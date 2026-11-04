import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { effectivePrice, mergeCartLines, type Product } from "@/lib/shop";

export type CartItem = {
  productId: string;
  variant: string;
  quantity: number;
  name: string;
  slug: string;
  image: string;
  unitPrice: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  user: User | null;
  add: (p: Product, variant: string, qty: number) => Promise<void>;
  setQty: (productId: string, variant: string, qty: number) => Promise<void>;
  remove: (productId: string, variant: string) => Promise<void>;
  clear: () => Promise<void>;
};

const Ctx = createContext<CartCtx | null>(null);
const LS_KEY = "km_cart";
const SESSION_KEY = "km_session_id";

function readLocal(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function writeLocal(items: CartItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}
export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, id); }
  return id;
}

type DbRow = {
  product_id: string; selected_variant: string; quantity: number;
  products: { name: string; slug: string; images: string[]; price: number; sale_price: number | null } | null;
};

async function fetchDbCart(userId: string): Promise<CartItem[]> {
  const { data } = await supabase
    .from("cart_items")
    .select("product_id,selected_variant,quantity,products(name,slug,images,price,sale_price)")
    .eq("user_id", userId)
    .order("created_at");
  return ((data ?? []) as unknown as DbRow[]).filter((r) => r.products).map((r) => ({
    productId: r.product_id,
    variant: r.selected_variant,
    quantity: r.quantity,
    name: r.products!.name,
    slug: r.products!.slug,
    image: r.products!.images?.[0] ?? "",
    unitPrice: effectivePrice({ price: Number(r.products!.price), sale_price: r.products!.sale_price == null ? null : Number(r.products!.sale_price) }),
  }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);

  const syncUser = useCallback(async (u: User | null) => {
    userRef.current = u;
    setUser(u);
    if (!u) { setItems(readLocal()); return; }
    const guest = readLocal();
    const account = await fetchDbCart(u.id);
    if (guest.length) {
      const merged = mergeCartLines(account, guest);
      const sessionId = getSessionId();
      await supabase.from("cart_items").upsert(
        merged.map((m) => ({ user_id: u.id, session_id: sessionId, product_id: m.productId, selected_variant: m.variant, quantity: m.quantity })),
        { onConflict: "user_id,product_id,selected_variant" },
      );
      writeLocal([]);
      setItems(merged);
    } else {
      setItems(account);
    }
  }, []);

  useEffect(() => {
    getSessionId();
    setItems(readLocal());
    supabase.auth.getUser().then(({ data }) => syncUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        const next = session?.user ?? null;
        if (next?.id !== userRef.current?.id) void syncUser(next);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [syncUser]);

  const persist = useCallback(async (next: CartItem[], changed?: CartItem, removed?: { productId: string; variant: string }) => {
    setItems(next);
    const u = userRef.current;
    if (!u) { writeLocal(next); return; }
    if (changed) {
      await supabase.from("cart_items").upsert(
        { user_id: u.id, session_id: getSessionId(), product_id: changed.productId, selected_variant: changed.variant, quantity: changed.quantity },
        { onConflict: "user_id,product_id,selected_variant" },
      );
    }
    if (removed) {
      await supabase.from("cart_items").delete().eq("user_id", u.id).eq("product_id", removed.productId).eq("selected_variant", removed.variant);
    }
  }, []);

  const add = useCallback(async (p: Product, variant: string, qty: number) => {
    const cur = items;
    const hit = cur.find((i) => i.productId === p.id && i.variant === variant);
    const line: CartItem = hit
      ? { ...hit, quantity: hit.quantity + qty }
      : { productId: p.id, variant, quantity: qty, name: p.name, slug: p.slug, image: p.images[0] ?? "", unitPrice: effectivePrice(p) };
    const next = hit ? cur.map((i) => (i === hit ? line : i)) : [...cur, line];
    await persist(next, line);
  }, [items, persist]);

  const remove = useCallback(async (productId: string, variant: string) => {
    await persist(items.filter((i) => !(i.productId === productId && i.variant === variant)), undefined, { productId, variant });
  }, [items, persist]);

  const setQty = useCallback(async (productId: string, variant: string, qty: number) => {
    if (qty < 1) return remove(productId, variant);
    const next = items.map((i) => (i.productId === productId && i.variant === variant ? { ...i, quantity: qty } : i));
    await persist(next, next.find((i) => i.productId === productId && i.variant === variant));
  }, [items, persist, remove]);

  const clear = useCallback(async () => {
    setItems([]);
    writeLocal([]);
    const u = userRef.current;
    if (u) await supabase.from("cart_items").delete().eq("user_id", u.id);
  }, []);

  const value = useMemo<CartCtx>(() => ({
    items, open, setOpen, user, add, setQty, remove, clear,
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
  }), [items, open, user, add, setQty, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
}
