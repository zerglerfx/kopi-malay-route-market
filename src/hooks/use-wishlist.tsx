import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "./use-cart";
import { WishlistContext, type WishlistContextValue } from "./wishlist-context";
import { mergeWishlist, toggleWishlist } from "@/lib/wishlist";

const LS = "km_wishlist";
const readLocal = (): string[] => { try { return JSON.parse(localStorage.getItem(LS) || "[]"); } catch { return []; } };
const writeLocal = (ids: string[]) => localStorage.setItem(LS, JSON.stringify(ids));

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useCart();
  const [ids, setIds] = useState<string[]>([]);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setIds(readLocal()); return; }
      const { data } = await supabase.from("wishlist_items").select("product_id").eq("user_id", user.id).order("created_at");
      const account = (data ?? []).map((r) => r.product_id);
      const guest = readLocal();
      const extra = guest.filter((g) => !account.includes(g));
      if (extra.length) {
        await supabase.from("wishlist_items").upsert(extra.map((product_id) => ({ user_id: user.id, product_id })), { onConflict: "user_id,product_id" });
        writeLocal([]);
      }
      if (!cancelled) setIds(mergeWishlist(account, guest));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggle = useCallback(async (productId: string) => {
    const had = idsRef.current.includes(productId);
    const next = toggleWishlist(idsRef.current, productId);
    setIds(next);
    if (!user) { writeLocal(next); return; }
    if (had) await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
    else await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
  }, [user]);

  const value = useMemo<WishlistContextValue>(() => ({ ids, has: (id) => ids.includes(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be inside WishlistProvider");
  return ctx;
}
