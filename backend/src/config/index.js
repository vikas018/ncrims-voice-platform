import dotenv from 'dotenv';
dotenv.config();

/**
 * Central config loader + validation.
 * Fails fast at boot if a required secret is missing, so we never
 * discover a bad env var halfway through a live campaign.
 */
function required(key) {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. See .env.example`);
  }
  return v;
}

function optional(key, fallback) {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  mongoUri: required('MONGO_URI'),

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  billing: {
    minPulseSeconds: parseInt(optional('BILLING_MIN_PULSE_SECONDS', '60'), 10),
    // VOICEARTAI terms: 1-minute minimum, then actual connected duration -> per_second.
    overageMode: optional('BILLING_OVERAGE_MODE', 'per_second'), // whole_minute | per_second
    gstPercent: parseInt(optional('BILLING_GST_PERCENT', '18'), 10),
  },

  voice: {
    provider: optional('VOICE_PROVIDER', 'vapi').toLowerCase(),
    // Two-engine routing: which provider handles each campaign engine.
    // Demo defaults both to the global provider (vapi); in production set
    // ANNOUNCEMENT_PROVIDER=plivo and CONVERSATION_PROVIDER=sarvam.
    announcementProvider: optional('ANNOUNCEMENT_PROVIDER', '').toLowerCase(),
    conversationProvider: optional('CONVERSATION_PROVIDER', '').toLowerCase(),
    plivo: {
      authId: optional('PLIVO_AUTH_ID', ''),
      authToken: optional('PLIVO_AUTH_TOKEN', ''),
      fromNumber: optional('PLIVO_FROM_NUMBER', ''),
      answerUrl: optional('PLIVO_ANSWER_URL', ''),
      webhookSecret: optional('PLIVO_WEBHOOK_SECRET', ''),
    },
    vapi: {
      apiKey: optional('VAPI_API_KEY', ''),
      assistantId: optional('VAPI_ASSISTANT_ID', ''),
      phoneNumberId: optional('VAPI_PHONE_NUMBER_ID', ''),
      webhookSecret: optional('VAPI_WEBHOOK_SECRET', ''),
    },
    bolna: {
      apiKey: optional('BOLNA_API_KEY', ''),
      agentId: optional('BOLNA_AGENT_ID', ''),
      webhookSecret: optional('BOLNA_WEBHOOK_SECRET', ''),
    },
    sarvam: {
      apiKey: optional('SARVAM_API_KEY', ''),
      agentId: optional('SARVAM_AGENT_ID', ''),
      webhookSecret: optional('SARVAM_WEBHOOK_SECRET', ''),
    },
  },
};

export default config;
