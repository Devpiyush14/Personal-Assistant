# Piyush Kaushik — CV Voice Assistant

A zero-cost, cloud-hosted voice assistant that answers questions about Piyush's
professional experience, **strictly** from his Master CV. Embed the link in a CV
or LinkedIn; an HR visitor opens it and asks questions by voice or text.

It is **not** a fine-tuned or "trained" model. The whole CV fits in one prompt, so
the assistant is prompt-stuffed: the files in `public/cv/` are injected into the
system prompt on every request, and the model is instructed to answer only from
them. Updating your CV = editing a markdown file and pushing. No retraining, no
vector DB, no embeddings.

## How it works

```
Browser (index.html)                 Cloudflare Pages Function (/api/chat)
  mic  -> Web Speech API (ASR)  --->  reads public/cv/*.md
  text -> fetch /api/chat             builds system prompt (CV + rules)
  <- reply                            calls Groq (or Gemini) with your key
  speaker <- Web Speech API (TTS)     returns 2-3 sentence answer
```

- **Voice in/out:** browser Web Speech API — free, client-side, near-zero latency.
  Best on Chrome/Edge. Safari/iOS speech-recognition is partial, so the text box is
  always available as the guaranteed path.
- **LLM:** Groq free tier (`llama-3.1-8b-instant`, ~560 tok/s) → first words in well
  under a second. Gemini `gemini-2.5-flash` wired as an automatic fallback.
- **Cost:** $0. No credit card needed for Groq's free tier. A CV bot gets a handful
  of visitors a day — nowhere near the free limits (~14,400 requests/day on Groq 8B).

## The backend folder you keep updating

Everything the assistant knows lives in `public/cv/`:

| File | What goes in it |
|------|-----------------|
| `00-persona.md` | Voice, tone, and the hard rules (answer only from CV, decline gracefully). Switch first-person vs third-person here. |
| `01-profile.md` | Summary, contact, education. |
| `02-experience.md` | Full work history. |
| `03-skills.md` | Core skills. |
| `04-projects.md` | Side projects. |
| `05-faq.md` | Recruiter questions the CV doesn't answer (next role, relocation, notice). Edit freely. |

Edit any of these, `git push`, and Cloudflare redeploys in ~30s. To add a file,
create it in `public/cv/` and add its path to the `CV_FILES` array in
`functions/api/chat.js`.

## Deploy (one-time, ~10 minutes, free)

### 1. Get a free Groq API key
- Go to https://console.groq.com → sign up (no card) → API Keys → Create key.
- Copy it (starts with `gsk_...`).
- *(Optional fallback)* Get a Gemini key at https://aistudio.google.com/apikey.

### 2. Put this folder in a GitHub repo
```bash
cd cv-voice-assistant
git init && git add . && git commit -m "CV voice assistant"
# create an empty repo on github.com, then:
git remote add origin https://github.com/Devpiyush14/cv-voice-assistant.git
git branch -M main && git push -u origin main
```

### 3. Deploy on Cloudflare Pages (free)
- https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
- Pick the repo. Build settings:
  - **Framework preset:** None
  - **Build command:** *(leave empty)*
  - **Build output directory:** `public`
- **Save and Deploy.**

### 4. Add your API key as a secret
- In the Pages project → **Settings** → **Environment variables** (Production):
  - `GROQ_API_KEY` = your `gsk_...` key
  - *(optional)* `GEMINI_API_KEY` = your Gemini key
  - *(optional)* `PROVIDER` = `groq` (default) or `gemini`
- **Save**, then **Deployments → Retry deployment** so the key loads.

Your assistant is live at `https://cv-voice-assistant.pages.dev` (or your custom
domain). That's the link you put in your CV.

> The function reads the key from the server environment only — it is never sent to
> the browser.

## Switching model / provider
In `functions/api/chat.js`, `CONFIG` block:
- Richer answers, lower quota: `groqModel: "llama-3.3-70b-versatile"`.
- Prefer Gemini: set env var `PROVIDER=gemini` (needs `GEMINI_API_KEY`).

## Local test (optional)
```bash
npm i -g wrangler
wrangler pages dev public   # set GROQ_API_KEY in your shell first
```

## Notes
- Free LLM tiers may use inputs for training. Not a concern here — the CV is
  public-facing by design. Do not add anything private to `public/cv/`.
- Keep answers short: the 2–3 sentence cap is set by `maxTokens` in `chat.js` and
  reinforced in the persona. Short answers are faster and better for voice.
