import { CONFIG } from './config.js';
import { clamp, lerp, TAU } from './utils.js';

export class Camera{
  constructor(){
    this.x = 0; this.y = 0; this.zoom = 0.85;
    this.targetZoom = 0.85;
  }
  follow(comet, dt, nearMassive, gate){
    const lookX = comet.vx * 0.28;
    const lookY = comet.vy * 0.28;
    let tx = comet.x + clamp(lookX, -CONFIG.CAMERA_LOOKAHEAD, CONFIG.CAMERA_LOOKAHEAD);
    let ty = comet.y + clamp(lookY, -CONFIG.CAMERA_LOOKAHEAD, CONFIG.CAMERA_LOOKAHEAD);
    // Subtle framing bias toward the gate once it's within reach, so the approach reads
    // as deliberate rather than the gate just scrolling into view.
    if(gate && !gate.activated){
      const dgx = gate.x - comet.x, dgy = gate.y - comet.y;
      const dg = Math.hypot(dgx, dgy);
      if(dg < 900 && dg > 1){
        const bias = clamp((900 - dg) / 900, 0, 1) * 0.3;
        tx += (dgx / dg) * bias * 140;
        ty += (dgy / dg) * bias * 140;
      }
    }
    const t = 1 - Math.exp(-CONFIG.CAMERA_LERP * dt);
    this.x = lerp(this.x, tx, t);
    this.y = lerp(this.y, ty, t);

    const speedT = clamp(comet.speed / 420, 0, 1);
    let wantZoom = lerp(CONFIG.ZOOM_MAX, CONFIG.ZOOM_MIN, speedT);
    if(nearMassive) wantZoom = Math.min(wantZoom, CONFIG.ZOOM_MIN + 0.12);
    this.targetZoom = wantZoom;
    this.zoom = lerp(this.zoom, this.targetZoom, 1 - Math.exp(-2.2 * dt));
  }
  worldToScreen(x, y, cw, ch){
    return { x: (x - this.x) * this.zoom + cw / 2, y: (y - this.y) * this.zoom + ch / 2 };
  }
}

function hash2(ix, iy, seed){
  let h = ix * 374761393 + iy * 668265263 + seed * 982451653;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 10000) / 10000;
}

export class Renderer{
  constructor(gameCanvas, fxCanvas){
    this.canvas = gameCanvas;
    this.fxCanvas = fxCanvas;
    this.ctx = gameCanvas.getContext('2d');
    this.fxCtx = fxCanvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.camera = new Camera();
    this.shake = 0;
    this.starSeed = Math.floor(Math.random() * 99999);
    this.nebulaSeed = Math.floor(Math.random() * 99999);
    this.resize();
  }

  resize(){
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    for(const c of [this.canvas, this.fxCanvas]){
      c.width = this.w * this.dpr; c.height = this.h * this.dpr;
      c.style.width = this.w + 'px'; c.style.height = this.h + 'px';
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fxCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  addShake(amount){ this.shake = Math.min(28, this.shake + amount); }

  worldToScreen(x, y){ return this.camera.worldToScreen(x, y, this.w, this.h); }

  clear(){
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.fxCtx.clearRect(0, 0, this.w, this.h);
  }

  beginFrame(dt, reducedMotion){
    this.clear();
    this.ctx.save();
    if(this.shake > 0.15 && !reducedMotion){
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      this.ctx.translate(sx, sy);
      this.shake *= 0.86;
    } else this.shake = 0;
  }
  endFrame(){ this.ctx.restore(); }

  drawBackground(nebulaTint){
    const ctx = this.ctx;
    ctx.fillStyle = '#04050d';
    ctx.fillRect(0, 0, this.w, this.h);

    // nebula blobs (parallax 0.02, fixed world positions via hash)
    for(let i = 0; i < 5; i++){
      const wx = (hash2(i, 1, this.nebulaSeed) - 0.5) * 6000;
      const wy = (hash2(i, 2, this.nebulaSeed) - 0.5) * 6000;
      const s = this.worldToScreen(wx * 0.03 + this.camera.x * 0.97, wy * 0.03 + this.camera.y * 0.97);
      const r = 340 + hash2(i, 3, this.nebulaSeed) * 260;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      const hueSets = [ 'rgba(120,90,200,', 'rgba(70,110,190,', 'rgba(150,80,140,' ];
      const c = hueSets[i % hueSets.length];
      grad.addColorStop(0, c + (0.05 + nebulaTint*0.02) + ')');
      grad.addColorStop(1, c + '0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    }

    for(const layer of CONFIG.STARFIELD_LAYERS){
      this._drawStarLayer(layer);
    }
  }

  _drawStarLayer(layer){
    const ctx = this.ctx;
    const tile = 700;
    const camX = this.camera.x * layer.parallax;
    const camY = this.camera.y * layer.parallax;
    const x0 = Math.floor((camX - this.w) / tile) - 1;
    const x1 = Math.floor((camX + this.w) / tile) + 1;
    const y0 = Math.floor((camY - this.h) / tile) - 1;
    const y1 = Math.floor((camY + this.h) / tile) + 1;
    const perTile = Math.max(3, Math.round(tile * tile * layer.density));
    ctx.save();
    for(let ty = y0; ty <= y1; ty++){
      for(let tx = x0; tx <= x1; tx++){
        for(let i = 0; i < perTile; i++){
          const hx = hash2(tx * 1000 + i, ty, this.starSeed + Math.round(layer.parallax*1000));
          const hy = hash2(tx, ty * 1000 + i, this.starSeed + Math.round(layer.parallax*1000) + 7);
          const wx = tx * tile + hx * tile;
          const wy = ty * tile + hy * tile;
          const sx = wx - camX + this.w/2;
          const sy = wy - camY + this.h/2;
          const tw = hash2(tx*7+i, ty*13+i, this.starSeed);
          const size = layer.size[0] + tw * (layer.size[1] - layer.size[0]);
          const tw2 = hash2(tx*3+i, ty*5+i, this.starSeed+99);
          const alpha = layer.alpha * (0.5 + tw2*0.5);
          ctx.fillStyle = `rgba(220,228,255,${alpha})`;
          ctx.fillRect(sx, sy, size, size);
        }
      }
    }
    ctx.restore();
  }

  drawOrbitLines(system, show){
    if(!show) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(140,160,255,0.10)';
    ctx.lineWidth = 1;
    const center = this.worldToScreen(system.star.x, system.star.y);
    for(const p of system.planets){
      ctx.beginPath();
      ctx.arc(center.x, center.y, p.orbitRadius * this.camera.zoom, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Gravity readability aid: faint rings at each body's meaningful influence radius.
  // 'off' draws nothing, 'low' is a single subtle ring, 'high' adds a tighter inner warning ring.
  drawGravityRings(system, level){
    if(!level || level === 'off') return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([4, 7]);

    const drawRing = (x, y, radius, alpha) => {
      const s = this.worldToScreen(x, y);
      const r = radius * this.camera.zoom;
      if(r < 4 || s.x < -r || s.x > this.w+r || s.y < -r || s.y > this.h+r) return;
      ctx.strokeStyle = `rgba(150,200,255,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke();
    };

    drawRing(system.star.x, system.star.y, system.star.heatRadius, 0.08);
    drawRing(system.star.x, system.star.y, system.star.dangerRadius, 0.14);
    for(const p of system.planets){
      drawRing(p.x, p.y, p.radius * CONFIG.ASSIST_INFLUENCE_MULT, 0.07);
      if(level === 'high') drawRing(p.x, p.y, p.radius * 2.1, 0.16);
    }
    ctx.restore();
  }

  // Brief expanding bloom used during the gate-entry cinematic.
  drawGateBloom(x, y, t01){
    const ctx = this.ctx;
    const s = this.worldToScreen(x, y);
    const r = (60 + t01 * 260) * this.camera.zoom;
    const alpha = (1 - t01) * 0.5;
    if(alpha <= 0.01) return;
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    glow.addColorStop(0, `rgba(220,250,255,${alpha})`);
    glow.addColorStop(1, 'rgba(220,250,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
  }

  drawStar(star, flare){
    const ctx = this.ctx;
    const s = this.worldToScreen(star.x, star.y);
    const r = star.radius * this.camera.zoom;
    if(s.x < -r*4 || s.x > this.w+r*4 || s.y < -r*4 || s.y > this.h+r*4) return;

    const pulse = 1 + Math.sin(performance.now()/900) * 0.03;
    const glowR = r * 6 * pulse;
    const glow = ctx.createRadialGradient(s.x, s.y, r*0.3, s.x, s.y, glowR);
    glow.addColorStop(0, hexA(star.colors.mid, 0.35));
    glow.addColorStop(0.4, hexA(star.colors.outer, 0.14));
    glow.addColorStop(1, hexA(star.colors.outer, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, glowR, 0, TAU); ctx.fill();

    const core = ctx.createRadialGradient(s.x - r*0.2, s.y - r*0.2, 0, s.x, s.y, r);
    core.addColorStop(0, star.colors.core);
    core.addColorStop(0.55, star.colors.mid);
    core.addColorStop(1, star.colors.outer);
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(s.x, s.y, r*pulse, 0, TAU); ctx.fill();

    if(flare && flare.state !== 'idle'){
      const a0 = flare.sectorAngle - flare.sectorWidth/2;
      const a1 = flare.sectorAngle + flare.sectorWidth/2;
      const reach = star.heatRadius * 1.6 * this.camera.zoom;
      ctx.save();
      ctx.globalAlpha = flare.state === 'warning' ? 0.18 + Math.sin(performance.now()/140)*0.1 : 0.32;
      const fg = ctx.createRadialGradient(s.x, s.y, r, s.x, s.y, reach);
      const col = flare.state === 'warning' ? '255,190,90' : '255,120,70';
      fg.addColorStop(0, `rgba(${col},0.55)`);
      fg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, reach, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawPlanet(p){
    const ctx = this.ctx;
    const s = this.worldToScreen(p.x, p.y);
    const r = p.radius * this.camera.zoom;
    if(s.x < -r*5 || s.x > this.w+r*5 || s.y < -r*5 || s.y > this.h+r*5) return;

    if(p.hasRing){
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(0.42);
      ctx.scale(1, 0.32);
      ctx.strokeStyle = hexA(p.rim, 0.45);
      ctx.lineWidth = Math.max(1, r*0.22);
      ctx.beginPath(); ctx.arc(0, 0, r*1.7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = hexA(p.rim, 0.2);
      ctx.lineWidth = Math.max(1, r*0.4);
      ctx.beginPath(); ctx.arc(0, 0, r*2.05, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    const glow = ctx.createRadialGradient(s.x, s.y, r*0.6, s.x, s.y, r*2.1);
    glow.addColorStop(0, hexA(p.color, 0.22));
    glow.addColorStop(1, hexA(p.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, r*2.1, 0, TAU); ctx.fill();

    const body = ctx.createRadialGradient(s.x - r*0.35, s.y - r*0.35, r*0.1, s.x, s.y, r);
    body.addColorStop(0, hexA(p.rim, 0.9));
    body.addColorStop(0.5, p.color);
    body.addColorStop(1, shade(p.color, -0.4));
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(p.rim, 0.5);
    ctx.lineWidth = Math.max(1, r*0.1);
    ctx.beginPath(); ctx.arc(s.x, s.y, r*0.96, -0.9, 0.5); ctx.stroke();
    ctx.restore();

    for(const m of p.moons){
      const ms = this.worldToScreen(m.x, m.y);
      const mr = Math.max(1.5, m.radius * this.camera.zoom);
      ctx.fillStyle = '#cfd6e6';
      ctx.beginPath(); ctx.arc(ms.x, ms.y, mr, 0, TAU); ctx.fill();
    }
  }

  drawAsteroidBelt(belt){
    const ctx = this.ctx;
    for(const a of belt.asteroids){
      const s = this.worldToScreen(a.x, a.y);
      const r = a.radius * this.camera.zoom;
      if(s.x < -30 || s.x > this.w+30 || s.y < -30 || s.y > this.h+30) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(a.rotation);
      ctx.fillStyle = '#8a8a94';
      ctx.beginPath();
      const n = 6;
      for(let i=0;i<n;i++){
        const ang = (i/n)*TAU;
        const rr = r * (0.75 + hash2(Math.floor(a.angle*1000)+i, i, 5)*0.5);
        const px = Math.cos(ang)*rr, py = Math.sin(ang)*rr;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGate(gate, pulseT){
    const ctx = this.ctx;
    const s = this.worldToScreen(gate.x, gate.y);
    const r = gate.radius * this.camera.zoom;
    if(s.x < -r*4 || s.x > this.w+r*4 || s.y < -r*4 || s.y > this.h+r*4) return;

    const pulse = 1 + Math.sin(pulseT*2.4)*0.08;
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r*3*pulse);
    glow.addColorStop(0, 'rgba(150,240,255,0.35)');
    glow.addColorStop(1, 'rgba(150,240,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, r*3*pulse, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(pulseT*0.3);
    for(let ring=0; ring<3; ring++){
      ctx.strokeStyle = `rgba(180,245,255,${0.5 - ring*0.14})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r*(0.7+ring*0.16)*pulse, ring*0.5, ring*0.5+TAU*0.78);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(220,255,255,0.9)';
    ctx.beginPath(); ctx.arc(s.x, s.y, r*0.18, 0, TAU); ctx.fill();
  }

  drawResource(r, RESOURCE_TYPES){
    const ctx = this.ctx;
    const s = this.worldToScreen(r.x, r.y);
    const def = RESOURCE_TYPES[r.type];
    const rad = def.radius * this.camera.zoom;
    if(s.x < -20 || s.x > this.w+20 || s.y < -20 || s.y > this.h+20) return;
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad*4);
    glow.addColorStop(0, `rgba(${def.color},0.5)`);
    glow.addColorStop(1, `rgba(${def.color},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(s.x, s.y, rad*4, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(s.x, s.y);
    const spin = performance.now()/500;
    if(r.type === 'STARDUST'){
      ctx.rotate(spin);
      drawDiamond(ctx, rad*1.6, def.glowColor);
    } else if(r.type === 'ANCIENT_CORE'){
      ctx.rotate(spin*0.6);
      drawStarShape(ctx, rad*1.4, def.glowColor);
    } else {
      ctx.fillStyle = def.glowColor;
      ctx.beginPath(); ctx.arc(0,0,rad,0,TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawTrajectory(pts, reducedMotion){
    if(!pts || pts.length < 2) return;
    const ctx = this.ctx;
    ctx.save();
    const n = pts.length;
    const step = reducedMotion ? 3 : 1;
    for(let i=0; i<n; i+=step){
      const p = pts[i];
      const s = this.worldToScreen(p.x, p.y);
      if(s.x < -20 || s.x > this.w+20 || s.y < -20 || s.y > this.h+20) continue;
      const t = i / n;
      const alpha = (1 - t) * 0.55;
      const size = p.danger ? 2.4 : 1.6;
      ctx.fillStyle = p.danger ? `rgba(255,120,90,${alpha})` : `rgba(150,225,255,${alpha})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, TAU); ctx.fill();
    }
    if(pts.collided){
      const last = pts[pts.length-1];
      const s = this.worldToScreen(last.x, last.y);
      ctx.strokeStyle = 'rgba(255,90,70,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x-6,s.y-6); ctx.lineTo(s.x+6,s.y+6);
      ctx.moveTo(s.x+6,s.y-6); ctx.lineTo(s.x-6,s.y+6); ctx.stroke();
    }
    ctx.restore();
  }

  drawAimLine(comet, dx, dy, strengthFrac){
    const ctx = this.ctx;
    const s = this.worldToScreen(comet.x, comet.y);
    const len = 40 + strengthFrac * 90;
    const n = Math.hypot(dx,dy) || 1;
    const ex = s.x + (dx/n)*len, ey = s.y + (dy/n)*len;
    ctx.save();
    ctx.strokeStyle = `rgba(180,240,255,${0.35 + strengthFrac*0.5})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(180,240,255,${0.6 + strengthFrac*0.4})`;
    ctx.beginPath(); ctx.arc(ex,ey,4+strengthFrac*4,0,TAU); ctx.fill();
    ctx.restore();
  }

  drawComet(comet){
    const ctx = this.ctx;
    const s = this.worldToScreen(comet.x, comet.y);
    const r = Math.max(2.2, comet.radius * this.camera.zoom);
    const heatT = clamp(comet.heat / 100, 0, 1);
    const coreColor = heatT > 0.75 ? '#fff0e0' : heatT > 0.5 ? '#ffe8d8' : '#eafcff';
    const midColor = heatT > 0.75 ? '#ffb27a' : heatT > 0.5 ? '#bfe9ff' : '#8fe9ff';

    // halo
    const haloR = r * (3.2 + comet.tailIntensity*1.4);
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloR);
    halo.addColorStop(0, hexA(midColor, 0.4));
    halo.addColorStop(1, hexA(midColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(s.x, s.y, haloR, 0, TAU); ctx.fill();

    if(comet.impactFlash > 0){
      ctx.save();
      ctx.globalAlpha = comet.impactFlash * 0.7;
      ctx.fillStyle = '#ff6a55';
      ctx.beginPath(); ctx.arc(s.x, s.y, r*3, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // nucleus — flickers subtly once the comet is CRACKING/CRITICAL, communicating
    // fragility without a second HUD meter.
    const stability = comet.stabilityState;
    const flicker = stability === 'CRITICAL' ? 0.72 + Math.sin(performance.now()/55)*0.28
                  : stability === 'CRACKING' ? 0.88 + Math.sin(performance.now()/90)*0.12
                  : 1;
    ctx.save();
    ctx.globalAlpha = clamp(flicker, 0.3, 1);
    const core = ctx.createRadialGradient(s.x - r*0.3, s.y - r*0.3, 0, s.x, s.y, r);
    core.addColorStop(0, coreColor);
    core.addColorStop(0.6, midColor);
    core.addColorStop(1, hexA(midColor, 0.3));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    ctx.restore();

    if(comet.invulnTimer > 0){
      ctx.save();
      ctx.strokeStyle = `rgba(180,240,255,${0.4 + Math.sin(performance.now()/100)*0.2})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, r*1.8, 0, TAU); ctx.stroke();
      ctx.restore();
    } else if(stability === 'CRITICAL'){
      ctx.save();
      ctx.strokeStyle = `rgba(255,90,70,${0.3 + Math.sin(performance.now()/180)*0.22})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, r*2.3, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  applyDamageFlash(intensity){
    if(intensity <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(255,70,60,${intensity*0.28})`;
    ctx.fillRect(0,0,this.w,this.h);
    ctx.restore();
  }

  applyHeatVignette(heat01){
    if(heat01 <= 0.35) return;
    const ctx = this.ctx;
    const t = clamp((heat01-0.35)/0.65, 0, 1);
    const grad = ctx.createRadialGradient(this.w/2,this.h/2, Math.min(this.w,this.h)*0.3, this.w/2,this.h/2, Math.max(this.w,this.h)*0.72);
    grad.addColorStop(0, 'rgba(255,80,40,0)');
    grad.addColorStop(1, `rgba(255,60,30,${t*0.35})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,this.w,this.h);
    ctx.restore();
  }
}

function drawDiamond(ctx, r, color){
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0,-r); ctx.lineTo(r*0.65,0); ctx.lineTo(0,r); ctx.lineTo(-r*0.65,0);
  ctx.closePath(); ctx.fill();
}
function drawStarShape(ctx, r, color){
  ctx.fillStyle = color;
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const ang = (i/10)*TAU - Math.PI/2;
    const rr = i%2===0 ? r : r*0.42;
    const px = Math.cos(ang)*rr, py = Math.sin(ang)*rr;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.fill();
}

function hexA(hex, alpha){
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}
function shade(hex, amt){
  const c = hexToRgb(hex);
  const f = v => clamp(Math.round(v + v*amt), 0, 255);
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}
function hexToRgb(hex){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const num = parseInt(hex,16);
  return { r:(num>>16)&255, g:(num>>8)&255, b:num&255 };
}
