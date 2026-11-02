// Cloudflare Pages Function — POST /api/chat
// Reads the CV markdown files (served as static assets), stuffs them into a
// system prompt, and calls the LLM. The API key never reaches the browser.
//
// To change the knowledge: edit the files in public/cv/ and git push. That's it.
// To change the model/provider: edit the CONFIG block below (or set env vars).

const CV_FILES = [
  "/cv/00-persona.md",
  "/cv/01-profile.md",
  "/cv/02-experience.md",
  "/cv/03-skills.md",
  "/cv/04-projects.md",
  "/cv/05-faq.md",
];

const CONFIG = {
  // Default provider: Groq (free tier, ~560 tok/s → sub-second answers).
  // Swap model to "llama-3.3-70b-versatile" for richer answers (lower daily quota).
  provider: "groq",
  groqModel: "llama-3.1-8b-instant",
  geminiModel: "gemini-2.5-flash",
  maxTokens: 220,     // keeps answers to ~2–3 spoken sentences
  temperature: 0.3,   // low = sticks to the CV, less invention
};

// Simple per-IP throttle so a single visitor can't burn the daily free quota.
const RATE = { windowMs: 60_000, max: 12 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, start: now };
  if (now - rec.start > RATE.windowMs) { rec.count = 0; rec.start = now; }
  rec.count++;
  hits.set(ip, rec);
  return rec.count > RATE.max;
}

async function loadCV(request) {
  const origin = new URL(request.url).origin;
  const parts = await Promise.all(
    CV_FILES.map(async (p) => {
      const r = await fetch(origin + p);
      return r.ok ? await r.text() : "";
    })
  );
  return parts.filter(Boolean).join("\n\n---\n\n");
}

function buildSystemPrompt(cv) {
  return (
    "You are a voice CV assistant. Follow the persona and rules at the top of " +
    "the documents exactly. Answer ONLY using the documents below. If the answer " +
    "is not in them, say so and redirect — never invent roles, dates, numbers, or " +
    "skills. Keep answers to 2–3 short sentences suitable for being spoken aloud.\n\n" +
    "=== CV DOCUMENTS START ===\n\n" + cv + "\n\n=== CV DOCUMENTS END ==="
  );
}

async function callGroq(env, system, messages) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: CONFIG.groqModel,
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!r.ok) throw new Error(`groq ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || "";
}

async function callGemini(env, system, messages) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: CONFIG.temperature,
        maxOutputTokens: CONFIG.maxTokens,
      },
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

export async function onRequestPost({ request, env }) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    if (rateLimited(ip)) {
      return new Response(
        JSON.stringify({ reply: "A lot of questions just came in — please wait a few seconds and try again." }),
        { status: 429, headers: cors }
      );
    }

    const body = await request.json();
    // messages: [{role:'user'|'assistant', content:string}, ...] — last ~8 turns
    const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "no messages" }), { status: 400, headers: cors });
    }

    const cv = await loadCV(request);
    const system = buildSystemPrompt(cv);

    let reply;
    const provider = env.PROVIDER || CONFIG.provider;
    try {
      reply = provider === "gemini"
        ? await callGemini(env, system, messages)
        : await callGroq(env, system, messages);
    } catch (primaryErr) {
      // Fallback to the other provider if its key is configured.
      if (provider !== "gemini" && env.GEMINI_API_KEY) {
        reply = await callGemini(env, system, messages);
      } else if (provider === "gemini" && env.GROQ_API_KEY) {
        reply = await callGroq(env, system, messages);
      } else {
        throw primaryErr;
      }
    }

    return new Response(JSON.stringify({ reply }), { headers: cors });
  } catch (err) {
    return new Response(
      JSON.stringify({ reply: "Sorry, I hit a problem answering that. Please try again.", error: String(err) }),
      { status: 500, headers: cors }
    );
  }
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
