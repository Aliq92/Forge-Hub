import { TAU, clamp } from './utils.js';

export class Minimap{
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.resize();
  }
  resize(){
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = this.canvas.clientWidth || 180;
    this.canvas.width = size * this.dpr;
    this.canvas.height = size * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.size = size;
  }

  draw(system, comet){
    const ctx = this.ctx;
    const size = this.size;
    ctx.clearRect(0, 0, size, size);
    const cx = size/2, cy = size/2;
    const worldRadius = system.bounds.radius;
    const scale = (size/2 - 8) / worldRadius;

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, size/2-2, 0, TAU); ctx.clip();

    // belts as faint rings
    ctx.strokeStyle = 'rgba(160,160,180,0.28)';
    for(const belt of system.belts){
      ctx.lineWidth = Math.max(1, belt.bandWidth*scale);
      ctx.beginPath();
      ctx.arc(cx + system.star.x*scale, cy + system.star.y*scale, belt.orbitRadius*scale, 0, TAU);
      ctx.stroke();
    }

    // star
    ctx.fillStyle = '#ffdd8a';
    ctx.beginPath(); ctx.arc(cx + system.star.x*scale, cy + system.star.y*scale, 4, 0, TAU); ctx.fill();

    // flare sector
    if(system.flare.state !== 'idle'){
      ctx.save();
      ctx.globalAlpha = system.flare.state==='warning' ? 0.35 : 0.55;
      ctx.fillStyle = system.flare.state==='warning' ? '#ffb14e' : '#ff5a4e';
      const a0 = system.flare.sectorAngle - system.flare.sectorWidth/2;
      const a1 = system.flare.sectorAngle + system.flare.sectorWidth/2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy, size/2-4, a0, a1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // planets
    for(const p of system.planets){
      const px = cx + p.x*scale, py = cy + p.y*scale;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(px, py, clamp(p.radius*scale*1.4,1.5,4), 0, TAU); ctx.fill();
    }

    // gate
    const gx = cx + system.gate.x*scale, gy = cy + system.gate.y*scale;
    ctx.strokeStyle = '#9bf3ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(gx, gy, 4, 0, TAU); ctx.stroke();

    // comet
    const px = cx + comet.x*scale, py = cy + comet.y*scale;
    ctx.fillStyle = '#eafcff';
    ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,225,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.stroke();

    ctx.restore();

    ctx.strokeStyle = 'rgba(140,150,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, size/2-2, 0, TAU); ctx.stroke();
  }
}
