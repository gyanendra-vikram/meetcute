import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  profile: {
    bio: { type: String, default: '' },
    birthDate: Date,
    gender: { type: String, enum: ['woman', 'man', 'nonbinary'] },
    interestedIn: {
      type: [{ type: String, enum: ['woman', 'man', 'nonbinary'] }],
      default: ['woman', 'man', 'nonbinary'],
    },
    location: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    interests: { type: [String], default: [] },
    allowNsfwMemes: { type: Boolean, default: false },
    isComplete: { type: Boolean, default: false },
  },
  emailVerified: { type: Boolean, default: true },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);
