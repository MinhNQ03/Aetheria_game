/**
 * UI capture tool (development only — NOT part of the game/build).
 *
 * Launches the installed Chrome (headless) via Playwright, opens the running
 * dev server, lets the WebGL scene render, drives inputs (keyboard + mouse
 * drag), and writes screenshots + a JSON report to tools/shots/. The agent
 * reads those PNGs/JSON to "see" and verify the game.
 *
 * IMPORTANT: this is an AUTOMATED WebGL render test. Headless Chrome renders
 * WebGL via ANGLE/SwiftShader (software), which proves the scene draws and the
 * logic runs — it is NOT a measure of real hardware-GPU rendering or FPS.
 *
 * Usage (from project root, with node on PATH):
 *   node tools/capture.mjs [baseUrl]      # default http://localhost:5173
 *
 * Requires a dev server already running (npm run dev). This script does not
 * start it, so capture and serving stay decoupled.
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

/** Parse "x / y / z" out of a debug-overlay line that starts with `label`. */
function parseVec(overlayText, label) {
  const line = overlayText
    .split('\n')
    .find((l) => l.trim().startsWith(label));
  if (!line) return null;
  const nums = line.match(/-?\d+\.\d+/g);
  if (!nums || nums.length < 3) return null;
  return { x: +nums[0], y: +nums[1], z: +nums[2] };
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
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => errors.push(String(err)));

  const report = { baseUrl: BASE_URL, shots: [], tests: {}, consoleLines, errors };

  const overlay = () =>
    page.evaluate(() => {
      const el = document.getElementById('debug-overlay');
      return el ? el.innerText : '';
    });

  // Center of the canvas, used as the origin for mouse-drag orbit.
  const cx = VIEWPORT.width / 2;
  const cy = VIEWPORT.height / 2;

  try {
    const resp = await page.goto(BASE_URL, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
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

    // The player-position label differs by language; capture starts in vi.
    const PLAYER_LABEL_VI = 'Nhân vật';

    // --- Baseline ---
    await shoot('01-default.png');
    report.tests.overlayStart = await overlay();

    // Hold a key for `ms`, return the distance travelled on the XZ plane.
    const measureMove = async (keys, ms) => {
      const before = parseVec(await overlay(), PLAYER_LABEL_VI);
      for (const k of keys) await page.keyboard.down(k);
      await sleep(ms);
      for (const k of keys) await page.keyboard.up(k);
      await sleep(250); // let deceleration settle a touch
      const after = parseVec(await overlay(), PLAYER_LABEL_VI);
      const dist =
        before && after
          ? Math.hypot(after.x - before.x, after.z - before.z)
          : null;
      return { before, after, dist };
    };

    // --- Test: forward (W) ---
    report.tests.forward = await measureMove(['KeyW'], 900);
    await shoot('02-forward.png');

    // --- Test: backward (S) ---
    report.tests.backward = await measureMove(['KeyS'], 600);

    // --- Test: strafe left/right (A, D) ---
    report.tests.left = await measureMove(['KeyA'], 600);
    report.tests.right = await measureMove(['KeyD'], 600);
    await shoot('03-strafed.png');

    // --- Test: diagonal must NOT be faster than single axis ---
    // Compare distance over the same duration for W vs W+D.
    const straight = await measureMove(['KeyW'], 700);
    const diagonal = await measureMove(['KeyW', 'KeyD'], 700);
    report.tests.diagonalCheck = {
      straightDist: straight.dist,
      diagonalDist: diagonal.dist,
      // true if diagonal isn't meaningfully faster (<5% over straight).
      ok:
        straight.dist != null &&
        diagonal.dist != null &&
        diagonal.dist <= straight.dist * 1.05,
    };
    await shoot('04-after-diagonal.png');

    // --- Test: camera orbit via mouse drag ---
    const camBefore = parseVec(await overlay(), 'Máy quay');
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Drag right across the canvas.
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(cx + i * 24, cy);
      await sleep(16);
    }
    await page.mouse.up();
    await sleep(400);
    const camAfter = parseVec(await overlay(), 'Máy quay');
    report.tests.cameraOrbit = {
      before: camBefore,
      after: camAfter,
      moved:
        camBefore && camAfter
          ? Math.hypot(
              camAfter.x - camBefore.x,
              camAfter.z - camBefore.z
            ) > 0.1
          : null,
    };
    await shoot('05-camera-orbited.png');

    // --- Test: language toggle (L) ---
    await page.keyboard.press('KeyL');
    await sleep(300);
    report.tests.overlayEN = await overlay();
    await shoot('06-language-en.png');

    // --- Test: resize ---
    await page.setViewportSize({ width: 900, height: 600 });
    await sleep(400);
    report.tests.resizedCanvas = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      return { width: c.width, height: c.height };
    });
    await shoot('07-resized.png');
  } catch (err) {
    report.fatal = String(err);
  } finally {
    writeFileSync(
      join(OUT_DIR, 'report.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );
    await browser.close();
  }

  console.log('CAPTURE_OK shots=' + report.shots.length);
  if (report.errors.length || report.fatal) {
    console.log('CAPTURE_HAS_ERRORS');
    process.exitCode = 1;
  }
}

main();
