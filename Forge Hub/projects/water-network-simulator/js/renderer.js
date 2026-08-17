/* renderer.js
   Canvas rendering: schematic network view, flow particle animation,
   overlays, and vector-style node icons. */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';
  const C = WNS.Components;

  class Renderer {
    constructor(canvas, app) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.app = app; // reference to main app for network + view state
      this.particles = new Map(); // pipeId -> [{t, }]
      this.time = 0;
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = Math.max(200, Math.floor(rect.width * dpr));
      this.canvas.height = Math.max(200, Math.floor(rect.height * dpr));
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cssWidth = rect.width;
      this.cssHeight = rect.height;
    }

    worldToScreen(x, y) {
      const v = this.app.view;
      return { x: x * v.zoom + v.panX, y: y * v.zoom + v.panY };
    }
    screenToWorld(x, y) {
      const v = this.app.view;
      return { x: (x - v.panX) / v.zoom, y: (y - v.panY) / v.zoom };
    }

    draw(dtMs) {
      this.time += dtMs;
      const ctx = this.ctx;
      const w = this.cssWidth, h = this.cssHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, w, h);
      this.drawGrid(w, h);

      const net = this.app.network;
      const overlay = this.app.view.overlay;

      // pipes first
      for (const pipe of net.pipes.values()) this.drawPipe(pipe, overlay);
      // nodes
      for (const node of net.nodes.values()) this.drawNode(node, overlay);

      if (this.app.view.pipeDraft) this.drawDraft();
    }

    drawGrid(w, h) {
      const ctx = this.ctx;
      const v = this.app.view;
      const step = 40 * v.zoom;
      if (step < 8) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      const offX = v.panX % step;
      const offY = v.panY % step;
      ctx.beginPath();
      for (let x = offX; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = offY; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }

    pipeColor(pipe, overlay) {
      const clr = C.colors;
      if (overlay === 'leaks') {
        if (pipe.leak && pipe.leak.active) return clr.pipeLeak;
        if (pipe.broken) return clr.pipeBroken;
        return 'rgba(120,140,170,0.25)';
      }
      if (overlay === 'utilization') {
        if (!pipe.enabled) return clr.pipeClosed;
        const u = pipe.utilization;
        if (u > 1) return clr.pipeOverload;
        if (u > 0.75) return clr.pipeHigh;
        if (u > 0.05) return '#5ea0e0';
        return clr.pipeNoFlow;
      }
      if (overlay === 'flow') {
        if (!pipe.enabled) return clr.pipeClosed;
        const mag = Math.abs(pipe.flow);
        if (mag < 0.05) return clr.pipeNoFlow;
        const t = Math.min(mag / 40, 1);
        return lerpColor('#3a6ea5', '#ffcf4d', t);
      }
      switch (pipe.status) {
        case 'closed': return clr.pipeClosed;
        case 'broken': return clr.pipeBroken;
        case 'leaking': return clr.pipeLeak;
        case 'overloaded': return clr.pipeOverload;
        case 'high': return clr.pipeHigh;
        case 'no-flow': return clr.pipeNoFlow;
        default: return clr.pipeNormal;
      }
    }

    drawPipe(pipe, overlay) {
      const ctx = this.ctx;
      const net = this.app.network;
      const a = net.getNode(pipe.from), b = net.getNode(pipe.to);
      if (!a || !b) return;
      const pa = this.worldToScreen(a.x, a.y), pb = this.worldToScreen(b.x, b.y);
      const selected = net.selectedId === pipe.id;

      const width = clampNum(2 + Math.sqrt(pipe.diameter) * 0.35, 2, 14) * this.app.view.zoom;
      const color = this.pipeColor(pipe, overlay);

      ctx.save();
      ctx.lineCap = 'round';

      if (selected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = width + 6;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (!pipe.enabled) ctx.setLineDash([width * 1.4, width * 1.4]);
      else if (pipe.broken) ctx.setLineDash([width * 0.6, width * 1.2]);
      else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      ctx.setLineDash([]);

      // overload hazard stripes
      if (pipe.status === 'overloaded') {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = Math.max(1, width * 0.25);
        ctx.setLineDash([6, 10]);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.setLineDash([]);
      }

      if (pipe.enabled && !pipe.broken && this.app.view.flowAnim && Math.abs(pipe.flow) > 0.05) {
        this.drawFlowParticles(pipe, pa, pb);
      } else if (pipe.enabled && !this.app.view.flowAnim && Math.abs(pipe.flow) > 0.05) {
        this.drawArrow(pa, pb, pipe.flow >= 0);
      }

      if (pipe.leak && pipe.leak.active && pipe.enabled) {
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        this.drawLeakMarker(mx, my, pipe.leak.severity);
      }
      if (pipe.broken) {
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        this.drawBreakMarker(mx, my);
      }

      if (this.app.view.labels.pipeIds || this.app.view.labels.flow) {
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2 - 10;
        let txt = '';
        if (this.app.view.labels.pipeIds) txt += pipe.name;
        if (this.app.view.labels.flow) txt += (txt ? '  ' : '') + Math.abs(pipe.flow).toFixed(1) + ' L/s';
        if (txt) this.drawLabel(mx, my, txt, '#c9d6e8');
      }

      ctx.restore();
    }

    drawArrow(pa, pb, forward) {
      const ctx = this.ctx;
      const from = forward ? pa : pb, to = forward ? pb : pa;
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.fillStyle = '#dce8ff';
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    drawFlowParticles(pipe, pa, pb) {
      const ctx = this.ctx;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const forward = pipe.flow >= 0;
      const speed = clampNum(Math.abs(pipe.flow), 0.5, 60);
      const count = clampNum(Math.round(1 + Math.abs(pipe.flow) / 8), 1, 8);
      const cycle = 1400 - clampNum(speed * 18, 0, 1000); // ms per loop, faster = higher flow
      for (let i = 0; i < count; i++) {
        let t = ((this.time / cycle) + i / count) % 1;
        if (!forward) t = 1 - t;
        const x = pa.x + dx * t, y = pa.y + dy * t;
        const r = clampNum(2 + Math.abs(pipe.flow) * 0.06, 2, 5);
        ctx.beginPath();
        ctx.fillStyle = '#bfe6ff';
        ctx.globalAlpha = 0.9;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // direction chevron near midpoint
      this.drawArrow(pa, pb, forward);
    }

    drawLeakMarker(x, y, severity) {
      const ctx = this.ctx;
      const r = 5 + severity * 6;
      ctx.save();
      ctx.strokeStyle = '#ff9d3c';
      ctx.fillStyle = 'rgba(255,157,60,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // small droplet
      ctx.fillStyle = '#ff9d3c';
      ctx.beginPath();
      const t = (this.time / 500) % 1;
      ctx.arc(x, y + r + t * 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawBreakMarker(x, y) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = '#ff2d2d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 8, y - 8); ctx.lineTo(x - 8, y + 8);
      ctx.stroke();
      ctx.restore();
    }

    drawLabel(x, y, text, color) {
      const ctx = this.ctx;
      ctx.font = '11px system-ui, sans-serif';
      const pad = 3;
      const wtxt = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(8,12,20,0.72)';
      ctx.fillRect(x - wtxt / 2 - pad, y - 10, wtxt + pad * 2, 14);
      ctx.fillStyle = color || '#dce8ff';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y + 1);
      ctx.textAlign = 'left';
    }

    nodeStatusColor(node) {
      if (node.type === 'demand' || node.type === 'junction') {
        const st = C.pressureStatus(node.pressure, node.hasSupply);
        return { CRITICAL: '#ff3b3b', LOW: '#ffb14d', NORMAL: '#5fd37a', HIGH: '#59c9ff', 'NO SUPPLY': '#6b7385' }[st];
      }
      return null;
    }

    drawNode(node, overlay) {
      const ctx = this.ctx;
      const net = this.app.network;
      const p = this.worldToScreen(node.x, node.y);
      const z = this.app.view.zoom;
      const R = 15 * z;
      const selected = net.selectedId === node.id;
      const color = C.colors[node.type];

      ctx.save();
      ctx.translate(p.x, p.y);

      if (selected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, Math.PI * 2); ctx.stroke();
      }

      // status halo
      let haloColor = null;
      if (overlay === 'pressure' && (node.type === 'demand' || node.type === 'junction')) {
        haloColor = this.nodeStatusColor(node);
      } else if (overlay === 'tank' && node.type === 'tank') {
        haloColor = node.fillPercent < 15 ? '#ff3b3b' : node.fillPercent < 40 ? '#ffb14d' : '#5fd37a';
      } else if (overlay === 'demand' && node.type === 'demand') {
        const t = clampNum(node.requiredDemand / 30, 0, 1);
        haloColor = lerpColor('#5fd37a', '#ff3b3b', t);
      } else {
        haloColor = this.nodeStatusColor(node);
      }
      if (haloColor) {
        ctx.beginPath();
        ctx.fillStyle = hexA(haloColor, 0.22);
        ctx.arc(0, 0, R + 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R + 9, 0, Math.PI * 2); ctx.stroke();
      }

      this.drawIcon(node, R, color);

      ctx.restore();

      // labels
      const lbl = this.app.view.labels;
      let lines = [];
      if (lbl.names) lines.push(node.name);
      if (lbl.pressure && node.pressure !== undefined) lines.push(node.pressure.toFixed(1) + 'm');
      if (lines.length) {
        this.drawLabel(p.x, p.y + R + 14, lines.join(' | '), '#e7edf7');
      }
      if (lbl.warnings) {
        const w = net.warnings.find((x) => x.text.includes(node.name));
        if (w) this.drawLabel(p.x, p.y - R - 12, '⚠', '#ffcf4d');
      }
    }

    drawIcon(node, R, color) {
      const ctx = this.ctx;
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.fillStyle = hexA(color, 0.18);

      switch (node.type) {
        case 'reservoir': {
          ctx.beginPath();
          ctx.moveTo(-R, -R * 0.3);
          ctx.lineTo(-R, R * 0.5);
          ctx.quadraticCurveTo(0, R * 0.9, R, R * 0.5);
          ctx.lineTo(R, -R * 0.3);
          ctx.quadraticCurveTo(0, -R * 0.7, -R, -R * 0.3);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-R * 0.7, -R * 0.05);
          ctx.quadraticCurveTo(0, R * 0.25, R * 0.7, -R * 0.05);
          ctx.stroke();
          break;
        }
        case 'pump': {
          ctx.beginPath(); ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.save();
          const spin = node.enabled && !node.failed ? this.time / 260 : 0;
          ctx.rotate(spin);
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.7, Math.sin(a + 0.5) * R * 0.7, Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85);
          }
          ctx.stroke();
          ctx.restore();
          if (!node.enabled || node.failed) {
            ctx.strokeStyle = '#ff3b3b';
            ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.8); ctx.lineTo(R * 0.8, R * 0.8); ctx.stroke();
          }
          break;
        }
        case 'tank': {
          const w = R * 1.5, h = R * 1.7;
          ctx.beginPath();
          ctx.ellipse(0, -h / 2, w / 2, w / 5, 0, 0, Math.PI * 2);
          ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2);
          ctx.ellipse(0, h / 2, w / 2, w / 5, 0, 0, Math.PI, false);
          ctx.lineTo(w / 2, -h / 2);
          ctx.stroke();
          const fillP = clampNum(node.fillPercent || 0, 0, 100) / 100;
          const fh = h * fillP;
          ctx.save();
          ctx.beginPath();
          ctx.rect(-w / 2, h / 2 - fh, w, fh);
          ctx.clip();
          ctx.fillStyle = hexA('#4fb6ff', 0.55);
          ctx.fillRect(-w / 2, -h, w, h * 2);
          ctx.restore();
          break;
        }
        case 'junction': {
          ctx.beginPath(); ctx.arc(0, 0, R * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          break;
        }
        case 'demand': {
          const s = R * 0.9;
          ctx.beginPath();
          ctx.moveTo(-s, s); ctx.lineTo(-s, -s * 0.2); ctx.lineTo(0, -s); ctx.lineTo(s, -s * 0.2); ctx.lineTo(s, s);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.rect(-s * 0.25, s * 0.1, s * 0.5, s * 0.6); ctx.stroke();
          break;
        }
        case 'valve': {
          const s = R * 0.9;
          ctx.beginPath();
          ctx.moveTo(-s, -s * 0.6); ctx.lineTo(0, 0); ctx.lineTo(-s, s * 0.6); ctx.closePath();
          ctx.moveTo(s, -s * 0.6); ctx.lineTo(0, 0); ctx.lineTo(s, s * 0.6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          const openness = clampNum(node.open, 0, 100) / 100;
          ctx.save();
          ctx.rotate((1 - openness) * (Math.PI / 2.4));
          ctx.strokeStyle = openness < 0.05 ? '#ff3b3b' : color;
          ctx.beginPath(); ctx.moveTo(-s * 1.1, 0); ctx.lineTo(s * 1.1, 0); ctx.stroke();
          ctx.restore();
          break;
        }
      }
    }

    drawDraft() {
      const ctx = this.ctx;
      const d = this.app.view.pipeDraft;
      const net = this.app.network;
      const a = net.getNode(d.fromId);
      if (!a) return;
      const pa = this.worldToScreen(a.x, a.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(d.mouseX, d.mouseY); ctx.stroke();
      ctx.restore();
    }
  }

  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function hexA(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function lerpColor(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(hex) {
    const c = hex.replace('#', '');
    return { r: parseInt(c.substring(0, 2), 16), g: parseInt(c.substring(2, 4), 16), b: parseInt(c.substring(4, 6), 16) };
  }

  WNS.Renderer = Renderer;
})(window.WNS);
