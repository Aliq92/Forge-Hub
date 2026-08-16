# Moonlit Terrarium — Seven Quiet Nights (v0.1)

A calm, autonomous ecosystem in a compact glass terrarium. Four glowing
nocturnal creatures — **Motes** — forage, drink, rest, seek shelter, and
gather on their own. Each night you may place exactly one gift to help
them through. Keep at least one Mote glowing after seven nights and you win.

## Running it

No build step, no dependencies. Just open `index.html` in a modern
desktop or mobile browser (double-click it, or drag it into a browser tab).

Files:

- `index.html` — page structure and overlays
- `styles.css` — visual styling and responsive layout
- `script.js` — the entire simulation (state, behaviour, rendering, input, UI)
- `README.md` — this file

## How to play

1. Read the start overlay and click **Begin Night 1**.
2. Watch the four Motes — **Ember, Pip, Sable, Wren** — wander, forage,
   drink, and rest on their own.
3. Pick one gift from the panel: **Food, Water, Shelter,** or **Moon Lamp**.
4. Tap or click inside the terrarium to place it. You get one placement
   per night; the controls lock afterward. At the next dawn that gift is
   removed and the controls unlock again for a new choice.
5. Tap any Mote to see its name, activity, Hunger, Thirst, and Energy.
6. Each night lasts about 40 seconds. Survive all seven.

**Win:** at least one Mote is still active (Energy above 0) after Night 7.
**Lose:** all four Motes become exhausted (Energy at 0) at the same time.

Gifts last only for the night they're placed in: at most one may be placed
per night, and it is removed from the terrarium (its effect ending with it)
the moment the next night begins, when the controls unlock for a fresh
choice. Gifts never accumulate across nights.

## Gameplay & architecture decisions

- **Care commitment.** Once a Mote commits to eating, drinking, or
  resting, it stays until the need is meaningfully resolved (Hunger ≤ 25,
  Thirst ≤ 25, Energy ≥ 80), the gift disappears, or a genuinely more
  urgent need (much higher-priority thirst/hunger, or true exhaustion)
  overrides it. Ambient wandering/gathering never interrupts care.
- **Exhaustion has a way out.** A Mote at 0 Energy doesn't decay further
  and always prioritises finding Shelter above anything else once it
  exists in the world. If no Shelter has been placed yet, it drifts
  slowly instead of freezing, so it's never stuck in a dead state.
- **Moon Lamp** doesn't fill a meter directly — it slows nearby Motes'
  Energy drain and gently draws content Motes in for peaceful gathering,
  making it a good "buy time" pick when the colony is already fed and
  watered.
- **Delta-time simulation.** All movement, timers, and need changes are
  driven by elapsed real time (`dt`), clamped to a maximum step per
  frame. Returning from a backgrounded/suspended browser tab can't
  cause the colony to jump straight to exhaustion.
- **Single persistent loop.** One `requestAnimationFrame` loop runs for
  the lifetime of the page. Restarting the game replaces the in-memory
  state object and resets the DOM; it never spawns a second loop,
  listener set, or canvas.
- **World-space canvas.** The simulation runs in a fixed 960×600 logical
  coordinate space. The canvas is resized and rescaled to fit its
  container (respecting device pixel ratio) without ever stretching or
  distorting the simulated world, on desktop or mobile, portrait or
  landscape.
- **Pointer Events.** Mouse, touch, and stylus input all go through the
  same `pointerdown` handlers, so behaviour is identical across devices.
- **Auto-pause.** The `visibilitychange` event pauses the simulation the
  moment the tab is hidden and resumes it on return, unless the player
  had already paused manually (that preference is respected).

## Balance notes (v0.1 tuning)

- Hunger/Thirst rise slowly on their own (~0.8–0.9 per second); Food and
  Water reduce them quickly (9/second) once a Mote is in range, so care
  has an obvious, satisfying effect within the same night.
- Energy drains slowly and is *not* restored by Food or Water directly —
  only Shelter (and, indirectly, the Moon Lamp slowing the drain) restores
  it, so Shelter placement becomes a meaningful strategic decision across
  the seven nights rather than a guaranteed daily pick.
- Several Motes can use the same Food, Water, or Shelter simultaneously —
  nothing is depleted or exclusive.

## Known limitations (v0.1)

- No audio.
- No persistence between browser sessions — refreshing the page starts a
  new run (this is by design for v0.1's scope).
- Balance was hand-tuned and tested via an automated no-intervention run
  (predictably ends in a loss) and a "care every night" run (ends in a
  win); it has not been tested against every possible mix of player
  choices.
- Very old browsers without `Canvas 2D`, `Pointer Events`, or
  `requestAnimationFrame` support are not targeted.

## Suggested manual checks

- Resize the browser window slowly across the desktop/mobile breakpoint
  (~860px) and confirm the layout re-stacks cleanly with no overlap or
  horizontal scrollbar.
- Rotate a mobile device between portrait and landscape mid-game.
- Switch to another browser tab for 10+ seconds mid-night and confirm
  the simulation pauses and resumes smoothly on return.
- Click Pause, then Restart, then Pause again, to confirm state doesn't
  leak between runs.

## Recommended focus for v0.2

- Optional ambient audio (soft night sounds, muted per-Mote chirps).
- A gentle end-of-night summary instead of only a live Happenings feed.
- More Mote personality: distinct wander speeds/temperaments per Mote.
- Accessibility pass: keyboard-operable intervention placement, and a
  reduced-motion mode for the drifting particles and camera-free canvas
  animation.
