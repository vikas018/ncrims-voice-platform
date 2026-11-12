import config from '../config/index.js';
import logger from '../utils/logger.js';
import VapiAdapter from './providers/VapiAdapter.js';
import BolnaAdapter from './providers/BolnaAdapter.js';
import SarvamAdapter from './providers/SarvamAdapter.js';
import PlivoAnnouncementAdapter from './providers/PlivoAnnouncementAdapter.js';

/**
 * Picks the active voice adapter. The rest of the app imports THIS, never a
 * concrete provider — so switching providers is config, not code.
 *
 * Two-engine model: a campaign's `engine` ('announcement' | 'conversation')
 * selects which provider dials it, via ANNOUNCEMENT_PROVIDER /
 * CONVERSATION_PROVIDER. Both fall back to the global VOICE_PROVIDER (so the
 * demo keeps working on vapi until the production providers are wired).
 */
const registry = {
  vapi: VapiAdapter,
  bolna: BolnaAdapter,
  sarvam: SarvamAdapter,
  plivo: PlivoAnnouncementAdapter,
};

const cache = new Map();

export function getVoiceProvider(providerName) {
  const name = (providerName || config.voice.provider || 'vapi').toLowerCase();
  const Adapter = registry[name];
  if (!Adapter) {
    throw new Error(`Unknown voice provider "${name}". Known: ${Object.keys(registry).join(', ')}`);
  }
  if (!cache.has(name)) {
    cache.set(name, new Adapter());
    logger.info(`Voice provider active: ${name}`);
  }
  return cache.get(name);
}

/**
 * Resolve the provider for a campaign engine.
 * @param {'announcement'|'conversation'} engine
 * @param {object} [orgConfig] optional per-tenant override { provider }
 */
export function getVoiceProviderForEngine(engine, orgConfig) {
  if (orgConfig?.provider) return getVoiceProvider(orgConfig.provider); // tenant override wins
  const byEngine =
    engine === 'conversation' ? config.voice.conversationProvider : config.voice.announcementProvider;
  return getVoiceProvider(byEngine || config.voice.provider);
}

export default getVoiceProvider;
