import {
  emptySteps, emptyPattern, clonePattern, TRACK_IDS,
} from './state.js';

export function clearTrack(pattern, trackId) {
  if (trackId === 'bass') {
    pattern.bass.steps = emptySteps();
    return;
  }
  pattern.drums[trackId] = emptySteps();
}

export function clearPattern(pattern) {
  TRACK_IDS.forEach((id) => { pattern.drums[id] = emptySteps(); });
  pattern.bass.steps = emptySteps();
}

export function duplicateInto(sourcePattern) {
  return clonePattern(sourcePattern);
}

export function newBlankPattern() {
  return emptyPattern();
}
