import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { CATEGORIES, KAMPALA } from '../constants';
import { enqueueReport, flushQueue, peekQueue } from '../offline';
import { MapView } from '../components/MapView.jsx';
import { SeverityBadge } from '../components/SeverityBadge.jsx';

export function Report() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('medical');
  const [description, setDescription] = useState('');
  const [addressText, setAddressText] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [queued, setQueued] = useState(peekQueue().length);
  const [result, setResult] = useState(null);

  useEffect(() => {
    captureLocation();
  }, []);

  useEffect(() => {
    const onOnline = () => {
      flushQueue((item) => submitReport(item, { silent: true })).then((r) => setQueued(r.remaining));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [token]);

  const captureLocation = () => {
    setLocating(true);
    setErr('');
    if (!navigator.geolocation) {
      setErr('This device cannot share GPS. Enter a landmark instead.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      (geoErr) => {
        setErr(`${geoErr.message} You can still submit with a landmark. Kampala centre is used only if GPS and address are both missing.`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const submitReport = async (payload) => {
    return api('/emergencies', {
      method: 'POST',
      token,
      body: payload,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setResult(null);
    const loc = location || KAMPALA;
    const payload = {
      category,
      description,
      lat: loc.lat,
      lng: loc.lng,
      addressText,
      locationAccuracyM: loc.accuracy,
      channel: 'web',
      reporterPhone: user ? undefined : phone,
    };
    if (!user && !phone) {
      setErr('Enter a phone number so responders can reach you, or create an account.');
      return;
    }
    if (!navigator.onLine) {
      enqueueReport(payload);
      setQueued(peekQueue().length);
      setErr('');
      setResult({ offline: true });
      return;
    }
    setBusy(true);
    try {
      const data = await submitReport(payload);
      setResult(data);
      if (user?.role === 'citizen') {
        /* stay on confirmation */
      }
    } catch (error) {
      if (!navigator.onLine) {
        enqueueReport(payload);
        setQueued(peekQueue().length);
        setResult({ offline: true });
      } else {
        setErr(error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="notice">
        If you can reach official emergency services, call them as well. AfriResQ alerts nearby community responders and facilities.
      </div>
      <div className="split">
        <form className="card" onSubmit={submit}>
          <h2 style={{ marginTop: 0 }}>Report an emergency</h2>
          <p className="muted">Choose the type, add a short description if you can, and send. Location is captured automatically when allowed.</p>
          <div className="grid-2" style={{ marginTop: 12 }}>
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} className={`tile ${category === c.id ? 'selected' : ''}`} onClick={() => setCategory(c.id)}>
                <strong>{c.label}</strong>
                <span className="tiny">{c.hint}</span>
              </button>
            ))}
          </div>
          <label className="field"><span>What is happening? (optional, helps priority)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Motorcycle accident, one person bleeding, near Old Taxi Park" />
          </label>
          {!user && (
            <label className="field"><span>Your phone number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2567xxxxxxxx" required />
            </label>
          )}
          <label className="field"><span>Landmark / address</span>
            <input value={addressText} onChange={(e) => setAddressText(e.target.value)} placeholder="Near Mulago roundabout, opposite the market" />
          </label>
          <div className="cluster" style={{ marginTop: 14 }}>
            <button type="button" className="btn ghost" onClick={captureLocation} disabled={locating}>
              {locating ? 'Finding you…' : location ? `Location captured (±${Math.round(location.accuracy || 0)} m)` : 'Use my location'}
            </button>
          </div>
          <div className="actions">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button>
            {!user && <Link className="btn ghost" to="/login">Sign in instead</Link>}
          </div>
          {queued > 0 && <div className="alert warn">{queued} report(s) waiting to send when you are back online.</div>}
          {err && <div className="alert err">{err}</div>}
        </form>
        <div className="stack">
          <MapView emergencies={[]} responders={[]} center={location || KAMPALA} />
          {result?.offline && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Saved on this device</h3>
              <p className="muted">No connection right now. The report will send automatically when the network returns.</p>
            </div>
          )}
          {result?.emergency && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Report received <SeverityBadge severity={result.classification?.severity} /></h3>
              <p className="muted">Priority {result.classification?.priorityScore} / 100</p>
              {result.classification?.reasons && (
                <ul className="tiny">
                  {result.classification.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
              {result.matching?.candidates?.length ? (
                <p><strong>{result.matching.candidates.length}</strong> nearby responder(s) notified within {result.matching.searchRadiusKm} km.</p>
              ) : (
                <div className="alert warn">{result.matching?.warning || 'No nearby responder was available. A coordinator will escalate.'}</div>
              )}
              {result.matching?.candidates?.map((c) => (
                <div className="row" key={c.responderId}>
                  <div>{c.name}</div>
                  <div className="muted">{c.distanceKm} km</div>
                </div>
              ))}
              {user && (
                <div className="actions">
                  <button className="btn ghost" type="button" onClick={() => navigate(`/emergencies/${result.emergency.id}`)}>Track this report</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
