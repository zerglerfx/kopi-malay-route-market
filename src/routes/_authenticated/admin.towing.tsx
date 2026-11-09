import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listTowing, updateTowing } from "@/lib/admin.functions";
import { TOWING_STATUSES } from "@/lib/towing";

export const Route = createFileRoute("/_authenticated/admin/towing")({ component: TowingAdmin });

function TowingAdmin() {
  const fetchAll = useServerFn(listTowing);
  const save = useServerFn(updateTowing);
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "towing"], queryFn: () => fetchAll() });
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted text-left font-display text-xs uppercase">
          <tr>{["Ref", "Rider", "Motorcycle", "Breakdown", "Destination", "Map", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <tr key={t.id} className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs">{t.reference}<div className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div></td>
              <td className="px-3 py-2">{t.name}<div><a href={`tel:${t.phone}`} className="underline">{t.phone}</a></div></td>
              <td className="px-3 py-2">{t.motorcycle_model}<div className="text-xs text-muted-foreground">{t.plate_number}</div></td>
              <td className="max-w-[220px] px-3 py-2">{t.breakdown_location}</td>
              <td className="max-w-[220px] px-3 py-2">{t.destination}</td>
              <td className="px-3 py-2">{t.pickup_lat != null ? <a target="_blank" rel="noreferrer" className="underline" href={`https://www.google.com/maps?q=${t.pickup_lat},${t.pickup_lng}`}>Open map</a> : "—"}</td>
              <td className="px-3 py-2">
                <select value={t.status} onChange={async (e) => {
                  try { await save({ data: { id: t.id, status: e.target.value as (typeof TOWING_STATUSES)[number] } }); toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "towing"] }); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                }} className="rounded border bg-card px-2 py-1 text-xs capitalize">
                  {TOWING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {!data.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No towing requests yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
