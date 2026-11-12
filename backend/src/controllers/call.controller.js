import { z } from 'zod';
import CallLog from '../models/CallLog.js';
import { placeTestCall } from '../services/call.service.js';
import { normalizePhone } from '../services/csv.service.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

/** Build the Mongo filter from query params — shared by list and export. */
function buildCallFilter(req) {
  const { campaignId, status, outcome, q, from, to } = req.query;
  const filter = { organizationId: req.organizationId };
  if (campaignId) filter.campaignId = campaignId;
  if (status) filter.status = status;
  if (outcome) filter.outcome = outcome;
  if (q) {
    filter.$or = [
      { patientName: new RegExp(q, 'i') },
      { phoneNumber: new RegExp(q.replace(/\s/g, ''), 'i') },
    ];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

/** List call logs with filters: campaign, status, outcome, date range, search. */
export const listCalls = asyncHandler(async (req, res) => {
  const filter = buildCallFilter(req);
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '25', 10));

  const [calls, total] = await Promise.all([
    CallLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('campaignId', 'name'),
    CallLog.countDocuments(filter),
  ]);

  res.json({ calls, page, limit, total });
});

/** Export ALL call logs matching the current filters (no pagination) for CSV. */
export const exportCalls = asyncHandler(async (req, res) => {
  const filter = buildCallFilter(req);
  const calls = await CallLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(50000) // safety cap
    .populate('campaignId', 'name');
  res.json({ calls, total: calls.length });
});

export const getCall = asyncHandler(async (req, res) => {
  const call = await CallLog.findOne({ _id: req.params.id, organizationId: req.organizationId }).populate(
    'campaignId',
    'name type'
  );
  if (!call) throw new ApiError(404, 'Call not found');
  res.json({ call });
});

const testSchema = z.object({
  phoneNumber: z.string().min(5),
  patientName: z.string().optional(),
});

/** Place a single test call through the active adapter. */
export const testCall = asyncHandler(async (req, res) => {
  const data = testSchema.parse(req.body);
  const phone = normalizePhone(data.phoneNumber) || data.phoneNumber;
  const result = await placeTestCall(req.organizationId, { ...data, phoneNumber: phone });
  res.json(result);
});
