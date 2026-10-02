/**
 * Health as pure data/logic — no Three.js, no rendering.
 *
 * Shared by any entity that can be damaged (enemies now; player/boss later).
 * Guarantees: current stays within [0, max]; non-positive damage/heal are
 * no-ops; damage after death does nothing; the death callback fires exactly
 * once. Listener registration returns an unsubscribe function so there's no
 * global event bus to leak.
 */
export class HealthComponent {
  /** @param {number} max maximum (and starting) health. */
  constructor(max) {
    this.max = max;
    this.current = max;
    this._dead = false;

    /** @type {Set<(amount: number, health: HealthComponent) => void>} */
    this._onDamage = new Set();
    /** @type {Set<(health: HealthComponent) => void>} */
    this._onDeath = new Set();
  }

  /** @returns {boolean} */
  isDead() {
    return this._dead;
  }

  /** @returns {number} current / max in [0, 1]. */
  getFraction() {
    return this.max > 0 ? this.current / this.max : 0;
  }

  /**
   * Apply damage. Clamps at 0 and triggers death once.
   * @param {number} amount positive damage; <= 0 is ignored.
   * @returns {number} actual damage applied.
   */
  takeDamage(amount) {
    if (this._dead || amount <= 0) return 0;

    const applied = Math.min(amount, this.current);
    this.current -= applied;

    for (const cb of this._onDamage) cb(applied, this);

    if (this.current <= 0) {
      this.current = 0;
      this._dead = true;
      for (const cb of this._onDeath) cb(this);
    }
    return applied;
  }

  /**
   * Heal, clamped at max. No effect once dead.
   * @param {number} amount positive heal; <= 0 is ignored.
   * @returns {number} actual amount healed.
   */
  heal(amount) {
    if (this._dead || amount <= 0) return 0;
    const before = this.current;
    this.current = Math.min(this.max, this.current + amount);
    return this.current - before;
  }

  /** Restore to full and clear the dead flag. */
  reset() {
    this.current = this.max;
    this._dead = false;
  }

  /**
   * @param {(amount: number, health: HealthComponent) => void} cb
   * @returns {() => void} unsubscribe
   */
  onDamage(cb) {
    this._onDamage.add(cb);
    return () => this._onDamage.delete(cb);
  }

  /**
   * @param {(health: HealthComponent) => void} cb
   * @returns {() => void} unsubscribe
   */
  onDeath(cb) {
    this._onDeath.add(cb);
    return () => this._onDeath.delete(cb);
  }

  /** Drop all listeners (call on entity disposal). */
  clearListeners() {
    this._onDamage.clear();
    this._onDeath.clear();
  }
}
