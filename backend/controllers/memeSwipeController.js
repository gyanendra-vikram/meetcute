import MemeSwipe from '../models/MemeSwipe.js';
import MemeProgress from '../models/MemeProgress.js';
import MemeAsset from '../models/MemeAsset.js';
import User from '../models/User.js';
import memeDeck, { MEME_SWIPES_REQUIRED } from '../data/memeDeck.js';

const parseMemeId = (memeId) => {
  const suffixIndex = memeId.lastIndexOf('@');
  if (suffixIndex < 0) return { cardId: memeId, cycle: 0 };
  const cycle = Number(memeId.slice(suffixIndex + 1));
  return Number.isInteger(cycle)
    ? { cardId: memeId.slice(0, suffixIndex), cycle }
    : { cardId: memeId, cycle: 0 };
};

const isAdult = (birthDate) => {
  if (!birthDate) return false;
  const date = new Date(birthDate);
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  if (
    today.getUTCMonth() < date.getUTCMonth()
    || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())
  ) {
    age -= 1;
  }
  return age >= 18;
};

const getSwipeProgress = async (userId) => {
  const [swipes, progress, user] = await Promise.all([
    MemeSwipe.find({ user: userId }).select('memeId').sort({ createdAt: 1, _id: 1 }),
    MemeProgress.ensureForUser(userId),
    User.findById(userId).select('profile.birthDate profile.allowNsfwMemes'),
  ]);
  const canSeeNsfw = user?.profile?.allowNsfwMemes === true && isAdult(user.profile.birthDate);
  const assetFilter = { status: 'approved', isModeratedApproved: true, isTemplate: false };
  if (!canSeeNsfw) assetFilter.isNsfw = { $ne: true };
  const redditFilter = {
    source: 'reddit',
    status: { $ne: 'rejected' },
    lastSeenAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  };
  if (!canSeeNsfw) redditFilter.isNsfw = { $ne: true };
  const [approvedMemes, redditMemes] = await Promise.all([
    MemeAsset.find(assetFilter)
      .select('title imageUrl tags captionTop captionBottom isNsfw')
      .sort({ createdAt: 1, _id: 1 })
      .limit(300),
    MemeAsset.find(redditFilter)
      .select('title sourceUrl sourcePostId sourceAuthor subreddit tags isNsfw')
      .sort({ lastSeenAt: -1 })
      .limit(100),
  ]);
  const communityCards = approvedMemes.map((meme) => ({
    id: `community-${meme._id}`,
    emoji: '',
    category: meme.tags[0] || 'community',
    title: meme.title,
    setup: meme.captionTop,
    twist: meme.captionBottom,
    imageUrl: meme.imageUrl,
    isNsfw: meme.isNsfw === true,
  }));
  const redditCards = redditMemes.map((meme) => ({
    id: `reddit-${meme._id}`,
    emoji: '↗',
    category: meme.tags[0] || 'reddit',
    title: meme.title,
    setup: `r/${meme.subreddit}${meme.sourceAuthor ? ` · u/${meme.sourceAuthor}` : ''}`,
    twist: 'Swipe based on your humor.',
    sourceUrl: meme.sourceUrl,
    embedUrl: (() => {
      const postId = String(meme.sourcePostId || '').split(':').slice(1).join(':');
      if (!/^[A-Za-z0-9]+$/.test(postId) || !/^[A-Za-z0-9_]{2,21}$/.test(meme.subreddit || '')) return '';
      return `https://embed.reddit.com/r/${encodeURIComponent(meme.subreddit)}/comments/${postId}/?ref_source=embed&ref=share&embed=true`;
    })(),
    isNsfw: meme.isNsfw === true,
  }));
  const deck = [...redditCards, ...memeDeck, ...communityCards];
  let cycle = progress.deckCycle || 0;
  const getCycleCards = (activeCycle) => {
    const swipedIds = new Set(swipes
      .map((swipe) => ({ ...parseMemeId(swipe.memeId), swipe }))
      .filter((entry) => entry.cycle === activeCycle)
      .map((entry) => entry.cardId));
    const offset = (activeCycle * 7) % deck.length;
    const cycleDeck = [...deck.slice(offset), ...deck.slice(0, offset)];
    return {
      swipedIds,
      nextCard: cycleDeck.find((meme) => !swipedIds.has(meme.id)) || null,
    };
  };

  let { swipedIds, nextCard } = getCycleCards(cycle);
  if (!nextCard) {
    cycle += 1;
    await MemeProgress.updateOne({ user: userId }, { $set: { deckCycle: cycle } });
    ({ swipedIds, nextCard } = getCycleCards(cycle));
  }

  const swipesCompleted = Math.max(0, swipes.length - progress.lastSuggestedAtSwipeCount);
  const card = nextCard
    ? { ...nextCard, id: cycle === 0 ? nextCard.id : `${nextCard.id}@${cycle}` }
    : null;

  return {
    card,
    swipesCompleted,
    swipesRequired: MEME_SWIPES_REQUIRED,
    swipesRemaining: Math.max(0, MEME_SWIPES_REQUIRED - swipesCompleted),
    deckTotal: deck.length,
    cardsRemaining: Math.max(0, deck.length - swipedIds.size),
    complete: swipesCompleted >= MEME_SWIPES_REQUIRED,
  };
};

export const getMemeSwipeFeed = async (req, res) => {
  res.json(await getSwipeProgress(req.user.id));
};

export const recordMemeSwipe = async (req, res) => {
  const { memeId, action } = req.body;
  if (typeof memeId !== 'string') return res.status(400).json({ msg: 'Choose a valid meme card' });
  if (!['like', 'pass'].includes(action)) {
    return res.status(400).json({ msg: 'Action must be like or pass' });
  }

  const progress = await getSwipeProgress(req.user.id);
  if (progress.complete) return res.status(409).json({ msg: 'Your next profile suggestion is ready' });
  if (!progress.card || progress.card.id !== memeId) {
    return res.status(409).json({ msg: 'This meme card is no longer current. Reload Discover and try again.' });
  }

  try {
    await MemeSwipe.create({
      user: req.user.id,
      memeId,
      category: progress.card.category,
      action,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return res.status(409).json({ msg: 'You already swiped this meme' });
  }

  res.status(201).json(await getSwipeProgress(req.user.id));
};
