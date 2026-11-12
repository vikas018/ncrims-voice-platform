/**
 * Maintenance: reset a tidy wallet for demos.
 * Clears the ledger, credits one 10,000-minute package, and recomputes
 * consumed minutes from the actual call logs so the numbers are consistent.
 *
 * Run:  node src/scripts/resetWallet.js
 */
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import logger from '../utils/logger.js';
import Organization from '../models/Organization.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import CallLog from '../models/CallLog.js';

const PACKAGE_MINUTES = 10000;

async function run() {
  await connectDB();
  const org = await Organization.findOne({ slug: 'ncrims' });
  if (!org) {
    logger.error('NCRIMS organization not found — run the seed first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Minutes actually consumed, from the billed call logs.
  const agg = await CallLog.aggregate([
    { $match: { organizationId: org._id } },
    { $group: { _id: null, consumed: { $sum: '$billedMinutes' } } },
  ]);
  const consumed = agg[0]?.consumed || 0;

  // Wipe the ledger and rebuild it cleanly.
  await WalletTransaction.deleteMany({ organizationId: org._id });

  const wallet = await Wallet.findOneAndUpdate(
    { organizationId: org._id },
    { totalMinutes: PACKAGE_MINUTES, consumedMinutes: consumed },
    { new: true, upsert: true }
  );

  await WalletTransaction.create({
    organizationId: org._id,
    type: 'credit',
    minutes: PACKAGE_MINUTES,
    reason: 'package_topup',
    balanceAfter: PACKAGE_MINUTES,
    note: '10,000-min prepaid package',
  });

  logger.info('----------------------------------------------------');
  logger.info('Wallet reset complete.');
  logger.info(`  Total allotted : ${PACKAGE_MINUTES}`);
  logger.info(`  Consumed       : ${consumed} (from ${await CallLog.countDocuments({ organizationId: org._id })} call logs)`);
  logger.info(`  Remaining      : ${wallet.remainingMinutes}`);
  logger.info('----------------------------------------------------');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  logger.error(e.stack || e.message);
  process.exit(1);
});
