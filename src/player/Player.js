import {
  Group,
  Mesh,
  CapsuleGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { INPUT_ACTIONS, MOVEMENT_CONFIG } from '../utils/constants.js';

/**
 * The player entity.
 *
 * STEP 1 is a placeholder: a capsule primitive wrapped in a Group so a real
 * GLB model (with animations) can be dropped in later without changing the
 * entity's public shape. Exposes position/rotation/velocity and an object3D,
 * and reads movement from an InputManager.
 *
 * No combat, HP, skills, or animation yet.
 */
export class Player {
  constructor() {
    this.object3D = new Group();

    const geometry = new CapsuleGeometry(0.5, 1, 8, 16);
    const material = new MeshStandardMaterial({ color: 0x3a7bd5 });
    this._mesh = new Mesh(geometry, material);
    // Lift so the capsule rests on the ground (half height + radius).
    this._mesh.position.y = 1;
    this.object3D.add(this._mesh);

    this._geometry = geometry;
    this._material = material;

    // Movement state. position/rotation are proxied to the Group.
    this.velocity = new Vector3();
    this._moveDir = new Vector3();
  }

  /** @returns {import('three').Vector3} live position (mutating moves the player). */
  get position() {
    return this.object3D.position;
  }

  /** @returns {import('three').Euler} live rotation. */
  get rotation() {
    return this.object3D.rotation;
  }

  /**
   * Advance the player using current input.
   * @param {number} deltaTime seconds since last frame.
   * @param {import('../input/InputManager.js').InputManager} input
   */
  update(deltaTime, input) {
    // Build a movement direction on the XZ plane from logical actions.
    // Forward is -Z (into the screen), matching the camera offset.
    let x = 0;
    let z = 0;
    if (input.isPressed(INPUT_ACTIONS.FORWARD)) z -= 1;
    if (input.isPressed(INPUT_ACTIONS.BACKWARD)) z += 1;
    if (input.isPressed(INPUT_ACTIONS.LEFT)) x -= 1;
    if (input.isPressed(INPUT_ACTIONS.RIGHT)) x += 1;

    this._moveDir.set(x, 0, z);

    if (this._moveDir.lengthSq() > 0) {
      this._moveDir.normalize();
      this.velocity
        .copy(this._moveDir)
        .multiplyScalar(MOVEMENT_CONFIG.speed);

      // Face the direction of travel, smoothly.
      const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z);
      this._rotateTowards(targetAngle, deltaTime);
    } else {
      this.velocity.set(0, 0, 0);
    }

    // Integrate position.
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
  }

  _rotateTowards(targetAngle, deltaTime) {
    const current = this.object3D.rotation.y;
    // Shortest angular distance in (-PI, PI].
    let diff = targetAngle - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const t = Math.min(1, MOVEMENT_CONFIG.rotationLerp * deltaTime);
    this.object3D.rotation.y = current + diff * t;
  }

  /** Free GPU resources. */
  dispose() {
    this._geometry.dispose();
    this._material.dispose();
  }
}
