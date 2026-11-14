/** Rejection alert + flow. Browser-safe pure logic; the server wires real dependencies. */
export const REJECT_REASON_MAX = 200;
export const MAX_ALERT_ITEM_LINES = 8;

export const escTg = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type RejectAlertInput = {
  orderNumber: string;
  actorEmail: string;
  actorRole: "owner" | "staff" | null;
  at: Date;
  customerName: string;
  country: string;
  items: { product_name: string; selected_variant: string; quantity: number }[];
  currency: string;
  total: number;
  reason: string | null;
};

/** Only name + country of the customer; never phone, address, email, slip URL or access token. */
export function buildRejectAlert(i: RejectAlertInput): string {
  const shown = i.items.slice(0, MAX_ALERT_ITEM_LINES).map((it) => `  – ${it.quantity} × ${escTg(it.product_name)}${it.selected_variant ? ` (${escTg(it.selected_variant)})` : ""}`);
  const extra = i.items.length - shown.length;
  if (extra > 0) shown.push(`  – +${extra} more item${extra === 1 ? "" : "s"}`);
  const badge = i.actorRole === "owner" ? " [Owner]" : i.actorRole === "staff" ? " [Staff]" : "";
  const money = `${i.currency === "thb" ? "THB" : "RM"} ${Number(i.total).toFixed(2)}`;
  const country = i.country ? i.country.charAt(0).toUpperCase() + i.country.slice(1) : "—";
  const reason = i.reason?.trim() ? escTg(i.reason.trim().slice(0, REJECT_REASON_MAX)) : "No reason given";
  return [
    `❌ <b>ORDER REJECTED: ${escTg(i.orderNumber)}</b>`,
    `• Rejected by: ${escTg(i.actorEmail)}${badge}`,
    `• Time: ${i.at.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })}`,
    `• Customer: ${escTg(i.customerName || "—")} (${escTg(country)})`,
    `• Items:`,
    ...shown,
    `• Total: ${money}`,
    `• Reason: ${reason}`,
  ].join("\n");
}

export type RejectDeps = {
  transition: () => Promise<boolean>;
  buildAlert: () => Promise<string>;
  send: (text: string) => Promise<boolean>;
  log?: (msg: string, err?: unknown) => void;
};

/** Transition first; alert only when this call actually changed the status. Alert failure never undoes the rejection. */
export async function runReject(deps: RejectDeps): Promise<{ ok: boolean; alerted: boolean }> {
  const changed = await deps.transition();
  if (!changed) return { ok: false, alerted: false };
  const log = deps.log ?? ((m, e) => console.error(m, e));
  try {
    const sent = await deps.send(await deps.buildAlert());
    if (!sent) log("[reject] Telegram alert not delivered");
    return { ok: true, alerted: sent };
  } catch (e) {
    log("[reject] Telegram alert failed", e);
    return { ok: true, alerted: false };
  }
}
