import config from '../config/index.js';
import logger from '../utils/logger.js';
import VapiAdapter from './providers/VapiAdapter.js';
import BolnaAdapter from './providers/BolnaAdapter.js';

/**
 * Picks the active voice adapter. The rest of the app imports THIS, never a
 * concrete provider — so demo->production is a single env var (VOICE_PROVIDER),
 * optionally overridden per-tenant via organization.voiceConfig.provider.
 */
const registry = {
  vapi: VapiAdapter,
  bolna: BolnaAdapter,
  // retell: RetellAdapter,  // add in Phase 4
  // sarvam: SarvamAdapter,  // add in Phase 4
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

export default getVoiceProvider;
