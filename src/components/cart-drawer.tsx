import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { formatRM, imageFor } from "@/lib/shop";

export function CartDrawer() {
  const { items, open, setOpen, subtotal, setQty, remove } = useCart();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader><SheetTitle className="font-display uppercase">Your Cart</SheetTitle></SheetHeader>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <p>Your cart is empty.</p>
            <Button asChild onClick={() => setOpen(false)}><Link to="/shop">Start shopping</Link></Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-4">
              {items.map((i) => (
                <li key={i.productId + i.variant} className="flex gap-3 py-4">
                  <img src={imageFor(i.image)} alt={i.name} className="size-20 rounded-md border object-cover" />
                  <div className="flex flex-1 flex-col">
                    <p className="font-medium leading-tight">{i.name}</p>
                    {i.variant && <p className="text-xs text-muted-foreground">Size: {i.variant}</p>}
                    <p className="text-sm">{formatRM(i.unitPrice)}</p>
                    <div className="mt-auto flex items-center gap-2">
                      <button aria-label="Decrease" className="rounded border p-1" onClick={() => setQty(i.productId, i.variant, i.quantity - 1)}><Minus className="size-3" /></button>
                      <span className="w-6 text-center text-sm">{i.quantity}</span>
                      <button aria-label="Increase" className="rounded border p-1" onClick={() => setQty(i.productId, i.variant, i.quantity + 1)}><Plus className="size-3" /></button>
                      <button aria-label="Remove" className="ml-auto text-muted-foreground hover:text-sale" onClick={() => remove(i.productId, i.variant)}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t p-4">
              <div className="mb-1 flex justify-between font-display text-lg font-bold"><span>Subtotal</span><span>{formatRM(subtotal)}</span></div>
              <p className="mb-4 text-xs text-muted-foreground">Shipping calculated at checkout.</p>
              <Button asChild className="w-full" size="lg" onClick={() => setOpen(false)}><Link to="/checkout">Checkout</Link></Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
