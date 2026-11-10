import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { linkStock, listAdminProducts, listLoyverseVariants, saveProduct, syncLoyverseStock } from "@/lib/admin.functions";
import { imageFor } from "@/lib/shop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/products")({ component: ProductsAdmin });

type Data = Awaited<ReturnType<typeof listAdminProducts>>;
type P = Data["products"][number];
type Draft = { id?: string; name: string; slug: string; description: string; category_id: string; price: string; sale_price: string; price_thb: string; weight_kg: string; images: string; sizes: string; is_featured: boolean; is_new_arrival: boolean; is_active: boolean };
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const str = (n: unknown) => (n == null ? "" : String(n));
const input = "w-full rounded border bg-card px-2 py-1.5 text-sm";
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ProductsAdmin() {
  const fetchAll = useServerFn(listAdminProducts);
  const save = useServerFn(saveProduct);
  const sync = useServerFn(syncLoyverseStock);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "products"], queryFn: () => fetchAll() });
  const [d, setD] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [syncing, setSyncing] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "products"] }); qc.invalidateQueries({ queryKey: ["products"] }); };

  const edit = (p?: P) => setD(p ? {
    id: p.id, name: p.name, slug: p.slug, description: p.description, category_id: p.category_id, price: str(p.price), sale_price: str(p.sale_price), price_thb: str(p.price_thb),
    weight_kg: str(p.weight_kg), images: p.images.join("\n"), sizes: p.sizes.join(", "), is_featured: p.is_featured, is_new_arrival: p.is_new_arrival, is_active: p.is_active,
  } : { name: "", slug: "", description: "", category_id: data?.categories[0]?.id ?? "", price: "", sale_price: "", price_thb: "", weight_kg: "", images: "", sizes: "", is_featured: false, is_new_arrival: true, is_active: true });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d) return;
    try {
      await save({ data: {
        id: d.id, name: d.name, slug: d.slug || slugify(d.name), description: d.description, category_id: d.category_id,
        price: Number(d.price), sale_price: num(d.sale_price), price_thb: num(d.price_thb), weight_kg: num(d.weight_kg),
        images: d.images.split("\n").map((s) => s.trim()).filter(Boolean), sizes: d.sizes.split(",").map((s) => s.trim()).filter(Boolean),
        is_featured: d.is_featured, is_new_arrival: d.is_new_arrival, is_active: d.is_active,
      } });
      toast.success("Product saved"); setD(null); refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
  };

  const doSync = async () => {
    setSyncing(true);
    try { const r = await sync(); toast.success(`Synced ${r.variants} Loyverse items`); refresh(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Sync failed"); }
    finally { setSyncing(false); }
  };

  if (error) return <p className="text-destructive">{error.message}</p>;
  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  const cat = (id: string) => data.categories.find((c) => c.id === id)?.name ?? "";
  const rows = data.products.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => edit()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">+ Add product</button>
        <button onClick={doSync} disabled={syncing} className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> Sync stock from Loyverse</button>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter products…" className="ml-auto w-full max-w-xs rounded-md border bg-card px-3 py-2 text-sm" />
      </div>
      <p className="text-xs text-muted-foreground">Stock counts come from Loyverse (master record) and are read-only here. Add new items in Loyverse first, then link them below.</p>

      <Dialog open={!!d} onOpenChange={(o) => { if (!o) setD(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{d?.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
      {d && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">Name<input required className={input} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value, slug: d.id ? d.slug : slugify(e.target.value) })} /></label>
          <label className="text-sm">Web address (slug)<input required className={input} value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} /></label>
          <label className="text-sm">Category<select className={input} value={d.category_id} onChange={(e) => setD({ ...d, category_id: e.target.value })}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm">Price RM<input required type="number" step="0.01" min={0} className={input} value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} /></label>
          <label className="text-sm">Sale price RM<input type="number" step="0.01" min={0} className={input} value={d.sale_price} onChange={(e) => setD({ ...d, sale_price: e.target.value })} /></label>
          <label className="text-sm">Price THB<input type="number" step="0.01" min={0} className={input} value={d.price_thb} onChange={(e) => setD({ ...d, price_thb: e.target.value })} /></label>
          <label className="text-sm">Weight (kg)<input type="number" step="0.001" min={0} className={input} value={d.weight_kg} onChange={(e) => setD({ ...d, weight_kg: e.target.value })} /></label>
          <label className="text-sm sm:col-span-4">Description<textarea rows={3} className={input} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Photos (one image link per line)<textarea rows={3} className={input} value={d.images} onChange={(e) => setD({ ...d, images: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2">Sizes (comma separated, apparel only)<input className={input} placeholder="S, M, L, XL" value={d.sizes} onChange={(e) => setD({ ...d, sizes: e.target.value })} /></label>
          <div className="flex flex-wrap gap-4 text-sm sm:col-span-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_new_arrival} onChange={(e) => setD({ ...d, is_new_arrival: e.target.checked })} /> New Arrival (home slider)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_featured} onChange={(e) => setD({ ...d, is_featured: e.target.checked })} /> Best seller</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} /> Visible in shop</label>
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            <button type="button" onClick={() => setD(null)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-muted text-left font-display text-xs uppercase"><tr>{["", "Product", "Category", "RM", "THB", "Weight", "Loyverse stock", "Flags", ""].map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`border-t align-top ${p.is_active ? "" : "opacity-50"}`}>
                <td className="px-3 py-2"><img src={imageFor(p.images[0])} alt="" className="size-12 rounded bg-muted object-contain" /></td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{cat(p.category_id)}</td>
                <td className="px-3 py-2">{p.sale_price != null ? <><s>{p.price.toFixed(2)}</s> {p.sale_price.toFixed(2)}</> : p.price.toFixed(2)}</td>
                <td className="px-3 py-2">{p.price_thb?.toFixed(2) ?? "—"}</td>
                <td className="px-3 py-2">{p.weight_kg != null ? `${p.weight_kg} kg` : "—"}</td>
                <td className="px-3 py-2"><StockCell p={p} data={data} onChange={refresh} /></td>
                <td className="px-3 py-2 text-xs">{[p.is_new_arrival && "New", p.is_featured && "Best seller", !p.is_active && "Hidden"].filter(Boolean).join(", ")}</td>
                <td className="px-3 py-2"><button className="underline" onClick={() => edit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockCell({ p, data, onChange }: { p: P; data: Data; onChange: () => void }) {
  const link = useServerFn(linkStock);
  const loadVariants = useServerFn(listLoyverseVariants);
  const [open, setOpen] = useState(false);
  const { data: variants, isLoading } = useQuery({ queryKey: ["admin", "loyverse-variants"], queryFn: () => loadVariants(), enabled: open, staleTime: 5 * 60_000 });
  const shared = data.shared.find((s) => s.product_id === p.id);
  const rows = data.stock.filter((s) => s.product_id === p.id);
  const sizes = p.sizes.length ? p.sizes : [""];

  if (shared) {
    const pool = data.stock.find((s) => s.loyverse_variant_id === shared.loyverse_variant_id);
    return <span className="text-xs">Shared pool: {pool?.in_stock ?? "?"}</span>;
  }
  return (
    <div className="space-y-1 text-xs">
      {sizes.map((size) => {
        const r = rows.find((x) => x.size === size);
        return (
          <div key={size} className="flex items-center gap-2">
            {size && <span className="w-8 font-semibold">{size}</span>}
            {open ? (
              <select disabled={isLoading} value={r?.loyverse_variant_id ?? ""} className="max-w-[220px] rounded border bg-card px-1 py-0.5"
                onChange={async (e) => {
                  try { await link({ data: { product_id: p.id, size, loyverse_variant_id: e.target.value || null } }); toast.success("Stock link updated"); onChange(); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Link failed"); }
                }}>
                <option value="">{isLoading ? "Loading Loyverse…" : "Not tracked (unlimited)"}</option>
                {variants?.map((v) => <option key={v.variant_id} value={v.variant_id}>{v.label}</option>)}
              </select>
            ) : <span>{r ? `${r.in_stock} in stock` : "Not tracked"}</span>}
          </div>
        );
      })}
      <button onClick={() => setOpen(!open)} className="underline">{open ? "Done" : rows.some((x) => x.loyverse_variant_id) ? "Edit link" : "Link to Loyverse"}</button>
    </div>
  );
}
