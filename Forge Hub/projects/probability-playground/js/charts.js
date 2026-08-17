/* charts.js — tiny dependency-free canvas chart helpers.
   Provides a line chart (running probability / average) and a bar chart
   (histograms / frequency distributions with an optional theoretical
   overlay). Both are redrawn on demand — callers batch trials and only
   call draw() periodically, so this stays cheap even at high trial rates. */
(function (global) {
  const PP = (global.PP = global.PP || {});

  function setupCanvas(canvas) {
    const dpr = global.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height || 220));
    if (canvas._cssW !== w || canvas._cssH !== h || canvas._dpr !== dpr) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas._cssW = w;
      canvas._cssH = h;
      canvas._dpr = dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function niceFont(ctx, size) {
    ctx.font = `${size}px "IBM Plex Mono", monospace`;
  }

  function lineChart(canvas, opts) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 48, r: 14, t: 14, b: 26 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    if (plotW <= 4 || plotH <= 4) return;

    const series = (opts.series || []).filter((s) => s.points && s.points.length);
    const allPts = series.flatMap((s) => s.points);
    if (!allPts.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      niceFont(ctx, 12);
      ctx.fillText(opts.emptyLabel || 'No data yet', pad.l, h / 2);
      return;
    }
    let xMin = opts.xMin !== undefined ? opts.xMin : Math.min(...allPts.map((p) => p.x));
    let xMax = opts.xMax !== undefined ? opts.xMax : Math.max(...allPts.map((p) => p.x));
    if (xMax === xMin) xMax = xMin + 1;
    let yMin = opts.yMin !== undefined ? opts.yMin : Math.min(...allPts.map((p) => p.y));
    let yMax = opts.yMax !== undefined ? opts.yMax : Math.max(...allPts.map((p) => p.y));
    if (yMax === yMin) {
      yMax += 1;
      yMin -= 1;
    }
    const xScale = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * plotW;
    const yScale = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    niceFont(ctx, 11);
    ctx.lineWidth = 1;
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const yy = yMin + ((yMax - yMin) * i) / yTicks;
      const py = yScale(yy);
      ctx.beginPath();
      ctx.moveTo(pad.l, py);
      ctx.lineTo(w - pad.r, py);
      ctx.stroke();
      const label = opts.yFormat ? opts.yFormat(yy) : yy.toFixed(2);
      ctx.fillText(label, 4, py + 3);
    }

    (opts.refLines || []).forEach((rl) => {
      const isVertical = rl.x !== undefined;
      ctx.strokeStyle = rl.color || '#f0a500';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (isVertical) {
        const px = xScale(rl.x);
        ctx.moveTo(px, pad.t);
        ctx.lineTo(px, pad.t + plotH);
      } else {
        const py = yScale(rl.y);
        ctx.moveTo(pad.l, py);
        ctx.lineTo(w - pad.r, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (rl.label) {
        ctx.fillStyle = rl.color || '#f0a500';
        niceFont(ctx, 11);
        if (isVertical) {
          const px = xScale(rl.x);
          ctx.fillText(rl.label, Math.min(w - pad.r - ctx.measureText(rl.label).width, px + 6), pad.t + 12);
        } else {
          const py = yScale(rl.y);
          const tw = ctx.measureText(rl.label).width;
          ctx.fillText(rl.label, w - pad.r - tw - 4, Math.max(pad.t + 10, py - 5));
        }
      }
    });

    series.forEach((s) => {
      ctx.strokeStyle = s.color || '#4fd1c5';
      ctx.lineWidth = s.width || 2;
      if (s.points.length > 1) {
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const px = xScale(p.x);
          const py = yScale(Math.max(yMin, Math.min(yMax, p.y)));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        if (s.fill) {
          ctx.lineTo(xScale(s.points[s.points.length - 1].x), yScale(yMin));
          ctx.lineTo(xScale(s.points[0].x), yScale(yMin));
          ctx.closePath();
          ctx.fillStyle = s.fillColor || 'rgba(79,209,197,0.08)';
          ctx.fill();
        }
      }
      if (s.marker) {
        ctx.fillStyle = s.markerColor || s.color || '#4fd1c5';
        s.points.forEach((p) => {
          const px = xScale(p.x);
          const py = yScale(Math.max(yMin, Math.min(yMax, p.y)));
          ctx.beginPath();
          ctx.arc(px, py, s.markerRadius || 4.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    niceFont(ctx, 11);
    const xMinLabel = opts.xFormat ? opts.xFormat(xMin) : String(Math.round(xMin));
    const xMaxLabel = opts.xFormat ? opts.xFormat(xMax) : String(Math.round(xMax));
    ctx.fillText(xMinLabel, pad.l, h - 7);
    const mw = ctx.measureText(xMaxLabel).width;
    ctx.fillText(xMaxLabel, w - pad.r - mw, h - 7);

    if (opts.legend && series.length > 1) {
      let lx = pad.l + 8;
      series.forEach((s) => {
        ctx.fillStyle = s.color || '#4fd1c5';
        ctx.fillRect(lx, pad.t - 2, 8, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        niceFont(ctx, 11);
        ctx.fillText(s.label || '', lx + 12, pad.t + 6);
        lx += 14 + ctx.measureText(s.label || '').width + 14;
      });
    }
  }

  function barChart(canvas, opts) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 42, r: 12, t: 16, b: 30 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const bars = opts.bars || [];
    if (plotW <= 4 || plotH <= 4 || !bars.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      niceFont(ctx, 12);
      ctx.fillText(opts.emptyLabel || 'No data yet', 10, h / 2);
      return;
    }
    const theo = opts.theoretical || [];
    const yMax = opts.yMax !== undefined
      ? opts.yMax
      : Math.max(...bars.map((b) => b.value), ...theo.map((t) => t.value), 0.0001) * 1.12;
    const n = bars.length;
    const gap = Math.min(10, Math.max(2, (plotW / n) * 0.22));
    const bw = (plotW - gap * (n + 1)) / n;

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    niceFont(ctx, 11);
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const val = (yMax * i) / yTicks;
      const py = pad.t + plotH - (val / yMax) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.l, py);
      ctx.lineTo(w - pad.r, py);
      ctx.stroke();
      ctx.fillText(opts.yFormat ? opts.yFormat(val) : val.toFixed(2), 2, py + 3);
    }

    bars.forEach((b, i) => {
      const x = pad.l + gap + i * (bw + gap);
      const bh = Math.max(0, (b.value / yMax) * plotH);
      const y = pad.t + plotH - bh;
      ctx.fillStyle = b.color || opts.barColor || '#4fd1c5';
      ctx.beginPath();
      const r = Math.min(4, bw / 2);
      ctx.moveTo(x, y + bh);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, y + bh);
      ctx.closePath();
      ctx.fill();

      if (theo[i]) {
        const ty = pad.t + plotH - (theo[i].value / yMax) * plotH;
        ctx.strokeStyle = opts.theoColor || '#f0a500';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 2, ty);
        ctx.lineTo(x + bw + 2, ty);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      niceFont(ctx, 10.5);
      const lbl = String(b.label);
      const lw = ctx.measureText(lbl).width;
      if (lw < bw + gap) ctx.fillText(lbl, x + bw / 2 - lw / 2, h - 10);
    });

    if (opts.theoretical && opts.theoretical.length) {
      ctx.fillStyle = opts.theoColor || '#f0a500';
      niceFont(ctx, 10.5);
      ctx.fillText('— theoretical', pad.l, pad.t - 4);
    }
  }

  PP.charts = { setupCanvas, lineChart, barChart };
})(window);
