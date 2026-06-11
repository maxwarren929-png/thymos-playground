# 🏆 Hunger Games Simulator — Spec

## Elevator Pitch
A real-time browser game where you set up named tributes in districts, drop them into a big tiled arena with weapons at the center, and watch them fight to the death. You pan/zoom the camera like a god observing from above. No direct control — only observation and (later) Gamemaker interventions.

---

## 1. Setup Screen

Full-screen HTML overlay before the game starts.

### Controls
- **Tribute count**: spinner 2–24
- **Tribute list**: dynamically generated rows
  - Each row: number, text input (name), district number input
  - Default districts: pairs (1,1, 2,2, 3,3 …)
- **Start button**: validates all names filled, hides overlay, creates game

### State
All tribute configs live in memory — no persistence needed.

---

## 2. The Arena

### Dimensions
- **Map**: 3000 × 1800 world units
- **Canvas**: 960 × 540 CSS pixels (scaled to fit viewport)
- **Tiles**: `bg.png` (1160×740) repeated in a 3×3 grid, centered so the middle tile roughly covers the Cornucopia area

### Camera
- **Pan**: right-click drag
- **Zoom**: scroll wheel, clamped 0.3× – 2×
- **Bounds**: camera center can't leave the map edges (accounts for zoom)
- **Transform**: `translate(center) → scale(zoom) → translate(-camera)` applied to all world rendering

---

## 3. Sprites (from wbwwb)

### Sprite System
- **Format**: TexturePacker JSON + PNG pairs
- **Parser**: regex `name.replace(/(\D+)0+(\d+)/, '$1$2')` normalises frame names (e.g. `body0000` → `body0`)
- **Atlas loader**: `SpriteAtlas` class loads JSON + PNG via fetch, creates `Image` from blob URL
- **Manager**: `SpriteLayers` class holds named atlases, has `get(name)` and `add(name, jsonPath, pngPath)`

### Atlases Required
| Key | Files |
|---|---|
| `body` | body.json, body.png (frames 0–1: circle, square) |
| `body_red` | body_red.json, body_red.png (same layout, red variant) |
| `face` | face.json, face.png (frames 0–12: expressions) |
| `cursor` | cursor.json, cursor.png (single frame) |
| `weapons_gun` | weapon_gun.json, weapon_gun.png (frames 0–7) |
| `weapons_bat` | weapon_bat.json, weapon_bat.png |
| `weapons_shotgun` | weapon_shotgun.json, weapon_shotgun.png |
| `weapons_axe` | weapon_axe.json, weapon_axe.png |
| `gore_bodies` | gore_bodies.json, gore_bodies.png (12 frames) |
| `gore` | gore.json, gore.png (3 frames) |
| `blood` | blood.json, blood.png (3 frames) |

### Background Image
- `sprites/bg.png` loaded directly as an `Image` (not via atlas)
- Used as tiled background

---

## 4. Tributes (Peeps)

### Properties
| Field | Type | Description |
|---|---|---|
| `id` | number | Unique index |
| `name` | string | User-provided |
| `district` | number | User-provided, determines team |
| `bodyFrame` | 0–1 | Random circle(0) or square(1), cosmetic |
| `isRed` | bool | ~5% chance, uses body_red sprite |
| `alive` | bool | |
| `health` | number | Starts at 4, max 4 |
| `weapon` | string | `null` until picked up from ground |
| `hasWeapon` | bool | |
| `kills` | number | Incremented on kill |
| `stats` | object | Strength, speed, eyesight, loyalty, aggression, friendliness |
| `relationships` | Map | Per-tribute trust, fear, anger, bond, and last-seen state |
| `memories` | array | Recent events that alter relationships |
| `allianceId` | number \| null | Active alliance membership |
| `state` | enum | See state machine below |

### Movement (matching original wbwwb)
- `hop += speed / 40` (cycles 0→1)
- Sway: `rotation = sin(hop·2π) × 0.1`
- Hop bob: `pivot.y = abs(sin(hop·2π)) × 10`
- Bounce squash at bottom of hop cycle
- Velocity smoothing: `vel = vel×0.9 + v×0.1`
- Render scale: `0.65 × bounce × flip` (width), `0.65 / bounce` (height)

### State Machine
| State | Trigger | Behaviour |
|---|---|---|
| `rush_center` | Game start | Charged toward Cornucopia (1500, 900) at speed 3+. Transitions to `wander` after 5s or when within 120px of center. |
| `wander` | Default | Random direction wander. If enemy within 200px → `charge`. |
| `flee_cursor` | _removed_ | _removed_ |
| `charge` | Enemy spotted | Move toward nearest enemy at speed 2+. If within 48px and weapon ready → `attack`. |
| `attack` | In range | Pause, animate weapon (frame 6). Deal damage at t=0.15s. Return to `charge`. |

### Goal System
Each tribute tracks a current goal for more readable behavior:

| Goal | Behaviour |
|---|---|
| `rush_center` | Push toward the Cornucopia |
| `scavenge_weapon` | Move toward a visible ground weapon |
| `hunt` | Chase a selected non-allied tribute |
| `flee` | Move away from danger or the Cornucopia |
| `regroup` | Move toward a distant ally |
| `hide` | Drift away and avoid conflict |
| `wander` | Default low-priority roaming |

Opening goals are chosen from stats/profile so not everyone behaves identically at the bloodbath: aggressive tributes rush, fast tributes may grab weapons, timid tributes may flee, and high-eyesight cautious tributes may skirt the center.

### Legacy District / Team Rules
The original district-only ally rules were replaced by the explicit alliance system below.

### Tribute Identity
Each tribute receives six stats from 1-10:

| Stat | Effect |
|---|---|
| `strength` | Adds damage to melee weapons and fists only |
| `speed` | Multiplies movement, chase, flee, and scavenge speed |
| `eyesight` | Extends detection range for tributes and ground weapons |
| `loyalty` | Reduces betrayal pressure and makes alliances last longer |
| `aggression` | Increases willingness to hunt, chase, and betray |
| `friendliness` | Increases willingness to propose and accept alliances |

### Relationships / Memory
Every tribute tracks trust, fear, anger, bond, and last-seen state toward every other tribute.
Memories currently include `attacked_me`, `fought_beside_me`, `killed_ally`, and `betrayed_me`.

### Current Alliance Rules
- Alliances are explicit objects with member ids, type, strength, and creation time.
- District partners start in a `district` alliance, but district alone no longer guarantees permanent safety.
- Cross-district alliances require mutual agreement based on friendliness, loyalty, trust, bond, danger, aggression, anger, and distance. Tributes must be within 105 world units to form an alliance.
- A tribute can betray an ally when aggression/opportunity/final-game pressure beats loyalty, trust, and bond. Betrayal pressure rises as fewer tributes remain.
- When only one alliance remains, final alliance pressure begins and alliance strength decays instead of instantly forcing free-for-all.

### Combat
- Armed: 3 damage per hit (2 hits to kill)
- Unarmed: 1 damage per hit (4 hits to kill)
- Kill increments `this.kills`, records `_deathBy` for death log

### Weapon Pickup
- Tribute walks within 35px of a ground weapon → equips it
- `equipWeapon(type)` sets `weapon` and `hasWeapon`
- On death: weapon drops back to the ground at the corpse location

### Rendering Layers (back to front)
1. Body (`body${frame}` or `body_red${frame}`)
2. Face (`face${idx}` — blink override: frame 2)
3. Weapon (`weapon_${type}${frame}` — frame 4=rest, 6=BAM)

### Face Labels
The face atlas is numeric, but the simulator labels frames for identity/debug UI:

| Frame | Label |
|---|---|
| `face0` | neutral |
| `face1` | calm |
| `face2` | blink |
| `face3` | shocked |
| `face4` | uneasy |
| `face5` | annoyed |
| `face6` | happy |
| `face7` | worried |
| `face8` | friendly |
| `face9` | angry |
| `face10` | furious |
| `face11` | panicked |
| `face12` | crying |

### Hover Label (screen-space, outside camera transform)
- Position: world-to-screen converted, drawn at that screen position
- **Background pill**: rounded rect, dark semi-transparent
- **Name**: white 12px
- **District**: gold 10px, above name
- **Health bar**: 28×4px, green (health>1) or red

---

## 5. Cursor Entity

### World-Space Physical Object
| Property | Value |
|---|---|
| Radius | 16 |
| Health | 20 |
| Spawn | Map center (1500, 900) |
| Death | Health reaches 0 → 2s respawn timer |

### Behaviour
- Follows mouse world position (updated every mousemove, except during pan)
- Peeps react to cursor proximity (flee state when within 120px)
- Clicking creates a visual **shockwave** ring (cosmetic only for now)
- `mouseMoved(x, y)` sets world position (unless dead)
- Rendering via `cursor0` frame from cursor atlas

---

## 6. Ground Weapons

### Initial Spawn
- 8 weapons placed in a circle (radius 80px) around Cornucopia center
- Distribution: 2 of each type (gun, bat, shotgun, axe), shuffled

### Properties
| Field | Type |
|---|---|
| `x` | number |
| `y` | number |
| `type` | string: 'gun' \| 'bat' \| 'shotgun' \| 'axe' |

### Rendering
- Faint golden circle glow (radius 18, alpha 0.08)
- Weapon sprite at scale 0.45, frame 4 (rest pose)
- Fallback: filled gold circle if atlas missing

### Dropping
- When a tribute dies with a weapon, it's added to `groundWeapons` with a small random offset

---

## 7. Death System

### Death Processing (per death per tick)
1. **Death data**: `tribute.die(killer)` returns `{name, district, x, y, weapon, side, kills, killedBy}`
2. **Weapon drop**: if tribute had weapon, push to `groundWeapons`
3. **Death log entry**: formatted kill message + 🔔 cannon announcement
4. **Effects**:
   - **Blood splat** (`blood0`–`blood2`): 1, scale 0.3–0.7, life 3–5s
   - **Gore particles** (`gore0`–`gore2`): 5–30 particles based on weapon, ejected with velocity, z-bounce physics
   - **Corpse** (`gore_bodies`): frame formula `(weaponIdx+2)×2 + sideOffset` (0=circle, 1=square), with z-arc and landing

### Gore Particle Physics
- `vx`, `vy` (horizontal), `vz` (vertical z)
- Z-gravity: 0.4
- Bounce on landing: if `|vz| > 1`, reverse with damping × -0.2
- Rotation: `vr` applied per frame
- Fade out: alpha based on remaining life

### Corpse Physics
- `vz` initial: -1.5 to -3.5 (arc up)
- Z-gravity: 0.15 (gentler than gore)
- Rotates during flight at 4 rad/s
- Stops completely on landing (`onGround = true`)

---

## 8. Effects System

### Types
| Type | Sprite | Behaviour |
|---|---|---|
| `splat` | `blood0–2` | Ground stain, fades over 3–5s |
| `gore_particle` | `gore0–2` | Flying particle with z-bounce physics |
| `corpse` | `gore_bodies` | Body with z-arc, lands, stays for 10s |

### Slow Motion
Fatal hit events trigger a global slow-motion window:
- Time scale drops to 0.28x for about 1.15 seconds.
- Camera focus remains on the fatal hit location longer than normal hits.
- A subtle `SLOW MOTION` overlay is rendered while the effect is active.

### Depth Sort (Y-order)
1. Ground splats (behind everything)
2. Alive peeps
3. Corpses (accounting for z-height)
4. Gore particles (accounting for z-height)

---

## 9. Death Log

In-memory array of `{text, isCannon}` entries. Rendered in the right-side HTML panel.

### Entry Types
- **Kill**: `<span class="killer">${name}</span> (D${district}) killed <span class="victim">${name}</span> (D${district}) with ${weapon} ${emoji}`
- **Cannon**: `🔔 N tributes remain` (gold, centered, smaller font)
- **Alliance break**: `💔 ALLIANCE BROKEN — every tribute for themselves!` (cannon style)

### Weapon Names / Emoji
| Weapon | Name | Emoji |
|---|---|---|
| `gun` | a spear | 🔱 |
| `bat` | a club | 🏏 |
| `shotgun` | a bow | 🏹 |
| `axe` | an axe | 🪓 |
| `fists` | their fists | 👊 |

### UI
- Panel: 220px wide, 540px tall, right of canvas
- Log scrolls, newest at top, max 30 visible
- CSS-styled death entries

---

## 10. Victory

### Condition
- `alive tributes ≤ 1` → game ends

### Screen (HTML overlay)
- Crown emoji
- "THE VICTOR" heading (gold)
- Winner name (large, white)
- "District N · X kills"
- "PLAY AGAIN" button → reloads page

### Edge Case
- 0 alive → "No one" / "Everyone died..."

---

## 11. User Input

| Input | Action |
|---|---|
| Left click | Shockwave (+ future Gamemaker powers) |
| Right-click drag | Pan camera |
| Scroll wheel | Zoom (0.3×–2×) |
| Mouse move | Cursor entity follows (screen→world) |
| Hover near tribute | Name + D# + health bar label |

---

## 12. Event Flow

```
Page Load
  ↓
init():
  loadSprites()        – fetch + parse all atlases + bg image
  setupSetupScreen()   – create HTML form
  resizeCanvas()
  start game loop
  ↓
User sets tributes + clicks START
  ↓
startGame(configs):
  clear arrays, create Peep instances (ring around center)
  spawn 8 ground weapons (circle around Cornucopia)
  hide setup overlay, show canvas
  set gameState = 'playing'
  ↓
gameLoop (60fps):
  update(dt):
    – peep.update() each (movement, combat, weapon pickup)
    – process deaths → effects + death log
    – alliance check
    – victory check
    – cursor.update()
    – effects physics + fade
    – hover detection
    – camera bounds clamp
  render():
    – clear + camera transform
    – tiled bg
    – ground weapons
    – depth-sorted entities (splat → peep → corpse → gore → cursor)
    – screen-space hover label
    – zoom hint overlay (first 5s)
```

---

## 13. Project File Structure

```
cursor-worshippers/
├── index.html            – setup overlay, game canvas, info panel, victory overlay
├── style.css             – all styles (setup form, game layout, death log, victory)
├── favicon.svg           – trophy emoji as favicon
├── sprites/
│   ├── bg.png            – arena background tile (1160×740)
│   ├── peeps/
│   │   ├── body.json / .png          – circle(0), square(1)
│   │   ├── body_red.json / .png      – red variant
│   │   ├── face.json / .png          – 13 expression frames
│   │   ├── weapon_gun.json / .png    – 8 animation frames
│   │   ├── weapon_bat.json / .png
│   │   ├── weapon_shotgun.json / .png
│   │   ├── weapon_axe.json / .png
│   │   ├── gore_bodies.json / .png   – 12 corpse frames
│   │   ├── gore.json / .png          – 3 blood splatter frames
│   │   └── blood.json / .png         – 3 ground stain frames
│   └── misc/
│       └── cursor.json / .png        – single frame
└── js/
    ├── sprite-loader.js  – SpriteAtlas + SpriteLayers classes
    ├── peep.js           – Peep class (tribute)
    ├── cursor-entity.js  – CursorEntity class
    └── main.js           – game state, setup, loop, camera, death log, rendering
```

---

## 14. Future / Gamemaker Powers (not yet implemented)

- Left-click to drop supplies / weapons
- Right-click to trigger disasters (lightning, fire)
- Sponsor gifts (heal nearest tribute)
- Force field push
- Sound effects
- Pause / slow-motion
- Replay / highlight reel
