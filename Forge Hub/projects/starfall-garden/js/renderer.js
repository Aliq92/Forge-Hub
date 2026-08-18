// All canvas rendering: starfield, planet terrain, plants, player, fragments, meteors, effects.
SG.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldRadius = 260;
    this.centerX = 0; this.centerY = 0; this.scale = 1;
    this.time = 0;
    this.stars = [];
    this.nebulae = [];
    this.dust = [];
    this.shakeX = 0; this.shakeY = 0;
    this._initBackground();
  }

  resize(w, h, dpr) {
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = w; this.cssH = h;
    this.centerX = w / 2;
    this.centerY = h / 2;
    this.scale = (Math.min(w, h) * 0.44) / this.worldRadius;
    this._initBackground();
  }

  _initBackground() {
    const w = this.cssW || window.innerWidth, h = this.cssH || window.innerHeight;
    this.stars = [];
    for (let layer = 0; layer < 3; layer++) {
      const count = layer === 0 ? 90 : layer === 1 ? 60 : 35;
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: Math.random() * w, y: Math.random() * h,
          size: SG.util.rand(0.6, layer === 2 ? 2.6 : 1.6),
          phase: Math.random() * SG.util.TAU,
          speed: SG.util.rand(0.6, 1.4),
          parallax: 3 + layer * 6,
        });
      }
      this.stars.push(arr);
    }
    this.nebulae = [];
    for (let i = 0; i < 4; i++) {
      this.nebulae.push({
        x: Math.random() * w, y: Math.random() * h,
        r: SG.util.rand(180, 340),
        hue: SG.util.choice(['#241a4d', '#1a2c4d', '#2a1a3d', '#14203d']),
        phase: Math.random() * SG.util.TAU,
      });
    }
    this.dust = [];
    for (let i = 0; i < 26; i++) {
      this.dust.push({ x: Math.random() * w, y: Math.random() * h, size: SG.util.rand(1, 2.4), speed: SG.util.rand(3, 10), drift: Math.random() * SG.util.TAU });
    }
  }

  toScreen(x, y) {
    return { x: this.centerX + this.shakeX + x * this.scale, y: this.centerY + this.shakeY + y * this.scale };
  }

  updateShake(amount, enabled) {
    if (!enabled || amount <= 0) { this.shakeX = 0; this.shakeY = 0; return; }
    const mag = amount * 7;
    this.shakeX = SG.util.rand(-mag, mag);
    this.shakeY = SG.util.rand(-mag, mag);
  }

  // -------- Background --------
  drawBackground(dt, parallaxX, parallaxY, reducedMotion) {
    const ctx = this.ctx, w = this.cssW, h = this.cssH;
    this.time += dt;
    const grad = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.42, Math.max(w, h) * 0.75);
    grad.addColorStop(0, '#0d1230');
    grad.addColorStop(0.55, '#080a20');
    grad.addColorStop(1, '#05060f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (const n of this.nebulae) {
      const pulse = reducedMotion ? 0 : Math.sin(this.time * 0.12 + n.phase) * 14;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r + pulse);
      g.addColorStop(0, n.hue + '55');
      g.addColorStop(1, n.hue + '00');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    for (let li = 0; li < this.stars.length; li++) {
      for (const s of this.stars[li]) {
        const tw = reducedMotion ? 0.8 : 0.6 + 0.4 * Math.sin(this.time * s.speed + s.phase);
        const ox = reducedMotion ? 0 : parallaxX * s.parallax;
        const oy = reducedMotion ? 0 : parallaxY * s.parallax;
        ctx.globalAlpha = tw;
        ctx.fillStyle = '#dfe8ff';
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.size, 0, SG.util.TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (!reducedMotion) {
      for (const d of this.dust) {
        d.y += d.speed * dt * 0.4;
        d.x += Math.sin(this.time * 0.3 + d.drift) * 0.15;
        if (d.y > h) { d.y = -5; d.x = Math.random() * w; }
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#9fb8ff';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, SG.util.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // -------- Planet & terrain --------
  drawPlanet(world, healthPct, reducedMotion) {
    const ctx = this.ctx;
    const c = this.toScreen(0, 0);
    const R = this.worldRadius * this.scale;
    const glowT = healthPct / 100;

    // outer atmosphere glow
    ctx.save();
    const atmo = ctx.createRadialGradient(c.x, c.y, R * 0.7, c.x, c.y, R * (1.28 + glowT * 0.15));
    atmo.addColorStop(0, SG.util.rgba(SG.COLORS.healthyCyan, 0.05 + glowT * 0.18));
    atmo.addColorStop(1, SG.util.rgba(SG.COLORS.healthyCyan, 0));
    ctx.fillStyle = atmo;
    ctx.beginPath(); ctx.arc(c.x, c.y, R * 1.3, 0, SG.util.TAU); ctx.fill();
    ctx.restore();

    // base disc
    ctx.save();
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, SG.util.TAU); ctx.clip();
    const base = ctx.createRadialGradient(c.x, c.y - R * 0.2, R * 0.1, c.x, c.y, R * 1.05);
    base.addColorStop(0, SG.util.lerp2color(SG.COLORS.spaceViolet, SG.COLORS.healthySoil, glowT));
    base.addColorStop(1, '#0c0a18');
    ctx.fillStyle = base;
    ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2);

    this.cellSizeScreen = world.cellSize * this.scale;
    for (const patch of world.patches) this._drawPatch(ctx, patch, world, reducedMotion);

    ctx.restore();

    // planet rim
    ctx.save();
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, SG.util.TAU);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = SG.util.rgba(SG.COLORS.healthyCyan, 0.15 + glowT * 0.55);
    ctx.shadowColor = SG.COLORS.healthyCyan;
    ctx.shadowBlur = 8 + glowT * 26;
    ctx.stroke();
    ctx.restore();

    // unlocked barrier ring
    if (world.unlockedRadius < world.radius - 2) {
      const pulse = reducedMotion ? 0.5 : 0.5 + 0.3 * Math.sin(this.time * 2.2);
      const br = world.unlockedRadius * this.scale;
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, br, 0, SG.util.TAU);
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = SG.util.rgba('#8fd9ff', 0.35 * pulse + 0.15);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  _patchColor(patch) {
    switch (patch.state) {
      case SG.TERRAIN.DEAD: return { fill: SG.COLORS.deadCharcoal, glow: null };
      case SG.TERRAIN.RESTORED: return { fill: SG.COLORS.healthySoil, glow: SG.COLORS.healthyTeal };
      case SG.TERRAIN.BLOOMING: return { fill: '#0f4a45', glow: SG.COLORS.healthyCyan };
      case SG.TERRAIN.SCORCHED: return { fill: SG.COLORS.scorched, glow: SG.COLORS.scorchedGlow };
      case SG.TERRAIN.CRYSTAL: return { fill: '#183a52', glow: SG.COLORS.crystal };
      default: return { fill: SG.COLORS.deadCharcoal, glow: null };
    }
  }

  _drawPatch(ctx, patch, world, reducedMotion) {
    const s = this.toScreen(patch.x, patch.y);
    const size = this.cellSizeScreen || (world.cellSize * this.scale);
    const half = size * 0.46 * patch.sizeJitter;
    const locked = !world.isUnlocked(patch);
    const col = this._patchColor(patch);

    ctx.save();
    if (locked) ctx.globalAlpha = 0.35;

    if (col.glow) {
      const pulse = reducedMotion ? 1 : (patch.state === SG.TERRAIN.SCORCHED ? 0.7 + 0.3 * Math.sin(this.time * 5 + patch.jitter) : 0.85 + 0.15 * Math.sin(this.time * 1.4 + patch.jitter));
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = size * 0.55 * pulse;
    }
    ctx.fillStyle = col.fill;
    const r = half * 0.35;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(s.x - half, s.y - half, half * 2, half * 2, r) : ctx.rect(s.x - half, s.y - half, half * 2, half * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (patch.state === SG.TERRAIN.DEAD || patch.state === SG.TERRAIN.SCORCHED) {
      ctx.strokeStyle = patch.state === SG.TERRAIN.SCORCHED ? 'rgba(255,120,60,0.35)' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - half * 0.5, s.y - half * 0.3);
      ctx.lineTo(s.x + half * 0.2, s.y + half * 0.4);
      ctx.moveTo(s.x - half * 0.1, s.y - half * 0.5);
      ctx.lineTo(s.x - half * 0.3, s.y + half * 0.2);
      ctx.stroke();
    }
    if (patch.state === SG.TERRAIN.CRYSTAL) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y - half * 0.2, half * 0.22, 0, SG.util.TAU); ctx.fill();
    }
    if (patch.restoreFx > 0) {
      ctx.globalAlpha = patch.restoreFx;
      ctx.strokeStyle = SG.COLORS.healthyCyan;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, half * (2.2 - patch.restoreFx * 1.2), 0, SG.util.TAU); ctx.stroke();
    }
    ctx.restore();

    if (patch.plant && patch.plant.alive) this._drawPlant(ctx, patch, s, size, reducedMotion);
  }

  _drawPlant(ctx, patch, s, cellSize, reducedMotion) {
    const pl = patch.plant;
    const cfg = SG.PLANT_TYPES[pl.type];
    const grow = SG.util.easeOutBack(pl.growth);
    const scale = SG.util.clamp(grow, 0.08, 1.15) * (cellSize / 30);
    const sway = reducedMotion ? 0 : Math.sin(this.time * 1.6 + pl.pulsePhase) * 0.06;

    ctx.save();
    ctx.translate(s.x, s.y);

    if (cfg.auraRadius && pl.growth > 0.4) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = cfg.color;
      ctx.beginPath(); ctx.arc(0, 0, cfg.auraRadius * this.scale, 0, SG.util.TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 10 * scale;
    ctx.fillStyle = pl.damagedFlash > 0 ? '#ff8080' : cfg.color;

    if (pl.type === 'glowgrass') {
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.rotate(sway + i * 0.28);
        ctx.beginPath();
        ctx.moveTo(i * 2.4 * scale, 0);
        ctx.quadraticCurveTo(i * 2.4 * scale + 2, -9 * scale, i * 1.2 * scale, -15 * scale);
        ctx.quadraticCurveTo(i * 2.4 * scale - 1, -8 * scale, i * 2.4 * scale, 0);
        ctx.fill();
        ctx.restore();
      }
    } else if (pl.type === 'starflower') {
      ctx.save(); ctx.rotate(sway);
      ctx.fillRect(-1.2 * scale, -16 * scale, 2.4 * scale, 16 * scale);
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(0, -18 * scale);
        ctx.rotate((i / 5) * SG.util.TAU);
        ctx.beginPath();
        ctx.ellipse(0, -6 * scale, 3.2 * scale, 6 * scale, 0, 0, SG.util.TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath(); ctx.arc(0, -18 * scale, 3 * scale, 0, SG.util.TAU); ctx.fill();
      ctx.restore();
    } else if (pl.type === 'luminatree') {
      ctx.save(); ctx.rotate(sway * 0.4);
      ctx.fillStyle = '#5a3d2a';
      ctx.fillRect(-2.2 * scale, -22 * scale, 4.4 * scale, 22 * scale);
      ctx.fillStyle = pl.damagedFlash > 0 ? '#ff8080' : cfg.color;
      [[-10, -30, 9], [10, -30, 9], [0, -40, 11], [0, -24, 8]].forEach(([dx, dy, r]) => {
        ctx.beginPath(); ctx.arc(dx * scale, dy * scale, r * scale, 0, SG.util.TAU); ctx.fill();
      });
      ctx.restore();
    } else if (pl.type === 'shieldbloom') {
      const pulse = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(this.time * 2.4);
      ctx.beginPath(); ctx.arc(0, -6 * scale, 8 * scale * pulse, 0, SG.util.TAU); ctx.fill();
      ctx.strokeStyle = cfg.color; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, -6 * scale, 13 * scale, 0, SG.util.TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // -------- Player --------
  drawPlayer(player, reducedMotion) {
    const ctx = this.ctx;
    for (const t of player.trail) {
      const s = this.toScreen(t.x, t.y);
      const a = (t.life / 0.28) * 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = SG.COLORS.healthyCyan;
      ctx.beginPath(); ctx.arc(s.x, s.y, player.radius * this.scale * 0.7, 0, SG.util.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const s = this.toScreen(player.x, player.y);
    const R = player.radius * this.scale;

    if (player.shieldReady) {
      const pulse = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(this.time * 3);
      ctx.strokeStyle = SG.util.rgba('#7ea8ff', 0.5 * pulse);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, R * 2.1, 0, SG.util.TAU); ctx.stroke();
    }
    if (player.shieldFlash > 0) {
      ctx.strokeStyle = SG.util.rgba('#ffffff', player.shieldFlash);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, R * 2.4, 0, SG.util.TAU); ctx.stroke();
    }

    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = SG.COLORS.healthyCyan;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, player.collectRadius * this.scale, 0, SG.util.TAU); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(player.facing + Math.PI / 2);

    ctx.shadowColor = player.damageFlash > 0 ? '#ff5050' : SG.COLORS.healthyCyan;
    ctx.shadowBlur = 14 + (player.dashTimer > 0 ? 12 : 0);
    ctx.fillStyle = player.damageFlash > 0 ? '#ff8080' : (player.hitInvuln > 0 ? 'rgba(200,240,255,0.6)' : '#eaffff');

    ctx.beginPath();
    ctx.moveTo(0, -R * 1.3);
    ctx.quadraticCurveTo(R * 1.1, -R * 0.2, R * 0.7, R);
    ctx.quadraticCurveTo(0, R * 0.6, -R * 0.7, R);
    ctx.quadraticCurveTo(-R * 1.1, -R * 0.2, 0, -R * 1.3);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = SG.COLORS.healthyTeal;
    ctx.beginPath(); ctx.arc(0, -R * 0.1, R * 0.32, 0, SG.util.TAU); ctx.fill();
    ctx.restore();
  }

  // -------- Fragments --------
  drawFragments(resourceManager) {
    const ctx = this.ctx;
    for (const f of resourceManager.fragments) {
      if (!f.landed) {
        const s0 = this.toScreen(f.startX, f.startY);
        const s1 = this.toScreen(f.x, f.y);
        const grad = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
        grad.addColorStop(0, SG.util.rgba(f.color, 0));
        grad.addColorStop(1, SG.util.rgba(f.color, 0.55));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
        ctx.shadowColor = f.color; ctx.shadowBlur = 12;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(s1.x, s1.y, f.baseRadius * 0.8, 0, SG.util.TAU); ctx.fill();
        ctx.shadowBlur = 0;
        continue;
      }
      const s = this.toScreen(f.x, f.y);
      const bob = Math.sin(f.bob) * 2;
      let alpha = 1;
      if (f.life < 3) alpha = 0.4 + 0.6 * (Math.sin(f.life * 10) * 0.5 + 0.5);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = f.magnetized ? 20 : 12;
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(s.x, s.y + bob, f.baseRadius, 0, SG.util.TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
  }

  // -------- Meteors --------
  drawMeteors(meteorManager, reducedMotion) {
    const ctx = this.ctx;
    for (const m of meteorManager.meteors) {
      if (m.state === 'warning') {
        const s = this.toScreen(m.x, m.y);
        const outerR = m.impactRadius * this.scale;
        const frac = SG.util.clamp(m.warnTimer / m.warnTime, 0, 1);
        const pulse = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(this.time * 8);
        ctx.save();
        ctx.strokeStyle = SG.util.rgba(m.color, 0.65 * pulse);
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(s.x, s.y, outerR, 0, SG.util.TAU); ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = SG.util.rgba(m.color, 0.14);
        ctx.beginPath(); ctx.arc(s.x, s.y, outerR * frac, 0, SG.util.TAU); ctx.fill();

        ctx.translate(s.x, s.y - outerR - 14);
        ctx.fillStyle = SG.util.rgba('#fff6e0', pulse);
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(7, 7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = m.color;
        ctx.fillRect(-1.3, -3, 2.6, 6);
        ctx.restore();
      } else if (m.state === 'falling') {
        const s0 = this.toScreen(m.startX, m.startY);
        const s1 = this.toScreen(m.drawX, m.drawY);
        const grad = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
        grad.addColorStop(0, SG.util.rgba(m.color, 0));
        grad.addColorStop(1, SG.util.rgba(m.color, 0.9));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
        ctx.shadowColor = m.color; ctx.shadowBlur = 18;
        ctx.fillStyle = '#fff6e0';
        ctx.beginPath(); ctx.arc(s1.x, s1.y, 5.5, 0, SG.util.TAU); ctx.fill();
        ctx.shadowBlur = 0;

        const gs = this.toScreen(m.x, m.y);
        const groundFrac = 1 - SG.util.clamp(m.fallTimer / m.fallTime, 0, 1);
        ctx.globalAlpha = 0.5 * groundFrac;
        ctx.fillStyle = m.color;
        ctx.beginPath(); ctx.ellipse(gs.x, gs.y, m.impactRadius * this.scale * 0.3 * groundFrac, m.impactRadius * this.scale * 0.12 * groundFrac, 0, 0, SG.util.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (m.state === 'impacted') {
        const s = this.toScreen(m.x, m.y);
        const t = 1 - (m.impactedFlash / 0.35);
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = '#fff6e0';
        ctx.beginPath(); ctx.arc(s.x, s.y, m.impactRadius * this.scale * 0.5 * (1 - t), 0, SG.util.TAU); ctx.fill();
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 3 * (1 - t);
        ctx.beginPath(); ctx.arc(s.x, s.y, m.impactRadius * this.scale * (0.4 + t * 0.9), 0, SG.util.TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawParticles(particles) { particles.draw(this.ctx); }
};

SG.util.lerp2color = function (hexA, hexB, t) {
  const a = SG.util.hexToRgb(hexA), b = SG.util.hexToRgb(hexB);
  const r = Math.round(SG.util.lerp(a.r, b.r, t));
  const g = Math.round(SG.util.lerp(a.g, b.g, t));
  const bl = Math.round(SG.util.lerp(a.b, b.b, t));
  return `rgb(${r},${g},${bl})`;
};
