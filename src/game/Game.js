import { WebGLRenderer, Clock } from 'three';

import { RENDER_CONFIG } from '../utils/constants.js';
import { GameState } from './GameState.js';
import { GameLoop } from './GameLoop.js';
import { Localization } from '../localization/Localization.js';
import { InputManager } from '../input/InputManager.js';
import { CameraController } from '../camera/CameraController.js';
import { AssetLoader } from '../utils/AssetLoader.js';
import { MapManager } from '../world/MapManager.js';
import { Player } from '../player/Player.js';
import { EnemyManager } from '../enemy/EnemyManager.js';
import { HitDetectionSystem } from '../combat/HitDetectionSystem.js';
import { INPUT_ACTIONS } from '../utils/constants.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';

/**
 * Top-level orchestrator.
 *
 * Owns the renderer, clock, and the lifetimes of every subsystem (state,
 * localization, input, assets, maps, player, camera, loop, debug UI), wires
 * them together, and exposes update()/render() to the GameLoop.
 *
 * The live map is owned by MapManager; Game reads `mapManager.current` to get
 * the active World (scene, collision, spawn). Game holds no gameplay rules.
 */
export class Game {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this._canvas = canvas;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: RENDER_CONFIG.antialias,
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RENDER_CONFIG.maxPixelRatio)
    );

    this.clock = new Clock();

    // Core services and entities.
    this.state = new GameState();
    this.localization = new Localization(this.state.language);
    this.input = new InputManager();
    this.assets = new AssetLoader();
    this.maps = new MapManager(this.assets);
    this.player = new Player();
    /** @type {EnemyManager | null} created per map in loadMap(). */
    this.enemies = null;
    this.hitDetection = new HitDetectionSystem();
    // Cached provider of alive targets, bound once (no per-frame closure alloc).
    this._getTargets = () => (this.enemies ? this.enemies.getAliveEnemies() : []);
    this.camera = new CameraController(this._aspect());
    this.debug = new DebugOverlay(this.localization);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
      getDelta: () => this.clock.getDelta(),
    });

    this._onResize = this._onResize.bind(this);
  }

  /** @returns {import('../world/World.js').World | null} the live map. */
  get world() {
    return this.maps.current;
  }

  /**
   * Load the starting map, wire everything up, and start the loop.
   * Async because a map may await assets before it's ready.
   * @returns {Promise<void>}
   */
  async start() {
    await this.loadMap(this.state.currentMap);

    this.input.attach();
    this.input.attachPointer(this._canvas); // mouse-drag camera orbit
    this.debug.mount();

    window.addEventListener('resize', this._onResize);
    this._onResize(); // ensure correct initial size

    this.loop.start();
  }

  /**
   * Load (or switch to) a map by id, then place the player at its spawn and
   * rebind the camera to the player. Safe to call again for map transitions.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async loadMap(id) {
    // Tear down the previous map's enemies before the old world is disposed.
    if (this.enemies) {
      this.enemies.dispose();
      this.enemies = null;
    }

    const world = await this.maps.loadMap(id);
    this.state.currentMap = world.name;

    // Put the player into the new scene at the map's spawn point.
    world.scene.add(this.player.getObject3D());
    this.player.setSpawn(world.getSpawn());

    // Spawn this map's enemies into the new scene (data-driven).
    this.enemies = new EnemyManager(world.scene);
    this.enemies.spawnFromDefinitions(world.getEnemyDefinitions());

    // (Re)bind the camera to the current player root.
    this.camera.setTarget(this.player.getObject3D());
  }

  /**
   * Advance all systems by deltaTime.
   * @param {number} deltaTime seconds.
   */
  update(deltaTime) {
    const world = this.world;
    if (!world) return; // nothing to update until a map is ready

    // Feed accumulated mouse-drag into the camera orbit first, so movement
    // this frame is relative to the up-to-date camera yaw.
    const { dx, dy } = this.input.consumePointerDelta();
    this.camera.orbit(dx, dy);

    // Edge-triggered attack: one request per key press.
    if (this.input.consumePressed(INPUT_ACTIONS.ATTACK)) {
      this.player.requestAttack();
    }

    // Player movement + combat (combat resolves hits against alive enemies).
    this.player.update(deltaTime, {
      input: this.input,
      cameraYaw: this.camera.getYaw(),
      world,
      collision: world.getCollision(),
      hitDetection: this.hitDetection,
      getTargets: this._getTargets,
    });

    // Enemies update after the player (they chase the player's new position),
    // before the camera follows.
    if (this.enemies) {
      this.enemies.update(deltaTime, { target: this.player, world });
    }

    this.camera.update(deltaTime);

    // Mirror the live player position into serializable state.
    const p = this.player.getPosition();
    this.state.player.position.x = p.x;
    this.state.player.position.y = p.y;
    this.state.player.position.z = p.z;

    // Nearest-enemy state for the debug overlay (also handy for future lock-on).
    const nearest = this.enemies
      ? this.enemies.getNearestAlive(this.player.getPosition())
      : null;

    this.debug.update({
      deltaTime,
      mapName: this.state.currentMap,
      playerPosition: this.state.player.position,
      language: this.localization.language,
      movementState: this.player.getMovementState(),
      speed: this.player.getSpeed(),
      cameraPosition: this.camera.getPosition(),
      assetCount: this.assets.getLoadedCount(),
      colliderCount: world.getCollision().getColliderCount(),
      enemyCount: this.enemies ? this.enemies.getEnemies().length : 0,
      aliveEnemies: this.enemies ? this.enemies.getAliveCount() : 0,
      nearestEnemyState: nearest ? nearest.getState() : null,
      combatState: this.player.getCombatState(),
      cooldownRemaining: this.player.getCooldownRemaining(),
      lastHitCount: this.player.getLastAttackHitCount(),
    });
  }

  /**
   * DEV-ONLY: teleport the player (used by automated capture to reach the world
   * boundary without a long walk). Goes through Player.setSpawn so the
   * MovementController abstraction stays intact: velocity resets and the visual
   * syncs. Not used by any gameplay path.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} [rotation]
   */
  devSetPlayerPosition(x, y, z, rotation = 0) {
    this.player.setSpawn({ x, y, z, rotation });
  }

  /**
   * DEV-ONLY: read the nearest alive enemy's health (used by automated capture
   * to verify combat damage / one-hit-per-swing). Returns null if none.
   * @returns {{ current:number, max:number, state:string }|null}
   */
  devGetNearestEnemyHealth() {
    if (!this.enemies) return null;
    const e = this.enemies.getNearestAlive(this.player.getPosition());
    if (!e) return null;
    const h = e.getHealth();
    return { current: h.getCurrent(), max: h.getMax(), state: e.getState() };
  }

  render() {
    const world = this.world;
    if (!world) return;
    this.renderer.render(world.scene, this.camera.camera);
  }

  /** Toggle UI language at runtime (vi <-> en). Useful for a settings menu. */
  toggleLanguage() {
    const next = this.localization.toggleLanguage();
    this.state.language = next;
    return next;
  }

  _aspect() {
    return window.innerWidth / window.innerHeight;
  }

  _onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.setAspect(this._aspect());
  }

  /** Stop the loop and release resources. */
  dispose() {
    this.loop.stop();
    this.input.detach();
    this.debug.unmount();
    window.removeEventListener('resize', this._onResize);

    if (this.enemies) {
      this.enemies.dispose();
      this.enemies = null;
    }
    this.maps.unloadMap(); // disposes the live world
    this.player.dispose();
    this.assets.dispose(); // dispose the shared cache on full teardown only
    this.renderer.dispose();
  }
}
