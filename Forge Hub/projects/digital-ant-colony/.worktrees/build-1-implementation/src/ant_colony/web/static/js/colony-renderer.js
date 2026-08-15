import { drawAnts } from "./ants.js";
import { drawTasks } from "./tasks.js";

export class ColonyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.antPositions = new Map();
  }

  render(state, elapsedMs) {
    const context = this.context;
    const viewport = { width: this.canvas.width, height: this.canvas.height };
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.fillStyle = "#07151d";
    context.fillRect(0, 0, viewport.width, viewport.height);

    const glow = context.createRadialGradient(viewport.width / 2, viewport.height / 2, 8, viewport.width / 2, viewport.height / 2, 115);
    const synthesis = state?.colony?.synthesis_active;
    const alpha = synthesis ? 0.28 + Math.sin(elapsedMs / 260) * 0.08 : 0.12;
    glow.addColorStop(0, `rgba(239, 119, 255, ${alpha})`);
    glow.addColorStop(1, "rgba(32, 92, 108, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(viewport.width / 2, viewport.height / 2, 115, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = synthesis ? "#ef77ff" : "#2e6c7a";
    context.lineWidth = synthesis ? 3 : 1.5;
    context.beginPath();
    context.arc(viewport.width / 2, viewport.height / 2, 36, 0, Math.PI * 2);
    context.stroke();

    if (!state) return;
    drawTasks(context, state, viewport, elapsedMs);
    drawAnts(context, state, viewport, elapsedMs, this.antPositions);
  }
}
