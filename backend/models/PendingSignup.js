import mongoose from 'mongoose';

const pendingSignupSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  emailVerificationToken: String,
  emailVerificationExpires: { type: Date, expires: 0 },
});

export default mongoose.model('PendingSignup', pendingSignupSchema);
