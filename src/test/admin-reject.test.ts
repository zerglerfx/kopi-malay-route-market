import { describe, it, expect, vi } from "vitest";
import { buildRejectAlert, runReject, MAX_ALERT_ITEM_LINES } from "@/lib/order-reject";

const base = {
  orderNumber: "KM-1", actorEmail: "staff@shop.test", actorRole: "staff" as const, at: new Date("2026-11-14T10:00:00Z"),
  customerName: "Ali", country: "malaysia", items: [{ product_name: "Tumbler", selected_variant: "", quantity: 2 }, { product_name: "Jersey", selected_variant: "M", quantity: 1 }],
  currency: "myr", total: 120, reason: null,
};

describe("order rejection alert", () => {
  it("sends the alert once after a successful reject", async () => {
    const send = vi.fn().mockResolvedValue(true);
    const r = await runReject({ transition: async () => true, buildAlert: async () => "x", send });
    expect(r).toEqual({ ok: true, alerted: true });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not send when the transition is refused or repeated", async () => {
    const send = vi.fn().mockResolvedValue(true);
    let status = "pending_verification";
    const transition = async () => { if (status !== "pending_verification") return false; status = "rejected"; return true; };
    await runReject({ transition, buildAlert: async () => "x", send });
    const second = await runReject({ transition, buildAlert: async () => "x", send });
    expect(second.ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("a Telegram failure does not undo the rejection", async () => {
    let status = "pending_verification";
    const r = await runReject({ transition: async () => { status = "rejected"; return true; }, buildAlert: async () => "x", send: async () => { throw new Error("down"); }, log: () => {} });
    expect(r.ok).toBe(true);
    expect(status).toBe("rejected");
  });
  it("contains no customer email, phone, address, token or slip URL; staff email allowed", () => {
    const text = buildRejectAlert(base);
    for (const bad of ["ali@customer.test", "+60123456789", "Jalan Ampang", "tok_secret", "receipts/"]) expect(text).not.toContain(bad);
    expect(text).toContain("staff@shop.test [Staff]");
    expect(text).toContain("2 × Tumbler");
    expect(text).toContain("1 × Jersey (M)");
    expect(text).toContain("RM 120.00");
    expect(text).toContain("No reason given");
  });
  it("escapes special characters in user-entered text", () => {
    const text = buildRejectAlert({ ...base, customerName: "A<b>", items: [{ product_name: "Mug & <i>", selected_variant: "", quantity: 1 }], reason: "bad <slip> & _x_ *y* [z]" });
    expect(text).toContain("Reason: bad &lt;slip&gt; &amp; _x_ *y* [z]");
    expect(text).toContain("A&lt;b&gt;");
    expect(text).toContain("Mug &amp; &lt;i&gt;");
    expect(text).not.toContain("<slip>");
  });
  it("caps items at 8 lines then '+N more items'", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ product_name: `P${i}`, selected_variant: "", quantity: 1 }));
    const text = buildRejectAlert({ ...base, items });
    expect(text.split("\n").filter((l) => l.startsWith("  – ") && l.includes("× P")).length).toBe(MAX_ALERT_ITEM_LINES);
    expect(text).toContain("+4 more items");
    expect(text.length).toBeLessThan(4096);
  });
});
