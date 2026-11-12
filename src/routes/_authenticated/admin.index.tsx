import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ImagePlus, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { exportOrdersCsv, listOrders, markOrderStock, setTrackingLabel, updateOrder, type AdminOrder } from "@/lib/admin.functions";
import { STOCK_LABEL } from "@/lib/order-stock";
import { filterOrders, fullAddress, itemsText, money, orderTotals, statusOptions, type AdminOrderRow, type OrderFilters } from "@/lib/admin-csv";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/")({ component: OrdersAdmin });

const STATUS = ["pending_verification", "verified", "rejected", "shipped", "completed", "pending", "paid"] as const;
const label = (s: string) => s.replace(/_/g, " ");

function OrdersAdmin() {
  const fetchOrders = useServerFn(listOrders);
  const save = useServerFn(updateOrder);
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "orders"], queryFn: () => fetchOrders() });
  const [filters, setFilters] = useState<OrderFilters>({});
  const setF = (k: keyof OrderFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));
  const [details, setDetails] = useState<AdminOrder | null>(null);
  const exportFn = useServerFn(exportOrdersCsv);
  const [exporting, setExporting] = useState(false);
  const [qr, setQr] = useState<AdminOrder | null>(null);
  const [labelOrder, setLabelOrder] = useState<AdminOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const saveLabel = useServerFn(setTrackingLabel);
  const markStock = useServerFn(markOrderStock);
  const [shortfall, setShortfall] = useState<{ item: string; needed: number; available: number }[] | null>(null);
  const markRestored = async (o: AdminOrder) => {
    if (!confirm(`Only do this after adding ${o.order_number}'s items back in Loyverse yourself. Mark as restored?`)) return;
    try { await markStock({ data: { id: o.id, stock_status: "restored" } }); toast.success("Marked as restored"); void qc.invalidateQueries({ queryKey: ["admin", "orders"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };

  const uploadLabel = async (o: AdminOrder, file: File | null) => {
    if (file && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Please choose a PNG, JPG or WEBP image"); return; }
    if (file && file.size > 5 * 1024 * 1024) { toast.error("Image must be 5MB or smaller"); return; }
    setBusy(o.id);
    try {
      const dataUrl = file ? await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); }) : null;
      await saveLabel({ data: { id: o.id, dataUrl } });
      toast.success(file ? "Courier label saved" : "Courier label removed");
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(null); }
  };

  const rows = useMemo(() => filterOrders(data, filters), [data, filters]);
  const statuses = useMemo(() => statusOptions(data), [data]);

  const patch = async (id: string, p: { status?: (typeof STATUS)[number]; tracking_number?: string | null }) => {
    try {
      const r = await save({ data: { id, ...p } });
      if (!r.ok) setShortfall(r.shortfall);
      else toast.success("Order updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { void qc.invalidateQueries({ queryKey: ["admin", "orders"] }); }
  };

  const exportCsv = async () => {
    setExporting(true);
    let csv: string;
    try { csv = await exportFn({ data: filters }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); return; }
    finally { setExporting(false); }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kopi-malay-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <p className="text-destructive">{error.message}</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={filters.q ?? ""} onChange={(e) => setF("q", e.target.value)} placeholder="Search ref, name, email, phone, product…" aria-label="Search orders" className="w-full max-w-xs rounded-md border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
        <select aria-label="Status filter" value={filters.status ?? ""} onChange={(e) => setF("status", e.target.value)} className="rounded-md border bg-card px-2 py-2 text-sm capitalize">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select aria-label="Country filter" value={filters.currency ?? ""} onChange={(e) => setF("currency", e.target.value)} className="rounded-md border bg-card px-2 py-2 text-sm">
          <option value="">All countries</option><option value="myr">Malaysia (MYR)</option><option value="thb">Thailand (THB)</option>
        </select>
        <label className="flex items-center gap-1 text-xs">From<input type="date" value={filters.from ?? ""} onChange={(e) => setF("from", e.target.value)} className="rounded-md border bg-card px-2 py-1.5 text-sm" /></label>
        <label className="flex items-center gap-1 text-xs">To<input type="date" value={filters.to ?? ""} onChange={(e) => setF("to", e.target.value)} className="rounded-md border bg-card px-2 py-1.5 text-sm" /></label>
        {Object.values(filters).some(Boolean) && <button onClick={() => setFilters({})} className="text-xs underline">Clear</button>}
        <span className="text-sm text-muted-foreground">{rows.length} orders</span>
        <button onClick={() => void exportCsv()} disabled={!rows.length || exporting} className="ml-auto flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Download className="size-4" /> {exporting ? "Exporting…" : "Export to Excel / CSV"}</button>
      </div>
      {isLoading ? <p className="mt-6 text-muted-foreground">Loading orders…</p> : (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted text-left font-display text-xs uppercase">
              <tr>{["NO.", "Name", "Address", "Phone Number", "Payment / Receipt", "Items", "Totals", "Courier Label / QR Code", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((o, i) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="px-3 py-2 font-semibold">{i + 1}<button onClick={() => setDetails(o)} className="block font-mono text-xs font-normal underline">{o.order_number}</button></td>
                  <td className="px-3 py-2">{o.address.name}<div className="text-xs text-muted-foreground">{o.email}</div></td>
                  <td className="max-w-[220px] px-3 py-2">{fullAddress(o.address)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{o.address.phone}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{money(o.currency, o.total_amount)}</div>
                    <div className="text-xs text-muted-foreground">{o.payment_method}{o.promo_code ? ` · ${o.promo_code}` : ""}</div>
                    {o.receipt_url ? <a href={o.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-medium underline">View receipt</a> : <span className="text-xs text-muted-foreground">No receipt</span>}
                    {o.status !== "verified" && o.status !== "rejected" && o.status !== "shipped" && o.status !== "completed" && <div className="mt-1 flex gap-1">
                      <button onClick={() => patch(o.id, { status: "verified" })} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Verify</button>
                      <button onClick={() => patch(o.id, { status: "rejected" })} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Reject</button>
                    </div>}
                  </td>
                  <td className="max-w-[260px] px-3 py-2">{itemsText(o.items)}<button onClick={() => setDetails(o)} className="mt-1 block text-xs font-medium underline">View details</button></td>
                  <td className="min-w-[180px] px-3 py-2"><Totals o={o} /></td>
                  <td className="w-[300px] px-3 py-2">
                    {o.label_url ? (
                      <button onClick={() => setLabelOrder(o)} aria-label="Open courier label" className="block w-full overflow-hidden rounded-md border bg-background">
                        <img src={o.label_url} alt={`Courier label for ${o.order_number}`} className="mx-auto max-h-56 w-full object-contain" />
                      </button>
                    ) : (
                      <div className="grid h-40 w-full place-items-center rounded-md border border-dashed text-xs text-muted-foreground">No courier label yet</div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <label className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border px-2 py-1 text-xs font-medium hover:bg-muted ${busy === o.id ? "pointer-events-none opacity-50" : ""}`}>
                        <ImagePlus className="size-3.5" /> {busy === o.id ? "Uploading…" : o.label_url ? "Replace J&T QR" : "Upload J&T QR"}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void uploadLabel(o, e.target.files?.[0] ?? null); e.target.value = ""; }} />
                      </label>
                      {o.label_url && <button aria-label="Remove courier label" disabled={busy === o.id} onClick={() => void uploadLabel(o, null)} className="rounded border px-2 py-1 hover:bg-muted"><Trash2 className="size-3.5" /></button>}
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-xs">{o.order_number}<button aria-label="Show QR code" onClick={() => setQr(o)}><QrCode className="size-4" /></button></div>
                    <input
                      defaultValue={o.tracking_number ?? ""} placeholder="Tracking no."
                      onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== o.tracking_number) void patch(o.id, { tracking_number: v }); }}
                      className="mt-1 w-full rounded border bg-card px-2 py-1 text-xs"
                    />
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select value={o.status} onChange={(e) => patch(o.id, { status: e.target.value as (typeof STATUS)[number] })} className="rounded border bg-card px-2 py-1 text-xs capitalize">
                      {STATUS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                    <div className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs ${o.stock_status === "deducted" ? "bg-primary text-primary-foreground" : o.stock_status === "unknown" ? "border-dashed" : "text-muted-foreground"}`}>{STOCK_LABEL[o.stock_status]}</div>
                    {o.stock_status === "unknown" && o.status === "rejected" && <button onClick={() => void markRestored(o)} className="mt-1 block rounded border px-2 py-0.5 text-xs hover:bg-muted">Mark restored</button>}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!qr} onOpenChange={(v) => !v && setQr(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>{qr?.order_number}</DialogTitle></DialogHeader>
          {qr && <div className="grid place-items-center gap-2 bg-background p-4"><QRCodeSVG value={`${qr.order_number}${qr.tracking_number ? ` | ${qr.tracking_number}` : ""}`} size={200} /><p className="text-sm">{qr.tracking_number ?? "No tracking number yet"}</p></div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!shortfall} onOpenChange={(v) => !v && setShortfall(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Not enough stock in Loyverse</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The order was not verified and no stock was changed.</p>
          <ul className="mt-2 space-y-1 text-sm">{shortfall?.map((s, i) => <li key={i} className="flex justify-between gap-4 border-b py-1"><span>{s.item}</span><span>need {s.needed} · have {s.available} · short {s.needed - s.available}</span></li>)}</ul>
        </DialogContent>
      </Dialog>
      <Dialog open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="font-mono">{details?.order_number}</DialogTitle></DialogHeader>
          {details && <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded border px-2 py-0.5 capitalize">{label(details.status)}</span>
              <span className="rounded border px-2 py-0.5">{STOCK_LABEL[details.stock_status]}</span>
              <span className="text-muted-foreground">{new Date(details.created_at).toLocaleString()}</span>
            </div>
            <div><div className="font-semibold">{details.address.name}</div><div>{details.email}</div><div>{details.address.phone}</div><div className="text-muted-foreground">{fullAddress(details.address)}</div></div>
            <ul className="divide-y rounded-md border">{details.items.map((it, k) => <li key={k} className="flex justify-between gap-3 px-3 py-1.5"><span>{it.product_name}{it.selected_variant ? ` (${it.selected_variant})` : ""}</span><span>× {it.quantity}</span></li>)}</ul>
            <div className="rounded-md border p-3"><Totals o={details} /></div>
            <div className="space-y-1">
              <div>Payment: {details.payment_method}</div>
              {details.receipt_url ? <a href={details.receipt_url} target="_blank" rel="noreferrer" className="font-medium underline">View receipt</a> : <span className="text-muted-foreground">No receipt</span>}
              <div>Tracking no.: {details.tracking_number ?? "—"}</div>
              {details.label_url && <img src={details.label_url} alt={`Courier label for ${details.order_number}`} className="max-h-48 rounded border object-contain" />}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!labelOrder} onOpenChange={(v) => !v && setLabelOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{labelOrder?.order_number} · {labelOrder?.tracking_number ?? "Courier label"}</DialogTitle></DialogHeader>
          {labelOrder?.label_url && <div className="bg-background p-2"><img src={labelOrder.label_url} alt={`Courier label for ${labelOrder.order_number}`} className="max-h-[75vh] w-full object-contain" /><a href={labelOrder.label_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">Open full size</a></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Totals({ o }: { o: AdminOrderRow }) {
  const t = orderTotals(o);
  const row = (k: string, v: string, strong = false) => <div className={`flex justify-between gap-3 text-xs ${strong ? "border-t pt-1 text-sm font-semibold" : ""}`}><span>{k}</span><span className="tabular-nums">{v}</span></div>;
  return (
    <div className="space-y-0.5">
      {row("Subtotal", money(o.currency, t.subtotal))}
      {t.bundle > 0 && row("Bundle savings", `− ${money(o.currency, t.bundle)}`)}
      {(t.promoCode || t.promo > 0) && row(`Promo${t.promoCode ? ` ${t.promoCode}` : ""}`, `− ${money(o.currency, t.promo)}`)}
      {row("Shipping", t.shipping > 0 ? `+ ${money(o.currency, t.shipping)}` : "Free")}
      {row("Total", money(o.currency, t.total), true)}
    </div>
  );
}
