import { Vector3, MathUtils } from 'three';
import { ENEMY_CONFIG, ENEMY_STATES } from '../utils/constants.js';
import { EnemyModel } from './EnemyModel.js';
import { EnemyAIController } from './EnemyAIController.js';
import { HealthComponent } from '../health/HealthComponent.js';

/**
 * An enemy entity — a thin facade over three collaborators, mirroring Player:
 *
 *   Enemy
 *    ├── EnemyAIController   (decides state + desired direction/speed/facing)
 *    ├── EnemyModel          (visual placeholder; GLB-ready seam)
 *    └── HealthComponent     (hp / damage / death)
 *
 * The facade owns the runtime position and applies AI output to it, resolving
 * static collision + world boundary via the shared CollisionSystem (same as the
 * player). It never reads the player's internals — only `target.getPosition()`.
 */
export class Enemy {
  /**
   * @param {object} definition map enemy definition (data only)
   * @param {object} [baseConfig] defaults (ENEMY_CONFIG)
   */
  constructor(definition, baseConfig = ENEMY_CONFIG) {
    this.id = definition.id;
    this.type = definition.type ?? 'basic';

    // Merge defaults with per-enemy overrides (data-driven tuning).
    this._config = { ...baseConfig, ...(definition.behavior ?? {}), ...(definition.stats ?? {}) };

    const [sx, sy, sz] = definition.position ?? [0, 0, 0];
    this.position = new Vector3(sx, sy, sz);
    this.velocity = new Vector3();
    this.facing = definition.rotation ?? 0;

    this._model = new EnemyModel(definition.color);
    this._object3D = this._model.getObject3D();
    this._object3D.position.copy(this.position);
    this._model.setFacingAngle(this.facing);

    const patrol = definition.behavior?.patrol ?? [];
    this._ai = new EnemyAIController(this._config, patrol);

    this.health = new HealthComponent(this._config.maxHealth);
    this._offDeath = this.health.onDeath(() => this._onDeath());

    this._removed = false;
    this._disposed = false;
  }

  // ----- Public API -----

  getObject3D() {
    return this._object3D;
  }

  getPosition() {
    return this.position;
  }

  getVelocity() {
    return this.velocity;
  }

  /** @returns {string} current AI state (see ENEMY_STATES). */
  getState() {
    return this._ai.state;
  }

  /** @returns {HealthComponent} */
  getHealth() {
    return this.health;
  }

  isDead() {
    return this.health.isDead();
  }

  /**
   * Apply damage. Death is handled via the health death callback.
   * @param {number} amount
   * @returns {number} damage applied
   */
  takeDamage(amount) {
    return this.health.takeDamage(amount);
  }

  /**
   * Advance one frame: AI decides, facade integrates + collides + syncs model.
   * @param {number} deltaTime seconds
   * @param {object} ctx
   * @param {{ getPosition(): import('three').Vector3 } | null} [ctx.target]
   * @param {{ getGroundHeight(x,z): number, getCollision(): object }} [ctx.world]
   */
  update(deltaTime, { target, world } = {}) {
    if (this.isDead()) {
      // Dead: no AI, no movement. Still cheap to skip here.
      this.velocity.set(0, 0, 0);
      return;
    }

    const targetPosition = target ? target.getPosition() : null;
    this._ai.update(deltaTime, { position: this.position, targetPosition });

    // Apply desired movement.
    const speed = this._ai.speed;
    this.velocity.copy(this._ai.moveDir).multiplyScalar(speed);
    this.position.x += this.velocity.x * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Static collision + boundary (shared system — same as the player).
    const collision = world?.getCollision?.();
    if (collision) collision.resolve(this.position, this._config.radius);

    // Ground height.
    this.position.y = world?.getGroundHeight
      ? world.getGroundHeight(this.position.x, this.position.z)
      : 0;

    // Smooth facing toward the AI's desired heading. The AI keeps `facing`
    // pointed at the player even while standing at chase-stop distance, so we
    // turn whenever moving or chasing.
    if (speed > 0 || this._ai.state === ENEMY_STATES.CHASE) {
      this.facing = this._approachAngle(
        this.facing,
        this._ai.facing,
        this._config.rotationSpeed * deltaTime
      );
    }

    // Sync visual.
    this._object3D.position.copy(this.position);
    this._model.setFacingAngle(this.facing);
    this._model.update(deltaTime, { state: this._ai.state, speed });
  }

  _onDeath() {
    this._ai.setDead();
    this.velocity.set(0, 0, 0);
    this._model.setDead();
  }

  _approachAngle(current, targetAngle, t) {
    let diff = targetAngle - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return current + diff * MathUtils.clamp(t, 0, 1);
  }

  /** Free GPU resources + listeners. Idempotent. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._offDeath) this._offDeath();
    this.health.clearListeners();
    this._model.dispose();
    // Detach from any parent scene node.
    this._object3D.removeFromParent?.();
  }
}
