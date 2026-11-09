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
  "id,name,slug,description,price,sale_price,price_thb,weight_kg,images,variants,is_featured,stock_qty,categories(name,slug),product_stock(size,in_stock)";

type Row = {
  id: string; name: string; slug: string; description: string; price: number; sale_price: number | null;
  price_thb: number | null; weight_kg: number | null; images: string[]; variants: unknown; is_featured: boolean; stock_qty: number;
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
    is_featured: r.is_featured, stock_qty: r.stock_qty,
    stock: r.product_stock?.length ? Object.fromEntries(r.product_stock.map((s) => [s.size, s.in_stock])) : null,
    category_slug: r.categories?.slug ?? "", category_name: r.categories?.name ?? "",
  };
}

export const getCategories = createServerFn({ method: "GET" }).handler(async (): Promise<Category[]> => {
  const { data, error } = await publicClient().from("categories").select("id,name,slug").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getProducts = createServerFn({ method: "GET" }).handler(async (): Promise<Product[]> => {
  const { data, error } = await publicClient().from("products").select(SELECT).eq("is_active", true).order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toProduct);
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }): Promise<Product | null> => {
    const { data: row, error } = await publicClient().from("products").select(SELECT).eq("is_active", true).eq("slug", data.slug).maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toProduct(row as unknown as Row) : null;
  });
