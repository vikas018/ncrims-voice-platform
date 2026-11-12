import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    isActive: { type: Boolean, default: true },
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
);

/** Set a password (hashes with bcrypt). Never store plaintext. */
userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Strip the hash whenever a user is serialized to JSON. */
userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    organizationId: this.organizationId,
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    lastActiveAt: this.lastActiveAt,
  };
};

export default mongoose.model('User', userSchema);
