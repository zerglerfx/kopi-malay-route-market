import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PriceTag } from "@/components/product-card";
import { useCart } from "@/hooks/use-cart";
import { productQuery } from "@/lib/queries";
import { imageFor, isApparel } from "@/lib/shop";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    return { name: p.name, description: p.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Kopi Malay Route 1` },
          { name: "description", content: loaderData.description.slice(0, 155) },
          { property: "og:title", content: `${loaderData.name} — Kopi Malay Route 1` },
          { property: "og:description", content: loaderData.description.slice(0, 155) },
          { property: "og:type", content: "product" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Product unavailable — Kopi Malay" }, { name: "robots", content: "noindex" }],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <div className="p-16 text-center"><p className="mb-4">Product not found.</p><Link to="/shop" className="text-primary underline">Back to shop</Link></div>
  ),
  errorComponent: ({ error }) => <p className="p-8 text-sale">{error.message}</p>,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { add, setOpen } = useCart();
  const navigate = useNavigate();
  const [img, setImg] = useState(0);
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  if (!p) return null;
  const apparel = isApparel(p);
  const gallery = Array.from(new Set(p.images.length ? p.images : [""]));
  const ready = !apparel || !!size;

  const doAdd = async (buy: boolean) => {
    if (!ready) { toast.warning("Please select a size first"); return; }
    await add(p, size, qty);
    if (buy) navigate({ to: "/checkout" });
    else toast.success(`${p.name} added to cart`, { action: { label: "View cart", onClick: () => setOpen(true) } });
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-2 md:gap-12">
      <div>
        <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
          <img src={imageFor(gallery[img])} alt={p.name} width={1024} height={1024} className="size-full object-cover" />
        </div>
        {gallery.length > 1 && (
          <div className="mt-3 flex gap-2">
            {gallery.map((g, i) => (
              <button key={g + i} onClick={() => setImg(i)} className={`size-20 overflow-hidden rounded-md border-2 ${i === img ? "border-primary" : "border-transparent"}`}>
                <img src={imageFor(g)} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Link to="/shop/$category" params={{ category: p.category_slug }} className="text-xs uppercase tracking-widest text-primary">{p.category_name}</Link>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{p.name}</h1>
        <PriceTag p={p} className="mt-3 text-xl" />
        {apparel && (
          <div className="mt-6">
            <p className="mb-2 font-display text-sm font-semibold uppercase">Size {size && <span className="text-muted-foreground">— {size}</span>}</p>
            <div className="flex flex-wrap gap-2">
              {p.variants.sizes!.map((s) => (
                <button key={s} onClick={() => setSize(s)} className={`min-w-12 rounded-md border px-3 py-2 font-medium ${size === s ? "border-ink bg-ink text-ink-foreground" : "bg-card hover:border-ink"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 flex items-center gap-3">
          <p className="font-display text-sm font-semibold uppercase">Qty</p>
          <div className="flex items-center rounded-md border bg-card">
            <button aria-label="Decrease quantity" className="p-3" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="size-4" /></button>
            <span className="w-8 text-center">{qty}</span>
            <button aria-label="Increase quantity" className="p-3" onClick={() => setQty(qty + 1)}><Plus className="size-4" /></button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button disabled={!ready} onClick={() => doAdd(false)} className="rounded-md bg-ink py-3 font-display font-semibold uppercase text-ink-foreground hover:bg-primary disabled:opacity-40">Add to cart</button>
          <button disabled={!ready} onClick={() => doAdd(true)} className="rounded-md bg-sale py-3 font-display font-semibold uppercase text-sale-foreground hover:opacity-90 disabled:opacity-40">Buy now</button>
        </div>
        {!ready && <p className="mt-2 text-sm text-muted-foreground">Select a size to continue.</p>}
        <Accordion type="single" collapsible defaultValue="desc" className="mt-8">
          <AccordionItem value="desc"><AccordionTrigger className="font-display uppercase">Description</AccordionTrigger><AccordionContent>{p.description}</AccordionContent></AccordionItem>
          {apparel && (
            <AccordionItem value="size"><AccordionTrigger className="font-display uppercase">Size guide</AccordionTrigger>
              <AccordionContent>Chest (cm): S 96 · M 102 · L 108 · XL 114 · XXL 120. Relaxed fit — size down for a closer fit.</AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="ship"><AccordionTrigger className="font-display uppercase">Shipping</AccordionTrigger>
            <AccordionContent>RM 8.00 to West Malaysia (3-5 business days). RM 15.00 to Sabah, Sarawak & Labuan (5-8 business days).</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
