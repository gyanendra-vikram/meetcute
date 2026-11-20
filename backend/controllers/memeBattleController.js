import mongoose from 'mongoose';
import Match from '../models/Match.js';
import MemeBattle from '../models/MemeBattle.js';

const ROUND_SECONDS = 60;

const startRound = (round, startedAt) => {
  round.startedAt = startedAt;
  round.endsAt = new Date(startedAt.getTime() + ROUND_SECONDS * 1000);
};

const participantsFor = (battle, userId) => {
  const viewerId = userId.toString();
  return {
    viewerId,
    partnerId: battle.users.find((id) => id.toString() !== viewerId)?.toString(),
  };
};

export const toPublicBattle = (battle, userId) => {
  const { viewerId, partnerId } = participantsFor(battle, userId);
  const rounds = battle.rounds.map((round, index) => {
    const ownResponse = round.responses.find((response) => response.user.toString() === viewerId);
    const partnerResponse = round.responses.find((response) => response.user.toString() === partnerId);
    const complete = round.resolved;
    const currentRoundIndex = battle.rounds.findIndex((item) => !item.resolved);

    return {
      index,
      id: round.id,
      emoji: round.emoji,
      title: round.title,
      category: round.category,
      prompt: round.prompt,
      answeredByMe: Boolean(ownResponse),
      complete,
      myAnswer: ownResponse?.text || null,
      partnerAnswer: complete ? partnerResponse?.text || null : null,
      timedOutByMe: round.timedOutBy.some((id) => id.toString() === viewerId),
      partnerTimedOut: round.timedOutBy.some((id) => id.toString() === partnerId),
      secondsRemaining: index === currentRoundIndex && round.endsAt
        ? Math.max(0, Math.ceil((round.endsAt.getTime() - Date.now()) / 1000))
        : null,
      laughedAtPartner: Boolean(partnerResponse?.laughedBy.some((id) => id.toString() === viewerId)),
    };
  });
  const myLaughs = battle.rounds.reduce((total, round) => total + Number(Boolean(
    round.responses
      .find((response) => response.user.toString() === viewerId)
      ?.laughedBy.some((id) => id.toString() === partnerId),
  )), 0);
  const partnerLaughs = battle.rounds.reduce((total, round) => total + Number(Boolean(
    round.responses
      .find((response) => response.user.toString() === partnerId)
      ?.laughedBy.some((id) => id.toString() === viewerId),
  )), 0);

  return {
    _id: battle._id,
    status: battle.status,
    expiresAt: battle.expiresAt,
    acceptedByMe: battle.acceptedBy.some((id) => id.toString() === viewerId),
    partnerAccepted: battle.acceptedBy.some((id) => id.toString() === partnerId),
    rounds,
    result: { myLaughs, partnerLaughs },
    myDecision: battle.chatDecisions.find((decision) => decision.user.toString() === viewerId)?.choice || null,
    partnerDecision: battle.chatDecisions.find((decision) => decision.user.toString() === partnerId)?.choice || null,
  };
};

const advanceExpiredRound = async (battle) => {
  const roundIndex = battle.rounds.findIndex((round) => !round.resolved);
  if (battle.status !== 'active' || roundIndex < 0) return battle;
  const round = battle.rounds[roundIndex];
  const now = new Date();
  if (!round.endsAt || round.endsAt > now) return battle;

  const timedOutUsers = battle.users.filter((userId) =>
    !round.responses.some((response) => response.user.equals(userId)));
  const nextRound = battle.rounds[roundIndex + 1];
  const update = {
    $set: {
      'rounds.$[current].resolved': true,
      'rounds.$[current].completedAt': now,
    },
  };
  if (timedOutUsers.length) {
    update.$addToSet = { 'rounds.$[current].timedOutBy': { $each: timedOutUsers } };
  }
  if (nextRound) {
    update.$set['rounds.$[next].startedAt'] = now;
    update.$set['rounds.$[next].endsAt'] = new Date(now.getTime() + ROUND_SECONDS * 1000);
  } else {
    update.$set.status = 'results';
  }

  const arrayFilters = [{ 'current.id': round.id, 'current.resolved': false }];
  if (nextRound) arrayFilters.push({ 'next.id': nextRound.id, 'next.resolved': false });
  await MemeBattle.updateOne(
    {
      _id: battle._id,
      status: 'active',
      rounds: { $elemMatch: { id: round.id, resolved: false, endsAt: { $lte: now } } },
    },
    update,
    { arrayFilters },
  );
  return MemeBattle.findById(battle._id);
};

export const ensureMemeBattle = async (match) => {
  try {
    return await MemeBattle.findOneAndUpdate(
      { match: match._id },
      {
        $setOnInsert: {
          match: match._id,
          users: match.users,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return MemeBattle.findOne({ match: match._id });
  }
};

const findOwnedBattle = async (matchId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(matchId)) return null;
  const match = await Match.findOne({ _id: matchId, users: userId }).select('_id');
  if (!match) return null;
  return MemeBattle.findOne({ match: match._id, users: userId });
};

export const getMemeBattle = async (req, res) => {
  let battle = await findOwnedBattle(req.params.matchId, req.user.id);
  if (!battle) return res.status(404).json({ msg: 'Meme battle not found' });
  if (battle.status === 'pending' && battle.expiresAt <= new Date()) {
    await MemeBattle.updateOne(
      { _id: battle._id, status: 'pending' },
      { $set: { status: 'ended' } },
    );
    battle = await MemeBattle.findById(battle._id);
  }
  battle = await advanceExpiredRound(battle);
  res.json(toPublicBattle(battle, req.user.id));
};

export const acceptMemeBattle = async (req, res) => {
  const battle = await findOwnedBattle(req.params.matchId, req.user.id);
  if (!battle) return res.status(404).json({ msg: 'Meme battle not found' });
  if (battle.status !== 'pending' || battle.expiresAt <= new Date()) {
    return res.status(409).json({ msg: 'This meme battle is no longer waiting for players' });
  }

  const updatedBattle = await MemeBattle.findOneAndUpdate(
    { _id: battle._id, status: 'pending' },
    { $addToSet: { acceptedBy: req.user.id } },
    { new: true },
  );
  if (!updatedBattle) return res.status(409).json({ msg: 'This meme battle is no longer available' });
  if (updatedBattle.users.every((id) => updatedBattle.acceptedBy.some((accepted) => accepted.equals(id)))) {
    const startedAt = new Date();
    const firstRound = updatedBattle.rounds[0];
    startRound(firstRound, startedAt);
    await MemeBattle.updateOne(
      { _id: updatedBattle._id, status: 'pending', acceptedBy: { $all: updatedBattle.users } },
      {
        $set: {
          status: 'active',
          'rounds.0.startedAt': firstRound.startedAt,
          'rounds.0.endsAt': firstRound.endsAt,
        },
      },
    );
  }
  const finalBattle = await MemeBattle.findById(updatedBattle._id);
  res.json(toPublicBattle(finalBattle, req.user.id));
};

export const skipMemeBattle = async (req, res) => {
  const battle = await findOwnedBattle(req.params.matchId, req.user.id);
  if (!battle) return res.status(404).json({ msg: 'Meme battle not found' });
  if (!['pending', 'active'].includes(battle.status)) {
    return res.status(409).json({ msg: 'This meme battle can no longer be skipped' });
  }
  const updated = await MemeBattle.findOneAndUpdate(
    { _id: battle._id, status: { $in: ['pending', 'active'] } },
    { $set: { status: 'ended' } },
    { new: true },
  );
  if (!updated) return res.status(409).json({ msg: 'This meme battle can no longer be skipped' });
  res.json(toPublicBattle(updated, req.user.id));
};

export const submitMemeBattleAnswer = async (req, res) => {
  const { roundIndex } = req.params;
  const index = Number(roundIndex);
  const text = req.body.text;
  if (!Number.isInteger(index) || index < 0 || index > 4) {
    return res.status(400).json({ msg: 'Choose a valid battle round' });
  }
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 180) {
    return res.status(400).json({ msg: 'Your answer must be between 1 and 180 characters' });
  }

  let battle = await findOwnedBattle(req.params.matchId, req.user.id);
  if (!battle) return res.status(404).json({ msg: 'Meme battle not found' });
  if (battle.status !== 'active') return res.status(409).json({ msg: 'This battle is not accepting answers' });
  battle = await advanceExpiredRound(battle);
  if (battle.status !== 'active') return res.status(409).json({ msg: 'The battle is complete' });
  const currentRoundIndex = battle.rounds.findIndex((round) => !round.resolved);
  if (index !== currentRoundIndex) {
    return res.status(409).json({ msg: 'Answer the current round first' });
  }
  const round = battle.rounds[currentRoundIndex];
  const now = new Date();
  if (!round.endsAt || round.endsAt <= now) {
    return res.status(409).json({ msg: 'Time is up for this round' });
  }
  if (round.responses.some((response) => response.user.equals(req.user.id))) {
    return res.status(409).json({ msg: 'You already answered this round' });
  }

  const updated = await MemeBattle.updateOne(
    {
      _id: battle._id,
      status: 'active',
      rounds: {
        $elemMatch: {
          id: round.id,
          resolved: false,
          endsAt: { $gt: now },
          responses: { $not: { $elemMatch: { user: req.user.id } } },
          timedOutBy: { $ne: req.user.id },
        },
      },
    },
    { $push: { 'rounds.$.responses': { user: req.user.id, text: text.trim() } } },
  );
  if (!updated.modifiedCount) return res.status(409).json({ msg: 'This round has already closed' });

  let updatedBattle = await MemeBattle.findById(battle._id);
  const updatedRound = updatedBattle.rounds[currentRoundIndex];
  if (updatedRound.responses.length === updatedBattle.users.length) {
    const completedAt = new Date();
    const nextRound = updatedBattle.rounds[currentRoundIndex + 1];
    const roundUpdate = {
      $set: {
        'rounds.$[current].resolved': true,
        'rounds.$[current].completedAt': completedAt,
      },
    };
    const arrayFilters = [{ 'current.id': round.id, 'current.resolved': false }];
    if (nextRound) {
      const nextEndsAt = new Date(completedAt.getTime() + ROUND_SECONDS * 1000);
      roundUpdate.$set['rounds.$[next].startedAt'] = completedAt;
      roundUpdate.$set['rounds.$[next].endsAt'] = nextEndsAt;
      arrayFilters.push({ 'next.id': nextRound.id, 'next.resolved': false });
    } else {
      roundUpdate.$set.status = 'results';
    }
    await MemeBattle.updateOne(
      {
        _id: battle._id,
        status: 'active',
        rounds: { $elemMatch: { id: round.id, resolved: false, responses: { $size: updatedBattle.users.length } } },
      },
      roundUpdate,
      { arrayFilters },
    );
    updatedBattle = await MemeBattle.findById(battle._id);
  }
  res.json(toPublicBattle(updatedBattle, req.user.id));
};

export const laughAtMemeBattleAnswer = async (req, res) => {
  const index = Number(req.params.roundIndex);
  if (!Number.isInteger(index) || index < 0 || index > 4) {
    return res.status(400).json({ msg: 'Choose a valid battle round' });
  }
  const battle = await findOwnedBattle(req.params.matchId, req.user.id);
  if (!battle) return res.status(404).json({ msg: 'Meme battle not found' });
  if (!['active', 'results'].includes(battle.status)) {
    return res.status(409).json({ msg: 'Reactions are not available for this battle' });
  }

  const round = battle.rounds[index];
  if (!round.resolved || round.responses.length !== 2) {
    return res.status(409).json({ msg: 'Wait until both answers are revealed' });
  }
  const partnerAnswer = round.responses.find((response) => !response.user.equals(req.user.id));
  if (!partnerAnswer) return res.status(409).json({ msg: 'Your partner has not answered this round yet' });
  if (partnerAnswer.laughedBy.some((id) => id.equals(req.user.id))) {
    return res.status(409).json({ msg: 'You already reacted to this answer' });
  }

  const updated = await MemeBattle.updateOne(
    { _id: battle._id, status: { $in: ['active', 'results'] } },
    {
      $addToSet: {
        'rounds.$[round].responses.$[answer].laughedBy': req.user.id,
      },
    },
    {
      arrayFilters: [
        { 'round.id': round.id },
        { 'answer.user': { $ne: req.user.id }, 'answer.laughedBy': { $ne: req.user.id } },
      ],
    },
  );
  if (!updated.modifiedCount) return res.status(409).json({ msg: 'You already reacted to this answer' });

  const updatedBattle = await MemeBattle.findById(battle._id);
  res.json(toPublicBattle(updatedBattle, req.user.id));
};

export const decideMemeBattle = async (req, res) => {
  const { choice } = req.body;
  if (!['chat', 'pass'].includes(choice)) {
    return res.status(400).json({ msg: 'Choose whether to chat or pass' });
  }
  const battle = await findOwnedBattle(req.params.matchId, req.user.id);
  if (!battle) return res.status(404).json({ msg: 'Meme battle not found' });
  if (battle.status !== 'results') return res.status(409).json({ msg: 'Finish the battle before deciding' });
  if (battle.chatDecisions.some((decision) => decision.user.equals(req.user.id))) {
    return res.status(409).json({ msg: 'You already made your decision' });
  }

  const updatedBattle = await MemeBattle.findOneAndUpdate(
    {
      _id: battle._id,
      status: 'results',
      chatDecisions: { $not: { $elemMatch: { user: req.user.id } } },
    },
    { $push: { chatDecisions: { user: req.user.id, choice } } },
    { new: true },
  );
  if (!updatedBattle) return res.status(409).json({ msg: 'You already made your decision' });

  if (choice === 'pass') {
    await MemeBattle.updateOne(
      { _id: battle._id, status: 'results' },
      { $set: { status: 'ended' } },
    );
  } else if (
    updatedBattle.chatDecisions.length === updatedBattle.users.length &&
    updatedBattle.chatDecisions.every((decision) => decision.choice === 'chat')
  ) {
    await MemeBattle.updateOne(
      { _id: battle._id, status: 'results' },
      { $set: { status: 'chat_open' } },
    );
  }
  const finalBattle = await MemeBattle.findById(battle._id);
  res.json(toPublicBattle(finalBattle, req.user.id));
};
