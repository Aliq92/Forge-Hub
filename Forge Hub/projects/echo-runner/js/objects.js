// objects.js — deterministic evaluation of puzzle objects (moving platforms, lasers,
// plates, switches, doors, crumbling floors). Everything here is a pure function of
// the attempt tick and recorded entity inputs, so replay is always reproducible.
import { TICK_RATE, DT, aabbOverlap } from './physics.js';

// Cycle order is: [dwell at A] -> [travel A to B] -> [dwell at B] -> [travel B to A] -> repeat.
// Starting each attempt with a dwell (rather than mid-departure) gives the player a
// predictable window to board right after a reset, instead of requiring them to chase it.
export function movingPlatformRectAt(mp, tick) {
  const [A, B] = mp.points;
  const dist = Math.hypot(B.x - A.x, B.y - A.y);
  const travelTime = dist / mp.speed; // seconds
  const wait = mp.waitTicks ? mp.waitTicks / TICK_RATE : 0;
  const cycle = 2 * (travelTime + wait);
  const t = cycle > 0 ? (tick * DT) % cycle : 0;

  let frac, from, to;
  if (t < wait) {
    frac = 0; from = A; to = B;
  } else if (t < wait + travelTime) {
    frac = travelTime > 0 ? (t - wait) / travelTime : 1;
    from = A; to = B;
  } else if (t < 2 * wait + travelTime) {
    frac = 1; from = A; to = B;
  } else {
    frac = travelTime > 0 ? (t - 2 * wait - travelTime) / travelTime : 1;
    from = B; to = A;
  }
  const x = from.x + (to.x - from.x) * frac;
  const y = from.y + (to.y - from.y) * frac;
  return { x, y, w: mp.w, h: mp.h, id: mp.id, isMoving: true };
}

// Lasers are either cycle-driven (onTicks/offTicks) or link-driven (disableLinks:
// a list of plate/switch ids that, while active, suppress the beam).
export function laserActiveAt(laser, tick, rt) {
  if (laser.disableLinks) {
    const disabled = laser.disableLinks.some((id) => {
      if (rt.plates[id]) return rt.plates[id].active;
      if (rt.switches[id]) return rt.switches[id].on;
      return false;
    });
    return !disabled;
  }
  const offset = laser.offsetTicks || 0;
  const cyc = laser.onTicks + laser.offTicks;
  return ((tick + offset) % cyc) < laser.onTicks;
}

export function isEntityOnPlate(entity, plate) {
  if (!entity.grounded) return false;
  const overlapX = entity.x < plate.x + plate.w && entity.x + entity.w > plate.x;
  const closeY = Math.abs((entity.y + entity.h) - plate.y) < 3;
  return overlapX && closeY;
}

export function plateAllows(plate, entity) {
  if (plate.allow === 'echo') return entity.type === 'echo';
  if (plate.allow === 'player') return entity.type === 'player';
  return true;
}

// Creates a fresh mutable runtime state for a room attempt (reset every retry).
export function createRoomRuntime(levelDef) {
  const rt = { plates: {}, switches: {}, doors: {}, crumbling: {}, particles: [] };
  (levelDef.plates || []).forEach((p) => (rt.plates[p.id] = { active: false }));
  (levelDef.switches || []).forEach((s) => (rt.switches[s.id] = { on: false }));
  (levelDef.doors || []).forEach((d) => (rt.doors[d.id] = { open: !!d.startOpen, timedUntil: null, risingArm: {} }));
  (levelDef.crumblingFloors || []).forEach((c) => (rt.crumbling[c.id] = { touchedTick: null, broken: false }));
  return rt;
}

// entities: array of live physics entities this tick (player + echoes), each with .type/.echoIndex
// inputsThisTick: Map entity -> input snapshot used this tick (for interact edge detection)
export function evaluateTriggers(levelDef, rt, entities, inputsThisTick, tick, events) {
  // Plates: active while ANY allowed entity currently stands on them.
  for (const plate of levelDef.plates || []) {
    let active = false;
    for (const ent of entities) {
      if (!plateAllows(plate, ent)) continue;
      if (isEntityOnPlate(ent, plate)) { active = true; break; }
    }
    const st = rt.plates[plate.id];
    if (active && !st.active) events.push({ type: 'plateOn', id: plate.id });
    if (!active && st.active) events.push({ type: 'plateOff', id: plate.id });
    st.active = active;
  }

  // Switches: toggle on interact-press edge while an entity overlaps the switch zone.
  for (const sw of levelDef.switches || []) {
    for (const ent of entities) {
      if (!plateAllows(sw, ent)) continue;
      const input = inputsThisTick.get(ent);
      if (!input || !input.interactPressed) continue;
      if (!aabbOverlap(ent, sw)) continue;
      const st = rt.switches[sw.id];
      st.on = !st.on;
      events.push({ type: 'switchToggle', id: sw.id, on: st.on });
    }
  }

  // Doors: open if any (or all, if requireAll) linked plate/switch source is active,
  // OR a timed-open window from a linked timed switch is still counting down.
  for (const door of levelDef.doors || []) {
    const sources = (door.links || []).map((linkId) => {
      if (rt.plates[linkId]) return rt.plates[linkId].active;
      if (rt.switches[linkId]) return rt.switches[linkId].on;
      return false;
    });
    let logic;
    if (sources.length === 0) logic = !!door.startOpen;
    else logic = door.requireAll ? sources.every(Boolean) : sources.some(Boolean);

    const st = rt.doors[door.id];
    let open = logic;
    // timed doors: a linked switch turning on (rising edge) starts a countdown window
    if (door.timedTicks) {
      for (const linkId of door.links || []) {
        const sw = rt.switches[linkId];
        if (!sw) continue;
        const wasArmed = st.risingArm[linkId];
        if (sw.on && !wasArmed) {
          st.timedUntil = tick + door.timedTicks;
          events.push({ type: 'doorTimedStart', id: door.id });
        }
        st.risingArm[linkId] = sw.on;
      }
      if (st.timedUntil !== null) {
        if (tick <= st.timedUntil) open = true;
        else st.timedUntil = null;
      }
    }
    if (open && !st.open) events.push({ type: 'doorOpen', id: door.id });
    if (!open && st.open) events.push({ type: 'doorClose', id: door.id });
    st.open = open;
  }

  // Crumbling floors: start timer on first contact this attempt; break after delay.
  for (const cf of levelDef.crumblingFloors || []) {
    const st = rt.crumbling[cf.id];
    if (st.broken) continue;
    let touched = false;
    for (const ent of entities) {
      if (isEntityOnPlate(ent, { x: cf.x, y: cf.y, w: cf.w, h: cf.h })) { touched = true; break; }
    }
    if (touched && st.touchedTick === null) {
      st.touchedTick = tick;
      events.push({ type: 'crumbleStart', id: cf.id });
    }
    if (st.touchedTick !== null && tick - st.touchedTick >= cf.crumbleDelayTicks) {
      st.broken = true;
      events.push({ type: 'crumbleBreak', id: cf.id });
    }
  }
}

export function doorSolidRect(door, rt) {
  return rt.doors[door.id].open ? null : { x: door.x, y: door.y, w: door.w, h: door.h, id: door.id };
}
