import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  full_name: string; phone: string; address: string; city: string; state: string; postcode: string; country: string;
  motorcycle_make: string; motorcycle_model: string; motorcycle_plate: string; preferred_contact: string; contact_handle: string;
};

export const EMPTY_PROFILE: Profile = {
  full_name: "", phone: "", address: "", city: "", state: "", postcode: "", country: "malaysia",
  motorcycle_make: "", motorcycle_model: "", motorcycle_plate: "", preferred_contact: "whatsapp", contact_handle: "",
};

export const CONTACT_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone call" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
];

/** Load the signed-in user's profile (RLS limits this to their own row). Returns null when signed out. */
export async function loadMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const out = { ...EMPTY_PROFILE };
  if (data) for (const k of Object.keys(out) as (keyof Profile)[]) out[k] = (data[k] as string | null) ?? out[k];
  return out;
}
