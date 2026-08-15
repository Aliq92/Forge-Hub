"""Local FastAPI server for the read-only colony observer."""

from importlib.resources import files

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ant_colony.web.controller import RunAlreadyStartedError, RunController
from ant_colony.web.protocol import BrowserEnvelope, BrowserMessageType
from ant_colony.web.state import SnapshotBuilder


def _idle_snapshot() -> BrowserEnvelope:
    return BrowserEnvelope(
        1,
        BrowserMessageType.SNAPSHOT,
        "",
        0,
        0,
        None,
        {
            "colony": {
                "status": "IDLE",
                "cycle": 0,
                "goal": None,
                "synthesis_active": False,
                "final_result": None,
            },
            "ants": [],
            "tasks": [],
            "results": [],
            "verifications": [],
        },
    )


def create_app(controller: RunController | None = None) -> FastAPI:
    controller = controller or RunController()
    app = FastAPI(title="Digital Ant Colony", docs_url=None, redoc_url=None)
    static_root = files("ant_colony.web").joinpath("static")
    app.mount("/static", StaticFiles(directory=str(static_root)), name="static")
    app.state.run_controller = controller

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(static_root.joinpath("index.html"))

    @app.post("/api/runs", status_code=status.HTTP_202_ACCEPTED)
    async def start_run() -> dict[str, str]:
        try:
            await controller.start()
        except RunAlreadyStartedError as error:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
        return {"status": "started"}

    @app.get("/api/state")
    async def current_state() -> dict[str, object]:
        if controller.current_engine is None:
            return _idle_snapshot().to_dict()
        return SnapshotBuilder().build(controller.current_engine).to_dict()

    @app.websocket("/ws")
    async def websocket_stream(websocket: WebSocket) -> None:
        await websocket.accept()
        subscriber_id, queue = controller.hub.subscribe()
        try:
            snapshot = (
                SnapshotBuilder().build(controller.current_engine)
                if controller.current_engine is not None
                else _idle_snapshot()
            )
            await websocket.send_json(snapshot.to_dict())
            while True:
                envelope = await queue.get()
                await websocket.send_json(envelope.to_dict())
        except WebSocketDisconnect:
            pass
        finally:
            controller.hub.unsubscribe(subscriber_id)

    return app

