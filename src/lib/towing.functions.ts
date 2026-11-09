import { createServerFn } from "@tanstack/react-start";
import { TowingRequest } from "./towing";

export const submitTowingRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TowingRequest.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTelegram, escHtml } = await import("./telegram.server");
    let reference = "";
    for (let i = 0; i < 5; i++) {
      reference = `TW-${Math.floor(10000 + Math.random() * 90000)}`;
      const { error } = await supabaseAdmin.from("towing_requests").insert({ ...data, reference });
      if (!error) break;
      if (error.code !== "23505" || i === 4) throw new Error("Could not save your request. Please call us directly.");
    }
    const map = data.pickup_lat != null && data.pickup_lng != null ? `https://www.google.com/maps?q=${data.pickup_lat},${data.pickup_lng}` : null;
    await sendTelegram([
      `🚨 <b>Towing &amp; Rescue request ${reference}</b>`,
      `👤 ${escHtml(data.name)} · ${escHtml(data.phone)}`,
      `🏍️ ${escHtml(data.motorcycle_model)} · Plate ${escHtml(data.plate_number)}`,
      `📍 Breakdown: ${escHtml(data.breakdown_location)}`,
      map ? `🗺️ Pin: ${map}` : "🗺️ No map pin provided",
      `🏁 Destination: ${escHtml(data.destination)}`,
    ].join("\n")).catch((e) => console.error("Towing alert failed", e));
    return { reference };
  });
