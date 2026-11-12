import app from './app.js';
import config from './config/index.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js';

async function start() {
  try {
    await connectDB();
    app.listen(config.port, () => {
      logger.info(`NCRIMS backend listening on http://localhost:${config.port} (${config.env})`);
      logger.info(`Active voice provider: ${config.voice.provider}`);
    });
  } catch (err) {
    logger.error(`Failed to start: ${err.message}`);
    process.exit(1);
  }
}

start();
