/**
 * Calls the isolated backend endpoint POST /api/claude-voice/chat.
 * Reuses the app's apiBase so the runtime backend-URL override (login screen)
 * works here too. No JWT is attached — this endpoint is intentionally public
 * (flag-gated + rate-limited on the server).
 */
import { apiBase } from '../../api/client.js';

export async function sendChat({ system, messages }) {
  const res = await fetch(`${apiBase.get()}/api/claude-voice/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data.reply || '';
}

export default { sendChat };
