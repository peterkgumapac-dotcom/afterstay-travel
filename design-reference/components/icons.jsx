// Icons — thin, consistent line set

function Icon({ size = 20, stroke = 1.6, children, style = {}, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} {...rest}>
      {children}
    </svg>
  );
}

const IHome = (p) => <Icon {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1Z"/></Icon>;
const ICompass = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m14.5 9.5-5 1.5-1.5 5 5-1.5 1.5-5Z"/></Icon>;
const ISuitcase = (p) => <Icon {...p}><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3M3 12h18"/></Icon>;
const IWallet = (p) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M16 12h5M16 12a2 2 0 1 0 0 0Z"/></Icon>;
const ICamera = (p) => <Icon {...p}><path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></Icon>;

const IBell = (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>;
const ISearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>;
const IFilter = (p) => <Icon {...p}><path d="M3 5h18M6 12h12M10 19h4"/></Icon>;
const IArrow = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>;
const IArrowLeft = (p) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></Icon>;
const IPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
const IHeart = (p) => <Icon {...p}><path d="M20.8 11.2A5.2 5.2 0 0 0 12 7a5.2 5.2 0 0 0-8.8 4.2c0 6.2 8.8 10.6 8.8 10.6s8.8-4.4 8.8-10.6Z"/></Icon>;
const IHeartFill = (p) => <Icon {...p}><path d="M20.8 11.2A5.2 5.2 0 0 0 12 7a5.2 5.2 0 0 0-8.8 4.2c0 6.2 8.8 10.6 8.8 10.6s8.8-4.4 8.8-10.6Z" fill="currentColor"/></Icon>;
const IBookmark = (p) => <Icon {...p}><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/></Icon>;
const IBookmarkFill = (p) => <Icon {...p}><path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" fill="currentColor"/></Icon>;

const IPin = (p) => <Icon {...p}><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z"/><circle cx="12" cy="9.5" r="2.5"/></Icon>;
const IStar = (p) => <Icon {...p}><path d="m12 3 2.6 5.6 6 .7-4.5 4 1.3 6L12 16.5 6.6 19.3l1.3-6-4.5-4 6-.7L12 3Z" fill="currentColor"/></Icon>;
const IClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IWifi = (p) => <Icon {...p}><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a6 6 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".6" fill="currentColor"/></Icon>;
const IKey = (p) => <Icon {...p}><circle cx="8" cy="15" r="4"/><path d="m11 12 10-10M17 6l3 3M15 8l3 3"/></Icon>;
const ISun = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/></Icon>;
const ICloud = (p) => <Icon {...p}><path d="M7 18a5 5 0 0 1 1-9.9A6 6 0 0 1 19 9a4.5 4.5 0 0 1-2 8.9Z"/></Icon>;
const IPlane = (p) => <Icon {...p}><path d="M3 13.5 22 4l-5.5 17-4-8Z"/><path d="m13 13-4 4"/></Icon>;
const IDoor = (p) => <Icon {...p}><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M15 12h.01"/></Icon>;
const IUsers = (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 10a3 3 0 0 0 0-6M22 20c0-2.5-2.2-4.3-4.5-4.8"/></Icon>;
const IMap = (p) => <Icon {...p}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2ZM9 4v16M15 6v16"/></Icon>;
const IList = (p) => <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01"/></Icon>;
const IGrid = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>;
const ISparkle = (p) => <Icon {...p}><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></Icon>;
const IChevronRight = (p) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>;
const IChevronDown = (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
const IMore = (p) => <Icon {...p}><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></Icon>;
const INav = (p) => <Icon {...p}><path d="M3 11 21 3l-8 18-2-8Z"/></Icon>;
const ICheck = (p) => <Icon {...p}><path d="m5 12 5 5L20 7"/></Icon>;
const ICircle = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/></Icon>;
const ICheckCircle = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></Icon>;
const ICoffee = (p) => <Icon {...p}><path d="M4 8h14v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M18 10h2a2 2 0 0 1 0 4h-2M8 2v3M12 2v3M16 2v3"/></Icon>;
const IUtensils = (p) => <Icon {...p}><path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 12v9M18 3a3 3 0 0 0-3 3v7h3v8"/></Icon>;
const IMountain = (p) => <Icon {...p}><path d="m3 19 5-9 4 6 3-4 6 7Z"/></Icon>;
const ISpa = (p) => <Icon {...p}><path d="M12 22c-4-4-8-6-8-12 4 0 8 2 8 6 0-4 4-6 8-6 0 6-4 8-8 12Z"/></Icon>;
const IMoon = (p) => <Icon {...p}><path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10Z"/></Icon>;
const IShop = (p) => <Icon {...p}><path d="M4 7h16l-1 13H5ZM9 7a3 3 0 0 1 6 0"/></Icon>;
const IBeach = (p) => <Icon {...p}><path d="M12 2a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8Z"/><path d="M12 10v11M3 21h18"/></Icon>;

Object.assign(window, {
  Icon,
  IHome, ICompass, ISuitcase, IWallet, ICamera,
  IBell, ISearch, IFilter, IArrow, IArrowLeft, IPlus, IHeart, IHeartFill,
  IBookmark, IBookmarkFill, IPin, IStar, IClock, IWifi, IKey, ISun, ICloud,
  IPlane, IDoor, IUsers, IMap, IList, IGrid, ISparkle, IChevronRight, IChevronDown,
  IMore, INav, ICheck, ICircle, ICheckCircle, ICoffee, IUtensils, IMountain, ISpa,
  IMoon, IShop, IBeach,
});
