import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { NewArrivalCarousel } from "@/components/new-arrival-carousel";
import { ProductCard } from "@/components/product-card";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { imageFor } from "@/lib/shop";

const CAT_IMG: Record<string, string> = { "jerseys-t-shirts": "tee", stickers: "chromium-black-yellow", tumblers: "tumbler-16oz", "fridge-magnets": "magnet-tak-city", patches: "patch", lanyard: "cap", "other-merch": "cap" };

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery)]);
  },
  head: () => ({
    meta: [
      { title: "Kopi Malay — Route 1 Official Merchandise" },
      { name: "description", content: "Official Route 1 merch for coffee lovers and riders: Mae Hong Son Loop stickers, riding jackets, tees and kopi tumblers." },
      { property: "og:title", content: "Kopi Malay — Route 1 Official Merchandise" },
      { property: "og:description", content: "Gear for the long road and the perfect kopi stop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
  errorComponent: ({ error }) => <p className="p-8 text-sale">{error instanceof Error ? error.message : "Something went wrong"}</p>,
});

function Home() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const arrivals = products.filter((p) => p.is_new_arrival);
  const featured = products.filter((p) => p.is_featured).slice(0, 8);

  return (
    <>
      <NewArrivalCarousel products={arrivals.length ? arrivals : products.slice(-6)} />

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="font-display text-2xl font-bold uppercase">Shop by category</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {categories.map((c) => (
            <Link key={c.slug} to="/shop/$category" params={{ category: c.slug }} className="group relative aspect-[4/5] overflow-hidden rounded-lg border bg-muted">
              <img src={imageFor(products.find((p) => p.category_slug === c.slug)?.images[0] ?? CAT_IMG[c.slug])} alt={c.name} loading="lazy" className="size-full object-contain transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-x-2 bottom-2 rounded-sm bg-ink px-2 py-1.5 text-center font-display text-sm font-semibold uppercase text-ink-foreground">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold uppercase">Best sellers</h2>
          <Link to="/shop" className="text-sm font-medium text-primary">View all →</Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:grid-cols-3">
          {[["1,864", "Curves on the Mae Hong Son Loop"], ["FREE", "Accessories shipping across Thailand"], ["RM 20", "Malaysia quantity-block shipping"]].map(([big, small]) => (
            <div key={big}><p className="font-display text-5xl font-bold">{big}</p><p className="mt-1 text-primary-foreground/80">{small}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
