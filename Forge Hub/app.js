/* ============================================
   FORGE HUB — Project Registry
   Add a new project by appending an entry here.
   category must be one of: simulation, game, tool, experiment
   status must be one of: complete, in-progress, prototype
   ============================================ */
const projects = [
  {
    title: "Digital Ant Colony",
    slug: "digital-ant-colony",
    category: "simulation",
    description: "A living ant colony simulation with emergent foraging and pheromone trails.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/digital-ant-colony/"
  },
  {
    title: "Gravity Garden",
    slug: "gravity-garden",
    category: "simulation",
    description: "Place gravity wells and watch particles orbit, attract, and repel.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/gravity-garden/"
  },
  {
    title: "Particle Lab",
    slug: "particle-lab",
    category: "tool",
    description: "An interactive playground for tuning particle physics forces.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/particle-lab/"
  },
  {
    title: "The Button That Judges You",
    slug: "button-that-judges-you",
    category: "experiment",
    description: "A single button that reacts to how — and how often — you press it.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/button-that-judges-you/"
  },
  {
    title: "Aurora Loom",
    slug: "aurora-loom",
    category: "experiment",
    description: "Drag across the sky to pluck and weave glowing threads of aurora light.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/aurora-loom/"
  },
  {
    title: "Gravity Sandbox",
    slug: "gravity-sandbox",
    category: "simulation",
    description: "Spawn planets, moons, stars, and black holes and watch an N-body gravity simulation unfold.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/gravity-sandbox/"
  },
  {
    title: "Molt",
    slug: "molt",
    category: "game",
    description: "Eat anything smaller, avoid anything bigger, and molt into a random mutation as you grow.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/molt/"
  },
  {
    title: "Mycelium",
    slug: "mycelium",
    category: "simulation",
    description: "A fungal growth sim where colonies spread biomass through a nutrient network.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/mycelium/"
  },
  {
    title: "Moonlit Terrarium",
    slug: "moonlit-terrarium",
    category: "game",
    description: "Keep four nocturnal Motes alive for seven quiet nights with one gift per night.",
    status: "prototype",
    thumbnail: "",
    path: "./projects/moonlit-terrarium/"
  }
];

const STATUS_LABELS = {
  complete: "Complete",
  "in-progress": "In Progress",
  prototype: "Prototype"
};

const grid = document.getElementById("project-grid");
const emptyState = document.getElementById("empty-state");
const filterButtons = document.querySelectorAll(".filter-btn");

function createCard(project) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.dataset.category = project.category;

  const thumb = document.createElement("div");
  thumb.className = "card-thumb";
  if (project.thumbnail) {
    const img = document.createElement("img");
    img.src = project.thumbnail;
    img.alt = `${project.title} thumbnail`;
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "card-thumb-fallback";
    fallback.textContent = project.category;
    thumb.appendChild(fallback);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const topRow = document.createElement("div");
  topRow.className = "card-top-row";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = project.title;

  const category = document.createElement("span");
  category.className = "card-category";
  category.textContent = project.category;

  topRow.append(title, category);

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent = project.description;

  const bottomRow = document.createElement("div");
  bottomRow.className = "card-bottom-row";

  const status = document.createElement("span");
  status.className = "card-status";
  status.dataset.status = project.status;
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, STATUS_LABELS[project.status] || project.status);

  const launch = document.createElement("a");
  launch.className = "launch-btn";
  launch.textContent = "LAUNCH";
  launch.href = project.path;
  launch.setAttribute("aria-label", `Launch ${project.title}`);

  bottomRow.append(status, launch);
  body.append(topRow, description, bottomRow);
  card.append(thumb, body);

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

function checkProjectAvailable(path) {
  return fetch(path, { method: "HEAD" })
    .then((res) => res.ok)
    .catch(() => null); // null = unknown, treat as available
}

function renderProjects(filter) {
  grid.innerHTML = "";
  const visible = projects.filter((p) => filter === "all" || p.category === filter);

  visible.forEach((project) => grid.appendChild(createCard(project)));

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

renderProjects("all");
