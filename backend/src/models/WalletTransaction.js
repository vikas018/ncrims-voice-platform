import mongoose from 'mongoose';

/**
 * Append-only money ledger. We never just overwrite a balance — every
 * credit (top-up) and debit (billed call) is one immutable row, each
 * debit traceable to the exact call that caused it. This is your proof
 * when the client asks "why did we consume 300 minutes last Tuesday?".
 */
const walletTransactionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    minutes: { type: Number, required: true },
    reason: { type: String, enum: ['package_topup', 'call_billed', 'adjustment'], required: true },
    callLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallLog' }, // for debits
    balanceAfter: { type: Number, required: true }, // remaining-minutes snapshot for audit
    note: { type: String, default: '' },

    // credit (package top-up) details — all optional
    ratePerMinute: { type: Number }, // ₹ per minute agreed for this package
    amount: { type: Number }, // total ₹ paid = minutes × ratePerMinute
    reference: { type: String, default: '' }, // invoice / payment reference
  },
  { timestamps: true }
);

walletTransactionSchema.index({ organizationId: 1, createdAt: -1 });

export default mongoose.model('WalletTransaction', walletTransactionSchema);
