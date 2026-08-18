// Lightweight canvas visualizer driven by an AnalyserNode. Frequency bars plus a
// thin master level meter. Runs on requestAnimationFrame — never touches audio timing.

export function createVisualizer(canvas, analyser, reducedMotionFn) {
  const ctx2d = canvas.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const freqData = new Uint8Array(bufferLength);
  const timeData = new Uint8Array(analyser.fftSize);
  let rafId = null;
  let dpr = Math.min(2, window.devicePixelRatio || 1);

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function draw() {
    rafId = requestAnimationFrame(draw);
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    ctx2d.clearRect(0, 0, w, h);

    const reduced = reducedMotionFn ? reducedMotionFn() : false;
    const barCount = 40;
    const step = Math.floor(bufferLength / barCount);
    const barWidth = w / barCount;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6ee7c9';

    ctx2d.fillStyle = accent;
    ctx2d.globalAlpha = reduced ? 0.55 : 0.85;
    for (let i = 0; i < barCount; i += 1) {
      let sum = 0;
      for (let j = 0; j < step; j += 1) sum += freqData[i * step + j];
      const avg = sum / step / 255;
      const barH = Math.max(2, avg * h);
      const x = i * barWidth + barWidth * 0.15;
      const bw = barWidth * 0.7;
      ctx2d.fillRect(x, h - barH, bw, barH);
    }
    ctx2d.globalAlpha = 1;

    // RMS level meter as a thin line across the top
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const v = (timeData[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    const meterW = Math.min(w, rms * w * 2.2);
    ctx2d.fillStyle = accent;
    ctx2d.globalAlpha = 0.9;
    ctx2d.fillRect(0, 0, meterW, Math.max(2, 2 * dpr));
    ctx2d.globalAlpha = 1;
  }

  resize();
  window.addEventListener('resize', resize);
  draw();

  return {
    stop() { if (rafId) cancelAnimationFrame(rafId); },
    resize,
  };
}
