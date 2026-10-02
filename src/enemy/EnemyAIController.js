import { Vector3 } from 'three';
import { ENEMY_STATES } from '../utils/constants.js';

/** Behaviour modes a map can assign to an enemy. */
export const ENEMY_MODES = Object.freeze({
  GUARD: 'guard',
  PATROL: 'patrol',
});

/**
 * Enemy AI as a small, explicit state machine. It reads the enemy's current
 * position and the target (player) position, decides a state, and outputs a
 * desired movement direction + speed + facing. It owns NO Three.js scene
 * objects and never mutates position — the Enemy facade applies the result
 * (so collision/boundary stay in one place).
 *
 * The `mode` chooses the enemy's non-combat base behaviour:
 *   - guard:  base state is `idle`; stand until the player enters detection,
 *             chase, then return to `idle` on losing the target.
 *   - patrol: base state is `patrol`; walk the waypoint loop, chase on detect,
 *             then return to `patrol` on losing the target.
 *
 * States: idle | patrol | chase | dead.
 * loseTargetRadius > detectionRadius gives hysteresis so the state doesn't
 * flicker at the detection edge.
 */
export class EnemyAIController {
  /**
   * @param {object} aiConfig resolved AI config (detection/loseTarget/speeds/…)
   * @param {object} [options]
   * @param {string} [options.mode] 'guard' | 'patrol' (defaults to guard)
   * @param {Array<[number,number,number]>} [options.patrol] waypoints
   */
  constructor(aiConfig, { mode, patrol = [] } = {}) {
    this._config = aiConfig;
    this._patrol = patrol.map((p) => new Vector3(p[0], p[1] ?? 0, p[2]));
    this._patrolIndex = 0;

    this._mode = this._resolveMode(mode);
    // Base (non-chase) state is derived from the mode, not from data shape.
    this._baseState =
      this._mode === ENEMY_MODES.PATROL && this._patrol.length > 0
        ? ENEMY_STATES.PATROL
        : ENEMY_STATES.IDLE;
    this.state = this._baseState;

    /** Output written each frame: desired horizontal movement direction. */
    this.moveDir = new Vector3();
    /** Output: desired speed (0 when standing). */
    this.speed = 0;
    /** Output: desired facing yaw (radians); unchanged when not moving. */
    this.facing = 0;

    // Scratch vectors (allocated once; reused every frame).
    this._toTarget = new Vector3();
    this._toWaypoint = new Vector3();
  }

  /** @returns {string} resolved behaviour mode. */
  getMode() {
    return this._mode;
  }

  /** Validate the requested mode; fall back to guard, warning in dev. */
  _resolveMode(mode) {
    if (mode === ENEMY_MODES.GUARD || mode === ENEMY_MODES.PATROL) {
      return mode;
    }
    if (mode !== undefined && import.meta.env?.DEV) {
      console.warn(
        `EnemyAIController: unknown mode "${mode}", falling back to "guard".`
      );
    }
    return ENEMY_MODES.GUARD;
  }

  /** Force the terminal dead state (no more movement). */
  setDead() {
    this.state = ENEMY_STATES.DEAD;
    this.moveDir.set(0, 0, 0);
    this.speed = 0;
  }

  /**
   * Advance the AI one frame. Reads positions; writes moveDir/speed/facing.
   * @param {number} _deltaTime
   * @param {object} ctx
   * @param {import('three').Vector3} ctx.position enemy position (read-only)
   * @param {import('three').Vector3 | null} ctx.targetPosition player position
   */
  update(_deltaTime, { position, targetPosition }) {
    if (this.state === ENEMY_STATES.DEAD) {
      this.moveDir.set(0, 0, 0);
      this.speed = 0;
      return;
    }

    const cfg = this._config;
    const distToTarget = targetPosition
      ? this._planarDistance(position, targetPosition)
      : Infinity;

    // --- State transitions ---
    if (this.state === ENEMY_STATES.CHASE) {
      // Return to the mode's base state when the target escapes.
      if (distToTarget > cfg.loseTargetRadius) {
        this.state = this._baseState;
      }
    } else if (distToTarget <= cfg.detectionRadius) {
      this.state = ENEMY_STATES.CHASE;
    }

    // --- State behaviour (writes outputs) ---
    switch (this.state) {
      case ENEMY_STATES.CHASE:
        this._doChase(position, targetPosition, distToTarget);
        break;
      case ENEMY_STATES.PATROL:
        this._doPatrol(position);
        break;
      default:
        this._doIdle();
        break;
    }
  }

  _doChase(position, targetPosition, dist) {
    const cfg = this._config;
    // Stop a little short so the enemy doesn't jitter on top of the player.
    if (dist <= cfg.chaseStopDistance) {
      this.moveDir.set(0, 0, 0);
      this.speed = 0;
      // Keep facing the player while standing next to them.
      this._toTarget.copy(targetPosition).sub(position);
      if (this._toTarget.lengthSq() > 1e-6) {
        this.facing = Math.atan2(this._toTarget.x, this._toTarget.z);
      }
      return;
    }
    this._toTarget.copy(targetPosition).sub(position);
    this._toTarget.y = 0;
    this._setHeading(this._toTarget, cfg.chaseSpeed);
  }

  _doPatrol(position) {
    const cfg = this._config;
    const wp = this._patrol[this._patrolIndex];
    this._toWaypoint.copy(wp).sub(position);
    this._toWaypoint.y = 0;

    if (this._toWaypoint.length() <= cfg.waypointThreshold) {
      // Advance to the next waypoint (loop).
      this._patrolIndex = (this._patrolIndex + 1) % this._patrol.length;
      this.moveDir.set(0, 0, 0);
      this.speed = 0;
      return;
    }
    this._setHeading(this._toWaypoint, cfg.moveSpeed);
  }

  _doIdle() {
    this.moveDir.set(0, 0, 0);
    this.speed = 0;
  }

  /** Normalize a direction into moveDir and set speed + facing. */
  _setHeading(dir, speed) {
    if (dir.lengthSq() <= 1e-6) {
      this.moveDir.set(0, 0, 0);
      this.speed = 0;
      return;
    }
    this.moveDir.copy(dir).normalize();
    this.speed = speed;
    this.facing = Math.atan2(this.moveDir.x, this.moveDir.z);
  }

  _planarDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
  }
}
