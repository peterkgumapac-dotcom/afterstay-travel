// Loader — "Living Postcard" itinerary loader.
// A series of animated travel vignettes rotate through while we formulate the trip.
// No progress bar. No percentages. Just motion + personality.

function ItineraryLoader({ onDone, durationMs = 6500, destination = 'Boracay', name = 'Peter' }) {
  const scenes = React.useMemo(() => ([
    { k: 'plane',    line: `Packing your passport, ${name}`,              sub: 'Pulling bookings from your inbox…' },
    { k: 'map',      line: `Dropping pins around ${destination}`,         sub: 'Hotels, beaches, that sisig spot.' },
    { k: 'sun',      line: 'Reading the skies',                           sub: 'Sunrise at 5:42, rain at 8pm.' },
    { k: 'postcard', line: 'Stitching your days together',                sub: 'Seven perfect ones, coming up.' },
    { k: 'compass',  line: `Ready when you are, ${name}`,                 sub: 'Tap to begin.' },
  ]), [destination, name]);

  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const per = durationMs / scenes.length;
    const t = setInterval(() => {
      setIdx(i => {
        if (i >= scenes.length - 1) { clearInterval(t); setTimeout(() => onDone && onDone(), 650); return i; }
        return i + 1;
      });
    }, per);
    return () => clearInterval(t);
  }, [durationMs, onDone, scenes.length]);

  const scene = scenes[idx];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse 70% 55% at 50% 28%, rgba(198, 106, 54, 0.28) 0%, transparent 62%),
        radial-gradient(ellipse 60% 45% at 70% 85%, rgba(127, 55, 18, 0.26) 0%, transparent 72%),
        var(--bg)
      `,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.65  0 0 0 0 0.45  0 0 0 0 0.25  0 0 0 0.22 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        opacity: 0.32, mixBlendMode: 'soft-light',
      }} />

      {/* Brand */}
      <div style={{ padding: '28px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="26" height="26" viewBox="0 0 64 64" fill="none" style={{ color: 'var(--accent)' }}>
          <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2.2" fill="none" opacity="0.95"/>
          <path d="M32 12 L52 48 L12 48 Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" fill="none"/>
          <path d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <div className="display" style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          after<span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500 }}>stay</span>
        </div>
        {/* Scene dots */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {scenes.map((_, i) => (
            <div key={i} style={{
              width: i === idx ? 16 : 5, height: 5, borderRadius: 99,
              background: i <= idx ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.45s cubic-bezier(.4,.1,.2,1)',
            }}/>
          ))}
        </div>
      </div>

      {/* Stage — animated postcard */}
      <div style={{
        flex: 1, position: 'relative', margin: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div key={scene.k} style={{
          width: '100%', maxWidth: 310, aspectRatio: '1 / 1.05',
          position: 'relative',
          animation: 'sceneIn 0.55s cubic-bezier(.2,.8,.2,1) both',
        }}>
          {scene.k === 'plane'    && <PlaneScene/>}
          {scene.k === 'map'      && <MapPinScene/>}
          {scene.k === 'sun'      && <SunriseScene/>}
          {scene.k === 'postcard' && <PostcardScene/>}
          {scene.k === 'compass'  && <CompassScene/>}
        </div>
      </div>

      {/* Copy */}
      <div style={{ padding: '4px 28px 40px', textAlign: 'center' }}>
        <div key={'line' + idx} className="display" style={{
          fontSize: 24, lineHeight: 1.15, letterSpacing: '-0.025em', color: 'var(--text)',
          animation: 'copyIn 0.5s ease-out both',
          minHeight: 30,
        }}>
          {scene.line}
          {idx < scenes.length - 1 && (
            <span style={{ display: 'inline-flex', marginLeft: 2 }}>
              <span style={{ animation: 'dot 1.2s infinite 0s' }}>.</span>
              <span style={{ animation: 'dot 1.2s infinite 0.2s' }}>.</span>
              <span style={{ animation: 'dot 1.2s infinite 0.4s' }}>.</span>
            </span>
          )}
        </div>
        <div key={'sub' + idx} style={{
          fontSize: 13, color: 'var(--text-3)', marginTop: 8,
          animation: 'copyIn 0.5s ease-out 0.08s both',
        }}>
          {scene.sub}
        </div>
      </div>

      <style>{`
        @keyframes sceneIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes copyIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dot {
          0%, 20% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes spinSlow { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes drawPath { to { stroke-dashoffset: 0; } }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.2) translateY(-10px); }
          70% { opacity: 1; transform: scale(1.15) translateY(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes bobPin {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes sunRise {
          from { transform: translateY(50px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes cloudDrift {
          from { transform: translateX(-20px); }
          to   { transform: translateX(20px); }
        }
        @keyframes stampIn {
          0% { opacity: 0; transform: rotate(-20deg) scale(0.4); }
          60% { opacity: 1; transform: rotate(-12deg) scale(1.1); }
          100% { opacity: 0.95; transform: rotate(-8deg) scale(1); }
        }
        @keyframes cardFlip {
          from { transform: rotateY(-12deg) translateY(6px); opacity: 0; }
          to   { transform: rotateY(0) translateY(0); opacity: 1; }
        }
        @keyframes needlePoint {
          0% { transform: rotate(-40deg); }
          40% { transform: rotate(65deg); }
          70% { transform: rotate(30deg); }
          100% { transform: rotate(45deg); }
        }
      `}</style>
    </div>
  );
}

/* === Scenes === */

function PlaneScene() {
  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
      <defs>
        <path id="planeArc" d="M 30 230 Q 150 60 270 180" fill="none"/>
        <linearGradient id="planeSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e38868" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#7f3712" stopOpacity="0.05"/>
        </linearGradient>
      </defs>
      {/* sky wash */}
      <rect x="0" y="0" width="300" height="300" fill="url(#planeSky)"/>
      {/* distant mountains */}
      <path d="M 0 240 L 60 190 L 110 220 L 170 170 L 230 215 L 300 180 L 300 300 L 0 300 Z"
            fill="var(--accent)" opacity="0.18"/>
      {/* arc */}
      <use href="#planeArc" stroke="var(--accent)" strokeWidth="1.4"
           strokeDasharray="4 5" fill="none" opacity="0.55"
           style={{ strokeDashoffset: 400, strokeDasharray: '400 400', animation: 'drawPath 2s ease-out forwards' }}/>
      {/* plane */}
      <g fill="var(--accent)" stroke="#fffaf0" strokeWidth="1">
        <g>
          <animateMotion dur="2.2s" repeatCount="indefinite" rotate="auto">
            <mpath href="#planeArc"/>
          </animateMotion>
          <g transform="scale(1.2)">
            <path d="M-11 0 L11 -3 L15 0 L11 3 Z"/>
            <path d="M0 -5 L4 0 L0 5 Z"/>
            <path d="M-5 -0.5 L-5 0.5 L-11 2.5 L-11 -2.5 Z"/>
          </g>
        </g>
      </g>
      {/* sun */}
      <circle cx="220" cy="90" r="22" fill="#ffd9a8" opacity="0.7"/>
      <circle cx="220" cy="90" r="14" fill="#ffeacc"/>
    </svg>
  );
}

function MapPinScene() {
  const pins = [
    { x: 90,  y: 95,  d: 0.1 },
    { x: 175, y: 140, d: 0.35 },
    { x: 220, y: 90,  d: 0.6 },
    { x: 130, y: 200, d: 0.85 },
    { x: 225, y: 215, d: 1.1 },
  ];
  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
      {/* paper card */}
      <rect x="20" y="30" width="260" height="240" rx="16"
            fill="var(--card-2)" stroke="var(--border)"/>
      {/* grid */}
      <g stroke="var(--border)" strokeWidth="0.6" opacity="0.7">
        {Array.from({length: 8}, (_, i) => <line key={'h'+i} x1="20" y1={30 + i * 30} x2="280" y2={30 + i * 30}/>)}
        {Array.from({length: 9}, (_, i) => <line key={'v'+i} x1={20 + i * 30} y1="30" x2={20 + i * 30} y2="270"/>)}
      </g>
      {/* coastline blob */}
      <path d="M 50 140 Q 80 90 140 110 Q 200 120 240 180 Q 220 240 160 230 Q 90 235 60 200 Z"
            fill="var(--accent)" opacity="0.14" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.4"
            strokeDasharray="3 3"/>
      {/* path connecting pins */}
      <polyline
        points={pins.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"
        strokeDasharray="300 300" strokeDashoffset="300"
        style={{ animation: 'drawPath 1.6s ease-out 0.2s forwards' }}/>
      {/* pins */}
      {pins.map((p, i) => (
        <g key={i} style={{
          opacity: 0,
          transformOrigin: `${p.x}px ${p.y}px`,
          animation: `popIn 0.5s cubic-bezier(.2,1.4,.3,1) ${p.d}s forwards, bobPin 2.4s ease-in-out ${p.d + 0.7}s infinite`,
        }}>
          <path d={`M ${p.x} ${p.y - 18} C ${p.x - 8} ${p.y - 18} ${p.x - 8} ${p.y - 6} ${p.x} ${p.y} C ${p.x + 8} ${p.y - 6} ${p.x + 8} ${p.y - 18} ${p.x} ${p.y - 18} Z`}
                fill="var(--accent)"/>
          <circle cx={p.x} cy={p.y - 12} r="3" fill="#fffaf0"/>
        </g>
      ))}
    </svg>
  );
}

function SunriseScene() {
  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c66a36"/>
          <stop offset="60%" stopColor="#e38868"/>
          <stop offset="100%" stopColor="#ffd9a8"/>
        </linearGradient>
        <clipPath id="horizonClip">
          <rect x="0" y="0" width="300" height="200"/>
        </clipPath>
      </defs>
      <rect x="0" y="0" width="300" height="200" fill="url(#skyGrad)" opacity="0.85"/>
      {/* rays */}
      <g clipPath="url(#horizonClip)" style={{ transformOrigin: '150px 200px', animation: 'spinSlow 30s linear infinite' }}>
        {Array.from({length: 12}, (_, i) => (
          <line key={i} x1="150" y1="200" x2="150" y2="-60"
                stroke="#fffaf0" strokeWidth="1.5" opacity="0.18"
                transform={`rotate(${i * 30} 150 200)`}/>
        ))}
      </g>
      {/* sun rising */}
      <g style={{ animation: 'sunRise 1.8s cubic-bezier(.2,.7,.2,1) forwards' }}>
        <circle cx="150" cy="200" r="60" fill="#fffaf0" opacity="0.35"/>
        <circle cx="150" cy="200" r="44" fill="#ffeacc"/>
      </g>
      {/* drifting clouds */}
      <g style={{ animation: 'cloudDrift 8s ease-in-out infinite alternate' }}>
        <ellipse cx="70" cy="85" rx="28" ry="7" fill="#fffaf0" opacity="0.5"/>
        <ellipse cx="210" cy="65" rx="34" ry="8" fill="#fffaf0" opacity="0.4"/>
      </g>
      {/* water */}
      <rect x="0" y="200" width="300" height="100" fill="#7f3712" opacity="0.5"/>
      {/* water reflection lines */}
      <g stroke="#ffeacc" strokeWidth="1.5" strokeLinecap="round" opacity="0.45">
        <line x1="120" y1="220" x2="180" y2="220"/>
        <line x1="100" y1="240" x2="200" y2="240"/>
        <line x1="80" y1="258" x2="220" y2="258"/>
        <line x1="60" y1="276" x2="240" y2="276"/>
      </g>
    </svg>
  );
}

function PostcardScene() {
  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
      {/* back card */}
      <g style={{ animation: 'cardFlip 0.7s ease-out 0.3s both' }}>
        <rect x="50" y="70" width="220" height="160" rx="6"
              fill="var(--card)" stroke="var(--border)" transform="rotate(4 160 150)"/>
      </g>
      {/* middle card */}
      <g style={{ animation: 'cardFlip 0.7s ease-out 0.15s both' }}>
        <rect x="50" y="70" width="220" height="160" rx="6"
              fill="var(--card)" stroke="var(--border)" transform="rotate(-3 160 150)"/>
      </g>
      {/* top card */}
      <g style={{ animation: 'cardFlip 0.7s ease-out 0s both' }}>
        <rect x="50" y="70" width="220" height="160" rx="6"
              fill="#fffaf0" stroke="var(--accent)" strokeOpacity="0.3"/>
        {/* divider */}
        <line x1="160" y1="82" x2="160" y2="218" stroke="var(--accent)" strokeOpacity="0.3" strokeDasharray="2 3"/>
        {/* left: tiny scene */}
        <rect x="62" y="82" width="86" height="80" fill="#e38868" opacity="0.4"/>
        <circle cx="132" cy="108" r="12" fill="#ffeacc"/>
        <path d="M 62 142 Q 90 125 120 135 Q 145 145 148 150 L 148 162 L 62 162 Z" fill="#7f3712" opacity="0.55"/>
        {/* handwritten lines */}
        <g stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
          <line x1="62"  y1="180" x2="140" y2="180"/>
          <line x1="62"  y1="192" x2="130" y2="192"/>
          <line x1="62"  y1="204" x2="146" y2="204"/>
        </g>
        {/* right: address lines */}
        <g stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
          <line x1="172" y1="130" x2="250" y2="130"/>
          <line x1="172" y1="144" x2="240" y2="144"/>
          <line x1="172" y1="158" x2="250" y2="158"/>
          <line x1="172" y1="172" x2="220" y2="172"/>
        </g>
        {/* stamp */}
        <g transform="translate(238, 98)" style={{ transformOrigin: '238px 98px', animation: 'stampIn 0.5s cubic-bezier(.2,1.4,.3,1) 0.9s both' }}>
          <rect x="-18" y="-14" width="36" height="28" fill="var(--accent)" stroke="#fffaf0" strokeWidth="2" strokeDasharray="3 2"/>
          <path d="M -8 -4 L 8 -4 L 0 6 Z" fill="#fffaf0"/>
        </g>
      </g>
    </svg>
  );
}

function CompassScene() {
  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
      {/* outer ring */}
      <circle cx="150" cy="150" r="110" fill="var(--card)" stroke="var(--accent)" strokeWidth="2"/>
      <circle cx="150" cy="150" r="96" fill="none" stroke="var(--accent)" strokeOpacity="0.35" strokeDasharray="2 4"/>
      {/* tick marks */}
      <g stroke="var(--text-2)" strokeWidth="1.2">
        {Array.from({length: 32}, (_, i) => {
          const a = (i * 360 / 32) * Math.PI / 180;
          const r1 = i % 4 === 0 ? 82 : 90;
          return (
            <line key={i}
              x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1}
              x2={150 + Math.cos(a) * 100} y2={150 + Math.sin(a) * 100}
              opacity={i % 4 === 0 ? 1 : 0.4}/>
          );
        })}
      </g>
      {/* cardinal letters */}
      {[['N', 150, 68], ['E', 232, 155], ['S', 150, 242], ['W', 68, 155]].map(([l, x, y]) => (
        <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontFamily="var(--font-sans)" fontSize="13" fontWeight="700"
              fill={l === 'N' ? 'var(--accent)' : 'var(--text-2)'}>{l}</text>
      ))}
      {/* needle */}
      <g style={{ transformOrigin: '150px 150px', animation: 'needlePoint 1.6s cubic-bezier(.3,.6,.3,1) forwards' }}>
        <path d="M 150 82 L 158 150 L 150 218 L 142 150 Z" fill="var(--accent)" opacity="0.95"/>
        <path d="M 150 82 L 158 150 L 142 150 Z" fill="var(--accent)"/>
        <path d="M 150 218 L 158 150 L 142 150 Z" fill="var(--text-dim)"/>
      </g>
      {/* center hub */}
      <circle cx="150" cy="150" r="7" fill="#fffaf0" stroke="var(--accent)" strokeWidth="2"/>
      <circle cx="150" cy="150" r="2.5" fill="var(--accent)"/>
      {/* floating sparkles */}
      <g fill="var(--accent)" opacity="0.8">
        <circle cx="70"  cy="70"  r="2" style={{ animation: 'float 2.4s ease-in-out infinite' }}/>
        <circle cx="240" cy="90"  r="1.6" style={{ animation: 'float 2.8s ease-in-out 0.3s infinite' }}/>
        <circle cx="230" cy="240" r="2" style={{ animation: 'float 2.2s ease-in-out 0.6s infinite' }}/>
        <circle cx="60"  cy="230" r="1.6" style={{ animation: 'float 2.6s ease-in-out 0.9s infinite' }}/>
      </g>
    </svg>
  );
}

window.ItineraryLoader = ItineraryLoader;
