import { Game } from './game/Game.js';

/**
 * Entry point. Keeps logic out of here: find the canvas, boot the Game, and
 * wire a couple of top-level conveniences. Everything else lives in modules.
 */
const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas element #game-canvas was not found.');
}

const game = new Game(canvas);
game.start().catch((err) => {
  // Surface startup/asset failures instead of a silent blank canvas.
  console.error('Game failed to start:', err);
});

// Press "L" to toggle UI language at runtime (vi <-> en).
// This proves the localization layer updates live; later it moves into a menu.
// Press "K" (DEV) to damage the nearest enemy — exercises health/death until a
// real combat system exists in a later step.
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyL') {
    game.toggleLanguage();
  } else if (event.code === 'KeyK') {
    game.devDamageNearestEnemy();
  }
});

// Expose the game for automated capture / debugging ONLY in dev builds. Vite
// statically replaces import.meta.env.DEV, so this block is dropped from the
// production bundle (no debug surface shipped).
if (import.meta.env.DEV) {
  window.__game = game;
}

// Clean up GPU/DOM resources on page unload.
window.addEventListener('beforeunload', () => game.dispose());
