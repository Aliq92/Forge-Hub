// ============================================================
// constellation.js — even distribution of satellites across planes
// ============================================================
const Constellation = {

  /**
   * Build an array of Satellite objects distributed across `planes` orbital
   * planes (RAAN spread evenly across 360deg) with `count` total satellites
   * (spread as evenly as possible across planes), all sharing altitude &
   * inclination. `phaseOffsetDeg` staggers the starting phase between
   * adjacent planes (a "walker-delta"-like pattern), which helps avoid
   * satellites in different planes bunching up at shared crossing points.
   */
  build(opts) {
    const {
      name, count, planes, altitude, inclination, coverageAngle,
      phaseOffsetDeg = 0, colorIndex = 0
    } = opts;

    const constellationId = nextId('const');
    const color = CONST.COLORS_BY_CONSTELLATION[colorIndex % CONST.COLORS_BY_CONSTELLATION.length];
    const sats = [];

    const nPlanes = Math.max(1, Math.min(planes, count));
    const perPlaneBase = Math.floor(count / nPlanes);
    let remainder = count - perPlaneBase * nPlanes;

    let satIndex = 0;
    for (let p = 0; p < nPlanes; p++) {
      const raan = (360 / nPlanes) * p;
      const perPlane = perPlaneBase + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      for (let s = 0; s < perPlane; s++) {
        const basePhase = (360 / Math.max(1, perPlane)) * s;
        const phase = (basePhase + phaseOffsetDeg * p) % 360;

        const sat = new Satellite({
          name: `${name || 'SAT'}-${String(satIndex + 1).padStart(2, '0')}`,
          altitude, inclination, phase, raan,
          coverageAngle,
          constellationId, constellationName: name,
          planeIndex: p,
          color
        });
        sats.push(sat);
        satIndex++;
      }
    }
    return { id: constellationId, name, sats, planes: nPlanes, color };
  }
};
