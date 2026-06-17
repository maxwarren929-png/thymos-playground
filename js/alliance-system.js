function createDistrictAlliances() {
  const byDistrict = new Map();
  for (const peep of state.peeps) {
    if (!byDistrict.has(peep.district)) byDistrict.set(peep.district, []);
    byDistrict.get(peep.district).push(peep);
  }
  for (const members of byDistrict.values()) {
    if (members.length > 1) createAlliance(members, "district", CONSTANTS.ALLIANCE.START_STRENGTH_DISTRICT, performance.now());
  }
}

function createAlliance(members, type = "cross_district", strength = 55, frameNow = performance.now()) {
  const uniqueMembers = [...new Set(members)].filter((peep) => peep?.alive);
  if (uniqueMembers.length < 2) return null;
  const alliance = {
    id: nextAllianceId,
    members: uniqueMembers.map((peep) => peep.id),
    type,
    strength,
    createdAt: frameNow,
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

function requestAlliance(proposer, candidate, frameNow = performance.now()) {
  if (!proposer?.alive || !candidate?.alive || areAllied(proposer, candidate)) return false;
  const dist = Math.hypot(candidate.x - proposer.x, candidate.y - proposer.y);
  if (dist > CONSTANTS.ALLIANCE.VICINITY) return false;
  const proposerRel = proposer.relationshipWith(candidate);
  const candidateRel = candidate.relationshipWith(proposer);
  const proposerScore = proposer.allianceDesire(candidate, proposerRel, dist);
  const candidateScore = candidate.allianceDesire(proposer, candidateRel, dist);
  if (proposerScore < CONSTANTS.ALLIANCE.DESIRE_THRESHOLD || candidateScore < CONSTANTS.ALLIANCE.DESIRE_THRESHOLD) return false;

  const alliance = mergeOrCreateAlliance(proposer, candidate, frameNow);
  if (!alliance) return false;

  // Record event for recap
  pushAllEvent({
    type: "alliance",
    proposer: { name: proposer.name, district: proposer.district },
    candidate: { name: candidate.name, district: candidate.district },
    timestamp: frameNow,
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

function mergeOrCreateAlliance(a, b, frameNow = performance.now()) {
  if (a.allianceId && a.allianceId === b.allianceId) return getAlliance(a.allianceId);
  removeFromAlliance(a);
  removeFromAlliance(b);
  return createAlliance([a, b], "cross_district", CONSTANTS.ALLIANCE.START_STRENGTH_CROSS, frameNow);
}

function breakAlliance(actor, target, frameNow = performance.now()) {
  if (!actor?.allianceId || !target?.allianceId || actor.allianceId !== target.allianceId) return false;
  const alliance = getAlliance(actor.allianceId);
  if (!alliance) return false;

  // Record event for recap
  pushAllEvent({
    type: "betrayal",
    actor: { name: actor.name, district: actor.district },
    target: { name: target.name, district: target.district },
    timestamp: frameNow,
    clip: captureClip(actor.x, actor.y),
  });

  actor.allianceId = null;
  alliance.members = alliance.members.filter((id) => id !== actor.id);
  target.remember("betrayed_me", actor, 1.4);
  for (const peep of alivePeeps()) {
    if (peep !== actor && peep.allianceId === alliance.id) peep.remember("betrayed_me", actor, 0.7);
  }
  // Gossip: let nearby tributes observe the betrayal
  state.peeps.forEach((p) => { if (p.alive) p.observeBetrayal(actor, target, state); });
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
