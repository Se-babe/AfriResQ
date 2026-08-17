export const KAMPALA = { lat: 0.3476, lng: 32.5825 };

export const CATEGORIES = [
  { id: 'medical', label: 'Medical', hint: 'Injury, illness, childbirth' },
  { id: 'road_accident', label: 'Road accident', hint: 'Crash, motorcycle, pedestrian' },
  { id: 'fire', label: 'Fire', hint: 'Building, bush, vehicle fire' },
  { id: 'security', label: 'Security', hint: 'Assault, theft, threat' },
  { id: 'missing_person', label: 'Missing person', hint: 'Lost child or adult' },
  { id: 'disaster', label: 'Disaster', hint: 'Flood, collapse, storm' },
  { id: 'other', label: 'Other', hint: 'Something else urgent' },
];

export const SKILLS = [
  'medical',
  'first_aid',
  'paramedic',
  'nurse',
  'fire',
  'rescue',
  'security',
  'police',
  'search_rescue',
  'community_volunteer',
  'traffic',
];

export const DEMO_ACCOUNTS = [
  { role: 'Citizen', phone: '+256700000099', password: 'CitizenPass123!' },
  { role: 'Responder', phone: '+256700000010', password: 'ResponderPass123!' },
  { role: 'Coordinator', phone: '+256700000002', password: 'CoordPass123!' },
  { role: 'Admin', phone: '+256700000001', password: 'AdminPass123!' },
];

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || String(id || '').replaceAll('_', ' ');
}

export function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatSeconds(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const s = Math.round(Number(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export function statusLabel(status) {
  return String(status || '').replaceAll('_', ' ');
}
