import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import MemeBattle from '../components/MemeBattle';

const fallbackPhoto = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=180&q=80';

const battleStatusLabel = (status) => {
  if (status === 'pending') return 'Waiting to start';
  if (status === 'active') return 'In progress';
  if (status === 'results') return 'Choose what’s next';
  if (status === 'chat_open' || status === 'skipped') return 'Chat opened';
  if (status === 'ended') return 'Rejected';
  return 'Battle';
};

export default function Battles() {
  const [battles, setBattles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const loadBattles = useCallback(async (showError = true) => {
    try {
      const { data } = await API.get('/dating/matches');
      const availableBattles = data.filter((match) => match.battle);
      setBattles(availableBattles);
      const requestedId = new URLSearchParams(location.search).get('matchId');
      setSelectedId((currentId) => {
        if (availableBattles.some((match) => match._id === currentId)) return currentId;
        const preferred = availableBattles.find((match) => match._id === requestedId);
        if (preferred) return preferred._id;
        const needsAttention = availableBattles.find((match) =>
          ['pending', 'active', 'results'].includes(match.battle.status));
        return needsAttention?._id || availableBattles[0]?._id || null;
      });
    } catch (error) {
      if (showError) toast.error(error.response?.data?.msg || 'Could not load your battles');
    } finally {
      setLoading(false);
    }
  }, [location.search]);

  useEffect(() => {
    loadBattles();
    const refresh = window.setInterval(() => loadBattles(false), 10000);
    return () => window.clearInterval(refresh);
  }, [loadBattles]);

  const selected = battles.find((match) => match._id === selectedId);
  const updateSelectedStatus = useCallback((status) => {
    if (!selectedId || !status || status === 'loading') return;
    setBattles((current) => current.map((match) => {
      if (match._id !== selectedId || !match.battle || match.battle.status === status) return match;
      return { ...match, battle: { ...match.battle, status } };
    }));
  }, [selectedId]);

  const chatIsOpen = selected?.battle && ['chat_open', 'skipped'].includes(selected.battle.status);

  return (
    <main className="dating-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR MATCH ICEBREAKERS</p>
          <h1>Your <span>battles.</span></h1>
          <p className="muted">Play rapid-fire together, then decide whether to open a conversation.</p>
        </div>
        <Link className="text-link" to="/matches">See your chats <span aria-hidden="true">→</span></Link>
      </header>

      {loading ? <div className="empty-state">Loading your battles…</div> : battles.length === 0 ? (
        <section className="empty-state">
          <span className="empty-icon" aria-hidden="true">✦</span>
          <h2>No battles yet</h2>
          <p>When you both like each other, your battle will show up here.</p>
          <Link className="button button-primary" to="/discover">Discover people</Link>
        </section>
      ) : (
        <section className="battles-layout">
          <aside className="battle-list">
            <h2>All battles <span>{battles.length}</span></h2>
            {battles.map((match) => (
              <button
                className={`battle-list-row ${match._id === selectedId ? 'battle-list-row-active' : ''}`}
                key={match._id}
                onClick={() => setSelectedId(match._id)}
                type="button"
              >
                <img src={match.profile.photoUrl || fallbackPhoto} alt="" />
                <span className="battle-list-copy">
                  <strong>{match.profile.name}</strong>
                  <small>{battleStatusLabel(match.battle.status)}</small>
                </span>
                <span className={`battle-status-dot battle-status-${match.battle.status}`} aria-hidden="true" />
              </button>
            ))}
          </aside>

          <section className="battle-workspace">
            {selected ? (
              <>
                <header className="battle-workspace-header">
                  <img src={selected.profile.photoUrl || fallbackPhoto} alt="" />
                  <div>
                    <h2>{selected.profile.name}</h2>
                    <p>{battleStatusLabel(selected.battle.status)}</p>
                  </div>
                  {chatIsOpen && (
                    <Link className="button button-primary" to={`/matches?matchId=${selected._id}`}>
                      Open chat
                    </Link>
                  )}
                  {selected.battle.status === 'ended' && (
                    <Link className="text-link" to={`/matches?matchId=${selected._id}`}>
                      Manage match
                    </Link>
                  )}
                </header>

                {chatIsOpen ? (
                  <div className="battle-chat-ready">
                    <span aria-hidden="true">♡</span>
                    <div><strong>You’re both ready to chat.</strong><p>Your answers and conversation starters are waiting in the chat.</p></div>
                  </div>
                ) : (
                  <MemeBattle
                    key={selected._id}
                    matchId={selected._id}
                    onStatusChange={updateSelectedStatus}
                  />
                )}
              </>
            ) : (
              <div className="conversation-empty"><span aria-hidden="true">✦</span><p>Select a battle to continue.</p></div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
