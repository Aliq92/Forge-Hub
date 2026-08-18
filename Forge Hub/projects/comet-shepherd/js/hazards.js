import { randRange, randInt, clamp, dist, TAU } from './utils.js';

// ---------------- Asteroid belts ----------------

export function createAsteroidBelt(orbitRadius, bandWidth, count, rng, starMass){
  const gapCenter = randRange(rng, 0, TAU);
  const gapWidth = randRange(rng, 0.55, 0.9); // radians of guaranteed clear channel
  const asteroids = [];
  for(let i=0;i<count;i++){
    let angle = randRange(rng, 0, TAU);
    // keep a buffer around the gap so the channel stays clear
    let tries = 0;
    while(angularDist(angle, gapCenter) < gapWidth*0.5 + 0.05 && tries < 8){
      angle = randRange(rng, 0, TAU);
      tries++;
    }
    const radial = orbitRadius + randRange(rng, -bandWidth/2, bandWidth/2);
    const size = randRange(rng, 0.6, 1.9);
    const dir = rng() < 0.5 ? 1 : -1;
    // slower drift further out, roughly Keplerian feel
    const angularSpeed = dir * (0.055 / Math.sqrt(orbitRadius/400)) * randRange(rng, 0.7, 1.3);
    asteroids.push({
      angle, radial, size,
      radius: 5 + size*7,
      angularSpeed,
      rotation: randRange(rng,0,TAU),
      rotSpeed: randRange(rng,-1.5,1.5),
      x: Math.cos(angle) * radial, y: Math.sin(angle) * radial,
      wobblePhase: randRange(rng,0,TAU),
    });
  }
  return { orbitRadius, bandWidth, gapCenter, gapWidth, asteroids };
}

function angularDist(a, b){
  let d = Math.abs(a - b) % TAU;
  if(d > Math.PI) d = TAU - d;
  return d;
}

export function updateAsteroidBelt(belt, star, dt){
  for(const a of belt.asteroids){
    a.angle += a.angularSpeed * dt;
    a.rotation += a.rotSpeed * dt;
    a.x = star.x + Math.cos(a.angle) * a.radial;
    a.y = star.y + Math.sin(a.angle) * a.radial;
  }
}

// Returns the asteroid the comet is currently overlapping, or null.
export function findAsteroidCollision(belts, comet){
  for(const belt of belts){
    for(const a of belt.asteroids){
      if(a.hit) continue;
      const d = dist(a.x, a.y, comet.x, comet.y);
      if(d < a.radius + comet.radius) return a;
    }
  }
  return null;
}

// ---------------- Solar flares ----------------

export class FlareController{
  constructor(rng, difficultyFactor){
    this.rng = rng;
    this.difficulty = difficultyFactor;
    this.state = 'idle'; // idle -> warning -> active -> idle
    this.timer = randRange(rng, 14, 22) / Math.max(1, difficultyFactor*0.5);
    this.sectorAngle = 0;
    this.sectorWidth = Math.PI/2.6;
    this.warnDuration = 4.5;
    this.activeDuration = randRange(rng, 3.5, 5.5);
    this.t = 0;
  }

  update(dt){
    const events = { justWarned:false, justActivated:false, justEnded:false };
    this.t += dt;
    if(this.state === 'idle'){
      this.timer -= dt;
      if(this.timer <= 0){
        this.state = 'warning';
        this.t = 0;
        this.sectorAngle = randRange(this.rng, 0, TAU);
        events.justWarned = true;
      }
    } else if(this.state === 'warning'){
      if(this.t >= this.warnDuration){
        this.state = 'active';
        this.t = 0;
        events.justActivated = true;
      }
    } else if(this.state === 'active'){
      if(this.t >= this.activeDuration){
        this.state = 'idle';
        this.t = 0;
        this.timer = randRange(this.rng, 16, 26) / Math.max(1, this.difficulty*0.5);
        events.justEnded = true;
      }
    }
    return events;
  }

  isPointInSector(angle, marginRad=0){
    return angularDist(angle, this.sectorAngle) < (this.sectorWidth/2 + marginRad);
  }
}

export function checkFlareHeat(flare, star, comet){
  if(flare.state !== 'active') return 0;
  const ang = Math.atan2(comet.y - star.y, comet.x - star.x);
  if(!flare.isPointInSector(ang)) return 0;
  const d = dist(star.x, star.y, comet.x, comet.y);
  const reach = star.heatRadius * 1.6;
  if(d > reach) return 0;
  const falloff = clamp(1 - d/reach, 0, 1);
  return 55 * falloff; // extra heat/sec on top of base solar heat
}
