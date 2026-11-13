import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listPromos, savePromo } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/promos")({ component: PromosAdmin });

type Draft = {
  id?: string; code: string; discount_type: "percentage" | "fixed_amount"; discount_value: string; discount_myr: string; discount_thb: string; receipt_discount_thb: string;
  min_order_myr: string; min_order_thb: string; max_uses: string; is_active: boolean; expires_at: string;
};
const EMPTY: Draft = { code: "", discount_type: "percentage", discount_value: "", discount_myr: "", discount_thb: "", receipt_discount_thb: "", min_order_myr: "", min_order_thb: "", max_uses: "", is_active: true, expires_at: "" };
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const str = (n: unknown) => (n == null ? "" : String(n));
const input = "w-full rounded border bg-card px-2 py-1.5 text-sm";

function PromosAdmin() {
  const fetchAll = useServerFn(listPromos);
  const save = useServerFn(savePromo);
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "promos"], queryFn: () => fetchAll() });
  const [d, setD] = useState<Draft | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d) return;
    const fixed = d.discount_type === "fixed_amount";
    if (d.receipt_discount_thb.trim() !== "" && !/^\d+(\.\d{1,2})?$/.test(d.receipt_discount_thb.trim())) { toast.error("THB off on receipt: numbers only, zero or more, up to two decimals"); return; }
    try {
      await save({ data: {
        id: d.id, code: d.code, discount_type: d.discount_type,
        discount_value: fixed ? Number(d.discount_myr || 0) : Number(d.discount_value || 0),
        discount_myr: fixed ? num(d.discount_myr) : null, discount_thb: fixed ? num(d.discount_thb) : null, receipt_discount_thb: num(d.receipt_discount_thb),
        min_order_myr: num(d.min_order_myr), min_order_thb: num(d.min_order_thb), max_uses: num(d.max_uses),
        is_active: d.is_active, expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : null,
      } });
      toast.success("Promo saved"); setD(null); qc.invalidateQueries({ queryKey: ["admin", "promos"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
  };

  if (error) return <p className="text-destructive">{error.message}</p>;
  return (
    <div className="space-y-4">
      <button onClick={() => setD({ ...EMPTY })} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">+ New promo code</button>
      <Dialog open={!!d} onOpenChange={(o) => { if (!o) setD(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{d?.id ? "Edit promo code" : "New promo code"}</DialogTitle></DialogHeader>
      {d && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">Code<input required className={input} value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase() })} /></label>
          <label className="text-sm">Type<select className={input} value={d.discount_type} onChange={(e) => setD({ ...d, discount_type: e.target.value as Draft["discount_type"] })}><option value="percentage">Percentage %</option><option value="fixed_amount">Fixed amount</option></select></label>
          {d.discount_type === "percentage"
            ? <><label className="text-sm">Percent off<input required type="number" min={1} max={100} className={input} value={d.discount_value} onChange={(e) => setD({ ...d, discount_value: e.target.value })} /></label>
                <label className="text-sm">THB off on receipt (RM orders)<input type="number" step="0.01" min={0} inputMode="decimal" className={input} value={d.receipt_discount_thb} onChange={(e) => setD({ ...d, receipt_discount_thb: e.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">Used only on the POS receipt for RM orders. Does not change what customers see or pay.</span></label></>
            : <>
                <label className="text-sm">RM off<input required type="number" step="0.01" min={0} className={input} value={d.discount_myr} onChange={(e) => setD({ ...d, discount_myr: e.target.value })} /></label>
                <label className="text-sm">THB off on receipt (RM orders)<input type="number" step="0.01" min={0} inputMode="decimal" className={input} value={d.receipt_discount_thb} onChange={(e) => setD({ ...d, receipt_discount_thb: e.target.value })} /><span className="mt-1 block text-xs text-muted-foreground">Used only on the POS receipt for RM orders. Does not change what customers see or pay.</span></label>
                <label className="text-sm">THB off<input required type="number" step="0.01" min={0} className={input} value={d.discount_thb} onChange={(e) => setD({ ...d, discount_thb: e.target.value })} /></label>
              </>}
          <label className="text-sm">Min order RM<input type="number" step="0.01" min={0} className={input} value={d.min_order_myr} onChange={(e) => setD({ ...d, min_order_myr: e.target.value })} /></label>
          <label className="text-sm">Min order THB<input type="number" step="0.01" min={0} className={input} value={d.min_order_thb} onChange={(e) => setD({ ...d, min_order_thb: e.target.value })} /></label>
          <label className="text-sm">Max uses<input type="number" min={1} className={input} value={d.max_uses} onChange={(e) => setD({ ...d, max_uses: e.target.value })} /></label>
          <label className="text-sm">Expires<input type="date" className={input} value={d.expires_at} onChange={(e) => setD({ ...d, expires_at: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} /> Active</label>
          <div className="flex gap-2 sm:col-span-4">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            <button type="button" onClick={() => setD(null)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}
        </DialogContent>
      </Dialog>
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted text-left font-display text-xs uppercase"><tr>{["Code", "Discount", "Minimum", "Used", "Expires", "Active", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                  <td className="px-3 py-2">{p.discount_type === "percentage" ? `${Number(p.discount_value)}%` : `RM ${str(p.discount_myr)} / THB ${str(p.discount_thb)}`}</td>
                  <td className="px-3 py-2">{p.min_order_myr != null || p.min_order_thb != null ? `RM ${str(p.min_order_myr) || "—"} / THB ${str(p.min_order_thb) || "—"}` : "—"}</td>
                  <td className="px-3 py-2">{p.current_uses}{p.max_uses != null ? ` / ${p.max_uses}` : ""}</td>
                  <td className="px-3 py-2">{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "Never"}</td>
                  <td className="px-3 py-2">{p.is_active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2"><button className="underline" onClick={() => setD({
                    id: p.id, code: p.code, discount_type: p.discount_type, discount_value: str(p.discount_value), discount_myr: str(p.discount_myr), discount_thb: str(p.discount_thb), receipt_discount_thb: str(p.receipt_discount_thb),
                    min_order_myr: str(p.min_order_myr), min_order_thb: str(p.min_order_thb), max_uses: str(p.max_uses), is_active: p.is_active, expires_at: p.expires_at?.slice(0, 10) ?? "",
                  })}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
