import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';

const humorStyles = [
  { value: 'wholesome', label: 'Wholesome', emoji: '🌱' },
  { value: 'dry', label: 'Dry wit', emoji: '🫠' },
  { value: 'chaotic', label: 'Chaotic', emoji: '🌀' },
  { value: 'dark', label: 'Dark humor', emoji: '🌚' },
  { value: 'niche', label: 'Niche internet', emoji: '🧠' },
];

export default function MemeHub() {
  const [battle, setBattle] = useState(null);
  const [dna, setDna] = useState(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('wholesome');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [votingFor, setVotingFor] = useState('');

  const loadBattle = useCallback(async () => {
    try {
      const [battleResponse, dnaResponse] = await Promise.all([
        API.get('/dating/memes/battle'),
        API.get('/dating/memes/dna'),
      ]);
      setBattle(battleResponse.data);
      setDna(dnaResponse.data);
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not load today’s meme battle');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBattle();
  }, [loadBattle]);

  const submitCaption = async (event) => {
    event.preventDefault();
    if (!caption.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await API.post('/dating/memes/captions', { caption, category });
      setBattle((current) => ({
        ...current,
        ownCaption: data,
        captions: [data, ...current.captions.filter((entry) => entry._id !== data._id)],
      }));
      setCaption('');
      toast.success('Your caption is in the battle!');
      const { data: updatedDna } = await API.get('/dating/memes/dna');
      setDna(updatedDna);
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not submit your caption');
    } finally {
      setSubmitting(false);
    }
  };

  const applaud = async (entry) => {
    if (votingFor) return;
    setVotingFor(entry._id);
    try {
      const { data } = await API.post(`/dating/memes/captions/${entry._id}/vote`);
      setBattle((current) => ({
        ...current,
        captions: current.captions.map((item) => item._id === data._id
          ? { ...item, voteCount: data.voteCount, votedByMe: data.votedByMe }
          : item),
      }));
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not applaud this caption');
    } finally {
      setVotingFor('');
    }
  };

  const shareDna = async () => {
    const text = `My Humor DNA is ${dna.topStyle || 'still a mystery'} — ${dna.totalApplause} applause on Meet Cute.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Humor DNA', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Your Humor DNA is copied and ready to share');
      }
    } catch (error) {
      if (error.name !== 'AbortError') toast.error('Could not share your Humor DNA');
    }
  };

  if (loading) {
    return <main className="dating-page"><div className="empty-state">Loading today’s battle…</div></main>;
  }

  return (
    <main className="dating-page meme-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR DAILY DOSE OF INTERNET</p>
          <h1>Make us <span>laugh.</span></h1>
          <p className="muted">No matches needed. Just good jokes and better banter.</p>
        </div>
        <Link className="text-link" to="/discover">Back to discovering <span aria-hidden="true">→</span></Link>
      </header>

      <div className="meme-hub-grid">
        <section className="battle-column">
          <article className="battle-card">
            <div className="battle-card-heading">
              <div><p className="eyebrow">TODAY’S CAPTION BATTLE</p><h2>Finish this meme</h2></div>
              <span className="battle-date">{battle?.dateKey}</span>
            </div>
            <div className="meme-template" aria-label={`${battle?.prompt.setup} ${battle?.prompt.twist}`}>
              <div className="meme-panel meme-panel-first"><span>THE SETUP</span><p>{battle?.prompt.setup}</p></div>
              <div className="meme-panel meme-panel-second"><span>THE PLOT TWIST</span><p>{battle?.prompt.twist}</p></div>
            </div>
            {battle?.ownCaption ? (
              <div className="submitted-caption">
                <span className="caption-check" aria-hidden="true">✓</span>
                <div><strong>You’re in today’s battle</strong><p>“{battle.ownCaption.caption}”</p></div>
                <span className="caption-score">♥ {battle.ownCaption.voteCount}</span>
              </div>
            ) : (
              <form className="caption-form" onSubmit={submitCaption}>
                <label className="form-field" htmlFor="daily-caption">Your one-liner</label>
                <textarea
                  id="daily-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={180}
                  rows={3}
                  placeholder="Make it yours. Keep it kind."
                  required
                />
                <div className="caption-form-footer">
                  <span>{caption.length}/180</span>
                  <button className="button button-primary" type="submit" disabled={!caption.trim() || submitting}>
                    {submitting ? 'Entering…' : 'Enter the battle'}
                  </button>
                </div>
                <fieldset className="form-field humor-style-field">
                  <legend>Your humor style</legend>
                  <div className="humor-style-options">
                    {humorStyles.map((style) => (
                      <label className={`humor-style-option ${category === style.value ? 'humor-style-selected' : ''}`} key={style.value}>
                        <input
                          type="radio"
                          name="humor-style"
                          value={style.value}
                          checked={category === style.value}
                          onChange={() => setCategory(style.value)}
                        />
                        <span aria-hidden="true">{style.emoji}</span>{style.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </form>
            )}
          </article>

          <section className="caption-leaderboard">
            <div className="section-title"><div><p className="eyebrow">THE CROWD HAS SPOKEN</p><h2>Today’s captions</h2></div><span>{battle?.captions.length || 0}</span></div>
            {battle?.captions.length ? (
              <ol className="caption-list">
                {battle.captions.map((entry, index) => (
                  <li className="caption-entry" key={entry._id}>
                    <span className="caption-rank">{index + 1}</span>
                    <div className="caption-entry-copy">
                      <p>“{entry.caption}”</p>
                      <small>{entry.isMine ? 'You' : entry.authorName} · {entry.categoryLabel}</small>
                    </div>
                    <button
                      className={`applause-button ${entry.votedByMe ? 'applause-given' : ''}`}
                      onClick={() => applaud(entry)}
                      disabled={entry.isMine || entry.votedByMe || votingFor === entry._id}
                      aria-label={entry.votedByMe ? `Applauded, ${entry.voteCount} votes` : `Applaud caption by ${entry.authorName}`}
                    >
                      ♥ <span>{entry.voteCount}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="battle-empty"><span aria-hidden="true">✦</span><p>First caption gets the spotlight. Break the ice with a joke.</p></div>
            )}
          </section>
        </section>

        <aside className="humor-dna-card">
          <div className="dna-orbit" aria-hidden="true"><span>✦</span><span>♥</span><span>✦</span></div>
          <p className="eyebrow">YOUR HUMOR DNA</p>
          <h2>{dna?.topStyle || 'A blank canvas'}</h2>
          <p className="dna-description">{dna?.topStyle
            ? 'The community is getting to know your sense of humor.'
            : 'Drop a caption and see what your humor says about you.'}</p>
          <div className="dna-stats">
            <div><strong>{dna?.totalApplause || 0}</strong><span>applause</span></div>
            <div><strong>{dna?.captions || 0}</strong><span>captions</span></div>
          </div>
          {dna?.styles?.length > 0 && (
            <div className="dna-style-list">
              {dna.styles.map((style) => (
                <div className="dna-style-row" key={style.name}>
                  <span>{style.name}</span><strong>{style.applause}</strong>
                </div>
              ))}
            </div>
          )}
          <button className="button button-secondary dna-share" onClick={shareDna}>Share your Humor DNA</button>
        </aside>
      </div>
    </main>
  );
}
