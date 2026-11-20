import mongoose from 'mongoose';

const swipeSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['like', 'pass'], required: true },
  createdAt: { type: Date, default: Date.now },
});

swipeSchema.index({ from: 1, to: 1 }, { unique: true });

export default mongoose.model('Swipe', swipeSchema);
