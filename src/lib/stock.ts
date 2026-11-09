export type StockMapping = { product_id: string; size: string; loyverse_variant_id: string };

/** Mixed designs sharing a POS variant are checked and deducted as one inventory pool. */
export function aggregateStockSales(
  lines: { productId: string; variant: string; quantity: number; name: string }[],
  mappings: StockMapping[],
): { variantId: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const tracked = mappings.filter((row) => row.product_id === line.productId);
    if (!tracked.length) continue;
    const row = tracked.find((mapping) => mapping.size === line.variant);
    if (!row) throw new Error(`${line.name} is sold out.`);
    totals.set(row.loyverse_variant_id, (totals.get(row.loyverse_variant_id) ?? 0) + line.quantity);
  }
  return [...totals].map(([variantId, quantity]) => ({ variantId, quantity }));
}