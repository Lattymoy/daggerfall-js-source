// ═══════════════════════════════════════════════════════════════════
// EE0: THE WORLD RENDER GATE.
//
// The first Enhanced Environments attempt shipped a black world and
// every gate said pass, because no gate ever rendered the game: eslint,
// the node suite and a vite build have no GL context, and the lab's
// render gate loads a page that needs no data. The game needs ARENA2.
//
// This boots the ACTUAL exterior against ACTUAL data and reads ACTUAL
// pixels. It fails on:
//   - a page error;
//   - the frame never advancing (the world did not boot);
//   - a black ground: the lower half's mean under 20;
//   - a flat ground: fewer than 8 distinct colours in the lower half
//     (a void is one colour; so is a single unlit tile);
//   - a black sky: the upper half's mean under 20.
//
// Every slice of the arc runs it before committing. A slice that
// touches a shader runs it AND tools/bootProbe.mjs.
//
//   ARENA2_PATH=/path/to/ARENA2 node tools/worldRenderGate.mjs [--minutes N]
//       [--mode classic|enhanced] [--world] [--weather <type>] [--grass off]
//       [--season <name>] [--rain <n>] [--small] [--save]
//
// Every knob above is read by the page it is handed to; see the note on
// the knob list below.
//
// Standalone: it starts its own vite server on 5223, like the other
// world probes, so nothing else needs to be running.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = Number(arg('minutes', 720));        // noon by default: the sun is up and the ground is lit
const MODE = arg('mode', 'enhanced');
// AUDIT 54 (f3/render): EE3's `--ground` knob stood here and passed
// `&ground=<mode>` to a page that has not read it since 8256ae2 ("REVERT
// the Enhanced Environments ground arc": "no reader of tileArrayFor,
// enhancedGround or groundMode remains anywhere"), and then printed
// `ground=<mode>` in the pass line - a door that could neither fail nor
// act, claiming it had gated a ground mode that no longer exists. Every
// knob below still has a live reader: ?weather (scenes/shared.js's
// weatherName), ?grass (world.js's labGrass), ?season (shared.js's
// seasonOverride), ?rain (both hosts' precipOpts.countCap). Do not
// re-add a knob without one.
const WEATHER = arg('weather', null);        // EE5: ?weather=<type>, the probe door
const WORLD = process.argv.includes('--world');   // EE7: the WORLD host (?world), where the grass lives
const GRASS = arg('grass', null);            // EE7: ?grass=off, the kill switch
const SEASON = arg('season', null);          // EE7: ?season=summer, the existing pin - grass needs a lawn to stand on
const RAIN = arg('rain', null);              // EE8: ?rain=<n> caps the enhanced volume for the harness
const PORT = Number(process.env.GATE_PORT ?? 5223);   // a stuck server on one port must not block the next run

const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); fails.push(name); }
};

const server = await createServer({ server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
// EE7: --small halves the frame for the WORLD host, whose grass is a
// software rasteriser's whole afternoon at full size; the checks are
// ratios of the frame and do not care.
const SMALL = process.argv.includes('--small');
const page = await browser.newPage({ viewport: SMALL ? { width: 480, height: 300 } : { width: 960, height: 600 } });
page.setDefaultTimeout(300000);   // EE7: the world host under a software rasteriser is slow, and slow is not wrong
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

// the classic skin is the control; the enhanced skin is what the arc
// changes. ?sky=classic is NOT set, so the enhanced sky draws when the
// pref allows it.
// AUDIT 48 F1: the skin's URL door is ?skin=classic. A bare ?classic is
// the classic START-LOCATION door in world.js, so every classic-mode run
// of this gate before today rendered the ENHANCED skin and called it
// classic - the numbers only differed by weather. Now it is the skin.
const skin = MODE === 'classic' ? '&skin=classic' : '';
const dials = (WEATHER ? `&weather=${WEATHER}` : '') + (GRASS ? `&grass=${GRASS}` : '') + (SEASON ? `&season=${SEASON}` : '') + (RAIN ? `&rain=${RAIN}` : '');
await page.goto(`http://localhost:${PORT}/play/?${WORLD ? 'world' : 'exterior'}&shot&novideo&nofoes${skin}${dials}`);

// wait for the world to actually render frames
const until = Date.now() + 150000;   // EE8: the exterior boots in ~90s here; a shader that will not link never advances a frame, and the gate must say so inside a harness call
let frames = 0;
while (Date.now() < until) {
  frames = await page.evaluate(() => (typeof window.__frame === 'number' ? window.__frame : 0));
  if (frames > 30) break;
  await page.waitForTimeout(1000);
}
check('the exterior boots and renders frames', frames > 30, `frames=${frames}`);
check('no page error', errors.length === 0, errors.slice(0, 2).join(' | '));

// set the time of day, then let a few frames settle
if (MINUTES !== null) {
  await page.evaluate((m) => { if (window.__setWorldMinutes) window.__setWorldMinutes(m); }, MINUTES);
  await page.waitForTimeout(1500);
}

// the frame comes back as a SCREENSHOT of the canvas element, not a
// pixel read-back: the default framebuffer is cleared on present, so a
// read-back outside the game's own rAF returns zeros - which is the
// false "everything is black" this gate's first run reported. The
// compositor's copy is what the player sees, and it is what we judge.
const canvas = await page.$('canvas');
const png = await canvas.screenshot({ type: 'png', timeout: 180000 });   // EE7: a frame with grass in it takes a software rasteriser seconds
const { PNG } = await import('pngjs');
const img = PNG.sync.read(png);
const { width: w, height: h, data: px } = img;
const stats = (y0, y1) => {
  let sum = 0, n = 0; const seen = new Set();
  for (let y = y0; y < y1; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const o = (y * w + x) * 4;
      const r = px[o], g = px[o + 1], b = px[o + 2];
      sum += (r + g + b) / 3; n++;
      seen.add(`${r >> 4},${g >> 4},${b >> 4}`);
    }
  }
  return { mean: sum / n, colours: seen.size };
};
// PNG rows run top-down: the sky is the LOW rows, the ground the HIGH
const sample = { sky: stats(0, Math.floor(h * 0.4)), ground: stats(Math.floor(h * 0.55), h) };
check(`the lower half is lit (mean ${sample.ground.mean.toFixed(1)} > 20)`, sample.ground.mean > 20);
check(`the lower half has detail (${sample.ground.colours} colours > 8)`, sample.ground.colours > 8);
// EE3: THE TERRAIN ITSELF, not the lower half. The lower half has
// buildings in it, and buildings are lit even when the ground under
// them is a void - the gate passed on a black terrain because of them.
// The exterior boots to a fixed view, and in it the street runs
// through a band just above the HUD, centre-left, with no building
// standing in it. That band is the TERRAIN and it is judged alone.
// If the boot view ever changes, this band moves with it - it is a
// coordinate, not a law - but a band that reads under 12 has never
// been anything but a void.
// The band's MEDIAN, not its mean: a black terrain under falling snow
// carries bright specks that lifted the mean to 18 on one broken run
// and 2 on the next. The median of a void with dots in it is the void.
const street = (() => {
  const vals = [];
  const y0 = Math.floor(h * 0.78), y1 = Math.floor(h * 0.83);
  const x0 = Math.floor(w * 0.25), x1 = Math.floor(w * 0.44);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const o = (y * w + x) * 4; vals.push((px[o] + px[o + 1] + px[o + 2]) / 3);
  }
  vals.sort((a, b) => a - b);
  return vals[vals.length >> 1];
})();
check(`the TERRAIN is lit (street band median ${street.toFixed(1)} > 12)`, street > 12);
// EE2: the sky's expectation follows the hour. By day it is bright;
// at night it is DARK BUT NOT EMPTY - a mean well under day's, with
// stars and a moon as bright specks. A night sky that read like day
// would be the palette ignoring the clock; a night sky of pure zero
// would be the dome not drawing at all. Both are faults.
const NIGHT = MINUTES < 300 || MINUTES > 1260;
if (NIGHT) {
  check(`the night sky is dark (mean ${sample.sky.mean.toFixed(1)} < 70)`, sample.sky.mean < 70);
  check(`...but drawn, with lights in it (${sample.sky.colours} colours > 3)`, sample.sky.colours > 3);
} else {
  check(`the sky is drawn (mean ${sample.sky.mean.toFixed(1)} > 20)`, sample.sky.mean > 20);
}
if (process.argv.includes('--save')) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/worldGate.png', png);
}

await browser.close();
await server.close();
if (fails.length) { console.error(`\nworld render gate: ${fails.length} failure(s)`); process.exit(1); }
console.log(`\nworld render gate ok (${MODE}, ${MINUTES} min)`);
