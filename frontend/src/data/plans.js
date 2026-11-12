/**
 * VOICEARTAI plan catalog — the single source of truth for pricing + features.
 *
 * ⚠️ PRICING is from the client proposal and is authoritative.
 * ⚠️ FEATURE lists are DRAFTS based on the plan tiers — edit them here to match
 *    what VOICEARTAI actually includes in each plan before sharing with clients.
 */
export const GST = 0.18; // 18%

export const PLAN_FAMILIES = [
  {
    category: 'Promotional',
    categoryDesc: 'Outbound announcements — appointment confirmations, health-camp drives, reminders, re-engagement.',
    voice: 'Standard',
    voiceDesc: 'Clear, natural AI voice in Hindi & English.',
    features: [
      'Hindi + English (Hinglish) voice',
      'Appointment confirmations & reminders',
      'Health-camp & drive announcements',
      'Call recording + full transcript',
      'Outcome tracking (confirmed / rescheduled / not interested)',
      'Bulk CSV upload & campaign scheduling',
    ],
    tiers: [
      { tier: 'Starter', minutes: 10000, rate: 3.2 },
      { tier: 'Enterprise', minutes: 100000, rate: 2.2 },
    ],
  },
  {
    category: 'Promotional',
    categoryDesc: 'Outbound announcements — appointment confirmations, health-camp drives, reminders, re-engagement.',
    voice: 'Premium',
    voiceDesc: 'Ultra-natural premium voice with better accent & interruption handling.',
    features: [
      'Everything in Promotional · Standard',
      'Premium ultra-natural voice',
      'Better accent & interruption handling',
      'Priority call throughput',
    ],
    tiers: [
      { tier: 'Starter', minutes: 25000, rate: 5.0 },
      { tier: 'Enterprise', minutes: 100000, rate: 4.0 },
    ],
  },
  {
    category: 'Lead Generation',
    categoryDesc: 'Qualify prospects, capture interest, and book consultations — conversational, outcome-driven.',
    voice: 'Standard',
    voiceDesc: 'Clear, natural AI voice in Hindi & English.',
    features: [
      'Hindi + English (Hinglish) voice',
      'Lead qualification prompts',
      'Interest capture & callback scheduling',
      'Structured outcome + data capture',
      'Call recording + full transcript',
      'CRM-ready export (CSV)',
    ],
    tiers: [
      { tier: 'Starter', minutes: 10000, rate: 3.5 },
      { tier: 'Enterprise', minutes: 100000, rate: 2.5 },
    ],
  },
  {
    category: 'Lead Generation',
    categoryDesc: 'Qualify prospects, capture interest, and book consultations — conversational, outcome-driven.',
    voice: 'Premium',
    voiceDesc: 'Ultra-natural premium voice with advanced conversation handling.',
    features: [
      'Everything in Lead Generation · Standard',
      'Premium ultra-natural voice',
      'Advanced conversation handling',
      'Priority throughput + support',
    ],
    tiers: [
      { tier: 'Starter', minutes: 25000, rate: 7.0 },
      { tier: 'Enterprise', minutes: 100000, rate: 6.0 },
    ],
  },
];

// Common commercial terms (shown in the comparison footer).
export const COMMERCIAL_TERMS = [
  '18% GST extra on all plans',
  'Billing applies only to connected calls',
  '1-minute minimum per connected call, then by actual duration',
  'No charge for unanswered or unconnected calls',
];

// Flat list used by the Add-Package dropdown.
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
export const PLANS = PLAN_FAMILIES.flatMap((f) =>
  f.tiers.map((t) => ({
    id: `${slug(f.category)}-${slug(f.voice)}-${slug(t.tier)}`,
    group: `${f.category} · ${f.voice}`,
    tier: t.tier,
    minutes: t.minutes,
    rate: t.rate,
  }))
);

export const fmtMoney = (n) =>
  n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
