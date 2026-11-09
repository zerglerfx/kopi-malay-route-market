import { createFileRoute } from "@tanstack/react-router";

// Loyverse calls this when counter stock changes. The payload is never trusted:
// we only use it as a signal and re-read stock directly from the Loyverse API.
export const Route = createFileRoute("/api/public/loyverse-webhook")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { pullStock } = await import("@/lib/loyverse.server");
          await pullStock(supabaseAdmin);
          return new Response("ok");
        } catch (e) {
          console.error("Loyverse sync failed", e);
          return new Response("sync failed", { status: 500 });
        }
      },
    },
  },
});
