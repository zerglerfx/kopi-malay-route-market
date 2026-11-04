import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";

export const NAV = [
  { label: "Shop All", category: undefined },
  { label: "Shirts", category: "shirts" },
  { label: "Sweaters & Jackets", category: "sweaters-jackets" },
  { label: "Stickers", category: "stickers" },
  { label: "Tumblers", category: "tumblers" },
  { label: "Other Merch", category: "other-merch" },
] as const;

function NavLink({ item, onClick }: { item: (typeof NAV)[number]; onClick?: () => void }) {
  const cls = "font-display text-sm font-medium uppercase tracking-wide text-ink-foreground/80 hover:text-ink-foreground [&.active]:text-signal";
  return item.category ? (
    <Link to="/shop/$category" params={{ category: item.category }} className={cls} onClick={onClick}>{item.label}</Link>
  ) : (
    <Link to="/shop" className={cls} onClick={onClick} activeOptions={{ exact: true }}>{item.label}</Link>
  );
}

export function SiteHeader() {
  const { count, setOpen, user } = useCart();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <header className="no-print sticky top-0 z-40 bg-ink text-ink-foreground">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <button className="lg:hidden" aria-label="Menu" onClick={() => setMenu(!menu)}>
          {menu ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-sm bg-signal font-display text-xs font-bold text-signal-foreground">R1</span>
          <span className="font-display text-lg font-bold leading-none">
            KOPI MALAY<span className="block text-[10px] font-medium tracking-[0.2em] text-ink-foreground/60">ROUTE 1 OFFICIAL</span>
          </span>
        </Link>
        <nav className="ml-6 hidden flex-1 items-center gap-6 lg:flex">
          {NAV.map((n) => <NavLink key={n.label} item={n} />)}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <button aria-label="Search" onClick={() => setSearch(!search)}><Search className="size-5" /></button>
          {user ? (
            <button aria-label="Sign out" title={`Signed in as ${user.email} — click to sign out`} onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 text-sm">
              <User className="size-5" /><span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <Link to="/auth" aria-label="Account" className="flex items-center gap-1 text-sm"><User className="size-5" /><span className="hidden sm:inline">Login</span></Link>
          )}
          <button aria-label="Open cart" className="relative" onClick={() => setOpen(true)}>
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-sale text-[10px] font-bold text-sale-foreground">{count}</span>
            )}
          </button>
        </div>
      </div>
      {search && (
        <form
          className="border-t border-ink-foreground/10 px-4 py-3"
          onSubmit={(e) => { e.preventDefault(); setSearch(false); navigate({ to: "/shop", search: { q: q || undefined } }); }}
        >
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stickers, jackets, tumblers…"
            className="mx-auto block w-full max-w-2xl rounded-md border border-ink-foreground/20 bg-transparent px-4 py-2 text-ink-foreground placeholder:text-ink-foreground/50 focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </form>
      )}
      {menu && (
        <nav className="flex flex-col gap-4 border-t border-ink-foreground/10 px-4 py-4 lg:hidden">
          {NAV.map((n) => <NavLink key={n.label} item={n} onClick={() => setMenu(false)} />)}
        </nav>
      )}
      <div className="road-stripe" />
    </header>
  );
}
