import { DEFAULT_LANGUAGE, DEFAULT_MAP } from '../utils/constants.js';

/**
 * Central, serializable-ish game state.
 *
 * STEP 1 keeps only what's needed now, but the shape anticipates later
 * systems (story progression, quests). Gameplay systems should read/write
 * through this object rather than holding their own scattered state, which
 * keeps a future save/load feature straightforward.
 *
 * Note: `player` here holds lightweight state data (not the Three.js Player
 * entity). The entity lives in Game; this is the data that would be persisted.
 */
export class GameState {
  constructor({ language = DEFAULT_LANGUAGE, currentMap = DEFAULT_MAP } = {}) {
    /** @type {string} active language code. */
    this.language = language;

    /** @type {string} logical name of the current map. */
    this.currentMap = currentMap;

    /** Minimal player state placeholder (extended in later steps). */
    this.player = {
      position: { x: 0, y: 0, z: 0 },
    };

    /** Story progression placeholder. Not driven by any logic in STEP 1. */
    this.story = {
      chapter: 0,
      flags: {},
    };

    /** Quest log placeholder. Not driven by any logic in STEP 1. */
    this.quests = {
      active: [],
      completed: [],
    };
  }
}
