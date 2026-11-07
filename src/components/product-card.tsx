import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { effectivePrice, formatRM, imageFor, isApparel, type Product } from "@/lib/shop";

export function PriceTag({ p, className = "" }: { p: Product; className?: string }) {
  const onSale = effectivePrice(p) < p.price;
  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${className}`}>
      <span className={onSale ? "font-semibold text-sale" : "font-semibold"}>{formatRM(effectivePrice(p))}</span>
      {onSale && <span className="text-sm text-muted-foreground line-through">{formatRM(p.price)}</span>}
      {p.price_thb != null && <span className="text-sm text-muted-foreground">/ THB {p.price_thb.toFixed(2)}</span>}
    </div>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const { add, setOpen } = useCart();
  const [picking, setPicking] = useState(false);
  const onSale = effectivePrice(p) < p.price;

  const addWith = async (variant: string) => {
    await add(p, variant, 1);
    setPicking(false);
    toast.success(`${p.name}${variant ? ` (${variant})` : ""} added to cart`, { action: { label: "View cart", onClick: () => setOpen(true) } });
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border bg-card">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-muted">
        <img src={imageFor(p.images[0])} alt={p.name} loading="lazy" width={1024} height={1024} className="size-full object-contain transition-transform duration-500 group-hover:scale-105" />
        {onSale && <span className="absolute left-2 top-2 rounded-sm bg-sale px-2 py-0.5 font-display text-xs font-bold uppercase text-sale-foreground">Sale</span>}
        {p.is_featured && !onSale && <span className="absolute left-2 top-2 rounded-sm bg-signal px-2 py-0.5 font-display text-xs font-bold uppercase text-signal-foreground">Best seller</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category_name}</p>
        <Link to="/product/$slug" params={{ slug: p.slug }} className="font-medium leading-snug hover:text-primary">{p.name}</Link>
        <PriceTag p={p} />
        <div className="mt-auto pt-2">
          {picking ? (
            <div className="flex flex-wrap gap-1">
              {(p.variants.sizes ?? []).map((s) => (
                <Button variant="outline" size="sm" key={s} onClick={() => addWith(s)} className="min-w-9 px-2">{s}</Button>
              ))}
            </div>
          ) : (
            <Button
              onClick={() => (isApparel(p) ? setPicking(true) : addWith(""))}
              className="w-full rounded-md bg-ink py-2 font-display text-sm font-semibold uppercase text-ink-foreground transition-colors hover:bg-primary"
            >
              {isApparel(p) ? "Choose size" : "Add to cart"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
