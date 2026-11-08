import { describe, expect, it } from "vitest";
import { makeOrderRef, ORDER_REF_RE, receiptError } from "@/lib/manual-order";

describe("manual QR orders", () => {
  it("makes KM- plus 5 digit references", () => {
    expect(makeOrderRef(() => 0)).toBe("KM-10000");
    expect(makeOrderRef(() => 0.99999)).toMatch(ORDER_REF_RE);
  });
  it("accepts PNG, JPG and PDF up to 5MB", () => {
    expect(receiptError({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
    expect(receiptError({ type: "application/pdf", size: 1000 })).toBeNull();
  });
  it("rejects over 5MB, other types and missing files", () => {
    expect(receiptError({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
    expect(receiptError({ type: "image/gif", size: 10 })).not.toBeNull();
    expect(receiptError(null)).not.toBeNull();
  });
});
