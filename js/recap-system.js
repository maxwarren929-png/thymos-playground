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
  if (!frames.length) return { frames: [], x: cap.data.victim.x, y: cap.data.victim.y, zoom: 1 };
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

// === RECAP LOGIC ===

function showRecap() {
  // Flush any active death captures before switching to recap
  // so deaths in the final seconds of a day aren't lost
  state.activeCaptures.forEach(cap => {
    const clip = buildDynamicClip(cap);
    pushAllEvent({ ...cap.data, clip });
  });
  state.activeCaptures = [];

  // Force process any pending events before showing recap
  // Use pre-captured frames stored at event creation so clips match the right moment
  state.pendingEvents.forEach(e => {
      e.data.clip = { frames: e.clipFrames || state.rollingHistory.slice(), x: e.x, y: e.y };
      pushAllEvent(e.data);
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
