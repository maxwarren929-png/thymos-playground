# 📺 Nightly Recap & Highlight Reel — Technical Spec

## 1. Overview
The Nightly Recap system introduces a rhythmic pause in the simulation to summarize the day's events. It transitions the experience from a "live observation" to a "cinematic broadcast," allowing the user to review key moments and honor the fallen before proceeding to the next day.

## 2. The Day/Night Cycle

### Timing
- **Day Length**: 60 real-time seconds (configurable).
- **Day Timer**: A countdown displayed (or hidden) that triggers the transition.
- **Night Transition**: 
  - At T-minus 5s: Screen begins to dim (vignette/brightness filter).
  - At T=0: Game pauses (`gameState = 'recap'`), sounds fade out, and the Recap Overlay appears.

### Progression
- Clicking "Continue" on the final recap screen:
  - Resets the Day Timer to 60s.
  - Increments `currentDay`.
  - Clears all temporary "Daily" data.
  - Resumes simulation.

---

## 3. The Highlight Recorder

A new system tasked with capturing "Snapshot Data" of significant events as they happen.

### Captured Event Types
| Type | Trigger | Data Captured |
|---|---|---|
| **Bloodbath** | Deaths in the first 5s of Day 1 | Count of deaths, killers involved, weapon types. |
| **Kill** | `peep.die()` | Killer name, victim name, weapon used, location (x, y). |
| **Alliance** | `requestAlliance()` | Member names, type, location. |
| **Betrayal** | `breakAlliance()` | Betrayer name, victim name, location. |
| **Massacre** | 3+ deaths in < 3 seconds | Total deaths, area of effect. |

### Highlight Data Object
```javascript
{
  type: 'kill' | 'alliance' | 'betrayal' | 'bloodbath',
  timestamp: number,
  location: { x, y },
  title: string,       // e.g., "Forest Ambush"
  description: string, // e.g., "Tribute 4 was killed by Tribute 1"
  cinematicQuote: string // e.g., "A brutal end..."
}
```

---

## 4. The Highlight Director

The "Director" logic runs at the end of the day to pick the top moments (Max 5) to show in the reel.

### Selection Priority (Weighting)
1. **Bloodbath** (High - Day 1 only)
2. **Betrayals** (High)
3. **Massacres** (High)
4. **Alliances** (Medium)
5. **Kills** (Medium/Low - prioritized by proximity to other events or "nemesis" status)

---

## 5. UI Components

### Layer 1: The Fallen Wall
- **Layout**: Grid of circles/cards.
- **Visuals**:
  - Grayscale portrait of the deceased.
  - District number + Name.
  - Death cause (icon).
- **Interaction**: "View Highlights" button to proceed.

### Layer 2: Cinematic Reel
- **Frame**: A stylized 16:9 box with "Simulated Replay" scanlines.
- **Content**:
  - **Tag**: Red badge (e.g., "KEY MOMENT").
  - **Main Text**: Large, bold impact font.
  - **Sub Text**: Descriptive sentence.
  - **Quote**: Italicized "Flavor text."
- **Navigation**: "Previous" and "Next Moment" buttons.
- **Final Action**: "Continue to Day N" button.

---

## 6. Technical State Changes

### `state` Object Additions
- `dayTimer`: float (60.0)
- `currentDay`: integer (1)
- `dailyHighlights`: array of objects
- `dailyFallen`: array of tribute IDs

### Logic Integration
- **`main.js`**: `update()` must check `dayTimer` and manage the transition.
- **`peep.js`**: `die()` and `takeDamage()` must report back to the `Recorder`.
- **`alliance.js`**: (Logic inside main.js) must report formations and breaks.

---

## 7. Future Expansion (V2)
- **Visual Replays**: Instead of text summaries, show a "Ghost Replay" (re-simulated or recorded positions) inside the highlight box.
- **Sponsor Phase**: Allow users to send items to survivors during the Night transition.
- **Stat Tracking**: Show a "Day Progress" chart (Who is getting stronger vs. weaker).
