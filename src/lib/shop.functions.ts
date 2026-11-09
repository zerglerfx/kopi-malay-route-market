import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Category, Product } from "./shop";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const SELECT =
  "id,name,slug,description,price,sale_price,price_thb,weight_kg,images,variants,is_featured,is_new_arrival,stock_qty,categories(name,slug),product_stock(size,in_stock)";

type Row = {
  id: string; name: string; slug: string; description: string; price: number; sale_price: number | null;
  price_thb: number | null; weight_kg: number | null; images: string[]; variants: unknown; is_featured: boolean; is_new_arrival: boolean; stock_qty: number;
  categories: { name: string; slug: string } | null;
  product_stock: { size: string; in_stock: number }[] | null;
};

function toProduct(r: Row): Product {
  return {
    id: r.id, name: r.name, slug: r.slug, description: r.description,
    price: Number(r.price), sale_price: r.sale_price == null ? null : Number(r.sale_price),
    price_thb: r.price_thb == null ? null : Number(r.price_thb),
    weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
    images: r.images ?? [], variants: (r.variants ?? {}) as Product["variants"],
    is_featured: r.is_featured, is_new_arrival: r.is_new_arrival, stock_qty: r.stock_qty,
    stock: r.product_stock?.length ? Object.fromEntries(r.product_stock.map((s) => [s.size, s.in_stock])) : null,
    category_slug: r.categories?.slug ?? "", category_name: r.categories?.name ?? "",
  };
}

async function withSharedStock(client: ReturnType<typeof publicClient>, products: Product[]) {
  if (!products.length) return products;
  const { data: links, error } = await client.from("shared_stock_links")
    .select("product_id,loyverse_variant_id,product_stock(in_stock)").in("product_id", products.map((p) => p.id));
  if (error) throw new Error(error.message);
  return products.map((product) => {
    const link = links?.find((row) => row.product_id === product.id);
    return link ? { ...product, stock: { "": link.product_stock?.in_stock ?? 0 }, stock_pool: link.loyverse_variant_id } : product;
  });
}

export const getCategories = createServerFn({ method: "GET" }).handler(async (): Promise<Category[]> => {
  const { data, error } = await publicClient().from("categories").select("id,name,slug").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getProducts = createServerFn({ method: "GET" }).handler(async (): Promise<Product[]> => {
  const client = publicClient();
  const { data, error } = await client.from("products").select(SELECT).eq("is_active", true).order("created_at");
  if (error) throw new Error(error.message);
  return withSharedStock(client, ((data ?? []) as unknown as Row[]).map(toProduct));
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }): Promise<Product | null> => {
    const client = publicClient();
    const { data: row, error } = await client.from("products").select(SELECT).eq("is_active", true).eq("slug", data.slug).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return (await withSharedStock(client, [toProduct(row as unknown as Row)]))[0] ?? null;
  });
