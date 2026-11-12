/**
 * Wraps async route handlers so thrown errors/rejections reach the
 * central error middleware instead of crashing the process.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** A thrown ApiError carries an HTTP status the error middleware will honor. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default asyncHandler;
