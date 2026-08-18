// Lookahead audio scheduler (Chris Wilson "A Tale of Two Clocks" pattern).
// Audio timing is driven purely by AudioContext.currentTime; setTimeout only decides
// how often we *check* whether it's time to schedule the next steps. The visual
// playhead never drives audio — it just replays a queue of {step, time} entries
// against ctx.currentTime via requestAnimationFrame (see main.js).

const LOOKAHEAD_MS = 25.0;
const SCHEDULE_AHEAD_S = 0.12;
const MAX_SWING_PCT = 70;

export class Scheduler {
  constructor(ctx, onStep) {
    this.ctx = ctx;
    this.onStep = onStep; // (stepIndex, time) => void
    this.bpm = 120;
    this.swing = 0;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timerId = null;
    this.playing = false;
  }

  setBpm(bpm) {
    this.bpm = Math.max(60, Math.min(180, bpm));
  }

  setSwing(pct) {
    this.swing = Math.max(0, Math.min(MAX_SWING_PCT, pct));
  }

  sixteenthDuration() {
    return 60.0 / this.bpm / 4;
  }

  advanceStep() {
    const dur = this.sixteenthDuration();
    const swingAmt = dur * (this.swing / 100) * 0.5;
    // Even step index -> the *upcoming* step is odd: delay it.
    // Odd step index -> the *upcoming* step is even: pull it back by the same
    // amount so each even/odd pair still spans exactly 2*dur (tempo unaffected).
    if (this.currentStep % 2 === 0) {
      this.nextStepTime += dur + swingAmt;
    } else {
      this.nextStepTime += dur - swingAmt;
    }
    this.currentStep = (this.currentStep + 1) % 16;
  }

  tick = () => {
    while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.onStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    this.timerId = setTimeout(this.tick, LOOKAHEAD_MS);
  };

  start() {
    if (this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.tick();
  }

  stop() {
    this.playing = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;
    this.currentStep = 0;
  }

  pause() {
    this.playing = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;
  }

  resume() {
    if (this.playing) return;
    this.playing = true;
    this.nextStepTime = this.ctx.currentTime + 0.06;
    this.tick();
  }
}
