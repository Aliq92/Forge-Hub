// DOM-based HUD and menu screens.
SG.UI = class {
  constructor(handlers) {
    this.h = handlers;
    this.save = SG.storage.load();
    this.difficulty = 'normal';
    this._cacheDom();
    this._buildPlantTray();
    this._bindEvents();
    this._applySettingsToInputs();
    this._refreshBestStats();
  }

  _cacheDom() {
    this.el = {};
    const ids = [
      'hud', 'bar-health', 'bar-energy', 'stat-fragments', 'stat-plants', 'stat-health', 'bar-planet',
      'phase-label', 'phase-timer', 'plant-tray', 'warning-banner', 'btn-pause', 'mobile-controls',
      'screen-title', 'screen-howto', 'screen-settings', 'screen-pause', 'screen-upgrade', 'screen-gameover', 'screen-victory',
      'btn-begin', 'btn-endless', 'btn-howto', 'btn-settings', 'btn-howto-close', 'btn-settings-close',
      'btn-resume', 'btn-pause-restart', 'btn-pause-settings', 'btn-pause-howto', 'btn-pause-title',
      'upgrade-cards', 'gameover-stats', 'btn-retry', 'btn-gameover-title',
      'victory-stats', 'btn-endless-continue', 'btn-victory-retry', 'btn-victory-title',
      'set-music', 'set-sfx', 'set-shake', 'set-particles', 'set-motion', 'set-fps',
      'best-stats', 'fps-counter',
    ];
    for (const id of ids) this.el[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
  }

  _buildPlantTray() {
    this.el.plantTray.innerHTML = '';
    this.plantSlotEls = {};
    Object.values(SG.PLANT_TYPES).forEach((cfg) => {
      const div = document.createElement('div');
      div.className = 'plant-slot';
      div.innerHTML = `<span class="key">${cfg.key}</span><span class="icon">${cfg.icon}</span><span class="cost">${cfg.cost}</span>`;
      div.title = `${cfg.name} — ${cfg.desc}`;
      div.addEventListener('click', () => this.h.onSelectPlantClick && this.h.onSelectPlantClick(cfg.id));
      this.el.plantTray.appendChild(div);
      this.plantSlotEls[cfg.id] = div;
    });
  }

  _bindEvents() {
    const h = this.h;
    this.el.btnBegin.addEventListener('click', () => h.begin(this.difficulty));
    this.el.btnEndless.addEventListener('click', () => h.beginEndless());
    this.el.btnHowto.addEventListener('click', () => this.show('howto'));
    this.el.btnSettings.addEventListener('click', () => this.show('settings'));
    this.el.btnHowtoClose.addEventListener('click', () => h.closeOverlay());
    this.el.btnSettingsClose.addEventListener('click', () => h.closeOverlay());
    this.el.btnResume.addEventListener('click', () => h.resume());
    this.el.btnPauseRestart.addEventListener('click', () => h.restart());
    this.el.btnPauseSettings.addEventListener('click', () => this.show('settings', true));
    this.el.btnPauseHowto.addEventListener('click', () => this.show('howto', true));
    this.el.btnPauseTitle.addEventListener('click', () => h.toTitle());
    this.el.btnRetry.addEventListener('click', () => h.restart());
    this.el.btnGameoverTitle.addEventListener('click', () => h.toTitle());
    this.el.btnEndlessContinue.addEventListener('click', () => h.continueEndless());
    this.el.btnVictoryRetry.addEventListener('click', () => h.restart());
    this.el.btnVictoryTitle.addEventListener('click', () => h.toTitle());
    this.el.btnPause.addEventListener('click', () => h.pauseToggle());

    document.querySelectorAll('.chip-btn[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn[data-diff]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.difficulty = btn.dataset.diff;
      });
    });

    this.el.setMusic.addEventListener('input', () => this._onSettingsChange());
    this.el.setSfx.addEventListener('input', () => this._onSettingsChange());
    this.el.setShake.addEventListener('change', () => this._onSettingsChange());
    this.el.setParticles.addEventListener('change', () => this._onSettingsChange());
    this.el.setMotion.addEventListener('change', () => this._onSettingsChange());
    this.el.setFps.addEventListener('change', () => this._onSettingsChange());
  }

  _applySettingsToInputs() {
    const s = this.save.settings;
    this.el.setMusic.value = s.musicVol;
    this.el.setSfx.value = s.sfxVol;
    this.el.setShake.checked = s.screenShake;
    this.el.setParticles.value = s.particles;
    this.el.setMotion.checked = s.reducedMotion;
    this.el.setFps.checked = s.showFPS;
    this.el.fpsCounter.classList.toggle('hidden', !s.showFPS);
  }

  _onSettingsChange() {
    const s = this.save.settings;
    s.musicVol = Number(this.el.setMusic.value);
    s.sfxVol = Number(this.el.setSfx.value);
    s.screenShake = this.el.setShake.checked;
    s.particles = this.el.setParticles.value;
    s.reducedMotion = this.el.setMotion.checked;
    s.showFPS = this.el.setFps.checked;
    SG.storage.save(this.save);
    this.el.fpsCounter.classList.toggle('hidden', !s.showFPS);
    this.h.onSettingsChanged && this.h.onSettingsChanged(s);
  }

  _refreshBestStats() {
    const st = this.save.stats;
    if (st.bestRestoration > 0) {
      this.el.bestStats.textContent = `Best Restoration: ${Math.round(st.bestRestoration)}%` +
        (st.victoryAchieved ? ` · Garden Restored${st.bestTimeVictory ? ' in ' + SG.util.formatTime(st.bestTimeVictory) : ''}` : '');
    } else {
      this.el.bestStats.textContent = '';
    }
    this.el.btnEndless.style.display = st.victoryAchieved ? 'block' : 'none';
  }

  saveStatsIfBest(restorationPct, victory, timeSec) {
    const st = this.save.stats;
    st.bestRestoration = Math.max(st.bestRestoration, restorationPct);
    if (victory) {
      st.victoryAchieved = true;
      if (!st.bestTimeVictory || timeSec < st.bestTimeVictory) st.bestTimeVictory = timeSec;
    }
    SG.storage.save(this.save);
    this._refreshBestStats();
  }

  show(name, fromPause) {
    ['title', 'howto', 'settings', 'pause', 'upgrade', 'gameover', 'victory'].forEach((n) => {
      this.el['screen' + n[0].toUpperCase() + n.slice(1)].classList.add('hidden');
    });
    this._returnToPause = !!fromPause;
    this.currentScreen = name || null;
    if (name) this.el['screen' + name[0].toUpperCase() + name.slice(1)].classList.remove('hidden');
  }

  hideAllScreens() { this.show(null); }

  setHudVisible(v) { this.el.hud.classList.toggle('hidden', !v); }
  setMobileControlsVisible(v) { this.el.mobileControls.classList.toggle('active', v); this.el.mobileControls.classList.toggle('hidden', !v); }

  updateHUD(s) {
    this.el.barHealth.style.width = SG.util.clamp((s.health / s.maxHealth) * 100, 0, 100) + '%';
    this.el.barEnergy.style.width = SG.util.clamp((s.energy / s.maxEnergy) * 100, 0, 100) + '%';
    this.el.statFragments.textContent = Math.floor(s.fragments);
    this.el.statPlants.textContent = s.plantsAlive;
    const hp = Math.floor(s.healthPct);
    this.el.statHealth.textContent = hp;
    this.el.barPlanet.style.width = hp + '%';

    this.el.phaseLabel.textContent = s.phaseLabel;
    this.el.phaseLabel.className = 'phase-label' + (s.phase === 'warning' ? ' warning' : s.phase === 'night' ? ' night' : '');
    this.el.phaseTimer.textContent = SG.util.formatTime(s.phaseTimer);

    if (s.warningText) {
      this.el.warningBanner.textContent = s.warningText;
      this.el.warningBanner.classList.remove('hidden');
    } else {
      this.el.warningBanner.classList.add('hidden');
    }

    Object.entries(this.plantSlotEls).forEach(([id, el]) => {
      const cfg = SG.PLANT_TYPES[id];
      const cost = Math.max(1, Math.round(cfg.cost * s.plantCostMul));
      el.querySelector('.cost').textContent = cost;
      el.classList.toggle('selected', s.selectedPlant === id);
      el.classList.toggle('unaffordable', s.fragments < cost);
    });

    if (s.showFPS) this.el.fpsCounter.textContent = Math.round(s.fps) + ' FPS';
  }

  showUpgradeChoices(choices, onPick) {
    this.el.upgradeCards.innerHTML = '';
    choices.forEach((u, i) => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `<span class="u-key">${i + 1}</span><div class="u-icon">${u.icon}</div><div class="u-name">${u.name}</div><div class="u-desc">${u.desc}</div>`;
      card.addEventListener('click', () => onPick(u.id));
      this.el.upgradeCards.appendChild(card);
    });
    this.show('upgrade');
  }

  _statsRows(pairs) {
    return pairs.map(([k, v]) => `<div class="k">${k}</div><div class="v">${v}</div>`).join('');
  }

  showGameOver(stats) {
    this.el.gameoverStats.innerHTML = this._statsRows([
      ['Restoration Reached', Math.floor(stats.healthPct) + '%'],
      ['Starfalls Survived', stats.cyclesCompleted],
      ['Fragments Collected', stats.fragmentsCollected],
      ['Plants Grown', stats.plantsGrown],
      ['Meteors Dodged', stats.meteorsDodged],
      ['Meteor Hits Taken', stats.meteorHits],
      ['Best Restoration', Math.floor(Math.max(stats.healthPct, this.save.stats.bestRestoration)) + '%'],
    ]);
    this.show('gameover');
  }

  showVictory(stats) {
    this.el.victoryStats.innerHTML = this._statsRows([
      ['Time to Restore', SG.util.formatTime(stats.timeSec)],
      ['Starfalls Survived', stats.cyclesCompleted],
      ['Fragments Collected', stats.fragmentsCollected],
      ['Plants Grown', stats.plantsGrown],
      ['Meteors Dodged', stats.meteorsDodged],
      ['Meteor Hits Taken', stats.meteorHits],
    ]);
    this.show('victory');
  }
};
