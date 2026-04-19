// Login — Afterstay welcome / sign-in
// Four entry paths: Apple, Google, Email, Phone. Animated constellation hero.

function LoginHero() {
  // Deterministic starfield + constellation + animated plane arc
  const stars = React.useMemo(() => {
    const rng = (s) => { let x = s; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
    const r = rng(7);
    return Array.from({ length: 44 }, () => ({
      x: r() * 100, y: r() * 100,
      s: 0.6 + r() * 1.6,
      o: 0.18 + r() * 0.55,
      d: r() * 4.5,           // twinkle delay
      td: 2.2 + r() * 2.8,    // twinkle duration
    }));
  }, []);

  // Constellation vertices
  const V = [[22,30],[54,18],[78,42],[60,62]];
  const linkPairs = [[0,1],[1,2],[2,0],[1,3]];

  return (
    <div style={{
      position: 'relative', height: 300, overflow: 'hidden',
      borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
      background: `
        radial-gradient(ellipse 80% 70% at 20% 20%, rgba(230, 135, 80, 0.32) 0%, transparent 62%),
        radial-gradient(ellipse 70% 60% at 85% 35%, rgba(198, 106, 54, 0.26) 0%, transparent 62%),
        radial-gradient(ellipse 90% 50% at 50% 100%, rgba(127, 55, 18, 0.32) 0%, transparent 72%),
        linear-gradient(160deg, #d58965 0%, #b9714a 55%, #955238 100%)
      `,
    }}>
      {/* starfield */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s * 0.15} fill="#fff"
            style={{ animation: `twinkle ${s.td}s ease-in-out ${s.d}s infinite`, opacity: s.o }}/>
        ))}
        {/* constellation lines — draw on entry */}
        <g stroke="#fff" strokeWidth="0.22" opacity="0.42" fill="none" strokeLinecap="round">
          {linkPairs.map(([a, b], i) => (
            <line key={i}
              x1={V[a][0]} y1={V[a][1]} x2={V[b][0]} y2={V[b][1]}
              style={{
                strokeDasharray: 80,
                strokeDashoffset: 80,
                animation: `drawLine 1.4s cubic-bezier(.55,.1,.3,1) ${0.35 + i * 0.18}s forwards`,
              }}/>
          ))}
        </g>
        {/* prominent stars — pulse in */}
        {V.map(([x,y], i) => (
          <g key={i} style={{
            opacity: 0,
            transformOrigin: `${x}px ${y}px`,
            animation: `starPop 0.6s cubic-bezier(.2,1.4,.4,1) ${0.15 + i * 0.12}s forwards`,
          }}>
            <circle cx={x} cy={y} r="2.8" fill="#ffeacc" opacity="0.16"/>
            <circle cx={x} cy={y} r="1" fill="#ffeacc"/>
          </g>
        ))}
      </svg>

      {/* animated plane along dashed arc */}
      <svg viewBox="0 0 390 300" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <path id="planePath" d="M-20,240 Q 120,100 260,180 T 420,130" fill="none"/>
        </defs>
        <use href="#planePath" stroke="#ffeacc" strokeOpacity="0.22" strokeWidth="1.2"
             strokeDasharray="3 4" fill="none"/>
        <g fill="#ffeacc" opacity="0.95">
          <g style={{ animation: 'planeFly 9s linear infinite' }}>
            <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
              <mpath href="#planePath"/>
            </animateMotion>
            <path d="M-7 0 L7 -1.6 L10 0 L7 1.6 Z"/>
            <path d="M0 -3.5 L2.6 0 L0 3.5 Z"/>
          </g>
        </g>
      </svg>

      {/* film grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.5  0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        opacity: 0.4, mixBlendMode: 'overlay', pointerEvents: 'none',
      }} />

      {/* brand lockup */}
      <div style={{
        position: 'absolute', left: 24, bottom: 28, right: 24,
        color: '#fffaf0',
        animation: 'heroUp 0.9s cubic-bezier(.2,.7,.2,1) 0.2s both',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px 4px 8px',
          background: 'rgba(255,250,240,0.14)',
          border: '1px solid rgba(255,250,240,0.22)',
          borderRadius: 999,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: 99, background: '#ffd9a8',
            animation: 'dotPulse 2.2s ease-in-out infinite',
          }}/>
          The trip, after the stay
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="40" height="40" viewBox="0 0 64 64" fill="none" style={{ color: '#fffaf0' }}>
            <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2.2" fill="none" opacity="0.95"/>
            <path d="M32 12 L52 48 L12 48 Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" fill="none"/>
            <path d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <div className="display" style={{
            fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.035em',
            color: '#fffaf0', fontWeight: 500,
          }}>
            after<span style={{ fontStyle: 'italic', fontWeight: 400, color: '#ffd9a8' }}>stay</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DividerOr() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 2px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--text-3)' }}>OR</div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
    </div>
  );
}

function SignInButton({ icon, label, bg, fg, border, onClick, shadow }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '14px 18px',
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        boxShadow: shadow || 'none',
        transform: press ? 'scale(0.985)' : hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 0.12s ease, box-shadow 0.18s ease',
      }}>
      {icon}
      {label}
    </button>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginTop: -2 }}>
      <path d="M17.6 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3.1 1-3.9 1-.8 0-2.1-.9-3.4-.9-1.7 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 2 2.7 3.3 2.6 1.3 0 1.8-.8 3.4-.8 1.6 0 2.1.8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.7-1-2.8-4.4zM15 5.5c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.4z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M3 7l9 6 9-6"/>
    </svg>
  );
}

// SMS / message bubble — distinct from a plain phone handset
function SMSIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 01-11.8 7L4 20.5l1.5-4.5A8 8 0 1121 12z"/>
      <circle cx="8.5" cy="12" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="12"  cy="12" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '15px 18px',
      background: disabled ? 'var(--card-2)' : 'var(--black)',
      color: disabled ? 'var(--text-3)' : 'var(--on-black)',
      border: '1px solid ' + (disabled ? 'var(--border)' : 'var(--black)'),
      borderRadius: 14,
      fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-sans)',
      transition: 'all 0.15s ease',
    }}>
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
      color: 'var(--text-3)', textTransform: 'uppercase',
      marginBottom: 8,
    }}>{children}</div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', autoFocus, prefix, inputMode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 14px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      height: 50,
      transition: 'border-color 0.15s',
    }}
    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {prefix && <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, paddingRight: 8, borderRight: '1px solid var(--border)' }}>{prefix}</div>}
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontSize: 15, color: 'var(--text)',
          fontFamily: 'var(--font-sans)', fontWeight: 500,
          letterSpacing: '-0.01em',
        }}
      />
    </div>
  );
}

function EmailPanel({ onBack, onContinue }) {
  const [email, setEmail] = React.useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <FieldLabel>Email</FieldLabel>
        <TextInput value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoFocus inputMode="email" />
      </div>
      <PrimaryButton onClick={() => valid && onContinue(email)} disabled={!valid}>
        Send magic link
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </PrimaryButton>
      <button onClick={onBack} style={{
        alignSelf: 'center', background: 'transparent', border: 'none',
        color: 'var(--text-3)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', padding: 8,
        fontFamily: 'var(--font-sans)',
      }}>
        ← Back to sign-in options
      </button>
    </div>
  );
}

function PhonePanel({ onBack, onContinue }) {
  const [cc, setCc] = React.useState('+63');
  const [phone, setPhone] = React.useState('');
  const valid = phone.replace(/\D/g, '').length >= 7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <FieldLabel>Mobile number</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={cc} onChange={(e) => setCc(e.target.value)} style={{
            width: 96, padding: '0 8px', height: 50,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            fontSize: 14, color: 'var(--text)', fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23857d70' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            paddingRight: 22,
          }}>
            <option value="+63">🇵🇭 +63</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+61">🇦🇺 +61</option>
            <option value="+65">🇸🇬 +65</option>
            <option value="+81">🇯🇵 +81</option>
            <option value="+91">🇮🇳 +91</option>
          </select>
          <div style={{ flex: 1 }}>
            <TextInput value={phone} onChange={setPhone} placeholder="917 555 0123" type="tel" inputMode="tel" autoFocus/>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
          We'll text you a 6-digit code. Standard message rates may apply.
        </div>
      </div>
      <PrimaryButton onClick={() => valid && onContinue(cc + phone)} disabled={!valid}>
        Send verification code
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </PrimaryButton>
      <button onClick={onBack} style={{
        alignSelf: 'center', background: 'transparent', border: 'none',
        color: 'var(--text-3)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', padding: 8,
        fontFamily: 'var(--font-sans)',
      }}>
        ← Back to sign-in options
      </button>
    </div>
  );
}

function SentPanel({ kind, target, onDone, onBack }) {
  const isEmail = kind === 'email';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center', paddingTop: 6 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 999,
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        display: 'grid', placeItems: 'center',
        color: 'var(--accent)',
        animation: 'popIn 0.5s cubic-bezier(.2,1.4,.3,1) both',
      }}>
        {isEmail ? <EmailIcon/> : <SMSIcon/>}
      </div>
      <div>
        <div className="display" style={{ fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 6 }}>
          {isEmail ? 'Check your inbox' : 'Check your messages'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
          We sent a {isEmail ? 'magic link' : '6-digit code'} to<br/>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{target}</span>
        </div>
      </div>
      <div style={{ width: '100%', marginTop: 4 }}>
        <PrimaryButton onClick={onDone}>
          Continue to Afterstay
        </PrimaryButton>
      </div>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none',
        color: 'var(--text-3)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', padding: 4,
        fontFamily: 'var(--font-sans)',
      }}>
        Use a different {isEmail ? 'email' : 'number'}
      </button>
    </div>
  );
}

function LoginScreen({ onSignedIn }) {
  const [mode, setMode] = React.useState('root');
  const [sent, setSent] = React.useState({ kind: null, target: null });

  const finish = () => {
    try { localStorage.setItem('afterstay_authed', '1'); } catch {}
    onSignedIn && onSignedIn();
  };

  // Stagger helper — each option fades up with a small delay
  const staggerStyle = (i) => ({
    opacity: 0,
    animation: `optIn 0.5s cubic-bezier(.2,.7,.2,1) ${0.45 + i * 0.07}s forwards`,
  });

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--bg)',
      overflowY: 'auto', overflowX: 'hidden',
    }} className="no-scroll">
      {/* Shared keyframes */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--tw, 0.25); transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.6); }
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
        @keyframes starPop {
          0% { opacity: 0; transform: scale(0.2); }
          70% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes heroUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes optIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.6; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <LoginHero />

      <div style={{ padding: '26px 22px 28px' }}>
        {mode === 'root' && (
          <>
            <div style={{ marginBottom: 20, ...staggerStyle(0) }}>
              <div className="display" style={{
                fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.03em',
                color: 'var(--text)', marginBottom: 6,
              }}>
                Welcome in.
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 310 }}>
                Your trip doesn't end at checkout. Sign in to keep the moments, the memories, the next one.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Apple first — iOS default */}
              <div style={staggerStyle(1)}>
                <SignInButton
                  onClick={finish}
                  icon={<AppleIcon/>}
                  label="Continue with Apple"
                  bg="#000"
                  fg="#fff"
                  border="#000"
                  shadow="0 1px 2px rgba(0,0,0,0.12)"
                />
              </div>

              {/* Google second */}
              <div style={staggerStyle(2)}>
                <SignInButton
                  onClick={finish}
                  icon={<GoogleIcon/>}
                  label="Continue with Google"
                  bg="#fff"
                  fg="#1f1f1f"
                  border="#dadce0"
                  shadow="0 1px 2px rgba(60,64,67,0.08)"
                />
              </div>

              <div style={staggerStyle(3)}>
                <DividerOr />
              </div>

              {/* Email third */}
              <div style={staggerStyle(4)}>
                <SignInButton
                  onClick={() => setMode('email')}
                  icon={<EmailIcon/>}
                  label="Continue with email"
                  bg="var(--card)"
                  fg="var(--text)"
                  border="var(--border)"
                />
              </div>

              {/* Phone last — SMS bubble icon */}
              <div style={staggerStyle(5)}>
                <SignInButton
                  onClick={() => setMode('phone')}
                  icon={<SMSIcon/>}
                  label="Continue with phone"
                  bg="var(--card)"
                  fg="var(--text)"
                  border="var(--border)"
                />
              </div>
            </div>

            {/* Social proof strip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 22, padding: '12px 14px',
              background: 'var(--card-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              ...staggerStyle(6),
            }}>
              <div style={{ display: 'flex' }}>
                {['#a64d1e', '#c66a36', '#b8892b'].map((c, i) => (
                  <div key={i} style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: c, marginLeft: i === 0 ? 0 : -6,
                    border: '2px solid var(--card-2)',
                  }}/>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>Peter, Aaron & Jane</span> are already on Afterstay.
              </div>
            </div>

            {/* Legal */}
            <div style={{
              marginTop: 18, fontSize: 10.5, color: 'var(--text-3)',
              textAlign: 'center', lineHeight: 1.55,
              letterSpacing: '0.01em',
              ...staggerStyle(7),
            }}>
              By continuing you agree to our{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'var(--accent-border)', textUnderlineOffset: 2 }}>Terms</span>
              {' '}&{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'var(--accent-border)', textUnderlineOffset: 2 }}>Privacy</span>.
            </div>
          </>
        )}

        {mode === 'email' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div className="display" style={{
                fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.03em',
                color: 'var(--text)', marginBottom: 6,
              }}>
                Sign in with email
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                We'll send a secure link — no password to remember.
              </div>
            </div>
            <EmailPanel
              onBack={() => setMode('root')}
              onContinue={(addr) => { setSent({ kind: 'email', target: addr }); setMode('sent'); }}
            />
          </>
        )}

        {mode === 'phone' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div className="display" style={{
                fontSize: 24, lineHeight: 1.1, letterSpacing: '-0.03em',
                color: 'var(--text)', marginBottom: 6,
              }}>
                Sign in with phone
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                Get a one-time code to verify your number.
              </div>
            </div>
            <PhonePanel
              onBack={() => setMode('root')}
              onContinue={(num) => { setSent({ kind: 'phone', target: num }); setMode('sent'); }}
            />
          </>
        )}

        {mode === 'sent' && (
          <SentPanel
            kind={sent.kind}
            target={sent.target}
            onDone={finish}
            onBack={() => setMode(sent.kind)}
          />
        )}
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
