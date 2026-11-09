import { z } from "zod";

export const TowingRequest = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  plate_number: z.string().trim().min(1, "Please enter the plate number.").max(20),
  motorcycle_model: z.string().trim().min(1, "Please enter the motorcycle model.").max(80),
  phone: z.string().trim().min(1, "Please enter your phone number.").max(30).refine(
    (v) => /^\+?[\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 6 && v.replace(/\D/g, "").length <= 15,
    "Please enter a valid phone number (6–15 digits).",
  ),
  breakdown_location: z.string().trim().min(3, "Describe where you are / distance marker.").max(300),
  destination: z.string().trim().min(3, "Please enter the towing destination address.").max(300),
  pickup_lat: z.number().min(-90).max(90).nullable(),
  pickup_lng: z.number().min(-180).max(180).nullable(),
});
export type TowingInput = z.infer<typeof TowingRequest>;

export const TOWING_STATUSES = ["new", "dispatched", "completed", "cancelled"] as const;

export function towingErrors(input: unknown): Partial<Record<keyof TowingInput, string>> {
  const r = TowingRequest.safeParse(input);
  const out: Partial<Record<keyof TowingInput, string>> = {};
  if (!r.success) for (const i of r.error.issues) { const k = i.path[0] as keyof TowingInput; out[k] ??= i.message; }
  return out;
}
