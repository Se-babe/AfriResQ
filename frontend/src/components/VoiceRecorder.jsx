import { useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 60;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Records a short voice note via MediaRecorder and hands the parent a
// {audioBase64, mimeType, durationSeconds} object (or null once cleared).
export function VoiceRecorder({ onChange }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [err, setErr] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const audioBase64 = await blobToBase64(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        onChange({ audioBase64, mimeType, durationSeconds: seconds });
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) recorder.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setErr('Microphone access was denied or is unavailable.');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const clear = () => {
    setPreviewUrl(null);
    setSeconds(0);
    onChange(null);
  };

  return (
    <div style={{ marginTop: 10 }}>
      {!previewUrl && !recording && (
        <button type="button" className="btn ghost" onClick={start}>🎤 Record a voice note</button>
      )}
      {recording && (
        <button type="button" className="btn danger" onClick={stop}>⏹ Stop recording ({seconds}s)</button>
      )}
      {previewUrl && (
        <div className="cluster">
          <audio controls src={previewUrl} />
          <button type="button" className="btn ghost" onClick={clear}>Remove</button>
        </div>
      )}
      {err && <div className="tiny" style={{ color: '#b42318' }}>{err}</div>}
    </div>
  );
}
