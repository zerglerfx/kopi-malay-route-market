import { createFileRoute } from "@tanstack/react-router";

// Serves catalog photos from the private product-images bucket. Product photos are
// public storefront content; only paths inside that bucket can be read.
export const Route = createFileRoute("/api/public/product-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[a-zA-Z0-9/_.-]+$/.test(path) || path.includes("..")) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("product-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
        });
      },
    },
  },
});
