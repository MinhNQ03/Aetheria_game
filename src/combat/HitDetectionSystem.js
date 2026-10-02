/**
 * Stateless melee hit detection on the XZ plane.
 *
 * Given an attack (origin, facing, config) and a list of candidate targets, it
 * returns which targets fall inside a forward sector:
 *
 *   hit  ⟺  planarDistance(origin, target) <= range + hitRadius
 *           AND angleBetween(facingDir, toTarget) <= halfAngle
 *
 * It never touches Three.js scene objects beyond reading `target.getPosition()`
 * and never allocates per candidate (reused scratch vectors). CombatController
 * only says "this attack is active"; this system decides who is actually hit.
 *
 * The candidate source is passed in (currently EnemyManager.getAliveEnemies()),
 * so a future spatial query can replace it without changing CombatController.
 */
export class HitDetectionSystem {
  constructor() {
    // Reused result array (no per-call allocation). Math uses scalars, so no
    // scratch vectors are needed.
    this._out = [];
  }

  /**
   * @param {object} q
   * @param {{x:number,z:number}} q.origin attacker position (XZ used)
   * @param {number} q.facing attacker facing yaw (radians); forward is
   *        (sin(facing), cos(facing)) on the XZ plane — same convention as the
   *        movement/model facing.
   * @param {object} q.config attack config (range, hitRadius, halfAngle)
   * @param {Array<{getPosition():{x:number,z:number}, isDead():boolean}>} q.candidates
   * @returns {Array} the subset of candidates that are hit (alive only)
   */
  query({ origin, facing, config, candidates }) {
    const out = this._out;
    out.length = 0;

    const maxDist = config.range + config.hitRadius;
    const maxDistSq = maxDist * maxDist;
    const cosHalfAngle = Math.cos(config.halfAngle);

    // Forward direction on the XZ plane (unit length).
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);

    for (const target of candidates) {
      if (!target || target.isDead()) continue;

      const p = target.getPosition();
      const dx = p.x - origin.x;
      const dz = p.z - origin.z;
      const distSq = dx * dx + dz * dz;

      // Range check first (cheap). Skip zero-distance degenerate case.
      if (distSq > maxDistSq || distSq < 1e-8) continue;

      // Angle check via normalized dot product against facing.
      const dist = Math.sqrt(distSq);
      const dot = (dx * fx + dz * fz) / dist; // cos(angle to target)
      if (dot >= cosHalfAngle) {
        out.push(target);
      }
    }

    return out;
  }
}
