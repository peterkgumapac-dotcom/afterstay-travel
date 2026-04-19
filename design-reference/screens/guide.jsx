// Guide — Property info, Nearby essentials, Notes (replaces moments)

const PROPERTY = {
  name: 'Canyon Hotels & Resorts Boracay',
  desc: 'Station B, Sitio Sinagpa, Balabag, Malay, Aklan 5608',
  checkIn: '3:00 PM',
  checkOut: '12:00 PM',
  phone: '+63 36 288 5888',
  email: 'reservations@canyonhotels.ph',
};

const AMENITIES = [
  { n: 'Infinity pool',   icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20c2 0 2-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2"/><path d="M2 15c2 0 2-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2"/><path d="M8 11V4a2 2 0 012-2h2a2 2 0 012 2v7"/></svg>) },
  { n: 'Free WiFi',       icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5a10 10 0 0114 0"/><path d="M8.5 15.5a5 5 0 017 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>) },
  { n: 'Breakfast',       icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h14a4 4 0 010 8H5a2 2 0 01-2-2z"/><path d="M8 7a2 2 0 014 0 2 2 0 004 0M17 12v-2a3 3 0 016 0v2"/></svg>) },
  { n: 'Gym',             icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 8v8M18 8v8M2 12h4M18 12h4M9 10v4M15 10v4"/></svg>) },
  { n: 'Shuttle',         icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 12h18M7 18v2M17 18v2"/><circle cx="7" cy="14" r="1" fill="currentColor"/><circle cx="17" cy="14" r="1" fill="currentColor"/></svg>) },
  { n: 'Spa',             icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-6 0-10-4-10-10 0-3 2-6 4-6s4 2 4 4M12 22c6 0 10-4 10-10 0-3-2-6-4-6s-4 2-4 4"/></svg>) },
];

const NEARBY = [
  { n: 'CityMall Boracay',   d: '470 m',  t: 'Shopping mall',    w: '6 min walk',  pin: 'M' },
  { n: "D'Mall",             d: '1.6 km', t: 'Shopping street',  w: '20 min walk', pin: 'D' },
  { n: 'Island Clinic',      d: '830 m',  t: 'Medical',          w: '10 min walk', pin: '+' },
  { n: 'White Beach Path 2', d: '1.1 km', t: 'Beach access',     w: '14 min walk', pin: '~' },
  { n: 'Puka Beach',         d: '4.2 km', t: 'Beach',            w: '15 min ride', pin: '~' },
];

const NOTES = [
  { title: 'Check-in tip', body: 'Agoda vouchers required at the front desk — already saved to Files.', time: '2h ago', by: 'Peter' },
  { title: 'Tricycle fare', body: 'Fixed rate ₱3–5/person short hops. Don\'t pay more than ₱150 flag-down from Caticlan.', time: 'Yesterday', by: 'Aaron' },
  { title: 'Sunset plan',   body: 'Try Station 2 first night — golden hour 5:40 PM. Bring the GoPro.', time: '2 days ago', by: 'Jane' },
];

function GuideScreen() {
  const [tab, setTab] = React.useState('property');

  return (
    <Page>
      <TopBar title="Guide" subtitle="Canyon Hotels · Boracay" right={
        <button className="icon-btn round">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.6" y2="16.6"/></svg>
        </button>
      } />

      <div style={{ padding: '0 16px 16px' }}>
        <div className="seg" style={{ width: '100%' }}>
          {[['property', 'Property'], ['nearby', 'Nearby'], ['notes', 'Notes']].map(([id, l]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'property' && (
        <>
          {/* Hero */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ position: 'relative', height: 200, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url("${HOTEL_PHOTOS[0]}")`,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }}/>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)',
              }}/>
              <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, color: '#fff' }}>
                <div className="display" style={{ fontSize: 20, lineHeight: 1.1, marginBottom: 3 }}>{PROPERTY.name}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{PROPERTY.desc}</div>
              </div>
            </div>
          </div>

          {/* Times */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="card" style={{ padding: 14 }}>
                <div className="eyebrow">Check-in</div>
                <div className="display mono" style={{ fontSize: 20, color: 'var(--text)', marginTop: 6, fontWeight: 550 }}>{PROPERTY.checkIn}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>Sun, Apr 20</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div className="eyebrow">Check-out</div>
                <div className="display mono" style={{ fontSize: 20, color: 'var(--text)', marginTop: 6, fontWeight: 550 }}>{PROPERTY.checkOut}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>Sun, Apr 27</div>
              </div>
            </div>
          </div>

          <GroupHeader kicker="Amenities" title="What's included" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {AMENITIES.map(a => (
                <div key={a.n} style={{
                  padding: '14px 10px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  textAlign: 'center',
                }}>
                  <div style={{ color: 'var(--accent)', marginBottom: 8 }}>{a.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{a.n}</div>
                </div>
              ))}
            </div>
          </div>

          <GroupHeader kicker="Contact" title="Reach the property" />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row
              title={PROPERTY.phone}
              meta="Reception · 24 hours"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 20 20 0 01-8.6-3.1 19.5 19.5 0 01-6-6A20 20 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.8.6a2 2 0 011.7 2z"/></svg>}
            />
            <Row
              title={PROPERTY.email}
              meta="Reservations"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>}
            />
          </div>
        </>
      )}

      {tab === 'nearby' && (
        <>
          {/* Mini map card */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              position: 'relative', height: 150, borderRadius: 20,
              background: 'linear-gradient(135deg, var(--card) 0%, var(--card-2) 100%)',
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              {/* subtle grid */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
                <defs>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--border)" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)"/>
              </svg>
              {/* hotel pin */}
              <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 999,
                  background: 'var(--accent)', color: 'var(--on-black)',
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 0 0 6px rgba(216, 171, 122, 0.22), 0 0 0 12px rgba(216, 171, 122, 0.10)',
                  animation: 'pulseDot 2s ease-in-out infinite',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text)', fontWeight: 550, marginTop: 6 }}>Canyon Hotels</div>
              </div>
              {/* other pins, scattered */}
              {[
                { x: '20%', y: '30%' }, { x: '75%', y: '25%' }, { x: '30%', y: '75%' }, { x: '80%', y: '70%' },
              ].map((p, i) => (
                <div key={i} style={{
                  position: 'absolute', left: p.x, top: p.y,
                  width: 8, height: 8, borderRadius: 999,
                  background: 'var(--text-3)', opacity: 0.6,
                }}/>
              ))}
              <button className="btn sm" style={{
                position: 'absolute', right: 12, bottom: 12,
                background: 'var(--card)', backdropFilter: 'blur(10px)',
              }}>Open map →</button>
            </div>
          </div>

          <GroupHeader kicker="Essentials" title="Around the hotel" />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NEARBY.map(n => (
              <div key={n.n} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 14px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--accent-bg)',
                  border: '1px solid var(--accent-border)',
                  display: 'grid', placeItems: 'center',
                  color: 'var(--accent)', fontWeight: 550, fontSize: 14,
                }}>{n.pin}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{n.t} · {n.w}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>{n.d}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'notes' && (
        <>
          <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{NOTES.length} notes · shared with group</div>
            <button className="btn sm primary">+ New note</button>
          </div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {NOTES.map((n, i) => (
              <div key={i} style={{
                padding: 16,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{n.time}</div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.45 }}>{n.body}</div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text-3)' }}>
                  by <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{n.by}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 20 }} />
    </Page>
  );
}

window.GuideScreen = GuideScreen;
