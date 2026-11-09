import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("confirmed Loyverse merchandise links", () => {
  it.each([
    ["Official lanyard uses Black", "1b55951b-3250-409e-a5f4-52b476eb2ec6", "c64e6e42-91ca-4cc4-b5dd-785148d99b46"],
    ["Batik lanyard uses Yellow", "51cd5763-f0a3-4592-b7e5-93eda8911593", "d6d39eac-c7d3-4a44-82e3-e0c047b5061e"],
    ["South Asia Gate magnet uses 0KM", "58b4d778-02a1-4072-9828-acd0b6a2fff6", "e3d85c5b-4a1c-48f0-a07a-4572d512c787"],
  ])("%s", async (_rule, productId, variantId) => {
    const { data, error } = await supabase.from("product_stock")
      .select("loyverse_variant_id,size,in_stock,synced_at")
      .eq("product_id", productId).eq("size", "").single();
    expect(error).toBeNull();
    expect(data?.loyverse_variant_id).toBe(variantId);
    expect(data?.size).toBe("");
    expect(data?.in_stock).toEqual(expect.any(Number));
    expect(data?.synced_at).toEqual(expect.any(String));
  }, 30000);
});