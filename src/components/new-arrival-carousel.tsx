import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { effectivePrice, formatRM, imageFor, type Product } from "@/lib/shop";

export function NewArrivalCarousel({ products }: { products: Product[] }) {
  const [ref, api] = useEmblaCarousel({ loop: true, align: "start" });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!api) return;
    const on = () => setIndex(api.selectedScrollSnap());
    api.on("select", on); on();
    const t = setInterval(() => api.scrollNext(), 6000);
    return () => { api.off("select", on); clearInterval(t); };
  }, [api]);
  const prev = useCallback(() => api?.scrollPrev(), [api]);
  const next = useCallback(() => api?.scrollNext(), [api]);
  if (!products.length) return null;

  return (
    <section className="relative bg-ink text-ink-foreground" aria-roledescription="carousel" aria-label="New arrivals">
      <div className="overflow-hidden" ref={ref}>
        <div className="flex">
          {products.map((p) => (
            <div key={p.id} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className="mx-auto grid min-h-[520px] max-w-7xl items-center gap-6 px-6 py-10 md:grid-cols-2 md:px-16">
                <div className="order-2 md:order-1">
                  <span className="inline-block rounded-sm bg-ink-foreground px-2 py-1 font-display text-xs font-bold uppercase text-ink">New arrival</span>
                  <h2 className="mt-4 font-display text-4xl font-bold uppercase leading-[0.95] md:text-6xl">{p.name}</h2>
                  <p className="mt-3 text-lg text-ink-foreground/80">{formatRM(effectivePrice(p))}{p.price_thb != null && ` / THB ${p.price_thb.toFixed(2)}`}</p>
                  <Link to="/product/$slug" params={{ slug: p.slug }} className="mt-6 inline-block rounded-md bg-ink-foreground px-6 py-3 font-display font-semibold uppercase text-ink hover:opacity-90">Shop now</Link>
                </div>
                <Link to="/product/$slug" params={{ slug: p.slug }} className="order-1 md:order-2">
                  <img src={imageFor(p.images[0])} alt={p.name} className="mx-auto aspect-square w-full max-w-md rounded-lg bg-ink-foreground/5 object-contain" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={prev} aria-label="Previous slide" className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-ink-foreground/30 bg-ink/70 hover:bg-ink md:left-4"><ChevronLeft /></button>
      <button onClick={next} aria-label="Next slide" className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-ink-foreground/30 bg-ink/70 hover:bg-ink md:right-4"><ChevronRight /></button>
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
        {products.map((p, i) => (
          <button key={p.id} aria-label={`Go to slide ${i + 1}`} onClick={() => api?.scrollTo(i)} className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-ink-foreground" : "w-2 bg-ink-foreground/40"}`} />
        ))}
      </div>
    </section>
  );
}
