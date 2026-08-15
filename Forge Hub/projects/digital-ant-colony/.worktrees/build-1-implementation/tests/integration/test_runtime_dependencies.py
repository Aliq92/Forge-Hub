def test_installed_runtime_has_a_uvicorn_websocket_transport() -> None:
    """Catch installs that can serve HTTP but silently reject WebSocket upgrades."""
    from uvicorn.protocols.websockets.auto import AutoWebSocketsProtocol

    assert AutoWebSocketsProtocol is not None
