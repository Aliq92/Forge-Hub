// All DOM-based UI: title, HUD, pause, settings, upgrade choice, victory,
// game over, minimap and compass, toasts.
import { COLORS, TILE, TERRAIN, ACHIEVEMENTS, SHRINE_COUNT } from './config.js';
import { clamp, dist, mulberry32 } from './utils.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = {};
    document.querySelectorAll('.screen').forEach(el => { this.screens[el.id] = el; });
    this.hud = document.getElementById('hud');
    this.screenStack = [];
    this._bindButtons();
    this._bindSettingsInputs();
    this._initTitleBg();
    this.minimapCtx = document.getElementById('minimap-canvas').getContext('2d');
    this.lastToast = 0;
  }

  _bindButtons() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this._handleAction(btn.dataset.action));
    });
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.game.startJourney(btn.dataset.mode));
    });
  }

  _handleAction(action) {
    const g = this.game;
    switch (action) {
      case 'begin': this.show('screen-modes'); break;
      case 'howto': this.show('screen-howto', true); break;
      case 'settings': this.show('screen-settings', true); break;
      case 'pause-settings': this.show('screen-settings', true); break;
      case 'pause-howto': this.show('screen-howto', true); break;
      case 'modes': this.show('screen-modes'); break;
      case 'back-title': this.show('screen-title'); break;
      case 'back-prev': this.showPrevious(); break;
      case 'resume': g.resume(); break;
      case 'restart': g.restartJourney(); break;
      case 'title': g.returnToTitle(); break;
      case 'continue-exploring': g.continueExploring(); break;
      case 'retry': g.restartJourney(); break;
    }
  }

  _bindSettingsInputs() {
    const s = this.game.settings;
    const music = document.getElementById('set-music');
    const sound = document.getElementById('set-sound');
    const fog = document.getElementById('set-fog');
    const particles = document.getElementById('set-particles');
    const shake = document.getElementById('set-shake');
    const reduced = document.getElementById('set-reduced');
    const fps = document.getElementById('set-fps');
    const flicker = document.getElementById('set-flicker');

    music.value = s.musicVolume; sound.value = s.soundVolume;
    fog.value = s.fogDensity; particles.value = s.particleDensity;
    shake.checked = s.screenShake; reduced.checked = s.reducedMotion;
    fps.checked = s.showFPS; flicker.checked = s.lanternFlicker;

    music.addEventListener('input', () => this.game.updateSetting('musicVolume', parseFloat(music.value)));
    sound.addEventListener('input', () => this.game.updateSetting('soundVolume', parseFloat(sound.value)));
    fog.addEventListener('input', () => this.game.updateSetting('fogDensity', parseFloat(fog.value)));
    particles.addEventListener('input', () => this.game.updateSetting('particleDensity', parseFloat(particles.value)));
    shake.addEventListener('change', () => this.game.updateSetting('screenShake', shake.checked));
    reduced.addEventListener('change', () => this.game.updateSetting('reducedMotion', reduced.checked));
    fps.addEventListener('change', () => this.game.updateSetting('showFPS', fps.checked));
    flicker.addEventListener('change', () => this.game.updateSetting('lanternFlicker', flicker.checked));
  }

  show(id, trackPrev = false) {
    if (trackPrev) {
      const current = Object.values(this.screens).find(s => !s.classList.contains('hidden'));
      if (current) this.screenStack.push(current.id);
    } else {
      this.screenStack = [];
    }
    for (const key in this.screens) this.screens[key].classList.add('hidden');
    this.screens[id].classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showPrevious() {
    const prev = this.screenStack.pop() || 'screen-title';
    for (const key in this.screens) this.screens[key].classList.add('hidden');
    this.screens[prev].classList.remove('hidden');
  }

  showHUD() {
    for (const key in this.screens) this.screens[key].classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  setBestJourney(progress) {
    const el = document.getElementById('best-journey');
    if (!progress || progress.bestShrines === 0) { el.textContent = ''; return; }
    const time = progress.bestTimeSec ? ` · ${Math.floor(progress.bestTimeSec / 60)}m` : '';
    el.textContent = `Best Journey: ${progress.bestShrines}/${SHRINE_COUNT} shrines${time}${progress.victories ? ' · Vale Restored' : ''}`;
  }

  // ---------- HUD ----------
  updateHUD(player, shrines, world, compassTarget, objectiveText) {
    const heartsEl = document.getElementById('health-hearts');
    if (heartsEl.childElementCount !== player.maxHealth) {
      heartsEl.innerHTML = '';
      for (let i = 0; i < player.maxHealth; i++) {
        const h = document.createElement('div');
        h.className = 'heart';
        heartsEl.appendChild(h);
      }
    }
    [...heartsEl.children].forEach((h, i) => {
      h.innerHTML = heartSVG(i < player.health);
    });

    const frac = player.lantern.energy / player.lantern.maxEnergy;
    const fill = document.getElementById('lantern-bar-fill');
    fill.style.width = `${clamp(frac * 100, 0, 100)}%`;
    fill.classList.toggle('low', player.lantern.lowEnergy);

    document.getElementById('firefly-count').textContent = this.game.stats.fireflies;

    const flareFill = document.getElementById('flare-bar-fill');
    const flareFrac = 1 - player.lantern.flareCooldown / player.lantern.flareCooldownMax;
    flareFill.style.width = `${clamp(flareFrac * 100, 0, 100)}%`;

    document.getElementById('low-energy-warning').classList.toggle('hidden', !player.lantern.lowEnergy);
    document.getElementById('objective-text').textContent = objectiveText;

    this._drawMinimap(player, shrines, world);
    this._updateCompass(player, compassTarget);
  }

  setInteractPrompt(visible, text) {
    const el = document.getElementById('prompt-interact');
    el.classList.toggle('hidden', !visible);
    if (visible && text) el.innerHTML = text;
  }

  _updateCompass(player, target) {
    const needle = document.getElementById('compass-needle');
    if (!target) { needle.style.opacity = 0.15; return; }
    needle.style.opacity = 1;
    const ang = Math.atan2(target.y - player.y, target.x - player.x) + Math.PI / 2;
    needle.style.transform = `rotate(${ang}rad)`;
  }

  _drawMinimap(player, shrines, world) {
    const ctx = this.minimapCtx;
    const size = 176, cx = size / 2, cy = size / 2;
    const worldWindow = 780; // world units visible radius
    const scale = (size / 2) / worldWindow;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(5,6,12,0.9)';
    ctx.fillRect(0, 0, size, size);

    const tMin = Math.max(0, Math.floor((player.x - worldWindow) / TILE));
    const tMax = Math.min(world.w - 1, Math.ceil((player.x + worldWindow) / TILE));
    const tyMin = Math.max(0, Math.floor((player.y - worldWindow) / TILE));
    const tyMax = Math.min(world.h - 1, Math.ceil((player.y + worldWindow) / TILE));

    for (let ty = tyMin; ty <= tyMax; ty += 1) {
      for (let tx = tMin; tx <= tMax; tx += 1) {
        if (!world.isExplored(tx, ty)) continue;
        const wx = tx * TILE, wy = ty * TILE;
        const mx = cx + (wx - player.x) * scale;
        const my = cy + (wy - player.y) * scale;
        const terrain = world.overlay[world.idx(tx, ty)] || world.biome[world.idx(tx, ty)];
        ctx.fillStyle = MINIMAP_COLOR[terrain] || '#333';
        ctx.fillRect(mx, my, 2.2, 2.2);
      }
    }

    for (const s of shrines.shrines) {
      if (!world.isExplored(...tileOf(world, s.x, s.y))) continue;
      drawDot(ctx, cx + (s.x - player.x) * scale, cy + (s.y - player.y) * scale, s.activated ? COLORS.lantern.gold : '#9a93ad', 3.4);
    }
    if (shrines.activatedCount >= SHRINE_COUNT || shrines.heart.activated) {
      const h = shrines.heart;
      drawDot(ctx, cx + (h.x - player.x) * scale, cy + (h.y - player.y) * scale, COLORS.magic.violet, 4.2);
    }
    for (const lt of world.objects.lumenTrees) {
      if (!lt.discovered) continue;
      drawDot(ctx, cx + (lt.x - player.x) * scale, cy + (lt.y - player.y) * scale, COLORS.magic.paleBlue, 2.4);
    }

    drawDot(ctx, cx, cy, '#ffffff', 3.2);
    ctx.restore();
  }

  // ---------- Upgrade choice ----------
  showUpgradeChoice(title, options, onPick) {
    document.getElementById('upgrade-title').textContent = title;
    const wrap = document.getElementById('upgrade-cards');
    wrap.innerHTML = '';
    for (const opt of options) {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `<div class="upgrade-card-name">${opt.name}</div><div class="upgrade-card-desc">${opt.desc}</div>`;
      card.addEventListener('click', () => onPick(opt));
      wrap.appendChild(card);
    }
    this.show('screen-upgrade');
  }

  // ---------- Victory / Game over ----------
  showVictory(stats) {
    document.getElementById('victory-stats').innerHTML = statsHTML(stats);
    this.show('screen-victory');
  }
  showGameOver(stats) {
    document.getElementById('gameover-stats').innerHTML = statsHTML(stats);
    this.show('screen-gameover');
  }

  toast(text) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  achievementToast(id) {
    const a = ACHIEVEMENTS[id];
    if (a) this.toast(`Achievement — ${a.name}`);
  }

  // ---------- Title background ----------
  _initTitleBg() {
    const canvas = document.getElementById('title-bg');
    const ctx = canvas.getContext('2d');
    const rng = mulberry32(99);
    let fireflies = [];
    let trees = [];
    let raf = null;
    let running = false;

    const resize = () => {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      trees = [];
      for (let i = 0; i < 9; i++) {
        trees.push({ x: rng() * canvas.width, w: 30 + rng() * 60, h: 140 + rng() * 220 });
      }
      if (fireflies.length === 0) {
        for (let i = 0; i < 26; i++) {
          fireflies.push({ x: rng() * canvas.width, y: rng() * canvas.height, phase: rng() * 10, spd: 0.3 + rng() * 0.6 });
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (t) => {
      const w = canvas.width, h = canvas.height;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#141026'); grad.addColorStop(0.6, '#0a0916'); grad.addColorStop(1, '#050408');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (const tr of trees) {
        ctx.beginPath();
        ctx.moveTo(tr.x - tr.w / 2, h);
        ctx.quadraticCurveTo(tr.x, h - tr.h, tr.x, h - tr.h * 1.05);
        ctx.quadraticCurveTo(tr.x, h - tr.h, tr.x + tr.w / 2, h);
        ctx.fill();
      }

      // lantern glow, gently pulsing, near lower-center
      const lx = w * 0.5, ly = h * 0.72;
      const pulse = 0.75 + 0.25 * Math.sin(t * 0.0016);
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 180 * pulse);
      glow.addColorStop(0, 'rgba(255,210,140,0.35)');
      glow.addColorStop(0.5, 'rgba(255,150,80,0.12)');
      glow.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly, 180 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffdc9a';
      ctx.shadowColor = '#ffb457'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      for (const f of fireflies) {
        f.y += Math.sin(t * 0.001 * f.spd + f.phase) * 0.15;
        f.x += Math.cos(t * 0.0007 * f.spd + f.phase) * 0.1;
        const a = 0.4 + 0.5 * Math.sin(t * 0.003 + f.phase);
        ctx.fillStyle = `rgba(255,220,160,${a})`;
        ctx.shadowColor = '#ffd98a'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (running) raf = requestAnimationFrame(draw);
    };

    this.startTitleBg = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    this.stopTitleBg = () => { running = false; if (raf) cancelAnimationFrame(raf); };
    this.startTitleBg();
  }
}

function heartSVG(full) {
  const color = full ? '#ff5c6a' : 'rgba(255,255,255,0.15)';
  return `<svg viewBox="0 0 20 18" width="20" height="18"><path d="M10 17 C4 12 0 8.5 0 4.8 C0 2 2.2 0 4.8 0 C6.8 0 8.6 1.2 10 3.2 C11.4 1.2 13.2 0 15.2 0 C17.8 0 20 2 20 4.8 C20 8.5 16 12 10 17 Z" fill="${color}"/></svg>`;
}

function statsHTML(stats) {
  const rows = [
    ['Distance Explored', `${Math.round(stats.distance)} m`],
    ['Shrines Activated', `${stats.shrinesActivated}/${SHRINE_COUNT}`],
    ['Fireflies Collected', stats.fireflies],
    ['Hidden Paths Found', stats.hiddenPaths],
    ['Shadow Encounters', stats.encounters],
    ['Lantern Flares Used', stats.flares],
    ['Time in the Vale', formatTime(stats.timeSec)]
  ];
  return rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><span class="stat-val">${v}</span></div>`).join('');
}

function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawDot(ctx, x, y, color, r) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function tileOf(world, x, y) { const t = world.worldToTile(x, y); return [t.tx, t.ty]; }

const MINIMAP_COLOR = {
  [TERRAIN.PATH]: '#a08a5f', [TERRAIN.STONE]: '#8b8880', [TERRAIN.BRIDGE]: '#8a7654',
  [TERRAIN.GRASS]: '#3f5d3d', [TERRAIN.MEADOW]: '#527049', [TERRAIN.TALLGRASS]: '#3d5a39',
  [TERRAIN.WATER]: '#2e5a86', [TERRAIN.DEEPWATER]: '#1c3e66', [TERRAIN.MUD]: '#4a3f2e',
  [TERRAIN.SHADOWGROUND]: '#2c2540', [TERRAIN.RUINS]: '#6a6474', [TERRAIN.WALL]: '#0a0a10',
  [TERRAIN.CAVE]: '#332e40'
};
