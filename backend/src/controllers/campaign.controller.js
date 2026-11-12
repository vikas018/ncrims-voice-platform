import { z } from 'zod';
import Campaign from '../models/Campaign.js';
import CallLog from '../models/CallLog.js';
import { parsePatientCsv } from '../services/csv.service.js';
import { triggerCampaignCalls } from '../services/call.service.js';
import { getBalance } from '../services/wallet.service.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['confirmation', 'camp_announcement', 'followup']),
  language: z.enum(['hi', 'en', 'hinglish']).default('hinglish'),
});

export const createCampaign = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  const campaign = await Campaign.create({
    ...data,
    organizationId: req.organizationId,
    createdBy: req.user._id,
    status: 'draft',
  });
  res.status(201).json({ campaign });
});

export const listCampaigns = asyncHandler(async (req, res) => {
  const filter = { organizationId: req.organizationId };
  if (req.query.status) filter.status = req.query.status;
  const campaigns = await Campaign.find(filter).sort({ createdAt: -1 });
  res.json({ campaigns });
});

export const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  res.json({ campaign });
});

/**
 * Parse an uploaded CSV WITHOUT committing. Returns valid + invalid rows so
 * the UI can show the preview ("1,497 valid, 3 errors") before the staff
 * commits the list. Stateless — nothing is written here.
 */
export const previewUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded (field name: "file")');
  const result = parsePatientCsv(req.file.buffer);
  res.json({
    summary: { total: result.totalRows, valid: result.valid.length, invalid: result.invalid.length },
    valid: result.valid.slice(0, 50), // preview cap
    invalid: result.invalid.slice(0, 50),
  });
});

/**
 * Commit an uploaded CSV: create one queued CallLog per valid row.
 * No calls are placed yet — that's the /trigger step.
 */
export const commitUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded (field name: "file")');
  const campaign = await Campaign.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!campaign) throw new ApiError(404, 'Campaign not found');

  const { valid, invalid, totalRows } = parsePatientCsv(req.file.buffer);

  const docs = valid.map((row) => ({
    organizationId: req.organizationId,
    campaignId: campaign._id,
    patientName: row.patientName,
    phoneNumber: row.phoneNumber,
    doctorOrDept: row.doctorOrDept,
    appointmentAt: row.appointmentAt ? new Date(row.appointmentAt) : undefined,
    purpose: row.purpose,
    status: 'queued',
  }));
  if (docs.length) await CallLog.insertMany(docs, { ordered: false });

  campaign.stats.total += docs.length;
  await campaign.save();

  res.status(201).json({
    created: docs.length,
    skipped: invalid.length,
    totalRows,
    campaign,
  });
});

const statusActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'complete']),
});

/**
 * Pause / resume / complete a campaign.
 *  - pause:    running -> paused
 *  - resume:   paused  -> running (and re-triggers any still-queued calls)
 *  - complete: running/paused -> completed
 */
export const setCampaignStatus = asyncHandler(async (req, res) => {
  const { action } = statusActionSchema.parse(req.body);
  const campaign = await Campaign.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!campaign) throw new ApiError(404, 'Campaign not found');

  if (action === 'pause') {
    if (campaign.status !== 'running') throw new ApiError(400, 'Only a running campaign can be paused');
    campaign.status = 'paused';
    await campaign.save();
  } else if (action === 'resume') {
    if (campaign.status !== 'paused') throw new ApiError(400, 'Only a paused campaign can be resumed');
    // Re-trigger places only still-queued calls, so this is safe to call again.
    await triggerCampaignCalls(campaign); // sets status back to 'running'
  } else if (action === 'complete') {
    if (campaign.status === 'completed') throw new ApiError(400, 'Campaign is already completed');
    campaign.status = 'completed';
    await campaign.save();
  }

  res.json({ campaign });
});

/** Delete a campaign and its call logs. A running campaign must be paused first. */
export const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (campaign.status === 'running') {
    throw new ApiError(400, 'Pause the campaign before deleting it');
  }

  const { deletedCount } = await CallLog.deleteMany({ campaignId: campaign._id });
  await campaign.deleteOne();
  // Note: wallet ledger entries are kept — they are an immutable historical record.
  res.json({ deleted: true, id: req.params.id, callLogsRemoved: deletedCount });
});

/** Launch outbound calls for all queued logs — with a wallet pre-check. */
export const triggerCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!campaign) throw new ApiError(404, 'Campaign not found');

  const balance = await getBalance(req.organizationId);
  if (balance.remainingMinutes <= 0) {
    throw new ApiError(402, 'Insufficient minute balance. Please top up before launching.');
  }

  const result = await triggerCampaignCalls(campaign);
  res.json({ message: `Triggered ${result.placed} of ${result.total} calls`, ...result });
});
