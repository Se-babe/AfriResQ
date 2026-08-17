import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { EmergencyCard } from '../components/EmergencyCard.jsx';

export function MyReports() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/emergencies/reported', { token }).then(setRows).catch((e) => setErr(e.message));
  }, [token]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>My reports</h2>
      <p className="muted">Every emergency you submitted, from report through resolution.</p>
      {err && <div className="alert err">{err}</div>}
      {rows.length === 0 && !err && <p className="muted">No reports yet.</p>}
      {rows.map((item) => <EmergencyCard key={item.id} item={item} />)}
    </div>
  );
}
