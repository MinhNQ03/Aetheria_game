import {
  Group,
  Mesh,
  CapsuleGeometry,
  ConeGeometry,
  RingGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  DoubleSide,
} from 'three';
import { COMBAT_CONFIG, COMBAT_STATES } from '../utils/constants.js';

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

    // --- Attack feedback: a flat slash arc in front of the player, matching
    // the gameplay hit sector (range + halfAngle). Hidden except during the
    // ACTIVE combat window. This is purely visual; gameplay hit detection is
    // computed separately in HitDetectionSystem.
    const atk = COMBAT_CONFIG.basicAttack;
    const arcGeo = new RingGeometry(0.6, atk.range, 24, 1, -atk.halfAngle, atk.halfAngle * 2);
    this._arcMat = new MeshBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 0.0,
      side: DoubleSide,
      depthWrite: false,
    });
    this._slash = new Mesh(arcGeo, this._arcMat);
    // Lay flat on the ground, open toward +Z (model forward). RingGeometry is
    // built in the XY plane around +X at angle 0; rotate so angle 0 -> +Z and
    // the ring lies on the XZ plane.
    this._slash.rotation.x = -Math.PI / 2;
    this._slash.rotation.z = Math.PI / 2;
    this._slash.position.y = 0.1;
    this._slash.visible = false;
    this.root.add(this._slash);
    this._track(arcGeo);
    this._track(this._arcMat);
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
   * Reflect the current combat state in the attack-feedback visual. The slash
   * arc is shown only during the ACTIVE window. Combat logic never touches the
   * mesh/material — it only passes a state string here.
   * @param {string} combatState one of COMBAT_STATES
   */
  setCombatState(combatState) {
    const active = combatState === COMBAT_STATES.ACTIVE;
    this._slash.visible = active;
    this._arcMat.opacity = active ? 0.5 : 0.0;
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
