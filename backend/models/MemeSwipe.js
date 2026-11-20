import mongoose from 'mongoose';

const memeSwipeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memeId: { type: String, required: true },
  category: { type: String, required: true },
  action: { type: String, enum: ['like', 'pass'], required: true },
  createdAt: { type: Date, default: Date.now },
});

memeSwipeSchema.index({ user: 1, memeId: 1 }, { unique: true });

export default mongoose.model('MemeSwipe', memeSwipeSchema);
