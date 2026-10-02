/**
 * Central configuration for the game.
 * Keep tunable values here instead of scattering magic numbers across modules.
 */

/** Supported language codes. */
export const LANGUAGES = Object.freeze({
  VI: 'vi',
  EN: 'en',
});

/** Default language the game boots with. */
export const DEFAULT_LANGUAGE = LANGUAGES.VI;

/** Identifier of the map loaded at startup. */
export const DEFAULT_MAP = 'TestWorld';

/** Renderer / display configuration. */
export const RENDER_CONFIG = Object.freeze({
  // Clamp pixel ratio to avoid over-rendering on high-DPI screens.
  maxPixelRatio: 2,
  clearColor: 0x87ceeb, // sky blue, overridden by the world background
  antialias: true,
});

/**
 * Third-person orbit camera configuration.
 *
 * The camera sits on a sphere around the player: `distance` back, rotated by a
 * yaw/pitch the player can orbit with the mouse. `height`/`lookAtHeight` keep
 * the player framed slightly below centre, which reads well for action RPGs.
 */
export const CAMERA_CONFIG = Object.freeze({
  fov: 60,
  near: 0.1,
  far: 1000,

  // Orbit geometry.
  distance: 8, // horizontal+depth distance from the player
  height: 4, // how high the camera sits above the player's feet
  lookAtHeight: 1.4, // point the camera looks at, above the player's origin

  // Initial orbit angles (radians). yaw 0 looks down -Z toward the player.
  initialYaw: 0,
  initialPitch: 0.32,

  // Pitch clamp so the camera never flips under/over the player.
  minPitch: -0.35,
  maxPitch: 1.15,

  // Smoothing (higher = snappier). Scaled by deltaTime for FPS independence.
  positionSmoothing: 8,

  // Mouse orbit sensitivity (radians per pixel of drag).
  orbitSensitivity: 0.0045,
});

/**
 * Player movement configuration.
 *
 * Movement is camera-relative and uses simple acceleration/deceleration toward
 * a target velocity so starts/stops feel weighted rather than instant.
 */
export const MOVEMENT_CONFIG = Object.freeze({
  // Max ground speed, units per second.
  speed: 6,
  // How fast velocity ramps up toward the target (units/s^2-ish, scaled by dt).
  acceleration: 40,
  // How fast velocity bleeds off when there's no input.
  deceleration: 30,
  // How quickly the model turns to face travel direction (per second).
  rotationSpeed: 12,
  // Below this speed with no input, the player is considered idle.
  idleThreshold: 0.05,
  // Player footprint radius used for static collision resolution.
  radius: 0.5,
});

/** Discrete movement states. Animation (later) can key off these. */
export const MOVEMENT_STATES = Object.freeze({
  IDLE: 'idle',
  MOVING: 'moving',
});

/**
 * Enemy defaults, split into two concerns:
 *   - stats: gameplay/movement numbers the entity owns;
 *   - ai:    perception/behaviour tuning the AI controller reads.
 *
 * A map's enemy definition overrides these via `definition.stats` and
 * `definition.ai`; `definition.behavior` carries metadata (mode, patrol).
 * See maps/TestWorld.js.
 */
export const ENEMY_CONFIG = Object.freeze({
  stats: Object.freeze({
    maxHealth: 30,
    // Patrol/idle wander speed vs. chase speed (units/second).
    moveSpeed: 2.2,
    chaseSpeed: 3.6,
    // Footprint radius for static collision resolution.
    radius: 0.5,
    // How quickly the model turns to face its heading (per second).
    rotationSpeed: 8,
  }),
  ai: Object.freeze({
    // How close the player must be to start chasing.
    detectionRadius: 10,
    // Must exceed detectionRadius to avoid state flicker at the edge.
    loseTargetRadius: 16,
    // Distance from a patrol point at which it's considered reached.
    waypointThreshold: 0.4,
    // How close the enemy stops when chasing (so it doesn't jitter).
    chaseStopDistance: 1.2,
    // NOTE: movement speeds live in `stats` (single source of truth). Enemy
    // composes stats.moveSpeed/stats.chaseSpeed into the AI config at runtime.
  }),
});

/** Enemy AI / lifecycle states. */
export const ENEMY_STATES = Object.freeze({
  IDLE: 'idle',
  PATROL: 'patrol',
  CHASE: 'chase',
  DEAD: 'dead',
});

/** Logical input actions, decoupled from physical keys. */
export const INPUT_ACTIONS = Object.freeze({
  FORWARD: 'forward',
  BACKWARD: 'backward',
  LEFT: 'left',
  RIGHT: 'right',
});
