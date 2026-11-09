import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Heart, LayoutDashboard, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import badge from "@/assets/tak-route-1-shield-solid-white.png.asset.json";
import kopiLogo from "@/assets/kopi-malay-official-logo.png.asset.json";

export const NAV = [
  { label: "Shop All", category: undefined },
  { label: "Jerseys & T-shirts", category: "jerseys-t-shirts" },
  { label: "Stickers", category: "stickers" },
  { label: "Tumblers", category: "tumblers" },
  { label: "Fridge Magnets", category: "fridge-magnets" },
  { label: "Patches", category: "patches" },
  { label: "Lanyard", category: "lanyard" },
  { label: "Other Merch", category: "other-merch" },
] as const;

function NavLink({ item, onClick, className }: { item: (typeof NAV)[number]; onClick?: () => void; className: string }) {
  return item.category ? (
    <Link to="/shop/$category" params={{ category: item.category }} className={className} onClick={onClick}>{item.label}</Link>
  ) : (
    <Link to="/shop" className={className} onClick={onClick} activeOptions={{ exact: true }}>{item.label}</Link>
  );
}

const topCls = "flex items-center gap-1 font-display text-sm font-semibold uppercase tracking-wide text-ink-foreground/85 hover:text-ink-foreground focus:outline-none";
const itemCls = "w-full cursor-pointer font-display text-sm uppercase";

export function SiteHeader() {
  const { count, setOpen, user } = useCart();
  const { ids } = useWishlist();
  const admin = useIsAdmin();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const close = () => setMenu(false);

  return (
    <header className="no-print sticky top-0 z-40 bg-ink text-ink-foreground">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-2 px-3 sm:h-24 sm:gap-4 sm:px-4">
        <button className="grid size-10 shrink-0 place-items-center lg:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          {menu ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
        <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Kopi Malay x Route 1 home">
          <img src={kopiLogo.url} alt="Kopi Malay official logo" className="size-11 shrink-0 rounded-full bg-background object-contain p-0.5 sm:size-14" />
          <span aria-hidden className="font-display text-lg font-bold text-ink-foreground/70 sm:text-xl">x</span>
          <img src={badge.url} alt="Tak Route 1 badge" className="size-11 shrink-0 object-contain sm:size-14" />
        </Link>
        <nav className="ml-6 hidden items-center gap-6 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className={topCls}>Shop <ChevronDown className="size-4" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {NAV.map((n) => <DropdownMenuItem key={n.label} asChild><NavLink item={n} className={itemCls} /></DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={topCls}>Services <ChevronDown className="size-4" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem asChild><Link to="/towing" className={itemCls}>Towing &amp; Rescue</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {admin && <Link to="/admin" className={topCls}><LayoutDashboard className="size-4" /> Admin</Link>}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-0 sm:gap-3 [&>*]:grid [&>*]:min-h-10 [&>*]:min-w-9 sm:[&>*]:min-w-10 [&>*]:place-items-center sm:[&>*]:flex">
          <button aria-label="Search" onClick={() => setSearch(!search)}><Search className="size-5" /></button>
          <Link to="/wishlist" aria-label="Wishlist" className="relative">
            <Heart className="size-5" />
            {ids.length > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink-foreground text-[10px] font-bold text-ink">{ids.length}</span>}
          </Link>
          {user ? (
            <button aria-label="Sign out" title={`Signed in as ${user.email} — click to sign out`} onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/", replace: true }); }} className="flex items-center gap-1 text-sm">
              <User className="size-5" /><span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <Link to="/auth" aria-label="Account" className="flex items-center gap-1 text-sm"><User className="size-5" /><span className="hidden sm:inline">Login</span></Link>
          )}
          <button aria-label="Open cart" className="relative" onClick={() => setOpen(true)}>
            <ShoppingBag className="size-5" />
            {count > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink-foreground text-[10px] font-bold text-ink">{count}</span>}
          </button>
        </div>
      </div>
      {search && (
        <form className="border-t border-ink-foreground/10 px-4 py-3" onSubmit={(e) => { e.preventDefault(); setSearch(false); navigate({ to: "/shop", search: { q: q || undefined } }); }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stickers, jerseys, tumblers…"
            className="mx-auto block w-full max-w-2xl rounded-md border border-ink-foreground/20 bg-transparent px-4 py-2 text-ink-foreground placeholder:text-ink-foreground/50 focus:outline-none focus:ring-2 focus:ring-ink-foreground/40" />
        </form>
      )}
      {menu && (
        <nav className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto border-t border-ink-foreground/10 px-4 py-4 lg:hidden">
          <p className="pb-1 font-display text-xs font-bold uppercase tracking-widest text-ink-foreground/50">Shop</p>
          {NAV.map((n) => <NavLink key={n.label} item={n} onClick={close} className="py-1.5 pl-2 font-display text-sm uppercase text-ink-foreground/85" />)}
          <p className="pb-1 pt-3 font-display text-xs font-bold uppercase tracking-widest text-ink-foreground/50">Services</p>
          <Link to="/towing" onClick={close} className="py-1.5 pl-2 font-display text-sm uppercase text-ink-foreground/85">Towing &amp; Rescue</Link>
          {admin && <Link to="/admin" onClick={close} className="pt-3 font-display text-sm font-bold uppercase">Admin dashboard</Link>}
        </nav>
      )}
      <div className="road-stripe" />
    </header>
  );
}

export function MarqueeBanner() {
  const text = "Register To Be A Member Today To Receive Special Offer!";
  return (
    <Link to="/auth" search={{ mode: "signup" }} className="no-print block overflow-hidden border-b bg-background py-2 text-foreground" aria-label={text}>
      <div className="flex w-max animate-marquee gap-16 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-wider">
        {Array.from({ length: 8 }).map((_, i) => <span key={i} aria-hidden={i > 0}>★ {text}</span>)}
      </div>
    </Link>
  );
}
