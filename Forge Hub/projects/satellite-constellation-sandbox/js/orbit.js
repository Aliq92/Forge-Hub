// ============================================================
// orbit.js — simplified circular-orbit Keplerian mechanics
// All angles in radians internally unless suffixed *Deg.
// ============================================================
const Orbit = {

  deg2rad(d) { return d * Math.PI / 180; },
  rad2deg(r) { return r * 180 / Math.PI; },

  // semi-major axis (= radius for circular orbit) in km
  orbitRadiusKm(altitudeKm) {
    return CONST.EARTH_RADIUS_KM + altitudeKm;
  },

  // circular orbital period in seconds: T = 2*pi*sqrt(r^3 / mu)
  periodSec(altitudeKm) {
    const r = this.orbitRadiusKm(altitudeKm);
    return 2 * Math.PI * Math.sqrt((r * r * r) / CONST.MU_EARTH);
  },

  // circular orbital speed in km/s: v = sqrt(mu / r)
  speedKmS(altitudeKm) {
    const r = this.orbitRadiusKm(altitudeKm);
    return Math.sqrt(CONST.MU_EARTH / r);
  },

  angularRateRadS(altitudeKm) {
    return (2 * Math.PI) / this.periodSec(altitudeKm);
  },

  earthRotationAngle(simElapsedSec) {
    const w = (2 * Math.PI) / CONST.EARTH_SIDEREAL_DAY_SEC;
    return (w * simElapsedSec) % (2 * Math.PI);
  },

  // Format seconds into a friendly "Xh Ym" / "X min" string
  formatDuration(sec) {
    if (!isFinite(sec) || sec <= 0) return '—';
    if (sec < 3600) {
      return (sec / 60).toFixed(1) + ' min';
    }
    const hrs = sec / 3600;
    if (hrs < 48) {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      return `${h}h ${m}m`;
    }
    const days = hrs / 24;
    return days.toFixed(2) + ' days';
  },

  /**
   * Compute a satellite's position given its orbital elements and elapsed sim time.
   * Returns ECI coords {x,y,z} in km, and ECEF-derived {lat, lon} in degrees.
   * Frame: Z = Earth's polar/rotation axis. Orbital plane rotated by inclination (about X)
   * then by RAAN (about Z). Earth rotation is then subtracted to get ECEF (world) frame,
   * which is what continents/ground stations are drawn in (static in ECEF).
   */
  computeState(sat, simElapsedSec) {
    const r = this.orbitRadiusKm(sat.altitude);
    const w = this.angularRateRadS(sat.altitude);
    const theta = this.deg2rad(sat.phase) + w * simElapsedSec; // mean anomaly (circular => true anomaly)

    const xo = r * Math.cos(theta);
    const yo = r * Math.sin(theta);

    const inc = this.deg2rad(sat.inclination);
    // rotate about X by inclination
    const x1 = xo;
    const y1 = yo * Math.cos(inc);
    const z1 = yo * Math.sin(inc);

    const raan = this.deg2rad(sat.raan || 0);
    // rotate about Z by RAAN -> ECI
    const X = x1 * Math.cos(raan) - y1 * Math.sin(raan);
    const Y = x1 * Math.sin(raan) + y1 * Math.cos(raan);
    const Z = z1;

    // rotate ECI -> ECEF (world) by -earthAngle about Z
    const phi = this.earthRotationAngle(simElapsedSec);
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const Xw = X * cosP + Y * sinP;
    const Yw = -X * sinP + Y * cosP;
    const Zw = Z;

    const lat = this.rad2deg(Math.asin(Math.max(-1, Math.min(1, Zw / r))));
    const lon = this.rad2deg(Math.atan2(Yw, Xw));

    return { eci: { x: X, y: Y, z: Z }, world: { x: Xw, y: Yw, z: Zw }, r, lat, lon, theta };
  },

  // world-frame position for an arbitrary point on the orbital ring (for drawing the path)
  ringPointWorld(sat, ringTheta, simElapsedSec) {
    const r = this.orbitRadiusKm(sat.altitude);
    const xo = r * Math.cos(ringTheta);
    const yo = r * Math.sin(ringTheta);
    const inc = this.deg2rad(sat.inclination);
    const x1 = xo;
    const y1 = yo * Math.cos(inc);
    const z1 = yo * Math.sin(inc);
    const raan = this.deg2rad(sat.raan || 0);
    const X = x1 * Math.cos(raan) - y1 * Math.sin(raan);
    const Y = x1 * Math.sin(raan) + y1 * Math.cos(raan);
    const Z = z1;
    const phi = this.earthRotationAngle(simElapsedSec);
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    return {
      x: X * cosP + Y * sinP,
      y: -X * sinP + Y * cosP,
      z: Z
    };
  },

  // lat/lon (deg) -> ECEF world unit-sphere point scaled by radius r (default Earth radius)
  latLonToWorld(latDeg, lonDeg, r) {
    r = r || CONST.EARTH_RADIUS_KM;
    const lat = this.deg2rad(latDeg), lon = this.deg2rad(lonDeg);
    return {
      x: r * Math.cos(lat) * Math.cos(lon),
      y: r * Math.cos(lat) * Math.sin(lon),
      z: r * Math.sin(lat)
    };
  },

  // Earth's angular radius as seen from a satellite at given altitude (deg)
  earthAngularRadiusDeg(altitudeKm) {
    const r = this.orbitRadiusKm(altitudeKm);
    return this.rad2deg(Math.asin(Math.min(1, CONST.EARTH_RADIUS_KM / r)));
  },

  /**
   * Maximum Earth-central angle (deg) between a satellite's nadir point and a ground point
   * that still allows a link at the given minimum elevation angle (deg).
   * lambda = 90 - elev - asin( Re/(Re+h) * cos(elev) )
   */
  coverageCentralAngleDeg(altitudeKm, minElevationDeg) {
    const r = this.orbitRadiusKm(altitudeKm);
    const ratio = CONST.EARTH_RADIUS_KM / r;
    const elevRad = this.deg2rad(minElevationDeg);
    const eta = Math.asin(Math.min(1, ratio * Math.cos(elevRad)));
    const lambdaRad = (Math.PI / 2) - elevRad - eta;
    return Math.max(0, this.rad2deg(lambdaRad));
  },

  // angular distance in degrees between two lat/lon points (great-circle, via unit vectors)
  centralAngleBetween(latA, lonA, latB, lonB) {
    const a = this.latLonToWorld(latA, lonA, 1);
    const b = this.latLonToWorld(latB, lonB, 1);
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
    return this.rad2deg(Math.acos(dot));
  },

  // ground-footprint radius on Earth's surface (km), i.e. the arc length for the central angle
  coverageRadiusKm(altitudeKm, minElevationDeg) {
    const angleDeg = this.coverageCentralAngleDeg(altitudeKm, minElevationDeg);
    return this.deg2rad(angleDeg) * CONST.EARTH_RADIUS_KM;
  }
};
