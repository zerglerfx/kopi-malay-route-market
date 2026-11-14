import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidPin } from "@/lib/owner-pin";
import { assertOwner, hashCode, hashPin, newCode, verifyOwnerPin } from "@/lib/owner-pin.server";

const { sendTelegram } = vi.hoisted(() => ({ sendTelegram: vi.fn() }));
vi.mock("@/lib/telegram.server", () => ({ sendTelegram, escHtml: (s: string) => s }));

beforeEach(() => { sendTelegram.mockReset(); });

function pinAdmin(lockedUntil: string | null, alreadyLocked = false) {
  const rpc = vi.fn().mockResolvedValue({ data: lockedUntil });
  const update = vi.fn();
  const admin = {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { pin_hash: "unused", salt: "unused", locked_until: alreadyLocked ? lockedUntil : null } }) }) }),
      update,
    })),
    rpc,
  };
  return { admin: admin as unknown as Parameters<typeof verifyOwnerPin>[0], rpc, update };
}

const ctx = (owner: boolean) => ({ userId: "u1", supabase: { rpc: async (_f: "has_role", a: { _role: string }) => ({ data: a._role === "owner" ? owner : true }) } });

describe("owner PIN", () => {
  it("accepts exactly 6 digits only", () => {
    expect(isValidPin("123456")).toBe(true);
    for (const p of ["12345", "1234567", "12345a", " 123456", ""]) expect(isValidPin(p)).toBe(false);
  });
  it("rejects an admin-only account", async () => {
    await expect(assertOwner(ctx(false))).rejects.toThrow(/owner access required/);
    await expect(assertOwner(ctx(true))).resolves.toBe("u1");
  });
  it("PIN hash depends on salt and pepper", async () => {
    const a = await hashPin("123456", "s1", "pepA");
    expect(await hashPin("123456", "s1", "pepA")).toBe(a);
    expect(await hashPin("123456", "s2", "pepA")).not.toBe(a);
    expect(await hashPin("123456", "s1", "pepB")).not.toBe(a);
    expect(await hashPin("654321", "s1", "pepA")).not.toBe(a);
  });
  it("code hash is bound to the owner", async () => {
    expect(await hashCode("u1", "111111", "p")).not.toBe(await hashCode("u2", "111111", "p"));
    expect(newCode()).toMatch(/^\d{6}$/);
  });
  it("waits for the fifth-attempt lock alert before responding", async () => {
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    const { admin, rpc, update } = pinAdmin(until);
    let finishDelivery: (value: boolean) => void = () => { throw new Error("Delivery not started"); };
    sendTelegram.mockImplementation(() => new Promise<boolean>((resolve) => { finishDelivery = resolve; }));
    let returned = false;
    const result = verifyOwnerPin(admin, "u1", "bad", "owner@example.test").then((r) => { returned = true; return r; });
    await vi.waitFor(() => expect(sendTelegram).toHaveBeenCalledTimes(1));
    expect(returned).toBe(false);
    expect(rpc).toHaveBeenCalledWith("register_owner_pin_failure", { _user: "u1" });
    expect(update).not.toHaveBeenCalled();
    finishDelivery(true);
    await expect(result).resolves.toEqual({ ok: false, reason: "locked", lockedUntil: until });
  });
  it("keeps the lockout when Telegram reports a delivery failure", async () => {
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    const { admin } = pinAdmin(until);
    sendTelegram.mockResolvedValue(false);
    await expect(verifyOwnerPin(admin, "u1", "bad", "owner@example.test")).resolves.toEqual({ ok: false, reason: "locked", lockedUntil: until });
  });
  it("does not send another alert or count attempts while already locked", async () => {
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    const { admin, rpc } = pinAdmin(until, true);
    await expect(verifyOwnerPin(admin, "u1", "bad", "owner@example.test")).resolves.toEqual({ ok: false, reason: "locked", lockedUntil: until });
    expect(rpc).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });
});
