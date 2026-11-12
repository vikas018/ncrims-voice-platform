import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';

/** Get (or lazily create) the wallet for an organization. */
export async function ensureWallet(organizationId) {
  let wallet = await Wallet.findOne({ organizationId });
  if (!wallet) wallet = await Wallet.create({ organizationId, totalMinutes: 0, consumedMinutes: 0 });
  return wallet;
}

/**
 * Credit a prepaid package. Writes a ledger row and bumps totalMinutes.
 * `details` may be a plain note string (back-compat) or an object
 * { note, ratePerMinute, reference } capturing the commercial terms.
 */
export async function topUp(organizationId, minutes, details = {}) {
  const opts = typeof details === 'string' ? { note: details } : details || {};
  const wallet = await ensureWallet(organizationId);
  wallet.totalMinutes += minutes;
  await wallet.save();

  const amount =
    opts.ratePerMinute != null ? Math.round(minutes * opts.ratePerMinute * 100) / 100 : undefined;

  await WalletTransaction.create({
    organizationId,
    type: 'credit',
    minutes,
    reason: 'package_topup',
    balanceAfter: wallet.remainingMinutes,
    note: opts.note || '',
    ratePerMinute: opts.ratePerMinute,
    amount,
    reference: opts.reference || '',
  });
  return wallet;
}

/**
 * Debit minutes for a billed call. ONE debit per call — the caller
 * (webhook handler) guarantees idempotency via the providerCallId unique
 * index before invoking this, so a retried webhook can't double-charge.
 * Returns null when there is nothing to bill (minutes <= 0).
 */
export async function debitForCall(organizationId, minutes, callLogId) {
  if (!minutes || minutes <= 0) return null;

  const wallet = await ensureWallet(organizationId);
  wallet.consumedMinutes += minutes;
  await wallet.save();

  return WalletTransaction.create({
    organizationId,
    type: 'debit',
    minutes,
    reason: 'call_billed',
    callLogId,
    balanceAfter: wallet.remainingMinutes,
  });
}

export async function getBalance(organizationId) {
  const wallet = await ensureWallet(organizationId);
  return {
    totalMinutes: wallet.totalMinutes,
    consumedMinutes: wallet.consumedMinutes,
    remainingMinutes: wallet.remainingMinutes,
  };
}

export default { ensureWallet, topUp, debitForCall, getBalance };
