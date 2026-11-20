import express from 'express';
import {
  discoverProfiles,
  getMatches,
  getMessages,
  getProfile,
  saveProfilePhoto,
  sendMessage,
  swipeProfile,
  unmatchProfile,
  updateProfile,
} from '../controllers/datingController.js';
import {
  getDailyBattle,
  getHumorDna,
  submitCaption,
  voteForCaption,
} from '../controllers/memeController.js';
import {
  acceptMemeBattle,
  decideMemeBattle,
  getMemeBattle,
  laughAtMemeBattleAnswer,
  skipMemeBattle,
  submitMemeBattleAnswer,
} from '../controllers/memeBattleController.js';
import { getMemeSwipeFeed, recordMemeSwipe } from '../controllers/memeSwipeController.js';
import { getWeeklyRedditMemes } from '../controllers/memeAssetController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadProfilePhoto } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);
router.route('/profile').get(getProfile).put(updateProfile);
router.post('/profile/photo', uploadProfilePhoto, saveProfilePhoto);
router.get('/discover', discoverProfiles);
router.post('/swipes', swipeProfile);
router.get('/matches', getMatches);
router.delete('/matches/:matchId', unmatchProfile);
router.route('/matches/:matchId/messages').get(getMessages).post(sendMessage);
router.get('/memes/battle', getDailyBattle);
router.post('/memes/captions', submitCaption);
router.post('/memes/captions/:captionId/vote', voteForCaption);
router.get('/memes/dna', getHumorDna);
router.get('/memes/feed', getMemeSwipeFeed);
router.post('/memes/swipes', recordMemeSwipe);
router.get('/memes/reddit', getWeeklyRedditMemes);
router.get('/matches/:matchId/battle', getMemeBattle);
router.post('/matches/:matchId/battle/accept', acceptMemeBattle);
router.post('/matches/:matchId/battle/skip', skipMemeBattle);
router.post('/matches/:matchId/battle/rounds/:roundIndex/answers', submitMemeBattleAnswer);
router.post('/matches/:matchId/battle/rounds/:roundIndex/laugh', laughAtMemeBattleAnswer);
router.post('/matches/:matchId/battle/decision', decideMemeBattle);

export default router;
