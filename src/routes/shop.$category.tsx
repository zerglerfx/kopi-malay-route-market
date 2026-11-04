import { createFileRoute } from "@tanstack/react-router";
import { ShopView, validateShopSearch } from "@/components/shop-view";
import { categoriesQuery, productsQuery } from "@/lib/queries";

const NAMES: Record<string, string> = {
  shirts: "Shirts", "sweaters-jackets": "Sweaters & Jackets", stickers: "Stickers", tumblers: "Tumblers", "other-merch": "Other Merch",
};

export const Route = createFileRoute("/shop/$category")({
  validateSearch: validateShopSearch,
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery)]);
  },
  head: ({ params }) => {
    const name = NAMES[params.category] ?? "Shop";
    return {
      meta: [
        { title: `${name} — Kopi Malay Route 1 Merch` },
        { name: "description", content: `Shop ${name.toLowerCase()} from the Kopi Malay Route 1 official merchandise store.` },
        { property: "og:title", content: `${name} — Kopi Malay Route 1 Merch` },
        { property: "og:description", content: `Route 1 ${name.toLowerCase()} for riders and kopi lovers.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Page,
  errorComponent: ({ error }) => <p className="p-8 text-sale">{error.message}</p>,
});

function Page() {
  const { category } = Route.useParams();
  return <ShopView category={category} search={Route.useSearch()} />;
}
