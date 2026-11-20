import mongoose from 'mongoose';

const memeProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastSuggestedAtSwipeCount: { type: Number, default: 0 },
  pendingCandidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deckCycle: { type: Number, default: 0 },
});

memeProgressSchema.statics.ensureForUser = async function ensureForUser(userId) {
  try {
    return await this.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return this.findOne({ user: userId });
  }
};

const MemeProgress = mongoose.model('MemeProgress', memeProgressSchema);

export default MemeProgress;
