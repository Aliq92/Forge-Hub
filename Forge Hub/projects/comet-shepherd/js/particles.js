// Simple pooled particle system shared by tail, pickups, impacts, flares, gates.

export class ParticleSystem{
  constructor(maxParticles = 1400){
    this.max = maxParticles;
    this.pool = new Array(maxParticles);
    for(let i=0;i<maxParticles;i++) this.pool[i] = makeParticle();
    this.freeIdx = maxParticles - 1;
    this.free = this.pool.map((_,i)=>i);
    this.active = [];
    this.densityScale = 1;
  }

  setDensity(scale){ this.densityScale = scale; }

  spawn(opts){
    if(Math.random() > this.densityScale && this.densityScale < 1){
      // probabilistically drop particles when density is reduced
    }
    if(this.free.length === 0) return null;
    const idx = this.free.pop();
    const p = this.pool[idx];
    p.idx = idx;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = p.maxLife = opts.life || 1;
    p.size = opts.size || 2;
    p.sizeEnd = opts.sizeEnd !== undefined ? opts.sizeEnd : p.size * 0.3;
    p.color = opts.color || '255,255,255';
    p.alphaStart = opts.alpha !== undefined ? opts.alpha : 1;
    p.alphaEnd = opts.alphaEnd !== undefined ? opts.alphaEnd : 0;
    p.drag = opts.drag !== undefined ? opts.drag : 0.98;
    p.gravity = opts.gravity || 0;
    p.glow = opts.glow || false;
    this.active.push(p);
    return p;
  }

  spawnBudget(count){
    return Math.round(count * this.densityScale);
  }

  update(dt){
    const still = [];
    for(const p of this.active){
      p.life -= dt;
      if(p.life <= 0){ this.free.push(p.idx); continue; }
      p.vx *= Math.pow(p.drag, dt*60);
      p.vy *= Math.pow(p.drag, dt*60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      still.push(p);
    }
    this.active = still;
  }

  clear(){
    for(const p of this.active) this.free.push(p.idx);
    this.active = [];
  }

  draw(ctx, worldToScreen){
    for(const p of this.active){
      const t = 1 - p.life / p.maxLife;
      const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;
      if(alpha <= 0.003) continue;
      const size = p.size + (p.sizeEnd - p.size) * t;
      const s = worldToScreen(p.x, p.y);
      if(p.glow){
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size*3);
        grad.addColorStop(0, `rgba(${p.color},${alpha})`);
        grad.addColorStop(1, `rgba(${p.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size*3, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.4,size), 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  get count(){ return this.active.length; }
}

function makeParticle(){
  return { idx:0, x:0,y:0, vx:0,vy:0, life:0, maxLife:1, size:2, sizeEnd:0, color:'255,255,255', alphaStart:1, alphaEnd:0, drag:0.98, gravity:0, glow:false };
}
