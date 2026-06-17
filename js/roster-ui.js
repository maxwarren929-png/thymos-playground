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
      ? traitPart.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '_')).filter(t => traitKeys.includes(t))
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
