import { z } from 'zod';
import CallLog from '../models/CallLog.js';
import { placeTestCall } from '../services/call.service.js';
import { normalizePhone } from '../services/csv.service.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

/** List call logs with filters: campaign, status, outcome, date range, search. */
export const listCalls = asyncHandler(async (req, res) => {
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

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '25', 10));

  const [calls, total] = await Promise.all([
    CallLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('campaignId', 'name'),
    CallLog.countDocuments(filter),
  ]);

  res.json({ calls, page, limit, total });
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
