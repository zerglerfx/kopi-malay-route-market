// Server-only Telegram text alert via the connector gateway.
// Never throws: failures are logged with full detail so order/towing saves are never blocked.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

type Ctx = { headers: Record<string, string>; chatId: string };

async function resolveCtx(tag: string): Promise<Ctx | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const tgKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !tgKey) {
    console.error(`[telegram:${tag}] Not configured (LOVABLE_API_KEY=${!!lovableKey}, TELEGRAM_API_KEY=${!!tgKey})`);
    return null;
  }
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": tgKey, "Content-Type": "application/json" };
  const envChat = process.env["TELEGRAM_CHAT_ID"]?.trim();
  if (envChat) return { headers, chatId: envChat };
  // Fallback: Telegram keeps updates only ~24h, so set TELEGRAM_CHAT_ID for reliability.
  const r = await fetch(`${GATEWAY_URL}/getUpdates`, { method: "POST", headers, body: "{}" });
  if (!r.ok) {
    console.error(`[telegram:${tag}] getUpdates failed [${r.status}]: ${await r.text()}`);
    return null;
  }
  const j = (await r.json()) as { result?: { message?: { chat?: { id: number } }; my_chat_member?: { chat?: { id: number } } }[] };
  const last = [...(j.result ?? [])].reverse().find((u) => u.message?.chat?.id ?? u.my_chat_member?.chat?.id);
  const id = last?.message?.chat?.id ?? last?.my_chat_member?.chat?.id;
  if (!id) {
    console.error(`[telegram:${tag}] No TELEGRAM_CHAT_ID set and no recent chat with the bot — alert NOT delivered. Message the bot, then save its chat ID.`);
    return null;
  }
  return { headers, chatId: String(id) };
}

async function call(tag: string, ctx: Ctx, method: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/${method}`, { method: "POST", headers: ctx.headers, body: JSON.stringify({ chat_id: ctx.chatId, ...body }) });
    const txt = await res.text();
    if (!res.ok) { console.error(`[telegram:${tag}] ${method} failed [${res.status}]: ${txt}`); return false; }
    const j = JSON.parse(txt) as { ok?: boolean; description?: string };
    if (j.ok === false) { console.error(`[telegram:${tag}] ${method} rejected: ${j.description}`); return false; }
    console.log(`[telegram:${tag}] ${method} delivered`);
    return true;
  } catch (e) {
    console.error(`[telegram:${tag}] ${method} network error`, e);
    return false;
  }
}

export async function sendTelegram(text: string, tag = "alert", attachment?: { url: string; isPdf: boolean }): Promise<boolean> {
  try {
    const ctx = await resolveCtx(tag);
    if (!ctx) return false;
    const ok = await call(tag, ctx, "sendMessage", { text, parse_mode: "HTML", disable_web_page_preview: true });
    if (attachment?.url) await call(tag, ctx, attachment.isPdf ? "sendDocument" : "sendPhoto", { [attachment.isPdf ? "document" : "photo"]: attachment.url });
    return ok;
  } catch (e) {
    console.error(`[telegram:${tag}] unexpected error`, e);
    return false;
  }
}

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
