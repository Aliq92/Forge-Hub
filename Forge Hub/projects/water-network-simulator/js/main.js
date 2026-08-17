/* main.js
   Application bootstrap: App state, fixed-rate simulation loop,
   requestAnimationFrame rendering loop, and canvas pointer interactions. */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';

  class App {
    constructor() {
      this.network = new WNS.Network();
      this.view = {
        panX: 80, panY: 60, zoom: 1,
        overlay: 'none',
        labels: { names: true, pressure: false, flow: false, pipeIds: false, warnings: true },
        flowAnim: true,
        pipeDraft: null
      };
      this.tool = 'select';
      this.playing = false;
      this.speed = 1;
      this.tickIntervalMs = 250;
      this.baseSimSecondsPerTick = 30;
      this._acc = 0;
      this._lastFrame = null;

      this.canvas = document.getElementById('netCanvas');
      this.renderer = new WNS.Renderer(this.canvas, this);

      this.dragNode = null;
      this.dragOffset = null;
      this.panning = false;
      this.panLast = null;
      this.pointerMoved = false;
      this.activeChallenge = null;

      this._bindCanvasEvents();
      window.addEventListener('resize', () => this.renderer.resize());
    }

    start() {
      this.renderer.resize();
      requestAnimationFrame((t) => this._loop(t));
    }

    setPlaying(playing) {
      if (playing && this.network.structureDirty) this.network.captureBaseline();
      const wasPlaying = this.playing;
      this.playing = playing;
      if (playing && !wasPlaying) this.network.log('Simulation started.', 'info');
      else if (!playing && wasPlaying) this.network.log('Simulation paused.', 'info');
      WNS.UI.syncPlayButtons(this);
    }

    resetSimulation() {
      this.network.resetSimulation();
      WNS.UI.refreshAll(this);
    }

    clearNetwork() {
      this.playing = false;
      this.network.clearAll();
      this.activeChallenge = null;
      WNS.UI.hideChallengeBanner();
      WNS.Hydraulics.solve(this.network, 0);
      WNS.UI.refreshAll(this);
      WNS.UI.syncPlayButtons(this);
    }

    loadScenario(id) {
      this.playing = false;
      this.activeChallenge = null;
      WNS.UI.hideChallengeBanner();
      WNS.Scenarios.loadScenario(this.network, id);
      this.view.panX = 80; this.view.panY = 60; this.view.zoom = 1;
      WNS.Hydraulics.solve(this.network, 0);
      WNS.UI.refreshAll(this);
      WNS.UI.syncPlayButtons(this);
    }

    loadChallenge(id) {
      const ch = WNS.Scenarios.challenges.find((c) => c.id === id);
      if (!ch) return;
      this.playing = false;
      WNS.Scenarios.loadScenario(this.network, ch.scenarioId);
      ch.setup(this.network);
      this.network.captureBaseline();
      this.activeChallenge = ch;
      this.view.panX = 80; this.view.panY = 60; this.view.zoom = 1;
      WNS.Hydraulics.solve(this.network, 0);
      WNS.UI.showChallengeBanner(ch);
      WNS.UI.refreshAll(this);
      WNS.UI.syncPlayButtons(this);
    }

    setTool(tool) {
      this.tool = tool;
      this.view.pipeDraft = null;
      this.canvas.style.cursor = tool === 'select' ? 'default' : (tool === 'delete' ? 'not-allowed' : 'crosshair');
    }

    _loop(ts) {
      if (this._lastFrame == null) this._lastFrame = ts;
      const dtMs = Math.min(ts - this._lastFrame, 250);
      this._lastFrame = ts;

      this._acc += dtMs;
      while (this._acc >= this.tickIntervalMs) {
        this._acc -= this.tickIntervalMs;
        let simDt = 0;
        if (this.playing) {
          simDt = this.baseSimSecondsPerTick * this.speed;
          this.network.simSeconds += simDt;
        }
        WNS.Hydraulics.solve(this.network, simDt);
      }

      this.renderer.draw(dtMs);
      WNS.UI.tick(this);
      requestAnimationFrame((t) => this._loop(t));
    }

    // ---- pointer / hit testing ----
    _bindCanvasEvents() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this._onPointerDown(e));
      c.addEventListener('pointermove', (e) => this._onPointerMove(e));
      c.addEventListener('pointerup', (e) => this._onPointerUp(e));
      c.addEventListener('pointercancel', (e) => this._onPointerUp(e));
      c.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      c.addEventListener('contextmenu', (e) => { e.preventDefault(); this.view.pipeDraft = null; });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this.view.pipeDraft = null; this.network.selectedId = null; WNS.UI.refreshInspector(this); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.network.selectedId && document.activeElement.tagName !== 'INPUT') {
            this.deleteSelected();
          }
        }
      });
    }

    screenPosFromEvent(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    hitTestNode(sx, sy) {
      const z = this.view.zoom;
      let best = null, bestD = 20 * z + 6;
      for (const n of this.network.nodes.values()) {
        const p = this.renderer.worldToScreen(n.x, n.y);
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < bestD) { bestD = d; best = n; }
      }
      return best;
    }

    hitTestPipe(sx, sy) {
      let best = null, bestD = 8;
      for (const p of this.network.pipes.values()) {
        const a = this.network.getNode(p.from), b = this.network.getNode(p.to);
        if (!a || !b) continue;
        const pa = this.renderer.worldToScreen(a.x, a.y), pb = this.renderer.worldToScreen(b.x, b.y);
        const d = pointSegDist(sx, sy, pa.x, pa.y, pb.x, pb.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }

    _onPointerDown(e) {
      this.canvas.setPointerCapture(e.pointerId);
      const s = this.screenPosFromEvent(e);
      this.pointerMoved = false;
      this._downPos = s;

      if (this.tool === 'select') {
        const node = this.hitTestNode(s.x, s.y);
        if (node) {
          this.network.selectedId = node.id;
          this.dragNode = node;
          const w = this.renderer.screenToWorld(s.x, s.y);
          this.dragOffset = { x: w.x - node.x, y: w.y - node.y };
          WNS.UI.refreshInspector(this);
          return;
        }
        const pipe = this.hitTestPipe(s.x, s.y);
        if (pipe) {
          this.network.selectedId = pipe.id;
          WNS.UI.refreshInspector(this);
          return;
        }
        this.panning = true;
        this.panLast = s;
        return;
      }

      if (this.tool === 'pipe') {
        const node = this.hitTestNode(s.x, s.y);
        if (!node) return;
        if (!this.view.pipeDraft) {
          this.view.pipeDraft = { fromId: node.id, mouseX: s.x, mouseY: s.y };
        } else {
          const fromId = this.view.pipeDraft.fromId;
          this.view.pipeDraft = null;
          if (fromId === node.id) return;
          const res = this.network.addPipe(fromId, node.id);
          if (res.error) WNS.UI.toast(res.error);
          else { this.network.selectedId = res.id; WNS.UI.refreshInspector(this); }
        }
        return;
      }

      if (this.tool === 'delete') {
        const node = this.hitTestNode(s.x, s.y);
        if (node) { this.network.removeNode(node.id); WNS.UI.refreshInspector(this); return; }
        const pipe = this.hitTestPipe(s.x, s.y);
        if (pipe) { this.network.removePipe(pipe.id); WNS.UI.refreshInspector(this); return; }
        return;
      }

      // placement tools
      if (WNS.Components.TYPES.includes(this.tool)) {
        const w = this.renderer.screenToWorld(s.x, s.y);
        const n = this.network.addNode(this.tool, Math.round(w.x), Math.round(w.y));
        this.network.selectedId = n.id;
        WNS.UI.refreshInspector(this);
      }
    }

    _onPointerMove(e) {
      const s = this.screenPosFromEvent(e);
      if (this._downPos && Math.hypot(s.x - this._downPos.x, s.y - this._downPos.y) > 3) this.pointerMoved = true;

      if (this.dragNode) {
        const w = this.renderer.screenToWorld(s.x, s.y);
        this.dragNode.x = w.x - this.dragOffset.x;
        this.dragNode.y = w.y - this.dragOffset.y;
        return;
      }
      if (this.panning) {
        this.view.panX += s.x - this.panLast.x;
        this.view.panY += s.y - this.panLast.y;
        this.panLast = s;
        return;
      }
      if (this.view.pipeDraft) {
        this.view.pipeDraft.mouseX = s.x;
        this.view.pipeDraft.mouseY = s.y;
      }
    }

    _onPointerUp(e) {
      if (!this.pointerMoved && this.tool === 'select' && !this.dragNode && this.panning) {
        // plain click on empty canvas -> deselect
        this.network.selectedId = null;
        WNS.UI.refreshInspector(this);
      }
      this.dragNode = null;
      this.panning = false;
    }

    _onWheel(e) {
      e.preventDefault();
      const s = this.screenPosFromEvent(e);
      const before = this.renderer.screenToWorld(s.x, s.y);
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.view.zoom = Math.max(0.35, Math.min(2.5, this.view.zoom * factor));
      const after = this.renderer.worldToScreen(before.x, before.y);
      this.view.panX += s.x - after.x;
      this.view.panY += s.y - after.y;
    }

    deleteSelected() {
      const id = this.network.selectedId;
      if (!id) return;
      if (this.network.nodes.has(id)) this.network.removeNode(id);
      else this.network.removePipe(id);
      WNS.UI.refreshInspector(this);
    }
  }

  function pointSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t, cy = ay + dy * t;
    return Math.hypot(px - cx, py - cy);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.WNS_APP = app;
    WNS.UI.init(app);
    app.loadScenario('basicSupply');
    app.start();
  });
})(window.WNS);
