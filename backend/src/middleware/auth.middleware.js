import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import { ApiError } from '../utils/asyncHandler.js';

/** Verify the JWT, attach req.user (lean safe object). */
export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    const payload = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw new ApiError(401, 'Account not found or inactive');

    req.user = user;
    req.organizationId = user.organizationId;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired session'));
    }
    next(err);
  }
}

/** Gate a route to admins only (e.g. wallet top-ups, user management). */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }
  next();
}
