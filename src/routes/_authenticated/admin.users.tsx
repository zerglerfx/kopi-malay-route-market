import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listRoleChanges, listUsers, setAdminRole } from "@/lib/admin.functions";
import { filterByRole, roleCounts, ROLE_CHANGE_PAGE, ROLE_LABEL, type UserKind } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users · Kopi Malay Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsersAdmin,
});

function UsersAdmin() {
  const [tab, setTab] = useState<"users" | "log">("users");
  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist">
        {([["users", "Users"], ["log", "Role changes"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "bg-card"}`}>{l}</button>
        ))}
      </div>
      {tab === "users" ? <UserList /> : <RoleChanges />}
    </div>
  );
}

const RoleBadge = ({ role }: { role: UserKind }) => <span className={`rounded px-2 py-0.5 text-xs font-semibold ${role === "owner" ? "bg-primary text-primary-foreground" : role === "staff" ? "border border-foreground" : "border text-muted-foreground"}`}>{ROLE_LABEL[role]}</span>;

function UserList() {
  const fetchAll = useServerFn(listUsers);
  const save = useServerFn(setAdminRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserKind | "all">("all");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fetchAll() });
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  const counts = roleCounts(data);
  const rows = filterByRole(data, role).filter((u) => [u.email, u.profile?.full_name, u.profile?.phone].join(" ").toLowerCase().includes(q.toLowerCase()));
  const chips: [UserKind | "all", string, number][] = [["all", "All", counts.all], ["owner", "Owners", counts.owner], ["staff", "Staff", counts.staff], ["customer", "Customers", counts.customer]];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(([k, l, n]) => <button key={k} aria-pressed={role === k} onClick={() => setRole(k)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${role === k ? "bg-primary text-primary-foreground" : "bg-card"}`}>{l} ({n})</button>)}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name or phone…" className="w-full max-w-xs rounded-md border bg-card px-3 py-2" />
        <span className="text-sm text-muted-foreground">{rows.length} shown</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted text-left font-display text-xs uppercase">
            <tr>{["Role", "Email", "Name", "Phone", "Region", "Motorcycle", "Contact", "Sign-in", "Signed up", "Last sign-in", "Orders", "Email", "Staff access (Admin)"].map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.profile?.full_name || "—"}</td>
                <td className="px-3 py-2">{u.profile?.phone || "—"}</td>
                <td className="px-3 py-2 capitalize">{[u.profile?.city, u.profile?.state, u.profile?.country].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-3 py-2">{[u.profile?.motorcycle_make, u.profile?.motorcycle_model, u.profile?.motorcycle_plate].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2 capitalize">{u.profile?.preferred_contact || "—"}</td>
                <td className="px-3 py-2 capitalize">{u.provider}</td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">{u.orders}</td>
                <td className="px-3 py-2">
                  <span className={u.email_confirmed ? "rounded border px-2 py-0.5 text-xs" : "rounded border border-dashed px-2 py-0.5 text-xs text-muted-foreground"}>{u.email_confirmed ? "Confirmed" : "Unconfirmed"}</span>
                </td>
                <td className="px-3 py-2">
                  {u.is_owner ? <span className="text-xs font-semibold">Owner</span> : (
                    <label title={!u.email_confirmed && !u.is_admin ? "Email must be confirmed first" : undefined} className="flex items-center gap-2">
                      <input type="checkbox" aria-label={`Staff access (Admin) for ${u.email}`} checked={u.is_admin} disabled={!u.is_admin && !u.email_confirmed} onChange={async (e) => {
                        try { await save({ data: { user_id: u.id, admin: e.target.checked } }); toast.success("Access updated"); qc.invalidateQueries({ queryKey: ["admin"] }); }
                        catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                      }} />
                      Staff access (Admin)
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleChanges() {
  const fetchLog = useServerFn(listRoleChanges);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"all" | "grant" | "remove">("all");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error, isFetching } = useQuery({ queryKey: ["admin", "role-changes", q, action, offset], queryFn: () => fetchLog({ data: { q, action, offset } }), placeholderData: keepPreviousData });
  const reset = () => setOffset(0);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search email…" aria-label="Search role changes" className="w-full rounded-md border bg-card px-3 py-2 sm:max-w-xs" />
        <select aria-label="Action filter" value={action} onChange={(e) => { setAction(e.target.value as typeof action); reset(); }} className="rounded-md border bg-card px-2 py-2 text-sm">
          <option value="all">All</option><option value="grant">Granted</option><option value="remove">Removed</option>
        </select>
        {data && <span className="text-sm text-muted-foreground">{data.total} entries</span>}
      </div>
      {error ? <p className="mt-4 text-destructive">{error.message}</p> : isLoading ? <p className="mt-4 text-muted-foreground">Loading…</p> : !data?.entries.length ? <p className="mt-4 text-muted-foreground">No role changes recorded.</p> : (
        <ul className="mt-4 divide-y rounded-md border">
          {data.entries.map((e) => (
            <li key={e.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_12rem_1fr_1fr] sm:items-center sm:gap-3">
              <span className="text-xs text-muted-foreground">{new Date(e.changed_at).toLocaleString()}</span>
              <span className="font-semibold">{e.action === "grant" ? "Staff access granted" : "Staff access removed"}</span>
              <span className={`break-all ${e.target_deleted ? "italic text-muted-foreground" : ""}`}><span className="text-xs text-muted-foreground sm:hidden">Account: </span>{e.target}</span>
              <span className={`break-all ${e.actor_deleted ? "italic text-muted-foreground" : ""}`}><span className="text-xs text-muted-foreground">By </span>{e.actor}{e.actor_role && <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">{e.actor_role === "owner" ? "Owner" : "Staff"}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {data && data.entries.length < data.total && <button disabled={isFetching} onClick={() => setOffset(data.entries.length)} className="mt-3 rounded-md border px-4 py-2 text-sm font-semibold">{isFetching ? "Loading…" : `Load more (${ROLE_CHANGE_PAGE})`}</button>}
    </div>
  );
}
