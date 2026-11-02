// Cloudflare Pages Function — POST /api/visit
// Logs one page-visit row to D1. Best-effort: never throws to the client.
// Called once per page load from the frontend.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const session = typeof body.session === "string" ? body.session.slice(0, 64) : "";
    const country = request.headers.get("CF-IPCountry") || "??";
    const referer = (request.headers.get("Referer") || "").slice(0, 200);
    const ua = (request.headers.get("User-Agent") || "").slice(0, 200);
    if (env.DB) {
      const stmt = env.DB
        .prepare("INSERT INTO visits (ts, session, country, referer, ua) VALUES (?, ?, ?, ?, ?)")
        .bind(new Date().toISOString(), session, country, referer, ua);
      context.waitUntil(stmt.run().catch(() => {}));
    }
  } catch (_) { /* ignore */ }
  return new Response(JSON.stringify({ ok: true }), { headers: cors });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
