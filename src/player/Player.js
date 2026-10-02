import { PlayerModel } from './PlayerModel.js';
import { MovementController } from './MovementController.js';

/**
 * The player entity — a thin facade over two collaborators:
 *
 *   Player
 *    ├── MovementController   (logic: position, velocity, state, facing)
 *    └── PlayerModel          (visual: meshes now, GLB + animation later)
 *
 * Game only talks to Player (getObject3D/getPosition/getVelocity/
 * getMovementState and update). Combat, skills, animation, etc. attach to the
 * movement controller or the model without turning this class into a monolith.
 *
 * No combat, HP, skills, or animation yet.
 */
export class Player {
  constructor() {
    this._model = new PlayerModel();
    this._movement = new MovementController();

    // Root the model represents the player in the scene.
    this._object3D = this._model.getObject3D();
  }

  /** @returns {import('three').Object3D} root to add to the scene. */
  getObject3D() {
    return this._object3D;
  }

  /** @returns {import('three').Vector3} live world position (feet). */
  getPosition() {
    return this._movement.position;
  }

  /** @returns {import('three').Vector3} live horizontal velocity. */
  getVelocity() {
    return this._movement.velocity;
  }

  /** @returns {number} current horizontal speed. */
  getSpeed() {
    return this._movement.getSpeed();
  }

  /** @returns {string} current movement state (see MOVEMENT_STATES). */
  getMovementState() {
    return this._movement.state;
  }

  /**
   * Place the player at a map spawn point and sync the visual immediately.
   * @param {{x:number,y:number,z:number,rotation?:number}} spawn
   */
  setSpawn(spawn) {
    this._movement.setPosition(spawn.x, spawn.y, spawn.z, spawn.rotation ?? 0);
    this._object3D.position.set(spawn.x, spawn.y, spawn.z);
    this._model.setFacingAngle(this._movement.facing);
  }

  /**
   * Advance the player by one frame.
   * @param {number} deltaTime seconds
   * @param {object} ctx
   * @param {import('../input/InputManager.js').InputManager} ctx.input
   * @param {number} ctx.cameraYaw yaw the camera looks along (radians)
   * @param {{ getGroundHeight(x: number, z: number): number }} [ctx.world]
   * @param {{ resolve(pos: {x,z}, radius: number): void }} [ctx.collision]
   */
  update(deltaTime, { input, cameraYaw, world, collision }) {
    this._movement.update(deltaTime, { input, cameraYaw, world, collision });

    // Apply movement results to the visual.
    const p = this._movement.position;
    this._object3D.position.set(p.x, p.y, p.z);
    this._model.setFacingAngle(this._movement.facing);
    this._model.update(deltaTime, {
      state: this._movement.state,
      speed: this._movement.getSpeed(),
    });
  }

  /** Free GPU resources. */
  dispose() {
    this._model.dispose();
  }
}
