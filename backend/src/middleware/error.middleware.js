import logger from '../utils/logger.js';

/** 404 for unmatched routes. */
export function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

/** Central error handler — the only place that formats error responses. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
  else logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${err.message}`);

  // Mongo duplicate key -> friendly message
  if (err.code === 11000) {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  res.status(status).json({ error: err.message || 'Internal server error' });
}
