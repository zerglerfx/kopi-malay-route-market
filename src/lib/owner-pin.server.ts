// Server-only Owner PIN crypto (Web Crypto, workerd-safe). The pepper lives in project secrets, never the database.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function pepper(): string {
  const p = process.env["OWNER_PIN_PEPPER"];
  if (!p) throw new Error("Owner PIN is not configured");
  return p;
}

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

/** PBKDF2-SHA256, 100k iterations, per-PIN salt + secret pepper. */
export async function hashPin(pin: string, salt: string, pep = pepper()): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(`${pin}:${pep}`), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return hex(bits);
}

/** HMAC-SHA256 of the email code, bound to the owner, keyed by the pepper. */
export async function hashCode(userId: string, code: string, pep = pepper()): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pep), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${userId}:${code}`)));
}

export function newCode(): string {
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

type RoleCtx = { supabase?: { rpc: (fn: "has_role", args: { _user_id: string; _role: "owner" }) => PromiseLike<{ data: boolean | null }> }; userId?: string };

/** Rejects anyone who is not an owner (admin-only accounts included), checked as the caller. */
export async function assertOwner(ctx: RoleCtx): Promise<string> {
  if (!ctx?.supabase?.rpc || !ctx.userId) throw new Error("Please sign in again");
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "owner" });
  if (!data) throw new Error("Forbidden: owner access required");
  return ctx.userId;
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export type PinCheck = { ok: true } | { ok: false; reason: "not_set" | "locked" | "wrong"; lockedUntil?: string };

/** Verifies an owner PIN; a wrong PIN only increments the atomic failure counter (5 → 15-min lock). */
export async function verifyOwnerPin(admin: Admin, userId: string, pin: string, ownerEmail: string): Promise<PinCheck> {
  const { data: row } = await admin.from("owner_pins").select("pin_hash,salt,locked_until").eq("user_id", userId).maybeSingle();
  if (!row) return { ok: false, reason: "not_set" };
  if (row.locked_until && new Date(row.locked_until) > new Date()) return { ok: false, reason: "locked", lockedUntil: row.locked_until };
  if (/^\d{6}$/.test(pin) && safeEqual(await hashPin(pin, row.salt), row.pin_hash)) {
    await admin.from("owner_pins").update({ failed_attempts: 0 }).eq("user_id", userId);
    return { ok: true };
  }
  const { data: lockedUntil } = await admin.rpc("register_owner_pin_failure", { _user: userId });
  if (lockedUntil) {
    const { sendTelegram, escHtml } = await import("./telegram.server");
    void sendTelegram(`🔒 <b>Owner PIN locked</b>\n• Owner: ${escHtml(ownerEmail)}\n• Reason: 5 wrong PIN attempts\n• Locked until: ${new Date(lockedUntil as string).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}`, "pin-lock");
    return { ok: false, reason: "locked", lockedUntil: lockedUntil as string };
  }
  return { ok: false, reason: "wrong" };
}
