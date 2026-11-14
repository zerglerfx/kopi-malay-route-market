/** Strict admin order flow, shared by the admin UI and the server. */
export const ORDER_ACTIONS = ["verify", "reject", "ship", "complete", "tracking"] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];
/** action -> [required current status, next status] */
export const ORDER_FLOW: Record<OrderAction, readonly [string, string]> = {
  verify: ["pending_verification", "verified"],
  reject: ["pending_verification", "rejected"],
  ship: ["verified", "shipped"],
  complete: ["shipped", "completed"],
  tracking: ["shipped", "shipped"],
};
export const ORDER_STATUSES = ["pending_verification", "verifying", "verified", "shipped", "completed", "rejected", "reversing", "refunded"] as const;
export const actionsFor = (status: string): OrderAction[] => ORDER_ACTIONS.filter((a) => ORDER_FLOW[a][0] === status);
export const canTransition = (from: string, action: OrderAction) => ORDER_FLOW[action][0] === from;

/** Owner-only reversals (PIN required). Refunded is terminal: no action of any kind applies to it. */
export const canUndoVerify = (status: string) => status === "verified";
export const canRefund = (status: string) => ["verified", "shipped", "completed"].includes(status);
export const isTerminal = (status: string) => status === "refunded" || status === "rejected";
/** Statuses that count toward revenue/sales totals. */
export const countsAsSale = (status: string) => !["refunded", "rejected", "reversing"].includes(status);
export function salesTotals(rows: { status: string; currency: string; total_amount: number }[]) {
  const live = rows.filter((r) => countsAsSale(r.status));
  const sum = (c: string) => Math.round(live.filter((r) => r.currency === c).reduce((s, r) => s + r.total_amount, 0) * 100) / 100;
  return { count: live.length, myr: sum("myr"), thb: sum("thb") };
}
/** Customer-facing status wording. */
export const CUSTOMER_STATUS: Record<string, string> = {
  pending_verification: "Payment Proof Submitted - Pending Admin Verification",
  verifying: "Payment Proof Submitted - Pending Admin Verification",
  reversing: "Payment Proof Submitted - Pending Admin Verification",
  verified: "Payment Verified - Preparing for Shipment",
  shipped: "Shipped",
  completed: "Delivered / Received",
  rejected: "Payment Rejected",
  refunded: "Refunded",
};
export const customerStatus = (s: string) => CUSTOMER_STATUS[s] ?? s.replace(/_/g, " ");
