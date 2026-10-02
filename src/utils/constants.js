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

/** Third-person camera configuration. */
export const CAMERA_CONFIG = Object.freeze({
  fov: 60,
  near: 0.1,
  far: 1000,
  // Offset from the follow target, in world units.
  offset: { x: 0, y: 6, z: 10 },
  // How far above the target's origin the camera looks.
  lookAtHeight: 1.2,
  // Smoothing factor for follow interpolation (0..1 per frame-ish, scaled by dt).
  followLerp: 6,
});

/** Player movement configuration. */
export const MOVEMENT_CONFIG = Object.freeze({
  // Units per second.
  speed: 5,
  // How quickly the player rotates to face the movement direction (per second).
  rotationLerp: 10,
});

/** Logical input actions, decoupled from physical keys. */
export const INPUT_ACTIONS = Object.freeze({
  FORWARD: 'forward',
  BACKWARD: 'backward',
  LEFT: 'left',
  RIGHT: 'right',
});
