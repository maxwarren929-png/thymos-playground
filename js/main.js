const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const WORLD = {
  width: GAME_CONSTANTS.worldDimensions.width,
  height: GAME_CONSTANTS.worldDimensions.height,
  center: { x: GAME_CONSTANTS.worldDimensions.width / 2, y: GAME_CONSTANTS.worldDimensions.height / 2 }
};
const sprites = new SpriteLayers();
let bgImage = null;
let creatureCount = 12;
let gameState = "setup";
let isPaused = false;
let lastTime = performance.now();
let gameStartTime = 0;
let hoverCreature = null;

// === GAME SPEED ===
const SPEED_LEVELS = [0.25, 0.5, 1, 2, 4];
let speedIndex = 2;

// === STATE ===
const state = {
  creatures: [],
  bushes: [],
  water: [],
  hounds: [],
  births: [],
  deaths: [],
  speciationEvents: [],
  generation: 1,
  avgTraits: {},
  traitHistory: [],
};

const camera = {
  x: WORLD.center.x,
  y: WORLD.center.y,
  zoom: CONSTANTS.CAMERA.DEFAULT_ZOOM,
  panning: false,
  panMoved: false,
  lastX: 0,
  lastY: 0,
  panStartX: 0,
  panStartY: 0,
  focusX: WORLD.center.x,
  focusY: WORLD.center.y,
  focusTimer: 0,
  tracking: false,
  trackedCreature: null,
};

const els = {
  setupOverlay: document.getElementById("setup-overlay"),
  creatureList: document.getElementById("creature-list"),
  countDisplay: document.getElementById("count-display"),
  countDown: document.getElementById("count-down"),
  countUp: document.getElementById("count-up"),
  startBtn: document.getElementById("start-btn"),
  popCount: document.getElementById("pop-count"),
  genCount: document.getElementById("gen-count"),
  creatureEntries: document.getElementById("creature-entries"),
  speedBtn: document.getElementById("speed-btn"),
  genStats: document.getElementById("gen-stats"),
  bushCountDisplay: document.getElementById("bush-count-display"),
  bushCountDown: document.getElementById("bush-count-down"),
  bushCountUp: document.getElementById("bush-count-up"),
  bushFoodDisplay: document.getElementById("bush-food-display"),
  bushFoodDown: document.getElementById("bush-food-down"),
  bushFoodUp: document.getElementById("bush-food-up"),
  bushRegrowDisplay: document.getElementById("bush-regrow-display"),
  bushRegrowDown: document.getElementById("bush-regrow-down"),
  bushRegrowUp: document.getElementById("bush-regrow-up"),
  waterCountDisplay: document.getElementById("water-count-display"),
  waterCountDown: document.getElementById("water-count-down"),
  waterCountUp: document.getElementById("water-count-up"),
};

let mapConfig = {
  bushCount: CONSTANTS.MAP.BUSH_COUNT_DEFAULT,
  maxFoodPerBush: CONSTANTS.MAP.MAX_FOOD_PER_BUSH_DEFAULT,
  bushRegrow: CONSTANTS.MAP.BUSH_REGROW_DEFAULT,
  waterCount: CONSTANTS.MAP.WATER_COUNT_DEFAULT,
};

init();

async function init() {
  registerAtlases();
  setupUi();
  setupInput();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  try {
    [bgImage] = await Promise.all([
      SpriteAtlas.loadImage("sprites/bg.png"),
      sprites.loadAll(),
    ]);
  } catch (error) {
    if (DEBUG) console.warn(error);
  }

  requestAnimationFrame(loop);
}

function registerAtlases() {
  const peeps = "sprites/peeps";
  const misc = "sprites/misc";
  sprites.add("body", `${peeps}/body.json`, `${peeps}/body.png`);
  sprites.add("body_red", `${peeps}/body_red.json`, `${peeps}/body_red.png`);
  sprites.add("face", `${peeps}/face.json`, `${peeps}/face.png`);
  sprites.add("cursor", `${misc}/cursor.json`, `${misc}/cursor.png`);
}

function setupUi() {
  els.countDown.addEventListener("click", () => setCreatureCount(creatureCount - 1));
  els.countUp.addEventListener("click", () => setCreatureCount(creatureCount + 1));
  els.startBtn.addEventListener("click", startGame);

  els.speedBtn.addEventListener("click", () => {
    speedIndex = (speedIndex + 1) % SPEED_LEVELS.length;
    const speed = SPEED_LEVELS[speedIndex];
    els.speedBtn.textContent = `⏵ ${speed}x`;
  });

  // Map controls
  const mapSpinners = [
    { down: els.bushCountDown, up: els.bushCountUp, display: els.bushCountDisplay, key: 'bushCount', min: CONSTANTS.BUSH.MIN_COUNT, max: CONSTANTS.BUSH.MAX_COUNT },
    { down: els.bushFoodDown, up: els.bushFoodUp, display: els.bushFoodDisplay, key: 'maxFoodPerBush', min: CONSTANTS.BUSH.MIN_MAX_FOOD, max: CONSTANTS.BUSH.MAX_MAX_FOOD },
    { down: els.bushRegrowDown, up: els.bushRegrowUp, display: els.bushRegrowDisplay, key: 'bushRegrow', min: CONSTANTS.BUSH.MIN_REGROW, max: CONSTANTS.BUSH.MAX_REGROW },
    { down: els.waterCountDown, up: els.waterCountUp, display: els.waterCountDisplay, key: 'waterCount', min: 3, max: 30 },
  ];

  for (const s of mapSpinners) {
    s.down.addEventListener("click", () => {
      mapConfig[s.key] = Math.max(s.min, mapConfig[s.key] - 1);
      s.display.textContent = mapConfig[s.key];
    });
    s.up.addEventListener("click", () => {
      mapConfig[s.key] = Math.min(s.max, mapConfig[s.key] + 1);
      s.display.textContent = mapConfig[s.key];
    });
  }

  setCreatureCount(creatureCount);

  // Research panel toggle
  const researchBtn = document.getElementById("research-btn");
  const researchOverlay = document.getElementById("research-overlay");
  const researchClose = document.getElementById("research-close");
  if (researchBtn && researchOverlay && researchClose) {
    researchBtn.addEventListener("click", () => {
      researchOverlay.style.display = "flex";
      els.setupOverlay.style.display = "none";
    });
    researchClose.addEventListener("click", () => {
      researchOverlay.style.display = "none";
      els.setupOverlay.style.display = "flex";
    });
  }
}

function setCreatureCount(count, existingData = null) {
  creatureCount = Math.max(CONSTANTS.CREATURE.COUNT_MIN, Math.min(CONSTANTS.CREATURE.COUNT_MAX, count));
  els.countDisplay.textContent = creatureCount;
  els.creatureList.innerHTML = "";

  const genomeKeys = Object.keys(GENOME_REGISTRY);

  for (let i = 0; i < creatureCount; i += 1) {
    const rowData = existingData && existingData[i] ? existingData[i] : {};
    const row = document.createElement("div");
    row.className = "creature-row";

    let genomeHtml = '';
    for (const key of genomeKeys) {
      if (GENOME_REGISTRY[key].category !== "physical") continue;
      const range = GENOME_REGISTRY[key];
      const val = rowData[key] != null ? rowData[key] : (range.min + Math.random() * (range.max - range.min));
      const pct = ((val - range.min) / (range.max - range.min)) * 100;
      genomeHtml += `<div class="genome-slider-row">
        <span class="genome-label">${key}</span>
        <input type="range" class="genome-slider" data-key="${key}" min="0" max="100" value="${pct}">
        <span class="genome-val">${val.toFixed(2)}</span>
      </div>`;
    }

    const diet = rowData.diet || "herbivore";

    row.innerHTML = `
      <div class="creature-header">
        <span class="creature-num">${i + 1}</span>
        <input class="creature-name" type="text" maxlength="${CONSTANTS.CREATURE.NAME_MAX_LENGTH}" value="${escapeAttr(rowData.name || `Creature ${i + 1}`)}">
        <select class="diet-select">
          <option value="herbivore" ${diet === "herbivore" ? "selected" : ""}>Herbivore</option>
          <option value="carnivore" ${diet === "carnivore" ? "selected" : ""}>Carnivore</option>
          <option value="omnivore" ${diet === "omnivore" ? "selected" : ""}>Omnivore</option>
        </select>
        <button class="toggle-genome-btn">🧬</button>
      </div>
      <div class="genome-panel" style="display:none">
        ${genomeHtml}
      </div>
    `;

    const toggleBtn = row.querySelector(".toggle-genome-btn");
    const panel = row.querySelector(".genome-panel");
    toggleBtn.onclick = () => {
      const showing = panel.style.display !== "none";
      panel.style.display = showing ? "none" : "block";
      toggleBtn.style.opacity = showing ? "0.5" : "1";
    };

    // Hook sliders to update displayed value
    for (const slider of row.querySelectorAll(".genome-slider")) {
      slider.addEventListener("input", () => {
        const pct = Number(slider.value) / 100;
        const key = slider.dataset.key;
        const range = GENOME_REGISTRY[key];
        const val = range.min + pct * (range.max - range.min);
        slider.parentElement.querySelector(".genome-val").textContent = val.toFixed(2);
      });
    }

    els.creatureList.appendChild(row);
  }
}

function startGame() {
  const rows = [...els.creatureList.querySelectorAll(".creature-row")];
  const configs = rows.map((row, index) => {
    const name = row.querySelector(".creature-name").value.trim() || `Creature ${index + 1}`;
    const diet = row.querySelector(".diet-select").value;

    const genome = {};
    for (const slider of row.querySelectorAll(".genome-slider")) {
      const pct = Number(slider.value) / 100;
      const key = slider.dataset.key;
      const range = GENOME_REGISTRY[key];
      genome[key] = range.min + pct * (range.max - range.min);
    }

    return { name, id: index, genome, diet };
  });

  state.creatures = [];
  state.bushes = [];
  state.water = [];
  state.births = [];
  state.deaths = [];
  state.generation = 1;
  state.avgTraits = {};
  state.traitHistory = [];

  nextCreatureId = 0;
  gameStartTime = performance.now();

  configs.forEach((config, index) => {
    const angle = (index / configs.length) * Math.PI * 2;
    const radius = GAME_CONSTANTS.spawnRadius;
    const creature = new Creature(config, WORLD.center.x + Math.cos(angle) * radius, WORLD.center.y + Math.sin(angle) * radius);
    creature.mugshot = creature.renderMugshot(sprites);
    state.creatures.push(creature);
  });

  spawnBushes();
  spawnWater();
  spawnHounds();
  updateSidebar();

  els.setupOverlay.style.display = "none";
  gameState = "playing";
  camera.x = WORLD.center.x;
  camera.y = WORLD.center.y;
  camera.zoom = CONSTANTS.CAMERA.DEFAULT_ZOOM;
}

function spawnBushes() {
  state.bushes = [];
  for (let i = 0; i < mapConfig.bushCount; i++) {
    state.bushes.push({
      x: WORLD.center.x + (Math.random() - 0.5) * WORLD.width * 0.8,
      y: WORLD.center.y + (Math.random() - 0.5) * WORLD.height * 0.8,
      food: mapConfig.maxFoodPerBush,
      maxFood: mapConfig.maxFoodPerBush,
      regrowTimer: 0,
    });
  }
}

function updateBushes(dt) {
  for (const bush of state.bushes) {
    if (bush.food >= bush.maxFood) continue;
    bush.regrowTimer -= dt;
    if (bush.regrowTimer <= 0) {
      bush.food = Math.min(bush.maxFood, bush.food + 1);
      bush.regrowTimer = mapConfig.bushRegrow;
    }
  }
}

function spawnWater() {
  state.water = [];
  for (let i = 0; i < mapConfig.waterCount; i++) {
    state.water.push({
      x: WORLD.center.x + (Math.random() - 0.5) * WORLD.width * 0.8,
      y: WORLD.center.y + (Math.random() - 0.5) * WORLD.height * 0.8,
    });
  }
}

function spawnHounds() {
  state.hounds = [];
  const count = CONSTANTS.HOUND.START_COUNT;
  for (let i = 0; i < count; i++) {
    const x = WORLD.center.x + (Math.random() - 0.5) * WORLD.width * 0.6;
    const y = WORLD.center.y + (Math.random() - 0.5) * WORLD.height * 0.6;
    const hound = new Hound({ generation: 1 }, x, y);
    state.hounds.push(hound);
  }
}

function setupInput() {
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2) {
      camera.panning = true;
      camera.panMoved = false;
      camera.focusTimer = 0;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      camera.panStartX = event.clientX;
      camera.panStartY = event.clientY;
    } else if (event.button === 0 && gameState === "playing") {
      const pos = screenToWorld(event.offsetX, event.offsetY);
      const clicked = state.creatures.find(c => c.alive && Math.hypot(c.x - pos.x, c.y - pos.y) < 30);
      if (clicked) {
        trackCreature(clicked);
      }
    }
  });

  const pauseBtn = document.getElementById("pause-btn");
  const pauseOverlay = document.getElementById("pause-overlay");
  function togglePause() {
    if (gameState !== "playing") return;
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? "▶" : "⏸";
    pauseOverlay.style.display = isPaused ? "flex" : "none";
  }
  pauseBtn.addEventListener("click", togglePause);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      togglePause();
    }
  });

  window.addEventListener("mouseup", () => {
    camera.panning = false;
    camera.panMoved = false;
  });
  window.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    if (camera.panning) {
      const dx = event.clientX - camera.lastX;
      const dy = event.clientY - camera.lastY;
      const totalDx = event.clientX - camera.panStartX;
      const totalDy = event.clientY - camera.panStartY;
      if (!camera.panMoved && Math.hypot(totalDx, totalDy) > 2) {
        camera.panMoved = true;
        camera.tracking = false;
        camera.trackedCreature = null;
      }
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      clampCamera();
      return;
    }
    if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
      const pos = screenToWorld(sx, sy);
      hoverCreature = state.creatures.find(c => c.alive && Math.hypot(c.x - pos.x, c.y - pos.y) < 30) || null;
    }
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const before = screenToWorld(event.offsetX, event.offsetY);
    camera.zoom = Math.max(CONSTANTS.CAMERA.ZOOM_MIN, Math.min(CONSTANTS.CAMERA.ZOOM_MAX, camera.zoom * (event.deltaY < 0 ? CONSTANTS.CAMERA.ZOOM_STEP : 1 / CONSTANTS.CAMERA.ZOOM_STEP)));
    const after = screenToWorld(event.offsetX, event.offsetY);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
  }, { passive: false });
}

function trackCreature(creature) {
  if (!creature?.alive) return;
  camera.trackedCreature = creature;
  camera.tracking = true;
  camera.focusTimer = 2;
}

function loop(now) {
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const dt = rawDt * SPEED_LEVELS[speedIndex];

  if (gameState === "playing" && !isPaused) {
    update(dt, rawDt);
  }
  if (gameState !== "research") render();
  requestAnimationFrame(loop);
}

function update(dt, rawDt) {
  const world = createWorldContext();
  const alive = state.creatures.filter(c => c.alive);

  // Update creatures
  for (const creature of alive) {
    creature.update(dt, world);
  }

  // Update hounds
  for (const hound of state.hounds) {
    if (hound.alive) hound.update(dt, world);
  }
  // Remove dead hounds
  for (let i = state.hounds.length - 1; i >= 0; i--) {
    if (!state.hounds[i].alive) state.hounds.splice(i, 1);
  }

  // Remove dead and log deaths
  const justDied = state.creatures.filter(c => !c.alive && !c._loggedDeath);
  for (const c of justDied) {
    c._loggedDeath = true;
    state.deaths.push({ name: c.name, generation: c.generation, age: c.age, genome: { ...c.genome } });
  }

  // Resolve collisions
  resolveCollisions(alive, world);

  // Bush regrowth
  updateBushes(rawDt);

  // Update generation tracking
  let maxGen = 0;
  for (const c of state.creatures) {
    if (c.alive && c.generation > maxGen) maxGen = c.generation;
  }
  state.generation = maxGen;

  // Calculate average traits
  const aliveCreatures = state.creatures.filter(c => c.alive);
  if (aliveCreatures.length > 0) {
    const avg = {};
    for (const key of Object.keys(GENOME_REGISTRY)) {
      let sum = 0;
      for (const c of aliveCreatures) sum += c.genome[key];
      avg[key] = sum / aliveCreatures.length;
    }
    state.avgTraits = avg;
  }

  // Track trait history (skip in research mode — research.js collects its own snapshots)
  if (gameState !== "research" && state.creatures.filter(c => c.alive).length > 0) {
    state.traitHistory.push({
      generation: state.generation,
      avgTraits: { ...state.avgTraits },
      population: state.creatures.filter(c => c.alive).length,
      time: (performance.now() - gameStartTime) / 1000,
    });
    if (state.traitHistory.length > CONSTANTS.EVOLUTION.TRAIT_HISTORY_MAX) {
      state.traitHistory.shift();
    }
  }

  if (gameState !== "research") {
    updateCamera(dt);
    clampCamera();
    updateSidebar();
  }
}

function createWorldContext() {
  return {
    ...WORLD,
    creatures: state.creatures,
    bushes: state.bushes,
    water: state.water,
    hounds: state.hounds,
    spawnCreature: (config, x, y) => {
      const creature = new Creature(config, x, y);
      creature.mugshot = creature.renderMugshot(sprites);
      state.creatures.push(creature);
    },
    spawnHound: (config, x, y) => {
      const hound = new Hound(config, x, y);
      state.hounds.push(hound);
    },
    logBirth: (parentA, parentB) => {
      state.births.push({
        parentA: parentA.name,
        parentB: parentB.name,
        generation: parentA.generation + 1,
        time: performance.now(),
      });
    },
    logSpeciation: (event) => {
      state.speciationEvents.push(event);
      if (state.speciationEvents.length > 20) state.speciationEvents.shift();
    },
  };
}

function resolveCollisions(creatures) {
  const n = creatures.length;
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const a = creatures[i];
    if (!a.alive) continue;
    let px = 0, py = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = creatures[j];
      if (!b.alive) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1600 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const strength = (1 - d / 40) * 1.2;
      px += (dx / d) * strength;
      py += (dy / d) * strength;
    }
    if (px !== 0 || py !== 0) {
      a.vx += px;
      a.vy += py;
    }
  }
}

function updateCamera(dt) {
  if (camera.panning) return;

  if (camera.tracking && camera.trackedCreature) {
    if (camera.trackedCreature.alive) {
      camera.focusX = camera.trackedCreature.x;
      camera.focusY = camera.trackedCreature.y;
      camera.focusTimer = 1;
    } else {
      camera.tracking = false;
      camera.trackedCreature = null;
    }
  }

  if (camera.focusTimer <= 0) return;
  camera.focusTimer = Math.max(0, camera.focusTimer - dt);
  const ease = 1 - Math.pow(CONSTANTS.CAMERA.FOCUS_EASE_POW, dt);
  camera.x += (camera.focusX - camera.x) * ease;
  camera.y += (camera.focusY - camera.y) * ease;
}

function updateSidebar() {
  const alive = state.creatures.filter(c => c.alive);
  els.popCount.textContent = alive.length;
  els.genCount.textContent = state.generation;

  const fingerprint = state.creatures.map(c => `${c.id}:${c.alive ? 1 : 0}`).join(',');
  if (fingerprint === updateSidebar._lastFingerprint) return;
  updateSidebar._lastFingerprint = fingerprint;

  els.creatureEntries.innerHTML = "";
  for (const creature of state.creatures) {
    const entry = document.createElement("div");
    entry.className = "sidebar-entry";
    if (camera.trackedCreature === creature) entry.classList.add("selected");
    entry.onclick = () => { if (creature.alive) trackCreature(creature); };

    let traitsHtml = '';
    if (creature.alive && creature.customTraits && creature.customTraits.length > 0) {
      traitsHtml = creature.customTraits.map(k => {
        const d = CONSTANTS.CUSTOM_TRAIT_LIBRARY[k];
        return d ? d.icon : '';
      }).join('');
      traitsHtml = `<div style="font-size:11px;padding:2px 0">${traitsHtml}</div>`;
    }
    entry.innerHTML = `
      <div class="sidebar-mugshot-container">
        <img src="${creature.mugshot}" class="sidebar-mugshot">
        ${!creature.alive ? '<div class="dead-overlay">X</div>' : ''}
      </div>
      <div style="flex:1;min-width:0">
        <span style="color: ${creature.alive ? '#fff' : '#666'}">${escapeHtml(creature.name)}</span>
        ${traitsHtml}
      </div>
    `;
    els.creatureEntries.appendChild(entry);
  }

  // Update gen stats display
  if (els.genStats) {
    const keys = Object.keys(GENOME_REGISTRY);
    const avg = state.avgTraits;
    const aliveCreatures = state.creatures.filter(c => c.alive);

    // Species stats
    const speciesMap = {};
    for (const c of aliveCreatures) {
      if (!speciesMap[c.speciesId]) speciesMap[c.speciesId] = { name: c.speciesName, count: 0 };
      speciesMap[c.speciesId].count++;
    }
    const speciesEntries = Object.entries(speciesMap).sort((a, b) => b[1].count - a[1].count);

    let html = `<div style="font-size:10px;color:#888;padding:4px 8px;border-bottom:1px solid #222;display:flex;justify-content:space-between">
      <span>SPECIES (${speciesEntries.length})</span>
      <span>${aliveCreatures.length} alive</span>
    </div>`;
    for (const [id, sp] of speciesEntries.slice(0, 5)) {
      const hue = (Number(id) * CONSTANTS.SPECIATION.COLOR_HUE_STEP) % 360;
      html += `<div style="font-size:9px;padding:1px 8px;display:flex;justify-content:space-between">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(${hue},35%,30%);margin-right:4px"></span>${escapeHtml(sp.name)}</span>
        <span style="color:#fff">${sp.count}</span>
      </div>`;
    }
    html += `<div style="font-size:10px;color:#888;padding:4px 8px;border-bottom:1px solid #222">AVERAGE TRAITS</div>`;
    let lastCat = "";
    for (const key of keys) {
      const val = avg[key];
      if (val !== undefined) {
        const cat = GENOME_REGISTRY[key].category;
        if (cat !== lastCat) {
          html += `<div style="font-size:9px;color:#666;padding:2px 8px;text-transform:uppercase">${cat}</div>`;
          lastCat = cat;
        }
        const pct = ((val - GENOME_REGISTRY[key].min) / (GENOME_REGISTRY[key].max - GENOME_REGISTRY[key].min)) * 100;
        html += `<div style="font-size:10px;padding:2px 8px;display:flex;justify-content:space-between">
          <span style="color:#aaa">${key}</span>
          <span style="color:#fff">${val.toFixed(2)}</span>
        </div>`;
        html += `<div style="margin:0 8px 2px;height:3px;background:#222;border-radius:2px">
          <div style="height:100%;width:${pct}%;background:#4a9;border-radius:2px"></div>
        </div>`;
      }
    }
    els.genStats.innerHTML = html;
  }
}

// === RENDER ===
function render() {
  ctx.clearRect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  ctx.save();
  applyCameraTransform();
  renderBackground();
  renderWater();
  renderBushes();
  renderHounds();

  const spriteCache = {
    body: sprites.get("body"),
    red: sprites.get("body_red"),
    face: sprites.get("face"),
  };

  const drawables = [
    ...state.creatures.filter(c => c.alive).map(c => ({ y: c.y, render: () => c.render(ctx, sprites, spriteCache) })),
  ];
  drawables.sort((a, b) => a.y - b.y).forEach(d => d.render());
  ctx.restore();

  renderHoverLabel();
}

function applyCameraTransform() {
  ctx.translate(CONSTANTS.CANVAS.HALF_WIDTH, CONSTANTS.CANVAS.HALF_HEIGHT);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

function renderBackground() {
  const canvasW = GAME_CONSTANTS.universeDimensions.width;
  const canvasH = GAME_CONSTANTS.universeDimensions.height;
  const canvasX = WORLD.center.x - canvasW / 2;
  const canvasY = WORLD.center.y - canvasH / 2;

  ctx.fillStyle = CONSTANTS.BACKGROUND.FILL_COLOR;
  ctx.fillRect(canvasX, canvasY, canvasW, canvasH);

  ctx.strokeStyle = CONSTANTS.BACKGROUND.GRID_COLOR;
  ctx.lineWidth = CONSTANTS.BACKGROUND.GRID_LINE_WIDTH;
  const gridSpacing = CONSTANTS.CANVAS.GRID_SPACING;
  const startGX = Math.ceil(canvasX / gridSpacing) * gridSpacing;
  const startGY = Math.ceil(canvasY / gridSpacing) * gridSpacing;
  for (let gx = startGX; gx <= canvasX + canvasW; gx += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(gx, canvasY);
    ctx.lineTo(gx, canvasY + canvasH);
    ctx.stroke();
  }
  for (let gy = startGY; gy <= canvasY + canvasH; gy += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(canvasX, gy);
    ctx.lineTo(canvasX + canvasW, gy);
    ctx.stroke();
  }

  if (!bgImage) return;
  const tileW = bgImage.width;
  const tileH = bgImage.height;
  const startX = WORLD.center.x - tileW * 1.5;
  const startY = WORLD.center.y - tileH * 1.5;
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      ctx.drawImage(bgImage, startX + x * tileW, startY + y * tileH);
    }
  }
}

function renderBushes() {
  for (const bush of state.bushes) {
    ctx.save();
    const pulse = 0.8 + Math.sin(performance.now() / 600 + bush.x) * 0.15;
    const foodRatio = bush.food / bush.maxFood;

    // Bush body
    ctx.fillStyle = `rgba(40, 100, 40, ${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(bush.x, bush.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(60, 140, 60, ${pulse * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bush.x, bush.y, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Berry dots proportional to food available
    if (foodRatio > 0) {
      const berryCount = Math.max(1, Math.floor(4 * foodRatio));
      const berryAngle = performance.now() / 1000 + bush.x;
      for (let i = 0; i < berryCount; i++) {
        const a = (i / berryCount) * Math.PI * 2 + berryAngle;
        const r = 5 + Math.sin(performance.now() / 400 + i) * 2;
        ctx.fillStyle = foodRatio > 0.5 ? "#e04040" : "#c07030";
        ctx.beginPath();
        ctx.arc(bush.x + Math.cos(a) * r, bush.y + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function renderWater() {
  for (const w of state.water) {
    ctx.save();
    const pulse = 0.7 + Math.sin(performance.now() / 800 + w.x * 0.1) * 0.3;
    ctx.fillStyle = `rgba(60, 150, 220, ${pulse * 0.15})`;
    ctx.beginPath();
    ctx.arc(w.x, w.y, CONSTANTS.WATER.RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(60, 150, 220, ${pulse * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w.x, w.y, CONSTANTS.WATER.RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(120, 200, 255, ${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderHounds() {
  for (const h of state.hounds) {
    if (h.alive) h.render(ctx);
  }
}

function renderHoverLabel() {
  if (!hoverCreature) return;
  const pos = worldToScreen(hoverCreature.x, hoverCreature.y - 50);

  const genome = hoverCreature.genome;
  const lines = [
    `${hoverCreature.name}`,
    `Gen ${hoverCreature.generation} | Age ${Math.floor(hoverCreature.age)}`,
    `${hoverCreature.speciesName || "Unknown Species"}`,
    `HP ${Math.floor(hoverCreature.health)}/${hoverCreature.maxHealth}  H ${Math.floor(hoverCreature.hunger)}/${hoverCreature.maxHunger}  T ${Math.floor(hoverCreature.thirst)}/${hoverCreature.maxThirst}`,
  ];

  const w = CONSTANTS.UI.TOOLTIP_WIDTH;
  const h = CONSTANTS.UI.TOOLTIP_HEIGHT;
  ctx.save();
  ctx.fillStyle = "rgba(10, 10, 14, 0.82)";
  roundRect(ctx, pos.x - w / 2, pos.y - h, w, h, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = CONSTANTS.UI.TOOLTIP_FONT_NAME;
  ctx.textAlign = "center";
  ctx.fillText(lines[0], pos.x, pos.y - 80);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = CONSTANTS.UI.TOOLTIP_FONT_STATS;
  ctx.fillText(lines[1], pos.x, pos.y - 64);

  ctx.fillStyle = "rgba(180,180,100,0.8)";
  ctx.fillText(lines[2], pos.x, pos.y - 50);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(lines[3], pos.x, pos.y - 36);

  let yOff = -20;
  // Physical genome bars (full bars)
  for (const [key, val] of Object.entries(genome)) {
    const range = GENOME_REGISTRY[key];
    if (range.category !== "physical") continue;
    const pct = ((val - range.min) / (range.max - range.min)) * 100;
    ctx.textAlign = "left";
    ctx.fillStyle = "#888";
    ctx.fillText(key, pos.x - 75, pos.y + yOff);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.fillText(val.toFixed(2), pos.x + 75, pos.y + yOff);
    ctx.fillStyle = "#333";
    ctx.fillRect(pos.x - 70, pos.y + yOff + 2, 140, 3);
    ctx.fillStyle = "#4a9";
    ctx.fillRect(pos.x - 70, pos.y + yOff + 2, 140 * (pct / 100), 3);
    yOff += 16;
  }

  // Personality genome (compact line)
  yOff += 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#665";
  ctx.font = "9px monospace";
  let persLine = "PER: ";
  for (const [key, val] of Object.entries(genome)) {
    const range = GENOME_REGISTRY[key];
    if (range.category !== "personality") continue;
    const pct = ((val - range.min) / (range.max - range.min)) * 100;
    const barLen = Math.round(pct / 100 * 6);
    persLine += `${key.slice(0, 3)}${'▊'.repeat(barLen)}${'·'.repeat(6 - barLen)} `;
  }
  ctx.fillText(persLine, pos.x - 75, pos.y + yOff);

  // Custom traits display
  if (hoverCreature.customTraits && hoverCreature.customTraits.length > 0) {
    yOff += 4;
    for (const key of hoverCreature.customTraits) {
      const traitDef = CONSTANTS.CUSTOM_TRAIT_LIBRARY[key];
      if (!traitDef) continue;
      ctx.textAlign = "left";
      ctx.fillStyle = "#c9a";
      ctx.font = "11px monospace";
      ctx.fillText(`${traitDef.icon} ${traitDef.name}`, pos.x - 75, pos.y + yOff);
      yOff += 14;
    }
  }

  // Drives display
  if (hoverCreature.drives) {
    yOff += 4;
    ctx.textAlign = "left";
    ctx.fillStyle = "#888";
    ctx.font = "9px monospace";
    const dirverKeys = Object.keys(hoverCreature.drives);
    let driveLine = "";
    for (const key of dirverKeys) {
      const v = hoverCreature.drives[key] || 0;
      const barLen = Math.round(v * 8);
      driveLine += `${key[0].toUpperCase()}${'█'.repeat(barLen)}${'░'.repeat(8 - barLen)} `;
    }
    ctx.fillText(driveLine, pos.x - 75, pos.y + yOff);
    yOff += 12;
  }

  // Vocabulary display
  if (hoverCreature.vocabSize > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#666";
    ctx.font = "9px monospace";
    ctx.fillText(`vocab: ${hoverCreature.vocabSize} sig: ${hoverCreature.episodicMemorySize || 0}`, pos.x - 75, pos.y + yOff);
    yOff += 12;
    if (hoverCreature.topVocab && hoverCreature.topVocab.length > 0) {
      for (const v of hoverCreature.topVocab) {
        ctx.fillStyle = "#776";
        ctx.fillText(`[${v.tokens.join(",")}] → ${Math.round(v.confidence * 100)}%`, pos.x - 75, pos.y + yOff);
        yOff += 10;
      }
    }
  }

  ctx.strokeStyle = hoverCreature.health > 3 ? "#62d46b" : "#e55248";
  ctx.lineWidth = 1;
  const barW = 60;
  ctx.strokeRect(pos.x - barW / 2, pos.y + 10, barW, 4);
  ctx.fillStyle = hoverCreature.health > 3 ? "#62d46b" : "#e55248";
  ctx.fillRect(pos.x - barW / 2, pos.y + 10, barW * (hoverCreature.health / hoverCreature.maxHealth), 4);

  ctx.restore();
}

function resizeCanvas() {
  const panelWidth = window.innerWidth < CONSTANTS.UI.PANEL_BREAKPOINT ? 0 : CONSTANTS.UI.SIDEBAR_WIDTH;
  const maxWidth = Math.max(CONSTANTS.UI.MIN_WIDTH, window.innerWidth - panelWidth - CONSTANTS.UI.MARGIN);
  const maxHeight = Math.max(CONSTANTS.UI.MIN_HEIGHT, window.innerHeight - CONSTANTS.UI.MARGIN);
  const scale = Math.min(maxWidth / CONSTANTS.CANVAS.LOGICAL_WIDTH, maxHeight / CONSTANTS.CANVAS.LOGICAL_HEIGHT);

  const displayWidth = Math.floor(CONSTANTS.CANVAS.LOGICAL_WIDTH * scale);
  const displayHeight = Math.floor(CONSTANTS.CANVAS.LOGICAL_HEIGHT * scale);

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(displayWidth * dpr));
  canvas.height = Math.max(1, Math.floor(displayHeight * dpr));

  const renderScaleX = canvas.width / CONSTANTS.CANVAS.LOGICAL_WIDTH;
  const renderScaleY = canvas.height / CONSTANTS.CANVAS.LOGICAL_HEIGHT;
  ctx.setTransform(renderScaleX, 0, 0, renderScaleY, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

function screenToWorld(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  const x = sx * (CONSTANTS.CANVAS.LOGICAL_WIDTH / rect.width);
  const y = sy * (CONSTANTS.CANVAS.LOGICAL_HEIGHT / rect.height);
  return {
    x: camera.x + (x - CONSTANTS.CANVAS.HALF_WIDTH) / camera.zoom,
    y: camera.y + (y - CONSTANTS.CANVAS.HALF_HEIGHT) / camera.zoom,
  };
}

function worldToScreen(x, y) {
  return {
    x: (x - camera.x) * camera.zoom + CONSTANTS.CANVAS.HALF_WIDTH,
    y: (y - camera.y) * camera.zoom + CONSTANTS.CANVAS.HALF_HEIGHT,
  };
}

function clampCamera() {
  const universeW = GAME_CONSTANTS.universeDimensions.width;
  const universeH = GAME_CONSTANTS.universeDimensions.height;
  const halfW = CONSTANTS.CANVAS.HALF_WIDTH / camera.zoom;
  const halfH = CONSTANTS.CANVAS.HALF_HEIGHT / camera.zoom;
  const minX = WORLD.center.x - universeW / 2 + halfW;
  const maxX = WORLD.center.x + universeW / 2 - halfW;
  const minY = WORLD.center.y - universeH / 2 + halfH;
  const maxY = WORLD.center.y + universeH / 2 - halfH;

  if (halfW * 2 >= universeW) camera.x = WORLD.center.x;
  else camera.x = Math.max(minX, Math.min(maxX, camera.x));

  if (halfH * 2 >= universeH) camera.y = WORLD.center.y;
  else camera.y = Math.max(minY, Math.min(maxY, camera.y));
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
