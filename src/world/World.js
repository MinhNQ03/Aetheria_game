import {
  Scene,
  Color,
  Fog,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  AmbientLight,
  DirectionalLight,
} from 'three';
import { DEFAULT_MAP } from '../utils/constants.js';

/**
 * A simple test world built entirely from Three.js primitives.
 *
 * Owns the Scene plus its environment (sky color, fog, lights, ground, and a
 * few placeholder blocks). No external assets are loaded. Later steps will
 * replace this with real maps (Village, Forest, Dungeon) behind the same
 * interface: construct a world, read .scene, call dispose() on teardown.
 */
export class World {
  /** @param {string} [name] logical map name, used by UI/debug. */
  constructor(name = DEFAULT_MAP) {
    this.name = name;

    this.scene = new Scene();
    this.scene.background = new Color(0x9ad0ec); // soft daytime sky
    this.scene.fog = new Fog(0x9ad0ec, 40, 120);

    /** Meshes/materials/geometries to dispose on teardown. */
    this._disposables = [];

    this._buildLights();
    this._buildGround();
    this._buildPlaceholders();
  }

  _buildLights() {
    const ambient = new AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 20, 10);
    this.scene.add(sun);
  }

  _buildGround() {
    const geometry = new PlaneGeometry(200, 200);
    const material = new MeshStandardMaterial({
      color: 0x4f8f4f,
      roughness: 1,
      metalness: 0,
    });
    const ground = new Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2; // lay flat on the XZ plane
    this.scene.add(ground);
    this._track(geometry, material);
  }

  _buildPlaceholders() {
    // A handful of boxes to give the player a sense of movement and scale.
    const positions = [
      [-6, 1, -6],
      [6, 1, -8],
      [-8, 1, 6],
      [8, 1, 7],
      [0, 1, -14],
    ];

    for (const [x, y, z] of positions) {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new MeshStandardMaterial({ color: 0xb56b45 });
      const box = new Mesh(geometry, material);
      box.position.set(x, y, z);
      this.scene.add(box);
      this._track(geometry, material);
    }
  }

  _track(geometry, material) {
    this._disposables.push(geometry, material);
  }

  /** Free GPU resources owned by this world. */
  dispose() {
    for (const resource of this._disposables) {
      if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
      }
    }
    this._disposables.length = 0;
  }
}
