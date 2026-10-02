import { PlayerModel } from './PlayerModel.js';
import { MovementController } from './MovementController.js';
import { CombatController } from '../combat/CombatController.js';

/**
 * The player entity — a thin facade over three collaborators:
 *
 *   Player
 *    ├── MovementController   (logic: position, velocity, state, facing)
 *    ├── CombatController     (logic: attack state/timing, damage)
 *    └── PlayerModel          (visual: meshes now, GLB + animation later)
 *
 * Game only talks to Player. Combat is requested via requestAttack() and
 * advanced inside update() using the player's current position + facing, so
 * attacks are camera-independent (facing comes from movement, not the camera).
 *
 * No HP for the player yet (STEP 5 is player → enemy only), no skills, no combo.
 */
export class Player {
  constructor() {
    this._model = new PlayerModel();
    this._movement = new MovementController();
    this._combat = new CombatController();

    this._object3D = this._model.getObject3D();
  }

  getObject3D() {
    return this._object3D;
  }

  getPosition() {
    return this._movement.position;
  }

  getVelocity() {
    return this._movement.velocity;
  }

  getSpeed() {
    return this._movement.getSpeed();
  }

  /** @returns {string} movement state (see MOVEMENT_STATES). */
  getMovementState() {
    return this._movement.state;
  }

  /** @returns {string} combat state (see COMBAT_STATES). */
  getCombatState() {
    return this._combat.getState();
  }

  /** @returns {number} seconds until another swing can start. */
  getCooldownRemaining() {
    return this._combat.getCooldownRemaining();
  }

  /** @returns {number} targets hit by the current/most-recent swing. */
  getLastAttackHitCount() {
    return this._combat.getLastAttackHitCount();
  }

  /** Edge-triggered: request a melee swing (honored only when free). */
  requestAttack() {
    this._combat.requestAttack();
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
   * Advance the player by one frame: movement, then combat (using the facing
   * movement just produced), then visual sync.
   * @param {number} deltaTime seconds
   * @param {object} ctx
   * @param {import('../input/InputManager.js').InputManager} ctx.input
   * @param {number} ctx.cameraYaw yaw the camera looks along (radians)
   * @param {{ getGroundHeight(x,z): number }} [ctx.world]
   * @param {{ resolve(pos:{x,z}, radius:number): void }} [ctx.collision]
   * @param {{ query(q:object): Array }} [ctx.hitDetection]
   * @param {() => Array} [ctx.getTargets] alive candidate targets provider
   */
  update(deltaTime, { input, cameraYaw, world, collision, hitDetection, getTargets }) {
    this._movement.update(deltaTime, { input, cameraYaw, world, collision });

    // Combat uses the player's own facing (not the camera) so swings aim where
    // the character is pointing.
    if (hitDetection && getTargets) {
      this._combat.update(deltaTime, {
        position: this._movement.position,
        facing: this._movement.facing,
        hitDetection,
        getTargets,
      });
    }

    // Apply results to the visual.
    const p = this._movement.position;
    this._object3D.position.set(p.x, p.y, p.z);
    this._model.setFacingAngle(this._movement.facing);
    this._model.setCombatState(this._combat.getState());
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
