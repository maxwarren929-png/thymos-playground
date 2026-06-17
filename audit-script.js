const fs = require('fs');
const path = require('path');

const files = [
  'js/main.js',
  'js/peep.js',
  'js/sprite-loader.js',
  'js/cursor-entity.js',
  'js/config.js',
  'js/ai-controller.js'
];

const results = {
  syntaxErrors: [],
  undefinedVars: [],
  potentialBugs: [],
  styleIssues: []
};

function analyzeFile(filePath) {
  const content = fs.readFileSync(path.join('C:/Users/tacob/projects/cursor-worshippers', filePath), 'utf-8');
  const lines = content.split('\n');

  // Check for common issues
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check for potential undefined variable usage (very basic heuristic)
    const globalVars = ['Peep', 'CursorEntity', 'AIController', 'SpriteAtlas', 'SpriteLayers', 'GAME_CONSTANTS', 'STAT_REGISTRY', 'WEAPON_REGISTRY', 'TRAIT_LIBRARY', 'CHARACTER_LIBRARY'];
    
    // Look for console.log left in code
    if (line.includes('console.log') || line.includes('console.warn') || line.includes('console.error')) {
      if (!line.includes('catch') && !line.includes('error')) {
        results.styleIssues.push(`${filePath}:${lineNum}: console statement left in code`);
      }
    }

    // Look for potential == instead of ===
    if (/[^=!]==[^=]/.test(line)) {
      results.potentialBugs.push(`${filePath}:${lineNum}: using == instead of ===`);
    }

    // Look for potential unused variables or missing declarations
    if (/\b(let|const)\s+\w+\s*;/.test(line)) {
      results.potentialBugs.push(`${filePath}:${lineNum}: variable declared without initialization`);
    }
  });
}

files.forEach(analyzeFile);
console.log(JSON.stringify(results, null, 2));
