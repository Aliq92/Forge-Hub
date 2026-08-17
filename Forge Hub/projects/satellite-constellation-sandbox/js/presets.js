// ============================================================
// presets.js — constellation presets, prebuilt demos, challenges
// All apply() functions operate against the global `App` (main.js).
// ============================================================

const CONSTELLATION_PRESETS = [
  {
    title: 'EQUATORIAL RING',
    desc: 'A ring of low-inclination satellites circling near the equator.',
    apply(App) {
      App.clearSatellites();
      const c = Constellation.build({
        name: 'EQ-RING', count: 12, planes: 1, altitude: 1200,
        inclination: 2, coverageAngle: 10, colorIndex: 0
      });
      App.addConstellation(c);
    }
  },
  {
    title: 'POLAR COVERAGE',
    desc: 'Several polar orbital planes sweeping over every latitude as Earth turns.',
    apply(App) {
      App.clearSatellites();
      const c = Constellation.build({
        name: 'POLAR', count: 18, planes: 6, altitude: 900,
        inclination: 90, coverageAngle: 8, phaseOffsetDeg: 20, colorIndex: 1
      });
      App.addConstellation(c);
    }
  },
  {
    title: 'GLOBAL LEO',
    desc: 'Multiple inclined planes designed for broad, redundant Earth coverage.',
    apply(App) {
      App.clearSatellites();
      const c = Constellation.build({
        name: 'GLOBAL', count: 48, planes: 8, altitude: 780,
        inclination: 55, coverageAngle: 12, phaseOffsetDeg: 15, colorIndex: 2
      });
      App.addConstellation(c);
    }
  },
  {
    title: 'MEO NETWORK',
    desc: 'A smaller number of high-altitude satellites, each covering a huge footprint.',
    apply(App) {
      App.clearSatellites();
      const c = Constellation.build({
        name: 'MEO-NET', count: 12, planes: 3, altitude: 10000,
        inclination: 56, coverageAngle: 15, colorIndex: 3
      });
      App.addConstellation(c);
    }
  },
  {
    title: 'GEO BELT',
    desc: 'Several GEO-like satellites strung around the equator, roughly stationary overhead.',
    apply(App) {
      App.clearSatellites();
      const c = Constellation.build({
        name: 'GEO-BELT', count: 8, planes: 1, altitude: 35786,
        inclination: 0, coverageAngle: 5, colorIndex: 4
      });
      App.addConstellation(c);
    }
  },
  {
    title: 'EARTH OBSERVATION',
    desc: 'A small set of near-polar satellites suited to scanning the whole surface over time.',
    apply(App) {
      App.clearSatellites();
      const c = Constellation.build({
        name: 'EO-SET', count: 6, planes: 3, altitude: 700,
        inclination: 98, coverageAngle: 10, colorIndex: 5
      });
      App.addConstellation(c);
    }
  },
  {
    title: 'RANDOM CONSTELLATION',
    desc: 'Generate a reasonable random constellation to explore.',
    apply(App) {
      App.clearSatellites();
      const alt = Math.round(300 + Math.random() * 15000);
      const inc = Math.round(Math.random() * 100);
      const count = 6 + Math.floor(Math.random() * 30);
      const planes = 1 + Math.floor(Math.random() * 6);
      const c = Constellation.build({
        name: 'RANDOM', count, planes, altitude: alt,
        inclination: inc, coverageAngle: 8 + Math.round(Math.random() * 20),
        phaseOffsetDeg: Math.round(Math.random() * 40), colorIndex: 6
      });
      App.addConstellation(c);
    }
  }
];

const DEMOS = [
  {
    title: 'WHY LEO MOVES FAST',
    desc: 'One very low satellite vs. one very high satellite — watch the speed difference.',
    apply(App) {
      App.clearSatellites();
      App.clearGroundStations();
      App.addConstellation({ id: nextId('const'), name: 'LOW', sats: [new Satellite({
        name: 'LOW-LEO', altitude: 300, inclination: 15, phase: 0, coverageAngle: 10,
        constellationId: nextId('const'), constellationName: 'LOW', color: CONST.COLORS_BY_CONSTELLATION[0]
      })] });
      App.addConstellation({ id: nextId('const'), name: 'HIGH', sats: [new Satellite({
        name: 'HIGH-MEO', altitude: 15000, inclination: 15, phase: 90, coverageAngle: 10,
        constellationId: nextId('const'), constellationName: 'HIGH', color: CONST.COLORS_BY_CONSTELLATION[3]
      })] });
      App.setSpeed(200);
      App.setToggle('orbits', true);
      App.setToggle('labels', true);
    }
  },
  {
    title: 'INCLINATION',
    desc: 'Identical altitude, five different inclinations — see how orbital planes tilt.',
    apply(App) {
      App.clearSatellites();
      App.clearGroundStations();
      const incs = [0, 30, 53, 90, 98];
      incs.forEach((inc, i) => {
        App.addConstellation({ id: nextId('const'), name: 'INC' + inc, sats: [new Satellite({
          name: `INC-${inc}`, altitude: 4000, inclination: inc, phase: i * 40, coverageAngle: 10,
          constellationId: nextId('const'), constellationName: 'INC' + inc, color: CONST.COLORS_BY_CONSTELLATION[i]
        })] });
      });
      App.setSpeed(100);
      App.setToggle('orbits', true);
      App.setToggle('labels', true);
    }
  },
  {
    title: 'COVERAGE VS ALTITUDE',
    desc: 'Satellites at several altitudes, showing how footprint size scales with height.',
    apply(App) {
      App.clearSatellites();
      App.clearGroundStations();
      const alts = [500, 2000, 10000, 20200, 35786];
      alts.forEach((alt, i) => {
        App.addConstellation({ id: nextId('const'), name: 'ALT' + alt, sats: [new Satellite({
          name: `ALT-${alt}`, altitude: alt, inclination: 0, phase: i * 60, coverageAngle: 10,
          constellationId: nextId('const'), constellationName: 'ALT' + alt, color: CONST.COLORS_BY_CONSTELLATION[i]
        })] });
      });
      App.setSpeed(50);
      App.setToggle('coverage', true);
      App.setToggle('orbits', true);
    }
  },
  {
    title: 'POLAR ORBIT',
    desc: 'A near-polar satellite with its ground track traced beneath it.',
    apply(App) {
      App.clearSatellites();
      App.clearGroundStations();
      const sat = new Satellite({ name: 'POLAR-01', altitude: 800, inclination: 98, phase: 0, coverageAngle: 12,
        constellationId: nextId('const'), constellationName: 'POLAR', color: CONST.COLORS_BY_CONSTELLATION[1] });
      sat.showGroundTrack = true;
      App.addConstellation({ id: nextId('const'), name: 'POLAR', sats: [sat] });
      App.setSpeed(60);
      App.setToggle('groundTracks', true);
      App.setToggle('coverage', true);
      App.selectSatellite(sat.id);
    }
  },
  {
    title: 'CONSTELLATION',
    desc: 'A multi-plane global network — watch broad coverage emerge.',
    apply(App) {
      App.clearSatellites();
      App.clearGroundStations();
      const c = Constellation.build({
        name: 'NETWORK', count: 40, planes: 8, altitude: 900,
        inclination: 60, coverageAngle: 12, phaseOffsetDeg: 12, colorIndex: 2
      });
      App.addConstellation(c);
      App.setSpeed(100);
      App.setToggle('coverage', true);
      App.setToggle('orbits', true);
    }
  },
  {
    title: 'GEO',
    desc: 'A generic geostationary-style satellite that hovers over roughly one longitude.',
    apply(App) {
      App.clearSatellites();
      App.clearGroundStations();
      const sat = new Satellite({ name: 'GEO-01', altitude: 35786, inclination: 0, phase: 0, coverageAngle: 5,
        constellationId: nextId('const'), constellationName: 'GEO', color: CONST.COLORS_BY_CONSTELLATION[4] });
      App.addConstellation({ id: nextId('const'), name: 'GEO', sats: [sat] });
      App.setSpeed(300);
      App.setToggle('coverage', true);
      App.setToggle('groundTracks', true);
      sat.showGroundTrack = true;
      App.selectSatellite(sat.id);
    }
  }
];

const CHALLENGES = [
  {
    id: 'global90',
    title: 'GLOBAL COVERAGE',
    desc: 'Achieve at least 90% estimated Earth coverage with the fewest satellites possible.',
    check(App) {
      const cov = App.coverageStats.coveragePct || 0;
      const n = App.state.satellites.filter(s => s.active).length;
      return { pass: cov >= 90 && n > 0, detail: `${cov.toFixed(1)}% coverage · ${n} satellites` };
    }
  },
  {
    id: 'polarLink',
    title: 'POLAR LINK',
    desc: 'Maintain frequent coverage over a polar ground station (add one at ~78°N or higher).',
    check(App) {
      const polarGs = App.state.groundStations.find(g => Math.abs(g.lat) >= 66);
      if (!polarGs) return { pass: false, detail: 'Add a ground station above 66° latitude' };
      return { pass: polarGs.linked, detail: polarGs.linked ? `${polarGs.name} is CONNECTED` : `${polarGs.name}: NO LINK` };
    }
  },
  {
    id: 'equatorialNet',
    title: 'EQUATORIAL NETWORK',
    desc: 'Provide continuous connection to three equatorial ground stations at once.',
    check(App) {
      const eqStations = App.state.groundStations.filter(g => Math.abs(g.lat) <= 15);
      const linked = eqStations.filter(g => g.linked).length;
      return { pass: eqStations.length >= 3 && linked >= 3, detail: `${linked}/${Math.max(3, eqStations.length)} equatorial stations linked` };
    }
  },
  {
    id: 'minimalConstellation',
    title: 'MINIMAL CONSTELLATION',
    desc: 'Reach 60% global coverage using fewer than 12 satellites.',
    check(App) {
      const cov = App.coverageStats.coveragePct || 0;
      const n = App.state.satellites.filter(s => s.active).length;
      return { pass: cov >= 60 && n > 0 && n < 12, detail: `${cov.toFixed(1)}% coverage with ${n} satellites` };
    }
  }
];
