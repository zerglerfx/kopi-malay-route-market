import { describe, expect, it } from "vitest";
import { checkoutErrors, ValidatedCheckoutDetails } from "@/lib/checkout-validation";

const details = { name: "Test Rider", phone: "+60 12-345 6789", email: "rider@example.com", address: "12 Jalan Test", city: "Shah Alam", postcode: "40000", state: "Selangor", country: "Malaysia" };
const receipt = { type: "image/jpeg", size: 1000 };

describe("mandatory checkout details", () => {
  for (const field of ["name", "phone", "email", "address", "city", "postcode", "state", "country"] as const) {
    it(`blocks missing ${field}`, () => {
      expect(checkoutErrors({ ...details, [field]: "   " }, receipt)[field]).toBeTruthy();
      expect(ValidatedCheckoutDetails.safeParse({ ...details, [field]: "   " }).success).toBe(false);
    });
  }
  it("requires payment proof", () => {
    expect(checkoutErrors(details, null).receipt).toBe("Please upload your payment proof.");
  });
  it("rejects invalid email, phone and postcode", () => {
    const errors = checkoutErrors({ ...details, email: "invalid", phone: "abcdef", postcode: "1234" }, receipt);
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.postcode).toBeTruthy();
  });
  it("requires a valid Malaysian state and blocks Singapore", () => {
    expect(checkoutErrors({ ...details, state: "Bangkok" }, receipt).state).toBeTruthy();
    expect(checkoutErrors({ ...details, country: "Singapore" }, receipt).country).toBeTruthy();
  });
  it("accepts complete Malaysian and Thai details with valid proof", () => {
    expect(checkoutErrors(details, receipt)).toEqual({});
    expect(checkoutErrors({ ...details, country: "Thailand", state: "Tak", postcode: "63000", phone: "+66 81 234 5678" }, receipt)).toEqual({});
  });
  it("rejects invalid receipt types, empty and oversized files", () => {
    for (const file of [{ type: "image/gif", size: 1000 }, { type: "image/png", size: 0 }, { type: "application/pdf", size: 5 * 1024 * 1024 + 1 }]) {
      expect(checkoutErrors(details, file).receipt).toBeTruthy();
    }
  });
});