import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import API from '../utils/api';

const tags = ['desi', 'tech', 'sarcasm', 'wholesome', 'dark'];

export default function AdminMemes() {
  const [pending, setPending] = useState([]);
  const [selectedTags, setSelectedTags] = useState({});
  const [rightsConfirmed, setRightsConfirmed] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');

  const loadPending = useCallback(async () => {
    try {
      const { data } = await API.get('/admin/memes');
      setPending(data);
      setSelectedTags((current) => Object.fromEntries(data.map((meme) => [
        meme._id,
        current[meme._id] || (meme.subreddit?.toLowerCase().includes('wholesome')
          ? ['wholesome']
          : meme.subreddit?.toLowerCase().includes('programmer')
            ? ['tech']
            : meme.subreddit?.toLowerCase().includes('indian')
              ? ['desi']
              : []),
      ])));
      setRightsConfirmed((current) => Object.fromEntries(data.map((meme) => [
        meme._id,
        current[meme._id] || false,
      ])));
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not load pending memes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const runIngestion = async () => {
    setWorking('ingest');
    try {
      const { data } = await API.post('/admin/memes/ingest');
      const failures = data.failed?.length || 0;
      const message = `Queue refreshed: ${data.inserted} new, ${data.skipped} filtered out${failures ? `, ${failures} source(s) failed` : ''}.`;
      if (failures) toast.info(message);
      else toast.success(message);
      await loadPending();
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Reddit ingestion failed');
    } finally {
      setWorking('');
    }
  };

  const toggleTag = (memeId, tag) => {
    setSelectedTags((current) => {
      const selected = current[memeId] || [];
      return {
        ...current,
        [memeId]: selected.includes(tag)
          ? selected.filter((item) => item !== tag)
          : [...selected, tag],
      };
    });
  };

  const moderate = async (meme, action) => {
    setWorking(meme._id);
    try {
      if (action === 'approve') {
        await API.post(`/admin/memes/${meme._id}/approve`, {
          tags: selectedTags[meme._id] || [],
          confirmRights: Boolean(rightsConfirmed[meme._id]),
        });
        toast.success('Meme approved and added to the feed');
      } else {
        await API.post(`/admin/memes/${meme._id}/reject`);
        toast.info('Meme rejected');
      }
      setPending((current) => current.filter((item) => item._id !== meme._id));
    } catch (error) {
      toast.error(error.response?.data?.msg || `Could not ${action} meme`);
    } finally {
      setWorking('');
    }
  };

  return (
    <main className="dating-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">CONTENT MODERATION</p>
          <h1>Meme <span>admin.</span></h1>
          <p className="muted">Reddit source links show in Discover without approval. Confirm rights before copying images to Cloudinary.</p>
        </div>
        <div className="community-admin-actions">
          <button className="button button-secondary" onClick={runIngestion} disabled={working === 'ingest'}>
            {working === 'ingest' ? 'Checking Reddit…' : 'Refresh Reddit queue'}
          </button>
        </div>
      </header>

      <section className="community-pending-section">
        <div className="section-title"><div><p className="eyebrow">IN REVIEW</p><h2>Pending memes</h2></div><span>{pending.length}</span></div>
        {loading ? <div className="empty-state">Loading review queue…</div> : pending.length ? (
          <div className="community-pending-list">
            {pending.map((meme) => (
              <article className="community-pending-card" key={meme._id}>
                {meme.imageUrl ? (
                  <img className="community-pending-image" src={meme.imageUrl} alt="Submitted meme" />
                ) : (
                  <div className="community-pending-source">Reddit image is not copied until rights are confirmed.</div>
                )}
                <div className="community-pending-content">
                  <h3>{meme.title}</h3>
                  <p>{meme.source === 'reddit' ? `r/${meme.subreddit} · u/${meme.sourceAuthor}` : 'Community submission'}</p>
                  {meme.isNsfw && <span className="reddit-weekly-tags"><strong>NSFW</strong></span>}
                  {meme.captionTop && <p className="community-caption">Top: {meme.captionTop}</p>}
                  {meme.captionBottom && <p className="community-caption">Bottom: {meme.captionBottom}</p>}
                  {meme.sourceUrl && <a href={meme.sourceUrl} target="_blank" rel="noreferrer">Open original Reddit post</a>}
                  <fieldset className="community-tag-fieldset">
                    <legend>Tags</legend>
                    {tags.map((tag) => (
                      <label key={tag}>
                        <input type="checkbox" checked={(selectedTags[meme._id] || []).includes(tag)} onChange={() => toggleTag(meme._id, tag)} />
                        {tag}
                      </label>
                    ))}
                  </fieldset>
                  <label className="community-rights-note">
                    <input
                      type="checkbox"
                      checked={Boolean(rightsConfirmed[meme._id])}
                      onChange={(event) => setRightsConfirmed((current) => ({ ...current, [meme._id]: event.target.checked }))}
                    />
                    I confirmed this image may be republished in this app.
                  </label>
                  <div className="community-card-actions">
                    <button
                      className="button button-primary"
                      onClick={() => moderate(meme, 'approve')}
                      disabled={working === meme._id || !(selectedTags[meme._id] || []).length || !rightsConfirmed[meme._id]}
                    >
                      Approve + tag
                    </button>
                    <button className="button button-secondary" onClick={() => moderate(meme, 'reject')} disabled={working === meme._id}>
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>No memes are waiting for review.</p></div>
        )}
      </section>
    </main>
  );
}
