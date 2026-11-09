export type AdminOrderRow = {
  order_number: string;
  created_at: string;
  status: string;
  currency: string;
  total_amount: number;
  payment_method: string;
  tracking_number: string | null;
  email: string | null;
  address: { name?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; country?: string };
  items: { product_name: string; selected_variant: string; quantity: number }[];
};

export const CSV_HEADERS = ["NO.", "Name", "Address", "Phone Number", "Email", "Order Ref", "Payment", "Status", "Items", "Total", "Tracking No.", "Date"];

export const fullAddress = (a: AdminOrderRow["address"]) =>
  [a.address, a.postcode && a.city ? `${a.postcode} ${a.city}` : a.city ?? a.postcode, a.state, a.country].filter(Boolean).join(", ");

export const itemsText = (items: AdminOrderRow["items"]) =>
  items.map((i) => `${i.quantity} × ${i.product_name}${i.selected_variant ? ` (${i.selected_variant})` : ""}`).join("; ");

const cell = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR) for text cells.
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Excel-friendly CSV (UTF-8 BOM, CRLF). Rows are numbered in the order given. */
export function ordersToCsv(rows: AdminOrderRow[]): string {
  const lines = rows.map((r, i) => [
    i + 1, r.address.name, fullAddress(r.address), r.address.phone, r.email, r.order_number, r.payment_method, r.status,
    itemsText(r.items), `${r.currency.toUpperCase()} ${Number(r.total_amount).toFixed(2)}`, r.tracking_number, r.created_at.slice(0, 10),
  ].map(cell).join(","));
  return "\uFEFF" + [CSV_HEADERS.join(","), ...lines].join("\r\n");
}

export const digits = (s: string) => s.replace(/\D/g, "");
