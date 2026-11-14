export type StockStatus = "not_deducted" | "deducting" | "deducted" | "restoring" | "restored" | "written_off" | "unknown";
export type StockAction = "deduct" | "restore" | "none";

const UNDO_STATUSES = new Set(["rejected", "pending", "pending_verification"]);
const NEEDS_STOCK = new Set(["shipped", "completed", "paid"]);

/** Decide what a status change does to Loyverse stock. Legacy ("unknown") orders are never moved automatically. */
export function planStockAction(stock: StockStatus, nextStatus: string): StockAction {
  if (stock === "deducting" || stock === "restoring") throw new Error("A stock update for this order is still in progress. Please wait a moment and try again.");
  if (nextStatus === "verified") return stock === "not_deducted" || stock === "restored" || stock === "written_off" ? "deduct" : "none";
  if (UNDO_STATUSES.has(nextStatus)) return stock === "deducted" ? "restore" : "none";
  if (NEEDS_STOCK.has(nextStatus) && stock !== "deducted" && stock !== "unknown") throw new Error("Verify this order first so its stock is deducted before marking it shipped or completed.");
  return "none";
}

export const STOCK_LABEL: Record<StockStatus, string> = {
  not_deducted: "Not deducted", deducting: "Deducting…", deducted: "Stock deducted",
  restoring: "Restoring…", restored: "Restored", written_off: "Written off", unknown: "Check manually",
};
