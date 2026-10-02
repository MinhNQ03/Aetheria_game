/**
 * Health as pure data/logic — no Three.js, no rendering.
 *
 * Shared by any entity that can be damaged (enemies now; player/boss later).
 * Guarantees:
 *   - max is a finite number > 0 (validated at construction);
 *   - current always stays within [0, max];
 *   - non-positive / non-finite damage and heal are no-ops;
 *   - damage after death does nothing;
 *   - the death callback fires exactly once;
 *   - internal state (current, dead) is fully updated BEFORE any listener runs,
 *     and a throwing listener cannot corrupt that state (listeners are isolated).
 *
 * Listener registration returns an unsubscribe function — no global event bus.
 */
export class HealthComponent {
  /** @param {number} max maximum (and starting) health; must be finite and > 0. */
  constructor(max) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new Error(`HealthComponent: max must be a finite number > 0 (got ${max})`);
    }
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

  /** @returns {number} current health. */
  getCurrent() {
    return this.current;
  }

  /** @returns {number} max health. */
  getMax() {
    return this.max;
  }

  /** @returns {number} current / max in [0, 1]. */
  getFraction() {
    return this.current / this.max;
  }

  /**
   * Apply damage. Clamps at 0 and triggers death once.
   *
   * State is mutated and the dead flag decided before any notification, so a
   * throwing onDamage listener can't skip death handling or leave current in a
   * bad state. Listeners are invoked in isolation (one failure is contained).
   *
   * @param {number} amount positive, finite damage; otherwise ignored.
   * @returns {number} actual damage applied.
   */
  takeDamage(amount) {
    if (this._dead || !Number.isFinite(amount) || amount <= 0) return 0;

    // 1-4) Mutate state and decide death before emitting anything.
    const applied = Math.min(amount, this.current);
    this.current -= applied;
    const justDied = this.current <= 0;
    if (justDied) {
      this.current = 0;
      this._dead = true;
    }

    // 5) Damage notification.
    this._emit(this._onDamage, (cb) => cb(applied, this));

    // 6) Death notification (exactly once; state already final).
    if (justDied) {
      this._emit(this._onDeath, (cb) => cb(this));
    }

    return applied;
  }

  /**
   * Heal, clamped at max. No effect once dead or for non-positive amounts.
   * @param {number} amount positive, finite heal; otherwise ignored.
   * @returns {number} actual amount healed.
   */
  heal(amount) {
    if (this._dead || !Number.isFinite(amount) || amount <= 0) return 0;
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

  /**
   * Invoke each listener in isolation so one throwing listener doesn't stop the
   * others or corrupt health state. Errors are reported, not swallowed silently.
   */
  _emit(set, call) {
    for (const cb of set) {
      try {
        call(cb);
      } catch (err) {
        console.error('HealthComponent listener threw:', err);
      }
    }
  }
}
