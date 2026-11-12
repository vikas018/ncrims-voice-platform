import CallLog from '../models/CallLog.js';
import Campaign from '../models/Campaign.js';
import getVoiceProvider, { getVoiceProviderForEngine } from '../voice/VoiceProviderFactory.js';
import Organization from '../models/Organization.js';
import logger from '../utils/logger.js';

/**
 * Trigger outbound calls for every queued call log in a campaign.
 * The campaign's engine (announcement | conversation) picks which provider
 * dials it. We store the returned providerCallId so the webhook can match.
 */
export async function triggerCampaignCalls(campaign) {
  const org = await Organization.findById(campaign.organizationId);
  const provider = getVoiceProviderForEngine(campaign.engine, org?.voiceConfig);
  const assistantId = org?.voiceConfig?.assistantId || undefined;
  logger.info(`Campaign "${campaign.name}" [engine=${campaign.engine}] dialing via ${provider.name}`);

  const queued = await CallLog.find({ campaignId: campaign._id, status: 'queued' });
  let placed = 0;

  for (const log of queued) {
    try {
      const { providerCallId, status } = await provider.initiateCall({
        phoneNumber: log.phoneNumber,
        assistantId,
        metadata: { callLogId: log._id.toString(), campaignId: campaign._id.toString() },
      });
      log.provider = provider.name;
      log.providerCallId = providerCallId;
      log.status = status || 'ringing';
      await log.save();
      placed++;
    } catch (err) {
      log.status = 'failed';
      await log.save();
      logger.error(`triggerCampaignCalls: ${log.phoneNumber} failed: ${err.message}`);
    }
  }

  campaign.status = 'running';
  await campaign.save();
  return { placed, total: queued.length };
}

/** Place a single test call (one number) through the active adapter. */
export async function placeTestCall(organizationId, { phoneNumber, patientName = 'Test Patient' }) {
  const org = await Organization.findById(organizationId);
  const provider = getVoiceProvider(org?.voiceConfig?.provider);

  const { providerCallId, status } = await provider.initiateCall({
    phoneNumber,
    assistantId: org?.voiceConfig?.assistantId || undefined,
    metadata: { test: true },
  });

  return { provider: provider.name, providerCallId, status, phoneNumber, patientName };
}

export default { triggerCampaignCalls, placeTestCall };
