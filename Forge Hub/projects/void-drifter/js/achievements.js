// ---------------- Local achievements (optional, persisted via SaveData) ----------------
const ACHIEVEMENT_DEFS = [
  { id: 'first_flight', name: 'FIRST FLIGHT', desc: 'Travel 5 km.', check: (s) => s.distanceKm >= 5 },
  { id: 'drifter', name: 'DRIFTER', desc: 'Travel 25 km.', check: (s) => s.distanceKm >= 25 },
  { id: 'void_runner', name: 'VOID RUNNER', desc: 'Travel 100 km.', check: (s) => s.distanceKm >= 100 },
  { id: 'scrapper', name: 'SCRAPPER', desc: 'Collect 100 salvage.', check: (s) => s.salvageCollectedTotal >= 100 },
  { id: 'too_close', name: 'TOO CLOSE', desc: 'Survive a critical collision.', check: (s) => s.criticalCollisionSurvived },
  { id: 'empty_tank', name: 'EMPTY TANK', desc: 'Travel 2 km after running out of fuel.', check: (s) => s.distanceSinceFuelEmptyKm >= 2 },
];

class AchievementTracker {
  constructor() {
    this.unlocked = SaveData.getAchievements();
  }
  update(stats, onUnlock) {
    for (const def of ACHIEVEMENT_DEFS) {
      if (this.unlocked[def.id]) continue;
      if (def.check(stats)) {
        SaveData.unlockAchievement(def.id);
        this.unlocked[def.id] = Date.now();
        if (onUnlock) onUnlock(def);
      }
    }
  }
}
