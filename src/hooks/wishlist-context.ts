import { createContext } from "react";

export type WishlistContextValue = {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
};

export const WishlistContext = createContext<WishlistContextValue | null>(null);
