import { useState } from 'react';
import { api } from '../api';

export function RatingForm({ emergencyId, token, existingRating, onRated }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (existingRating) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your rating</h3>
        <p>{'★'.repeat(existingRating.stars)}{'☆'.repeat(5 - existingRating.stars)}</p>
        {existingRating.comment && <p className="muted">{existingRating.comment}</p>}
      </div>
    );
  }

  const submit = async () => {
    if (stars === 0) { setErr('Pick a star rating first'); return; }
    setBusy(true); setErr('');
    try {
      const { rating } = await api(`/emergencies/${emergencyId}/rating`, { method: 'POST', token, body: { stars, comment: comment || undefined } });
      onRated(rating);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Rate the response</h3>
      <div className="cluster">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, color: n <= stars ? '#e0b400' : '#d8cdb9' }}
          >
            ★
          </button>
        ))}
      </div>
      <label className="field"><span>Comment (optional)</span>
        <input value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="How did it go?" />
      </label>
      {err && <div className="alert err">{err}</div>}
      <button className="btn primary" type="button" disabled={busy} onClick={submit}>Submit rating</button>
    </div>
  );
}
