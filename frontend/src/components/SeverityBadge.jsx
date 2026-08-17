export function SeverityBadge({ severity }) {
  if (!severity || severity === 'unclassified') return <span className="pill">Unclassified</span>;
  return <span className={`badge sev-${severity}`}>{severity}</span>;
}

export function StatusPill({ status }) {
  return <span className="pill">{String(status || '').replaceAll('_', ' ')}</span>;
}
