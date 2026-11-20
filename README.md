# BattleMeet (MERN Stack)

## Tech Stack
- React (Frontend)
- Node.js + Express + MongoDB (Backend)

## Dating features
- Email-verified signup and login, reusing the existing account system.
- Dating profiles with an 18+ birthday check, bio, photo URL, location, interests, and preferences.
- Profile photos uploaded to Cloudinary.
- Profile discovery, like/pass choices, and mutual-like matching.
- Meme-first discovery: every five meme swipes unlocks one profile suggestion, prioritizing people who have also swiped memes; incoming likes are surfaced immediately so the recipient can respond without another batch. The original app-owned deck reshuffles and recycles when exhausted.
- Basic text conversations for matches.
- A daily caption battle with one entry per user, community applause, and a shareable Humor DNA summary.
- A five-round, 60-second-per-round banter battle after a new mutual match; both people must join, then both choose chat after seeing the result. The answers remain available as chat icebreakers.
- A dedicated Battles section lists every match battle; active rounds are played there, while approved battles link to the separate chat view.
- Unmatching removes the connection, battle, chat, and both users’ likes; when both users have completed a meme batch, it re-queues each profile for the other.
- Rights-gated meme library: weekly Reddit image links are categorized without being copied; an admin must confirm republication rights before any image is uploaded to Cloudinary and approved.
- Discover includes categorized weekly Reddit source cards in the meme swipe deck without requiring admin access. Cards link to the original post; Reddit media is not copied. NSFW cards are excluded by default and only returned for verified adults who enable the preference in their profile.
- `/admin/memes` reviews and tags rights-cleared submissions before they join the discovery deck.

## Getting Started

## 🛠 Environment Setup

### Backend `.env` Configuration

Create a `.env` file inside the `backend/` folder with the following keys:

MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000

FRONTEND_URL=http://localhost:3000
EMAIL_HOST=your_smtp_host
EMAIL_USER=your_smtp_username
EMAIL_PASS=your_smtp_password
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
MEME_ADMIN_EMAILS=admin@example.com
REDDIT_USER_AGENT=BattleMeetMemeQueue/1.0 (contact: admin@example.com)
REDDIT_MEME_SUBREDDITS=wholesomememes,ProgrammerHumor,IndianDankMemes
REDDIT_REFRESH_CRON=0 3 * * *


### Backend Setup
```bash
cd backend
npm install
npm run dev
```

The backend runs at `http://localhost:5000`.
Reddit ingestion fetches each configured subreddit’s top posts for the day, seeds the queue when the backend starts if safe Reddit memes are older than 24 hours, and refreshes every day at 03:00 UTC by default. Set `REDDIT_REFRESH_CRON` to change the schedule. If Reddit returns 403, ingestion falls back to subreddit samples from meme-api.com. Admins can also refresh the queue from `/admin/memes` or run `npm run ingest:reddit-memes`. Reddit images remain external links until an admin confirms permission to republish them. Upload only memes that you own or are licensed to use.
`MEME_ADMIN_EMAILS` is only needed for meme review and Cloudinary publishing; it is not required to view categorized Reddit links in Discover.

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The frontend runs at `http://localhost:3000`.
