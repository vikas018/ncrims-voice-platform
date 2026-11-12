import mongoose from 'mongoose';

/**
 * The tenant. One per hospital client (NCRIMS). Makes the platform
 * multi-tenant from day one — a second client needs no schema change.
 */
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    branding: {
      displayName: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#0E7C86' },
    },
    voiceConfig: {
      // which adapter this tenant calls through; overrides the global env default if set
      provider: { type: String, enum: ['vapi', 'retell', 'bolna', 'sarvam', ''], default: '' },
      assistantId: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Organization', organizationSchema);
