import { createFileRoute } from "@tanstack/react-router";
import { ShopView, validateShopSearch } from "@/components/shop-view";
import { categoriesQuery, productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/shop/")({
  validateSearch: validateShopSearch,
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery)]);
  },
  head: () => ({
    meta: [
      { title: "Shop All — Kopi Malay Route 1 Merch" },
      { name: "description", content: "Shirts, riding jackets, stickers and tumblers from the Kopi Malay Route 1 official merch store." },
      { property: "og:title", content: "Shop All — Kopi Malay Route 1 Merch" },
      { property: "og:description", content: "Shirts, riding jackets, stickers and tumblers for riders and kopi lovers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
  errorComponent: ({ error }) => <p className="p-8 text-sale">{error instanceof Error ? error.message : "Something went wrong"}</p>,
});

function Page() {
  return <ShopView search={Route.useSearch()} />;
}
