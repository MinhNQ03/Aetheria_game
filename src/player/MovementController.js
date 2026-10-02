import { Vector3, MathUtils } from 'three';
import {
  INPUT_ACTIONS,
  MOVEMENT_CONFIG,
  MOVEMENT_STATES,
} from '../utils/constants.js';

/**
 * Player MOVEMENT logic, isolated from the visual model.
 *
 * Responsibilities:
 *  - read movement intent from the InputManager (logical actions),
 *  - turn it into a camera-relative direction on the XZ plane,
 *  - accelerate/decelerate velocity toward a target,
 *  - integrate position (deltaTime-based) and clamp to ground,
 *  - track a smoothed facing angle and an idle/moving state.
 *
 * It owns no Three.js scene objects beyond math vectors; the Player facade
 * applies the resulting position/facing to the model. This keeps combat/skills
 * (which will add states and intents) from turning Player into a giant class.
 */
export class MovementController {
  /**
   * @param {object} [config] overrides for MOVEMENT_CONFIG.
   */
  constructor(config = MOVEMENT_CONFIG) {
    this._config = config;

    /** World position of the player's feet. Mutated in place each frame. */
    this.position = new Vector3(0, 0, 0);
    /** Current horizontal velocity (y unused). */
    this.velocity = new Vector3(0, 0, 0);
    /** Facing angle around Y (radians); smoothed toward travel direction. */
    this.facing = 0;
    /** @type {string} one of MOVEMENT_STATES. */
    this.state = MOVEMENT_STATES.IDLE;

    // Scratch vectors reused each frame (no per-frame allocation).
    this._intent = new Vector3();
    this._camForward = new Vector3();
    this._camRight = new Vector3();
    this._moveDir = new Vector3();
    this._targetVel = new Vector3();
  }

  /** @returns {number} current horizontal speed. */
  getSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /**
   * Advance movement by one frame.
   * @param {number} deltaTime seconds
   * @param {object} ctx
   * @param {import('../input/InputManager.js').InputManager} ctx.input
   * @param {number} ctx.cameraYaw yaw (radians) the camera is looking along
   * @param {{ getGroundHeight(x: number, z: number): number }} [ctx.world]
   */
  update(deltaTime, { input, cameraYaw, world }) {
    // 1) Raw intent on the XZ plane from logical actions (local space).
    //    forward = -Z, right = +X (screen-space convention).
    let ix = 0;
    let iz = 0;
    if (input.isPressed(INPUT_ACTIONS.FORWARD)) iz -= 1;
    if (input.isPressed(INPUT_ACTIONS.BACKWARD)) iz += 1;
    if (input.isPressed(INPUT_ACTIONS.LEFT)) ix -= 1;
    if (input.isPressed(INPUT_ACTIONS.RIGHT)) ix += 1;
    this._intent.set(ix, 0, iz);
    const hasInput = this._intent.lengthSq() > 0;

    // 2) Convert intent into a camera-relative world direction.
    //    Camera looks along cameraYaw; forward is where the camera faces.
    this._moveDir.set(0, 0, 0);
    if (hasInput) {
      // Camera-forward on the ground plane (yaw 0 => -Z).
      this._camForward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
      // Right is forward rotated -90° around Y.
      this._camRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

      // intent.z<0 means "forward" (W), so subtract camForward*intent.z.
      this._moveDir
        .addScaledVector(this._camForward, -this._intent.z)
        .addScaledVector(this._camRight, this._intent.x);
      // Normalize so diagonal input isn't faster.
      if (this._moveDir.lengthSq() > 0) this._moveDir.normalize();
    }

    // 3) Target velocity, then accelerate/decelerate toward it.
    this._targetVel
      .copy(this._moveDir)
      .multiplyScalar(hasInput ? this._config.speed : 0);

    const rate = hasInput
      ? this._config.acceleration
      : this._config.deceleration;
    // Frame-rate independent approach toward target velocity.
    const t = Math.min(1, rate * deltaTime / Math.max(this._config.speed, 1e-3));
    this.velocity.x = MathUtils.lerp(this.velocity.x, this._targetVel.x, t);
    this.velocity.z = MathUtils.lerp(this.velocity.z, this._targetVel.z, t);

    // Snap tiny residual velocity to zero so the player fully stops.
    if (!hasInput && this.getSpeed() < this._config.idleThreshold) {
      this.velocity.set(0, 0, 0);
    }

    // 4) Integrate position.
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // 5) Ground constraint (flat for now; World owns the real height).
    this.position.y = world ? world.getGroundHeight(this.position.x, this.position.z) : 0;

    // 6) Facing: turn smoothly toward travel direction while moving.
    const speed = this.getSpeed();
    if (speed > this._config.idleThreshold) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      this.facing = this._approachAngle(
        this.facing,
        targetAngle,
        this._config.rotationSpeed * deltaTime
      );
    }

    // 7) State.
    this.state =
      speed > this._config.idleThreshold
        ? MOVEMENT_STATES.MOVING
        : MOVEMENT_STATES.IDLE;
  }

  /** Smoothly rotate `current` toward `target` by up to `t` (0..1) of the gap. */
  _approachAngle(current, target, t) {
    let diff = target - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
    return current + diff * Math.min(1, t);
  }
}
