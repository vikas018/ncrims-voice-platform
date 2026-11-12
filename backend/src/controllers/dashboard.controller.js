import CallLog from '../models/CallLog.js';
import Campaign from '../models/Campaign.js';
import { getBalance } from '../services/wallet.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Aggregated numbers for the dashboard landing screen. */
export const summary = asyncHandler(async (req, res) => {
  const orgId = req.organizationId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [byStatus, todayAgg, balance, recentCampaigns] = await Promise.all([
    CallLog.aggregate([
      { $match: { organizationId: orgId, createdAt: { $gte: startOfDay } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    CallLog.aggregate([
      { $match: { organizationId: orgId, createdAt: { $gte: startOfDay } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$outcome', 'confirmed'] }, 1, 0] } },
          minutes: { $sum: '$billedMinutes' },
        },
      },
    ]),
    getBalance(orgId),
    Campaign.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(5),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  const t = todayAgg[0] || { total: 0, connected: 0, confirmed: 0, minutes: 0 };
  const connectRate = t.total ? Math.round((t.connected / t.total) * 1000) / 10 : 0;

  res.json({
    today: {
      calls: t.total,
      connected: t.connected,
      connectRate,
      confirmed: t.confirmed,
      minutesUsed: t.minutes,
    },
    outcomesToday: {
      connected: statusMap.connected || 0,
      unanswered: statusMap.unanswered || 0,
      busyFailed: (statusMap.busy || 0) + (statusMap.failed || 0),
      queued: statusMap.queued || 0,
    },
    wallet: balance,
    recentCampaigns,
  });
});
