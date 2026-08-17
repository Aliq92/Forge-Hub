# FORGE HUB

FORGE HUB is the permanent home for completed HTML experiments, simulations, games, and tools built under Project FORGE. It's a single static launcher page that lists every finished project as a card and opens it with one click.

Plain HTML, CSS, and vanilla JavaScript. No frameworks, no build step, no npm.

## Running it locally

There's no build process — just open the file:

- Double-click [index.html](index.html), **or**
- Serve the folder with any static server, for example:

```bash
npx serve .
```

```bash
python -m http.server 8000
```

Either approach works since the site has no server-side dependencies.

## Project structure

```
forge-hub/
├── index.html              # Launcher / gallery homepage
├── styles.css               # All site styling
├── app.js                   # Project registry + card rendering + filtering
├── projects/
│   ├── worldseed/
│   │   └── index.html
│   ├── evolution-games/
│   │   └── index.html
│   └── predator-prey/
│       └── index.html
└── assets/                  # Reserved for any one-off project assets
```

## Adding a new project

1. Create a new folder under `projects/`, named with a URL-friendly slug:

   ```
   projects/your-project-name/
   ```

2. Put the project's own `index.html` (plus any CSS/JS/assets it needs) inside that folder. Each project is self-contained and can be built however you like — the hub only links to it.

3. Register the project in `app.js` by appending an entry to the `projects` array at the top of the file:

   ```js
   {
     title: "Your Project Name",
     slug: "your-project-name",
     category: "simulation",       // simulation | game | tool | experiment | visualization | utility
     description: "One short sentence about what it does.",
     status: "prototype",          // prototype | active | in-progress | complete | paused | archived | experimental
     path: "./projects/your-project-name/"
   }
   ```

4. Save and refresh the homepage — the card is generated automatically from the registry. No HTML editing required.

Because the new entry is appended to the end of the array, it automatically:
- gets the next sequential **Forge build number** (`FORGE-013`, etc.)
- becomes the **"Latest Build"** featured card at the top of the page

If a registered project's folder doesn't exist yet (or its `index.html` is missing), the homepage detects this and marks the card's launch button as unavailable instead of linking to a broken page.

## Card visual identity

There's no thumbnail artwork to design or upload. Each card's compact header — symbol, accent color, glow, badge — is derived automatically from its `category`, via the `categoryStyles` config at the top of `app.js`:

```js
const categoryStyles = {
  simulation:    { label: "Simulation",    className: "type-simulation",    icon: "<svg…>" },
  game:          { label: "Game",          className: "type-game",          icon: "<svg…>" },
  tool:          { label: "Tool",          className: "type-tool",          icon: "<svg…>" },
  experiment:    { label: "Experiment",    className: "type-experiment",    icon: "<svg…>" },
  visualization: { label: "Visualization", className: "type-visualization", icon: "<svg…>" },
  utility:       { label: "Utility",       className: "type-utility",       icon: "<svg…>" }
};
```

So the only thing you normally need to set per project is `category` — its symbol, badge, and accent color (teal for simulations, purple for games, blue for tools, magenta for experiments, green for visualizations) all follow automatically. Each card also gets a subtle, deterministic per-project variation (icon tilt, decorative dot count, build-number watermark) so same-category cards aren't identical. To add a new category, add an entry to `categoryStyles` and a matching `--color-type-*` accent variable in `styles.css`.

## Filtering

The ALL / SIMULATIONS / GAMES / TOOLS / EXPERIMENTS buttons filter the grid client-side by each project's `category` field. No page reload, no server calls.

## Deploying to Netlify

1. Push this folder to a Git repository (GitHub, GitLab, or Bitbucket), or drag-and-drop the folder directly onto [Netlify Drop](https://app.netlify.com/drop).
2. In Netlify, choose **Add new site → Import an existing project** and select the repo.
3. Build settings:
   - **Build command:** leave blank (none needed)
   - **Publish directory:** `.` (the project root, since `index.html` lives at the top level)
4. Deploy. Netlify will serve the site as-is with no build step.

Every subfolder under `projects/` is served automatically since Netlify publishes the whole directory tree — no extra routing configuration is required.
