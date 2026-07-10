// =============================================================================
// RESEARCH MODULE — Headless simulation, data recording, tables, charts, exports
// =============================================================================

// === Seeded PRNG (Mulberry32) ===
let _nativeRandom = null;

function seedRNG(seed) {
  _nativeRandom = Math.random;
  let s = seed >>> 0;
  Math.random = function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unseedRNG() {
  if (_nativeRandom) Math.random = _nativeRandom;
}

// === Research State ===
const R = {
  running: false,
  seed: 42,
  maxGenerations: 500,
  creatureCount: 12,
  data: [],
  lastSnapshotGen: 0,
  startTime: 0,
  ticksPerFrame: 120,
  _animId: null,
};

function setupResearchWorld(count) {
  state.creatures = [];
  state.bushes = [];
  state.water = [];
  state.hounds = [];
  state.births = [];
  state.deaths = [];
  state.speciationEvents = [];
  state.generation = 1;
  state.avgTraits = {};
  state.traitHistory = [];

  // Re-seed RNG right before creature creation for deterministic setup
  seedRNG(R.seed);

  Creature._nextSpeciesId = 1;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = GAME_CONSTANTS.spawnRadius;
    const diet = ["herbivore", "carnivore", "omnivore"][i % 3];
    const config = { name: `C${i}`, id: i, genome: {}, diet };
    const x = WORLD.center.x + Math.cos(angle) * radius;
    const y = WORLD.center.y + Math.sin(angle) * radius;
    const creature = new Creature(config, x, y);
    creature.mugshot = "";
    state.creatures.push(creature);
  }

  // Spawn resources (uses seeded Math.random from here on)
  spawnBushes();
  spawnWater();
  spawnHounds();

  R.lastSnapshotGen = state.generation;
  R.data = [];
}

// =============================================================================
// Data Recorder — per-generation snapshots
// =============================================================================

function takeSnapshot() {
  const alive = state.creatures.filter((c) => c.alive);
  const n = alive.length;

  // Species breakdown
  const speciesMap = {};
  for (const c of alive) {
    if (!speciesMap[c.speciesId])
      speciesMap[c.speciesId] = { name: c.speciesName, count: 0, creatures: [] };
    speciesMap[c.speciesId].count++;
    speciesMap[c.speciesId].creatures.push(c);
  }
  const speciesData = {};
  for (const [id, sp] of Object.entries(speciesMap)) {
    const avg = {};
    for (const key of Object.keys(GENOME_REGISTRY)) {
      let sum = 0;
      for (const c of sp.creatures) sum += c.genome[key];
      avg[key] = sum / sp.creatures.length;
    }
    speciesData[id] = { name: sp.name, count: sp.count, avgTraits: avg };
  }

  // Trait std dev (population diversity)
  const stdDev = {};
  const avg = state.avgTraits;
  if (Object.keys(avg).length > 0 && n > 1) {
    for (const key of Object.keys(GENOME_REGISTRY)) {
      let sumSq = 0;
      for (const c of alive) {
        const d = c.genome[key] - avg[key];
        sumSq += d * d;
      }
      stdDev[key] = Math.sqrt(sumSq / n);
    }
  }

  // Language metrics
  let vocabSum = 0,
    confSum = 0,
    confN = 0,
    epMemSum = 0;
  const allTokenSets = new Set();
  for (const c of alive) {
    const vs = c.productionVocab?.length || 0;
    vocabSum += vs;
    epMemSum += c.episodicMemory?.length || 0;
    if (vs > 0) {
      let mc = 0;
      for (const e of c.productionVocab) {
        if (e.confidence > mc) mc = e.confidence;
        allTokenSets.add(e.tokens.join(","));
      }
      confSum += mc;
      confN++;
    }
  }

  // Genetic diversity (avg pairwise distance across all alive)
  let totalDist = 0,
    pairs = 0;
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        totalDist += Creature.geneticDistance(alive[i], alive[j]);
        pairs++;
      }
    }
  }

  return {
    generation: state.generation,
    population: n,
    speciesCount: Object.keys(speciesMap).length,
    species: speciesData,
    avgTraits: avg,
    traitStdDev: stdDev,
    avgVocabSize: n > 0 ? vocabSum / n : 0,
    avgMaxConfidence: confN > 0 ? confSum / confN : 0,
    uniqueTokenSequences: allTokenSets.size,
    avgEpisodicMemorySize: n > 0 ? epMemSum / n : 0,
    geneticDiversity: pairs > 0 ? totalDist / pairs : 0,
    geneticPairs: pairs,
    houndPopulation: state.hounds.filter((h) => h.alive).length,
    time: (performance.now() - R.startTime) / 1000,
  };
}

// =============================================================================
// Headless Loop
// =============================================================================

function startResearch() {
  if (R.running) return;
  const seedInput = document.getElementById("research-seed");
  const maxGenInput = document.getElementById("research-max-gens");
  const countInput = document.getElementById("research-creature-count");

  // If the game was playing, reset gameStartTime so normal mode works later
  gameStartTime = performance.now();

  R.seed = parseInt(seedInput.value, 10) || 42;
  R.maxGenerations = parseInt(maxGenInput.value, 10) || 500;
  R.creatureCount = parseInt(countInput.value, 10) || 12;
  R.running = true;
  R.startTime = performance.now();

  // Seed RNG for deterministic execution
  seedRNG(R.seed);

  // Setup the world
  const count = R.creatureCount;
  state.creatures = [];
  state.bushes = [];
  state.water = [];
  state.hounds = [];
  state.births = [];
  state.deaths = [];
  state.speciationEvents = [];
  state.generation = 1;
  state.avgTraits = {};
  state.traitHistory = [];
  Creature._nextSpeciesId = 1;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = GAME_CONSTANTS.spawnRadius;
    const diet = ["herbivore", "carnivore", "omnivore"][i % 3];
    const config = { name: `C${i}`, id: i, genome: {}, diet };
    const x = WORLD.center.x + Math.cos(angle) * radius;
    const y = WORLD.center.y + Math.sin(angle) * radius;
    const creature = new Creature(config, x, y);
    creature.mugshot = "";
    state.creatures.push(creature);
  }
  spawnBushes();
  spawnWater();
  spawnHounds();

  R.lastSnapshotGen = state.generation;
  R.data = [takeSnapshot()];

  gameState = "research";

  // Toggle UI
  document.getElementById("research-run-btn").style.display = "none";
  document.getElementById("research-stop-btn").style.display = "";
  document.getElementById("research-status").textContent = "Running…";

  R._animId = requestAnimationFrame(researchTick);
}

function stopResearch() {
  R.running = false;
  if (R._animId) {
    cancelAnimationFrame(R._animId);
    R._animId = null;
  }
  unseedRNG();
  gameState = "setup";
  document.getElementById("research-run-btn").style.display = "";
  document.getElementById("research-stop-btn").style.display = "none";
  document.getElementById("research-status").textContent = "Stopped.";
  finalizeResearch();
}

function researchTick() {
  if (!R.running) return;

  const TICK_DT = 1 / 60;
  const ticks = R.ticksPerFrame;

  for (let i = 0; i < ticks; i++) {
    update(TICK_DT, TICK_DT);

    if (state.generation > R.lastSnapshotGen) {
      R.data.push(takeSnapshot());
      R.lastSnapshotGen = state.generation;
    }

    const alive = state.creatures.filter((c) => c.alive).length;
    if (alive === 0) {
      R.running = false;
      unseedRNG();
      gameState = "setup";
      document.getElementById("research-status").textContent =
        "Complete — extinction at gen " + state.generation;
      finalizeResearch();
      return;
    }
    if (state.generation >= R.maxGenerations) {
      R.running = false;
      unseedRNG();
      gameState = "setup";
      document.getElementById("research-status").textContent =
        "Complete — max generations reached.";
      finalizeResearch();
      return;
    }
  }

  const status = document.getElementById("research-status");
  const alive = state.creatures.filter((c) => c.alive).length;
  status.textContent = `Gen ${state.generation} | Pop ${alive} | Species ${Object.keys(R.data[R.data.length - 1]?.species || {}).length} | ${((performance.now() - R.startTime) / 1000).toFixed(1)}s`;
  updateResearchUI();

  R._animId = requestAnimationFrame(researchTick);
}

function finalizeResearch() {
  document.getElementById("research-run-btn").style.display = "";
  document.getElementById("research-stop-btn").style.display = "none";
  if (R.data.length > 0) {
    renderGenerationsTable();
    renderSpeciesTable();
    renderSpeciationLog();
    renderCharts();
    document.getElementById("research-export-bar").style.display = "";
    document.getElementById("research-status").textContent +=
      ` (${R.data.length} snapshots recorded)`;
  }
}

// =============================================================================
// UI — Render tables, logs, charts
// =============================================================================

function renderGenerationsTable() {
  const container = document.getElementById("research-gen-table");
  const d = R.data;
  if (!d || d.length === 0) {
    container.innerHTML = "<p>No data.</p>";
    return;
  }

  // Build column definitions from the first snapshot
  const cols = [
    { key: "generation", label: "Gen" },
    { key: "population", label: "Pop" },
    { key: "speciesCount", label: "Species" },
    { key: "houndPopulation", label: "Hounds" },
    { key: "geneticDiversity", label: "GenDiv" },
    { key: "avgVocabSize", label: "Vocab" },
    { key: "avgMaxConfidence", label: "Conf" },
    { key: "uniqueTokenSequences", label: "Tokens" },
    { key: "avgEpisodicMemorySize", label: "EpMem" },
    { key: "time", label: "Time(s)" },
  ];

  // Add physical trait columns
  for (const key of Object.keys(GENOME_REGISTRY)) {
    if (GENOME_REGISTRY[key].category === "physical") {
      cols.push({ key: "avg_" + key, label: key });
    }
  }

  let html = `<div style="overflow-x:auto;max-height:400px;overflow-y:auto"><table class="research-table">
    <thead><tr>${cols.map((c) => `<th data-col="${c.key}">${c.label}</th>`).join("")}</tr></thead><tbody>`;

  for (const snap of d) {
    html += "<tr>";
    for (const c of cols) {
      let val = c.key.startsWith("avg_")
        ? snap.avgTraits?.[c.key.slice(4)]
        : snap[c.key];
      if (typeof val === "number") val = val.toFixed(3);
      html += `<td>${val ?? ""}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  container.innerHTML = html;

  // Add sort-on-click
  container.querySelectorAll("th").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const key = th.dataset.col;
      const asc = th.dataset.asc !== "1";
      th.dataset.asc = asc ? "1" : "0";
      R.data.sort((a, b) => {
        let va = key.startsWith("avg_") ? a.avgTraits?.[key.slice(4)] : a[key];
        let vb = key.startsWith("avg_") ? b.avgTraits?.[key.slice(4)] : b[key];
        return asc ? va - vb : vb - va;
      });
      renderGenerationsTable();
    });
  });
}

function renderSpeciesTable() {
  const container = document.getElementById("research-species-table");
  const d = R.data;
  if (!d || d.length === 0) {
    container.innerHTML = "<p>No data.</p>";
    return;
  }

  // Aggregate species across all snapshots
  const speciesSummary = {};
  for (const snap of d) {
    for (const [id, sp] of Object.entries(snap.species || {})) {
      if (!speciesSummary[id]) {
        speciesSummary[id] = { name: sp.name, firstGen: snap.generation, lastGen: snap.generation, maxPop: sp.count, totalSnaps: 0 };
      }
      speciesSummary[id].lastGen = snap.generation;
      if (sp.count > speciesSummary[id].maxPop) speciesSummary[id].maxPop = sp.count;
      speciesSummary[id].totalSnaps++;
    }
  }

  let html = `<div style="overflow-x:auto;max-height:400px;overflow-y:auto"><table class="research-table">
    <thead><tr><th>Species</th><th>First Gen</th><th>Last Gen</th><th>Max Pop</th><th>Snapshots</th></tr></thead><tbody>`;
  for (const [id, sp] of Object.entries(speciesSummary)) {
    html += `<tr><td>${sp.name}</td><td>${sp.firstGen}</td><td>${sp.lastGen}</td><td>${sp.maxPop}</td><td>${sp.totalSnaps}</td></tr>`;
  }
  html += "</tbody></table></div>";
  container.innerHTML = html;
}

function renderSpeciationLog() {
  const container = document.getElementById("research-speciation-log");
  const events = state.speciationEvents || [];
  if (events.length === 0) {
    container.innerHTML = "<p>No speciation events recorded.</p>";
    return;
  }
  let html = `<div style="overflow-y:auto;max-height:400px"><table class="research-table">
    <thead><tr><th>Gen</th><th>Type</th><th>Parents</th><th>New Species</th></tr></thead><tbody>`;
  for (const ev of events) {
    const type = ev.parentSpeciesA && ev.parentSpeciesB ? "Hybrid" : "Split";
    html += `<tr><td>${ev.generation ?? "?"}</td><td>${type}</td><td>${ev.parentSpeciesA ?? "—"} ${ev.parentSpeciesB ? "× " + ev.parentSpeciesB : ""}</td><td>#${ev.childSpeciesId}</td></tr>`;
  }
  html += "</tbody></table></div>";
  container.innerHTML = html;
}

// =============================================================================
// Charts — Pure canvas line charts
// =============================================================================

function renderCharts() {
  drawPopChart();
  drawTraitChart();
  drawDiversityChart();
  drawLanguageChart();
}

function _chartCanvas(id) {
  const canvas = document.getElementById(id);
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = Math.floor(rect.width) || 400;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = 220 * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = "220px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { canvas, ctx, w, h: 220 };
}

function _drawGrid(ctx, w, h, pad, minY, maxY, nTicks) {
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const range = maxY - minY || 1;
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= nTicks; i++) {
    const y = pad.top + (i / nTicks) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText((maxY - (i / nTicks) * range).toFixed(1), pad.left - 4, y + 3);
  }
}

function _drawLine(ctx, data, pad, plotW, plotH, minY, maxY, color) {
  const range = maxY - minY || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + (i / Math.max(1, data.length - 1)) * plotW;
    const y = pad.top + plotH - ((data[i] - minY) / range) * plotH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawPopChart() {
  const { ctx, w, h } = _chartCanvas("chart-population");
  const pad = { top: 28, bottom: 22, left: 48, right: 16 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const pop = R.data.map((d) => d.population);
  const species = R.data.map((d) => d.speciesCount);
  const maxVal = Math.max(1, ...pop, ...species);

  ctx.clearRect(0, 0, w, h);
  _drawGrid(ctx, w, h, pad, 0, maxVal, 4);
  _drawLine(ctx, pop, pad, plotW, plotH, 0, maxVal, "#4a9");
  _drawLine(ctx, species, pad, plotW, plotH, 0, maxVal, "#e8a");

  ctx.fillStyle = "#aaa";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Population (green) & Species (purple)", w / 2, 14);
  ctx.fillStyle = "#555";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.fillText("gen →", w - pad.right, h - 4);
}

function drawTraitChart() {
  const { ctx, w, h } = _chartCanvas("chart-traits");
  const pad = { top: 28, bottom: 22, left: 48, right: 16 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // Choose 4 key physical traits
  const traitKeys = ["size", "speed", "strength", "intelligence"];
  const colors = ["#4a9", "#e8a", "#ea4", "#4ae"];
  const series = traitKeys.map((key) => R.data.map((d) => d.avgTraits?.[key] ?? 0));
  let minVal = Infinity,
    maxVal = -Infinity;
  for (const s of series) {
    for (const v of s) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  if (minVal === maxVal) maxVal = minVal + 0.1;

  ctx.clearRect(0, 0, w, h);
  _drawGrid(ctx, w, h, pad, minVal, maxVal, 4);

  for (let i = 0; i < series.length; i++) {
    _drawLine(ctx, series[i], pad, plotW, plotH, minVal, maxVal, colors[i]);
  }

  ctx.fillStyle = "#aaa";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Trait Averages", w / 2, 14);

  // Legend
  let lx = pad.left;
  ctx.font = "8px monospace";
  for (let i = 0; i < traitKeys.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(lx, h - 18, 8, 8);
    ctx.fillStyle = "#aaa";
    ctx.textAlign = "left";
    ctx.fillText(traitKeys[i], lx + 10, h - 11);
    lx += 60;
  }
}

function drawDiversityChart() {
  const { ctx, w, h } = _chartCanvas("chart-diversity");
  const pad = { top: 28, bottom: 22, left: 48, right: 16 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const div = R.data.map((d) => d.geneticDiversity);
  const maxVal = Math.max(0.01, ...div);

  ctx.clearRect(0, 0, w, h);
  _drawGrid(ctx, w, h, pad, 0, maxVal, 4);
  _drawLine(ctx, div, pad, plotW, plotH, 0, maxVal, "#e84");

  ctx.fillStyle = "#aaa";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Genetic Diversity", w / 2, 14);
  ctx.fillStyle = "#555";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.fillText("gen →", w - pad.right, h - 4);
}

function drawLanguageChart() {
  const { ctx, w, h } = _chartCanvas("chart-language");
  const pad = { top: 28, bottom: 22, left: 48, right: 16 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const vocab = R.data.map((d) => d.avgVocabSize);
  const tokens = R.data.map((d) => d.uniqueTokenSequences);
  const maxVal = Math.max(1, ...vocab, ...tokens);

  ctx.clearRect(0, 0, w, h);
  _drawGrid(ctx, w, h, pad, 0, maxVal, 4);
  _drawLine(ctx, vocab, pad, plotW, plotH, 0, maxVal, "#4ae");
  _drawLine(ctx, tokens, pad, plotW, plotH, 0, maxVal, "#ea4");

  ctx.fillStyle = "#aaa";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Language: Avg Vocab (blue) & Unique Tokens (orange)", w / 2, 14);
  ctx.fillStyle = "#555";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.fillText("gen →", w - pad.right, h - 4);
}

// =============================================================================
// Exports
// =============================================================================

function exportCSV() {
  if (R.data.length === 0) return;
  const rows = [];
  const headers = ["generation", "population", "speciesCount", "houndPopulation", "geneticDiversity", "avgVocabSize", "avgMaxConfidence", "uniqueTokenSequences", "avgEpisodicMemorySize", "time"];
  for (const key of Object.keys(GENOME_REGISTRY)) {
    headers.push("avg_" + key);
    headers.push("std_" + key);
  }
  rows.push(headers.join(","));
  for (const snap of R.data) {
    const vals = headers.map((h) => {
      let v;
      if (h.startsWith("avg_")) v = snap.avgTraits?.[h.slice(4)];
      else if (h.startsWith("std_")) v = snap.traitStdDev?.[h.slice(4)];
      else v = snap[h];
      return v != null ? v.toFixed(4) : "";
    });
    rows.push(vals.join(","));
  }
  downloadBlob(rows.join("\n"), "research-data.csv", "text/csv");
}

function exportJSON() {
  if (R.data.length === 0) return;
  const blob = JSON.stringify({ seed: R.seed, maxGenerations: R.maxGenerations, creatureCount: R.creatureCount, snapshots: R.data }, null, 2);
  downloadBlob(blob, "research-data.json", "application/json");
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================================
// UI Init
// =============================================================================

function initResearchUI() {
  const runBtn = document.getElementById("research-run-btn");
  const stopBtn = document.getElementById("research-stop-btn");
  const csvBtn = document.getElementById("research-export-csv");
  const jsonBtn = document.getElementById("research-export-json");

  runBtn.addEventListener("click", startResearch);
  stopBtn.addEventListener("click", stopResearch);
  csvBtn.addEventListener("click", exportCSV);
  jsonBtn.addEventListener("click", exportJSON);

  // Tab switching
  document.querySelectorAll(".research-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".research-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".research-tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const tab = document.getElementById("research-tab-" + btn.dataset.tab);
      if (tab) tab.classList.add("active");

      // Re-render charts when switching to chart tab (sizing fix)
      if (btn.dataset.tab === "charts" && R.data.length > 0) {
        // Delay to allow layout
        setTimeout(renderCharts, 50);
      }
    });
  });

  // Run on Enter key in input fields
  document.querySelectorAll("#research-seed, #research-max-gens, #research-creature-count").forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startResearch();
    });
  });
}

function updateResearchUI() {
  // The status is updated inline in researchTick
  // Could also update a mini-table here if needed
}

// Boot
document.addEventListener("DOMContentLoaded", initResearchUI);
