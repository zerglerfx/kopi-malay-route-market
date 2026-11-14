import { describe, expect, it } from "vitest";
import { isValidPin } from "@/lib/owner-pin";
import { assertOwner, hashCode, hashPin, newCode } from "@/lib/owner-pin.server";

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
});
