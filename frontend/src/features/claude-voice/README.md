# Gemini Voice — Hindi voice test (isolated feature)

A **separate, parallel** experiment that runs a Hindi voice conversation through
the **Google Gemini API** (free tier) instead of Vapi. It exists to compare an
LLM-driven conversation against the existing Vapi web-call assistant. **It does
not touch the Vapi integration** — all Vapi code (`hooks/useVapiCall.js`,
`pages/Campaigns.jsx`, the Vapi `.env` keys) is untouched and still works.

> **Folder name note:** the folder/files are called `claude-voice` for
> historical reasons (this started as a Claude test). It now runs on Gemini.
> Only the backend provider changed — the route, flag, and frontend are the same.

## How it works

```
Browser mic ──► Web Speech API (SpeechRecognition, hi-IN)   ← speech-to-text
                     │ final phrase
                     ▼
            POST /api/claude-voice/chat   (backend)          ← Gemini call
                     │ GEMINI_API_KEY lives here, never in the browser
                     ▼  model: gemini-flash-latest, replies in Hindi
            speechSynthesis (Hindi voice)                    ← text-to-speech
```

Flow: **Start → bot speaks the first message → listen → Gemini → speak reply →
listen …**. Talking over the bot interrupts it (barge-in).

## Files

| File | Role |
|------|------|
| `config.js` | Default system prompt + first message (copied from the Vapi defaults) and STT/TTS language. |
| `claudeVoiceApi.js` | `fetch` wrapper for `POST /api/claude-voice/chat` (uses the app's `apiBase`). |
| `useClaudeVoice.js` | The voice loop: STT, TTS, barge-in, status machine, conversation history. |
| `ClaudeVoiceTest.jsx` | The `/voice-test` page (editable prompt + first message, transcript, status). |

Backend (the only server files for this feature):

| File | Role |
|------|------|
| `backend/src/controllers/claudeVoice.controller.js` | Calls Gemini via `@google/genai`. Flag-gated, rate-limited, input-validated. |
| `backend/src/routes/claudeVoice.routes.js` | Mounts `POST /chat` at `/api/claude-voice`. |

## Setup

1. **Get a free Gemini key** at `aistudio.google.com/apikey` (no credit card).

2. **Backend** — in `backend/.env`:
   ```
   ENABLE_CLAUDE_VOICE=true
   GEMINI_API_KEY=AIza...
   # optional: GEMINI_MODEL=gemini-flash-latest
   ```
   Install the dependency (once): `cd backend && npm install`.
   Restart the backend (OneDrive makes `node --watch` unreliable — restart manually).

3. **Frontend** — in `frontend/.env`:
   ```
   VITE_ENABLE_CLAUDE_VOICE=true
   ```
   Restart the Vite dev server (env vars are read at build/start).

   For the Vercel deploy, add `VITE_ENABLE_CLAUDE_VOICE=true`. For the Back4App
   backend, add `ENABLE_CLAUDE_VOICE=true` and `GEMINI_API_KEY`.

## How to use

1. Open **`/voice-test`** (e.g. `http://localhost:5173/voice-test`). Standalone
   page — no login needed.
2. Use **Google Chrome on desktop** (Web Speech API). Other browsers show a
   "not supported" notice.
3. (Optional) Edit the **System prompt** and **First message**.
4. Click **Start**, allow the microphone, and speak Hindi after the greeting.
5. Click **Stop** to end. Talk over the bot to interrupt it.

Per-request token usage is logged to the backend console (`[gemini-voice] …`)
so you can compare against Vapi.

## Cost / safety notes

- The Gemini key is server-side only. The browser talks only to
  `/api/claude-voice/chat`.
- Gemini's **free tier** has no card and generous limits — fine for demos.
- The endpoint 404s unless `ENABLE_CLAUDE_VOICE=true`, and is rate-limited
  (20 requests/IP/min).
- The system prompt forces a short 1–3 sentence Hindi reply. `maxOutputTokens`
  is set to 1024 for headroom, because newer flash models spend hidden
  "thinking" tokens that also count toward the cap — too small a cap can return
  an empty reply.
- Model default is `gemini-flash-latest` (override via `GEMINI_MODEL`). Don't pin a
  retired model name — old ones return a 404.

## Replacing Vapi later (if this wins)

This feature is intentionally standalone so you can swap it in yourself:

1. In `pages/Campaigns.jsx`, replace the `useVapiCall()` usage with
   `useClaudeVoice()` (same idea: `start` / `stop` + a status + a transcript).
2. Move the editable First message / AI instructions into `useClaudeVoice`'s
   `setFirstMessage` / `setSystemPrompt` instead of Vapi `assistantOverrides`.
3. Keep the password gate (1995) in front of `start` if you still want it.
4. Once migrated, you can remove `@vapi-ai/web`, `useVapiCall.js`, and the
   `VITE_VAPI_*` env vars.
5. For **real phone calls** (not browser), this feature is not enough — browser
   STT/TTS only runs in a browser tab. Production phone calls still need a
   telephony provider (Vapi/Sarvam/Plivo). This is a web-demo replacement for
   the Vapi *web-call* demo, not for outbound dialing.
