// Discover — Trip Planner (AI itinerary) + Places tab

const CATEGORIES = [
  { id: 'beach',    label: 'Beaches',     emoji: '🏝️', color: '#7ac4d6' },
  { id: 'food',     label: 'Food',        emoji: '🍜', color: '#e8a860' },
  { id: 'activity', label: 'Activities',  emoji: '🌊', color: '#5a8fb5' },
  { id: 'nightlife',label: 'Nightlife',   emoji: '🍹', color: '#b66a8a' },
  { id: 'photo',    label: 'Photo spots', emoji: '📸', color: '#8b6f5a' },
  { id: 'wellness', label: 'Wellness',    emoji: '🧘', color: '#7ba88a' },
];

const CATEGORY_SUGGESTIONS = {
  beach:     ['Puka Shell Beach', 'White Beach Station 1', 'Diniwid cove', 'Ilig-Iligan', 'Bulabog wind beach'],
  food:      ['Best local eats', 'Fresh seafood grills', 'Late-night ihaw-ihaw', 'Coffee & brunch', 'Must-try halo-halo'],
  activity:  ['Island hopping', 'Parasailing', 'Snorkeling reefs', 'Helmet diving', 'Kite-surfing Bulabog'],
  nightlife: ['Beachfront sundowners', 'Live music bars', 'Fire dancers', 'Sky bar rooftop', 'Late-night clubs'],
  photo:     ['Willy\'s Rock at sunset', 'Drone-friendly viewpoints', 'Puka sunset', 'Mt Luho overlook', 'Pastel cafés'],
  wellness:  ['Beachside massage', 'Yoga at sunrise', 'Spa day', 'Wellness retreats', 'Juice & smoothie bars'],
};

const FIRST_VISIT_CHIPS = [
  '🌅 Sunset at Puka', '🏝️ Island hopping', '🍽️ Best local eats',
  '🌊 Snorkeling spots', '📸 Photo spots', '🍹 Sundowners',
  '⚡ Must-do firsts', '🎯 Hidden gems',
];

const ITINERARY_STYLES = [
  { id: 'relaxed',   label: 'Relaxed',   sub: 'Slow mornings, spa, sunsets' },
  { id: 'adventure', label: 'Adventure', sub: 'Water sports, trails, reefs' },
  { id: 'foodie',    label: 'Foodie',    sub: 'Local eats, markets, bars' },
  { id: 'family',    label: 'Family',    sub: 'Kid-safe, easy access' },
  { id: 'culture',   label: 'Culture',   sub: 'History, markets, locals' },
];

const PLACES = [
  { n: 'Puka Shell Beach',     t: 'Beach',      r: 4.7, rv: '3.2k', d: '4.2 km', dn: 4.2, price: 0, openNow: true,  img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80' },
  { n: "D'Mall",               t: 'Shopping',   r: 4.3, rv: '1.8k', d: '1.6 km', dn: 1.6, price: 2, openNow: true,  img: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&q=80' },
  { n: 'Willy\'s Rock',        t: 'Landmark',   r: 4.5, rv: '2.1k', d: '900 m',  dn: 0.9, price: 0, openNow: true,  img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80' },
  { n: 'Jonah\'s Fruit Shake', t: 'Restaurant', r: 4.6, rv: '890',  d: '1.2 km', dn: 1.2, price: 1, openNow: false, img: 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?w=800&q=80' },
].map(p => ({ ...p, img: (window.resolveUrl ? window.resolveUrl(p.img) : p.img) }));

const TRENDING = [
  { n: 'Island hopping tour',  pr: '₱1,800',   img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80' },
  { n: 'Parasailing',          pr: '₱1,200',   img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80' },
  { n: 'Sunset sail',          pr: '₱1,500',   img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80' },
].map(t => ({ ...t, img: (window.resolveUrl ? window.resolveUrl(t.img) : t.img) }));

function DiscoverScreen() {
  const [tab, setTab] = React.useState('planner'); // planner | places | saved
  const [prompt, setPrompt] = React.useState('');
  const [style, setStyle] = React.useState('relaxed');
  const [saved, setSaved] = React.useState(() => new Set());
  const [recommended, setRecommended] = React.useState(() => new Set());
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState({
    minRating: 0,   // 0 | 4.0 | 4.5
    openNow: false,
    nearby: false,  // ≤ 2 km
    maxPrice: 3,    // 0–3 (free, $, $$, $$$)
  });
  const toggleSave = (name) => setSaved(s => {
    const next = new Set(s);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  const toggleRecommend = (name) => setRecommended(s => {
    const next = new Set(s);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });
  const activeFilterCount =
    (filters.minRating > 0 ? 1 : 0) +
    (filters.openNow ? 1 : 0) +
    (filters.nearby ? 1 : 0) +
    (filters.maxPrice < 3 ? 1 : 0);
  const filterPlaces = (list) => list.filter(p => {
    if (filters.minRating && p.r < filters.minRating) return false;
    if (filters.openNow && !p.openNow) return false;
    if (filters.nearby && p.dn > 2) return false;
    if (filters.maxPrice < 3 && p.price > filters.maxPrice) return false;
    return true;
  });
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState(null); // null = show category grid; else show suggestions for that cat

  return (
    <Page>
      <TopBar title="Discover" subtitle="Boracay" right={
        <button className="icon-btn round">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M6 12h12M10 18h4"/>
          </svg>
        </button>
      } />

      <div style={{ padding: '0 16px 16px' }}>
        <div className="seg" style={{ width: '100%' }}>
          <button className={tab === 'planner' ? 'active' : ''} onClick={() => setTab('planner')}>Planner</button>
          <button className={tab === 'places' ? 'active' : ''} onClick={() => setTab('places')}>Places</button>
          <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
            Saved{saved.size ? ` · ${saved.size}` : ''}
          </button>
        </div>
      </div>

      {tab === 'planner' && (
        <>
          {/* AI prompt input */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              position: 'relative',
              background: 'linear-gradient(135deg, var(--card) 0%, var(--card-2) 100%)',
              border: '1px solid var(--border)',
              borderRadius: 22,
              padding: 18,
              overflow: 'hidden',
            }}>
              {/* subtle glow */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 140, height: 140, borderRadius: 999,
                background: 'radial-gradient(circle, rgba(217, 164, 65, 0.28) 0%, transparent 70%)',
              }}/>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--accent-lt), var(--accent))',
                    display: 'grid', placeItems: 'center',
                    color: '#fff',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>Trip Planner</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>AI-generated day-by-day for Boracay</div>
                  </div>
                </div>

                <div style={{
                  background: 'var(--canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  marginBottom: 12,
                }}>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="What do you want to do on this trip?"
                    style={{
                      width: '100%',
                      minHeight: 56,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text)',
                      fontSize: 13,
                      fontFamily: 'var(--font-sans)',
                      resize: 'none',
                    }}
                  />
                </div>

                <button className="btn lg primary" style={{ width: '100%' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>
                  </svg>
                  Generate Itinerary
                </button>
              </div>
            </div>
          </div>

          {/* Quick suggestions — category picker → suggestions */}
          <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div className="eyebrow">Quick suggestions</div>
              <div className="display" style={{ fontSize: 16, marginTop: 2, color: 'var(--text)' }}>
                {cat ? CATEGORIES.find(c => c.id === cat).label : 'Pick a vibe'}
              </div>
            </div>
            {cat && (
              <button onClick={() => setCat(null)} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit',
              }}>
                ← Categories
              </button>
            )}
          </div>

          {!cat && (
            <div style={{ padding: '0 16px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <button key={c.id}
                    onClick={() => setCat(c.id)}
                    style={{
                      appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      padding: '14px 8px 12px',
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 14, textAlign: 'center',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      transition: 'transform 0.15s, border-color 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${c.color}22`,
                      border: `1px solid ${c.color}55`,
                      display: 'grid', placeItems: 'center',
                      fontSize: 22,
                    }}>{c.emoji}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--text)' }}>{c.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cat && (
            <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 8, animation: 'catFadeIn 0.25s ease' }}>
              {CATEGORY_SUGGESTIONS[cat].map(s => (
                <button key={s} onClick={() => setPrompt(s)}
                  style={{
                    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 12, textAlign: 'left',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--card-2)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'var(--card)')}
                >
                  <span style={{ fontSize: 16 }}>{CATEGORIES.find(c => c.id === cat).emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{s}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
                    <path d="M9 6l6 6-6 6"/>
                  </svg>
                </button>
              ))}
              <style>{`@keyframes catFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            </div>
          )}

          {/* Itinerary styles */}
          <GroupHeader kicker="Style" title="Pick your pace" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ITINERARY_STYLES.map(s => {
              const active = style === s.id;
              return (
                <div key={s.id} onClick={() => setStyle(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px',
                  background: active ? 'var(--accent-bg)' : 'var(--card)',
                  border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: 14, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 999,
                    border: `2px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`,
                    display: 'grid', placeItems: 'center',
                    flexShrink: 0,
                  }}>
                    {active && <div style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--accent)' }}/>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <GroupHeader kicker="Trending in Boracay" title="What everyone's doing" action={<button className="btn sm ghost" style={{ color: 'var(--accent)', border: 'none' }}>All →</button>}/>
          <div className="no-scroll" style={{ padding: '0 0 14px', overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, width: 'max-content', padding: '0 16px' }}>
              {TRENDING.map(t => (
                <div key={t.n} style={{
                  width: 180,
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    height: 100,
                    backgroundImage: `url("${t.img}")`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}/>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t.n}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 550 }}>from {t.pr}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'places' && (
        <>
          {/* Search */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 14px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.6" y2="16.6"/>
              </svg>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search restaurants, beaches, activities…"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', color: 'var(--text)',
                  fontSize: 13, fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
          </div>

          <div className="no-scroll" style={{ padding: '0 16px 10px', overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
              {['All', 'Beach', 'Food', 'Activity', 'Shopping', 'Landmark'].map((c, i) => (
                <button key={c} className={`chip ${i === 0 ? 'active' : ''}`}>{c}</button>
              ))}
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowFilters(s => !s)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 11px', borderRadius: 99,
                border: `1px solid ${activeFilterCount ? 'var(--accent)' : 'var(--border)'}`,
                background: activeFilterCount ? 'var(--accent-bg)' : 'var(--card)',
                color: activeFilterCount ? 'var(--accent)' : 'var(--text)',
                fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h18l-7 9v6l-4 2v-8z"/>
              </svg>
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </button>
            <FilterChip active={filters.openNow} onClick={() => setFilters(f => ({ ...f, openNow: !f.openNow }))}>Open now</FilterChip>
            <FilterChip active={filters.nearby}  onClick={() => setFilters(f => ({ ...f, nearby: !f.nearby }))}>Nearby</FilterChip>
            <FilterChip active={filters.minRating >= 4.5} onClick={() => setFilters(f => ({ ...f, minRating: f.minRating >= 4.5 ? 0 : 4.5 }))}>★ 4.5+</FilterChip>
          </div>

          {showFilters && (
            <div style={{
              margin: '0 16px 14px', padding: 14,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <FilterRow label="Minimum rating">
                {[0, 4.0, 4.5].map(v => (
                  <SegBtn key={v} active={filters.minRating === v} onClick={() => setFilters(f => ({ ...f, minRating: v }))}>
                    {v === 0 ? 'Any' : `★ ${v.toFixed(1)}+`}
                  </SegBtn>
                ))}
              </FilterRow>
              <FilterRow label="Price">
                {['Free', '$', '$$', '$$$'].map((lbl, i) => (
                  <SegBtn key={lbl} active={filters.maxPrice === i} onClick={() => setFilters(f => ({ ...f, maxPrice: i }))}>
                    {lbl}{i < 3 ? ' or less' : ''}
                  </SegBtn>
                ))}
              </FilterRow>
              <FilterRow label="Distance">
                <SegBtn active={!filters.nearby} onClick={() => setFilters(f => ({ ...f, nearby: false }))}>Any</SegBtn>
                <SegBtn active={filters.nearby}  onClick={() => setFilters(f => ({ ...f, nearby: true  }))}>≤ 2 km</SegBtn>
              </FilterRow>
              <FilterRow label="Availability">
                <SegBtn active={!filters.openNow} onClick={() => setFilters(f => ({ ...f, openNow: false }))}>All</SegBtn>
                <SegBtn active={filters.openNow}  onClick={() => setFilters(f => ({ ...f, openNow: true  }))}>Open now</SegBtn>
              </FilterRow>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setFilters({ minRating: 0, openNow: false, nearby: false, maxPrice: 3 })}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 4 }}>
                  Reset
                </button>
                <button onClick={() => setShowFilters(false)}
                  style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#3d2416', color: '#fffaf0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Show results
                </button>
              </div>
            </div>
          )}

          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(() => {
              const list = filterPlaces(PLACES);
              if (!list.length) return (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  No places match these filters.
                </div>
              );
              return list.map(p => (
                <PlaceCard key={p.n} p={p}
                  isSaved={saved.has(p.n)}
                  isRec={recommended.has(p.n)}
                  onSave={() => toggleSave(p.n)}
                  onRecommend={() => toggleRecommend(p.n)} />
              ));
            })()}
          </div>
        </>
      )}

      {tab === 'saved' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {saved.size === 0 ? (
            <div style={{
              padding: '36px 20px', textAlign: 'center',
              background: 'var(--card)', border: '1px dashed var(--border)',
              borderRadius: 16, color: 'var(--text-3)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, marginBottom: 8 }}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No saved places yet</div>
              <div style={{ fontSize: 12 }}>Tap the bookmark on a place to save it here.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {saved.size} saved · {recommended.size} recommended
                </div>
                <button onClick={() => { setSaved(new Set()); setRecommended(new Set()); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Clear all
                </button>
              </div>
              {PLACES.filter(p => saved.has(p.n)).map(p => (
                <PlaceCard key={p.n} p={p}
                  isSaved={true}
                  isRec={recommended.has(p.n)}
                  onSave={() => toggleSave(p.n)}
                  onRecommend={() => toggleRecommend(p.n)} />
              ))}
            </>
          )}
        </div>
      )}

      <div style={{ height: 20 }} />
    </Page>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 11px', borderRadius: 99,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent-bg)' : 'var(--card)',
      color: active ? 'var(--accent)' : 'var(--text)',
      fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

function FilterRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function SegBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 10px', borderRadius: 8,
      border: `1px solid ${active ? '#3d2416' : 'var(--border)'}`,
      background: active ? '#3d2416' : 'var(--card)',
      color: active ? '#fffaf0' : 'var(--text)',
      fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

function PlaceCard({ p, isSaved, isRec, onSave, onRecommend }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: 10,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      gap: 10,
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{
          width: 90, height: 90, borderRadius: 10,
          backgroundImage: `url("${p.img}")`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          flexShrink: 0,
        }}/>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 550, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.t}</div>
            {p.openNow ? (
              <span style={{ fontSize: 9.5, fontWeight: 650, color: '#2f7a46', background: 'rgba(125,220,150,0.14)', border: '1px solid rgba(125,220,150,0.35)', padding: '1px 6px', borderRadius: 99 }}>OPEN</span>
            ) : (
              <span style={{ fontSize: 9.5, fontWeight: 650, color: 'var(--text-3)', background: 'var(--card-2)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 99 }}>CLOSED</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 550, color: 'var(--text)', marginTop: 2 }}>{p.n}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--warn)', fontWeight: 550 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.7L22 9.3l-5 4.9 1.2 7.1L12 18l-6.2 3.3L7 14.2 2 9.3l7.1-.6z"/></svg>
              {p.r}
            </span>
            <span>{p.rv}</span>
            <span>·</span>
            <span>{p.d}</span>
            <span>·</span>
            <span style={{ fontWeight: 600 }}>{p.price === 0 ? 'Free' : '$'.repeat(p.price)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 12px', borderRadius: 10, border: 'none',
          background: '#3d2416', color: '#fffaf0',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none"/>
          </svg>
          Explore
        </button>
        <button onClick={onSave} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 12px', borderRadius: 10,
          border: `1px solid ${isSaved ? 'var(--accent)' : 'var(--border)'}`,
          background: isSaved ? 'var(--accent-bg)' : 'var(--card)',
          color: isSaved ? 'var(--accent)' : 'var(--text)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Recommend to group */}
      <button onClick={onRecommend} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '8px 12px', borderRadius: 10,
        border: `1px dashed ${isRec ? 'var(--accent)' : 'var(--border)'}`,
        background: isRec ? 'var(--accent-bg)' : 'transparent',
        color: isRec ? 'var(--accent)' : 'var(--text-3)',
        fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={isRec ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3h5v5M21 3l-7 7M4 21l7-7M4 14v7h7"/>
        </svg>
        {isRec ? 'Recommended to group ✓' : 'Recommend to group'}
      </button>
    </div>
  );
}

window.DiscoverScreen = DiscoverScreen;
