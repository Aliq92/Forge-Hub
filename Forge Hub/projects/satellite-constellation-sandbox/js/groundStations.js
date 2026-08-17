// ============================================================
// groundStations.js — ground station entity + visibility/pass logic
// ============================================================
class GroundStation {
  constructor(opts) {
    this.id = nextId('gs');
    this.name = opts.name || this.id.toUpperCase();
    this.lat = opts.lat;
    this.lon = opts.lon;
    this.minElevation = (opts.minElevation != null) ? opts.minElevation : 10;

    this.linked = false;
    this.bestSatId = null;
    this.bestSatName = null;
    this.bestElevation = 0;
    this.visibleCount = 0;
    this.connectionStartSimSec = null;   // sim time the current best-sat link started
    this.connectionDurationSec = 0;
    this.lastLinkedSimSec = null;        // sim time last observed linked
    this.timeSinceCoverageSec = 0;
    this.history = [];                   // rolling boolean window for availability %
    this.availabilityPct = 0;
    this.screen = null;                  // renderer-populated
  }
}

const GroundStations = {
  HISTORY_LEN: 50,

  worldPos(gs) {
    return Orbit.latLonToWorld(gs.lat, gs.lon, CONST.EARTH_RADIUS_KM);
  },

  // elevation angle (deg) of satellite as seen from ground station, and slant range (km)
  elevationTo(gs, sat) {
    if (!sat.state) return { elevation: -90, range: Infinity };
    const G = this.worldPos(gs);
    const S = sat.state.world;
    const Dx = S.x - G.x, Dy = S.y - G.y, Dz = S.z - G.z;
    const range = Math.sqrt(Dx * Dx + Dy * Dy + Dz * Dz) || 1e-6;
    const gMag = Math.sqrt(G.x * G.x + G.y * G.y + G.z * G.z) || 1;
    const ux = G.x / gMag, uy = G.y / gMag, uz = G.z / gMag;
    const dot = (Dx * ux + Dy * uy + Dz * uz) / range;
    const elevation = Orbit.rad2deg(Math.asin(Math.max(-1, Math.min(1, dot))));
    return { elevation, range };
  },

  /**
   * Recompute visibility/link state for a single ground station against the
   * active satellite list. Returns whether a "pass event" (link state change)
   * occurred, so callers can surface a toast.
   */
  update(gs, satellites, simElapsedSec) {
    let best = null, bestElev = -90, visibleCount = 0;
    for (const sat of satellites) {
      if (!sat.active || !sat.state) continue;
      const { elevation, range } = this.elevationTo(gs, sat);
      if (elevation >= gs.minElevation) {
        visibleCount++;
        if (elevation > bestElev) { bestElev = elevation; best = sat; }
      }
    }

    const wasLinked = gs.linked;
    const nowLinked = !!best;
    let event = null;

    if (nowLinked) {
      if (!wasLinked || gs.bestSatId !== best.id) {
        gs.connectionStartSimSec = simElapsedSec;
      }
      gs.connectionDurationSec = simElapsedSec - (gs.connectionStartSimSec != null ? gs.connectionStartSimSec : simElapsedSec);
      gs.bestSatId = best.id;
      gs.bestSatName = best.name;
      gs.bestElevation = bestElev;
      gs.lastLinkedSimSec = simElapsedSec;
      gs.timeSinceCoverageSec = 0;
      if (!wasLinked) event = 'connected';
    } else {
      gs.connectionDurationSec = 0;
      gs.bestSatId = null;
      gs.bestSatName = null;
      gs.bestElevation = 0;
      if (gs.lastLinkedSimSec != null) {
        gs.timeSinceCoverageSec = simElapsedSec - gs.lastLinkedSimSec;
      }
      if (wasLinked) event = 'lost';
    }

    gs.linked = nowLinked;
    gs.visibleCount = visibleCount;

    gs.history.push(nowLinked ? 1 : 0);
    while (gs.history.length > this.HISTORY_LEN) gs.history.shift();
    const sum = gs.history.reduce((a, b) => a + b, 0);
    gs.availabilityPct = gs.history.length ? (sum / gs.history.length) * 100 : 0;

    return event;
  }
};
