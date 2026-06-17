# Bug Audit & Unhardcoding Refactor Plan

## Bugs Found (Severity: 🔴 Critical / 🟡 Moderate / 🟢 Cosmetic)

### 🔴 Bug 1: `hideRecap` ignores `GAME_CONSTANTS.dayLength`
- **Location:** `js/main.js` ~line 1833
- **Issue:** `state.dayTimer = 60;` is hardcoded. If `GAME_CONSTANTS.dayLength` is changed to anything else, resuming from recap desyncs.
- **Fix:** Use `GAME_CONSTANTS.dayLength`.

### 🔴 Bug 2: Replay weapon attack frame is inconsistent with live render
- **Location:** `js/peep.js` `renderFromSnapshot` ~line 1877
- **Issue:** `isAttacking = snapshot.state === "attack" && snapshot.attackTime < 2.0` uses `2.0`, but the live `renderWeapon` uses `< 0.75`. This causes weapons to snap back to idle too early in replays, or stay attacking too long.
- **Fix:** Use a shared constant `COMBAT.REPLAY_ATTACK_FRAME_THRESHOLD` (or unify with `0.75`).

### 🟡 Bug 3: "Lover in trouble" actually means "lover is attacking someone"
- **Location:** `js/peep.js` ~line 785
- **Issue:** `if (lover && lover.state === "attack")` triggers defender mode when the lover is the aggressor, not when they are in danger. It should check if the lover is being targeted (`someone.attackTarget === lover`) or is fleeing/panicking.
- **Fix:** Check for `lover.state === "flee" || lover.state === "panic"` or if any enemy has `attackTarget === lover`.

### 🟡 Bug 4: Stale alliance commands after leader dies
- **Location:** `js/peep.js` `update()` ~line 640
- **Issue:** If a charismatic leader dies, `alliance.commandTargetId` persists forever. Followers continue obeying a ghost order.
- **Fix:** Add an alliance command TTL (time-to-live) checked in `update()`.

### 🟡 Bug 5: `escapeAttr` aliases `escapeHtml`
- **Location:** `js/main.js`
- **Issue:** HTML escaping and attribute escaping have different requirements. `' '` is safe in HTML but not in unquoted attributes. Current usage is quoted so it's low severity.
- **Fix:** Keep as-is for now since all attributes are quoted, but document.

### 🟢 Bug 6: Multiple `performance.now()` calls within single update frame
- **Location:** `js/main.js` `update()`
- **Issue:** `const now = performance.now();` is used for event timing, but `dt` is derived from `requestAnimationFrame`. Event ordering may jitter by microseconds.
- **Fix:** Pass a single `now` value down through the world context.

## Unhardcoding Strategy

### New `CONSTANTS` object (in `js/config.js`)
Group all magic numbers into namespaced categories:

```js
const CONSTANTS = {
  CANVAS: { logicalWidth: 960, logicalHeight: 540, halfWidth: 480, halfHeight: 270 },
  CAMERA: { defaultZoom: 0.45, zoomMin: 0.3, zoomMax: 2.0, zoomStep: 1.1, panThreshold: 2 },
  TRIBUTE: { min: 2, max: 24, default: 12, nameMaxLength: 24 },
  DISTRICT: { min: 1, max: 12 },
  DAY: { length: 60, nightTransitionStart: 5, nightOpacity: 0.5 },
  RECAP: { rollingHistoryMax: 180, captureFrames: 60, replayScale: 0.8, clipPadding: 250 },
  AI: { brainInterval: 8.5, brainReset: 8.0, overrideDuration: 10000, concurrency: 3 },
  ALLIANCE: { vicinity: 105, desireThreshold: 42, leaderDesireThreshold: 30, proposalCooldown: 6000 },
  SLOW_MO: { scale: 0.28, duration: 1.15 },
  // ... etc
};
```

### Files to Touch
1. `js/config.js` — append the mega-constants object
2. `js/main.js` — replace ~80 hardcoded numbers with `CONSTANTS.*`
3. `js/peep.js` — replace ~120 hardcoded numbers with `CONSTANTS.*`
4. `js/ai-controller.js` — replace API/model constants with `CONSTANTS.AI.*`

### Regression Testing
- Open `index.html` in browser
- Start a game with 12 tributes
- Verify: movement, combat, death effects, recap, night overlay, AI brain (if key provided), player possession, fog of war, super speed trails, laser eyes
