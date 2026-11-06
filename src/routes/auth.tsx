import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login or Sign up — Kopi Malay Route 1" },
      { name: "description", content: "Sign in to save your cart and track your Kopi Malay orders." },
      { property: "og:title", content: "Login — Kopi Malay Route 1" },
      { property: "og:description", content: "Sign in to save your cart and track orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const field = "w-full rounded-md border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring";

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Welcome back! Your cart has been synced.");
      navigate({ to: "/shop" });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) { toast.success("Account created!"); navigate({ to: "/shop" }); }
      else toast.success("Check your email to confirm your account.");
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl font-bold uppercase">{mode === "login" ? "Login" : "Create account"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        <input required type="password" minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        <button disabled={busy} className="w-full rounded-md bg-ink py-3 font-display font-semibold uppercase text-ink-foreground hover:bg-primary disabled:opacity-50">
          {mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-4 text-sm text-primary underline">
        {mode === "login" ? "New here? Create an account" : "Already have an account? Login"}
      </button>
    </div>
  );
}
