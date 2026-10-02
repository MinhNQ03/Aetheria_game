import { WebGLRenderer, Clock } from 'three';

import { RENDER_CONFIG } from '../utils/constants.js';
import { GameState } from './GameState.js';
import { GameLoop } from './GameLoop.js';
import { Localization } from '../localization/Localization.js';
import { InputManager } from '../input/InputManager.js';
import { CameraController } from '../camera/CameraController.js';
import { World } from '../world/World.js';
import { Player } from '../player/Player.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';

/**
 * Top-level orchestrator.
 *
 * Owns the renderer, clock, and the lifetimes of every subsystem (state,
 * localization, input, world, player, camera, loop, debug UI). It wires them
 * together and exposes update()/render() to the GameLoop.
 *
 * Game deliberately holds no gameplay rules itself. As systems grow, they are
 * added as fields here and ticked inside update(), keeping GameLoop untouched.
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
    this.world = new World(this.state.currentMap);
    this.player = new Player();
    this.camera = new CameraController(this._aspect());
    this.debug = new DebugOverlay(this.localization);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
      getDelta: () => this.clock.getDelta(),
    });

    this._onResize = this._onResize.bind(this);
  }

  /** Wire everything up and start the loop. */
  start() {
    // Place the player into the world and follow it.
    this.world.scene.add(this.player.getObject3D());
    this.camera.setTarget(this.player.getObject3D());

    this.input.attach();
    this.input.attachPointer(this._canvas); // mouse-drag camera orbit
    this.debug.mount();

    window.addEventListener('resize', this._onResize);
    this._onResize(); // ensure correct initial size

    this.loop.start();
  }

  /**
   * Advance all systems by deltaTime.
   * New systems (enemies, physics, animation) hook in here.
   * @param {number} deltaTime seconds.
   */
  update(deltaTime) {
    // Feed accumulated mouse-drag into the camera orbit first, so movement
    // this frame is relative to the up-to-date camera yaw.
    const { dx, dy } = this.input.consumePointerDelta();
    this.camera.orbit(dx, dy);

    this.player.update(deltaTime, {
      input: this.input,
      cameraYaw: this.camera.getYaw(),
      world: this.world,
    });
    this.camera.update(deltaTime);

    // Mirror the live player position into serializable state.
    const p = this.player.getPosition();
    this.state.player.position.x = p.x;
    this.state.player.position.y = p.y;
    this.state.player.position.z = p.z;

    this.debug.update({
      deltaTime,
      mapName: this.state.currentMap,
      playerPosition: this.state.player.position,
      language: this.localization.language,
      movementState: this.player.getMovementState(),
      speed: this.player.getSpeed(),
      cameraPosition: this.camera.getPosition(),
    });
  }

  render() {
    this.renderer.render(this.world.scene, this.camera.camera);
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

    this.world.dispose();
    this.player.dispose();
    this.renderer.dispose();
  }
}
