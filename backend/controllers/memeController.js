import mongoose from 'mongoose';
import CaptionEntry from '../models/CaptionEntry.js';

const styles = {
  wholesome: 'Wholesome',
  dry: 'Dry wit',
  chaotic: 'Chaotic',
  dark: 'Dark humor',
  niche: 'Niche internet',
};

const prompts = [
  {
    setup: 'Me: I’ll go to bed right after this video.',
    twist: 'The next video starts playing at 2:47 a.m.',
  },
  {
    setup: 'Me: I’m going to have a productive day.',
    twist: 'My to-do list has one item: make a to-do list.',
  },
  {
    setup: 'The group chat: “We should plan something soon!”',
    twist: 'Three months later, everyone is still reacting with 👀.',
  },
  {
    setup: 'Me opening the fridge for the fifth time.',
    twist: 'The snacks have not updated since the last refresh.',
  },
  {
    setup: 'Me: “I’m just going to quickly check my email.”',
    twist: 'The inbox has entered the chat.',
  },
  {
    setup: 'When you finally sit down after a long day.',
    twist: 'Your brain remembers one awkward thing from 2014.',
  },
  {
    setup: 'Me trying to leave the house on time.',
    twist: 'The keys were in my hand the whole time.',
  },
];

const currentDateKey = () => new Date().toISOString().slice(0, 10);

const getDailyPrompt = (dateKey) => {
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  return prompts[((dayNumber % prompts.length) + prompts.length) % prompts.length];
};

const formatEntry = (entry, viewerId) => ({
  _id: entry._id,
  caption: entry.caption,
  category: entry.category,
  categoryLabel: styles[entry.category],
  voteCount: entry.voteCount ?? entry.votes.length,
  votedByMe: entry.votedByMe ?? entry.votes.some((voter) => voter.toString() === viewerId),
  isMine: (entry.authorId || entry.author._id).toString() === viewerId,
  authorName: entry.authorName || entry.author.name,
});

export const getDailyBattle = async (req, res) => {
  const dateKey = currentDateKey();
  const viewerId = req.user.id;
  const [entries, ownEntry] = await Promise.all([
    CaptionEntry.aggregate([
      { $match: { dateKey } },
      {
        $addFields: {
          voteCount: { $size: '$votes' },
          votedByMe: { $in: [new mongoose.Types.ObjectId(viewerId), '$votes'] },
        },
      },
      { $sort: { voteCount: -1, createdAt: 1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorDoc',
        },
      },
      { $unwind: '$authorDoc' },
      {
        $project: {
          _id: 1,
          caption: 1,
          category: 1,
          voteCount: 1,
          votedByMe: 1,
          authorId: '$authorDoc._id',
          authorName: '$authorDoc.name',
        },
      },
    ]),
    CaptionEntry.findOne({ dateKey, author: viewerId }).populate('author', 'name'),
  ]);
  const rankedEntries = entries.map((entry) => formatEntry(entry, viewerId));
  const ownCaption = ownEntry ? formatEntry(ownEntry, viewerId) : null;
  if (ownCaption && !rankedEntries.some((entry) => entry._id.toString() === ownCaption._id.toString())) {
    rankedEntries.push(ownCaption);
  }

  res.json({
    dateKey,
    prompt: getDailyPrompt(dateKey),
    ownCaption,
    captions: rankedEntries,
  });
};

export const submitCaption = async (req, res) => {
  const { caption, category } = req.body;
  if (typeof caption !== 'string' || !caption.trim() || caption.trim().length > 180) {
    return res.status(400).json({ msg: 'Caption must be between 1 and 180 characters' });
  }
  if (!Object.prototype.hasOwnProperty.call(styles, category)) {
    return res.status(400).json({ msg: 'Choose a valid humor style' });
  }

  try {
    const entry = await CaptionEntry.create({
      author: req.user.id,
      dateKey: currentDateKey(),
      caption: caption.trim(),
      category,
    });
    await entry.populate('author', 'name');
    res.status(201).json(formatEntry(entry, req.user.id));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ msg: 'You already entered today’s caption battle' });
    }
    throw error;
  }
};

export const voteForCaption = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.captionId)) {
    return res.status(404).json({ msg: 'Caption not found' });
  }

  const dateKey = currentDateKey();
  const entry = await CaptionEntry.findOne({
    _id: req.params.captionId,
    dateKey,
  });
  if (!entry) return res.status(404).json({ msg: 'Caption not found' });
  if (entry.author.toString() === req.user.id) {
    return res.status(400).json({ msg: 'You cannot applaud your own caption' });
  }

  const updatedEntry = await CaptionEntry.findOneAndUpdate(
    { _id: entry._id, dateKey },
    { $addToSet: { votes: req.user.id } },
    { new: true },
  );
  if (!updatedEntry) return res.status(404).json({ msg: 'Caption not found' });
  res.json({
    _id: updatedEntry._id,
    voteCount: updatedEntry.votes.length,
    votedByMe: true,
  });
};

export const getHumorDna = async (req, res) => {
  const results = await CaptionEntry.aggregate([
    { $match: { author: new mongoose.Types.ObjectId(req.user.id) } },
    {
      $group: {
        _id: '$category',
        applause: { $sum: { $size: '$votes' } },
        captions: { $sum: 1 },
      },
    },
    { $sort: { applause: -1, captions: -1 } },
  ]);

  const totalApplause = results.reduce((total, style) => total + style.applause, 0);
  res.json({
    topStyle: results[0] ? styles[results[0]._id] : null,
    totalApplause,
    captions: results.reduce((total, style) => total + style.captions, 0),
    styles: results.map((style) => ({
      name: styles[style._id],
      applause: style.applause,
    })),
  });
};
