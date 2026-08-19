import { useState } from 'react';
import { api } from '../api';

function base64ToBlobUrl(base64, mimeType) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function VoiceNotePlayer({ emergencyId, token }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const data = await api(`/emergencies/${emergencyId}/voice-note`, { token });
      setUrl(base64ToBlobUrl(data.audioBase64, data.mimeType));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      {!url && (
        <button type="button" className="btn ghost" disabled={busy} onClick={load}>
          {busy ? 'Loading…' : '🎤 Play voice note'}
        </button>
      )}
      {url && <audio controls autoPlay src={url} style={{ width: '100%' }} />}
      {err && <div className="tiny" style={{ color: '#b42318' }}>{err}</div>}
    </div>
  );
}
