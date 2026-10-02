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

    // --- Movement sanity (also used by STEP 2 criteria) ---
    report.tests.forward = await move(['KeyW'], 800);
    await shoot('02-forward.png');

    // --- Collision: crates sit near (3..5, 5..7). Spawn is origin; walk +X,+Z
    //     into them and confirm we don't end up inside the cluster. ---
    // First return toward origin area.
    await move(['KeyS'], 400);
    const col = await move(['KeyW', 'KeyD'], 1500); // push toward crate cluster
    // After pushing into crates, player should be stopped outside them, i.e.
    // not sitting at the crate centres (~4,6). We assert it didn't pass far
    // beyond the near face. This is a soft check; exact value depends on angle.
    report.tests.collision = {
      end: col.after,
      // crates occupy roughly x in [2.25,5], z in [4.25,8]; player radius 0.5.
      // "blocked" = player not INSIDE the cluster interior.
      blocked: col.after
        ? !(col.after.x > 2.8 && col.after.x < 4.7 &&
            col.after.z > 4.8 && col.after.z < 7.2)
        : null,
    };
    await shoot('03-collision.png');

    // --- World boundary: bounds are +/-48 with radius 0.5 => |coord| <= 47.5.
    //     Walk a long time toward +X and confirm clamp. ---
    const far = await move(['KeyD'], 4000);
    const bx = far.after ? far.after.x : null;
    report.tests.boundary = {
      end: far.after,
      // Should be clamped at ~47.5 (allow small tolerance), never beyond 48.
      clamped: bx != null ? bx <= 48 && bx >= 46 : null,
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
    await shoot('05-camera.png');

    // --- Language toggle ---
    await page.keyboard.press('KeyL');
    await sleep(300);
    report.tests.overlayEN = await overlay();
    await shoot('06-language-en.png');

    // --- Resize ---
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
