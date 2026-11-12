import mongoose from 'mongoose';

/**
 * One row per patient call — the heart of the system.
 * `providerCallId` has a unique sparse index: it is how we enforce
 * webhook idempotency (a retried/duplicate webhook can never double-bill).
 * `billedMinutes` is OUR computed pulse value, never trusted from the provider.
 */
const callLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },

    // patient data (from the uploaded CSV)
    patientName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    doctorOrDept: { type: String, default: '' },
    appointmentAt: { type: Date },
    purpose: { type: String, default: '' },

    // provider linkage
    provider: { type: String, default: '' }, // which adapter placed THIS call
    providerCallId: { type: String }, // unset until a call is placed (see partial index below)

    // normalized results (filled by the webhook handler)
    status: {
      type: String,
      enum: ['queued', 'ringing', 'connected', 'unanswered', 'busy', 'failed'],
      default: 'queued',
    },
    outcome: {
      type: String,
      enum: ['confirmed', 'rescheduled', 'not_interested', 'no_outcome'],
      default: 'no_outcome',
    },
    durationSeconds: { type: Number, default: 0 },
    billedMinutes: { type: Number, default: 0 },
    recordingUrl: { type: String, default: '' }, // URL only — never raw audio bytes
    transcript: { type: String, default: '' },

    // audit trail
    webhookReceivedAt: { type: Date },
    rawWebhookPayload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Idempotency guard: at most one call log per provider call id. A PARTIAL index
// (not sparse) so it only applies to docs where providerCallId is an actual
// string — unplaced calls (field absent) are never considered duplicates.
callLogSchema.index(
  { providerCallId: 1 },
  { unique: true, partialFilterExpression: { providerCallId: { $type: 'string' } } }
);
callLogSchema.index({ organizationId: 1, status: 1 });

export default mongoose.model('CallLog', callLogSchema);
