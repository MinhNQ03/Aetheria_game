import {
  Group,
  Mesh,
  CapsuleGeometry,
  ConeGeometry,
  MeshStandardMaterial,
} from 'three';

/**
 * The player's VISUAL representation, isolated from movement logic.
 *
 * Owns the mesh(es) under a single root Group. Movement code only ever asks the
 * model to face a direction (`setFacingAngle`) or reports motion to it
 * (`update`); it never reaches into geometry. This is the seam where a GLB
 * character + AnimationMixer will replace the placeholder later:
 *
 *   PlayerModel (capsule)  ->  PlayerModel (GLB mesh)  ->  + AnimationMixer
 *
 * ...without touching MovementController, Player, Camera, or GameLoop.
 */
export class PlayerModel {
  constructor() {
    /** Root that movement rotates/positions; swap its children for a GLB. */
    this.root = new Group();

    this._disposables = [];

    // Body: a capsule standing on the ground (radius 0.5, cylinder part 1.0).
    const bodyGeo = new CapsuleGeometry(0.5, 1, 8, 16);
    const bodyMat = new MeshStandardMaterial({ color: 0x3a7bd5 });
    const body = new Mesh(bodyGeo, bodyMat);
    body.position.y = 1; // rest on the ground: half-height(0.5) + radius(0.5)
    this.root.add(body);
    this._track(bodyGeo, bodyMat);

    // A small nose cone marks "forward" so rotation is visible on the
    // placeholder. Points along +Z (model forward); harmless to remove with GLB.
    const noseGeo = new ConeGeometry(0.18, 0.4, 12);
    const noseMat = new MeshStandardMaterial({ color: 0xffd166 });
    const nose = new Mesh(noseGeo, noseMat);
    nose.rotation.x = Math.PI / 2; // point the cone along +Z
    nose.position.set(0, 1, 0.55);
    this.root.add(nose);
    this._track(noseGeo, noseMat);
  }

  /** @returns {import('three').Group} the visual root to add to the scene. */
  getObject3D() {
    return this.root;
  }

  /**
   * Face a world yaw angle (radians) around the Y axis.
   * @param {number} angle
   */
  setFacingAngle(angle) {
    this.root.rotation.y = angle;
  }

  /**
   * Per-frame visual update hook. No-op for the placeholder; a GLB version will
   * advance its AnimationMixer here based on movement state/speed.
   * @param {number} _deltaTime
   * @param {{ state: string, speed: number }} _motion
   */
  update(_deltaTime, _motion) {
    // Intentionally empty until an animated model is attached.
  }

  _track(geometry, material) {
    this._disposables.push(geometry, material);
  }

  /** Free GPU resources owned by the model. */
  dispose() {
    for (const r of this._disposables) {
      if (r && typeof r.dispose === 'function') r.dispose();
    }
    this._disposables.length = 0;
  }
}
