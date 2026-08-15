// main.js — wiring: game loop, input handling, UI updates

let world, settlement, humans, effects;
let canvas, ctx;
let paused = false;
let speedMultiplier = 1;
let currentTool = null;
let lastTime = null;

function initGame() {
  world = new World();
  settlement = new Settlement(world);
  effects = new Effects(world);
  humans = [];

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 14 + Math.random() * 10;
    humans.push(new Human(
      settlement.center.x + Math.cos(angle) * dist,
      settlement.center.y + Math.sin(angle) * dist
    ));
  }
}

function findNearestGrass(x, y) {
  const start = world.tileCoordAtPixel(x, y);
  for (let radius = 0; radius < 6; radius++) {
    for (let r = -radius; r <= radius; r++) {
      for (let c = -radius; c <= radius; c++) {
        const tile = world.getTile(start.col + c, start.row + r);
        if (tile && tile.type === 'grass') {
          return world.tileCenterPixel(start.col + c, start.row + r);
        }
      }
    }
  }
  return { x, y };
}

// ---- input --------------------------------------------------------------

function getCanvasPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}

function setActiveTool(tool) {
  currentTool = tool === 'none' ? null : tool;
  document.querySelectorAll('.tool').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === currentTool);
  });
}

function handleCanvasClick(evt) {
  const { x, y } = getCanvasPos(evt);
  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;

  switch (currentTool) {
    case 'spawnHuman': {
      const spot = findNearestGrass(x, y);
      humans.push(new Human(spot.x, spot.y));
      break;
    }
    case 'growForest':
      world.growForestAt(x, y);
      break;
    case 'lightning':
      effects.strikeLightning(x, y, humans);
      break;
    case 'fire':
      effects.igniteNear(x, y);
      break;
    default:
      break;
  }
}

function setupUI() {
  document.querySelectorAll('.tool').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'none') {
        setActiveTool('none');
        return;
      }
      if (tool === 'rain') {
        effects.startRain();
        return; // instant effect, no world click required
      }
      setActiveTool(currentTool === tool ? 'none' : tool);
    });
  });

  canvas.addEventListener('click', handleCanvasClick);

  document.getElementById('btnPause').addEventListener('click', (e) => {
    paused = !paused;
    e.target.textContent = paused ? 'Resume' : 'Pause';
  });

  const speedButtons = {
    btnSpeed1: 1,
    btnSpeed2: 2,
    btnSpeed4: 4
  };
  Object.keys(speedButtons).forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      speedMultiplier = speedButtons[id];
      document.querySelectorAll('.speedBtn').forEach(b => b.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    });
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    initGame();
    setActiveTool('none');
    paused = false;
    document.getElementById('btnPause').textContent = 'Pause';
  });
}

// ---- stats ----------------------------------------------------------------

function updateStatsUI() {
  const pop = humans.filter(h => !h.dead).length;
  document.getElementById('statPop').textContent = pop;
  document.getElementById('statFood').textContent = Math.floor(settlement.inventory.food);
  document.getElementById('statWood').textContent = Math.floor(settlement.inventory.wood);
  document.getElementById('statStone').textContent = Math.floor(settlement.inventory.stone);
  document.getElementById('statHouses').textContent = settlement.houses.length;
  document.getElementById('statYear').textContent = settlement.year;
  document.getElementById('statDay').textContent = settlement.day;
}

// ---- loop -------------------------------------------------------------------

function update(dt) {
  const scaledDt = dt * speedMultiplier;
  world.update(scaledDt, effects.rainActive);

  for (const h of humans) h.update(scaledDt, world, settlement);
  humans = humans.filter(h => !h.dead);

  settlement.update(scaledDt, humans);
  effects.update(scaledDt, humans);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  world.render(ctx);
  settlement.render(ctx);
  for (const h of humans) h.render(ctx);
  effects.render(ctx);
}

function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  dt = Math.min(dt, 0.05); // clamp to avoid huge jumps on tab switch

  if (!paused) update(dt);
  render();
  updateStatsUI();

  requestAnimationFrame(loop);
}

// ---- boot -------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('worldCanvas');
  canvas.width = WORLD_COLS * TILE_SIZE;
  canvas.height = WORLD_ROWS * TILE_SIZE;
  ctx = canvas.getContext('2d');

  initGame();
  setupUI();
  requestAnimationFrame(loop);
});
