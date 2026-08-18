// recorder.js — captures per-tick input snapshots and stores them as echoes.
// Deterministic replay only ever reads from these arrays; no wall-clock timing involved.

export class Recorder {
  constructor(maxTicks) {
    this.maxTicks = maxTicks;
    this.reset();
  }

  reset() {
    this.isRecording = false;
    this.buffer = [];
    this.echoes = []; // { inputs: [...], id }
    this._nextId = 1;
  }

  clearEchoes() {
    this.echoes = [];
  }

  removeLastEcho() {
    return this.echoes.pop();
  }

  start() {
    this.isRecording = true;
    this.buffer = [];
  }

  // returns the finished echo, or null if nothing recorded
  stop() {
    this.isRecording = false;
    if (this.buffer.length === 0) return null;
    const echo = { id: this._nextId++, inputs: this.buffer };
    this.echoes.push(echo);
    this.buffer = [];
    return echo;
  }

  // discard whatever was being recorded (used on death / forced expiry)
  cancel() {
    this.isRecording = false;
    this.buffer = [];
  }

  // returns true if recording just hit its cap this tick (caller should force-stop as failure)
  captureTick(input) {
    if (!this.isRecording) return false;
    this.buffer.push(input);
    return this.buffer.length >= this.maxTicks;
  }

  timeRemainingTicks() {
    if (!this.isRecording) return this.maxTicks;
    return Math.max(0, this.maxTicks - this.buffer.length);
  }
}

// Given an echo's recorded inputs and the current attempt tick, return the input
// to feed the physics step this tick. Once exhausted the echo goes idle (holds still)
// but keeps simulating physics so it settles under gravity rather than floating.
export function echoInputAt(echo, attemptTick) {
  if (attemptTick < echo.inputs.length) return echo.inputs[attemptTick];
  return { left: false, right: false, jumpPressed: false, jumpHeld: false, interactPressed: false };
}
