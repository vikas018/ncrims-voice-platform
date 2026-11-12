import { z } from 'zod';
import Organization from '../models/Organization.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

/** Return the signed-in user's organization (branding + voice config). */
export const getOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');
  res.json({ organization: org });
});

const updateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  branding: z
    .object({
      displayName: z.string().max(120).optional(),
      logoUrl: z.string().max(500).optional(),
      primaryColor: z
        .string()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour like #0E7C86')
        .optional(),
    })
    .optional(),
  voiceConfig: z
    .object({
      provider: z.enum(['vapi', 'retell', 'bolna', 'sarvam', '']).optional(),
      assistantId: z.string().max(120).optional(),
    })
    .optional(),
});

/** Admin-only: update branding and/or the active voice provider. */
export const updateOrg = asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body);
  const org = await Organization.findById(req.organizationId);
  if (!org) throw new ApiError(404, 'Organization not found');

  if (data.name !== undefined) org.name = data.name;
  // Set nested fields individually + markModified — Mongoose doesn't reliably
  // track a whole-object reassignment on a nested path.
  if (data.branding) {
    for (const [k, v] of Object.entries(data.branding)) org.branding[k] = v;
    org.markModified('branding');
  }
  if (data.voiceConfig) {
    for (const [k, v] of Object.entries(data.voiceConfig)) org.voiceConfig[k] = v;
    org.markModified('voiceConfig');
  }

  await org.save();
  res.json({ organization: org });
});
