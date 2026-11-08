import { describe, expect, it } from "vitest";

// Public storefront integration check: uses the running preview and its real catalog.
describe("uploaded catalog prices", () => {
  it.each([
    ["route-1-official-bikers-riding-jersey-short-sleeve", 75, 599],
    ["route-1-official-bikers-riding-jersey-long-sleeve", 88, 699],
    ["anniversary-edition-jersey-short-sleeve", 88, 699],
    ["anniversary-edition-jersey-long-sleeve", 100, 799],
    ["official-route-1-tshirt", 58, 459],
    ["fridge-magnet-route-1", 11, 89],
    ["patch-velcro-pit-stop-south-asia-gate", 14.5, 109],
    ["patch-velcro-red-white-tak-route-1", 14.5, 109],
    ["sticker-route-1-emblem", 6.5, 49],
  ])("%s has the specified MYR and THB prices", async (slug, rm, thb) => {
    const response = await fetch(`http://localhost:8080/product/${slug}`);
    expect(response.ok).toBe(true);
    const html = (await response.text()).replace(/<!--.*?-->/gs, "");
    expect(html).toContain(`RM ${Number(rm).toFixed(2)}`);
    expect(html).toContain(`THB ${Number(thb).toFixed(2)}`);
  }, 30000);
});