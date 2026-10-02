import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_CONFIG } from '../utils/constants.js';

/**
 * Third-person follow camera.
 *
 * Owns a PerspectiveCamera and smoothly trails a target Object3D at a fixed
 * offset. The target can be swapped at runtime (setTarget), which later steps
 * can use for cutscenes, vehicles, or lock-on.
 *
 * Intentionally minimal in STEP 1: no lock-on, cinematic moves, shake, or
 * obstacle avoidance.
 */
export class CameraController {
  /**
   * @param {number} aspect initial viewport aspect ratio.
   * @param {object} [config] overrides for CAMERA_CONFIG.
   */
  constructor(aspect, config = CAMERA_CONFIG) {
    this._config = config;
    this.camera = new PerspectiveCamera(
      config.fov,
      aspect,
      config.near,
      config.far
    );

    /** @type {import('three').Object3D | null} */
    this._target = null;

    this._offset = new Vector3(
      config.offset.x,
      config.offset.y,
      config.offset.z
    );

    // Scratch vectors reused each frame to avoid per-frame allocations.
    this._desiredPosition = new Vector3();
    this._lookAt = new Vector3();
    this._lookAtOffset = new Vector3(0, config.lookAtHeight, 0);

    // Sensible starting pose before a target is assigned.
    this.camera.position.copy(this._offset);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Set (or clear) the object the camera follows.
   * @param {import('three').Object3D | null} target
   */
  setTarget(target) {
    this._target = target;
    if (target) {
      // Snap behind the target immediately so there's no initial lerp jump.
      this._desiredPosition.copy(target.position).add(this._offset);
      this.camera.position.copy(this._desiredPosition);
      this._updateLookAt(target);
    }
  }

  /**
   * Advance the follow interpolation.
   * @param {number} deltaTime seconds since last frame.
   */
  update(deltaTime) {
    if (!this._target) return;

    this._desiredPosition
      .copy(this._target.position)
      .add(this._offset);

    // Frame-rate independent smoothing.
    const t = Math.min(1, this._config.followLerp * deltaTime);
    this.camera.position.lerp(this._desiredPosition, t);

    this._updateLookAt(this._target);
  }

  _updateLookAt(target) {
    this._lookAt.copy(target.position).add(this._lookAtOffset);
    this.camera.lookAt(this._lookAt);
  }

  /**
   * Update projection when the viewport resizes.
   * @param {number} aspect
   */
  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
