import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { MapView } from '../components/MapView.jsx';
import { KAMPALA } from '../constants';

const TYPES = ['health_facility', 'police', 'fire', 'ngo', 'community_group', 'ambulance', 'other'];

export function Organizations() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'health_facility', phone: '', addressText: '', lat: KAMPALA.lat, lng: KAMPALA.lng });
  const [err, setErr] = useState('');

  const load = () => api('/organizations').then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api('/organizations', { method: 'POST', token, body: { ...form, lat: Number(form.lat), lng: Number(form.lng) } });
      setForm({ name: '', type: 'health_facility', phone: '', addressText: '', lat: KAMPALA.lat, lng: KAMPALA.lng });
      load();
    } catch (error) { setErr(error.message); }
  };

  return (
    <div className="split">
      <div className="stack">
        <form className="card" onSubmit={submit}>
          <h2 style={{ marginTop: 0 }}>Register an organization</h2>
          <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="field"><span>Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field"><span>Address</span><input value={form.addressText} onChange={(e) => setForm({ ...form, addressText: e.target.value })} /></label>
          <div className="grid-2">
            <label className="field"><span>Lat</span><input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></label>
            <label className="field"><span>Lng</span><input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></label>
          </div>
          <button className="btn primary" type="submit">Save organization</button>
          {err && <div className="alert err">{err}</div>}
        </form>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Directory</h3>
          {rows.map((o) => (
            <div className="row" key={o.id}>
              <div>
                <strong>{o.name}</strong>
                <div className="tiny">{o.type.replaceAll('_', ' ')} · {o.phone || 'no phone'} · {o.address_text || `${o.lat}, ${o.lng}`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MapView
        emergencies={rows.filter((o) => o.lat != null).map((o) => ({ id: o.id, lat: o.lat, lng: o.lng, category: 'other', severity: 'low', status: o.type, address_text: o.name }))}
        responders={[]}
        tall
      />
    </div>
  );
}
