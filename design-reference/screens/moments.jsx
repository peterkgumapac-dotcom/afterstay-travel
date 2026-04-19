// Moments — trip gallery segment for Our Trip
// Photos are context-linked: place, day, weather, expense, who took it.
// Three layouts: mosaic, diary, map-pinned.

// Tropical/Boracay-feel photos — stable Unsplash IDs
const MOMENT_PHOTOS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80', // white beach wide
  'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900&q=80', // sunset palms
  'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=900&q=80', // rocky beach formation
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80&sat=-10', // variant
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&q=80', // turquoise shoreline
  'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=900&q=80', // palm silhouette sunset
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=900&q=80', // aerial tropical
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80', // food/dinner
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=900&q=80', // boat sail
  'https://images.unsplash.com/photo-1517824806704-9040b037703b?w=900&q=80', // sunset water
  'https://images.unsplash.com/photo-1540202404-1b927e27fa8b?w=900&q=80', // spa
  'https://images.unsplash.com/photo-1504198266287-1659872e6590?w=900&q=80', // golden sunset
].map(u => (window.resolveUrl ? window.resolveUrl(u) : u));

// Trip group — mirrors trip.jsx
const MOMENT_PEOPLE = {
  P: { name: 'Peter', color: '#a64d1e' },
  A: { name: 'Aaron', color: '#b8892b' },
  J: { name: 'Jane',  color: '#c66a36' },
};

// 12 photos across the trip, richly tagged.
// Shape: { img, by, day, time, place, caption, weather, expense?, reactions, voice? }
// voice.duration in seconds; presence means author recorded a voice note.
const MOMENTS = [
  { img: 0,  by: 'P', day: 'Apr 20', time: '4:32 PM', place: "Canyon Hotels — Station 2", caption: "Checked in. Executive Suite.", weather: '33° sunny', reactions: { '❤️': 2, '🔥': 1 } },
  { img: 1,  by: 'A', day: 'Apr 20', time: '6:14 PM', place: 'White Beach, Station 2',    caption: "First swim. Water was warm.", weather: '31° clear', reactions: { '❤️': 3 }, voice: { duration: 14 } },
  { img: 2,  by: 'J', day: 'Apr 20', time: '6:52 PM', place: 'Willy\'s Rock',               caption: "Sunset over Willy's.", weather: '30° clear', reactions: { '❤️': 3, '🌅': 2 } },
  { img: 3,  by: 'P', day: 'Apr 21', time: '8:30 AM', place: 'Nonie\'s',                   caption: "Breakfast. Worth the queue.", weather: '29° sunny', expense: { label: 'Nonie\'s breakfast', amt: '₱1,840' }, reactions: { '😋': 2 } },
  { img: 4,  by: 'A', day: 'Apr 21', time: '11:15 AM', place: 'Puka Shell Beach',          caption: "Puka. Empty at 11am.", weather: '32° sunny', reactions: { '❤️': 2, '🐚': 1 } },
  { img: 5,  by: 'P', day: 'Apr 21', time: '1:40 PM', place: 'Crystal Cove Island',        caption: "Island hop #1.", weather: '33° partly', reactions: { '🔥': 2 }, voice: { duration: 11 } },
  { img: 6,  by: 'J', day: 'Apr 22', time: '7:20 AM', place: 'Mt. Luho Viewpoint',         caption: "Got up for sunrise. Worth it.", weather: '28° clear', reactions: { '❤️': 3, '🌄': 2 }, voice: { duration: 19 } },
  { img: 7,  by: 'P', day: 'Apr 22', time: '6:45 PM', place: 'D\'Mall',                     caption: "Dinner crawl.", weather: '30° clear', expense: { label: 'Aria dinner', amt: '₱3,420' }, reactions: { '😋': 3 } },
  { img: 8,  by: 'A', day: 'Apr 23', time: '10:20 AM', place: 'Ariel\'s Point',             caption: "Cliff dive. 15 meters.", weather: '32° sunny', expense: { label: 'Ariel\'s tour', amt: '₱4,500' }, reactions: { '🔥': 3, '😱': 2 }, voice: { duration: 22 } },
  { img: 9,  by: 'J', day: 'Apr 24', time: '5:50 PM', place: 'Diniwid Beach',              caption: "Quieter side. Our favorite.", weather: '30° clear', reactions: { '❤️': 3 } },
  { img: 10, by: 'P', day: 'Apr 25', time: '7:15 PM', place: 'Mandala Spa',                caption: "Couples massage.", weather: '29° rain', expense: { label: 'Spa × 3', amt: '₱6,300' }, reactions: { '💆': 3 } },
  { img: 11, by: 'A', day: 'Apr 26', time: '5:55 PM', place: 'White Beach, Station 1',     caption: "Last sunset.", weather: '30° clear', reactions: { '❤️': 3, '🥹': 2 }, voice: { duration: 17 } },
];

// Parse "4:32 PM" → decimal hours (0-24).
function parseHour(t) {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 12;
  let h = parseInt(m[1], 10); const mm = parseInt(m[2], 10);
  const pm = /PM/i.test(m[3]);
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h + mm / 60;
}
// Time-of-day color palette — morning cool → midday warm → sunset coral → night deep
function todColor(hour) {
  // anchor stops
  const stops = [
    { h: 5,  c: [90, 130, 170] },   // dawn cool blue
    { h: 9,  c: [120, 170, 190] },  // morning teal
    { h: 12, c: [230, 190, 110] },  // midday warm
    { h: 17, c: [220, 120, 70] },   // sunset coral
    { h: 20, c: [150, 80, 130] },   // dusk magenta
    { h: 23, c: [70, 60, 110] },    // night purple
    { h: 29, c: [90, 130, 170] },   // wrap back to dawn
  ];
  let h = hour;
  if (h < 5) h += 24;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      const rgb = [0,1,2].map(k => Math.round(a.c[k] + (b.c[k] - a.c[k]) * t));
      return `rgb(${rgb.join(',')})`;
    }
  }
  return 'rgb(200,150,100)';
}

function Avatar({ k, size = 22, ring = false }) {
  const p = MOMENT_PEOPLE[k];
  return (
    <div title={p.name} style={{
      width: size, height: size, borderRadius: 999,
      background: p.color, color: '#0b0f14',
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.46, fontWeight: 600,
      border: ring ? '2px solid var(--card)' : 'none',
      flexShrink: 0,
    }}>{k}</div>
  );
}

// ---------- Day chip strip ----------
function DayChips({ active, onChange, counts }) {
  const days = Object.keys(counts);
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '0 16px 14px',
      overflowX: 'auto', scrollbarWidth: 'none',
    }} className="no-scroll">
      <button onClick={() => onChange('all')} style={chipStyle(active === 'all')}>
        <span>All</span>
        <span style={chipCount(active === 'all')}>{MOMENTS.length}</span>
      </button>
      {days.map(d => (
        <button key={d} onClick={() => onChange(d)} style={chipStyle(active === d)}>
          <span>{d}</span>
          <span style={chipCount(active === d)}>{counts[d]}</span>
        </button>
      ))}
    </div>
  );
}
function chipStyle(on) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 999,
    background: on ? 'var(--accent)' : 'var(--card)',
    color: on ? 'var(--on-black)' : 'var(--text-2)',
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}
function chipCount(on) {
  return {
    fontSize: 10, fontWeight: 550, fontVariantNumeric: 'tabular-nums',
    padding: '2px 6px', borderRadius: 99,
    background: on ? 'rgba(0,0,0,0.16)' : 'var(--card-2)',
    color: on ? 'var(--on-black)' : 'var(--text-3)',
    minWidth: 18, textAlign: 'center',
  };
}

// ---------- Mosaic tile ----------
// Pattern: each row alternates. Indices 0,3,6… = hero (full-width short);
// then pairs of 2 squares.
function MosaicTile({ m, onOpen, aspect = '1 / 1' }) {
  const authorColor = MOMENT_PEOPLE[m.by].color;
  const totalReactions = Object.values(m.reactions || {}).reduce((a, b) => a + b, 0);
  const isLoved = totalReactions >= 5;
  return (
    <div onClick={() => onOpen(m)} style={{
      position: 'relative',
      aspectRatio: aspect,
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      cursor: 'pointer',
      backgroundImage: `url("${MOMENT_PHOTOS[m.img]}")`,
      backgroundSize: 'cover', backgroundPosition: 'center',
      boxShadow: isLoved ? `0 0 0 1.5px ${authorColor}55, 0 4px 18px -6px ${authorColor}55` : 'none',
    }}>
      {/* author color strip — left edge, 2px */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5,
        background: authorColor,
        opacity: 0.9,
      }}/>
      {/* bottom gradient + meta */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.72) 100%)',
      }}/>
      <div style={{
        position: 'absolute', left: 8, right: 8, bottom: 8,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 6,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.92)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}>{m.place}</div>
        </div>
        <Avatar k={m.by} size={18} />
      </div>
      {/* top-left corner chips */}
      <div style={{
        position: 'absolute', top: 8, left: 10,
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {m.voice && (
          <div title={`${m.voice.duration}s voice note`} style={{
            width: 20, height: 20, borderRadius: 99,
            background: 'rgba(11, 15, 20, 0.78)',
            color: 'rgba(255,255,255,0.95)',
            display: 'grid', placeItems: 'center',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
          </div>
        )}
        {isLoved && (
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.03em',
            padding: '3px 7px', borderRadius: 99,
            background: 'rgba(11, 15, 20, 0.78)',
            color: '#ffb4a2',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <span>♥</span><span>{totalReactions}</span>
          </div>
        )}
      </div>
      {m.expense && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 9, fontWeight: 600, letterSpacing: '0.02em',
          padding: '3px 7px', borderRadius: 99,
          background: 'rgba(11, 15, 20, 0.78)',
          color: 'var(--accent-lt)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          fontVariantNumeric: 'tabular-nums',
        }}>{m.expense.amt}</div>
      )}
    </div>
  );
}

function reactionScore(m) {
  return Object.values(m.reactions || {}).reduce((a, b) => a + b, 0);
}

// ---------- Mosaic layout ----------
// Day-aware: each day gets a hero (highest-reaction photo) followed by its supporting shots.
// Compact day divider line between clusters so time stays legible.
function MosaicLayout({ items, onOpen }) {
  // Group by day, preserving order.
  const byDay = [];
  const dayIndex = {};
  items.forEach(m => {
    if (dayIndex[m.day] == null) {
      dayIndex[m.day] = byDay.length;
      byDay.push({ day: m.day, items: [] });
    }
    byDay[dayIndex[m.day]].items.push(m);
  });

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {byDay.map((grp, gIdx) => {
        // hero = highest reaction-score item in day; rest are supporting (pairs of 2 squares).
        const ms = grp.items;
        let heroIdx = 0;
        let bestScore = -1;
        ms.forEach((m, i) => {
          const s = reactionScore(m) + (m.voice ? 1 : 0);
          if (s > bestScore) { bestScore = s; heroIdx = i; }
        });
        const hero = ms[heroIdx];
        const rest = ms.filter((_, i) => i !== heroIdx);
        // chunk rest into pairs
        const pairs = [];
        for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));

        return (
          <div key={grp.day} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* day divider (not on first) */}
            {gIdx > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '4px 0 2px',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
                <span className="eyebrow" style={{ margin: 0, fontSize: 9, color: 'var(--text-3)' }}>
                  {grp.day}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
              </div>
            )}

            {/* hero 16/10 */}
            <MosaicTile m={hero} onOpen={onOpen} aspect="16 / 10" />

            {/* supporting pairs */}
            {pairs.map((pr, pIdx) => {
              if (pr.length === 2) {
                return (
                  <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {pr.map((m, j) => <MosaicTile key={j} m={m} onOpen={onOpen} aspect="1 / 1" />)}
                  </div>
                );
              }
              // single orphan — tall tile alongside empty space? just make it a wide tile.
              return <MosaicTile key={pIdx} m={pr[0]} onOpen={onOpen} aspect="16 / 10" />;
            })}
          </div>
        );
      })}
    </div>
  );
}

// Build a "day in one line" auto-summary from the day's moments.
// Picks up to 3 most-distinct place names, comma-joined.
function dayOneLiner(ms) {
  const seen = new Set();
  const parts = [];
  for (const m of ms) {
    // shorten place: drop ", Station X" suffixes and "Hotels" etc.
    const p = m.place.split(/[,—]/)[0].trim().replace(/^Canyon Hotels/, 'Canyon').replace(/\s+Viewpoint$/,'');
    if (seen.has(p)) continue;
    seen.add(p);
    parts.push(p);
    if (parts.length >= 3) break;
  }
  return parts.join(' · ');
}

// Voice-note pill — fake playback with a shimmering waveform.
function VoiceNote({ voice, byColor }) {
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0); // 0..1
  React.useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / (voice.duration * 1000));
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setPlaying(false); setTimeout(() => setProgress(0), 400); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, voice.duration]);

  // Build a pseudo-random but stable waveform based on duration.
  const bars = React.useMemo(() => {
    const n = 36;
    const seed = voice.duration * 7.1;
    return Array.from({ length: n }, (_, i) => {
      const s = Math.sin(i * 1.3 + seed) * 0.5 + Math.sin(i * 0.41 + seed * 1.7) * 0.5;
      return 0.25 + Math.abs(s) * 0.75;
    });
  }, [voice.duration]);

  const curSec = Math.round(progress * voice.duration);
  const shown = playing ? `0:${String(curSec).padStart(2, '0')}` : `0:${String(voice.duration).padStart(2, '0')}`;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setPlaying(p => !p); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px 8px 10px',
        background: 'var(--card-2)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${byColor}`,
        borderRadius: 12,
        cursor: 'pointer',
        marginTop: 8,
      }}
    >
      {/* play/pause */}
      <div style={{
        width: 26, height: 26, borderRadius: 99,
        background: byColor,
        color: '#0b0f14',
        display: 'grid', placeItems: 'center',
        flexShrink: 0,
      }}>
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
        )}
      </div>
      {/* waveform */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
        {bars.map((h, i) => {
          const pos = i / (bars.length - 1);
          const active = pos <= progress;
          return (
            <div key={i} style={{
              width: 2, height: `${h * 100}%`,
              background: active ? byColor : 'var(--border-2)',
              borderRadius: 1,
              opacity: active ? 1 : 0.55,
              transition: 'background 80ms linear, opacity 80ms linear',
            }}/>
          );
        })}
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {shown}
      </div>
    </div>
  );
}

// ---------- Diary layout — day by day story ----------
function DiaryLayout({ items, onOpen }) {
  // Group by day
  const days = {};
  items.forEach(m => { (days[m.day] = days[m.day] || []).push(m); });
  const dayKeys = Object.keys(days);

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 26 }}>
      {dayKeys.map((d, idx) => {
        const ms = days[d];
        const weather = ms[0].weather;
        const totalExp = ms.reduce((acc, m) => acc + (m.expense ? parseInt(m.expense.amt.replace(/[^\d]/g, ''), 10) : 0), 0);
        const people = [...new Set(ms.map(x => x.by))];
        const oneLiner = dayOneLiner(ms);
        const voiceMoment = ms.find(m => m.voice);

        return (
          <div key={d}>
            {/* Day header — auto one-liner is the headline */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="eyebrow" style={{ margin: 0 }}>Day {idx + 1} · {d}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex' }}>
                    {people.map((p, i) => (
                      <div key={p} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                        <Avatar k={p} size={20} ring />
                      </div>
                    ))}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--text-3)', fontWeight: 550,
                    padding: '3px 8px', borderRadius: 99,
                    background: 'var(--card)', border: '1px solid var(--border)',
                  }}>{weather}</div>
                </div>
              </div>
              {/* Auto one-liner */}
              <div className="display" style={{
                fontSize: 19, lineHeight: 1.2, color: 'var(--text)',
                letterSpacing: '-0.01em',
              }}>
                {oneLiner}
              </div>
              {/* Quiet-moment meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 10.5, color: 'var(--text-3)' }}>
                <span>{ms.length} {ms.length === 1 ? 'moment' : 'moments'}</span>
                <span style={{ color: 'var(--border-2)' }}>·</span>
                <span>{ms[0].time} — {ms[ms.length - 1].time}</span>
                {totalExp > 0 && (
                  <>
                    <span style={{ color: 'var(--border-2)' }}>·</span>
                    <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      ₱{totalExp.toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Big hero */}
            <MosaicTile m={ms[0]} onOpen={onOpen} aspect="16 / 10" />

            {/* Supporting row */}
            {ms.length > 1 && (
              <div style={{
                display: 'grid', gridTemplateColumns: `repeat(${Math.min(ms.length - 1, 3)}, 1fr)`,
                gap: 6, marginTop: 6,
              }}>
                {ms.slice(1, 4).map((m, j) => <MosaicTile key={j} m={m} onOpen={onOpen} aspect="1 / 1" />)}
              </div>
            )}

            {/* Voice note — if anyone recorded one that day */}
            {voiceMoment && (
              <VoiceNote voice={voiceMoment.voice} byColor={MOMENT_PEOPLE[voiceMoment.by].color} />
            )}

            {/* Pull-quote caption */}
            <div style={{
              marginTop: 10,
              padding: '10px 12px',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${MOMENT_PEOPLE[ms[0].by].color}`,
              borderRadius: 12,
              fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45,
            }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>"{ms[0].caption}"</span>
              <span style={{ color: 'var(--text-3)' }}> — {MOMENT_PEOPLE[ms[0].by].name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Map layout — photo thumbnails pinned on a Boracay map ----------
// Photo thumbnails as pins (not dots). Realistic island shape w/ water + beaches.
// Stacked pins cluster into a + chip. Scrubber overlays the bottom of the map.
function MapLayout({ items, onOpen }) {
  // Sort items chronologically by (day, time) for path + scrubber.
  const ordered = React.useMemo(() => {
    const dayOrder = {};
    items.forEach(m => { if (dayOrder[m.day] == null) dayOrder[m.day] = Object.keys(dayOrder).length; });
    return [...items].sort((a, b) => {
      const d = dayOrder[a.day] - dayOrder[b.day];
      if (d !== 0) return d;
      return parseHour(a.time) - parseHour(b.time);
    });
  }, [items]);

  // Positions keyed by image index — tuned to Boracay's real hourglass shape.
  // Axes: 0-100 on both. The island spans roughly x=42-64, y=12-92 in SVG viewBox 100x140.
  const posByImg = {
    0:  { x: 56, y: 52 },  // Canyon Hotels Station 2 (stay)
    1:  { x: 46, y: 60 },  // White Beach Station 2
    2:  { x: 44, y: 66 },  // Willy's Rock
    3:  { x: 54, y: 48 },  // Nonie's (Station 2 north)
    4:  { x: 55, y: 16 },  // Puka Shell Beach (north tip)
    5:  { x: 70, y: 36 },  // Crystal Cove (offshore east)
    6:  { x: 62, y: 28 },  // Mt. Luho (interior-north)
    7:  { x: 50, y: 54 },  // D'Mall
    8:  { x: 34, y: 46 },  // Ariel's Point (offshore west)
    9:  { x: 44, y: 40 },  // Diniwid Beach (NW coast)
    10: { x: 58, y: 62 },  // Mandala Spa (interior south)
    11: { x: 45, y: 82 },  // White Beach Station 1 (south)
  };
  const posOf = (m) => posByImg[m.img] || { x: 50, y: 50 };
  const HOME = { x: 55, y: 52 }; // stay property

  // Scrubber state — 0..N (how many moments are "revealed")
  const [cursor, setCursor] = React.useState(ordered.length);
  const [playing, setPlaying] = React.useState(false);
  React.useEffect(() => { setCursor(ordered.length); }, [ordered.length]);

  React.useEffect(() => {
    if (!playing) return;
    if (cursor >= ordered.length) { setCursor(0); return; }
    const id = setTimeout(() => {
      setCursor(c => {
        if (c >= ordered.length) { setPlaying(false); return c; }
        return c + 1;
      });
    }, 520);
    return () => clearTimeout(id);
  }, [playing, cursor, ordered.length]);

  const revealed = ordered.slice(0, cursor);
  const current = revealed[revealed.length - 1]; // the most recent revealed

  // Build SVG path connecting revealed points (home → points, in order).
  const pathD = React.useMemo(() => {
    if (revealed.length === 0) return '';
    const pts = [HOME, ...revealed.map(posOf)];
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [revealed]);

  // Day headings shown below, independent of scrubber.
  const daysCount = new Set(items.map(m => m.day)).size;

  // Cluster nearby pins — if two are within 4 map units, stack them.
  // Preserves chronological order inside each cluster.
  const clusters = React.useMemo(() => {
    const out = [];
    ordered.forEach(m => {
      const p = posOf(m);
      // find a near-enough existing cluster
      const nearIdx = out.findIndex(c => {
        const dx = c.x - p.x, dy = c.y - p.y;
        return (dx * dx + dy * dy) < (6 * 6);
      });
      if (nearIdx >= 0) out[nearIdx].items.push(m);
      else out.push({ x: p.x, y: p.y, items: [m] });
    });
    return out;
  }, [ordered]);

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        borderRadius: 18,
        overflow: 'hidden',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        boxShadow: 'inset 0 0 40px rgba(70, 130, 170, 0.08)',
      }}>
        {/* Water layer — subtle dots + radial gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse at 55% 45%, rgba(120,180,200,0.15) 0%, rgba(120,180,200,0.04) 60%, transparent 90%),
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 10px,
              rgba(120, 180, 200, 0.035) 10px,
              rgba(120, 180, 200, 0.035) 11px
            )
          `,
        }}/>
        {/* Water ripples near coast */}
        <svg viewBox="0 0 100 140" preserveAspectRatio="none" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none',
        }}>
          <defs>
            {/* Land fill — warm sandy beach */}
            <linearGradient id="land-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0"   stopColor="#d9c099" stopOpacity="0.85"/>
              <stop offset="0.5" stopColor="#c9a877" stopOpacity="0.85"/>
              <stop offset="1"   stopColor="#b89160" stopOpacity="0.85"/>
            </linearGradient>
            {/* Interior vegetation tint */}
            <radialGradient id="land-veg" cx="50%" cy="45%" r="60%">
              <stop offset="0"   stopColor="#7a9a6a" stopOpacity="0.45"/>
              <stop offset="0.7" stopColor="#7a9a6a" stopOpacity="0.12"/>
              <stop offset="1"   stopColor="#7a9a6a" stopOpacity="0"/>
            </radialGradient>
            {/* Beach highlight — pale sand on west coast */}
            <linearGradient id="beach-strip" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0"    stopColor="#fff1d4" stopOpacity="0.85"/>
              <stop offset="0.5"  stopColor="#ffe3b0" stopOpacity="0.7"/>
              <stop offset="1"    stopColor="#fff1d4" stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Coast ripple rings — faint */}
          <ellipse cx="50" cy="70" rx="42" ry="62" fill="none" stroke="rgba(120,180,200,0.12)" strokeWidth="0.25"/>
          <ellipse cx="50" cy="70" rx="38" ry="58" fill="none" stroke="rgba(120,180,200,0.08)" strokeWidth="0.25"/>

          {/* Boracay-ish hourglass silhouette
              Real shape: narrow waist around middle (Station 2), wider top (Puka area),
              wider south lobe (White Beach + Cagban). */}
          <path
            d="
              M 52 10
              Q 62 11 64 18
              Q 66 24 62 28
              Q 60 32 64 34
              Q 68 38 66 44
              Q 64 48 58 50
              Q 54 52 54 56
              Q 56 62 54 68
              Q 52 74 56 80
              Q 60 86 58 90
              Q 54 94 48 92
              Q 42 88 42 82
              Q 44 74 42 68
              Q 40 62 44 56
              Q 46 52 42 50
              Q 36 48 38 42
              Q 42 36 44 32
              Q 46 28 42 24
              Q 40 18 44 14
              Q 48 10 52 10 Z
            "
            fill="url(#land-fill)"
            stroke="rgba(170, 130, 80, 0.5)"
            strokeWidth="0.25"
          />
          {/* Interior vegetation overlay */}
          <path
            d="
              M 52 10
              Q 62 11 64 18 Q 66 24 62 28 Q 60 32 64 34 Q 68 38 66 44 Q 64 48 58 50
              Q 54 52 54 56 Q 56 62 54 68 Q 52 74 56 80 Q 60 86 58 90 Q 54 94 48 92
              Q 42 88 42 82 Q 44 74 42 68 Q 40 62 44 56 Q 46 52 42 50
              Q 36 48 38 42 Q 42 36 44 32 Q 46 28 42 24 Q 40 18 44 14 Q 48 10 52 10 Z
            "
            fill="url(#land-veg)"
          />
          {/* West coast beach strip (White Beach) — thin pale line along west side of south lobe */}
          <path
            d="M 44 56 Q 42 66 42 78 Q 44 86 47 90"
            fill="none"
            stroke="#fff1d4"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.6"
          />
          {/* North coast beach strip (Puka) */}
          <path
            d="M 48 12 Q 54 11 60 14"
            fill="none"
            stroke="#fff1d4"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.55"
          />

          {/* Small offshore rocks — Willy's Rock near south lobe */}
          <circle cx="44" cy="64" r="0.6" fill="rgba(170, 130, 80, 0.7)"/>
          <circle cx="43.6" cy="64.3" r="0.4" fill="rgba(170, 130, 80, 0.5)"/>

          {/* Crystal Cove offshore east */}
          <ellipse cx="69" cy="36" rx="2" ry="1.3" fill="url(#land-fill)" stroke="rgba(170,130,80,0.4)" strokeWidth="0.15"/>
          {/* Ariel's Point offshore west */}
          <ellipse cx="34" cy="46" rx="1.8" ry="1.2" fill="url(#land-fill)" stroke="rgba(170,130,80,0.4)" strokeWidth="0.15"/>

          {/* Dashed route path between revealed pins */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="0.5"
              strokeDasharray="1.2 1"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}
        </svg>

        {/* Compass + meta */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 9, color: 'var(--text-2)', fontWeight: 700, letterSpacing: '0.08em',
          padding: '4px 8px', borderRadius: 99,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
          Boracay · {items.length}
        </div>
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 26, height: 26, borderRadius: 99,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          display: 'grid', placeItems: 'center',
          fontSize: 10, color: 'var(--text-2)', fontWeight: 700,
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          <span style={{ fontSize: 7, color: 'var(--accent)', marginBottom: -2 }}>▲</span>
          <span style={{ fontSize: 8, lineHeight: 1 }}>N</span>
        </div>

        {/* Area labels — placed in the water, not on land, so they don't fight pins */}
        {[
          { label: 'Puka Beach',   x: 76, y: 15, align: 'left'  },
          { label: 'Mt. Luho',     x: 75, y: 28, align: 'left'  },
          { label: 'Diniwid',      x: 27, y: 40, align: 'right' },
          { label: 'Station 2',    x: 76, y: 52, align: 'left'  },
          { label: 'Station 1',    x: 24, y: 82, align: 'right' },
          { label: 'Crystal Cove', x: 78, y: 38, align: 'left'  },
          { label: "Ariel's Pt.",  x: 24, y: 48, align: 'right' },
        ].map(l => (
          <div key={l.label} style={{
            position: 'absolute', left: `${l.x}%`, top: `${l.y}%`,
            transform: l.align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            fontSize: 8, color: 'var(--text-3)',
            fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            opacity: 0.6,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {l.align === 'left' && <span style={{ width: 8, height: 1, background: 'var(--text-3)', opacity: 0.5, display: 'inline-block' }}/>}
              {l.label}
              {l.align === 'right' && <span style={{ width: 8, height: 1, background: 'var(--text-3)', opacity: 0.5, display: 'inline-block' }}/>}
            </span>
          </div>
        ))}

        {/* Home base marker — house icon */}
        <div style={{
          position: 'absolute', left: `${HOME.x}%`, top: `${HOME.y}%`,
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: 4,
            background: 'var(--accent)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 3px var(--card), 0 2px 8px rgba(0,0,0,0.18)',
            transform: 'rotate(45deg)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--on-black)" stroke="none" style={{ transform: 'rotate(-45deg)' }}>
              <path d="M12 3 L3 11 L5 11 L5 20 L10 20 L10 14 L14 14 L14 20 L19 20 L19 11 L21 11 Z"/>
            </svg>
          </div>
        </div>

        {/* Photo-thumbnail pins */}
        {clusters.map((cluster, cIdx) => {
          const primary = cluster.items[0];
          const primaryIdx = ordered.indexOf(primary);
          const isRevealed = primaryIdx < cursor;
          const isCurrent = primaryIdx === cursor - 1;
          const authorColor = MOMENT_PEOPLE[primary.by].color;
          const stackSize = cluster.items.length;

          return (
            <button
              key={cIdx}
              onClick={() => onOpen(primary)}
              style={{
                position: 'absolute',
                left: `${cluster.x}%`, top: `${cluster.y}%`,
                transform: `translate(-50%, -100%) scale(${isRevealed ? 1 : 0.5})`,
                opacity: isRevealed ? 1 : 0,
                transition: 'opacity 280ms ease, transform 340ms cubic-bezier(0.34,1.56,0.64,1)',
                padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                zIndex: isCurrent ? 20 : (10 + cIdx),
                filter: isCurrent ? 'none' : '',
              }}
              title={`${primary.place} · ${primary.time}`}
            >
              {/* stacked-pin visual */}
              <div style={{ position: 'relative', width: 36, height: 36 }}>
                {/* back tiles for stacks */}
                {stackSize > 1 && (
                  <>
                    <div style={{
                      position: 'absolute', inset: 0,
                      borderRadius: 10,
                      background: '#fff',
                      transform: 'translate(4px, -3px) rotate(4deg)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                    }}/>
                  </>
                )}
                {stackSize > 2 && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    borderRadius: 10,
                    background: '#fff',
                    transform: 'translate(-3px, -2px) rotate(-5deg)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                  }}/>
                )}
                {/* primary photo tile */}
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 10,
                  background: `url("${MOMENT_PHOTOS[primary.img]}") center/cover`,
                  border: `2px solid #fff`,
                  boxShadow: isCurrent
                    ? `0 0 0 2px ${authorColor}, 0 6px 16px rgba(0,0,0,0.28)`
                    : `0 2px 8px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)`,
                }}/>
                {/* count badge for stacks */}
                {stackSize > 1 && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    minWidth: 18, height: 18, padding: '0 4px',
                    borderRadius: 99,
                    background: authorColor,
                    color: '#0b0f14',
                    fontSize: 9, fontWeight: 700,
                    display: 'grid', placeItems: 'center',
                    border: '1.5px solid #fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
                  }}>
                    +{stackSize - 1}
                  </div>
                )}
              </div>
              {/* pin tail — triangle pointing down to exact location */}
              <svg width="10" height="8" viewBox="0 0 10 8" style={{ marginTop: -1, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.22))' }}>
                <path d="M 0 0 L 10 0 L 5 8 Z" fill="#fff"/>
              </svg>
              {/* anchor dot at exact point */}
              <div style={{
                width: 6, height: 6, borderRadius: 99,
                background: authorColor,
                border: '1.5px solid #fff',
                marginTop: -2,
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}/>
            </button>
          );
        })}

        {/* Current-moment caption — bottom left, inline with map */}
        {current && (
          <div style={{
            position: 'absolute',
            left: 12, bottom: 56,
            maxWidth: '62%',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${MOMENT_PEOPLE[current.by].color}`,
            borderRadius: 10,
            padding: '7px 10px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current.place}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1, fontWeight: 550 }}>
              {current.day} · {current.time}
            </div>
          </div>
        )}

        {/* In-map scrubber — overlays bottom of map */}
        <div style={{
          position: 'absolute', left: 10, right: 10, bottom: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px 6px 6px',
          borderRadius: 12,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        }}>
          <button
            onClick={() => {
              if (cursor >= ordered.length) setCursor(0);
              setPlaying(p => !p);
            }}
            style={{
              width: 26, height: 26, borderRadius: 99,
              background: 'var(--accent)', color: 'var(--on-black)',
              border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={ordered.length}
            value={cursor}
            onChange={(e) => { setPlaying(false); setCursor(parseInt(e.target.value, 10)); }}
            style={{
              flex: 1, accentColor: 'var(--accent)',
              height: 3, cursor: 'pointer', margin: 0,
            }}
          />
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
            {cursor}/{ordered.length}
          </div>
        </div>
      </div>

      {/* Chronological list below map */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ordered.map((m, i) => {
          const isRevealed = i < cursor;
          const authorColor = MOMENT_PEOPLE[m.by].color;
          return (
            <div
              key={i}
              onClick={() => onOpen(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${authorColor}`,
                borderRadius: 12,
                cursor: 'pointer',
                opacity: isRevealed ? 1 : 0.38,
                transition: 'opacity 200ms ease',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: `url("${MOMENT_PHOTOS[m.img]}") center/cover`,
                border: '1px solid var(--border)',
                flexShrink: 0,
                filter: isRevealed ? 'none' : 'grayscale(0.9)',
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.place}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{m.day} · {m.time}</div>
              </div>
              <Avatar k={m.by} size={20} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Lightbox ----------
function Lightbox({ m, onClose, onPrev, onNext, idx, total }) {
  if (!m) return null;
  const p = MOMENT_PEOPLE[m.by];
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(5, 7, 10, 0.92)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '14px 14px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#fff',
      }}>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 99,
          background: 'rgba(255,255,255,0.12)',
          border: 'none', color: '#fff', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.04em' }}>
          {idx + 1} / {total}
        </div>
        <button style={{
          width: 32, height: 32, borderRadius: 99,
          background: 'rgba(255,255,255,0.12)',
          border: 'none', color: '#fff', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/></svg>
        </button>
      </div>

      {/* Photo */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px' }}>
        <div style={{
          width: '100%', aspectRatio: '3 / 4',
          borderRadius: 14,
          backgroundImage: `url("${MOMENT_PHOTOS[m.img]}")`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}/>
        {/* Prev/next */}
        <button onClick={onPrev} style={navBtn('left')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={onNext} style={navBtn('right')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>

      {/* Meta sheet */}
      <div style={{
        margin: 14,
        padding: 14,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar k={m.by} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>{m.day} · {m.time}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.entries(m.reactions).map(([emo, n]) => (
              <div key={emo} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 8px', borderRadius: 99,
                background: 'rgba(255,255,255,0.10)',
                fontSize: 11, fontWeight: 600,
              }}>
                <span>{emo}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 550, marginBottom: 10 }}>{m.caption}</div>

        {/* Voice note in lightbox */}
        {m.voice && (
          <div style={{ marginBottom: 10 }}>
            <VoiceNote voice={m.voice} byColor={p.color} />
          </div>
        )}

        {/* Context chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <MetaChip icon="pin" label={m.place} />
          <MetaChip icon="sun" label={m.weather} />
          {m.expense && (
            <MetaChip icon="wallet" label={`${m.expense.label} · ${m.expense.amt}`} tone="accent" />
          )}
        </div>
      </div>
    </div>
  );
}

function navBtn(side) {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 18,
    width: 36, height: 36, borderRadius: 99,
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', cursor: 'pointer',
    display: 'grid', placeItems: 'center',
  };
}

function MetaChip({ icon, label, tone }) {
  const icons = {
    pin: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"/><circle cx="12" cy="9" r="2.5"/></svg>,
    sun: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>,
    wallet: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>,
  };
  const accent = tone === 'accent';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px', borderRadius: 99,
      background: accent ? 'rgba(216,171,122,0.18)' : 'rgba(255,255,255,0.08)',
      color: accent ? 'var(--accent-lt)' : 'rgba(255,255,255,0.85)',
      fontSize: 10.5, fontWeight: 600, letterSpacing: '-0.005em',
    }}>
      {icons[icon]}
      <span>{label}</span>
    </div>
  );
}

// ---------- Main ----------
function MomentsTab() {
  const [day, setDay] = React.useState('all');
  const [layout, setLayout] = React.useState(() => {
    try {
      const t = JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}');
      return t.momentsLayout || 'mosaic';
    } catch { return 'mosaic'; }
  });
  const [openIdx, setOpenIdx] = React.useState(null);

  React.useEffect(() => {
    window.__setMomentsLayout = setLayout;
    return () => { delete window.__setMomentsLayout; };
  }, []);

  // count per day
  const counts = React.useMemo(() => {
    const c = {};
    MOMENTS.forEach(m => { c[m.day] = (c[m.day] || 0) + 1; });
    return c;
  }, []);

  const filtered = day === 'all' ? MOMENTS : MOMENTS.filter(m => m.day === day);

  const handleOpen = (m) => {
    setOpenIdx(filtered.indexOf(m));
  };
  const openItem = openIdx == null ? null : filtered[openIdx];

  return (
    <>
      {/* Stats strip */}
      <div style={{
        padding: '0 16px 14px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        <StatBlock label="Moments" value={MOMENTS.length} />
        <StatBlock label="Places" value={new Set(MOMENTS.map(m => m.place)).size} />
        <StatBlock label="Days" value={Object.keys(counts).length} />
      </div>

      {/* Day filter */}
      <DayChips active={day} onChange={setDay} counts={counts} />

      {/* Layout switcher — inline pill */}
      <div style={{ padding: '0 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {filtered.length} {filtered.length === 1 ? 'moment' : 'moments'}
          {day !== 'all' && <> on {day}</>}
        </div>
        <div className="seg" style={{ padding: 2 }}>
          {[
            { v: 'mosaic', label: 'Mosaic' },
            { v: 'diary',  label: 'Diary' },
            { v: 'map',    label: 'Map' },
          ].map(o => (
            <button key={o.v}
              className={layout === o.v ? 'active' : ''}
              onClick={() => {
                setLayout(o.v);
                // also persist via tweaks
                try {
                  const t = JSON.parse(localStorage.getItem('afterstay_tweaks') || '{}');
                  t.momentsLayout = o.v;
                  localStorage.setItem('afterstay_tweaks', JSON.stringify(t));
                } catch {}
                window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { momentsLayout: o.v } }, '*');
              }}
              style={{ fontSize: 10.5, padding: '5px 10px' }}
            >{o.label}</button>
          ))}
        </div>
      </div>

      {/* Layouts */}
      {layout === 'mosaic' && <MosaicLayout items={filtered} onOpen={handleOpen} />}
      {layout === 'diary'  && <DiaryLayout  items={filtered} onOpen={handleOpen} />}
      {layout === 'map'    && <MapLayout    items={filtered} onOpen={handleOpen} />}

      {/* Upload CTA */}
      <div style={{ padding: '20px 16px 0' }}>
        <button style={{
          width: '100%', padding: '12px 14px',
          background: 'var(--card)', border: '1px dashed var(--border-2)',
          borderRadius: 14,
          color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--font-sans)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4l1.5 2h3a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3l1.5-2z"/>
            <circle cx="12" cy="13" r="3.5"/>
          </svg>
          Add moment
        </button>
      </div>

      {/* Lightbox */}
      {openItem && (
        <Lightbox
          m={openItem}
          idx={openIdx}
          total={filtered.length}
          onClose={() => setOpenIdx(null)}
          onPrev={() => setOpenIdx((openIdx - 1 + filtered.length) % filtered.length)}
          onNext={() => setOpenIdx((openIdx + 1) % filtered.length)}
        />
      )}
    </>
  );
}

function StatBlock({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      <div className="display mono" style={{ fontSize: 20, lineHeight: 1, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 550, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
    </div>
  );
}

// Home Moments preview — strip of recent shots, taps deep-link to Trip → Moments
function HomeMomentsPreview() {
  const moments = (window.MOMENTS || []).slice(-6).reverse();
  const photos = window.MOMENT_PHOTOS || [];
  const people = window.MOMENT_PEOPLE || {};
  if (!moments.length) return null;
  const totalCount = (window.MOMENTS || []).length;
  const hero = moments[0];
  const strip = moments.slice(1, 5);

  const goMoments = () => {
    try { localStorage.setItem('afterstay_trip_tab', 'moments'); } catch {}
    if (window.__setActive) window.__setActive('trip');
  };

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Hero recent moment */}
      <div onClick={goMoments} style={{
        position: 'relative', aspectRatio: '16 / 10',
        borderRadius: 18, overflow: 'hidden',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        backgroundImage: `url("${photos[hero.img]}")`,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.78) 100%)',
        }}/>
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
          padding: '4px 8px', borderRadius: 99,
          background: 'rgba(11,15,20,0.7)', backdropFilter: 'blur(6px)',
          color: 'rgba(255,255,255,0.92)',
          textTransform: 'uppercase',
        }}>Latest · {hero.day}</div>
        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 12,
          color: '#fff',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            "{hero.caption}"
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 99,
              background: people[hero.by]?.color || '#999',
              color: '#0b0f14', fontSize: 9, fontWeight: 700,
              display: 'grid', placeItems: 'center',
            }}>{hero.by}</div>
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.78)' }}>
              {people[hero.by]?.name} · {hero.place}
            </span>
          </div>
        </div>
      </div>

      {/* Thumbnail strip + view-all */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 6 }}>
        {strip.map((m, i) => (
          <div key={i} onClick={goMoments} style={{
            aspectRatio: '1 / 1',
            borderRadius: 10,
            backgroundImage: `url("${photos[m.img]}")`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}/>
        ))}
        <button onClick={goMoments} style={{
          aspectRatio: '1 / 1',
          borderRadius: 10,
          background: 'var(--accent)', color: 'var(--on-black)',
          border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2, padding: 0, minWidth: 58,
          fontFamily: 'var(--font-sans)',
        }}>
          <span className="display mono" style={{ fontSize: 16, lineHeight: 1 }}>+{totalCount - 5}</span>
          <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em' }}>VIEW ALL</span>
        </button>
      </div>
    </div>
  );
}

window.HomeMomentsPreview = HomeMomentsPreview;
window.MomentsTab = MomentsTab;
window.MOMENTS = MOMENTS;
window.MOMENT_PHOTOS = MOMENT_PHOTOS;
window.MOMENT_PEOPLE = MOMENT_PEOPLE;
