import { COMBAT_CONFIG, COMBAT_STATES } from '../utils/constants.js';

/**
 * Player melee combat logic — timing and damage, no rendering.
 *
 * Lifecycle of one swing:
 *
 *   IDLE ──requestAttack()──► WINDUP ──► ACTIVE ──► RECOVERY ──► IDLE
 *                               (no hits)  (hits land)  (locked out)
 *
 * A cooldown gates how often a new swing may start. Damage can only land in the
 * ACTIVE window, and each swing hits any given target at most once
 * (one-hit-per-swing) via a Set that is cleared when the swing enters ACTIVE.
 *
 * The controller owns no Three.js objects. Game/Player feed it the attack
 * origin + facing and a hit-detection system + candidate source each frame; it
 * calls `target.takeDamage()` (never touches HealthComponent directly) and
 * reports its state for visuals/debug.
 */
export class CombatController {
  /** @param {object} [config] basic-attack config (COMBAT_CONFIG.basicAttack). */
  constructor(config = COMBAT_CONFIG.basicAttack) {
    this._config = config;

    this.state = COMBAT_STATES.IDLE;
    this._stateTime = 0; // seconds elapsed in the current phase
    this._cooldown = 0; // seconds until a new swing may start
    this._pendingAttack = false; // a requestAttack() waiting to be honored

    /** Targets already damaged by the current swing (one-hit-per-swing). */
    this._hitThisSwing = new Set();
    this._lastAttackHitCount = 0;
  }

  /** @returns {string} current combat state (see COMBAT_STATES). */
  getState() {
    return this.state;
  }

  /** @returns {boolean} whether a swing is in progress (not idle). */
  isAttacking() {
    return this.state !== COMBAT_STATES.IDLE;
  }

  /** @returns {number} seconds remaining before another swing can start. */
  getCooldownRemaining() {
    return Math.max(0, this._cooldown);
  }

  /** @returns {number} targets hit by the most recent completed/active swing. */
  getLastAttackHitCount() {
    return this._lastAttackHitCount;
  }

  /**
   * Request a swing. Honored only when idle and off cooldown; otherwise ignored
   * (no queuing/buffering in STEP 5). Edge-triggered by the caller.
   */
  requestAttack() {
    this._pendingAttack = true;
  }

  /**
   * Advance combat one frame.
   * @param {number} deltaTime seconds
   * @param {object} ctx
   * @param {{x:number,z:number}} ctx.position attack origin (player feet)
   * @param {number} ctx.facing player facing yaw (radians)
   * @param {{query(q:object):Array}} ctx.hitDetection
   * @param {() => Array} ctx.getTargets provider of alive candidate targets
   */
  update(deltaTime, { position, facing, hitDetection, getTargets }) {
    if (this._cooldown > 0) this._cooldown -= deltaTime;

    // Start a new swing if one is pending and we're free to act.
    if (
      this._pendingAttack &&
      this.state === COMBAT_STATES.IDLE &&
      this._cooldown <= 0
    ) {
      this._beginSwing();
    }
    this._pendingAttack = false; // a request only applies to the frame it's made

    switch (this.state) {
      case COMBAT_STATES.WINDUP:
        this._stateTime += deltaTime;
        if (this._stateTime >= this._config.windup) {
          this._enterActive();
        }
        break;

      case COMBAT_STATES.ACTIVE:
        this._stateTime += deltaTime;
        // Resolve hits every active frame (new targets may enter the arc).
        this._resolveHits(position, facing, hitDetection, getTargets);
        if (this._stateTime >= this._config.activeTime) {
          this._enterPhase(COMBAT_STATES.RECOVERY);
        }
        break;

      case COMBAT_STATES.RECOVERY:
        this._stateTime += deltaTime;
        if (this._stateTime >= this._config.recovery) {
          this.state = COMBAT_STATES.IDLE;
          this._stateTime = 0;
        }
        break;

      default:
        break; // IDLE: nothing to advance
    }
  }

  _beginSwing() {
    this.state = COMBAT_STATES.WINDUP;
    this._stateTime = 0;
    this._cooldown = this._config.cooldown;
    this._lastAttackHitCount = 0;
  }

  _enterActive() {
    this._enterPhase(COMBAT_STATES.ACTIVE);
    // One-hit-per-swing: fresh set for this active window.
    this._hitThisSwing.clear();
  }

  _enterPhase(state) {
    this.state = state;
    this._stateTime = 0;
  }

  _resolveHits(position, facing, hitDetection, getTargets) {
    const candidates = getTargets();
    const hits = hitDetection.query({
      origin: position,
      facing,
      config: this._config,
      candidates,
    });

    for (const target of hits) {
      if (this._hitThisSwing.has(target)) continue; // already hit this swing
      this._hitThisSwing.add(target);
      target.takeDamage(this._config.damage);
      this._lastAttackHitCount++;
    }
  }
}
