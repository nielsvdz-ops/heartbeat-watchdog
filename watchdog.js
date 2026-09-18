// watchdog.js — cloud "dead man's switch" heartbeat monitor.
//
// Role: this runs in the CLOUD (or, for now, in a local container). The laptop
// sends it a heartbeat every ~60s. If no heartbeat arrives within GRACE_SECONDS,
// the watchdog alerts via Telegram that the PC is offline. It alerts again (once)
// when heartbeats resume. Because the alert is sent from here — not from behind
// the laptop's Surfshark VPN — it isn't subject to the VPN block that killed the
// old ntfy alerts.
//
// Self-contained: Node.js built-ins only (http + global fetch). Zero npm deps.
//
// Secrets come from the environment (never hard-coded, never committed):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Tunables (optional):
//   PORT (default 8080), GRACE_SECONDS (default 180)

const http = require('http');

const PORT = Number(process.env.PORT) || 8080;
const GRACE_MS = (Number(process.env.GRACE_SECONDS) || 180) * 1000; // offline if silent this long
const CHECK_EVERY_MS = 30 * 1000;
const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const CHAT = String(process.env.TELEGRAM_CHAT_ID || '').trim();

let lastBeat = Date.now(); // assume alive at boot
let offline = false;       // current state — used so we alert only on transitions

async function telegram(text) {
  if (!TOKEN || !CHAT) {
    console.log('[watchdog] (no Telegram config) would send:', text);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) console.error('[watchdog] Telegram rejected:', JSON.stringify(data));
    return !!data.ok;
  } catch (e) {
    console.error('[watchdog] Telegram error:', e.message);
    return false;
  }
}

const server = http.createServer((req, res) => {
  // The laptop pings this to say "I'm alive".
  if (req.url === '/heartbeat' || req.url === '/ping') {
    lastBeat = Date.now();
    console.log(`[watchdog] heartbeat received (was ${offline ? 'OFFLINE' : 'alive'})`);
    // If we were offline, a heartbeat means we're back — alert immediately
    // instead of waiting for the next periodic check.
    if (offline) {
      offline = false;
      telegram('🟢 *PC back online* — heartbeat resumed.');
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok\n');
    return;
  }
  // A human/browser can hit this to see current status.
  if (req.url === '/' || req.url === '/health') {
    const ageS = Math.round((Date.now() - lastBeat) / 1000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: offline ? 'OFFLINE' : 'alive', secondsSinceLastBeat: ageS }));
    return;
  }
  res.writeHead(404);
  res.end('not found\n');
});

async function check() {
  const silentFor = Date.now() - lastBeat;
  if (!offline && silentFor > GRACE_MS) {
    offline = true;
    await telegram(`🔴 *PC OFFLINE* — no heartbeat for ${Math.round(silentFor / 1000)}s. The laptop / Command Center may be down.`);
  } else if (offline && silentFor <= GRACE_MS) {
    offline = false;
    await telegram('🟢 *PC back online* — heartbeat resumed.');
  }
}

server.listen(PORT, () => {
  console.log(`[watchdog] listening on :${PORT}, grace ${GRACE_MS / 1000}s`);
  telegram(`✅ *Heartbeat watchdog started* — grace ${Math.round(GRACE_MS / 1000)}s. Waiting for laptop heartbeats.`);
});

setInterval(() => check().catch((e) => console.error('[watchdog]', e.message)), CHECK_EVERY_MS);
