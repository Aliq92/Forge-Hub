import { antDestination, pheromoneVisual, profileAppearance, taskPosition } from "./colony-layout.js";

function polygon(context, x, y, radius, sides, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + index * Math.PI * 2 / sides;
    const point = { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.closePath();
}

export function drawAnts(context, state, viewport, elapsedMs, positions) {
  for (const ant of Object.values(state.ants)) {
    const destination = antDestination(ant, state.tasks, viewport, elapsedMs);
    const current = positions.get(ant.id) ?? antDestination({ ...ant, targetTaskId: null }, state.tasks, viewport, elapsedMs);
    const speed = ant.activity === "MOVING_TO_TASK" ? 0.09 : 0.16;
    const position = {
      x: current.x + (destination.x - current.x) * speed,
      y: current.y + (destination.y - current.y) * speed,
    };
    positions.set(ant.id, position);

    const target = ant.targetTaskId ? state.tasks[ant.targetTaskId] : null;
    if (target) {
      const targetPosition = taskPosition(target, state.tasks, viewport);
      const signal = pheromoneVisual(target.pheromones);
      context.strokeStyle = `rgba(79, 205, 255, ${0.16 + signal.alpha * 0.5})`;
      context.lineWidth = signal.trailWidth;
      context.beginPath();
      context.moveTo(position.x, position.y);
      context.lineTo(targetPosition.x, targetPosition.y);
      context.stroke();
    }

    const appearance = profileAppearance(ant.profile);
    context.fillStyle = appearance.color;
    context.strokeStyle = ant.activity === "VERIFYING" ? "#fff2ac" : "#07141b";
    context.lineWidth = ant.activity === "VERIFYING" ? 3 : 1.5;
    if (appearance.shape === "diamond") polygon(context, position.x, position.y, 8, 4, Math.PI / 4);
    else if (appearance.shape === "hexagon") polygon(context, position.x, position.y, 9, 6);
    else {
      context.beginPath();
      context.arc(position.x, position.y, 7, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
  }
}
