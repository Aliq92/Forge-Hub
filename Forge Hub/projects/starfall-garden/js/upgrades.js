// Milestone upgrades: every 15% Planet Health restored, choose one blessing.
SG.UPGRADES = [
  {
    id: 'magnetic_heart', name: 'Magnetic Heart', icon: '❤', maxPicks: 5,
    desc: 'Increases star-fragment collection radius.',
    apply(p) { p.collectRadius += 20; },
  },
  {
    id: 'swiftstep', name: 'Swiftstep', icon: '➤', maxPicks: 5,
    desc: 'Increases movement speed.',
    apply(p) { p.speedMul += 0.11; },
  },
  {
    id: 'star_dash', name: 'Star Dash', icon: '✦', maxPicks: 4,
    desc: 'Reduces dash cooldown.',
    apply(p) { p.dashCooldownMul = Math.max(0.35, p.dashCooldownMul * 0.8); },
  },
  {
    id: 'deep_reservoir', name: 'Deep Reservoir', icon: '⬡', maxPicks: 5,
    desc: 'Increases maximum energy.',
    apply(p) { p.maxEnergy += 24; p.energy += 24; },
  },
  {
    id: 'living_armor', name: 'Living Armor', icon: '⛨', maxPicks: 5,
    desc: 'Increases maximum health.',
    apply(p) { p.maxHealth += 18; p.health += 18; },
  },
  {
    id: 'celestial_shield', name: 'Celestial Shield', icon: '✡', maxPicks: 4,
    desc: 'Unlocks or strengthens a shield that absorbs one meteor hit.',
    apply(p) { if (!p.shieldEnabled) { p.shieldEnabled = true; p.shieldTimer = 0; } else { p.shieldCooldown = Math.max(6, p.shieldCooldown - 4); } },
  },
  {
    id: 'green_thumb', name: 'Green Thumb', icon: '✿', maxPicks: 4,
    desc: 'Reduces planting costs.',
    apply(p) { p.plantCostMul = Math.max(0.45, p.plantCostMul * 0.85); },
  },
  {
    id: 'root_network', name: 'Root Network', icon: '🜏', maxPicks: 3,
    desc: 'Plants restore nearby terrain more cheaply.',
    apply(p) { p.rootNetworkBonus = true; p.rootNetworkLevel = (p.rootNetworkLevel || 0) + 1; },
  },
  {
    id: 'star_harvest', name: 'Star Harvest', icon: '★', maxPicks: 4,
    desc: 'Fragments have a chance to be worth double.',
    apply(p) { p.fragmentBonusChance = Math.min(0.6, p.fragmentBonusChance + 0.15); },
  },
  {
    id: 'forewarning', name: 'Forewarning', icon: '⏱', maxPicks: 4,
    desc: 'Meteor warnings appear earlier.',
    apply(p) { p.warningTimeBonus += 0.45; },
  },
  {
    id: 'time_bloom', name: 'Time Bloom', icon: '❁', maxPicks: 1,
    desc: 'Planting flora briefly slows nearby meteors.',
    apply(p) { p.timeBloomActive = true; },
  },
  {
    id: 'second_wind', name: 'Second Wind', icon: '♲', maxPicks: 1,
    desc: 'Survive one otherwise-fatal hit per run.',
    apply(p) { p.secondWind = true; },
  },
];

SG.UpgradeManager = class {
  constructor() {
    this.reset();
  }

  reset() {
    this.milestonesTriggered = 0;
    this.pickedCounts = {};
    this.history = [];
  }

  nextThreshold() {
    const t = (this.milestonesTriggered + 1) * SG.CONFIG.upgradeMilestoneStep;
    return t < 100 ? t : null;
  }

  checkMilestone(healthPct) {
    const t = this.nextThreshold();
    if (t !== null && healthPct >= t) { this.milestonesTriggered++; return true; }
    return false;
  }

  rollChoices(count = 3) {
    const eligible = SG.UPGRADES.filter(u => (this.pickedCounts[u.id] || 0) < u.maxPicks);
    const pool = eligible.length >= count ? eligible : SG.UPGRADES;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  apply(id, player) {
    const u = SG.UPGRADES.find(x => x.id === id);
    if (!u) return;
    u.apply(player);
    this.pickedCounts[id] = (this.pickedCounts[id] || 0) + 1;
    this.history.push(id);
  }
};
