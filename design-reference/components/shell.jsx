// Shell — status bar, top bar, 5-tab bottom nav
// Tabs match real app: Home · Guide · Discover · Budget · Trips

const HOTEL_PHOTOS = [
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1400&q=80',
  'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1400&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1400&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&q=80',
].map(u => (window.resolveUrl ? window.resolveUrl(u) : u));

function StatusBar() {
  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px 0 32px', fontSize: 15, fontWeight: 600,
      color: 'var(--text)', letterSpacing: '-0.01em',
    }}>
      <span className="mono">9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          <path d="M1 7h2v3H1zM5 5h2v5H5zM9 3h2v7H9zM13 1h2v9h-2z" fill="currentColor"/>
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <path d="M8 3c2 0 3.8.7 5.2 2l1.3-1.4C12.8 2 10.5 1 8 1S3.2 2 1.5 3.6L2.8 5C4.2 3.7 6 3 8 3zm0 3c1.2 0 2.3.4 3.2 1.2l1.3-1.4C11.3 4.7 9.7 4 8 4s-3.3.7-4.5 1.8l1.3 1.4C5.7 6.4 6.8 6 8 6zm0 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill="currentColor"/>
        </svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: 24, height: 11, border: '1.2px solid currentColor', borderRadius: 3,
            padding: 1, opacity: 0.9,
          }}>
            <div style={{ width: '85%', height: '100%', background: 'currentColor', borderRadius: 1.5 }} />
          </div>
          <div style={{ width: 1.5, height: 4, background: 'currentColor', borderRadius: 0.5, opacity: 0.7 }} />
        </div>
      </div>
    </div>
  );
}

function TopBar({ title, subtitle, right, onBack, compact = false }) {
  const defaultMark = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width="22" height="22" viewBox="0 0 64 64" fill="none" style={{ color: 'var(--accent)' }}>
        <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2.4" fill="none" opacity="0.95"/>
        <path d="M32 12 L52 48 L12 48 Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" fill="none"/>
        <path d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
      <span className="display" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text-2)' }}>
        after<span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500 }}>stay</span>
      </span>
    </div>
  );
  return (
    <div style={{
      padding: compact ? '8px 20px 10px' : '10px 20px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {onBack && (
          <button className="icon-btn round" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{subtitle}</div>}
          <div className="display" style={{ fontSize: compact ? 22 : 26, lineHeight: 1.1, color: 'var(--text)' }}>{title}</div>
        </div>
      </div>
      {right || defaultMark}
    </div>
  );
}

// 5-tab bottom bar, floating pill
function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'home',     label: 'Home',     icon: 'home' },
    { id: 'guide',    label: 'Guide',    icon: 'book' },
    { id: 'discover', label: 'Discover', icon: 'compass' },
    { id: 'budget',   label: 'Budget',   icon: 'wallet' },
    { id: 'trip',     label: 'Trips', icon: 'users' },
  ];

  const icons = {
    home: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5H4.5A1.5 1.5 0 013 20z"/><polyline points="9 21.5 9 12.5 15 12.5 15 21.5"/></svg>),
    book: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4.5A1.5 1.5 0 015.5 3H20v15H5.5A1.5 1.5 0 004 19.5z"/><path d="M4 19.5A1.5 1.5 0 005.5 21H20"/></svg>),
    compass: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="16.2 7.8 13.8 13.8 7.8 16.2 10.2 10.2 16.2 7.8"/></svg>),
    wallet: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor"/></svg>),
    users: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="7" r="2.5"/><path d="M15.5 13.8c2.7.3 5 2.5 5.5 5.2"/></svg>),
  };

  return (
    <div style={{
      position: 'absolute', bottom: 10, left: 10, right: 10, zIndex: 50,
      padding: 4,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      boxShadow: 'var(--shadow-lg)',
      display: 'flex', gap: 2, alignItems: 'center',
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '9px 0 7px',
            background: isActive ? 'var(--accent-bg)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-3)',
            border: 'none', borderRadius: 18, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600,
            letterSpacing: '-0.01em',
            transition: 'all 0.18s',
          }}>
            {icons[t.icon]}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Page wrap
function Page({ children, pad = true }) {
  return (
    <div className="no-scroll" style={{
      position: 'absolute', inset: 0,
      overflowY: 'auto', overflowX: 'hidden',
      paddingBottom: 90,
    }}>
      {children}
    </div>
  );
}

// Module group header (smart grouping signature — section label + line)
function GroupHeader({ kicker, title, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '22px 20px 10px',
    }}>
      <div>
        {kicker && <div className="eyebrow">{kicker}</div>}
        <div className="display" style={{ fontSize: 20, lineHeight: 1.15, marginTop: 3, color: 'var(--text)' }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// Collapsible section — header that toggles its content. Matches GroupHeader type scale.
function CollapsibleSection({ kicker, title, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', appearance: 'none', cursor: 'pointer',
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          padding: '22px 20px 10px',
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div>
          {kicker && <div className="eyebrow">{kicker}</div>}
          <div className="display" style={{ fontSize: 20, lineHeight: 1.15, marginTop: 3, color: 'var(--text)' }}>{title}</div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--text-3)', fontWeight: 500,
          paddingBottom: 4,
        }}>
          {open ? 'Hide' : 'Show'}
          <svg width="11" height="11" viewBox="0 0 10 10" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.22s' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 16px', animation: 'collapseIn 0.25s ease' }}>
          {children}
        </div>
      )}
      <style>{`
        @keyframes collapseIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Generic row
function Row({ icon, title, meta, value, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {icon && (
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--card-2)',
          display: 'grid', placeItems: 'center',
          color: 'var(--text-2)',
        }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
        {meta && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{meta}</div>}
      </div>
      {value && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{value}</div>}
    </div>
  );
}

// Expose
Object.assign(window, { StatusBar, TopBar, TabBar, Page, GroupHeader, CollapsibleSection, Row, HOTEL_PHOTOS });
