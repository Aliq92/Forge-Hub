// ============================================================
// satellite.js — Satellite entity
// ============================================================
class Satellite {
  constructor(opts) {
    this.id = nextId('sat');
    this.name = opts.name || this.id.toUpperCase();
    this.altitude = opts.altitude;          // km
    this.inclination = opts.inclination;    // deg
    this.phase = opts.phase || 0;           // deg, initial mean anomaly
    this.raan = opts.raan || 0;             // deg, orbital plane longitude offset
    this.coverageAngle = (opts.coverageAngle != null) ? opts.coverageAngle : CONST.DEFAULT_MIN_ELEVATION_DEG; // min elevation deg
    this.active = opts.active !== false;
    this.constellationId = opts.constellationId || null;
    this.constellationName = opts.constellationName || null;
    this.planeIndex = opts.planeIndex || 0;
    this.color = opts.color || CONST.COLORS_BY_CONSTELLATION[0];
    this.showGroundTrack = !!opts.showGroundTrack;

    // live/derived state, recomputed each sim tick
    this.state = null;      // {eci, world, r, lat, lon, theta}
    this.screen = null;     // renderer-populated: {x,y,depth,occluded,front}
    this.trail = [];        // array of {lat,lon} world footprints for trail rendering
    this.sunlit = true;
  }

  get period() { return Orbit.periodSec(this.altitude); }
  get speed() { return Orbit.speedKmS(this.altitude); }
  get coverageRadiusKm() { return Orbit.coverageRadiusKm(this.altitude, this.coverageAngle); }
  get coverageCentralAngleDeg() { return Orbit.coverageCentralAngleDeg(this.altitude, this.coverageAngle); }

  update(simElapsedSec) {
    this.state = Orbit.computeState(this, simElapsedSec);
  }

  pushTrail(maxLen) {
    if (!maxLen || !this.state) return;
    this.trail.push({ lat: this.state.lat, lon: this.state.lon });
    while (this.trail.length > maxLen) this.trail.shift();
  }

  clearTrail() { this.trail.length = 0; }
}
