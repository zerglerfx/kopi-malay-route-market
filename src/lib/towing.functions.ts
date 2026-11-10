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
    const tel = data.phone.replace(/[^\d+]/g, "");
    const time = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "short", timeStyle: "short" });
    await sendTelegram([
      `🚨 <b>TOWING &amp; RESCUE REQUEST ${reference}</b>`,
      "",
      `👤 Rider: ${escHtml(data.name)}`,
      `📞 Phone: <a href="tel:${escHtml(tel)}">${escHtml(data.phone)}</a>${tel ? ` · <a href="https://wa.me/${escHtml(tel.replace("+", ""))}">WhatsApp</a>` : ""}`,
      `🏍️ Motorcycle: ${escHtml(data.motorcycle_model)} (Plate: ${escHtml(data.plate_number)})`,
      `📍 Breakdown: ${escHtml(data.breakdown_location)}`,
      `🏁 Destination: ${escHtml(data.destination)}`,
      `⏰ Time: ${time} (UTC+8)`,
    ].join("\n"), "towing");
    return { reference };
  });
