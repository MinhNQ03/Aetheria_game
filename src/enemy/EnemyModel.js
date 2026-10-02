import {
  Group,
  Mesh,
  CapsuleGeometry,
  ConeGeometry,
  MeshStandardMaterial,
} from 'three';

/**
 * An enemy's VISUAL representation, isolated from AI/movement.
 *
 * AI never touches geometry; it only tells the model where to face
 * (`setFacingAngle`) and whether it has died (`setDead`). This is the seam
 * where a GLB mesh + AnimationMixer will replace the placeholder later without
 * changing Enemy, the AI, or the manager.
 */
export class EnemyModel {
  /** @param {number} [color] body color (hex). */
  constructor(color = 0xc0392b) {
    this.root = new Group();
    this._disposables = [];

    const bodyGeo = new CapsuleGeometry(0.5, 1, 8, 16);
    this._bodyMat = new MeshStandardMaterial({ color });
    const body = new Mesh(bodyGeo, this._bodyMat);
    body.position.y = 1;
    this.root.add(body);
    this._track(bodyGeo);

    // Forward marker so facing is visible on the placeholder.
    const noseGeo = new ConeGeometry(0.18, 0.4, 12);
    this._noseMat = new MeshStandardMaterial({ color: 0x2c2c2c });
    const nose = new Mesh(noseGeo, this._noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1, 0.55);
    this.root.add(nose);
    this._track(noseGeo);

    this._track(this._bodyMat, this._noseMat);
  }

  /** @returns {import('three').Group} visual root to add to the scene. */
  getObject3D() {
    return this.root;
  }

  /** @param {number} angle world yaw (radians). */
  setFacingAngle(angle) {
    this.root.rotation.y = angle;
  }

  /**
   * Simple death visual: dim/desaturate and sink slightly. A GLB version would
   * play a death animation here instead.
   */
  setDead() {
    this._bodyMat.color.set(0x4a4a4a);
    this._bodyMat.transparent = true;
    this._bodyMat.opacity = 0.5;
    this.root.position.y -= 0.3;
  }

  /**
   * Per-frame visual hook. No-op for the placeholder; a GLB version advances
   * its AnimationMixer here from state/speed.
   * @param {number} _deltaTime
   * @param {{ state: string, speed: number }} _motion
   */
  update(_deltaTime, _motion) {
    // Intentionally empty until an animated model is attached.
  }

  _track(...resources) {
    for (const r of resources) if (r) this._disposables.push(r);
  }

  /** Free GPU resources owned by this model (never shared asset cache). */
  dispose() {
    for (const r of this._disposables) {
      if (r && typeof r.dispose === 'function') r.dispose();
    }
    this._disposables.length = 0;
  }
}
