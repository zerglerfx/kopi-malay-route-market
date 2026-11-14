import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { OwnerPinButton } from "@/components/admin/OwnerPinDialog";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Kopi Malay" },
      { name: "description", content: "Kopi Malay store administration." },
      { property: "og:title", content: "Admin Dashboard — Kopi Malay" },
      { property: "og:description", content: "Store administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Orders", exact: true },
  { to: "/admin/products", label: "Products & Stock" },
  { to: "/admin/promos", label: "Promo Codes" },
  { to: "/admin/towing", label: "Towing Requests" },
  { to: "/admin/users", label: "Users" },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-3xl font-bold uppercase">Admin dashboard</h1><OwnerPinButton /></div>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} activeOptions={{ exact: "exact" in t }} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 font-display text-sm font-semibold uppercase text-muted-foreground hover:text-foreground [&.active]:border-foreground [&.active]:text-foreground">
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6"><Outlet /></div>
    </div>
  );
}
