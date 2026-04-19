// Animated banner reacting to spend state: cruising / low / over
function BudgetStatusBanner({ state, spent, total }) {
  const pct = Math.round((spent / total) * 100);
  const variants = {
    cruising: {
      bg: 'linear-gradient(135deg, rgba(126, 204, 140, 0.18) 0%, rgba(198, 106, 54, 0.10) 100%)',
      border: 'rgba(126, 204, 140, 0.55)',
      accent: '#3e8f54',
      eyebrow: 'All good',
      title: "You're cruising",
      sub: `₱${(total - spent).toLocaleString()} left · pacing ahead of plan`,
      icon: 'check',
    },
    low: {
      bg: 'linear-gradient(135deg, rgba(230, 170, 60, 0.20) 0%, rgba(198, 106, 54, 0.12) 100%)',
      border: 'rgba(230, 170, 60, 0.6)',
      accent: '#b07a14',
      eyebrow: 'Low balance',
      title: 'Watch your pace',
      sub: `Only ₱${(total - spent).toLocaleString()} left for ${Math.max(1, 8 - Math.round(pct / 12))} more days`,
      icon: 'bell',
    },
    over: {
      bg: 'linear-gradient(135deg, rgba(214, 90, 60, 0.22) 0%, rgba(127, 55, 18, 0.16) 100%)',
      border: 'rgba(214, 90, 60, 0.65)',
      accent: '#c44d2c',
      eyebrow: 'Over budget',
      title: 'Time to ease off',
      sub: `₱${Math.abs(total - spent).toLocaleString()} over your trip cap`,
      icon: 'alert',
    },
  };
  const v = variants[state] || variants.cruising;

  return (
    <div style={{
      position: 'relative',
      background: v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 18,
      padding: '14px 16px',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: 12,
      animation: state === 'over' ? 'shakeH 0.5s ease-in-out' : 'bannerIn 0.4s ease-out',
    }}>
      {/* Shimmer / pulse backdrop */}
      {state === 'cruising' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(110deg, transparent 40%, rgba(126,204,140,0.18) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 4s ease-in-out infinite',
        }}/>
      )}
      {state === 'low' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 1px rgba(230,170,60,0.35)',
          animation: 'lowPulse 1.8s ease-in-out infinite',
        }}/>
      )}
      {state === 'over' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 2px rgba(214,90,60,0.5)',
          animation: 'overPulse 1.2s ease-in-out infinite',
        }}/>
      )}

      {/* Icon */}
      <div style={{
        position: 'relative',
        width: 40, height: 40, borderRadius: 12,
        background: '#fffaf0',
        border: `1px solid ${v.border}`,
        color: v.accent,
        display: 'grid', placeItems: 'center',
        flexShrink: 0,
        animation: state === 'low' ? 'ringBell 2s ease-in-out infinite'
                  : state === 'over' ? 'alertPulse 1s ease-in-out infinite'
                  : 'iconBob 3s ease-in-out infinite',
      }}>
        {v.icon === 'check' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        {v.icon === 'bell'  && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>}
        {v.icon === 'alert' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ fontSize: 9.5, fontWeight: 650, letterSpacing: '0.16em', textTransform: 'uppercase', color: v.accent }}>{v.eyebrow}</div>
        <div className="display" style={{ fontSize: 16, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: 2 }}>{v.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{v.sub}</div>
      </div>

      <style>{`
        @keyframes bannerIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shakeH {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes lowPulse {
          0%, 100% { box-shadow: inset 0 0 0 1px rgba(230,170,60,0.3); }
          50% { box-shadow: inset 0 0 0 1px rgba(230,170,60,0.7), 0 0 0 3px rgba(230,170,60,0.2); }
        }
        @keyframes overPulse {
          0%, 100% { box-shadow: inset 0 0 0 2px rgba(214,90,60,0.4); }
          50% { box-shadow: inset 0 0 0 2px rgba(214,90,60,0.9), 0 0 0 4px rgba(214,90,60,0.2); }
        }
        @keyframes ringBell {
          0%, 100% { transform: rotate(0); }
          10%, 30% { transform: rotate(-14deg); }
          20%, 40% { transform: rotate(14deg); }
          50% { transform: rotate(0); }
        }
        @keyframes alertPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes iconBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

// Budget — Limited/Unlimited toggle, Cruising mode, ₱ currency

function BudgetScreen() {
  const [mode, setMode] = React.useState('limited'); // limited | unlimited
  const [bState, setBState] = React.useState(() => {
    try { return (JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}').budgetState) || 'cruising'; } catch { return 'cruising'; }
  });
  React.useEffect(() => { window.__setBudgetState = setBState; }, []);

  const total = 1000;
  // Dynamic spend based on state
  const spent = bState === 'cruising' ? 284 : bState === 'low' ? 820 : 1120;
  const remaining = total - spent;
  const days = 8;
  const perDay = Math.round(total / days);

  const categories = [
    { n: 'Food & Drink', a: 156, c: 'var(--chart-1)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v9a4 4 0 008 0V2M10 2v4M18 5v16M14 5c0-1 1-3 4-3v8a2 2 0 01-2 2h-2"/></svg>) },
    { n: 'Transport',   a: 68,  c: 'var(--chart-2)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 14h16M8 20v-2M16 20v-2"/><circle cx="8" cy="17" r="1" fill="currentColor"/><circle cx="16" cy="17" r="1" fill="currentColor"/></svg>) },
    { n: 'Activities',  a: 40,  c: 'var(--chart-3)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9"/><circle cx="12" cy="12" r="3"/></svg>) },
    { n: 'Shopping',    a: 20,  c: 'var(--chart-4)', icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/></svg>) },
  ];

  const status = remaining / total > 0.5 ? 'Cruising' : remaining / total > 0.2 ? 'Watch' : 'Over';

  return (
    <Page>
      <TopBar title="Budget" subtitle="Boracay · 8 days" right={
        <button className="icon-btn round">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 10v6M4.2 4.2l4.3 4.3m7 7l4.3 4.3M1 12h6m10 0h6M4.2 19.8l4.3-4.3m7-7l4.3-4.3"/></svg>
        </button>
      }/>

      {/* Mode toggle — Limited / Unlimited */}
      <div style={{ padding: '0 20px 14px' }}>
        <div className="seg" style={{ width: '100%' }}>
          <button className={mode === 'limited' ? 'active' : ''} onClick={() => setMode('limited')}>Limited</button>
          <button className={mode === 'unlimited' ? 'active' : ''} onClick={() => setMode('unlimited')}>Unlimited</button>
        </div>
      </div>

      {mode === 'limited' && (
        <>
          {/* Animated status banner */}
          <div style={{ padding: '0 16px 12px' }}>
            <BudgetStatusBanner state={bState} spent={spent} total={total} />
          </div>

          {/* Main summary card */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: 'linear-gradient(180deg, var(--card) 0%, var(--card-2) 100%)',
              border: '1px solid var(--border)',
              borderRadius: 22,
              padding: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div className="eyebrow">Total budget · 8 days</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 18, color: 'var(--text-3)', fontWeight: 600 }}>₱</span>
                    <span className="display mono" style={{ fontSize: 36, color: 'var(--text)' }}>{total.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>₱{perDay}/day target</div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 999,
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  color: 'var(--accent)', fontSize: 11, fontWeight: 550,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 15l7-7 7 7"/>
                  </svg>
                  {status}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, borderRadius: 99, background: 'var(--card-2)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', width: `${(spent / total) * 100}%`,
                  background: 'linear-gradient(90deg, var(--chart-1), var(--chart-2))',
                  borderRadius: 99,
                }}/>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>
                  Spent <span className="mono" style={{ color: 'var(--text)', fontWeight: 550 }}>₱{spent}</span>
                </span>
                <span style={{ color: 'var(--text-3)' }}>
                  Left <span className="mono" style={{ color: 'var(--accent)', fontWeight: 550 }}>₱{remaining.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Accommodation — paid separately */}
          <GroupHeader kicker="Accommodation · Paid Mar 29" title="Canyon Hotels" />
          <div style={{ padding: '0 16px' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-border)',
                display: 'grid', placeItems: 'center',
                color: 'var(--accent)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Paid in full</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>₱16,497.25 per person · 3 travelers</div>
              </div>
              <div className="display mono" style={{ fontSize: 18, color: 'var(--text)', fontWeight: 550 }}>₱49,491</div>
            </div>
          </div>

          {/* Categories */}
          <GroupHeader kicker="Categories" title="Where it's going" />
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(c => {
              const pct = Math.round((c.a / spent) * 100);
              return (
                <div key={c.n} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: c.c + '20',
                    color: c.c,
                    display: 'grid', placeItems: 'center',
                    border: `1px solid ${c.c}40`,
                  }}>{c.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.n}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>₱{c.a}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'var(--card-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: c.c, borderRadius: 99 }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Who pays? — roulette picker */}
          <WhoPaysWheel />

          {/* Recent expenses */}
          <GroupHeader kicker="Recent" title="Expenses" action={<button className="btn sm ghost" style={{ color: 'var(--accent)', border: 'none' }}>All →</button>}/>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { t: 'Lunch · Jonah\'s Fruit Shake', by: 'Peter', a: 18, cat: 'Food & Drink' },
              { t: 'Tricycle · Station 1 → hotel', by: 'Aaron', a: 3, cat: 'Transport' },
              { t: 'Island hopping deposit', by: 'Jane', a: 40, cat: 'Activities' },
              { t: 'Coffee · Nonie\'s', by: 'Peter', a: 6, cat: 'Food & Drink' },
            ].map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.t}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{e.cat} · by {e.by}</div>
                </div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>₱{e.a}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'unlimited' && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: 'var(--card)',
            border: '1px dashed var(--border-2)',
            borderRadius: 20,
          }}>
            <div style={{
              width: 52, height: 52, margin: '0 auto 14px',
              borderRadius: 999,
              background: 'var(--accent-bg)',
              display: 'grid', placeItems: 'center',
              color: 'var(--accent)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.4 10.6a7 7 0 11-12.8 0 7 7 0 0112.8 0z" transform="rotate(90 12 12)"/>
                <path d="M8 12h8"/>
              </svg>
            </div>
            <div className="display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>No budget cap</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 260, margin: '0 auto 16px' }}>
              Track expenses without a limit. We'll still categorize and summarize everything.
            </div>
            <button className="btn primary sm">+ Add expense</button>
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </Page>
  );
}

/* ---------- Who pays? — roulette ---------- */

const WHO_PAYS_MEMBERS = [
  { name: 'Peter', init: 'P', color: '#a64d1e' },
  { name: 'Aaron', init: 'A', color: '#b8892b' },
  { name: 'Jane',  init: 'J', color: '#c66a36' },
];

function WhoPaysWheel() {
  const [rotation, setRotation] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const [winner, setWinner] = React.useState(null);
  const [mode, setMode] = React.useState('wheel'); // wheel | dice

  const N = WHO_PAYS_MEMBERS.length;
  const segAngle = 360 / N;
  const SIZE = 180;
  const R = SIZE / 2;

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);
    const pickIdx = Math.floor(Math.random() * N);
    // Extra rotations + land so that pickIdx segment is under the top pointer
    // Segment i occupies angles [i*segAngle, (i+1)*segAngle]; center at i*segAngle + segAngle/2
    // We want the center of pickIdx at angle 0 (top). Current rotation r maps segment center to r + centerAngle.
    // target: r + centerAngle ≡ 0 mod 360 → r ≡ -centerAngle mod 360
    const centerAngle = pickIdx * segAngle + segAngle / 2;
    const targetBase = (360 - centerAngle) % 360;
    const spins = 5 + Math.floor(Math.random() * 3); // 5–7 full turns
    const newRot = rotation - (rotation % 360) + spins * 360 + targetBase;
    setRotation(newRot);
    setTimeout(() => {
      setSpinning(false);
      setWinner(WHO_PAYS_MEMBERS[pickIdx]);
    }, 3600);
  }

  function rollDice() {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);
    let ticks = 0;
    const total = 12 + Math.floor(Math.random() * 6);
    const pickIdx = Math.floor(Math.random() * N);
    const tick = setInterval(() => {
      setWinner(WHO_PAYS_MEMBERS[ticks % N]);
      ticks++;
      if (ticks >= total) {
        clearInterval(tick);
        setWinner(WHO_PAYS_MEMBERS[pickIdx]);
        setSpinning(false);
      }
    }, 80);
  }

  // SVG arc path for each segment
  function segPath(i) {
    const start = (i * segAngle - 90) * Math.PI / 180;
    const end = ((i + 1) * segAngle - 90) * Math.PI / 180;
    const x1 = R + R * Math.cos(start);
    const y1 = R + R * Math.sin(start);
    const x2 = R + R * Math.cos(end);
    const y2 = R + R * Math.sin(end);
    const large = segAngle > 180 ? 1 : 0;
    return `M${R},${R} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`;
  }

  return (
    <>
      <GroupHeader kicker="Who pays?" title="Let fate decide" action={
        <div className="seg" style={{ fontSize: 10 }}>
          <button className={mode === 'wheel' ? 'active' : ''} onClick={() => setMode('wheel')}>Wheel</button>
          <button className={mode === 'dice' ? 'active' : ''} onClick={() => setMode('dice')}>Dice</button>
        </div>
      } />
      <div style={{ padding: '0 16px' }}>
        <div style={{
          padding: '22px 16px 20px',
          background: 'linear-gradient(180deg, var(--card) 0%, var(--card-2) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          {mode === 'wheel' && (
            <div style={{ position: 'relative', width: SIZE + 20, height: SIZE + 20, display: 'grid', placeItems: 'center' }}>
              {/* Pointer */}
              <div style={{
                position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '9px solid transparent',
                borderRight: '9px solid transparent',
                borderTop: '14px solid var(--text)',
                zIndex: 2,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}/>
              {/* Wheel */}
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 3.4s cubic-bezier(0.17, 0.67, 0.2, 1.0)' : 'none',
                filter: 'drop-shadow(0 8px 20px rgba(166,77,30,0.2))',
              }}>
                {WHO_PAYS_MEMBERS.map((m, i) => {
                  const centerAngle = (i * segAngle + segAngle / 2 - 90) * Math.PI / 180;
                  const tx = R + (R * 0.62) * Math.cos(centerAngle);
                  const ty = R + (R * 0.62) * Math.sin(centerAngle);
                  const rotDeg = i * segAngle + segAngle / 2;
                  return (
                    <g key={m.name}>
                      <path d={segPath(i)} fill={m.color} stroke="#fffaf0" strokeWidth="2"/>
                      <g transform={`translate(${tx},${ty}) rotate(${rotDeg})`}>
                        <text x="0" y="-4" textAnchor="middle" fill="#fffaf0" fontSize="13" fontWeight="700" style={{ fontFamily: 'inherit' }}>{m.init}</text>
                        <text x="0" y="12" textAnchor="middle" fill="#fffaf0" fontSize="8.5" fontWeight="600" opacity="0.85" style={{ fontFamily: 'inherit', letterSpacing: '0.05em' }}>{m.name.toUpperCase()}</text>
                      </g>
                    </g>
                  );
                })}
                {/* Center hub */}
                <circle cx={R} cy={R} r="14" fill="#fffaf0" stroke="var(--border)" strokeWidth="1.5"/>
                <circle cx={R} cy={R} r="4" fill="var(--accent)"/>
              </svg>
            </div>
          )}

          {mode === 'dice' && (
            <div style={{
              width: SIZE, height: SIZE, display: 'grid', placeItems: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 120, height: 120, borderRadius: 22,
                background: winner ? winner.color : 'var(--card-2)',
                color: '#fffaf0',
                display: 'grid', placeItems: 'center',
                fontSize: 56, fontWeight: 700,
                border: '2px solid var(--border)',
                boxShadow: '0 10px 26px rgba(0,0,0,0.15)',
                animation: spinning ? 'diceTumble 0.12s linear infinite' : 'none',
                transition: 'background 0.3s',
              }}>
                {winner ? winner.init : '?'}
              </div>
            </div>
          )}

          {/* Result */}
          <div style={{
            minHeight: 48, textAlign: 'center',
            opacity: winner && !spinning ? 1 : 0.4,
            transition: 'opacity 0.3s',
          }}>
            {winner && !spinning ? (
              <>
                <div className="eyebrow" style={{ color: 'var(--accent)' }}>Next round's on</div>
                <div className="display" style={{ fontSize: 22, color: 'var(--text)', marginTop: 2 }}>{winner.name} 🍹</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14 }}>
                {spinning ? (mode === 'wheel' ? 'Spinning…' : 'Rolling…') : `Tap to pick someone to pay`}
              </div>
            )}
          </div>

          <button
            onClick={mode === 'wheel' ? spin : rollDice}
            disabled={spinning}
            className="btn primary"
            style={{
              width: '100%',
              opacity: spinning ? 0.55 : 1,
              cursor: spinning ? 'default' : 'pointer',
            }}
          >
            {spinning ? '…' : mode === 'wheel' ? 'Spin the wheel' : 'Roll the dice'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes diceTumble {
          0%   { transform: rotate(0deg)   scale(1); }
          25%  { transform: rotate(90deg)  scale(0.95); }
          50%  { transform: rotate(180deg) scale(1.02); }
          75%  { transform: rotate(270deg) scale(0.95); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </>
  );
}

window.BudgetScreen = BudgetScreen;
