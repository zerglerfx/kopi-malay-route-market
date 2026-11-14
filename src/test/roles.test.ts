import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { actorBadge, buildRoleChanges, buildRoleIndex, DELETED_ACCOUNT, filterByRole, highestRole, orderPlacer, roleCounts, sortUsersByRole, type RoleAuditRow } from "@/lib/roles";
import { assertOwnerCaller } from "@/lib/owner-gate.server";
import { filterOrders } from "@/lib/admin-csv";

const idx = buildRoleIndex([{ user_id: "o", role: "owner" }, { user_id: "o", role: "admin" }, { user_id: "s", role: "admin" }, { user_id: "gone", role: "admin" }], ["o", "s", "c"]);
const ctx = (roles: string[]) => ({ userId: "u", supabase: { rpc: async (_: "has_role", a: { _role: string }) => ({ data: roles.includes(a._role) }) } });

describe("role labels", () => {
  it("shows the highest role for each kind", () => {
    expect(highestRole(["owner", "admin"])).toBe("owner");
    expect(highestRole(["admin"])).toBe("staff");
    expect(highestRole([])).toBe("customer");
  });
  it("filter counts match the list and sort is role then newest", () => {
    const users = [
      { id: "1", role: "customer" as const, created_at: "2026-03-01" }, { id: "2", role: "owner" as const, created_at: "2026-01-01" },
      { id: "3", role: "staff" as const, created_at: "2026-02-01" }, { id: "4", role: "customer" as const, created_at: "2026-04-01" },
    ];
    const c = roleCounts(users);
    for (const k of ["owner", "staff", "customer"] as const) expect(c[k]).toBe(filterByRole(users, k).length);
    expect(c.all).toBe(filterByRole(users, "all").length);
    expect(sortUsersByRole(users).map((u) => u.id)).toEqual(["2", "3", "4", "1"]);
  });
  it("rejects staff admins and customers from owner-only lists", async () => {
    await expect(assertOwnerCaller(ctx(["admin"]))).rejects.toThrow(/owner access required/);
    await expect(assertOwnerCaller(ctx([]))).rejects.toThrow(/owner access required/);
    await expect(assertOwnerCaller(ctx(["admin", "owner"]))).resolves.toBeUndefined();
  });
  it("order badge for guest, customer, staff and owner orders", () => {
    expect(orderPlacer(null, idx)).toBe("guest");
    expect(orderPlacer("c", idx)).toBe("customer");
    expect(orderPlacer("s", idx)).toBe("staff");
    expect(orderPlacer("o", idx)).toBe("owner");
  });
  it("deleted or role-less accounts give no badge and no error", () => {
    expect(orderPlacer("gone", idx)).toBeNull();
    expect(actorBadge("gone", idx)).toBeNull();
    expect(actorBadge("c", idx)).toBeNull();
    expect(actorBadge(undefined, idx)).toBeNull();
    expect(actorBadge("s", idx)).toBe("staff");
  });
  it("Placed by filter narrows orders (used by both list and CSV)", () => {
    const base = { order_number: "A", created_at: "2026-01-01", status: "verified", currency: "myr", total_amount: 1, payment_method: "x", tracking_number: null, email: null, address: {}, items: [] };
    const rows = [{ ...base, placed_by: "staff" }, { ...base, placed_by: "guest" }];
    expect(filterOrders(rows, { placed_by: "staff" })).toHaveLength(1);
  });
});

describe("role change log", () => {
  const rows: RoleAuditRow[] = [
    { id: "1", changed_at: "2026-01-01T00:00:00Z", action: "grant", changed_by: "o", changed_by_email: "o@x.com", target_user_id: "s", target_email: "s@x.com" },
    { id: "2", changed_at: "2026-03-01T00:00:00Z", action: "remove", changed_by: "o", changed_by_email: "o@x.com", target_user_id: "gone", target_email: "gone@x.com" },
    { id: "3", changed_at: "2026-02-01T00:00:00Z", action: "grant", changed_by: "o", changed_by_email: "o@x.com", target_user_id: "gone", target_email: "gone@x.com" },
  ];
  it("is newest first", () => expect(buildRoleChanges(rows, idx, {}).entries.map((e) => e.id)).toEqual(["2", "3", "1"]));
  it("search and filter work together", () => {
    const r = buildRoleChanges(rows, idx, { q: "s@x", action: "grant" });
    expect(r.entries.map((e) => e.id)).toEqual(["1"]);
    expect(r.total).toBe(1);
  });
  it("deleted accounts show Deleted account", () => {
    const e = buildRoleChanges(rows, idx, {}).entries.find((x) => x.id === "2")!;
    expect(e.target).toBe(DELETED_ACCOUNT);
    expect(e.actor_role).toBe("owner");
  });
  it("pages 25 at a time", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...rows[0]!, id: String(i), changed_at: `2026-01-${String(i + 1).padStart(2, "0")}` }));
    expect(buildRoleChanges(many, idx, {}).entries).toHaveLength(25);
    expect(buildRoleChanges(many, idx, { offset: 25 }).entries).toHaveLength(30);
  });
  it("exposes no create, update or delete function for the log", () => {
    const src = readFileSync("src/lib/admin.functions.ts", "utf8");
    const exported = [...src.matchAll(/export const (\w+)/g)].map((m) => m[1]!);
    expect(exported.filter((n) => /role ?change|audit/i.test(n))).toEqual(["listRoleChanges"]);
    expect(src).not.toMatch(/from\("admin_role_audit"\)\.(insert|update|delete|upsert)/);
  });
});
