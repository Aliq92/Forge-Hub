const STORAGE_KEY = 'beatFoundry.project.v1';
const AUTOSAVE_KEY = 'beatFoundry.autosave.v1';

export function saveProject(state, key = STORAGE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadProject(key = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function hasSavedProject(key = STORAGE_KEY) {
  return !!localStorage.getItem(key);
}

let autosaveTimer = null;
export function scheduleAutosave(state, onSaved) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveProject(state, STORAGE_KEY);
    if (onSaved) onSaved();
  }, 1000);
}

export function loadAutosave() {
  return loadProject(AUTOSAVE_KEY);
}

export { STORAGE_KEY, AUTOSAVE_KEY };
