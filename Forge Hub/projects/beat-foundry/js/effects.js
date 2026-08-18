// Small helpers that translate musical FX settings into audioEngine calls.

export const DELAY_SUBDIVISIONS = {
  '1/8': 0.5,
  '1/4': 1.0,
  '1/8d': 0.75, // dotted 1/8
};

export function delayTimeForBpm(bpm, subdivision) {
  const beatSeconds = 60 / bpm;
  const factor = DELAY_SUBDIVISIONS[subdivision] || DELAY_SUBDIVISIONS['1/8'];
  return beatSeconds * factor;
}

// Applies a brief gain-reduction dip to `gainParam` at time `t`, used for the
// kick-triggered sidechain "pump" on the bass bus.
export function duckGain(ctx, gainParam, time, depth, releaseSec = 0.16) {
  if (depth <= 0) return;
  const now = time;
  const baseline = 1;
  gainParam.cancelScheduledValues(now);
  gainParam.setValueAtTime(baseline, now);
  gainParam.linearRampToValueAtTime(Math.max(0.02, 1 - depth), now + 0.012);
  gainParam.setTargetAtTime(baseline, now + 0.012, releaseSec / 3);
}
