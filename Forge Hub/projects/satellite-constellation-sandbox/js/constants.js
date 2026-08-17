// ============================================================
// constants.js — physical constants & shared configuration
// ============================================================
const CONST = {
  EARTH_RADIUS_KM: 6371,
  MU_EARTH: 398600.4418,           // km^3 / s^2, standard gravitational parameter
  EARTH_SIDEREAL_DAY_SEC: 86164.0905, // seconds — Earth's real rotation period
  MIN_ALT_KM: 160,
  MAX_ALT_KM: 40000,

  // rendering
  EARTH_RADIUS_PX: 190,            // Earth radius on screen at zoom = 1
  STAR_COUNT: 420,

  // coverage sampling grid (lat/lon step in degrees)
  COVERAGE_SAMPLE_STEP_DEG: 9,

  // low-frequency update intervals (simulated seconds is not used; these are real ms)
  COVERAGE_UPDATE_MS: 350,
  STATS_UPDATE_MS: 350,
  GS_UPDATE_MS: 250,

  DEFAULT_MIN_ELEVATION_DEG: 10,

  TRAIL_LENGTHS: { off: 0, short: 60, long: 260 },

  COLORS_BY_CONSTELLATION: [
    '#4db8ff', '#4fe8c8', '#ffb454', '#b98bff', '#6bf28c',
    '#ff8fa3', '#ffe15a', '#7ad0ff', '#ff9d5c', '#c792ea'
  ]
};

// altitude presets (km)
const ALT_PRESETS = [
  { label: 'LOW LEO', value: 300 },
  { label: 'LEO', value: 500 },
  { label: 'EARTH OBSERVATION', value: 700 },
  { label: 'MEO', value: 10000 },
  { label: 'GNSS-LIKE', value: 20200 },
  { label: 'GEO-LIKE', value: 35786 }
];

// inclination presets (deg)
const INC_PRESETS = [
  { label: '0°  EQUATORIAL', value: 0 },
  { label: '30°', value: 30 },
  { label: '53°', value: 53 },
  { label: '90°  POLAR', value: 90 },
  { label: '98°  SUN-SYNC-LIKE', value: 98 }
];

const GS_PRESETS = [
  { label: 'Equator Station', lat: 0, lon: 0 },
  { label: 'Northern Station', lat: 52, lon: 13 },
  { label: 'Southern Station', lat: -34, lon: -58 },
  { label: 'Polar Station', lat: 78, lon: 16 }
];

let __idCounter = 1;
function nextId(prefix) { return prefix + '-' + (__idCounter++); }
