import IVoiceProvider, { STATUS, OUTCOME } from '../IVoiceProvider.js';
import config from '../../config/index.js';

/**
 * Bolna AI adapter — a PRODUCTION provider (India-focused, Exotel telephony).
 *
 * Scaffolded now so the contract is proven; the live REST/webhook details are
 * finalized in Phase 4 against Bolna's docs. The whole point of the adapter
 * pattern: wiring this fully later needs NO changes outside this file.
 */
export default class BolnaAdapter extends IVoiceProvider {
  constructor() {
    super('bolna');
    this.cfg = config.voice.bolna;
  }

  async initiateCall({ phoneNumber, assistantId, metadata = {} }) {
    if (!this.cfg.apiKey) {
      throw new Error('BolnaAdapter: BOLNA_API_KEY not configured (set it in Phase 4).');
    }
    const res = await fetch('https://api.bolna.ai/call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: assistantId || this.cfg.agentId,
        recipient_phone_number: phoneNumber,
        user_data: metadata,
      }),
    });
    if (!res.ok) throw new Error(`Bolna initiateCall failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { providerCallId: data.call_id || data.id, status: STATUS.QUEUED };
  }

  normalizeWebhook(raw) {
    return {
      providerCallId: raw.call_id || raw.id,
      status: mapStatus(raw.status),
      outcome: mapOutcome(raw.extracted_data?.outcome || raw.outcome),
      durationSeconds: Number(raw.conversation_duration ?? raw.duration ?? 0),
      recordingUrl: raw.recording_url || '',
      transcript: raw.transcript || '',
    };
  }

  verifySignature(req) {
    if (!this.cfg.webhookSecret) return true;
    return req.get('x-bolna-signature') === this.cfg.webhookSecret;
  }
}

function mapStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('completed') || v.includes('answered')) return STATUS.CONNECTED;
  if (v.includes('no-answer') || v.includes('no_answer')) return STATUS.UNANSWERED;
  if (v.includes('busy')) return STATUS.BUSY;
  return STATUS.FAILED;
}

function mapOutcome(o) {
  const v = String(o || '').toLowerCase();
  if (v.includes('confirm')) return OUTCOME.CONFIRMED;
  if (v.includes('reschedul')) return OUTCOME.RESCHEDULED;
  if (v.includes('not') && v.includes('interest')) return OUTCOME.NOT_INTERESTED;
  return OUTCOME.NONE;
}
