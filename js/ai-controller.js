class AIController {
  static async fetchAIThought(peep, world) {
    if (!world.apiKey) return null;
    
    const isGithub = world.apiKey.startsWith("ghp_") || world.apiKey.startsWith("github_pat_");
    
    // Construct the persona and context
    const traitNames = (peep.traits || []).join(", ");
    const persona = `You are ${peep.name} from District ${peep.district}. Stats: STR ${peep.stats.strength}, SPD ${peep.stats.speed}, EYE ${peep.stats.eyesight}, AGR ${peep.stats.aggression}. Traits: ${traitNames}. Life story: ${peep.aiMemorySummary}`;
// Construct the immediate surroundings (restricted by actual eyesight)
    const awarenessRange = peep.profile?.enemyAwareness || CONSTANTS.FOG.DEFAULT_AWARENESS;

const nearbyEnemies = world.peeps
    .filter(p => p.alive && p !== peep && !world.areAllied(p, peep))
    .map(p => ({ name: p.name, id: p.id, dist: Math.floor(Math.hypot(p.x - peep.x, p.y - peep.y)), weapon: p.weapon || "fists" }))
    .filter(p => p.dist <= awarenessRange)
    .sort((a, b) => a.dist - b.dist).slice(0, CONSTANTS.AI.NEARBY_ENEMIES_MAX);

const nearbyAllies = world.peeps
    .filter(p => p.alive && p !== peep && world.areAllied(p, peep))
    .map(p => ({ name: p.name, id: p.id, dist: Math.floor(Math.hypot(p.x - peep.x, p.y - peep.y)) }))
    .filter(p => p.dist <= awarenessRange * CONSTANTS.AI.ALLY_RANGE_MULT) // Allies are slightly easier to track/hear
    .slice(0, CONSTANTS.AI.NEARBY_ALLIES_MAX);

const nearbyWeapons = world.groundWeapons
    .map(w => ({ type: w.type, dist: Math.floor(Math.hypot(w.x - peep.x, w.y - peep.y)) }))
    .filter(w => w.dist <= awarenessRange)
    .sort((a, b) => a.dist - b.dist).slice(0, CONSTANTS.AI.NEARBY_WEAPONS_MAX);

    const memories = peep.memories.slice(0, CONSTANTS.AI.MEMORIES_CONTEXT_MAX).map(m => {
        const actor = world.peeps.find(p => p.id === m.actorId);
        return `${m.type} involving ${actor ? actor.name : 'someone'}`;
    }).join(". ");

    const systemPrompt = `You are a tribute in the Hunger Games. Respond ONLY with a valid JSON object.
Rules:
1. If an enemy is within 100m, you MUST either "hunt" them or "flee". Do not "wander" or "scavenge" if you are under attack.
2. If you already have a gun or shotgun, do NOT use "scavenge_weapon". Focus on survival or hunting.
3. Your goal must be one of: "hunt", "flee", "scavenge_weapon", "hide", "regroup", "wander".

Context:
${persona}
Memories: ${memories}
Surroundings: Enemies:${JSON.stringify(nearbyEnemies)}, Allies:${JSON.stringify(nearbyAllies)}, Weapons:${JSON.stringify(nearbyWeapons)}
Current Status: Health ${Math.floor(peep.health)}/${peep.maxHealth}, Weapon: ${peep.weapon || "none"}

JSON Format:
{
  "goal": "string",
  "targetId": number|null,
  "shout": "short dialogue (max 30 chars)",
  "memorySummary": "1-sentence summary of your situation"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      let response;
      let text;

      if (isGithub) {
        response = await fetch(CONSTANTS.AI.GITHUB_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${world.apiKey}`
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You are a Hunger Games simulator agent. You MUST respond with a single JSON object. No prose, no markdown blocks." },
              { role: "user", content: systemPrompt }
            ],
            model: CONSTANTS.AI.MODEL_GITHUB,
            temperature: CONSTANTS.AI.TEMPERATURE,
            max_tokens: CONSTANTS.AI.MAX_TOKENS,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
        const data = await response.json();
        text = data.choices?.[0]?.message?.content;
      } else {
        // Standard Google Gemini logic
        // NOTE: Gemini requires the API key in the query parameter. This exposes the key
        // in browser history and referrer headers. Use a backend proxy for production.
        const url = `${CONSTANTS.AI.GEMINI_ENDPOINT_TEMPLATE}?key=${world.apiKey}`;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error("Empty Gemini response");
        text = data.candidates[0].content.parts[0].text;
      }

      clearTimeout(timeoutId);
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
      }
      throw new Error("No JSON object found in AI response");
    } catch (error) {
      clearTimeout(timeoutId);
      if (DEBUG) console.error("🧠 AI Brain Error:", error);
      return null;
    }
  }
}
