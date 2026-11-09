// Server-only Telegram text alert via the connector gateway.
export async function sendTelegram(text: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const tgKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !tgKey) { console.error("Telegram not configured"); return; }
  const base = "https://connector-gateway.lovable.dev/telegram";
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": tgKey, "Content-Type": "application/json" };
  let chatId = process.env["TELEGRAM_CHAT_ID"];
  if (!chatId) {
    const r = await fetch(`${base}/getUpdates`, { method: "POST", headers, body: "{}" });
    const j = (await r.json()) as { result?: { message?: { chat?: { id: number } }; my_chat_member?: { chat?: { id: number } } }[] };
    const last = [...(j.result ?? [])].reverse().find((u) => u.message?.chat?.id ?? u.my_chat_member?.chat?.id);
    const id = last?.message?.chat?.id ?? last?.my_chat_member?.chat?.id;
    if (!id) { console.error("No Telegram chat found; message the bot first"); return; }
    chatId = String(id);
  }
  const res = await fetch(`${base}/sendMessage`, { method: "POST", headers, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }) });
  if (!res.ok) console.error(`Telegram sendMessage failed [${res.status}]: ${await res.text()}`);
}

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
