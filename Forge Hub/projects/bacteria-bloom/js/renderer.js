/* Bacteria Bloom - canvas rendering: agar texture, colony field, glass dish, overlays */
(function (BB) {
  'use strict';
  const util = BB.util;
  const STRAIN_ORDER = BB.Strains.STRAIN_ORDER;
  const STRAINS = BB.Strains.STRAINS;

  const _scratch = new Uint8ClampedArray(3);
  const _comp = { r: 0, g: 0, b: 0, a: 0 };

  function hsl2rgbInto(h, s, l, out) {
    h = ((h % 360) + 360) % 360;
    s = util.clamp(s, 0, 100) / 100; l = util.clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    out[0] = Math.round((r + m) * 255);
    out[1] = Math.round((g + m) * 255);
    out[2] = Math.round((b + m) * 255);
  }

  function compositeOver(dr, dg, db, da, sr, sg, sb, sa) {
    const outA = sa + da * (1 - sa);
    if (outA <= 0.0001) { _comp.r = 0; _comp.g = 0; _comp.b = 0; _comp.a = 0; return _comp; }
    _comp.r = (sr * sa + dr * da * (1 - sa)) / outA;
    _comp.g = (sg * sa + dg * da * (1 - sa)) / outA;
    _comp.b = (sb * sa + db * da * (1 - sa)) / outA;
    _comp.a = outA;
    return _comp;
  }

  function Renderer(canvas, env, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.env = env; this.sim = sim;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.visualMode = 'normal';

    this.cssW = 0; this.cssH = 0; this.cx = 0; this.cy = 0; this.radius = 0;

    this.agarCanvas = document.createElement('canvas');
    this.agarCanvas.width = env.w; this.agarCanvas.height = env.h;
    this.agarCtx = this.agarCanvas.getContext('2d');

    this.dynCanvas = document.createElement('canvas');
    this.dynCanvas.width = env.w; this.dynCanvas.height = env.h;
    this.dynCtx = this.dynCanvas.getContext('2d');
    this.dynImageData = this.dynCtx.createImageData(env.w, env.h);

    this.pings = [];
    this.brushPreview = null;

    this.rebuildAgar();
  }

  Renderer.prototype.rebuildAgar = function () {
    const env = this.env;
    const id = this.agarCtx.createImageData(env.w, env.h);
    const data = id.data;
    for (let y = 0; y < env.h; y++) {
      for (let x = 0; x < env.w; x++) {
        const i = y * env.w + x;
        const p = i * 4;
        if (!env.dishMask[i]) { data[p + 3] = 0; continue; }
        const variation = env.agarVariation[i];
        const grain = (Math.random() - 0.5) * 5;
        const L = util.clamp(27 + variation * 12 + grain, 10, 52);
        hsl2rgbInto(36, 16, L, _scratch);
        data[p] = _scratch[0]; data[p + 1] = _scratch[1]; data[p + 2] = _scratch[2];
        data[p + 3] = 232;
      }
    }
    this.agarCtx.putImageData(id, 0, 0);
  };

  Renderer.prototype.resize = function (cssW, cssH) {
    this.cssW = cssW; this.cssH = cssH;
    const size = Math.min(cssW, cssH);
    this.radius = size * 0.46;
    this.cx = cssW / 2; this.cy = cssH / 2;
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Renderer.prototype.screenToGrid = function (clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = clientX - rect.left, cssY = clientY - rect.top;
    const dx = cssX - this.cx, dy = cssY - this.cy;
    const inDishCss = (dx * dx + dy * dy) <= this.radius * this.radius;
    const gx = this.env.cx + (dx / this.radius) * this.env.radius;
    const gy = this.env.cy + (dy / this.radius) * this.env.radius;
    return { x: gx, y: gy, inDish: inDishCss && this.env.inDish(Math.round(gx), Math.round(gy)) };
  };

  Renderer.prototype.gridRadiusToCss = function (rCells) {
    return (rCells / this.env.radius) * this.radius;
  };

  Renderer.prototype.addPing = function (gx, gy, color) {
    this.pings.push({ gx, gy, t: 0, color: color || 'rgba(255,255,255,0.9)' });
  };

  Renderer.prototype.setBrushPreview = function (preview) { this.brushPreview = preview; };

  Renderer.prototype.buildDynamicLayer = function (mode) {
    const env = this.env, sim = this.sim;
    const w = env.w, h = env.h, n = w * h;
    const data = this.dynImageData.data;

    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (!env.dishMask[i]) { data[p + 3] = 0; continue; }

      let r = 0, g = 0, b = 0, a = 0;

      // nutrient hint / overlay layer
      const nut = env.nutrient[i];
      const isNutrientMode = mode === 'nutrients';
      const nutAlpha = isNutrientMode ? 0.62 : 0.045;
      const nutCurve = isNutrientMode ? Math.pow(nut, 1.35) : nut;
      const nh = isNutrientMode ? 146 : util.lerp(30, 46, nut);
      const ns = isNutrientMode ? 22 + nutCurve * 55 : 14 + nut * 8;
      const nl = isNutrientMode ? 10 + nutCurve * 42 : 22 + nut * 10;
      hsl2rgbInto(nh, ns, nl, _scratch);
      let c = compositeOver(r, g, b, a, _scratch[0], _scratch[1], _scratch[2], nutAlpha);
      r = c.r; g = c.g; b = c.b; a = c.a;

      // inhibitor zone tint
      const inhib = env.inhibitor[i];
      if (inhib > 0.02) {
        const inhibAlpha = Math.min(0.6, inhib * 0.62);
        hsl2rgbInto(280, 30, 26 + inhib * 10, _scratch);
        c = compositeOver(r, g, b, a, _scratch[0], _scratch[1], _scratch[2], inhibAlpha);
        r = c.r; g = c.g; b = c.b; a = c.a;
      }

      // colony
      const sIdx = sim.strainIdxGrid[i];
      if (sIdx !== 255) {
        const strain = STRAINS[STRAIN_ORDER[sIdx]];
        const density = sim.density[i];
        const age = sim.age[i];
        const dead = sim.dead[i];
        const deathFade = sim.deathFade[i];
        const mutId = sim.mutationIdGrid[i];
        let hue = strain.hue, sat = strain.sat, light = strain.light;

        if (mutId > 0) {
          const colony = sim.colonies.get(sim.colonyIdGrid[i]);
          const mut = colony ? colony.mutations[mutId - 1] : null;
          if (mut) hue += mut.hueShift;
        }

        const maturity = util.clamp(age / 300, 0, 1);
        let colAlpha;

        if (mode === 'stress') {
          const tempFactor = sim.computeTempFactor(strain, env.temperature);
          const stress = sim.computeStressLevel(strain, env.nutrient[i], env.inhibitor[i], tempFactor);
          hue = util.lerp(150, 4, stress);
          sat = 62; light = 40 + stress * 10;
          colAlpha = 0.25 + 0.65 * density;
        } else if (mode === 'age') {
          light = util.lerp(80, 16, maturity);
          sat = strain.sat * util.lerp(1.1, 0.65, maturity);
          colAlpha = 0.3 + 0.6 * density;
        } else {
          light = strain.light + (1 - maturity) * 9 - maturity * 11;
          sat = strain.sat + (1 - maturity) * 10;
          colAlpha = 0.5 + 0.42 * density + 0.08 * maturity;
        }
        colAlpha = util.clamp(colAlpha, 0, 0.96);

        if (dead) {
          light = util.lerp(light, 9, 0.65);
          sat = util.lerp(sat, 5, 0.75);
          colAlpha *= 0.82 * deathFade;
        }

        hsl2rgbInto(hue, util.clamp(sat, 4, 96), util.clamp(light, 5, 92), _scratch);
        c = compositeOver(r, g, b, a, _scratch[0], _scratch[1], _scratch[2], colAlpha);
        r = c.r; g = c.g; b = c.b; a = c.a;
      }

      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = Math.round(a * 255);
    }
    this.dynCtx.putImageData(this.dynImageData, 0, 0);
  };

  Renderer.prototype._drawPings = function (ctx, dt) {
    if (!this.pings.length) return;
    const keep = [];
    for (const ping of this.pings) {
      ping.t += dt;
      if (ping.t > 0.7) continue;
      const t = ping.t / 0.7;
      const cssPos = this._gridToCss(ping.gx, ping.gy);
      const r = util.lerp(2, 26, t);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = ping.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cssPos.x, cssPos.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      keep.push(ping);
    }
    this.pings = keep;
  };

  Renderer.prototype._gridToCss = function (gx, gy) {
    const dx = (gx - this.env.cx) / this.env.radius * this.radius;
    const dy = (gy - this.env.cy) / this.env.radius * this.radius;
    return { x: this.cx + dx, y: this.cy + dy };
  };

  Renderer.prototype._drawRim = function (ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
    const rimGrad = ctx.createLinearGradient(this.cx - this.radius, this.cy - this.radius, this.cx + this.radius, this.cy + this.radius);
    rimGrad.addColorStop(0, 'rgba(255,255,255,0.38)');
    rimGrad.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    rimGrad.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.lineWidth = Math.max(2, this.radius * 0.02);
    ctx.strokeStyle = rimGrad;
    ctx.shadowColor = 'rgba(160,220,220,0.25)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius + 1, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype._drawBrushPreview = function (ctx) {
    if (!this.brushPreview) return;
    const bp = this.brushPreview;
    const pos = this._gridToCss(bp.gx, bp.gy);
    const r = this.gridRadiusToCss(bp.radiusCells);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = bp.color || 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.draw = function (dtSeconds) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    const glowGrad = ctx.createRadialGradient(this.cx, this.cy, this.radius * 0.7, this.cx, this.cy, this.radius * 1.35);
    glowGrad.addColorStop(0, 'rgba(120,190,190,0.10)');
    glowGrad.addColorStop(1, 'rgba(120,190,190,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, this.radius * 1.35, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0c1211';
    ctx.fillRect(this.cx - this.radius, this.cy - this.radius, this.radius * 2, this.radius * 2);

    const bx = this.cx - this.radius, by = this.cy - this.radius, bs = this.radius * 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.agarCanvas, bx, by, bs, bs);

    this.buildDynamicLayer(this.visualMode);
    ctx.drawImage(this.dynCanvas, bx, by, bs, bs);

    const shade = ctx.createRadialGradient(this.cx, this.cy, this.radius * 0.15, this.cx, this.cy, this.radius);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2); ctx.fill();

    this._drawPings(ctx, dtSeconds);

    ctx.restore();

    this._drawRim(ctx);
    this._drawBrushPreview(ctx);
  };

  BB.Renderer = Renderer;

})(window.BB = window.BB || {});
