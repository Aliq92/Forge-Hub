// ---------------- UI: HUD, minimap, menus, toasts, warnings ----------------
class UIManager {
  constructor() {
    const id = (x) => document.getElementById(x);
    this.hud = id('hud');
    this.hullFill = id('hullFill');
    this.fuelFill = id('fuelFill');
    this.energyFill = id('energyFill');
    this.shieldFill = id('shieldFill');
    this.shieldRow = id('shieldRow');
    this.statDistance = id('statDistance');
    this.statBest = id('statBest');
    this.statSpeed = id('statSpeed');
    this.statSalvage = id('statSalvage');
    this.sectorBanner = id('sectorBanner');
    this.warningsEl = id('warnings');
    this.toastsEl = id('toasts');
    this.interactHint = id('interactHint');

    this.screens = {
      title: id('titleScreen'),
      tutorial: id('tutorialScreen'),
      pause: id('pauseScreen'),
      controls: id('controlsScreen'),
      settings: id('settingsScreen'),
      upgrade: id('upgradeScreen'),
      station: id('stationScreen'),
      gameover: id('gameOverScreen'),
    };

    this.titleBest = id('titleBest');
    this.upgradeChoices = id('upgradeChoices');

    this.stationSalvage = id('stationSalvage');
    this.btnStationRepair = id('btnStationRepair');
    this.stationRepairDesc = id('stationRepairDesc');
    this.btnStationRefuel = id('btnStationRefuel');
    this.stationRefuelDesc = id('stationRefuelDesc');
    this.btnStationUpgrade = id('btnStationUpgrade');
    this.stationUpgradeDesc = id('stationUpgradeDesc');

    this.goDistance = id('goDistance');
    this.goSectors = id('goSectors');
    this.goSalvage = id('goSalvage');
    this.goHits = id('goHits');
    this.goResources = id('goResources');
    this.goUpgrades = id('goUpgrades');
    this.goBest = id('goBest');
    this.gameOverTitle = id('gameOverTitle');

    this.touchControls = id('touchControls');
    this.fpsCounter = id('fpsCounter');

    this.minimapCanvas = id('minimapCanvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this._resizeMinimap();

    this._sectorBannerTimer = null;
    this._lastSector = null;
    this._warningState = {};
  }

  _resizeMinimap() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = this.minimapCanvas.clientWidth || 150;
    this.minimapCanvas.width = size * dpr;
    this.minimapCanvas.height = size * dpr;
    this.minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._minimapSize = size;
  }

  showHud(show) { this.hud.classList.toggle('hidden', !show); }

  hideAllScreens() { Object.values(this.screens).forEach((s) => s.classList.add('hidden')); }
  showScreen(name) { this.hideAllScreens(); if (this.screens[name]) this.screens[name].classList.remove('hidden'); }

  updateHUD(player, stats) {
    this.hullFill.style.width = clamp((player.hull / player.maxHull) * 100, 0, 100) + '%';
    this.fuelFill.style.width = clamp((player.fuel / player.maxFuel) * 100, 0, 100) + '%';
    this.energyFill.style.width = clamp((player.energy / player.maxEnergy) * 100, 0, 100) + '%';

    this.hullFill.style.background = player.hull / player.maxHull < 0.25 ? 'var(--accent-danger)' : '';
    this.fuelFill.style.background = player.fuel / player.maxFuel < 0.15 ? 'var(--accent-danger)' : '';

    if (player.maxShield > 0) {
      this.shieldRow.classList.remove('hidden');
      this.shieldFill.style.width = clamp((player.shieldCharge / player.maxShield) * 100, 0, 100) + '%';
    } else {
      this.shieldRow.classList.add('hidden');
    }

    this.statDistance.textContent = pxToKm(stats.distancePx).toFixed(2) + ' km';
    this.statBest.textContent = stats.bestKm.toFixed(2) + ' km';
    this.statSpeed.textContent = Math.round(player.speed) + ' m/s';
    this.statSalvage.textContent = Math.floor(player.salvage) + ' / ' + Math.floor(player.maxCargo);
  }

  setSector(name) {
    if (name === this._lastSector) return;
    this._lastSector = name;
    this.sectorBanner.textContent = name;
    this.sectorBanner.classList.add('show');
    clearTimeout(this._sectorBannerTimer);
    this._sectorBannerTimer = setTimeout(() => this.sectorBanner.classList.remove('show'), 3400);
  }

  updateWarnings(list) {
    this.warningsEl.innerHTML = '';
    for (const w of list) {
      const chip = document.createElement('div');
      chip.className = 'warning-chip' + (w.level === 'mid' ? ' warn-mid' : '');
      chip.textContent = w.text;
      this.warningsEl.appendChild(chip);
    }
  }

  toast(title, msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${title}</b>${msg ? ' — ' + msg : ''}`;
    this.toastsEl.appendChild(el);
    setTimeout(() => el.remove(), 3200);
    while (this.toastsEl.children.length > 3) this.toastsEl.removeChild(this.toastsEl.firstChild);
  }

  setInteractHint(show, text) {
    this.interactHint.classList.toggle('hidden', !show);
    if (text) this.interactHint.innerHTML = text;
  }

  showUpgradeChoices(choices, onPick) {
    this.upgradeChoices.innerHTML = '';
    for (const c of choices) {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${c.name}, level ${c.level} to ${c.level + 1}, ${c.desc}`);
      card.innerHTML = `<div class="icon">${c.icon}</div><div class="name">${c.name}</div><div class="lvl">LV ${c.level} → ${c.level + 1}</div><div class="desc">${c.desc}</div>`;
      card.addEventListener('click', () => onPick(c.key));
      card.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onPick(c.key); } });
      this.upgradeChoices.appendChild(card);
    }
    this.showScreen('upgrade');
  }

  setStationInfo(player, repairCost, refuelCost, upgradeCost) {
    this.stationSalvage.textContent = Math.floor(player.salvage);
    const fullHull = player.hull >= player.maxHull;
    const fullFuel = player.fuel >= player.maxFuel;
    this.stationRepairDesc.textContent = fullHull ? 'Hull already full' : `Restore hull — ${repairCost} salvage`;
    this.btnStationRepair.disabled = fullHull || player.salvage < repairCost;
    this.stationRefuelDesc.textContent = fullFuel ? 'Fuel already full' : `Restore fuel — ${refuelCost} salvage`;
    this.btnStationRefuel.disabled = fullFuel || player.salvage < refuelCost;
    this.stationUpgradeDesc.textContent = `Spend salvage on a ship upgrade — ${upgradeCost} salvage`;
    this.btnStationUpgrade.disabled = player.salvage < upgradeCost;
  }

  setGameOverStats(s) {
    this.goDistance.textContent = pxToKm(s.distancePx).toFixed(2) + ' km';
    this.goSectors.textContent = s.sectorsSurvived;
    this.goSalvage.textContent = Math.floor(s.salvageCollectedTotal);
    this.goHits.textContent = s.asteroidsHit;
    this.goResources.textContent = s.resourcesCollected;
    this.goUpgrades.textContent = s.upgradesAcquired;
    this.goBest.textContent = s.bestKm.toFixed(2) + ' km';
    this.gameOverTitle.textContent = s.title || 'SHIP DESTROYED';
  }

  setFps(fps) { this.fpsCounter.textContent = Math.round(fps) + ' FPS'; }
  showFpsCounter(show) { this.fpsCounter.classList.toggle('hidden', !show); }

  showTouchControls(show) { this.touchControls.classList.toggle('enabled', show); this.touchControls.classList.toggle('hidden', !show); }

  syncSettingsUI(s) {
    document.getElementById('musicVolume').value = s.musicVolume;
    document.getElementById('soundVolume').value = s.soundVolume;
    document.getElementById('screenShake').checked = s.screenShake;
    document.getElementById('particleDensity').value = s.particleDensity;
    document.getElementById('showFps').checked = s.showFps;
    document.getElementById('reducedMotion').checked = s.reducedMotion;
  }

  drawMinimap(player, world, sectorInfo, insideIonCloud, beacons) {
    const ctx = this.minimapCtx;
    const size = this._minimapSize;
    const cx = size / 2, cy = size / 2;
    const range = player.scannerRange * (insideIonCloud ? 0.55 : 1);
    const scale = (size / 2 - 8) / range;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(5,8,16,0.4)';
    ctx.fillRect(0, 0, size, size);

    // range rings
    ctx.strokeStyle = 'rgba(100,224,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, (size / 2 - 8) * (i / 3), 0, TAU); ctx.stroke();
    }

    const jitter = insideIonCloud ? 4 : 0;
    const nearby = world.queryNearby(player.x, player.y, range);

    const plot = (x, y, color, r) => {
      const dx = (x - player.x) * scale + (jitter ? (Math.random() - 0.5) * jitter : 0);
      const dy = (y - player.y) * scale + (jitter ? (Math.random() - 0.5) * jitter : 0);
      const d = Math.hypot(dx, dy);
      if (d > size / 2 - 8) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, TAU);
      ctx.fill();
    };

    for (const a of nearby.asteroids) plot(a.x, a.y, 'rgba(180,180,190,0.85)', a.sizeClass === 'large' ? 2.6 : 1.7);
    for (const r of nearby.resources) plot(r.x, r.y, `rgb(${r.color})`, 2.2);
    for (const hz of nearby.hazards) plot(hz.x, hz.y, hz.type === 'mine' ? 'rgba(255,70,70,0.95)' : hz.type === 'ioncloud' ? 'rgba(160,110,255,0.7)' : 'rgba(255,140,60,0.9)', 2.2);
    for (const s of nearby.stations) plot(s.x, s.y, 'rgba(100,224,255,1)', 3.2);
    for (const g of nearby.gravityWells) plot(g.x, g.y, 'rgba(150,90,220,1)', 3);
    for (const b of beacons || []) plot(b.x, b.y, `rgb(${b.color})`, 3);

    // player marker (always center, rotated to facing)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#e7f3fb';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.strokeStyle = insideIonCloud ? 'rgba(160,110,255,0.6)' : 'rgba(100,224,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, size / 2 - 1, 0, TAU); ctx.stroke();
  }
}
