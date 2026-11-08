// Browser-safe helpers shared by checkout and the order server functions.
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ["image/png", "image/jpeg", "application/pdf"] as const;

export function receiptError(file: { type: string; size: number } | null | undefined): string | null {
  if (!file) return "Please upload your payment proof.";
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return "Receipt must be a PNG, JPG or PDF file.";
  if (file.size > RECEIPT_MAX_BYTES) return "Receipt must be 5MB or smaller.";
  if (file.size === 0) return "Receipt file is empty.";
  return null;
}

export const ORDER_REF_RE = /^KM-\d{5}$/;
export function makeOrderRef(rand: () => number = Math.random): string {
  return `KM-${String(Math.floor(rand() * 90000) + 10000)}`;
}

export const SUPPORT_TELEGRAM_URL = "https://t.me/kopimalay";
