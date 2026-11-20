import mongoose from 'mongoose';
import memeBattlePrompts from '../data/memeBattlePrompts.js';

const responseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 180, trim: true },
  laughedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

const roundSchema = new mongoose.Schema({
  id: { type: String, required: true },
  emoji: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  prompt: { type: String, required: true },
  responses: { type: [responseSchema], default: [] },
  timedOutBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  resolved: { type: Boolean, default: false },
  startedAt: Date,
  endsAt: Date,
  completedAt: Date,
});

const decisionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  choice: { type: String, enum: ['chat', 'pass'], required: true },
});

const memeBattleSchema = new mongoose.Schema({
  match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, unique: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  acceptedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: {
    type: String,
    enum: ['pending', 'active', 'results', 'skipped', 'chat_open', 'ended'],
    default: 'pending',
  },
  rounds: {
    type: [roundSchema],
    default: () => memeBattlePrompts.map((prompt) => ({ ...prompt, responses: [] })),
  },
  chatDecisions: { type: [decisionSchema], default: [] },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('MemeBattle', memeBattleSchema);
