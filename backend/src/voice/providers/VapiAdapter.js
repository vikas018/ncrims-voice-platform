import IVoiceProvider, { STATUS, OUTCOME } from '../IVoiceProvider.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Vapi.ai adapter — the DEMO/MVP provider.
 *
 * For the live client pitch we primarily use Vapi's Web SDK (browser test call),
 * but this adapter also supports real outbound calls via Vapi's REST API so the
 * exact same code path works when a phone number is attached.
 */
export default class VapiAdapter extends IVoiceProvider {
  constructor() {
    super('vapi');
    this.cfg = config.voice.vapi;
  }

  async initiateCall({ phoneNumber, assistantId, metadata = {} }) {
    // If no API key is configured (pure browser-demo mode), return a mock id so
    // the rest of the pipeline works end-to-end without a paid call.
    if (!this.cfg.apiKey) {
      const mockId = `vapi_mock_${Date.now()}_${Math.round(phoneNumber.length * 7)}`;
      logger.warn(`VapiAdapter: no API key set — returning mock call id ${mockId}`);
      return { providerCallId: mockId, status: STATUS.QUEUED };
    }

    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: assistantId || this.cfg.assistantId,
        phoneNumberId: this.cfg.phoneNumberId,
        customer: { number: phoneNumber },
        metadata, // echoed back on the webhook so we can match the call log
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vapi initiateCall failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return { providerCallId: data.id, status: STATUS.QUEUED };
  }

  normalizeWebhook(raw) {
    // Vapi wraps events as { message: { type, call, ... } } on end-of-call-report.
    const msg = raw?.message ?? raw;
    const call = msg?.call ?? raw?.call ?? {};
    const endedReason = msg?.endedReason || call?.endedReason || '';

    return {
      providerCallId: call.id || msg.callId || raw.id,
      status: mapStatus(endedReason, msg),
      outcome: mapOutcome(msg),
      durationSeconds: deriveDuration(msg, call),
      recordingUrl: msg?.recordingUrl || msg?.artifact?.recordingUrl || '',
      transcript: msg?.transcript || msg?.artifact?.transcript || '',
    };
  }

  verifySignature(req) {
    // Vapi can send a shared secret header. If none is configured, accept
    // (demo mode). In production always set VAPI_WEBHOOK_SECRET.
    if (!this.cfg.webhookSecret) return true;
    const sent = req.get('x-vapi-secret') || req.get('x-webhook-secret');
    return sent === this.cfg.webhookSecret;
  }
}

/** Map Vapi's endedReason vocabulary into our canonical status. */
function mapStatus(endedReason, msg) {
  const r = String(endedReason).toLowerCase();
  if (r.includes('no-answer') || r.includes('did-not-answer') || r.includes('no_answer')) {
    return STATUS.UNANSWERED;
  }
  if (r.includes('busy')) return STATUS.BUSY;
  if (r.includes('failed') || r.includes('error') || r.includes('rejected')) return STATUS.FAILED;
  // customer-ended, assistant-ended, hangup, etc. => a real conversation happened
  if (r.includes('ended') || r.includes('hangup') || r.includes('completed')) return STATUS.CONNECTED;

  // Fall back to any explicit status field Vapi provides.
  const s = String(msg?.status || '').toLowerCase();
  if (s === 'ended' || s === 'in-progress') return STATUS.CONNECTED;
  return STATUS.FAILED;
}

/** Derive a structured outcome from Vapi's analysis / structured-data block. */
function mapOutcome(msg) {
  const raw =
    msg?.analysis?.structuredData?.outcome ||
    msg?.structuredData?.outcome ||
    msg?.analysis?.successEvaluation ||
    '';
  const o = String(raw).toLowerCase();
  if (o.includes('confirm')) return OUTCOME.CONFIRMED;
  if (o.includes('reschedul')) return OUTCOME.RESCHEDULED;
  if (o.includes('not') && o.includes('interest')) return OUTCOME.NOT_INTERESTED;
  return OUTCOME.NONE;
}

function deriveDuration(msg, call) {
  if (typeof msg?.durationSeconds === 'number') return msg.durationSeconds;
  if (typeof msg?.duration === 'number') return msg.duration;
  const start = msg?.startedAt || call?.startedAt;
  const end = msg?.endedAt || call?.endedAt;
  if (start && end) return Math.max(0, (new Date(end) - new Date(start)) / 1000);
  return 0;
}
