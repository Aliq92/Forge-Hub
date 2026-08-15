# Digital Ant Colony Forge Build #1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic approximately ten-ant research colony whose autonomous coordination is auditable headlessly and observable as a live local browser ant farm.

**Architecture:** A synchronous, domain-centric Python core advances ants in stable ID order against an authoritative in-memory blackboard. A provider-neutral deterministic scenario adapter supplies Build #1 work, while an optional FastAPI/WebSocket layer publishes read-only snapshots and events to a vanilla JavaScript Canvas projection.

**Tech Stack:** Python 3.12+, dataclasses, type hints, pytest, FastAPI, Uvicorn, HTML, CSS, vanilla JavaScript, HTML Canvas, WebSocket, and the Node built-in test runner for pure frontend projection logic.

## Global Constraints

- Preserve the boundary: ants decide; blackboard remembers; pheromones signal; providers think; colony runs; visualization observes.
- Run one colony at a time in one Python process for Build #1.
- Use a deterministic single-process cycle and stable ant-ID turn order.
- Keep `Blackboard.claim_task()` atomic within the Build #1 execution model and replaceable by a locked or transactional implementation later.
- Keep the observer read-only; only a separate narrow command may start the predefined scenario.
- Use exactly four normalized task signals: urgency, confidence, demand, and verification, each clamped to `0.0..1.0`.
- Use task states `OPEN`, `CLAIMED`, `COMPLETED`, `VERIFIED`, `BLOCKED`, and `FAILED`.
- Include only Explorer, Verifier, and Synthesizer profiles using one shared ant abstraction.
- Keep ant local memory bounded and never provide the entire event history by default.
- Use only the scenario-focused deterministic provider; no real LLM adapter or API credential belongs in Build #1.
- Bind the web experience to `127.0.0.1:8000` by default.
- Keep frontend state disposable and reconstructible from a snapshot plus sequenced events.
- Do not add database persistence, distributed execution, frontend frameworks, authentication, deployment infrastructure, embeddings, RAG, MCP, or autonomous browsing.
- Write a failing deterministic test before each production change and commit each independently reviewable task.

---

## Planned file responsibilities

```text
src/ant_colony/
|-- __main__.py                  # python -m ant_colony entry point
|-- cli.py                       # CLI parsing and headless/web launch
|-- ants/
|   |-- models.py                # profiles, capabilities, activity, bounded memory
|   |-- profiles.py              # Explorer/Verifier/Synthesizer configurations
|   |-- scoring.py               # inspectable deterministic weighted scoring
|   `-- ant.py                   # one-phase-per-turn shared ant state machine
|-- blackboard/
|   |-- models.py                # goals, tasks, results, verification records
|   |-- ids.py                   # deterministic sequential identifiers
|   |-- transitions.py           # legal task lifecycle transitions
|   |-- board.py                 # authoritative state and atomic mutation API
|   `-- verification.py          # independent verification/confidence rules
|-- colony/
|   |-- models.py                # configuration, run status, turn/run outcomes
|   |-- policy.py                # completion, progress, and stall predicates
|   |-- engine.py                # stable cycle runner; no task assignment
|   `-- factory.py               # deterministic Build #1 composition root
|-- events/
|   |-- models.py                # typed domain events
|   |-- clock.py                 # system and deterministic clocks
|   `-- journal.py               # append-only ordered journal
|-- pheromones/
|   |-- models.py                # immutable normalized four-signal value
|   `-- rules.py                 # reinforcement and decay
|-- providers/
|   |-- base.py                  # typed provider protocol and operations
|   `-- deterministic.py         # scenario-only deterministic adapter
|-- research/
|   |-- models.py                # scenario and final answer models
|   `-- scenario.py              # fixed Build #1 scenario data
`-- web/
    |-- protocol.py              # versioned browser envelopes and mapping
    |-- state.py                 # snapshot and reconstruction projection
    |-- websocket.py             # bounded observer subscriptions
    |-- controller.py            # one-run start lifecycle and display pacing
    |-- server.py                # FastAPI app factory and routes
    `-- static/
        |-- index.html           # ant-farm document
        |-- css/colony.css       # responsive visual system
        `-- js/
            |-- app.js           # UI bootstrap and rendering loop
            |-- websocket.js     # snapshot/event connection and recovery
            |-- colony-state.js  # pure browser projection reducer
            |-- colony-renderer.js # Canvas scene orchestration
            |-- ants.js          # ant layout and drawing
            `-- tasks.js         # task nodes, signals, and trails
package.json                     # ES-module mode only; no npm dependencies
tests/
|-- unit/                        # deterministic domain tests
|-- integration/                 # headless and ASGI/WebSocket tests
|-- frontend/                    # Node tests for pure JavaScript projection
`-- fixtures/                    # protocol and scenario fixtures
```

## Cross-task interface catalog

The signatures below are fixed for this plan. A task may add private helpers but must not rename these public seams without revising this document first.

```text
Blackboard.create_goal(title: str, description: str, created_by: str) -> Goal
Blackboard.create_task(draft: TaskDraft) -> Task
Blackboard.eligible_tasks(eligible_kinds: frozenset[TaskKind], capabilities: frozenset[str]) -> tuple[Task, ...]
Blackboard.claim_task(task_id: str, ant_id: str) -> ClaimOutcome
Blackboard.add_result(task_id: str, ant_id: str, draft: ResultDraft) -> ResultRecord
Blackboard.complete_task(task_id: str, ant_id: str, result_id: str) -> Task
Blackboard.release_after_failure(task_id: str, ant_id: str, failure: FailureRecord) -> Task
Blackboard.create_verification_task(target_task_id: str, created_by: str) -> Task
Blackboard.record_verification(draft: VerificationDraft) -> VerificationRecord
Blackboard.snapshot() -> BlackboardSnapshot

WorkProvider.decompose(request: DecompositionRequest) -> DecompositionResponse
WorkProvider.execute(request: ExecutionRequest) -> ExecutionResponse
WorkProvider.verify(request: VerificationRequest) -> VerificationResponse
WorkProvider.synthesize(request: SynthesisRequest) -> SynthesisResponse

Ant.take_turn(context: AntTurnContext) -> AntTurnOutcome

ColonyEngine.step() -> CycleOutcome
ColonyEngine.run_until_terminal() -> ColonyRunResult
ColonyEngine.events_after(sequence: int) -> tuple[DomainEvent, ...]

SnapshotBuilder.build(engine: ColonyEngine) -> BrowserEnvelope
EventMapper.map(event: DomainEvent) -> BrowserEnvelope | None
```

---

### Task 1: Normalized pheromones and immutable domain records

**Files:**
- Create: `src/ant_colony/pheromones/models.py`
- Create: `src/ant_colony/pheromones/rules.py`
- Create: `src/ant_colony/blackboard/models.py`
- Create: `src/ant_colony/blackboard/transitions.py`
- Test: `tests/unit/test_domain_models.py`

**Interfaces:**
- Consumes: Python `dataclasses`, `datetime`, `enum`, and type hints only.
- Produces: `PheromoneLevels`, `reinforce()`, `decay()`, `Goal`, `TaskDraft`, frozen `Task`, `ResultDraft`, frozen `ResultRecord`, `VerificationDraft`, frozen `VerificationRecord`, `FailureRecord`, `TaskKind`, `TaskStatus`, `VerificationVerdict`, `FailureCategory`, and `transition_task()`.

The test file defines `NOW = datetime(2026, 8, 15, tzinfo=UTC)` and a local `make_task(status)` factory that fills every required `Task` field with fixed values.

- [ ] **Step 1: Write the failing tests**

```python
def test_pheromone_values_are_clamped_and_decay():
    levels = PheromoneLevels(urgency=1.2, confidence=-0.1, demand=0.8, verification=0.5)
    assert levels == PheromoneLevels(urgency=1.0, confidence=0.0, demand=0.8, verification=0.5)
    assert decay(levels, factor=0.5) == PheromoneLevels(0.5, 0.0, 0.4, 0.25)

def test_transition_rejects_completed_to_claimed():
    task = make_task(status=TaskStatus.COMPLETED)
    with pytest.raises(InvalidTaskTransition):
        transition_task(task, TaskStatus.CLAIMED, updated_at=NOW)
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_domain_models.py -v`  
Expected: FAIL during import because `ant_colony.pheromones.models` and `ant_colony.blackboard.models` do not exist.

- [ ] **Step 3: Implement the minimum typed models and rules**

Use frozen dataclasses. Clamp in `PheromoneLevels.__post_init__` with `object.__setattr__`. Implement only these transitions:

```python
ALLOWED_TRANSITIONS = {
    TaskStatus.OPEN: frozenset({TaskStatus.CLAIMED}),
    TaskStatus.CLAIMED: frozenset({TaskStatus.COMPLETED, TaskStatus.OPEN, TaskStatus.BLOCKED, TaskStatus.FAILED}),
    TaskStatus.COMPLETED: frozenset({TaskStatus.VERIFIED, TaskStatus.OPEN}),
    TaskStatus.BLOCKED: frozenset({TaskStatus.OPEN}),
    TaskStatus.VERIFIED: frozenset(),
    TaskStatus.FAILED: frozenset(),
}
```

`transition_task()` must return `dataclasses.replace(task, status=new_status, updated_at=updated_at)` and raise `InvalidTaskTransition` before mutation for every unlisted edge.

- [ ] **Step 4: Verify the task**

Run: `python -m pytest tests/unit/test_domain_models.py -v`  
Expected: PASS, including exact clamping, decay, immutability, and transition cases.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/pheromones src/ant_colony/blackboard tests/unit/test_domain_models.py
git commit -m "feat: add typed tasks and pheromone rules"
```

---

### Task 2: Deterministic IDs, clock, and append-only event journal

**Files:**
- Create: `src/ant_colony/blackboard/ids.py`
- Create: `src/ant_colony/events/clock.py`
- Create: `src/ant_colony/events/models.py`
- Create: `src/ant_colony/events/journal.py`
- Test: `tests/unit/test_event_journal.py`

**Interfaces:**
- Consumes: `datetime`, `timedelta`, and frozen dataclasses.
- Produces: `SequentialIdSource.next(prefix: str) -> str`, `Clock.now() -> datetime`, `SystemClock`, `IncrementingClock`, `EventType`, `DomainEvent`, `EventJournal.append(...)`, `EventJournal.events`, and `EventJournal.after(sequence: int)`.

- [ ] **Step 1: Write the failing tests**

```python
def test_journal_assigns_stable_ids_sequences_and_times():
    journal = EventJournal(IncrementingClock(BASE_TIME), SequentialIdSource())
    first = journal.append("RUN-0001", 0, EventType.TASK_CREATED, "ANT-01", "TASK-0001", {"parent_id": None})
    second = journal.append("RUN-0001", 1, EventType.TASK_CLAIMED, "ANT-01", "TASK-0001", {})
    assert (first.id, first.sequence) == ("EVENT-0001", 1)
    assert (second.id, second.sequence) == ("EVENT-0002", 2)
    assert second.timestamp > first.timestamp
    assert journal.after(1) == (second,)
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run: `python -m pytest tests/unit/test_event_journal.py -v`  
Expected: FAIL because `EventJournal` is not defined.

- [ ] **Step 3: Implement the ordered journal**

Define `EventType` with all domain actions required by the spec, including observation, claim, result, failure, verification, confidence, pheromone, synthesis, completion, and stall events. `EventJournal.append()` creates the event, appends it to a private list, and returns it. Expose events only as tuples. `details` must be copied into an immutable mapping before storage.

```python
def after(self, sequence: int) -> tuple[DomainEvent, ...]:
    return tuple(event for event in self._events if event.sequence > sequence)
```

- [ ] **Step 4: Verify the task**

Run: `python -m pytest tests/unit/test_event_journal.py -v`  
Expected: PASS with stable sequences, immutable public views, and deterministic timestamps.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/blackboard/ids.py src/ant_colony/events tests/unit/test_event_journal.py
git commit -m "feat: add deterministic domain event journal"
```

---

### Task 3: Authoritative blackboard, task hierarchy, results, and atomic claims

**Files:**
- Create: `src/ant_colony/blackboard/board.py`
- Test: `tests/unit/test_blackboard.py`

**Interfaces:**
- Consumes: Task/result models, `SequentialIdSource`, `Clock`, and `EventJournal` from Tasks 1–2.
- Produces: `Blackboard`, `BlackboardSnapshot`, `ClaimOutcome`, `UnknownTaskError`, `ParentTaskError`, and the create/claim/result/complete signatures in the interface catalog.

The test file defines a `board` pytest fixture using `IncrementingClock`, `SequentialIdSource`, and `EventJournal`, plus a `research_draft(title, parent_id=None, max_attempts=2)` helper returning a fully populated `TaskDraft`.

- [ ] **Step 1: Write failing blackboard tests**

```python
def test_only_one_ant_can_claim_an_open_task(board):
    task = board.create_task(research_draft("Compare approaches"))
    first = board.claim_task(task.id, "ANT-01")
    second = board.claim_task(task.id, "ANT-02")
    assert first.claimed is True
    assert second.claimed is False
    assert board.task(task.id).claimed_by == "ANT-01"

def test_child_task_preserves_parent_relationship(board):
    parent = board.create_task(research_draft("Root research"))
    child = board.create_task(research_draft("Gather evidence", parent_id=parent.id))
    assert child.parent_id == parent.id
    assert board.snapshot().child_ids_by_parent[parent.id] == (child.id,)
```

Also test that adding a result creates a new immutable record, completing a task references that result, invalid parents are rejected, and snapshots cannot mutate board internals.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_blackboard.py -v`  
Expected: FAIL because `ant_colony.blackboard.board` does not exist.

- [ ] **Step 3: Implement the minimal blackboard**

Store goals, tasks, results, and parent indexes in private dictionaries. All changes replace frozen records. `claim_task()` must perform check-and-replace in one method and return a non-throwing losing outcome for a valid task that is no longer open.

```python
def claim_task(self, task_id: str, ant_id: str) -> ClaimOutcome:
    current = self.task(task_id)
    if current.status is not TaskStatus.OPEN:
        return ClaimOutcome(False, current)
    claimed = replace(current, status=TaskStatus.CLAIMED, claimed_by=ant_id, updated_at=self._clock.now())
    self._tasks[task_id] = claimed
    self._emit(EventType.TASK_CLAIMED, actor_id=ant_id, subject_id=task_id)
    return ClaimOutcome(True, claimed)
```

Emit goal, task, claim, result, and completion events only after successful authoritative mutation.

- [ ] **Step 4: Verify the task**

Run: `python -m pytest tests/unit/test_blackboard.py -v`  
Expected: PASS for single-winner claiming, hierarchy, immutable results, and snapshot isolation.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/blackboard/board.py tests/unit/test_blackboard.py
git commit -m "feat: add authoritative in-memory blackboard"
```

---

### Task 4: Bounded recovery, verification records, and confidence changes

**Files:**
- Modify: `src/ant_colony/blackboard/board.py`
- Create: `src/ant_colony/blackboard/verification.py`
- Test: `tests/unit/test_failure_recovery.py`
- Test: `tests/unit/test_verification.py`

**Interfaces:**
- Consumes: `Blackboard`, task transitions, failure/verification records, and journal events.
- Produces: `Blackboard.release_after_failure()`, `block_task()`, `reopen_task()`, `create_verification_task()`, `VerificationService.apply()`, and deterministic confidence adjustment.

`test_failure_recovery.py` defines `execution_failure(notes)` as a local `FailureRecord` factory. `test_verification.py` defines `completed_task()`, `contradiction_draft()`, and a `verification_service` fixture from the concrete types created in this task.

- [ ] **Step 1: Write the failing recovery and verification tests**

```python
def test_failed_task_reopens_until_retry_budget_is_exhausted(board):
    task = board.create_task(research_draft("Retry research", max_attempts=2))
    board.claim_task(task.id, "ANT-01")
    reopened = board.release_after_failure(task.id, "ANT-01", execution_failure("first"))
    assert reopened.status is TaskStatus.OPEN
    board.claim_task(task.id, "ANT-02")
    failed = board.release_after_failure(task.id, "ANT-02", execution_failure("second"))
    assert failed.status is TaskStatus.FAILED

def test_contradiction_reduces_confidence_and_reopens_target(board, verification_service):
    target = completed_task(board, confidence=0.8)
    check = board.create_verification_task(target.id, "ANT-02")
    record = verification_service.apply(contradiction_draft(check.id, target.id, delta=-0.35))
    assert record.verdict is VerificationVerdict.CONTRADICTION
    assert board.task(target.id).confidence == pytest.approx(0.45)
    assert board.task(target.id).status is TaskStatus.OPEN
```

- [ ] **Step 2: Run both files and confirm the expected failures**

Run: `python -m pytest tests/unit/test_failure_recovery.py tests/unit/test_verification.py -v`  
Expected: FAIL because recovery and verification operations are absent.

- [ ] **Step 3: Implement direct, bounded recovery rules**

`release_after_failure()` increments attempts exactly once, records the failure, clears `claimed_by`, and transitions to `OPEN` while `attempt_count < max_attempts`; otherwise it transitions to `FAILED`. `VerificationService.apply()` must validate the verification task and target, append an immutable record, clamp confidence after applying the configured delta, and either verify or reopen the target according to the verdict and recommendation.

Agreement marks the target `VERIFIED` only when resulting confidence meets its verification threshold. Disagreement lowers confidence without overwriting results. Contradiction with `recommend_reopen=True` reopens the target.

- [ ] **Step 4: Verify recovery and verification**

Run: `python -m pytest tests/unit/test_failure_recovery.py tests/unit/test_verification.py -v`  
Expected: PASS for release, terminal failure, agreement, disagreement, contradiction, confidence clamping, and immutable records.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/blackboard tests/unit/test_failure_recovery.py tests/unit/test_verification.py
git commit -m "feat: add task recovery and independent verification"
```

---

### Task 5: Shared ant profiles, bounded memory, and inspectable scoring

**Files:**
- Create: `src/ant_colony/ants/models.py`
- Create: `src/ant_colony/ants/profiles.py`
- Create: `src/ant_colony/ants/scoring.py`
- Test: `tests/unit/test_ant_scoring.py`

**Interfaces:**
- Consumes: `Task`, `TaskKind`, `TaskStatus`, and task pheromones.
- Produces: `AntState`, `AntActivity`, `AntProfile`, `ScoringWeights`, `MemoryEntry`, `BoundedAntMemory`, `ScoreBreakdown`, `ScoredTask`, `score_task()`, and `choose_task()`.

The test file defines local `explorer_state()` and `task()` factories with fixed IDs/timestamps and keyword overrides for scoring inputs.

- [ ] **Step 1: Write failing deterministic scoring tests**

```python
def test_explorer_chooses_high_demand_capability_match():
    ant = explorer_state("ANT-01", capabilities={"analysis"})
    weak = task("TASK-0001", priority=5, demand=0.2, required={"analysis"})
    strong = task("TASK-0002", priority=5, demand=0.9, required={"analysis"})
    chosen = choose_task(ant, (weak, strong), related_claimed_counts={})
    assert chosen is not None
    assert chosen.task.id == "TASK-0002"
    assert chosen.breakdown.demand > 0

def test_duplication_penalty_changes_selection():
    ant = explorer_state("ANT-01", capabilities={"analysis"})
    duplicate = task("TASK-0001", topic_key="coordination", demand=1.0)
    alternative = task("TASK-0002", topic_key="verification", demand=0.7)
    chosen = choose_task(ant, (duplicate, alternative), {"coordination": 3})
    assert chosen is not None
    assert chosen.task.id == "TASK-0002"
```

Also assert deterministic tie resolution by score, priority, creation sequence, and task ID; verifier/synthesizer eligibility; and memory eviction at the configured limit.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_ant_scoring.py -v`  
Expected: FAIL because ant scoring modules do not exist.

- [ ] **Step 3: Implement the shared scoring system**

Implement the weighted sum as named contributions, not a hidden aggregate:

```python
total = (
    breakdown.priority
    + breakdown.urgency
    + breakdown.demand
    + breakdown.verification_need
    + breakdown.capability_match
    - breakdown.duplication_penalty
)
```

Profiles differ only in immutable weights, eligible task kinds, and capabilities. `BoundedAntMemory` stores only recent task IDs, topic keys, and outcomes in a deque with default limit five.

- [ ] **Step 4: Verify scoring**

Run: `python -m pytest tests/unit/test_ant_scoring.py -v`  
Expected: PASS with exact factor assertions and stable selections across repeated runs.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/ants tests/unit/test_ant_scoring.py
git commit -m "feat: add shared ant profiles and deterministic scoring"
```

---

### Task 6: Provider-neutral operations and fixed deterministic scenario

**Files:**
- Create: `src/ant_colony/research/models.py`
- Create: `src/ant_colony/research/scenario.py`
- Create: `src/ant_colony/providers/base.py`
- Create: `src/ant_colony/providers/deterministic.py`
- Create: `tests/fixtures/synthetic_scenario.py`
- Create: `tests/fixtures/__init__.py`
- Test: `tests/unit/test_deterministic_provider.py`

**Interfaces:**
- Consumes: Task/result/verification types and immutable scenario configuration.
- Produces: `ResearchScenario`, `ScenarioFinding`, `FinalAnswer`, four provider request/response pairs, `WorkProvider`, `ProviderFailure`, `DeterministicScenarioProvider`, and `build_synthetic_scenario()`.

`tests/fixtures/synthetic_scenario.py` defines `configured_contradiction_request()` from the public request model and the known contradictory scenario key.

- [ ] **Step 1: Write failing provider-contract tests**

```python
def test_deterministic_provider_decomposes_same_request_identically():
    provider = DeterministicScenarioProvider(build_synthetic_scenario())
    request = DecompositionRequest(goal_id="GOAL-0001", goal_text=provider.scenario.goal)
    assert provider.decompose(request) == provider.decompose(request)
    assert len(provider.decompose(request).tasks) >= 3

def test_verification_detects_configured_contradiction():
    provider = DeterministicScenarioProvider(build_synthetic_scenario())
    response = provider.verify(configured_contradiction_request())
    assert response.verdict is VerificationVerdict.CONTRADICTION
    assert response.recommend_reopen is True
```

Also assert that unknown scenario keys raise typed `ProviderFailure`, synthesis input ordering does not change output, and no API key/environment lookup occurs.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_deterministic_provider.py -v`  
Expected: FAIL because provider request/response models do not exist.

- [ ] **Step 3: Implement one scenario-focused provider**

Define `WorkProvider` with the four exact methods in the interface catalog. Store scenario facts in immutable mappings keyed by task topic. Sort all input result references before lookup and synthesis. The synthetic scenario must contain enough research branches, one deliberate contradiction, verification expectations, and a stable expected final answer to exercise the full lifecycle.

Do not parse arbitrary prose, call the network, import an AI SDK, or branch the colony engine on scenario keys.

- [ ] **Step 4: Verify provider determinism**

Run: `python -m pytest tests/unit/test_deterministic_provider.py -v`  
Expected: PASS across repeated decomposition, execution, verification, and synthesis calls.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/providers src/ant_colony/research tests/fixtures/synthetic_scenario.py tests/unit/test_deterministic_provider.py
git commit -m "feat: add deterministic research provider boundary"
```

---

### Task 7: One-phase shared ant turn state machine

**Files:**
- Create: `src/ant_colony/ants/ant.py`
- Test: `tests/unit/test_ant_turns.py`

**Interfaces:**
- Consumes: `Blackboard`, `WorkProvider`, scoring functions, profiles, and event journal.
- Produces: `Ant`, `AntTurnContext(board, provider, cycle)`, `AntTurnOutcome`, and `Ant.take_turn()`.

The test file defines `context` and `context_with_failing_provider` fixtures with real blackboards; the failing provider implements all four protocol methods and raises `ProviderFailure` only from `execute()`.

- [ ] **Step 1: Write failing phase-progression tests**

```python
def test_explorer_claim_and_execution_occur_on_separate_turns(context):
    ant = Ant(explorer_state("ANT-01", {"analysis"}))
    first = ant.take_turn(context)
    assert first.activity is AntActivity.MOVING_TO_TASK
    assert context.board.task(first.task_id).status is TaskStatus.CLAIMED
    second = ant.take_turn(context.next_cycle())
    assert second.activity is AntActivity.WORKING
    assert context.board.task(first.task_id).status is TaskStatus.COMPLETED

def test_provider_failure_releases_task_for_another_ant(context_with_failing_provider):
    ant = Ant(explorer_state("ANT-01", {"analysis"}))
    claimed = ant.take_turn(context_with_failing_provider)
    failed = ant.take_turn(context_with_failing_provider.next_cycle())
    assert failed.failed is True
    assert context_with_failing_provider.board.task(claimed.task_id).status is TaskStatus.OPEN
```

Add focused tests for explorer decomposition, verifier operation, synthesizer operation, bounded memory update, observed-task events, and ant activity/target events.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_ant_turns.py -v`  
Expected: FAIL because `Ant` is not implemented.

- [ ] **Step 3: Implement a single state machine**

When the ant has no current task, observe eligible work, score it, attempt an atomic claim, and stop the turn. On a later turn, dispatch by `TaskKind` through the provider, record results or verification, update bounded memory and signals, clear current task, and stop.

```python
def take_turn(self, context: AntTurnContext) -> AntTurnOutcome:
    if self.state.current_task_id is None:
        return self._observe_score_and_claim(context)
    task = context.board.task(self.state.current_task_id)
    if task.kind is TaskKind.VERIFICATION:
        return self._verify(context, task)
    if task.kind is TaskKind.SYNTHESIS:
        return self._synthesize(context, task)
    return self._execute_research(context, task)
```

Provider exceptions must become `FailureRecord` values and flow through blackboard recovery. No profile-specific subclass may be introduced.

- [ ] **Step 4: Verify ant turns**

Run: `python -m pytest tests/unit/test_ant_turns.py -v`  
Expected: PASS with each observable phase separated and deterministic.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/ants/ant.py tests/unit/test_ant_turns.py
git commit -m "feat: add deterministic shared ant turn loop"
```

---

### Task 8: Completion readiness, progress accounting, and stall policy

**Files:**
- Create: `src/ant_colony/colony/models.py`
- Create: `src/ant_colony/colony/policy.py`
- Test: `tests/unit/test_colony_policy.py`

**Interfaces:**
- Consumes: `BlackboardSnapshot`, `DomainEvent`, task kinds/statuses, and final-answer confidence.
- Produces: `ColonyConfig`, `ColonyStatus`, `CompletionAssessment`, `StallAssessment`, `assess_completion()`, `cycle_made_progress()`, and `assess_stall()`.

The test file defines `snapshot_factory(**overrides)` to construct complete immutable `BlackboardSnapshot` values and replace only the named readiness conditions.

- [ ] **Step 1: Write failing completion and stall tests**

```python
def test_completed_tasks_without_verification_cannot_finalize(snapshot_factory):
    snapshot = snapshot_factory(research_status=TaskStatus.COMPLETED, verified=False, synthesis_result=True, final_confidence=0.9)
    assessment = assess_completion(snapshot, minimum_confidence=0.75)
    assert assessment.complete is False
    assert "verification" in assessment.reasons

def test_colony_stalls_only_without_progress_or_recovery(snapshot_factory):
    snapshot = snapshot_factory(claimable=False, retryable=False)
    stalled = assess_stall(snapshot, no_progress_cycles=5, configured_limit=5, cycle=20, maximum_cycles=100)
    assert stalled.stalled is True
    assert stalled.reason == "no viable work after 5 no-progress cycles"
```

Also assert synthesis and minimum confidence are mandatory, critical failures block completion, claimable work prevents stall, and the maximum-cycle reason is distinct.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_colony_policy.py -v`  
Expected: FAIL because colony policy types do not exist.

- [ ] **Step 3: Implement pure policy functions**

Keep policy free of mutation. Define the progress-event set explicitly as task creation, claim, completion, verification, reopen, terminal failure, confidence change, and synthesis start/completion. Return assessments containing booleans and human-readable deterministic reasons used in events and tests.

- [ ] **Step 4: Verify colony policy**

Run: `python -m pytest tests/unit/test_colony_policy.py -v`  
Expected: PASS for all completion gates and both stall paths.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/colony/models.py src/ant_colony/colony/policy.py tests/unit/test_colony_policy.py
git commit -m "feat: add colony completion and stall policy"
```

---

### Task 9: Stable colony engine and deterministic headless milestone

**Files:**
- Create: `src/ant_colony/colony/engine.py`
- Create: `src/ant_colony/colony/factory.py`
- Test: `tests/integration/test_deterministic_colony.py`

**Interfaces:**
- Consumes: `Ant`, `Blackboard`, deterministic provider/scenario, pheromone decay, policy functions, clock, IDs, and event journal.
- Produces: `ColonyEngine.step()`, `ColonyEngine.run_until_terminal()`, `CycleOutcome`, `ColonyRunResult`, and `build_deterministic_colony(ant_count: int = 10) -> ColonyEngine`.

- [ ] **Step 1: Write the failing milestone tests**

```python
def test_deterministic_colony_reaches_verified_synthesis():
    first = build_deterministic_colony(ant_count=10).run_until_terminal()
    second = build_deterministic_colony(ant_count=10).run_until_terminal()
    assert first.status is ColonyStatus.COMPLETED
    assert first.final_answer == second.final_answer
    assert first.final_confidence == second.final_confidence
    assert first.event_trace == second.event_trace
    assert first.final_confidence >= 0.75

def test_engine_invokes_ants_in_stable_id_order():
    engine = build_deterministic_colony(ant_count=10)
    outcome = engine.step()
    assert outcome.ant_turn_order == tuple(f"ANT-{index:02d}" for index in range(1, 11))
```

Assert the trace contains decomposition, autonomous claims, a contradiction, reopening, verification, pheromone decay, synthesis, and completion. Add a separate deliberately unworkable fixture that reaches `STALLED`.

- [ ] **Step 2: Run the integration test and confirm the expected failure**

Run: `python -m pytest tests/integration/test_deterministic_colony.py -v`  
Expected: FAIL because the engine and composition root do not exist.

- [ ] **Step 3: Implement the smallest complete synchronous runner**

`step()` increments the cycle, invokes every ant exactly once in sorted order, assesses progress, applies pheromone decay once, creates synthesis work only when readiness first becomes true, and evaluates completion/stall after mutations.

```python
def run_until_terminal(self) -> ColonyRunResult:
    while self.status is ColonyStatus.RUNNING:
        self.step()
    return self._build_result()
```

The factory creates ten stable IDs with a profile mix of six explorers, three verifiers, and one synthesizer; injects deterministic IDs/clock/provider; and seeds only the synthetic goal plus root decomposition work. The engine must never call `choose_task()` itself.

- [ ] **Step 4: Verify headless behavior**

Run: `python -m pytest tests/unit tests/integration/test_deterministic_colony.py -v`  
Expected: PASS with byte-for-byte stable logical traces after timestamps are normalized by the deterministic clock.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/colony tests/integration/test_deterministic_colony.py
git commit -m "feat: complete deterministic headless colony milestone"
```

---

### Task 10: Versioned observer protocol, snapshots, and reconstruction

**Files:**
- Create: `src/ant_colony/web/protocol.py`
- Create: `src/ant_colony/web/state.py`
- Create: `tests/fixtures/browser_messages.py`
- Test: `tests/unit/test_web_protocol.py`
- Test: `tests/unit/test_visualization_state.py`

**Interfaces:**
- Consumes: `ColonyEngine`, `BlackboardSnapshot`, ant states, `DomainEvent`, and final result.
- Produces: `BrowserMessageType`, `BrowserEventType`, `BrowserEnvelope`, `SnapshotBuilder`, `EventMapper`, `VisualizationState`, and `apply_browser_event()`.

`tests/fixtures/browser_messages.py` defines fixed snapshot, task-claim, activity, pheromone, verification, synthesis, and completion envelope factories. `test_web_protocol.py` creates `event_mapper` and `claimed_event` fixtures from concrete Task 2 events.

- [ ] **Step 1: Write failing protocol and reconstruction tests**

```python
def test_task_claim_maps_to_versioned_browser_event(event_mapper, claimed_event):
    envelope = event_mapper.map(claimed_event)
    assert envelope is not None
    assert envelope.schema_version == 1
    assert envelope.event_type is BrowserEventType.TASK_CLAIMED
    assert envelope.payload == {"task_id": "TASK-0004", "ant_id": "ANT-07"}

def test_snapshot_plus_events_reconstructs_current_visual_state(engine):
    snapshot = SnapshotBuilder().build(engine)
    baseline = VisualizationState.from_snapshot(snapshot)
    engine.step()
    mapped = tuple(filter(None, (EventMapper().map(event) for event in engine.events_after(snapshot.sequence))))
    reconstructed = reduce(apply_browser_event, mapped, baseline)
    assert reconstructed == VisualizationState.from_snapshot(SnapshotBuilder().build(engine))
```

Also test ant activity targets, task spawning, pheromone values, verification, synthesis, completion, failure events, strictly increasing sequences, and JSON serialization.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_web_protocol.py tests/unit/test_visualization_state.py -v`  
Expected: FAIL because browser protocol modules do not exist.

- [ ] **Step 3: Implement a read-only mapper and snapshot builder**

Use dataclasses and explicit `to_dict()` methods. Never serialize Python class names or internal dictionary layout. Omit domain events that have no visual meaning by returning `None`; retain every domain event in the journal.

```python
@dataclass(frozen=True)
class BrowserEnvelope:
    schema_version: int
    message_type: BrowserMessageType
    run_id: str
    sequence: int
    cycle: int
    event_type: BrowserEventType | None
    payload: Mapping[str, JSONValue]
```

Snapshots must contain logical ant targets and task signals, not screen coordinates.

- [ ] **Step 4: Verify protocol correctness**

Run: `python -m pytest tests/unit/test_web_protocol.py tests/unit/test_visualization_state.py -v`  
Expected: PASS, including full snapshot-plus-event reconstruction equality.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/web/protocol.py src/ant_colony/web/state.py tests/fixtures/browser_messages.py tests/unit/test_web_protocol.py tests/unit/test_visualization_state.py
git commit -m "feat: add read-only browser observation protocol"
```

---

### Task 11: FastAPI static server, bounded WebSocket observation, and run control

**Files:**
- Create: `src/ant_colony/web/websocket.py`
- Create: `src/ant_colony/web/controller.py`
- Create: `src/ant_colony/web/server.py`
- Create: `src/ant_colony/web/static/index.html`
- Create: `tests/conftest.py`
- Test: `tests/integration/test_web_server.py`
- Test: `tests/integration/test_websocket_stream.py`

**Interfaces:**
- Consumes: `build_deterministic_colony()`, `SnapshotBuilder`, `EventMapper`, and FastAPI.
- Produces: `ObserverHub.subscribe()`, `ObserverHub.publish()`, `RunController.start()`, `RunController.current_engine`, and `create_app(controller: RunController | None = None) -> FastAPI`.

`tests/conftest.py` defines `test_client` from `create_app(RunController(display_delay=0.01))` using FastAPI's `TestClient` as a context-managed pytest fixture.

- [ ] **Step 1: Write failing ASGI and WebSocket tests**

```python
def test_server_serves_static_index(test_client):
    response = test_client.get("/")
    assert response.status_code == 200
    assert "Digital Ant Colony" in response.text

def test_websocket_receives_snapshot_then_real_colony_event(test_client):
    with test_client.websocket_connect("/ws") as socket:
        snapshot = socket.receive_json()
        assert test_client.post("/api/runs").status_code == 202
        event = socket.receive_json()
    assert snapshot["message_type"] == "SNAPSHOT"
    assert event["message_type"] == "EVENT"
    assert event["sequence"] > snapshot["sequence"]
```

Add tests for a second start returning `409`, queue overflow causing a resnapshot marker, disconnect cleanup, and headless engine completion with a hub that has no subscribers.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/integration/test_web_server.py tests/integration/test_websocket_stream.py -v`  
Expected: FAIL because `create_app()` and observer transport do not exist.

- [ ] **Step 3: Implement the local observer server**

Mount package static assets, define only `POST /api/runs`, `GET /api/state`, and `WebSocket /ws`, and bind through Uvicorn later in the CLI. `RunController.start()` creates an async runner task that repeatedly calls synchronous `engine.step()`, publishes newly appended mapped events without awaiting individual browsers, then sleeps for configured display pacing.

Each subscriber receives a bounded `asyncio.Queue`. `ObserverHub.publish()` uses `put_nowait`; on overflow it clears that subscriber queue and inserts one `RESNAPSHOT_REQUIRED` envelope. It must never await a subscriber or call blackboard mutation methods.

- [ ] **Step 4: Verify the web boundary**

Run: `python -m pytest tests/integration/test_web_server.py tests/integration/test_websocket_stream.py tests/integration/test_deterministic_colony.py -v`  
Expected: PASS; the web tests receive real engine messages and the original headless test remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/web tests/integration/test_web_server.py tests/integration/test_websocket_stream.py
git commit -m "feat: stream colony state through local observer server"
```

---

### Task 12: Pure frontend projection and WebSocket recovery

**Files:**
- Create: `package.json`
- Modify: `src/ant_colony/web/static/index.html`
- Create: `src/ant_colony/web/static/js/colony-state.js`
- Create: `src/ant_colony/web/static/js/websocket.js`
- Create: `src/ant_colony/web/static/js/app.js`
- Create: `tests/frontend/colony-state.test.mjs`
- Modify: `tests/integration/test_web_server.py`

**Interfaces:**
- Consumes: protocol schema version 1, snapshot/event envelopes, `/api/runs`, `/api/state`, and `/ws`.
- Produces: `createColonyState(snapshot)`, `applyEvent(state, envelope)`, `connectColonySocket(handlers)`, reconnect/resnapshot behavior, and DOM regions for Canvas, goal/status, final result, confidence, and event history.

- [ ] **Step 1: Write failing JavaScript projection tests**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { applyEvent, createColonyState } from "../../src/ant_colony/web/static/js/colony-state.js";

test("task claim associates the real ant with the real task", () => {
  const state = createColonyState({
    sequence: 4,
    payload: {
      colony: { status: "RUNNING", cycle: 2 },
      ants: [{ id: "ANT-07", activity: "OBSERVING", target_task_id: null }],
      tasks: [{ id: "TASK-0012", status: "OPEN", pheromones: {} }],
    },
  });
  const next = applyEvent(state, {
    sequence: 5,
    event_type: "TASK_CLAIMED",
    payload: { ant_id: "ANT-07", task_id: "TASK-0012" },
  });
  assert.equal(next.ants["ANT-07"].targetTaskId, "TASK-0012");
  assert.equal(next.tasks["TASK-0012"].status, "CLAIMED");
});
```

Add tests for child task creation, pheromone decay, verification activity, synthesis state, completion/final result, immutable reducer behavior, sequence gaps setting `needsResnapshot`, and snapshots clearing that flag.

- [ ] **Step 2: Run the frontend test and confirm the expected failure**

Run: `node --test tests/frontend/colony-state.test.mjs`  
Expected: FAIL because `colony-state.js` does not exist.

- [ ] **Step 3: Implement the pure projection and connection**

Create `package.json` with exactly `{"private": true, "type": "module"}` and no dependencies. Keep `colony-state.js` free of DOM and Canvas access. `applyEvent()` returns new top-level maps for changed ants/tasks and ignores duplicate sequences. A sequence gap must set `needsResnapshot=true` without applying the event. `websocket.js` fetches `/api/state` after `RESNAPSHOT_REQUIRED`, a sequence gap, or reconnect.

`app.js` may start the fixed run and update text/event-history DOM, but it must not calculate scores, task eligibility, verification results, or lifecycle transitions.

- [ ] **Step 4: Verify projection and static delivery**

Run: `node --test tests/frontend/colony-state.test.mjs`  
Expected: PASS for every protocol transition.  
Run: `python -m pytest tests/integration/test_web_server.py -v`  
Expected: PASS and confirm `/`, `/static/js/colony-state.js`, and `/static/js/websocket.js` are served.

- [ ] **Step 5: Commit**

```bash
git add package.json src/ant_colony/web/static tests/frontend tests/integration/test_web_server.py
git commit -m "feat: reconstruct colony state in the browser"
```

---

### Task 13: Meaningful Canvas ant-farm rendering

**Files:**
- Create: `src/ant_colony/web/static/css/colony.css`
- Create: `src/ant_colony/web/static/js/ants.js`
- Create: `src/ant_colony/web/static/js/tasks.js`
- Create: `src/ant_colony/web/static/js/colony-renderer.js`
- Modify: `src/ant_colony/web/static/js/app.js`
- Test: `tests/frontend/layout.test.mjs`

**Interfaces:**
- Consumes: the pure browser state from Task 12 and one Canvas 2D context.
- Produces: `taskPosition(task, allTasks, bounds)`, `antTargetPosition(ant, state, bounds)`, `signalVisuals(task)`, `drawTasks()`, `drawAnts()`, and `ColonyRenderer.render(state, timestamp)`.

The test file defines literal `BOUNDS`, `stateWithClaim()`, and `taskWithSignals()` helpers containing only the fields consumed by the pure layout functions.

- [ ] **Step 1: Write failing semantic-layout tests**

```javascript
test("claimed ant targets its authoritative task node", () => {
  const state = stateWithClaim("ANT-07", "TASK-0012");
  assert.deepEqual(
    antTargetPosition(state.ants["ANT-07"], state, BOUNDS),
    taskPosition(state.tasks["TASK-0012"], Object.values(state.tasks), BOUNDS),
  );
});

test("pheromone visuals weaken when values decay", () => {
  const strong = signalVisuals(taskWithSignals({ demand: 0.9, verification: 0.8 }));
  const weak = signalVisuals(taskWithSignals({ demand: 0.3, verification: 0.2 }));
  assert.ok(strong.haloRadius > weak.haloRadius);
  assert.ok(strong.trailAlpha > weak.trailAlpha);
});
```

Also assert deterministic task positions by stable ID/parent relationship, verifier/synthesizer visual kinds, child nodes near parents, and bounded idle wander around authoritative logical positions.

- [ ] **Step 2: Run the layout test and confirm the expected failure**

Run: `node --test tests/frontend/layout.test.mjs`  
Expected: FAIL because ant/task layout modules do not exist.

- [ ] **Step 3: Implement the renderer without decorative false work**

Use stable hash-derived task placement adjusted by parent position. Ease each displayed ant position toward `antTargetPosition()`. Claimed/working ants target their task; verifiers use a square body and verification halo; the synthesizer uses a diamond body and targets the synthesis node. Idle wander is low-amplitude, deterministic from ant ID and time, and cannot cross into a task halo.

Map demand to halo radius, urgency to pulse rate, confidence to opacity, and verification to a distinct ring/trail intensity. Respect `prefers-reduced-motion`. Keep the event history and final answer readable outside Canvas.

- [ ] **Step 4: Verify semantics and perform the focused visual smoke check**

Run: `node --test tests/frontend/colony-state.test.mjs tests/frontend/layout.test.mjs`  
Expected: PASS.  
Run: `python -m pytest tests/integration/test_web_server.py tests/integration/test_websocket_stream.py -v`  
Expected: PASS.  
- [ ] **Step 5: Commit**

```bash
git add src/ant_colony/web/static tests/frontend/layout.test.mjs
git commit -m "feat: render meaningful live ant colony activity"
```

---

### Task 14: CLI entry points, final integration, and operator documentation

**Files:**
- Create: `src/ant_colony/cli.py`
- Create: `src/ant_colony/__main__.py`
- Modify: `README.md`
- Test: `tests/unit/test_cli.py`
- Test: `tests/integration/test_full_experience.py`

**Interfaces:**
- Consumes: `build_deterministic_colony()`, `create_app()`, and Uvicorn.
- Produces: `build_parser()`, `main(argv: Sequence[str] | None = None) -> int`, `python -m ant_colony`, and `python -m ant_colony --headless`.

`test_full_experience.py` defines `wait_for_completed_state(client, timeout_seconds)` using repeated `GET /api/state` calls with a monotonic deadline; the fixture controller uses zero display delay so the wait is bounded and deterministic.

- [ ] **Step 1: Write failing CLI and full-experience tests**

```python
def test_headless_cli_prints_final_result_and_trace(capsys):
    exit_code = main(["--headless"])
    output = capsys.readouterr().out
    assert exit_code == 0
    assert "COLONY_COMPLETED" in output
    assert "Final confidence:" in output

def test_full_web_run_reaches_same_result_as_headless(test_client):
    headless = build_deterministic_colony().run_until_terminal()
    response = test_client.post("/api/runs")
    assert response.status_code == 202
    completed = wait_for_completed_state(test_client, timeout_seconds=2.0)
    assert completed["final_result"] == headless.final_answer.content
    assert completed["final_confidence"] == headless.final_confidence
```

Also test default host/port arguments, no browser import in headless mode, and nonzero exit status for a stalled headless run.

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run: `python -m pytest tests/unit/test_cli.py tests/integration/test_full_experience.py -v`  
Expected: FAIL because `cli.py` and `__main__.py` do not exist.

- [ ] **Step 3: Implement the entry points and concise README**

`python -m ant_colony` calls Uvicorn with `host="127.0.0.1"` and `port=8000`. `--headless` builds the same deterministic colony, runs to terminal, prints each structured event in sequence followed by the final result/confidence, and never imports `ant_colony.web.server` on that branch.

Document Python 3.12 environment setup, `pip install -e ".[dev]"`, headless and browser commands, expected URL, deterministic scope, test commands, and evidence categories. Do not document any unimplemented provider or deployment path.

- [ ] **Step 4: Run the complete automated verification**

Run: `python -m pytest -v`  
Expected: all Python unit and integration tests PASS.  
Run: `node --test tests/frontend/colony-state.test.mjs tests/frontend/layout.test.mjs`  
Expected: all frontend projection/layout tests PASS.  
Run: `python -m ant_colony --headless`  
Expected: exit code 0, ordered trace ending in `COLONY_COMPLETED`, final result, and confidence at or above `0.75`.

- [ ] **Step 5: Run the manual browser verification**

Run: `python -m ant_colony`  
Expected: Uvicorn listens only on `http://127.0.0.1:8000`. Open the URL, start the synthetic scenario, and observe state-derived ant movement, gathering, child-task spawning, signal decay, verification, contradiction/reopen activity, synthesis, final result/confidence, and inspectable event history. Stop the server cleanly after capture.

- [ ] **Step 6: Commit**

```bash
git add src/ant_colony/cli.py src/ant_colony/__main__.py README.md tests/unit/test_cli.py tests/integration/test_full_experience.py
git commit -m "feat: deliver deterministic Build 1 experience"
```

---

## Plan review against the approved specification

- Approximately ten deterministic ants and stable turn order: Tasks 5, 7, and 9.
- Goal creation, decomposition, child tasks, claiming, execution, and immutable results: Tasks 3, 6, 7, and 9.
- Explorer, Verifier, and Synthesizer through one abstraction: Tasks 5 and 7.
- Inspectable priority, urgency, demand, verification, capability, and duplication scoring: Task 5.
- Exactly four normalized and decaying pheromones: Tasks 1 and 9.
- Independent agreement/disagreement/contradiction records and confidence adjustment: Task 4.
- Provider-neutral boundary with deterministic no-key adapter: Task 6.
- Execution, provider, coordination, and confidence failure handling: Tasks 4 and 7.
- Structured complete event trace: Tasks 2, 3, 4, 7, and 9.
- Verification-aware completion and safe stall detection: Tasks 8 and 9.
- Headless deterministic final result: Tasks 9 and 14.
- Read-only visualization boundary and reconstructible protocol: Tasks 10 and 11.
- Static serving, WebSocket connection, mapping, reconnect, and observer independence: Tasks 10–12.
- Meaningful ants, tasks, gathering, spawning, pheromones, verification, synthesis, completion, and final result: Tasks 12–14.
- No paid API, probabilistic assertion, frontend framework, database, or infrastructure expansion appears in any task.

## Execution stop condition

This document is planning output only. Do not execute Task 1 or create any runtime/frontend implementation until the user explicitly approves this plan and chooses an execution workflow.
