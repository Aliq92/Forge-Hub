# Predator–Prey Simulation

A browser-based, real-time predator–prey ecosystem simulation. Everything
runs client-side with plain HTML, CSS, vanilla JavaScript (ES modules), and
the HTML5 Canvas API — no frameworks, no build step, no backend.

Watch prey wander, forage, and flee; predators hunt and chase; food
regenerate; and populations rise and fall over time as an emergent result of
simple per-agent rules (not a scripted animation).

## Project structure

```
predator-prey-simulation/
├── index.html          Page shell, canvas, HUD, and controls
├── styles/
│   └── main.css         Dark ecosystem visual theme
├── src/
│   ├── main.js           Entry point: canvas setup, animation loop, HUD, controls
│   ├── simulation.js      Owns all entities, advances one tick, renders the frame
│   ├── config.js          All tunable parameters (speeds, energy, vision, etc.)
│   ├── prey.js            Prey behavior: wander, flee, seek food, reproduce
│   ├── predator.js        Predator behavior: wander, hunt, kill, reproduce
│   └── food.js            Food particle
└── README.md
```

## How to run it

The project must be served over HTTP (not opened as a `file://` URL) because
it uses ES module imports, which browsers block on the `file://` protocol.

From inside the `predator-prey-simulation` folder, run:

```bash
python -m http.server 8000
```

Then open your browser to:

```
http://localhost:8000
```

Any other static file server (e.g. `npx serve`, VS Code's "Live Server")
works too — the project has no server-side logic at all.

## How the ecosystem works

Each simulation tick, every agent runs simple local rules based only on what
is near it (there's no global intelligence or pathing):

- **Food** spawns at random positions over time, up to a population cap. It
  disappears when eaten.
- **Prey**
  - Look for the nearest predator within their detection radius. If one is
    found, they turn and move directly away from it (fleeing costs extra
    energy).
  - Otherwise, they look for the nearest food within vision range and move
    toward it, eating it on contact for an energy boost.
  - If no predator or food is in range, they wander — their heading drifts
    randomly instead of moving in a straight line.
  - Energy drains every tick. At zero energy, a prey dies.
  - Once energy is high enough (and after a reproduction cooldown), a prey
    splits off a child, paying an energy cost to do so.
- **Predators**
  - Look for the nearest prey within vision range and chase it.
  - If no prey is visible, they wander.
  - Killing a prey (getting within kill range) grants a large energy boost.
  - Energy drains every tick; with no food, predators eventually starve and
    die.
  - Like prey, predators reproduce once energy is high enough and their
    cooldown has expired.
- Entities that move past the edge of the canvas **wrap around** to the
  opposite side rather than stopping — the world is a torus, not a walled box.

Because both species depend on energy dynamics rather than fixed lifespans,
population sizes naturally oscillate: more prey means more food for
predators, which grows the predator population, which then thins out prey,
which starves predators back down, and so on. If predators die out entirely,
prey are free to grow unchecked. If prey die out, predators are guaranteed to
eventually starve.

## Controls

- **Pause / Resume** — freezes or continues the simulation loop.
- **Restart** — resets the ecosystem back to the starting populations.
- **Speed (0.5x / 1x / 2x / 4x)** — scales how fast simulated time advances
  relative to real time. The simulation uses a fixed-timestep accumulator, so
  behavior stays consistent regardless of speed or the browser's actual
  frame rate.

The HUD (top-left) shows live prey/predator/food counts, elapsed simulated
time, and current FPS.

## Configuration

Every tunable number lives in [`src/config.js`](src/config.js), grouped by
`prey`, `predator`, `food`, `world`, and `simulation`. Notable knobs:

- `startCount` / `maxCount` — starting and maximum population sizes
- `maxSpeed`, `turnRate`, `wanderJitter` — movement feel
- `visionRadius`, `predatorDetectionRadius` — how far agents can sense
- `energyDrain`, `energyFromFood`, `energyFromPrey` — energy economy
- `reproduceEnergyThreshold`, `reproduceCost`, `reproduceCooldownFrames` —
  reproduction rules
- `food.spawnPerFrame` — food regeneration rate

Changing these values and refreshing the page is enough to retune the whole
ecosystem — no other code changes are needed for basic balancing.
