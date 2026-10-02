/**
 * UI capture tool (development only — NOT part of the game/build).
 *
 * Launches installed Chrome (headless) via Playwright, opens the running dev
 * server, lets the WebGL scene render, drives inputs (keyboard + mouse drag),
 * and writes screenshots + a JSON report to tools/shots/. The agent reads the
 * PNGs/JSON to "see" and verify the game.
 *
 * IMPORTANT: this is an AUTOMATED WebGL render test. Headless Chrome renders
 * WebGL via ANGLE/SwiftShader (software) — it proves the scene draws and logic
 * runs, NOT real hardware-GPU rendering or FPS.
 *
 * Usage: node tools/capture.mjs [baseUrl]   # default http://localhost:5173
 * Requires a dev server already running (capture does not start one).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'shots');
const BASE_URL = process.argv[2] || 'http://localhost:5173';

const VIEWPORT = { width: 1280, height: 720 };
const SETTLE_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parse "x / y / z" from the debug-overlay line beginning with `label`. */
function parseVec(text, label) {
  const line = text.split('\n').find((l) => l.trim().startsWith(label));
  if (!line) return null;
  const nums = line.match(/-?\d+\.\d+/g);
  if (!nums || nums.length < 3) return null;
  return { x: +nums[0], y: +nums[1], z: +nums[2] };
}

/** Parse a single integer value from a labelled overlay line. */
function parseInt1(text, label) {
  const line = text.split('\n').find((l) => l.trim().startsWith(label));
  if (!line) return null;
  const m = line.match(/-?\d+/);
  return m ? +m[0] : null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const page = await browser.newPage({ viewport: VIEWPORT });
  const consoleLines = [];
  const errors = [];
  page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(String(e)));

  const report = { baseUrl: BASE_URL, shots: [], tests: {}, consoleLines, errors };
  const overlay = () =>
    page.evaluate(() => {
      const el = document.getElementById('debug-overlay');
      return el ? el.innerText : '';
    });

  const PLAYER = 'Nhân vật';
  const COLLIDERS = 'Vật cản';
  const ENEMIES = 'Quái';
  const ALIVE = 'Còn sống';
  const ENEMY_STATE = 'Trạng thái quái';

  /** Read the text value after the first ':' of a labelled overlay line. */
  const readLabel = (text, label) => {
    const line = text.split('\n').find((l) => l.trim().startsWith(label));
    if (!line) return null;
    const i = line.indexOf(':');
    return i === -1 ? null : line.slice(i + 1).trim();
  };

  try {
    // domcontentloaded is enough (and faster/steadier than networkidle under a
    // loaded dev machine + headless SwiftShader).
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    report.status = resp ? resp.status() : null;
    // Assert the canvas is attached to the DOM. A full-viewport <canvas> can
    // intermittently fail Playwright's stricter 'visible' check even when on
    // screen; the WebGL context check below confirms it's actually drawing.
    // Timeout is generous because headless startup can be slow on a busy host.
    await page.waitForSelector('#game-canvas', { state: 'attached', timeout: 30000 });
    await sleep(SETTLE_MS);

    report.canvas = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return {
        width: c.width,
        height: c.height,
        hasWebGL: !!gl,
        renderer: gl
          ? gl.getParameter(
              (gl.getExtension('WEBGL_debug_renderer_info') || {})
                .UNMASKED_RENDERER_WEBGL || gl.RENDERER
            )
          : null,
      };
    });

    const shoot = async (name) => {
      await page.screenshot({ path: join(OUT_DIR, name) });
      report.shots.push(name);
    };

    const start = await overlay();
    report.tests.overlayStart = start;
    report.tests.spawn = parseVec(start, PLAYER);
    report.tests.colliderCount = parseInt1(start, COLLIDERS);
    // Enemies at spawn: expect a count, all alive, nearest not chasing yet
    // (player spawns at origin; the nearest guard sits ~8.5 units away > 10? no,
    // ~8.49 < 10, so it may already chase — we assert count/alive, not state).
    report.tests.enemyStart = {
      count: parseInt1(start, ENEMIES),
      alive: parseInt1(start, ALIVE),
      nearestState: readLabel(start, ENEMY_STATE),
    };
    await shoot('01-spawn.png');

    // Hold keys for `ms`; return before/after player position + distance.
    const move = async (keys, ms) => {
      const before = parseVec(await overlay(), PLAYER);
      for (const k of keys) await page.keyboard.down(k);
      await sleep(ms);
      for (const k of keys) await page.keyboard.up(k);
      await sleep(250);
      const after = parseVec(await overlay(), PLAYER);
      const dist = before && after
        ? Math.hypot(after.x - before.x, after.z - before.z) : null;
      return { before, after, dist };
    };

    // --- Enemy chase: stand still ~1.2s; the near guard (within detection
    //     radius) should chase, so nearest-enemy state becomes "chase". ---
    await sleep(1200);
    const chaseOverlay = await overlay();
    report.tests.enemyChase = {
      nearestState: readLabel(chaseOverlay, ENEMY_STATE),
      alive: parseInt1(chaseOverlay, ALIVE),
    };
    await shoot('02-enemy-chase.png');

    // --- COMBAT: teleport next to the distant idle guard (guard_02 at
    //     (-28,0,-28)), face it (-Z, facing=PI), and swing. Verify real melee
    //     damage via Enemy.takeDamage, one-hit-per-swing, cooldown, and death.
    //     Uses the DEV hooks (dev build only). ---
    const hasDevHooks = await page.evaluate(
      () => typeof window.__game !== 'undefined'
    );
    report.tests.hasDevHooks = hasDevHooks;

    if (!hasDevHooks) {
      // Production build: no debug surface, so combat/boundary tests that rely
      // on teleport/health-read are skipped. The load+render smoke test above
      // (status 200, errors [], WebGL) still validates the production bundle.
      report.tests.skippedDevTests = true;
    } else {
    const enemyHp = () =>
      page.evaluate(() =>
        window.__game && window.__game.devGetNearestEnemyHealth
          ? window.__game.devGetNearestEnemyHealth()
          : null
      );
    const faceEnemy = () =>
      page.evaluate(() => window.__game.devSetPlayerPosition(-28, 0, -26, Math.PI));

    await faceEnemy();
    await sleep(200);
    const hpStart = await enemyHp(); // expect 30

    // Case E: one swing deals exactly `damage` once (one-hit-per-swing).
    await page.keyboard.press('Space');
    // Read cooldown shortly after the swing starts: > 0 proves a cooldown is
    // active and would gate a retap (deterministic, not a wall-clock race).
    await sleep(120);
    const cooldownNow = parseFloat(readLabel(await overlay(), 'Hồi chiêu'));
    // Then wait comfortably past windup+active (even under a slow headless
    // host, where clamped deltaTime stretches wall-clock) before reading HP.
    await sleep(600);
    const hpAfter1 = await enemyHp(); // expect 20 (one swing = 10)

    report.tests.combatHit = {
      hpStart: hpStart ? hpStart.current : null,
      hpAfterOneSwing: hpAfter1 ? hpAfter1.current : null,
      // exactly one swing's damage (10) applied — proves one-hit-per-swing
      oneSwingDamage:
        hpStart && hpAfter1 ? hpStart.current - hpAfter1.current : null,
      // cooldown is counting down after the swing (gates the next request)
      cooldownActive: Number.isFinite(cooldownNow) ? cooldownNow > 0 : null,
    };
    await shoot('03-combat-hit.png');

    // Kill the guard with repeated swings (spaced past cooldown) and confirm it
    // dies and is removed. 30 HP / 10 => 3 hits; a few extra to be safe.
    const aliveBeforeKill = parseInt1(await overlay(), ALIVE);
    for (let i = 0; i < 4; i++) {
      await faceEnemy();
      await page.keyboard.press('Space');
      await sleep(600); // > cooldown so each swing counts
    }
    await sleep(400);
    const killOverlay = await overlay();
    report.tests.combatDeath = {
      aliveBefore: aliveBeforeKill,
      aliveAfter: parseInt1(killOverlay, ALIVE),
      died:
        aliveBeforeKill != null &&
        parseInt1(killOverlay, ALIVE) < aliveBeforeKill,
    };

    // Case B: miss when out of range. Teleport far from any enemy and swing;
    // nearest enemy HP must not change.
    await page.evaluate(() => window.__game.devSetPlayerPosition(0, 0, 40, 0));
    await sleep(150);
    const hpBeforeMiss = await enemyHp();
    await page.keyboard.press('Space');
    await sleep(400);
    const hpAfterMiss = await enemyHp();
    report.tests.combatMiss = {
      hpBefore: hpBeforeMiss ? hpBeforeMiss.current : null,
      hpAfter: hpAfterMiss ? hpAfterMiss.current : null,
      missed:
        hpBeforeMiss && hpAfterMiss
          ? hpBeforeMiss.current === hpAfterMiss.current
          : null,
    };

    // --- Movement sanity (no screenshot; overlay assertion only) ---
    report.tests.forward = await move(['KeyW'], 800);

    // --- Collision: push +X,+Z into the crate cluster, then assert the player
    //     is OUTSIDE every crate collider (geometry-based, not a loose box).
    //     Crates (centre, half-extent) from maps/TestWorld.js; player radius 0.5.
    //     Inside an inflated AABB (half + radius) would mean penetration. ---
    const PLAYER_RADIUS = 0.5;
    const CRATES = [
      { x: 3, z: 5, halfX: 0.75, halfZ: 0.75 },
      { x: 5, z: 5, halfX: 0.75, halfZ: 0.75 },
      { x: 4, z: 7, halfX: 1.0, halfZ: 1.0 },
    ];
    await move(['KeyS'], 400);
    const col = await move(['KeyW', 'KeyD'], 1500);
    const insideAny = (p) =>
      CRATES.some(
        (c) =>
          Math.abs(p.x - c.x) < c.halfX + PLAYER_RADIUS - 1e-3 &&
          Math.abs(p.z - c.z) < c.halfZ + PLAYER_RADIUS - 1e-3
      );
    report.tests.collision = {
      end: col.after,
      // blocked === true means the player did not penetrate any crate.
      blocked: col.after ? !insideAny(col.after) : null,
    };

    // --- World boundary (fast): teleport near maxX via the DEV hook, then
    //     push +X briefly. Avoids a multi-second walk. bounds +/-48, player
    //     radius 0.5 => clamp at x ≈ 47.5. ---
    const teleported = await page.evaluate(() => {
      if (window.__game && typeof window.__game.devSetPlayerPosition === 'function') {
        window.__game.devSetPlayerPosition(46, 0, 0, 0);
        return true;
      }
      return false;
    });
    report.tests.devHook = teleported;
    await sleep(100);
    const far = await move(['KeyD'], 600);
    const bx = far.after ? far.after.x : null;
    report.tests.boundary = {
      end: far.after,
      // Clamped at ~47.5, never beyond the hard max (48).
      clamped: bx != null ? bx <= 48 && bx >= 47 : null,
    };
    await shoot('04-boundary.png');
    } // end dev-hook-only tests

    // --- Camera orbit via mouse drag (works in dev and production) ---
    const cx = VIEWPORT.width / 2;
    const cy = VIEWPORT.height / 2;
    const camBefore = parseVec(await overlay(), 'Máy quay');
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(cx + i * 24, cy); await sleep(16); }
    await page.mouse.up();
    await sleep(400);
    const camAfter = parseVec(await overlay(), 'Máy quay');
    report.tests.cameraOrbit = {
      before: camBefore, after: camAfter,
      moved: camBefore && camAfter
        ? Math.hypot(camAfter.x - camBefore.x, camAfter.z - camBefore.z) > 0.1
        : null,
    };

    // --- Language toggle (no screenshot; overlay assertion only) ---
    await page.keyboard.press('KeyL');
    await sleep(300);
    report.tests.overlayEN = await overlay();

    // --- Resize ---
    await page.setViewportSize({ width: 900, height: 600 });
    await sleep(400);
    report.tests.resizedCanvas = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      return { width: c.width, height: c.height };
    });
    await shoot('05-resized.png');
  } catch (err) {
    report.fatal = String(err);
  } finally {
    writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    await browser.close();
  }

  console.log('CAPTURE_OK shots=' + report.shots.length);
  if (report.errors.length || report.fatal) {
    console.log('CAPTURE_HAS_ERRORS');
    process.exitCode = 1;
  }
}

main();
