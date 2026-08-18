// physics.js — deterministic fixed-timestep platformer physics.
// Pure functions only: given the same entity state + input + world geometry,
// output must always be identical. This is what makes echo replay trustworthy.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const PHYS = {
  MOVE_ACCEL: 2600,      // px/s^2 while a direction is held
  MOVE_MAX_SPEED: 230,   // px/s
  GROUND_FRICTION: 2200, // px/s^2 deceleration when no input
  AIR_FRICTION: 900,
  GRAVITY: 1550,
  MAX_FALL_SPEED: 900,
  JUMP_VELOCITY: -510,
  COYOTE_TICKS: 6,       // ~0.1s
  JUMP_BUFFER_TICKS: 7,  // ~0.12s
  PLAYER_W: 22,
  PLAYER_H: 34,
};

export function makeEntityPhysicsState(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    w: PHYS.PLAYER_W, h: PHYS.PLAYER_H,
    grounded: false,
    wasGrounded: false,
    facing: 1,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    standingOn: null, // id of moving platform currently riding
    landedThisTick: false,
    jumpedThisTick: false,
    dead: false,
  };
}

export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectOf(e) {
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

// Resolve movement against a list of solid rects using axis-separated AABB sweep.
// solids: array of {x,y,w,h, oneWay?:bool, allowDir?:1|-1 (one-way gate normal)}
function moveAndCollide(entity, dx, dy, solids) {
  entity.grounded = false;

  // X axis
  entity.x += dx;
  for (const s of solids) {
    if (s.oneWay) continue; // one-way platforms only block from above (handled in Y pass)
    if (s.isGate) continue; // gates only block horizontal motion, handled specially below
    if (!aabbOverlap(entity, s)) continue;
    if (dx > 0) entity.x = s.x - entity.w;
    else if (dx < 0) entity.x = s.x + s.w;
  }
  // one-way gates: block horizontal movement opposing allowDir
  for (const s of solids) {
    if (!s.isGate) continue;
    if (!aabbOverlap(entity, s)) continue;
    const movingDir = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    if (movingDir !== 0 && movingDir !== s.allowDir) {
      if (dx > 0) entity.x = s.x - entity.w;
      else if (dx < 0) entity.x = s.x + s.w;
    }
  }

  // Y axis
  entity.y += dy;
  for (const s of solids) {
    if (s.isGate) continue;
    if (s.oneWay) {
      // only collide when falling and entity's previous bottom was above platform top
      if (dy >= 0) {
        const prevBottom = entity.y + entity.h - dy;
        if (prevBottom <= s.y + 0.5 && aabbOverlap(entity, s)) {
          entity.y = s.y - entity.h;
          entity.vy = 0;
          entity.grounded = true;
          entity.standingOn = s.id || null;
        }
      }
      continue;
    }
    if (!aabbOverlap(entity, s)) continue;
    if (dy > 0) {
      entity.y = s.y - entity.h;
      entity.vy = 0;
      entity.grounded = true;
      entity.standingOn = s.id || null;
    } else if (dy < 0) {
      entity.y = s.y + s.h;
      entity.vy = 0;
    }
  }
}

// input: {left,right,jumpPressed,jumpHeld,interactPressed}
// solids: static + dynamic solid rects for this tick (already positioned)
export function stepEntity(entity, input, solids) {
  entity.landedThisTick = false;
  entity.jumpedThisTick = false;
  entity.wasGrounded = entity.grounded;

  // horizontal
  let targetDir = 0;
  if (input.left) targetDir -= 1;
  if (input.right) targetDir += 1;
  if (targetDir !== 0) entity.facing = targetDir;

  if (targetDir !== 0) {
    entity.vx += targetDir * PHYS.MOVE_ACCEL * DT;
    entity.vx = Math.max(-PHYS.MOVE_MAX_SPEED, Math.min(PHYS.MOVE_MAX_SPEED, entity.vx));
  } else {
    const fr = (entity.grounded ? PHYS.GROUND_FRICTION : PHYS.AIR_FRICTION) * DT;
    if (entity.vx > 0) entity.vx = Math.max(0, entity.vx - fr);
    else if (entity.vx < 0) entity.vx = Math.min(0, entity.vx + fr);
  }

  // timers
  if (entity.grounded) entity.coyoteTimer = PHYS.COYOTE_TICKS;
  else entity.coyoteTimer = Math.max(0, entity.coyoteTimer - 1);

  if (input.jumpPressed) entity.jumpBufferTimer = PHYS.JUMP_BUFFER_TICKS;
  else entity.jumpBufferTimer = Math.max(0, entity.jumpBufferTimer - 1);

  // gravity
  entity.vy += PHYS.GRAVITY * DT;
  if (entity.vy > PHYS.MAX_FALL_SPEED) entity.vy = PHYS.MAX_FALL_SPEED;

  // jump
  if (entity.jumpBufferTimer > 0 && entity.coyoteTimer > 0) {
    entity.vy = PHYS.JUMP_VELOCITY;
    entity.jumpBufferTimer = 0;
    entity.coyoteTimer = 0;
    entity.grounded = false;
    entity.jumpedThisTick = true;
  }

  const dx = entity.vx * DT;
  const dy = entity.vy * DT;
  entity.standingOn = null;
  moveAndCollide(entity, dx, dy, solids);

  if (entity.grounded && !entity.wasGrounded) entity.landedThisTick = true;

  return entity;
}

export function rectFrom(x, y, w, h, extra) {
  return Object.assign({ x, y, w, h }, extra || {});
}
