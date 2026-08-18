// ---------------- Bootstrap: canvas, RAF loop, DOM wiring ----------------
(function () {
  const canvas = document.getElementById('gameCanvas');
  const renderer = new Renderer(canvas);
  const game = new Game();

  window.addEventListener('resize', () => { renderer.resize(); game.ui._resizeMinimap(); });

  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice) game.ui.showTouchControls(true);

  // ---- Title screen ----
  document.getElementById('btnStart').addEventListener('click', () => {
    const mode = document.getElementById('modeSelect').value;
    if (!SaveData.getTutorialSeen()) {
      game.mode = mode;
      game.openTutorial();
      game._afterTutorialStart = mode;
    } else {
      game.startRun(mode);
    }
  });
  document.getElementById('btnHowTo').addEventListener('click', () => game.openTutorial());
  document.getElementById('btnSettings').addEventListener('click', () => game.openSettings());

  // ---- Tutorial ----
  document.getElementById('btnTutClose').addEventListener('click', () => {
    const pendingMode = game._afterTutorialStart;
    game._afterTutorialStart = null;
    game.closeTutorial();
    if (pendingMode) game.startRun(pendingMode);
  });

  // ---- Pause ----
  document.getElementById('btnResume').addEventListener('click', () => game.resumeFromPause());
  document.getElementById('btnRestart').addEventListener('click', () => game.restartRun());
  document.getElementById('btnControls').addEventListener('click', () => game.openControls());
  document.getElementById('btnPauseSettings').addEventListener('click', () => game.openSettings());
  document.getElementById('btnToTitle').addEventListener('click', () => game.returnToTitle());

  // ---- Controls ----
  document.getElementById('btnControlsClose').addEventListener('click', () => game._closeSubScreen());

  // ---- Settings ----
  const settingInputs = ['musicVolume', 'soundVolume', 'screenShake', 'particleDensity', 'showFps', 'reducedMotion'];
  settingInputs.forEach((id) => {
    document.getElementById(id).addEventListener('input', () => game.applySettingsFromUI());
    document.getElementById(id).addEventListener('change', () => game.applySettingsFromUI());
  });
  document.getElementById('btnSettingsClose').addEventListener('click', () => game._closeSubScreen());

  // ---- Upgrade ----
  document.getElementById('btnSkipUpgrade').addEventListener('click', () => game.skipUpgrade());

  // ---- Station ----
  document.getElementById('btnStationRepair').addEventListener('click', () => game.stationRepair());
  document.getElementById('btnStationRefuel').addEventListener('click', () => game.stationRefuel());
  document.getElementById('btnStationUpgrade').addEventListener('click', () => game.stationBuyUpgrade());
  document.getElementById('btnStationLeave').addEventListener('click', () => game.stationLeave());

  // ---- Game over ----
  document.getElementById('btnRetry').addEventListener('click', () => game.restartRun());
  document.getElementById('btnGoToTitle').addEventListener('click', () => game.returnToTitle());

  // ---- Touch pause / dock buttons ----
  document.getElementById('touchPause').addEventListener('click', () => game._handleEscape());
  const touchDockBtn = document.getElementById('touchDock');
  const dockAction = (e) => { e.preventDefault(); game.interact(); };
  touchDockBtn.addEventListener('touchstart', dockAction, { passive: false });
  touchDockBtn.addEventListener('click', dockAction);

  // apply persisted settings to audio engine once it inits, and on load
  const origInit = game.sound.init.bind(game.sound);
  game.sound.init = function () {
    origInit();
    game.sound.setMusicVolume(game.settings.musicVolume / 100);
    game.sound.setSfxVolume(game.settings.soundVolume / 100);
  };

  // pause automatically if tab loses visibility mid-run
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') game._handleEscape();
  });

  window.__VD_DEBUG = { game, renderer };

  // ---- Main loop ----
  let lastTime = performance.now();
  let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;

  function frame(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = clamp(dt, 0, 1 / 30); // clamp to avoid huge steps on tab-resume / stutter

    game.update(dt);
    game.render(renderer, dt);

    fpsFrames++; fpsAccum += dt; fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      game.ui.setFps(fpsFrames / fpsAccum);
      fpsFrames = 0; fpsAccum = 0; fpsTimer = 0;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
