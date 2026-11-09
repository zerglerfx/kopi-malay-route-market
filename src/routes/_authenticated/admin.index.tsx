import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { listOrders, updateOrder, type AdminOrder } from "@/lib/admin.functions";
import { digits, fullAddress, itemsText, ordersToCsv } from "@/lib/admin-csv";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/")({ component: OrdersAdmin });

const STATUS = ["pending_verification", "verified", "rejected", "shipped", "completed", "pending", "paid"] as const;
const label = (s: string) => s.replace(/_/g, " ");

function OrdersAdmin() {
  const fetchOrders = useServerFn(listOrders);
  const save = useServerFn(updateOrder);
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["admin", "orders"], queryFn: () => fetchOrders() });
  const [phone, setPhone] = useState("");
  const [qr, setQr] = useState<AdminOrder | null>(null);

  const rows = useMemo(() => {
    const q = digits(phone);
    return q ? data.filter((o) => digits(o.address.phone ?? "").includes(q)) : data;
  }, [data, phone]);

  const patch = async (id: string, p: { status?: (typeof STATUS)[number]; tracking_number?: string | null }) => {
    try { await save({ data: { id, ...p } }); toast.success("Order updated"); qc.invalidateQueries({ queryKey: ["admin", "orders"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };

  const exportCsv = () => {
    const blob = new Blob([ordersToCsv(rows)], { type: "text/csv;charset=utf-8" });
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
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Search by phone number…" inputMode="tel" className="w-full max-w-xs rounded-md border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
        <span className="text-sm text-muted-foreground">{rows.length} orders</span>
        <button onClick={exportCsv} disabled={!rows.length} className="ml-auto flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Download className="size-4" /> Export to Excel / CSV</button>
      </div>
      {isLoading ? <p className="mt-6 text-muted-foreground">Loading orders…</p> : (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted text-left font-display text-xs uppercase">
              <tr>{["NO.", "Name", "Address", "Phone Number", "Payment / Receipt", "Items", "Order Ref / Tracking", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((o, i) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="px-3 py-2 font-semibold">{i + 1}</td>
                  <td className="px-3 py-2">{o.address.name}<div className="text-xs text-muted-foreground">{o.email}</div></td>
                  <td className="max-w-[220px] px-3 py-2">{fullAddress(o.address)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{o.address.phone}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.currency.toUpperCase()} {o.total_amount.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{o.payment_method}{o.promo_code ? ` · ${o.promo_code}` : ""}</div>
                    {o.receipt_url ? <a href={o.receipt_url} target="_blank" rel="noreferrer" className="text-xs font-medium underline">View receipt</a> : <span className="text-xs text-muted-foreground">No receipt</span>}
                    <div className="mt-1 flex gap-1">
                      <button onClick={() => patch(o.id, { status: "verified" })} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Verify</button>
                      <button onClick={() => patch(o.id, { status: "rejected" })} className="rounded border px-2 py-0.5 text-xs hover:bg-muted">Reject</button>
                    </div>
                  </td>
                  <td className="max-w-[260px] px-3 py-2">{itemsText(o.items)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-mono text-xs">{o.order_number}<button aria-label="Show QR code" onClick={() => setQr(o)}><QrCode className="size-4" /></button></div>
                    <input
                      defaultValue={o.tracking_number ?? ""} placeholder="Tracking no."
                      onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== o.tracking_number) void patch(o.id, { tracking_number: v }); }}
                      className="mt-1 w-36 rounded border bg-card px-2 py-1 text-xs"
                    />
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select value={o.status} onChange={(e) => patch(o.id, { status: e.target.value as (typeof STATUS)[number] })} className="rounded border bg-card px-2 py-1 text-xs capitalize">
                      {STATUS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No orders found.</td></tr>}
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
    </div>
  );
}
