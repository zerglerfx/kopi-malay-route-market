/** Browser-safe display helpers for Owner / Staff / Customer labels. Roles are always resolved on the server. */
export type UserKind = "owner" | "staff" | "customer";
export type PlacedBy = UserKind | "guest";
export const ROLE_ORDER: UserKind[] = ["owner", "staff", "customer"];
export const ROLE_LABEL: Record<UserKind, string> = { owner: "Owner", staff: "Staff (Admin)", customer: "Customer" };
export const PLACED_LABEL: Record<PlacedBy, string> = { owner: "Owner", staff: "Staff", customer: "Customer", guest: "Guest" };
export const DELETED_ACCOUNT = "Deleted account";

/** Highest role wins: Owner > Staff > Customer. */
export function highestRole(roles: readonly string[]): UserKind {
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "staff";
  return "customer";
}

export type RoleIndex = { roles: Map<string, string[]>; existing: Set<string> };
export function buildRoleIndex(rows: { user_id: string; role: string }[], existingIds: Iterable<string>): RoleIndex {
  const roles = new Map<string, string[]>();
  for (const r of rows) roles.set(r.user_id, [...(roles.get(r.user_id) ?? []), r.role]);
  return { roles, existing: new Set(existingIds) };
}

/** Order badge. No account → guest; deleted account → null (no badge). */
export function orderPlacer(userId: string | null | undefined, idx: RoleIndex): PlacedBy | null {
  if (!userId) return "guest";
  if (!idx.existing.has(userId)) return null;
  return highestRole(idx.roles.get(userId) ?? []);
}

/** Timeline badge: only Owner or Staff; deleted or role-less accounts → null. */
export function actorBadge(userId: string | null | undefined, idx: RoleIndex): "owner" | "staff" | null {
  if (!userId || !idx.existing.has(userId)) return null;
  const r = highestRole(idx.roles.get(userId) ?? []);
  return r === "customer" ? null : r;
}

export function sortUsersByRole<T extends { role: UserKind; created_at: string }>(users: T[]): T[] {
  return [...users].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.created_at.localeCompare(a.created_at));
}
export function roleCounts(users: { role: UserKind }[]) {
  return { all: users.length, owner: users.filter((u) => u.role === "owner").length, staff: users.filter((u) => u.role === "staff").length, customer: users.filter((u) => u.role === "customer").length };
}
export const filterByRole = <T extends { role: UserKind }>(users: T[], f: UserKind | "all") => (f === "all" ? users : users.filter((u) => u.role === f));

// ---------- Role change log (read-only) ----------
export type RoleAuditRow = { id: string; changed_at: string; action: string; changed_by: string; changed_by_email: string; target_user_id: string; target_email: string };
export type RoleChangeEntry = { id: string; changed_at: string; action: "grant" | "remove"; target: string; target_deleted: boolean; actor: string; actor_deleted: boolean; actor_role: "owner" | "staff" | null };
export const ROLE_CHANGE_PAGE = 25;

export function buildRoleChanges(rows: RoleAuditRow[], idx: RoleIndex, f: { q?: string | undefined; action?: "all" | "grant" | "remove" | undefined; offset?: number | undefined }) {
  const q = (f.q ?? "").trim().toLowerCase();
  const all: RoleChangeEntry[] = rows.map((r) => {
    const td = !idx.existing.has(r.target_user_id), ad = !idx.existing.has(r.changed_by);
    return { id: r.id, changed_at: r.changed_at, action: (r.action === "grant" ? "grant" : "remove") as "grant" | "remove",
      target: td ? DELETED_ACCOUNT : r.target_email, target_deleted: td,
      actor: ad ? DELETED_ACCOUNT : r.changed_by_email, actor_deleted: ad, actor_role: actorBadge(r.changed_by, idx) };
  }).sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  const matched = all.filter((e) => (!f.action || f.action === "all" || e.action === f.action) && (!q || `${e.target} ${e.actor}`.toLowerCase().includes(q)));
  const offset = Math.max(0, f.offset ?? 0);
  return { total: matched.length, entries: matched.slice(0, offset + ROLE_CHANGE_PAGE) };
}
