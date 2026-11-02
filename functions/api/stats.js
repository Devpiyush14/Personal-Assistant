// Cloudflare Pages Function — POST /api/stats
// Returns aggregated analytics from D1. Protected by STATS_PASSWORD secret:
// the caller must POST {"password": "..."} matching env.STATS_PASSWORD.

const headers = { "Content-Type": "application/json" };

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));

  if (!env.STATS_PASSWORD) {
    return new Response(JSON.stringify({ error: "STATS_PASSWORD not configured" }), { status: 500, headers });
  }
  if (body.password !== env.STATS_PASSWORD) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 binding 'DB' not configured" }), { status: 500, headers });
  }

  const all = (sql) => env.DB.prepare(sql).all().then((r) => r.results || []).catch(() => []);

  const [
    visits, questions, qSessions, vSessions, topQ, byCountry, byDay, recent,
  ] = await Promise.all([
    all("SELECT COUNT(*) n FROM visits"),
    all("SELECT COUNT(*) n FROM questions"),
    all("SELECT COUNT(DISTINCT session) n FROM questions WHERE session <> ''"),
    all("SELECT COUNT(DISTINCT session) n FROM visits WHERE session <> ''"),
    all("SELECT q, COUNT(*) n FROM questions GROUP BY q ORDER BY n DESC LIMIT 10"),
    all("SELECT country, COUNT(*) n FROM visits GROUP BY country ORDER BY n DESC LIMIT 12"),
    all("SELECT substr(ts,1,10) d, COUNT(*) n FROM visits GROUP BY d ORDER BY d DESC LIMIT 14"),
    all("SELECT ts, country, q FROM questions ORDER BY id DESC LIMIT 30"),
  ]);

  const totalVisits = visits[0]?.n || 0;
  const totalQuestions = questions[0]?.n || 0;
  const askingSessions = qSessions[0]?.n || 0;
  const uniqueVisitors = vSessions[0]?.n || 0;

  return new Response(JSON.stringify({
    totalVisits,
    uniqueVisitors,
    totalQuestions,
    askingSessions,
    questionsPerAskingSession: askingSessions ? +(totalQuestions / askingSessions).toFixed(2) : 0,
    engagementRate: uniqueVisitors ? +((askingSessions / uniqueVisitors) * 100).toFixed(1) : 0,
    topQuestions: topQ,
    byCountry,
    byDay,
    recent,
  }), { headers });
}
