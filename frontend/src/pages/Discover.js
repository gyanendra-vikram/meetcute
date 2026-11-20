import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';

const fallbackPhotos = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=85',
];

export default function Discover() {
  const [profiles, setProfiles] = useState([]);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [needsMemeSwipes, setNeedsMemeSwipes] = useState(false);
  const [waitingForMemeUsers, setWaitingForMemeUsers] = useState(false);
  const [memeFeed, setMemeFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      const { data } = await API.get('/dating/discover');
      setNeedsProfile(data.needsProfile);
      setNeedsMemeSwipes(Boolean(data.needsMemeSwipes));
      setWaitingForMemeUsers(Boolean(data.waitingForMemeUsers));
      if (data.needsProfile) {
        setProfiles([]);
        setMemeFeed(null);
      } else if (data.needsMemeSwipes) {
        const { data: feed } = await API.get('/dating/memes/feed');
        setProfiles([]);
        setMemeFeed(feed);
      } else {
        setProfiles(data.profiles);
        setMemeFeed(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const refreshProfiles = useCallback(async () => {
    setLoading(true);
    await loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    let lastRefresh = 0;
    const refreshWhenVisible = () => {
      if (submitting || document.visibilityState !== 'visible' || Date.now() - lastRefresh < 1000) return;
      lastRefresh = Date.now();
      refreshProfiles();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshProfiles, submitting]);

  const handleSwipe = async (action) => {
    const profile = profiles[0];
    if (!profile || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await API.post('/dating/swipes', {
        targetUserId: profile._id,
        action,
      });
      if (data.matched) toast.success(`It's a match with ${profile.name}! Your meme battle is waiting in Battles.`);
      setLoading(true);
      await loadProfiles();
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not save your choice');
      await loadProfiles();
    } finally {
      setSubmitting(false);
    }
  };

  const handleMemeSwipe = async (action) => {
    if (!memeFeed?.card || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await API.post('/dating/memes/swipes', {
        memeId: memeFeed.card.id,
        action,
      });
      if (data.complete) {
        setMemeFeed(null);
        setNeedsMemeSwipes(false);
        setLoading(true);
        toast.success('Your next profile suggestion is ready!');
        await loadProfiles();
      } else {
        setMemeFeed(data);
      }
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not save your meme choice');
      await loadProfiles();
    } finally {
      setSubmitting(false);
    }
  };

  const profile = profiles[0];
  const showingMemeFeed = Boolean(memeFeed && !memeFeed.complete);

  return (
    <main className="dating-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h1>{needsMemeSwipes ? <>Find your <span>humor.</span></> : <>Meet someone <span>real.</span></>}</h1>
          <p className="muted">{needsMemeSwipes
            ? 'Swipe five meme cards to unlock a profile suggestion. If someone likes you first, you can respond sooner.'
            : 'Thoughtful connections start with a hello.'}</p>
        </div>
        <div className="discover-links">
          <Link className="text-link" to="/battles">See your battles <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      {loading ? (
        <div className="empty-state"><span className="loading-dot" /> Finding people for you…</div>
      ) : needsProfile ? (
        <section className="empty-state">
          <span className="empty-icon" aria-hidden="true">♡</span>
          <h2>First, tell people about you</h2>
          <p>Add a photo and a few details to start meeting people.</p>
          <Link className="button button-primary" to="/profile">Build your profile</Link>
        </section>
      ) : showingMemeFeed ? (
        <section className="meme-discovery">
          <div className="meme-progress">
            <span className="eyebrow">YOUR NEXT PROFILE SUGGESTION</span>
            <strong>{memeFeed.swipesCompleted}/{memeFeed.swipesRequired}</strong>
          </div>
          {waitingForMemeUsers && (
            <div className="meme-waiting-message">
              <strong>No eligible profile is available right now.</strong>
              <p>We’ll suggest someone when a complete profile matches your preferences.</p>
            </div>
          )}
          <article className="meme-deck-card">
            <div className={`meme-deck-art ${memeFeed.card.embedUrl ? 'meme-deck-art-reddit' : ''}`}>
              {memeFeed.card.embedUrl ? (
                <iframe
                  className="reddit-post-embed"
                  src={memeFeed.card.embedUrl}
                  title={`${memeFeed.card.title} from Reddit`}
                  loading="eager"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : memeFeed.card.imageUrl ? (
                <img className="meme-deck-image" src={memeFeed.card.imageUrl} alt={memeFeed.card.title} />
              ) : (
                <span className="meme-deck-emoji" aria-hidden="true">{memeFeed.card.emoji}</span>
              )}
              {!memeFeed.card.embedUrl && (
                <span className="meme-deck-category">{memeFeed.card.category}</span>
              )}
              {!memeFeed.card.embedUrl && memeFeed.card.isNsfw && (
                <span className="meme-deck-nsfw">NSFW</span>
              )}
            </div>
            {!memeFeed.card.embedUrl && (
              <div className="meme-deck-copy">
                <h2>{memeFeed.card.title}</h2>
                <p>{memeFeed.card.setup}</p>
                <p className="meme-deck-twist">{memeFeed.card.twist}</p>
                {memeFeed.card.sourceUrl && (
                  <a className="meme-source-link" href={memeFeed.card.sourceUrl} target="_blank" rel="noreferrer">
                    Open original Reddit post <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            )}
          </article>
          <div className="meme-deck-actions">
            <button
              className="swipe-button pass-button"
              onClick={() => handleMemeSwipe('pass')}
              disabled={submitting}
              aria-label="Not my humor"
            >
              <span aria-hidden="true">×</span>
            </button>
            <span>Not my humor</span>
            <button
              className="swipe-button like-button"
              onClick={() => handleMemeSwipe('like')}
              disabled={submitting}
              aria-label="I like this meme"
            >
              <span aria-hidden="true">♥</span>
            </button>
            <span>That’s me</span>
          </div>
          <p className="meme-deck-note">
            Meme cards and Reddit picks · {memeFeed.swipesRemaining} more until your suggestion · {memeFeed.cardsRemaining} until refresh
          </p>
        </section>
      ) : profile ? (
        <section className="discovery-layout">
          <article className="profile-card">
            <div className="profile-photo-wrap">
              <img
                className="profile-photo"
                src={profile.photoUrl || fallbackPhotos[profiles.length % fallbackPhotos.length]}
                alt={`${profile.name}'s profile`}
              />
              <div className="photo-shade" />
              <div className="profile-photo-caption">
                <h2>{profile.name}, {profile.age}</h2>
                {profile.location && <p><span aria-hidden="true">⌖</span> {profile.location}</p>}
              </div>
              <span className="profile-count">{profiles.length} nearby</span>
            </div>
            <div className="profile-details">
              {profile.likedYou && (
                <p className="humor-compatibility">They liked your profile — like back to match.</p>
              )}
              <p>{profile.bio || 'Still writing their story. Say hello and start the conversation.'}</p>
              {profile.interests?.length > 0 && (
                <div className="interest-list">
                  {profile.interests.map((interest) => <span className="interest-chip" key={interest}>{interest}</span>)}
                </div>
              )}
              {typeof profile.humorCompatibility === 'number' && (
                <p className="humor-compatibility">
                  <span aria-hidden="true">✦</span> {profile.humorCompatibility}% humor match
                  <small>{profile.sharedMemeCount}/{profile.comparedMemeCount} shared choices</small>
                </p>
              )}
              {profile.memeSwiping ? (
                <p className="humor-compatibility">Also swiping memes</p>
              ) : (
                <p className="humor-compatibility humor-compatibility-new">New to meme matching</p>
              )}
            </div>
          </article>
          <div className="swipe-actions" aria-label="Choose whether to like this profile">
            <button className="swipe-button pass-button" onClick={() => handleSwipe('pass')} disabled={submitting} aria-label="Pass">
              <span aria-hidden="true">×</span>
            </button>
            <span>Pass</span>
            <button className="swipe-button like-button" onClick={() => handleSwipe('like')} disabled={submitting} aria-label="Like">
              <span aria-hidden="true">♥</span>
            </button>
            <span>Like</span>
          </div>
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-icon" aria-hidden="true">✦</span>
          <h2>You’re all caught up</h2>
          <p>Check back soon for more people who fit your preferences. Unmatched profiles can reappear when you refresh.</p>
          <button className="button button-secondary" onClick={refreshProfiles} type="button">Refresh people</button>
          <Link className="button button-secondary" to="/profile">Update your profile</Link>
        </section>
      )}

    </main>
  );
}
