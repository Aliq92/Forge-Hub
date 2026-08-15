import { applyEvent, createColonyState } from "./colony-state.js";
import { ColonyRenderer } from "./colony-renderer.js";
import { connectColonySocket, fetchSnapshot } from "./websocket.js";

let state = null;
const renderer = new ColonyRenderer(document.querySelector("[data-colony-canvas]"));

function renderText() {
  if (!state) return;
  document.querySelector("[data-colony-status]").textContent = state.colony.status;
  document.querySelector("[data-cycle]").textContent = String(state.cycle);
  document.querySelector("[data-ant-count]").textContent = String(Object.keys(state.ants).length);
  document.querySelector("[data-task-count]").textContent = String(Object.keys(state.tasks).length);
  const history = document.querySelector("[data-event-history]");
  history.replaceChildren(...state.events.slice(-10).reverse().map((event) => {
    const item = document.createElement("li");
    item.textContent = `${String(event.sequence).padStart(3, "0")} ${event.event_type}`;
    return item;
  }));
  const result = state.colony.final_result;
  document.querySelector("[data-final-result]").textContent = result?.content ?? "Awaiting synthesis";
  document.querySelector("[data-final-confidence]").textContent = result ? result.confidence.toFixed(2) : "—";
}

async function acceptEnvelope(envelope) {
  if (envelope.message_type === "SNAPSHOT") {
    state = createColonyState(envelope);
  } else if (state) {
    state = applyEvent(state, envelope);
    if (state.needsResnapshot) state = createColonyState(await fetchSnapshot());
  }
  renderText();
}

document.querySelector("[data-start]").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  const response = await fetch("/api/runs", { method: "POST" });
  if (!response.ok && response.status !== 409) throw new Error(`run start failed: ${response.status}`);
});

connectColonySocket({
  onEnvelope: acceptEnvelope,
  onStatus: (status) => { document.querySelector("[data-connection]").textContent = status; },
});

function animate(elapsedMs) {
  renderer.render(state, elapsedMs);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
