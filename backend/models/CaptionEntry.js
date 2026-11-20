import mongoose from 'mongoose';

const captionEntrySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dateKey: { type: String, required: true },
  caption: { type: String, required: true, maxlength: 180, trim: true },
  category: {
    type: String,
    enum: ['wholesome', 'dry', 'chaotic', 'dark', 'niche'],
    required: true,
  },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

captionEntrySchema.index({ author: 1, dateKey: 1 }, { unique: true });

export default mongoose.model('CaptionEntry', captionEntrySchema);
