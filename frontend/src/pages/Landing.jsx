import { Link } from 'react-router-dom';
import { DEMO_ACCOUNTS } from '../constants';

export function Landing() {
  return (
    <div>
      <section className="hero">
        <div>
          <div className="kicker"><span className="pulse" /> Republic of Uganda · Digital public infrastructure</div>
          <h2>Uganda’s digital emergency coordination infrastructure.</h2>
          <p className="lede">
            AfriResQ is built for the Government of Uganda — a national system that connects
            a person in distress to the nearest suitable responder, health facility, or
            community resource. Citizens, districts, hospitals, and organisations use it
            at no charge. The Ministry of ICT and National Guidance funds and owns the platform
            so every Ugandan can reach help faster.
          </p>
          <div className="actions">
            <Link className="btn primary" to="/report">Report an emergency</Link>
            <Link className="btn ghost" to="/register">Join as a responder</Link>
            <Link className="btn ink" to="/login">Sign in</Link>
          </div>
          <p className="tiny" style={{ marginTop: 16 }}>
            Complements Uganda Police, fire brigade, ambulance, and hospitals. It does not replace them.
          </p>
        </div>
        <div className="hero-card">
          <p className="tiny" style={{ color: '#c9d4df', letterSpacing: '0.12em', textTransform: 'uppercase' }}>National operating model</p>
          <h3 style={{ fontSize: 32, margin: '8px 0 18px' }}>Government pays. Ugandans use it free.</h3>
          <div className="stack">
            <p><strong>Ministry of ICT</strong> procures, funds, and governs the national platform.</p>
            <p><strong>Citizens</strong> report an emergency in a few taps — no fee, no subscription.</p>
            <p><strong>Responders and organisations</strong> (health facilities, Red Cross, local government, volunteers) access the system free of charge.</p>
            <p><strong>District coordinators</strong> see a live national picture: who needs help, who is going, and how long it took.</p>
          </div>
        </div>
      </section>

      <section className="steps">
        <div className="grid-4">
          <article className="step"><n>01</n><h3>Report</h3><p className="muted">Any Ugandan reports with category, a short description, and location.</p></article>
          <article className="step"><n>02</n><h3>Classify</h3><p className="muted">Auditable severity — critical, high, moderate or low.</p></article>
          <article className="step"><n>03</n><h3>Match</h3><p className="muted">Search widens from 3 km to 50 km until an eligible responder is found.</p></article>
          <article className="step"><n>04</n><h3>Coordinate</h3><p className="muted">Live dashboards for districts and national coordinators until the case is closed.</p></article>
        </div>
      </section>

      <section className="grid-3" style={{ marginTop: 8 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>For Government</h3>
          <p className="muted">One national coordination layer. Evidence of response times, hotspots, and coverage gaps to support the Ministry of ICT, Ministry of Health, and local governments.</p>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Free for the public</h3>
          <p className="muted">No charge to citizens, community responders, NGOs, or health facilities. Access is a public service, paid for once at the centre.</p>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Made for Uganda</h3>
          <p className="muted">Phone-first identity, GPS with landmark fallback, and design for intermittent connectivity — starting with a Kampala district pilot, ready to scale nationwide.</p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 22 }}>
        <h3 style={{ marginTop: 0 }}>Kampala pilot demo</h3>
        <p className="muted">Demonstration accounts for the Uganda pilot. Run <code>npm run seed</code> on the backend, or register as a citizen for free.</p>
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
