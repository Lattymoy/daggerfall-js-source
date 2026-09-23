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

// The save/load half of the report. Three loads, the way a player makes
// them: the dungeon's OWN door (F12 / the pause menu underground) on a
// save taken in this castle; that same door on a save taken on the
// street (another place - the world host's load must take over and put
// the player there); and the street's load on the castle save (the load
// re-enters the SAVED dungeon, not the first door the streaming world
// loaded).
const untilMode = async (want, ms = 240000) => {
  for (const until = Date.now() + ms; Date.now() < until;) {
    const m = await ev(() => window.__mode());
    const idle = await ev(() => window.__streamIdle());
    if (m === want && idle) return m;
    await page.waitForTimeout(1000);
  }
  return await ev(() => window.__mode());
};
const reenter = async () => {
  if ((await ev(() => window.__mode())) === 'dungeon') return;
  await ev(([p, y]) => window.__warpTo(p, y), [stand, yaw]);
  await page.waitForTimeout(500);
  await ev(() => window.__enter());
  await untilMode('dungeon', 120000);
  await page.waitForTimeout(3000);
};
await reenter();
const castleKey = JSON.parse(await ev(() => window.__dungeonProbe())).locationKey;
console.log(`castle save -> ${await ev(() => window.__quickSave('castle'))}`);
await page.waitForTimeout(500);
const keys = JSON.parse(await ev(() => window.__saveKeys()));
const castleSave = keys.find((k) => k.name === 'castle')?.key ?? null;
check(castleSave != null, `the castle save has a slot (${JSON.stringify(keys)})`);
// 1. the dungeon's own door, the castle's own save: home, no line
await ev((k) => window.__dungeonQuickLoad(k), castleSave);
await page.waitForTimeout(2500);
let p1 = JSON.parse(await ev(() => window.__dungeonProbe()) ?? 'null');
console.log(`load 1 (own door, castle save): mode=${await ev(() => window.__mode())} key=${p1?.locationKey} hud=${JSON.stringify(p1?.hud)}`);
check(p1 && p1.locationKey === castleKey && !(p1.hud ?? []).some((l) => /different dungeon/.test(l)), 'the dungeon\'s own door loads its own save in place');
// 2. a save from the STREET, loaded through the dungeon's own door
await ev(() => window.__dungeonExit());
await untilMode('exterior', 60000);
await page.waitForTimeout(2000);
console.log(`street save -> ${await ev(() => window.__quickSave('street'))}`);
await page.waitForTimeout(500);
const streetSave = JSON.parse(await ev(() => window.__saveKeys())).find((k) => k.name === 'street')?.key ?? null;
check(streetSave != null, 'the street save has a slot');
await reenter();
await ev((k) => window.__dungeonQuickLoad(k), streetSave);
const m2 = await untilMode('exterior');
console.log(`load 2 (own door, street save): mode=${m2} street hud=${await ev(() => window.__hudLines())}`);
check(m2 === 'exterior', 'a save from another place, loaded underground, puts the player THERE (the world host\'s load took it)');
// 3. the street's load on the castle save: the SAVED dungeon is re-entered
await ev((k) => window.__loadSave(k), castleSave);
const m3 = await untilMode('dungeon');
await page.waitForTimeout(2000);
const p3 = JSON.parse(await ev(() => window.__dungeonProbe()) ?? 'null');
console.log(`load 3 (street load, castle save): mode=${m3} key=${p3?.locationKey} (saved in ${castleKey}) hud=${JSON.stringify(p3?.hud)} feet=${JSON.stringify(p3?.feet)}`);
check(m3 === 'dungeon' && p3?.locationKey === castleKey && !(p3.hud ?? []).some((l) => /different dungeon/.test(l)), 'the load comes home to the saved dungeon, and the dungeon host agrees it is the one');
await shot('3-after.png');
const real = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource/.test(e));
check(real.length === 0, real.length ? `page errors: ${real.slice(0, 3).join(' | ')}` : 'zero page errors');
console.log('--- last console lines ---');
console.log(logs.filter((l) => !/404|\[warning\] \[vite\]/.test(l)).slice(-80).join('\n'));
await browser.close();
await server.close();
console.log(fails === 0 ? 'CASTLE PROBE: ALL GREEN' : `CASTLE PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
