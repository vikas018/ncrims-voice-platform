import IVoiceProvider, { STATUS, OUTCOME } from '../IVoiceProvider.js';
import config from '../../config/index.js';

/**
 * Sarvam AI adapter — the CONVERSATION engine (full STT+LLM+TTS, Hindi-first).
 * Used for interactive campaigns (lead-gen, qualifying) where the patient
 * talks back. Higher cost (~₹3.5-4/min) but real dialogue.
 *
 * Scaffolded now; live REST/webhook details finalized in Phase 4 against
 * Sarvam's docs. Adapter pattern = wiring this fully needs no changes elsewhere.
 */
export default class SarvamAdapter extends IVoiceProvider {
  constructor() {
    super('sarvam');
    this.cfg = config.voice.sarvam;
  }

  async initiateCall({ phoneNumber, assistantId, metadata = {} }) {
    if (!this.cfg.apiKey) {
      throw new Error('SarvamAdapter: SARVAM_API_KEY not configured (set it in Phase 4).');
    }
    const res = await fetch('https://api.sarvam.ai/v1/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: assistantId || this.cfg.agentId,
        to_number: phoneNumber,
        metadata,
      }),
    });
    if (!res.ok) throw new Error(`Sarvam initiateCall failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { providerCallId: data.call_id || data.id, status: STATUS.QUEUED };
  }

  normalizeWebhook(raw) {
    return {
      providerCallId: raw.call_id || raw.id,
      status: mapStatus(raw.status),
      outcome: mapOutcome(raw.extracted?.outcome || raw.outcome),
      durationSeconds: Number(raw.duration_seconds ?? raw.duration ?? 0),
      recordingUrl: raw.recording_url || '',
      transcript: raw.transcript || '',
    };
  }

  verifySignature(req) {
    if (!this.cfg.webhookSecret) return true;
    return req.get('x-sarvam-signature') === this.cfg.webhookSecret;
  }
}

function mapStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('complete') || v.includes('answered') || v.includes('ended')) return STATUS.CONNECTED;
  if (v.includes('no-answer') || v.includes('no_answer') || v.includes('noanswer')) return STATUS.UNANSWERED;
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
