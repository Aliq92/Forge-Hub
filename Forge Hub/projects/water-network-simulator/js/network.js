/* network.js
   Graph data model: nodes, pipes, event log, serialization, baseline
   snapshot used for "Reset Simulation" vs "Clear Network". */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';
  const C = WNS.Components;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj, (k, v) => (v === Infinity ? '__INF__' : v)),
      (k, v) => (v === '__INF__' ? Infinity : v));
  }

  class Network {
    constructor() {
      this.nodes = new Map();
      this.pipes = new Map();
      this.eventLog = [];
      this.simSeconds = 0;
      this.demandMode = 'constant'; // 'constant' | 'daily'
      this.selectedId = null;
      this.structureDirty = true;
      this.baseline = null;
      this._counters = { reservoir: 0, pump: 0, tank: 0, junction: 0, demand: 0, valve: 0, pipe: 0 };
      this._warnState = {}; // key -> bool, used to log only on transitions
      this.stats = {};
      this.warnings = [];
      this.history = { time: [], demand: [], supply: [], avgPressure: [], tankLevel: [], loss: [] };
    }

    get simHours() { return (this.simSeconds / 3600) % 24; }

    nextId(type) {
      this._counters[type] = (this._counters[type] || 0) + 1;
      return C.idPrefix[type] + this._counters[type];
    }

    addNode(type, x, y, overrides) {
      const id = this.nextId(type);
      const node = Object.assign(
        { id, type, x, y, head: 0, pressure: 0, hasSupply: false },
        C.defaults(type),
        overrides || {}
      );
      this.nodes.set(id, node);
      this.structureDirty = true;
      return node;
    }

    addPipe(fromId, toId, overrides) {
      if (fromId === toId) return { error: 'A pipe cannot connect a node to itself.' };
      if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return { error: 'Invalid node.' };
      for (const p of this.pipes.values()) {
        if ((p.from === fromId && p.to === toId) || (p.from === toId && p.to === fromId)) {
          return { error: 'These nodes are already connected by a pipe.' };
        }
      }
      const id = this.nextId('pipe');
      const pipe = Object.assign(
        { id, from: fromId, to: toId, flow: 0, pressureLoss: 0, status: 'normal', utilization: 0 },
        C.pipeDefaults(),
        overrides || {}
      );
      pipe.name = pipe.name || id;
      this.pipes.set(id, pipe);
      this.structureDirty = true;
      return pipe;
    }

    removeNode(id) {
      if (!this.nodes.has(id)) return;
      for (const [pid, p] of Array.from(this.pipes.entries())) {
        if (p.from === id || p.to === id) this.pipes.delete(pid);
      }
      this.nodes.delete(id);
      if (this.selectedId === id) this.selectedId = null;
      this.structureDirty = true;
    }

    removePipe(id) {
      this.pipes.delete(id);
      if (this.selectedId === id) this.selectedId = null;
      this.structureDirty = true;
    }

    getNode(id) { return this.nodes.get(id); }
    getPipe(id) { return this.pipes.get(id); }

    getConnectedPipes(nodeId) {
      const out = [];
      for (const p of this.pipes.values()) {
        if (p.from === nodeId || p.to === nodeId) out.push(p);
      }
      return out;
    }

    otherEnd(pipe, nodeId) { return pipe.from === nodeId ? pipe.to : pipe.from; }

    clearAll() {
      this.nodes.clear();
      this.pipes.clear();
      this.eventLog = [];
      this.simSeconds = 0;
      this._counters = { reservoir: 0, pump: 0, tank: 0, junction: 0, demand: 0, valve: 0, pipe: 0 };
      this.baseline = null;
      this.selectedId = null;
      this._warnState = {};
      this.warnings = [];
      this.stats = {};
      this.history = { time: [], demand: [], supply: [], avgPressure: [], tankLevel: [], loss: [] };
    }

    log(text, level) {
      level = level || 'info';
      this.eventLog.push({ t: this.simHours, text, level });
      if (this.eventLog.length > 300) this.eventLog.shift();
    }

    // Capture the dynamic (mutable-during-sim) fields so Reset Simulation
    // can restore them without touching topology/layout/static properties.
    captureBaseline() {
      const nodes = {};
      for (const [id, n] of this.nodes) {
        const d = {};
        if (n.type === 'tank') d.currentVolume = n.currentVolume;
        if (n.type === 'pump') { d.enabled = n.enabled; d.failed = n.failed; }
        if (n.type === 'valve') { d.open = n.open; d.closedByFailure = n.closedByFailure; }
        if (n.type === 'reservoir') { d.sourceLossActive = n.sourceLossActive; }
        if (n.type === 'demand') { d.surgeActive = n.surgeActive; }
        nodes[id] = d;
      }
      const pipes = {};
      for (const [id, p] of this.pipes) {
        pipes[id] = { enabled: p.enabled, leak: deepClone(p.leak), broken: p.broken };
      }
      this.baseline = deepClone({ nodes, pipes });
      this.structureDirty = false;
    }

    resetSimulation() {
      if (!this.baseline) this.captureBaseline();
      const b = this.baseline;
      for (const [id, n] of this.nodes) {
        const d = b.nodes[id];
        if (!d) continue;
        Object.assign(n, deepClone(d));
      }
      for (const [id, p] of this.pipes) {
        const d = b.pipes[id];
        if (!d) continue;
        Object.assign(p, deepClone(d));
      }
      this.simSeconds = 0;
      this.eventLog = [];
      this._warnState = {};
      this.warnings = [];
      this.history = { time: [], demand: [], supply: [], avgPressure: [], tankLevel: [], loss: [] };
      this.log('Simulation reset.', 'info');
    }

    serialize() {
      return deepClone({
        nodes: Array.from(this.nodes.values()),
        pipes: Array.from(this.pipes.values()),
        counters: this._counters
      });
    }

    loadFromData(data) {
      this.clearAll();
      const d = deepClone(data);
      for (const n of d.nodes) this.nodes.set(n.id, n);
      for (const p of d.pipes) this.pipes.set(p.id, p);
      if (d.counters) this._counters = d.counters;
      this.structureDirty = true;
      this.log('Network loaded.', 'info');
      this.captureBaseline();
    }
  }

  WNS.Network = Network;
  WNS.deepClone = deepClone;
})(window.WNS);
