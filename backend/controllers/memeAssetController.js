import mongoose from 'mongoose';
import cloudinary from '../middleware/cloudinary.js';
import MemeAsset from '../models/MemeAsset.js';
import User from '../models/User.js';

const allowedTags = new Set(['desi', 'tech', 'sarcasm', 'wholesome', 'dark']);
const redditImageHosts = new Set(['i.redd.it', 'preview.redd.it', 'i.imgur.com']);

const ageFromBirthDate = (birthDate) => {
  const date = new Date(birthDate);
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  if (
    today.getUTCMonth() < date.getUTCMonth()
    || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
};

const parseTags = (value) => {
  let tags = value;
  if (typeof value === 'string') {
    try {
      tags = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(tags) || tags.some((tag) => !allowedTags.has(tag))) return null;
  return [...new Set(tags)];
};

const uploadSourceUrl = (sourceImageUrl) => {
  const parsedUrl = new URL(sourceImageUrl);
  if (!redditImageHosts.has(parsedUrl.hostname.toLowerCase())) {
    throw new Error('This source image host is not allowed');
  }
  return cloudinary.uploader.upload(sourceImageUrl, {
    folder: 'meet-cute/memes',
    resource_type: 'image',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  });
};

export const getWeeklyRedditMemes = async (req, res) => {
  const viewer = await User.findById(req.user.id).select('profile.birthDate profile.allowNsfwMemes');
  if (!viewer) return res.status(404).json({ msg: 'User not found' });
  const age = viewer.profile?.birthDate ? ageFromBirthDate(viewer.profile.birthDate) : 0;
  const canSeeNsfw = age >= 18 && viewer.profile?.allowNsfwMemes === true;
  const filter = {
    source: 'reddit',
    status: { $ne: 'rejected' },
    lastSeenAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  };
  if (!canSeeNsfw) filter.isNsfw = { $ne: true };

  const memes = await MemeAsset.find(filter)
    .select('title sourceUrl sourceAuthor subreddit tags isNsfw lastSeenAt')
    .sort({ lastSeenAt: -1 })
    .limit(30);
  res.json({
    allowNsfwMemes: canSeeNsfw,
    memes: memes.map((meme) => ({
      _id: meme._id,
      title: meme.title,
      sourceUrl: meme.sourceUrl,
      sourceAuthor: meme.sourceAuthor,
      subreddit: meme.subreddit,
      tags: meme.tags,
      category: meme.tags[0] || 'reddit',
      isNsfw: meme.isNsfw,
      lastSeenAt: meme.lastSeenAt,
    })),
  });
};

export const getPendingMemes = async (req, res) => {
  const memes = await MemeAsset.find({ status: 'pending', isTemplate: false, source: { $ne: 'reddit' } })
    .select('title imageUrl source sourceUrl sourceImageUrl sourceAuthor subreddit tags isNsfw captionTop captionBottom createdAt')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(memes);
};

export const approveMeme = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.memeId)) {
    return res.status(400).json({ msg: 'Choose a valid meme' });
  }
  const tags = parseTags(req.body.tags);
  if (!tags?.length) return res.status(400).json({ msg: 'Choose at least one valid tag' });
  if (req.body.confirmRights !== true && req.body.confirmRights !== 'true') {
    return res.status(400).json({ msg: 'Confirm that this meme is permitted to be republished' });
  }

  const meme = await MemeAsset.findOne({ _id: req.params.memeId, status: 'pending', isTemplate: false });
  if (!meme) return res.status(404).json({ msg: 'Pending meme not found' });
  if (!meme.imageUrl && !meme.sourceImageUrl) {
    return res.status(400).json({ msg: 'This meme has no image to approve' });
  }

  if (!meme.imageUrl) {
    try {
      const uploaded = await uploadSourceUrl(meme.sourceImageUrl);
      meme.imageUrl = uploaded.secure_url;
      meme.publicId = uploaded.public_id;
    } catch (error) {
      console.error('Approved Reddit meme upload failed:', error.message);
      return res.status(502).json({ msg: 'Could not copy the rights-cleared image to Cloudinary' });
    }
  }

  meme.tags = tags;
  meme.rightsConfirmed = true;
  meme.status = 'approved';
  meme.isModeratedApproved = true;
  await meme.save();
  res.json({ _id: meme._id, status: meme.status, tags: meme.tags });
};

export const rejectMeme = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.memeId)) {
    return res.status(400).json({ msg: 'Choose a valid meme' });
  }
  const meme = await MemeAsset.findOneAndUpdate(
    { _id: req.params.memeId, status: 'pending', isTemplate: false },
    { $set: { status: 'rejected', isModeratedApproved: false } },
    { new: true },
  );
  if (!meme) return res.status(404).json({ msg: 'Pending meme not found' });
  res.json({ _id: meme._id, status: meme.status });
};

export const runMemeIngestionNow = async (req, res) => {
  const { runRedditMemeIngestion } = await import('../services/redditMemeIngestion.js');
  const result = await runRedditMemeIngestion();
  res.json(result);
};
