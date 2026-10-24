// PROF-RETICLE (2026-10-01): THE ACTS ON THE CROSSHAIR, PHOTOGRAPHED - each act's marks (ui/professions/profReticle.js) round a
// drawn crosshair over a sky-and-grass ground, through a 65 degree lens, at the moments a player sees: the vein with its
// glint and a blow's flash, the ring in the band, the steady hand held and bruised, the Basket's glint and its finds,
// the knife's line half drawn and the Gentle hold, the net winding, waiting over a school, at the tug and in the haul;
// the still forms under reduced motion; a phone's width. Driven headless through Vite over the real modules - no
// ARENA2, no world.
//
//   node tools/profReticleProbe.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'probe-out/prof-reticle';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const shots = [];
const failures = [];
/** A judgement: the marks are on the reticle, inside the screen, with no plate and no title. */
const check = (ok, what) => { if (!ok) failures.push(what); };
try {
  for (const [vw, vh, tag, reduced] of [[1280, 800, 'desk', false], [390, 844, 'phone', false], [1280, 800, 'still', true]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('http://localhost:5241/src/ui/professions/profHud.js', { waitUntil: 'domcontentloaded' }); console.error('loaded', tag);   // a page of the origin - the modules import from it; never the landing (U60)
    await page.evaluate(() => { document.head.querySelectorAll('style, link[rel=stylesheet]').forEach((n) => n.remove()); document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;height:100vh;background:linear-gradient(#8aa0b5 0 48%, #55663f 48% 70%, #3f4d30 70%)'; const x = document.createElement('div'); x.style.cssText = 'position:fixed;left:50%;top:50%;width:9px;height:9px;transform:translate(-50%,-50%);background:linear-gradient(#e6dcc0,#e6dcc0) center/100% 1px no-repeat,linear-gradient(#e6dcc0,#e6dcc0) center/1px 100% no-repeat'; document.body.append(x); });
    const scenes = await page.evaluate(async () => {
      const { createProfHud } = await import('/src/ui/professions/profHud.js');
      const { createMineAct } = await import('/src/systems/mineAct.js');
      const { createChopAct } = await import('/src/systems/chopAct.js');
      const { createHerbAct } = await import('/src/systems/herbAct.js');
      const { createTraceAct } = await import('/src/systems/traceAct.js');
      const { createFishAct } = await import('/src/systems/fishAct.js');
      const { setProfCueSink } = await import('/src/systems/professions/profSounds.js');
      setProfCueSink(() => {});
      window.__hud = createProfHud({ anchor: () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, focal: window.innerHeight / 2 / Math.tan((65 * Math.PI) / 360) }) });
      const run = (n, f) => { for (let i = 0; i < n; i++) f(i); };
      const cycle = () => { let r = 0.05; return () => { r = (r + 0.37) % 1; return r; }; };   // the glint's re-roll asks until it moves
      const acts = {
        mine: () => { const a = createMineAct({ tier: 2, rng: cycle() }); a.tick(0.1, { aim: { yaw: -4.6, pitch: 2.2 } }); a.tick(0.1, { attack: true, aim: { yaw: -4.6, pitch: 2.2 } }); a.tick(0.6, { aim: { yaw: 1, pitch: -1 } }); a.tick(0.05, { attack: true, aim: { yaw: 1, pitch: -1 } }); return [a, '', {}]; },
        chop: () => { const a = createChopAct({ tier: 2, rank: 40 }); a.tick(0.9, {}); a.tick(0.01, { attack: true }); a.tick(0.5, {}); return [a, '', {}]; },
        steady: () => { const a = createHerbAct({ kind: 'steady' }); run(10, () => a.tick(0.1, { held: true })); return [a, 'E', {}]; },
        bruised: () => { const a = createHerbAct({ kind: 'steady' }); a.tick(0.1, { held: true }); run(8, () => a.tick(0.1, { held: true, view: { yaw: 9, pitch: 0 } })); return [a, 'E', {}]; },
        basket: () => { let r = 0; const a = createHerbAct({ kind: 'basket', rng: () => ((r += 0.37) % 1) }); run(5, () => a.tick(0.1, {})); a.tick(0.05, { attack: true }); run(6, () => a.tick(0.1, {})); a.tick(0.3, {}); return [a, 'tap the glint', {}]; },
        trace: () => { const a = createTraceAct({ tier: 4, rng: () => 0.5 }); const p = a.state.points; a.tick(0.05, { held: true, aim: { yaw: p[0][0], pitch: p[0][1] } }); for (let i = 1; i <= 30; i++) { const u = (i / 30) * 3; const k = Math.floor(u), t = u - k; a.tick(0.05, { held: true, aim: { yaw: p[k][0] + (p[k + 1][0] - p[k][0]) * t, pitch: p[k][1] + (p[k + 1][1] - p[k][1]) * t + 0.3 } }); } return [a, 'E', {}]; },
        gentle: () => { const a = createTraceAct({ tier: 2, gentle: true }); run(3, () => a.tick(0.2, { held: true })); return [a, 'E', {}]; },
        wind: () => { const a = createFishAct({ rng: () => 0.5 }); run(9, () => a.tick(0.1, { held: true })); return [a, 'E', {}]; },
        wait: () => { const a = createFishAct({ rng: () => 0.5, schoolAt: () => 0 }); run(6, () => a.tick(0.1, { held: true })); a.tick(0.05, { held: false }); run(14, () => a.tick(0.05, {})); return [a, 'E', {}]; },
        tug: () => { const a = createFishAct({ rng: () => 0.2, schoolAt: () => 0 }); run(6, () => a.tick(0.1, { held: true })); a.tick(0.05, { held: false }); for (let i = 0; i < 2000 && a.state.phase !== 'tug'; i++) a.tick(0.05, {}); return [a, 'E', {}]; },
        haul: () => { const a = createFishAct({ rng: () => 0.2 }); run(6, () => a.tick(0.1, { held: true })); a.tick(0.05, { held: false }); for (let i = 0; i < 2000 && a.state.phase !== 'tug'; i++) a.tick(0.05, {}); a.tick(0.05, { attack: true }); run(30, (i) => a.tick(0.1, { held: i % 3 !== 0 })); return [a, 'E', {}]; },
      };
      window.__acts = acts;
      return Object.keys(acts);
    });
    for (const name of scenes) {
      await page.evaluate((n) => { const [a, label, o] = window.__acts[n](); window.__hud.setMeter(a, label, o); }, name);
      await page.waitForTimeout(140);
      const seen = await page.evaluate(() => {
        const m = document.querySelector('.prof-meter');
        const r = m.getBoundingClientRect(), cs = getComputedStyle(m);
        const hint = m.querySelector('.prof-hint'), hr = hint.getBoundingClientRect();
        const marks = [...m.querySelectorAll('.prof-rc *')].filter((n) => n !== hint && !hint.contains(n))
          .map((n) => n.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
        return {
          reticle: m.classList.contains('prof-reticle'), title: !!m.querySelector('.prof-acttitle'), plate: cs.backgroundColor,
          cx: r.left + r.width / 2, cy: r.top + r.height / 2, hint: hint.textContent, hintL: hr.left, hintR: hr.right,
          marks: marks.length, left: Math.min(...marks.map((b) => b.left)), right: Math.max(...marks.map((b) => b.right)),
          ring: getComputedStyle(m.querySelector('.prof-ring') ?? m).display, bar: getComputedStyle(m.querySelector('.prof-ringbar') ?? m).display,
          sw: document.documentElement.scrollWidth,
        };
      });
      const at = `${tag}-${name}`;
      check(seen.reticle && !seen.title, `${at}: the reticle, untitled`);
      check(seen.plate === 'rgba(0, 0, 0, 0)', `${at}: no plate (${seen.plate})`);
      check(Math.abs(seen.cx - vw / 2) < 1 && Math.abs(seen.cy - vh / 2) < 1, `${at}: round the crosshair (${seen.cx}, ${seen.cy})`);
      check(seen.hint.length > 0 && seen.hintL >= 0 && seen.hintR <= vw, `${at}: the hint on the screen (${seen.hintL}..${seen.hintR})`);
      check(seen.marks > 0 && seen.left >= 0 && seen.right <= vw, `${at}: the marks on the screen (${seen.marks}, ${seen.left}..${seen.right})`);
      check(seen.sw <= vw, `${at}: no sideways scroll (${seen.sw})`);
      if (name === 'chop') check(reduced ? seen.ring === 'none' && seen.bar !== 'none' : seen.ring !== 'none' && seen.bar === 'none', `${at}: ${reduced ? 'the still bar' : 'the ring'}`);
      const w = Math.min(vw, 420), h = 300;
      const file = `${out}/${tag}-${name}.png`;
      await page.screenshot({ path: file, clip: { x: (vw - w) / 2, y: vh / 2 - h / 2, width: w, height: h } });
      shots.push(file); console.error('shot', file);
    }
    check(errors.length === 0, `${tag}: page errors ${errors.join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(shots.join('\n'));
console.log(failures.length ? `FAIL ${failures.length}:\n  ${failures.join('\n  ')}` : `PASS: ${shots.length} shots, every check held`);
if (failures.length) process.exitCode = 1;
