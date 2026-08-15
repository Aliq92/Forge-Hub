import { pheromoneVisual, taskPosition } from "./colony-layout.js";

function statusColor(status) {
  return ({ OPEN: "#6f8ca8", CLAIMED: "#5bb8ff", COMPLETED: "#62d99f", VERIFIED: "#ffca58", FAILED: "#ff6b7a", BLOCKED: "#997da8" })[status] ?? "#6f8ca8";
}

export function drawTasks(context, state, viewport, elapsedMs) {
  const tasks = Object.values(state.tasks);
  for (const task of tasks) {
    const position = taskPosition(task, state.tasks, viewport);
    if (task.parentId && state.tasks[task.parentId]) {
      const parent = taskPosition(state.tasks[task.parentId], state.tasks, viewport);
      context.strokeStyle = "rgba(115, 146, 169, 0.24)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(parent.x, parent.y);
      context.lineTo(position.x, position.y);
      context.stroke();
    }

    const signal = pheromoneVisual(task.pheromones);
    const pulse = 1 + Math.sin(elapsedMs / 430 + position.x) * 0.06;
    const gradient = context.createRadialGradient(position.x, position.y, 3, position.x, position.y, signal.haloRadius * pulse);
    gradient.addColorStop(0, `rgba(75, 216, 255, ${signal.alpha})`);
    gradient.addColorStop(1, "rgba(75, 216, 255, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(position.x, position.y, signal.haloRadius * pulse, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#102a38";
    context.strokeStyle = statusColor(task.status);
    context.lineWidth = task.status === "VERIFIED" ? 3 : 2;
    context.beginPath();
    context.arc(position.x, position.y, 11, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#c9deea";
    context.font = "10px ui-monospace, monospace";
    context.fillText(task.id, position.x + 15, position.y + 4);
  }
}
