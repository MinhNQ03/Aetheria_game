/**
 * Fixed structure for the main loop: a requestAnimationFrame driver that calls
 * update(deltaTime) then render() every frame.
 *
 * The loop itself knows nothing about players, enemies, or UI. The owner
 * (Game) passes in update/render callbacks, so new systems can be added inside
 * those callbacks without ever touching this file.
 */
export class GameLoop {
  /**
   * @param {object} callbacks
   * @param {(deltaTime: number) => void} callbacks.update
   * @param {() => void} callbacks.render
   * @param {() => number} callbacks.getDelta clock delta provider (seconds).
   */
  constructor({ update, render, getDelta }) {
    this._update = update;
    this._render = render;
    this._getDelta = getDelta;

    this._running = false;
    this._rafId = null;

    // Bound so requestAnimationFrame keeps the right `this`.
    this._tick = this._tick.bind(this);
  }

  /** @returns {boolean} */
  get isRunning() {
    return this._running;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick() {
    if (!this._running) return;

    // Clamp delta to avoid a huge jump after a tab was backgrounded.
    const deltaTime = Math.min(this._getDelta(), 0.1);

    this._update(deltaTime);
    this._render();

    this._rafId = requestAnimationFrame(this._tick);
  }
}
