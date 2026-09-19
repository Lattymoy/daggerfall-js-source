// THE GUN LAB, IN A REAL BROWSER, WITH NO ARENA2.
//
// The claims a source sweep cannot make about gun-proto.html: the art
// loads and slices, the background key clears the page without eating
// the muzzle flash, the frame badges are off the art, the weapon sits
// on the RIGHT where the classic ones do, and - the one that matters
// for the slicing - THE GUN DOES NOT MOVE ACROSS THE CYCLE with every
// movement module off. Six frames whose flash and smoke grow up and to
// the left will slide the weapon around under any per-frame trim; this
// measures the drawn rect on every frame of a live shot and fails if
// it drifts a pixel.
//
// Then the things that SHOULD move: Weapon Widget's Bob while walking,
// the reload lower on the mod's Offset easing, the gun's own recoil
// spring, and the screenshake - which must move the ROOM and not the
// weapon, since the camera carries the weapon.
//
// Boots vite in-process, so:
//     node tools/gunProtoProbe.mjs [shots-dir]
//
// Writes idle + the six fire frames + the reload as PNGs for
// eyeballing. They are OUR art on the lab's own backdrop - no ARENA2
// pixel - but they go to a scratch dir, not public/ (AUDIT 21's law).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.argv[2] || 'scratch/gun-proto';
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

/** The panel is the lab's only input surface, so the probe drives it
 *  the way a hand would - the control, then its own `input` event. */
const set = (vals) => page.evaluate((v) => {
  for (const [id, value] of Object.entries(v)) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`no control ${id}`);
    if (el.type === 'checkbox') el.checked = !!value; else el.value = String(value);
    el.dispatchEvent(new Event('input'));
  }
}, vals);
/** The lab's own window on the frame. One round trip: the frame loop
 *  is sampled at 4fps in the cycle test and a second hop costs frames. */
const read = () => page.evaluate(() => globalThis.__gunLab);
const fireClick = () => page.evaluate(() => document.getElementById('c').dispatchEvent(new MouseEvent('mousedown')));

await page.goto('http://127.0.0.1:5198/gun-proto.html', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__gunLab?.ready, null, { timeout: 20000 });
// the shots are for judging the POSE, so the panels come off (Tab)
await page.keyboard.press('Tab');

const art = (await read()).art;
check('the sheet sliced into six frames and the idle pose loaded', art.frames === 6 && art.idle, `${art.frames} frames`);
check('the gun has a box and the flash has room around it',
  art.anchor.w > 100 && art.union.w >= art.anchor.w && art.union.h >= art.anchor.h,
  `gun ${art.anchor.w}x${art.anchor.h}, with flash ${art.union.w}x${art.union.h}`);
check('the flash grows UP and LEFT of the gun, which is what the union box is for',
  art.union.x <= art.anchor.x && art.union.y < art.anchor.y,
  `union (${art.union.x},${art.union.y}) vs gun (${art.anchor.x},${art.anchor.y})`);
check('the frame-number badges are off the art', art.anchor.x >= 0 && art.anchor.w < 666,
  `gun box starts at x=${art.anchor.x} of the cropped cell`);

// THE RIGHT-HAND SIDE. The page opens on AlignRight, and the weapon's
// box has to land in the right half - Mac's first note on the lab.
const rest = await read();
const vw = 1280;
// The bob is live at rest (Bob.BobWhileIdle's tenth), so the edge is
// allowed a few pixels of sway - what is asserted is the SIDE.
check('the weapon sits on the RIGHT of the screen out of the box',
  rest.anchorRect.x + rest.anchorRect.w / 2 > vw / 2 && rest.anchorRect.x > vw * 0.25
  && rest.anchorRect.x + rest.anchorRect.w <= vw + 12,
  `box ${rest.anchorRect.x.toFixed(0)}..${(rest.anchorRect.x + rest.anchorRect.w).toFixed(0)} of ${vw}`);
await page.screenshot({ path: `${shots}/idle.png` });

// THE REGISTRATION TEST. Everything that can legitimately move the
// sprite goes off - bob, inertia, the slide, the kick - and the cycle
// is slowed right down, so the only thing left that could move the
// weapon is the slicing.
await set({ fps: 4, kick: 0, modBob: false, modInertia: false, modOffset: false, walk: false });
await fireClick();

// No screenshots inside this loop: a capture costs more than a frame
// at 4fps and the probe would miss half the cycle measuring it.
const seen = new Map();
for (let i = 0; i < 300; i++) {
  const s = await read();
  if (s?.state === 'Firing' && !seen.has(s.frame)) seen.set(s.frame, s.rect);
  if (s?.state !== 'Firing' && seen.size >= 6) break;
  await page.waitForTimeout(12);
}
check('every one of the six frames reached the screen', seen.size === 6, `${seen.size}/6`);
const rects = [...seen.values()];
const drift = rects.length ? Math.max(...rects.map((r) => Math.abs(r.x - rects[0].x) + Math.abs(r.y - rects[0].y))) : Infinity;
check('THE GUN DOES NOT MOVE: one box for all six frames', drift === 0, `max drift ${drift}px`);

// The frames for eyeballing come off the SCRUB (arrow keys), which
// holds a frame still for as long as a capture takes.
for (let f = 0; f < 6; f++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(60);
  const s = await read();
  await page.screenshot({ path: `${shots}/fire-${s.frame + 1}.png` });
}
await page.keyboard.press('ArrowRight');   // back to frame 1

// ── WEAPON WIDGET'S BOB ──────────────────────────────────────────────
// The mod's module, running on the gun: standing still it barely
// breathes (Bob.BobWhileIdle's tenth), walking it sways, and the sway
// is bigger than the breath.
await set({ fps: 14, cool: 700, modBob: true, modOffset: true, walk: false });
await page.waitForTimeout(400);
const spanOf = async (ms) => {
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (let i = 0; i < ms / 40; i++) {
    const p = (await read()).channels.position;
    lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])];
    hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])];
    await page.waitForTimeout(40);
  }
  return [hi[0] - lo[0], hi[1] - lo[1]];
};
const still = await spanOf(1200);
await set({ walk: true });
await page.waitForTimeout(1400);   // Bob.SpeedMove eases in from standing
const walking = await spanOf(1600);
check('Weapon Widget’s Bob sways the gun while walking',
  walking[0] > 2 && walking[1] > 1, `x span ${walking[0].toFixed(1)}px, y span ${walking[1].toFixed(1)}px`);
check('and the walk sways it further than standing still does',
  walking[0] > still[0] * 1.5, `walking ${walking[0].toFixed(1)}px vs standing ${still[0].toFixed(1)}px`);
await page.screenshot({ path: `${shots}/bob-walking.png` });
await set({ walk: false });

// ── THE RELOAD LOWER ─────────────────────────────────────────────────
// No reload animation exists, so the weapon leaves the frame on the
// Offset module's easing and comes back up. Measured on the CHANNEL and
// on the drawn rect, because the rect is what the player sees.
await set({ cool: 1400, drop: 0.55, offsetSpeed: 1, kick: 0 });
await page.waitForTimeout(300);
const beforeY = (await read()).anchorRect.y;
await fireClick();
let lowest = -Infinity, sawReload = false, shot = false;
for (let i = 0; i < 120; i++) {
  const s = await read();
  if (s.reloading) {
    sawReload = true;
    lowest = Math.max(lowest, s.anchorRect.y);
    if (!shot) { shot = true; await page.screenshot({ path: `${shots}/reload.png` }); }
  }
  if (sawReload && !s.reloading) break;
  await page.waitForTimeout(30);
}
await page.waitForTimeout(600);
const afterY = (await read()).anchorRect.y;
check('the reload LOWERS the weapon', sawReload && lowest > beforeY + 20,
  `resting y=${beforeY.toFixed(0)}, lowest y=${lowest.toFixed(0)}`);
check('and it comes back up when the weapon is ready', Math.abs(afterY - beforeY) < 12,
  `back at y=${afterY.toFixed(0)} against ${beforeY.toFixed(0)}`);

// ── THE RECOIL ───────────────────────────────────────────────────────
// The spring the mod cannot lend: a shot throws the sprite UP the
// screen (a smaller y) and the spring pulls it home.
// a kick bigger than the panel's 5, and softer, so the rise is still
// measurable through a round trip per sample - the DEFAULT recoil is
// home in under a tenth of a second by design
await set({ kick: 30, stiff: 120, damp: 14, cool: 700, modBob: false, modInertia: false });
await page.waitForTimeout(500);
const restY = (await read()).anchorRect.y;
await fireClick();
let highest = Infinity;
for (let i = 0; i < 30; i++) { highest = Math.min(highest, (await read()).anchorRect.y); await page.waitForTimeout(10); }
check('the shot KICKS the weapon up the screen', highest < restY - 8,
  `rest y=${restY.toFixed(0)}, peak y=${highest.toFixed(0)}`);
await page.waitForTimeout(1600);
const settled = (await read()).anchorRect.y;
check('and the spring brings it home', Math.abs(settled - restY) < 4,
  `settled at y=${settled.toFixed(0)} against ${restY.toFixed(0)}`);

// ── THE SCREENSHAKE ──────────────────────────────────────────────────
// The camera, not the weapon: the room moves and the sprite - carried
// by that camera - does not. Measured as the pair, because a shake
// that moved the sprite would pass a "did anything move" check.
// Everything that legitimately moves the sprite goes off - the kick,
// the bob, the inertia and the reload lower - so "the weapon did not
// move" means the shake and nothing else. A long, slow shake, because
// a round trip per sample is slower than a frame and a 3-tenths
// rattle would be over before the probe saw its peak.
await set({ kick: 0, stiff: 400, damp: 36, shake: 20, shakeDecay: 0.8, cool: 700, modBob: false, modInertia: false, modOffset: false });
await page.waitForTimeout(500);
const calmRect = (await read()).anchorRect;
await fireClick();
let peak = 0, weaponMoved = 0, sawTrauma = 0;
for (let i = 0; i < 30; i++) {
  const s2 = await read();
  peak = Math.max(peak, Math.hypot(s2.cam.x, s2.cam.y));
  sawTrauma = Math.max(sawTrauma, s2.trauma);
  weaponMoved = Math.max(weaponMoved, Math.abs(s2.anchorRect.x - calmRect.x) + Math.abs(s2.anchorRect.y - calmRect.y));
  await page.waitForTimeout(12);
}
check('the shot SHAKES THE CAMERA', peak > 3 && sawTrauma > 0.5,
  `peak ${peak.toFixed(1)} native px, trauma ${sawTrauma.toFixed(2)}`);
check('and the weapon rides it rather than being shaken by it', weaponMoved < 1.5,
  `weapon moved ${weaponMoved.toFixed(2)}px with the kick off`);
await page.waitForTimeout(3000);
const calm = await read();
check('the shake settles to exactly nothing', calm.cam.x === 0 && calm.cam.y === 0 && calm.cam.rot === 0,
  `trauma ${calm.trauma.toFixed(3)}`);
await set({ kick: 5, shake: 30, shakeDecay: 5, modBob: true, modInertia: true, modOffset: true });

// The mirror, and the alignment swap under it.
await set({ flip: true, align: 2 });
await page.waitForTimeout(160);
const flipped = (await read()).anchorRect;
await page.screenshot({ path: `${shots}/left-hand.png` });   // the MIRROR, shot while it is on
await set({ flip: false });
await page.waitForTimeout(160);
const right = (await read()).anchorRect;
check('the handedness mirror swaps the weapon to the other side', flipped.x < right.x,
  `left-hand x=${flipped.x.toFixed(0)} vs right-hand x=${right.x.toFixed(0)}`);

// ── THE SOUND ────────────────────────────────────────────────────────
// Not "is it audible" - headless Chromium has no speakers and the page
// would sound the same either way. What is checkable is the thing that
// actually breaks: every clip named in the lab's own lists RESOLVES,
// and the dropdowns open on the pick. A renamed or un-copied .wav is a
// silent 404 in a lab whose whole job is judging feel.
const sfx = await page.evaluate(async () => {
  const names = Object.values(globalThis.__gunLabSfx ?? {}).flat().map(([n]) => n);
  const out = [];
  for (const n of names) {
    const url = new URL(`sfx/${n}.wav`, document.baseURI).href;
    const r = await fetch(url);
    const b = r.ok ? await r.arrayBuffer() : null;
    // the classic file's own shape: RIFF, mono, 11025, 8-bit
    let ok = false, rate = 0, bits = 0, ch = 0;
    if (b && b.byteLength > 44) {
      const dv = new DataView(b);
      ch = dv.getUint16(22, true); rate = dv.getUint32(24, true); bits = dv.getUint16(34, true);
      ok = String.fromCharCode(...new Uint8Array(b, 0, 4)) === 'RIFF';
    }
    out.push({ n, status: r.status, ok, rate, bits, ch, bytes: b?.byteLength ?? 0 });
  }
  const sel = (id) => document.getElementById(id).value;
  return { clips: out, picks: [sel('sfxFire'), sel('sfxOpen'), sel('sfxClose')] };
});
const bad = sfx.clips.filter((c) => !c.ok || c.rate !== 11025 || c.bits !== 8 || c.ch !== 1);
check('every sound the lab offers loads, in the classic format', bad.length === 0,
  bad.length ? bad.map((c) => `${c.n}:${c.status}/${c.rate}/${c.bits}bit/${c.ch}ch`).join(' ') : `${sfx.clips.length} clips, all 11025Hz 8-bit mono`);
check('the dropdowns open on the picks', sfx.picks.join(',') === 'fire-shotgun,open-winchester,close-ready', sfx.picks.join(', '));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
await server.close();
console.log(`\nshots in ${shots}/`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} ok`);
process.exit(failed ? 1 : 0);
