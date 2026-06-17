# Cursor Worshippers Architecture Guide

This guide explains how to extend the game's systems, specifically the **Recap System** and the **Trait/Character Architecture**.

---

## 📽️ The Recap System

The recap system allows you to showcase "highlights" from the match. To make something appear in a recap, you need to follow three steps: **Log**, **Capture**, and **Generate**.

### 1. Logging an Event
Events are logged via the `world.logEvent()` method. This registers an event in `state.pendingEvents`.

```javascript
world.logEvent({
  type: "custom_event",
  x: this.x,
  y: this.y,
  data: { 
    customField: "some value",
    // victim/killer references if applicable
  }
});
```

### 2. Capturing Visuals (Snapshots)
For an event to have a replay clip, the system must save a "rolling history" of frames.
- **Persistence:** If you want a visual effect (like Laser Eyes or a specific face) to show up in the replay, that state **MUST** be included in the `Peep.getSnapshot()` method.
- **Rendering:** You must then implement the drawing logic in `Peep.renderFromSnapshot(ctx, snapshot, sprites)`.

### 3. Generating Highlights
Highlights are curated in `js/main.js` inside the `generateHighlights()` function. This is where you filter the `state.allEvents` and create the "Highlight Objects" that the UI displays.

```javascript
const myEvents = events.filter(e => e.type === "custom_event");
myEvents.forEach(e => {
  highlights.push({
    tag: "Cool Event",
    main: "SOMETHING HAPPENED",
    sub: "Description of the event",
    desc: "Flavor text",
    clip: e.clip // The clip captured automatically after logEvent
  });
});
```

---

## 🧬 Traits vs. Characters

The game uses a modular architecture to separate "what someone can do" from "who someone is."

### 1. Traits (The "What")
Traits are defined in `TRAIT_LIBRARY` in `js/config.js`. They are modular building blocks that can modify:
- **Stats:** (Strength, Speed, etc.)
- **Abilities:** (isFlying, hasLaserEyes, lifesteal, armor, etc.)
- **Starting Equipment:** (Weapons)

**Example Trait:**
```javascript
vampiric: {
  name: "Vampiric",
  abilities: { lifesteal: 0.4 } // Logic handled in Peep.updateAttack
}
```

### 2. Characters (The "Who")
Characters are "Presets" defined in `CHARACTER_LIBRARY`. They are simply a collection of traits and base stats triggered by the tribute's name (case-insensitive).

**Example Character:**
```javascript
superman: {
  name: "Superman",
  traits: ["flight", "lasereyes"], // Combines two modular traits
  stats: { strength: 100, speed: 100 }
}
```

### Implementation Flow:
1. **Define the Logic:** Add the actual behavior (e.g., healing on hit) to the `Peep` class in `js/peep.js`.
2. **Expose the Trait:** Add a key to `TRAIT_LIBRARY` that sets the new property.
3. **Assign to Character:** (Optional) Add that trait to a preset in `CHARACTER_LIBRARY`.
