/**
 * Voice chat endpoint (test feature) — powered by Google Gemini.
 *
 * NOTE: The folder/file names say "claude-voice" for historical reasons (this
 * started as a Claude test). It now runs on Gemini's free tier. The route,
 * flag, and frontend are unchanged — only the provider differs.
 *
 * ISOLATED, PARALLEL TEST FEATURE. Does NOT touch the Vapi integration. Powers
 * the browser Hindi voice chat at /voice-test, to compare against Vapi.
 *
 * Security:
 *   - GEMINI_API_KEY is read from the environment and NEVER sent to the browser.
 *     The browser only ever talks to THIS endpoint.
 *   - Gated behind ENABLE_CLAUDE_VOICE=true.
 *   - Simple in-memory per-IP rate limit to cap usage on a public URL.
 *
 * Reads env directly (process.env) on purpose — stays out of the central config
 * loader so this test feature can't break the main app's boot.
 */
import { GoogleGenAI } from '@google/genai';

// Model fallback chain. We use "latest" aliases (not dated names) so Google
// repoints them and they never 404 the way gemini-2.0-flash did. The free tier
// gets intermittent 503 "high demand" spikes, so we try a lighter model first
// (more spare capacity, fast, fine for short replies) and fall back to the full
// flash model if it's down. Set GEMINI_MODEL to force a single model instead.
const MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-flash-lite-latest', 'gemini-flash-latest'];
const MAX_TOKENS = 1024; // headroom for the hidden "thinking" step; reply stays short
const MAX_HISTORY = 24; // cap conversation turns sent per request
const MAX_MESSAGE_CHARS = 2000; // reject absurdly long user turns
const MAX_SYSTEM_CHARS = 4000; // cap the editable system prompt

// Appended to whatever system prompt the client sends, so replies are always
// speakable Hindi regardless of what the user typed in the prompt box.
const HINDI_STYLE = `
Always reply in natural, conversational Hindi (Devanagari script). Keep replies short (1-3 sentences) because they will be spoken aloud. No markdown, emojis, bullet points or special symbols.`;

// ---- tiny in-memory rate limiter (per IP, fixed window) -------------------
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20; // requests per IP per minute
const hits = new Map(); // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

// Occasionally prune stale entries so the Map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) if (now > rec.resetAt) hits.delete(ip);
}, RATE_WINDOW_MS).unref?.();

export function isEnabled() {
  return String(process.env.ENABLE_CLAUDE_VOICE || '').toLowerCase() === 'true';
}

/**
 * POST /api/claude-voice/chat
 * Body: { system?: string, messages: [{ role: 'user'|'assistant', content: string }] }
 * Returns: { reply: string }
 */
export async function chat(req, res) {
  if (!isEnabled()) {
    return res.status(404).json({ error: 'Voice test feature is disabled.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  // ---- validate input ----
  const body = req.body || {};
  const rawMessages = Array.isArray(body.messages) ? body.messages : null;
  if (!rawMessages || rawMessages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required.' });
  }

  // Map our {role:'user'|'assistant'} history to Gemini's {role:'user'|'model'}
  // contents shape: [{ role, parts: [{ text }] }].
  const contents = [];
  for (const m of rawMessages.slice(-MAX_HISTORY)) {
    const role = m?.role === 'assistant' ? 'model' : 'user';
    const content = typeof m?.content === 'string' ? m.content.trim() : '';
    if (!content) continue;
    contents.push({ role, parts: [{ text: content.slice(0, MAX_MESSAGE_CHARS) }] });
  }
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'The last message must be a non-empty user turn.' });
  }

  const clientSystem = typeof body.system === 'string' ? body.system.slice(0, MAX_SYSTEM_CHARS) : '';
  const systemInstruction = `${clientSystem}${HINDI_STYLE}`.trim();

  // httpOptions.timeout caps each attempt so a Gemini "high demand" (503)
  // retry-storm can't hang the caller's browser. We try each model in the chain
  // until one answers; if all fail the frontend speaks a short Hindi apology.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 12_000 } });
  let lastErr;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: MAX_TOKENS,
        },
      });

      const reply = (response.text || '').trim();
      if (!reply) continue; // empty (e.g. all tokens went to thinking) — try next

      // Log token usage so you can compare cost against Vapi for the same call.
      const u = response.usageMetadata || {};
      console.log(
        `[gemini-voice] model=${model} in=${u.promptTokenCount ?? '?'} out=${u.candidatesTokenCount ?? '?'} turns=${contents.length}`
      );
      return res.json({ reply });
    } catch (err) {
      lastErr = err;
      console.error(`[gemini-voice] ${model} failed:`, err?.message || err);
      // fall through to the next model in the chain
    }
  }

  const status =
    lastErr?.status && lastErr.status >= 400 && lastErr.status < 600 ? lastErr.status : 502;
  return res.status(status).json({ error: 'Gemini API request failed.' });
}

export default { chat, isEnabled };
