import test from "node:test";
import assert from "node:assert/strict";

import { connectColonySocket } from "../../src/ant_colony/web/static/js/websocket.js";

class FakeWebSocket {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type, payload) {
    this.listeners.get(type)?.(payload);
  }
}

test("incoming envelopes are reduced strictly one at a time", async () => {
  let releaseFirst;
  const firstCanFinish = new Promise((resolve) => { releaseFirst = resolve; });
  const order = [];
  let active = 0;
  let maximumActive = 0;

  const socket = connectColonySocket({
    locationRef: { protocol: "http:", host: "localhost:8000" },
    WebSocketImpl: FakeWebSocket,
    fetchImpl: async () => { throw new Error("unexpected snapshot request"); },
    onStatus: () => {},
    onEnvelope: async (envelope) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      order.push(`start-${envelope.sequence}`);
      if (envelope.sequence === 1) await firstCanFinish;
      order.push(`end-${envelope.sequence}`);
      active -= 1;
    },
  });

  socket.emit("message", { data: JSON.stringify({ sequence: 1, event_type: "TASK_CREATED" }) });
  socket.emit("message", { data: JSON.stringify({ sequence: 2, event_type: "TASK_CLAIMED" }) });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(order, ["start-1"]);
  releaseFirst();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(maximumActive, 1);
  assert.deepEqual(order, ["start-1", "end-1", "start-2", "end-2"]);
});
