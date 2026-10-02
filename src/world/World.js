import {
  Scene,
  Color,
  Fog,
  Group,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  DodecahedronGeometry,
  MeshStandardMaterial,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
} from 'three';
import { CollisionSystem } from './CollisionSystem.js';

/**
 * A loaded map instance built from a plain map definition.
 *
 * Owns: the Scene, environment (sky/fog/lights), static object meshes, the
 * map's CollisionSystem, ground height, boundary, and spawn point. It does NOT
 * own player movement, enemies, combat, quests, or save state.
 *
 * All GPU resources it creates are tracked and freed in dispose(). It never
 * disposes the shared AssetLoader cache (assets may be reused by other maps).
 */
export class World {
  /**
   * @param {object} definition a map definition (see maps/TestWorld.js)
   * @param {import('../utils/AssetLoader.js').AssetLoader} [assetLoader]
   */
  constructor(definition, assetLoader = null) {
    this.definition = definition;
    this.name = definition.id;
    this._assetLoader = assetLoader;

    this.scene = new Scene();
    this.collision = new CollisionSystem(definition.bounds);

    /** Map-owned geometries/materials to dispose on teardown. */
    this._disposables = [];
    this._built = false;
  }

  /**
   * Build scene content from the definition. Async so a future map that awaits
   * GLB assets uses the same entry point.
   * @returns {Promise<void>}
   */
  async build() {
    if (this._built) return;
    this._buildEnvironment();
    this._buildObjects();
    this._built = true;
  }

  // ----- Map API consumed by Game / MovementController -----

  /** @returns {{x,y,z,rotation}} spawn point for the player. */
  getSpawn() {
    const s = this.definition.spawn;
    return { x: s.x, y: s.y, z: s.z, rotation: s.rotation ?? 0 };
  }

  /** @returns {{minX,maxX,minZ,maxZ}} walkable boundary. */
  getBounds() {
    return this.definition.bounds;
  }

  /** @returns {CollisionSystem} this map's static collision. */
  getCollision() {
    return this.collision;
  }

  /** @returns {object[]} enemy spawn definitions (data only; may be empty). */
  getEnemyDefinitions() {
    return this.definition.enemies ?? [];
  }

  /**
   * Ground height at a world XZ position. Flat for now; the seam lets later
   * maps return terrain/heightmap/raycast values without changing callers.
   * @param {number} _x
   * @param {number} _z
   * @returns {number}
   */
  getGroundHeight(_x, _z) {
    return 0;
  }

  // ----- Build helpers -----

  _buildEnvironment() {
    const env = this.definition.environment;

    this.scene.background = new Color(env.skyColor);
    if (env.fog) {
      this.scene.fog = new Fog(env.fog.color, env.fog.near, env.fog.far);
    }

    if (env.hemisphere) {
      this.scene.add(
        new HemisphereLight(
          env.hemisphere.sky,
          env.hemisphere.ground,
          env.hemisphere.intensity
        )
      );
    }
    if (env.ambient) {
      this.scene.add(new AmbientLight(env.ambient.color, env.ambient.intensity));
    }
    if (env.sun) {
      const sun = new DirectionalLight(env.sun.color, env.sun.intensity);
      sun.position.set(...env.sun.position);
      this.scene.add(sun);
    }

    // Ground plane.
    const g = env.ground;
    const geo = new PlaneGeometry(g.size, g.size);
    const mat = new MeshStandardMaterial({
      color: g.color,
      roughness: 1,
      metalness: 0,
    });
    const ground = new Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this._track(geo, mat);
  }

  _buildObjects() {
    // Shared materials by color key, so repeated objects reuse one material.
    const colors = this.definition.colors || {};
    const sharedMat = new Map();
    const mat = (hex) => {
      if (!sharedMat.has(hex)) {
        const m = new MeshStandardMaterial({ color: hex, roughness: 0.9 });
        sharedMat.set(hex, m);
        this._disposables.push(m);
      }
      return sharedMat.get(hex);
    };

    for (const obj of this.definition.objects) {
      const [x, y, z] = obj.position;
      let node = null;

      switch (obj.type) {
        case 'tree':
          node = this._makeTree(mat(colors.trunk), mat(colors.foliage));
          break;
        case 'rock':
          node = this._makeRock(mat(colors.rock), obj.size?.[0] ?? 1);
          break;
        case 'crate':
          node = this._makeBox(mat(colors.crate), obj.size ?? [1.5, 1.5, 1.5]);
          break;
        case 'wall':
          node = this._makeBox(mat(colors.wall), obj.size ?? [4, 3, 1]);
          break;
        case 'path':
          node = this._makePath(obj.size ?? [4, 20]);
          break;
        default:
          continue;
      }

      node.position.set(x, y, z);
      this.scene.add(node);

      // Register collider from the definition (data-driven, not inferred).
      if (obj.collider) {
        if (obj.collider.shape === 'circle') {
          this.collision.addCircle(x, z, obj.collider.radius);
        } else if (obj.collider.shape === 'box') {
          this.collision.addBox(x, z, obj.collider.halfX, obj.collider.halfZ);
        }
      }
    }
  }

  _makeTree(trunkMat, foliageMat) {
    const group = new Group();
    const trunkGeo = new CylinderGeometry(0.3, 0.4, 2, 8);
    const trunk = new Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1;
    group.add(trunk);

    const foliageGeo = new ConeGeometry(1.6, 3.5, 8);
    const foliage = new Mesh(foliageGeo, foliageMat);
    foliage.position.y = 3.4;
    group.add(foliage);

    this._track(trunkGeo, null, foliageGeo);
    return group;
  }

  _makeRock(rockMat, radius) {
    const geo = new DodecahedronGeometry(radius);
    const mesh = new Mesh(geo, rockMat);
    mesh.position.y = radius * 0.6;
    this._track(geo);
    return mesh;
  }

  _makeBox(boxMat, size) {
    const [w, h, d] = size;
    const geo = new BoxGeometry(w, h, d);
    const mesh = new Mesh(geo, boxMat);
    mesh.position.y = h / 2;
    this._track(geo);
    return mesh;
  }

  _makePath(size) {
    const [w, len] = size;
    const geo = new PlaneGeometry(w, len);
    const mat = new MeshStandardMaterial({ color: 0xb8a67a, roughness: 1 });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    this._track(geo, mat);
    return mesh;
  }

  _track(...resources) {
    for (const r of resources) {
      if (r) this._disposables.push(r);
    }
  }

  /** Free GPU resources owned by this map (never the shared asset cache). */
  dispose() {
    for (const r of this._disposables) {
      if (r && typeof r.dispose === 'function') r.dispose();
    }
    this._disposables.length = 0;

    // Drop scene references so GC can reclaim nodes.
    this.scene.clear();
  }
}
