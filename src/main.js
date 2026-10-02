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

// Press "L" to toggle UI language at runtime (vi <-> en). Production control.
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyL') {
    game.toggleLanguage();
  }
});

// DEV-ONLY surface. Vite statically replaces import.meta.env.DEV, so this block
// is dropped from the production bundle — no debug behaviour ships. Exposes the
// game to automated capture (boundary teleport). The old "K" debug-damage key
// is gone now that real combat exists (STEP 5).
if (import.meta.env.DEV) {
  window.__game = game;
}

// Clean up GPU/DOM resources on page unload.
window.addEventListener('beforeunload', () => game.dispose());
