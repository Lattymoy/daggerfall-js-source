// CASTLE1 (DragynDance, Discord, 2026-09-22: "Entering castle daggerfall
// removes your ability to interact with anything, so you are unable to
// leave, talk to the guard, or open any doors"): walk INTO Castle
// Daggerfall through its own entrance door, from the street, on the
// world host - then try to interact the way a player would.
//
// Usage: ARENA2_PATH=/home/user/dfdata/arena2 node tools/castleProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS ?? 'castle-shots';
mkdirSync(SHOTS, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({ root: process.cwd(), server: { port: 5231, strictPort: true, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const logs = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { logs.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404/.test(m.text())) errors.push(`[console] ${m.text()}`); });

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; return !!ok; };
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const shot = async (name) => { try { await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 8000 }); } catch (e) { console.log(`(screenshot ${name} skipped: ${e.message.split('\n')[0]})`); } };

const LOC = process.env.LOC ?? 'Daggerfall';
const REGION = process.env.REGION ?? 'Daggerfall';
await page.goto(`http://localhost:5231/play/?world&shot&play&region=${encodeURIComponent(REGION)}&loc=${encodeURIComponent(LOC)}&class=1&novideo&tod=12:00`);

let mode = null;
for (const until = Date.now() + 240000; Date.now() < until;) {
  mode = await ev(() => (window.__mode ? window.__mode() : null));
  const idle = await ev(() => (window.__streamIdle ? window.__streamIdle() : false));
  if (mode && idle) break;
  await page.waitForTimeout(1000);
}
check(mode === 'exterior', `booted on the street (mode: ${mode})`);
await page.waitForTimeout(3000);

const doors = await ev(() => window.__doors());
const entrances = doors.filter((d) => d.type === 2);
console.log(`dungeon entrance doors: ${JSON.stringify(entrances)}`);
check(entrances.length > 0, `${entrances.length} dungeon entrance door(s) in the loaded world`);
const pixel = await ev(() => window.__currentPixel());
console.log(`player pixel ${pixel}`);

// The headless class start pops the main quest's opening box on the street; a player reads it and clicks it away.
for (let i = 0; i < 60; i++) {   // the tutorial's pages, then the main quest's opening box
  const t = JSON.parse(await ev(() => window.__talk()));
  if (!t.overlay) break;
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
}
console.log('talk before entering: ' + JSON.stringify(JSON.parse(await ev(() => window.__talk())).overlay));
const d = entrances[0];
// An exterior door's normal points OUT of the building; stand in front, look at it.
const stand = [d.pos[0] + d.normal[0] * 1.0, d.pos[1] - 0.5, d.pos[2] + d.normal[2] * 1.0];
const yaw = Math.atan2(-d.normal[0], -d.normal[2]);
console.log(await ev(([p, y]) => window.__warpTo(p, y), [stand, yaw]));
await page.waitForTimeout(500);
await shot('1-at-door.png');
const entered = await ev(() => window.__enter());
console.log(`__enter -> ${entered}`);
for (const until = Date.now() + 120000; Date.now() < until;) {
  mode = await ev(() => window.__mode());
  if (mode === 'dungeon') break;
  await page.waitForTimeout(500);
}
check(mode === 'dungeon', `walked in through the door (mode: ${mode})`);
await page.waitForTimeout(4000);
await shot('2-inside.png');

const probe = JSON.parse(await ev(() => window.__dungeonProbe()));
console.log(JSON.stringify({ ...probe, people: probe.people.length, nearTargets: probe.nearTargets.slice(0, 5) }));
console.log('talk: ' + await ev(() => window.__talk()));
console.log('overlayKind: ' + await ev(() => window.__overlayKind()));
check(probe.transitioning === false, 'the transition latch is down');
check(!probe.overlay, `no window is up in the dungeon's own slot (${probe.overlayKind})`);
console.log(`street slot held: ${probe.talkOverlay} (a headless class start's tutorial pages ride there; a played character read them on the street)`);

// Try the exit door the way classicStartProbe does.
if (probe.exits.length) {
  const { pos, normal } = probe.exits[0];
  const st = [pos[0] + normal[0] * 0.8, pos[1] - 0.5, pos[2] + normal[2] * 0.8];
  const yw = Math.atan2(-normal[0], -normal[2]);
  await ev(([p, y]) => window.__warpTo(p, y), [st, yw]);
  await page.waitForTimeout(300);
  const before = JSON.parse(await ev(() => window.__dungeonProbe()));
  console.log('at exit: ' + JSON.stringify({ pick: before.pick, picked: before.picked, wall: before.wall, containing: before.containing, near: before.nearTargets.slice(0, 4) }));
check(before.pick?.key === 'exit:0', `the ray at the exit door names the exit (${before.pick?.key})`);
  const left = await ev(() => window.__dungeonExit());
  console.log(`__dungeonExit -> ${left}`);
  await page.waitForTimeout(1500);
  const after = await ev(() => window.__mode());
  check(after === 'exterior', `the exit door answers (mode after: ${after})`);
}

// The save/load half of the report: quicksave INSIDE the castle, then load it back.
if ((await ev(() => window.__mode())) !== 'dungeon') {
  console.log('(not in the dungeon any more - re-entering for the save/load half)');
  await ev(([p, y]) => window.__warpTo(p, y), [stand, yaw]);
  await page.waitForTimeout(500);
  await ev(() => window.__enter());
  for (const until = Date.now() + 120000; Date.now() < until;) { if ((await ev(() => window.__mode())) === 'dungeon') break; await page.waitForTimeout(500); }
  await page.waitForTimeout(3000);
}
const saved = await ev(() => window.__quickSave());
console.log(`__quickSave -> ${JSON.stringify(saved)}`);
await page.waitForTimeout(1000);
const keyBefore = JSON.parse(await ev(() => window.__dungeonProbe())).locationKey;
await ev(() => window.__quickLoad());
for (const until = Date.now() + 180000; Date.now() < until;) {
  const idle = await ev(() => window.__streamIdle());
  const m = await ev(() => window.__mode());
  if (idle && m === 'dungeon') break;
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(3000);
const afterLoad = JSON.parse(await ev(() => window.__dungeonProbe()) ?? 'null');
console.log(`after load: mode=${await ev(() => window.__mode())} key=${afterLoad?.locationKey} (saved in ${keyBefore}) hud=${JSON.stringify(afterLoad?.hud)} pick=${JSON.stringify(afterLoad?.pick)} containing=${JSON.stringify(afterLoad?.containing)} feet=${JSON.stringify(afterLoad?.feet)}`);
console.log('street hud: ' + await ev(() => window.__hudLines()));
check(afterLoad && afterLoad.locationKey === keyBefore, 'the load comes home to the same dungeon');
await shot('3-after.png');
const real = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource/.test(e));
check(real.length === 0, real.length ? `page errors: ${real.slice(0, 3).join(' | ')}` : 'zero page errors');
console.log('--- last console lines ---');
console.log(logs.filter((l) => !/404|\[warning\] \[vite\]/.test(l)).slice(-80).join('\n'));
await browser.close();
await server.close();
console.log(fails === 0 ? 'CASTLE PROBE: ALL GREEN' : `CASTLE PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
