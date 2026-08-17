const kampalaLat = 0.3476;
const kampalaLng = 32.5825;

const categories = [
  ('medical', 'Medical', 'Injury, illness, childbirth'),
  ('road_accident', 'Road accident', 'Crash, motorcycle, pedestrian'),
  ('fire', 'Fire', 'Building, bush, vehicle fire'),
  ('security', 'Security', 'Assault, theft, threat'),
  ('missing_person', 'Missing person', 'Lost child or adult'),
  ('disaster', 'Disaster', 'Flood, collapse, storm'),
  ('other', 'Other', 'Something else urgent'),
];

const skills = [
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

String categoryLabel(String? id) {
  for (final c in categories) {
    if (c.$1 == id) return c.$2;
  }
  return (id ?? '').replaceAll('_', ' ');
}

String prettyStatus(String? status) => (status ?? '').replaceAll('_', ' ');
