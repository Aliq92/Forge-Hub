from ant_colony.cli import main


def test_headless_cli_prints_ordered_trace_and_final_answer(capsys) -> None:
    exit_code = main(["--headless"])
    lines = capsys.readouterr().out.splitlines()

    assert exit_code == 0
    assert lines[0] == "Digital Ant Colony - deterministic headless run"
    trace = [line for line in lines if line.startswith("EVENT ")]
    sequences = [int(line.split()[1]) for line in trace]
    assert sequences == list(range(1, len(sequences) + 1))
    assert any("TASK_REOPENED" in line for line in trace)
    assert any("TASK_VERIFIED" in line for line in trace)
    assert any("SYNTHESIS_STARTED" in line for line in trace)
    assert lines[-3] == "STATUS COMPLETED"
    assert lines[-2].startswith("CONFIDENCE ")
    assert lines[-1].startswith("FINAL ")


def test_server_cli_uses_loopback_defaults(monkeypatch) -> None:
    called = {}

    def fake_run(app, *, factory, host, port, log_level):
        called.update(app=app, factory=factory, host=host, port=port, log_level=log_level)

    monkeypatch.setattr("uvicorn.run", fake_run)

    assert main([]) == 0
    assert called == {
        "app": "ant_colony.web.server:create_app",
        "factory": True,
        "host": "127.0.0.1",
        "port": 8000,
        "log_level": "info",
    }
