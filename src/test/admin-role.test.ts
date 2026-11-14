import { describe, expect, it, vi } from "vitest";
import { runSetAdminRole, type AdminRoleDeps } from "@/lib/admin-role.server";

const base = { actorId: "owner", actorEmail: "o@x.com", targetId: "t", grant: true };
function deps(over: Partial<AdminRoleDeps> = {}, target = { email: "t@x.com", email_confirmed: true, is_owner: false }) {
  const audit: string[] = [];
  const d: AdminRoleDeps = {
    assertOwner: async () => {},
    getTarget: async () => target,
    write: vi.fn(async (g: boolean) => { audit.push(g ? "grant" : "remove"); return true; }),
    notify: vi.fn(async () => true),
    ...over,
  };
  return { d, audit };
}

describe("admin role management", () => {
  it("refuses to grant admin to an unconfirmed email", async () => {
    const { d, audit } = deps({}, { email: "t@x.com", email_confirmed: false, is_owner: false });
    await expect(runSetAdminRole(base, d)).rejects.toThrow(/confirmed email/);
    expect(audit).toEqual([]);
  });
  it("rejects a non-owner admin calling it directly", async () => {
    const { d, audit } = deps({ assertOwner: async () => { throw new Error("Owner only"); } });
    await expect(runSetAdminRole(base, d)).rejects.toThrow("Owner only");
    expect(audit).toEqual([]);
  });
  it("writes an audit row for each grant and removal", async () => {
    const { d, audit } = deps();
    await runSetAdminRole(base, d);
    await runSetAdminRole({ ...base, grant: false }, d);
    expect(audit).toEqual(["grant", "remove"]);
    expect(d.notify).toHaveBeenCalledTimes(2);
  });
  it("owners can't be changed", async () => {
    const { d, audit } = deps({}, { email: "t@x.com", email_confirmed: true, is_owner: true });
    await expect(runSetAdminRole({ ...base, grant: false }, d)).rejects.toThrow(/Owner/);
    expect(audit).toEqual([]);
  });
  it("a Telegram failure does not undo the change", async () => {
    const { d, audit } = deps({ notify: async () => { throw new Error("down"); } });
    await expect(runSetAdminRole(base, d)).resolves.toEqual({ ok: true, changed: true });
    expect(audit).toEqual(["grant"]);
  });
});
