import { Enemy } from './Enemy.js';

/**
 * Owns the lifecycle of all enemies for the current map: spawn, per-frame
 * update, removal of the dead, and disposal on map unload. It holds no AI logic
 * itself — each Enemy drives its own AI/movement/health.
 *
 *   EnemyManager.spawnFromDefinitions(defs)  // on map load
 *   EnemyManager.update(dt, { target, world })
 *   EnemyManager.dispose()                   // on map unload / teardown
 *
 * The manager adds/removes each enemy's Object3D to/from the world scene, so
 * no enemy outlives its map. Dead enemies are removed a short, fixed delay
 * after death (so the death visual is briefly visible) — no per-enemy timers;
 * the delay is tracked as elapsed time in the manager's own update.
 */
export class EnemyManager {
  /**
   * @param {import('three').Scene} scene the live map scene to parent enemies to
   */
  constructor(scene) {
    this._scene = scene;
    /** @type {Enemy[]} */
    this._enemies = [];
    /** Seconds a dead enemy lingers before removal. */
    this._removeDelay = 1.5;
    /** @type {Map<Enemy, number>} dead enemy -> elapsed time since death */
    this._deadTimers = new Map();
  }

  /**
   * Spawn one enemy from a data definition and parent it to the scene.
   * @param {object} definition
   * @returns {Enemy}
   */
  spawn(definition) {
    const enemy = new Enemy(definition);
    this._scene.add(enemy.getObject3D());
    this._enemies.push(enemy);
    return enemy;
  }

  /**
   * Spawn a batch (e.g. a map's `enemies` list).
   * @param {object[]} definitions
   */
  spawnFromDefinitions(definitions = []) {
    for (const def of definitions) this.spawn(def);
  }

  /** @returns {Enemy[]} all enemies (including dead-but-not-yet-removed). */
  getEnemies() {
    return this._enemies;
  }

  /** @returns {Enemy[]} enemies that are still alive. */
  getAliveEnemies() {
    return this._enemies.filter((e) => !e.isDead());
  }

  /** @returns {number} */
  getAliveCount() {
    let n = 0;
    for (const e of this._enemies) if (!e.isDead()) n++;
    return n;
  }

  /**
   * Nearest alive enemy to a world position (for debug / future targeting).
   * @param {import('three').Vector3} position
   * @returns {Enemy | null}
   */
  getNearestAlive(position) {
    let best = null;
    let bestSq = Infinity;
    for (const e of this._enemies) {
      if (e.isDead()) continue;
      const p = e.getPosition();
      const dx = p.x - position.x;
      const dz = p.z - position.z;
      const d = dx * dx + dz * dz;
      if (d < bestSq) {
        bestSq = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Update all enemies, then remove any that have been dead past the delay.
   * @param {number} deltaTime seconds
   * @param {object} ctx forwarded to each Enemy.update ({ target, world }).
   */
  update(deltaTime, ctx) {
    for (const enemy of this._enemies) {
      enemy.update(deltaTime, ctx);

      if (enemy.isDead()) {
        const elapsed = (this._deadTimers.get(enemy) ?? 0) + deltaTime;
        this._deadTimers.set(enemy, elapsed);
      }
    }

    // Remove enemies whose death lingered past the delay. Iterate a copy-safe
    // way (collect, then remove) to avoid mutating during the loop above.
    if (this._deadTimers.size > 0) {
      for (const [enemy, elapsed] of this._deadTimers) {
        if (elapsed >= this._removeDelay) this.remove(enemy);
      }
    }
  }

  /**
   * Remove and dispose a single enemy (idempotent per enemy).
   * @param {Enemy} enemy
   */
  remove(enemy) {
    const i = this._enemies.indexOf(enemy);
    if (i !== -1) this._enemies.splice(i, 1);
    this._deadTimers.delete(enemy);
    enemy.dispose();
  }

  /** Dispose every enemy and clear state (map unload / teardown). */
  dispose() {
    for (const enemy of this._enemies) enemy.dispose();
    this._enemies.length = 0;
    this._deadTimers.clear();
  }
}
