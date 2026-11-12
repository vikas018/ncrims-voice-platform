import IVoiceProvider, { STATUS, OUTCOME } from '../IVoiceProvider.js';
import config from '../../config/index.js';

/**
 * Plivo + TTS adapter — the ANNOUNCEMENT engine (one-way message + key press).
 * Used for confirmations / camp announcements where the patient just listens
 * and presses a digit (1 = confirm, 2 = reschedule). No conversational AI, so
 * it's cheap (~₹0.70/min: Plivo telephony + a TTS voice).
 *
 * Scaffolded now; the live Plivo XML/Answer-URL + DTMF capture is wired in
 * Phase 4. Keeping the same IVoiceProvider contract so routing is uniform.
 */
export default class PlivoAnnouncementAdapter extends IVoiceProvider {
  constructor() {
    super('plivo');
    this.cfg = config.voice.plivo;
  }

  async initiateCall({ phoneNumber, metadata = {} }) {
    if (!this.cfg.authId || !this.cfg.authToken) {
      throw new Error('PlivoAnnouncementAdapter: PLIVO_AUTH_ID/TOKEN not configured (set in Phase 4).');
    }
    const url = `https://api.plivo.com/v1/Account/${this.cfg.authId}/Call/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${this.cfg.authId}:${this.cfg.authToken}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.cfg.fromNumber,
        to: phoneNumber,
        answer_url: this.cfg.answerUrl, // serves the TTS message + DTMF menu
        answer_method: 'GET',
      }),
    });
    if (!res.ok) throw new Error(`Plivo initiateCall failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { providerCallId: data.request_uuid || data.call_uuid, status: STATUS.QUEUED };
  }

  normalizeWebhook(raw) {
    // Plivo hangup/DTMF callbacks: CallStatus + Digits pressed.
    return {
      providerCallId: raw.CallUUID || raw.request_uuid || raw.call_uuid,
      status: mapStatus(raw.CallStatus || raw.Status),
      outcome: mapDigit(raw.Digits),
      durationSeconds: Number(raw.Duration || raw.BillDuration || 0),
      recordingUrl: raw.RecordUrl || '',
      transcript: '',
    };
  }

  verifySignature(req) {
    if (!this.cfg.webhookSecret) return true;
    return req.get('x-plivo-signature-v3') === this.cfg.webhookSecret;
  }
}

function mapStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('completed') || v.includes('answered')) return STATUS.CONNECTED;
  if (v.includes('no-answer') || v.includes('noanswer') || v.includes('no_answer')) return STATUS.UNANSWERED;
  if (v.includes('busy')) return STATUS.BUSY;
  return STATUS.FAILED;
}
// Map the pressed key to an outcome (1 confirm, 2 reschedule, 3 not interested).
function mapDigit(d) {
  const v = String(d || '').trim();
  if (v === '1') return OUTCOME.CONFIRMED;
  if (v === '2') return OUTCOME.RESCHEDULED;
  if (v === '3') return OUTCOME.NOT_INTERESTED;
  return OUTCOME.NONE;
}
