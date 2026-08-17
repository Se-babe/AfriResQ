import { Link } from 'react-router-dom';
import { categoryLabel, formatWhen } from '../constants';
import { SeverityBadge, StatusPill } from './SeverityBadge.jsx';

export function EmergencyCard({ item, to, extra, actions }) {
  const href = to || `/emergencies/${item.id}`;
  return (
    <div className="row">
      <div>
        <div className="cluster">
          <SeverityBadge severity={item.severity} />
          <strong>{categoryLabel(item.category)}</strong>
          <StatusPill status={item.status} />
        </div>
        {item.description && <p className="muted" style={{ margin: '6px 0 0' }}>{item.description}</p>}
        <p className="tiny" style={{ margin: '6px 0 0' }}>
          {item.address_text || `${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}`}
          {item.distance_km != null ? ` · ${item.distance_km} km away` : ''}
          {item.assigned_responder_name ? ` · ${item.assigned_responder_name}` : ''}
          {item.created_at ? ` · ${formatWhen(item.created_at)}` : ''}
          {extra ? ` · ${extra}` : ''}
        </p>
      </div>
      <div className="stack">
        <Link className="btn ghost small" to={href}>Open</Link>
        {actions}
      </div>
    </div>
  );
}
