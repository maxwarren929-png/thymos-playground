// Version: 1.0.5 - AI Brain Diagnostics
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const WORLD = { 
  width: GAME_CONSTANTS.worldDimensions.width, 
  height: GAME_CONSTANTS.worldDimensions.height, 
  center: { x: GAME_CONSTANTS.worldDimensions.width / 2, y: GAME_CONSTANTS.worldDimensions.height / 2 } 
};
const sprites = new SpriteLayers();
let bgImage = null;
let tributeCount = 12;
let gameState = "setup";
let isPaused = false;
let lastTime = performance.now();
let gameStartTime = 0;
let finalAlliancePressure = false;
let allianceLogged = false;
let hoverPeep = null;
let nextAllianceId = 1;

// === GAME SPEED ===
const SPEED_LEVELS = [0.25, 0.5, 1, 2, 4];
let speedIndex = 2; // default 1x

// === REPLAY PLAYER ===
function updateReplay(dt) {
  const highlight = state.highlights[state.currentHighlightIdx];
  if (!highlight || !highlight.clip) return;

  const canvas = els.recapReplayCanvas;
  const ctx = canvas.getContext("2d");
  const clip = highlight.clip;
  if (!clip || !clip.frames || clip.frames.length === 0) return;

  const frameCount = clip.frames.length;
  const frameDuration = 1 / CONSTANTS.RECAP.REPLAY_FPS; // 60fps playback rate
  const duration = frameCount * frameDuration;
  state.replayTimer = (state.replayTimer || 0) + dt;
  const progress = (state.replayTimer % duration) / duration;
  const frameIdx = Math.floor(progress * frameCount);
  const snapshot = clip.frames[frameIdx];

  if (!snapshot) return;

  ctx.fillStyle = "#0a0a0e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  const zoom = clip.zoom || 1.0;
  ctx.scale(0.8 * zoom, 0.8 * zoom);
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
    ctx.strokeStyle = CONSTANTS.BACKGROUND.FALLBACK_GRID_COLOR;
    ctx.lineWidth = CONSTANTS.BACKGROUND.FALLBACK_GRID_LINE_WIDTH;
    for (let x = clip.x - 400; x < clip.x + 400; x += CONSTANTS.BACKGROUND.FALLBACK_GRID_SPACING) {
      ctx.beginPath(); ctx.moveTo(x, clip.y - 300); ctx.lineTo(x, clip.y + 300); ctx.stroke();
    }
    for (let y = clip.y - 300; y < clip.y + 300; y += CONSTANTS.BACKGROUND.FALLBACK_GRID_SPACING) {
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

  // Update recap trails for super speed ghosts
  if (snapshot.peeps) {
    snapshot.peeps.forEach(p => {
      if (p.hasSuperSpeed) {
        if (!state.recapTrails[p.id]) state.recapTrails[p.id] = [];
        state.recapTrails[p.id].push({ x: p.x, y: p.y, hop: p.hop, flip: p.flip });
        if (state.recapTrails[p.id].length > 6) state.recapTrails[p.id].shift();
      }
    });
  }

  // Cache sprite lookups for recap (same as main render)
  const spriteCache = {
    body: sprites.get("body"),
    red: sprites.get("body_red"),
    loveHat: sprites.get("lovehat"),
    loverShirt: sprites.get("lover_shirt"),
    face: sprites.get("face"),
    faceMurder: sprites.get("face_murder"),
    faceNervous: sprites.get("face_nervous"),
  };

  // Sort drawables: Peeps, corpses, gore
  const drawables = [];
  if (snapshot.peeps) {
    snapshot.peeps.forEach(p => {
      // Draw super speed ghost frames in recap
      if (p.hasSuperSpeed && state.recapTrails[p.id]) {
        const trail = state.recapTrails[p.id];
        for (let i = 0; i < trail.length - 1; i++) {
          const t = trail[i];
          ctx.save();
          ctx.globalAlpha = ((i + 1) / trail.length) * 0.25;
          const ghostPhase = Math.sin(t.hop * Math.PI * 2);
          const ghostBob = Math.abs(ghostPhase) * CONSTANTS.PEEP.BOB_HEIGHT;
          const ghostSX = CONSTANTS.PEEP.BASE_SCALE * (1 + Math.max(0, -ghostPhase) * CONSTANTS.PEEP.VISUAL_BOUNCE) * t.flip * (p.visualScale || 1);
          const ghostSY = CONSTANTS.PEEP.BASE_SCALE / (1 + Math.max(0, -ghostPhase) * CONSTANTS.PEEP.VISUAL_BOUNCE) * (p.visualScale || 1);
          ctx.translate(t.x, t.y - ghostBob);
          ctx.scale(ghostSX, ghostSY);
          spriteCache.body?.draw(ctx, `body${p.bodyFrame || 0}`, 0, 0, { scaleX: 1, scaleY: 1, rotation: 0, anchorY: 0.72 });
          ctx.restore();
        }
      }
      drawables.push({ y: p.y, render: () => Peep.renderFromSnapshot(ctx, p, sprites, spriteCache, state.replayTimer) });
    });
  }
  if (snapshot.effects) {
    snapshot.effects.filter(e => e.type === "gore_particle").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      const z = e.z || 0;
      drawables.push({ y: e.y + z, render: () => sprites.get("gore")?.draw(ctx, `gore${e.frame}`, e.x, e.y + z, {
        scale: e.scale,
        rotation: e.rotation,
        alpha,
      }) });
    });
    // New effect types for replay
    snapshot.effects.filter(e => e.type === "spark").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      drawables.push({ y: e.y, render: () => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgba(255, 230, 120, ${alpha})`;
        ctx.lineWidth = (e.scale || 1) * 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x - (e.vx || 0) * 0.03, e.y - (e.vy || 0) * 0.03);
        ctx.stroke();
        ctx.restore();
      }});
    });
    snapshot.effects.filter(e => e.type === "blood_mist").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      const z = e.z || 0;
      drawables.push({ y: e.y + z, render: () => {
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = `rgba(200, 30, 30, ${alpha})`;
        const size = (e.scale || 1) * 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y + z, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }});
    });
    snapshot.effects.filter(e => e.type === "smoke_puff").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      drawables.push({ y: e.y, render: () => {
        ctx.save();
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
        const size = (e.scale || 1) * 10;
        ctx.beginPath();
        ctx.arc(e.x, e.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }});
    });
    snapshot.effects.filter(e => e.type === "shell").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      drawables.push({ y: e.y, render: () => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rotation || 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(-1.5, -3, 3, 6);
        ctx.restore();
      }});
    });
  }

  drawables.sort((a, b) => a.y - b.y).forEach(d => d.render());

  // Replay projectiles
  if (snapshot.projectiles) {
    snapshot.projectiles.forEach((p) => {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width * 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = p.width;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      ctx.stroke();

      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.width * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Sonic crack lines
  if (snapshot.effects) {
    snapshot.effects.filter(e => e.type === "sonic_crack").forEach(e => {
      const alpha = Math.max(0, Math.min(1, e.life / e.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2 + Math.random();
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#fff";
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.targetX, e.targetY);
      ctx.stroke();
      ctx.restore();
    });
  }

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
  activeCaptures: [], // Death clips recording post-mortem frames
  rollingHistory: [], // Max 180 frames (3s)
  highlights: [],
  currentHighlightIdx: 0,
  recapTrails: {},
  recapIsEndGame: false,
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
  selectedPeep: null,
  playerPeep: null,
  controlMode: false,
  gameOverShown: false,
  keysPressed: {},
  playerAimAngle: 0,
  playerAttackQueued: false,
  projectiles: [],
};

const camera = {
  x: WORLD.center.x,
  y: WORLD.center.y,
  zoom: 0.45,
  panning: false,
  panMoved: false,
  tracking: false,
  lastX: 0,
  lastY: 0,
  panStartX: 0,
  panStartY: 0,
  focusX: WORLD.center.x,
  focusY: WORLD.center.y,
  focusTimer: 0,
  shakeTimer: 0,
  shakeIntensity: 0,
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
  tributeSidebar: document.getElementById("tribute-entries"),
  controlModeToggle: document.getElementById("control-mode-toggle"),
  gameoverOverlay: document.getElementById("gameover-overlay"),
  gameoverName: document.getElementById("gameover-name"),
  gameoverDetail: document.getElementById("gameover-detail"),
  possessBtn: document.getElementById("possess-btn"),
  watchBtn: document.getElementById("watch-btn"),
  releaseBtn: document.getElementById("release-btn"),
  speedBtn: document.getElementById("speed-btn"),
};

const weaponLabels = {
  gun: ["a spear", "🔱"],
  bat: ["a club", "🏏"],
  shotgun: ["a bow", "🏹"],
  axe: ["an axe", "🪓"],
  fists: ["their fists", "👊"],
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
  sprites.add("lovehat", `${peeps}/lovehat.json`, `${peeps}/lovehat.png`);
  sprites.add("lover_shirt", `${peeps}/lover_shirt.json`, `${peeps}/lover_shirt.png`);
  sprites.add("lover_panic", `${peeps}/lover_panic.json`, `${peeps}/lover_panic.png`);
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
  els.possessBtn.addEventListener("click", () => hideGameOver(true));
  els.watchBtn.addEventListener("click", () => hideGameOver(false));
  els.releaseBtn.addEventListener("click", releaseControl);

  // Recap listeners
  els.viewRecapBtn.addEventListener("click", showRecap);
  els.recapCloseBtn.addEventListener("click", hideRecap);
  els.recapHighlightsBtn.addEventListener("click", showHighlightView);
  els.recapPrevBtn.addEventListener("click", prevHighlight);
  els.recapNextBtn.addEventListener("click", nextHighlight);
  els.recapFinishBtn.addEventListener("click", hideRecap);

  // AI Test Button
  const testBtn = document.getElementById("test-api-btn");
  const keyInput = document.getElementById("api-key-input");
  const keyWarning = document.getElementById("key-warning");

  keyInput.addEventListener("input", () => {
    const val = keyInput.value.trim();
    if (!val) {
      keyWarning.textContent = "";
    } else if (val.startsWith("AIza")) {
      keyWarning.textContent = "";
    } else if (val.startsWith("ghp_") || val.startsWith("github_pat_")) {
      keyWarning.textContent = "✅ GitHub token detected. Use with 'Test' button.";
      keyWarning.style.color = "#62d46b";
    } else {
      keyWarning.textContent = "⚠️ Unrecognized key format. Gemini keys start with 'AIza', GitHub tokens with 'ghp_'.";
      keyWarning.style.color = "#ff473f";
    }
  });

  testBtn.addEventListener("click", async () => {
    const key = document.getElementById("api-key-input").value.trim();
    if (!key) {
      testBtn.textContent = "NEED KEY";
      setTimeout(() => testBtn.textContent = "TEST", 1500);
      return;
    }
    testBtn.textContent = "WAIT...";
    testBtn.disabled = true;
    try {
      const isGithub = key.startsWith("ghp_") || key.startsWith("github_pat_");
      let response;

      if (isGithub) {
        response = await fetch(CONSTANTS.AI.GITHUB_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ 
            messages: [{ role: "user", content: "Respond with only one word: SUCCESS" }],
            model: "gpt-4o-mini",
            max_tokens: 5
          })
        });
      } else {
        response = await fetch(`${CONSTANTS.AI.GEMINI_ENDPOINT_TEMPLATE}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Respond with only one word: SUCCESS" }] }] })
        });
      }
      
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        testBtn.textContent = "✅ OK";
        testBtn.style.color = "#62d46b";
        keyWarning.textContent = `AI Brain connected via ${isGithub ? 'GitHub' : 'Google'}!`;
      } else {
        const msg = data.error?.message || data.message || "";
        console.error("Test API Fail:", data);
        if (response.status === 404 && !isGithub) {
          testBtn.textContent = "❌ REGION?";
          keyWarning.textContent = "⚠️ Google blocks Free Tier in UK/EU. Use a VPN or try your GitHub key.";
        } else {
          testBtn.textContent = "❌ FAIL";
          keyWarning.textContent = `⚠️ ${isGithub ? 'GitHub' : 'Google'} Error ${response.status}: ${msg || 'Access denied.'}`;
        }
        testBtn.style.color = "#e55248";
      }
    } catch (e) {
      testBtn.textContent = "❌ ERR";
      testBtn.style.color = "#e55248";
    }
    setTimeout(() => {
      testBtn.textContent = "TEST";
      testBtn.style.color = "#aaa";
      testBtn.disabled = false;
    }, 3000);
  });

  els.bulkImportToggle = document.getElementById("bulk-import-toggle");
  els.bulkImportPanel = document.getElementById("bulk-import-panel");
  els.bulkInput = document.getElementById("bulk-input");
  els.bulkParseBtn = document.getElementById("bulk-parse-btn");
  els.bulkClearBtn = document.getElementById("bulk-clear-btn");
  els.randomizeBtn = document.getElementById("randomize-btn");
  els.saveRosterBtn = document.getElementById("save-roster-btn");
  els.loadRosterBtn = document.getElementById("load-roster-btn");
  els.rosterModal = document.getElementById("roster-modal");
  els.rosterModalClose = document.getElementById("roster-modal-close");
  els.rosterNameInput = document.getElementById("roster-name-input");
  els.rosterModalAction = document.getElementById("roster-modal-action");
  els.savedRostersList = document.getElementById("saved-rosters-list");

  els.bulkImportToggle.addEventListener("click", () => {
    const showing = els.bulkImportPanel.style.display !== "none";
    els.bulkImportPanel.style.display = showing ? "none" : "block";
    els.rosterModal.style.display = "none";
  });

  els.bulkParseBtn.addEventListener("click", () => {
    const text = els.bulkInput.value;
    const tributes = parseBulkImport(text);
    if (tributes.length > 0) {
      deserializeRoster(tributes);
      els.bulkInput.value = "";
      els.bulkImportPanel.style.display = "none";
    }
  });

  els.bulkClearBtn.addEventListener("click", () => {
    els.bulkInput.value = "";
  });

  els.randomizeBtn.addEventListener("click", generateRandomRoster);

  els.saveRosterBtn.addEventListener("click", () => showRosterModal("save"));
  els.loadRosterBtn.addEventListener("click", () => showRosterModal("load"));
  els.rosterModalClose.addEventListener("click", hideRosterModal);

  els.speedBtn.addEventListener("click", () => {
    speedIndex = (speedIndex + 1) % SPEED_LEVELS.length;
    const speed = SPEED_LEVELS[speedIndex];
    els.speedBtn.textContent = `⏵ ${speed}x`;
  });

  setTributeCount(tributeCount);
}

function setTributeCount(count, rosterData = null) {
  tributeCount = Math.max(CONSTANTS.TRIBUTE.COUNT_MIN, Math.min(CONSTANTS.TRIBUTE.COUNT_MAX, count));
  els.countDisplay.textContent = tributeCount;

  let existing;
  if (rosterData) {
    existing = rosterData.map(t => ({
      name: t.name || "",
      district: String(t.district || ""),
      isAI: !!t.isAI,
      traits: Array.isArray(t.traits) ? t.traits : [],
      stats: t.stats || {}
    }));
  } else {
    existing = [...els.tributeList.querySelectorAll(".tribute-row")].map((row) => ({
      name: row.querySelector(".tribute-name")?.value || "",
      district: row.querySelector(".tribute-district")?.value || "",
      isAI: row.querySelector(".ai-toggle-btn")?.classList.contains("active") || false,
      traits: [...row.querySelectorAll(".trait-picker input:checked")].map(cb => cb.value),
      stats: row.dataset.stats ? JSON.parse(row.dataset.stats) : {}
    }));
  }

  els.tributeList.innerHTML = "";
  for (let i = 0; i < tributeCount; i += 1) {
    const row = document.createElement("div");
    row.className = "tribute-row";

    const rowData = existing[i] || {};
    const rowTraits = rowData.traits || [];
    const isAI = rowData.isAI || false;
    const stats = rowData.stats || {};

    row.dataset.stats = JSON.stringify(stats);

    row.innerHTML = `
      <span class="tribute-num">${i + 1}</span>
      <input class="tribute-name" type="text" maxlength="${CONSTANTS.TRIBUTE.NAME_MAX_LENGTH}" value="${escapeAttr(rowData.name || `Tribute ${i + 1}`)}">
      <span class="district-label">D</span>
      <input class="tribute-district" type="number" min="${CONSTANTS.DISTRICT.MIN}" max="${CONSTANTS.DISTRICT.MAX}" value="${escapeAttr(rowData.district || Math.floor(i / 2) + 1)}">
      <button class="ai-toggle-btn ${isAI ? 'active' : ''}" title="Toggle AI Brain">🧠</button>
      <button class="trait-toggle-btn" title="Add Traits">🧬</button>
      <div class="trait-picker" style="display:none">
        ${Object.keys(TRAIT_LIBRARY).map(t => `
          <label class="trait-checkbox">
            <input type="checkbox" value="${t}" ${rowTraits.includes(t) ? 'checked' : ''}>
            ${TRAIT_LIBRARY[t].name}
          </label>
        `).join('')}
      </div>
    `;

    const aiBtn = row.querySelector(".ai-toggle-btn");
    aiBtn.onclick = () => {
      aiBtn.classList.toggle("active");
    };

    const toggleBtn = row.querySelector(".trait-toggle-btn");
    const picker = row.querySelector(".trait-picker");
    toggleBtn.onclick = () => {
      picker.style.display = picker.style.display === "none" ? "grid" : "none";
      toggleBtn.style.color = picker.style.display === "none" ? "#aaa" : "#ffd700";
    };

    els.tributeList.appendChild(row);
  }
}

function readTributeConfigs() {
  const rows = [...els.tributeList.querySelectorAll(".tribute-row")];
  const configs = rows.map((row, index) => {
    const name = row.querySelector(".tribute-name").value.trim();
    const district = Number(row.querySelector(".tribute-district").value);
    const traits = [...row.querySelectorAll(".trait-picker input:checked")].map(cb => cb.value);
    const isAI = row.querySelector(".ai-toggle-btn").classList.contains("active");
    const stats = row.dataset.stats ? JSON.parse(row.dataset.stats) : undefined;

    return { id: index, name, district, traits, isAI, stats };
  });

  const invalid = configs.find((config) => !config.name || !Number.isFinite(config.district) || config.district < CONSTANTS.DISTRICT.MIN || config.district > CONSTANTS.DISTRICT.MAX);
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
  state.recapIsEndGame = false;
  state.dayTimer = GAME_CONSTANTS.dayLength;
  state.currentDay = 1;
  state.isNight = false;
  state.hitEvents = [];
  state.effects = [];
  state.shockwaves = [];
  state.projectiles = [];
  state.alliances = [];
  state.slowMo = { timer: 0, duration: 0, scale: 1 };
  state.processedDeaths = new Set();
  state.cursor = new CursorEntity(WORLD.center.x, WORLD.center.y);
  state.apiKey = document.getElementById("api-key-input").value.trim();
  state.aiTimer = CONSTANTS.AI.BRAIN_RESET;
  state.playerPeep = null;
  state.controlMode = els.controlModeToggle?.checked || false;
  state.gameOverShown = false;
  state.keysPressed = {};
  state.playerAimAngle = 0;
  state.playerAttackQueued = false;
  els.releaseBtn.style.display = "none";
  els.gameoverOverlay.style.display = "none";
  
  nextAllianceId = 1;
  finalAlliancePressure = false;
  allianceLogged = false;
  hoverPeep = null;
  camera.x = WORLD.center.x;
  camera.y = WORLD.center.y;
  camera.zoom = CONSTANTS.CAMERA.DEFAULT_ZOOM;
  camera.focusX = WORLD.center.x;
  camera.focusY = WORLD.center.y;
  camera.focusTimer = 0;

  configs.forEach((config, index) => {
    const angle = (index / configs.length) * Math.PI * 2;
    const radius = GAME_CONSTANTS.spawnRadius;
    
    // Apply character preset if name matches
    const charPreset = CHARACTER_LIBRARY[config.name.toLowerCase()];
    if (charPreset) {
        config.traits = [...(config.traits || []), ...charPreset.traits];
        config.stats = { ...charPreset.stats, ...(config.stats || {}) };
        config.abilities = { ...(config.abilities || {}), ...(charPreset.abilities || {}) };
    }
    
    config.center = WORLD.center;
    state.peeps.push(new Peep(config, WORLD.center.x + Math.cos(angle) * radius, WORLD.center.y + Math.sin(angle) * radius));
  });
  state.peeps.forEach((peep) => {
    peep.initializeRelationships(state.peeps);
    peep.mugshot = peep.renderMugshot(sprites);
  });
  createDistrictAlliances();

  spawnWeapons();
  updateTributeSidebar();
  els.setupOverlay.style.display = "none";
  els.totalCount.textContent = configs.length;
  els.deathLog.innerHTML = "";
  gameStartTime = performance.now();
  gameState = "playing";
}

function updateTributeSidebar() {
    const fingerprint = state.peeps.map(p => `${p.id}:${p.alive ? 1 : 0}:${state.playerPeep === p ? 1 : 0}`).join(',');
    if (fingerprint === updateTributeSidebar._lastFingerprint) return;
    updateTributeSidebar._lastFingerprint = fingerprint;
    els.tributeSidebar.innerHTML = "";
    state.peeps.forEach(peep => {
        const entry = document.createElement("div");
        entry.className = `sidebar-entry${state.selectedPeep === peep || state.playerPeep === peep ? ' selected' : ''}`;
        entry.onclick = () => {
          if (state.controlMode && peep.alive) {
            possessPeep(peep);
          } else if (peep.alive) {
            trackPeep(peep);
          } else {
    focusCamera(peep.x, peep.y, { zoom: CONSTANTS.CAMERA.TRACKING_ZOOM, duration: CONSTANTS.CAMERA.FOCUS_DURATION_DEFAULT });
          }
        };
        
        entry.innerHTML = `
            <div class="sidebar-mugshot-container">
                <img src="${peep.mugshot}" class="sidebar-mugshot">
                ${!peep.alive ? '<div class="dead-overlay">X</div>' : ''}
            </div>
            <span style="color: ${peep.alive ? '#fff' : '#666'}">${escapeHtml(peep.name)}</span>
        `;
        els.tributeSidebar.appendChild(entry);
    });
}

function trackPeep(peep) {
    if (!peep?.alive) return;
    state.selectedPeep = peep;
    camera.tracking = true;
    focusCamera(peep.x, peep.y, { zoom: CONSTANTS.CAMERA.TRACKING_ZOOM, duration: CONSTANTS.CAMERA.FOCUS_DURATION_DEFAULT });
}

function stopTracking() {
    camera.tracking = false;
    state.selectedPeep = null;
}

function focusCamera(x, y, options = {}) {
    if (camera.panning) return;
    const { zoom = null, duration = CONSTANTS.CAMERA.FOCUS_DURATION_DEFAULT } = options;
    camera.focusX = x;
    camera.focusY = y;
    camera.focusTimer = Math.max(camera.focusTimer, duration);
    if (zoom) camera.zoom = zoom;
}

function possessPeep(peep) {
    if (!peep?.alive) return;
    if (state.playerPeep) releaseControl();
    state.playerPeep = peep;
    peep.isPlayerControlled = true;
    state.controlMode = true;
    els.releaseBtn.style.display = "block";
    camera.tracking = false;
    state.selectedPeep = null;
}

function releaseControl() {
    if (state.playerPeep) {
        state.playerPeep.isPlayerControlled = false;
        state.playerPeep = null;
    }
    state.playerAttackQueued = false;
    els.releaseBtn.style.display = "none";
}

function showGameOver(data) {
    if (state.gameOverShown) return;
    state.gameOverShown = true;
    els.gameoverName.textContent = data.name;
    els.gameoverDetail.textContent = `District ${data.district} - Killed by ${data.killedBy ? data.killedBy.name : 'the arena'}`;
    els.gameoverOverlay.style.display = "flex";
    els.releaseBtn.style.display = "none";
    // Stop any camera tracking on the dead player
    camera.tracking = false;
    state.selectedPeep = null;
}

function hideGameOver(shouldPossess) {
    els.gameoverOverlay.style.display = "none";
    state.gameOverShown = false;
    if (!shouldPossess) {
        releaseControl();
    } else {
        // Let the player pick a new tribute from the sidebar
        // The possess flow is triggered by clicking a sidebar entry
        // Just drop control so they can re-click
        releaseControl();
    }
}

function spawnWeapons() {
  const types = shuffle(["gun", "gun", "bat", "bat", "shotgun", "shotgun", "axe", "axe"]);
  state.groundWeapons = types.map((type, index) => {
    const angle = (index / types.length) * Math.PI * 2;
    return {
      type,
      x: WORLD.center.x + Math.cos(angle) * GAME_CONSTANTS.cornucopiaRadius,
      y: WORLD.center.y + Math.sin(angle) * GAME_CONSTANTS.cornucopiaRadius,
    };
  });
}

function setupInput() {
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2 && !state.playerPeep) {
      camera.panning = true;
      camera.panMoved = false;
      camera.focusTimer = 0;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      camera.panStartX = event.clientX;
      camera.panStartY = event.clientY;
    } else if (event.button === 0 && gameState === "playing") {
      const pos = screenToWorld(event.offsetX, event.offsetY);
      
      if (state.playerPeep) {
        // Player-controlled attack
        state.playerAttackQueued = true;
        return;
      }
      
      // Click a peep to track them
      const clickedPeep = alivePeeps().find(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 30);
      if (clickedPeep) {
        trackPeep(clickedPeep);
      } else {
        state.shockwaves.push({ x: pos.x, y: pos.y, radius: CONSTANTS.EFFECTS.SHOCKWAVE.START_RADIUS, life: CONSTANTS.EFFECTS.SHOCKWAVE.LIFE, maxLife: CONSTANTS.EFFECTS.SHOCKWAVE.LIFE });
      }
    }
  });
  // Pause toggle
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
    state.keysPressed[e.code] = true;
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      togglePause();
    }
  });
  window.addEventListener("keyup", (e) => {
    state.keysPressed[e.code] = false;
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
        stopTracking();
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
      state.cursor.mouseMoved(pos.x, pos.y);
      // Track aim angle for player-controlled tribute
      if (state.playerPeep) {
        const dx = pos.x - state.playerPeep.x;
        const dy = pos.y - state.playerPeep.y;
        state.playerAimAngle = Math.atan2(dy, dx);
      }
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

function loop(now) {
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const dt = rawDt * getTimeScale();
  if (gameState !== "playing" || !isPaused) {
    update(dt, rawDt);
  }
  render();
  requestAnimationFrame(loop);
}

function update(dt, rawDt = dt) {
  updateSlowMotion(rawDt);
  updateCameraShake(dt);
  if (gameState === "playing") {
    recordFrame();

    // Process pending events for capture
    const now = performance.now();
    state.pendingEvents = state.pendingEvents.filter(e => {
      if (now >= e.triggerTime) {
        // Use pre-captured frames stored at event creation so clips match the right moment
        e.data.clip = { frames: e.clipFrames || state.rollingHistory.slice(), x: e.x, y: e.y };
        state.allEvents.push(e.data);
        return false; // Remove from pending
      }
      return true;
    });

    // Process active death captures (post-recording for dynamic clips)
    state.activeCaptures = state.activeCaptures.filter(cap => {
      if (now >= cap.triggerTime) {
        const clip = buildDynamicClip(cap);
        state.allEvents.push({ ...cap.data, clip });
        return false;
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

    // AI Brain Thinking Loop
    state.aiTimer += rawDt;
    if (state.aiTimer >= CONSTANTS.AI.BRAIN_INTERVAL) {
      state.aiTimer = 0;
      processAIBrains();
    }

    state.hitEvents = [];
    const world = createWorldContext();
    state.peeps.forEach((peep) => peep.update(dt, world));
    if (state.playerPeep) world.resetAttack();
    updateProjectiles(dt);
    processHitEvents();
    processDeaths();
    // Check if player-controlled tribute died
    if (state.playerPeep && !state.playerPeep.alive && !state.gameOverShown) {
      showGameOver(state.playerPeep.die());
    }
    updateAlliance();
    state.cursor.update(dt);
    updateHover();
    checkVictory();
    updateTributeSidebar(); // Refresh sidebar for dead status
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
    effects: state.effects.map(e => {
      const base = {
        type: e.type,
        x: e.x,
        y: e.y,
        z: e.z,
        frame: e.frame,
        scale: e.scale,
        life: e.life,
        maxLife: e.maxLife,
        rotation: e.rotation,
      };
      if (e.type === "sonic_crack") {
        base.targetX = e.targetX;
        base.targetY = e.targetY;
      }
      if (e.type === "spark") {
        base.vx = e.vx;
        base.vy = e.vy;
      }
      if (e.type === "blood_mist") {
        base.vx = e.vx;
        base.vy = e.vy;
        base.vz = e.vz;
      }
      if (e.type === "shell") {
        base.vx = e.vx;
        base.vy = e.vy;
        base.rotation = e.rotation;
      }
      return base;
    }),
    timestamp: performance.now(),
  };
  state.rollingHistory.push(snapshot);
  if (state.rollingHistory.length > CONSTANTS.RECAP.ROLLING_HISTORY_MAX) {
    state.rollingHistory.shift();
  }
  // Continue recording into active death-capture buffers
  for (const cap of state.activeCaptures) {
    cap.postFrames.push(snapshot);
  }
}

function captureClip(x, y) {
  // Store only the last 60 frames (1 second) per clip to avoid unbounded memory growth
  // Full rollingHistory is 180 frames (3s), but that many frames per event is wasteful
  const startIdx = Math.max(0, state.rollingHistory.length - CONSTANTS.RECAP.CAPTURE_FRAMES);
  return {
    frames: state.rollingHistory.slice(startIdx),
    x,
    y
  };
}

function buildDynamicClip(cap) {
  const frames = [...cap.preFrames, ...cap.postFrames];
  const victimId = cap.data.victim.id;
  const killerId = cap.data.killer?.id;

  // Find the death frame: first frame where victim is no longer alive
  let deathIdx = frames.findIndex(f => {
    const v = f.peeps.find(p => p.id === victimId);
    return v && !v.alive;
  });
  if (deathIdx === -1) deathIdx = Math.floor(frames.length * 0.75);

  // Compute center and zoom from the death frame
  const dFrame = frames[deathIdx];
  const vSnap = dFrame.peeps.find(p => p.id === victimId);
  const kSnap = killerId ? dFrame.peeps.find(p => p.id === killerId) : null;

  let centerX, centerY, zoom;
  if (vSnap && kSnap) {
    centerX = (vSnap.x + kSnap.x) / 2;
    centerY = (vSnap.y + kSnap.y) / 2;
    const dx = Math.abs(vSnap.x - kSnap.x);
    const dy = Math.abs(vSnap.y - kSnap.y);
    const padding = CONSTANTS.RECAP.CLIP_PADDING; // generous padding for laser beams and weapon visuals
    const availW = CONSTANTS.RECAP.REPLAY_CANVAS_WIDTH / CONSTANTS.RECAP.REPLAY_SCALE; // canvas width / base replay scale
    const availH = CONSTANTS.RECAP.REPLAY_CANVAS_HEIGHT / CONSTANTS.RECAP.REPLAY_SCALE;
    zoom = Math.max(0.15, Math.min(1.5, Math.min(availW / (dx + padding), availH / (dy + padding))));
  } else if (vSnap) {
    centerX = vSnap.x;
    centerY = vSnap.y;
    zoom = 1.0;
  } else {
    centerX = cap.data.victim.x;
    centerY = cap.data.victim.y;
    zoom = 1.0;
  }

  return { frames, x: centerX, y: centerY, zoom };
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
    allianceVicinity: CONSTANTS.ALLIANCE.VICINITY,
    betrayalPressure: getBetrayalPressure(),
    elapsed: (performance.now() - gameStartTime) / 1000,
    logGoal,
    apiKey: state.apiKey,
    keysPressed: state.keysPressed,
    aimAngle: state.playerAimAngle,
    attackQueued: state.playerAttackQueued,
    resetAttack: () => { state.playerAttackQueued = false; },
    spawnProjectile: (params) => {
      if (!params) return;
      const dx = params.targetX - params.x;
      const dy = params.targetY - params.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = params.speed || 600;
      state.projectiles.push({
        x: params.x,
        y: params.y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        speed,
        distanceTraveled: 0,
        maxDistance: params.maxDistance || 1000,
        ownerId: params.ownerId,
        damage: params.damage,
        weapon: params.weapon,
        width: params.weapon === "laser_eyes" ? 3 : 1.5,
        color: params.weapon === "laser_eyes" ? "#ff3300" : "#ffd700",
        life: (params.maxDistance || 1000) / speed,
      });
    },
    spawnEffect: (type, params = {}) => {
      const e = { type, x: params.x || 0, y: params.y || 0, life: params.life ?? 0.3, maxLife: params.life ?? 0.3, ...params };
      if (type === "shell") {
        e.gravity = 400;
        e.bounce = 0.4;
        e.grounded = false;
      }
      state.effects.push(e);
    },
    triggerShake: (intensity = 2, duration = 0.15) => triggerCameraShake(intensity, duration),
    logEvent: (eventData) => {
        state.pendingEvents.push({
                triggerTime: performance.now() + CONSTANTS.EVENT.TRIGGER_DELAY,
            x: eventData.x,
            y: eventData.y,
            clipFrames: state.rollingHistory.slice(),
            data: { ...eventData, day: state.currentDay }
        });
    }
  };
}

function processHitEvents() {
  const processedTargets = new Set();
  for (const hit of state.hitEvents) {
    if (hit.fatal && processedTargets.has(hit.target.id)) continue;
    if (hit.fatal) processedTargets.add(hit.target.id);
    addHitEffects(hit);
    focusCamera(hit.x, hit.y, { duration: hit.fatal ? CONSTANTS.CAMERA.FOCUS_DURATION_FATAL : CONSTANTS.CAMERA.FOCUS_DURATION_HIT });
    if (hit.fatal) triggerSlowMotion(CONSTANTS.SLOW_MO.SCALE, CONSTANTS.SLOW_MO.DURATION);
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

function triggerCameraShake(intensity = 2, duration = 0.15) {
  camera.shakeIntensity = Math.max(camera.shakeIntensity, intensity);
  camera.shakeTimer = Math.max(camera.shakeTimer, duration);
}

function updateCameraShake(dt) {
  if (camera.shakeTimer <= 0) return;
  camera.shakeTimer = Math.max(0, camera.shakeTimer - dt);
  const decay = camera.shakeTimer > 0 ? camera.shakeTimer / 0.15 : 0;
  camera.shakeIntensity *= 0.9;
  if (camera.shakeTimer <= 0) camera.shakeIntensity = 0;
}

function getShakeOffset() {
  if (camera.shakeTimer <= 0 || camera.shakeIntensity <= 0) return { x: 0, y: 0 };
  const angle = Math.random() * Math.PI * 2;
  const radius = camera.shakeIntensity * (camera.shakeTimer / 0.15);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function getTimeScale() {
  const gameSpeed = SPEED_LEVELS[speedIndex];
  return state.slowMo.timer > 0 ? state.slowMo.scale * gameSpeed : gameSpeed;
}

function processDeaths() {
  for (const peep of state.peeps) {
    if (peep.alive || state.processedDeaths.has(peep.id)) continue;
    state.processedDeaths.add(peep.id);
    
    // Heartbreak Check
    if (peep.loverId) {
        const lover = state.peeps.find(p => p.id === peep.loverId && p.alive);
        if (lover) {
            state.pendingEvents.push({
            triggerTime: performance.now() + CONSTANTS.EVENT.TRIGGER_DELAY,
                x: peep.x,
                y: peep.y,
                clipFrames: state.rollingHistory.slice(),
                data: {
                    type: "heartbreak",
                    victim: peep.name,
                    survivor: lover.name,
    projectiles: state.projectiles.map(p => ({
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      color: p.color,
      width: p.width,
    })),
    timestamp: performance.now(),
                    day: state.currentDay
                }
            });
            lover.state = "panic";
            lover.isLoverDead = true;
            lover.loverMournTimer = CONSTANTS.ROMANCE.MOURN_TIMER; // Keep shirt/hat for mourning
        }
    }
    
    const data = peep.die();

    // Record event for recap with dynamic post-mortem capture
    state.activeCaptures.push({
      triggerTime: performance.now() + CONSTANTS.EVENT.TRIGGER_DELAY,
      preFrames: state.rollingHistory.slice(),
      postFrames: [],
      data: {
        type: "death",
        victim: data,
        killer: data.killedBy,
        timestamp: performance.now(),
        day: state.currentDay,
        mugshot: peep.mugshot
      }
    });

    if (data.weapon) {
      state.groundWeapons.push({
        type: data.weapon,
        x: data.x + randomRange(-16, 16),
        y: data.y + randomRange(-16, 16),
      });
    }
    addDeathEffects(data);
    
    // Explosive Death logic
    if (peep.explodeOnDeath) {
        state.shockwaves.push({ x: peep.x, y: peep.y, radius: CONSTANTS.EFFECTS.SHOCKWAVE.START_RADIUS, life: CONSTANTS.EFFECTS.SHOCKWAVE.LIFE, maxLife: CONSTANTS.EFFECTS.SHOCKWAVE.LIFE });
        state.peeps.forEach(p => {
            if (p.alive && p !== peep) {
                const d = Math.hypot(p.x - peep.x, p.y - peep.y);
                if (d < CONSTANTS.EFFECTS.EXPLOSION.RANGE) {
                    p.takeDamage(CONSTANTS.EFFECTS.EXPLOSION.DAMAGE, peep); // Damage neighbors
                }
            }
        });
    }

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
  const splatLife = randomRange(CONSTANTS.EFFECTS.SPLAT.LIFE_MIN, CONSTANTS.EFFECTS.SPLAT.LIFE_MAX);
  state.effects.push({
    type: "splat",
    x: data.x,
    y: data.y,
    frame: Math.floor(Math.random() * 3),
      scale: randomRange(CONSTANTS.EFFECTS.SPLAT.SCALE_MIN, CONSTANTS.EFFECTS.SPLAT.SCALE_MAX),
    life: splatLife,
    maxLife: splatLife,
    rotation: Math.random() * Math.PI * 2,
  });

  const goreCount = data.weapon
    ? CONSTANTS.EFFECTS.GORE.WEAPON_COUNT_MIN + Math.floor(Math.random() * (CONSTANTS.EFFECTS.GORE.WEAPON_COUNT_MAX - CONSTANTS.EFFECTS.GORE.WEAPON_COUNT_MIN + 1))
    : CONSTANTS.EFFECTS.GORE.UNARMED_COUNT_MIN + Math.floor(Math.random() * (CONSTANTS.EFFECTS.GORE.UNARMED_COUNT_MAX - CONSTANTS.EFFECTS.GORE.UNARMED_COUNT_MIN + 1));
  for (let i = 0; i < goreCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(CONSTANTS.EFFECTS.GORE.SPEED_MIN, data.weapon ? CONSTANTS.EFFECTS.GORE.SPEED_WEAPON_MAX : CONSTANTS.EFFECTS.GORE.SPEED_UNARMED_MAX);
      const life = randomRange(CONSTANTS.EFFECTS.GORE.LIFE_MIN, CONSTANTS.EFFECTS.GORE.LIFE_MAX);
    state.effects.push({
      type: "gore_particle",
      x: data.x,
      y: data.y,
      z: randomRange(CONSTANTS.EFFECTS.GORE.Z_MIN, CONSTANTS.EFFECTS.GORE.Z_MAX),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: randomRange(CONSTANTS.EFFECTS.GORE.VZ_MIN, CONSTANTS.EFFECTS.GORE.VZ_MAX),
      vr: randomRange(CONSTANTS.EFFECTS.GORE.VR_MIN, CONSTANTS.EFFECTS.GORE.VR_MAX),
      rotation: Math.random() * Math.PI * 2,
      frame: Math.floor(Math.random() * 3),
      life,
      maxLife: life,
      scale: randomRange(CONSTANTS.EFFECTS.GORE.SCALE_MIN, CONSTANTS.EFFECTS.GORE.SCALE_MAX),
    });
  }

  const weaponIndex = ["gun", "bat", "shotgun", "axe"].indexOf(data.weapon);
  state.effects.push({
    type: "corpse",
    x: data.x,
    y: data.y,
    z: -8,
      vx: randomRange(CONSTANTS.EFFECTS.CORPSE.VX_MIN, CONSTANTS.EFFECTS.CORPSE.VX_MAX),
      vy: randomRange(CONSTANTS.EFFECTS.CORPSE.VY_MIN, CONSTANTS.EFFECTS.CORPSE.VY_MAX),
      vz: randomRange(CONSTANTS.EFFECTS.CORPSE.VZ_MIN, CONSTANTS.EFFECTS.CORPSE.VZ_MAX),
    rotation: 0,
    frame: Math.max(0, (weaponIndex + 2) * 2 + data.side) % 12,
      life: CONSTANTS.EFFECTS.CORPSE.LIFE,
      maxLife: CONSTANTS.EFFECTS.CORPSE.LIFE,
    onGround: false,
  });
}

function addHitEffects(hit) {
  const goreCount = hit.weapon === "fists"
    ? CONSTANTS.EFFECTS.HIT_GORE.FISTS_COUNT_MIN + Math.floor(Math.random() * (CONSTANTS.EFFECTS.HIT_GORE.FISTS_COUNT_MAX - CONSTANTS.EFFECTS.HIT_GORE.FISTS_COUNT_MIN + 1))
    : CONSTANTS.EFFECTS.HIT_GORE.WEAPON_COUNT_MIN + Math.floor(Math.random() * (CONSTANTS.EFFECTS.HIT_GORE.WEAPON_COUNT_MAX - CONSTANTS.EFFECTS.HIT_GORE.WEAPON_COUNT_MIN + 1));
  for (let i = 0; i < goreCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(CONSTANTS.EFFECTS.HIT_GORE.SPEED_MIN, hit.weapon === "gun" ? CONSTANTS.EFFECTS.HIT_GORE.GUN_SPEED_MAX : CONSTANTS.EFFECTS.HIT_GORE.SPEED_MAX);
      const life = randomRange(CONSTANTS.EFFECTS.HIT_GORE.LIFE_MIN, CONSTANTS.EFFECTS.HIT_GORE.LIFE_MAX);
    state.effects.push({
      type: "gore_particle",
      x: hit.x + randomRange(-8, 8),
      y: hit.y + randomRange(-8, 8),
      z: randomRange(CONSTANTS.EFFECTS.HIT_GORE.Z_MIN, CONSTANTS.EFFECTS.HIT_GORE.Z_MAX),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: randomRange(CONSTANTS.EFFECTS.HIT_GORE.VZ_MIN, CONSTANTS.EFFECTS.HIT_GORE.VZ_MAX),
      vr: randomRange(CONSTANTS.EFFECTS.HIT_GORE.VR_MIN, CONSTANTS.EFFECTS.HIT_GORE.VR_MAX),
      rotation: Math.random() * Math.PI * 2,
      frame: Math.floor(Math.random() * 3),
      life,
      maxLife: life,
      scale: randomRange(CONSTANTS.EFFECTS.HIT_GORE.SCALE_MIN, CONSTANTS.EFFECTS.HIT_GORE.SCALE_MAX),
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
    } else if (effect.type === "shell") {
      if (!effect.grounded) {
        effect.x += (effect.vx || 0) * dt;
        effect.y += (effect.vy || 0) * dt;
        effect.vy = (effect.vy || 0) + effect.gravity * dt;
        effect.rotation = (effect.rotation || 0) + (effect.vr || 10) * dt;
        if (effect.y >= effect.groundY) {
          effect.y = effect.groundY;
          effect.vy *= -effect.bounce;
          effect.vx = (effect.vx || 0) * 0.6;
          if (Math.abs(effect.vy) < 30) effect.grounded = true;
        }
      }
    } else if (effect.type === "spark") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vx *= 0.85;
      effect.vy *= 0.85;
    } else if (effect.type === "blood_mist") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.z += effect.vz * dt;
      effect.vz += 0.4;
      effect.vx *= 0.92;
      effect.vy *= 0.92;
      if (effect.z > 0) {
        effect.z = 0;
        effect.vz = 0;
        effect.vx *= 0.5;
        effect.vy *= 0.5;
      }
    }
  }
  // Corpses stay for their lifetime (10s) after landing, then get cleaned up
  state.effects = state.effects.filter((effect) => {
    if (effect.type === "corpse" && effect.onGround && effect.life <= 0) return false;
    return effect.life > 0;
  });
}

function updateProjectiles(dt) {
  const alive = state.peeps.filter((p) => p.alive);
  for (const p of state.projectiles) {
    // Smoke trail at current position before moving
    state.effects.push({
      type: "smoke_puff",
      x: p.x,
      y: p.y,
      life: 0.15,
      maxLife: 0.15,
      scale: 0.5 + Math.random() * 0.3,
    });

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.distanceTraveled += p.speed * dt;
    p.life -= dt;

    const owner = state.peeps.find((pe) => pe.id === p.ownerId);
    const hit = alive.find((peep) => {
      if (peep.id === p.ownerId) return false;
      if (owner && areAllied(owner, peep)) return false;
      return Math.hypot(peep.x - p.x, peep.y - p.y) < 18;
    });

    if (hit) {
      hit.takeDamage(p.damage, owner);
      if (owner && owner.lifesteal) {
        owner.health = Math.min(owner.maxHealth, owner.health + p.damage * owner.lifesteal);
      }
      hit.remember("attacked_me", owner, 1);
      state.hitEvents.push({
        x: hit.x,
        y: hit.y,
        weapon: p.weapon,
        side: hit.bodyFrame,
        target: hit,
        killer: owner,
        fatal: !hit.alive,
      });

      // Impact spark burst
      const sparkCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        state.effects.push({
          type: "spark",
          x: hit.x,
          y: hit.y,
          z: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.15 + Math.random() * 0.1,
          maxLife: 0.25,
          scale: 0.5 + Math.random() * 0.5,
        });
      }

      // Blood mist on hard hits / fatal
      if (!hit.alive || p.damage >= 3) {
        const ownerX = owner?.x ?? p.x;
        const ownerY = owner?.y ?? p.y;
        const backAngle = Math.atan2(hit.y - ownerY, hit.x - ownerX);
        const mistCount = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < mistCount; i++) {
          const spread = (Math.random() - 0.5) * 1.2;
          const angle = backAngle + spread;
          const speed = 30 + Math.random() * 80;
          state.effects.push({
            type: "blood_mist",
            x: hit.x,
            y: hit.y,
            z: -5 - Math.random() * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: -10 - Math.random() * 20,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.6,
            scale: 0.3 + Math.random() * 0.4,
          });
        }
      }

      // Camera shake on hit
      triggerCameraShake(p.weapon === "shotgun" ? 3 : 2, 0.12);

      p.life = 0;
      continue;
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0 && p.distanceTraveled < p.maxDistance);
}

function updateSpectatorCamera(dt) {
  if (camera.panning || gameState !== "playing") return;

  // Hard-lock camera to player-controlled tribute
  if (state.playerPeep && state.playerPeep.alive) {
    const ease = 1 - Math.pow(0.01, dt);
    camera.x += (state.playerPeep.x - camera.x) * ease;
    camera.y += (state.playerPeep.y - camera.y) * ease;
    camera.zoom = Math.min(CONSTANTS.CAMERA.PLAYER_ZOOM, camera.zoom + (CONSTANTS.CAMERA.PLAYER_ZOOM - camera.zoom) * ease * 0.5);
    return;
  }

  // Handle persistent tracking
  if (camera.tracking && state.selectedPeep) {
    if (state.selectedPeep.alive) {
      camera.focusX = state.selectedPeep.x;
      camera.focusY = state.selectedPeep.y;
      camera.focusTimer = 1.0; // Keep it focused
    } else {
      stopTracking();
    }
  }

  if (camera.focusTimer <= 0) return;
  
  camera.focusTimer = Math.max(0, camera.focusTimer - dt);
  const ease = 1 - Math.pow(0.04, dt);
  camera.x += (camera.focusX - camera.x) * ease;
  camera.y += (camera.focusY - camera.y) * ease;
}

function updateShockwaves(dt) {
  for (const wave of state.shockwaves) {
    wave.life -= dt;
    wave.radius += CONSTANTS.EFFECTS.SHOCKWAVE.SPEED * dt;
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
    if (alliance) alliance.strength = Math.max(0, alliance.strength - CONSTANTS.ALLIANCE.FINAL_PRESSURE_STRENGTH_DRAIN);
  }
}

function checkVictory() {
  const alive = alivePeeps();
  if (alive.length > 1) return;
  gameState = "ended";
  // If the player just died, don't override the game over overlay with victory
  if (state.gameOverShown) return;
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

function getPlayerAwareness() {
  if (!state.playerPeep?.alive) return Infinity;
  return (state.playerPeep.profile?.enemyAwareness || 250) *
         (state.playerPeep.stats?.eyesight / 10 || 1);
}

function canPlayerSee(x, y) {
  if (!state.playerPeep?.alive) return true;
  const awareness = getPlayerAwareness();
  return Math.hypot(x - state.playerPeep.x, y - state.playerPeep.y) <= awareness;
}

function renderFogOverlay() {
  if (!state.playerPeep?.alive) return;
  const pos = worldToScreen(state.playerPeep.x, state.playerPeep.y);
  const awareness = getPlayerAwareness() * camera.zoom;

  const grad = ctx.createRadialGradient(pos.x, pos.y, awareness * 0.35, pos.x, pos.y, awareness);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.65, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, `rgba(0,0,0,${CONSTANTS.FOG.OUTER_ALPHA})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);

  ctx.fillStyle = `rgba(0,0,0,${CONSTANTS.FOG.BASE_ALPHA})`;
  ctx.beginPath();
  ctx.rect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  ctx.arc(pos.x, pos.y, awareness, 0, Math.PI * 2);
  ctx.fill("evenodd");
}

function render() {
  ctx.clearRect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  ctx.save();
  applyCameraTransform();
  renderBackground();
  renderWeapons();
  renderWorldEffects("splat", (e) => canPlayerSee(e.x, e.y));

  // Cache sprite lookups once per frame instead of per-peep
  const spriteCache = {
    body: sprites.get("body"),
    red: sprites.get("body_red"),
    loveHat: sprites.get("lovehat"),
    loverShirt: sprites.get("lover_shirt"),
    face: sprites.get("face"),
    faceMurder: sprites.get("face_murder"),
    faceNervous: sprites.get("face_nervous"),
  };

  const canSee = (x, y) => canPlayerSee(x, y);
  const drawables = [
    ...state.peeps.filter((peep) => peep.alive && canSee(peep.x, peep.y)).map((peep) => ({ y: peep.y, render: () => peep.render(ctx, sprites, spriteCache) })),
    ...state.effects.filter((effect) => effect.type === "corpse" && canSee(effect.x, effect.y)).map((effect) => ({ y: effect.y + (effect.z || 0), render: () => renderEffect(effect) })),
    ...state.effects.filter((effect) => effect.type === "gore_particle" && canSee(effect.x, effect.y)).map((effect) => ({ y: effect.y + (effect.z || 0), render: () => renderEffect(effect) })),
    ...state.effects.filter((effect) => ["spark", "blood_mist", "smoke_puff", "shell"].includes(effect.type) && canSee(effect.x, effect.y)).map((effect) => ({ y: effect.y + (effect.z || 0), render: () => renderEffect(effect) })),
    { y: state.cursor.y, render: () => state.cursor.render(ctx, sprites) },
  ];
  drawables.sort((a, b) => a.y - b.y).forEach((drawable) => drawable.render());
  renderShockwaves();
  renderProjectiles();
  ctx.restore();

  renderHoverLabel();
  renderFogOverlay();
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
  } else if (timer < CONSTANTS.DAY.NIGHT_TRANSITION_START) {
    opacity = (1 - (timer / CONSTANTS.DAY.NIGHT_TRANSITION_START)) * CONSTANTS.DAY.NIGHT_OVERLAY_OPACITY;
  }

  if (opacity <= 0) return;

  ctx.save();
  ctx.fillStyle = CONSTANTS.NIGHT.OVERLAY_COLOR + `${opacity})`;
  ctx.fillRect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  
  // Add a subtle vignette
  const grad = ctx.createRadialGradient(CONSTANTS.CANVAS.HALF_WIDTH, CONSTANTS.CANVAS.HALF_HEIGHT, CONSTANTS.NIGHT.VIGNETTE_INNER_RADIUS, CONSTANTS.CANVAS.HALF_WIDTH, CONSTANTS.CANVAS.HALF_HEIGHT, CONSTANTS.NIGHT.VIGNETTE_OUTER_RADIUS);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, CONSTANTS.NIGHT.VIGNETTE_COLOR + `${opacity * CONSTANTS.DAY.NIGHT_VIGNETTE_MULTIPLIER})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  ctx.restore();
}

function applyCameraTransform() {
  const shake = getShakeOffset();
  ctx.translate(CONSTANTS.CANVAS.HALF_WIDTH + shake.x, CONSTANTS.CANVAS.HALF_HEIGHT + shake.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

function renderBackground() {
  // Fill a large area so zoomed-out views don't show bare canvas
  const canvasW = GAME_CONSTANTS.universeDimensions.width;
  const canvasH = GAME_CONSTANTS.universeDimensions.height;
  const canvasX = WORLD.center.x - canvasW / 2;
  const canvasY = WORLD.center.y - canvasH / 2;
  
  ctx.fillStyle = CONSTANTS.BACKGROUND.FILL_COLOR;
  ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
  
  // Subtle grid pattern across the full universe
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
  // Draw 3×3 tile grid centered on the world, covering the playable area
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
    if (!canPlayerSee(weapon.x, weapon.y)) continue;
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

function renderWorldEffects(type, filterFn = null) {
  state.effects.filter((effect) => effect.type === type && (!filterFn || filterFn(effect))).forEach(renderEffect);
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
      scale: CONSTANTS.EFFECTS.CORPSE.SCALE,
      rotation: effect.rotation,
      alpha: Math.min(1, alpha * CONSTANTS.EFFECTS.CORPSE.ALPHA_MULT),
    });
  } else if (effect.type === "spark") {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgba(255, 230, 120, ${alpha})`;
    ctx.lineWidth = (effect.scale || 1) / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(effect.x, effect.y);
    ctx.lineTo(effect.x - effect.vx * 0.03, effect.y - effect.vy * 0.03);
    ctx.stroke();
    ctx.restore();
  } else if (effect.type === "blood_mist") {
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = `rgba(200, 30, 30, ${alpha})`;
    const size = (effect.scale || 1) * 4 / camera.zoom;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y + z, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (effect.type === "smoke_puff") {
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
    const size = (effect.scale || 1) * 10 / camera.zoom;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (effect.type === "shell") {
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.rotate(effect.rotation || 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#d4af37";
    const w = 3 / camera.zoom;
    const h = 6 / camera.zoom;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  } else if (effect.type === "sonic_crack") {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = (2 + Math.random()) / camera.zoom;
    ctx.shadowBlur = 8 / camera.zoom;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.moveTo(effect.x, effect.y);
    ctx.lineTo(effect.targetX, effect.targetY);
    ctx.stroke();
    ctx.restore();
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

function renderProjectiles() {
  for (const p of state.projectiles) {
    if (!canPlayerSee(p.x, p.y)) continue;
    ctx.save();

    // Outer glow (trail)
    ctx.shadowBlur = 12 / camera.zoom;
    ctx.shadowColor = p.color;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = (p.width * 2) / camera.zoom;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
    ctx.stroke();

    // Core tracer
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = p.width / camera.zoom;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
    ctx.stroke();

    // Glowing head
    ctx.shadowBlur = 8 / camera.zoom;
    ctx.shadowColor = p.color;
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.width * 0.8) / camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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
  const w = CONSTANTS.UI.TOOLTIP_WIDTH;
  const h = CONSTANTS.UI.TOOLTIP_HEIGHT;
  ctx.save();
  ctx.fillStyle = "rgba(10, 10, 14, 0.82)";
  roundRect(ctx, pos.x - w / 2, pos.y - h, w, h, 8);
  ctx.fill();
  ctx.fillStyle = "#ffd700";
  ctx.font = "9px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`District ${hoverPeep.district} - ${allianceText}`, pos.x, pos.y - 82);
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(hoverPeep.name, pos.x, pos.y - 66);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "9px Segoe UI, sans-serif";
  ctx.fillText(statText, pos.x, pos.y - 52);
  ctx.fillText(socialText, pos.x, pos.y - 39);
  ctx.fillText(goalText, pos.x, pos.y - 26);
  ctx.fillText(faceText, pos.x, pos.y - 13);
  ctx.fillStyle = hoverPeep.health > 1 ? "#62d46b" : "#e55248";
  ctx.fillRect(pos.x - 14, pos.y - 4, CONSTANTS.UI.TOOLTIP_HEALTH_BAR_WIDTH * (hoverPeep.health / hoverPeep.maxHealth), 4);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(pos.x - 14, pos.y - 4, CONSTANTS.UI.TOOLTIP_HEALTH_BAR_WIDTH, 4);
  ctx.restore();
}

function renderSlowMotionOverlay() {
  if (state.slowMo.timer <= 0) return;
  const alpha = Math.min(0.5, state.slowMo.timer / Math.max(0.01, state.slowMo.duration));
  ctx.save();
  ctx.fillStyle = `rgba(255, 215, 90, ${CONSTANTS.SLOW_MO.OVERLAY_ALPHA_BASE * alpha})`;
  ctx.fillRect(0, 0, CONSTANTS.CANVAS.LOGICAL_WIDTH, CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  ctx.fillStyle = `rgba(255, 230, 140, ${0.85 * alpha})`;
  ctx.font = "700 11px Segoe UI, sans-serif";
  ctx.fillText("SLOW MOTION", 22, 28);
  ctx.restore();
}

function renderZoomHint() {
  if (gameState !== "playing" || performance.now() - gameStartTime > 5000) return;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  roundRect(ctx, 18, CONSTANTS.CANVAS.LOGICAL_HEIGHT - 40, 250, 24, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText("Right-drag to pan. Scroll to zoom.", 32, CONSTANTS.CANVAS.LOGICAL_HEIGHT - 24);
  ctx.restore();
}

function pushLog(text, isCannon) {
  state.deathLog.unshift({ text, isCannon });
  state.deathLog = state.deathLog.slice(0, CONSTANTS.UI.LOG_MAX_ENTRIES);
  els.deathLog.innerHTML = state.deathLog
    .map((entry) => `<div class="death-entry${entry.isCannon ? " cannon" : ""}">${entry.text}</div>`)
    .join("");
}

function logGoal(peep, goal, target = null) {
  if (!peep?.alive) return;
    if (CONSTANTS.GOAL_LOGGING.IGNORED_GOALS.includes(goal)) return;
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
    if (members.length > 1) createAlliance(members, "district", CONSTANTS.ALLIANCE.START_STRENGTH_DISTRICT);
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
  if (dist > CONSTANTS.ALLIANCE.VICINITY) return false;
  const proposerRel = proposer.relationshipWith(candidate);
  const candidateRel = candidate.relationshipWith(proposer);
  const proposerScore = proposer.allianceDesire(candidate, proposerRel, dist);
  const candidateScore = candidate.allianceDesire(proposer, candidateRel, dist);
  if (proposerScore < CONSTANTS.ALLIANCE.DESIRE_THRESHOLD || candidateScore < CONSTANTS.ALLIANCE.DESIRE_THRESHOLD) return false;

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
  if (alive <= 2) return CONSTANTS.BETRAYAL_PRESSURE.ALIVE_2;
  if (alive <= 3) return CONSTANTS.BETRAYAL_PRESSURE.ALIVE_3;
  if (alive <= 5) return CONSTANTS.BETRAYAL_PRESSURE.ALIVE_5;
  if (alive <= 8) return CONSTANTS.BETRAYAL_PRESSURE.ALIVE_8;
  return 0;
}

function mergeOrCreateAlliance(a, b) {
  if (a.allianceId && a.allianceId === b.allianceId) return getAlliance(a.allianceId);
  removeFromAlliance(a);
  removeFromAlliance(b);
  return createAlliance([a, b], "cross_district", CONSTANTS.ALLIANCE.START_STRENGTH_CROSS);
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
  const panelWidth = window.innerWidth < CONSTANTS.UI.PANEL_BREAKPOINT ? 0 : CONSTANTS.UI.SIDEBAR_WIDTH;
  const maxWidth = Math.max(CONSTANTS.UI.MIN_WIDTH, window.innerWidth - panelWidth - CONSTANTS.UI.MARGIN);
  const maxHeight = Math.max(CONSTANTS.UI.MIN_HEIGHT, window.innerHeight - CONSTANTS.UI.MARGIN);
  const scale = Math.min(maxWidth / CONSTANTS.CANVAS.LOGICAL_WIDTH, maxHeight / CONSTANTS.CANVAS.LOGICAL_HEIGHT);
  
  const displayWidth = Math.floor(CONSTANTS.CANVAS.LOGICAL_WIDTH * scale);
  const displayHeight = Math.floor(CONSTANTS.CANVAS.LOGICAL_HEIGHT * scale);
  
  // Set CSS display size
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  // Match the drawing buffer to the displayed size so large viewports do not
  // upscale a fixed 960x540 render.
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
  // We allow the camera to move within a much larger "Universe" than the physical WORLD
  const universeW = GAME_CONSTANTS.universeDimensions.width;
  const universeH = GAME_CONSTANTS.universeDimensions.height;

  const halfW = CONSTANTS.CANVAS.HALF_WIDTH / camera.zoom;
  const halfH = CONSTANTS.CANVAS.HALF_HEIGHT / camera.zoom;

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

// === ROSTER SAVE / LOAD / RANDOMIZE / BULK IMPORT ===

const NAME_BANK = [
  "Aiden", "Bryn", "Cora", "Darius", "Elara", "Finn", "Gwen", "Hector",
  "Iris", "Jasper", "Kira", "Leo", "Mira", "Nolan", "Opal", "Pax",
  "Quinn", "Rex", "Sage", "Talon", "Uma", "Vex", "Wren", "Xander",
  "Yara", "Zane", "Asha", "Brutus", "Cassia", "Draven", "Ember",
  "Frost", "Griffin", "Haven", "Ivy", "Jett", "Kael", "Luna",
  "Milo", "Nova", "Orion", "Phoenix", "Raven", "Silas", "Thorne",
  "Violet", "Wolf", "Zenith", "Blaze", "Cipher", "Dagger", "Echo",
  "Fang", "Glory", "Hawk", "Ignis", "Jinx", "Kestrel", "Lyra"
];

function serializeRoster() {
  const rows = [...els.tributeList.querySelectorAll(".tribute-row")];
  return rows.map(row => ({
    name: row.querySelector(".tribute-name")?.value || "",
    district: Number(row.querySelector(".tribute-district")?.value) || 1,
    isAI: row.querySelector(".ai-toggle-btn")?.classList.contains("active") || false,
    traits: [...row.querySelectorAll(".trait-picker input:checked")].map(cb => cb.value),
    stats: row.dataset.stats ? JSON.parse(row.dataset.stats) : {}
  }));
}

function deserializeRoster(tributes) {
  if (!Array.isArray(tributes) || tributes.length === 0) return;
  const clamped = tributes.slice(0, CONSTANTS.TRIBUTE.COUNT_MAX);
  setTributeCount(clamped.length, clamped);
}

function parseBulkImport(text) {
  const lines = text.trim().split(/\n/).map(l => l.trim()).filter(Boolean);
  const traitKeys = Object.keys(TRAIT_LIBRARY);

  return lines.map((line, i) => {
    // Extract optional district: D12 or #12 anywhere in the line
    const districtMatch = line.match(/\b[D#](\d+)\b/);
    const district = districtMatch ? Math.max(CONSTANTS.DISTRICT.MIN, Math.min(CONSTANTS.DISTRICT.MAX, Number(districtMatch[1]))) : (Math.floor(i / 2) + 1);
    const lineWithoutDistrict = districtMatch ? line.replace(districtMatch[0], '') : line;

    const match = lineWithoutDistrict.match(/^([^\[]+?)(?:\s*\[(.*?)\])?\s*$/);
    const name = match ? match[1].trim() : lineWithoutDistrict.trim();
    const traitPart = match ? match[2] : '';
    const traits = traitPart
      ? traitPart.split(',').map(t => t.trim().toLowerCase()).filter(t => traitKeys.includes(t))
      : [];

    return {
      name: name || `Tribute ${i + 1}`,
      district,
      isAI: false,
      traits,
      stats: {}
    };
  });
}

function generateRandomRoster() {
  const count = tributeCount;
  const names = shuffle(NAME_BANK).slice(0, count);
  const traitKeys = Object.keys(TRAIT_LIBRARY);

  const tributes = names.map((name, i) => {
    const numTraits = Math.floor(Math.random() * 3); // 0, 1, or 2
    const traits = shuffle(traitKeys).slice(0, numTraits);

    return {
      name,
      district: Math.floor(i / 2) + 1,
      isAI: Math.random() > 0.7, // ~30% AI
      traits,
      stats: {}
    };
  });

  deserializeRoster(tributes);
}

function getSavedRosters() {
  try {
    return JSON.parse(localStorage.getItem('hg_rosters') || '[]');
  } catch {
    return [];
  }
}

function setSavedRosters(rosters) {
  localStorage.setItem('hg_rosters', JSON.stringify(rosters));
}

function saveRosterToStorage(name) {
  if (!name || !name.trim()) {
    els.rosterNameInput.style.borderColor = '#ff473f';
    setTimeout(() => els.rosterNameInput.style.borderColor = '#3a3a44', 1200);
    return false;
  }
  const rosters = getSavedRosters();
  const existingIndex = rosters.findIndex(r => r.name === name.trim());
  const roster = { name: name.trim(), tributes: serializeRoster() };

  if (existingIndex >= 0) {
    rosters[existingIndex] = roster;
  } else {
    rosters.push(roster);
  }
  setSavedRosters(rosters);
  return true;
}

function loadRosterFromStorage(name) {
  const rosters = getSavedRosters();
  const found = rosters.find(r => r.name === name);
  if (found) {
    deserializeRoster(found.tributes);
    return true;
  }
  return false;
}

function deleteRosterFromStorage(name) {
  let rosters = getSavedRosters();
  rosters = rosters.filter(r => r.name !== name);
  setSavedRosters(rosters);
}

function refreshSavedRostersList() {
  const container = els.savedRostersList;
  if (!container) return;
  const rosters = getSavedRosters();

  if (rosters.length === 0) {
    container.innerHTML = '<div style="color:#666; font-size:12px; padding:8px 0;">No saved rosters yet.</div>';
    return;
  }

  container.innerHTML = rosters.map(r => `
    <div class="saved-roster-item">
      <span class="saved-roster-name">${escapeHtml(r.name)}</span>
      <span class="saved-roster-meta">${r.tributes.length} tributes</span>
      <button class="saved-roster-load" data-name="${escapeAttr(r.name)}">Load</button>
      <button class="saved-roster-delete" data-name="${escapeAttr(r.name)}">Delete</button>
    </div>
  `).join('');

  container.querySelectorAll('.saved-roster-load').forEach(btn => {
    btn.onclick = () => {
      loadRosterFromStorage(btn.dataset.name);
      hideRosterModal();
    };
  });

  container.querySelectorAll('.saved-roster-delete').forEach(btn => {
    btn.onclick = () => {
      deleteRosterFromStorage(btn.dataset.name);
      refreshSavedRostersList();
    };
  });
}

function showRosterModal(mode) {
  const modal = els.rosterModal;
  const title = document.getElementById('roster-modal-title') || modal.querySelector('h3');
  const actionBtn = els.rosterModalAction;
  const input = els.rosterNameInput;

  modal.style.display = 'block';
  els.bulkImportPanel.style.display = 'none';
  refreshSavedRostersList();

  if (mode === 'save') {
    if (title) title.textContent = 'Save Roster';
    actionBtn.textContent = 'Save';
    input.style.display = 'block';
    input.value = '';
    input.focus();
    actionBtn.onclick = () => {
      if (saveRosterToStorage(input.value)) {
        hideRosterModal();
      }
    };
  } else {
    if (title) title.textContent = 'Load Roster';
    actionBtn.textContent = 'Close';
    input.style.display = 'none';
    actionBtn.onclick = hideRosterModal;
  }
}

function hideRosterModal() {
  els.rosterModal.style.display = 'none';
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
  // Force process any pending events before showing recap
  // Use pre-captured frames stored at event creation so clips match the right moment
  state.pendingEvents.forEach(e => {
      e.data.clip = { frames: e.clipFrames || state.rollingHistory.slice(), x: e.x, y: e.y };
      state.allEvents.push(e.data);
  });
  state.pendingEvents = [];

  const isEndGame = gameState === "ended";
  state.recapIsEndGame = isEndGame;
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
    state.dayTimer = GAME_CONSTANTS.dayLength;
    state.currentDay += 1;
    state.recapIsEndGame = false;
    els.recapOverlay.style.display = "none";
  }
}

function showFallenView() {
  els.recapFallenView.style.display = "block";
  els.recapHighlightView.style.display = "none";
  els.recapFallenList.innerHTML = "";

  const isEndGame = state.recapIsEndGame;

  const deaths = state.allEvents.filter((e) => {
    if (e.type !== "death") return false;
    if (isEndGame) return true; // Show all on game over
    // Check if the event day matches the current day
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
  state.recapTrails = {};
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
  const isEndGame = state.recapIsEndGame;
  const events = isEndGame ? state.allEvents : state.allEvents.filter(e => e.day === state.currentDay);
  
  // 1. Bloodbath (deaths in first 10s of Day 1)
  const bloodbathDeaths = events.filter(e => e.type === "death" && (e.timestamp - gameStartTime) < CONSTANTS.RECAP.BLOODBATH_WINDOW);
  if (bloodbathDeaths.length >= CONSTANTS.RECAP.BLOODBATH_THRESHOLD) {
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
// 4. Significant Kills
const deathEvents = events.filter(e => e.type === "death");
// Sort by kills to prioritize high-kill tributes, or just take a sample
deathEvents.forEach((d, idx) => {
  // Only show first 3 kills of the day, or all if it's the final day/endgame
  if (idx < CONSTANTS.RECAP.HIGHLIGHT_MAX_PER_DAY || isEndGame || state.peeps.filter(p => p.alive).length <= 3) {
      highlights.push({
        tag: "The Kill",
        main: "FATAL ENCOUNTER",
        sub: `${d.victim.name} (D${d.victim.district}) fell to ${d.killer ? d.killer.name : "the arena"}.`,
        desc: d.killer ? "Another one bites the dust." : "The arena is a dangerous place.",
        clip: d.clip
      });
  }
});

// 5. Romance
const romances = events.filter(e => e.type === "romance");
romances.forEach(r => {
  highlights.push({
    tag: "Romance",
    main: "FORBIDDEN LOVE",
    sub: `${r.proposer} and ${r.candidate} have fallen in love.`,
    desc: "A moment of peace in the madness.",
    clip: r.clip
  });
});

// 6. Heartbreak
const heartbreaks = events.filter(e => e.type === "heartbreak");
heartbreaks.forEach(h => {
  highlights.push({
    tag: "Tragedy",
    main: "HEARTBROKEN",
    sub: `${h.survivor} is devastated by the loss of ${h.victim}.`,
    desc: "The cruelest part of the game.",
    clip: h.clip
  });
});

return highlights; // Return all significant events found
}

async function processAIBrains() {
  if (!state.apiKey) return;

  const world = createWorldContext();
  const aiTributes = state.peeps.filter(p => p.alive && p.isAI && !p.isThinking);
  if (aiTributes.length === 0) return;

  // Concurrency limiter: at most 3 concurrent API calls to avoid rate limits
  const CONCURRENCY = CONSTANTS.AI.CONCURRENCY;
  let idx = 0;

  async function processNext() {
    while (idx < aiTributes.length) {
      const peep = aiTributes[idx++];
      peep.isThinking = true;
      try {
        const thought = await AIController.fetchAIThought(peep, world);
        peep.isThinking = false;
        if (thought && peep.alive) {
          peep.aiGoalOverride = {
            goal: thought.goal,
            targetId: thought.targetId,
            shout: thought.shout,
            expiresAt: performance.now() + CONSTANTS.AI.OVERRIDE_DURATION
          };
          peep.aiMemorySummary = thought.memorySummary || peep.aiMemorySummary;
        }
      } catch (err) {
        peep.isThinking = false;
        pushLog(`<span style="color:#ff473f">🧠 AI Brain Error (${escapeHtml(peep.name)}): API call failed.</span>`, false);
        console.error("AI Brain Error:", err);
      }
    }
  }

  // Fire CONCURRENCY workers
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(processNext());
  }
  await Promise.all(workers);
}
