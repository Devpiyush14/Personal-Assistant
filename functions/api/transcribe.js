// Cloudflare Pages Function — POST /api/transcribe
// Receives a short audio clip (multipart field "audio") and returns {text}.
// Uses Groq Whisper, so voice input works on every browser (iOS Safari/Chrome/
// Firefox/Edge included) instead of relying on the flaky Web Speech API.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), { status: 500, headers: cors });
    }

    const inForm = await request.formData();
    const audio = inForm.get("audio");
    if (!audio || typeof audio === "string") {
      return new Response(JSON.stringify({ error: "no audio" }), { status: 400, headers: cors });
    }

    const gForm = new FormData();
    gForm.append("file", audio, audio.name || "clip.webm");
    gForm.append("model", "whisper-large-v3-turbo");
    gForm.append("response_format", "json");
    gForm.append("language", "en");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, // no Content-Type: fetch sets the multipart boundary
      body: gForm,
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `groq stt ${r.status}`, detail: (await r.text()).slice(0, 300) }), { status: 502, headers: cors });
    }
    const j = await r.json();
    return new Response(JSON.stringify({ text: (j.text || "").trim() }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
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
