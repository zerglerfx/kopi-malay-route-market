import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { effectivePrice } from "@/lib/shop";
import { ProductCard } from "./product-card";

export type ShopSearch = { q?: string | undefined; sort?: "featured" | "price-asc" | "price-desc" | undefined };

export function validateShopSearch(s: Record<string, unknown>): ShopSearch {
  const sort = s["sort"] === "price-asc" || s["sort"] === "price-desc" ? s["sort"] : undefined;
  return { q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined, sort };
}

export function ShopView({ category, search }: { category?: string; search: ShopSearch }) {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const navigate = useNavigate();
  const current = categories.find((c) => c.slug === category);

  let list = products.filter((p) => !category || p.category_slug === category);
  if (search.q) {
    const q = search.q.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (search.sort === "price-asc") list = [...list].sort((a, b) => effectivePrice(a) - effectivePrice(b));
  else if (search.sort === "price-desc") list = [...list].sort((a, b) => effectivePrice(b) - effectivePrice(a));
  else list = [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));

  const tab = "whitespace-nowrap rounded-full border px-4 py-1.5 font-display text-sm font-medium transition-colors";
  const on = "border-ink bg-ink text-ink-foreground";
  const off = "bg-card hover:border-ink";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold uppercase md:text-5xl">{current?.name ?? "Shop All"}</h1>
      {search.q && <p className="mt-2 text-muted-foreground">Results for “{search.q}”</p>}
      <div className="mt-6 flex items-center gap-4">
        <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 pb-1">
          <Link to="/shop" search={{ q: search.q }} className={`${tab} ${!category ? on : off}`}>All</Link>
          {categories.map((c) => (
            <Link key={c.slug} to="/shop/$category" params={{ category: c.slug }} search={{ q: search.q }} className={`${tab} ${category === c.slug ? on : off}`}>{c.name}</Link>
          ))}
        </div>
        <select
          aria-label="Sort"
          value={search.sort ?? "featured"}
          onChange={(e) => navigate({ to: ".", search: (prev: ShopSearch) => ({ ...prev, sort: e.target.value === "featured" ? undefined : (e.target.value as ShopSearch["sort"]) }) })}
          className="hidden rounded-md border bg-card px-3 py-1.5 text-sm sm:block"
        >
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      {list.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No products found.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
