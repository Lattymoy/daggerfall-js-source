// THE PISTOL LAB, IN A REAL BROWSER, WITH NO ARENA2 - tools/gunProtoProbe.mjs's
// method for the second lab (bible/05-Combat/Pistol-Lab.md).
//
// What a source sweep cannot claim about pistol-proto.html: the strip
// loads and cuts to 1 bit, the pistol is drawn at Daggerfall's own size
// with the forearm's cut on the view's corner, THE PISTOL DOES NOT MOVE
// ACROSS THE CYCLE except as the art moves it (every movement module
// off), and - the pair's - the left pistol is the right in the glass,
// the trigger picks hands as the Two-Hands law says, the resting pistol
// lowers while the other fires, Bob goes outward, and the shake moves
// the room and neither weapon.
//
//     node tools/pistolProtoProbe.mjs [shots-dir]      (npm run pistolproto)
//
// Writes the six frames, the pair at rest, mid-alternate, the volley
// and the reload as PNGs for eyeballing - our art on the lab's own
// backdrop, to a scratch dir, never public/ (AUDIT 21's law).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.argv[2] || 'scratch/pistol-proto';
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch();
const VW = 1280, VH = 800;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const set = (vals) => page.evaluate((v) => {
  for (const [id, value] of Object.entries(v)) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`no control ${id}`);
    if (el.type === 'checkbox') el.checked = !!value; else el.value = String(value);
    el.dispatchEvent(new Event('input'));
  }
}, vals);
const read = () => page.evaluate(() => globalThis.__pistolLab);
const click = (button = 0) => page.evaluate((b) => document.getElementById('c').dispatchEvent(new MouseEvent('mousedown', { button: b })), button);
const unclick = () => page.evaluate(() => dispatchEvent(new MouseEvent('mouseup')));
/** `__pistolLab` is written once a frame, so a read in the same instant as
 *  a click is the frame BEFORE it (Home.md: frame-sync, never sleep). Two
 *  rAFs: the first may run ahead of the page's own frame callback. */
const nextFrame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const STILL = { modBob: false, modInertia: false, modOffset: false, kick: 0, walk: false };
const near = (a, b, eps = 1.5) => Math.abs(a - b) <= eps;
/** Wait until both pistols are loaded and resting. */
const settle = async () => {
  await page.waitForFunction(() => {
    const s = globalThis.__pistolLab;
    return s?.R.state === 'Idle' && s?.L.state === 'Idle' && s.R.guard < 0.01 && s.L.guard < 0.01;
  }, null, { timeout: 15000 });
  await page.waitForTimeout(120);
};

await page.goto('http://127.0.0.1:5197/pistol-proto.html', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__pistolLab?.ready, null, { timeout: 20000 });
await page.keyboard.press('Tab');   // the panels come off for the shots

// ── THE ART ──────────────────────────────────────────────────────────
const art = (await read()).art;
check('the strip cut into six frames', art.frames === 6, `${art.frames} frames`);
check('the cut is 1-bit: no texel between 0 and 255 reaches the screen', art.soft === 0, `${art.soft} soft texels`);
check('the flash has room up and left of the rest frame, and the two share the arm’s corner',
  art.union.x <= art.anchor.x && art.union.y <= art.anchor.y
  && art.union.x + art.union.w === art.anchor.x + art.anchor.w && art.union.y + art.union.h === art.anchor.y + art.anchor.h,
  `pistol ${art.anchor.w}x${art.anchor.h} at (${art.anchor.x},${art.anchor.y}), with flash ${art.union.w}x${art.union.h} at (${art.union.x},${art.union.y})`);

// ── THE PAIR AT REST ─────────────────────────────────────────────────
await set(STILL);
await settle();
let s = await read();
// the panel's own size and raise - the owner's row, not a number assumed here
const pose = await page.evaluate(() => ({ scale: +document.getElementById('scale').value, raise: +document.getElementById('raise').value }));
check('both pistols are drawn - the lab opens on the pair', s.R.drawn && s.L.drawn && s.trigger === 'alternate', s.trigger);
check('native size: the pistol is its art width on the 320-wide surface, times the panel’s size',
  near(s.R.anchorRect.w, art.anchor.w * VW / 320 * pose.scale), `${s.R.anchorRect.w.toFixed(1)}px for ${art.anchor.w} art px at ${pose.scale}x`);
// the raise is FPSWeapon's offsetHeight in design units: -1 sinks the cut one unit below the edge
check('the forearm’s cut sits on the view’s right edge, the raise below its bottom',
  near(s.R.rect.x + s.R.rect.w, VW) && near(s.R.rect.y + s.R.rect.h, VH - pose.raise * VH / 200),
  `right edge ${(s.R.rect.x + s.R.rect.w).toFixed(1)}, bottom ${(s.R.rect.y + s.R.rect.h).toFixed(1)} at raise ${pose.raise}`);
check('the left pistol is the right in the glass',
  near(s.L.rect.x, VW - (s.R.rect.x + s.R.rect.w)) && near(s.L.rect.y, s.R.rect.y) && near(s.L.rect.w, s.R.rect.w),
  `left x=${s.L.rect.x.toFixed(1)}, right ends ${(s.R.rect.x + s.R.rect.w).toFixed(1)} of ${VW}`);
check('and the two do not overlap', s.L.rect.x + s.L.rect.w < s.R.rect.x,
  `left ends ${(s.L.rect.x + s.L.rect.w).toFixed(0)}, right starts ${s.R.rect.x.toFixed(0)}`);
await page.screenshot({ path: `${shots}/pair-rest.png` });

// ── THE REGISTRATION TEST ────────────────────────────────────────────
// Everything that can move the sprite off, the cycle slowed: the drawn
// rect must not move a pixel across six frames (the art moves the
// pistol INSIDE the canvas; the canvas does not move).
await set({ ...STILL, trigger: 'single', fps: 4 });
await settle();
await click(); await unclick();
const seen = new Map();
for (let i = 0; i < 300; i++) {
  const r = await read();
  if (r.R.state === 'Firing' && !seen.has(r.R.frame)) seen.set(r.R.frame, r.R.rect);
  if (r.R.state !== 'Firing' && seen.size >= 6) break;
  await page.waitForTimeout(12);
}
check('every one of the six frames reached the screen', seen.size === 6, `${seen.size}/6`);
const rects = [...seen.values()];
const drift = rects.length ? Math.max(...rects.map((r) => Math.abs(r.x - rects[0].x) + Math.abs(r.y - rects[0].y))) : Infinity;
check('THE CANVAS DOES NOT MOVE: one box for all six frames', drift === 0, `max drift ${drift}px`);
s = await read();
check('single is one pistol', s.R.drawn && !s.L.drawn);
for (let f = 0; f < 6; f++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${shots}/fire-${(await read()).R.frame + 1}.png` });
}
await page.keyboard.press('ArrowRight');

// ── WHICH HAND FIRES ─────────────────────────────────────────────────
await set({ ...STILL, trigger: 'alternate', lead: 'R', fps: 12, cool: 1400 });
await settle();
// Counted per click, each read a drawn frame after it. The first cut read
// `lastShot` in the click's own instant - the frame BEFORE the shot - and
// answered "R then R" one run in three: a stale read, not a misfire.
const shotsOf = (r) => `${r.R.shots}/${r.L.shots}`;
const s0 = await read();
await click(); await unclick(); await nextFrame();
const s1 = await read();
await page.waitForTimeout(150);
await click(); await unclick(); await nextFrame();
const s2 = await read();
const firstR = s1.R.shots === s0.R.shots + 1 && s1.L.shots === s0.L.shots;
const secondL = s2.L.shots === s1.L.shots + 1 && s2.R.shots === s1.R.shots;
check('alternate: the lead opens and a quick second pull is the other hand’s (the flurry)',
  firstR && secondL && s2.lastShot?.off && s2.lastShot?.flurry,
  `R/L shots ${shotsOf(s0)} -> ${shotsOf(s1)} (R ${s1.R.state}) -> ${shotsOf(s2)}, last ${s2.lastShot?.hand}${s2.lastShot?.off ? ' (off hand)' : ''}`);
// THE GUARD: the resting pistol lowers while the other fires
await settle();
const restL = (await read()).L.anchorRect.y;
await set({ fps: 4 });
await click(); await unclick();
let lowered = 0;
for (let i = 0; i < 40; i++) { const r = await read(); lowered = Math.max(lowered, r.L.anchorRect.y - restL); await page.waitForTimeout(15); }
check('the resting pistol lowers while the other fires (handsLaw GUARD)', lowered > 8, `left lowered ${lowered.toFixed(1)}px`);
await page.screenshot({ path: `${shots}/alternate-guard.png` });
await set({ fps: 12 });
await settle();
const afterGuard = (await read()).L.anchorRect.y;
check('and comes back when the shot ends', near(afterGuard, restL), `back at y=${afterGuard.toFixed(1)} against ${restL.toFixed(1)}`);

await set({ trigger: 'volley' });
await settle();
const before = await read();
await click(); await unclick(); await nextFrame();
const volley = await read();
check('volley fires both on one pull', volley.R.shots === before.R.shots + 1 && volley.L.shots === before.L.shots + 1,
  `R ${before.R.shots}->${volley.R.shots}, L ${before.L.shots}->${volley.L.shots}`);
// both hands are the striking hand: neither guards (the first cut lowered
// both, each because the other was firing - this probe's shake check found it)
check('and neither pistol drops into the guard on a volley', volley.R.guard < 0.01 && volley.L.guard < 0.01,
  `guard R ${volley.R.guard.toFixed(2)}, L ${volley.L.guard.toFixed(2)}`);
await page.screenshot({ path: `${shots}/volley.png` });

await set({ trigger: 'perHand' });
await settle();
const ph = await read();
await click(2); await unclick(); await nextFrame();
const ph2 = await read();
check('per hand: the right mouse button fires the left pistol alone',
  ph2.L.shots === ph.L.shots + 1 && ph2.R.shots === ph.R.shots, `L ${ph.L.shots}->${ph2.L.shots}, R ${ph.R.shots}->${ph2.R.shots}`);

// ── THE RELOAD LOWER, each hand its own ──────────────────────────────
await set({ trigger: 'single', modOffset: true, cool: 1400, drop: 0.7 });
await settle();
const restY = (await read()).R.anchorRect.y;
await click(); await unclick();
let lowest = -Infinity, shotReload = false;
for (let i = 0; i < 120; i++) {
  const r = await read();
  if (r.R.reloading) {
    lowest = Math.max(lowest, r.R.anchorRect.y);
    if (!shotReload && r.R.anchorRect.y > restY + 60) { shotReload = true; await page.screenshot({ path: `${shots}/reload.png` }); }
  } else if (lowest > -Infinity) break;
  await page.waitForTimeout(30);
}
await page.waitForTimeout(700);
check('the reload LOWERS the pistol', lowest > restY + 20, `resting y=${restY.toFixed(0)}, lowest ${lowest.toFixed(0)}`);
check('and brings it back', near((await read()).R.anchorRect.y, restY, 12));

// ── BOB GOES OUTWARD ─────────────────────────────────────────────────
// Two-Hands' first sway rule: the left hand the right's exact mirror.
await set({ ...STILL, trigger: 'alternate', modBob: true, walk: true });
await page.waitForTimeout(1400);
let mirrored = 0, moved = 0;
for (let i = 0; i < 20; i++) {
  const r = await read();
  const dR = r.R.anchorRect.x - (VW - r.R.anchorRect.w);
  const dL = r.L.anchorRect.x;
  moved = Math.max(moved, Math.abs(dR));
  mirrored = Math.max(mirrored, Math.abs(dR + dL));
  await page.waitForTimeout(40);
}
check('Bob sways the pair while walking, the left the right’s mirror (outward)', moved > 2 && mirrored < 1.5,
  `sway ${moved.toFixed(1)}px, mirror error ${mirrored.toFixed(2)}px`);
await page.screenshot({ path: `${shots}/pair-walking.png` });

// ── THE SCREENSHAKE moves the room, not the weapons ─────────────────
await set({ ...STILL, trigger: 'volley', shake: 20, shakeDecay: 0.8 });
await settle();
const calm = await read();
await click(); await unclick();
let peak = 0, weaponMoved = 0;
for (let i = 0; i < 30; i++) {
  const r = await read();
  peak = Math.max(peak, Math.hypot(r.cam.x, r.cam.y));
  for (const hd of ['R', 'L']) weaponMoved = Math.max(weaponMoved, Math.abs(r[hd].anchorRect.x - calm[hd].anchorRect.x) + Math.abs(r[hd].anchorRect.y - calm[hd].anchorRect.y));
  await page.waitForTimeout(12);
}
check('a volley shakes the camera', peak > 3, `peak ${peak.toFixed(1)} native px`);
check('and both pistols ride it', weaponMoved < 1.5, `moved ${weaponMoved.toFixed(2)}px with the kick off`);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
await server.close();
console.log(`\nshots in ${shots}/`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} ok`);
process.exit(failed ? 1 : 0);
