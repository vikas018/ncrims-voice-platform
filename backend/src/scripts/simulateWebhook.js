/**
 * Webhook simulator — proves the ENTIRE money path without any real call.
 *
 * It finds queued/ringing calls in the DB, marks them ringing (as if dialed),
 * then POSTs a realistic Vapi-shaped webhook for each to our own endpoint —
 * exercising normalization, the pulse engine, wallet debit, the ledger, and
 * campaign stats exactly as a live provider would.
 *
 * Run (with the server running):  npm run simulate
 */
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import CallLog from '../models/CallLog.js';

const BASE = `http://localhost:${config.port}`;

// A spread of outcomes so you can see every billing branch in the dashboard.
const SCENARIOS = [
  { endedReason: 'customer-ended-call', durationSeconds: 108, outcome: 'confirmed' },   // 1:48 -> 2 min
  { endedReason: 'customer-ended-call', durationSeconds: 42, outcome: 'rescheduled' },  // 0:42 -> 1 min
  { endedReason: 'customer-did-not-answer', durationSeconds: 0, outcome: '' },          // unanswered -> 0
  { endedReason: 'customer-ended-call', durationSeconds: 15, outcome: 'not_interested' }, // 0:15 -> 1 min
  { endedReason: 'customer-busy', durationSeconds: 0, outcome: '' },                     // busy -> 0
  { endedReason: 'assistant-ended-call', durationSeconds: 156, outcome: 'confirmed' },   // 2:36 -> 3 min
];

function buildVapiPayload(call, scenario) {
  return {
    message: {
      type: 'end-of-call-report',
      endedReason: scenario.endedReason,
      durationSeconds: scenario.durationSeconds,
      recordingUrl: scenario.durationSeconds > 0 ? `https://recordings.example.com/${call.providerCallId}.mp3` : '',
      transcript: scenario.durationSeconds > 0 ? `AI: नमस्ते...\nPatient: जी हाँ...` : '',
      analysis: { structuredData: { outcome: scenario.outcome } },
      call: { id: call.providerCallId },
    },
  };
}

async function run() {
  await connectDB();

  // Assign a providerCallId to any queued calls so they can be matched.
  const queued = await CallLog.find({ status: { $in: ['queued', 'ringing'] } }).limit(SCENARIOS.length);
  if (queued.length === 0) {
    logger.warn('No queued calls found. Run `npm run seed` first.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let i = 0;
  for (const call of queued) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    if (!call.providerCallId) {
      call.providerCallId = `sim_${call._id}`;
      call.provider = 'vapi';
      call.status = 'ringing';
      await call.save();
    }

    const payload = buildVapiPayload(call, scenario);
    const res = await fetch(`${BASE}/api/webhooks/voice/vapi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    logger.info(
      `Simulated ${call.patientName} [${scenario.endedReason}, ${scenario.durationSeconds}s] -> ` +
        `${res.status} ${JSON.stringify(body)}`
    );
    i++;
  }

  // Fire a duplicate to PROVE idempotency (should return idempotent:true, no double-bill).
  const first = queued[0];
  const dup = buildVapiPayload(first, SCENARIOS[0]);
  const dres = await fetch(`${BASE}/api/webhooks/voice/vapi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dup),
  });
  logger.info(`Idempotency re-send for ${first.patientName} -> ${JSON.stringify(await dres.json())}`);

  logger.info('Simulation complete. Check the dashboard / wallet balance.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error(e.stack || e.message);
  process.exit(1);
});
