const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const WORLD = { width: 3000, height: 1800, center: { x: 1500, y: 900 } };
const sprites = new SpriteLayers();
let bgImage = null;
let tributeCount = 12;
let gameState = "setup";
let lastTime = performance.now();
let gameStartTime = 0;
let finalAlliancePressure = false;
let allianceLogged = false;
let hoverPeep = null;
let nextAllianceId = 1;

// === REPLAY PLAYER ===
function updateReplay(dt) {
  const highlight = state.highlights[state.currentHighlightIdx];
  if (!highlight || !highlight.clip) return;

  const canvas = els.recapReplayCanvas;
  const ctx = canvas.getContext("2d");
  const clip = highlight.clip;
  if (!clip || !clip.frames || clip.frames.length === 0) return;

  const frameCount = clip.frames.length;
  state.replayTimer = (state.replayTimer || 0) + dt;
  const duration = 2.0;
  const progress = (state.replayTimer % duration) / duration;
  const frameIdx = Math.floor(progress * frameCount);
  const snapshot = clip.frames[frameIdx];

  if (!snapshot) return;

  ctx.fillStyle = "#0a0a0e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(0.8, 0.8);
  ctx.translate(-clip.x, -clip.y);

  // Background Image
  if (bgImage) {
    const tileW = bgImage.width;
    const tileH = bgImage.height;
    const startX = WORLD.center.x - tileW * 1.5;
    const startY = WORLD.center.y - tileH * 1.5;
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        ctx.drawImage(bgImage, startX + x * tileW, startY + y * tileH);
      }
    }
  } else {
    // Fallback Grid
    ctx.strokeStyle = "#1a1a24";
    ctx.lineWidth = 2;
    for (let x = clip.x - 400; x < clip.x + 400; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, clip.y - 300); ctx.lineTo(x, clip.y + 300); ctx.stroke();
    }
    for (let y = clip.y - 300; y < clip.y + 300; y += 100) {
      ctx.beginPath(); ctx.moveTo(clip.x - 400, y); ctx.lineTo(clip.x + 400, y); ctx.stroke();
    }
  }

  // Render Splats
  if (snapshot.effects) {
    snapshot.effects.filter(e => e.type === "splat").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      sprites.get("blood")?.draw(ctx, `blood${e.frame}`, e.x, e.y, {
        scale: e.scale,
        rotation: e.rotation,
        alpha,
      });
    });
  }

  // Render Ground Weapons
  if (snapshot.groundWeapons) {
    snapshot.groundWeapons.forEach(w => {
      const wAtlas = sprites.get(`weapons_${w.type}`);
      if (wAtlas) {
        wAtlas.draw(ctx, `weapon_${w.type}4`, w.x, w.y, { scale: 0.45 });
      } else {
        ctx.fillStyle = "rgba(255, 215, 0, 0.3)";
        ctx.beginPath(); ctx.arc(w.x, w.y, 10, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  // Sort drawables: Peeps, corpses, gore
  const drawables = [];
  if (snapshot.peeps) {
    snapshot.peeps.forEach(p => {
      drawables.push({ y: p.y, render: () => Peep.renderFromSnapshot(ctx, p, sprites) });
    });
  }
  if (snapshot.effects) {
    snapshot.effects.filter(e => e.type === "corpse" || e.type === "gore_particle").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      const z = e.z || 0;
      let renderFn = null;
      if (e.type === "gore_particle") {
        renderFn = () => sprites.get("gore")?.draw(ctx, `gore${e.frame}`, e.x, e.y + z, {
          scale: e.scale,
          rotation: e.rotation,
          alpha,
        });
      } else if (e.type === "corpse") {
        renderFn = () => sprites.get("gore_bodies")?.draw(ctx, `gore_bodies${e.frame}`, e.x, e.y + z, {
          scale: 0.62,
          rotation: e.rotation,
          alpha: Math.min(1, alpha * 1.4),
        });
      }
      if (renderFn) drawables.push({ y: e.y + z, render: renderFn });
    });
  }

  drawables.sort((a, b) => a.y - b.y).forEach(d => d.render());

  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#000";
  for (let i = 0; i < canvas.height; i += 4) {
    ctx.fillRect(0, i, canvas.width, 2);
  }
  ctx.restore();
}

const state = {
  peeps: [],
  groundWeapons: [],
  deathLog: [],
  allEvents: [],
  pendingEvents: [], // Events waiting for clip capture
  rollingHistory: [], // Max 180 frames (3s)
  highlights: [],
  currentHighlightIdx: 0,
  dayTimer: 60,
  currentDay: 1,
  isNight: false,
  hitEvents: [],
  effects: [],
  shockwaves: [],
  alliances: [],
  slowMo: { timer: 0, duration: 0, scale: 1 },
  processedDeaths: new Set(),
  cursor: new CursorEntity(WORLD.center.x, WORLD.center.y),
};

const camera = {
  x: WORLD.center.x,
  y: WORLD.center.y,
  zoom: 0.45,
  panning: false,
  lastX: 0,
  lastY: 0,
  focusX: WORLD.center.x,
  focusY: WORLD.center.y,
  focusTimer: 0,
};

const els = {
  setupOverlay: document.getElementById("setup-overlay"),
  tributeList: document.getElementById("tribute-list"),
  countDisplay: document.getElementById("count-display"),
  countDown: document.getElementById("count-down"),
  countUp: document.getElementById("count-up"),
  startBtn: document.getElementById("start-btn"),
  popCount: document.getElementById("pop-count"),
  totalCount: document.getElementById("total-count"),
  deathLog: document.getElementById("death-log"),
  victoryOverlay: document.getElementById("victory-overlay"),
  winnerName: document.getElementById("winner-name"),
  winnerDistrict: document.getElementById("winner-district"),
  restartBtn: document.getElementById("restart-btn"),
  // Recap elements
  viewRecapBtn: document.getElementById("view-recap-btn"),
  recapOverlay: document.getElementById("recap-overlay"),
  recapFallenView: document.getElementById("recap-fallen-view"),
  recapFallenList: document.getElementById("recap-fallen-list"),
  recapHighlightsBtn: document.getElementById("recap-highlights-btn"),
  recapCloseBtn: document.getElementById("recap-close-btn"),
  recapHighlightView: document.getElementById("recap-highlight-view"),
  recapCounter: document.getElementById("recap-counter"),
  recapTag: document.getElementById("recap-tag"),
  recapMain: document.getElementById("recap-main"),
  recapSub: document.getElementById("recap-sub"),
  recapDesc: document.getElementById("recap-desc"),
  recapPrevBtn: document.getElementById("recap-prev-btn"),
  recapNextBtn: document.getElementById("recap-next-btn"),
  recapFinishBtn: document.getElementById("recap-finish-btn"),
  recapReplayCanvas: document.getElementById("recap-replay-canvas"),
};

const weaponLabels = {
  gun: ["a spear", "trident"],
  bat: ["a club", "bat"],
  shotgun: ["a bow", "bow"],
  axe: ["an axe", "axe"],
  fists: ["their fists", "fists"],
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
    console.warn(error);
  }

  requestAnimationFrame(loop);
}

function registerAtlases() {
  const peeps = "sprites/peeps";
  const misc = "sprites/misc";
  sprites.add("body", `${peeps}/body.json`, `${peeps}/body.png`);
  sprites.add("body_red", `${peeps}/body_red.json`, `${peeps}/body_red.png`);
  sprites.add("face", `${peeps}/face.json`, `${peeps}/face.png`);
  sprites.add("face_murder", `${peeps}/face_murder.json`, `${peeps}/face_murder.png`);
  sprites.add("face_nervous", `${peeps}/face_nervous.json`, `${peeps}/face_nervous.png`);
  sprites.add("cursor", `${misc}/cursor.json`, `${misc}/cursor.png`);
  sprites.add("weapons_gun", `${peeps}/weapon_gun.json`, `${peeps}/weapon_gun.png`);
  sprites.add("weapons_bat", `${peeps}/weapon_bat.json`, `${peeps}/weapon_bat.png`);
  sprites.add("weapons_shotgun", `${peeps}/weapon_shotgun.json`, `${peeps}/weapon_shotgun.png`);
  sprites.add("weapons_axe", `${peeps}/weapon_axe.json`, `${peeps}/weapon_axe.png`);
  sprites.add("gore_bodies", `${peeps}/gore_bodies.json`, `${peeps}/gore_bodies.png`);
  sprites.add("gore", `${peeps}/gore.json`, `${peeps}/gore.png`);
  sprites.add("blood", `${peeps}/blood.json`, `${peeps}/blood.png`);
}

function setupUi() {
  els.countDown.addEventListener("click", () => setTributeCount(tributeCount - 1));
  els.countUp.addEventListener("click", () => setTributeCount(tributeCount + 1));
  els.startBtn.addEventListener("click", () => {
    const configs = readTributeConfigs();
    if (configs) startGame(configs);
  });
  els.restartBtn.addEventListener("click", () => location.reload());

  // Recap listeners
  els.viewRecapBtn.addEventListener("click", showRecap);
  els.recapCloseBtn.addEventListener("click", hideRecap);
  els.recapHighlightsBtn.addEventListener("click", showHighlightView);
  els.recapPrevBtn.addEventListener("click", prevHighlight);
  els.recapNextBtn.addEventListener("click", nextHighlight);
  els.recapFinishBtn.addEventListener("click", hideRecap);

  setTributeCount(tributeCount);
}

function setTributeCount(count) {
  tributeCount = Math.max(2, Math.min(24, count));
  els.countDisplay.textContent = tributeCount;
  const existing = [...els.tributeList.querySelectorAll(".tribute-row")].map((row) => ({
    name: row.querySelector(".tribute-name")?.value || "",
    district: row.querySelector(".tribute-district")?.value || "",
  }));

  els.tributeList.innerHTML = "";
  for (let i = 0; i < tributeCount; i += 1) {
    const row = document.createElement("div");
    row.className = "tribute-row";
    row.innerHTML = `
      <span class="tribute-num">${i + 1}</span>
      <input class="tribute-name" type="text" maxlength="24" value="${escapeAttr(existing[i]?.name || `Tribute ${i + 1}`)}">
      <span class="district-label">D</span>
      <input class="tribute-district" type="number" min="1" max="12" value="${escapeAttr(existing[i]?.district || Math.floor(i / 2) + 1)}">
    `;
    els.tributeList.appendChild(row);
  }
}

function readTributeConfigs() {
  const rows = [...els.tributeList.querySelectorAll(".tribute-row")];
  const configs = rows.map((row, index) => ({
    id: index,
    name: row.querySelector(".tribute-name").value.trim(),
    district: Number(row.querySelector(".tribute-district").value),
  }));

  const invalid = configs.find((config) => !config.name || !Number.isFinite(config.district) || config.district < 1);
  if (invalid) {
    els.startBtn.textContent = "FILL EVERY NAME AND DISTRICT";
    setTimeout(() => (els.startBtn.textContent = "START THE GAMES"), 1200);
    return null;
  }
  return configs;
}

function startGame(configs) {
  state.peeps = [];
  state.groundWeapons = [];
  state.deathLog = [];
  state.allEvents = [];
  state.rollingHistory = [];
  state.highlights = [];
  state.currentHighlightIdx = 0;
  state.dayTimer = 60;
  state.currentDay = 1;
  state.isNight = false;
  state.hitEvents = [];
  state.effects = [];
  state.shockwaves = [];
  state.alliances = [];
  state.slowMo = { timer: 0, duration: 0, scale: 1 };
  state.processedDeaths = new Set();
  state.cursor = new CursorEntity(WORLD.center.x, WORLD.center.y);
  nextAllianceId = 1;
  finalAlliancePressure = false;
  allianceLogged = false;
  hoverPeep = null;
  camera.x = WORLD.center.x;
  camera.y = WORLD.center.y;
  camera.zoom = 0.45;
  camera.focusX = WORLD.center.x;
  camera.focusY = WORLD.center.y;
  camera.focusTimer = 0;

  configs.forEach((config, index) => {
    const angle = (index / configs.length) * Math.PI * 2;
    const radius = 460;
    state.peeps.push(new Peep(config, WORLD.center.x + Math.cos(angle) * radius, WORLD.center.y + Math.sin(angle) * radius));
  });
  state.peeps.forEach((peep) => {
    peep.initializeRelationships(state.peeps);
    peep.mugshot = peep.renderMugshot(sprites);
  });
  createDistrictAlliances();

  spawnWeapons();
  els.setupOverlay.style.display = "none";
  els.totalCount.textContent = configs.length;
  els.deathLog.innerHTML = "";
  gameStartTime = performance.now();
  gameState = "playing";
}

function spawnWeapons() {
  const types = shuffle(["gun", "gun", "bat", "bat", "shotgun", "shotgun", "axe", "axe"]);
  state.groundWeapons = types.map((type, index) => {
    const angle = (index / types.length) * Math.PI * 2;
    return {
      type,
      x: WORLD.center.x + Math.cos(angle) * 80,
      y: WORLD.center.y + Math.sin(angle) * 80,
    };
  });
}

function setupInput() {
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2) {
      camera.panning = true;
      camera.focusTimer = 0;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
    } else if (event.button === 0 && gameState === "playing") {
      const pos = screenToWorld(event.offsetX, event.offsetY);
      state.shockwaves.push({ x: pos.x, y: pos.y, radius: 4, life: 0.5, maxLife: 0.5 });
    }
  });
  window.addEventListener("mouseup", () => (camera.panning = false));
  window.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    if (camera.panning) {
      camera.x -= (event.clientX - camera.lastX) / camera.zoom;
      camera.y -= (event.clientY - camera.lastY) / camera.zoom;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      clampCamera();
      return;
    }
    if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
      const pos = screenToWorld(sx, sy);
      state.cursor.mouseMoved(pos.x, pos.y);
    }
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const before = screenToWorld(event.offsetX, event.offsetY);
    camera.zoom = Math.max(0.3, Math.min(2, camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9)));
    const after = screenToWorld(event.offsetX, event.offsetY);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
  }, { passive: false });
}

function loop(now) {
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const dt = rawDt * getTimeScale();
  update(dt, rawDt);
  render();
  requestAnimationFrame(loop);
}

function update(dt, rawDt = dt) {
  updateSlowMotion(rawDt);
  if (gameState === "playing") {
    recordFrame();

    // Process pending events for capture
    const now = performance.now();
    state.pendingEvents = state.pendingEvents.filter(e => {
      if (now >= e.triggerTime) {
        e.data.clip = captureClip(e.x, e.y);
        state.allEvents.push(e.data);
        return false; // Remove from pending
      }
      return true;
    });

    // Day Timer Logic
    if (!state.isNight) {
      state.dayTimer -= rawDt;
      if (state.dayTimer <= 0) {
        state.dayTimer = 0;
        state.isNight = true;
        showRecap();
      }
    }

    state.hitEvents = [];
    const world = createWorldContext();
    state.peeps.forEach((peep) => peep.update(dt, world));
    processHitEvents();
    processDeaths();
    updateAlliance();
    state.cursor.update(dt);
    updateHover();
    checkVictory();
  } else if (gameState === "recap") {
    // Ensure entities don't move or process AI during recap
    state.cursor.update(dt);
    updateHover();
    updateReplay(rawDt);
  }
  updateEffects(dt);
  updateShockwaves(dt);
  updateSpectatorCamera(dt);
  clampCamera();
  updatePopulation();
}

function recordFrame() {
  const snapshot = {
    peeps: state.peeps.map(p => p.getSnapshot()),
    groundWeapons: state.groundWeapons.map(w => ({ ...w })),
    effects: state.effects.map(e => ({
      type: e.type,
      x: e.x,
      y: e.y,
      z: e.z,
      frame: e.frame,
      scale: e.scale,
      life: e.life,
      maxLife: e.maxLife,
      rotation: e.rotation,
    })),
    timestamp: performance.now(),
  };
  state.rollingHistory.push(snapshot);
  if (state.rollingHistory.length > 180) {
    state.rollingHistory.shift();
  }
}

function captureClip(x, y) {
  return {
    frames: JSON.parse(JSON.stringify(state.rollingHistory)),
    x,
    y
  };
}

function createWorldContext() {
  return {
    ...WORLD,
    peeps: state.peeps,
    groundWeapons: state.groundWeapons,
    hitEvents: state.hitEvents,
    cursor: state.cursor,
    areAllied,
    getAlliance,
    requestAlliance,
    breakAlliance,
    allianceVicinity: 105,
    betrayalPressure: getBetrayalPressure(),
    elapsed: (performance.now() - gameStartTime) / 1000,
    logGoal,
  };
}

function processHitEvents() {
  for (const hit of state.hitEvents) {
    addHitEffects(hit);
    focusCamera(hit.x, hit.y, hit.fatal ? 2.4 : 1.1);
    if (hit.fatal) triggerSlowMotion(0.28, 1.15);
  }
}

function triggerSlowMotion(scale = 0.28, duration = 1.15) {
  state.slowMo.scale = scale;
  state.slowMo.timer = Math.max(state.slowMo.timer, duration);
  state.slowMo.duration = Math.max(state.slowMo.duration, duration);
}

function updateSlowMotion(rawDt) {
  if (state.slowMo.timer <= 0) {
    state.slowMo.scale = 1;
    state.slowMo.duration = 0;
    return;
  }
  state.slowMo.timer = Math.max(0, state.slowMo.timer - rawDt);
  if (state.slowMo.timer <= 0) state.slowMo.scale = 1;
}

function getTimeScale() {
  return state.slowMo.timer > 0 ? state.slowMo.scale : 1;
}

function processDeaths() {
  for (const peep of state.peeps) {
    if (peep.alive || state.processedDeaths.has(peep.id)) continue;
    state.processedDeaths.add(peep.id);
    const data = peep.die();

    // Record event for recap
    state.allEvents.push({
      type: "death",
      victim: data,
      killer: data.killedBy,
      timestamp: performance.now(),
      clip: captureClip(data.x, data.y),
      mugshot: peep.mugshot
    });

    if (data.weapon) {
      state.groundWeapons.push({
        type: data.weapon,
        x: data.x + randomRange(-16, 16),
        y: data.y + randomRange(-16, 16),
      });
    }
    addDeathEffects(data);
    recordDeathMemories(peep, data);
    removeFromAlliance(peep, "death");
    addKillLog(data);
  }
}

function recordDeathMemories(victim, data) {
  const killer = data.killedBy;
  if (!killer) return;
  const victimAllianceId = victim.allianceId;
  for (const peep of alivePeeps()) {
    if (peep === killer) continue;
    if (victimAllianceId && peep.allianceId === victimAllianceId) {
      peep.remember("killed_ally", killer, 1.2, { victimId: victim.id });
    }
  }
}

function addKillLog(data) {
  const killer = data.killedBy;
  const weaponType = killer?.weapon || "fists";
  const [weaponName, weaponText] = weaponLabels[weaponType] || weaponLabels.fists;
  const killText = killer
    ? `<span class="killer">${escapeHtml(killer.name)}</span> (D${killer.district}) killed <span class="victim">${escapeHtml(data.name)}</span> (D${data.district}) with <span class="weapon">${weaponName}</span> <span class="weapon-text">${weaponText}</span>`
    : `<span class="victim">${escapeHtml(data.name)}</span> (D${data.district}) died in the arena`;
  pushLog(killText, false);
  pushLog(`${alivePeeps().length} tributes remain`, true);
}

function addDeathEffects(data) {
  const splatLife = randomRange(3, 5);
  state.effects.push({
    type: "splat",
    x: data.x,
    y: data.y,
    frame: Math.floor(Math.random() * 3),
    scale: randomRange(0.3, 0.7),
    life: splatLife,
    maxLife: splatLife,
    rotation: Math.random() * Math.PI * 2,
  });

  const goreCount = data.weapon ? 20 + Math.floor(Math.random() * 11) : 5 + Math.floor(Math.random() * 8);
  for (let i = 0; i < goreCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(1.2, data.weapon ? 5 : 2.6);
    const life = randomRange(2, 4);
    state.effects.push({
      type: "gore_particle",
      x: data.x,
      y: data.y,
      z: randomRange(-6, -22),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: randomRange(-4, -1),
      vr: randomRange(-0.16, 0.16),
      rotation: Math.random() * Math.PI * 2,
      frame: Math.floor(Math.random() * 3),
      life,
      maxLife: life,
      scale: randomRange(0.4, 0.75),
    });
  }

  const weaponIndex = ["gun", "bat", "shotgun", "axe"].indexOf(data.weapon);
  state.effects.push({
    type: "corpse",
    x: data.x,
    y: data.y,
    z: -8,
    vx: randomRange(-1.5, 1.5),
    vy: randomRange(-1.5, 1.5),
    vz: randomRange(-3.5, -1.5),
    rotation: 0,
    frame: Math.max(0, (weaponIndex + 2) * 2 + data.side) % 12,
    life: 10,
    maxLife: 10,
    onGround: false,
  });
}

function addHitEffects(hit) {
  const goreCount = hit.weapon === "fists" ? 2 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 6);
  for (let i = 0; i < goreCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(0.6, hit.weapon === "gun" ? 3.8 : 2.5);
    const life = randomRange(0.7, 1.5);
    state.effects.push({
      type: "gore_particle",
      x: hit.x + randomRange(-8, 8),
      y: hit.y + randomRange(-8, 8),
      z: randomRange(-4, -14),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: randomRange(-3, -0.8),
      vr: randomRange(-0.14, 0.14),
      rotation: Math.random() * Math.PI * 2,
      frame: Math.floor(Math.random() * 3),
      life,
      maxLife: life,
      scale: randomRange(0.28, 0.55),
    });
  }
}

function updateEffects(dt) {
  for (const effect of state.effects) {
    effect.life -= dt;
    if (effect.type === "gore_particle") {
      effect.x += effect.vx;
      effect.y += effect.vy;
      effect.z += effect.vz;
      effect.vz += 0.4;
      effect.rotation += effect.vr;
      if (effect.z > 0) {
        effect.z = 0;
        if (Math.abs(effect.vz) > 1) effect.vz *= -0.2;
      }
    } else if (effect.type === "corpse" && !effect.onGround) {
      effect.x += effect.vx;
      effect.y += effect.vy;
      effect.z += effect.vz;
      effect.vz += 0.15;
      effect.rotation += dt * 4;
      if (effect.z >= 0) {
        effect.z = 0;
        effect.vx = 0;
        effect.vy = 0;
        effect.vz = 0;
        effect.onGround = true;
      }
    }
  }
  state.effects = state.effects.filter((effect) => effect.type === "corpse" || effect.life > 0);
}

function updateSpectatorCamera(dt) {
  if (camera.panning || camera.focusTimer <= 0 || gameState !== "playing") return;
  camera.focusTimer = Math.max(0, camera.focusTimer - dt);
  const ease = 1 - Math.pow(0.04, dt);
  camera.x += (camera.focusX - camera.x) * ease;
  camera.y += (camera.focusY - camera.y) * ease;
}

function focusCamera(x, y, duration) {
  if (camera.panning) return;
  camera.focusX = x;
  camera.focusY = y;
  camera.focusTimer = Math.max(camera.focusTimer, duration);
}

function updateShockwaves(dt) {
  for (const wave of state.shockwaves) {
    wave.life -= dt;
    wave.radius += 360 * dt;
  }
  state.shockwaves = state.shockwaves.filter((wave) => wave.life > 0);
}

function updateAlliance() {
  cleanupAlliances();
  const alive = alivePeeps();
  const activeAllianceIds = new Set(alive.map((peep) => peep.allianceId).filter(Boolean));
  if (activeAllianceIds.size === 1 && alive.length > 1 && alive.every((peep) => peep.allianceId)) {
    finalAlliancePressure = true;
    if (!allianceLogged) {
      pushLog("FINAL ALLIANCE PRESSURE - loyalty is being tested.", true);
      allianceLogged = true;
    }
    const alliance = getAlliance([...activeAllianceIds][0]);
    if (alliance) alliance.strength = Math.max(0, alliance.strength - 0.08);
  }
}

function checkVictory() {
  const alive = alivePeeps();
  if (alive.length > 1) return;
  gameState = "ended";
  const winner = alive[0];
  els.winnerName.textContent = winner ? winner.name : "No one";
  els.winnerDistrict.textContent = winner ? `District ${winner.district} - ${winner.kills} kills` : "Everyone died...";
  els.victoryOverlay.style.display = "flex";
}

function updateHover() {
  hoverPeep = alivePeeps().find((peep) => Math.hypot(peep.x - state.cursor.x, peep.y - state.cursor.y) < 36) || null;
}

function updatePopulation() {
  els.popCount.textContent = alivePeeps().length;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  applyCameraTransform();
  renderBackground();
  renderWeapons();
  renderWorldEffects("splat");

  const drawables = [
    ...state.peeps.filter((peep) => peep.alive).map((peep) => ({ y: peep.y, render: () => peep.render(ctx, sprites) })),
    ...state.effects.filter((effect) => effect.type === "corpse").map((effect) => ({ y: effect.y + (effect.z || 0), render: () => renderEffect(effect) })),
    ...state.effects.filter((effect) => effect.type === "gore_particle").map((effect) => ({ y: effect.y + (effect.z || 0), render: () => renderEffect(effect) })),
    { y: state.cursor.y, render: () => state.cursor.render(ctx, sprites) },
  ];
  drawables.sort((a, b) => a.y - b.y).forEach((drawable) => drawable.render());
  renderShockwaves();
  ctx.restore();

  renderHoverLabel();
  renderNightOverlay(); // New Night Effect
  renderSlowMotionOverlay();
  renderZoomHint();
}

function renderNightOverlay() {
  const isRecap = gameState === "recap";
  const timer = state.dayTimer;
  
  // Transition starts at 5 seconds left
  let opacity = 0;
  if (isRecap) {
    opacity = 0.5;
  } else if (timer < 5) {
    opacity = (1 - (timer / 5)) * 0.5;
  }

  if (opacity <= 0) return;

  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 15, ${opacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add a subtle vignette
  const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 100, canvas.width/2, canvas.height/2, canvas.width/1.5);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,5, ${opacity * 1.5})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function applyCameraTransform() {
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

function renderBackground() {
  ctx.fillStyle = "#101015";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
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

function renderWeapons() {
  for (const weapon of state.groundWeapons) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 215, 0, 0.08)";
    ctx.beginPath();
    ctx.arc(weapon.x, weapon.y, 18, 0, Math.PI * 2);
    ctx.fill();
    const atlas = sprites.get(`weapons_${weapon.type}`);
    const drawn = atlas?.draw(ctx, `weapon_${weapon.type}4`, weapon.x, weapon.y, { scale: 0.45 });
    if (!drawn) {
      ctx.fillStyle = "#d6a91c";
      ctx.beginPath();
      ctx.arc(weapon.x, weapon.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function renderWorldEffects(type) {
  state.effects.filter((effect) => effect.type === type).forEach(renderEffect);
}

function renderEffect(effect) {
  const alpha = Math.max(0, Math.min(1, effect.life / effect.maxLife));
  const z = effect.z || 0;
  if (effect.type === "splat") {
    sprites.get("blood")?.draw(ctx, `blood${effect.frame}`, effect.x, effect.y, {
      scale: effect.scale,
      rotation: effect.rotation,
      alpha,
    });
  } else if (effect.type === "gore_particle") {
    sprites.get("gore")?.draw(ctx, `gore${effect.frame}`, effect.x, effect.y + z, {
      scale: effect.scale,
      rotation: effect.rotation,
      alpha,
    });
  } else if (effect.type === "corpse") {
    sprites.get("gore_bodies")?.draw(ctx, `gore_bodies${effect.frame}`, effect.x, effect.y + z, {
      scale: 0.62,
      rotation: effect.rotation,
      alpha: Math.min(1, alpha * 1.4),
    });
  }
}

function renderShockwaves() {
  for (const wave of state.shockwaves) {
    const alpha = wave.life / wave.maxLife;
    ctx.strokeStyle = `rgba(255, 230, 120, ${alpha})`;
    ctx.lineWidth = 3 / camera.zoom;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function renderHoverLabel() {
  if (!hoverPeep) return;
  const pos = worldToScreen(hoverPeep.x, hoverPeep.y - 64);
  const alliance = getAlliance(hoverPeep.allianceId);
  const statText = `STR ${hoverPeep.stats.strength} SPD ${hoverPeep.stats.speed} EYE ${hoverPeep.stats.eyesight}`;
  const socialText = `LOY ${hoverPeep.stats.loyalty} AGR ${hoverPeep.stats.aggression} FRD ${hoverPeep.stats.friendliness}`;
  const faceText = `face: ${hoverPeep.faceLabel}`;
  const goalText = `goal: ${hoverPeep.goalLabel()}`;
  const allianceText = alliance ? `${alliance.type.replace("_", " ")} alliance (${alliance.members.length})` : "solo";
  const w = 176;
  const h = 98;
  ctx.save();
  ctx.fillStyle = "rgba(10, 10, 14, 0.82)";
  roundRect(ctx, pos.x - w / 2, pos.y - h, w, h, 8);
  ctx.fill();
  ctx.fillStyle = "#ffd700";
  ctx.font = "10px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`District ${hoverPeep.district} - ${allianceText}`, pos.x, pos.y - 58);
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(hoverPeep.name, pos.x, pos.y - 43);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "10px Segoe UI, sans-serif";
  ctx.fillText(statText, pos.x, pos.y - 46);
  ctx.fillText(socialText, pos.x, pos.y - 34);
  ctx.fillText(goalText, pos.x, pos.y - 22);
  ctx.fillText(faceText, pos.x, pos.y - 10);
  ctx.fillStyle = hoverPeep.health > 1 ? "#62d46b" : "#e55248";
  ctx.fillRect(pos.x - 14, pos.y - 4, 28 * (hoverPeep.health / hoverPeep.maxHealth), 4);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(pos.x - 14, pos.y - 4, 28, 4);
  ctx.restore();
}

function renderSlowMotionOverlay() {
  if (state.slowMo.timer <= 0) return;
  const alpha = Math.min(0.5, state.slowMo.timer / Math.max(0.01, state.slowMo.duration));
  ctx.save();
  ctx.fillStyle = `rgba(255, 215, 90, ${0.08 * alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgba(255, 230, 140, ${0.85 * alpha})`;
  ctx.font = "700 11px Segoe UI, sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText("SLOW MOTION", 22, 28);
  ctx.restore();
}

function renderZoomHint() {
  if (gameState !== "playing" || performance.now() - gameStartTime > 5000) return;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  roundRect(ctx, 18, canvas.height - 40, 250, 24, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText("Right-drag to pan. Scroll to zoom.", 32, canvas.height - 24);
  ctx.restore();
}

function pushLog(text, isCannon) {
  state.deathLog.unshift({ text, isCannon });
  state.deathLog = state.deathLog.slice(0, 30);
  els.deathLog.innerHTML = state.deathLog
    .map((entry) => `<div class="death-entry${entry.isCannon ? " cannon" : ""}">${entry.text}</div>`)
    .join("");
}

function logGoal(peep, goal, target = null) {
  if (!peep?.alive) return;
  if (goal === "wander" || goal === "rush_center") return;
  const targetText = target?.name ? ` <span class="victim">${escapeHtml(target.name)}</span>` : "";
  const labels = {
    scavenge_weapon: "is searching for a weapon.",
    hunt: "is hunting",
    flee: "is fleeing",
    regroup: "is regrouping with",
    hide: "is hiding.",
  };
  const label = labels[goal];
  if (!label) return;
  pushLog(`<span class="killer">${escapeHtml(peep.name)}</span> ${label}${targetText}`, false);
}

function createDistrictAlliances() {
  const byDistrict = new Map();
  for (const peep of state.peeps) {
    if (!byDistrict.has(peep.district)) byDistrict.set(peep.district, []);
    byDistrict.get(peep.district).push(peep);
  }
  for (const members of byDistrict.values()) {
    if (members.length > 1) createAlliance(members, "district", 82);
  }
}

function createAlliance(members, type = "cross_district", strength = 55) {
  const uniqueMembers = [...new Set(members)].filter((peep) => peep?.alive);
  if (uniqueMembers.length < 2) return null;
  const alliance = {
    id: nextAllianceId,
    members: uniqueMembers.map((peep) => peep.id),
    type,
    strength,
    createdAt: performance.now(),
  };
  nextAllianceId += 1;
  state.alliances.push(alliance);
  uniqueMembers.forEach((peep) => (peep.allianceId = alliance.id));
  return alliance;
}

function getAlliance(id) {
  if (!id) return null;
  return state.alliances.find((alliance) => alliance.id === id) || null;
}

function areAllied(a, b) {
  return Boolean(a?.alive && b?.alive && a.allianceId && a.allianceId === b.allianceId && getAlliance(a.allianceId));
}

function requestAlliance(proposer, candidate) {
  if (!proposer?.alive || !candidate?.alive || areAllied(proposer, candidate)) return false;
  const dist = Math.hypot(candidate.x - proposer.x, candidate.y - proposer.y);
  if (dist > 105) return false;
  const proposerRel = proposer.relationshipWith(candidate);
  const candidateRel = candidate.relationshipWith(proposer);
  const proposerScore = proposer.allianceDesire(candidate, proposerRel, dist);
  const candidateScore = candidate.allianceDesire(proposer, candidateRel, dist);
  if (proposerScore < 42 || candidateScore < 42) return false;

  const alliance = mergeOrCreateAlliance(proposer, candidate);
  if (!alliance) return false;

  // Record event for recap
  state.allEvents.push({
    type: "alliance",
    proposer: { name: proposer.name, district: proposer.district },
    candidate: { name: candidate.name, district: candidate.district },
    timestamp: performance.now(),
    clip: captureClip(proposer.x, proposer.y),
  });

  proposerRel.trust = Math.min(100, proposerRel.trust + 18);
  proposerRel.bond = Math.min(100, proposerRel.bond + 12);
  candidateRel.trust = Math.min(100, candidateRel.trust + 18);
  candidateRel.bond = Math.min(100, candidateRel.bond + 12);
  pushLog(`<span class="killer">${escapeHtml(proposer.name)}</span> and <span class="victim">${escapeHtml(candidate.name)}</span> formed an alliance.`, true);
  return true;
}

function getBetrayalPressure() {
  const alive = alivePeeps().length;
  if (alive <= 2) return 38;
  if (alive <= 3) return 30;
  if (alive <= 5) return 20;
  if (alive <= 8) return 10;
  return 0;
}

function mergeOrCreateAlliance(a, b) {
  if (a.allianceId && a.allianceId === b.allianceId) return getAlliance(a.allianceId);
  removeFromAlliance(a);
  removeFromAlliance(b);
  return createAlliance([a, b], "cross_district", 58);
}

function breakAlliance(actor, target) {
  if (!actor?.allianceId || !target?.allianceId || actor.allianceId !== target.allianceId) return false;
  const alliance = getAlliance(actor.allianceId);
  if (!alliance) return false;

  // Record event for recap
  state.allEvents.push({
    type: "betrayal",
    actor: { name: actor.name, district: actor.district },
    target: { name: target.name, district: target.district },
    timestamp: performance.now(),
    clip: captureClip(actor.x, actor.y),
  });

  actor.allianceId = null;
  alliance.members = alliance.members.filter((id) => id !== actor.id);
  target.remember("betrayed_me", actor, 1.4);
  for (const peep of alivePeeps()) {
    if (peep !== actor && peep.allianceId === alliance.id) peep.remember("betrayed_me", actor, 0.7);
  }
  pushLog(`<span class="killer">${escapeHtml(actor.name)}</span> betrayed <span class="victim">${escapeHtml(target.name)}</span>.`, true);
  cleanupAlliances();
  return true;
}

function removeFromAlliance(peep) {
  if (!peep?.allianceId) return;
  const alliance = getAlliance(peep.allianceId);
  peep.allianceId = null;
  if (!alliance) return;
  alliance.members = alliance.members.filter((id) => id !== peep.id);
  cleanupAlliances();
}

function cleanupAlliances() {
  for (const alliance of state.alliances) {
    alliance.members = alliance.members.filter((id) => {
      const peep = state.peeps.find((item) => item.id === id);
      return peep?.alive && peep.allianceId === alliance.id;
    });
    if (alliance.members.length === 1) {
      const peep = state.peeps.find((item) => item.id === alliance.members[0]);
      if (peep) peep.allianceId = null;
    }
  }
  state.alliances = state.alliances.filter((alliance) => alliance.members.length >= 2);
}

function alivePeeps() {
  return state.peeps.filter((peep) => peep.alive);
}

function resizeCanvas() {
  const panelWidth = window.innerWidth < 860 ? 0 : 236;
  const maxWidth = Math.max(320, window.innerWidth - panelWidth - 32);
  const maxHeight = Math.max(240, window.innerHeight - 32);
  const scale = Math.min(maxWidth / 960, maxHeight / 540);
  canvas.style.width = `${Math.floor(960 * scale)}px`;
  canvas.style.height = `${Math.floor(540 * scale)}px`;
}

function screenToWorld(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  const x = sx * (canvas.width / rect.width);
  const y = sy * (canvas.height / rect.height);
  return {
    x: camera.x + (x - canvas.width / 2) / camera.zoom,
    y: camera.y + (y - canvas.height / 2) / camera.zoom,
  };
}

function worldToScreen(x, y) {
  return {
    x: (x - camera.x) * camera.zoom + canvas.width / 2,
    y: (y - camera.y) * camera.zoom + canvas.height / 2,
  };
}

function clampCamera() {
  // We allow the camera to move within a much larger "Universe" than the physical WORLD
  const universeW = WORLD.width * 2.5; // 7500
  const universeH = WORLD.height * 2.5; // 4500
  
  const halfW = canvas.width / 2 / camera.zoom;
  const halfH = canvas.height / 2 / camera.zoom;

  // Center the Universe around the World center
  const minX = WORLD.center.x - universeW / 2 + halfW;
  const maxX = WORLD.center.x + universeW / 2 - halfW;
  const minY = WORLD.center.y - universeH / 2 + halfH;
  const maxY = WORLD.center.y + universeH / 2 - halfH;

  if (halfW * 2 >= universeW) {
    camera.x = WORLD.center.x;
  } else {
    camera.x = Math.max(minX, Math.min(maxX, camera.x));
  }

  if (halfH * 2 >= universeH) {
    camera.y = WORLD.center.y;
  } else {
    camera.y = Math.max(minY, Math.min(maxY, camera.y));
  }
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

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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

function escapeAttr(value) {
  return escapeHtml(value);
}

// === RECAP LOGIC ===

function showRecap() {
  const isEndGame = gameState === "ended";
  gameState = "recap";
  
  els.victoryOverlay.style.display = "none";
  els.recapOverlay.style.display = "flex";
  
  // Update header text based on context
  const kicker = document.querySelector(".recap-kicker");
  if (kicker) {
    kicker.textContent = isEndGame ? "Game Complete" : `Night ${state.currentDay}`;
  }

  showFallenView();
}

function hideRecap() {
  if (state.peeps.filter(p => p.alive).length <= 1) {
    // If the game actually ended, go back to victory screen
    gameState = "ended";
    els.recapOverlay.style.display = "none";
    els.victoryOverlay.style.display = "flex";
  } else {
    // Resume simulation for next day
    gameState = "playing";
    state.isNight = false;
    state.dayTimer = 60;
    state.currentDay += 1;
    els.recapOverlay.style.display = "none";
  }
}

function showFallenView() {
  els.recapFallenView.style.display = "block";
  els.recapHighlightView.style.display = "none";
  els.recapFallenList.innerHTML = "";

  const isEndGame = gameState === "ended";

  const deaths = state.allEvents.filter((e) => {
    if (e.type !== "death") return false;
    if (isEndGame) return true; // Show all on game over
    return e.day === state.currentDay;
  });

  if (deaths.length === 0) {
    els.recapFallenList.innerHTML = "<div style='color: #666; font-style: italic; margin-top: 40px;'>No one died today...</div>";
  } else {
    deaths.forEach((event, index) => {
      const card = document.createElement("div");
      card.className = "recap-fallen-card";
      card.style.animationDelay = `${index * 0.1}s`;
      card.innerHTML = `
        <div class="recap-portrait">
          ${event.mugshot ? `<img src="${event.mugshot}" style="width: 100%; height: 100%; border-radius: 50%; filter: grayscale(1);">` : "🌑"}
        </div>
        <div class="recap-name">${escapeHtml(event.victim.name)}</div>
        <div class="recap-detail">District ${event.victim.district}</div>
      `;
      els.recapFallenList.appendChild(card);
    });
  }
}

function showHighlightView() {
  state.highlights = generateHighlights();
  state.currentHighlightIdx = 0;
  
  if (state.highlights.length === 0) {
    state.highlights.push({
      tag: "Quiet Match",
      main: "LITTLE ACTION",
      sub: "It was a relatively quiet match with few major incidents.",
      desc: "The arena was eerily still."
    });
  }

  els.recapFallenView.style.display = "none";
  els.recapHighlightView.style.display = "flex";
  updateHighlight();
}

function updateHighlight() {
  const h = state.highlights[state.currentHighlightIdx];
  if (!h) return;
  
  els.recapTag.textContent = h.tag;
  els.recapMain.textContent = h.main;
  els.recapSub.textContent = h.sub;
  els.recapDesc.textContent = `"${h.desc}"`;
  els.recapCounter.textContent = `${state.currentHighlightIdx + 1} / ${state.highlights.length}`;

  // Reset replay timer
  state.replayTimer = 0;

  els.recapPrevBtn.disabled = state.currentHighlightIdx === 0;

  if (state.currentHighlightIdx === state.highlights.length - 1) {
    els.recapNextBtn.style.display = "none";
    els.recapFinishBtn.style.display = "inline-block";
  } else {
    els.recapNextBtn.style.display = "inline-block";
    els.recapFinishBtn.style.display = "none";
  }

  // Trigger animation
  els.recapHighlightView.style.animation = "none";
  els.recapHighlightView.offsetHeight; // trigger reflow
  els.recapHighlightView.style.animation = "recapSlideIn 0.35s ease-out";
}

function nextHighlight() {
  if (state.currentHighlightIdx < state.highlights.length - 1) {
    state.currentHighlightIdx++;
    updateHighlight();
  }
}

function prevHighlight() {
  if (state.currentHighlightIdx > 0) {
    state.currentHighlightIdx--;
    updateHighlight();
  }
}

function generateHighlights() {
  const highlights = [];
  const isEndGame = gameState === "ended";
  const events = isEndGame ? state.allEvents : state.allEvents.filter(e => e.day === state.currentDay);
  
  // 1. Bloodbath (deaths in first 10s of Day 1)
  const bloodbathDeaths = events.filter(e => e.type === "death" && (e.timestamp - gameStartTime) < 10000);
  if (bloodbathDeaths.length >= 3) {
    highlights.push({
      tag: "Bloodbath",
      main: "THE CORNUCOPIA",
      sub: `${bloodbathDeaths.length} tributes were slaughtered in the opening moments of the games.`,
      desc: "A brutal start to the competition.",
      clip: bloodbathDeaths[0].clip
    });
  }

  // 2. Betrayals (All)
  const betrayals = events.filter(e => e.type === "betrayal");
  betrayals.forEach(b => {
    highlights.push({
      tag: "Betrayal",
      main: "BROKEN TRUST",
      sub: `${b.actor.name} (D${b.actor.district}) turned on their ally ${b.target.name} (D${b.target.district}).`,
      desc: "In the arena, friends are just enemies you haven't killed yet.",
      clip: b.clip
    });
  });

  // 3. Significant Alliances
  const alliances = events.filter(e => e.type === "alliance");
  alliances.forEach(a => {
    highlights.push({
      tag: "Alliance",
      main: "STRENGTH IN NUMBERS",
      sub: `${a.proposer.name} and ${a.candidate.name} have formed a powerful bond.`,
      desc: "United they stand, for now.",
      clip: a.clip
    });
  });
// 4. All Kills
const deathEvents = events.filter(e => e.type === "death");
deathEvents.forEach(d => {
  highlights.push({
    tag: "The Kill",
    main: "FATAL ENCOUNTER",
    sub: `${d.victim.name} (D${d.victim.district}) fell to ${d.killer ? d.killer.name : "the arena"}.`,
    desc: "Death comes for everyone eventually.",
    clip: d.clip
  });
});
  return highlights; // Return all significant events found
}
