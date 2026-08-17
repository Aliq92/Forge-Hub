// ============================================================
// renderer.js — Canvas pseudo-3D rendering engine
// World frame = ECEF (Earth-fixed): continents & ground stations are
// static in this frame; satellite positions are computed in ECI then
// rotated into this frame each tick (see orbit.js), which is what makes
// Earth appear to spin beneath fixed orbital planes.
// Camera is an orthographic arcball: yaw/pitch define a view direction,
// projection drops the "toward camera" axis (depth) which also gives an
// exact circular silhouette test for Earth occlusion.
// ============================================================
const Renderer = {
  canvas: null, ctx: null, dpr: 1,
  width: 0, height: 0, cx: 0, cy: 0,

  camera: { yaw: -0.6, pitch: 0.42, zoom: 1, panX: 0, panY: 0 },
  _basis: null,

  stars: [],
  continents: [],
  sunDirEci: { x: 0.86, y: 0.35, z: 0.28 },

  dragging: false, lastPointer: null, dragMoved: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._buildContinents();
    this._buildStars();
    this.resize();
    this._bindInput();
    this._updateBasis();
  },

  resize() {
    const parent = this.canvas.parentElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = parent.clientWidth;
    this.height = parent.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  },

  // ---------------- camera ----------------
  _updateBasis() {
    const { yaw, pitch } = this.camera;
    const camDir = {
      x: Math.cos(pitch) * Math.cos(yaw),
      y: Math.cos(pitch) * Math.sin(yaw),
      z: Math.sin(pitch)
    };
    let worldUp = { x: 0, y: 0, z: 1 };
    // avoid gimbal degeneracy near poles
    if (Math.abs(camDir.z) > 0.999) worldUp = { x: 0, y: 1, z: 0 };
    const right = normalize(cross(worldUp, camDir));
    const up2 = cross(camDir, right);
    this._basis = { camDir, right, up2 };

    function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
    function normalize(v) { const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1; return { x: v.x / m, y: v.y / m, z: v.z / m }; }
  },

  get pxPerKm() { return (CONST.EARTH_RADIUS_PX / CONST.EARTH_RADIUS_KM) * this.camera.zoom; },
  get earthRadiusPx() { return CONST.EARTH_RADIUS_PX * this.camera.zoom; },

  // project a world-space km point -> {sx, sy, depth, occluded}
  project(p) {
    const b = this._basis;
    const camX = p.x * b.right.x + p.y * b.right.y + p.z * b.right.z;
    const camY = p.x * b.up2.x + p.y * b.up2.y + p.z * b.up2.z;
    const camZ = p.x * b.camDir.x + p.y * b.camDir.y + p.z * b.camDir.z;
    const scale = this.pxPerKm;
    const sx = this.cx + this.camera.panX + camX * scale;
    const sy = this.cy + this.camera.panY - camY * scale;
    const Re = CONST.EARTH_RADIUS_KM;
    const occluded = camZ < 0 && (camX * camX + camY * camY) < Re * Re;
    return { sx, sy, depth: camZ, occluded, front: camZ >= 0 };
  },

  resetCamera() {
    this.camera.yaw = -0.6; this.camera.pitch = 0.42; this.camera.zoom = 1;
    this.camera.panX = 0; this.camera.panY = 0;
    this._updateBasis();
  },

  focusEarth() { this.resetCamera(); },

  focusSatellite(sat) {
    if (!sat || !sat.state) return;
    const w = sat.state.world;
    this.camera.yaw = Math.atan2(w.y, w.x);
    const r = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z) || 1;
    this.camera.pitch = Math.asin(Math.max(-0.98, Math.min(0.98, w.z / r)));
    this.camera.panX = 0; this.camera.panY = 0;
    this._updateBasis();
  },

  zoomBy(factor) {
    this.camera.zoom = Math.max(0.15, Math.min(8, this.camera.zoom * factor));
  },

  _bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.dragging = true; this.dragMoved = false;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.lastPointer) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.dragMoved = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (e.shiftKey || e.button === 2) {
        this.camera.panX += dx; this.camera.panY += dy;
      } else {
        this.camera.yaw += dx * 0.006;
        this.camera.pitch = Math.max(-1.5, Math.min(1.5, this.camera.pitch - dy * 0.006));
        this._updateBasis();
      }
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomBy(factor);
    }, { passive: false });

    // touch pinch
    let pinchStartDist = null, pinchStartZoom = 1;
    c.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        pinchStartZoom = this.camera.zoom;
      }
    }, { passive: true });
    c.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinchStartDist) {
        const d = dist(e.touches[0], e.touches[1]);
        this.camera.zoom = Math.max(0.15, Math.min(8, pinchStartZoom * (d / pinchStartDist)));
      }
    }, { passive: true });
    function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

    window.addEventListener('resize', () => this.resize());
  },

  // ---------------- static content builders ----------------
  _buildStars() {
    const stars = [];
    for (let i = 0; i < CONST.STAR_COUNT; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: Math.random() * 1.3 + 0.25,
        a: Math.random() * 0.55 + 0.25,
        tw: Math.random() * Math.PI * 2
      });
    }
    this.stars = stars;
  },

  _buildContinents() {
    // Rough, stylized landmass outlines (lat, lon) — NOT geographically precise;
    // intended to give a recognizable "this is Earth" impression only.
    const raw = {
      'N. America': [[71,-156],[70,-128],[60,-140],[55,-130],[48,-125],[40,-124],[32,-117],[20,-105],[15,-92],[18,-95],[25,-97],[30,-90],[30,-81],[35,-76],[40,-74],[45,-67],[47,-60],[50,-56],[55,-60],[60,-65],[65,-80],[68,-95],[70,-110],[71,-130]],
      'S. America': [[12,-72],[8,-77],[0,-80],[-5,-81],[-18,-70],[-25,-70],[-33,-71],[-40,-73],[-45,-73],[-53,-71],[-55,-68],[-52,-60],[-45,-58],[-38,-58],[-30,-52],[-23,-43],[-15,-39],[-8,-35],[-3,-40],[2,-50],[5,-60],[8,-65]],
      'Eurasia': [[71,25],[68,40],[66,60],[68,90],[70,120],[68,140],[62,160],[55,163],[50,155],[45,140],[40,130],[35,128],[32,120],[25,115],[22,108],[18,105],[10,105],[5,100],[2,102],[8,98],[15,95],[20,90],[22,88],[25,80],[24,68],[26,60],[30,50],[35,45],[38,35],[40,28],[45,30],[50,30],[55,20],[60,10],[65,15]],
      'Africa': [[37,10],[33,10],[32,20],[30,32],[22,37],[12,43],[10,51],[0,42],[-5,40],[-15,40],[-22,35],[-27,32],[-34,20],[-33,18],[-28,16],[-18,12],[-10,13],[0,9],[5,-5],[10,-15],[15,-17],[22,-16],[28,-11],[33,-9],[35,-6]],
      'Australia': [[-11,142],[-13,136],[-17,122],[-22,114],[-30,115],[-35,118],[-38,141],[-38,145],[-33,151],[-28,153],[-20,148],[-16,145]],
      'Greenland': [[83,-35],[78,-60],[70,-55],[62,-45],[60,-42],[65,-38],[72,-25],[80,-18]],
      'Madagascar': [[-12,49],[-16,44],[-22,43],[-25,46],[-22,48],[-16,50]],
      'Britain': [[59,-3],[54,-6],[51,-10],[51,-3],[53,1],[58,-1]],
      'Japan': [[45,142],[38,140],[34,132],[31,131],[35,136],[41,140]],
      'New Zealand': [[-34,173],[-41,174],[-46,168],[-41,172]],
      'Indonesia': [[6,96],[-6,106],[-8,115],[-2,120],[2,109]],
      'Antarctica': [[-63,-160],[-65,-120],[-66,-80],[-65,-40],[-63,0],[-65,40],[-66,80],[-65,120],[-63,160],[-65,-160]]
    };
    this.continents = Object.keys(raw).map(name => ({
      name,
      points: raw[name].map(([lat, lon]) => ({ lat, lon }))
    }));
  },

  // ---------------- main render entry ----------------
  render(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, this.width, this.height);

    this._updateBasis();
    this._drawStarfield();

    const toggles = state.toggles;
    const viewMode = state.viewMode;

    if (toggles.atmosphere) this._drawAtmosphere();
    this._drawEarthSphere(state);
    if (toggles.grid) this._drawLatLonGrid();
    this._drawContinents(state);

    const orbitAlpha = viewMode === 'network' ? 0.35 : 1;
    const coverageAlpha = viewMode === 'coverage' ? 1 : (viewMode === 'network' ? 0.25 : 0.85);

    if (toggles.coverage) this._drawCoverage(state, coverageAlpha);

    if (toggles.groundTracks || viewMode === 'groundtrack') this._drawGroundTracks(state);

    if (toggles.orbits) this._drawOrbitPaths(state, orbitAlpha);

    this._drawTrails(state);

    if (viewMode === 'network') this._drawSatelliteLinks(state);
    if (toggles.satLinks) this._drawSatelliteLinks(state);

    this._drawGroundStations(state);
    this._drawSatellites(state, toggles.labels || viewMode === 'network');

    this._drawGsLinks(state);
  },

  // ---------------- layers ----------------
  _drawStarfield() {
    const ctx = this.ctx;
    ctx.save();
    for (const s of this.stars) {
      const x = s.x * this.width, y = s.y * this.height;
      const tw = 0.6 + 0.4 * Math.sin(s.tw + performance.now() * 0.0005);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawAtmosphere() {
    const ctx = this.ctx;
    const r = this.earthRadiusPx;
    const g = ctx.createRadialGradient(this.cx + this.camera.panX, this.cy + this.camera.panY, r * 0.96, this.cx + this.camera.panX, this.cy + this.camera.panY, r * 1.35);
    g.addColorStop(0, 'rgba(120,190,255,0.55)');
    g.addColorStop(0.4, 'rgba(90,160,255,0.18)');
    g.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.cx + this.camera.panX, this.cy + this.camera.panY, r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawEarthSphere(state) {
    const ctx = this.ctx;
    const r = this.earthRadiusPx;
    const ex = this.cx + this.camera.panX, ey = this.cy + this.camera.panY;

    // light source screen-space offset (fixed upper-left key light for a consistent sphere look)
    const lightX = ex - r * 0.35, lightY = ey - r * 0.35;
    const g = ctx.createRadialGradient(lightX, lightY, r * 0.05, ex, ey, r * 1.05);
    g.addColorStop(0, '#1f5f8f');
    g.addColorStop(0.45, '#123f63');
    g.addColorStop(0.8, '#0a2140');
    g.addColorStop(1, '#040d1c');

    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(140,200,255,0.35)';
    ctx.stroke();
    ctx.restore();
  },

  _projectLatLon(lat, lon, r) {
    return this.project(Orbit.latLonToWorld(lat, lon, r || CONST.EARTH_RADIUS_KM));
  },

  _drawContinents(state) {
    const ctx = this.ctx;
    const Re = CONST.EARTH_RADIUS_KM * 1.001;
    const sunW = state.sunDirWorld;

    for (const cont of this.continents) {
      const pts = cont.points.map(p => {
        const world = Orbit.latLonToWorld(p.lat, p.lon, Re);
        const proj = this.project(world);
        return { proj, world };
      });
      const frontCount = pts.filter(p => p.proj.front).length;
      if (frontCount < pts.length * 0.55) continue; // mostly on the far side — skip

      // average dot with camera dir for a soft limb fade
      let dotSum = 0;
      for (const p of pts) {
        const m = Math.sqrt(p.world.x ** 2 + p.world.y ** 2 + p.world.z ** 2) || 1;
        dotSum += p.proj.depth / m;
      }
      const limb = Math.max(0, Math.min(1, dotSum / pts.length + 0.15));

      // day/night terminator shading if sunlight mode data available
      let lightMul = 1;
      if (sunW) {
        let ndotSum = 0;
        for (const p of pts) {
          const m = Math.sqrt(p.world.x ** 2 + p.world.y ** 2 + p.world.z ** 2) || 1;
          ndotSum += (p.world.x * sunW.x + p.world.y * sunW.y + p.world.z * sunW.z) / m;
        }
        const nd = ndotSum / pts.length;
        lightMul = state.toggles.sunlight ? (nd > 0 ? 1 : 0.32) : 1;
      }

      ctx.save();
      ctx.globalAlpha = limb * lightMul;
      ctx.fillStyle = '#3f7a52';
      ctx.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.proj.sx, p.proj.sy);
        else ctx.lineTo(p.proj.sx, p.proj.sy);
      });
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  _drawLatLonGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(160,210,255,0.22)';
    ctx.lineWidth = 1;

    // parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      this._strokeSphereLine(Array.from({ length: 73 }, (_, i) => ({ lat, lon: -180 + i * 5 })));
    }
    // meridians
    for (let lon = -150; lon <= 180; lon += 30) {
      this._strokeSphereLine(Array.from({ length: 37 }, (_, i) => ({ lat: -90 + i * 5, lon })));
    }
    ctx.restore();
  },

  // draws a polyline of lat/lon points on the sphere surface, splitting into
  // visible sub-segments so the far side doesn't draw through the globe
  _strokeSphereLine(latLonPts, radiusKm, style) {
    const ctx = this.ctx;
    const r = radiusKm || CONST.EARTH_RADIUS_KM * 1.0005;
    ctx.save();
    if (style) { ctx.strokeStyle = style.color || ctx.strokeStyle; ctx.lineWidth = style.width || ctx.lineWidth; }
    let path = [];
    const flush = () => {
      if (path.length > 1) {
        ctx.beginPath();
        path.forEach((p, i) => i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy));
        ctx.stroke();
      }
      path = [];
    };
    for (const ll of latLonPts) {
      const proj = this._projectLatLon(ll.lat, ll.lon, r);
      if (proj.front) path.push(proj); else flush();
    }
    flush();
    ctx.restore();
  },

  _drawOrbitPaths(state, alphaMul) {
    const ctx = this.ctx;
    const selected = state.selectedSatId;
    for (const sat of state.satellites) {
      if (!sat.active) continue;
      const isSel = sat.id === selected;
      ctx.save();
      ctx.lineWidth = isSel ? 1.6 : 1;
      const baseAlpha = (isSel ? 0.85 : 0.35) * alphaMul;

      const N = 96;
      let path = [];
      const flush = (occludedSeg) => {
        if (path.length > 1) {
          ctx.globalAlpha = occludedSeg ? baseAlpha * 0.12 : baseAlpha;
          ctx.strokeStyle = sat.color;
          ctx.beginPath();
          path.forEach((p, i) => i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy));
          ctx.stroke();
        }
        path = [];
      };
      let curOccluded = null;
      for (let i = 0; i <= N; i++) {
        const theta = (i / N) * Math.PI * 2;
        const w = Orbit.ringPointWorld(sat, theta, state.simElapsedSec);
        const proj = this.project(w);
        if (curOccluded === null) curOccluded = proj.occluded;
        if (proj.occluded !== curOccluded) { flush(curOccluded); curOccluded = proj.occluded; }
        path.push(proj);
      }
      flush(curOccluded);
      ctx.restore();
    }
  },

  _drawGroundTracks(state) {
    const ctx = this.ctx;
    for (const sat of state.satellites) {
      if (!sat.active || !sat.showGroundTrack) continue;
      ctx.save();
      ctx.strokeStyle = sat.color;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([1, 3]);
      ctx.globalAlpha = 0.8;
      const N = 180;
      const T = sat.period;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = state.simElapsedSec - T * 0.5 + (i / N) * T;
        const st = Orbit.computeState(sat, Math.max(0, t));
        pts.push({ lat: st.lat, lon: st.lon });
      }
      // split path at large longitude jumps (wraparound) to avoid streaks across the map
      let seg = [];
      const flush = () => {
        if (seg.length > 1) {
          ctx.beginPath();
          seg.forEach((p, i) => i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy));
          ctx.stroke();
        }
        seg = [];
      };
      let prevLon = null;
      for (const p of pts) {
        if (prevLon !== null && Math.abs(p.lon - prevLon) > 180) flush();
        prevLon = p.lon;
        const proj = this._projectLatLon(p.lat, p.lon, CONST.EARTH_RADIUS_KM * 1.001);
        if (proj.front) seg.push(proj); else flush();
      }
      flush();
      ctx.restore();
    }
  },

  _drawTrails(state) {
    const ctx = this.ctx;
    for (const sat of state.satellites) {
      if (!sat.active || !sat.trail.length) continue;
      ctx.save();
      ctx.strokeStyle = sat.color;
      const n = sat.trail.length;
      let path = [];
      const flush = () => {
        if (path.length > 1) {
          ctx.beginPath();
          path.forEach((p, i) => i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy));
          ctx.stroke();
        }
        path = [];
      };
      for (let i = 0; i < n; i++) {
        const t = sat.trail[i];
        const world = Orbit.latLonToWorld(t.lat, t.lon, sat.state ? sat.state.r : CONST.EARTH_RADIUS_KM + sat.altitude);
        const proj = this.project(world);
        ctx.globalAlpha = (i / n) * 0.5;
        if (proj.front) path.push(proj); else flush();
      }
      flush();
      ctx.restore();
    }
  },

  _drawCoverage(state, alphaMul) {
    const ctx = this.ctx;
    for (const sat of state.satellites) {
      if (!sat.active || !sat.state) continue;
      const angleDeg = sat.coverageCentralAngleDeg;
      if (angleDeg <= 0) continue;
      const nadirProj = this.project(Orbit.latLonToWorld(sat.state.lat, sat.state.lon, CONST.EARTH_RADIUS_KM));
      if (!nadirProj.front) continue; // footprint's nadir is on the far side — skip (avoids far-side artifacts)

      const N = 64;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const brg = (i / N) * Math.PI * 2;
        const ll = destinationPoint(sat.state.lat, sat.state.lon, angleDeg, brg);
        const proj = this._projectLatLon(ll.lat, ll.lon, CONST.EARTH_RADIUS_KM * 1.0015);
        pts.push(proj);
      }
      const visible = pts.filter(p => p.front);
      if (visible.length < 3) continue;

      ctx.save();
      ctx.globalAlpha = 0.16 * alphaMul;
      ctx.fillStyle = sat.color;
      ctx.beginPath();
      visible.forEach((p, i) => i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy));
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.55 * alphaMul;
      ctx.strokeStyle = sat.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      visible.forEach((p) => { if (!started) { ctx.moveTo(p.sx, p.sy); started = true; } else ctx.lineTo(p.sx, p.sy); });
      ctx.stroke();
      ctx.restore();
    }

    function destinationPoint(lat, lon, angleDeg, bearingRad) {
      const dr = Orbit.deg2rad(angleDeg);
      const lat1 = Orbit.deg2rad(lat), lon1 = Orbit.deg2rad(lon);
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(bearingRad));
      const lon2 = lon1 + Math.atan2(
        Math.sin(bearingRad) * Math.sin(dr) * Math.cos(lat1),
        Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2)
      );
      return { lat: Orbit.rad2deg(lat2), lon: Orbit.rad2deg(lon2) };
    }
  },

  _drawSatellites(state, showLabels) {
    const ctx = this.ctx;
    const selected = state.selectedSatId;
    // depth-sort for a subtly convincing overlap order
    const list = state.satellites.filter(s => s.active && s.state);
    list.sort((a, b) => (a.screen ? a.screen.depth : 0) - (b.screen ? b.screen.depth : 0));

    for (const sat of list) {
      const proj = this.project(sat.state.world);
      sat.screen = proj;
      if (proj.occluded) continue;

      const isSel = sat.id === selected;
      const eclipsed = state.toggles.sunlight && !sat.sunlit;

      ctx.save();
      ctx.globalAlpha = eclipsed ? 0.45 : 1;
      ctx.fillStyle = sat.color;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, isSel ? 5 : 3.4, 0, Math.PI * 2);
      ctx.fill();

      if (isSel) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, 9, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, 5.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (showLabels || isSel) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(230,240,255,0.9)';
        ctx.font = '10px Consolas, monospace';
        ctx.fillText(sat.name, proj.sx + 8, proj.sy - 6);
      }
      ctx.restore();
    }
  },

  _drawGroundStations(state) {
    const ctx = this.ctx;
    for (const gs of state.groundStations) {
      const proj = this._projectLatLon(gs.lat, gs.lon, CONST.EARTH_RADIUS_KM * 1.001);
      gs.screen = proj;
      if (proj.occluded) continue;
      ctx.save();
      ctx.fillStyle = gs.linked ? '#6bf28c' : '#ff8f8f';
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(proj.sx, proj.sy - 7);
      ctx.lineTo(proj.sx + 6, proj.sy + 5);
      ctx.lineTo(proj.sx - 6, proj.sy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.font = '9.5px Consolas, monospace';
      ctx.fillText(gs.name, proj.sx + 9, proj.sy + 3);
      ctx.restore();
    }
  },

  _drawGsLinks(state) {
    const ctx = this.ctx;
    for (const gs of state.groundStations) {
      if (!gs.linked || !gs.bestSatId || !gs.screen || gs.screen.occluded) continue;
      const sat = state.satellites.find(s => s.id === gs.bestSatId);
      if (!sat || !sat.screen || sat.screen.occluded) continue;
      ctx.save();
      ctx.strokeStyle = '#6bf28c';
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(gs.screen.sx, gs.screen.sy);
      ctx.lineTo(sat.screen.sx, sat.screen.sy);
      ctx.stroke();
      ctx.restore();
    }
  },

  _segmentBlockedByEarth(p1, p2) {
    // closest approach of the segment p1->p2 to the origin, vs Earth radius
    const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
    const lenSq = dx * dx + dy * dy + dz * dz || 1e-9;
    let t = -(p1.x * dx + p1.y * dy + p1.z * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = p1.x + dx * t, cy = p1.y + dy * t, cz = p1.z + dz * t;
    const distSq = cx * cx + cy * cy + cz * cz;
    return distSq < (CONST.EARTH_RADIUS_KM * CONST.EARTH_RADIUS_KM);
  },

  _drawSatelliteLinks(state) {
    const ctx = this.ctx;
    const maxRangeKm = state.satLinkRangeKm || 8000;
    const active = state.satellites.filter(s => s.active && s.state);
    ctx.save();
    ctx.strokeStyle = '#94e6ff';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const pa = a.state.world, pb = b.state.world;
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
        if (dist > maxRangeKm) continue;
        if (this._segmentBlockedByEarth(pa, pb)) continue;
        const proj1 = this.project(pa), proj2 = this.project(pb);
        if (proj1.occluded || proj2.occluded) continue;
        ctx.globalAlpha = 0.32 * (1 - dist / maxRangeKm) + 0.08;
        ctx.beginPath();
        ctx.moveTo(proj1.sx, proj1.sy);
        ctx.lineTo(proj2.sx, proj2.sy);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  // called from selection logic: hit-test satellites near a screen point
  hitTestSatellite(state, sx, sy) {
    let best = null, bestD = 16 * 16;
    for (const sat of state.satellites) {
      if (!sat.active || !sat.screen || sat.screen.occluded) continue;
      const d = (sat.screen.sx - sx) ** 2 + (sat.screen.sy - sy) ** 2;
      if (d < bestD) { bestD = d; best = sat; }
    }
    return best;
  }
};
