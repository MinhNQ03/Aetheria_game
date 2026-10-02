/**
 * Static collision for a map, resolved on the horizontal (XZ) plane.
 *
 * The world registers simple blocking volumes (circles and axis-aligned
 * boxes). Movement asks the system to resolve a desired position for a moving
 * circle (the player's footprint radius); the system pushes the position out of
 * any volume it overlaps. It also clamps to the map's rectangular boundary.
 *
 * This is a flat seam: later steps can swap the internals for a spatial grid,
 * navmesh, or physics engine without changing how MovementController calls it.
 * No per-frame scene traversal — colliders are registered once at map build.
 */
export class CollisionSystem {
  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} [bounds]
   */
  constructor(bounds = null) {
    /** @type {Array<object>} registered static colliders */
    this._colliders = [];
    this._bounds = bounds;
  }

  /** @param {{minX,maxX,minZ,maxZ}} bounds */
  setBounds(bounds) {
    this._bounds = bounds;
  }

  /**
   * Register an axis-aligned box collider (XZ extents; Y ignored for now).
   * @param {number} x center X
   * @param {number} z center Z
   * @param {number} halfX half-size along X
   * @param {number} halfZ half-size along Z
   */
  addBox(x, z, halfX, halfZ) {
    this._colliders.push({ type: 'box', x, z, halfX, halfZ });
  }

  /**
   * Register a circle collider (XZ).
   * @param {number} x center X
   * @param {number} z center Z
   * @param {number} radius
   */
  addCircle(x, z, radius) {
    this._colliders.push({ type: 'circle', x, z, radius });
  }

  /** @returns {number} count of registered colliders. */
  getColliderCount() {
    return this._colliders.length;
  }

  /**
   * Resolve a moving circle against all colliders and the boundary, mutating
   * `pos` in place.
   * @param {{x:number,z:number}} pos desired position (mutated)
   * @param {number} radius mover footprint radius
   */
  resolve(pos, radius) {
    for (const c of this._colliders) {
      if (c.type === 'circle') {
        this._resolveCircle(pos, radius, c);
      } else {
        this._resolveBox(pos, radius, c);
      }
    }
    this.clampToBounds(pos, radius);
  }

  _resolveCircle(pos, radius, c) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minDist = radius + c.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }

  _resolveBox(pos, radius, c) {
    // Closest point on the (inflated) box to the mover centre.
    const minX = c.x - c.halfX - radius;
    const maxX = c.x + c.halfX + radius;
    const minZ = c.z - c.halfZ - radius;
    const maxZ = c.z + c.halfZ + radius;

    // Only overlapping if inside the inflated box.
    if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) {
      return;
    }

    // Push out along the axis of least penetration.
    const penLeft = pos.x - minX;
    const penRight = maxX - pos.x;
    const penTop = pos.z - minZ;
    const penBottom = maxZ - pos.z;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);

    if (minPen === penLeft) pos.x = minX;
    else if (minPen === penRight) pos.x = maxX;
    else if (minPen === penTop) pos.z = minZ;
    else pos.z = maxZ;
  }

  /**
   * Keep the mover inside the map boundary (accounting for its radius).
   * @param {{x:number,z:number}} pos
   * @param {number} radius
   */
  clampToBounds(pos, radius) {
    if (!this._bounds) return;
    const b = this._bounds;
    pos.x = Math.min(Math.max(pos.x, b.minX + radius), b.maxX - radius);
    pos.z = Math.min(Math.max(pos.z, b.minZ + radius), b.maxZ - radius);
  }
}
