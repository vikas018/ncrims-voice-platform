import mongoose from 'mongoose';

/**
 * One bulk outreach batch. stats is denormalized (counters live on the
 * doc) so the dashboard reads one document instead of aggregating
 * thousands of call logs on every page load. The webhook handler
 * increments these counters as results arrive.
 */
const campaignSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['confirmation', 'camp_announcement', 'followup'],
      required: true,
    },
    language: { type: String, enum: ['hi', 'en', 'hinglish'], default: 'hinglish' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['draft', 'running', 'paused', 'completed'],
      default: 'draft',
      index: true,
    },
    stats: {
      total: { type: Number, default: 0 },
      connected: { type: Number, default: 0 },
      unanswered: { type: Number, default: 0 },
      busy: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      confirmed: { type: Number, default: 0 },
      rescheduled: { type: Number, default: 0 },
      notInterested: { type: Number, default: 0 },
      minutesConsumed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Campaign', campaignSchema);
