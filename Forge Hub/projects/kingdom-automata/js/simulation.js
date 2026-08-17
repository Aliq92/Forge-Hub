// ============================================================
// simulation.js — the world clock: economy, military, expansion,
// diplomacy, war, rebellion, collapse, events.
// ============================================================

const YEAR_TICKS = 12; // 1 tick = 1 month
const EXPANSION_INTERVAL = 3;
const DIPLOMACY_INTERVAL = 2;
const REBELLION_INTERVAL = 4;
const MAX_EVENTS = 600;

const PRESETS = {
  peaceful:  { numKingdoms: 5, conflictLevel: 15, landPercentage: 55, mountainFrequency: 28, resourceAbundance: 32, personalityBias: 'peaceful' },
  balanced:  { numKingdoms: 6, conflictLevel: 45, landPercentage: 55, mountainFrequency: 30, resourceAbundance: 30, personalityBias: 'balanced' },
  warring:   { numKingdoms: 7, conflictLevel: 85, landPercentage: 55, mountainFrequency: 26, resourceAbundance: 28, personalityBias: 'aggressive' },
  fractured: { numKingdoms: 12, conflictLevel: 55, landPercentage: 58, mountainFrequency: 32, resourceAbundance: 30, personalityBias: 'balanced' },
  imperial:  { numKingdoms: 4, conflictLevel: 45, landPercentage: 60, mountainFrequency: 28, resourceAbundance: 34, personalityBias: 'imperial' },
  custom:    {},
};

function pickPersonality(rng, bias) {
  const weights = {
    peaceful:  { TRADER: 3, DEFENSIVE: 2.5, BALANCED: 3, ISOLATIONIST: 1.5, EXPANSIONIST: 1, AGGRESSIVE: 0.4 },
    balanced:  { TRADER: 1.5, DEFENSIVE: 1.5, BALANCED: 2, ISOLATIONIST: 1, EXPANSIONIST: 1.5, AGGRESSIVE: 1.2 },
    aggressive:{ TRADER: 0.6, DEFENSIVE: 1.2, BALANCED: 1, ISOLATIONIST: 0.6, EXPANSIONIST: 1.8, AGGRESSIVE: 2.4 },
    imperial:  { TRADER: 0.7, DEFENSIVE: 1.4, BALANCED: 1, ISOLATIONIST: 0.4, EXPANSIONIST: 2.2, AGGRESSIVE: 1.6 },
  }[bias] || null;
  if (!weights) return rngPick(rng, PERSONALITY_KEYS);
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = rng() * total;
  for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
  return 'BALANCED';
}

class Simulation {
  constructor() {
    this.listeners = { event: [], change: [] };
  }

  init(config) {
    this.config = config;
    this.rng = makeRNG(config.seed);
    this.year = config.startYear ?? 800;
    this.tickCount = 0;
    this.running = false;
    this.speed = 1;

    this.world = generateWorld(config);
    this.kingdoms = new Map();
    this.settlements = new Map();
    this.nextKingdomId = 1;
    this.nextSettlementId = 1;
    this.eventLog = [];
    this.dirty = true;

    this.stats = {
      kingdomsFounded: 0, kingdomsDestroyed: 0, warsFought: 0, rebellions: 0,
      largestEmpireEver: { name: '-', size: 0, year: 0 },
      longestLived: { name: '-', years: 0 },
      mostSuccessfulDynasty: { name: '-', score: 0 },
      highestPopulation: { value: 0, year: 0 },
    };

    this.nameBank = buildNameBank(this.rng, 260);
    this.spawnStartingKingdoms(config.numKingdoms || 6);
  }

  // ---- events -------------------------------------------------------
  addEvent(text, category = 'general', kingdomIds = []) {
    const record = { year: this.yearLabel(), text, category, kingdomIds, t: this.tickCount };
    this.eventLog.push(record);
    if (this.eventLog.length > MAX_EVENTS) this.eventLog.shift();
    for (const fn of this.listeners.event) fn(record);
  }
  onEvent(fn) { this.listeners.event.push(fn); }
  yearLabel() { return Math.floor(this.year); }

  takeName() { return this.nameBank.length ? this.nameBank.pop() : (rngPick(this.rng, NAME_PREFIX) + rngPick(this.rng, NAME_SUFFIX)); }

  // ---- spawning -------------------------------------------------------
  spawnStartingKingdoms(n) {
    const w = this.world;
    const landCells = [];
    for (let i = 0; i < w.terrain.length; i++) {
      if (isLand(w, i) && w.terrain[i] !== TERRAIN.MOUNTAIN) landCells.push(i);
    }
    if (!landCells.length) return;
    const minDist = Math.max(6, Math.floor(Math.min(w.width, w.height) / (Math.sqrt(n) + 1.4)));
    const capitals = [];
    let guard = 0;
    while (capitals.length < n && guard < 4000) {
      guard++;
      const i = rngPick(this.rng, landCells);
      const [x, y] = cellXY(w, i);
      const t = w.terrain[i];
      if (t === TERRAIN.DESERT && this.rng() < 0.7) continue;
      let ok = true;
      for (const c of capitals) { if (dist2(x, y, c.x, c.y) < minDist * minDist) { ok = false; break; } }
      if (ok) capitals.push({ x, y, i });
    }
    for (let k = 0; k < capitals.length; k++) this.foundKingdom(capitals[k], k, capitals.length);
  }

  foundKingdom(capitalCell, index, total) {
    const w = this.world;
    const rng = this.rng;
    const id = this.nextKingdomId++;
    const { color, colorLight } = pickKingdomColor(index, total, rng);
    const name = this.takeName();
    const dynasty = generateDynastyName(rng);
    const ruler = generateRulerName(rng);
    const personality = pickPersonality(rng, PRESETS[this.config.preset]?.personalityBias || 'balanced');

    // Claim starting territory via BFS from capital.
    const targetSize = rngInt(rng, 10, 16);
    const territory = new Set();
    const queue = [capitalCell.i];
    const seen = new Set(queue);
    while (queue.length && territory.size < targetSize) {
      const cur = queue.shift();
      if (isLand(w, cur) && w.owner[cur] === -1) {
        territory.add(cur);
        w.owner[cur] = id;
      }
      for (const nb of neighbors4(w, cur)) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        if (isLand(w, nb)) queue.push(nb);
      }
    }

    const settlementId = this.nextSettlementId++;
    const settlement = new Settlement(settlementId, id, capitalCell.x, capitalCell.y, 'capital', name, this.yearLabel());
    this.settlements.set(settlementId, settlement);
    w.settlementAt[capitalCell.i] = settlementId;

    let popCap = 0;
    for (const c of territory) popCap += TERRAIN_QUALITY[w.terrain[c]] * 380 + (w.resource[c] ? 120 : 0);
    const population = Math.max(1800, Math.round(popCap * rngFloat(rng, 0.4, 0.6)) + settlement.population);

    const kingdom = new Kingdom(id, {
      name, dynasty, ruler, color, colorLight, personality,
      founded: this.yearLabel(),
      capitalSettlementId: settlementId,
      territory,
      population,
      treasury: rngInt(rng, 500, 1400),
      military: Math.round(population * 0.018),
      stability: rngInt(rng, 65, 90),
      tech: rngFloat(rng, 0.9, 1.2),
    });
    this.kingdoms.set(id, kingdom);
    this.stats.kingdomsFounded++;
    this.refreshFrontier(kingdom);
    this.addEvent(`The Kingdom of ${name} was founded, ruled by ${ruler.display} of the House of ${dynasty}.`, 'founding', [id]);
    this.dirty = true;
    return kingdom;
  }

  aliveKingdoms() {
    const out = [];
    for (const k of this.kingdoms.values()) if (k.alive) out.push(k);
    return out;
  }

  // ---- frontier / neighbor cache -------------------------------------
  refreshFrontier(kingdom) {
    const w = this.world;
    const frontierMap = new Map(); // cellIndex -> score
    const neighborIds = new Set();
    const warTargets = new Map(); // enemyId -> cellIndex[]
    const settlementCoords = kingdom.settlements.map(sid => this.settlements.get(sid)).filter(Boolean);

    for (const cell of kingdom.territory) {
      for (const nb of neighbors4(w, cell)) {
        const owner = w.owner[nb];
        if (owner === kingdom.id) continue;
        if (!isLand(w, nb)) continue;
        if (owner === -1) {
          if (!frontierMap.has(nb)) frontierMap.set(nb, this.scoreFrontierCell(kingdom, nb, settlementCoords));
        } else {
          neighborIds.add(owner);
          if (kingdom.isAtWarWith(owner)) {
            if (!warTargets.has(owner)) warTargets.set(owner, []);
            warTargets.get(owner).push(nb);
          }
        }
      }
    }
    kingdom.frontier = [...frontierMap.entries()].map(([i, score]) => ({ i, score })).sort((a, b) => b.score - a.score);
    kingdom.neighborIds = neighborIds;
    kingdom.warTargets = warTargets;
    kingdom.lastFrontierTick = this.tickCount;
  }

  scoreFrontierCell(kingdom, i, settlementCoords) {
    const w = this.world;
    const t = w.terrain[i];
    const quality = TERRAIN_QUALITY[t];
    const cost = TERRAIN_EXPANSION_COST[t];
    if (!isFinite(cost)) return -Infinity;
    const resBonus = w.resource[i] ? 0.6 : 0;
    const riverBonus = w.river[i] ? 0.15 : 0;
    const [x, y] = cellXY(w, i);
    let nearest = Infinity;
    for (const s of settlementCoords) { const d = Math.abs(s.x - x) + Math.abs(s.y - y); if (d < nearest) nearest = d; }
    const distPenalty = clamp((nearest === Infinity ? 0 : nearest) / 22, 0, 1);
    return (quality * 1.3 + resBonus + riverBonus - distPenalty * 0.8) / cost;
  }

  // ---- main tick --------------------------------------------------------
  tick() {
    this.tickCount++;
    this.year += 1 / YEAR_TICKS;
    const kingdoms = this.aliveKingdoms();

    for (const k of kingdoms) this.updateStabilityAndTimers(k);
    for (const k of kingdoms) this.updatePopulation(k);
    for (const k of kingdoms) this.updateEconomy(k);
    for (const k of kingdoms) this.updateMilitaryAndTech(k);

    for (const k of kingdoms) {
      if (this.tickCount - k.lastFrontierTick >= EXPANSION_INTERVAL) this.refreshFrontier(k);
    }
    for (const k of kingdoms) this.expandTerritory(k);
    for (const k of kingdoms) this.trySettle(k);

    if (this.tickCount % DIPLOMACY_INTERVAL === 0) this.updateDiplomacy(kingdoms);
    this.resolveWars(kingdoms);

    if (this.tickCount % REBELLION_INTERVAL === 0) for (const k of kingdoms) this.checkRebellion(k);

    for (const k of kingdoms) this.checkCollapse(k);
    for (const k of kingdoms) this.rollWorldEvent(k);

    this.updateRecords(kingdoms);
    for (const fn of this.listeners.change) fn();
  }

  updateStabilityAndTimers(k) {
    if (k.recentConquestTimer > 0) k.recentConquestTimer--;
    if (k.rebellionCooldown > 0) k.rebellionCooldown--;
    if (k.warCooldown > 0) k.warCooldown--;
    const wars = k.atWarCount();
    const allies = k.allyCount();
    const avgTerritory = this.avgTerritorySize();
    let target = 68
      - wars * 9
      - (k.recentConquestTimer > 0 ? 14 : 0)
      - (k.treasury <= 0 ? 8 : 0)
      + allies * 2.5
      - (avgTerritory > 0 && k.territory.size > avgTerritory * 2.2 ? 8 : 0)
      + (k.personality === 'ISOLATIONIST' ? 4 : 0);
    target = clamp(target, 5, 96);
    k.stability += (target - k.stability) * 0.05 + rngFloat(this.rng, -1, 1);
    k.stability = clamp(k.stability, 0, 100);
    if (k.stability <= 8) k.lowStabilityTimer = (k.lowStabilityTimer || 0) + 1; else k.lowStabilityTimer = 0;
  }

  avgTerritorySize() {
    const alive = this.aliveKingdoms();
    if (!alive.length) return 0;
    let sum = 0; for (const k of alive) sum += k.territory.size;
    return sum / alive.length;
  }

  updatePopulation(k) {
    const w = this.world;
    let cap = 0;
    for (const c of k.territory) cap += TERRAIN_QUALITY[w.terrain[c]] * 380 + (w.resource[c] ? 130 : 0);
    for (const sid of k.settlements) { const s = this.settlements.get(sid); if (s) cap += s.type === 'capital' ? 3200 : s.type === 'city' ? 1800 : 700; }
    k.populationCap = Math.max(cap, 100);

    const wars = k.atWarCount();
    const stabilityFactor = clamp(k.stability / 70, 0.25, 1.25);
    const warPenalty = 1 - Math.min(wars * 0.22, 0.7);
    const base = 0.0042;
    const room = 1 - k.population / k.populationCap;
    let growth = base * k.population * stabilityFactor * warPenalty * room;
    if (k.territory.size === 0) growth = -k.population * 0.18;
    k.population = Math.max(0, k.population + growth);
    if (k.population > k.peakPopulation) k.peakPopulation = k.population;
  }

  updateEconomy(k) {
    const w = this.world;
    let resourceCells = 0;
    for (const c of k.territory) if (w.resource[c]) resourceCells++;
    let settleIncome = 0;
    for (const sid of k.settlements) { const s = this.settlements.get(sid); if (s) settleIncome += s.type === 'capital' ? 40 : s.type === 'city' ? 22 : 9; }
    let allyBonus = 1 + k.allyCount() * 0.06;
    const techBonus = 1 + Math.min(k.tech, 6) * 0.18;
    let income = (k.population * 0.012 + k.territory.size * 1.4 + resourceCells * 3.2 + settleIncome) * techBonus * allyBonus;
    income *= clamp(k.stability / 70, 0.4, 1.2);
    const upkeep = k.military * 0.045 + k.settlements.length * 6 + k.treasury * 0.006; // administrative drag keeps war-chests from growing without bound
    k.income = income - upkeep;
    k.treasury = Math.max(0, k.treasury + k.income);
  }

  updateMilitaryAndTech(k) {
    const traits = k.traits;
    const treasuryFactor = k.treasury > 0 ? 1 : 0.65;
    const target = k.population * 0.021 * traits.militaryInvest * (0.45 + 0.55 * Math.min(k.tech, 3)) * treasuryFactor * clamp(k.stability / 100, 0.3, 1.25);
    k.military += (target - k.military) * 0.14;
    k.military = Math.max(0, k.military);

    const techInc = 0.0016 * clamp(k.stability / 100, 0.3, 1.2) * (0.5 + 0.5 * Math.min(k.treasury / 1200, 1)) / (1 + k.tech * 0.22);
    k.tech += techInc;
  }

  expandTerritory(k) {
    const w = this.world;
    if (!k.frontier.length) return;
    const traits = k.traits;
    const power = clamp(0.12 + k.population / 6500, 0.08, 3.2) * traits.expansionRate * clamp(k.stability / 70, 0.25, 1.4);
    let attempts = Math.floor(power) + (this.rng() < (power % 1) ? 1 : 0);
    attempts = Math.min(attempts, 5);
    const poolSize = Math.min(k.frontier.length, 10);
    for (let a = 0; a < attempts; a++) {
      if (!k.frontier.length) break;
      const pool = k.frontier.slice(0, poolSize).filter(f => w.owner[f.i] === -1);
      if (!pool.length) { k.frontier = k.frontier.filter(f => w.owner[f.i] === -1); break; }
      let totalW = 0; for (const f of pool) totalW += Math.max(f.score, 0.02);
      let r = this.rng() * totalW; let chosen = pool[0];
      for (const f of pool) { r -= Math.max(f.score, 0.02); if (r <= 0) { chosen = f; break; } }
      const cost = TERRAIN_EXPANSION_COST[w.terrain[chosen.i]];
      if (this.rng() > 1 / cost) continue;
      if (w.owner[chosen.i] !== -1) continue;
      w.owner[chosen.i] = k.id;
      k.territory.add(chosen.i);
      if (k.territory.size > k.peakTerritory) k.peakTerritory = k.territory.size;
      k.frontier = k.frontier.filter(f => f.i !== chosen.i);
      for (const nb of neighbors4(w, chosen.i)) {
        if (w.owner[nb] === -1 && isLand(w, nb) && !k.frontier.some(f => f.i === nb)) {
          k.frontier.push({ i: nb, score: this.scoreFrontierCell(k, nb, k.settlements.map(sid => this.settlements.get(sid)).filter(Boolean)) });
        }
      }
      k.frontier.sort((x, y) => y.score - x.score);
      this.dirty = true;
    }
  }

  trySettle(k) {
    if (k.settlementFoundCooldown === undefined) k.settlementFoundCooldown = rngInt(this.rng, 5, 12);
    k.settlementFoundCooldown--;
    if (k.settlementFoundCooldown > 0) return;
    k.settlementFoundCooldown = rngInt(this.rng, 8, 20);
    if (k.territory.size < 6) return;
    if (k.population < k.settlements.length * 2600) return;
    if (k.treasury < 260) return;
    if (k.settlements.length >= 3 + Math.sqrt(k.territory.size) * 1.4) return; // settlement density stays plausible even for huge empires

    const w = this.world;
    const existing = k.settlements.map(sid => this.settlements.get(sid)).filter(Boolean);
    let best = null, bestScore = -Infinity;
    for (const c of k.territory) {
      if (w.settlementAt[c] !== -1) continue;
      const t = w.terrain[c];
      if (t === TERRAIN.WATER) continue;
      const [x, y] = cellXY(w, c);
      let minDist = Infinity;
      for (const s of existing) { const d = Math.abs(s.x - x) + Math.abs(s.y - y); if (d < minDist) minDist = d; }
      if (minDist < 3) continue;
      const score = TERRAIN_QUALITY[t] + (w.resource[c] ? 0.8 : 0) + (w.river[c] ? 0.3 : 0) + Math.min(minDist, 12) * 0.05 + this.rng() * 0.3;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best == null) return;
    k.treasury -= 250;
    const [x, y] = cellXY(w, best);
    const type = existing.length < 2 && k.population > 6000 && this.rng() < 0.5 ? 'city' : (this.rng() < 0.32 ? 'city' : 'town');
    const id = this.nextSettlementId++;
    const name = generateSettlementName(this.rng, this.nameBank);
    const settlement = new Settlement(id, k.id, x, y, type, name, this.yearLabel());
    this.settlements.set(id, settlement);
    w.settlementAt[best] = id;
    k.settlements.push(id);
    this.addEvent(`The ${type} of ${name} was founded in the Kingdom of ${k.name}.`, 'settlement', [k.id]);
    this.dirty = true;
  }

  // ---- diplomacy --------------------------------------------------------
  updateDiplomacy(kingdoms) {
    const conflict = clamp(this.config.conflictLevel ?? 45, 0, 100) / 100;
    for (const a of kingdoms) {
      if (!a.neighborIds) continue;
      for (const bid of a.neighborIds) {
        const b = this.kingdoms.get(bid);
        if (!b || !b.alive || bid < a.id) continue; // process each pair once (a.id < bid handled from lower id side too) — use id ordering
        this.updatePairRelation(a, b, conflict);
      }
    }
    // ensure every neighbor pair processed once regardless of id ordering above quirk
    for (const a of kingdoms) {
      if (!a.neighborIds) continue;
      for (const bid of a.neighborIds) {
        const b = this.kingdoms.get(bid);
        if (!b || !b.alive) continue;
        if (a.id > bid) this.updatePairRelation(b, a, conflict, true);
      }
    }
  }

  updatePairRelation(a, b, conflict, skipIfRecentlyDone) {
    const relA = a.relationWith(b.id), relB = b.relationWith(a.id);
    if (relA.status === REL_STATUS.WAR) return;
    if (relA._lastUpdateTick === this.tickCount) return;
    relA._lastUpdateTick = relB._lastUpdateTick = this.tickCount;

    const tA = a.traits, tB = b.traits;
    let delta = rngFloat(this.rng, -0.5, 0.5) * (0.35 + conflict * 0.5);
    delta -= (tA.warChance + tB.warChance - 2) * 0.22 * conflict;
    delta += (tA.diplomacyChance + tB.diplomacyChance - 2) * 0.35;
    delta -= (tA.isolation + tB.isolation - 1) * 0.12;
    if (relA.allied) delta += 0.4;
    delta -= relA.value * 0.008; // slow mean-reversion — lets personality-driven trends persist for decades without freezing forever at the extremes
    relA.value = clamp(relA.value + delta, -100, 100);
    relB.value = relA.value;

    this.updateStatusLabel(relA); this.updateStatusLabel(relB);

    // Alliance formation
    if (!relA.allied && !relA.atWar && relA.value >= 28) {
      const chance = 0.035 * tA.allianceChance * tB.allianceChance;
      if (rngChance(this.rng, chance)) {
        relA.allied = relB.allied = true;
        relA.allianceSince = relB.allianceSince = this.yearLabel();
        this.updateStatusLabel(relA); this.updateStatusLabel(relB);
        this.addEvent(`${a.name} and ${b.name} formed an alliance.`, 'diplomacy', [a.id, b.id]);
      }
    } else if (relA.allied && relA.value < 5) {
      const chance = 0.03;
      if (rngChance(this.rng, chance)) {
        relA.allied = relB.allied = false;
        this.updateStatusLabel(relA); this.updateStatusLabel(relB);
        this.addEvent(`The alliance between ${a.name} and ${b.name} broke down.`, 'diplomacy', [a.id, b.id]);
      }
    }

    // War declaration
    if (!relA.allied && !relA.atWar && a.warCooldown <= 0 && b.warCooldown <= 0) {
      const strengthRatio = (a.military + 1) / (b.military + 1);
      let chance = 0.006 * conflict * tA.warChance;
      if (relA.value < -30) chance *= 2.2;
      if (strengthRatio > 1.4) chance *= 1.6;
      if (strengthRatio < 0.7) chance *= 0.35;
      chance *= clamp(a.stability / 70, 0.4, 1.3);
      if (rngChance(this.rng, chance)) this.declareWar(a, b);
    }
  }

  updateStatusLabel(rel) {
    if (rel.atWar) { rel.status = REL_STATUS.WAR; return; }
    if (rel.allied) { rel.status = REL_STATUS.ALLIED; return; }
    if (rel.value >= 15) rel.status = REL_STATUS.FRIENDLY;
    else if (rel.value <= -15) rel.status = REL_STATUS.HOSTILE;
    else rel.status = REL_STATUS.NEUTRAL;
  }

  declareWar(a, b, silent) {
    const relA = a.relationWith(b.id), relB = b.relationWith(a.id);
    if (relA.atWar) return;
    relA.atWar = relB.atWar = true;
    relA.allied = relB.allied = false;
    relA.warSince = relB.warSince = this.yearLabel();
    relA.warExhaustionSelf = relA.warExhaustionOther = relB.warExhaustionSelf = relB.warExhaustionOther = 0;
    this.updateStatusLabel(relA); this.updateStatusLabel(relB);
    this.stats.warsFought++;
    if (!silent) this.addEvent(`${a.name} declared war on ${b.name}.`, 'war', [a.id, b.id]);
    this.refreshFrontier(a); this.refreshFrontier(b);

    for (const allyId of a.neighborIds || []) {
      const ally = this.kingdoms.get(allyId);
      if (ally && ally.alive && a.isAlliedWith(allyId) && !ally.isAtWarWith(b.id) && rngChance(this.rng, 0.35)) {
        this.declareWar(ally, b, true);
        this.addEvent(`${ally.name} joined the war in support of ${a.name}.`, 'war', [ally.id, a.id, b.id]);
      }
    }
  }

  makePeace(a, b, reason) {
    const relA = a.relationWith(b.id), relB = b.relationWith(a.id);
    if (!relA.atWar) return;
    relA.atWar = relB.atWar = false;
    relA.value = relB.value = -20;
    a.warCooldown = b.warCooldown = rngInt(this.rng, 10, 24);
    this.updateStatusLabel(relA); this.updateStatusLabel(relB);
    this.addEvent(`${a.name} and ${b.name} signed a peace treaty${reason ? ' ' + reason : ''}.`, 'peace', [a.id, b.id]);
  }

  // ---- war resolution --------------------------------------------------
  resolveWars(kingdoms) {
    for (const a of kingdoms) {
      if (!a.warTargets) continue;
      for (const [enemyId, cells] of a.warTargets) {
        const b = this.kingdoms.get(enemyId);
        if (!b || !b.alive || !a.isAtWarWith(enemyId)) continue;
        this.resolveWarFront(a, b, cells);
      }
    }
    for (const a of kingdoms) {
      for (const [enemyId, rel] of a.relations) {
        if (rel.atWar) {
          rel.warExhaustionSelf += 1;
          const b = this.kingdoms.get(enemyId);
          if (!b || !b.alive) continue;
          const exhaustionChance = clamp((rel.warExhaustionSelf - 10) * 0.01, 0, 0.25) + (a.stability < 20 ? 0.05 : 0);
          if (rngChance(this.rng, exhaustionChance)) { this.makePeace(a, b, 'after prolonged conflict'); }
        }
      }
    }
  }

  resolveWarFront(a, b, cells) {
    const w = this.world;
    const valid = cells.filter(c => w.owner[c] === b.id);
    if (!valid.length) return;
    const aPower = a.military * (0.55 + 0.45 * Math.min(a.tech, 3)) / Math.max(1, Math.sqrt(a.territory.size));
    const bPower = b.military * (0.55 + 0.45 * Math.min(b.tech, 3)) / Math.max(1, Math.sqrt(b.territory.size));
    const cap = Math.min(valid.length, 5);
    for (let i = 0; i < cap; i++) {
      const cell = valid[Math.floor(this.rng() * valid.length)];
      if (w.owner[cell] !== b.id) continue;
      const terrain = w.terrain[cell];
      const isCapital = w.settlementAt[cell] !== -1 && this.settlements.get(w.settlementAt[cell])?.type === 'capital';
      let defenseMod = terrain === TERRAIN.MOUNTAIN ? 2.2 : terrain === TERRAIN.FOREST ? 1.3 : 1.0;
      if (isCapital) defenseMod *= 2.4;
      const diff = (aPower - bPower * defenseMod) / (aPower + bPower * defenseMod + 0.001);
      const captureProb = clamp(0.05 + diff * 0.22, 0.005, 0.4);
      if (this.rng() < captureProb) this.captureCell(a, b, cell);
    }
  }

  captureCell(a, b, cell) {
    const w = this.world;
    w.owner[cell] = a.id;
    b.territory.delete(cell);
    a.territory.add(cell);
    if (a.territory.size > a.peakTerritory) a.peakTerritory = a.territory.size;
    b.population = Math.max(0, b.population - b.population * 0.004);
    a.recentConquestTimer = 18;
    const relA = a.relationWith(b.id), relB = b.relationWith(a.id);
    relA.warExhaustionSelf += 1; relB.warExhaustionSelf += 2;

    const sid = w.settlementAt[cell];
    if (sid !== -1) {
      const s = this.settlements.get(sid);
      if (s) {
        s.kingdomId = a.id;
        b.settlements = b.settlements.filter(x => x !== sid);
        a.settlements.push(sid);
        if (s.type === 'capital') this.handleCapitalCapture(a, b, s);
      }
    }
    this.dirty = true;
  }

  handleCapitalCapture(a, b, oldCapitalSettlement) {
    this.addEvent(`The capital of ${b.name} has fallen to ${a.name}!`, 'capital', [a.id, b.id]);
    b.stability = clamp(b.stability - 38, 0, 100);
    a.treasury += Math.min(600, b.treasury * 0.3);
    b.treasury *= 0.6;

    const remaining = b.settlements.map(sid => this.settlements.get(sid)).filter(Boolean);
    if (remaining.length && b.territory.size > 0) {
      remaining.sort((x, y) => (y.type === 'city' ? 1 : 0) - (x.type === 'city' ? 1 : 0));
      const newCap = remaining[0];
      newCap.type = 'capital';
      b.capitalSettlementId = newCap.id;
      this.addEvent(`${newCap.name} was proclaimed the new capital of ${b.name}.`, 'capital', [b.id]);
      if (rngChance(this.rng, 0.4)) this.makePeace(a, b, 'after the loss of the capital');
    } else {
      b.capitalSettlementId = null;
    }
    if (rngChance(this.rng, 0.3)) { b.rebellionCooldown = 0; b.stability -= 10; }
  }

  // ---- rebellion --------------------------------------------------------
  checkRebellion(k) {
    if (k.rebellionCooldown > 0) return;
    if (k.territory.size < 22 || k.settlements.length < 2) return;
    const avgT = this.avgTerritorySize();
    let p = 0;
    if (k.stability < 30) p += (30 - k.stability) * 0.00015;
    if (avgT > 0 && k.territory.size > avgT * 2) p += 0.0015;
    if (k.recentConquestTimer > 0) p += 0.0012;
    let warExh = 0; for (const r of k.relations.values()) if (r.atWar) warExh += r.warExhaustionSelf;
    if (warExh > 25) p += 0.0015;
    p = clamp(p, 0, 0.012);
    if (!rngChance(this.rng, p)) return;
    this.triggerRebellion(k);
  }

  triggerRebellion(k) {
    const w = this.world;
    const capitalSettlement = this.settlements.get(k.capitalSettlementId);
    if (!capitalSettlement) return;
    const capitalCell = cellIndex(w, capitalSettlement.x, capitalSettlement.y);

    // BFS distance from capital across kingdom's own territory
    const dist = new Map([[capitalCell, 0]]);
    const q = [capitalCell];
    while (q.length) {
      const cur = q.shift();
      for (const nb of neighbors4(w, cur)) {
        if (k.territory.has(nb) && !dist.has(nb)) { dist.set(nb, dist.get(cur) + 1); q.push(nb); }
      }
    }
    const candidateSettlements = k.settlements
      .map(sid => this.settlements.get(sid))
      .filter(s => s && s.id !== k.capitalSettlementId && dist.has(cellIndex(w, s.x, s.y)))
      .sort((a, b) => dist.get(cellIndex(w, b.x, b.y)) - dist.get(cellIndex(w, a.x, a.y)));
    if (!candidateSettlements.length) { k.rebellionCooldown = 20; return; }
    const seed = candidateSettlements[0];
    const threshold = Math.max(1, Math.floor(dist.get(cellIndex(w, seed.x, seed.y)) * 0.55));

    const region = new Set();
    for (const [cell, d] of dist) if (d >= threshold) region.add(cell);
    if (region.size < 3 || region.size >= k.territory.size) { k.rebellionCooldown = 20; return; }

    const regionSettlements = k.settlements
      .map(sid => this.settlements.get(sid))
      .filter(s => s && region.has(cellIndex(w, s.x, s.y)));
    if (!regionSettlements.length) { k.rebellionCooldown = 20; return; }

    // Build new kingdom
    const rng = this.rng;
    const id = this.nextKingdomId++;
    const total = this.kingdoms.size + 3;
    const { color, colorLight } = pickKingdomColor(id, total, rng);
    const name = this.takeName();
    const dynasty = generateDynastyName(rng);
    const ruler = generateRulerName(rng);
    const personality = pickPersonality(rng, PRESETS[this.config.preset]?.personalityBias || 'balanced');

    const fraction = region.size / k.territory.size;
    for (const cell of region) { w.owner[cell] = id; k.territory.delete(cell); }
    for (const s of regionSettlements) { s.kingdomId = id; k.settlements = k.settlements.filter(sid => sid !== s.id); }
    regionSettlements.sort((a, b) => (b.type === 'city' ? 1 : 0) - (a.type === 'city' ? 1 : 0));
    regionSettlements[0].type = 'capital';

    const newKingdom = new Kingdom(id, {
      name, dynasty, ruler, color, colorLight, personality,
      founded: this.yearLabel(),
      capitalSettlementId: regionSettlements[0].id,
      territory: region,
      population: Math.max(400, k.population * fraction),
      treasury: Math.max(100, k.treasury * fraction * 0.6),
      military: Math.max(20, k.military * fraction * 0.5),
      stability: rngInt(rng, 52, 68),
      tech: k.tech * 0.92,
    });
    newKingdom.settlements = regionSettlements.map(s => s.id);
    this.kingdoms.set(id, newKingdom);
    this.stats.kingdomsFounded++;
    this.stats.rebellions++;

    k.population = Math.max(0, k.population - newKingdom.population);
    k.treasury = Math.max(0, k.treasury - newKingdom.treasury);
    k.military = Math.max(0, k.military - newKingdom.military);
    k.stability = clamp(k.stability + 16, 0, 100);
    k.rebellionCooldown = 100;
    newKingdom.rebellionCooldown = 80;

    const relParent = k.relationWith(id), relNew = newKingdom.relationWith(k.id);
    relParent.value = relNew.value = -35;
    this.updateStatusLabel(relParent); this.updateStatusLabel(relNew);

    this.refreshFrontier(k);
    this.refreshFrontier(newKingdom);
    this.addEvent(`Rebellion in ${k.name} gave rise to the Kingdom of ${name}, led by ${ruler.display}.`, 'rebellion', [k.id, id]);
    this.dirty = true;
  }

  // ---- collapse ----------------------------------------------------------
  checkCollapse(k) {
    if (!k.alive) return;
    const dead = k.territory.size === 0 || k.population < 40 || k.settlements.length === 0 || (k.lowStabilityTimer || 0) > 30;
    if (!dead) return;
    k.alive = false;
    k.diedYear = this.yearLabel();
    k.diedCause = k.territory.size === 0 ? 'loss of all territory' : k.population < 40 ? 'famine and depopulation' : 'total internal collapse';
    for (const sid of k.settlements) { const s = this.settlements.get(sid); if (s) this.world.settlementAt[cellIndex(this.world, s.x, s.y)] = -1; }
    for (const c of k.territory) this.world.owner[c] = -1;
    k.territory.clear();
    for (const [otherId, rel] of k.relations) { if (rel.atWar) { const other = this.kingdoms.get(otherId); if (other) { rel.atWar = false; const r2 = other.relationWith(k.id); r2.atWar = false; } } }
    this.stats.kingdomsDestroyed++;
    const lifespan = k.diedYear - k.founded;
    if (lifespan > this.stats.longestLived.years) this.stats.longestLived = { name: k.name, years: Math.round(lifespan) };
    this.addEvent(`${k.name} collapsed after ${Math.round(lifespan)} years (${k.diedCause}).`, 'collapse', [k.id]);
    this.dirty = true;
  }

  // ---- world events --------------------------------------------------------
  rollWorldEvent(k) {
    const chance = 0.006 + (k.stability < 35 ? 0.006 : 0);
    if (!rngChance(this.rng, chance)) return;
    const roll = this.rng();
    if (roll < 0.2) {
      k.population += k.population * 0.03; k.treasury += k.treasury * 0.1 + 100;
      this.addEvent(`A bountiful harvest boosts population and treasury in ${k.name}.`, 'event', [k.id]);
    } else if (roll < 0.36) {
      k.population = Math.max(0, k.population - k.population * 0.04);
      this.addEvent(`Drought strikes ${k.name}, straining its people.`, 'event', [k.id]);
    } else if (roll < 0.5) {
      k.population = Math.max(0, k.population - k.population * 0.11);
      k.stability = clamp(k.stability - 6, 0, 100);
      this.addEvent(`Plague sweeps through ${k.name}.`, 'event', [k.id]);
    } else if (roll < 0.68) {
      k.treasury += 350 + k.territory.size * 18;
      this.addEvent(`A gold discovery enriches the treasury of ${k.name}.`, 'event', [k.id]);
    } else if (roll < 0.85) {
      k.stability = clamp(k.stability - 13, 0, 100);
      this.addEvent(`Civil unrest grips ${k.name}.`, 'event', [k.id]);
    } else {
      k.military *= 1.14; k.tech += 0.04;
      this.addEvent(`${k.name} undergoes sweeping military reforms.`, 'event', [k.id]);
    }
  }

  updateRecords(kingdoms) {
    let totalPop = 0;
    for (const k of kingdoms) {
      totalPop += k.population;
      if (k.territory.size > this.stats.largestEmpireEver.size) this.stats.largestEmpireEver = { name: k.name, size: k.territory.size, year: this.yearLabel() };
      const dynastyScore = (this.year - k.founded) * (1 + k.territory.size * 0.01);
      if (dynastyScore > this.stats.mostSuccessfulDynasty.score) this.stats.mostSuccessfulDynasty = { name: k.dynasty, score: dynastyScore };
    }
    if (totalPop > this.stats.highestPopulation.value) this.stats.highestPopulation = { value: totalPop, year: this.yearLabel() };
  }

  // ---- observer tools --------------------------------------------------------
  observerCreateKingdom() {
    const w = this.world;
    const free = [];
    for (let i = 0; i < w.terrain.length; i++) if (isLand(w, i) && w.owner[i] === -1 && w.terrain[i] !== TERRAIN.MOUNTAIN) free.push(i);
    if (!free.length) { this.addEvent('No unclaimed land remains for a new kingdom to arise.', 'general'); return; }
    const i = rngPick(this.rng, free);
    const [x, y] = cellXY(w, i);
    const k = this.foundKingdom({ x, y, i }, this.kingdoms.size, this.kingdoms.size + 1);
    return k;
  }
  observerDestroyKingdom(id) {
    const k = this.kingdoms.get(id);
    if (!k || !k.alive) return;
    k.territory.clear();
    k.population = 0;
    k.settlements = [];
    this.checkCollapse(k);
  }
  observerAdjustStability(id, delta) { const k = this.kingdoms.get(id); if (k) k.stability = clamp(k.stability + delta, 0, 100); }
  observerAddPopulation(id, amount) { const k = this.kingdoms.get(id); if (k) k.population = Math.max(0, k.population + amount); }
  observerGiveWealth(id, amount) { const k = this.kingdoms.get(id); if (k) k.treasury = Math.max(0, k.treasury + amount); }
  observerStartWar(idA, idB) {
    const a = this.kingdoms.get(idA), b = this.kingdoms.get(idB);
    if (a && b && a.alive && b.alive && a.id !== b.id) this.declareWar(a, b);
  }
  observerForcePeace(idA, idB) {
    const a = this.kingdoms.get(idA), b = this.kingdoms.get(idB);
    if (a && b) this.makePeace(a, b, 'by decree');
  }
  observerCreateRebellion(id) {
    const k = this.kingdoms.get(id);
    if (k && k.alive) { k.rebellionCooldown = 0; k.stability = Math.min(k.stability, 25); this.triggerRebellion(k); }
  }

  // ---- summary --------------------------------------------------------
  getSummary() {
    return {
      yearsSimulated: Math.round(this.year - (this.config.startYear ?? 800)),
      kingdomsFounded: this.stats.kingdomsFounded,
      kingdomsDestroyed: this.stats.kingdomsDestroyed,
      warsFought: this.stats.warsFought,
      rebellions: this.stats.rebellions,
      largestEmpireEver: this.stats.largestEmpireEver,
      longestLived: this.stats.longestLived,
      mostSuccessfulDynasty: this.stats.mostSuccessfulDynasty,
      highestPopulation: this.stats.highestPopulation,
      livingKingdoms: this.aliveKingdoms().length,
    };
  }
}
