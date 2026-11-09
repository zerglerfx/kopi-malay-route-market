import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product-card";
import { productsQuery } from "@/lib/queries";
import { useWishlist } from "@/hooks/use-wishlist";

export const Route = createFileRoute("/wishlist")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  head: () => ({
    meta: [
      { title: "My Wishlist — Kopi Malay Route 1" },
      { name: "description", content: "Your saved Route 1 stickers, jerseys and merch to buy later." },
      { property: "og:title", content: "My Wishlist — Kopi Malay Route 1" },
      { property: "og:description", content: "Saved Route 1 merch to revisit later." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { ids } = useWishlist();
  const saved = ids.map((id) => products.find((p) => p.id === id)).filter((p) => p != null);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold uppercase">My wishlist</h1>
      {saved.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Nothing saved yet. Tap the heart on any item to save it. <Link to="/shop" className="font-medium text-foreground underline">Browse the shop</Link></p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {saved.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
