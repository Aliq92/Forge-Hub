// Small math / helper utilities.
SG.util = {
  clamp(v, min, max) { return v < min ? min : v > max ? max : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(this.rand(min, max + 1)); },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  weightedChoice(entries) {
    // entries: [{item, weight}]
    let total = 0;
    for (const e of entries) total += e.weight;
    let r = Math.random() * total;
    for (const e of entries) { r -= e.weight; if (r <= 0) return e.item; }
    return entries[entries.length - 1].item;
  },
  TAU: Math.PI * 2,
  angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInCubic(t) { return t * t * t; },
  easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  },
  hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },
  rgba(hex, a) {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },
};

SG.storage = {
  KEY: 'starfallGarden.save.v1',
  defaults() {
    return {
      settings: { musicVol: 60, sfxVol: 70, screenShake: true, particles: 'medium', reducedMotion: false, showFPS: false },
      stats: { bestRestoration: 0, bestTimeVictory: null, victoryAchieved: false, achievements: [] },
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw);
      return Object.assign(this.defaults(), parsed, {
        settings: Object.assign(this.defaults().settings, parsed.settings || {}),
        stats: Object.assign(this.defaults().stats, parsed.stats || {}),
      });
    } catch (e) { return this.defaults(); }
  },
  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },
};
