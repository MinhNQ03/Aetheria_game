/**
 * TestWorld — the STEP 3 playground map, defined as plain data.
 *
 * A map definition is pure description: id, spawn, boundary, environment, and a
 * list of objects. World reads this and builds Three.js meshes + colliders from
 * it, so adding Village/Forest/Dungeon later means adding another data file —
 * no changes to World, Game, or the collision code.
 *
 * Object shape:
 *   { type, position:[x,y,z], size:[...], color, collider }
 * `collider` is optional:
 *   { shape:'box', halfX, halfZ } | { shape:'circle', radius } | null (walkable)
 *
 * Coordinates are world units on a flat (y=0) ground. `position[1]` is the
 * object's vertical centre; collision is resolved on the XZ plane.
 */

// Reusable palette so objects reference named colors (no scattered hex).
const COLORS = {
  trunk: 0x6b4a2b,
  foliage: 0x3f7d34,
  rock: 0x8a8a8a,
  crate: 0xb5763f,
  wall: 0x9a8c7a,
};

export const TestWorld = {
  id: 'TestWorld',

  // Where (and which way) the player appears.
  spawn: { x: 0, y: 0, z: 0, rotation: 0 },

  // Rectangular walkable boundary on the XZ plane.
  bounds: { minX: -48, maxX: 48, minZ: -48, maxZ: 48 },

  environment: {
    skyColor: 0x9ad0ec,
    fog: { color: 0x9ad0ec, near: 50, far: 140 },
    ground: { size: 100, color: 0x4f8f4f },
    hemisphere: { sky: 0xbfe3ff, ground: 0x3a5a34, intensity: 0.7 },
    sun: { color: 0xfff2d6, intensity: 1.1, position: [20, 30, 10] },
    ambient: { color: 0xffffff, intensity: 0.25 },
  },

  objects: [
    // --- Trees (trunk + foliage), with a circle collider on the trunk ---
    { type: 'tree', position: [-10, 0, -10], collider: { shape: 'circle', radius: 0.9 } },
    { type: 'tree', position: [12, 0, -14], collider: { shape: 'circle', radius: 0.9 } },
    { type: 'tree', position: [-16, 0, 8], collider: { shape: 'circle', radius: 0.9 } },
    { type: 'tree', position: [18, 0, 10], collider: { shape: 'circle', radius: 0.9 } },
    { type: 'tree', position: [4, 0, -22], collider: { shape: 'circle', radius: 0.9 } },

    // --- Rocks (dodecahedron), circle collider ---
    { type: 'rock', position: [-6, 0, 6], size: [1.4], collider: { shape: 'circle', radius: 1.4 } },
    { type: 'rock', position: [8, 0, 4], size: [1.0], collider: { shape: 'circle', radius: 1.0 } },
    { type: 'rock', position: [-20, 0, -4], size: [1.8], collider: { shape: 'circle', radius: 1.8 } },

    // --- Crates (box), box collider; varied sizes for sense of scale ---
    { type: 'crate', position: [3, 0, 5], size: [1.5, 1.5, 1.5], collider: { shape: 'box', halfX: 0.75, halfZ: 0.75 } },
    { type: 'crate', position: [5, 0, 5], size: [1.5, 1.5, 1.5], collider: { shape: 'box', halfX: 0.75, halfZ: 0.75 } },
    { type: 'crate', position: [4, 0, 7], size: [2, 2, 2], collider: { shape: 'box', halfX: 1, halfZ: 1 } },

    // --- A small L-shaped wall structure, box colliders ---
    { type: 'wall', position: [-14, 0, -2], size: [8, 3, 1], collider: { shape: 'box', halfX: 4, halfZ: 0.5 } },
    { type: 'wall', position: [-18, 0, 2], size: [1, 3, 8], collider: { shape: 'box', halfX: 0.5, halfZ: 4 } },

    // --- A flat path strip (visual only, walkable — no collider) ---
    { type: 'path', position: [0, 0.02, 18], size: [4, 24], collider: null },
  ],

  // Enemy spawns (data only — no Three.js objects here). EnemyManager reads
  // these on map load. `behavior` overrides ENEMY_CONFIG per enemy.
  enemies: [
    // Guard near the player — close enough to test chase quickly.
    {
      id: 'guard_01',
      type: 'basic',
      position: [6, 0, 6],
      rotation: 0,
      behavior: { mode: 'guard' },
    },
    // Patroller walking a square route around the clearing.
    {
      id: 'patrol_01',
      type: 'basic',
      position: [-10, 0, 12],
      behavior: {
        mode: 'patrol',
        patrol: [
          [-10, 0, 12],
          [-10, 0, 24],
          [-20, 0, 24],
          [-20, 0, 12],
        ],
      },
    },
    // Patroller on the far side — far enough to verify detection radius.
    {
      id: 'patrol_02',
      type: 'basic',
      position: [20, 0, -20],
      behavior: {
        mode: 'patrol',
        patrol: [
          [20, 0, -20],
          [30, 0, -20],
          [30, 0, -30],
        ],
      },
    },
    // Distant idle guard — stays idle while the player is far away.
    {
      id: 'guard_02',
      type: 'basic',
      position: [-28, 0, -28],
      behavior: { mode: 'guard' },
    },
  ],

  // Named palette exposed so World can resolve object colors.
  colors: COLORS,
};
