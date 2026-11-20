import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import MemeBattle from '../components/MemeBattle';

const fallbackPhoto = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=180&q=80';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [unmatching, setUnmatching] = useState(false);
  const location = useLocation();

  const loadMatches = useCallback(async () => {
    try {
      const [matchesResponse, userResponse] = await Promise.all([
        API.get('/dating/matches'),
        API.get('/auth/me'),
      ]);
      setMatches(matchesResponse.data);
      setUserId(userResponse.data._id);
      const requestedId = new URLSearchParams(location.search).get('matchId');
      setSelected((current) =>
        matchesResponse.data.find((match) => match._id === requestedId) ||
        matchesResponse.data.find((match) => match._id === current?._id) ||
        matchesResponse.data[0] ||
        null);
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not load your matches');
    } finally {
      setLoading(false);
    }
  }, [location.search]);

  const loadMessages = useCallback(async (matchId, showError = true) => {
    try {
      const { data } = await API.get(`/dating/matches/${matchId}/messages`);
      setMessages(data);
    } catch (error) {
      if (showError) toast.error(error.response?.data?.msg || 'Could not load messages');
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    if (!selected?._id) {
      setMessages([]);
      return undefined;
    }
    if (selected.battle && !['skipped', 'chat_open'].includes(selected.battle.status)) {
      setMessages([]);
      return undefined;
    }

    loadMessages(selected._id);
    const refresh = window.setInterval(() => loadMessages(selected._id, false), 5000);
    return () => window.clearInterval(refresh);
  }, [selected, loadMessages]);

  const ignoreBattleStatus = useCallback(() => {}, []);
  const chatIsOpen = !selected?.battle || ['skipped', 'chat_open'].includes(selected.battle.status);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!message.trim() || !selected) return;
    try {
      const { data } = await API.post(`/dating/matches/${selected._id}/messages`, { text: message });
      setMessages((current) => [...current, data]);
      setMessage('');
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not send message');
    }
  };

  const unmatch = async () => {
    if (!selected || unmatching) return;
    const confirmed = window.confirm(
      `Unmatch ${selected.profile.name}? Your chat and battle will be removed, and you may see each other again.`,
    );
    if (!confirmed) return;

    setUnmatching(true);
    try {
      await API.delete(`/dating/matches/${selected._id}`);
      const remainingMatches = matches.filter((match) => match._id !== selected._id);
      setMatches(remainingMatches);
      setSelected(remainingMatches[0] || null);
      setMessages([]);
      setMessage('');
      toast.success(`You unmatched ${selected.profile.name}. You may see each other again.`);
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not unmatch this person');
    } finally {
      setUnmatching(false);
    }
  };

  return (
    <main className="dating-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">GOOD THINGS START HERE</p>
          <h1>Your matches</h1>
          <p className="muted">A mutual like is a lovely reason to say hello.</p>
        </div>
      </header>

      {loading ? <div className="empty-state">Loading your matches…</div> : (
        <section className="matches-layout">
          <aside className="match-list">
            <h2>Connections <span>{matches.length}</span></h2>
            {matches.length === 0 ? (
              <p className="match-empty">Your mutual likes will show up here. Keep discovering.</p>
            ) : matches.map((match) => (
              <button
                className={`match-row ${selected?._id === match._id ? 'match-row-active' : ''}`}
                key={match._id}
                onClick={() => {
                  if (selected?._id !== match._id) {
                    setSelected(match);
                  }
                }}
              >
                <img src={match.profile.photoUrl || fallbackPhoto} alt="" />
                <span><strong>{match.profile.name}</strong><small>{match.profile.location || 'Your new connection'}</small></span>
                <span className="match-heart" aria-hidden="true">♥</span>
              </button>
            ))}
          </aside>
          <section className="conversation">
            {selected ? (
              <>
                <header className="conversation-header">
                  <img src={selected.profile.photoUrl || fallbackPhoto} alt="" />
                  <div><h2>{selected.profile.name}</h2><p>{selected.profile.location || 'You matched!'}</p></div>
                  <button className="unmatch-button" onClick={unmatch} disabled={unmatching}>
                    {unmatching ? 'Unmatching…' : 'Unmatch'}
                  </button>
                </header>
                {selected.battle?.status === 'chat_open' && (
                  <MemeBattle
                    key={selected._id}
                    matchId={selected._id}
                    onStatusChange={ignoreBattleStatus}
                    onAskPrompt={setMessage}
                  />
                )}
                {selected.battle && !chatIsOpen && selected.battle.status !== 'ended' && (
                  <div className="battle-chat-locked">
                    <span aria-hidden="true">✦</span>
                    <div>
                      <strong>Your battle is waiting in Battles</strong>
                      <p>Finish the rapid-fire rounds there. Chat opens only when you both choose it.</p>
                    </div>
                    <Link className="button button-primary" to={`/battles?matchId=${selected._id}`}>Open battle</Link>
                  </div>
                )}
                {selected.battle?.status === 'ended' && (
                  <div className="battle-chat-locked">
                    <span aria-hidden="true">♡</span>
                    <div>
                      <strong>This battle was rejected</strong>
                      <p>Chat wasn’t opened. You can unmatch to see each other in Discover again.</p>
                    </div>
                    <Link className="button button-secondary" to={`/battles?matchId=${selected._id}`}>View result</Link>
                  </div>
                )}
                {chatIsOpen && (
                  <>
                    <div className="message-list" aria-live="polite">
                      {messages.length === 0 ? (
                        <div className="conversation-empty"><span aria-hidden="true">♡</span><p>You matched! Start with a friendly hello.</p></div>
                      ) : messages.map((item) => (
                        <p className={`message-bubble ${item.sender?._id === userId ? 'message-own' : ''}`} key={item._id}>
                          {item.text}
                        </p>
                      ))}
                    </div>
                    <form className="message-form" onSubmit={sendMessage}>
                      <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength="1000" placeholder={`Message ${selected.profile.name}…`} aria-label="Message" />
                      <button className="button button-primary" type="submit" disabled={!message.trim()}>Send</button>
                    </form>
                  </>
                )}
              </>
            ) : (
              <div className="conversation-empty"><span aria-hidden="true">✦</span><p>Your conversations will appear here.</p></div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
