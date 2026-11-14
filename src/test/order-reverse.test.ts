import { describe, expect, it, vi } from "vitest";
import { runReversal, type ReverseDeps } from "@/lib/order-reverse.server";
import { actionsFor, canRefund, canUndoVerify, salesTotals } from "@/lib/order-flow";

function world(over: Partial<ReverseDeps> = {}) {
  const state = { status: "completed", claimed: false, history: 0, posCalls: 0, receipt: null as string | null };
  const deps: ReverseDeps = {
    assertOwner: async () => {},
    verifyPin: async () => ({ ok: true }),
    claim: async (allowed) => { if (state.claimed || !allowed.includes(state.status)) return null; state.claimed = true; const p = state.status; state.status = "reversing"; return p; },
    pos: async () => { state.posCalls++; state.receipt ??= "R-1"; return { ok: true }; },
    release: async () => { state.status = "completed"; state.claimed = false; },
    refundReceipt: async () => state.receipt,
    finish: async (to) => { state.status = to; state.claimed = false; state.history++; return true; },
    notify: async () => {},
    log: () => {},
    ...over,
  };
  return { state, deps };
}

describe("owner reversals", () => {
  it("a second refund is blocked", async () => {
    const { state, deps } = world();
    expect((await runReversal("refund", deps)).ok).toBe(true);
    await expect(runReversal("refund", deps)).rejects.toThrow();
    expect(state.history).toBe(1);
  });
  it("an admin-only account is rejected before anything changes", async () => {
    const { state, deps } = world({ assertOwner: async () => { throw new Error("Forbidden: owner access required"); } });
    await expect(runReversal("refund", deps)).rejects.toThrow("owner");
    expect(state).toMatchObject({ status: "completed", posCalls: 0, history: 0 });
  });
  it("a wrong PIN changes nothing", async () => {
    const { state, deps } = world({ verifyPin: async () => ({ ok: false, reason: "wrong" }) });
    expect(await runReversal("refund", deps)).toMatchObject({ ok: false });
    expect(state).toMatchObject({ status: "completed", claimed: false, posCalls: 0, history: 0 });
  });
  it("a Loyverse failure restores the status and writes no history", async () => {
    const { state, deps } = world({ pos: async () => { throw new Error("Loyverse down"); } });
    await expect(runReversal("refund", deps)).rejects.toThrow("Loyverse down");
    expect(state).toMatchObject({ status: "completed", claimed: false, history: 0 });
  });
  it("a Telegram failure does not affect the result", async () => {
    const { state, deps } = world({ notify: async () => { throw new Error("telegram down"); } });
    expect((await runReversal("refund", deps)).ok).toBe(true);
    expect(state.status).toBe("refunded");
  });
  it("Refunded is terminal for every action", () => {
    expect(actionsFor("refunded")).toEqual([]);
    expect(canRefund("refunded")).toBe(false);
    expect(canUndoVerify("refunded")).toBe(false);
    expect(canUndoVerify("shipped")).toBe(false);
    expect(canRefund("pending_verification")).toBe(false);
  });
  it("refunded and rejected orders are excluded from sales totals", () => {
    const t = salesTotals([
      { status: "completed", currency: "myr", total_amount: 50 },
      { status: "refunded", currency: "myr", total_amount: 30 },
      { status: "rejected", currency: "thb", total_amount: 100 },
      { status: "verified", currency: "thb", total_amount: 200 },
    ]);
    expect(t).toEqual({ count: 2, myr: 50, thb: 200 });
  });
});
