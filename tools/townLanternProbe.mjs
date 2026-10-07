// YARD-LIGHT (2026-10-07, a field report: a night yard's lamp post and torch both dark, "i wish lights worked outside..",
// and Mac: "I guess enhanced lighting isnt shown lantern light anymore?"): THE TOWN'S LANTERNS, MEASURED IN THE REAL GAME.
// The suite pins the night's composition on a fake GL (test/yardLightRig.mjs); whether a lantern still LIGHTS THE STREET is
// a picture, and a picture is a number or it is a guess. This drives the WORLD host - the one players run - over the
// user's own ARENA2 in headless Chromium (ANGLE over SwiftShader): Daggerfall at night, the camera stood at street level
// five metres off the lowest lantern the frame lights and looking at it, then the SAME frame twice - once with the frame's
// point lights, once with renderer.setPointLights handed none - and reads the luma of both:
//   - `lights`: the point lights the renderer took, on and off (off must be 0 - the A/B's own control);
//   - `mean` / `lowerHalf`: the screen's mean luma, and its lower half's (the street the lantern lights), on and off.
// The lanterns light the street when the lower half reads at least `--min-gain` levels brighter with them than without.
// What it found the day it was written (the lane, 22:00): 48 lights; lower half 45.63 with them, 30.01 without - Enhanced
// Lighting lights the town's lanterns. The pictures are the user's data rendered: they stay in --out (scratch/, ignored).
//
// Usage: ARENA2_PATH=/home/user/dfdata/arena2 node tools/townLanternProbe.mjs [--lighting classic] [--tod 22:00]
//          [--out scratch/lanterns] [--min-gain 3] [--w 800 --h 500] [--port 5243] [--boot-s 1500]
// Exits 1 (FAIL - ...) when the world never booted, the frame lit no lantern, the control still lit something, the page
// threw, or the lanterns added less than --min-gain levels to the street.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const LIGHTING = arg('lighting', '');
const TOD = arg('tod', '22:00');
const OUT = arg('out', 'scratch/lanterns');
const MIN_GAIN = Number(arg('min-gain', 3));   // luma levels the lanterns must add to the street's half of the screen
const W = Number(arg('w', 800)), H = Number(arg('h', 500));
const PORT = Number(arg('port', 5243));
const BOOT_S = Number(arg('boot-s', 1500));   // how long the world may take to boot and stream idle (SwiftShader at night: minutes)
const LABEL = LIGHTING || 'lane';
/** The verdict's one exit: what failed, and a nonzero code. */
function fail(msg) { console.error(`FAIL - ${msg}`); process.exit(1); }
mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const say = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());   // nothing leaves the machine
const done = async (msg) => { await browser.close(); await server.close(); if (msg) fail(msg); };

const url = `http://localhost:${PORT}/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&weather=sunny&tod=${encodeURIComponent(TOD)}${LIGHTING ? `&lighting=${LIGHTING}` : ''}`;
say('goto', url);
await page.goto(url);
const ev = (f, a) => page.evaluate(f, a);
let booted = false;
for (const until = Date.now() + BOOT_S * 1000; Date.now() < until;) {
  booted = await ev(() => !!(window.__mode && window.__mode() === 'exterior' && window.__streamIdle?.() && window.__pose)).catch(() => false);
  if (booted) break;
  await sleep(2000);
}
if (!booted) await done(`the world never booted to an idle exterior in ${BOOT_S} s`);
say('booted');
/** The arrival's talk and any overlay it opens, pressed through. */
async function dismiss() { for (let i = 0; i < 40; i++) { const t = await ev(() => { try { return JSON.parse(window.__talk?.() ?? 'null'); } catch { return null; } }); if (!t?.overlay) return; await page.keyboard.press('Space'); await sleep(300); } }
const frames = async (k) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((n) => window.__frame > n, f0 + k, { timeout: 600000 }); };
await dismiss();
await frames(4);

// THE LANTERN: the lowest light of a street lantern's reach the frame lit (the town's: 18, flickering below it)
const lit = await ev(() => { const L = Array.from(window.__renderer._pointLights), o = []; for (let i = 0; i < L.length; i += 4) o.push(L.slice(i, i + 4)); return o; });
const lanterns = lit.filter((l) => l[3] > 10 && l[3] < 20).sort((a, b) => a[1] - b[1]);
if (!lanterns.length) await done(`the night frame lit no lantern (${lit.length} lights, none of a lantern's reach) - at ${TOD}?`);
const [lx, ly, lz] = lanterns[0];
const ex = lx + 5, ez = lz + 1.5;
await ev(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.38), [ex, ly - 1.4, ez, Math.atan2(lx - ex, lz - ez)]);
await frames(10);
await dismiss();
await frames(4);

/** The screen's mean luma (Rec. 709), from row `from` (a share of the height) down. */
const luma = (png, from = 0) => {
  const p = PNG.sync.read(png); let s = 0, n = 0;
  for (let y = Math.floor(p.height * from); y < p.height; y++) for (let x = 0; x < p.width; x++) { const i = (y * p.width + x) * 4; s += 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2]; n++; }
  return s / n;
};
// THE A/B: the same frame with the frame's lights, then with none handed (the renderer's own setter, wrapped and put back)
const on = { lights: await ev(() => window.__renderer._pointLights.length / 4), png: await page.screenshot({ path: `${OUT}/${LABEL}-on.png` }) };
await ev(() => { const r = window.__renderer; r.__tlpSet = r.setPointLights; r.setPointLights = function (_d, c) { return r.__tlpSet.call(r, new Float32Array(0), c, null); }; });
await frames(6);
const off = { lights: await ev(() => window.__renderer._pointLights.length / 4), png: await page.screenshot({ path: `${OUT}/${LABEL}-off.png` }) };
await ev(() => { const r = window.__renderer; r.setPointLights = r.__tlpSet; delete r.__tlpSet; });
const r2 = (v) => +v.toFixed(2);
const res = {
  lighting: LABEL, tod: TOD, lantern: [lx, ly, lz].map(r2), lights: { on: on.lights, off: off.lights },
  mean: { on: r2(luma(on.png)), off: r2(luma(off.png)) }, lowerHalf: { on: r2(luma(on.png, 0.5)), off: r2(luma(off.png, 0.5)) },
};
const gain = r2(res.lowerHalf.on - res.lowerHalf.off);
writeFileSync(`${OUT}/${LABEL}-ab.json`, JSON.stringify({ ...res, gain }, null, 1));
say(JSON.stringify(res));
if (errors.length) await done(`the page threw:\n${errors.join('\n')}`);
if (off.lights !== 0) await done(`the control still lit ${off.lights} lights - the A/B measures nothing`);
if (gain < MIN_GAIN) await done(`the lanterns added ${gain} levels to the street (under ${MIN_GAIN}): ${LABEL} at ${TOD} does not light the town's lanterns`);
say(`PASS - ${LABEL} at ${TOD}: ${on.lights} lights; the street ${res.lowerHalf.off} without them, ${res.lowerHalf.on} with (+${gain})`);
await done();
