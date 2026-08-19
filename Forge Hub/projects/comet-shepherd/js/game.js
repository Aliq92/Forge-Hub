import { CONFIG } from './config.js';
import { clamp, normalize, dist, formatNumber, formatDistance, makeRng, uid, todayStr } from './utils.js';
import { Comet } from './comet.js';
import { totalGravity } from './physics.js';
import { generateSystem, updateOrbits, gravityBodies } from './systemGenerator.js';
import { computeTrajectory } from './trajectory.js';
import { updateAsteroidBelt, findAsteroidCollision } from './hazards.js';
import { updateResources, RESOURCE_TYPES } from './resources.js';
import { makeUpgradeState, applyUpgradeEffects, rollUpgradeChoices, UPGRADE_META } from './upgrades.js';
import { ParticleSystem } from './particles.js';
import { computeScoreBreakdown } from './scoring.js';

const PARTICLE_DENSITY = { low:0.4, medium:0.75, high:1.15 };

export class Game{
  constructor(ui, renderer, minimap, audio, input){
    this.ui = ui; this.renderer = renderer; this.minimap = minimap; this.audio = audio; this.input = input;
    this.state = 'title';
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.previewOn = false;
    this.cinematicMode = false;
    this.particles = new ParticleSystem(1600);
    this.settings = ui.loadSettings();
    this.applySettings(this.settings);
    this._bindActions();
    this._initTitleDemo();
    window.addEventListener('resize', () => { this.renderer.resize(); this.minimap.resize(); });
    requestAnimationFrame((t) => this._loop(t));
  }

  applySettings(s){
    this.audio.setMusicVolume(s.music/100);
    this.audio.setSoundVolume(s.sound/100);
    this.particles.setDensity(PARTICLE_DENSITY[s.particles] ?? 0.75);
    this.reducedMotion = !!s.reduced;
    this.screenShakeOn = !!s.shake;
    this.gravityRingLevel = s.gravityRings || 'low';
    this.trajectoryQuality = CONFIG.TRAJECTORY_QUALITY[s.trajectory] ?? 1;
  }

  _bindActions(){
    const { ui } = this;
    ui.on('begin-journey', () => this.beginJourney());
    ui.on('how-to-play', () => ui.showScreen('screen-howto'));
    ui.on('close-howto', () => ui.showScreen(this.state==='title' ? 'screen-title' : null));
    ui.on('settings', () => { this._settingsReturnTo = 'screen-title'; ui.showScreen('screen-settings'); });
    ui.on('pause-settings', () => { this._settingsReturnTo = 'screen-pause'; ui.showScreen('screen-settings'); });
    ui.on('close-settings', () => ui.showScreen(this._settingsReturnTo || 'screen-title'));
    ui.on('best-run', () => { this._renderBestRun(); ui.showScreen('screen-bestrun'); });
    ui.on('close-bestrun', () => ui.showScreen('screen-title'));
    ui.on('pause', () => this.togglePause());
    ui.on('resume', () => this.resume());
    ui.on('quit-title', () => this.quitToTitle());
    ui.on('retry', () => { this.isChallengeRun ? this._startRun(this.seedBase, true) : this._startRun(uid(), false); });
    ui.on('continue-endless', () => { this._advanceAfterMilestone(); });

    ui.on('challenge', () => {
      if(!this.ui.getChallengeSeed()) this.ui.setChallengeSeed(uid());
      ui.showScreen('screen-challenge');
    });
    ui.on('challenge-new-seed', () => this.ui.setChallengeSeed(uid()));
    ui.on('challenge-daily', () => this.ui.setChallengeSeed('daily-' + todayStr()));
    ui.on('challenge-copy', () => this.ui.copyChallengeSeed());
    ui.on('challenge-begin', () => this._startRun(this.ui.getChallengeSeed() || uid(), true));
    ui.on('close-challenge', () => ui.showScreen('screen-title'));

    ui.on('mobile-preview', () => this.togglePreview());
    ui.on('mobile-burst', () => this._fireEmergency());
    ui.on('toggle-cinematic', () => this.setCinematicMode(!this.cinematicMode));

    ui.bindSettingsInputs(this.settings, (s) => {
      this.settings = s; this.ui.saveSettings(s); this.applySettings(s);
    });

    document.addEventListener('visibilitychange', () => {
      if(document.hidden && this.state === 'playing') this.pause();
    });
  }

  // ---------------- Title demo scene ----------------
  _initTitleDemo(){
    this.demoSystem = generateSystem(1, 'title-demo-' + Math.floor(Math.random()*99999));
    const sp = this.demoSystem.spawn, v = this.demoSystem.vel;
    this.demoComet = { x: sp.x, y: sp.y, vx: v.x, vy: v.y, radius: 9, heat: 8, tailIntensity: 0.6, impactFlash: 0, invulnTimer: 0 };
    this.demoTimer = 0;
  }
  _updateDemo(dt){
    updateOrbits(this.demoSystem, dt);
    const bodies = gravityBodies(this.demoSystem);
    const g = totalGravity(bodies, this.demoComet.x, this.demoComet.y);
    this.demoComet.vx += g.ax*dt; this.demoComet.vy += g.ay*dt;
    this.demoComet.x += this.demoComet.vx*dt; this.demoComet.y += this.demoComet.vy*dt;
    const spd = Math.hypot(this.demoComet.vx, this.demoComet.vy);
    this.demoComet.tailIntensity = clamp(0.4 + spd/500, 0.3, 1.2);
    const back = normalize(-this.demoComet.vx, -this.demoComet.vy);
    const budget = this.particles.spawnBudget(4);
    for(let i=0;i<budget;i++){
      const ang = Math.atan2(back.y,back.x) + (Math.random()-0.5)*0.4;
      const speed = 20 + Math.random()*40;
      this.particles.spawn({
        x:this.demoComet.x, y:this.demoComet.y,
        vx:Math.cos(ang)*speed + this.demoComet.vx*0.15, vy:Math.sin(ang)*speed + this.demoComet.vy*0.15,
        life:0.6+Math.random()*0.5, size:1.2+Math.random()*1.8, sizeEnd:0.2,
        color:'150,225,255', alpha:0.6, drag:0.97, glow:true,
      });
    }
    this.demoTimer += dt;
    const farGone = dist(this.demoComet.x,this.demoComet.y,0,0) > this.demoSystem.bounds.radius*1.6;
    if(this.demoTimer > 90 || farGone || !Number.isFinite(this.demoComet.x)) this._initTitleDemo();
    this.renderer.camera.x = this.demoComet.x * 0.4;
    this.renderer.camera.y = this.demoComet.y * 0.4;
    this.renderer.camera.zoom += (0.62 - this.renderer.camera.zoom) * Math.min(1, dt*0.5);
  }

  // ---------------- Run lifecycle ----------------
  beginJourney(){ this._startRun(uid(), false); }
  beginChallenge(seed){ this._startRun(seed || uid(), true); }

  _startRun(seedBase, isChallenge){
    this.seedBase = seedBase;
    this.isChallengeRun = !!isChallenge;
    this.systemNumber = 1;
    this.stardust = 0;
    this.upgradeState = makeUpgradeState();
    this.milestoneShown = false;
    this.assistTrack = new Map();
    this.starTrack = null;
    this.previewOn = this.settings.previewDefault !== false;
    this.stats = {
      gravityAssists:0, resourcesCollected:0, closestSolarPass: Infinity, timeSurvived:0,
      nearMisses:0, nearMissScore:0, resourcePoints:0, systemsCrossed:0,
    };
    const startSys = generateSystem(1, this.seedBase + '-1');
    this.comet = new Comet(startSys.spawn.x, startSys.spawn.y, startSys.vel.x, startSys.vel.y);
    applyUpgradeEffects(this.comet, this.upgradeState);
    this.system = startSys;
    this.particles.clear();
    this.ui.setHudVisible(true);
    this.ui.setSeedDisplay(this.isChallengeRun ? this.seedBase : null);
    this.ui.showScreen(null);
    this.state = 'playing';
    this.audio.init(); this.audio.resume();
    this.input.setEnabled(true);
  }

  togglePreview(){ this.previewOn = !this.previewOn; }

  setCinematicMode(on){
    this.cinematicMode = on;
    this.ui.setCinematicMode(on);
  }

  loadSystem(n){
    this.system = generateSystem(n, this.seedBase + '-' + n);
    this.comet.x = this.system.spawn.x; this.comet.y = this.system.spawn.y;
    this.comet.vx = this.system.vel.x; this.comet.vy = this.system.vel.y;
    this.comet.invulnTimer = 1.2;
    this.assistTrack = new Map();
    this.starTrack = null;
    this.particles.clear();
  }

  openUpgradeScreen(){
    this.state = 'upgrade';
    const rng = Math.random;
    const choices = rollUpgradeChoices(rng, this.upgradeState, 3);
    this.ui.populateUpgradeCards(choices, this.upgradeState, (id) => this._pickUpgrade(id));
    this.ui.showScreen('screen-upgrade');
  }

  _pickUpgrade(id){
    this.upgradeState[id] = Math.min(UPGRADE_META[id].maxLevel, this.upgradeState[id] + 1);
    applyUpgradeEffects(this.comet, this.upgradeState);
    this.audio.upgradeSelect();
    this.systemNumber += 1;
    this.loadSystem(this.systemNumber);
    this.ui.showScreen(null);
    this.state = 'playing';
  }

  _advanceAfterMilestone(){
    this.openUpgradeScreen();
  }

  togglePause(){
    if(this.state === 'playing') this.pause();
    else if(this.state === 'paused') this.resume();
  }
  pause(){
    if(this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showScreen('screen-pause');
  }
  resume(){
    if(this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.lastTime = performance.now();
  }
  quitToTitle(){
    this.state = 'title';
    this.ui.setHudVisible(false);
    this.ui.showScreen('screen-title');
    this._initTitleDemo();
  }

  // ---------------- Main loop ----------------
  _loop(now){
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05);

    try{
      const pendingEvents = this.input.pollEvents();
      for(const e of pendingEvents){
        if(e.type === 'pause'){ this.togglePause(); }
        else if(this.state === 'playing'){ (this._queuedInputEvents = this._queuedInputEvents||[]).push(e); }
      }

      if(this.state === 'playing') this._updatePlaying(dt);
      else if(this.state === 'title' || this.state === 'howto' || this.state === 'settings' || this.state === 'bestrun'){
        this._updateDemo(dt);
        this._queuedInputEvents = [];
      } else if(this.state === 'gate-transition'){
        this._updateGateTransition(dt);
        this._queuedInputEvents = [];
      }

      if(this.comet) this._sanitizeComet();
      const particleDt = this.state === 'gate-transition' ? dt * 0.35 : dt;
      this.particles.update(particleDt);
      this._render(dt);
    } catch(err){
      console.error('Comet Shepherd frame error (recovered):', err);
    }
    requestAnimationFrame((t) => this._loop(t));
  }

  // Last line of defense: if any comet scalar ever goes non-finite (bad upgrade math,
  // a future edge case), snap it back to a safe value instead of corrupting the run silently.
  _sanitizeComet(){
    const c = this.comet;
    if(!Number.isFinite(c.ice)) c.ice = c.maxIce * 0.5;
    if(!Number.isFinite(c.maxIce) || c.maxIce <= 0) c.maxIce = CONFIG.COMET_START_ICE;
    if(!Number.isFinite(c.energy)) c.energy = c.maxEnergy * 0.5;
    if(!Number.isFinite(c.maxEnergy) || c.maxEnergy <= 0) c.maxEnergy = CONFIG.COMET_START_ENERGY;
    if(!Number.isFinite(c.heat)) c.heat = 0;
    if(!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.vx) || !Number.isFinite(c.vy)){
      c.x = this.system.spawn.x; c.y = this.system.spawn.y;
      c.vx = this.system.vel.x; c.vy = this.system.vel.y;
    }
  }

  // ---------------- Playing update ----------------
  _updatePlaying(dt){
    const comet = this.comet, system = this.system;
    this.stats.timeSurvived += dt;

    this._handleDiscreteInput();
    this._handleContinuousInput(dt);

    updateOrbits(system, dt);
    for(const belt of system.belts) updateAsteroidBelt(belt, system.star, dt);
    const flareEvents = system.flare.update(dt);
    if(flareEvents.justWarned) this.audio.flareWarning();

    this.accumulator += dt;
    let steps = 0;
    const bodies = gravityBodies(system);
    while(this.accumulator >= CONFIG.PHYSICS_DT && steps < CONFIG.MAX_SUBSTEPS){
      this._physicsSubstep(bodies, CONFIG.PHYSICS_DT);
      this.accumulator -= CONFIG.PHYSICS_DT;
      steps++;
    }
    if(steps >= CONFIG.MAX_SUBSTEPS) this.accumulator = 0;

    const distToStar = dist(comet.x, comet.y, system.star.x, system.star.y);
    if(comet.alive) this.stats.closestSolarPass = Math.min(this.stats.closestSolarPass, distToStar);
    const heatInput = this._heatInputAt(distToStar, system.star.radius) + this._flareHeatBonus(system, comet, distToStar);
    const coldSpace = distToStar > system.star.heatRadius * 1.1;
    comet.update(dt, heatInput, coldSpace);

    this._emitTailParticles(dt);
    this._emitFragmentParticles(dt);
    this._checkCollisions();
    this._checkAssists();
    updateResources(system.resources, comet, dt, (r) => this._onCollectResource(r));

    this.renderer.camera.follow(comet, dt, this._nearMassivePlanet(), this.system.gate);

    if(!comet.alive){
      this._triggerGameOver();
      return;
    }

    const gate = system.gate;
    if(!gate.activated && dist(comet.x, comet.y, gate.x, gate.y) < gate.radius + comet.radius){
      gate.activated = true;
      this._triggerGateReached();
    }

    this._updateWarnings(distToStar);
    this.audio.setHumIntensity(clamp(comet.heat/100,0,1));

    this.ui.updateHUD(comet, this.systemNumber, this.stardust, this.previewOn || !!this.input.dragging);
  }

  _physicsSubstep(bodies, dt){
    const comet = this.comet;
    const g = totalGravity(bodies, comet.x, comet.y);
    comet.vx += g.ax * dt; comet.vy += g.ay * dt;
    comet.x += comet.vx * dt; comet.y += comet.vy * dt;
    if(!Number.isFinite(comet.x) || !Number.isFinite(comet.y) || !Number.isFinite(comet.vx) || !Number.isFinite(comet.vy)){
      comet.x = this.system.spawn.x; comet.y = this.system.spawn.y;
      comet.vx = this.system.vel.x; comet.vy = this.system.vel.y;
    }
  }

  _heatInputAt(distToStar, starRadius){
    const d = Math.max(distToStar, starRadius*0.3);
    const ratio = starRadius / d;
    const gain = 1400 * Math.pow(ratio, 2.4);
    return clamp(gain, 0, 260);
  }
  _flareHeatBonus(system, comet, distToStar){
    if(system.flare.state !== 'active') return 0;
    const ang = Math.atan2(comet.y - system.star.y, comet.x - system.star.x);
    if(!system.flare.isPointInSector(ang)) return 0;
    const reach = system.star.heatRadius * 1.6;
    if(distToStar > reach) return 0;
    return 55 * clamp(1 - distToStar/reach, 0, 1);
  }

  _nearMassivePlanet(){
    const comet = this.comet;
    for(const p of this.system.planets){
      if(p.typeKey === 'GAS' || p.typeKey === 'RINGED'){
        if(dist(comet.x,comet.y,p.x,p.y) < p.radius * 6) return true;
      }
    }
    return false;
  }

  // ---------------- Input ----------------
  _handleDiscreteInput(){
    const events = this._queuedInputEvents || [];
    this._queuedInputEvents = [];
    for(const e of events){
      if(e.type === 'toggle_preview'){ this.togglePreview(); }
      else if(e.type === 'emergency'){ this._fireEmergency(); }
      else if(e.type === 'drag_end'){ this._applyDragCorrection(e); }
      else if(e.type === 'toggle_cinematic'){ this.setCinematicMode(!this.cinematicMode); }
    }
  }
  _handleContinuousInput(dt){
    if(this.input.keys.left){
      if(this.comet.applyNudge(-1, 0)) this.audio.nudge();
    } else if(this.input.keys.right){
      if(this.comet.applyNudge(1, 0)) this.audio.nudge();
    }
  }

  _applyDragCorrection(e){
    const dx = e.end.x - e.start.x, dy = e.end.y - e.start.y;
    const d = Math.hypot(dx, dy);
    if(d < CONFIG.CORRECTION_MIN_DRAG) return;
    const strengthFrac = clamp((d - CONFIG.CORRECTION_MIN_DRAG) / (CONFIG.CORRECTION_MAX_DRAG - CONFIG.CORRECTION_MIN_DRAG), 0.08, 1);
    if(this.comet.applyCorrection(dx, dy, strengthFrac)) this.audio.correctionPulse();
  }

  _fireEmergency(){
    const comet = this.comet;
    const cs = this.renderer.worldToScreen(comet.x, comet.y);
    const dx = this.input.pointerScreen.x - cs.x, dy = this.input.pointerScreen.y - cs.y;
    if(Math.hypot(dx,dy) < 4) return;
    if(comet.applyCorrection(dx, dy, 1, true)){
      this.audio.emergency();
      this.renderer.addShake(this.screenShakeOn ? 8 : 0);
    }
  }

  // ---------------- Collisions ----------------
  _checkCollisions(){
    const comet = this.comet, system = this.system;
    const distStar = dist(comet.x,comet.y,system.star.x,system.star.y);
    if(distStar < system.star.radius){
      comet.damage(999);
      this._burstParticles(comet.x, comet.y, '255,150,80', 40, 3.2);
      this.renderer.addShake(this.screenShakeOn ? 26 : 0);
      this.audio.impact(2);
      return;
    }
    for(const p of system.planets){
      if(dist(comet.x,comet.y,p.x,p.y) < p.radius + comet.radius){
        const relSpeed = comet.speed;
        const dmg = clamp(55 + relSpeed*0.09, 55, 140);
        comet.damage(dmg);
        comet.invulnTimer = 1.1;
        const away = normalize(comet.x-p.x, comet.y-p.y);
        comet.vx = away.x * Math.max(80, relSpeed*0.5);
        comet.vy = away.y * Math.max(80, relSpeed*0.5);
        this._burstParticles(comet.x, comet.y, '200,220,255', 26, 2.6);
        this.renderer.addShake(this.screenShakeOn ? 20 : 0);
        this.audio.impact(1.6);
        break;
      }
    }
    const hitAsteroid = findAsteroidCollision(system.belts, comet);
    if(hitAsteroid){
      const relSpeed = comet.speed;
      const dmg = clamp(8 + relSpeed*0.05 + hitAsteroid.size*9, 8, 55);
      comet.damage(dmg);
      comet.invulnTimer = 0.5;
      hitAsteroid.hit = true;
      const away = normalize(comet.x-hitAsteroid.x, comet.y-hitAsteroid.y);
      comet.vx += away.x * 60; comet.vy += away.y * 60;
      this._burstParticles(hitAsteroid.x, hitAsteroid.y, '170,170,180', 16, 2);
      this.renderer.addShake(this.screenShakeOn ? 10 : 0);
      this.audio.impact(0.8);
      for(const belt of system.belts) belt.asteroids = belt.asteroids.filter(a => !a.hit);
    }
  }

  // ---------------- Gravity assist & near-miss detection ----------------
  // A single pass per encounter (tracked by entry/exit through an influence zone) decides
  // whether it was a meaningful slingshot, a skillful close pass, both (PERFECT SLINGSHOT),
  // or neither — so the same graze never fires two overlapping popups.
  _checkAssists(){
    const comet = this.comet;
    for(const p of this.system.planets){
      const influence = p.radius * CONFIG.ASSIST_INFLUENCE_MULT;
      const d = dist(comet.x,comet.y,p.x,p.y);
      const track = this.assistTrack.get(p.id);
      if(d < influence){
        if(!track){
          this.assistTrack.set(p.id, { entrySpeed: comet.speed, entryVx: comet.vx, entryVy: comet.vy, minDist: d });
        } else {
          track.minDist = Math.min(track.minDist, d);
        }
      } else if(track){
        this.assistTrack.delete(p.id);
        const collisionThreshold = p.radius + comet.radius;
        const ratio = track.minDist / Math.max(1, collisionThreshold);
        this._resolveEncounter(track, comet, ratio, CONFIG.NEAR_MISS.planetRatio, 'planet');
      }
    }

    // Star near-miss tracked separately since it's a single body, not a Map of many.
    const star = this.system.star;
    const dStar = dist(comet.x, comet.y, star.x, star.y);
    if(dStar < star.heatRadius){
      if(!this.starTrack){
        this.starTrack = { entrySpeed: comet.speed, entryVx: comet.vx, entryVy: comet.vy, minDist: dStar };
      } else {
        this.starTrack.minDist = Math.min(this.starTrack.minDist, dStar);
      }
    } else if(this.starTrack){
      const track = this.starTrack; this.starTrack = null;
      const ratio = track.minDist / Math.max(1, star.radius);
      this._resolveEncounter(track, comet, ratio, CONFIG.NEAR_MISS.starRatio, 'star');
    }
  }

  _resolveEncounter(track, comet, ratio, ratioTiers, kind){
    if(comet.invulnTimer > 0) return;
    const exitSpeed = comet.speed;
    const deltaPct = (exitSpeed - track.entrySpeed) / Math.max(1, track.entrySpeed);
    const dot = track.entryVx*comet.vx + track.entryVy*comet.vy;
    const magProduct = Math.max(1, track.entrySpeed * exitSpeed);
    const angleDelta = Math.acos(clamp(dot / magProduct, -1, 1)); // radians of heading change
    const meaningfulSpeed = Math.abs(deltaPct) >= CONFIG.ASSIST_MIN_SPEED_DELTA_PCT;
    const meaningfulAngle = angleDelta >= 0.19; // ~11 degrees of visible curvature
    const isSlingshot = meaningfulSpeed || meaningfulAngle;

    let rank = null;
    if(ratio <= ratioTiers.daring) rank = 'daring';
    else if(ratio <= ratioTiers.bold) rank = 'bold';
    else if(ratio <= ratioTiers.close) rank = 'close';

    const nm = CONFIG.NEAR_MISS;
    const s = this.renderer.worldToScreen(comet.x, comet.y);
    let label = null;

    if(isSlingshot && rank && (rank === 'daring' || rank === 'bold')){
      // A tight, dramatic pass that also meaningfully redirected the comet.
      label = 'PERFECT SLINGSHOT';
      this.stats.gravityAssists++;
      this.stats.nearMisses++;
      this.stats.nearMissScore += nm.score.perfect;
      this.stardust += nm.stardust.perfect;
      comet.heal(nm.iceHeal.perfect);
      if(comet.slingshotMasteryLevel > 0) comet.restoreEnergy(comet.slingshotMasteryLevel*8);
    } else if(isSlingshot){
      const pct = Math.round(deltaPct*100);
      label = meaningfulSpeed ? (deltaPct >= 0 ? `SLINGSHOT +${pct}%` : `GRAVITY BRAKE ${pct}%`) : 'GRAVITY ASSIST';
      this.stats.gravityAssists++;
      this.stats.nearMissScore += nm.score.assist;
      if(comet.slingshotMasteryLevel > 0) comet.restoreEnergy(comet.slingshotMasteryLevel*8);
    } else if(rank){
      const labels = { close: 'CLOSE PASS', bold: 'BOLD PASS', daring: 'DARING PASS' };
      label = labels[rank] + (kind === 'star' ? ' (SOLAR)' : '');
      this.stats.nearMisses++;
      this.stats.nearMissScore += nm.score[rank];
      this.stardust += nm.stardust[rank];
      if(rank === 'daring'){ comet.heal(nm.iceHeal.daring); }
    }

    if(label){
      this.ui.showFeedback(label, s.x, s.y - 50);
      this.audio.assistChime();
    }
  }

  // ---------------- Resources ----------------
  _onCollectResource(r){
    const comet = this.comet;
    this.stats.resourcesCollected++;
    let bonus = false;
    if(comet.starHarvestLevel > 0 && Math.random() < Math.min(0.35, 0.08+comet.starHarvestLevel*0.05)){
      bonus = true;
    }
    switch(r.type){
      case 'ICE_FRAGMENT': comet.heal(r.value); this.audio.pickupIce(); break;
      case 'ENERGY_SHARD': comet.restoreEnergy(r.value); this.audio.pickupEnergy(); break;
      case 'STARDUST': this.stardust += r.value; this.audio.pickupStardust(); break;
      case 'ANCIENT_CORE': this.stardust += r.value; this.audio.pickupCore(); break;
    }
    this.stats.resourcePoints += r.value;
    if(bonus){ this.stardust += 5; }
    const def = RESOURCE_TYPES[r.type];
    this._burstParticles(r.x, r.y, def.color, 10, 1.4);
  }

  // ---------------- Particles ----------------
  _emitTailParticles(dt){
    const comet = this.comet, star = this.system.star;
    const budget = this.particles.spawnBudget(Math.round(6 + comet.tailIntensity*10));
    const heatT = clamp(comet.heat/100,0,1);

    // Tail direction is stylized, not simulated solar wind: mostly velocity-backward,
    // blended toward "away from the star" as heat rises, so a close solar pass visibly
    // sweeps the tail outward rather than just streaking behind the flight path.
    const velBack = normalize(-comet.vx, -comet.vy);
    const awayFromStar = normalize(comet.x - star.x, comet.y - star.y);
    const starPull = clamp(heatT * 0.65, 0, 0.6);
    const back = normalize(
      velBack.x * (1 - starPull) + awayFromStar.x * starPull,
      velBack.y * (1 - starPull) + awayFromStar.y * starPull
    );

    const energetic = heatT > 0.6;
    for(let i=0;i<budget;i++){
      const spread = 0.5;
      const ang = Math.atan2(back.y,back.x) + (Math.random()-0.5)*spread;
      const speed = (20 + Math.random()*60 + comet.speed*0.15) * (energetic ? 1.35 : 1);
      const dist0 = Math.random()*comet.radius*1.5;
      const color = heatT > 0.6 ? '255,180,130' : '150,225,255';
      this.particles.spawn({
        x: comet.x + Math.cos(ang)*dist0*0.3, y: comet.y + Math.sin(ang)*dist0*0.3,
        vx: Math.cos(ang)*speed + comet.vx*0.15, vy: Math.sin(ang)*speed + comet.vy*0.15,
        life: (0.5 + Math.random()*0.6*comet.tailIntensity) * (energetic ? 1.2 : 1),
        size: (1.2+Math.random()*2.2) * (energetic ? 1.25 : 1), sizeEnd:0.2,
        color, alpha: energetic ? 0.85 : 0.7, drag:0.97, glow:true,
      });
    }
    if(comet.heat > 70 && Math.random() < 0.3){
      this.particles.spawn({
        x: comet.x, y: comet.y, vx:(Math.random()-0.5)*40, vy:(Math.random()-0.5)*40,
        life: 0.8, size: 1.6, sizeEnd:0.3, color:'220,240,255', alpha:0.8, drag:0.95,
      });
    }
  }

  // Visible breakup once the comet is CRACKING/CRITICAL — small pale debris chips
  // drifting off the nucleus, reusing the same pooled particle system as the tail.
  _emitFragmentParticles(dt){
    const comet = this.comet;
    const stability = comet.stabilityState;
    if(stability === 'STABLE' || stability === 'STRAINED') return;
    const rate = stability === 'CRITICAL' ? 3 : 1.2;
    const budget = this.particles.spawnBudget(Math.round(rate));
    for(let i=0;i<budget;i++){
      const ang = Math.random()*Math.PI*2;
      const speed = 12 + Math.random()*30;
      this.particles.spawn({
        x: comet.x, y: comet.y,
        vx: Math.cos(ang)*speed + comet.vx*0.3, vy: Math.sin(ang)*speed + comet.vy*0.3,
        life: 0.6 + Math.random()*0.5, size: 1 + Math.random()*1.6, sizeEnd: 0.15,
        color: '200,205,215', alpha: 0.6, drag: 0.96, glow:false,
      });
    }
  }
  _burstParticles(x, y, color, count, speedMult){
    const n = this.particles.spawnBudget(count);
    for(let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = (30 + Math.random()*90)*speedMult;
      this.particles.spawn({
        x, y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
        life:0.5+Math.random()*0.6, size:1.5+Math.random()*2.5, sizeEnd:0.2,
        color, alpha:0.9, drag:0.94, glow:true,
      });
    }
  }

  // ---------------- Warnings ----------------
  _updateWarnings(distToStar){
    const comet = this.comet, system = this.system;
    const list = [];
    if(comet.heatLabel === 'CRITICAL') list.push('HEAT CRITICAL');
    if(comet.ice < comet.maxIce*0.25) list.push('LOW ICE');
    if(comet.energy < comet.maxEnergy*0.15) list.push('LOW ENERGY');
    if(system.flare.state === 'warning') list.push('SOLAR FLARE INCOMING');
    else if(system.flare.state === 'active') list.push('SOLAR FLARE');
    if(!system.gate.activated && dist(comet.x,comet.y,system.gate.x,system.gate.y) < 700) list.push('GATE NEARBY');
    if(this._previewPts && this._previewPts.collided) list.push('COLLISION RISK');
    this.ui.setWarnings(list);
  }

  // ---------------- Gate / Game over ----------------
  _updateGateTransition(dt){
    this.gateTransitionTimer = (this.gateTransitionTimer || 0) + dt;
    const comet = this.comet, gate = this.system.gate;
    const cam = this.renderer.camera;
    cam.x += (comet.x - cam.x) * Math.min(1, dt * 3.2);
    cam.y += (comet.y - cam.y) * Math.min(1, dt * 3.2);
    cam.zoom += (Math.min(CONFIG.ZOOM_MAX + 0.3, cam.zoom + 0.4) - cam.zoom) * Math.min(1, dt * 2.2);
    if(Math.random() < 0.6){
      this.particles.spawn({
        x: comet.x, y: comet.y, vx:(Math.random()-0.5)*30, vy:(Math.random()-0.5)*30,
        life: 0.5, size: 1.8, sizeEnd: 0.2, color:'210,245,255', alpha: 0.85, drag:0.95, glow:true,
      });
    }
  }

  _triggerGateReached(){
    this.audio.gateActivate();
    this._burstParticles(this.system.gate.x, this.system.gate.y, '180,240,255', 50, 2.2);
    this.gateTransitionTimer = 0;
    this.stats.systemsCrossed = (this.stats.systemsCrossed||0) + 1;
    this.ui.fadeToBlack(() => {
      if(this.systemNumber === CONFIG.MILESTONE_SYSTEM && !this.milestoneShown){
        this.milestoneShown = true;
        this.state = 'milestone';
        this.ui.showScreen('screen-milestone');
      } else {
        this.openUpgradeScreen();
      }
    }, 500);
    this.state = 'gate-transition';
  }

  _triggerGameOver(){
    this.state = 'breaking';
    this._burstParticles(this.comet.x, this.comet.y, '200,235,255', 90, 3.6);
    this.renderer.addShake(this.screenShakeOn ? 26 : 0);
    this.audio.breakApart();
    setTimeout(() => {
      const breakdown = computeScoreBreakdown(this.stats, this.comet, this.stardust);
      const stats = this._collectFinalStats().concat(breakdown.rows);
      this.ui.renderStats(document.getElementById('gameover-stats'), stats);
      const best = this.ui.loadBest();
      if(!best || this.comet.distanceTravelled > best.distance){
        this.ui.saveBest({
          distance: this.comet.distanceTravelled,
          systems: this.stats.systemsCrossed||0,
          assists: this.stats.gravityAssists,
          resources: this.stats.resourcesCollected,
          stardust: this.stardust,
          maxSpeed: this.comet.maxSpeed,
          closestPass: Number.isFinite(this.stats.closestSolarPass) ? this.stats.closestSolarPass : 0,
          timeSurvived: this.stats.timeSurvived,
        });
      }
      this.state = 'gameover';
      this.ui.showScreen('screen-gameover');
    }, 1200);
  }

  _collectFinalStats(){
    return [
      ['SYSTEMS CROSSED', this.stats.systemsCrossed||0],
      ['DISTANCE TRAVELLED', formatDistance(this.comet.distanceTravelled)],
      ['GRAVITY ASSISTS', this.stats.gravityAssists],
      ['STARDUST COLLECTED', formatNumber(this.stardust)],
      ['RESOURCES COLLECTED', this.stats.resourcesCollected],
      ['MAXIMUM SPEED', Math.round(this.comet.maxSpeed) + ' u/s'],
      ['CLOSEST SOLAR PASS', Number.isFinite(this.stats.closestSolarPass) ? Math.round(this.stats.closestSolarPass) : '—'],
      ['TIME SURVIVED', Math.round(this.stats.timeSurvived) + 's'],
    ];
  }

  _renderBestRun(){
    const best = this.ui.loadBest();
    const container = document.getElementById('bestrun-stats');
    if(!best){
      container.innerHTML = '<p style="color:var(--text-dim)">No runs recorded yet. Begin your first journey.</p>';
      return;
    }
    this.ui.renderStats(container, [
      ['SYSTEMS CROSSED', best.systems],
      ['DISTANCE TRAVELLED', formatDistance(best.distance)],
      ['GRAVITY ASSISTS', best.assists],
      ['STARDUST COLLECTED', formatNumber(best.stardust)],
      ['RESOURCES COLLECTED', best.resources],
      ['MAXIMUM SPEED', Math.round(best.maxSpeed) + ' u/s'],
      ['CLOSEST SOLAR PASS', Math.round(best.closestPass)],
      ['TIME SURVIVED', Math.round(best.timeSurvived) + 's'],
    ]);
  }

  // ---------------- Render ----------------
  _render(dt){
    const r = this.renderer;
    r.beginFrame(dt, this.reducedMotion);

    const demoStates = new Set(['title','howto','settings','bestrun']);
    const useRun = !demoStates.has(this.state) && this.system && this.comet;
    const activeSystem = useRun ? this.system : this.demoSystem;
    const activeComet = useRun ? this.comet : this.demoComet;

    r.drawBackground(activeComet.heat ? activeComet.heat/100 : 0);
    r.drawOrbitLines(activeSystem, true);
    if(useRun) r.drawGravityRings(activeSystem, this.gravityRingLevel);
    r.drawStar(activeSystem.star, activeSystem.flare);
    for(const belt of activeSystem.belts) r.drawAsteroidBelt(belt);
    for(const p of activeSystem.planets) r.drawPlanet(p);
    r.drawGate(activeSystem.gate, performance.now()/1000);

    if(this.state === 'playing'){
      for(const res of this.system.resources){ if(!res.collected) r.drawResource(res, RESOURCE_TYPES); }
    }

    this.particles.draw(r.ctx, (x,y)=>r.worldToScreen(x,y));

    if(this.state === 'playing'){
      const dragVec = this.input.dragging ? this.input.dragVector() : null;
      const showPreview = this.previewOn || !!dragVec;
      if(showPreview){
        let pending = null;
        if(dragVec && dragVec.dist > CONFIG.CORRECTION_MIN_DRAG){
          const n = normalize(dragVec.dx, dragVec.dy);
          pending = { x: n.x * CONFIG.CORRECTION_MAX_IMPULSE * dragVec.strengthFrac, y: n.y * CONFIG.CORRECTION_MAX_IMPULSE * dragVec.strengthFrac };
        }
        this._previewPts = computeTrajectory(this.comet, this.system, pending, this.trajectoryQuality);
        r.drawTrajectory(this._previewPts, this.reducedMotion);
      } else {
        this._previewPts = null;
      }
      if(dragVec && dragVec.dist > CONFIG.CORRECTION_MIN_DRAG){
        r.drawAimLine(this.comet, dragVec.dx, dragVec.dy, dragVec.strengthFrac);
      }
    }

    r.drawComet(activeComet);

    if(this.state === 'gate-transition'){
      const t01 = clamp((this.gateTransitionTimer||0) / 0.55, 0, 1);
      r.drawGateBloom(activeComet.x, activeComet.y, t01);
    }

    r.applyDamageFlash(activeComet.impactFlash||0);
    r.applyHeatVignette((activeComet.heat||0)/100);
    r.endFrame();

    if(this.state==='playing' || this.state==='paused' || this.state==='gate-transition'){
      this.minimap.draw(this.system, this.comet);
    }

    if(this.settings.fps){
      this._fpsTimer = (this._fpsTimer||0) + dt;
      this._fpsAccum = (this._fpsAccum||0) + 1;
      if(!this._fpsEl){
        this._fpsEl = document.createElement('div');
        this._fpsEl.className = 'fps-counter';
        document.getElementById('app').appendChild(this._fpsEl);
      }
      this._fpsEl.style.display = 'block';
      if(this._fpsTimer > 0.4){
        this._fpsEl.textContent = Math.round(this._fpsAccum/this._fpsTimer) + ' FPS';
        this._fpsTimer = 0; this._fpsAccum = 0;
      }
    } else if(this._fpsEl){ this._fpsEl.style.display = 'none'; }
  }
}
