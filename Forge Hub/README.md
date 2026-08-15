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
└── assets/
    └── thumbnails/           # Optional card thumbnail images
```

## Adding a new project

1. Create a new folder under `projects/`, named with a URL-friendly slug:

   ```
   projects/your-project-name/
   ```

2. Put the project's own `index.html` (plus any CSS/JS/assets it needs) inside that folder. Each project is self-contained and can be built however you like — the hub only links to it.

3. (Optional) Add a thumbnail image to `assets/thumbnails/` if you want the card to show a preview instead of the category placeholder.

4. Register the project in `app.js` by adding an entry to the `projects` array at the top of the file:

   ```js
   {
     title: "Your Project Name",
     slug: "your-project-name",
     category: "simulation",       // simulation | game | tool | experiment
     description: "One short sentence about what it does.",
     status: "prototype",          // complete | in-progress | prototype
     thumbnail: "",                // e.g. "./assets/thumbnails/your-project.png"
     path: "./projects/your-project-name/"
   }
   ```

5. Save and refresh the homepage — the card is generated automatically from the registry. No HTML editing required.

If a registered project's folder doesn't exist yet (or its `index.html` is missing), the homepage detects this and marks the card's launch button as unavailable instead of linking to a broken page.

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
