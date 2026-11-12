import CallLog from '../models/CallLog.js';
import Campaign from '../models/Campaign.js';
import getVoiceProvider from '../voice/VoiceProviderFactory.js';
import { calculatePulse } from '../services/billing.service.js';
import { debitForCall } from '../services/wallet.service.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

// Which stats counter does a normalized status/outcome map to?
const STATUS_COUNTER = {
  connected: 'connected',
  unanswered: 'unanswered',
  busy: 'busy',
  failed: 'failed',
};
const OUTCOME_COUNTER = {
  confirmed: 'confirmed',
  rescheduled: 'rescheduled',
  not_interested: 'notInterested',
};

/**
 * POST /api/webhooks/voice/:provider
 *
 * The money-safe path:
 *   1. verify signature            -> reject forgeries
 *   2. normalize the raw payload   -> our canonical shape
 *   3. look up call by providerCallId
 *      - already finalized? STOP (idempotent) — a retried webhook can't double-bill
 *   4. compute billed minutes with OUR pulse engine (never trust provider billing)
 *   5. update call + debit wallet (one ledger row) + bump campaign stats
 *   6. always 200 once processed, so the provider stops retrying
 */
export const handleVoiceWebhook = asyncHandler(async (req, res) => {
  const providerName = req.params.provider;
  const provider = getVoiceProvider(providerName);

  if (!provider.verifySignature(req)) {
    throw new ApiError(401, 'Invalid webhook signature');
  }

  const n = provider.normalizeWebhook(req.body);
  if (!n.providerCallId) {
    logger.warn(`webhook(${providerName}): payload with no providerCallId, ignoring`);
    return res.status(200).json({ ok: true, ignored: 'no providerCallId' });
  }

  const call = await CallLog.findOne({ providerCallId: n.providerCallId });
  if (!call) {
    logger.warn(`webhook(${providerName}): no call log for providerCallId=${n.providerCallId}`);
    return res.status(200).json({ ok: true, ignored: 'unknown call' });
  }

  // Idempotency: if this call already reached a terminal status, do nothing.
  const terminal = ['connected', 'unanswered', 'busy', 'failed'];
  if (terminal.includes(call.status)) {
    return res.status(200).json({ ok: true, idempotent: true });
  }

  // 4. OUR billing — pure function, provider-agnostic.
  const billedMinutes = calculatePulse(n.status, n.durationSeconds);

  // 5. Persist the normalized result.
  call.status = n.status;
  call.outcome = n.outcome || 'no_outcome';
  call.durationSeconds = Math.round(n.durationSeconds || 0);
  call.billedMinutes = billedMinutes;
  call.recordingUrl = n.recordingUrl || '';
  call.transcript = n.transcript || '';
  call.webhookReceivedAt = new Date();
  call.rawWebhookPayload = req.body;
  await call.save();

  // Debit the wallet (only if there's something to bill). One ledger row,
  // guarded by the idempotency check above.
  if (billedMinutes > 0) {
    await debitForCall(call.organizationId, billedMinutes, call._id);
  }

  // Bump campaign counters.
  const inc = {};
  const sc = STATUS_COUNTER[n.status];
  if (sc) inc[`stats.${sc}`] = 1;
  const oc = OUTCOME_COUNTER[n.outcome];
  if (oc) inc[`stats.${oc}`] = 1;
  if (billedMinutes > 0) inc['stats.minutesConsumed'] = billedMinutes;
  if (Object.keys(inc).length) await Campaign.updateOne({ _id: call.campaignId }, { $inc: inc });

  logger.info(
    `webhook(${providerName}): ${n.providerCallId} -> ${n.status}/${n.outcome}, billed ${billedMinutes} min`
  );
  res.status(200).json({ ok: true, status: n.status, billedMinutes });
});
