import mongoose from 'mongoose';

const memeAssetSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  imageUrl: { type: String, default: '' },
  publicId: { type: String, default: '' },
  source: { type: String, enum: ['reddit', 'user', 'admin'], required: true },
  sourcePostId: { type: String, unique: true, sparse: true },
  sourceUrl: { type: String, default: '' },
  sourceImageUrl: { type: String, default: '' },
  sourceAuthor: { type: String, default: '' },
  subreddit: { type: String, default: '' },
  isNsfw: { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: Date.now },
  tags: {
    type: [{ type: String, enum: ['desi', 'tech', 'sarcasm', 'wholesome', 'dark'] }],
    default: [],
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isModeratedApproved: { type: Boolean, default: false },
  isTemplate: { type: Boolean, default: false },
  rightsConfirmed: { type: Boolean, default: false },
  captionTop: { type: String, default: '', maxlength: 200 },
  captionBottom: { type: String, default: '', maxlength: 200 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  parentTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'MemeAsset', default: null },
  createdAt: { type: Date, default: Date.now },
});

memeAssetSchema.index({ status: 1, isTemplate: 1, createdAt: -1 });

export default mongoose.model('MemeAsset', memeAssetSchema);
