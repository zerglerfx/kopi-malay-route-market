import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signup" } => (s["mode"] === "signup" ? { mode: "signup" } : {}),
  head: () => ({
    meta: [
      { title: "Login or Become a Member — Kopi Malay Route 1" },
      { name: "description", content: "Sign in or register as a Kopi Malay member to save your cart, wishlist and receive special offers." },
      { property: "og:title", content: "Login — Kopi Malay Route 1" },
      { property: "og:description", content: "Become a member for special offers, saved cart and wishlist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const field = "w-full rounded-md border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring";

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(search.mode === "signup" ? "signup" : "login");
  useEffect(() => { if (search.mode === "signup") setMode("signup"); }, [search.mode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  // Returning from Google sign-in lands here; send members on to their profile once the session exists.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/profile", replace: true }); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") navigate({ to: "/profile", replace: true }); });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
    if (result.error) { toast.error(result.error.message ?? "Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/profile" });
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Welcome back! Your cart has been synced.");
      navigate({ to: "/profile" });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) { toast.success("Account created!"); navigate({ to: "/profile" }); }
      else toast.success("Check your email to confirm your account.");
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl font-bold uppercase">{mode === "login" ? "Login" : "Become a member"}</h1>
      {mode === "signup" && <p className="mt-2 text-sm text-muted-foreground">Register today to receive special member offers.</p>}
      <button
        type="button" onClick={google}
        className="mt-6 flex h-10 w-full items-center justify-center gap-2.5 rounded-md border px-3 text-sm font-medium"
        style={{ background: "#FFFFFF", borderColor: "#747775", color: "#1F1F1F", fontFamily: "'Google Sans', 'DM Sans', sans-serif" }}
      >
        <GoogleG /> Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="space-y-3">
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        <input required type="password" minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        <button disabled={busy} className="w-full rounded-md bg-primary py-3 font-display font-semibold uppercase text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {mode === "login" ? "Login" : "Sign up"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-4 text-sm underline">
        {mode === "login" ? "New here? Become a member" : "Already have an account? Login"}
      </button>
    </div>
  );
}
