// Small stylized line-art item icons — original vector glyphs, no emoji, no external art.
const CATEGORY_BG = {
  CHARMS: '#5a3d63', HERBS: '#3f5a3f', CURIOS: '#3d5560', LIGHTS: '#6b4a1e', TONICS: '#3d5560',
  MEMORIES: '#5a4463', TOOLS: '#4a4038', BOOKS: '#4a3d2a', ODDITIES: '#4a3d55', PROTECTION: '#4a5240',
};

function badge(inner, bg) {
  return `<svg viewBox="0 0 64 64" class="item-icon-svg"><circle cx="32" cy="32" r="30" fill="${bg}" opacity="0.9"/>${inner}</svg>`;
}
const S = 'stroke="#f0d9a8" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="#f0d9a8"';

const GLYPHS = {
  bottle: `<path d="M27 14h10v6l5 6v22a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V26l5-6z" ${S}/><path d="M27 14h10" ${S}/><path d="M24 34h16" ${S} opacity="0.6"/>`,
  leaf: `<path d="M32 46c-10-2-16-12-14-24 12-2 22 4 24 14 1 6-3 10-10 10z" ${S}/><path d="M20 24c6 4 10 10 12 22" ${S} opacity="0.7"/>`,
  book: `<rect x="16" y="16" width="32" height="32" rx="2" ${S}/><path d="M32 16v32" ${S}/><path d="M20 24h8M20 32h8M36 24h8M36 32h8" ${S} opacity="0.6"/>`,
  bell: `<path d="M32 14c-8 0-11 7-11 14 0 8-4 10-4 12h30s-4-2-4-12c0-7-3-14-11-14z" ${S}/><path d="M27 44a5 5 0 0 0 10 0" ${S}/><circle cx="32" cy="12" r="2" ${F}/>`,
  key: `<circle cx="24" cy="24" r="8" ${S}/><path d="M30 30l16 16M40 40l4-4M44 44l4-4" ${S}/>`,
  stone: `<path d="M32 16l14 10-5 18H23l-5-18z" ${S}/>`,
  knot: `<path d="M22 32c0-8 8-12 12-6 4 6-2 12-6 12-6 0-10-4-10-10 0-8 8-14 16-10" ${S}/>`,
  compass: `<circle cx="32" cy="32" r="16" ${S}/><path d="M32 22l6 12-6 4-6-4z" ${F}/><circle cx="32" cy="32" r="2" fill="#2a2019"/>`,
  locket: `<path d="M32 20c-4-6-14-4-14 4 0 8 14 18 14 18s14-10 14-18c0-8-10-10-14-4z" ${S}/>`,
  coin: `<circle cx="32" cy="32" r="16" ${S}/><path d="M26 32h12M32 26v12" ${S}/>`,
  mirror: `<ellipse cx="32" cy="26" rx="12" ry="15" ${S}/><path d="M32 41v9M26 50h12" ${S}/>`,
  quill: `<path d="M44 16c-14 2-22 14-22 30 8-2 18-10 20-24" ${S}/><path d="M22 46l6-8" ${S}/>`,
  letter: `<rect x="14" y="20" width="36" height="24" rx="2" ${S}/><path d="M14 22l18 14 18-14" ${S}/>`,
  umbrella: `<path d="M32 14c10 0 16 8 16 16H16c0-8 6-16 16-16z" ${S}/><path d="M32 30v16a4 4 0 0 1-6 3" ${S}/>`,
  candle: `<rect x="27" y="26" width="10" height="22" rx="1.5" ${S}/><path d="M32 20c-3 3-3 5 0 8 3-3 3-5 0-8z" fill="#eab04a"/>`,
  whistle: `<rect x="16" y="28" width="26" height="8" rx="4" ${S}/><circle cx="46" cy="32" r="6" ${S}/>`,
  veil: `<path d="M18 20c6 8 6 18 0 26M32 16c6 10 6 22 0 32M46 20c-6 8-6 18 0 26" ${S} opacity="0.85"/>`,
  musicbox: `<rect x="16" y="26" width="26" height="18" rx="2" ${S}/><circle cx="44" cy="20" r="4" ${F}/><path d="M48 20V8" ${S}/>`,
  spectacles: `<circle cx="23" cy="32" r="9" ${S}/><circle cx="41" cy="32" r="9" ${S}/><path d="M32 30h0" ${S}/><path d="M14 30l-3-2M50 30l3-2" ${S}/>`,
  lantern: `<rect x="22" y="20" width="20" height="24" rx="3" ${S}/><path d="M28 20V14h8v6M28 44v6h8v-6" ${S}/><circle cx="32" cy="32" r="5" fill="#eab04a"/>`,
  ward: `<path d="M32 14l16 6v12c0 12-8 18-16 20-8-2-16-8-16-20V20z" ${S}/><path d="M25 32l5 5 9-10" ${S}/>`,
  ink: `<path d="M20 30h24l-4 14a3 3 0 0 1-3 2H27a3 3 0 0 1-3-2z" ${S}/><rect x="24" y="18" width="16" height="12" rx="2" ${S}/>`,
  salt: `<path d="M24 44l8-28 8 28z" ${S}/><path d="M26 38h12" ${S} opacity="0.6"/>`,
};

const ICON_MAP = {
  sachet: 'leaf', sprig: 'leaf', flower: 'leaf',
  bottle_light: 'bottle', tea: 'bottle', flask: 'bottle', vial: 'bottle', vial_storm: 'bottle',
  jar: 'bottle', jar_energy: 'bottle', teacup: 'bottle',
  book: 'book', book2: 'book', card: 'book', ledger: 'book',
  bell: 'bell', key: 'key',
  stone: 'stone', stone2: 'stone', whetstone: 'stone',
  thread: 'knot', seal: 'knot',
  compass: 'compass', locket: 'locket', coin: 'coin', mirror: 'mirror',
  quill: 'quill', letter: 'letter', umbrella: 'umbrella', candle: 'candle',
  whistle: 'whistle', musicbox2: 'musicbox', musicbox: 'musicbox',
  veil: 'veil', spectacles: 'spectacles', lantern: 'lantern',
  ward: 'ward', ink: 'ink', salt: 'salt',
};

export function itemIcon(item) {
  const glyphKey = ICON_MAP[item.icon] || 'stone';
  const bg = CATEGORY_BG[item.category] || '#4a4038';
  return badge(GLYPHS[glyphKey] || GLYPHS.stone, bg);
}
