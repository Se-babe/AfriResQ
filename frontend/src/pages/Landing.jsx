import { Link } from 'react-router-dom';
import { DEMO_ACCOUNTS } from '../constants';

export function Landing() {
  return (
    <div>
      <section className="hero">
        <div>
          <div className="kicker"><span className="pulse" /> Pilot · Kampala community coordination</div>
          <h2>Help is closer than the next phone call.</h2>
          <p className="lede">
            AfriResQ is a location-aware emergency coordination layer for African communities.
            Report once. Nearby verified responders are classified, matched, and notified — so help
            is not lost across scattered phone numbers.
          </p>
          <div className="actions">
            <Link className="btn primary" to="/report">Report an emergency</Link>
            <Link className="btn ghost" to="/register">Join as a responder</Link>
            <Link className="btn ink" to="/login">Sign in</Link>
          </div>
          <p className="tiny" style={{ marginTop: 16 }}>
            Not a replacement for official emergency services. Use AfriResQ alongside them.
          </p>
        </div>
        <div className="hero-card">
          <p className="tiny" style={{ color: '#c9d4df', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live pipeline</p>
          <h3 style={{ fontSize: 32, margin: '8px 0 18px' }}>Report → Classify → Match → Notify</h3>
          <div className="stack">
            <p><strong>1.</strong> A neighbour reports a road accident with GPS or a landmark.</p>
            <p><strong>2.</strong> Rules assign severity and an explainable priority score.</p>
            <p><strong>3.</strong> Nearby verified, available responders are ranked by distance, skill, rating and load.</p>
            <p><strong>4.</strong> Candidates are alerted. The first to accept owns the case until it is resolved.</p>
          </div>
        </div>
      </section>

      <section className="steps">
        <div className="grid-4">
          <article className="step"><n>01</n><h3>Report</h3><p className="muted">Three taps. Category, a short description, location.</p></article>
          <article className="step"><n>02</n><h3>Classify</h3><p className="muted">Auditable severity — critical, high, moderate or low.</p></article>
          <article className="step"><n>03</n><h3>Match</h3><p className="muted">Search widens from 3 km to 50 km until someone eligible is found.</p></article>
          <article className="step"><n>04</n><h3>Coordinate</h3><p className="muted">A live dashboard for coordinators. A case list for responders.</p></article>
        </div>
      </section>

      <section className="card" style={{ marginTop: 22 }}>
        <h3 style={{ marginTop: 0 }}>Try the seeded Kampala demo</h3>
        <p className="muted">Use these accounts after running <code>npm run seed</code> on the backend.</p>
        <div className="grid-2" style={{ marginTop: 12 }}>
          {DEMO_ACCOUNTS.map((a) => (
            <div key={a.phone} className="tile">
              <strong>{a.role}</strong>
              <div className="tiny">{a.phone}</div>
              <div className="tiny">{a.password}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
