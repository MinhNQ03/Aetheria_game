import { PerspectiveCamera, Vector3, MathUtils } from 'three';
import { CAMERA_CONFIG } from '../utils/constants.js';

/**
 * Third-person orbit camera.
 *
 * Follows a target Object3D (the player) and orbits around it on a sphere
 * defined by (yaw, pitch, distance). Mouse-drag deltas rotate the orbit; the
 * resulting yaw is published via getYaw() so player movement can be
 * camera-relative. Position follow is smoothed for a non-jittery feel.
 *
 * Deliberately out of scope for STEP 2 (but not blocked by this design):
 * collision/obstacle avoidance, lock-on, cinematic/boss cameras, shake.
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

    // Orbit state.
    this._yaw = config.initialYaw;
    this._pitch = config.initialPitch;

    // Scratch vectors reused each frame (no per-frame allocation).
    this._focus = new Vector3(); // point the camera orbits/looks at
    this._desired = new Vector3(); // desired camera position this frame
    this._offset = new Vector3(); // orbit offset from focus
    this._focusLift = new Vector3(0, config.lookAtHeight, 0);

    this.camera.position.set(0, config.height, config.distance);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Set (or clear) the object the camera follows.
   * @param {import('three').Object3D | null} target
   */
  setTarget(target) {
    this._target = target;
    if (target) {
      // Snap to the desired pose immediately (no startup lerp jump).
      this._computeFocus(target);
      this._computeDesired();
      this.camera.position.copy(this._desired);
      this.camera.lookAt(this._focus);
    }
  }

  /**
   * Apply a mouse-drag delta (pixels) to the orbit angles.
   * @param {number} dx horizontal drag
   * @param {number} dy vertical drag
   */
  orbit(dx, dy) {
    if (dx === 0 && dy === 0) return;
    const s = this._config.orbitSensitivity;
    // Drag right -> look right (yaw decreases so the world rotates intuitively).
    this._yaw -= dx * s;
    this._pitch = MathUtils.clamp(
      this._pitch + dy * s,
      this._config.minPitch,
      this._config.maxPitch
    );
  }

  /** @returns {number} current yaw (radians) for camera-relative movement. */
  getYaw() {
    return this._yaw;
  }

  /** @returns {import('three').Vector3} current camera position (for debug). */
  getPosition() {
    return this.camera.position;
  }

  /**
   * Advance the follow interpolation.
   * @param {number} deltaTime seconds since last frame.
   */
  update(deltaTime) {
    if (!this._target) return;

    this._computeFocus(this._target);
    this._computeDesired();

    // Frame-rate independent smoothing toward the desired position.
    const t = Math.min(1, this._config.positionSmoothing * deltaTime);
    this.camera.position.lerp(this._desired, t);
    this.camera.lookAt(this._focus);
  }

  /** Focus point: target origin raised to look at the upper body. */
  _computeFocus(target) {
    this._focus.copy(target.position).add(this._focusLift);
  }

  /**
   * Desired camera position = focus + orbit offset derived from yaw/pitch.
   * At pitch 0 the camera sits `distance` behind (+Z side of) and `height`
   * above the focus; pitch raises/lowers it along the sphere.
   */
  _computeDesired() {
    const d = this._config.distance;
    const cosP = Math.cos(this._pitch);
    const horizontal = d * cosP;
    this._offset.set(
      Math.sin(this._yaw) * horizontal,
      this._config.height + d * Math.sin(this._pitch),
      Math.cos(this._yaw) * horizontal
    );
    this._desired.copy(this._focus).add(this._offset);
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
