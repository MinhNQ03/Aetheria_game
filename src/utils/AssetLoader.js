import { TextureLoader, LoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Shared asset pipeline: textures and GLB/GLTF models behind one cache and one
 * LoadingManager (so a loading screen can hook progress later).
 *
 * Caching is by URL. Models are cached as their parsed GLTF; callers that place
 * a model in a scene should clone the returned scene so multiple placements and
 * multiple maps don't share one Object3D. The cache is owned by the loader, not
 * by any single map — maps dispose their own instances, never the cache.
 */
export class AssetLoader {
  constructor() {
    this.manager = new LoadingManager();
    this.textureLoader = new TextureLoader(this.manager);
    this.gltfLoader = new GLTFLoader(this.manager);

    /** URL -> Texture */
    this._textureCache = new Map();
    /** URL -> GLTF (parsed) */
    this._modelCache = new Map();
  }

  /**
   * Register progress callbacks (for a future loading screen).
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
    if (this._textureCache.has(url)) {
      return Promise.resolve(this._textureCache.get(url));
    }
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          this._textureCache.set(url, texture);
          resolve(texture);
        },
        undefined,
        (err) =>
          reject(new Error(`Failed to load texture "${url}": ${err?.message ?? err}`))
      );
    });
  }

  /**
   * Load a GLB/GLTF model, caching the parsed GLTF by URL.
   *
   * Returns the cached GLTF; callers typically use `gltf.scene.clone(true)` so
   * each placement is independent. Errors reject with the URL for context.
   *
   * @param {string} url
   * @returns {Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>}
   */
  loadModel(url) {
    if (this._modelCache.has(url)) {
      return Promise.resolve(this._modelCache.get(url));
    }
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this._modelCache.set(url, gltf);
          resolve(gltf);
        },
        undefined,
        (err) =>
          reject(new Error(`Failed to load model "${url}": ${err?.message ?? err}`))
      );
    });
  }

  /** @returns {number} number of cached assets (textures + models). */
  getLoadedCount() {
    return this._textureCache.size + this._modelCache.size;
  }

  /**
   * Dispose ALL cached GPU resources. Call only on full teardown, never on a
   * per-map unload (maps must not dispose the shared cache).
   */
  dispose() {
    for (const texture of this._textureCache.values()) {
      texture.dispose?.();
    }
    this._textureCache.clear();

    for (const gltf of this._modelCache.values()) {
      gltf.scene?.traverse((obj) => {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      });
    }
    this._modelCache.clear();
  }
}
