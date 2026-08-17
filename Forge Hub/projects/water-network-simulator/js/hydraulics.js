/* hydraulics.js
   Simplified iterative hydraulic solver ("linear theory" style relaxation).
   Not a certified EPANET-equivalent solver -- built for plausible,
   numerically stable, educational behaviour. */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';
  const C = WNS.Components;
  const H = C.HYD;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v) { return Number.isFinite(v) ? v : 0; }

  function pipeBaseResistance(pipe) {
    const d = Math.max(pipe.diameter, 10);
    const L = Math.max(pipe.length, 1);
    return H.PIPE_K * L / Math.pow(d, H.DIAM_EXP);
  }

  function pipeCapacity(pipe) {
    const d = Math.max(pipe.diameter, 1);
    return 1.5708 * d * d / 1000; // L/s, assumes ~2 m/s design velocity
  }

  // Daily demand multiplier curve, hour in [0,24).
  function dailyMultiplier(hour) {
    const h = ((hour % 24) + 24) % 24;
    const base = 0.55
      + 0.55 * Math.exp(-Math.pow((h - 7.5) / 1.6, 2))   // morning peak
      + 0.65 * Math.exp(-Math.pow((h - 19) / 2.0, 2))    // evening peak
      + 0.15 * Math.exp(-Math.pow((h - 13) / 3.0, 2));   // daytime bump
    const overnight = h < 5 || h > 23 ? 0.4 : 1;
    return clamp(base * (overnight === 0.4 ? 0.7 : 1), 0.25, 1.9);
  }
  WNS.dailyMultiplier = dailyMultiplier;

  function effectivePipeResistance(pipe, network) {
    const base = pipeBaseResistance(pipe);
    let mult = 1;
    const from = network.getNode(pipe.from);
    const to = network.getNode(pipe.to);
    for (const n of [from, to]) {
      if (n && n.type === 'valve') {
        const open = clamp(n.open, 0, 100) / 100;
        if (open <= H.VALVE_MIN_OPEN) return Infinity;
        mult *= 1 / (open * open);
      }
    }
    if (pipe.broken) mult *= H.BREAK_R_MULT;
    return base * mult;
  }

  function demandFor(node, network) {
    let d = node.baseDemand;
    if (node.surgeActive) d *= node.surgeMultiplier;
    if (network.demandMode === 'daily') d *= dailyMultiplier(network.simHours);
    return Math.max(0, d);
  }

  function leakFlowEstimate(pipe, headGuess) {
    if (!pipe.leak || !pipe.leak.active || !pipe.enabled || pipe.broken) return 0;
    const h = Math.max(headGuess, 0);
    return H.LEAK_COEFF * pipe.leak.severity * Math.sqrt(h + 0.5);
  }

  // Main entry point: advances hydraulics + tank storage by dtSeconds
  // (dtSeconds is *simulation* time, already scaled by simulation speed).
  function solve(network, dtSeconds) {
    const nodes = Array.from(network.nodes.values());
    const pipes = Array.from(network.pipes.values());
    if (nodes.length === 0) { network.stats = emptyStats(network); network.warnings = []; return; }

    const fixed = {};   // id -> head
    const varIds = [];
    for (const n of nodes) {
      if (n.type === 'reservoir') {
        const lossFactor = n.sourceLossActive ? n.sourceLossFactor : 1;
        fixed[n.id] = n.sourceHead * lossFactor;
      } else if (n.type === 'tank') {
        const level = n.minLevel + (n.currentVolume / Math.max(n.capacity, 1)) * (n.maxLevel - n.minLevel);
        fixed[n.id] = n.elevation + level;
      } else {
        varIds.push(n.id);
      }
    }

    // Warm-start heads/flows from previous tick where possible.
    const head = {};
    for (const n of nodes) head[n.id] = Number.isFinite(n.head) ? n.head : (fixed[n.id] || 20);
    Object.assign(head, fixed);

    // Pump nodes are re-derived from scratch each tick (see the phase-1/
    // phase-2 lock below): starting them from *last tick's already-boosted*
    // head would bias the "un-boosted" phase-1 settle toward that boosted
    // value and let the boost compound tick after tick. Give them a neutral
    // starting guess instead (average of the network's fixed head sources).
    const fixedVals = Object.values(fixed);
    const neutralHead = fixedVals.length ? fixedVals.reduce((a, b) => a + b, 0) / fixedVals.length : 20;
    for (const n of nodes) if (n.type === 'pump') head[n.id] = neutralHead;

    const Q = {}; // pipe id -> signed flow (from->to positive)
    for (const p of pipes) Q[p.id] = Number.isFinite(p.flow) && p.flow !== 0 ? p.flow : 0.5;

    // Effective resistance per pipe (recomputed each tick; valve/break state can change).
    const Reff = {};
    const activePipe = {};
    for (const p of pipes) {
      const r = p.enabled ? effectivePipeResistance(p, network) : Infinity;
      Reff[p.id] = r;
      activePipe[p.id] = Number.isFinite(r);
    }

    // Adjacency: nodeId -> [{pipe, other}]
    const adj = {};
    for (const n of nodes) adj[n.id] = [];
    for (const p of pipes) {
      if (!activePipe[p.id]) continue;
      adj[p.from].push({ pipe: p, other: p.to, sign: 1 });
      adj[p.to].push({ pipe: p, other: p.from, sign: -1 });
    }

    // Pressure-dependent demand: each demand node's extraction is recomputed
    // every sweep from ITS OWN latest head estimate (standard Gauss-Seidel
    // lag), so supply eases down smoothly as pressure drops instead of being
    // frozen at a fixed extraction for many sweeps and then jumped -- the
    // latter produces a bang-bang limit cycle (full demand crashes pressure
    // -> next pass cuts to ~0 -> pressure overshoots -> back to full demand
    // -> ...) that never settles for higher-resistance networks.
    const demandNodes = nodes.filter((n) => n.type === 'demand');
    const supplied = {};
    for (const n of demandNodes) supplied[n.id] = Number.isFinite(n.suppliedFlow) ? n.suppliedFlow : demandFor(n, network);

    // Leak extraction is attached to the pipe's "to" node, recomputed every
    // sweep from current head estimates.
    const leakAt = {};

    // Pumps add a fixed head *boost* relative to their own (un-boosted) inlet
    // condition. Recomputing "neighbor average + boost" on every sweep can
    // resonate through a low-resistance connector pipe and run away toward
    // the safety clamp, so pumps first settle as plain pass-through
    // junctions (phase 1), then get *locked* at (settled head + boost) as a
    // fixed boundary condition for the rest of the solve (phase 2) -- the
    // same treatment as a reservoir.
    const TOTAL_ITERS = H.OUTER_ITERS * H.INNER_ITERS;
    const pumpLockIter = Math.floor(TOTAL_ITERS / 3);
    const pumpLocked = {};

    for (let iter = 0; iter < TOTAL_ITERS; iter++) {
      for (const id in leakAt) delete leakAt[id];
      for (const p of pipes) {
        if (!p.leak || !p.leak.active) continue;
        const hAvg = ((head[p.from] || 0) + (head[p.to] || 0)) / 2;
        leakAt[p.to] = (leakAt[p.to] || 0) + leakFlowEstimate(p, hAvg);
      }

      const g = {};
      for (const p of pipes) {
        if (!activePipe[p.id]) { g[p.id] = 0; continue; }
        const qmag = Math.max(Math.abs(Q[p.id]), H.QMIN);
        g[p.id] = clamp(1 / (Reff[p.id] * qmag), H.GMIN, H.GMAX);
      }

      for (const id of varIds) {
        const n = network.getNode(id);

        if (n.type === 'pump' && pumpLocked[id] !== undefined) {
          head[id] = pumpLocked[id];
          continue;
        }

        const links = adj[id];
        let sumG = 0, sumGH = 0;
        for (const l of links) {
          const gp = g[l.pipe.id];
          sumG += gp;
          sumGH += gp * head[l.other];
        }
        const pipeSumG = sumG; // conductance from real pipes only, used for isolation checks
        if (pipeSumG <= 1e-9) {
          head[id] = n.type === 'demand' || n.type === 'junction' ? 0 : head[id];
          if (n.type === 'demand') supplied[id] = 0;
          if (n.type === 'pump' && iter === pumpLockIter) pumpLocked[id] = head[id];
          continue;
        }

        let extraction = 0;
        if (n.type === 'demand') {
          const want = demandFor(n, network);
          const hLocal = head[id] - n.elevation; // previous sweep's estimate for this node
          if (hLocal >= H.PDA_HFULL) {
            // pressure-saturated: demand is fully met and stops growing with head
            extraction = want;
          } else if (hLocal > H.PDA_HZERO) {
            // pressure-limited regime: fold demand in as a linear conductance
            // to a virtual zero-head sink, so it's solved *implicitly* together
            // with the pipe network instead of as an explicit lagged term --
            // an explicit lagged extraction here oscillates (bang-bang between
            // full and near-zero demand) for higher-resistance networks.
            sumG += want / (H.PDA_HFULL - H.PDA_HZERO);
          }
          // else: no usable pressure, no extraction and no conductance.
        }
        extraction += leakAt[id] || 0;

        let hNew = (sumGH - extraction) / sumG;
        hNew = clamp(hNew, H.HEAD_CLAMP_MIN, H.HEAD_CLAMP_MAX);
        // Under-relax the update (successive under-relaxation): the demand
        // curve has a kink at H=0 and H=Hfull, and near those kinks a full
        // Gauss-Seidel step can overshoot from one side to the other and
        // back, forming a stable limit cycle instead of settling. Blending
        // with the previous value damps that out.
        hNew = head[id] + H.SOR_FACTOR * (hNew - head[id]);
        head[id] = hNew;
        if (n.type === 'demand') {
          const want = demandFor(n, network);
          const ratio = clamp(((hNew - n.elevation) - H.PDA_HZERO) / (H.PDA_HFULL - H.PDA_HZERO), 0, 1);
          supplied[id] = want * ratio;
        }

        if (n.type === 'pump' && iter === pumpLockIter) {
          const enabled = n.enabled && !n.failed;
          const boosted = enabled ? Math.min(hNew + n.pressureBoost, hNew + H.PUMP_MAX_BOOST_HEADROOM) : hNew;
          pumpLocked[id] = clamp(boosted, H.HEAD_CLAMP_MIN, H.HEAD_CLAMP_MAX);
          head[id] = pumpLocked[id];
        }
      }

      for (const p of pipes) {
        if (!activePipe[p.id]) { Q[p.id] = 0; continue; }
        const dh = head[p.from] - head[p.to];
        const mag = Math.sqrt(Math.abs(dh) / Reff[p.id]);
        const qNew = clamp(Math.sign(dh) * mag, -H.FLOW_CLAMP, H.FLOW_CLAMP);
        // Damp flow too: conductance g is re-linearized from |Q| every sweep,
        // so an undamped Q swing feeds straight back into next sweep's g and
        // amplifies rather than settles.
        Q[p.id] = Q[p.id] + H.SOR_FACTOR * (qNew - Q[p.id]);
      }

    }

    // ---- Commit results back onto node/pipe objects ----
    for (const n of nodes) {
      n.head = safe(head[n.id]);
      if (n.type === 'reservoir') {
        n.pressure = n.head - n.elevation;
      } else if (n.type === 'tank') {
        const level = n.minLevel + (n.currentVolume / Math.max(n.capacity, 1)) * (n.maxLevel - n.minLevel);
        n.level = level;
        n.fillPercent = clamp((n.currentVolume / Math.max(n.capacity, 1)) * 100, 0, 100);
        n.pressure = level;
      } else {
        n.pressure = n.head - n.elevation;
      }
      n.hasSupply = adj[n.id] && adj[n.id].length > 0 && n.head > H.HEAD_CLAMP_MIN + 1;
      if (n.type === 'demand') {
        n.suppliedFlow = safe(supplied[n.id]);
        n.requiredDemand = demandFor(n, network);
        n.supplyPercent = n.requiredDemand > 0 ? clamp((n.suppliedFlow / n.requiredDemand) * 100, 0, 999) : 100;
      }
    }

    let totalLeakLoss = 0;
    for (const p of pipes) {
      const q = safe(Q[p.id]);
      p.flow = p.enabled ? q : 0;
      const from = network.getNode(p.from), to = network.getNode(p.to);
      p.pressureLoss = p.enabled ? Math.abs((from.head || 0) - (to.head || 0)) : 0;
      const cap = pipeCapacity(p);
      p.utilization = cap > 0 ? Math.abs(p.flow) / cap : 0;
      let leakQ = 0;
      if (p.leak && p.leak.active && p.enabled) {
        leakQ = leakAt[p.to] || 0;
        totalLeakLoss += leakQ;
      }
      p.leakFlow = leakQ;

      if (!p.enabled) p.status = 'closed';
      else if (p.broken) p.status = 'broken';
      else if (p.leak && p.leak.active) p.status = 'leaking';
      else if (Math.abs(p.flow) < 0.05) p.status = 'no-flow';
      else if (p.utilization > 1) p.status = 'overloaded';
      else if (p.utilization > 0.75) p.status = 'high';
      else p.status = 'normal';
    }

    // ---- Tank storage integration (explicit Euler) ----
    for (const n of nodes) {
      if (n.type !== 'tank') continue;
      let net = 0;
      for (const l of adj[n.id]) {
        const q = Q[l.pipe.id];
        net += l.pipe.to === n.id ? q : -q;
      }
      n.netFlow = safe(net);
      const deltaL = net * dtSeconds; // L/s * s = L
      n.currentVolume = clamp(n.currentVolume + deltaL, 0, n.capacity);
    }

    // ---- Pump auto-control based on associated tank level ----
    for (const n of nodes) {
      if (n.type !== 'pump' || !n.autoControl || !n.autoControl.enabled) continue;
      const tank = network.getNode(n.autoControl.tankId);
      if (!tank || tank.type !== 'tank') continue;
      if (!n.failed) {
        if (tank.fillPercent <= n.autoControl.startBelow && !n.enabled) {
          n.enabled = true;
          network.log(`${n.name} auto-started (${tank.name} below ${n.autoControl.startBelow}%).`, 'info');
        } else if (tank.fillPercent >= n.autoControl.stopAbove && n.enabled) {
          n.enabled = false;
          network.log(`${n.name} auto-stopped (${tank.name} above ${n.autoControl.stopAbove}%).`, 'info');
        }
      }
    }

    computeStatsAndWarnings(network, totalLeakLoss);
  }

  function emptyStats(network) {
    return {
      totalDemand: 0, totalSupplied: 0, unservedDemand: 0, sourceOutput: 0,
      waterLost: 0, avgPressure: 0, lowestPressure: 0, lowestPressureNode: null,
      activePumps: 0, tankStoragePercent: 0, activeLeaks: 0, health: 'HEALTHY',
      healthReason: 'Empty network.', efficiency: 100
    };
  }

  function computeStatsAndWarnings(network, totalLeakLoss) {
    const nodes = Array.from(network.nodes.values());
    const pipes = Array.from(network.pipes.values());
    const demandNodes = nodes.filter((n) => n.type === 'demand');
    const pumps = nodes.filter((n) => n.type === 'pump');
    const tanks = nodes.filter((n) => n.type === 'tank');
    const reservoirs = nodes.filter((n) => n.type === 'reservoir');

    const totalDemand = demandNodes.reduce((s, n) => s + (n.requiredDemand || 0), 0);
    const totalSupplied = demandNodes.reduce((s, n) => s + (n.suppliedFlow || 0), 0);
    const unserved = Math.max(0, totalDemand - totalSupplied);

    let sourceOutput = 0;
    for (const r of reservoirs) {
      for (const p of network.getConnectedPipes(r.id)) {
        if (!p.enabled) continue;
        sourceOutput += p.from === r.id ? Math.max(p.flow, 0) : Math.max(-p.flow, 0);
      }
    }

    const pressureNodes = nodes.filter((n) => n.type === 'demand' || n.type === 'junction');
    const pressures = pressureNodes.map((n) => n.pressure);
    const avgPressure = pressures.length ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0;
    let lowestPressure = pressures.length ? Math.min(...pressures) : 0;
    let lowestNode = null;
    for (const n of pressureNodes) if (n.pressure === lowestPressure) { lowestNode = n; break; }

    const activePumps = pumps.filter((p) => p.enabled && !p.failed).length;
    const tankAvg = tanks.length ? tanks.reduce((s, t) => s + t.fillPercent, 0) / tanks.length : 100;
    const activeLeaks = pipes.filter((p) => p.leak && p.leak.active && p.enabled).length;
    const brokenPipes = pipes.filter((p) => p.broken).length;
    const emptyTanks = tanks.filter((t) => t.fillPercent < 5).length;
    const lowPressureCount = pressureNodes.filter((n) => C.pressureStatus(n.pressure, n.hasSupply) === 'LOW' || C.pressureStatus(n.pressure, n.hasSupply) === 'CRITICAL').length;
    const isolatedDemand = demandNodes.filter((n) => !n.hasSupply || n.pressure <= C.HYD.HEAD_CLAMP_MIN + 1).length;

    const efficiency = totalDemand > 0 ? clamp(100 * (1 - (totalLeakLoss + unserved) / (totalDemand + totalLeakLoss + 1e-6)), 0, 100) : 100;

    // ---- health score ----
    const supplyRatio = totalDemand > 0 ? totalSupplied / totalDemand : 1;
    let score = 100;
    score -= (1 - supplyRatio) * 60;
    score -= lowPressureCount * 6;
    score -= activeLeaks * 5;
    score -= brokenPipes * 12;
    score -= pumps.filter((p) => !p.enabled || p.failed).length * 3;
    score -= emptyTanks * 8;
    score -= isolatedDemand * 10;
    score = clamp(score, 0, 100);

    let health, reason;
    if (score >= 85) { health = 'HEALTHY'; reason = 'Demand is met and pressures are within normal range.'; }
    else if (score >= 60) { health = 'STRESSED'; reason = 'Some areas have reduced pressure or minor supply shortfalls.'; }
    else if (score >= 30) { health = 'CRITICAL'; reason = 'Significant unserved demand, leaks, or low pressure across the network.'; }
    else { health = 'FAILED'; reason = 'The network is largely unable to deliver water where it is needed.'; }

    if (supplyRatio < 0.99) reason += ` Supplying ${(supplyRatio * 100).toFixed(0)}% of demand.`;
    if (activeLeaks > 0) reason += ` ${activeLeaks} active leak(s).`;
    if (brokenPipes > 0) reason += ` ${brokenPipes} broken pipe(s).`;
    if (emptyTanks > 0) reason += ` ${emptyTanks} tank(s) empty.`;

    network.stats = {
      totalDemand, totalSupplied, unservedDemand: unserved, sourceOutput,
      waterLost: totalLeakLoss, avgPressure, lowestPressure, lowestPressureNode: lowestNode ? lowestNode.name : '--',
      activePumps, totalPumps: pumps.length, tankStoragePercent: tankAvg, activeLeaks, health, healthReason: reason,
      efficiency, score
    };

    generateWarnings(network, { lowPressureCount, isolatedDemand });
    pushHistory(network);
  }

  function generateWarnings(network, extra) {
    const nodes = Array.from(network.nodes.values());
    const pipes = Array.from(network.pipes.values());
    const warnings = [];
    const setState = (key, active, text, level) => {
      const was = network._warnState[key];
      if (active && !was) network.log(text, level || 'warn');
      if (!active && was) network.log('Resolved: ' + text, 'info');
      network._warnState[key] = active;
      if (active) warnings.push({ text, level: level || 'warn' });
    };

    for (const n of nodes) {
      if (n.type === 'demand') {
        const status = C.pressureStatus(n.pressure, n.hasSupply);
        setState('press_' + n.id, status === 'CRITICAL' || status === 'NO SUPPLY',
          `Low pressure at ${n.name}.`, 'warn');
        setState('supply_' + n.id, n.supplyPercent < 70,
          `${n.name} receiving only ${n.supplyPercent.toFixed(0)}% of required demand.`, 'warn');
      }
      if (n.type === 'tank') {
        setState('tanklow_' + n.id, n.fillPercent < 15, `${n.name} below 15%.`, 'warn');
      }
      if (n.type === 'pump') {
        setState('pumpoff_' + n.id, !n.enabled || n.failed, `${n.name} offline.`, 'warn');
      }
      if (n.type === 'reservoir') {
        setState('sourceloss_' + n.id, n.sourceLossActive, `${n.name} experiencing reduced source availability.`, 'warn');
      }
    }
    for (const p of pipes) {
      setState('leak_' + p.id, p.leak && p.leak.active && p.enabled, `Leak detected on ${p.name}.`, 'warn');
      setState('broken_' + p.id, p.broken, `${p.name} is broken / severely restricted.`, 'warn');
      setState('overload_' + p.id, p.status === 'overloaded', `${p.name} operating near/over capacity.`, 'warn');
      setState('closed_' + p.id, !p.enabled, `${p.name} closed.`, 'info');
    }
    network.warnings = warnings;
  }

  function pushHistory(network) {
    const h = network.history;
    h.time.push(network.simHours);
    h.demand.push(network.stats.totalDemand);
    h.supply.push(network.stats.totalSupplied);
    h.avgPressure.push(network.stats.avgPressure);
    const tanks = Array.from(network.nodes.values()).filter((n) => n.type === 'tank');
    h.tankLevel.push(tanks.length ? tanks.reduce((s, t) => s + t.fillPercent, 0) / tanks.length : 0);
    h.loss.push(network.stats.waterLost);
    const MAX = 240;
    for (const k of Object.keys(h)) if (h[k].length > MAX) h[k].shift();
  }

  WNS.Hydraulics = {
    solve, pipeBaseResistance, pipeCapacity, effectivePipeResistance, demandFor, dailyMultiplier
  };
})(window.WNS);
