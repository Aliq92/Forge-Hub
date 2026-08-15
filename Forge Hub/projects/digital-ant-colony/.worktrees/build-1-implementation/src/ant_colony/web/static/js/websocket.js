export function socketUrl(locationRef = window.location) {
  const protocol = locationRef.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${locationRef.host}/ws`;
}

export async function fetchSnapshot(fetchImpl = fetch) {
  const response = await fetchImpl("/api/state");
  if (!response.ok) throw new Error(`snapshot request failed: ${response.status}`);
  return response.json();
}

export function connectColonySocket({ onEnvelope, onStatus, locationRef = window.location, WebSocketImpl = WebSocket, fetchImpl = fetch }) {
  const socket = new WebSocketImpl(socketUrl(locationRef));
  let messageQueue = Promise.resolve();
  socket.addEventListener("open", () => onStatus("connected"));
  socket.addEventListener("message", (message) => {
    messageQueue = messageQueue.then(async () => {
      const envelope = JSON.parse(message.data);
      if (envelope.event_type === "RESNAPSHOT_REQUIRED") {
        await onEnvelope(await fetchSnapshot(fetchImpl));
        return;
      }
      await onEnvelope(envelope);
    }).catch(() => onStatus("error"));
  });
  socket.addEventListener("close", () => onStatus("disconnected"));
  socket.addEventListener("error", () => onStatus("error"));
  return socket;
}
