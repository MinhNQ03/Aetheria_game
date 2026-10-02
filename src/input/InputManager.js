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
};

/**
 * Keyboard input, exposed as logical actions rather than raw keys so that
 * gameplay code (e.g. a future PlayerController) never touches key codes.
 *
 * Usage:
 *   const input = new InputManager();
 *   input.attach();
 *   if (input.isPressed(INPUT_ACTIONS.FORWARD)) { ... }
 *   input.detach(); // on teardown
 */
export class InputManager {
  /**
   * @param {Record<string, string>} [keyMap] custom code -> action map.
   * @param {EventTarget} [target] element to listen on (defaults to window).
   */
  constructor(keyMap = DEFAULT_KEY_MAP, target = window) {
    this._keyMap = keyMap;
    this._target = target;
    /** @type {Set<string>} currently active logical actions. */
    this._active = new Set();
    this._attached = false;

    // Bind once so attach/detach use the same references.
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  /** Start listening for input. */
  attach() {
    if (this._attached) return;
    this._target.addEventListener('keydown', this._onKeyDown);
    this._target.addEventListener('keyup', this._onKeyUp);
    // Clear held keys if the window loses focus to avoid "stuck" movement.
    this._target.addEventListener('blur', this._onBlur);
    this._attached = true;
  }

  /** Stop listening and clear state. */
  detach() {
    if (!this._attached) return;
    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
    this._target.removeEventListener('blur', this._onBlur);
    this._active.clear();
    this._attached = false;
  }

  /**
   * @param {string} action one of INPUT_ACTIONS.
   * @returns {boolean} whether the action is currently held.
   */
  isPressed(action) {
    return this._active.has(action);
  }

  _onKeyDown(event) {
    const action = this._keyMap[event.code];
    if (action) {
      this._active.add(action);
      // Prevent arrow keys from scrolling the page.
      event.preventDefault();
    }
  }

  _onKeyUp(event) {
    const action = this._keyMap[event.code];
    if (action) {
      this._active.delete(action);
    }
  }

  _onBlur() {
    this._active.clear();
  }
}
