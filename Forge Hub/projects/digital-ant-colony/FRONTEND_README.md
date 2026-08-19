# Digital Ant Colony

A small, self-contained ant colony simulation that runs entirely in the browser.
One nest, a colony of ants with three simple roles, food you place yourself,
obstacles you draw, hazards you paint, and three pheromone channels — watch the
colony discover food, avoid danger, and gradually settle into efficient
foraging trails through nothing but local behaviour and trail reinforcement.

This is **Simulation 01** of *Project Forge*, a planned collection of
independent browser simulations. Each project in the collection is built to
stand completely on its own (no shared server, no shared state) so it can
later be linked or embedded from a central Project Forge dashboard.

## Running it

No build step, no server, no dependencies.

1. Open `index.html` directly in a modern desktop or mobile browser.

That's it. Everything runs client-side with plain HTML, CSS, and JavaScript.

## Controls

| Action | Control | Key |
|---|---|---|
| Pause / Resume | **Pause** | `Space` |
| Simulation speed | `0.5x` `1x` `2x` `4x` `8x` | `1`–`5` |
| Tool | Food / Obstacle / Hazard / Erase | — |
| Food type (Food tool) | Crumbs / Sugar / Fruit / Protein | — |
| Brush size (Obstacle/Hazard/Erase) | Small / Medium / Large | — |
| Pheromone overlay | Off / Food / Home / Danger / All | `P` (cycles) |
| Add an ant | **+ Ant** | `A` |
| Colony growth on/off | **Growth: On/Off** | — |
| Load a preset scenario | Preset dropdown | — |
| Reset the current preset | **Reset Colony** (press twice to confirm) | `R` (press twice) |
| Cinematic mode (hide UI, just watch) | **Cinematic** | `C` |
| Click/tap the world | Applies the current tool (place food, paint, erase) | — |
| Drag on the world | Sprinkles food crumbs, or paints continuously | — |

## Simulation logic

**Ants** are a small state machine (`searching` / `returning`, plus a brief
`fleeing` reaction near danger) driven entirely by local information — what an
ant can sense right where it's standing. There is no pathfinding and no ant
ever "knows" where food or the nest is beyond what it can currently sense;
every efficient route that appears is an emergent side effect of pheromone
reinforcement:

- Every ant has a **role** — `scout` (wide-ranging, low trail affinity,
  bigger sensor), `worker` (balanced default), or `carrier` (strong trail
  affinity, slows down more while loaded) — assigned at spawn and reflected
  in body color.
- **Searching** ants wander with continuous random-turn noise, lay a thin
  **home pheromone** breadcrumb as they go, and bend gently toward the
  strongest nearby **food pheromone** — imperfectly, so the colony keeps
  exploring even once a strong trail exists.
- On reaching a food source, a searching ant picks up **one unit**, switches
  to `returning`, and remembers which food type it's carrying.
- **Returning** ants follow the home-pheromone trail back (the same
  breadcrumb-following trick real ants use), blended with a small homing bias
  toward the nest so they're never truly lost, and lay **food pheromone** as
  they walk. A heavier food type (fruit, protein) slows a loaded ant down.
- **Pheromones** (food, home, and danger — three independent grids) evaporate
  continuously. Trails that many ants reinforce because they lead somewhere
  useful and nearby stay strong; trails that fall out of use fade. This is
  what makes a physically shorter route around an obstacle end up with a
  stronger trail than a longer one, without ever hard-coding "pick the
  shortest path."
- **Obstacles** are a brush-painted grid ants can't pass through; they steer
  around a wall before hitting it and slide along it if they do.
- **Hazards** are a brush-painted zone: ants inside one deposit **danger
  pheromone** and flee; ants elsewhere sense and avoid a strong danger trail
  before ever entering the zone directly. Prolonged exposure fades an ant out
  (stylized — no gore, no combat).
- **Colony growth**: delivered food accumulates in colony storage (shown as a
  ring around the nest entrance). Once enough is banked, the colony spends it
  to raise a new ant, up to a device-appropriate population cap. Growth can be
  switched off to hold the population fixed for a cleaner visual experiment.

**Food sources** are finite and come in four types (crumbs, sugar, fruit,
protein) with different size, colony value, and carry weight. Each shrinks
visibly as ants consume it and disappears once exhausted.

**Presets** set the stage for six specific behaviours to watch: Simple
Forage, Two Food Sources, Two Paths (the route-competition demo — one way
around a wall is meaningfully shorter, and the colony gradually prefers it),
Maze Run, Scarce Food, and Hazard Route.

**Events** (food discovered, a trail becoming dominant, a source running dry,
storage milestones, a preset loading) are logged in the sidebar, throttled so
the log stays readable instead of scrolling constantly.

## File structure

```
digital-ant-colony/
├── index.html              Page shell, HUD markup, tool/overlay/preset controls
├── style.css                Dark "observation table" theme, responsive layout
├── app.js                   Canvas setup, render loop, input & UI wiring
├── js/
│   ├── utils.js              Math helpers + CONFIG (all tunable constants)
│   ├── pheromoneGrid.js       One pheromone channel: deposit / evaporate / draw
│   ├── obstacles.js            MaskGrid: shared brush-paintable layer (obstacles + hazards)
│   ├── food.js                  FoodSource: finite, shrinking, typed food clusters
│   ├── ant.js                     Ant behaviour state machine
│   ├── colony.js                   Orchestrates nest, ants, food, grids, stats, events
│   └── presets.js                   Named world layouts (Two Paths, Maze Run, ...)
└── README.md
```

Files are loaded as plain `<script>` tags (not ES modules) specifically so
the project works by double-clicking `index.html` — some browsers block
`type="module"` scripts from loading over the `file://` protocol.

## Performance notes

- Ants are plain JS objects updated in a flat array and drawn without any
  per-ant DOM — everything is Canvas 2D.
- Ant bodies are batched into a handful of `fill()` calls per frame (by role
  and carrying state) instead of one draw call per ant.
- Each pheromone channel is a single `Float32Array` grid; obstacles and
  hazards are `Uint8Array` masks — no per-cell objects, no per-cell DOM.
- Population is capped per device tier (lower on coarse-pointer/narrow
  viewports) so growth can't run away on weaker hardware.
- Designed for a starting population of ~50 ants with smooth performance well
  past 300 on desktop.

## Where future systems could connect

This version deliberately stops at one solid, readable core loop. Left out on
purpose, for later versions of this simulation or later Project Forge
entries:

- Queens, reproduction/genetics, or colony evolution
- Rival colonies or ant-vs-ant combat
- Individual ant memory, personality, or relationships
- Complex underground nest construction
- Camera pan/zoom (the world is sized to the viewport, not larger than it)

The `CONFIG` object in `js/utils.js` centralizes every tunable number
(speeds, sensing radii, evaporation rates, role traits, food types, growth
cost, population caps, etc.), `Colony` is the single simulation-state
integration point, and `js/presets.js` is the seam for adding new scenarios —
all intended as the places a future version, or a Project Forge dashboard
reading colony stats, would hook into.
