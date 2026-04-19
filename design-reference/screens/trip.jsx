// Our Trip — Group, flights, packing, files, notes

const MEMBERS = [
  { name: 'Peter Karl Gumapoz',     role: 'Primary', init: 'P', color: '#a64d1e', you: true },
  { name: 'Aaron Nicholas Gumapoz', role: 'Member',  init: 'A', color: '#b8892b' },
  { name: 'Jane Ansen Colada',      role: 'Member',  init: 'J', color: '#c66a36' },
];

const FLIGHTS = [
  {
    dir: 'Outbound', airline: 'Cebu Pacific', code: '5J', num: '911',
    ref: 'VN3HTQ', logo: 'var(--text-2)',
    date: 'Sun, Apr 20', dep: '7:30 PM', arr: '8:40 PM',
    from: 'MNL', fromCity: 'Manila', to: 'MPH', toCity: 'Caticlan',
    dur: '1h 10m',
    bags: [{ who: 'Peter', bag: '+20 kg' }, { who: 'Aaron', bag: 'Pack light' }, { who: 'Jane', bag: 'Pack light' }],
    status: 'On time',
  },
  {
    dir: 'Return', airline: 'Philippines AirAsia', code: 'Z2', num: '214',
    ref: 'J6FF4V', logo: '#e03838',
    date: 'Sun, Apr 27', dep: '9:10 AM', arr: '10:20 AM',
    from: 'MPH', fromCity: 'Caticlan', to: 'MNL', toCity: 'Manila',
    dur: '1h 10m',
    bags: [{ who: 'Peter', bag: '+15 kg' }, { who: 'Aaron', bag: 'Pack light' }, { who: 'Jane', bag: 'Pack light' }],
    status: 'On time',
  },
];

const PACKING = {
  'Essentials': [
    { t: 'Passport + ID', by: 'Peter', d: true },
    { t: 'Phone charger', by: 'Peter', d: true },
    { t: 'Hotel vouchers', by: 'Peter', d: true },
    { t: 'Toiletries kit', by: 'Aaron', d: false },
    { t: 'Prescription meds', by: 'Jane', d: false },
  ],
  'Beach': [
    { t: 'Swimsuits × 3', by: 'Everyone', d: true },
    { t: 'Sunscreen (SPF 50)', by: 'Aaron', d: true },
    { t: 'Beach towels × 3', by: 'Peter', d: false },
    { t: 'Waterproof pouch', by: 'Jane', d: false },
    { t: 'Reef-safe flip flops', by: 'Peter', d: false },
  ],
  'Electronics': [
    { t: 'GoPro + mount', by: 'Peter', d: true },
    { t: 'Power bank', by: 'Aaron', d: false },
    { t: 'Universal adapter', by: 'Peter', d: false },
  ],
};

const FILES = [
  { n: 'Booking_ID_1712826310_ETicket.pdf', size: '842 KB', t: 'Ticket',    who: 'Peter', icon: '#a64d1e' },
  { n: 'AGODA_Receipt_Canyon_Hotels.pdf',   size: '1.2 MB', t: 'Receipt',   who: 'Peter', icon: '#c66a36' },
  { n: 'Z2_214_Boarding_Passes.pdf',        size: '640 KB', t: 'Boarding',  who: 'Peter', icon: '#b8892b' },
  { n: 'Travel_Insurance_Policy.pdf',       size: '320 KB', t: 'Insurance', who: 'Peter', icon: '#d9a441' },
];

function TripScreen() {
  const [tab, setTab] = React.useState(() => {
    try { return localStorage.getItem('afterstay_trip_tab') || 'overview'; } catch { return 'overview'; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('afterstay_trip_tab', tab); } catch {}
  }, [tab]);

  const [addOpen, setAddOpen] = React.useState(false);
  // Allow child components (empty state, past-trips section) to open the sheet
  React.useEffect(() => { window.__openAddTrip = () => setAddOpen(true); }, []);

  return (
    <Page>
      <TopBar title="Trips" right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn round"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/></svg></button>
          <button className="icon-btn round"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/></svg></button>
        </div>
      } />

      {/* Active trip pill — only on Overview (where it's contextual) */}
      {tab === 'overview' && (
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px 6px 8px',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-border)',
            borderRadius: 999,
            fontSize: 11, fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '0.04em',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 99,
              background: 'var(--accent)',
              animation: 'livePulse 1.6s ease-in-out infinite',
            }}/>
            LIVE · BORACAY · APR 20–27
          </div>
        </div>
      )}
      {/* Segmented */}
      <div style={{ padding: '4px 16px 16px' }}>
        <div className="seg" style={{ width: '100%' }}>
          {['overview', 'summary', 'moments', 'flights', 'packing', 'files'].map(t => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          <GroupHeader kicker="Group · 3 travelers" title="Who's going" action={<button className="btn sm ghost" style={{ color: 'var(--accent)', border: 'none' }}>Invite +</button>} />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MEMBERS.map(m => (
              <div key={m.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 999,
                  background: m.color, color: '#0b0f14',
                  display: 'grid', placeItems: 'center',
                  fontSize: 13, fontWeight: 550,
                }}>{m.init}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {m.name}
                    {m.you && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 550 }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{m.role} · Booking linked</div>
                </div>
                <button className="icon-btn round" style={{ width: 32, height: 32 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <GroupHeader kicker="Accommodation" title="Canyon Hotels & Resorts" action={<span className="stat-chip" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>Paid</span>} />
          <div style={{ padding: '0 16px' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  backgroundImage: `url("${HOTEL_PHOTOS[0]}")`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  border: '1px solid var(--border)',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Executive Suite × 2</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Station B, Sitio Sinagpa, Balabag</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 550, textTransform: 'uppercase' }}>Check-in</div>
                  <div style={{ color: 'var(--text)', marginTop: 3, fontWeight: 600 }}>Apr 20 · 3:00 PM</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 550, textTransform: 'uppercase' }}>Checkout</div>
                  <div style={{ color: 'var(--text)', marginTop: 3, fontWeight: 600 }}>Apr 27 · 12:00 PM</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 550, textTransform: 'uppercase' }}>Total</div>
                  <div style={{ color: 'var(--text)', marginTop: 3, fontWeight: 600 }} className="mono">₱49,491.74</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 550, textTransform: 'uppercase' }}>Split / person</div>
                  <div style={{ color: 'var(--text)', marginTop: 3, fontWeight: 600 }} className="mono">₱16,497.25</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button className="btn sm primary" style={{ flex: 1 }}>Sync details</button>
              </div>
            </div>
          </div>

          <GroupHeader kicker="Transit · Both ways" title="Flights" />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FLIGHTS.map(f => <MiniFlightCard key={f.ref} f={f} />)}
          </div>
        </>
      )}

      {tab === 'summary' && <SummaryTab />}

      {tab === 'flights' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FLIGHTS.map(f => <FullFlightCard key={f.ref} f={f} />)}
        </div>
      )}

      {tab === 'moments' && <MomentsTab />}

      {tab === 'packing' && (
        <>
          <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 550 }}>7</span> of 13 packed
            </div>
            <button className="btn sm primary">+ Add item</button>
          </div>
          {Object.entries(PACKING).map(([group, items]) => (
            <div key={group}>
              <GroupHeader kicker={group} title={`${items.filter(i => i.d).length} / ${items.length} ready`} />
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map(it => (
                  <div key={it.t} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    opacity: it.d ? 0.7 : 1,
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: it.d ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${it.d ? 'var(--accent)' : 'var(--border-2)'}`,
                      display: 'grid', placeItems: 'center',
                      color: 'var(--on-black)',
                    }}>
                      {it.d && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', textDecoration: it.d ? 'line-through' : 'none' }}>{it.t}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, padding: '3px 8px', background: 'var(--card-2)', borderRadius: 99 }}>{it.by}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'files' && (
        <>
          <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{FILES.length} files · 3.0 MB</div>
            <button className="btn sm primary">+ Upload</button>
          </div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FILES.map(f => (
              <div key={f.n} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 14px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
              }}>
                <div style={{
                  width: 40, height: 44, borderRadius: 7,
                  background: `${f.icon}20`, color: f.icon,
                  display: 'grid', placeItems: 'center',
                  border: `1px solid ${f.icon}40`,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/>
                    <polyline points="14 3 14 8 19 8"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{f.t} · {f.size} · by {f.who}</div>
                </div>
                <button className="icon-btn round" style={{ width: 32, height: 32 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 20 }} />

      {/* FAB — Add trip */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add trip"
        style={{
          position: 'absolute',
          right: 18, bottom: 100,
          width: 52, height: 52, borderRadius: 99,
          background: 'var(--accent)', color: '#fffaf0',
          border: 'none', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 10px 26px rgba(166, 77, 30, 0.35), 0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 60,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.94)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Add-trip bottom sheet */}
      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </Page>
  );
}

function MiniFlightCard({ f }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: f.logo, color: '#fff',
            display: 'grid', placeItems: 'center',
            fontSize: 9, fontWeight: 600,
          }}>{f.code}</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 550, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{f.dir}</div>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginTop: 1 }}>{f.code} {f.num} · {f.date}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }} className="mono">Ref {f.ref}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
        <div>
          <div className="display mono" style={{ fontSize: 18, color: 'var(--text)' }}>{f.from}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{f.dep}</div>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{f.dur}</div>
        <div style={{ textAlign: 'right' }}>
          <div className="display mono" style={{ fontSize: 18, color: 'var(--text)' }}>{f.to}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{f.arr}</div>
        </div>
      </div>
    </div>
  );
}

function FullFlightCard({ f }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: f.logo, color: '#fff',
            display: 'grid', placeItems: 'center',
            fontSize: 11, fontWeight: 600,
          }}>{f.code}</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 550, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.dir}</div>
            <div style={{ fontSize: 14, fontWeight: 550, color: 'var(--text)', marginTop: 1 }}>{f.airline}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{f.code} {f.num} · Ref <span className="mono">{f.ref}</span></div>
          </div>
        </div>
        <span className="stat-chip" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--accent)' }}/> {f.status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div>
          <div className="display mono" style={{ fontSize: 26, color: 'var(--text)' }}>{f.from}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3, fontWeight: 600 }}>{f.dep}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{f.fromCity} · {f.date}</div>
        </div>
        <div style={{ color: 'var(--text-3)', textAlign: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16.5 17.2 14 16l-2 3-2-3-2.5 1.2-1.3 2L2 17l1.5-2L8 13l-2-8 2 1 4 6 4-6 2-1-2 8 4.5 2L22 17z"/>
          </svg>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>{f.dur}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="display mono" style={{ fontSize: 26, color: 'var(--text)' }}>{f.to}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3, fontWeight: 600 }}>{f.arr}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{f.toCity} · {f.date}</div>
        </div>
      </div>
      <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Baggage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {f.bags.map(b => (
            <div key={b.who} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>{b.who}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{b.bag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Summary ---------- */

const PAST_TRIPS = [
  { flag: '🇯🇵', dest: 'Tokyo',       country: 'Japan',       dates: 'Nov 2 – 9, 2025',   nights: 7, spent: 68200, miles: 1860, rating: 5 },
  { flag: '🇻🇳', dest: 'Da Nang',     country: 'Vietnam',     dates: 'Jul 14 – 19, 2025', nights: 5, spent: 32400, miles: 1085, rating: 4 },
  { flag: '🇵🇭', dest: 'Siargao',     country: 'Philippines', dates: 'Mar 8 – 13, 2025',  nights: 5, spent: 28900, miles: 450,  rating: 5 },
  { flag: '🇹🇭', dest: 'Bangkok',     country: 'Thailand',    dates: 'Dec 20 – 27, 2024', nights: 7, spent: 45600, miles: 1370, rating: 4 },
  { flag: '🇸🇬', dest: 'Singapore',   country: 'Singapore',   dates: 'Aug 3 – 6, 2024',   nights: 3, spent: 39800, miles: 1480, rating: 5 },
];

// Highlights as a horizontal-scroll rail — future-proofs to more cards as data grows
const HIGHLIGHTS = [
  { icon: '🌏', label: '5 countries', sub: 'JP · VN · TH · SG · PH', tint: '#c66a36' },
  { icon: '✈️', label: '6,245 miles', sub: '25× around Boracay',    tint: '#a64d1e' },
  { icon: '🏝',  label: 'Beach streak', sub: '4 trips in a row',     tint: '#b8892b' },
  { icon: '📸', label: '238 moments',  sub: 'Across all trips',     tint: '#d9a441' },
  { icon: '🗓',  label: 'Longest trip', sub: '7 nights · Tokyo',     tint: '#8a5a2b' },
  { icon: '💸', label: 'Best value',   sub: '₱5,780/night · Siargao', tint: '#7e9f5b' },
  { icon: '👥', label: 'Trip crew',    sub: 'Aaron · Jane',          tint: '#c06c4a' },
  { icon: '⭐', label: 'Top-rated',    sub: '3 perfect trips',       tint: '#e0a23f' },
];

function SummaryTab() {
  const [forceEmpty, setForceEmpty] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}').summaryState === 'empty';
    } catch { return false; }
  });
  React.useEffect(() => {
    const onTweak = (e) => setForceEmpty(e.detail?.summaryState === 'empty');
    window.addEventListener('afterstay:tweaks', onTweak);
    return () => window.removeEventListener('afterstay:tweaks', onTweak);
  }, []);

  const hasTrips = !forceEmpty && PAST_TRIPS.length > 0;

  if (!hasTrips) {
    return <SummaryEmptyState />;
  }

  const totalTrips = PAST_TRIPS.length + 1; // +1 for current Boracay
  const totalSpent = PAST_TRIPS.reduce((s, t) => s + t.spent, 0) + 18400;
  const totalNights = PAST_TRIPS.reduce((s, t) => s + t.nights, 0) + 2;
  const totalMiles = PAST_TRIPS.reduce((s, t) => s + t.miles, 0);
  const countries = new Set(PAST_TRIPS.map(t => t.flag)).size;

  return (
    <>
      <TripConstellationHero miles={totalMiles} trips={totalTrips} countries={countries} nights={totalNights} spent={totalSpent} pastTrips={PAST_TRIPS} />

      {/* Highlights — horizontal scroll */}
      <GroupHeader kicker="Highlights" title="Your travel story" />
      <div style={{
        display: 'flex', gap: 10,
        padding: '0 16px 4px',
        overflowX: 'auto', overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }} className="hl-rail">
        {HIGHLIGHTS.map((a, i) => (
          <div key={a.label} style={{
            flex: '0 0 auto',
            width: 140,
            padding: '14px 14px 16px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            scrollSnapAlign: 'start',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 60, height: 60, borderRadius: 99,
              background: a.tint, opacity: 0.08,
            }}/>
            <div style={{ fontSize: 22, marginBottom: 8, position: 'relative' }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', position: 'relative' }}>{a.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, position: 'relative', lineHeight: 1.35 }}>{a.sub}</div>
          </div>
        ))}
        {/* Spacer so last card doesn't hug the edge */}
        <div style={{ flex: '0 0 6px' }}/>
      </div>

      {/* Past trips */}
      <GroupHeader kicker={`Past trips · ${PAST_TRIPS.length}`} title="Where you've been" action={<button className="btn sm ghost" style={{ color: 'var(--accent)', border: 'none' }}>View all</button>} />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PAST_TRIPS.map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--card-2)',
              display: 'grid', placeItems: 'center',
              fontSize: 20,
              border: '1px solid var(--border)',
            }}>{t.flag}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.dest}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.dates} · {t.nights} nights</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>₱{t.spent.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, letterSpacing: '0.1em' }}>
                {'★'.repeat(t.rating)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - t.rating)}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Add-a-past-trip row */}
        <button
          onClick={() => window.__openAddTrip && window.__openAddTrip()}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: 'transparent',
            border: '1.5px dashed var(--border-2)',
            borderRadius: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-border)',
            color: 'var(--accent)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Add a past trip</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Backfill your travel history</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <div style={{ height: 16 }} />

      <style>{`
        .hl-rail::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}

/* ---------- Constellation hero for Summary ---------- */
// Anchors "6,245 miles traveled" with visual weight:
// a constellation of the user's actual trip destinations,
// connected with thin lines to Home base (Manila).

function TripConstellationHero({ miles, trips, countries, nights, spent, pastTrips }) {
  // Fixed pseudo-coordinates laid out within the hero — one star per destination + home base
  const W = 320, H = 120;
  const HOME = { x: 48, y: 72, label: 'MNL', home: true };
  const STARS = [
    { x: 88,  y: 42, label: 'TOK', flag: '🇯🇵' },
    { x: 130, y: 86, label: 'DAD', flag: '🇻🇳' },
    { x: 78,  y: 96, label: 'IAO', flag: '🇵🇭' },
    { x: 172, y: 58, label: 'BKK', flag: '🇹🇭' },
    { x: 208, y: 92, label: 'SIN', flag: '🇸🇬' },
    { x: 244, y: 50, label: 'MPH', flag: '🌴', current: true },
  ];

  return (
    <div style={{ padding: '0 16px 8px' }}>
      <div style={{
        position: 'relative',
        padding: '16px 18px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(192, 108, 74, 0.12), transparent 60%)',
          pointerEvents: 'none',
        }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>Lifetime · since 2024</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <div className="display" style={{ fontSize: 44, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>{miles.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 550 }}>miles traveled</div>
          </div>
        </div>

        {/* Constellation map */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="120"
          style={{ display: 'block', marginTop: 8, position: 'relative' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Connection lines from home base to each star */}
          {STARS.map((s, i) => (
            <line
              key={`l-${i}`}
              x1={HOME.x} y1={HOME.y}
              x2={s.x} y2={s.y}
              stroke="var(--accent)"
              strokeWidth="0.7"
              strokeDasharray="2 2"
              opacity={s.current ? 0.8 : 0.35}
              style={{
                animation: `constDraw 1.2s ease-out ${i * 0.12}s both`,
              }}
            />
          ))}

          {/* Home base */}
          <g transform={`translate(${HOME.x},${HOME.y})`}>
            <circle r="7" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.35"/>
            <circle r="4" fill="var(--accent)"/>
            <text x="0" y="18" textAnchor="middle" fill="var(--text-3)" fontSize="7" fontWeight="700" letterSpacing="0.1em" style={{ fontFamily: 'inherit' }}>HOME</text>
          </g>

          {/* Destination stars */}
          {STARS.map((s, i) => (
            <g key={`s-${i}`} transform={`translate(${s.x},${s.y})`} style={{ animation: `starPop 0.4s ease-out ${0.3 + i * 0.1}s both` }}>
              {s.current && (
                <circle r="8" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/>
                </circle>
              )}
              <circle r={s.current ? 3.5 : 2.5} fill={s.current ? 'var(--accent)' : 'var(--text)'}/>
              <text x="0" y="-7" textAnchor="middle" fill="var(--text-2)" fontSize="6.5" fontWeight="600" style={{ fontFamily: 'inherit' }}>{s.label}</text>
            </g>
          ))}
        </svg>

        {/* Stats row */}
        <div style={{
          display: 'flex', marginTop: 12, paddingTop: 14,
          borderTop: '1px dashed var(--border-2)',
        }}>
          <SummaryStat num={trips} label="Trips" />
          <SummaryStat num={countries} label="Countries" />
          <SummaryStat num={nights} label="Nights" />
          <SummaryStat num={`₱${(spent / 1000).toFixed(0)}k`} label="Spent" last />
        </div>
      </div>

      <style>{`
        @keyframes constDraw {
          from { stroke-dashoffset: 120; opacity: 0; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes starPop {
          from { opacity: 0; transform-origin: center; }
          to { opacity: 1; }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

/* ---------- Empty state ---------- */

function SummaryEmptyState() {
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{
        position: 'relative',
        padding: '32px 20px 24px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Background constellation art */}
        <svg viewBox="0 0 300 120" width="100%" height="120" style={{ display: 'block', opacity: 0.7 }}>
          {[
            [60, 70], [110, 40], [160, 80], [210, 35], [250, 75],
          ].map(([x, y], i, arr) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <line x1={arr[i-1][0]} y1={arr[i-1][1]} x2={x} y2={y} stroke="var(--accent)" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.5"/>
              )}
              <circle cx={x} cy={y} r="3" fill="var(--accent)">
                <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + (i % 3) * 0.5}s`} repeatCount="indefinite" begin={`${i * 0.3}s`}/>
              </circle>
            </React.Fragment>
          ))}
        </svg>

        <div className="display" style={{ fontSize: 22, color: 'var(--text)', marginTop: 10, letterSpacing: '-0.02em' }}>Your travel story starts here</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8, maxWidth: 260, margin: '8px auto 0', lineHeight: 1.5 }}>
          Every trip becomes a star in your personal constellation — distances, destinations, and the people you went with.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          <button className="btn primary" style={{ width: '100%' }}>Plan your first trip</button>
          <button className="btn sm ghost" style={{ width: '100%', color: 'var(--text-2)' }} onClick={() => window.__openAddTrip && window.__openAddTrip()}>Or add a past trip →</button>
        </div>

        <div style={{
          marginTop: 20, paddingTop: 16,
          borderTop: '1px dashed var(--border-2)',
          fontSize: 10.5, color: 'var(--text-3)', letterSpacing: '0.04em',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>1 trip · 500+ miles</span> unlocks your first highlight
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ num, label, last }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center',
      borderRight: last ? 'none' : '1px solid var(--border-2)',
    }}>
      <div className="display" style={{ fontSize: 20, color: 'var(--text)', lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 5, letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

/* ---------- Add trip bottom sheet ---------- */

function AddTripSheet({ open, onClose }) {
  const [kind, setKind] = React.useState('upcoming'); // upcoming | past
  const [dest, setDest] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [members, setMembers] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      // Reset after close animation
      setTimeout(() => {
        setKind('upcoming'); setDest(''); setStart(''); setEnd(''); setMembers(''); setSaved(false);
      }, 240);
    }
  }, [open]);

  function submit() {
    if (!dest.trim()) return;
    setSaved(true);
    setTimeout(() => onClose(), 900);
  }

  const SUGGESTED = ['Seoul', 'Bali', 'Taipei', 'Hong Kong', 'Hanoi', 'Kyoto'];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(20, 12, 6, 0.42)',
            zIndex: 70,
            animation: 'sheetBackIn 0.25s ease-out',
          }}
        />
      )}

      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--bg)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: '0 -12px 40px rgba(0,0,0,0.25)',
        zIndex: 71,
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)',
        maxHeight: '88%',
        overflow: 'auto',
        paddingBottom: 20,
      }}>
        {/* Handle */}
        <div style={{ padding: '10px 0 0', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: 'var(--border-2)' }}/>
        </div>

        {/* Header */}
        <div style={{ padding: '14px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--accent)' }}>New entry</div>
            <div className="display" style={{ fontSize: 20, color: 'var(--text)', marginTop: 2 }}>Add a trip</div>
          </div>
          <button className="icon-btn round" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Kind toggle */}
        <div style={{ padding: '14px 20px 8px' }}>
          <div className="seg" style={{ width: '100%' }}>
            <button className={kind === 'upcoming' ? 'active' : ''} onClick={() => setKind('upcoming')}>Upcoming</button>
            <button className={kind === 'past' ? 'active' : ''} onClick={() => setKind('past')}>Past trip</button>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Destination">
            <input
              type="text"
              placeholder="e.g. Seoul, Bali, Tokyo"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  onClick={() => setDest(s)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 11, fontWeight: 550,
                    background: 'var(--card-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                    borderRadius: 99,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{s}</button>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={kind === 'past' ? 'Started' : 'Departing'}>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle}/>
            </Field>
            <Field label={kind === 'past' ? 'Ended' : 'Returning'}>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle}/>
            </Field>
          </div>

          <Field label="Traveling with (optional)" hint="Comma-separated names">
            <input
              type="text"
              placeholder="e.g. Aaron, Jane"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              style={inputStyle}
            />
          </Field>

          {kind === 'upcoming' && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--accent-bg)',
              border: '1px solid var(--accent-border)',
              borderRadius: 12,
              display: 'flex', alignItems: 'flex-start', gap: 10,
              fontSize: 11.5, color: 'var(--text-2)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div>We'll scan your email for flight + hotel bookings matching this trip.</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px 6px', display: 'flex', gap: 10 }}>
          <button className="btn sm" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button
            className="btn primary sm"
            onClick={submit}
            disabled={!dest.trim() || saved}
            style={{
              flex: 2,
              opacity: (!dest.trim() || saved) ? 0.6 : 1,
            }}
          >
            {saved ? '✓ Added' : kind === 'past' ? 'Save past trip' : 'Create trip'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sheetBackIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 10.5, fontWeight: 650, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  fontSize: 13, fontWeight: 500,
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

window.TripScreen = TripScreen;
