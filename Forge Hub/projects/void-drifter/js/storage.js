// ---------------- Local persistence (best distance, settings, tutorial, achievements) ----------------
const SaveData = (function () {
  const KEYS = {
    best: 'vd_best_distance_km',
    settings: 'vd_settings',
    tutorial: 'vd_tutorial_seen',
    achievements: 'vd_achievements',
  };

  const DEFAULT_SETTINGS = {
    musicVolume: 50,
    soundVolume: 70,
    screenShake: true,
    particleDensity: 'medium',
    showFps: false,
    reducedMotion: false,
  };

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore quota/private-mode errors */ }
  }

  function getBestDistanceKm() {
    const v = parseFloat(safeGet(KEYS.best));
    return isNaN(v) ? 0 : v;
  }
  function setBestDistanceKm(km) {
    if (km > getBestDistanceKm()) safeSet(KEYS.best, String(km));
  }

  function getSettings() {
    try {
      const raw = safeGet(KEYS.settings);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s) { safeSet(KEYS.settings, JSON.stringify(s)); }

  function getTutorialSeen() { return safeGet(KEYS.tutorial) === '1'; }
  function setTutorialSeen() { safeSet(KEYS.tutorial, '1'); }

  function getAchievements() {
    try {
      const raw = safeGet(KEYS.achievements);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function unlockAchievement(id) {
    const a = getAchievements();
    if (a[id]) return false;
    a[id] = Date.now();
    safeSet(KEYS.achievements, JSON.stringify(a));
    return true;
  }

  return {
    getBestDistanceKm, setBestDistanceKm,
    getSettings, saveSettings,
    getTutorialSeen, setTutorialSeen,
    getAchievements, unlockAchievement,
  };
})();
