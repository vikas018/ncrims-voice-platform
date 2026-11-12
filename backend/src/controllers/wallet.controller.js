import { z } from 'zod';
import WalletTransaction from '../models/WalletTransaction.js';
import { getBalance, topUp } from '../services/wallet.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const balance = asyncHandler(async (req, res) => {
  res.json(await getBalance(req.organizationId));
});

const topUpSchema = z.object({
  minutes: z.number().int().positive().max(10_000_000),
  ratePerMinute: z.number().positive().optional(),
  reference: z.string().max(120).optional(),
  note: z.string().max(240).optional(),
});

/** Admin-only: add a prepaid minute package (with commercial terms). */
export const addPackage = asyncHandler(async (req, res) => {
  const { minutes, ratePerMinute, reference, note } = topUpSchema.parse(req.body);
  const wallet = await topUp(req.organizationId, minutes, { ratePerMinute, reference, note });
  res.status(201).json({
    totalMinutes: wallet.totalMinutes,
    consumedMinutes: wallet.consumedMinutes,
    remainingMinutes: wallet.remainingMinutes,
  });
});

export const transactions = asyncHandler(async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit || '50', 10));
  const txns = await WalletTransaction.find({ organizationId: req.organizationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('callLogId', 'patientName');
  res.json({ transactions: txns });
});
