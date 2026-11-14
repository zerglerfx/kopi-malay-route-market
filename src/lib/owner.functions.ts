import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PIN_RE } from "./owner-pin";

async function ownerSetup(context: unknown) {
  const { assertOwner } = await import("./owner-pin.server");
  const userId = await assertOwner(context as never);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email_confirmed_at ? data.user.email : null;
  if (!email) throw new Error("Owner email is not confirmed");
  return { admin: supabaseAdmin, userId, email };
}

/** Whether the caller is an owner, and their PIN state. Non-owners get { isOwner: false }. */
export const getOwnerPinStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const c = context as unknown as { supabase: { rpc: (f: "has_role", a: { _user_id: string; _role: "owner" }) => PromiseLike<{ data: boolean | null }> }; userId: string };
  const { data: isOwner } = await c.supabase.rpc("has_role", { _user_id: c.userId, _role: "owner" });
  if (!isOwner) return { isOwner: false as const, hasPin: false, lockedUntil: null as string | null, email: "" };
  const { admin, userId, email } = await ownerSetup(context);
  const { data } = await admin.from("owner_pins").select("locked_until").eq("user_id", userId).maybeSingle();
  const locked = data?.locked_until && new Date(data.locked_until) > new Date() ? data.locked_until : null;
  return { isOwner: true as const, hasPin: !!data, lockedUntil: locked, email };
});

/** Emails a 6-digit code to the signed-in owner's own address (max 5/hour, 10-min expiry). */
export const requestOwnerPinCode = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { admin, userId, email } = await ownerSetup(context);
  const { newCode, hashCode } = await import("./owner-pin.server");
  const code = newCode();
  const { data: id, error } = await admin.rpc("issue_owner_pin_code", { _user: userId, _hash: await hashCode(userId, code) });
  if (error) throw new Error(error.message);
  if (!id) return { ok: false as const, error: "Too many codes requested. You can request up to 5 codes per hour — please try again later." };
  const { sendTemplateEmail } = await import("./email-templates/send-email");
  try {
    const r = await sendTemplateEmail("owner-pin-code", email, { templateData: { code }, idempotencyKey: `owner-pin-code-${id}` });
    if (!r.sent) return { ok: false as const, error: "Your email address is blocked from receiving store emails." };
  } catch (e) {
    console.error("[owner-pin] email send failed", e);
    await admin.from("owner_pin_codes").update({ used_at: new Date().toISOString() }).eq("id", id as string);
    return { ok: false as const, error: "Could not send the code email. Please try again in a minute." };
  }
  const [name, domain] = email.split("@");
  return { ok: true as const, sentTo: `${(name ?? "").slice(0, 2)}***@${domain ?? ""}` };
});

/** Sets or resets the owner PIN after a valid email code. */
export const setOwnerPin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"), pin: z.string().regex(PIN_RE, "PIN must be exactly 6 digits") }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, userId, email } = await ownerSetup(context);
    const { hashCode, hashPin, newSalt } = await import("./owner-pin.server");
    const { data: result } = await admin.rpc("check_owner_pin_code", { _user: userId, _hash: await hashCode(userId, data.code) });
    if (result !== "ok") {
      const msg = result === "wrong" ? "Incorrect code. Please check your email and try again." : result === "exhausted" ? "Too many wrong codes. Please request a new code." : "This code has expired or was already used. Please request a new code.";
      return { ok: false as const, error: msg };
    }
    const { data: existing } = await admin.from("owner_pins").select("user_id").eq("user_id", userId).maybeSingle();
    const salt = newSalt();
    const { error } = await admin.from("owner_pins").upsert({ user_id: userId, salt, pin_hash: await hashPin(data.pin, salt), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    const { sendTelegram, escHtml } = await import("./telegram.server");
    void sendTelegram(`🔑 <b>Owner PIN ${existing ? "reset" : "set"}</b>\n• Owner: ${escHtml(email)}\n• Time: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}`, "pin-set");
    return { ok: true as const };
  });

/** Lets an owner check their PIN (same lockout rules as Refund/Undo Verify). */
export const testOwnerPin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pin: z.string().max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, userId, email } = await ownerSetup(context);
    const { verifyOwnerPin } = await import("./owner-pin.server");
    return verifyOwnerPin(admin, userId, data.pin, email);
  });
