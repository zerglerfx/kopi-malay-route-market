import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/loyverse.server", () => ({ posRequest: vi.fn(), findPosReceipt: vi.fn(), posSettings: vi.fn(), fetchLevels: vi.fn(), adjustStock: vi.fn(), pullStock: vi.fn(), writeoffTargets: vi.fn(), applyWriteoff: vi.fn() }));
import * as lv from "@/lib/loyverse.server";
import { processOrderPos } from "@/lib/order-pos.server";

const variant = "shared";
const receipt = { receipt_number: "6-52329", receipt_type: "SALE", refund_for: null, order: "KM-73679", total_money: 140, line_items: [{ id: "line", variant_id: variant, quantity: 3 }] };
let order: any, ops: any[], posts: number;
function client() {
 return { from(table: string) {
  let mode = "read", patch: any;
  const chain: any = {
   select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
   insert: (v: any) => { mode = "insert"; patch = v; return chain; }, update: (v: any) => { mode = "update"; patch = v; return chain; },
   single: () => Promise.resolve(run(true)), maybeSingle: () => Promise.resolve(run(true)),
   then: (resolve: any) => Promise.resolve(run(false)).then(resolve),
  };
  function run(single: boolean) {
   if (table === "orders") return { data: order, error: null };
   if (table === "order_pos_operations") {
    if (mode === "insert") { const op = { id: `op${ops.length}`, state: "ready", receipt_number: null, writeoff_state: "none", ...patch }; ops.unshift(op); return { data: op, error: null }; }
    if (mode === "update") { Object.assign(ops[0], patch); return { data: null, error: null }; }
    return { data: ops, error: null };
   }
   const data: Record<string, any> = { products: [{ id: "p", price_thb: 49, sale_price_thb: null, categories: { slug: "stickers" } }], product_stock: [], shared_stock_links: [{ product_id: "p", loyverse_variant_id: variant }], promo_codes: null };
   return { data: single ? data[table] : data[table] ?? [], error: null };
  }
  return chain;
 } } as any;
}
beforeEach(() => {
 vi.resetAllMocks(); posts = 0; ops = [];
 order = { id: "order", order_number: "KM-73679", status: "pending_verification", currency: "myr", subtotal: 19.5, shipping_fee: 20, total_amount: 38, discount_amount: 0, sticker_bundle_discount: 1.5, promo_code: null, promo_snapshot: null, stock_deductions: [{ variantId: variant, quantity: 3 }], order_items: [{ product_id: "p", product_name: "STICKER (8x8cm) - A", selected_variant: "", quantity: 3 }], stock_deducted_at: null, stock_restored_at: null };
 vi.mocked(lv.posSettings).mockResolvedValue({ storeId: "store", paymentId: "web", taxes: [{ id: "vat" }] });
 vi.mocked(lv.findPosReceipt).mockResolvedValue(null);
 vi.mocked(lv.fetchLevels).mockResolvedValue([{ variant_id: variant, store_id: "store", in_stock: 10 }]);
 vi.mocked(lv.posRequest).mockImplementation(async (_path, body) => { if (body) posts++; return receipt as any; });
 vi.mocked(lv.pullStock).mockResolvedValue(1);
});
const verify = () => processOrderPos(client(), { id: "order", action: "deduct", actor: "admin" });
describe("durable POS receipt flow", () => {
 it("creates a sale without direct stock adjustment and reuses it on retry", async () => {
  expect((await verify()).ok).toBe(true); expect((await verify()).ok).toBe(true);
  expect(posts).toBe(1); expect(lv.adjustStock).not.toHaveBeenCalled();
  expect(ops[0].payload.line_items.reduce((s: number, l: any) => s + Math.round(l.price * 100) * l.quantity, 0)).toBe(14000);
  expect(ops[0].payload.total_discounts).toEqual([]);
 });
 it("shortfall prevents a receipt", async () => {
  vi.mocked(lv.fetchLevels).mockResolvedValue([{ variant_id: variant, store_id: "store", in_stock: 2 }]);
  expect(await verify()).toMatchObject({ ok: false, shortfall: [{ needed: 3, available: 2 }] }); expect(posts).toBe(0);
 });
 it("reconciles a timed-out successful receipt instead of posting twice", async () => {
  vi.mocked(lv.posRequest).mockRejectedValueOnce(new Error("timeout"));
  vi.mocked(lv.findPosReceipt).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(receipt);
  expect((await verify()).ok).toBe(true); expect(ops[0].receipt_number).toBe("6-52329");
 });
 it("an unresolved timeout never sends a second sale", async () => {
  vi.mocked(lv.posRequest).mockRejectedValue(new Error("timeout"));
  await expect(verify()).rejects.toThrow("timeout");
  await expect(verify()).rejects.toThrow("uncertain outcome");
  expect(lv.posRequest).toHaveBeenCalledTimes(1);
 });
 it("historical reversal retains count restore", async () => {
  expect((await processOrderPos(client(), { id: "order", action: "restore", actor: "admin" })).ok).toBe(true);
  expect(lv.adjustStock).toHaveBeenCalledWith(expect.anything(), order.stock_deductions, 1); expect(posts).toBe(0);
 });
 it("asks about stock only after shipment", async () => {
  await verify(); order.status = "shipped";
  expect(await processOrderPos(client(), { id: "order", action: "restore", actor: "admin" })).toEqual({ ok: false, returnStockRequired: true });
  expect(posts).toBe(1);
 });
 it("before shipping refunds automatically with return to stock", async () => {
  await verify(); order.status = "verified";
  vi.mocked(lv.posRequest).mockResolvedValue({ ...receipt, receipt_number: "6-52330", receipt_type: "REFUND", refund_for: "6-52329" });
  await processOrderPos(client(), { id: "order", action: "restore", actor: "admin", returnToStock: false });
  expect(ops[0].return_to_stock).toBe(true); expect(lv.applyWriteoff).not.toHaveBeenCalled();
 });
 it("no-return refund writes inventory off once", async () => {
  await verify(); order.status = "completed";
  vi.mocked(lv.posRequest).mockResolvedValue({ ...receipt, receipt_number: "6-52330", receipt_type: "REFUND", refund_for: "6-52329" });
  vi.mocked(lv.writeoffTargets).mockResolvedValue([{ variant_id: variant, store_id: "store", stock_after: 7 }]);
  await processOrderPos(client(), { id: "order", action: "restore", actor: "admin", returnToStock: false });
  await processOrderPos(client(), { id: "order", action: "restore", actor: "admin", returnToStock: false });
  expect(lv.applyWriteoff).toHaveBeenCalledTimes(1); expect(lv.adjustStock).not.toHaveBeenCalled();
 });
 it("re-verification starts sale 2 and checks live inventory again", async () => {
  await verify(); order.status = "verified"; order.stock_deducted_at = "2026-11-12T01:00:00Z";
  vi.mocked(lv.posRequest).mockResolvedValue({ ...receipt, receipt_number: "6-52330", receipt_type: "REFUND", refund_for: "6-52329" });
  await processOrderPos(client(), { id: "order", action: "restore", actor: "admin" });
  order.stock_restored_at = "2026-11-12T02:00:00Z"; order.status = "pending";
  vi.mocked(lv.posRequest).mockResolvedValue({ ...receipt, receipt_number: "6-52331" });
  await verify(); expect(ops[0].cycle).toBe(2); expect(ops[0].payload.note).toContain("sale 2"); expect(lv.fetchLevels).toHaveBeenCalledTimes(2);
 });
});