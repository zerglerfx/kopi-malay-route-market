import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "./use-cart";

/** UI hint only — every admin server function re-checks the role server-side. */
export function useIsAdmin() {
  const { user } = useCart();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setAdmin(Boolean(data)));
  }, [user]);
  return admin;
}
