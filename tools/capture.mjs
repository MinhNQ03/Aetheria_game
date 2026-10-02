/**
 * UI capture tool (development only — NOT part of the game/build).
 *
 * Launches the installed Chrome (headless) via Playwright, opens the running
 * dev server, lets the WebGL scene render, drives a few inputs, and writes
 * screenshots + a console/error report to tools/shots/. The agent reads those
 * PNGs to "see" the game.
 *
 * Usage (from project root, with node on PATH):
 *   node tools/capture.mjs [baseUrl]
 *   # default baseUrl: http://localhost:5173
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
// Give the rAF loop time to render a few frames before each shot.
const SETTLE_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome', // use the Chrome already installed on this machine
    headless: true,
    args: [
      // Enable GPU/WebGL in headless via ANGLE's software backend so WebGL
      // renders deterministically without a physical GPU.
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const page = await browser.newPage({ viewport: VIEWPORT });

  const consoleLines = [];
  const errors = [];
  page.on('console', (msg) =>
    consoleLines.push(`[${msg.type()}] ${msg.text()}`)
  );
  page.on('pageerror', (err) => errors.push(String(err)));

  const report = { baseUrl: BASE_URL, shots: [], consoleLines, errors };

  try {
    const resp = await page.goto(BASE_URL, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
    report.status = resp ? resp.status() : null;

    // Confirm the canvas exists and has a non-zero drawing buffer.
    await page.waitForSelector('#game-canvas', { timeout: 10000 });
    await sleep(SETTLE_MS);
    report.canvas = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      const gl =
        c.getContext('webgl2') || c.getContext('webgl');
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
      const file = join(OUT_DIR, name);
      await page.screenshot({ path: file });
      report.shots.push(name);
    };

    // 1) Default view (language = vi).
    await shoot('01-default-vi.png');

    // 2) Hold forward (W) for ~1s so the player visibly moves.
    await page.keyboard.down('KeyW');
    await sleep(1000);
    await page.keyboard.up('KeyW');
    await sleep(300);
    await shoot('02-moved-forward.png');

    // 3) Toggle language to EN (press L) — proves localized overlay updates.
    await page.keyboard.press('KeyL');
    await sleep(400);
    await shoot('03-language-en.png');

    // 4) Read the debug overlay text so we can verify it in text form too.
    report.overlayText = await page.evaluate(() => {
      const el = document.getElementById('debug-overlay');
      return el ? el.innerText : null;
    });
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

  // Surface a short summary on stdout for the exit-code path.
  console.log('CAPTURE_OK shots=' + report.shots.length);
  if (report.errors.length || report.fatal) {
    console.log('CAPTURE_HAS_ERRORS');
    process.exitCode = 1;
  }
}

main();
