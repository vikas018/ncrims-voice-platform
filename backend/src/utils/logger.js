/**
 * Tiny timestamped logger. Swap for pino/winston later without touching callers.
 */
const ts = () => new Date().toISOString();

const logger = {
  info: (msg) => console.log(`[${ts()}] INFO  ${msg}`),
  warn: (msg) => console.warn(`[${ts()}] WARN  ${msg}`),
  error: (msg) => console.error(`[${ts()}] ERROR ${msg}`),
  debug: (msg) => {
    if (process.env.NODE_ENV !== 'production') console.log(`[${ts()}] DEBUG ${msg}`);
  },
};

export default logger;
