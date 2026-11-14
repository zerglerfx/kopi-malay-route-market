import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, ImagePlus, QrCode, Trash2 } from "lucide-react";
import { canRefund, canUndoVerify, salesTotals, type OrderAction } from "@/lib/order-flow";
import { getOwnerPinStatus } from "@/lib/owner.functions";
import { QRCodeSVG } from "qrcode.react";
import { exportOrdersCsv, getOrderHistory, listOrders, markOrderStock, reverseOrder, setTrackingLabel, updateOrder, type AdminOrder } from "@/lib/admin.functions";
import { STOCK_LABEL } from "@/lib/order-stock";
import { filterOrders, fullAddress, itemsText, money, orderTotals, statusOptions, type AdminOrderRow, type OrderFilters } from "@/lib/admin-csv";
import { PLACED_LABEL, type PlacedBy } from "@/lib/roles";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({ component: OrdersAdmin, head: () => ({ meta: [{ title: "Orders | Kopi Malay Admin" }, { name: "description", content: "Manage Kopi Malay website orders and POS receipt history." }, { property: "og:title", content: "Orders | Kopi Malay Admin" }, { property: "og:description", content: "Manage Kopi Malay website orders and POS receipt history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }) });

const label = (s: string) => s.replace(/_/g, " ");
const RoleTag = ({ kind }: { kind: PlacedBy | null }) => kind ? <span className="ml-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{PLACED_LABEL[kind]}</span> : null;

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
  const [updating, setUpdating] = useState<string | null>(null);
  const [promoChoice, setPromoChoice] = useState<{ id: string; paidDiscount: number; currency: string; maxThb: number } | null>(null);
  const [promoValue, setPromoValue] = useState("");
  const saveLabel = useServerFn(setTrackingLabel);
  const markStock = useServerFn(markOrderStock);
  const [shortfall, setShortfall] = useState<{ item: string; needed: number; available: number }[] | null>(null);
  const markRestored = async (o: AdminOrder) => {
    if (!confirm(`Only do this after adding ${o.order_number}'s items back in Loyverse yourself. Mark as restored?`)) return;
    try { await markStock({ data: { id: o.id, stock_status: "restored" } }); toast.success("Marked as restored"); void qc.invalidateQueries({ queryKey: ["admin", "orders"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };

  const [progress, setProgress] = useState<{ id: string; name: string; pct: number } | null>(null);
  const [labelError, setLabelError] = useState<{ id: string; msg: string } | null>(null);
  const uploadLabel = async (o: AdminOrder, file: File | null) => {
    setLabelError(null);
    if (file && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setLabelError({ id: o.id, msg: `${file.name}: please use a PNG, JPG or WEBP image` }); return; }
    if (file && file.size > 5 * 1024 * 1024) { setLabelError({ id: o.id, msg: `${file.name}: image must be 5MB or smaller` }); return; }
    setBusy(o.id);
    if (file) setProgress({ id: o.id, name: file.name, pct: 0 });
    try {
      const dataUrl = file ? await new Promise<string>((res, rej) => { const r = new FileReader(); r.onprogress = (e) => e.lengthComputable && setProgress({ id: o.id, name: file.name, pct: Math.round((e.loaded / e.total) * 50) }); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); }) : null;
      if (file) setProgress({ id: o.id, name: file.name, pct: 75 });
      await saveLabel({ data: { id: o.id, dataUrl } });
      if (file) setProgress({ id: o.id, name: file.name, pct: 100 });
      toast.success(file ? "Courier label saved" : "Courier label removed");
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (e) { setLabelError({ id: o.id, msg: e instanceof Error ? e.message : "Upload failed" }); }
    finally { setBusy(null); setProgress(null); }
  };

  const rows = useMemo(() => filterOrders(data, filters), [data, filters]);
  const statuses = useMemo(() => statusOptions(data), [data]);

  const patch = async (id: string, p: { action: OrderAction; tracking_number?: string; promo_thb?: number }) => {
    if (updating) return;
    setUpdating(id);
    try {
      const r = await save({ data: { id, ...p } });
      if (!r.ok) {
        if ("shortfall" in r) setShortfall(r.shortfall);
        else if ("promoConfirmation" in r) { setPromoValue(""); setPromoChoice({ id, ...r.promoConfirmation }); }
      } else { setPromoChoice(null); toast.success("Order updated"); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setUpdating(null); void qc.invalidateQueries({ queryKey: ["admin"] }); }
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
        <input value={filters.q ?? ""} onChange={(e) => setF("q", e.target.value)} placeholder="Search order/POS ref, name, phone, product…" aria-label="Search orders" className="w-full max-w-xs rounded-md border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
        <select aria-label="Status filter" value={filters.status ?? ""} onChange={(e) => setF("status", e.target.value)} className="rounded-md border bg-card px-2 py-2 text-sm capitalize">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select aria-label="Country filter" value={filters.currency ?? ""} onChange={(e) => setF("currency", e.target.value)} className="rounded-md border bg-card px-2 py-2 text-sm">
          <option value="">All countries</option><option value="myr">Malaysia (MYR)</option><option value="thb">Thailand (THB)</option>
        </select>
        <select aria-label="Placed by filter" value={filters.placed_by ?? ""} onChange={(e) => setF("placed_by", e.target.value)} className="rounded-md border bg-card px-2 py-2 text-sm">
          <option value="">Placed by: all</option><option value="guest">Guest</option><option value="customer">Customer</option><option value="staff">Staff</option><option value="owner">Owner</option>
        </select>
        <label className="flex items-center gap-1 text-xs">From<input type="date" value={filters.from ?? ""} onChange={(e) => setF("from", e.target.value)} className="rounded-md border bg-card px-2 py-1.5 text-sm" /></label>
        <label className="flex items-center gap-1 text-xs">To<input type="date" value={filters.to ?? ""} onChange={(e) => setF("to", e.target.value)} className="rounded-md border bg-card px-2 py-1.5 text-sm" /></label>
        {Object.values(filters).some(Boolean) && <button onClick={() => setFilters({})} className="text-xs underline">Clear</button>}
        <span className="text-sm text-muted-foreground">{rows.length} orders</span>
        <SalesSummary rows={rows} />
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
                  <td className="px-3 py-2 font-semibold">{i + 1}<button onClick={() => setDetails(o)} className="block font-mono text-xs font-normal underline">{o.order_number}</button><RoleTag kind={o.placed_by} /></td>
                  <td className="px-3 py-2">{o.address.name}<div className="text-xs text-muted-foreground">{o.email}</div></td>
                  <td className="max-w-[220px] px-3 py-2">{fullAddress(o.address)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{o.address.phone}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{money(o.currency, o.total_amount)}</div>
                    <PosNumbers o={o} />
                    <div className="text-xs text-muted-foreground">{o.payment_method}{o.promo_code ? ` · ${o.promo_code}` : ""}</div>
                    {o.receipt_url ? <a href={o.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-medium underline">View receipt</a> : <span className="text-xs text-muted-foreground">No receipt</span>}
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
                    <LabelDrop busy={busy === o.id} hasLabel={!!o.label_url} progress={progress?.id === o.id ? progress : null} error={labelError?.id === o.id ? labelError.msg : null} onFile={(f) => void uploadLabel(o, f)} />
                    {o.label_url && <button aria-label="Remove courier label" disabled={busy === o.id} onClick={() => void uploadLabel(o, null)} className="mt-1 flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"><Trash2 className="size-3.5" /> Remove label</button>}
                    <div className="mt-2 flex items-center gap-2 font-mono text-xs">{o.order_number}<button aria-label="Show QR code" onClick={() => setQr(o)}><QrCode className="size-4" /></button></div>
                    <TrackingControls key={`${o.id}-${o.status}-${o.tracking_number ?? ""}`} o={o} disabled={!!updating} onAction={(action, tracking) => void patch(o.id, tracking ? { action, tracking_number: tracking } : { action })} />
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-block rounded border px-2 py-0.5 text-xs font-semibold capitalize">{o.status === "verifying" ? "Verifying…" : label(o.status)}</span>
                    {o.status === "pending_verification" && <div className="mt-2 flex flex-col gap-1">
                      <Button size="sm" disabled={!!updating} onClick={() => void patch(o.id, { action: "verify" })}>{updating === o.id ? "Working…" : "Verify"}</Button>
                      <Button size="sm" variant="outline" disabled={!!updating} onClick={() => { if (confirm(`Reject ${o.order_number}? This cannot be undone.`)) void patch(o.id, { action: "reject" }); }}>Reject</Button>
                    </div>}
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
      <Dialog open={!!promoChoice} onOpenChange={(v) => !v && !updating && setPromoChoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm THB promo discount</DialogTitle></DialogHeader>
          {promoChoice && <><p className="text-sm">Customer received {money(promoChoice.currency, promoChoice.paidDiscount)} promo discount.</p><label className="space-y-1 text-sm"><span>THB discount (maximum {money("thb", promoChoice.maxThb)})</span><input aria-label="THB promo discount" type="number" min="0" max={promoChoice.maxThb} step="0.01" value={promoValue} onChange={(e) => setPromoValue(e.target.value)} className="w-full rounded border bg-card px-3 py-2" /></label><Button disabled={!!updating || !promoValue || !Number.isFinite(Number(promoValue)) || Number(promoValue) < 0 || Number(promoValue) > promoChoice.maxThb} onClick={() => void patch(promoChoice.id, { action: "verify", promo_thb: Number(promoValue) })}>Confirm discount and verify</Button></>}
        </DialogContent>
      </Dialog>
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
              <RoleTag kind={details.placed_by} />
              <span className="text-muted-foreground">{new Date(details.created_at).toLocaleString()}</span>
            </div>
            <div><div className="font-semibold">{details.address.name}</div><div>{details.email}</div><div>{details.address.phone}</div><div className="text-muted-foreground">{fullAddress(details.address)}</div></div>
            <ul className="divide-y rounded-md border">{details.items.map((it, k) => <li key={k} className="flex justify-between gap-3 px-3 py-1.5"><span>{it.product_name}{it.selected_variant ? ` (${it.selected_variant})` : ""}</span><span>× {it.quantity}</span></li>)}</ul>
            <div className="rounded-md border p-3"><Totals o={details} /></div>
            <div className="space-y-1">
              <div>Payment: {details.payment_method}</div>
              <div className="space-y-1"><div className="font-semibold">POS receipt history</div>{details.pos_history?.filter((p) => p.receipt_number).map((p) => <div key={`${p.cycle}-${p.kind}`} className="border-b py-1 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="capitalize">{p.kind} {p.cycle} · <span className="font-mono">{p.receipt_number}</span></span><span>{money("thb", Number(p.total_thb ?? 0))}</span></div>{p.confirmed_by && <div className="break-all text-muted-foreground">THB promo {Number(p.promo_thb ?? 0).toFixed(2)} confirmed by admin {p.confirmed_by}</div>}</div>)}{!details.pos_history?.some((p) => p.receipt_number) && <span className="text-muted-foreground">—</span>}</div>
              {details.receipt_url ? <a href={details.receipt_url} target="_blank" rel="noreferrer" className="font-medium underline">View receipt</a> : <span className="text-muted-foreground">No receipt</span>}
              <div>Tracking no.: {details.tracking_number ?? "—"}</div>
              {details.label_url && <img src={details.label_url} alt={`Courier label for ${details.order_number}`} className="max-h-48 rounded border object-contain" />}
            </div>
            <OwnerActions o={details} onDone={() => { setDetails(null); void qc.invalidateQueries({ queryKey: ["admin"] }); }} />
            <History id={details.id} />
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

function PosNumbers({ o }: { o: AdminOrder }) {
  const history = o.pos_history?.filter((p) => p.receipt_number) ?? [];
  const sale = history.filter((p) => p.kind === "sale").at(-1);
  const refund = history.filter((p) => p.kind === "refund").at(-1);
  return <div className="my-1 space-y-0.5 text-xs"><div>POS sale: <span className="font-mono">{sale?.receipt_number ?? "—"}</span></div>{refund && <div>POS refund: <span className="font-mono">{refund.receipt_number}</span></div>}</div>;
}

function Totals({ o }: { o: AdminOrderRow }) {
  const t = orderTotals(o);
  const row = (k: string, v: string, strong = false) => <div className={`flex justify-between gap-3 text-xs ${strong ? "border-t pt-1 text-sm font-semibold" : ""}`}><span>{k}</span><span className="tabular-nums">{v}</span></div>;
  return (
    <div className="space-y-0.5">
      {row(t.sale > 0 ? "Subtotal (regular price)" : "Subtotal", money(o.currency, t.subtotal + t.sale))}
      {t.sale > 0 && row("Sale", `− ${money(o.currency, t.sale)}`)}
      {t.bundle > 0 && row("Bundle savings", `− ${money(o.currency, t.bundle)}`)}
      {(t.promoCode || t.promo > 0) && row(`Promo${t.promoCode ? ` ${t.promoCode}` : ""}`, `− ${money(o.currency, t.promo)}`)}
      {row("Shipping", t.shipping > 0 ? `+ ${money(o.currency, t.shipping)}` : "Free")}
      {row("Total", money(o.currency, t.total), true)}
    </div>
  );
}

function History({ id }: { id: string }) {
  const fetchHistory = useServerFn(getOrderHistory);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "order-history", id], queryFn: () => fetchHistory({ data: { id } }) });
  return (
    <div className="space-y-1">
      <div className="font-semibold">Audit trail</div>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : error ? <p className="text-xs text-destructive">{error.message}</p> : !data?.length ? <p className="text-xs text-muted-foreground">No status changes recorded yet.</p> : (
        <ol className="space-y-2 border-l pl-3">
          {data.map((h) => (
            <li key={h.id} className="text-xs">
              <div className="font-medium capitalize">{h.from_status === h.to_status ? "Tracking corrected" : `${label(h.from_status ?? "—")} → ${label(h.to_status)}`}</div>
              <div className="text-muted-foreground">{new Date(h.changed_at).toLocaleString()} · {h.changed_by_email || "admin"}{h.actor_role && <RoleTag kind={h.actor_role} />}</div>
              {h.old_tracking_number ? <div>Tracking: <span className="font-mono">{h.old_tracking_number}</span> → <span className="font-mono">{h.tracking_number}</span></div> : h.to_status === "shipped" && h.tracking_number && <div>Tracking: <span className="font-mono">{h.tracking_number}</span></div>}
              {h.pos_receipt_number && <div>POS receipt: <span className="font-mono">{h.pos_receipt_number}</span></div>}
              {h.notes && <div>{h.notes}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TrackingControls({ o, disabled, onAction }: { o: AdminOrder; disabled: boolean; onAction: (a: OrderAction, tracking?: string) => void }) {
  const [value, setValue] = useState(o.tracking_number ?? "");
  const v = value.trim();
  if (o.status !== "verified" && o.status !== "shipped") return <div className="mt-1 text-xs">Tracking: <span className="font-mono">{o.tracking_number ?? "—"}</span></div>;
  return (
    <div className="mt-1 space-y-1">
      <input aria-label="Tracking number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tracking no." maxLength={80} className="w-full rounded border bg-card px-2 py-1 text-xs" />
      {o.status === "verified" && <Button size="sm" className="w-full" disabled={disabled || !v} onClick={() => onAction("ship", v)}>Mark as Shipped</Button>}
      {o.status === "shipped" && <>
        {v && v !== o.tracking_number && <Button size="sm" variant="outline" className="w-full" disabled={disabled} onClick={() => onAction("tracking", v)}>Save tracking correction</Button>}
        <Button size="sm" className="w-full" disabled={disabled} onClick={() => { if (confirm(`Mark ${o.order_number} as received? Tracking will be locked.`)) onAction("complete"); }}>Received</Button>
      </>}
    </div>
  );
}

function LabelDrop({ busy, hasLabel, progress, error, onFile }: { busy: boolean; hasLabel: boolean; progress: { name: string; pct: number } | null; error: string | null; onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div className="mt-2">
      <label
        onDragOver={(e) => { e.preventDefault(); if (!busy) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f && !busy) onFile(f); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-2 py-3 text-center text-xs transition-colors ${over ? "border-primary bg-muted" : "border-border hover:bg-muted"} ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <ImagePlus className="size-4" />
        <span className="font-medium">{over ? "Drop to upload" : hasLabel ? "Drop or click to replace J&T QR" : "Drop J&T QR here or click to browse"}</span>
        <span className="text-muted-foreground">PNG, JPG or WEBP · max 5MB</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </label>
      {progress && <div className="mt-1 text-xs"><div className="truncate">{progress.name} · {progress.pct < 100 ? "Uploading…" : "Done"}</div><div className="mt-0.5 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} /></div></div>}
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Sales counter: refunded, rejected and in-progress reversals never count toward revenue. */
function SalesSummary({ rows }: { rows: AdminOrder[] }) {
  const t = salesTotals(rows);
  return <span className="text-sm">Sales: <b>{t.count}</b> · {money("myr", t.myr)} · {money("thb", t.thb)}</span>;
}

function OwnerActions({ o, onDone }: { o: AdminOrder; onDone: () => void }) {
  const statusFn = useServerFn(getOwnerPinStatus);
  const { data: owner } = useQuery({ queryKey: ["owner-pin-status"], queryFn: () => statusFn() });
  const [kind, setKind] = useState<"undo_verify" | "refund" | null>(null);
  if (!owner?.isOwner || (!canUndoVerify(o.status) && !canRefund(o.status))) return null;
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="font-semibold">Owner actions</div>
      <div className="flex flex-wrap gap-2">
        {canUndoVerify(o.status) && <Button size="sm" variant="outline" onClick={() => setKind("undo_verify")}>Undo Verify</Button>}
        {canRefund(o.status) && <Button size="sm" variant="destructive" onClick={() => setKind("refund")}>Refund Order</Button>}
      </div>
      {kind && <ReverseForm o={o} kind={kind} onCancel={() => setKind(null)} onDone={onDone} />}
    </div>
  );
}

function ReverseForm({ o, kind, onCancel, onDone }: { o: AdminOrder; kind: "undo_verify" | "refund"; onCancel: () => void; onDone: () => void }) {
  const run = useServerFn(reverseOrder);
  const [reason, setReason] = useState("");
  const [bank, setBank] = useState("");
  const [restock, setRestock] = useState(true);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const field = "w-full rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const submit = async () => {
    if (busy) return;
    if (reason.trim().length < 3) return setErr("Reason is required.");
    if (!/^\d{6}$/.test(pin)) return setErr("Enter your 6-digit Owner PIN.");
    setBusy(true); setErr("");
    try {
      const r = await run({ data: { id: o.id, kind, pin, reason: reason.trim(), bank_reference: bank.trim() || undefined, return_to_stock: restock } });
      if (r.ok) { toast.success(kind === "refund" ? `${o.order_number} refunded` : `${o.order_number} moved back to Pending Verification`); onDone(); }
      else { setErr(r.error); setPin(""); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 border-t pt-2">
      <p className="text-xs text-muted-foreground">{kind === "refund" ? "Full refund. Status becomes Refunded and cannot change again. A Loyverse refund receipt is created." : "The order goes back to Pending Verification. A Loyverse refund receipt is created; verifying again makes a fresh sale receipt."}</p>
      {kind === "refund" && <div className="flex justify-between text-sm"><span>Refund amount</span><b>{money(o.currency, o.total_amount)}</b></div>}
      <label className="block text-xs">Reason (required)<input className={field} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
      {kind === "refund" && <label className="block text-xs">Bank reference (optional)<input className={field} value={bank} maxLength={120} onChange={(e) => setBank(e.target.value)} /></label>}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />Items returned to shop (unchecked = inventory write-off)</label>
      <label className="block text-xs">Owner PIN<input className={`${field} font-mono tracking-widest`} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></label>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2"><Button size="sm" variant={kind === "refund" ? "destructive" : "default"} disabled={busy} onClick={() => void submit()}>{busy ? "Working…" : kind === "refund" ? "Confirm refund" : "Confirm Undo Verify"}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}
