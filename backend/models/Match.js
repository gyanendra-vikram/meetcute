import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  pairKey: { type: String, required: true, unique: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Match', matchSchema);
