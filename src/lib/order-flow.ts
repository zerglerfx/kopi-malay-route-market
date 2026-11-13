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
export const ORDER_STATUSES = ["pending_verification", "verifying", "verified", "shipped", "completed", "rejected"] as const;
export const actionsFor = (status: string): OrderAction[] => ORDER_ACTIONS.filter((a) => ORDER_FLOW[a][0] === status);
export const canTransition = (from: string, action: OrderAction) => ORDER_FLOW[action][0] === from;
