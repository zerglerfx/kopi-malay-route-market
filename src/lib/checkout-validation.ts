import { z } from "zod";
import { MY_STATES } from "./shop";
import { receiptError } from "./manual-order";

export const CheckoutDetails = z.object({
  name: z.string().trim().min(1, "Please enter your full name.").max(120, "Full name must be 120 characters or fewer."),
  phone: z.string().trim().min(1, "Please enter your phone number.").max(30, "Phone number must be 30 characters or fewer.").refine(
    (v) => /^\+?[\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 6 && v.replace(/\D/g, "").length <= 15,
    "Please enter a valid phone number (6–15 digits).",
  ),
  email: z.string().trim().min(1, "Please enter your email address.").email("Please enter a valid email address.").max(255),
  address: z.string().trim().min(3, "Please fill in your shipping street address.").max(300),
  city: z.string().trim().min(1, "Please enter your city.").max(100),
  postcode: z.string().trim().regex(/^\d{5}$/, "Please enter a valid 5-digit postcode."),
  state: z.string().trim().min(1, "Please choose your state / region.").max(100),
  country: z.enum(["Malaysia", "Thailand"], { message: "Please select Malaysia or Thailand for delivery." }),
});

export function validateDeliveryState(data: { country: string; state: string }, ctx: z.RefinementCtx) {
  if (data.country === "Malaysia" && !(MY_STATES as readonly string[]).includes(data.state)) {
    ctx.addIssue({ code: "custom", path: ["state"], message: "Please choose a Malaysian state." });
  }
}

export const ValidatedCheckoutDetails = CheckoutDetails.superRefine(validateDeliveryState);
export type CheckoutField = keyof z.infer<typeof CheckoutDetails> | "receipt";
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export function checkoutErrors(details: unknown, receipt: { type: string; size: number } | null): CheckoutErrors {
  const result = ValidatedCheckoutDetails.safeParse(details);
  const errors: CheckoutErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as CheckoutField;
      if (!errors[key]) errors[key] = issue.message;
    }
  }
  const fileError = receiptError(receipt);
  if (fileError) errors.receipt = fileError;
  return errors;
}