# Digital Ant Colony — Forge Build #1 Architecture Design

Date: 2026-08-15  
Status: Approved for implementation planning

## 1. Purpose

Forge Build #1 proves that approximately ten deterministic simulated ants can coordinate on a synthetic research goal through shared state, inspectable signals, autonomous task selection, verification, and synthesis. It also provides a real-time browser view that behaves like the glass wall of an ant farm: visually alive, but never authoritative.

The research foundation is deliberately small. It must be deterministic, explainable, independently testable without paid APIs, and structured so later provider or concurrency adapters do not require changes to the colony core.

The governing boundary is:

> ants decide; blackboard remembers; pheromones signal; providers think; colony runs; visualization observes

## 2. Build #1 success criteria

Build #1 succeeds when all of the following are demonstrated:

1. A predefined synthetic research goal creates a deterministic run with approximately ten ants.
2. Explorers decompose work and create parent-linked child tasks.
3. Ants autonomously score and atomically claim work in stable turn order.
4. The deterministic provider produces auditable findings without credentials or network access.
5. Results remain separate immutable records rather than overwriting earlier conclusions.
6. Verifiers create independent verification records that can change confidence or reopen work.
7. A synthesizer finalizes only after research, verification, and confidence requirements are satisfied.
8. The colony terminates as completed or safely stalled under explicit rules.
9. An ordered event trace explains why the colony behaved as it did.
10. A local browser shows actual ants, task gathering, task spawning, pheromone intensity, verification, synthesis, completion, and final confidence from authoritative Python state.
11. The same deterministic colony completes headlessly when no frontend is present.

## 3. Explicit non-goals

Build #1 does not include real LLM adapters, generic text reasoning, database persistence, distributed execution, multiple processes, production networking, autonomous browsing, React, Vue, Next.js, Tailwind, PostgreSQL, Redis, Celery, Docker orchestration, Kubernetes, vector storage, embeddings, RAG, MCP, authentication, user accounts, cloud deployment, or persistent long-term agent memory.

The local FastAPI server exists only to serve the observer, expose a narrow synthetic-run start command, and stream state. It is not a general REST platform.

## 4. Architectural approach

Build #1 uses a domain-centric synchronous core with an in-memory blackboard and append-only event journal. A deterministic colony runner advances one cycle at a time. Ants run in stable ant-ID order, and each ant makes its own task decision using explicit scoring logic.

The web layer is optional. It maps domain events and snapshots into a versioned browser protocol. It has no access path for assigning tasks, changing scores, editing blackboard state, or directing ants.

An event-sourced core was rejected because replay projections would add complexity without improving the first experiment. An async actor model was rejected because scheduling and race behavior would weaken determinism. Concurrency remains a later adapter concern behind the blackboard claim boundary.

## 5. Components and ownership

### 5.1 Colony engine

The colony engine owns run lifecycle, cycle counting, stable ant invocation order, pheromone decay, progress accounting, completion evaluation, stall detection, and colony-level events.

It does not rank tasks for ants or assign work. Its only task-creation responsibilities are mechanical lifecycle gates, such as making synthesis work available when blackboard readiness conditions become true.

### 5.2 Blackboard

The blackboard is the sole authoritative in-memory store for goals, tasks, ownership, task status, immutable result records, verification records, pheromone values, and parent-child relationships.

Mutation occurs only through blackboard methods. Internal collections are never exposed for direct modification. `claim_task(task_id, ant_id)` performs status validation and ownership mutation as one indivisible synchronous operation. In Build #1 this is atomic because all colony mutation occurs on one runner thread. A future implementation may protect the same method with a lock or transactional store without changing callers.

### 5.3 Ants

One shared `Ant` abstraction holds a stable ID, capability set, scoring weights, bounded local memory, activity state, and current task ID. Explorer, Verifier, and Synthesizer are behavioral profiles using that abstraction rather than separate frameworks.

Local memory is a bounded deque of recent task IDs and outcomes. Ants do not receive the complete event journal or colony history. They observe only the blackboard view required to score currently eligible work.

### 5.4 Pheromones

Each task has exactly four normalized signals: urgency, confidence, demand, and verification. Values are clamped to `0.0..1.0`. Explicit rules reinforce signals after meaningful events, and the colony engine applies one configured multiplicative decay after every full colony cycle.

Pheromones guide scoring and visualization but do not bypass task eligibility or lifecycle rules.

### 5.5 Providers

The core depends on a synchronous `WorkProvider` protocol expressed with typed request and response models. It supports decomposition, task execution, verification judgment, and synthesis operations without exposing provider-specific data to the colony.

Build #1 implements only a scenario-focused deterministic provider. It uses predefined scenario facts and stable rules to return the same response for the same request. Future OpenAI, Anthropic, or local-model adapters implement the same provider boundary outside the colony core.

### 5.6 Events

Every meaningful state change appends a structured immutable `DomainEvent` to an in-memory `EventJournal`. An event includes a stable event ID, run ID, sequence number, cycle, type, actor ID where applicable, subject ID where applicable, timestamp, and typed details.

The journal is an audit trail, not the authoritative state database. A deterministic clock and sequential ID source make automated traces reproducible.

### 5.7 Research scenario

The research package defines one configurable synthetic scenario with a goal, known evidence fragments, deterministic contradictions, verification expectations, and an expected synthesis shape. Scenario knowledge belongs to the deterministic provider and fixtures, never the engine.

### 5.8 Web observation layer

The web package owns the FastAPI application factory, static-file serving, narrow run control, WebSocket connections, snapshot construction, and domain-to-browser event mapping.

The observer adapter is strictly read-only. A separate `RunController` may accept only “start the predefined scenario” when no run is active. It cannot mutate tasks or influence ant decisions. No pause, step, reassign, edit, or pheromone-control endpoint is included.

Frontend assets live inside `src/ant_colony/web/static/` rather than a repository-root `web/` directory. Co-locating them with the package lets the server resolve packaged resources reliably while retaining focused HTML, CSS, and JavaScript files.

## 6. Core typed model

### 6.1 Tasks

A task contains:

- stable ID and optional parent ID;
- title and description;
- kind: `RESEARCH`, `VERIFICATION`, or `SYNTHESIS`;
- status: `OPEN`, `CLAIMED`, `COMPLETED`, `VERIFIED`, `BLOCKED`, or `FAILED`;
- integer priority;
- required capabilities;
- creator ID and optional claimant ID;
- immutable result-reference IDs;
- confidence in `0.0..1.0`;
- four pheromone values;
- attempt count and maximum attempts;
- critical flag;
- created and updated timestamps.

Verification tasks additionally reference the completed research task they inspect. Synthesis tasks reference the goal rather than a single finding.

### 6.2 Results and verification

A `ResultRecord` contains its own ID, task ID, ant ID, provider operation, content, evidence notes, confidence, and timestamp. Existing results are never overwritten.

A `VerificationRecord` contains its own ID, verification task ID, target task ID, verifier ID, verdict (`AGREE`, `DISAGREE`, or `CONTRADICTION`), confidence delta, evidence notes, reopen recommendation, and timestamp.

Confidence adjustments are applied by a blackboard operation that records the verification first, clamps the new value, and emits a confidence-change event.

### 6.3 Ant activity

An ant has an activity state separate from task lifecycle: `IDLE`, `OBSERVING`, `MOVING_TO_TASK`, `WORKING`, `VERIFYING`, `SYNTHESIZING`, or `FAILED`. Activity changes and target task IDs drive meaningful browser motion. Physical screen coordinates are not domain state.

## 7. Deterministic execution and scoring

The colony runner sorts ants by stable ID at the start of each full cycle. Each ant advances by at most one meaningful phase per turn. Claiming, working, reporting, verifying, and synthesizing therefore remain separate observable changes rather than collapsing into one animation frame.

Eligible ants calculate scores with an inspectable weighted sum conceptually equivalent to:

```text
priority contribution
+ urgency contribution
+ demand contribution
+ verification-need contribution
+ capability-match contribution
- duplication penalty
```

Profiles configure weights and task-kind eligibility. The scoring implementation returns a breakdown for every factor. Stable ties resolve by total score, task priority, creation sequence, then task ID. No randomness or prompt-hidden scoring is used.

Duplicate work is discouraged when a related task is already claimed or when the ant's bounded memory shows a recent equivalent attempt. Duplicate penalties lower scores but never mutate task state.

## 8. Task lifecycle

Permitted transitions are:

```text
OPEN -> CLAIMED
CLAIMED -> COMPLETED
CLAIMED -> OPEN
CLAIMED -> BLOCKED
CLAIMED -> FAILED
COMPLETED -> VERIFIED
COMPLETED -> OPEN
BLOCKED -> OPEN
```

All other transitions are rejected without partial mutation.

Explorers may create child research tasks from a deterministic decomposition response. Child tasks retain the parent ID and emit individual creation events.

When research work is completed, verification demand can cause an explicit verification task to be created. A verifier claims that task atomically and produces a verification record. Agreement may promote the target to `VERIFIED`; disagreement or contradiction may lower confidence and reopen the target.

Synthesis becomes eligible only when the blackboard readiness predicate confirms that critical research and required verification are satisfied. A synthesizer then autonomously scores and claims the synthesis task.

## 9. Failure and recovery

Failure categories are represented explicitly:

- Task execution failure records the failed attempt and reopens the task while attempts remain.
- Provider failure converts an adapter exception into a typed failure record and follows the same bounded retry rule.
- Coordination failure covers a rejected claim or invalid transition; authoritative state remains unchanged and a diagnostic event is emitted.
- Confidence or verification failure prevents synthesis or completion and creates or reopens the required work.

When retry capacity is exhausted, a task becomes `FAILED`. A failed critical task prevents normal completion. Build #1 has no autonomous backoff, distributed recovery, or repair planner.

## 10. Completion and stall rules

Normal completion requires every condition below:

1. No critical research task is open, claimed, blocked, or failed.
2. Every required verification is satisfied.
3. A synthesis result exists.
4. Final confidence meets the configured minimum.

The colony does not complete merely because tasks are `COMPLETED`.

A cycle counts as progress when it creates, claims, completes, verifies, reopens, or terminally fails a task; changes confidence; or starts/completes synthesis. The colony becomes irrecoverably stalled when the configured consecutive no-progress limit is reached and no claimable or retryable recovery work exists. A maximum-cycle guard also terminates safely and emits a stall event with the reason.

## 11. Browser data flow

The local user experience is:

1. `python -m ant_colony` starts the FastAPI application on `127.0.0.1:8000`.
2. The browser loads packaged static assets.
3. A narrow command starts the predefined scenario.
4. The web runner advances the same synchronous engine used by headless mode, with optional async display pacing between deterministic steps.
5. Domain events enter the journal before being published to observer subscribers.
6. A read-only mapper creates versioned browser messages.
7. A WebSocket client receives an initial snapshot and then sequenced events.
8. The frontend projection updates and Canvas interpolates ants toward their authoritative target task nodes.
9. Reconnection receives a fresh snapshot and continues from its sequence number.

Async is limited to ASGI request handling, WebSocket delivery, and display pacing. Colony decisions and mutations remain synchronous.

Frontend availability never gates a colony cycle. A disconnected or broken observer may lose live delivery, but the event journal and authoritative run continue.

## 12. Browser protocol

Every message uses a small envelope:

```text
schema_version: 1
message_type: SNAPSHOT | EVENT
run_id: string
sequence: integer
cycle: integer
event_type: string or null
payload: typed object
```

The initial snapshot contains colony status, cycle, ants and activity targets, tasks and relationships, result summaries, verification progress, pheromone values, synthesis state, and final result where available.

The first protocol includes these event concepts:

- `ANT_CREATED`
- `ANT_ACTIVITY_CHANGED`
- `TASK_CREATED`
- `TASK_CLAIMED`
- `TASK_BLOCKED`
- `TASK_COMPLETED`
- `TASK_FAILED`
- `TASK_REOPENED`
- `RESULT_RECORDED`
- `TASK_VERIFICATION_STARTED`
- `TASK_VERIFIED`
- `ANT_FAILED`
- `PHEROMONE_CHANGED`
- `CONFIDENCE_CHANGED`
- `SYNTHESIS_STARTED`
- `COLONY_COMPLETED`
- `COLONY_STALLED`

The browser stores only a disposable projection. Task nodes use deterministic layout derived from stable IDs and relationships. Ants animate toward task nodes when their target task changes. Idle motion remains bounded around the ant's authoritative logical location and never implies unreported work.

Pheromone values appear as task halos or trail intensity. Verifiers use a distinct shape and activity treatment. Synthesis has an explicit colony state and visual gathering point. The event history remains visible beside the Canvas.

## 13. Event and snapshot correctness

Authoritative mutation occurs before the matching event is appended. The event sequence is strictly increasing within a run. Observer publication occurs only after journal append.

A snapshot is built from the blackboard, ant states, colony state, and journal sequence at one runner boundary between mutations. Applying later events in sequence reconstructs the same logical visualization projection. Missing or out-of-order sequence numbers cause the browser to request a new snapshot rather than guess.

## 14. Testing strategy

All automated colony tests use the deterministic provider and require no API key or network access.

Unit coverage includes:

- legal and illegal task transitions;
- single-winner atomic claims;
- scoring factor breakdown and stable tie resolution;
- capability matching and duplicate penalties;
- parent-child integrity;
- pheromone reinforcement, clamping, and decay;
- task release, retry, and terminal failure;
- immutable results;
- verification verdicts and confidence changes;
- synthesis readiness and premature-finalization rejection;
- completion and stall predicates;
- event serialization;
- snapshot construction and projection reconstruction.

Integration coverage includes:

- a deterministic approximately ten-ant run reaching the expected final result;
- an ordered explanatory event trace;
- headless execution without importing or starting web infrastructure;
- FastAPI application startup;
- static frontend delivery;
- WebSocket connection and initial snapshot;
- domain-to-browser event mapping;
- event sequence ordering and reconnect recovery;
- observer disconnection without colony interruption.

Frontend testing focuses on the small projection reducer and protocol correctness. Canvas rendering uses a documented manual browser smoke test rather than pixel-perfect assertions.

## 15. Planned repository shape

```text
digital-ant-colony/
|-- README.md
|-- pyproject.toml
|-- .gitignore
|-- .env.example
|-- docs/
|   |-- architecture/
|   |-- experiments/
|   `-- superpowers/
|       |-- specs/
|       |   `-- 2026-08-15-digital-ant-colony-build-1-design.md
|       `-- plans/
|           `-- 2026-08-15-digital-ant-colony-build-1.md
|-- src/ant_colony/
|   |-- __init__.py
|   |-- __main__.py
|   |-- cli.py
|   |-- colony/
|   |-- ants/
|   |-- blackboard/
|   |-- pheromones/
|   |-- providers/
|   |-- research/
|   |-- events/
|   `-- web/
|       |-- server.py
|       |-- protocol.py
|       |-- state.py
|       |-- websocket.py
|       `-- static/
|           |-- index.html
|           |-- css/colony.css
|           `-- js/
|               |-- app.js
|               |-- websocket.js
|               |-- colony-state.js
|               |-- colony-renderer.js
|               |-- ants.js
|               `-- tasks.js
`-- tests/
    |-- unit/
    |-- integration/
    `-- fixtures/
```

Only package markers, empty asset/test directories, project metadata, and planning documents belong to the initial skeleton. Runtime modules and frontend assets are created test-first during implementation.

## 16. Assumptions

- Build #1 runs one colony at a time in one Python process.
- The synthetic scenario is fixed but represented as typed configuration rather than embedded in engine branches.
- Approximately ten means the default scenario uses ten ants while configuration permits 10–30.
- One independent successful verification is required per critical research finding in Build #1.
- Confidence changes use deterministic configured deltas and clamping rather than probabilistic inference.
- The browser may start the fixed scenario through run control but cannot influence active colony decisions.
- Localhost binding is `127.0.0.1`; no remote network exposure is supported.
- Visual pacing changes wall-clock presentation only, never cycle order or scoring.

## 17. Risks and mitigations

### Observer backpressure

A slow browser could delay WebSocket delivery. The web layer uses bounded subscriber queues and replaces an overflowed stream with a fresh snapshot requirement. The colony runner never waits for a browser.

### Dual state representations

Python state and the JavaScript projection could drift. Versioned messages, strictly increasing sequences, snapshot recovery, and projection-reconstruction tests mitigate this risk.

### Animation implying false behavior

Decorative movement could misrepresent coordination. Work-related movement is driven only by ant activity and target task IDs. Idle wandering is constrained and visually distinct.

### Determinism versus real-time display

Async display timing could accidentally influence decisions. The web runner advances the synchronous engine first and delays only between completed deterministic steps.

### Verification ownership complexity

Reusing a research task's claimant field for verification would lose audit clarity. Explicit verification tasks and immutable verification records keep production and review ownership separate.

### Framework scope growth

Adding FastAPI could encourage unnecessary endpoints. Build #1 limits the server to static delivery, a single fixed-scenario start command, current-state access for recovery, and one WebSocket stream.
