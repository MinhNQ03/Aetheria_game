import { World } from './World.js';
import { TestWorld } from './maps/TestWorld.js';

/**
 * Owns the registry of map definitions and the currently loaded World.
 *
 *   MapManager.loadMap('TestWorld')  ->  builds a World from the definition
 *
 * Only one World is live at a time. Loading a new map disposes the old World's
 * resources first (but never the shared asset cache). `loadMap` is async so a
 * future map that awaits GLB assets fits the same signature — no transition
 * animation or loading screen here (that's a later step), just the seam.
 */
export class MapManager {
  /**
   * @param {import('../utils/AssetLoader.js').AssetLoader} assetLoader
   * @param {Record<string, object>} [registry] id -> map definition
   */
  constructor(assetLoader, registry = { [TestWorld.id]: TestWorld }) {
    this._assetLoader = assetLoader;
    this._registry = registry;
    /** @type {World | null} */
    this._world = null;
    /** @type {'empty'|'loading'|'ready'|'error'} */
    this._status = 'empty';
  }

  /** @returns {World | null} the currently loaded world. */
  get current() {
    return this._world;
  }

  /** @returns {string} load status: empty | loading | ready | error. */
  get status() {
    return this._status;
  }

  /** @returns {string[]} known map ids. */
  get availableMaps() {
    return Object.keys(this._registry);
  }

  /**
   * Load a map by id, replacing (and disposing) any current world.
   * @param {string} id
   * @returns {Promise<World>}
   */
  async loadMap(id) {
    const def = this._registry[id];
    if (!def) {
      this._status = 'error';
      throw new Error(`Unknown map id: "${id}"`);
    }

    this.unloadMap(); // tear down the previous world first (resets status)
    this._status = 'loading';

    try {
      const world = new World(def, this._assetLoader);
      await world.build(); // async-ready even though primitives are sync
      this._world = world;
      this._status = 'ready';
      return world;
    } catch (err) {
      this._status = 'error';
      throw new Error(`Failed to load map "${id}": ${err?.message ?? err}`);
    }
  }

  /** Dispose and drop the current world (keeps the asset cache intact). */
  unloadMap() {
    if (this._world) {
      this._world.dispose();
      this._world = null;
    }
    this._status = 'empty';
  }
}
