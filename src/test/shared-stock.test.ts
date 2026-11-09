import { describe, expect, it } from "vitest";
import { aggregateStockSales } from "@/lib/stock";
import { supabase } from "@/integrations/supabase/client";

describe("unified 8×8cm sticker inventory", () => {
  it("deducts three random designs as three units from one pool", () => {
    const lines = ["logo", "signage", "loop"].map((productId) => ({ productId, variant: "", quantity: 1, name: productId }));
    const rows = lines.map((line) => ({ product_id: line.productId, size: "", loyverse_variant_id: "pool-A" }));
    expect(aggregateStockSales(lines, rows)).toEqual([{ variantId: "pool-A", quantity: 3 }]);
  });
  it("links every 8×8cm design to H001 (A) and never H001 (C)", async () => {
    const { data: products, error } = await supabase.from("products").select("id").eq("is_active", true).like("name", "STICKER (8x8cm)%");
    expect(error).toBeNull();
    expect(products).toHaveLength(10);
    const { data: links, error: linkError } = await supabase.from("shared_stock_links").select("product_id,loyverse_variant_id");
    expect(linkError).toBeNull();
    for (const product of products ?? []) {
      expect(links?.find((row) => row.product_id === product.id)?.loyverse_variant_id).toBe("86a21fe3-26a0-46bd-a420-ae022e9fb5a2");
    }
    expect(links?.some((row) => row.loyverse_variant_id === "773a817c-6435-4581-8c3e-79d2bb922d5a")).toBe(false);
  }, 30000);
});