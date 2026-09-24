// INV3 - THE HOLD, MEASURED UNDER A REAL FINGER.
//
// Mac: "Hold to drag functionality in inventory sometimes doesnt work."
// SOMETIMES is the whole report, and node cannot see it. The suite
// drives this drag through test/invdrag.mjs, a document just real
// enough to carry the gesture - but that document has no compositor,
// no `touch-action` and no scroll gesture detector, so it delivers
// every pointermove a test asks for and can never answer the two
// questions the report turns on: how far a finger may drift before the
// BROWSER takes the gesture away, and in which axis. Both are
// properties of Chromium, not of this module, so they are measured
// here.
//
// What it reports:
//
//  - THE BROWSER'S OWN SLOP, off a bare `touch-action: pan-y` tile in a
//    scroller with no pane involved at all - the ceiling any hold law
//    has to live under.
//  - HOW OFTEN THE HOLD SURVIVES a drifting finger, as a rate over many
//    trials at each drift amplitude, which is the shape of "sometimes".
//  - and the laws, as pass/fail: a still finger always picks up, a
//    flick scrolls and is never a drag and drops nothing, an armed hold
//    carries and releases, and the body's panels take the same gesture.
//
// IT RUNS ON VITE'S OWN DEV SERVER rather than a static file server,
// for the reason tools/qs3Probe.mjs states: this module graph reaches
// `import.meta.glob`, a Vite COMPILE-TIME macro, and a plain server
// hands the browser the macro itself.
//
// The gestures are real touch points through CDP
// (`Input.dispatchTouchEvent`) - playwright's own touchscreen only
// taps, and a tap is the one gesture this feature is not.
//
//     node tools/invDragProbe.mjs
//
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers here; pass CHROMIUM=... to
// point at another executable. INV3_TRIALS=<n> changes the trial count
// per amplitude (default 12).
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'inv3-probe.tmp.html';
const BARE_NAME = 'inv3-bare.tmp.html';
const TRIALS = Number(process.env.INV3_TRIALS ?? 12);

/** The pane over the real modules, with a pack long enough to flick. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>INV3 probe</title>
<style>html,body{margin:0;height:100%;background:#12141a;overflow:hidden;overscroll-behavior:none}
#host{position:fixed;inset:0}</style></head><body><div id="host"></div>
<script type="module">
import { mountEnhancedInventory } from '/src/ui/enhancedInventory.js';
import { ITEM_TEMPLATES } from '/src/characters/paperdoll.js';
import { equipItem } from '/src/systems/equip.js';

const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
const mk = (n, group = 'Weapons') => { const tp = t(n); return tp && {
  name: tp.name, templateIndex: tp.index, group, stackCount: 1,
  currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50 }; };
const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] };
// enough tiles that the dock really scrolls - a list a finger can flick
// is the whole reason the hold exists
for (let i = 0; i < 12; i++) for (const n of ['Longsword', 'Dagger', 'Broadsword', 'Battle Axe'])
  { const it = mk(n); if (it) e.items.push(it); }
const worn = mk('Cuirass', 'Armor');
e.items.push(worn);
equipItem(e, worn);
e.goldPieces = 1287;
globalThis.__dropped = [];
mountEnhancedInventory(document.getElementById('host'), {
  entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => globalThis.__dropped.push(it),
});

globalThis.__ev = [];
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'])
  addEventListener(type, (ev) => globalThis.__ev.push(type), true);

const list = () => document.querySelector('.packlists');
globalThis.__probe = {
  // A press that never becomes a hold is a TAP, and a tap PICKS - which
  // raises the card, re-renders the window and moves every tile. That is
  // the pane working; it is the probe's job not to be confused by it, so
  // each gesture starts from nothing picked and the list at the top.
  reset() {
    globalThis.__ev.length = 0; globalThis.__dropped.length = 0;
    for (let i = 0; i < 4; i++) { const on = document.querySelector('.itemrow.on, .wornrow.on'); if (!on) break; on.click(); }
    const n = list(); if (n) n.scrollTop = 0;
  },
  ev: () => globalThis.__ev.join(','),
  ghost: () => !!document.querySelector('.dragghost'),
  ghostAt: () => { const g = document.querySelector('.dragghost'); return g ? { x: parseFloat(g.style.left), y: parseFloat(g.style.top) } : null; },
  verb: () => document.querySelector('.dragghost .ghostact')?.textContent ?? null,
  lock: () => document.body.classList.contains('draglock'),
  dropped: () => globalThis.__dropped.length,
  top: () => list()?.scrollTop ?? -1,
  scrollTo: (v) => { const n = list(); if (n) n.scrollTop = v; },
  room: () => { const n = list(); return n ? n.scrollHeight - n.clientHeight : -1; },
  items: () => document.querySelectorAll('.pack-dock .itemrow').length,
  // A TILE THE FINGER CAN REALLY REACH. A rect inside a scrolled
  // viewport still reports a position when it has been clipped out of
  // sight, and pressing there hits the tab strip above the list - which
  // is a probe reading "the hold is broken" when nothing was pressed.
  tile() {
    const n = list(); if (!n) return null;
    const lr = n.getBoundingClientRect();
    for (const row of document.querySelectorAll('.pack-dock .itemrow')) {
      const r = row.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (y > lr.top + 8 && y < lr.bottom - 8 && document.elementFromPoint(x, y)?.closest('.itemrow') === row) return { x, y };
    }
    return null;
  },
  worn() { const n = document.querySelector('.wornrow:not(.wornempty)'); if (!n) return null;
    const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; },
  dock() { const n = document.querySelector('.pack-dock'); if (!n) return null;
    const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; },
};
document.title = 'ready';
<\/script></body></html>`;

/** A bare pan-y tile in a scroller: NO pane, so what this measures is
 *  Chromium's own scroll-start slop and nothing of ours. */
const BARE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>INV3 bare</title>
<style>html,body{margin:0;height:100%;overflow:hidden}
#list{position:fixed;left:0;top:0;width:200px;height:300px;overflow-y:auto;background:#222}
.t{width:56px;height:56px;margin:6px;background:#555;touch-action:pan-y}</style></head><body><div id="list"></div>
<script>
const list = document.getElementById('list');
for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.className = 't'; list.append(d); }
globalThis.__ev = [];
for (const t of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) addEventListener(t, () => globalThis.__ev.push(t), true);
globalThis.__bare = {
  reset: () => { globalThis.__ev.length = 0; list.scrollTop = 0; },
  ev: () => globalThis.__ev.join(','),
  tile: () => { const r = list.querySelectorAll('.t')[1].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; },
};
document.title = 'ready';
<\/script></body></html>`;

const fails = [];
const check = (name, ok, detail = '') => {
  if (!ok) fails.push(`${name}${detail ? ` - ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
/** A seeded walk, so two runs of this probe are the same two runs. */
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const vite = await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const port = vite.httpServer.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

/** A phone with a phone's pixel ratio - the whole question is whether
 *  the browser's slop is in CSS px or device px, and a 1x page cannot
 *  tell you. */
const phone = (deviceScaleFactor) => ({ viewport: { width: 430, height: 860 }, hasTouch: true, isMobile: true, deviceScaleFactor });
const finger = (cdp) => (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 14, radiusY: 14, force: 1, id: 1 }],
});

try {
  // AUDIT 68 X2-probe-tmp-page-leak: written inside the try, so the finally that unlinks it always runs.
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  await writeFile(join(ROOT, `tools/${BARE_NAME}`), BARE);
  // ── WHAT THE BROWSER ITSELF ALLOWS ───────────────────────────────
  console.log('CHROMIUM\'S OWN SCROLL-START SLOP, off a bare pan-y tile');
  const ceiling = {};
  for (const dpr of [1, 2, 3]) {
    const ctx = await browser.newContext(phone(dpr));
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/tools/${BARE_NAME}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!globalThis.__bare, null, { timeout: 30000 });
    const cdp = await ctx.newCDPSession(page);
    const send = finger(cdp);
    const t = await page.evaluate(() => globalThis.__bare.tile());
    const takes = async (dx, dy) => {
      await page.evaluate(() => globalThis.__bare.reset());
      await send('touchStart', t.x, t.y);
      await page.waitForTimeout(20);
      await send('touchMove', t.x + dx, t.y + dy);
      await page.waitForTimeout(40);
      const ev = await page.evaluate(() => globalThis.__bare.ev());
      await send('touchEnd', t.x + dx, t.y + dy);
      await page.waitForTimeout(40);
      return ev.includes('pointercancel');
    };
    let vert = null;
    for (const d of [4, 8, 10, 12, 13, 14, 15, 16, 18, 20, 24]) if (vert === null && await takes(0, d)) vert = d;
    let horz = null;
    for (const d of [16, 24, 40, 80, 160]) if (horz === null && await takes(d, 0)) horz = d;
    ceiling[dpr] = { vert, horz };
    console.log(`   dpr ${dpr}: takes the gesture at ${vert}px VERTICAL; horizontal out to 160px: ${horz === null ? 'never' : `${horz}px`}`);
    await ctx.close();
  }
  check('the browser\'s slop is CSS px, not device px', ceiling[1].vert === ceiling[3].vert,
    `dpr1 ${ceiling[1].vert}, dpr2 ${ceiling[2].vert}, dpr3 ${ceiling[3].vert}`);
  check('and a pan-y surface never loses a HORIZONTAL gesture', [1, 2, 3].every((d) => ceiling[d].horz === null));

  // ── AND WHAT THE PANE DOES UNDER A FINGER ────────────────────────
  for (const dpr of [1, 3]) {
    const ctx = await browser.newContext(phone(dpr));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (er) => errors.push(er.message));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?nofonts`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!globalThis.__probe, null, { timeout: 30000 });
    const cdp = await ctx.newCDPSession(page);
    const send = finger(cdp);
    const P = (fn, ...a) => page.evaluate(fn, ...a);
    const sleep = (ms) => page.waitForTimeout(ms);
    /** A tile to press, once the last gesture's fling has finished
     *  moving the list. A momentum scroll outlives the finger, so a
     *  `scrollTop = 0` written while one is in flight is simply
     *  overwritten - and the rect that came back then belonged to a tile
     *  that has since slid out of the viewport. Measured the hard way:
     *  the probe read "no tile" and fell over. */
    const settle = async () => {
      for (let i = 0; i < 12; i++) {
        await P(() => globalThis.__probe.reset());
        await sleep(60);
        const t = await P(() => globalThis.__probe.tile());
        if (t && (await P(() => globalThis.__probe.top())) === 0) return t;
      }
      return null;
    };

    console.log(`\n══ the pack on a 430x860 phone, devicePixelRatio ${dpr} ══`);
    console.log(`   ${await P(() => globalThis.__probe.items())} tiles, ${await P(() => globalThis.__probe.room())}px of scroll under them`);

    /** One hold: press a tile, let the contact patch wander `amp` px
     *  about the point it came down on for 420ms, read the ghost. */
    const hold = async (amp, drift) => {
      const t = await settle();
      if (!t) return { ghost: false, cancel: false, none: true };
      await send('touchStart', t.x, t.y);
      for (let i = 1; i <= 7; i++) {
        await sleep(52);
        const [dx, dy] = drift(i / 7, amp);
        await send('touchMove', t.x + dx, t.y + dy);
      }
      const got = { ghost: await P(() => globalThis.__probe.ghost()), ev: await P(() => globalThis.__probe.ev()) };
      await send('touchEnd', t.x, t.y);
      await sleep(40);
      return { ghost: got.ghost, cancel: got.ev.includes('pointercancel') };
    };
    // a patch that wanders rather than travels - both axes, never twice
    // round the same point
    const wander = (u, amp) => [Math.cos(u * Math.PI * 2) * amp, Math.sin(u * Math.PI * 2 * 1.7) * amp];

    console.log('   HOW OFTEN THE HOLD SURVIVES A DRIFTING FINGER');
    for (const amp of [0, 2, 4, 6, 8, 10, 12, 16, 24]) {
      let up = 0; let cancels = 0;
      for (let i = 0; i < TRIALS; i++) { const r = await hold(amp, wander); if (r.ghost) up++; if (r.cancel) cancels++; }
      console.log(`     drift +/-${String(amp).padStart(2)}px: ghost ${String(up).padStart(2)}/${TRIALS}   the browser took it ${cancels}/${TRIALS}`);
      if (amp <= 10) check(`dpr ${dpr}: a finger drifting +/-${amp}px picks up`, up === TRIALS, `${up}/${TRIALS}`);
      if (amp === 24) check(`dpr ${dpr}: a finger that TRAVELS +/-24px does not`, up === 0, `${up}/${TRIALS}`);
    }

    // A RESTING THUMB, which is not a circle: a random walk of random
    // amplitude, the thing Mac's finger actually does.
    const rand = rng(20260917);
    let alive = 0;
    for (let i = 0; i < TRIALS * 2; i++) {
      const amp = 2 + rand() * 6;
      const seedAngle = rand() * Math.PI * 2;
      const r = await hold(amp, (u) => [Math.cos(seedAngle + u * 4) * amp, Math.sin(seedAngle + u * 5.3) * amp]);
      if (r.ghost) alive++;
    }
    console.log(`     a resting thumb (2-8px random walk): ${alive}/${TRIALS * 2}`);
    check(`dpr ${dpr}: a resting thumb always picks up`, alive === TRIALS * 2, `${alive}/${TRIALS * 2}`);

    // ── THE LAWS (AUDIT INV2 A1) ───────────────────────────────────
    const ft = await settle();
    if (!ft) { fails.push(`dpr ${dpr}: the list would not settle - no tile to press`); await ctx.close(); continue; }
    const before = await P(() => globalThis.__probe.top());
    await send('touchStart', ft.x, ft.y);
    let sawGhost = false;
    for (let i = 1; i <= 10; i++) {
      await sleep(10);
      await send('touchMove', ft.x, ft.y - i * 14);
      if (await P(() => globalThis.__probe.ghost())) sawGhost = true;
    }
    await send('touchEnd', ft.x, ft.y - 140);
    await sleep(160);
    const after = await P(() => globalThis.__probe.top());
    check(`dpr ${dpr}: a flick SCROLLS the pack`, after > before, `${before} -> ${after}`);
    check(`dpr ${dpr}: and is never a drag`, !sawGhost);
    check(`dpr ${dpr}: and puts nothing on the floor`, (await P(() => globalThis.__probe.dropped())) === 0);

    // AND AN ARMED HOLD CARRIES. It arms under the FINGER, not under the
    // point the finger landed on 320ms ago.
    const ht = await settle() ?? ft;
    await send('touchStart', ht.x, ht.y);
    await sleep(60);
    await send('touchMove', ht.x + 9, ht.y + 9);   // inside the slop, both axes
    await sleep(380);
    check(`dpr ${dpr}: the hold arms`, await P(() => globalThis.__probe.ghost()));
    check(`dpr ${dpr}: and takes the pan back`, await P(() => globalThis.__probe.lock()));
    const gx = await P(() => globalThis.__probe.ghostAt());
    check(`dpr ${dpr}: and it arms under the FINGER, not under where it landed`,
      !!gx && Math.abs(gx.x - (ht.x + 9)) < 4, `ghost x ${gx?.x}, finger x ${ht.x + 9}, landed x ${ht.x}`);
    for (let i = 1; i <= 8; i++) { await send('touchMove', ht.x + 9 + i * 18, ht.y + 9 - i * 12); await sleep(12); }
    check(`dpr ${dpr}: the ghost survives the carry`, await P(() => globalThis.__probe.ghost()),
      `verb ${JSON.stringify(await P(() => globalThis.__probe.verb()))}`);
    await send('touchEnd', ht.x + 153, ht.y - 87);
    await sleep(80);
    check(`dpr ${dpr}: the release puts it down`, !(await P(() => globalThis.__probe.ghost())));
    check(`dpr ${dpr}: and the pan is given back`, !(await P(() => globalThis.__probe.lock())));

    // AND THE SCROLLER DOES NOT TAKE IT BACK MID-CARRY. `.draglock`
    // cannot do this - Chromium latched the touch-action at touchstart -
    // so an armed drag carried DOWN a list that has somewhere to scroll
    // used to hand the gesture to the scroller and the ghost vanished
    // with the item halfway to the doll.
    await settle();
    // partway down, so a downward carry has somewhere to scroll TO -
    // at the top of the list there is nothing to steal and the bug hides
    await P(() => globalThis.__probe.scrollTo(80));
    const ct = await P(() => globalThis.__probe.tile()) ?? ft;
    await send('touchStart', ct.x, ct.y);
    await sleep(380);
    const armed = await P(() => globalThis.__probe.ghost());
    const wasTop = await P(() => globalThis.__probe.top());
    for (let i = 1; i <= 8; i++) { await send('touchMove', ct.x, ct.y + i * 16); await sleep(20); }
    check(`dpr ${dpr}: a carry STRAIGHT DOWN a scrollable list keeps the item`,
      armed && await P(() => globalThis.__probe.ghost()),
      `armed ${armed}, events ${await P(() => globalThis.__probe.ev())}`);
    check(`dpr ${dpr}: and the list stays where it was`, (await P(() => globalThis.__probe.top())) === wasTop,
      `${wasTop} -> ${await P(() => globalThis.__probe.top())}`);
    await send('touchEnd', ct.x, ct.y + 128);
    await sleep(80);

    // THE BODY'S PANELS TAKE THE SAME GESTURE (MAC-M2 A).
    const worn = await P(() => globalThis.__probe.worn());
    if (!worn) fails.push(`dpr ${dpr}: no filled worn panel to press`);
    else {
      await settle();
      await send('touchStart', worn.x, worn.y);
      for (let i = 1; i <= 7; i++) { await sleep(52); await send('touchMove', worn.x + Math.cos(i) * 8, worn.y + Math.sin(i * 1.7) * 8); }
      check(`dpr ${dpr}: a hold on the BODY picks the piece up too`, await P(() => globalThis.__probe.ghost()));
      const dock = await P(() => globalThis.__probe.dock());
      await send('touchMove', dock.x, dock.y);
      await sleep(60);
      check(`dpr ${dpr}: and over the dock it says what the release does`,
        (await P(() => globalThis.__probe.verb())) === 'Take off', JSON.stringify(await P(() => globalThis.__probe.verb())));
      await send('touchEnd', dock.x, dock.y);
      await sleep(80);
    }

    check(`dpr ${dpr}: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  await vite.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
  await unlink(join(ROOT, `tools/${BARE_NAME}`)).catch(() => {});
}

if (fails.length) { console.log('\nFAILED:'); for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
console.log('\nall clear');
