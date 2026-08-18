// localStorage persistence for settings, best progress and achievements.
import { DEFAULT_SETTINGS } from './config.js';

const KEY_SETTINGS = 'lv_settings';
const KEY_PROGRESS = 'lv_progress';
const KEY_ACHIEVEMENTS = 'lv_achievements';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY_PROGRESS);
    if (!raw) return { bestShrines: 0, bestTimeSec: null, victories: 0, totalFireflies: 0, hiddenPathsFound: 0 };
    return JSON.parse(raw);
  } catch (e) { return { bestShrines: 0, bestTimeSec: null, victories: 0, totalFireflies: 0, hiddenPathsFound: 0 }; }
}

export function saveProgress(progress) {
  try { localStorage.setItem(KEY_PROGRESS, JSON.stringify(progress)); } catch (e) { /* ignore */ }
}

export function loadAchievements() {
  try {
    const raw = localStorage.getItem(KEY_ACHIEVEMENTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function saveAchievements(ach) {
  try { localStorage.setItem(KEY_ACHIEVEMENTS, JSON.stringify(ach)); } catch (e) { /* ignore */ }
}
