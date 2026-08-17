/* ============================================
   FORGE HUB — Project Registry
   Add a new project by appending an entry here.
   category must be one of: simulation, game, tool, experiment, visualization, utility
   status must be one of: prototype, active, in-progress, complete, paused, archived, experimental
   The card header symbol/accent color is derived automatically from
   `category` via categoryStyles below — no thumbnail artwork needed.
   ============================================ */
const projects = [
  {
    title: "Digital Ant Colony",
    slug: "digital-ant-colony",
    category: "simulation",
    description: "A living ant colony simulation with emergent foraging and pheromone trails.",
    status: "prototype",
    path: "./projects/digital-ant-colony/"
  },
  {
    title: "Gravity Garden",
    slug: "gravity-garden",
    category: "simulation",
    description: "Place gravity wells and watch particles orbit, attract, and repel.",
    status: "prototype",
    path: "./projects/gravity-garden/"
  },
  {
    title: "Particle Lab",
    slug: "particle-lab",
    category: "tool",
    description: "An interactive playground for tuning particle physics forces.",
    status: "prototype",
    path: "./projects/particle-lab/"
  },
  {
    title: "The Button That Judges You",
    slug: "button-that-judges-you",
    category: "experiment",
    description: "A single button that reacts to how — and how often — you press it.",
    status: "prototype",
    path: "./projects/button-that-judges-you/"
  },
  {
    title: "Aurora Loom",
    slug: "aurora-loom",
    category: "experiment",
    description: "Drag across the sky to pluck and weave glowing threads of aurora light.",
    status: "prototype",
    path: "./projects/aurora-loom/"
  },
  {
    title: "Gravity Sandbox",
    slug: "gravity-sandbox",
    category: "simulation",
    description: "Spawn planets, moons, stars, and black holes and watch an N-body gravity simulation unfold.",
    status: "prototype",
    path: "./projects/gravity-sandbox/"
  },
  {
    title: "Molt",
    slug: "molt",
    category: "game",
    description: "Eat anything smaller, avoid anything bigger, and molt into a random mutation as you grow.",
    status: "prototype",
    path: "./projects/molt/"
  },
  {
    title: "Mycelium",
    slug: "mycelium",
    category: "simulation",
    description: "A fungal growth sim where colonies spread biomass through a nutrient network.",
    status: "prototype",
    path: "./projects/mycelium/"
  },
  {
    title: "Moonlit Terrarium",
    slug: "moonlit-terrarium",
    category: "game",
    description: "Keep four nocturnal Motes alive for seven quiet nights with one gift per night.",
    status: "prototype",
    path: "./projects/moonlit-terrarium/"
  },
  {
    title: "Wildfire Simulator",
    slug: "wildfire-simulator",
    category: "simulation",
    description: "An interactive fire spread sandbox — sculpt terrain, set the wind, and watch flames race across it.",
    status: "prototype",
    path: "./projects/wildfire-simulator/"
  },
  {
    title: "Kingdom Automata",
    slug: "kingdom-automata",
    category: "simulation",
    description: "An autonomous civilization sim — kingdoms rise, war, ally, and collapse across an alternate history you only observe.",
    status: "prototype",
    path: "./projects/kingdom-automata/"
  },
  {
    title: "Battle Sandbox",
    slug: "battle-sandbox",
    category: "game",
    description: "Draft two armies on a shared budget, pick a battlefield and commander doctrine, then watch AI factions fight it out.",
    status: "prototype",
    path: "./projects/battle-sandbox/"
  },
  {
    title: "Probability Playground",
    slug: "probability-playground",
    category: "tool",
    description: "An interactive laboratory for exploring randomness, probability, and statistics through hands-on simulations.",
    status: "prototype",
    path: "./projects/probability-playground/"
  },
  {
    title: "Ripple Tank",
    slug: "ripple-tank",
    category: "simulation",
    description: "A wave interference apparatus — drop sources into a virtual tank and watch ripples reflect, refract, and interfere.",
    status: "prototype",
    path: "./projects/ripple-tank/"
  },
  {
    title: "Water Network Simulator",
    slug: "water-network-simulator",
    category: "simulation",
    description: "Design a water distribution network with reservoirs, pumps, tanks, and valves, then simulate hydraulics and demand over time.",
    status: "prototype",
    path: "./projects/water-network-simulator/"
  }
];

/* ============================================
   Category visual identity — one symbol + accent
   className per build type. Icons are inline SVG
   (currentColor) so no extra image requests are made
   and future projects get their look purely from `type`.
   ============================================ */
const categoryStyles = {
  simulation: {
    label: "Simulation",
    className: "type-simulation",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><line x1="8.3" y1="13.4" x2="15.6" y2="17.5"/><line x1="15.6" y1="6.5" x2="8.3" y2="10.6"/></svg>'
  },
  game: {
    label: "Game",
    className: "type-game",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="9.5" rx="4.5"/><line x1="7" y1="10.5" x2="7" y2="15"/><line x1="4.75" y1="12.75" x2="9.25" y2="12.75"/><circle cx="16" cy="11.5" r="1"/><circle cx="18.5" cy="14" r="1"/></svg>'
  },
  tool: {
    label: "Tool",
    className: "type-tool",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/></svg>'
  },
  experiment: {
    label: "Experiment",
    className: "type-experiment",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3h5"/><path d="M10 3v5.2l-5 9a2 2 0 0 0 1.75 3h10.5a2 2 0 0 0 1.75-3l-5-9V3"/><path d="M7.5 15h9"/></svg>'
  },
  visualization: {
    label: "Visualization",
    className: "type-visualization",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></svg>'
  },
  utility: {
    label: "Utility",
    className: "type-utility",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.36 5.64l-1.56 1.56M7.2 16.8l-1.56 1.56M18.36 18.36l-1.56-1.56M7.2 7.2 5.64 5.64"/></svg>'
  }
};

// Kept as an alias so any external references to the old label map still work.
const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(categoryStyles).map(([key, val]) => [key, val.label])
);

const STATUS_LABELS = {
  complete: "Complete",
  "in-progress": "In Progress",
  prototype: "Prototype",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
  experimental: "Experimental"
};

const grid = document.getElementById("project-grid");
const emptyState = document.getElementById("empty-state");
const filterButtons = document.querySelectorAll(".filter-btn");
const featuredSlot = document.getElementById("featured-slot");
const introStats = document.getElementById("intro-stats");

function buildNumber(index) {
  return `FORGE-${String(index + 1).padStart(3, "0")}`;
}

// Small deterministic hash so each project gets a consistent but distinct
// variant (icon tilt + decorative dot count) without any stored config.
function variantOf(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash % 3;
}

function categoryIcon(category) {
  const wrap = document.createElement("span");
  wrap.className = "header-icon";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = (categoryStyles[category] && categoryStyles[category].icon) || "";
  return wrap;
}

function createCardHeader(project, index) {
  const style = categoryStyles[project.category] || {};
  const variant = variantOf(project.slug || project.title || String(index));

  const header = document.createElement("div");
  header.className = `card-header ${style.className || ""}`;
  header.dataset.category = project.category;
  header.dataset.variant = String(variant);

  const glow = document.createElement("div");
  glow.className = "card-header-glow";
  glow.setAttribute("aria-hidden", "true");

  const texture = document.createElement("div");
  texture.className = "card-header-texture";
  texture.setAttribute("aria-hidden", "true");

  const watermark = document.createElement("span");
  watermark.className = "card-header-watermark";
  watermark.setAttribute("aria-hidden", "true");
  watermark.textContent = String(index + 1).padStart(3, "0");

  const dots = document.createElement("div");
  dots.className = "card-header-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let i = 0; i <= variant; i++) {
    dots.appendChild(document.createElement("span"));
  }

  const buildTag = document.createElement("span");
  buildTag.className = "card-build-number";
  buildTag.textContent = buildNumber(index);

  const icon = categoryIcon(project.category);

  header.append(glow, texture, watermark, dots, buildTag, icon);
  return header;
}

function createStatusChip(project) {
  const status = document.createElement("span");
  status.className = "card-status";
  status.dataset.status = project.status;
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, STATUS_LABELS[project.status] || project.status);
  return status;
}

function createTypeBadge(project) {
  const style = categoryStyles[project.category] || {};
  const badge = document.createElement("span");
  badge.className = `card-category ${style.className || ""}`;
  badge.dataset.category = project.category;
  const iconWrap = document.createElement("span");
  iconWrap.className = "type-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = style.icon || "";
  badge.appendChild(iconWrap);
  badge.append(style.label || project.category);
  return badge;
}

function createCard(project, index) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.dataset.category = project.category;

  const header = createCardHeader(project, index);

  const body = document.createElement("div");
  body.className = "card-body";

  const topRow = document.createElement("div");
  topRow.className = "card-top-row";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = project.title;

  topRow.append(title, createTypeBadge(project));

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent = project.description;

  const bottomRow = document.createElement("div");
  bottomRow.className = "card-bottom-row";

  const status = createStatusChip(project);

  const launch = document.createElement("a");
  launch.className = "launch-btn";
  launch.textContent = "LAUNCH";
  launch.href = project.path;
  launch.setAttribute("aria-label", `Launch ${project.title}`);

  bottomRow.append(status, launch);
  body.append(topRow, description, bottomRow);
  card.append(header, body);

  // Best-effort check that the project actually exists on disk.
  // If the check can't run (e.g. local file:// CORS restrictions),
  // the launch button stays enabled and the browser handles a 404 normally.
  checkProjectAvailable(project.path).then((available) => {
    if (available === false) {
      launch.setAttribute("aria-disabled", "true");
      launch.removeAttribute("href");
      launch.textContent = "UNAVAILABLE";
      status.dataset.status = "prototype";
    }
  });

  return card;
}

function createFeaturedCard(project, index) {
  const card = createCard(project, index);
  card.classList.add("featured-card");

  const eyebrow = document.createElement("p");
  eyebrow.className = "featured-eyebrow";
  eyebrow.textContent = "Latest Build";
  card.querySelector(".card-body").prepend(eyebrow);

  return card;
}

function checkProjectAvailable(path) {
  return fetch(path, { method: "HEAD" })
    .then((res) => res.ok)
    .catch(() => null); // null = unknown, treat as available
}

function renderFeatured() {
  if (!featuredSlot || projects.length === 0) return;
  const index = projects.length - 1;
  const project = projects[index];
  featuredSlot.innerHTML = "";
  featuredSlot.appendChild(createFeaturedCard(project, index));
}

function renderIntro() {
  if (!introStats) return;
  const counts = projects.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});
  const breakdown = Object.keys(CATEGORY_LABELS)
    .filter((cat) => counts[cat])
    .map((cat) => `${counts[cat]} ${CATEGORY_LABELS[cat]}${counts[cat] > 1 ? "s" : ""}`)
    .join(" · ");

  introStats.textContent = `${projects.length} builds forged so far — ${breakdown}`;
}

function renderProjects(filter) {
  grid.innerHTML = "";
  const visible = projects
    .map((project, index) => ({ project, index }))
    .filter(({ project }) => filter === "all" || project.category === filter);

  visible.forEach(({ project, index }) => grid.appendChild(createCard(project, index)));

  emptyState.hidden = visible.length > 0;
}

function setActiveFilter(button) {
  filterButtons.forEach((btn) => btn.classList.remove("is-active"));
  button.classList.add("is-active");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button);
    renderProjects(button.dataset.filter);
  });
});

renderIntro();
renderFeatured();
renderProjects("all");
