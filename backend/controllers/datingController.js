import mongoose from 'mongoose';
import User from '../models/User.js';
import Swipe from '../models/Swipe.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import MemeBattle from '../models/MemeBattle.js';
import MemeProgress from '../models/MemeProgress.js';
import MemeSwipe from '../models/MemeSwipe.js';
import cloudinary from '../middleware/cloudinary.js';
import { ensureMemeBattle, toPublicBattle } from './memeBattleController.js';
import { MEME_SWIPES_REQUIRED } from '../data/memeDeck.js';

const genders = ['woman', 'man', 'nonbinary'];
const profileFields = 'name profile';

const ageFromBirthDate = (birthDate) => {
  const date = new Date(birthDate);
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  if (
    today.getUTCMonth() < date.getUTCMonth() ||
    (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
};

const canSeeEachOther = (viewer, candidate) =>
  viewer.profile.interestedIn.includes(candidate.profile.gender) &&
  candidate.profile.interestedIn.includes(viewer.profile.gender);

const queueUnmatchedCandidate = async (userId, candidateId) => {
  const [progress, memeSwipeCount] = await Promise.all([
    MemeProgress.ensureForUser(userId),
    MemeSwipe.countDocuments({ user: userId }),
  ]);
  if (progress.pendingCandidate || memeSwipeCount < MEME_SWIPES_REQUIRED) return;

  await MemeProgress.updateOne(
    { user: userId, pendingCandidate: null },
    { $set: { pendingCandidate: candidateId } },
  );
};

const publicProfile = (user) => ({
  _id: user._id,
  name: user.name,
  age: ageFromBirthDate(user.profile.birthDate),
  bio: user.profile.bio,
  gender: user.profile.gender,
  location: user.profile.location,
  photoUrl: user.profile.photoUrl,
  interests: user.profile.interests,
});

const baseMemeId = (memeId) => {
  const suffixIndex = memeId.lastIndexOf('@');
  return suffixIndex < 0 ? memeId : memeId.slice(0, suffixIndex);
};

const findOwnedMatch = async (matchId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(matchId)) return null;
  return Match.findOne({ _id: matchId, users: userId });
};

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select(profileFields);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  res.json({ name: user.name, profile: user.profile });
};

export const updateProfile = async (req, res) => {
  const {
    name,
    bio,
    birthDate,
    gender,
    interestedIn,
    location,
    photoUrl,
    interests,
    allowNsfwMemes,
  } = req.body;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
    return res.status(400).json({ msg: 'Name must be between 2 and 60 characters' });
  }
  if (typeof bio !== 'string' || bio.length > 500) {
    return res.status(400).json({ msg: 'Bio must be 500 characters or fewer' });
  }
  if (!genders.includes(gender)) {
    return res.status(400).json({ msg: 'Choose a valid gender' });
  }
  if (!Array.isArray(interestedIn) || !interestedIn.length || interestedIn.some((value) => !genders.includes(value))) {
    return res.status(400).json({ msg: 'Choose at least one gender you are interested in' });
  }

  const parsedBirthDate = new Date(birthDate);
  if (!birthDate || Number.isNaN(parsedBirthDate.getTime()) || ageFromBirthDate(parsedBirthDate) < 18) {
    return res.status(400).json({ msg: 'You must be at least 18 years old to use this app' });
  }
  if (parsedBirthDate > new Date()) {
    return res.status(400).json({ msg: 'Birth date cannot be in the future' });
  }
  if (typeof location !== 'string' || location.length > 100) {
    return res.status(400).json({ msg: 'Location must be 100 characters or fewer' });
  }
  if (typeof photoUrl !== 'string' || photoUrl.length > 500) {
    return res.status(400).json({ msg: 'Photo URL must be 500 characters or fewer' });
  }
  if (photoUrl && !/^https?:\/\/\S+$/i.test(photoUrl)) {
    return res.status(400).json({ msg: 'Photo must be a valid http or https URL' });
  }
  if (!Array.isArray(interests) || interests.length > 12 || interests.some((item) => typeof item !== 'string' || item.trim().length > 30)) {
    return res.status(400).json({ msg: 'Add up to 12 interests, each 30 characters or fewer' });
  }
  if (allowNsfwMemes !== undefined && typeof allowNsfwMemes !== 'boolean') {
    return res.status(400).json({ msg: 'NSFW meme preference must be enabled or disabled' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  user.name = name.trim();
  user.profile = {
    bio: bio.trim(),
    birthDate: parsedBirthDate,
    gender,
    interestedIn: [...new Set(interestedIn)],
    location: location.trim(),
    photoUrl: photoUrl.trim(),
    interests: [...new Set(interests.map((item) => item.trim()).filter(Boolean))],
    allowNsfwMemes: allowNsfwMemes === undefined
      ? Boolean(user.profile.allowNsfwMemes)
      : allowNsfwMemes,
    isComplete: true,
  };
  await user.save();
  res.json({ name: user.name, profile: user.profile });
};

export const saveProfilePhoto = async (req, res) => {
  if (!process.env.CLOUD_NAME || !process.env.CLOUD_API_KEY || !process.env.CLOUD_API_SECRET) {
    return res.status(503).json({ msg: 'Photo uploads are not configured on the server' });
  }
  if (!req.file) return res.status(400).json({ msg: 'Choose a photo to upload' });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: 'User not found' });

  let uploaded;
  try {
    uploaded = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'meet-cute/profiles',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      ).end(req.file.buffer);
    });
  } catch (error) {
    console.error('Cloudinary profile photo upload failed:', error.message);
    return res.status(502).json({ msg: 'Photo upload failed. Please try again.' });
  }

  if (!uploaded?.secure_url) {
    console.error('Cloudinary profile photo upload returned no secure URL');
    return res.status(502).json({ msg: 'Photo upload failed. Please try again.' });
  }

  user.profile.photoUrl = uploaded.secure_url;
  await user.save();
  res.json({ photoUrl: uploaded.secure_url });
};

export const discoverProfiles = async (req, res) => {
  const viewer = await User.findById(req.user.id).select(profileFields);
  if (!viewer) return res.status(404).json({ msg: 'User not found' });
  if (!viewer.profile?.isComplete) {
    return res.status(200).json({ profiles: [], needsProfile: true });
  }

  const [viewerMemeSwipes, initialProgress] = await Promise.all([
    MemeSwipe.find({ user: viewer._id }).select('memeId action createdAt').sort({ createdAt: -1, _id: -1 }),
    MemeProgress.ensureForUser(viewer._id),
  ]);
  let progress = initialProgress;
  const swipes = await Swipe.find({ from: viewer._id }).select('to action createdAt');
  const profileSwipesByTarget = new Map(
    swipes.map((swipe) => [swipe.to.toString(), swipe]),
  );
  const excludedIds = [
    viewer._id,
    ...swipes.filter((swipe) => swipe.action === 'like').map((swipe) => swipe.to),
  ];
  const candidates = await User.find({
    _id: { $nin: excludedIds },
    'profile.isComplete': true,
    'profile.gender': { $in: viewer.profile.interestedIn },
    'profile.interestedIn': viewer.profile.gender,
  }).select(profileFields);
  const memeSwipes = await MemeSwipe.find({
    user: { $in: [viewer._id, ...candidates.map((candidate) => candidate._id)] },
  }).select('user memeId action createdAt').sort({ createdAt: -1, _id: -1 });
  const swipesByUser = new Map();
  memeSwipes.forEach((memeSwipe) => {
    const userKey = memeSwipe.user.toString();
    if (!swipesByUser.has(userKey)) swipesByUser.set(userKey, new Map());
    const taste = swipesByUser.get(userKey);
    const cardId = baseMemeId(memeSwipe.memeId);
    if (!taste.has(cardId)) taste.set(cardId, memeSwipe.action);
  });
  const viewerTaste = swipesByUser.get(viewer._id.toString()) || new Map();
  const rankedProfiles = candidates.map((candidate) => {
    const candidateTaste = swipesByUser.get(candidate._id.toString()) || new Map();
    const hasEnoughSwipes = candidateTaste.size >= MEME_SWIPES_REQUIRED;
    const sharedCards = [...viewerTaste.entries()]
      .filter(([memeId]) => candidateTaste.has(memeId));
    const matchingSwipes = sharedCards.filter(([memeId, action]) => candidateTaste.get(memeId) === action).length;
    return {
      ...publicProfile(candidate),
      memeSwiping: hasEnoughSwipes,
      humorCompatibility: hasEnoughSwipes && sharedCards.length
        ? Math.round((matchingSwipes / sharedCards.length) * 100)
        : null,
      sharedMemeCount: hasEnoughSwipes ? matchingSwipes : null,
      comparedMemeCount: hasEnoughSwipes ? sharedCards.length : null,
    };
  }).sort((left, right) => (right.humorCompatibility ?? -1) - (left.humorCompatibility ?? -1));
  const unseenProfiles = rankedProfiles.filter(
    (profile) => !profileSwipesByTarget.has(profile._id.toString()),
  );

  let pendingCandidate = progress.pendingCandidate
    ? rankedProfiles.find((profile) => profile._id.toString() === progress.pendingCandidate.toString())
    : null;
  if (progress.pendingCandidate && !pendingCandidate) {
    const wasSwiped = swipes.some((swipe) => swipe.to.equals(progress.pendingCandidate));
    const update = { $set: { pendingCandidate: null } };
    if (!wasSwiped) {
      update.$set.lastSuggestedAtSwipeCount = Math.max(
        0,
        progress.lastSuggestedAtSwipeCount - MEME_SWIPES_REQUIRED,
      );
    }
    await MemeProgress.updateOne(
      { user: viewer._id, pendingCandidate: progress.pendingCandidate },
      update,
    );
    progress = await MemeProgress.findOne({ user: viewer._id });
  }

  if (pendingCandidate) {
    const likedViewer = await Swipe.exists({
      from: pendingCandidate._id,
      to: viewer._id,
      action: 'like',
    });
    return res.json({
      profiles: [{ ...pendingCandidate, likedYou: Boolean(likedViewer) }],
      needsProfile: false,
      needsMemeSwipes: false,
    });
  }

  const incomingLikes = await Swipe.find({ to: viewer._id, action: 'like' }).select('from');
  const incomingLikeIds = new Set(incomingLikes.map((swipe) => swipe.from.toString()));
  const incomingLikeProfile = unseenProfiles.find((profile) => incomingLikeIds.has(profile._id.toString()));
  if (incomingLikeProfile) {
    const assignedProgress = await MemeProgress.findOneAndUpdate(
      { user: viewer._id, pendingCandidate: null },
      { $set: { pendingCandidate: incomingLikeProfile._id } },
      { new: true },
    );
    if (assignedProgress) {
      return res.json({
        profiles: [{ ...incomingLikeProfile, likedYou: true }],
        needsProfile: false,
        needsMemeSwipes: false,
      });
    }

    const latestProgress = await MemeProgress.findOne({ user: viewer._id });
    const currentSuggestion = latestProgress?.pendingCandidate
      ? rankedProfiles.find((profile) => profile._id.toString() === latestProgress.pendingCandidate.toString())
      : null;
    if (currentSuggestion) {
      const likedViewer = await Swipe.exists({
        from: currentSuggestion._id,
        to: viewer._id,
        action: 'like',
      });
      return res.json({
        profiles: [{ ...currentSuggestion, likedYou: Boolean(likedViewer) }],
        needsProfile: false,
        needsMemeSwipes: false,
      });
    }
    return res.status(409).json({ msg: 'Your profile suggestion is updating. Refresh Discover and try again.' });
  }

  const swipesSinceSuggestion = Math.max(0, viewerMemeSwipes.length - progress.lastSuggestedAtSwipeCount);
  if (swipesSinceSuggestion < MEME_SWIPES_REQUIRED) {
    return res.json({
      profiles: [],
      needsProfile: false,
      needsMemeSwipes: true,
      swipesCompleted: swipesSinceSuggestion,
      swipesRequired: MEME_SWIPES_REQUIRED,
      waitingForMemeUsers: false,
    });
  }

  const memeActiveProfiles = unseenProfiles.filter((profile) => profile.memeSwiping);
  const unseenSuggestionPool = memeActiveProfiles.length ? memeActiveProfiles : unseenProfiles;
  const recycledPasses = rankedProfiles
    .filter((profile) => profileSwipesByTarget.get(profile._id.toString())?.action === 'pass')
    .sort((left, right) => {
      const leftLiked = incomingLikeIds.has(left._id.toString()) ? 1 : 0;
      const rightLiked = incomingLikeIds.has(right._id.toString()) ? 1 : 0;
      if (leftLiked !== rightLiked) return rightLiked - leftLiked;
      const leftSwipeAt = new Date(
        profileSwipesByTarget.get(left._id.toString()).createdAt || 0,
      ).getTime();
      const rightSwipeAt = new Date(
        profileSwipesByTarget.get(right._id.toString()).createdAt || 0,
      ).getTime();
      return leftSwipeAt - rightSwipeAt;
    });
  const suggestionPool = unseenSuggestionPool.length ? unseenSuggestionPool : recycledPasses;
  if (!suggestionPool.length) {
    await MemeProgress.updateOne(
      { user: viewer._id, pendingCandidate: null },
      { $set: { lastSuggestedAtSwipeCount: viewerMemeSwipes.length } },
    );
    return res.json({
      profiles: [],
      needsProfile: false,
      needsMemeSwipes: true,
      swipesCompleted: 0,
      swipesRequired: MEME_SWIPES_REQUIRED,
      waitingForMemeUsers: true,
    });
  }

  const suggestion = suggestionPool[0];
  const assignedProgress = await MemeProgress.findOneAndUpdate(
    {
      user: viewer._id,
      pendingCandidate: null,
    },
    {
      $inc: { lastSuggestedAtSwipeCount: MEME_SWIPES_REQUIRED },
      $set: { pendingCandidate: suggestion._id },
    },
    { new: true },
  );
  if (!assignedProgress) {
    const latestProgress = await MemeProgress.findOne({ user: viewer._id });
    const currentSuggestion = latestProgress?.pendingCandidate
      ? rankedProfiles.find((profile) => profile._id.toString() === latestProgress.pendingCandidate.toString())
      : null;
    if (currentSuggestion) {
      return res.json({
        profiles: [currentSuggestion],
        needsProfile: false,
        needsMemeSwipes: false,
      });
    }
    return res.status(409).json({ msg: 'Your profile suggestion is updating. Refresh Discover and try again.' });
  }

  res.json({
    profiles: [{ ...suggestion, likedYou: incomingLikeIds.has(suggestion._id.toString()) }],
    needsProfile: false,
    needsMemeSwipes: false,
  });
};

export const swipeProfile = async (req, res) => {
  const { targetUserId, action } = req.body;
  if (!mongoose.Types.ObjectId.isValid(targetUserId) || targetUserId === req.user.id) {
    return res.status(400).json({ msg: 'Choose a valid profile' });
  }
  if (!['like', 'pass'].includes(action)) {
    return res.status(400).json({ msg: 'Action must be like or pass' });
  }

  const target = await User.findById(targetUserId).select(profileFields);
  if (!target?.profile?.isComplete) return res.status(404).json({ msg: 'Profile not found' });
  const viewer = await User.findById(req.user.id).select(profileFields);
  if (!viewer?.profile?.isComplete) return res.status(400).json({ msg: 'Complete your profile before discovering people' });
  const progress = await MemeProgress.findOne({ user: viewer._id });
  if (!progress?.pendingCandidate?.equals(target._id)) {
    return res.status(403).json({ msg: 'Swipe five meme cards to unlock your next profile suggestion' });
  }
  if (action === 'like' && !canSeeEachOther(viewer, target)) {
    return res.status(400).json({ msg: 'This profile is outside your preferences' });
  }

  await Swipe.findOneAndUpdate(
    { from: viewer._id, to: target._id },
    { action, createdAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await MemeProgress.updateOne(
    { user: viewer._id, pendingCandidate: target._id },
    { $set: { pendingCandidate: null } },
  );

  if (action !== 'like') return res.json({ matched: false });

  const reciprocalLike = await Swipe.findOne({ from: target._id, to: viewer._id, action: 'like' });
  if (!reciprocalLike) return res.json({ matched: false });

  const users = [viewer._id, target._id].sort((a, b) => a.toString().localeCompare(b.toString()));
  const pairKey = users.map((id) => id.toString()).join(':');
  const existingMatch = await Match.findOne({ pairKey }).select('_id');
  let match;
  try {
    match = await Match.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { pairKey, users } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    match = await Match.findOne({ pairKey });
  }
  if (!existingMatch) await ensureMemeBattle(match);
  res.json({ matched: true, matchId: match._id, profile: publicProfile(target) });
};

export const getMatches = async (req, res) => {
  const matches = await Match.find({ users: req.user.id })
    .sort({ createdAt: -1 })
    .populate('users', profileFields);
  const battleDocs = await MemeBattle.find({ match: { $in: matches.map((match) => match._id) } });
  const battlesByMatch = new Map(battleDocs.map((battle) => [battle.match.toString(), battle]));
  res.json(matches.map((match) => {
    const otherUser = match.users.find((user) => user._id.toString() !== req.user.id);
    const battle = battlesByMatch.get(match._id.toString());
    return {
      _id: match._id,
      createdAt: match.createdAt,
      profile: otherUser ? publicProfile(otherUser) : null,
      battle: battle ? toPublicBattle(battle, req.user.id) : null,
    };
  }).filter((match) => match.profile));
};

export const unmatchProfile = async (req, res) => {
  const match = await findOwnedMatch(req.params.matchId, req.user.id);
  if (!match) return res.status(404).json({ msg: 'Match not found' });

  const otherUserId = match.users.find((userId) => userId.toString() !== req.user.id);
  if (!otherUserId) return res.status(404).json({ msg: 'Match not found' });

  await Swipe.deleteMany({
    $or: [
      { from: req.user.id, to: otherUserId },
      { from: otherUserId, to: req.user.id },
    ],
  });
  await Message.deleteMany({ match: match._id });
  await MemeBattle.deleteOne({ match: match._id });
  await match.deleteOne();
  await Promise.all([
    queueUnmatchedCandidate(req.user.id, otherUserId),
    queueUnmatchedCandidate(otherUserId, req.user.id),
  ]);

  res.status(204).end();
};

export const getMessages = async (req, res) => {
  const match = await findOwnedMatch(req.params.matchId, req.user.id);
  if (!match) return res.status(404).json({ msg: 'Match not found' });
  const battle = await MemeBattle.findOne({ match: match._id });
  if (battle && !['skipped', 'chat_open'].includes(battle.status)) {
    return res.status(403).json({ msg: 'Complete the meme battle and both choose chat before opening chat' });
  }
  const messages = await Message.find({ match: match._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('sender', 'name');
  res.json(messages.reverse());
};

export const sendMessage = async (req, res) => {
  const match = await findOwnedMatch(req.params.matchId, req.user.id);
  if (!match) return res.status(404).json({ msg: 'Match not found' });
  const battle = await MemeBattle.findOne({ match: match._id });
  if (battle && !['skipped', 'chat_open'].includes(battle.status)) {
    return res.status(403).json({ msg: 'Complete the meme battle and both choose chat before opening chat' });
  }
  if (typeof req.body.text !== 'string' || !req.body.text.trim() || req.body.text.trim().length > 1000) {
    return res.status(400).json({ msg: 'Message must be between 1 and 1000 characters' });
  }
  const message = await Message.create({
    match: match._id,
    sender: req.user.id,
    text: req.body.text.trim(),
  });
  await message.populate('sender', 'name');
  res.status(201).json(message);
};
