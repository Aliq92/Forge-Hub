// ============================================================
// kingdom.js — Kingdom & Settlement data model, personalities
// ============================================================

const PERSONALITIES = {
  AGGRESSIVE:   { label: 'Aggressive',   warChance: 1.8, expansionRate: 1.2, diplomacyChance: 0.7, militaryInvest: 1.4, allianceChance: 0.6, isolation: 0.3 },
  EXPANSIONIST: { label: 'Expansionist', warChance: 1.1, expansionRate: 1.8, diplomacyChance: 0.9, militaryInvest: 1.1, allianceChance: 0.8, isolation: 0.4 },
  TRADER:       { label: 'Trader',       warChance: 0.5, expansionRate: 0.8, diplomacyChance: 1.6, militaryInvest: 0.7, allianceChance: 1.5, isolation: 0.2 },
  DEFENSIVE:    { label: 'Defensive',    warChance: 0.6, expansionRate: 0.7, diplomacyChance: 1.0, militaryInvest: 1.5, allianceChance: 1.0, isolation: 0.5 },
  ISOLATIONIST: { label: 'Isolationist', warChance: 0.5, expansionRate: 0.9, diplomacyChance: 0.3, militaryInvest: 1.1, allianceChance: 0.3, isolation: 1.6 },
  BALANCED:     { label: 'Balanced',     warChance: 1.0, expansionRate: 1.0, diplomacyChance: 1.0, militaryInvest: 1.0, allianceChance: 1.0, isolation: 0.6 },
};
const PERSONALITY_KEYS = Object.keys(PERSONALITIES);

const REL_STATUS = { NEUTRAL: 'neutral', FRIENDLY: 'friendly', ALLIED: 'allied', HOSTILE: 'hostile', WAR: 'war' };

class Settlement {
  constructor(id, kingdomId, x, y, type, name, year) {
    this.id = id;
    this.kingdomId = kingdomId;
    this.x = x; this.y = y;
    this.type = type; // 'capital' | 'city' | 'town'
    this.name = name;
    this.founded = year;
    this.population = type === 'capital' ? 4200 : type === 'city' ? 2200 : 900;
  }
}

class Kingdom {
  constructor(id, opts) {
    this.id = id;
    this.name = opts.name;
    this.dynasty = opts.dynasty;
    this.ruler = opts.ruler;
    this.color = opts.color;
    this.colorLight = opts.colorLight;
    this.personality = opts.personality;
    this.founded = opts.founded;
    this.alive = true;
    this.diedYear = null;
    this.diedCause = null;

    this.capitalSettlementId = opts.capitalSettlementId;
    this.settlements = [opts.capitalSettlementId];
    this.territory = new Set(opts.territory || []);

    this.population = opts.population;
    this.treasury = opts.treasury;
    this.military = opts.military;
    this.stability = opts.stability;
    this.tech = opts.tech ?? 1.0;

    this.relations = new Map(); // kingdomId -> {value, status, warExhaustionSelf, warExhaustionOther, allianceSince, warSince}

    this.recentConquestTimer = 0; // ticks remaining where "recent conquest" instability applies
    this.warExhaustionAccum = 0;
    this.rebellionCooldown = 0;
    this.warCooldown = 0;
    this.lowStabilityTimer = 0;
    this.lastFrontierTick = -999;
    this.frontier = [];      // cached list of {i, score} unowned candidate cells
    this.warFrontier = [];   // cached list of contested enemy-owned cells by enemy id: Map enemyId -> [cells]

    this.peakPopulation = opts.population;
    this.peakTerritory = this.territory.size;

    this.settlementFoundCooldown = rngInt_seeded(opts.rngSeedTick || 0, 5, 14);
  }

  get traits() { return PERSONALITIES[this.personality]; }

  relationWith(otherId) {
    if (!this.relations.has(otherId)) {
      this.relations.set(otherId, { value: 0, status: REL_STATUS.NEUTRAL, warExhaustionSelf: 0, warExhaustionOther: 0, allianceSince: null, warSince: null });
    }
    return this.relations.get(otherId);
  }

  isAtWarWith(otherId) {
    const r = this.relations.get(otherId);
    return !!r && r.status === REL_STATUS.WAR;
  }
  isAlliedWith(otherId) {
    const r = this.relations.get(otherId);
    return !!r && r.status === REL_STATUS.ALLIED;
  }

  atWarCount() {
    let c = 0;
    for (const r of this.relations.values()) if (r.status === REL_STATUS.WAR) c++;
    return c;
  }
  allyCount() {
    let c = 0;
    for (const r of this.relations.values()) if (r.status === REL_STATUS.ALLIED) c++;
    return c;
  }
}

function rngInt_seeded(seedTick, min, max) {
  return min + Math.floor(((seedTick * 9301 + 49297) % 233280) / 233280 * (max - min + 1));
}

function pickKingdomColor(index, total, rng) {
  const hue = (distinctHue(index, total) + rngFloat(rng, -10, 10) + 360) % 360;
  const sat = rngFloat(rng, 62, 82);
  const light = rngFloat(rng, 46, 58);
  return { color: hslToHex(hue, sat, light), colorLight: hslToHex(hue, Math.max(sat - 10, 30), Math.min(light + 22, 82)) };
}
