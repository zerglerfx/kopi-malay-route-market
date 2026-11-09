import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listUsers, setAdminRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: UsersAdmin });

function UsersAdmin() {
  const fetchAll = useServerFn(listUsers);
  const save = useServerFn(setAdminRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fetchAll() });
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  const rows = data.filter((u) => u.email.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email…" className="w-full max-w-xs rounded-md border bg-card px-3 py-2" />
        <span className="text-sm text-muted-foreground">{data.length} registered members</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted text-left font-display text-xs uppercase">
            <tr>{["Email", "Sign-in", "Joined", "Last sign-in", "Orders", "Admin"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 capitalize">{u.provider}</td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">{u.orders}</td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={u.is_admin} onChange={async (e) => {
                      try { await save({ data: { user_id: u.id, admin: e.target.checked } }); toast.success("Access updated"); qc.invalidateQueries({ queryKey: ["admin", "users"] }); }
                      catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                    }} />
                    {u.is_admin ? "Admin" : "Member"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
