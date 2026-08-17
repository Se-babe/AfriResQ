import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { KAMPALA, categoryLabel } from '../constants';
import 'leaflet/dist/leaflet.css';

const SEV_COLOR = {
  critical: '#b42318',
  high: '#d9921a',
  moderate: '#2a6ebb',
  low: '#1a7a6d',
  unclassified: '#6b5e4e',
};

function Fit({ points }) {
  const map = useMap();
  const key = (points || []).map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    const valid = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length === 0) {
      map.setView([KAMPALA.lat, KAMPALA.lng], 12);
      return;
    }
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 14);
      return;
    }
    map.fitBounds(
      valid.map((p) => [p.lat, p.lng]),
      { padding: [28, 28], maxZoom: 14 }
    );
  }, [map, key]);
  return null;
}

export function MapView({ emergencies = [], responders = [], center, tall }) {
  const points = [
    ...emergencies.map((e) => ({ lat: e.lat, lng: e.lng })),
    ...responders.map((r) => ({ lat: r.current_lat, lng: r.current_lng })),
    ...(center ? [center] : []),
  ].filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));

  return (
    <div className={`map-wrap ${tall ? 'tall' : ''}`}>
      <MapContainer center={[KAMPALA.lat, KAMPALA.lng]} zoom={12} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Fit points={points} />
        {center && Number.isFinite(center.lat) && (
          <CircleMarker center={[center.lat, center.lng]} radius={10} pathOptions={{ color: '#0a1628', fillColor: '#e8a317', fillOpacity: 0.9 }}>
            <Popup>Report location</Popup>
          </CircleMarker>
        )}
        {emergencies.map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.lat, e.lng]}
            radius={e.severity === 'critical' ? 12 : 9}
            pathOptions={{ color: SEV_COLOR[e.severity] || '#0a1628', fillColor: SEV_COLOR[e.severity] || '#0a1628', fillOpacity: 0.8 }}
          >
            <Popup>
              <strong>{categoryLabel(e.category)}</strong>
              <br />
              {e.severity} · {e.status}
              <br />
              {e.address_text || ''}
            </Popup>
          </CircleMarker>
        ))}
        {responders.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.current_lat, r.current_lng]}
            radius={7}
            pathOptions={{ color: '#0e4d45', fillColor: '#1a7a6d', fillOpacity: 0.85 }}
          >
            <Popup>
              <strong>{r.name}</strong>
              <br />
              {r.availability_status} · {(r.skills || []).join(', ')}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
