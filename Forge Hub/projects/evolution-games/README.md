# Evolution Games — Natural Selection Playground

A lightweight, browser-based 2D evolution simulation. Small creatures wander
a world, hunt for food, survive, reproduce, and evolve over many generations
— all rendered live on an HTML5 canvas.

## How to run it

No build step, no server, no dependencies.

1. Open the `evolution-games` folder.
2. Double-click `index.html` (or right-click → Open with → your browser).

That's it — the simulation starts automatically.

If your browser blocks local file scripts for any reason, you can instead
serve the folder with any static file server, for example:

```bash
npx serve .
```

then open the printed `http://localhost` URL.

## Files

- `index.html` — page structure and layout (canvas + stats/control panel)
- `style.css` — dark simulation-lab visual styling
- `script.js` — all simulation logic (Food, Creature, Simulation, UI wiring)
- `README.md` — this file

## Controls

- **Pause / Resume** — freeze or continue the simulation
- **Restart** — wipe the world and start a fresh Generation 1
- **Speed** — 1x / 2x / 5x / 10x simulation speed
- **Mutation Rate** — slider controlling how much offspring traits drift from their parents
- **Click a creature** — select it to see its individual energy, speed, vision, size, efficiency, age, and food eaten in the side panel. The selected creature is highlighted and its vision radius is drawn.

## How it works (short version)

- Each creature has 4 inherited traits: **speed**, **vision range**, **body size**, and **energy efficiency**.
- Every trait costs energy to run — faster, bigger, and more perceptive creatures burn energy faster, while higher efficiency offsets that cost. No trait is free, so no single trait dominates.
- Creatures that spot food within their vision steer toward it; otherwise they wander.
- When a generation's timer runs out (or the whole population dies early), survivors are used to breed the next generation: fitter (higher-energy) survivors are more likely to become parents, and each offspring trait has a chance to mutate slightly.
- If every creature dies out before reproducing, the simulation automatically reseeds from the last surviving gene pool (or a fresh random population if none exists) and logs what happened.

## Known limitations

- There is no persistence — refreshing the page always starts a brand-new run at Generation 1.
- Creatures use simple nearest-food targeting and basic wandering, not full pathfinding or predator/prey behavior.
- Balance values (population size, food amount, generation length, energy costs) are hand-tuned approximations, not scientifically modeled.
- Very large population sizes (well beyond the ~50–70 default range) aren't performance-tested and may slow down on low-end machines.

## Suggested next upgrade

Add **predators or a second competing species** (or simply carnivore/herbivore
divergence) so evolutionary pressure comes from more than food scarcity alone
— this would make traits like speed and vision trade off against a real
threat instead of just a depleting resource, and make emergent strategies
(e.g., fast-but-fragile vs. big-but-slow) much more visually dramatic to
watch play out.
