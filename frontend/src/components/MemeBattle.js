import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import API from '../utils/api';

export default function MemeBattle({ matchId, onStatusChange, onAskPrompt }) {
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState('');

  const loadBattle = useCallback(async (showError = true) => {
    try {
      const { data } = await API.get(`/dating/matches/${matchId}/battle`);
      setBattle(data);
    } catch (error) {
      if (error.response?.status === 404) {
        setBattle(null);
      } else if (showError) {
        setBattle({ status: 'error' });
        toast.error(error.response?.data?.msg || 'Could not load the meme battle');
      }
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadBattle();
    const refresh = window.setInterval(() => loadBattle(false), 1000);
    return () => window.clearInterval(refresh);
  }, [loadBattle]);

  useEffect(() => {
    onStatusChange(loading ? 'loading' : battle?.status || null);
  }, [battle, loading, onStatusChange]);

  const runAction = async (path, body = {}) => {
    setSaving(true);
    try {
      const { data } = await API.post(`/dating/matches/${matchId}/battle${path}`, body);
      setBattle(data);
      setAnswer('');
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Could not update the meme battle');
      await loadBattle(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !battle || battle.status === 'skipped') return null;

  if (battle.status === 'error') {
    return (
      <section className="battle-gate" aria-live="polite">
        <p>We couldn’t load this battle. Chat will stay closed until its status is confirmed.</p>
        <button className="button button-secondary" onClick={() => loadBattle()} type="button">Try again</button>
      </section>
    );
  }

  if (battle.status === 'ended') {
    return (
      <section className="battle-gate battle-ended" aria-live="polite">
        <span aria-hidden="true">♡</span>
        <p>This battle ended. Unmatch to see each other in Discover again.</p>
      </section>
    );
  }

  if (battle.status === 'chat_open') {
    return (
      <section className="battle-recap">
        <div className="battle-recap-heading">
          <div><p className="eyebrow">YOUR RAPID-FIRE RECAP</p><h3>Keep the banter going</h3></div>
          <span>♥ {battle.result.myLaughs + battle.result.partnerLaughs}</span>
        </div>
        {battle.rounds.map((round) => (
          <article className="battle-recap-round" key={round.id}>
            <div><span aria-hidden="true">{round.emoji}</span><strong>{round.prompt}</strong></div>
            <p><small>Their answer</small>{round.partnerAnswer || (round.partnerTimedOut ? 'They ran out of time this round.' : 'No answer was submitted this round.')}</p>
            {round.partnerAnswer && (
              <button
                type="button"
                onClick={() => onAskPrompt(`Your answer to “${round.prompt}” made me curious — what inspired “${round.partnerAnswer}”?`)}
              >
                Ask about this
              </button>
            )}
          </article>
        ))}
      </section>
    );
  }

  const completedRounds = battle.rounds.filter((round) => round.complete);
  const currentRound = battle.rounds.find((round) => !round.complete);

  return (
    <section className="battle-gate" aria-live="polite">
      <header className="battle-gate-header">
        <div>
          <p className="eyebrow">YOUR MATCH ICEBREAKER</p>
          <h3>{battle.status === 'pending' ? 'Ready for a banter battle?' : 'Rapid-fire: 5 rounds'}</h3>
        </div>
        <span className="battle-progress">{completedRounds.length}/5</span>
      </header>

      {battle.status === 'pending' && (
        <div className="battle-invite">
          <p>A few quick prompts, no pressure. You both need to join before the battle starts.</p>
          {battle.acceptedByMe && !battle.partnerAccepted ? (
            <p className="battle-waiting">You’re in. Waiting for your match to respond…</p>
          ) : !battle.acceptedByMe && battle.partnerAccepted ? (
            <p className="battle-waiting">Your match is ready when you are.</p>
          ) : null}
          <div className="battle-actions">
            {!battle.acceptedByMe && (
              <button className="button button-primary" onClick={() => runAction('/accept')} disabled={saving}>
                Join the battle
              </button>
            )}
            <button className="button button-secondary" onClick={() => runAction('/skip')} disabled={saving}>
              Pass on this match
            </button>
          </div>
          <small className="battle-footnote">The invite expires in 48 hours. Either of you can pass on the match.</small>
        </div>
      )}

      {battle.status === 'active' && (
        <>
          {completedRounds.map((round) => (
            <article className="battle-round battle-round-complete" key={round.id}>
              <div className="battle-round-title"><span>{round.emoji}</span><div><small>ROUND {round.index + 1}</small><h4>{round.title}</h4></div></div>
              <p className="battle-question">{round.prompt}</p>
              <div className="battle-answer-pair">
                <p><small>You</small>{round.myAnswer || (round.timedOutByMe ? 'Time ran out' : 'No answer this round')}</p>
                <p><small>Your match</small>{round.partnerAnswer || (round.partnerTimedOut ? 'Time ran out' : 'No answer this round')}</p>
              </div>
              {round.partnerAnswer && !round.laughedAtPartner && (
                <button
                  className="battle-laugh"
                  onClick={() => runAction(`/rounds/${round.index}/laugh`)}
                  disabled={saving}
                >
                  😂 That got me
                </button>
              )}
              {round.laughedAtPartner && <small className="battle-reaction-saved">You gave this answer a laugh</small>}
            </article>
          ))}
          {currentRound && (
            <article className="battle-round" key={currentRound.id}>
              <div className="battle-round-title">
                <span>{currentRound.emoji}</span>
                <div><small>ROUND {currentRound.index + 1} · {currentRound.category}</small><h4>{currentRound.title}</h4></div>
                <strong className="battle-timer" aria-label={`${currentRound.secondsRemaining} seconds remaining`}>
                  {currentRound.secondsRemaining}s
                </strong>
              </div>
              <p className="battle-question">{currentRound.prompt}</p>
              {currentRound.answeredByMe ? (
                <div className="battle-waiting-answer">
                  <p>Your answer: “{currentRound.myAnswer}”</p>
                  <small>Waiting for your match · {currentRound.secondsRemaining}s left</small>
                </div>
              ) : (
                <form
                  className="battle-answer-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runAction(`/rounds/${currentRound.index}/answers`, { text: answer });
                  }}
                >
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    maxLength={180}
                    rows={2}
                    placeholder="Your funniest, kindest one-liner…"
                    aria-label={`Your answer for round ${currentRound.index + 1}`}
                    disabled={currentRound.secondsRemaining === 0 || saving}
                    required
                  />
                  <div className="battle-submit-row">
                    <small>{answer.length}/180 · 60 seconds. Roast the situation, not each other.</small>
                    <button className="button button-primary" type="submit" disabled={!answer.trim() || saving || currentRound.secondsRemaining === 0}>
                      {saving ? 'Sending…' : 'Send answer'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          )}
          <button className="battle-skip" onClick={() => runAction('/skip')} disabled={saving}>
            End the match
          </button>
        </>
      )}

      {battle.status === 'results' && (
        <>
          {battle.rounds.map((round) => (
            <article className="battle-round battle-round-complete" key={round.id}>
              <div className="battle-round-title"><span>{round.emoji}</span><div><small>ROUND {round.index + 1}</small><h4>{round.title}</h4></div></div>
              <div className="battle-answer-pair">
                <p><small>You</small>{round.myAnswer || (round.timedOutByMe ? 'Time ran out' : 'No answer this round')}</p>
                <p><small>Your match</small>{round.partnerAnswer || (round.partnerTimedOut ? 'Time ran out' : 'No answer this round')}</p>
              </div>
              {round.partnerAnswer && !round.laughedAtPartner && (
                <button
                  className="battle-laugh"
                  onClick={() => runAction(`/rounds/${round.index}/laugh`)}
                  disabled={saving}
                >
                  😂 That got me
                </button>
              )}
            </article>
          ))}
          <div className="battle-result">
            <span aria-hidden="true">✨</span>
            <h4>Your banter result</h4>
            <p>You got {battle.result.myLaughs} laugh{battle.result.myLaughs === 1 ? '' : 's'} from your match; they got {battle.result.partnerLaughs} from you.</p>
            {battle.myDecision ? (
              <p className="battle-waiting">Your choice is saved. Waiting for your match…</p>
            ) : (
              <div className="battle-actions">
                <button className="button button-primary" onClick={() => runAction('/decision', { choice: 'chat' })} disabled={saving}>
                  Let’s chat
                </button>
                <button className="button button-secondary" onClick={() => runAction('/decision', { choice: 'pass' })} disabled={saving}>
                  End this match
                </button>
              </div>
            )}
            {battle.myDecision === 'chat' && battle.partnerDecision === 'chat' && (
              <p className="battle-waiting">You both want to chat. Your conversation is opening…</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
