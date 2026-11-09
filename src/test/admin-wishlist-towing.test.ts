import { describe, expect, it } from "vitest";
import { CSV_HEADERS, digits, ordersToCsv } from "@/lib/admin-csv";
import { mergeWishlist, toggleWishlist } from "@/lib/wishlist";
import { towingErrors } from "@/lib/towing";

const order = {
  order_number: "KM-12345", created_at: "2026-11-09T06:00:00Z", status: "pending_verification", currency: "myr", total_amount: 95,
  payment_method: "duitnow_qr", tracking_number: null, email: "a@b.com",
  address: { name: 'Ali, "Bob"', phone: "+60 12-345 6789", address: "1 Jalan", city: "KL", state: "Selangor", postcode: "50000", country: "Malaysia" },
  items: [{ product_name: "Tumbler", selected_variant: "", quantity: 2 }],
};

describe("order export", () => {
  it("uses the operational column order starting with NO., Name, Address, Phone Number", () => {
    expect(CSV_HEADERS.slice(0, 4)).toEqual(["NO.", "Name", "Address", "Phone Number"]);
  });
  it("numbers rows, escapes quotes/commas and starts with a BOM for Excel", () => {
    const csv = ordersToCsv([order]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[1]).toMatch(/^1,"Ali, ""Bob""",/);
    expect(csv).toContain("2 × Tumbler");
  });
  it("phone search ignores formatting", () => {
    expect(digits(order.address.phone).includes(digits("019 345"))).toBe(false);
    expect(digits(order.address.phone).includes(digits("12-345"))).toBe(true);
  });
});

describe("wishlist", () => {
  it("merges guest items into the account without duplicates", () => {
    expect(mergeWishlist(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
  it("toggles items on and off", () => {
    expect(toggleWishlist(["a"], "a")).toEqual([]);
    expect(toggleWishlist([], "a")).toEqual(["a"]);
  });
});

describe("towing form", () => {
  it("requires every field", () => {
    const e = towingErrors({ name: "", plate_number: "", motorcycle_model: "", phone: "", breakdown_location: "", destination: "", pickup_lat: null, pickup_lng: null });
    expect(Object.keys(e).sort()).toEqual(["breakdown_location", "destination", "motorcycle_model", "name", "phone", "plate_number"]);
  });
  it("accepts a complete request", () => {
    expect(towingErrors({ name: "Ali", plate_number: "WXY1", motorcycle_model: "CB500X", phone: "+60123456789", breakdown_location: "KM 45 Route 1090", destination: "Tak workshop", pickup_lat: 16.8, pickup_lng: 99.1 })).toEqual({});
  });
});
