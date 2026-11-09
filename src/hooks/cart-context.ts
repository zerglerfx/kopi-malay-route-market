import { createContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { Product } from "@/lib/shop";
import type { CartItem } from "./use-cart";

export type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (value: boolean) => void;
  user: User | null;
  add: (product: Product, variant: string, quantity: number) => Promise<void>;
  setQty: (productId: string, variant: string, quantity: number) => Promise<void>;
  remove: (productId: string, variant: string) => Promise<void>;
  clear: () => Promise<void>;
};

// Keep identity stable across refreshes: mounted providers and new consumers
// must read the same context, even while route modules update independently.
export const CartContext = createContext<CartContextValue | null>(null);