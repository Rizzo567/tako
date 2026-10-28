/** F2 — cron del job dei preset (ogni 5 minuti). Chiama il tick idempotente del backend; la logica (06:00 nel
 * fuso del locale, una pubblicazione per giorno, avvisi, coda traduzioni) vive tutta nel backend.
 * Worker separato da takomenu-public: nessun rischio per il menu pubblico. NON DEPLOYATO: serve l'OK di Manuel. */
export function tickRequest(env) {
  if (env.TAKO_BACKEND_READY !== 'true') return null;
  for (const key of ['TAKO_GATEWAY_SECRET', 'TAKO_PRESET_CRON_SECRET']) if (typeof env[key] !== 'string' || env[key].length < 32) return null;
  let base;
  try { base = new URL(env.TAKO_EDGE_URL); } catch { return null; }
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || !/^\/functions\/v1\/[a-z0-9-]+\/?$/.test(base.pathname)) return null;
  const origin = env.TAKO_WEB_ORIGIN || 'https://takoitalia.com';
  return new Request(base.href.replace(/\/$/, '') + '/api/day-presets-cron/tick', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-tako-gateway-secret': env.TAKO_GATEWAY_SECRET, 'x-tako-gateway-origin': origin, 'x-tako-client-ip': '127.0.0.1', 'x-tako-cron-secret': env.TAKO_PRESET_CRON_SECRET },
    body: '{}',
  });
}
export async function runTick(env, fetcher = fetch) {
  const request = tickRequest(env);
  if (!request) return { ok: false, reason: 'not_configured' };
  const response = await fetcher(request, { signal: AbortSignal.timeout(55000) });
  return { ok: response.ok, status: response.status };
}
export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(runTick(env).then(r => { if (!r.ok) console.warn('preset tick', JSON.stringify(r)); })); },
  async fetch() { return new Response('Not found', { status: 404 }); },
};
