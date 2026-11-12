import jwt from 'jsonwebtoken';
import { z } from 'zod';
import config from '../config/index.js';
import User from '../models/User.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid email or password');

  const ok = await user.comparePassword(password);
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  user.lastActiveAt = new Date();
  await user.save();

  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

/** Let the signed-in user change their own password (verifies the current one). */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  // req.user from auth middleware omits passwordHash (select:false) — re-fetch it.
  const user = await User.findById(req.user._id).select('+passwordHash');
  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw new ApiError(400, 'Current password is incorrect');

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from the current one');
  }

  await user.setPassword(newPassword);
  await user.save();
  res.json({ changed: true });
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'staff']).default('staff'),
});

/** Admin-only: create a staff/admin account within the same organization. */
export const createUser = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const exists = await User.findOne({ email: data.email.toLowerCase() });
  if (exists) throw new ApiError(409, 'A user with that email already exists');

  const user = new User({
    organizationId: req.organizationId,
    name: data.name,
    email: data.email,
    role: data.role,
  });
  await user.setPassword(data.password);
  await user.save();

  res.status(201).json({ user: user.toSafeJSON() });
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ organizationId: req.organizationId }).sort({ createdAt: 1 });
  res.json({ users: users.map((u) => u.toSafeJSON()) });
});

/** Admin-only: create many staff from an uploaded CSV (Name, Email, Role, Password). */
export const bulkCreateUsers = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded (field name: "file")');
  const { parseUserCsv } = await import('../services/csv.service.js');
  const { valid, invalid, totalRows, defaultPassword } = parseUserCsv(req.file.buffer);

  const created = [];
  const skipped = [...invalid.map((i) => ({ email: i.email, reason: i.errors.join(', ') }))];

  for (const row of valid) {
    const exists = await User.findOne({ email: row.email });
    if (exists) {
      skipped.push({ email: row.email, reason: 'Already exists' });
      continue;
    }
    const user = new User({
      organizationId: req.organizationId,
      name: row.name,
      email: row.email,
      role: row.role,
    });
    await user.setPassword(row.password);
    await user.save();
    created.push(user.toSafeJSON());
  }

  res.status(201).json({
    created: created.length,
    skipped: skipped.length,
    skippedDetails: skipped.slice(0, 50),
    totalRows,
    defaultPassword,
  });
});

// Count active admins in the org — used to stop the last one being removed/demoted.
async function activeAdminCount(organizationId, excludeId) {
  const filter = { organizationId, role: 'admin', isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
}

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'staff']).optional(),
  isActive: z.boolean().optional(),
});

/** Admin-only: edit a user's name/role/active-state within the same org. */
export const updateUser = asyncHandler(async (req, res) => {
  const data = updateUserSchema.parse(req.body);
  const target = await User.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!target) throw new ApiError(404, 'User not found');

  const isSelf = target._id.equals(req.user._id);
  const demoting = data.role === 'staff' && target.role === 'admin';
  const deactivating = data.isActive === false && target.isActive;

  // Guard: never remove the last active admin (demote or deactivate).
  if ((demoting || deactivating) && target.role === 'admin') {
    const others = await activeAdminCount(req.organizationId, target._id);
    if (others === 0) throw new ApiError(400, 'This is the last active admin — assign another admin first');
  }
  // Guard: don't let an admin deactivate their own account (lock-out).
  if (isSelf && data.isActive === false) throw new ApiError(400, 'You cannot deactivate your own account');

  if (data.name !== undefined) target.name = data.name;
  if (data.role !== undefined) target.role = data.role;
  if (data.isActive !== undefined) target.isActive = data.isActive;
  await target.save();

  res.json({ user: target.toSafeJSON() });
});

/** Admin-only: delete a user (with the same last-admin / self safeguards). */
export const deleteUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!target) throw new ApiError(404, 'User not found');

  if (target._id.equals(req.user._id)) throw new ApiError(400, 'You cannot delete your own account');
  if (target.role === 'admin') {
    const others = await activeAdminCount(req.organizationId, target._id);
    if (others === 0) throw new ApiError(400, 'This is the last active admin — assign another admin first');
  }

  await target.deleteOne();
  res.json({ deleted: true, id: req.params.id });
});
