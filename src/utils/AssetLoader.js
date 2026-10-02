import {
  TextureLoader,
  LoadingManager,
} from 'three';

/**
 * Thin wrapper around Three.js loaders with a shared LoadingManager.
 *
 * STEP 1 only wires up texture loading and progress tracking so later steps
 * (GLB models, audio, etc.) can register their own loaders on the same manager
 * without reworking the asset pipeline. No external assets are loaded yet.
 */
export class AssetLoader {
  constructor() {
    this.manager = new LoadingManager();
    this.textureLoader = new TextureLoader(this.manager);

    /** Simple in-memory cache keyed by URL. */
    this._cache = new Map();
  }

  /**
   * Register progress callbacks. Useful for a loading screen in later steps.
   * @param {object} handlers
   * @param {() => void} [handlers.onStart]
   * @param {(url: string, loaded: number, total: number) => void} [handlers.onProgress]
   * @param {() => void} [handlers.onLoad]
   * @param {(url: string) => void} [handlers.onError]
   */
  setHandlers({ onStart, onProgress, onLoad, onError } = {}) {
    if (onStart) this.manager.onStart = onStart;
    if (onProgress) this.manager.onProgress = onProgress;
    if (onLoad) this.manager.onLoad = onLoad;
    if (onError) this.manager.onError = onError;
  }

  /**
   * Load a texture, caching by URL.
   * @param {string} url
   * @returns {Promise<import('three').Texture>}
   */
  loadTexture(url) {
    if (this._cache.has(url)) {
      return Promise.resolve(this._cache.get(url));
    }
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          this._cache.set(url, texture);
          resolve(texture);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  /** Dispose cached GPU resources. */
  dispose() {
    for (const asset of this._cache.values()) {
      if (asset && typeof asset.dispose === 'function') {
        asset.dispose();
      }
    }
    this._cache.clear();
  }
}
