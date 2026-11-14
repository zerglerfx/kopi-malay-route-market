/** Undo Verify / Refund orchestration. Dependencies are injected so the order of operations is testable. */
export type ReverseKind = "undo_verify" | "refund";
export const REVERSE_FROM: Record<ReverseKind, string[]> = { undo_verify: ["verified"], refund: ["verified", "shipped", "completed"] };
export const REVERSE_TO: Record<ReverseKind, string> = { undo_verify: "pending_verification", refund: "refunded" };

type PosOutcome = { ok: true } | { ok: false; [k: string]: unknown };
export type ReverseDeps = {
  assertOwner: () => Promise<void>;
  verifyPin: () => Promise<{ ok: true } | { ok: false; reason: string; lockedUntil?: string }>;
  claim: (allowed: string[]) => Promise<string | null>;
  pos: () => Promise<PosOutcome>;
  release: () => Promise<void>;
  refundReceipt: () => Promise<string | null>;
  finish: (to: string, receipt: string | null) => Promise<boolean>;
  notify: (previous: string, receipt: string | null) => Promise<unknown>;
  log?: (msg: string, err: unknown) => void;
};
export type ReverseResult = { ok: true; previous: string; receipt: string | null } | { ok: false; pin: { reason: string; lockedUntil?: string } } | { ok: false; pos: PosOutcome };

export async function runReversal(kind: ReverseKind, d: ReverseDeps): Promise<ReverseResult> {
  await d.assertOwner();                       // 1. owner role, as the caller
  const pin = await d.verifyPin();             // 2. PIN (wrong PIN changes nothing on the order)
  if (!pin.ok) return { ok: false, pin };
  const previous = await d.claim(REVERSE_FROM[kind]); // 3. atomic claim
  if (!previous) throw new Error("This order was just changed, already refunded, or is not eligible. Refresh and try again.");
  try {                                        // 4. Loyverse (skips posting when a receipt is already saved)
    const res = await d.pos();
    if (!res.ok) { await d.release(); return { ok: false, pos: res }; }
  } catch (err) {
    await d.release();                         // restore original status + stock state, no history row
    throw err;
  }
  const receipt = await d.refundReceipt();
  // 5. status + history in one transaction. If this fails the claim stays; a retry reuses the saved receipt.
  if (!(await d.finish(REVERSE_TO[kind], receipt))) throw new Error("Refund receipt saved but the order could not be finalised. Retry; no second receipt will be created.");
  try { await d.notify(previous, receipt); } catch (err) { (d.log ?? console.error)("Telegram alert failed", err); }
  return { ok: true, previous, receipt };
}
