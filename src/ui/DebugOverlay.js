/**
 * Lightweight on-screen debug panel: FPS, current map, player position, and
 * active language. All labels go through Localization (never hard-coded), and
 * the panel re-renders its labels when the language changes.
 *
 * Pure DOM — no framework. Mounts a fixed-position element over the canvas.
 */
export class DebugOverlay {
  /** @param {import('../localization/Localization.js').Localization} localization */
  constructor(localization) {
    this._loc = localization;
    this._el = null;
    this._rows = {};

    // FPS smoothing.
    this._fps = 0;
    this._accum = 0;
    this._frames = 0;

    this._unsubscribe = null;
  }

  /** Create and attach the overlay DOM. */
  mount() {
    if (this._el) return;

    const el = document.createElement('div');
    el.id = 'debug-overlay';
    Object.assign(el.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      padding: '8px 10px',
      font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      color: '#e6f0ff',
      background: 'rgba(10, 14, 22, 0.6)',
      borderRadius: '6px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      zIndex: '10',
    });

    // One row per metric; label text filled by _renderLabels().
    for (const key of [
      'fps',
      'map',
      'player',
      'state',
      'speed',
      'camera',
      'assets',
      'colliders',
      'enemies',
      'aliveEnemies',
      'enemyState',
      'language',
    ]) {
      const row = document.createElement('div');
      el.appendChild(row);
      this._rows[key] = row;
    }

    document.body.appendChild(el);
    this._el = el;

    // Keep labels in sync with language changes.
    this._unsubscribe = this._loc.onChange(() => this._renderLabels());
    this._renderLabels();
  }

  /** Remove the overlay and listeners. */
  unmount() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._rows = {};
  }

  /**
   * Update metrics each frame.
   * @param {object} data
   * @param {number} data.deltaTime seconds since last frame.
   * @param {string} data.mapName
   * @param {{x:number,y:number,z:number}} data.playerPosition
   * @param {string} data.language active language code.
   * @param {string} [data.movementState] one of MOVEMENT_STATES.
   * @param {number} [data.speed] current player speed.
   * @param {{x:number,y:number,z:number}} [data.cameraPosition]
   * @param {number} [data.assetCount] cached asset count.
   * @param {number} [data.colliderCount] static collider count.
   * @param {number} [data.enemyCount] total enemies.
   * @param {number} [data.aliveEnemies] alive enemies.
   * @param {string|null} [data.nearestEnemyState] nearest enemy AI state.
   */
  update({
    deltaTime,
    mapName,
    playerPosition,
    language,
    movementState,
    speed,
    cameraPosition,
    assetCount,
    colliderCount,
    enemyCount,
    aliveEnemies,
    nearestEnemyState,
  }) {
    if (!this._el) return;

    this._updateFps(deltaTime);

    this._lastMap = mapName;
    this._lastPos = playerPosition;
    this._lastLang = language;
    this._lastState = movementState;
    this._lastSpeed = speed;
    this._lastCamPos = cameraPosition;
    this._lastAssetCount = assetCount;
    this._lastColliderCount = colliderCount;
    this._lastEnemyCount = enemyCount;
    this._lastAliveEnemies = aliveEnemies;
    this._lastNearestEnemyState = nearestEnemyState;

    this._renderValues();
  }

  /** Map an AI/movement state code to its localized label. */
  _stateLabel(code) {
    const map = {
      idle: 'debug.stateIdle',
      moving: 'debug.stateMoving',
      patrol: 'debug.statePatrol',
      chase: 'debug.stateChase',
      dead: 'debug.stateDead',
    };
    return this._loc.t(map[code] || 'debug.stateIdle');
  }

  _updateFps(deltaTime) {
    this._accum += deltaTime;
    this._frames += 1;
    // Recompute roughly twice a second for a stable readout.
    if (this._accum >= 0.5) {
      this._fps = Math.round(this._frames / this._accum);
      this._accum = 0;
      this._frames = 0;
    }
  }

  /** Render only the localized label prefixes (on mount / language change). */
  _renderLabels() {
    this._renderValues();
  }

  /** Render full "Label: value" lines using current data + language. */
  _renderValues() {
    const t = (key) => this._loc.t(key);
    const pos = this._lastPos || { x: 0, y: 0, z: 0 };
    const fmt = (n) => n.toFixed(2);

    if (this._rows.fps) {
      this._rows.fps.textContent = `${t('debug.fps')}: ${this._fps}`;
    }
    if (this._rows.map) {
      this._rows.map.textContent = `${t('debug.map')}: ${
        this._lastMap || '-'
      }`;
    }
    if (this._rows.player) {
      this._rows.player.textContent = `${t('debug.player')}: ${fmt(
        pos.x
      )} / ${fmt(pos.y)} / ${fmt(pos.z)}`;
    }
    if (this._rows.state) {
      this._rows.state.textContent = `${t('debug.state')}: ${this._stateLabel(
        this._lastState
      )}`;
    }
    if (this._rows.speed) {
      const spd = typeof this._lastSpeed === 'number' ? this._lastSpeed : 0;
      this._rows.speed.textContent = `${t('debug.speed')}: ${fmt(spd)}`;
    }
    if (this._rows.camera) {
      const c = this._lastCamPos || { x: 0, y: 0, z: 0 };
      this._rows.camera.textContent = `${t('debug.camera')}: ${fmt(
        c.x
      )} / ${fmt(c.y)} / ${fmt(c.z)}`;
    }
    if (this._rows.assets) {
      const n = this._lastAssetCount ?? 0;
      this._rows.assets.textContent = `${t('debug.assets')}: ${n}`;
    }
    if (this._rows.colliders) {
      const n = this._lastColliderCount ?? 0;
      this._rows.colliders.textContent = `${t('debug.colliders')}: ${n}`;
    }
    if (this._rows.enemies) {
      const n = this._lastEnemyCount ?? 0;
      this._rows.enemies.textContent = `${t('debug.enemies')}: ${n}`;
    }
    if (this._rows.aliveEnemies) {
      const n = this._lastAliveEnemies ?? 0;
      this._rows.aliveEnemies.textContent = `${t('debug.aliveEnemies')}: ${n}`;
    }
    if (this._rows.enemyState) {
      const label = this._lastNearestEnemyState
        ? this._stateLabel(this._lastNearestEnemyState)
        : '-';
      this._rows.enemyState.textContent = `${t('debug.enemyState')}: ${label}`;
    }
    if (this._rows.language) {
      const lang = this._lastLang || this._loc.language;
      this._rows.language.textContent = `${t('debug.language')}: ${lang}`;
    }
  }
}
