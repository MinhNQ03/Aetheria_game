import { INPUT_ACTIONS } from '../utils/constants.js';

/**
 * Default mapping from physical keys (KeyboardEvent.code) to logical actions.
 * Both WASD and the arrow keys drive the same movement actions.
 */
const DEFAULT_KEY_MAP = {
  KeyW: INPUT_ACTIONS.FORWARD,
  ArrowUp: INPUT_ACTIONS.FORWARD,
  KeyS: INPUT_ACTIONS.BACKWARD,
  ArrowDown: INPUT_ACTIONS.BACKWARD,
  KeyA: INPUT_ACTIONS.LEFT,
  ArrowLeft: INPUT_ACTIONS.LEFT,
  KeyD: INPUT_ACTIONS.RIGHT,
  ArrowRight: INPUT_ACTIONS.RIGHT,
  Space: INPUT_ACTIONS.ATTACK,
  KeyJ: INPUT_ACTIONS.ATTACK,
};

/**
 * Actions that are edge-triggered (consumed once per physical press) rather
 * than reported as "held". Holding the key does NOT re-fire them each frame.
 */
const EDGE_ACTIONS = new Set([INPUT_ACTIONS.ATTACK]);

/**
 * Keyboard + mouse input, exposed as logical actions and consumable deltas so
 * gameplay/camera code never touches raw DOM events or key codes.
 *
 * Keyboard: isPressed(action) for held movement actions.
 * Mouse: drag (any button) over the canvas accumulates an orbit delta; the
 * camera reads it once per frame via consumePointerDelta(), which also resets
 * it. This keeps a single input abstraction (no second input system) and plays
 * nicely with headless capture (no pointer-lock requirement).
 *
 * Usage:
 *   const input = new InputManager();
 *   input.attach();                 // keyboard on window
 *   input.attachPointer(canvas);    // mouse orbit on the canvas
 *   if (input.isPressed(INPUT_ACTIONS.FORWARD)) { ... }
 *   const { dx, dy } = input.consumePointerDelta();
 *   input.detach();                 // on teardown
 */
export class InputManager {
  /**
   * @param {Record<string, string>} [keyMap] custom code -> action map.
   * @param {EventTarget} [target] element to listen on for keys (default window).
   */
  constructor(keyMap = DEFAULT_KEY_MAP, target = window) {
    this._keyMap = keyMap;
    this._target = target;
    /** @type {Set<string>} currently active (held) logical actions. */
    this._active = new Set();
    /** @type {Set<string>} edge-triggered actions pressed since last consume. */
    this._justPressed = new Set();
    this._attached = false;

    // Pointer (mouse) orbit state.
    this._pointerTarget = null;
    this._pointerAttached = false;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    // Accumulated, unconsumed drag delta in pixels.
    this._pointerDX = 0;
    this._pointerDY = 0;

    // Bind once so attach/detach use the same references.
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  /** Start listening for keyboard input. */
  attach() {
    if (this._attached) return;
    this._target.addEventListener('keydown', this._onKeyDown);
    this._target.addEventListener('keyup', this._onKeyUp);
    // Clear held keys if the window loses focus to avoid "stuck" movement.
    this._target.addEventListener('blur', this._onBlur);
    this._attached = true;
  }

  /**
   * Start listening for mouse-drag orbit on a specific element (the canvas).
   * @param {HTMLElement} element
   */
  attachPointer(element) {
    if (this._pointerAttached) return;
    this._pointerTarget = element;
    element.addEventListener('pointerdown', this._onPointerDown);
    // Move/up on window so a drag that leaves the canvas still tracks.
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this._pointerAttached = true;
  }

  /** Stop listening and clear all state. */
  detach() {
    if (this._attached) {
      this._target.removeEventListener('keydown', this._onKeyDown);
      this._target.removeEventListener('keyup', this._onKeyUp);
      this._target.removeEventListener('blur', this._onBlur);
      this._active.clear();
      this._justPressed.clear();
      this._attached = false;
    }
    if (this._pointerAttached) {
      this._pointerTarget.removeEventListener(
        'pointerdown',
        this._onPointerDown
      );
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
      this._pointerAttached = false;
      this._dragging = false;
      this._pointerDX = 0;
      this._pointerDY = 0;
    }
  }

  /**
   * @param {string} action one of INPUT_ACTIONS (held actions only).
   * @returns {boolean} whether the action is currently held.
   */
  isPressed(action) {
    return this._active.has(action);
  }

  /**
   * Edge-triggered read: returns true at most once per physical key press and
   * clears the flag, so a single press maps to a single action (no per-frame
   * spam while held). Use for ATTACK and similar discrete inputs.
   * @param {string} action
   * @returns {boolean}
   */
  consumePressed(action) {
    if (this._justPressed.has(action)) {
      this._justPressed.delete(action);
      return true;
    }
    return false;
  }

  /**
   * Read and reset the accumulated mouse-drag delta (pixels) since last call.
   * @returns {{dx: number, dy: number}}
   */
  consumePointerDelta() {
    const dx = this._pointerDX;
    const dy = this._pointerDY;
    this._pointerDX = 0;
    this._pointerDY = 0;
    return { dx, dy };
  }

  _onKeyDown(event) {
    const action = this._keyMap[event.code];
    if (!action) return;
    // Prevent default (arrow-key scroll, Space page-scroll).
    event.preventDefault();

    if (EDGE_ACTIONS.has(action)) {
      // Ignore OS auto-repeat; only the initial press counts as an edge.
      if (!event.repeat) this._justPressed.add(action);
    } else {
      this._active.add(action);
    }
  }

  _onKeyUp(event) {
    const action = this._keyMap[event.code];
    if (action && !EDGE_ACTIONS.has(action)) {
      this._active.delete(action);
    }
  }

  _onBlur() {
    this._active.clear();
    this._justPressed.clear();
    this._dragging = false;
  }

  _onPointerDown(event) {
    this._dragging = true;
    this._lastX = event.clientX;
    this._lastY = event.clientY;
  }

  _onPointerMove(event) {
    if (!this._dragging) return;
    this._pointerDX += event.clientX - this._lastX;
    this._pointerDY += event.clientY - this._lastY;
    this._lastX = event.clientX;
    this._lastY = event.clientY;
  }

  _onPointerUp() {
    this._dragging = false;
  }
}
