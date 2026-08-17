/* scenarios.js
   Prebuilt scenario networks and lightweight failure-challenge definitions. */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';

  function build(network, fn) {
    network.clearAll();
    fn(network);
    network.demandMode = 'constant';
    network.captureBaseline();
    network.log('Scenario loaded: ' + network._scenarioName, 'info');
  }

  const list = [
    {
      id: 'basicSupply',
      name: 'Basic Supply',
      description: 'A reservoir feeding several residential demand nodes through a simple branching network. Good starting point for learning the basics.',
      build(network) {
        network._scenarioName = 'Basic Supply';
        const r = network.addNode('reservoir', 120, 260, { name: 'Main Reservoir', sourceHead: 55 });
        const j1 = network.addNode('junction', 340, 260, { name: 'J1', elevation: 2 });
        const d1 = network.addNode('demand', 540, 140, { name: 'North Homes', demandType: 'residential', baseDemand: 8, elevation: 3 });
        const d2 = network.addNode('demand', 540, 260, { name: 'Central Homes', demandType: 'residential', baseDemand: 10, elevation: 2 });
        const d3 = network.addNode('demand', 540, 380, { name: 'South Homes', demandType: 'residential', baseDemand: 9, elevation: 4 });
        network.addPipe(r.id, j1.id, { length: 220, diameter: 220 });
        network.addPipe(j1.id, d1.id, { length: 260, diameter: 150 });
        network.addPipe(j1.id, d2.id, { length: 200, diameter: 150 });
        network.addPipe(j1.id, d3.id, { length: 260, diameter: 150 });
      }
    },
    {
      id: 'boosterPump',
      name: 'Booster Pump',
      description: 'An elevated, distant zone cannot maintain acceptable pressure from the reservoir alone. Enable the booster pump to restore service.',
      build(network) {
        network._scenarioName = 'Booster Pump';
        const r = network.addNode('reservoir', 100, 300, { name: 'Valley Reservoir', sourceHead: 32 });
        const j1 = network.addNode('junction', 320, 300, { name: 'J1', elevation: 4 });
        const pu = network.addNode('pump', 460, 300, { name: 'Booster PU-1', pressureBoost: 28, enabled: false });
        const j2 = network.addNode('junction', 600, 200, { name: 'Hilltop Junction', elevation: 22 });
        const d1 = network.addNode('demand', 760, 120, { name: 'Hilltop Homes', demandType: 'residential', baseDemand: 12, elevation: 24 });
        const d2 = network.addNode('demand', 760, 280, { name: 'Ridge Commercial', demandType: 'commercial', baseDemand: 14, elevation: 20 });
        network.addPipe(r.id, j1.id, { length: 300, diameter: 220 });
        network.addPipe(j1.id, pu.id, { length: 20, diameter: 200 });
        network.addPipe(pu.id, j2.id, { length: 260, diameter: 180 });
        network.addPipe(j2.id, d1.id, { length: 220, diameter: 150 });
        network.addPipe(j2.id, d2.id, { length: 240, diameter: 150 });
      }
    },
    {
      id: 'storageChallenge',
      name: 'Storage Challenge',
      description: 'A tank must buffer a sharp evening demand peak. Run on the daily demand cycle and watch the tank drain and refill.',
      build(network) {
        network._scenarioName = 'Storage Challenge';
        const r = network.addNode('reservoir', 100, 260, { name: 'Reservoir', sourceHead: 45 });
        const t = network.addNode('tank', 340, 180, { name: 'Hilltop Tank', capacity: 60000, currentVolume: 42000, elevation: 18, maxLevel: 8 });
        const j1 = network.addNode('junction', 340, 320, { name: 'J1', elevation: 3 });
        const d1 = network.addNode('demand', 560, 120, { name: 'Suburb A', demandType: 'residential', baseDemand: 16, elevation: 6 });
        const d2 = network.addNode('demand', 560, 260, { name: 'Suburb B', demandType: 'residential', baseDemand: 18, elevation: 6 });
        const d3 = network.addNode('demand', 560, 400, { name: 'Suburb C', demandType: 'commercial', baseDemand: 15, elevation: 5 });
        network.addPipe(r.id, j1.id, { length: 220, diameter: 220 });
        network.addPipe(j1.id, t.id, { length: 180, diameter: 180 });
        network.addPipe(t.id, d1.id, { length: 240, diameter: 150 });
        network.addPipe(j1.id, d2.id, { length: 260, diameter: 160 });
        network.addPipe(j1.id, d3.id, { length: 300, diameter: 150 });
        network.demandModeSuggestion = 'daily';
      }
    },
    {
      id: 'pipeBreak',
      name: 'Pipe Break',
      description: 'A looped trunk main lets you isolate a failed section with valves while keeping most customers supplied. Try breaking the marked trunk pipe.',
      build(network) {
        network._scenarioName = 'Pipe Break';
        const r = network.addNode('reservoir', 90, 260, { name: 'City Reservoir', sourceHead: 50 });
        const j1 = network.addNode('junction', 260, 260, { name: 'Trunk J1', elevation: 2 });
        const v1 = network.addNode('valve', 420, 160, { name: 'V-North', open: 100 });
        const v2 = network.addNode('valve', 420, 360, { name: 'V-South', open: 100 });
        const j2 = network.addNode('junction', 600, 160, { name: 'Trunk J2', elevation: 3 });
        const j3 = network.addNode('junction', 600, 360, { name: 'Trunk J3', elevation: 3 });
        const d1 = network.addNode('demand', 780, 120, { name: 'District North', demandType: 'residential', baseDemand: 14, elevation: 4 });
        const d2 = network.addNode('demand', 780, 260, { name: 'District Mid', demandType: 'commercial', baseDemand: 16, elevation: 4 });
        const d3 = network.addNode('demand', 780, 400, { name: 'District South', demandType: 'residential', baseDemand: 13, elevation: 4 });
        network.addPipe(r.id, j1.id, { length: 200, diameter: 260 });
        const trunk1 = network.addPipe(j1.id, v1.id, { length: 180, diameter: 220, name: 'Trunk-Main-A' });
        network.addPipe(j1.id, v2.id, { length: 180, diameter: 220, name: 'Trunk-Main-B' });
        network.addPipe(v1.id, j2.id, { length: 200, diameter: 200 });
        network.addPipe(v2.id, j3.id, { length: 200, diameter: 200 });
        network.addPipe(j2.id, j3.id, { length: 260, diameter: 160, name: 'Tie-Main' });
        network.addPipe(j2.id, d1.id, { length: 200, diameter: 150 });
        network.addPipe(j2.id, d2.id, { length: 220, diameter: 150 });
        network.addPipe(j3.id, d3.id, { length: 220, diameter: 150 });
        network._challengeHintPipe = trunk1.id;
      }
    },
    {
      id: 'highDemand',
      name: 'High Demand',
      description: 'A normally stable network pushed to its limits by unusually high consumption across the board.',
      build(network) {
        network._scenarioName = 'High Demand';
        const r = network.addNode('reservoir', 100, 260, { name: 'Reservoir', sourceHead: 48 });
        const j1 = network.addNode('junction', 300, 260, { name: 'J1', elevation: 3 });
        const d1 = network.addNode('demand', 520, 140, { name: 'Residential Zone', demandType: 'residential', baseDemand: 26, elevation: 4 });
        const d2 = network.addNode('demand', 520, 260, { name: 'Commercial Zone', demandType: 'commercial', baseDemand: 30, elevation: 3 });
        const d3 = network.addNode('demand', 520, 380, { name: 'Industrial Zone', demandType: 'industrial', baseDemand: 34, elevation: 2 });
        network.addPipe(r.id, j1.id, { length: 200, diameter: 220 });
        network.addPipe(j1.id, d1.id, { length: 240, diameter: 140 });
        network.addPipe(j1.id, d2.id, { length: 220, diameter: 140 });
        network.addPipe(j1.id, d3.id, { length: 260, diameter: 140 });
      }
    },
    {
      id: 'redundantNetwork',
      name: 'Redundant Network',
      description: 'A looped network with two supply points and a pump, showing how redundancy keeps customers supplied even if one path is lost.',
      build(network) {
        network._scenarioName = 'Redundant Network';
        const r1 = network.addNode('reservoir', 80, 160, { name: 'Reservoir A', sourceHead: 46 });
        const r2 = network.addNode('reservoir', 80, 400, { name: 'Reservoir B', sourceHead: 40 });
        const pu = network.addNode('pump', 260, 400, { name: 'PU-B', pressureBoost: 12, enabled: true });
        const j1 = network.addNode('junction', 300, 160, { name: 'J1', elevation: 3 });
        const j2 = network.addNode('junction', 500, 160, { name: 'J2', elevation: 3 });
        const j3 = network.addNode('junction', 500, 400, { name: 'J3', elevation: 3 });
        const d1 = network.addNode('demand', 700, 100, { name: 'Zone A', demandType: 'residential', baseDemand: 14, elevation: 4 });
        const d2 = network.addNode('demand', 700, 260, { name: 'Zone B', demandType: 'commercial', baseDemand: 18, elevation: 4 });
        const d3 = network.addNode('demand', 700, 420, { name: 'Zone C', demandType: 'residential', baseDemand: 12, elevation: 4 });
        network.addPipe(r1.id, j1.id, { length: 200, diameter: 220 });
        network.addPipe(r2.id, pu.id, { length: 20, diameter: 220 });
        network.addPipe(pu.id, j3.id, { length: 200, diameter: 200 });
        network.addPipe(j1.id, j2.id, { length: 220, diameter: 180 });
        network.addPipe(j2.id, j3.id, { length: 260, diameter: 180, name: 'Ring-Tie' });
        network.addPipe(j2.id, d1.id, { length: 180, diameter: 150 });
        network.addPipe(j2.id, d2.id, { length: 220, diameter: 150 });
        network.addPipe(j3.id, d3.id, { length: 200, diameter: 150 });
      }
    }
  ];

  function loadScenario(network, id) {
    const s = list.find((x) => x.id === id);
    if (!s) return false;
    build(network, s.build);
    return true;
  }

  // ---- Failure challenges (informal success criteria, evaluated live) ----
  const challenges = [
    {
      id: 'isolateBreak',
      name: 'Isolate the Break',
      scenarioId: 'pipeBreak',
      brief: 'A trunk main has ruptured. Isolate the break while keeping at least 70% of demand supplied.',
      setup(network) {
        const p = network.getPipe(network._challengeHintPipe);
        if (p) { p.broken = true; network.log(`${p.name} ruptured! Isolate it to protect service.`, 'warn'); }
      },
      evaluate(network) {
        const s = network.stats;
        const ratio = s.totalDemand > 0 ? s.totalSupplied / s.totalDemand : 1;
        return {
          metric: `Demand supplied: ${(ratio * 100).toFixed(0)}% (target ≥ 70%)`,
          success: ratio >= 0.7
        };
      }
    },
    {
      id: 'pumpFailurePeak',
      name: 'Pump Failure at Peak',
      scenarioId: 'storageChallenge',
      brief: 'The booster pump has failed during peak demand. Use stored water and available valves to maintain service.',
      setup(network) {
        network.demandMode = 'daily';
        // fast-forward to evening peak
        network.simSeconds = 19 * 3600;
        network.log('Peak demand period begun. Reservoir supply pump has failed.', 'warn');
      },
      evaluate(network) {
        const s = network.stats;
        const ratio = s.totalDemand > 0 ? s.totalSupplied / s.totalDemand : 1;
        return {
          metric: `Demand supplied: ${(ratio * 100).toFixed(0)}% (target ≥ 60%)`,
          success: ratio >= 0.6
        };
      }
    },
    {
      id: 'industrialSurge',
      name: 'Industrial Surge',
      scenarioId: 'highDemand',
      brief: 'A large industrial customer has suddenly doubled its demand. Prevent critical pressure anywhere on the network.',
      setup(network) {
        const industrial = Array.from(network.nodes.values()).find((n) => n.type === 'demand' && n.demandType === 'industrial');
        if (industrial) { industrial.surgeActive = true; industrial.surgeMultiplier = 2; network.log(`${industrial.name} demand surged.`, 'warn'); }
      },
      evaluate(network) {
        const nodes = Array.from(network.nodes.values()).filter((n) => n.type === 'demand' || n.type === 'junction');
        const critical = nodes.filter((n) => WNS.Components.pressureStatus(n.pressure, n.hasSupply) === 'CRITICAL' || WNS.Components.pressureStatus(n.pressure, n.hasSupply) === 'NO SUPPLY').length;
        return {
          metric: `Critical/no-supply nodes: ${critical} (target = 0)`,
          success: critical === 0
        };
      }
    }
  ];

  WNS.Scenarios = { list, loadScenario, challenges };
})(window.WNS);
