// ARENA2, SEEN (2026-10-02, Mac: "extremely detailed and authentic ... AAA grade. All UI elements and text must be
// enhanced UI plus"): the arena's bouts played through on the world host in a real browser - the city's exhibition on
// the hour (the fighters, the crowd in the tiers, the HUD), the Herald's choice at the gate, the floor's instance and
// a ladder bout fought to its verdict, the ladder's step and the way out. test/arena2_*.test.js hold the laws headless;
// this stands them over the real game and photographs what a fake cannot.
//
//     ARENA2_PATH=<the game's ARENA2> SHOTS=<dir> node tools/arenaProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS ?? 'tools/shots/arena';
mkdirSync(SHOTS, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SKIN = process.env.SKIN ?? 'enhanced';

const server = await createServer({ root: process.cwd(), server: { port: 5239, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { if (/\[arena\]|ARENA/.test(m.text())) console.log(`  console: ${m.text().slice(0, 200)}`); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404/.test(m.text())) errors.push(`[console] ${m.text().slice(0, 300)}`); });

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; return !!ok; };
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const shot = async (name) => { try { await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 90000 }); console.log(`  shot ${name}`); } catch (e) { console.log(`(screenshot ${name} skipped: ${e.message.split('\n')[0]})`); } };
const arena = () => ev(() => window.__arena?.() ?? null);
const waitFor = async (pred, ms, step = 500) => { for (const until = Date.now() + ms; Date.now() < until;) { const a = await arena(); if (a && pred(a)) return a; await page.waitForTimeout(step); } return arena(); };

await page.goto(`http://localhost:5239/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12:02&skin=${SKIN}&touch=off`);
let mode = null;
for (const until = Date.now() + 300000; Date.now() < until;) {
  mode = await ev(() => (window.__mode ? window.__mode() : null));
  const idle = await ev(() => (window.__streamIdle ? window.__streamIdle() : false));
  if (mode && idle) break;
  await page.waitForTimeout(1000);
}
check(mode === 'exterior', `booted in Daggerfall (mode: ${mode})`);
console.log(`  overlays put away: ${await ev(() => window.__arenaCloseOverlays())}`);
await page.waitForTimeout(3000);
await ev(() => window.__arenaCloseOverlays());
let a = await arena();
check(!!a?.centre, `the colosseum's sand stands in the city (centre ${JSON.stringify(a?.centre?.map((v) => +v.toFixed(1)))})`);

// THE CITY'S EXHIBITION: stand on the lower terrace's south side, looking north over the sand
if (a?.centre) {
  const c = a.centre;
  await ev(([p]) => window.__pose(p[0], p[1], p[2], 0, -0.25), [[c[0], c[1] + 7.2, c[2] - 21.6]]);
  a = await waitFor((x) => !!x.phase, 120000);
  check(a?.stage === 'city' && a?.kind === 'exhibition', `the hour's exhibition stands on the city floor (stage ${a?.stage}, phase ${a?.phase})`);
  console.log(`  fighters: ${JSON.stringify(a?.fighters)}`);
  await page.waitForTimeout(4000);
  await shot('1-city-call.png');
  a = await waitFor((x) => x.phase === 'fight', 120000);
  check(a?.phase === 'fight', `the count ran out into the fight (phase ${a?.phase}); crowd batches ${a?.crowd}`);
  await page.waitForTimeout(6000);
  await shot('2-city-fight.png');
  a = await waitFor((x) => x.fighters.some((f) => f.health < f.max), 90000, 2000);
  console.log(`  ${a?.fighters.some((f) => f.health < f.max) ? 'blows landed' : 'no blow yet (a software GPU runs a frame or two a second)'}: health ${a?.fighters.map((f) => `${f.health}/${f.max}`).join(', ')}, mood ${a?.mood?.toFixed?.(2)}`);
  await shot('3-city-blows.png');
}

// THE HERALD'S CHOICE at the gate
a = await arena();
if (a?.herald) {
  const h = a.herald;
  await ev(([p]) => window.__pose(p[0], p[1] + 0.3, p[2] + 3, Math.PI, 0), [h]);
  await page.waitForTimeout(1500);
  check(await ev(() => window.__arenaHerald()), 'the Herald\'s choice opens');
  await page.waitForTimeout(800);
  await shot('4-herald-choice.png');
  const dlg = await ev(() => [...document.querySelectorAll('.dlg-choice .dlg-btn .dlg-label')].map((n) => n.textContent));
  console.log(`  choices: ${JSON.stringify(dlg)}`);
  check(dlg.includes('Fight on the ladder'), 'his choice offers the ladder');
  await page.keyboard.press('KeyF');
  for (const until = Date.now() + 180000; Date.now() < until;) {
    mode = await ev(() => window.__mode());
    if (mode === 'dungeon') break;
    await page.waitForTimeout(500);
  }
  check(mode === 'dungeon', `down onto the floor's instance (mode ${mode})`);
  a = await waitFor((x) => x.stage === 'floor' && !!x.phase, 60000);
  check(a?.stage === 'floor' && a?.kind === 'ladder', `a ladder bout on the instance (phase ${a?.phase}, ${a?.fighters.map((f) => f.name).join(' vs ')})`);
  await page.waitForTimeout(2500);
  await shot('5-floor-call.png');
  a = await waitFor((x) => x.phase === 'fight', 120000);
  await page.waitForTimeout(1500);
  await shot('6-floor-fight.png');
  // the bout fought to its end by my blows (the probe's own door, through the pool's damage door)
  for (let i = 0; i < 40; i++) {
    a = await arena();
    if (a?.phase !== 'fight') break;
    await ev(() => window.__arenaStrike(9));
    await page.waitForTimeout(700);
  }
  a = await waitFor((x) => x.phase === 'verdict' || x.phase === 'heal' || x.phase === 'done', 20000);
  check(!!a?.result, `the bout ended: ${JSON.stringify(a?.result && { side: a.result.side, how: a.result.how })}`);
  await shot('7-floor-verdict.png');
  a = await waitFor((x) => x.phase === 'done', 20000);
  console.log(`  ladder: ${JSON.stringify(a?.ladder)}`);
  check(a?.ladder?.record?.wins + a?.ladder?.record?.losses >= 1, 'the ladder counted the bout');
}

console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log(`  ${e.split('\n')[0]}`);
check(errors.filter((e) => /arena/i.test(e)).length === 0, 'no arena error on the page');
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
