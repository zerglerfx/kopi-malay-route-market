import type { Json } from "@/integrations/supabase/types";
import { effectivePriceThb } from "./shop";
import { posNote, pricedPosLines, promoSnapshot, resolvePosPromo, satang, snapshotUnitThb, type PosReceiptSnapshot, type PromoSnapshot } from "./pos-pricing";
import * as lv from "./loyverse.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type Operation = import("@/integrations/supabase/types").Database["public"]["Tables"]["order_pos_operations"]["Row"];
type Delta = { variantId: string; quantity: number };
export type PosResult = { ok: true; deltas: Delta[] } | { ok: false; promoConfirmation: { paidDiscount: number; currency: string; maxThb: number } } | { ok: false; shortfall: lv.Shortfall[] } | { ok: false; returnStockRequired: true };

const json = (v: unknown) => v as Json;
const source = (ref: string, cycle: number) => `Kopi Malay Website | ${ref} | sale ${cycle}`;
const errorText = (e: unknown) => e instanceof Error ? e.message : "Loyverse request failed";

async function saveOp(admin: Admin, id: string, patch: Partial<Operation>) {
  const { error } = await admin.from("order_pos_operations").update(patch).eq("id", id);
  if (error) throw new Error(`Could not save POS progress: ${error.message}. Retry to reconcile; do not change Loyverse manually.`);
}

async function ensureReceipt(admin: Admin, op: Operation, ref: string): Promise<lv.PosReceipt> {
  if (op.receipt_number) return lv.posRequest<lv.PosReceipt>(`/receipts/${encodeURIComponent(op.receipt_number)}`);
  const marker = source(ref, op.cycle);
  const recover = () => lv.findPosReceipt(ref, marker, op.kind as "sale" | "refund", op.original_receipt_number);
  let found = await recover();
  if (found) {
    await saveOp(admin, op.id, { receipt_number: found.receipt_number, state: "receipt_saved", error: null });
    return found;
  }
  if (["submitting", "uncertain"].includes(op.state)) throw new Error("The previous receipt request has an uncertain outcome. No duplicate was sent. Retry later to check Loyverse for this web reference.");
  await saveOp(admin, op.id, { state: "submitting", error: null });
  try {
    found = await lv.posRequest<lv.PosReceipt>(op.kind === "sale" ? "/receipts" : `/receipts/${encodeURIComponent(op.original_receipt_number ?? "")}/refund`, op.payload);
  } catch (e) {
    // A 4xx refusal is definitive. Timeouts/server failures remain reconciliation-only.
    const message = errorText(e);
    await saveOp(admin, op.id, { state: /\[4\d\d\]/.test(message) && !/\[(408|429)\]/.test(message) ? "failed" : "uncertain", error: message });
    found = await recover().catch(() => null);
    if (!found) throw new Error(`${message}. Order status was not changed; the next attempt checks for an existing receipt first.`);
  }
  if (!found?.receipt_number) throw new Error("Loyverse returned no receipt number. Retry to reconcile, not create a duplicate.");
  await saveOp(admin, op.id, { receipt_number: found.receipt_number, state: "receipt_saved", error: null });
  return found;
}

export async function processOrderPos(admin: Admin, input: { id: string; action: "deduct" | "restore"; actor: string; returnToStock?: boolean | undefined; promoThb?: number | undefined }): Promise<PosResult> {
  const { data: order, error } = await admin.from("orders").select("id,order_number,status,currency,subtotal,shipping_fee,total_amount,discount_amount,sticker_bundle_discount,promo_code,promo_snapshot,pos_receipt_snapshot,stock_deductions,order_items(product_id,product_name,selected_variant,unit_price,quantity)").eq("id", input.id).single();
  if (error || !order) throw new Error(error?.message ?? "Order not found");
  const { data: operations, error: historyError } = await admin.from("order_pos_operations").select("*").eq("order_id", input.id).order("cycle", { ascending: false }).order("created_at", { ascending: false });
  if (historyError) throw new Error(historyError.message);
  const history = operations ?? [];
  const latestSale = history.find((op) => op.kind === "sale");
  const deltas = (order.stock_deductions ?? []) as unknown as Delta[];
  if (input.action === "restore" && !latestSale?.receipt_number) {
    // Historical orders retain their existing count-based restoration.
    await lv.adjustStock(admin, deltas, 1);
    return { ok: true, deltas };
  }
  // A completed refund may precede the final order status write. Resume it on restore;
  // only a genuinely restored order starts a new verification cycle.
  const { data: stockOrder } = await admin.from("orders").select("stock_restored_at,stock_deducted_at").eq("id", input.id).single();
  const refunded = latestSale && history.some((op) => op.kind === "refund" && op.cycle === latestSale.cycle && op.state === "completed") && stockOrder?.stock_restored_at && (!stockOrder.stock_deducted_at || stockOrder.stock_restored_at >= stockOrder.stock_deducted_at);
  const cycle = input.action === "restore" ? latestSale?.cycle ?? 1 : latestSale ? latestSale.cycle + (refunded ? 1 : 0) : 1;
  const kind = input.action === "deduct" ? "sale" : "refund";
  let op = history.find((x) => x.kind === kind && x.cycle === cycle);
  let receiptDeltas = deltas;

  if (!op && kind === "sale") {
    const ids = order.order_items.flatMap((i) => i.product_id ? [i.product_id] : []);
    const [productsResult, directResult, sharedResult, promoResult] = await Promise.all([
      admin.from("products").select("id,name,price_thb,sale_price_thb,categories(slug)").in("id", ids),
      admin.from("product_stock").select("product_id,size,loyverse_variant_id").in("product_id", ids),
      admin.from("shared_stock_links").select("product_id,loyverse_variant_id").in("product_id", ids),
      order.promo_code ? admin.from("promo_codes").select("discount_type,discount_value,discount_myr,discount_thb").eq("code", order.promo_code).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (productsResult.error || directResult.error || sharedResult.error || promoResult.error) throw new Error("Could not read catalog, stock links or promo values. No receipt created.");
    const receiptSnap = order.pos_receipt_snapshot as unknown as PosReceiptSnapshot | null;
    const items = order.order_items.map((i) => {
      const p = productsResult.data?.find((x) => x.id === i.product_id);
      const shared = sharedResult.data?.find((x) => x.product_id === i.product_id);
      const link = shared ?? directResult.data?.find((x) => x.product_id === i.product_id && x.size === i.selected_variant);
      return { variantId: link?.loyverse_variant_id ?? "", name: i.product_name, size: i.selected_variant, category_slug: p?.categories?.slug ?? "", quantity: i.quantity, priceThb: snapshotUnitThb(receiptSnap, i.product_id, i.selected_variant) ?? (p ? effectivePriceThb({ price_thb: p.price_thb == null ? null : Number(p.price_thb), sale_price_thb: p.sale_price_thb == null ? null : Number(p.sale_price_thb) }) : null) };
    });
    const priced = pricedPosLines(items, 0);
    const promo = resolvePosPromo({ currency: order.currency, rmBase: Number(order.subtotal) - Number(order.sticker_bundle_discount), paidDiscount: Number(order.discount_amount), thbBase: priced.base, hasPromo: !!order.promo_code || Number(order.discount_amount) > 0, snapshot: order.promo_snapshot as PromoSnapshot | null, current: promoResult.data ? promoSnapshot(promoResult.data) : null, confirmed: input.promoThb, receiptPromoThb: receiptSnap?.promo_thb ?? null });
    if (promo.needsConfirmation) return { ok: false, promoConfirmation: { currency: order.currency, paidDiscount: Number(order.discount_amount), maxThb: priced.base } };
    const final = pricedPosLines(items, promo.discount);
    receiptDeltas = [];
    for (const it of items) {
      const existing = receiptDeltas.find((d) => d.variantId === it.variantId);
      if (existing) existing.quantity += it.quantity; else receiptDeltas.push({ variantId: it.variantId, quantity: it.quantity });
    }
    const settings = await lv.posSettings();
    const payload = { store_id: settings.storeId, order: order.order_number, source: source(order.order_number, cycle), note: posNote({ ref: order.order_number, cycle, currency: order.currency, subtotal: Number(order.subtotal), bundle: Number(order.sticker_bundle_discount), promo: Number(order.discount_amount), code: order.promo_code, shipping: Number(order.shipping_fee), total: Number(order.total_amount), ...(promo.confirmed ? { confirmedBy: input.actor, promoThb: promo.discount } : {}) }), total_discounts: [], line_items: final.lines.map((l) => ({ ...l, line_taxes: settings.taxes })), payments: [{ payment_type_id: settings.paymentId }] };
    const { data: inserted, error: insertError } = await admin.from("order_pos_operations").insert({ order_id: input.id, cycle, kind, payload: json(payload), total_thb: final.total, promo_thb: promo.discount, confirmed_by: promo.confirmed ? input.actor : null }).select("*").single();
    if (insertError || !inserted) throw new Error(insertError?.message ?? "Could not save receipt intent");
    op = inserted;
  }

  if (!op && kind === "refund") {
    if (!latestSale?.receipt_number) throw new Error("Original sale receipt missing.");
    const afterShipment = ["shipped", "completed"].includes(order.status);
    if (afterShipment && input.returnToStock === undefined) return { ok: false, returnStockRequired: true };
    const original = await lv.posRequest<lv.PosReceipt>(`/receipts/${encodeURIComponent(latestSale.receipt_number)}`);
    const payload = { source: source(order.order_number, cycle), line_items: original.line_items.map((l) => ({ id: l.id, quantity: l.quantity })) };
    const { data: inserted, error: insertError } = await admin.from("order_pos_operations").insert({ order_id: input.id, cycle, kind, original_receipt_number: latestSale.receipt_number, payload: json(payload), total_thb: original.total_money, return_to_stock: afterShipment ? input.returnToStock ?? true : true }).select("*").single();
    if (insertError || !inserted) throw new Error(insertError?.message ?? "Could not save refund intent");
    op = inserted;
  }
  if (!op) throw new Error("POS operation missing");
  // Payload is immutable on retries, including confirmed prices and refund inventory choice.
  if (kind === "sale") {
    const payload = op.payload as unknown as { line_items: { variant_id: string; quantity: number }[]; store_id: string };
    receiptDeltas = [];
    for (const l of payload.line_items) {
      const d = receiptDeltas.find((x) => x.variantId === l.variant_id);
      if (d) d.quantity += l.quantity; else receiptDeltas.push({ variantId: l.variant_id, quantity: l.quantity });
    }
    const existing = op.receipt_number ? true : await lv.findPosReceipt(order.order_number, source(order.order_number, cycle), "sale");
    if (!existing && ["ready", "failed"].includes(op.state)) {
      const levels = await lv.fetchLevels(receiptDeltas.map((d) => d.variantId));
      const shortfall = receiptDeltas.map((d) => ({ ...d, needed: d.quantity, available: levels.filter((l) => l.variant_id === d.variantId && l.store_id === payload.store_id).reduce((s, l) => s + l.in_stock, 0) })).filter((d) => d.available < d.needed);
      if (shortfall.length) return { ok: false, shortfall };
    }
  }
  const receipt = await ensureReceipt(admin, op, order.order_number);
  if (satang(receipt.total_money) !== satang(Number(op.total_thb))) throw new Error(`POS receipt ${receipt.receipt_number} total does not match the expected THB merchandise total. Check manually; order status unchanged.`);
  if (kind === "refund" && op.return_to_stock === false) {
    const salePayload = latestSale?.payload as unknown as { store_id: string };
    let targets = op.writeoff_targets as unknown as { variant_id: string; store_id: string; stock_after: number }[] | null;
    if (!targets) {
      targets = await lv.writeoffTargets(deltas, salePayload.store_id);
      await saveOp(admin, op.id, { writeoff_targets: json(targets), writeoff_state: "ready" });
    }
    if (op.writeoff_state === "submitting" || op.writeoff_state === "uncertain") {
      const levels = await lv.fetchLevels(targets.map((t) => t.variant_id));
      const reconciled = targets.every((t) => levels.some((l) => l.variant_id === t.variant_id && l.store_id === t.store_id && l.in_stock === t.stock_after));
      if (!reconciled) throw new Error("Refund receipt saved, but the inventory write-off outcome is uncertain. Check stock manually; no repeated adjustment was sent.");
    } else if (op.writeoff_state !== "completed") {
      await saveOp(admin, op.id, { writeoff_state: "submitting" });
      try { await lv.applyWriteoff(targets); }
      catch (e) { await saveOp(admin, op.id, { writeoff_state: "uncertain", error: errorText(e) }); throw new Error(`Refund receipt saved; inventory write-off needs reconciliation: ${errorText(e)}`); }
    }
    await saveOp(admin, op.id, { writeoff_state: "completed" });
  }
  await saveOp(admin, op.id, { state: "completed", completed_at: new Date().toISOString(), error: null });
  await lv.pullStock(admin).catch((e) => console.error("POS stock refresh failed", e));
  return { ok: true, deltas: receiptDeltas };
}