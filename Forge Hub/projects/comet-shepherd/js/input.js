import { dist } from './utils.js';
import { CONFIG } from './config.js';

export class InputManager{
  constructor(canvas){
    this.canvas = canvas;
    this.pointerScreen = { x: window.innerWidth/2, y: window.innerHeight/2 - 100 };
    this.dragging = false;
    this.dragStartScreen = null;
    this.keys = { left:false, right:false };
    this.events = [];
    this.enabled = true;

    canvas.addEventListener('pointerdown', (e) => {
      if(!this.enabled) return;
      canvas.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.dragStartScreen = { x: e.clientX, y: e.clientY };
      this.pointerScreen = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', (e) => {
      this.pointerScreen = { x: e.clientX, y: e.clientY };
    });
    const endDrag = (e) => {
      if(!this.dragging) return;
      this.dragging = false;
      this.events.push({ type:'drag_end', start:this.dragStartScreen, end:{x:e.clientX,y:e.clientY} });
      this.dragStartScreen = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', (e) => { if(e.pointerType !== 'touch') return; });

    window.addEventListener('keydown', (e) => {
      if(!this.enabled) return;
      switch(e.code){
        case 'ArrowLeft': case 'KeyA': this.keys.left = true; break;
        case 'ArrowRight': case 'KeyD': this.keys.right = true; break;
        case 'Space': this.events.push({type:'emergency'}); e.preventDefault(); break;
        case 'KeyE': this.events.push({type:'toggle_preview'}); break;
        case 'Escape': this.events.push({type:'pause'}); break;
      }
    });
    window.addEventListener('keyup', (e) => {
      switch(e.code){
        case 'ArrowLeft': case 'KeyA': this.keys.left = false; break;
        case 'ArrowRight': case 'KeyD': this.keys.right = false; break;
      }
    });
    window.addEventListener('blur', () => { this.keys.left = false; this.keys.right = false; this.dragging = false; });
  }

  dragVector(){
    if(!this.dragging || !this.dragStartScreen) return null;
    const dx = this.pointerScreen.x - this.dragStartScreen.x;
    const dy = this.pointerScreen.y - this.dragStartScreen.y;
    const d = Math.hypot(dx, dy);
    return { dx, dy, dist: d, strengthFrac: Math.min(1, Math.max(0, (d - CONFIG.CORRECTION_MIN_DRAG) / (CONFIG.CORRECTION_MAX_DRAG - CONFIG.CORRECTION_MIN_DRAG))) };
  }

  pollEvents(){ const e = this.events; this.events = []; return e; }

  setEnabled(v){
    this.enabled = v;
    if(!v){ this.dragging = false; this.keys.left = false; this.keys.right = false; }
  }
}
