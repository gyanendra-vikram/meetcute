import { toast } from 'react-toastify';

const READ_MATCH_IDS_KEY = 'battlemeet.readBattleMatchIds';
export const MATCH_NOTIFICATION_EVENT = 'battlemeet:match-notification';
const notifiedMatchIds = new Set();

const getReadMatchIds = () => {
  const storedIds = localStorage.getItem(READ_MATCH_IDS_KEY);
  if (!storedIds) return new Set();

  try {
    const parsedIds = JSON.parse(storedIds);
    if (!Array.isArray(parsedIds)) throw new TypeError('Saved match notification state must be an array');
    return new Set(parsedIds.filter((id) => typeof id === 'string'));
  } catch (error) {
    console.error('Could not read saved match notification state:', error);
    localStorage.removeItem(READ_MATCH_IDS_KEY);
    return new Set();
  }
};

export function getUnreadMatchCount(matches) {
  const readMatchIds = getReadMatchIds();
  return matches.filter((match) => match?._id && !readMatchIds.has(String(match._id))).length;
}

export function markMatchesRead(matches) {
  const readMatchIds = getReadMatchIds();
  matches.forEach((match) => {
    if (match?._id) readMatchIds.add(String(match._id));
  });
  localStorage.setItem(READ_MATCH_IDS_KEY, JSON.stringify([...readMatchIds]));
}

export function clearReadMatches() {
  localStorage.removeItem(READ_MATCH_IDS_KEY);
}

export function notifyMatch(match) {
  const matchId = match?._id;
  const name = match?.profile?.name;
  if (!matchId || !name || notifiedMatchIds.has(String(matchId))) return;

  notifiedMatchIds.add(String(matchId));
  toast.success(`It's a match with ${name}! Your meme battle is waiting in Battles.`);
  window.dispatchEvent(new CustomEvent(MATCH_NOTIFICATION_EVENT, {
    detail: { matchId: String(matchId) },
  }));
}
