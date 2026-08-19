import { CONFIG } from './config.js';
import { clamp, formatNumber, formatDistance } from './utils.js';
import { UPGRADE_META, describeUpgrade } from './upgrades.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

export class UI{
  constructor(){
    this.screens = {};
    $$('.screen').forEach(el => this.screens[el.id] = el);
    this.hud = $('#hud');
    this.pauseBtn = $('#pause-btn');
    this.cinematicBtn = $('#cinematic-btn');
    this.barIce = $('#bar-ice');
    this.barHeat = $('#bar-heat');
    this.barEnergy = $('#bar-energy');
    this.heatLabel = $('#heat-label');
    this.statStardust = $('#stat-stardust');
    this.statSystem = $('#stat-system');
    this.statSpeed = $('#stat-speed');
    this.statDistance = $('#stat-distance');
    this.previewStatus = $('#preview-status');
    this.warningsEl = $('#warnings');
    this.feedbackLayer = $('#feedback-layer');
    this.energyHint = $('#energy-hint');
    this.fadeOverlay = $('#fade-overlay');
    this.activeWarnings = new Set();
    this.challengeSeedInput = $('#challenge-seed');
    this.seedStatWrap = $('#seed-stat-wrap');
    this.statSeed = $('#stat-seed');
    this._actions = {};

    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if(!btn) return;
      const action = btn.dataset.action;
      if(this._actions[action]) this._actions[action](btn);
    });
  }

  on(action, fn){ this._actions[action] = fn; }

  showScreen(id){
    for(const key in this.screens) this.screens[key].classList.remove('active');
    if(id && this.screens[id]) this.screens[id].classList.add('active');
  }
  hideAllScreens(){ this.showScreen(null); }

  setHudVisible(v){
    this.hud.classList.toggle('hidden', !v);
    this.pauseBtn.classList.toggle('hidden', !v);
    this.cinematicBtn.classList.toggle('hidden', !v);
  }

  updateHUD(comet, systemNumber, stardust, previewOn){
    this.barIce.style.width = clamp(comet.ice / comet.maxIce, 0, 1) * 100 + '%';
    this.barHeat.style.width = clamp(comet.heat / comet.maxHeat, 0, 1) * 100 + '%';
    this.barEnergy.style.width = clamp(comet.energy / comet.maxEnergy, 0, 1) * 100 + '%';
    const label = comet.heatLabel;
    this.heatLabel.textContent = label;
    this.heatLabel.style.color = label==='CRITICAL' ? 'var(--warn-red)' : label==='HOT' ? 'var(--warn-amber)' : label==='WARM' ? '#ffdd8a' : 'var(--cyan)';
    this.statStardust.textContent = formatNumber(stardust);
    this.statSystem.textContent = 'Sys ' + systemNumber;
    this.statSpeed.textContent = Math.round(comet.speed) + ' u/s';
    this.statDistance.textContent = formatDistance(comet.distanceTravelled);
    this.previewStatus.textContent = previewOn ? 'PREVIEW ON' : 'PREVIEW OFF';
    this.previewStatus.classList.toggle('on', previewOn);
  }

  setEnergyHint(text){ this.energyHint.textContent = text || ''; }

  // ---- challenge seed ----
  setChallengeSeed(seed){ if(this.challengeSeedInput) this.challengeSeedInput.value = seed; }
  getChallengeSeed(){ return this.challengeSeedInput ? this.challengeSeedInput.value.trim() : ''; }
  copyChallengeSeed(){
    const v = this.getChallengeSeed();
    if(!v) return;
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).catch(()=>{});
  }
  setSeedDisplay(seed){
    if(!this.seedStatWrap) return;
    if(seed){ this.seedStatWrap.style.display = ''; this.statSeed.textContent = seed.slice(0, 20); }
    else { this.seedStatWrap.style.display = 'none'; }
  }

  setCinematicMode(on){
    this.hud.classList.toggle('cinematic', !!on);
  }

  setWarnings(list){
    const wanted = new Set(list);
    for(const w of Array.from(this.activeWarnings)){
      if(!wanted.has(w)){
        this.activeWarnings.delete(w);
        const el = this.warningsEl.querySelector(`[data-warn="${w}"]`);
        if(el) el.remove();
      }
    }
    for(const w of wanted){
      if(!this.activeWarnings.has(w)){
        this.activeWarnings.add(w);
        const el = document.createElement('div');
        el.className = 'warning-msg';
        el.dataset.warn = w;
        el.textContent = w;
        this.warningsEl.appendChild(el);
      }
    }
  }

  showFeedback(text, worldScreenX, worldScreenY, kind='assist'){
    const el = document.createElement('div');
    el.className = 'feedback-msg';
    el.textContent = text;
    el.style.left = worldScreenX + 'px';
    el.style.top = worldScreenY + 'px';
    if(kind === 'warn') el.style.color = '#ffb27a';
    this.feedbackLayer.appendChild(el);
    setTimeout(() => el.remove(), 1450);
  }

  populateUpgradeCards(choiceIds, upgradeState, onPick){
    const container = $('#upgrade-cards');
    container.innerHTML = '';
    for(const id of choiceIds){
      const meta = UPGRADE_META[id];
      const lvl = upgradeState[id];
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <h4>${meta.icon} ${meta.name}</h4>
        <p>${meta.summary}</p>
        <p class="lvl">Lvl ${lvl}/${meta.maxLevel} &rarr; ${describeUpgrade(id, lvl)}</p>
      `;
      card.addEventListener('click', () => onPick(id));
      container.appendChild(card);
    }
  }

  renderStats(container, stats){
    container.innerHTML = '';
    for(const [label, value, isHeader] of stats){
      const row = document.createElement('div');
      row.className = isHeader ? 'stat-row stat-header' : 'stat-row';
      row.innerHTML = isHeader ? `<span>${label}</span>` : `<span>${label}</span><span>${value}</span>`;
      container.appendChild(row);
    }
  }

  fadeToBlack(cb, holdMs=550){
    this.fadeOverlay.classList.add('show');
    setTimeout(() => {
      cb && cb();
      setTimeout(() => this.fadeOverlay.classList.remove('show'), 60);
    }, holdMs);
  }

  // ---- settings persistence ----
  loadSettings(){
    let s;
    try{ s = JSON.parse(localStorage.getItem(CONFIG.STORAGE_SETTINGS)); } catch(e){ s = null; }
    const defaults = {
      music:50, sound:70, shake:true, particles:'medium', trajectory:'medium', reduced:false, fps:false,
      gravityRings:'low', previewDefault:true,
    };
    return Object.assign(defaults, s || {});
  }
  saveSettings(s){
    try{ localStorage.setItem(CONFIG.STORAGE_SETTINGS, JSON.stringify(s)); } catch(e){}
  }

  bindSettingsInputs(settings, onChange){
    const music = $('#set-music'), sound = $('#set-sound'), shake = $('#set-shake'),
      particles = $('#set-particles'), trajectory = $('#set-trajectory'), reduced = $('#set-reduced'), fps = $('#set-fps'),
      gravityRings = $('#set-gravity-rings'), previewDefault = $('#set-preview-default');
    music.value = settings.music; sound.value = settings.sound; shake.checked = settings.shake;
    particles.value = settings.particles; trajectory.value = settings.trajectory;
    reduced.checked = settings.reduced; fps.checked = settings.fps;
    gravityRings.value = settings.gravityRings; previewDefault.checked = settings.previewDefault;
    const emit = () => onChange({
      music:+music.value, sound:+sound.value, shake:shake.checked,
      particles: particles.value, trajectory: trajectory.value,
      reduced: reduced.checked, fps: fps.checked,
      gravityRings: gravityRings.value, previewDefault: previewDefault.checked,
    });
    [music,sound,shake,particles,trajectory,reduced,fps,gravityRings,previewDefault].forEach(el => {
      el.addEventListener('input', emit);
      el.addEventListener('change', emit);
    });
  }

  loadBest(){
    try{ return JSON.parse(localStorage.getItem(CONFIG.STORAGE_BEST)); } catch(e){ return null; }
  }
  saveBest(stats){
    try{ localStorage.setItem(CONFIG.STORAGE_BEST, JSON.stringify(stats)); } catch(e){}
  }
}
