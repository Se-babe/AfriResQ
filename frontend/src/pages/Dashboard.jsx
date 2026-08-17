import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, wsUrl } from '../api';
import { useAuth } from '../auth.jsx';
import { CATEGORIES, formatSeconds } from '../constants';
import { EmergencyCard } from '../components/EmergencyCard.jsx';
import { MapView } from '../components/MapView.jsx';

export function Dashboard() {
  const { token } = useAuth();
  const [emergencies, setEmergencies] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [responders, setResponders] = useState([]);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [err, setErr] = useState('');
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (category) qs.set('category', category);
      if (severity) qs.set('severity', severity);
      qs.set('limit', '80');
      const [e, a, r] = await Promise.all([
        api(`/emergencies?${qs.toString()}`, { token }),
        api('/analytics/summary', { token }),
        api('/responders', { token }),
      ]);
      setEmergencies(e);
      setAnalytics(a);
      setResponders(r);
      setErr('');
    } catch (e2) {
      setErr(e2.message);
    }
  }, [token, status, category, severity]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => setLive(true);
      ws.onclose = () => setLive(false);
      ws.onmessage = () => load();
    } catch { setLive(false); }
    const t = setInterval(load, 12000);
    return () => { clearInterval(t); ws?.close(); };
  }, [load]);

  const maxCat = Math.max(1, ...(analytics?.byCategory || []).map((x) => x.count));
  const mapResponders = useMemo(
    () => responders.filter((r) => r.current_lat != null && r.current_lng != null),
    [responders]
  );

  return (
    <div>
      <div className="cluster" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Coordination dashboard</h2>
        <span className="pill">{live ? <><span className="live-dot" /> Live</> : 'Polling'}</span>
      </div>
      {analytics && (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="stat"><div className="num">{analytics.activeEmergencies ?? '—'}</div><div className="label">Active now</div></div>
          <div className="stat"><div className="num">{analytics.totalEmergencies}</div><div className="label">All reports</div></div>
          <div className="stat"><div className="num">{analytics.matchingSuccessRate != null ? `${Math.round(analytics.matchingSuccessRate * 100)}%` : '—'}</div><div className="label">Match success</div></div>
          <div className="stat"><div className="num">{formatSeconds(analytics.avgSecondsToAcceptance)}</div><div className="label">Avg. time to accept</div></div>
        </div>
      )}
      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="filters">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {['reported','classified','matching','matched','notified','accepted','in_progress','resolved','closed','cancelled'].map((s) => <option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="">All severities</option>
                {['critical','high','moderate','low'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {err && <div className="alert err">{err}</div>}
            {emergencies.length === 0 && <p className="muted">No emergencies match these filters.</p>}
            {emergencies.map((item) => <EmergencyCard key={item.id} item={item} />)}
          </div>
        </div>
        <div className="stack">
          <MapView emergencies={emergencies} responders={mapResponders} tall />
          {analytics && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>By category</h3>
              <div className="bars">
                {(analytics.byCategory || []).map((row) => (
                  <div className="bar" key={row.category}>
                    <span>{row.category.replaceAll('_', ' ')}</span>
                    <i><b style={{ width: `${(row.count / maxCat) * 100}%` }} /></i>
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
              <p className="tiny" style={{ marginTop: 12 }}>
                Notify {formatSeconds(analytics.avgSecondsToFirstNotification)} · Available responders {analytics.availableResponders} · Pending verification {analytics.pendingVerification}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
