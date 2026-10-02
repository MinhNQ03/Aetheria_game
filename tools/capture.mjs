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
    const resp = await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    report.status = resp ? resp.status() : null;
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
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

    // --- Enemy death via DEV damage key (K). Guard has 30 HP, 10 per hit;
    //     press K 4x to be safe, then verify alive count dropped. ---
    const aliveBefore = parseInt1(await overlay(), ALIVE);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyK'); await sleep(120); }
    await sleep(200);
    const deathOverlay = await overlay();
    report.tests.enemyDeath = {
      aliveBefore,
      aliveAfter: parseInt1(deathOverlay, ALIVE),
      died: aliveBefore != null && parseInt1(deathOverlay, ALIVE) < aliveBefore,
    };
    await shoot('03-enemy-death.png');

    // --- Movement sanity (no screenshot; overlay assertion only) ---
    report.tests.forward = await move(['KeyW'], 800);

    // --- Collision: push +X,+Z toward the crate cluster (centres ~3..5,5..7).
    //     Assert the player ends up outside the cluster interior. ---
    await move(['KeyS'], 400);
    const col = await move(['KeyW', 'KeyD'], 1500);
    report.tests.collision = {
      end: col.after,
      blocked: col.after
        ? !(col.after.x > 2.8 && col.after.x < 4.7 &&
            col.after.z > 4.8 && col.after.z < 7.2)
        : null,
    };

    // --- World boundary: bounds +/-48, radius 0.5 => clamp at ~47.5.
    //     Walk +X long enough to actually reach the edge from wherever the
    //     player currently is (max span ~96 units at 6 u/s ≈ 16s; 9s is plenty
    //     from the mid-field position after the collision test). ---
    const far = await move(['KeyD'], 9000);
    const bx = far.after ? far.after.x : null;
    report.tests.boundary = {
      end: far.after,
      // Clamped at ~47.5 and never beyond the hard max (48).
      clamped: bx != null ? bx <= 48 && bx >= 47 : null,
    };
    await shoot('04-boundary.png');

    // --- Camera orbit via mouse drag ---
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
