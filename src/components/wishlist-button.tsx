import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "@/hooks/use-wishlist";

export function WishlistButton({ productId, name, className = "" }: { productId: string; name: string; className?: string }) {
  const { has, toggle } = useWishlist();
  const on = has(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(productId); toast.success(on ? "Removed from wishlist" : "Saved to wishlist"); }}
      className={`grid size-9 place-items-center rounded-full border bg-background/90 text-foreground shadow-sm hover:bg-background ${className}`}
    >
      <Heart className={`size-4 ${on ? "fill-current" : ""}`} />
    </button>
  );
}
