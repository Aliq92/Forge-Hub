# Digital Ant Colony

Digital Ant Colony is an experimental Python coordination engine exploring how autonomous workers coordinate through shared state, inspectable signals, recruitment, verification, and synthesis.

Forge Build #1 is a complete deterministic research scenario. Ten ants take turns in stable order within one Python process, coordinate through an authoritative blackboard, resolve an injected contradiction through independent verification, and produce a final synthesis. A real-time browser observer reconstructs that activity without making or changing colony decisions.

Core principle:

> ants decide; blackboard remembers; pheromones signal; providers think; colony runs; visualization observes

See the approved [architecture specification](docs/superpowers/specs/2026-08-15-digital-ant-colony-build-1-design.md) and the review-ready [implementation plan](docs/superpowers/plans/2026-08-15-digital-ant-colony-build-1.md).

## Local setup

Python 3.12 or newer is required. From the project root in PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## Start the live observer

```powershell
.\.venv\Scripts\python.exe -m ant_colony
```

Open <http://127.0.0.1:8000>, then select **Start synthetic research**. The server binds to loopback by default. The start endpoint is the application-control boundary; the observer itself only receives snapshots and events from the Python core.

## Run headlessly

```powershell
.\.venv\Scripts\python.exe -m ant_colony --headless
```

This path does not start the web server. It prints the deterministic event trace, terminal status, confidence, and final synthesis.

## Run all tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
& 'C:\Users\Awgku\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/frontend/*.test.mjs
```

The frontend tests use Node's built-in test runner and do not require npm packages. If `node` is already on `PATH`, the second command can simply begin with `node`.
