import cron from 'node-cron';
import MemeAsset from '../models/MemeAsset.js';

const DEFAULT_SUBREDDITS = ['wholesomememes', 'ProgrammerHumor', 'IndianDankMemes'];
const ALLOWED_IMAGE_HOSTS = new Set(['i.redd.it', 'preview.redd.it', 'i.imgur.com']);
const SUBREDDIT_TAGS = {
  wholesomememes: ['wholesome'],
  programmerhumor: ['tech', 'sarcasm'],
  indiandankmemes: ['desi'],
  dankinindia: ['desi'],
  indianmeymeytemplates: ['desi'],
};
const SUBREDDIT_ALIASES = {
  indianmeymeytemplates: 'IndianDankMemes',
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getImageUrl = (post) => {
  const url = post.url_overridden_by_dest || post.url;
  if (!url) return '';
  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_IMAGE_HOSTS.has(parsedUrl.hostname.toLowerCase())) return '';
    if (!/\.(jpe?g|png|webp|gif)$/i.test(parsedUrl.pathname)) return '';
    return parsedUrl.toString();
  } catch {
    return '';
  }
};

const getSourceUrl = (post) => {
  const sourceUrl = post.postLink
    || (post.permalink ? `https://www.reddit.com${post.permalink}` : '');
  if (!sourceUrl) return '';
  try {
    const parsedUrl = new URL(sourceUrl);
    if (!['reddit.com', 'www.reddit.com', 'redd.it'].includes(parsedUrl.hostname.toLowerCase())) return '';
    return parsedUrl.toString();
  } catch {
    return '';
  }
};

const getPostId = (post) => {
  if (post.id) return post.id;
  try {
    return new URL(post.postLink).pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
};

const configuredSubreddits = () => {
  const value = process.env.REDDIT_MEME_SUBREDDITS;
  const subreddits = (value ? value.split(',') : DEFAULT_SUBREDDITS)
    .map((name) => name.trim())
    .filter((name) => /^[A-Za-z0-9_]{2,21}$/.test(name));
  return [...new Set(subreddits.map((name) => SUBREDDIT_ALIASES[name.toLowerCase()] || name))];
};

const fetchMemeApiPosts = async (subreddit) => {
  const response = await fetch(`https://meme-api.com/gimme/${subreddit}/25`, {
    headers: { 'User-Agent': process.env.REDDIT_USER_AGENT || 'BattleMeetMemeQueue/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Meme API returned ${response.status}`);
  const data = await response.json();
  const memes = Array.isArray(data.memes) ? data.memes : data.postLink ? [data] : [];
  return memes.map((meme) => ({
    id: getPostId(meme),
    postLink: meme.postLink,
    title: meme.title,
    subreddit: meme.subreddit || subreddit,
    author: meme.author,
    over_18: meme.nsfw,
    spoiler: meme.spoiler,
    is_video: false,
    url: meme.url,
  }));
};

const fetchWeeklyPosts = async (subreddit, userAgent) => {
  const endpoint = new URL(`https://www.reddit.com/r/${subreddit}/top.json`);
  endpoint.searchParams.set('t', 'week');
  endpoint.searchParams.set('limit', '100');
  try {
    const response = await fetch(endpoint, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) {
      console.warn(`Reddit subreddit not found: r/${subreddit}`);
      return [];
    }
    if (response.ok) {
      const data = await response.json();
      return (data?.data?.children || []).map((child) => child.data);
    }
    console.warn(`Reddit returned ${response.status} for r/${subreddit}; trying meme-api.com`);
  } catch (error) {
    console.warn(`Reddit request failed for r/${subreddit}: ${error.message}; trying meme-api.com`);
  }
  return fetchMemeApiPosts(subreddit);
};

export const runRedditMemeIngestion = async () => {
  let inserted = 0;
  let skipped = 0;
  const failed = [];
  const userAgent = process.env.REDDIT_USER_AGENT || 'BattleMeetMemeQueue/1.0';

  for (const subreddit of configuredSubreddits()) {
    try {
      const posts = await fetchWeeklyPosts(subreddit, userAgent);
      for (const post of posts) {
        const postId = post ? getPostId(post) : '';
        const imageUrl = post ? getImageUrl(post) : '';
        const sourceUrl = post ? getSourceUrl(post) : '';
        if (!postId || !sourceUrl || post.spoiler || post.is_video || !imageUrl) {
          skipped += 1;
          continue;
        }

        const sourcePostId = `${subreddit}:${postId}`;
        const tags = SUBREDDIT_TAGS[subreddit.toLowerCase()] || [];
        const result = await MemeAsset.updateOne(
          { sourcePostId },
          {
            $set: {
              title: String(post.title || 'Untitled Reddit meme').slice(0, 160),
              sourceUrl,
              sourceImageUrl: imageUrl,
              sourceAuthor: String(post.author || '').slice(0, 80),
              subreddit,
              tags,
              isNsfw: Boolean(post.over_18),
              lastSeenAt: new Date(),
            },
            $setOnInsert: {
              source: 'reddit',
              sourcePostId,
              status: 'pending',
              isModeratedApproved: false,
              isTemplate: false,
              rightsConfirmed: false,
            },
          },
          { upsert: true },
        );
        if (result.upsertedCount) inserted += 1;
      }
    } catch (error) {
      failed.push(subreddit);
      console.error(`Meme ingestion failed for r/${subreddit}: ${error.message}`);
    }

    await wait(1000);
  }

  return { inserted, skipped, failed };
};

const refreshRedditQueue = async ({ onlyIfEmpty = false } = {}) => {
  try {
    if (onlyIfEmpty) {
      const recentMeme = await MemeAsset.exists({
        source: 'reddit',
        status: { $ne: 'rejected' },
        isNsfw: { $ne: true },
        lastSeenAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });
      if (recentMeme) return;
    }

    const result = await runRedditMemeIngestion();
    console.info('Reddit meme queue refreshed:', result);
  } catch (error) {
    console.error('Reddit meme ingestion failed:', error.message);
  }
};

export const startRedditMemeIngestion = () => {
  void refreshRedditQueue({ onlyIfEmpty: true });
  return cron.schedule(
    '0 3 * * 1',
    () => refreshRedditQueue(),
    { timezone: 'UTC' },
  );
};
