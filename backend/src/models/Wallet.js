import mongoose from 'mongoose';

/**
 * The prepaid minute wallet — one per organization. Holds running
 * totals only; remaining is computed (totalMinutes - consumedMinutes),
 * never stored, so it can't drift. Every change is also recorded as an
 * immutable WalletTransaction (see WalletTransaction.js).
 */
const walletSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    totalMinutes: { type: Number, default: 0 }, // lifetime allotted (sum of top-ups)
    consumedMinutes: { type: Number, default: 0 }, // running total of debits
  },
  { timestamps: true }
);

walletSchema.virtual('remainingMinutes').get(function () {
  return Math.max(0, this.totalMinutes - this.consumedMinutes);
});

walletSchema.set('toJSON', { virtuals: true });
walletSchema.set('toObject', { virtuals: true });

export default mongoose.model('Wallet', walletSchema);
