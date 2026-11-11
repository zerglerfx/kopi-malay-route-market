import { describe, expect, it } from "vitest";
import { planStockAction } from "@/lib/order-stock";

describe("order stock deduction timing", () => {
  it("verifying a new order deducts", () => expect(planStockAction("not_deducted", "verified")).toBe("deduct"));
  it("verifying again does nothing", () => expect(planStockAction("deducted", "verified")).toBe("none"));
  it("rejecting a never-deducted order changes no stock", () => expect(planStockAction("not_deducted", "rejected")).toBe("none"));
  it("rejecting a deducted order restores", () => expect(planStockAction("deducted", "rejected")).toBe("restore"));
  it("moving a deducted order back to pending restores", () => expect(planStockAction("deducted", "pending_verification")).toBe("restore"));
  it("rejecting a restored order again does nothing", () => expect(planStockAction("restored", "rejected")).toBe("none"));
  it("re-verifying after restore deducts once more", () => expect(planStockAction("restored", "verified")).toBe("deduct"));
  it("legacy orders are never moved automatically", () => {
    expect(planStockAction("unknown", "verified")).toBe("none");
    expect(planStockAction("unknown", "rejected")).toBe("none");
  });
  it("shipping requires verification first", () => expect(() => planStockAction("not_deducted", "shipped")).toThrow());
  it("blocks while another update is in progress", () => expect(() => planStockAction("deducting", "rejected")).toThrow());
});
