# Hunger Games Simulator — Traits & Characters Design Spec

**Purpose:** This document defines how tribute traits and character presets work in the Hunger Games Simulator. Use it to design new traits or characters without reading any code.

---

## 1. What Are Stats?

Every tribute has **6 base stats**, each ranging from **1 to 10**. These stats are randomly rolled at creation but can be overridden by traits or character presets.

| Stat | What It Does |
|------|-------------|
| **Strength** | Adds bonus damage with melee weapons and fists. Higher = hits harder. |
| **Speed** | Multiplies movement speed — chase, flee, and scavenge are all faster. |
| **Eyesight** | Extends detection range for spotting enemies and ground weapons. Higher = sees farther. |
| **Loyalty** | Makes alliances last longer and reduces the chance of betrayal. |
| **Aggression** | Increases willingness to hunt, chase, attack first, and betray allies. |
| **Friendliness** | Increases willingness to propose and accept alliances. |

### Default Rolls
When a tribute is created without overrides, each stat is rolled randomly within 1–10. Two tributes from the same district start with high trust and bond toward each other.

---

## 2. What Are Traits?

Traits are **named modifiers** that can be assigned to a tribute via the setup screen. Each trait does one or more of:

- **Overrides stats** to specific values (e.g., "aggression: 10")
- **Grants abilities** — special properties or powers (e.g., flight, regeneration)
- **Gives a starting weapon** (e.g., sniper starts with a gun)

### Existing Traits (Design Reference)

| Trait | What It Does | Design Notes |
|-------|-------------|--------------|
| **Bloodthirsty** | aggression = 10 | Always wants to fight. Will attack relentlessly. |
| **Sprinter** | speed = 5 | Moves faster than average across all behaviors. |
| **Tank** | strength = 3, maxHealth = 8 | Takes more hits to kill. Hard to put down. |
| **Sniper** | eyesight = 5, starts with gun | Sees enemies from very far. Can engage at range. |
| **Pacifist** | friendliness = 8, aggression = 1 | Very friendly, hates fighting. Will avoid combat and seek allies. |
| **Stealthy** | stealthModifier = 0.5 (enemies detect you at half range) | Harder to spot. Can sneak past enemies. |
| **Lucky** | damageReduction = 20% (takes 20% less damage from all sources) | Survives hits that would kill others. |
| **Scavenger** | scavengerMultiplier = 2 (finds weapons from twice as far) | Spots and grabs gear more easily. |
| **Berserker** | aggression = 10, strength = 5, maxHealth = -2 | Glass cannon bruiser. Hits hard but dies fast. |
| **Glass Cannon** | strength = 10, aggression = 8, maxHealth = -3 | Extreme glass cannon. Hits harder than anything but is very fragile. |
| **Psychopath** | aggression = 10, healOnKill = 1 (heals 1 HP per kill) | Gets stronger by killing. Rewarded for aggression. |
| **Medic** | regeneration = 0.15 HP/second | Slowly heals over time. Survives longer in drawn-out games. |
| **Thick Skinned** | armor = 1 (reduces damage by 1 per hit) | Every hit does 1 less damage. Great against fists but still vulnerable to weapons. |
| **Vampiric** | lifesteal = 40% (heals 40% of damage dealt) | Heals while fighting. Rewarded for being aggressive in combat. |
| **Giant** | strength = 4, maxHealth = 12, visualScale = 1.5×, speed debuff (slower) | Huge and tough but slow. Easy to see and hit. |
| **Tiny** | speed = 4, maxHealth = -2, visualScale = 0.65× | Small and fast but fragile. Hard to hit. |
| **Explosive** | explodeOnDeath (creates a damaging explosion on death) | Taking them out is risky — they might take you with them. |
| **Charismatic** | friendliness = 10, loyalty = 5, allianceBonus, canCommand, recruitmentRange = 200 | Natural leader. Easier to form alliances and can give tactical orders. |
| **Flight** | can fly (moves over obstacles, harder to pin down) | Avoids ground threats. Can reposition easily. |
| **Laser Eyes** | has super-powerful ranged attack (100 damage, 600 range) | Devastating weapon, but it's a special ability, not a standard weapon. |

### Design Rules for New Traits

When inventing a new trait, decide which **slot** it fills:

1. **Stat Override** — pushes a stat to a specific value. Usually one extreme (e.g., strength: 10, or friendliness: 1).
2. **Ability Grant** — adds a special property not covered by stats (see section 3 for all possible abilities).
3. **Starting Weapon** — gives the tribute a weapon from the start.
4. **Mixed** — a little of everything (e.g., a glass cannon trait gives strength and aggression but reduces health).

**Balance guidelines:**
- A trait should have a clear **strength AND a weakness** (or a clear tradeoff).
- Multiple traits can stack on the same tribute.
- Avoid creating traits that make a tribute unkillable or that completely negate another trait.
- Extreme stats (1 or 10) should feel extreme in gameplay.

---

## 3. Abilities Reference

These are the raw ability modifiers that traits can grant. Each has a specific gameplay effect.

| Ability | Effect | Valid Range |
|---------|--------|-------------|
| `maxHealth` | Sets max HP directly | 1–20+ |
| `maxHealthDelta` | Adds/subtracts from current max HP | -10 to +10 |
| `isFlying` | Tribute moves in the air, ignores ground obstacles | true/false |
| `hasLaserEyes` | Grants super-ranged attack (100 dmg, 600 range) | true/false |
| `healOnKill` | Heals this many HP per kill | 1–4 |
| `regeneration` | Passive HP regen per second | 0.05–0.5 |
| `armor` | Flat damage reduction per hit | 1–3 |
| `damageReduction` | % damage reduction (multiplicative) | 0–0.9 |
| `lifesteal` | % of damage dealt returned as healing | 0–0.8 |
| `stealthModifier` | Enemy detection range multiplier | 0.2–2 |
| `scavengerMultiplier` | Weapon pickup detection range multiplier | 0.2–4 |
| `speedDebuff` | Movement speed multiplier | 0.2–2 |
| `visualScale` | Render size multiplier | 0.5–2 |
| `explodeOnDeath` | Explodes on death, damaging nearby tributes | true/false |
| `allianceBonus` | Extra alliance-swaying power (makes others trust you faster) | 10–100 |
| `canCommand` | Can issue tactical commands to alliance members | true/false |
| `recruitmentRange` | Max distance for alliance proposals | 50–300 |

---

## 4. What Are Character Presets?

Character presets are **named characters** (like "Superman" or "Leader") that bundle a specific set of traits, stat overrides, and abilities. When a tribute's name matches a character preset (case-insensitive), those traits and overrides are automatically applied on top of whatever traits the user selected.

Think of them as **pre-made builds** — a way to guarantee a specific tribute behaves in a specific way without manual trait selection.

### Existing Character Presets (Design Reference)

| Character | Traits Applied | Stat Overrides | Ability Overrides | What Makes Them Unique |
|-----------|---------------|---------------|-------------------|----------------------|
| **Superman** | Flight + Laser Eyes | strength: 100, speed: 100 | maxHealth: 16 | Nearly unstoppable — flies, has super vision attack, massive HP, extreme stats. A deliberate joke/OP character. |
| **Leader** | Charismatic | friendliness: 20, loyalty: 10, eyesight: 8 | — | Maxed-out social stats plus leadership. Can command allies from very far. |

### Design Rules for New Character Presets

1. **Choose a theme** — The character name should strongly telegraph what they do (e.g., "Superman" = OP, "Leader" = social).
2. **Select 1–3 traits** that fit the theme.
3. **Optionally override stats** to emphasize the fantasy (stats can EXCEED the normal 1–10 range).
4. **Optionally add ability overrides** for unique mechanics not covered by traits.
5. **Don't make every character a preset** — presets are special. Use them sparingly for Easter eggs, references, or deliberately designed builds.

---

## 5. Behavioral Profiles

Beyond stats and traits, each tribute gets a **behavioral profile** that determines their fighting style. The profile is computed from their stats at creation:

| Profile | What They Do |
|---------|-------------|
| **Runner** (~25%) | Quick to leave the Cornucopia. Avoids fights when unarmed. Long retreats. |
| **Scavenger** (~27%) | Stays near center to grab gear, then leaves. Aggression-based hunting. |
| **Wanderer** (~24%) | Balanced. Moderate time at center, moderate hunting, moderate fleeing. |
| **Hunter** (~19%) | Stays at center longer, very aggressive hunting when armed, almost never flees. |
| **Berserker** (~5%) | Never leaves the center. Always attacks. Never retreats. Infinite awareness range. |

A tribute's profile affects:
- How long they stay at the Cornucopia at the start
- How far they detect enemies
- How aggressively they chase enemies (armed vs unarmed)
- How quickly they retreat and how far
- Whether they retreat at all after getting a weapon

Traits and stats shift which profile a tribute is likely to get — high aggression pushes toward Hunter/Berserker, low aggression pushes toward Runner/Wanderer.

---

## 6. Relationships & Social Mechanics

These are not directly controlled by traits but are important context for designing social traits:

- **Trust** — starts at 75 for same-district, ~10–25 for strangers. Grows through fighting together.
- **Bond** — starts at 70 for same-district, ~0–10 for strangers. Emotional attachment.
- **Fear** — increases when witnessing kills or being attacked.
- **Anger** — increases when attacked or when allies are killed.
- **Memories** — tributes remember events like `attacked_me`, `fought_beside_me`, `killed_ally`, `betrayed_me`.

High friendliness + loyalty = great ally material. High aggression + low loyalty = betrayal waiting to happen.

### Romance
Two tributes can fall in love if they spend **15 cumulative seconds within 120 units** of each other AND have trust > 80 and bond > 70. When one dies, the other mourns for 20 seconds (lover shirt/hat visible), then moves on.

---

## 7. Weapons Reference

Tributes can use these weapons. Weapons deal 3 damage (except fists = 1).

| Weapon | Range | Notes |
|--------|-------|-------|
| **Glock** (gun) | 180 | Long range firearm. The best standard weapon. |
| **Shotgun** | 125 | Medium range. Strong middle ground. |
| **Axe** | 56 | Heavy melee. Short range, same damage. |
| **Bat** | 52 | Light melee. Shortest range melee. |
| **Fists** | 42 | Default unarmed. 1 damage only. |
| **Laser Eyes** | 600 | Special ability. 100 damage. Not droppable. |

Strength stat adds bonus damage to melee attacks (axe, bat, fists) but NOT to guns.

---

## 8. Guide: How to Design a New Trait

**Step 1:** Pick a name (1 word, descriptive).

**Step 2:** Decide what the trait does:
- Push a stat to an extreme? → add `stats: { statName: value }`
- Grant a special property? → add `abilities: { abilityName: value }` (see section 3)
- Give a starting weapon? → add `startingWeapon: "weapon_name"`
- Mix of above?

**Step 3:** Check balance:
- Does it have a clear downside? (e.g., lower health, slower speed, lower friendliness)
- Does it create interesting gameplay moments? (e.g., explosive death, lifesteal, flight)
- Is it too similar to an existing trait?

**Step 4:** Write a 1-sentence flavor description.

### Example Design Process

> *"I want a trait called 'Cowardly' — the tribute runs away from everything."*
> - aggression: 1 (never fights, always flees)
> - speed: 4 (good at running)
> - friendliness: 6 (willing to ally for protection)
> - Result: A tribute that avoids combat, sticks with allies, and flees early. Weak alone, strong in groups.

---

## 9. Guide: How to Design a New Character

**Step 1:** Choose an iconic character name.

**Step 2:** Pick 1–3 traits that match the character's personality.

**Step 3:** Optionally add stat overrides (can exceed 1–10 for extreme characters).

**Step 4:** Optionally add ability overrides for unique mechanics.

**Step 5:** Test: does the character play the way their name suggests?

### Example Design Process

> *"I want a character called 'Hercules' — extremely strong but not very bright."*
> - traits: ["tank"] (tough + strong)
> - stat overrides: strength: 15 (superhuman), eyesight: 3 (poor perception)
> - Result: A powerhouse who can take hits but is easily ambushed or outmaneuvered.
