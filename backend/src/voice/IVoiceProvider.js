/**
 * The Voice Provider contract. Every adapter (Vapi, Retell, Bolna, Sarvam)
 * implements these methods and translates that provider's vocabulary into
 * OUR canonical enums. The rest of the app only ever sees our enums, so
 * switching providers is a config change, not a rewrite.
 *
 * Canonical status:  queued | ringing | connected | unanswered | busy | failed
 * Canonical outcome: confirmed | rescheduled | not_interested | no_outcome
 *
 * JavaScript has no interfaces, so this base class documents + enforces the
 * contract: a subclass that forgets a method throws loudly at call time.
 */
export default class IVoiceProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Place an outbound call.
   * @param {{phoneNumber:string, assistantId?:string, metadata?:object}} _args
   * @returns {Promise<{providerCallId:string, status:string}>}
   */
  async initiateCall(_args) {
    throw new Error(`${this.name}: initiateCall() not implemented`);
  }

  /**
   * Translate a raw provider webhook body into our normalized shape.
   * @param {object} _rawPayload
   * @returns {{
   *   providerCallId:string, status:string, outcome:string,
   *   durationSeconds:number, recordingUrl:string, transcript:string
   * }}
   */
  normalizeWebhook(_rawPayload) {
    throw new Error(`${this.name}: normalizeWebhook() not implemented`);
  }

  /**
   * Verify the webhook really came from this provider (signature/secret check).
   * @param {import('express').Request} _req
   * @returns {boolean}
   */
  verifySignature(_req) {
    throw new Error(`${this.name}: verifySignature() not implemented`);
  }
}

// Canonical vocabularies, exported so adapters and the UI share one source of truth.
export const STATUS = Object.freeze({
  QUEUED: 'queued',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  UNANSWERED: 'unanswered',
  BUSY: 'busy',
  FAILED: 'failed',
});

export const OUTCOME = Object.freeze({
  CONFIRMED: 'confirmed',
  RESCHEDULED: 'rescheduled',
  NOT_INTERESTED: 'not_interested',
  NONE: 'no_outcome',
});
