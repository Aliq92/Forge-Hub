// ============================================================
// coverage.js — global coverage sampling engine
// Samples a lat/lon grid across Earth at a low update frequency and
// estimates coverage %, overlap, and visibility statistics. Uses simple
// spherical central-angle geometry so occluded (far-side) ground points
// are automatically excluded — the same geometry that defines a
// satellite's coverage footprint prevents "seeing through" the Earth.
// ============================================================
const Coverage = {
  samplePoints: [],   // {lat, lon}
  lastUpdate: 0,
  result: {
    coveragePct: 0,
    overlapPct: 0,
    avgVisible: 0,
    maxVisible: 0,
    coveredAreaKm2: 0,
    uncoveredAreaKm2: 0,
    pointCounts: []   // parallel to samplePoints, # satellites visible at each
  },

  buildGrid(stepDeg) {
    stepDeg = stepDeg || CONST.COVERAGE_SAMPLE_STEP_DEG;
    const pts = [];
    for (let lat = -90; lat <= 90; lat += stepDeg) {
      // weight fewer samples near poles isn't necessary at this resolution; keep uniform grid
      for (let lon = -180; lon < 180; lon += stepDeg) {
        pts.push({ lat, lon });
      }
    }
    this.samplePoints = pts;
    return pts;
  },

  maybeUpdate(state, nowMs) {
    if (!this.samplePoints.length) this.buildGrid();
    if (nowMs - this.lastUpdate < CONST.COVERAGE_UPDATE_MS) return false;
    this.lastUpdate = nowMs;
    this.recompute(state);
    return true;
  },

  recompute(state) {
    const sats = state.satellites.filter(s => s.active && s.state);
    const n = this.samplePoints.length;
    const counts = new Array(n).fill(0);

    // precompute each active satellite's nadir point + coverage central angle
    const satGeo = sats.map(s => ({
      lat: s.state.lat, lon: s.state.lon,
      angle: s.coverageCentralAngleDeg
    }));

    for (let i = 0; i < n; i++) {
      const p = this.samplePoints[i];
      let c = 0;
      for (let j = 0; j < satGeo.length; j++) {
        const g = satGeo[j];
        if (g.angle <= 0) continue;
        const d = Orbit.centralAngleBetween(p.lat, p.lon, g.lat, g.lon);
        if (d <= g.angle) c++;
      }
      counts[i] = c;
    }

    let covered = 0, overlapCovered = 0, sumVisible = 0, maxVisible = 0;
    for (let i = 0; i < n; i++) {
      const c = counts[i];
      sumVisible += c;
      if (c > 0) covered++;
      if (c > 1) overlapCovered++;
      if (c > maxVisible) maxVisible = c;
    }

    const earthArea = 4 * Math.PI * CONST.EARTH_RADIUS_KM * CONST.EARTH_RADIUS_KM;
    const coveragePct = n ? (covered / n) * 100 : 0;

    this.result = {
      coveragePct,
      overlapPct: covered ? (overlapCovered / covered) * 100 : 0,
      avgVisible: n ? sumVisible / n : 0,
      maxVisible,
      coveredAreaKm2: earthArea * (coveragePct / 100),
      uncoveredAreaKm2: earthArea * (1 - coveragePct / 100),
      pointCounts: counts
    };
    return this.result;
  }
};
