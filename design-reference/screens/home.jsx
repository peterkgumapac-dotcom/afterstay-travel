// Home — Hey Peter, countdown, flight, stay, weather, quick access, FAB

const TRIP = {
  destination: 'Boracay, Philippines',
  hotel: 'Canyon Hotels & Resorts Boracay',
  start: new Date('2026-04-20T15:00:00+08:00'),
  end:   new Date('2026-04-27T12:00:00+08:00'),
  confirmation: '1712826310',
};

const GROUP = [
  { name: 'Peter',  role: 'Primary', init: 'P', color: '#a64d1e' },
  { name: 'Aaron',  role: 'Member',  init: 'A', color: '#b8892b' },
  { name: 'Jane',   role: 'Member',  init: 'J', color: '#c66a36' },
];

function useCountdown(target) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s, total: diff };
}

// Flashing slideshow hero (Canyon Hotels-style rotation)
function FlashingHero({ height = 380, radius = 24, photos = HOTEL_PHOTOS }) {
  const dur = photos.length * 4.5;
  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', borderRadius: radius, border: '1px solid var(--border)' }}>
      {photos.map((src, i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${src}")`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0,
          animation: `slideshow ${dur}s infinite ${i * 4.5}s, kenburns 16s ease-in-out ${i * 4.5}s infinite alternate`,
        }} />
      ))}
      {/* dark gradient overlay for legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)',
      }} />
      {/* pagination dots */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        display: 'flex', gap: 4,
      }}>
        {photos.map((_, i) => (
          <div key={i} style={{
            width: 18, height: 3, borderRadius: 3,
            background: 'rgba(255,255,255,0.4)',
            animation: `slideshow ${dur}s infinite ${i * 4.5}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// Countdown card — clean typographic grid, not a joke
function CountdownCard({ cd, onBoard }) {
  const label = TRIP.start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const units = [
    { v: cd.d, l: 'DAYS' },
    { v: cd.h, l: 'HRS' },
    { v: cd.m, l: 'MIN' },
    { v: cd.s, l: 'SEC' },
  ];
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      padding: '18px 20px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Arriving in</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginTop: 4 }}>{label}</div>
        </div>
        <div className="stamp">✈ Departing</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {units.map((u, i) => (
          <div key={u.l} style={{
            textAlign: 'center',
            padding: '14px 6px',
            background: 'var(--card-2)',
            borderRadius: 14,
            border: '1px solid var(--border)',
          }}>
            <div className="mono display" style={{
              fontSize: 30, fontWeight: 550, lineHeight: 1, color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>{String(u.v).padStart(2, '0')}</div>
            <div style={{
              fontSize: 9, fontWeight: 550, letterSpacing: '0.14em',
              color: 'var(--text-3)', marginTop: 8,
            }}>{u.l}</div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '16px 0 14px' }}/>

      {/* Manual boarding CTA */}
      <button
        onClick={onBoard}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid #2a1810',
          background: '#3d2416',
          color: '#fffaf0',
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(61, 36, 22, 0.32)',
          textAlign: 'left',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 99,
            background: 'rgba(255,250,240,0.22)',
            border: '1px solid rgba(255,250,240,0.35)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fffaf0">
              <path d="M2 16l20-6L2 4l2 6-2 6z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.85 }}>
              At the gate?
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 1 }}>
              I'm boarding now
            </div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
}

// Flight progress card — shows while the user is on the plane.
// Play button rotates a compass and animates the plane along an arc to its ETA.
function FlightProgressCard({ onLanded }) {
  const [playing, setPlaying] = React.useState(true);
  const [progress, setProgress] = React.useState(0.32); // 0 -> 1
  const totalMin = 70;
  const elapsedMin = Math.round(totalMin * progress);
  const remainingMin = totalMin - elapsedMin;
  const eta = '8:40 PM';

  // Drift the progress forward while playing
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress(p => Math.min(1, p + 0.008));
    }, 900);
    return () => clearInterval(id);
  }, [playing]);

  // Plane pose along the arc path (path length ~ 300 units)
  const pathD = "M 24 72 Q 150 -10 276 72";
  const arcLen = 320;

  return (
    <div style={{
      position: 'relative',
      background: 'transparent',
      color: 'var(--ink)',
      padding: '4px 2px 0',
    }}>
      {/* Top row: label • eta, status chip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--muted)',
          }}>Arriving in</span>
          <span className="mono" style={{
            fontSize: 15, fontWeight: 600, color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
          }}>
            {remainingMin}m
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>· ETA {eta}</span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 99,
          background: 'rgba(125, 220, 150, 0.14)',
          border: '1px solid rgba(125, 220, 150, 0.35)',
          fontSize: 9.5, fontWeight: 650,
          color: '#2f7a46',
          letterSpacing: '0.04em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: '#4fb372',
            animation: 'pulse 1.6s ease-in-out infinite' }}/>
          IN FLIGHT
        </div>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--line)', marginBottom: 10 }}/>

      {/* Arc strip — compact */}
      <div style={{ position: 'relative', padding: '0 4px' }}>
        <svg viewBox="0 0 300 56" style={{ width: '100%', height: 56, display: 'block', overflow: 'visible' }}>
          <defs>
            <path id="flightArc" d="M 20 46 Q 150 -8 280 46"/>
          </defs>
          {/* remaining arc (dashed, subtle) */}
          <use href="#flightArc" stroke="var(--line-strong, rgba(61,36,22,0.25))" strokeWidth="1.2" fill="none"
               strokeDasharray="3 4"/>
          {/* completed arc */}
          <use href="#flightArc" stroke="var(--accent)" strokeWidth="2" fill="none"
               strokeLinecap="round"
               strokeDasharray={arcLen} strokeDashoffset={arcLen * (1 - progress)}
               style={{ transition: 'stroke-dashoffset 0.9s linear' }}/>
          {/* origin + dest markers */}
          <circle cx="20" cy="46" r="3.5" fill="var(--ink)"/>
          <circle cx="280" cy="46" r="3.5" fill="var(--accent)"/>
          <circle cx="280" cy="46" r="7" fill="none" stroke="var(--accent)" strokeOpacity="0.5"
                  style={{ animation: 'pulseRing 2s ease-out infinite' }}/>

          {/* Plane — computed position + angle along the quadratic Bezier */}
          {(() => {
            // Bezier: P0(20,46), P1(150,-8), P2(280,46)
            const t = progress;
            const x = (1-t)*(1-t)*20 + 2*(1-t)*t*150 + t*t*280;
            const y = (1-t)*(1-t)*46 + 2*(1-t)*t*-8  + t*t*46;
            // Tangent
            const dx = 2*(1-t)*(150-20) + 2*t*(280-150);
            const dy = 2*(1-t)*(-8-46) + 2*t*(46-(-8));
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <g transform={`translate(${x} ${y}) rotate(${angle})`} style={{ transition: 'transform 0.9s linear' }}>
                {/* White halo so plane pops off arc + background */}
                <circle cx="0" cy="0" r="12" fill="#fffaf0" opacity="0.9"/>
                <circle cx="0" cy="0" r="12" fill="none" stroke="var(--accent)" strokeWidth="0.8" opacity="0.35"/>
                {/* Plane body — top-down view, deep espresso for contrast */}
                <g transform="scale(1.6)">
                  {/* Main wings (swept) */}
                  <path d="M0 0 L-5 -6 L-6.5 -6 L-1 0 L-6.5 6 L-5 6 Z" fill="#3d2416"/>
                  {/* Fuselage */}
                  <path d="M-6 -1.1 L4 -1.3 L6 -0.6 L6.4 0 L6 0.6 L4 1.3 L-6 1.1 Z" fill="#3d2416"/>
                  {/* Tail fin */}
                  <path d="M-6 0 L-8 -3 L-5.8 -3 L-4.5 0 L-5.8 3 L-8 3 Z" fill="#3d2416"/>
                  {/* Cockpit window */}
                  <ellipse cx="4" cy="0" rx="1.2" ry="0.6" fill="#ffd9a8"/>
                </g>
              </g>
            );
          })()}
        </svg>

        {/* Origin / Dest labels — status bar style */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: -4, padding: '0 2px',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.04em' }}>MNL</div>
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>Manila</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em' }}>MPH</div>
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>Caticlan</div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--line)', margin: '10px 0 0' }}/>

      {/* Status bar row: stats separated by vertical rules */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
        alignItems: 'center',
        padding: '8px 0 2px',
      }}>
        <Stat label="Progress" value={`${Math.round(progress * 100)}%`} />
        <div style={{ width: 1, height: 22, background: 'var(--line)' }}/>
        <Stat label="Altitude" value="34,000 ft" />
        <div style={{ width: 1, height: 22, background: 'var(--line)' }}/>
        <Stat label="Speed" value="820 km/h" />
      </div>

      {/* I've landed CTA */}
      <div style={{ height: 1, background: 'var(--line)', margin: '10px 0 0' }}/>
      <button
        onClick={onLanded}
        style={{
          marginTop: 10,
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 12,
          border: 'none',
          background: '#3d2416',
          color: '#fffaf0',
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(61, 36, 22, 0.32)',
          textAlign: 'left',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 99,
            background: 'rgba(255,250,240,0.22)',
            border: '1px solid rgba(255,250,240,0.35)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 22h20"/>
              <path d="M5.5 16l14-3.5a2 2 0 00-1.4-2.4l-2-.5-4-6-2 .4 1.6 5.2-4 1-2-1.5-1.2.3z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.85 }}>
              Wheels down?
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 1 }}>
              I've landed
            </div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.8); opacity: 0.5; }
        }
        @keyframes pulseRing {
          0% { r: 7; opacity: 0.5; }
          100% { r: 14; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 6px' }}>
      <div style={{
        fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--muted)',
        marginBottom: 2,
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: 12, fontWeight: 600, color: 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

// "Arrived" state — welcome + manual "Start trip" button
function ArrivedCard({ onStart }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--accent-bg) 0%, var(--card) 100%)',
      border: '1px solid var(--accent-border)',
      borderRadius: 22,
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--accent)',
          color: '#fffaf0',
          display: 'grid', placeItems: 'center',
          animation: 'bounce 2.2s ease-in-out infinite',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s-8-7-8-13a8 8 0 0116 0c0 6-8 13-8 13z"/>
            <circle cx="12" cy="9" r="3"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>Welcome to Boracay</div>
          <div className="display" style={{ fontSize: 20, letterSpacing: '-0.02em', marginTop: 2, color: 'var(--text)' }}>
            You've arrived
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            Check-in at Canyon Hotels · 2.1 km · 12 min by van
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--accent-border)', opacity: 0.6 }}/>

      {/* Manual Start Trip CTA */}
      <button
        onClick={onStart}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 14,
          border: 'none',
          background: '#3d2416',
          color: '#fffaf0',
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(61, 36, 22, 0.32)',
          textAlign: 'left',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 99,
            background: 'rgba(255,250,240,0.22)',
            border: '1px solid rgba(255,250,240,0.35)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="#fffaf0" stroke="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.85 }}>
              I'm at the hotel
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 1 }}>
              Explore now
            </div>
          </div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </button>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// "Active" state — trip is live, show current moment + next up
// "Active" state — dual status bar: days countdown + budget
function TripActiveCard() {
  // Read budgetState from tweaks so Home Active card stays in sync with Budget screen
  const [bState, setBState] = React.useState(() => {
    try { return (JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}').budgetState) || 'cruising'; } catch { return 'cruising'; }
  });
  React.useEffect(() => {
    const onTweaks = (e) => { if (e.detail && e.detail.budgetState) setBState(e.detail.budgetState); };
    window.addEventListener('afterstay:tweaks', onTweaks);
    return () => window.removeEventListener('afterstay:tweaks', onTweaks);
  }, []);

  // Mock trip: 7 nights, day 2 of 7 (mid-trip)
  const dayOfTrip = 2;
  const totalDays = 7;
  const daysLeft = totalDays - dayOfTrip;
  const tripPct = (dayOfTrip / totalDays) * 100;

  // Mock budget — spent scales with budgetState so Home reflects the chosen scenario
  const budget = 50000;     // ₱ budget
  const spent = bState === 'over' ? 44000       // exceeded pace (88%)
              : bState === 'low' ? 32500        // running low (65%, over pace)
              : 18400;                          // cruising (37%, on pace)
  const spentPct = (spent / budget) * 100;
  // expected pace at this point in the trip (linear)
  const expectedPct = tripPct;
  // Drive status directly from bState so the pill label is stable regardless of numbers
  const overspending = bState === 'over';
  const watch = bState === 'low';
  const onPace = bState === 'cruising';

  const status = overspending
    ? { label: 'Overspending', tone: '#b04a2a', bg: 'rgba(176,74,42,0.12)', border: 'rgba(176,74,42,0.35)', hint: `₱${(spent - Math.round(budget * expectedPct / 100)).toLocaleString()} past pace` }
    : watch
    ? { label: 'Watch spending', tone: '#8b6f2f', bg: 'rgba(200,160,60,0.14)', border: 'rgba(200,160,60,0.35)', hint: `₱${(budget - spent).toLocaleString()} left for ${daysLeft} days · above pace` }
    : { label: 'On pace', tone: '#2f7a46', bg: 'rgba(125,220,150,0.14)', border: 'rgba(125,220,150,0.35)', hint: `₱${(budget - spent).toLocaleString()} left for ${daysLeft} days` };

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Top row: Day label + TRIP LIVE pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--text-3)',
          }}>Boracay · Day {dayOfTrip} of {totalDays}</span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 99,
          background: 'rgba(125, 220, 150, 0.14)',
          border: '1px solid rgba(125, 220, 150, 0.35)',
          fontSize: 9.5, fontWeight: 650,
          color: '#2f7a46',
          letterSpacing: '0.04em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: '#4fb372',
            animation: 'pulseDot 1.6s ease-in-out infinite' }}/>
          TRIP LIVE
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }}/>

      {/* Days-left status bar */}
      <StatusBarRow
        kicker="DAYS LEFT"
        big={`${daysLeft}`}
        unit="days"
        hint={`${dayOfTrip} spent · returning Apr 27`}
        pct={tripPct}
        pctColor="#3d2416"
        pctLabel={`${Math.round(tripPct)}%`}
      />

      <div style={{ height: 1, background: 'var(--border)' }}/>

      {/* Budget — collapsed peek; tap to expand */}
      <BudgetPeek
        spent={spent} budget={budget} spentPct={spentPct} expectedPct={expectedPct}
        status={status} overspending={overspending} watch={watch}
      />

      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.8); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function BudgetStatusIcon({ overspending, watch, tone }) {
  // Overspending → pulsing warning flame
  // Watch → amber bell ring
  // On pace → steady heartbeat pulse
  if (overspending) {
    return (
      <span style={{ display: 'inline-flex', width: 22, height: 22, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 14 14" style={{ color: tone, animation: 'bsFlame 1.2s ease-in-out infinite' }}>
          <path d="M7 1.5c1.2 1.8 2.8 3 2.8 5.2a2.8 2.8 0 11-5.6 0c0-1 .4-1.8.4-2.8 0 1.2 1.4 1.8 2.4 1.8-.8-1.4-1.2-3.1 0-4.2z"
                fill="currentColor"/>
          <path d="M7 7.5c.8.9 1.4 1.5 1.4 2.5a1.4 1.4 0 11-2.8 0c0-.5.2-.9.4-1.4 0 .6.7.9 1.2.9-.4-.7-.6-1.5-.2-2z"
                fill="#fff" opacity="0.7"/>
        </svg>
        <span style={{
          position: 'absolute', inset: -2, borderRadius: 99,
          border: `1.5px solid ${tone}`, opacity: 0.4,
          animation: 'bsRing 1.6s ease-out infinite',
        }}/>
        <style>{`
          @keyframes bsFlame {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-1.5px) scale(1.14); }
          }
          @keyframes bsRing {
            0% { transform: scale(0.6); opacity: 0.6; }
            100% { transform: scale(1.35); opacity: 0; }
          }
        `}</style>
      </span>
    );
  }
  if (watch) {
    return (
      <span style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 14 14" style={{ color: tone, transformOrigin: '50% 20%', animation: 'bsBell 1.4s ease-in-out infinite' }}>
          <path d="M7 1.2c-.3 0-.5.2-.5.5v.6C4.8 2.7 3.6 4.3 3.6 6.2v2.2L2.6 10h8.8l-1-1.6V6.2c0-1.9-1.2-3.5-2.9-3.9v-.6c0-.3-.2-.5-.5-.5z"
                fill="currentColor"/>
          <path d="M5.8 10.8a1.2 1.2 0 002.4 0" stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        </svg>
        <style>{`
          @keyframes bsBell {
            0%, 100% { transform: rotate(-8deg); }
            25% { transform: rotate(10deg); }
            50% { transform: rotate(-6deg); }
            75% { transform: rotate(6deg); }
          }
        `}</style>
      </span>
    );
  }
  // on pace — heartbeat
  return (
    <span style={{ display: 'inline-flex', width: 24, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <svg width="24" height="20" viewBox="0 0 16 14" style={{ color: tone }}>
        <path d="M1 7h3l1.5-3.5L8 10l2-4 1.5 1H15"
              stroke="currentColor" strokeWidth="1.6" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="30" strokeDashoffset="30"
              style={{ animation: 'bsPulse 1.8s linear infinite' }}/>
      </svg>
      <style>{`
        @keyframes bsPulse {
          0% { stroke-dashoffset: 30; }
          60%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
      `}</style>
    </span>
  );
}

function BudgetPeek({ spent, budget, spentPct, expectedPct, status, overspending, watch }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', appearance: 'none', border: 'none', background: 'transparent',
          padding: 0, cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Budget</span>
          <BudgetStatusIcon overspending={overspending} watch={watch} tone={status.tone} />
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 8px', borderRadius: 99,
            background: status.bg, border: `1px solid ${status.border}`,
            color: status.tone,
          }}>
            {status.label.toUpperCase()}
          </span>
        </div>
        <span style={{
          fontSize: 11, color: 'var(--text-3)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {open ? 'Hide' : 'Peek'}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </svg>
        </span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ marginTop: 12, animation: 'peekOpen 0.25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                ₱{spent.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ ₱{budget.toLocaleString()}</span>
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(spentPct)}%</span>
          </div>
          <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--card-2)', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0,
              width: `${Math.min(100, spentPct)}%`,
              background: overspending
                ? 'linear-gradient(90deg, #3d2416 0%, #b04a2a 100%)'
                : watch
                ? 'linear-gradient(90deg, #3d2416 0%, #c8a03c 100%)'
                : '#3d2416',
              transition: 'width 0.6s ease',
            }}/>
            <div style={{
              position: 'absolute', top: -2, bottom: -2,
              left: `${expectedPct}%`, width: 2,
              background: 'var(--text-3)', opacity: 0.5,
            }}/>
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-3)' }}>
            {status.hint}
          </div>
        </div>
      )}
      <style>{`
        @keyframes peekOpen {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function StatusBarRow({ kicker, big, unit, hint, pct, pctColor, pctLabel }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{kicker}</span>
          <span className="mono display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{big}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{unit}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--card-2)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          width: `${pct}%`, background: pctColor,
          transition: 'width 0.6s ease',
        }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, fontSize: 10.5, color: 'var(--text-3)' }}>
        <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{pctLabel}</span>
      </div>
    </div>
  );
}

function FlightCard({ returnFlight = false }) {
  const flight = returnFlight
    ? {
        code: '5J 912', ref: 'VN3HTQ', date: 'Apr 27',
        depCity: 'Caticlan', depCode: 'MPH', depTime: '10:15 AM',
        arrCity: 'Manila',   arrCode: 'MNL', arrTime: '11:25 AM',
      }
    : {
        code: '5J 911', ref: 'VN3HTQ', date: 'Apr 20',
        depCity: 'Manila',   depCode: 'MNL', depTime: '7:30 PM',
        arrCity: 'Caticlan', arrCode: 'MPH', arrTime: '8:40 PM',
      };
  return (
    <div className="ticket" style={{ padding: 16, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--text-2)', color: 'var(--bg)',
            display: 'grid', placeItems: 'center',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
          }}>5J</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>Cebu Pacific · {flight.code}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Ref {flight.ref} · {flight.date}</div>
          </div>
        </div>
        <div className="stat-chip" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--accent)' }}/> On time
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 14 }}>
        <div>
          <div className="display mono" style={{ fontSize: 22, color: 'var(--text)' }}>{flight.depCode}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{flight.depTime} · {flight.depCity}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)' }}>
          <div style={{ width: 24, height: 1, background: 'currentColor', opacity: 0.6 }}/>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16.5 17.2 14 16l-2 3-2-3-2.5 1.2-1.3 2L2 17l1.5-2L8 13l-2-8 2 1 4 6 4-6 2-1-2 8 4.5 2L22 17z"/>
          </svg>
          <div style={{ width: 24, height: 1, background: 'currentColor', opacity: 0.6 }}/>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="display mono" style={{ fontSize: 22, color: 'var(--text)' }}>{flight.arrCode}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{flight.arrTime} · {flight.arrCity}</div>
        </div>
      </div>
      <div className="ticket-divider" style={{ margin: '14px -4px 12px' }}/>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)' }}>
        <span>Duration 1h 10m</span>
        <span>•</span>
        <span>3 passengers</span>
        <span>•</span>
        <span>Peter +20kg bag</span>
      </div>
    </div>
  );
}

const WEATHER = {
  today: { temp: 33, low: 26, cond: 'Partly cloudy', icon: 'cloud-sun' },
  rain: { at: '8:00 PM – 10:00 PM', chance: 88 },
  forecast: [
    { d: 'Today', hi: 33, lo: 26, i: 'cloud-sun', rain: 30 },
    { d: 'Sun',   hi: 33, lo: 26, i: 'rain',      rain: 84 },
    { d: 'Mon',   hi: 34, lo: 26, i: 'sun',       rain: 10 },
    { d: 'Tue',   hi: 33, lo: 27, i: 'cloud-sun', rain: 20 },
    { d: 'Wed',   hi: 32, lo: 26, i: 'rain',      rain: 65 },
  ],
};

function WeatherIcon({ kind, size = 22 }) {
  const s = size;
  const c = 'currentColor';
  if (kind === 'sun') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
  if (kind === 'rain') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M7 14a4 4 0 110-8 6 6 0 0111.6 2A3.5 3.5 0 0117 14z"/><path d="M9 18v2M13 18v2M17 18v2"/></svg>;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.8 3.8l.7.7M12.2 12.2l.7.7"/><path d="M18 20a4 4 0 100-8 6 6 0 00-10.5-2.5"/></svg>;
}

function WeatherCard() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Weather · Boracay</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span className="display" style={{ fontSize: 36, color: 'var(--text)' }}>{WEATHER.today.temp}°</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/ {WEATHER.today.low}°</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{WEATHER.today.cond}</div>
        </div>
        <div style={{ color: 'var(--text-2)', padding: '6px 8px', background: 'var(--card-2)', borderRadius: 12 }}>
          <WeatherIcon kind="cloud-sun" size={28}/>
        </div>
      </div>

      {/* Rain warning chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: 'var(--warn-bg)',
        borderRadius: 12,
        marginBottom: 14,
        border: '1px solid rgba(245, 181, 74, 0.20)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M7 14a4 4 0 110-8 6 6 0 0111.6 2A3.5 3.5 0 0117 14z"/>
          <path d="M9 18v2M13 18v2M17 18v2"/>
        </svg>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
          <span style={{ fontWeight: 550, color: 'var(--warn)' }}>Rain expected</span> today {WEATHER.rain.at} · {WEATHER.rain.chance}% chance
        </div>
      </div>

      {/* 5-day forecast */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {WEATHER.forecast.map((f, i) => (
          <div key={i} style={{
            textAlign: 'center',
            padding: '10px 4px',
            borderRadius: 12,
            background: i === 0 ? 'var(--accent-bg)' : 'transparent',
            border: i === 0 ? '1px solid var(--accent-border)' : '1px solid transparent',
          }}>
            <div style={{ fontSize: 10, fontWeight: 550, color: i === 0 ? 'var(--accent)' : 'var(--text-3)', letterSpacing: '0.08em' }}>{f.d.toUpperCase()}</div>
            <div style={{ margin: '6px auto 4px', color: 'var(--text-2)' }}><WeatherIcon kind={f.i} size={18}/></div>
            <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{f.hi}° <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{f.lo}°</span></div>
            {f.rain >= 50 && <div style={{ fontSize: 9, color: 'var(--info)', marginTop: 2, fontWeight: 600 }}>{f.rain}%</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Quick access grid — tiles like the real app
function QuickAccessCard() {
  const tiles = [
    { label: 'Check-in', value: '3:00 PM', hint: 'Apr 20' },
    { label: 'Checkout', value: '12:00 PM', hint: 'Apr 27' },
    { label: 'WiFi', value: 'Not set', hint: 'Add on arrival', muted: true },
    { label: 'Door code', value: '—', hint: 'Add on arrival', muted: true },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {tiles.map(t => (
        <div key={t.label} style={{
          padding: '14px 14px 12px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 550, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t.label}</div>
          <div className="display mono" style={{ fontSize: 17, color: t.muted ? 'var(--text-3)' : 'var(--text)', marginTop: 6, fontWeight: 550 }}>{t.value}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{t.hint}</div>
        </div>
      ))}
    </div>
  );
}

// Floating action button with radial menu
function FAB() {
  const [open, setOpen] = React.useState(false);
  const actions = [
    { label: 'Capture Moment', color: 'var(--fab-1)', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4l1.5 2h3a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3l1.5-2z"/><circle cx="12" cy="13" r="3.5"/></svg>) },
    { label: 'Quick Expense', color: 'var(--fab-2)', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>) },
    { label: 'Add to Packing', color: 'var(--fab-3)', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14v12H5z"/><path d="M9 8V5a3 3 0 016 0v3"/></svg>) },
    { label: 'Trip Summary',  color: 'var(--fab-4)', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><polyline points="14 3 14 8 19 8"/><path d="M9 13h6M9 17h4"/></svg>) },
  ];
  return (
    <>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}/>
      )}
      <div style={{ position: 'absolute', right: 18, bottom: 84, zIndex: 45 }}>
        {open && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            marginBottom: 12,
            animation: 'fadeUp 0.18s ease-out',
          }}>
            {actions.map((a, i) => (
              <div key={a.label} onClick={() => setOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end',
                cursor: 'pointer',
              }}>
                <div style={{
                  padding: '7px 12px',
                  background: 'var(--card)',
                  color: 'var(--text)',
                  borderRadius: 10,
                  fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                }}>{a.label}</div>
                <div style={{
                  width: 44, height: 44, borderRadius: 999,
                  background: a.color, color: '#fff',
                  display: 'grid', placeItems: 'center',
                  boxShadow: 'var(--shadow-md)',
                }}>{a.icon}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setOpen(!open)} style={{
          width: 56, height: 56, borderRadius: 999,
          background: 'var(--ink)',
          color: 'var(--bg)',
          border: 'none',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)',
          cursor: 'pointer',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 0.25s cubic-bezier(.4,1.6,.5,1)',
          marginLeft: 'auto',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    </>
  );
}

function HomeScreen() {
  const cd = useCountdown(TRIP.start);
  const [phase, setPhase] = React.useState(() => {
    try { return (JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}').tripPhase) || 'upcoming'; } catch { return 'upcoming'; }
  });
  React.useEffect(() => { window.__setTripPhase = setPhase; }, []);

  const boardFlight = React.useCallback(() => {
    setPhase('inflight');
    try {
      const tw = JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}');
      tw.tripPhase = 'inflight';
      localStorage.setItem('afterstay_tweaks', JSON.stringify(tw));
      window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { tripPhase: 'inflight' } }, '*');
    } catch {}
  }, []);

  const landFlight = React.useCallback(() => {
    setPhase('arrived');
    try {
      const tw = JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}');
      tw.tripPhase = 'arrived';
      localStorage.setItem('afterstay_tweaks', JSON.stringify(tw));
      window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { tripPhase: 'arrived' } }, '*');
    } catch {}
  }, []);

  const goExplore = React.useCallback(() => {
    try { window.__setActive?.('discover'); } catch {}
  }, []);

  const startTrip = React.useCallback(() => {
    setPhase('active');
    try {
      const tw = JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}');
      tw.tripPhase = 'active';
      localStorage.setItem('afterstay_tweaks', JSON.stringify(tw));
      window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { tripPhase: 'active' } }, '*');
    } catch {}
  }, []);

  return (
    <Page>
      {/* Top bar — Afterstay brand + user avatar */}
      <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Afterstay lockup — Constellation mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64" fill="none" style={{ color: 'var(--accent)' }}>
            {/* Outer circle — transparent interior */}
            <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.95"/>
            {/* Triangle / mountain */}
            <path d="M32 12 L52 48 L12 48 Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" fill="none"/>
            {/* Heartbeat / pulse line */}
            <path d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <div className="display" style={{
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: 'var(--text)',
            }}>
              after<span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500 }}>stay</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.18em', marginTop: 3, textTransform: 'uppercase' }}>
              Hey Peter · Boracay trip
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn round">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.7 21a2 2 0 01-3.4 0"/>
            </svg>
          </button>
          <ProfileAvatar />
        </div>
      </div>

      {/* Hero slideshow */}
      <div style={{ padding: '4px 16px 14px' }}>
        <div style={{ position: 'relative' }}>
          <FlashingHero height={320} radius={22} />
          {/* overlay: hotel name + group */}
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span className="stamp round" style={{ color: '#fff', borderColor: '#fff', opacity: 0.92, transform: 'rotate(-4deg)' }}>
                ✓ Confirmed
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Agoda #{TRIP.confirmation}</span>
            </div>
            <div className="display" style={{ fontSize: 22, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 3 }}>{TRIP.hotel}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              Executive Suite × 2 · 7 nights · Apr 20 – 27
            </div>
            {/* group avatars */}
            <div style={{ display: 'flex', marginTop: 10 }}>
              {GROUP.map((g, i) => (
                <div key={g.name} style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: g.color, color: '#0b0f14',
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontWeight: 550,
                  marginLeft: i === 0 ? 0 : -8,
                  border: '2px solid rgba(20,26,34,0.8)',
                }}>{g.init}</div>
              ))}
              <div style={{ marginLeft: 10, alignSelf: 'center', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                You + 2 travelers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown / Flight progress / Arrived — depends on trip phase */}
      <div style={{ padding: '0 16px 14px' }}>
        {phase === 'inflight' ? <FlightProgressCard onLanded={landFlight} /> :
         phase === 'arrived' ? <ArrivedCard onStart={goExplore} /> :
         phase === 'active' ? <TripActiveCard /> :
         <CountdownCard cd={cd} onBoard={boardFlight} />}
      </div>

      {phase === 'active' && (
        <>
          <GroupHeader kicker="Weather" title="Boracay right now" />
          <div style={{ padding: '0 16px' }}>
            <WeatherCard />
          </div>
        </>
      )}

      <CollapsibleSection
        kicker={phase === 'active' ? 'Transit · Return' : 'Transit · Outbound'}
        title={phase === 'active' ? 'Flight home to Manila' : 'Flight to Caticlan'}
        defaultOpen={phase !== 'active'}
      >
        <FlightCard returnFlight={phase === 'active'} />
      </CollapsibleSection>

      {phase !== 'active' && (
        <>
          <GroupHeader kicker="Weather" title="Boracay this week" />
          <div style={{ padding: '0 16px' }}>
            <WeatherCard />
          </div>
        </>
      )}

      <GroupHeader kicker="Stay · Quick access" title="Everything for check-in" />
      <div style={{ padding: '0 16px' }}>
        <QuickAccessCard />
      </div>

      <GroupHeader
        kicker="Moments · Day 1"
        title="Trip so far"
        action={<button className="btn sm ghost" style={{ color: 'var(--accent)', border: 'none' }} onClick={() => { try { localStorage.setItem('afterstay_trip_tab', 'moments'); } catch {}; window.__setActive && window.__setActive('trip'); }}>All →</button>}
      />
      {window.HomeMomentsPreview && <window.HomeMomentsPreview />}

      <GroupHeader kicker="Nearby" title="Around the hotel" action={<button className="btn sm ghost" style={{ color: 'var(--accent)', border: 'none' }}>Map →</button>} />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { n: 'CityMall Boracay', d: '470 m · 6 min walk', t: 'Mall' },
          { n: "D'Mall", d: '1.6 km · 20 min walk', t: 'Shopping street' },
          { n: 'Island Clinic', d: '830 m · 10 min walk', t: 'Medical' },
        ].map(p => (
          <Row key={p.n} title={p.n} meta={p.t} value={p.d.split(' · ')[0]} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"/>
              <circle cx="12" cy="9" r="2.8"/>
            </svg>
          }/>
        ))}
      </div>

      <div style={{ height: 16 }} />
      <FAB />
    </Page>
  );
}

window.HomeScreen = HomeScreen;

// ========== Profile avatar + sheet ==========
function ProfileAvatar() {
  const [open, setOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState(null);
  React.useEffect(() => {
    try { setPhoto(localStorage.getItem('afterstay_avatar')); } catch {}
  }, []);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: 32, height: 32, borderRadius: 999,
          background: photo ? `url(${photo}) center/cover` : 'linear-gradient(135deg, var(--accent), var(--coral))',
          display: 'grid', placeItems: 'center',
          color: '#fff', fontWeight: 600, fontSize: 12,
          boxShadow: '0 0 0 2px var(--bg), 0 0 0 3px var(--accent-border)',
          border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'inherit',
        }}
        aria-label="Profile"
      >
        {!photo && 'P'}
      </button>
      {open && <ProfileSheet onClose={() => setOpen(false)} photo={photo} setPhoto={setPhoto} />}
    </>
  );
}

function ProfileSheet({ onClose, photo, setPhoto }) {
  const [dark, setDark] = React.useState(() => document.documentElement.dataset.theme === 'dark');
  const [toast, setToast] = React.useState(null);
  const fileRef = React.useRef(null);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    try {
      const t = JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}');
      t.theme = next ? 'dark' : 'light';
      localStorage.setItem('afterstay_tweaks', JSON.stringify(t));
      document.documentElement.dataset.theme = t.theme;
      window.dispatchEvent(new CustomEvent('afterstay:tweaks', { detail: t }));
    } catch {}
  };

  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      setPhoto(url);
      try { localStorage.setItem('afterstay_avatar', url); } catch {}
      flash('Photo updated');
    };
    reader.readAsDataURL(f);
  };

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  const copyInvite = async () => {
    const url = 'https://afterstay.app/invite/boracay-2026-PTRN3H';
    try { await navigator.clipboard.writeText(url); flash('Invite link copied'); }
    catch { flash('Copy failed'); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20, 14, 8, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'flex-end',
        animation: 'profileBackIn 0.25s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: '24px 24px 0 0',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '10px 0 24px',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.2)',
          animation: 'profileSheetIn 0.32s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 12px' }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--border)' }}/>
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: 64, height: 64, borderRadius: 999,
              background: photo ? `url(${photo}) center/cover` : 'linear-gradient(135deg, var(--accent), var(--coral))',
              display: 'grid', placeItems: 'center',
              color: '#fff', fontWeight: 600, fontSize: 22,
              border: '2px solid var(--bg)',
              boxShadow: '0 0 0 1px var(--border), 0 4px 14px rgba(61,36,22,0.14)',
              cursor: 'pointer', position: 'relative',
              padding: 0, fontFamily: 'inherit',
            }}
          >
            {!photo && 'P'}
            <span style={{
              position: 'absolute', right: -2, bottom: -2,
              width: 22, height: 22, borderRadius: 99,
              background: 'var(--accent)', color: '#fff',
              display: 'grid', placeItems: 'center',
              border: '2px solid var(--bg)',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 20, letterSpacing: '-0.01em', color: 'var(--text)' }}>Peter Reyes</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>peter@afterstay.app</div>
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 99,
              background: 'var(--card-2)', border: '1px solid var(--border)',
              fontSize: 9.5, fontWeight: 650, letterSpacing: '0.1em', color: 'var(--text-2)' }}>
              AFTERSTAY MEMBER · SINCE 2024
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 99,
            background: 'var(--card-2)', border: '1px solid var(--border)',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        {/* Section: Account */}
        <ProfileGroup title="Account">
          <ProfileRow
            icon={<PIconCamera/>} label="Upload photo"
            hint={photo ? 'Tap to change' : 'JPG or PNG'}
            onClick={() => fileRef.current?.click()}
          />
          <ProfileRow
            icon={<PIconMail/>} label="Linked emails"
            right={<span style={{ fontSize: 11, color: 'var(--text-3)' }}>2 linked</span>}
            onClick={() => flash('Linked emails opened')}
          />
          <ProfileRow
            icon={<PIconUsers/>} label="Contacts"
            hint="Sync from phone for group invites"
            onClick={() => flash('Contacts syncing…')}
          />
        </ProfileGroup>

        {/* Section: Preferences */}
        <ProfileGroup title="Preferences">
          <ProfileRow
            icon={<PIconMoon/>} label="Dark mode"
            right={<Toggle on={dark} onChange={toggleDark}/>}
            onClick={toggleDark}
          />
        </ProfileGroup>

        {/* Section: Notifications */}
        <ProfileGroup title="Notifications">
          <NotifRow icon={<PIconPlane/>} label="Departure reminders" hint="3 hrs before boarding" storeKey="notif_departure" defaultOn={true}/>
          <NotifRow icon={<PIconAlert/>} label="Budget alerts" hint="When you hit 70 / 90 / 100%" storeKey="notif_budget" defaultOn={true}/>
          <NotifRow icon={<PIconBag/>} label="Packing reminders" hint="Day before the trip" storeKey="notif_pack" defaultOn={false}/>
          <NotifRow icon={<PIconBell/>} label="Group activity" hint="When someone saves or books" storeKey="notif_group" defaultOn={true} last/>
        </ProfileGroup>

        {/* Section: Trips */}
        <ProfileGroup title="Trips">
          <TripRow
            status="current" dest="Boracay" flag="🌴"
            dates="Apr 20 – 27, 2026"
            meta="7 nights · Canyon Hotels"
            onClick={() => flash('Current trip')}
          />
        </ProfileGroup>

        {/* Section: About */}
        <ProfileGroup title="About">
          <ProfileRow
            icon={<PIconInfo/>} label="App version"
            right={<span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>v1.4.0 · build 318</span>}
          />
        </ProfileGroup>

        <div style={{ padding: '6px 20px 0' }}>
          <button
            onClick={() => flash('Signed out')}
            style={{
              width: '100%', appearance: 'none', cursor: 'pointer',
              background: 'transparent', color: '#b04a2a',
              border: '1px solid rgba(176,74,42,0.25)',
              borderRadius: 14, padding: '13px 16px',
              fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
              letterSpacing: '0.02em',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 30, transform: 'translateX(-50%)',
          background: '#3d2416', color: '#f5ede0',
          padding: '10px 16px', borderRadius: 99,
          fontSize: 12, fontWeight: 550,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          animation: 'toastIn 0.3s ease-out',
          zIndex: 10000,
        }}>{toast}</div>
      )}

      <style>{`
        @keyframes profileBackIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes profileSheetIn { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes toastIn { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}

function ProfileGroup({ title, children }) {
  return (
    <div style={{ padding: '4px 20px 10px' }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
        color: 'var(--text-3)', textTransform: 'uppercase',
        padding: '10px 4px 6px',
      }}>{title}</div>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, hint, right, onClick, last }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', appearance: 'none', cursor: onClick ? 'pointer' : 'default',
        background: 'transparent', border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
        textAlign: 'left', fontFamily: 'inherit',
      }}
      onMouseOver={e => onClick && (e.currentTarget.style.background = 'var(--card-2)')}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--card-2)', border: '1px solid var(--border)',
        display: 'grid', placeItems: 'center', color: 'var(--text-2)',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      {right}
      {!right && onClick && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
          <path d="M9 6l6 6-6 6"/>
        </svg>
      )}
    </button>
  );
}

function Toggle({ on, onChange }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onChange(); }}
      style={{
        width: 38, height: 22, borderRadius: 99,
        background: on ? 'var(--accent)' : 'var(--border)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 18, height: 18, borderRadius: 99,
        background: '#fff', transition: 'left 0.22s cubic-bezier(.22,1,.36,1)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      }}/>
    </span>
  );
}

// Profile icons
const PIconCamera = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>);
const PIconMail = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>);
const PIconUsers = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>);
const PIconMoon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>);
const PIconLink = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>);
const PIconGroup = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="4"/><circle cx="17" cy="7" r="3"/><path d="M3 20a6 6 0 0112 0M15 20a5 5 0 016-4.9"/></svg>);
const PIconInfo = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></svg>);
const PIconPlane = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5c1.2-1.2 1.2-3 0-4.2s-3-1.2-4.2 0L11.8 6.8 3.6 5l-1.1 1.1 6 3.3-3.3 3.3-2.5-.4-1 1.1 3.5 2 2 3.5 1-1-.3-2.5 3.3-3.3 3.3 6z"/></svg>);
const PIconAlert = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17v.01"/></svg>);
const PIconBag = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 13h18"/></svg>);
const PIconBell = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>);
const PIconVideo = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>);
const PIconChart = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-6 3 4 5-8"/></svg>);

function StatTile({ label, value, sub }) {
  return (
    <div style={{
      background: 'var(--card-2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{label}</div>
      <div className="display mono" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function NotifRow({ icon, label, hint, storeKey, defaultOn, last }) {
  const [on, setOn] = React.useState(() => {
    try {
      const v = localStorage.getItem('afterstay_' + storeKey);
      return v === null ? defaultOn : v === '1';
    } catch { return defaultOn; }
  });
  const toggle = () => {
    const next = !on;
    setOn(next);
    try { localStorage.setItem('afterstay_' + storeKey, next ? '1' : '0'); } catch {}
  };
  return (
    <ProfileRow
      icon={icon} label={label} hint={hint}
      right={<Toggle on={on} onChange={toggle}/>}
      onClick={toggle}
      last={last}
    />
  );
}

function TripsStats() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', appearance: 'none', cursor: 'pointer',
          background: 'transparent', border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          textAlign: 'left', fontFamily: 'inherit',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--card-2)')}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'var(--card-2)', border: '1px solid var(--border)',
          display: 'grid', placeItems: 'center', color: 'var(--text-2)',
          flexShrink: 0,
        }}>
          <PIconChart/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Travel stats</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Your 2026 recap so far</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 10 10" style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.22s' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          padding: '14px 14px 14px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          animation: 'statsIn 0.25s ease',
        }}>
          <StatTile label="Total trips" value="1" sub="this year"/>
          <StatTile label="Total spent" value="₱18,400" sub="2026 so far"/>
          <StatTile label="Nights away" value="2" sub="of 7 booked"/>
          <StatTile label="Countries"   value="1" sub="Philippines"/>
          <style>{`@keyframes statsIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </>
  );
}

function TripRow({ status, dest, flag, dates, meta, onClick, last }) {
  const pill = status === 'current'
    ? { bg: 'rgba(125,220,150,0.14)', border: 'rgba(125,220,150,0.35)', color: '#2f7a46', label: 'LIVE' }
    : { bg: 'var(--card-2)', border: 'var(--border)', color: 'var(--text-3)', label: 'PAST' };
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', appearance: 'none', cursor: 'pointer',
        background: 'transparent', border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
        textAlign: 'left', fontFamily: 'inherit',
      }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--card-2)')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(217,119,87,0.16), rgba(217,119,87,0.04))',
        border: '1px solid var(--border)',
        display: 'grid', placeItems: 'center',
        fontSize: 22, flexShrink: 0,
      }}>{flag}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 550 }}>{dest}</div>
          <span style={{
            fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
            padding: '2px 6px', borderRadius: 99,
            background: pill.bg, border: `1px solid ${pill.border}`,
            color: pill.color,
          }}>
            {status === 'current' && <span style={{
              display: 'inline-block', width: 4, height: 4, borderRadius: 99,
              background: '#4fb372', marginRight: 4, verticalAlign: 1,
              animation: 'pulseDot 1.6s ease-in-out infinite',
            }}/>}
            {pill.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{dates} · {meta}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
        <path d="M9 6l6 6-6 6"/>
      </svg>
    </button>
  );
}
