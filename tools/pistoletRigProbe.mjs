// THE DWARVEN PISTOLET ON THE GAME'S OWN RIG (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md).
//
// The rig every host mounts (combat/weapon/weaponRig.js createWeaponRig) - not a copy of it - on a page of its own, over
// the real WebGL renderer, with a player that wears a PAIR of Dwarven Pistolets through the equip law and carries
// Pellets. Each frame is the host's own two calls (weaponRig.frame, weaponRig.draw); a shot is the host's attack door
// (weaponRig.clickAttack). No ARENA2: the gun's art needs no palette (artFor's own rule), and the room behind is a flat
// colour - what this measures is the weapon.
//
// What it checks on the real renderer: a pair is a gun pair on the rig; both pistols reach the screen, each forearm out
// of its own corner (the left one in the mirror); a pull fires the lead and the next the other, loaded while the lead
// reloads; each shot leaves its own barrel; the Pistolet's own clips; the rig spends no Pellet; one Pistolet is a single
// gun; and nothing throws. AUDIT PISTOLET B7: the resting pistol, the gilded pair's own pictures and the single gun's
// place are pinned in Node on the same rig (test/combat/weapon/pistoletRig.test.js), not here.
//
//     node tools/pistoletRigProbe.mjs [shots-dir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { readPng } from './pngIO.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.argv[2] || 'scratch/pistolet-rig';
mkdirSync(OUT, { recursive: true });
// AUDIT PISTOLET M9: the page beside the probe (tools/, ignored as every *.tmp.html is), written inside the try whose
// finally unlinks it (AUDIT 68 X2), and driven at its own path - never the site root, which is the landing page (U60).
const PAGE_NAME = 'pistoletrig.tmp.html';
const PAGE = `tools/${PAGE_NAME}`;
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>pistolet rig probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas id="c"></canvas>
<script type="module">
import { Renderer } from '/src/render/renderer.js';
import { perspective, lookAt } from '/src/world/mat4.js';
import { createWeaponRig } from '/src/combat/weapon/weaponRig.js';
import { createPistolet, PISTOLET_TEMPLATE } from '/src/systems/pistolet.js';
import { createPellets } from '/src/systems/thunderlock.js';
import { equipItem, unequipItem } from '/src/systems/equip.js';
import { mintGilded, SUNKEN_SOVEREIGN } from '/src/systems/gilded.js';
const canvas = document.getElementById('c');
canvas.width = innerWidth; canvas.height = innerHeight;
const renderer = new Renderer(canvas);
const audio = { played: [], playOneShot(k) { this.played.push(String(k)); }, registerSound: async () => true, play() {}, stop() {} };
const entity = { isPlayer: true, name: 'Probe', level: 10, career: { name: 'Archer' },
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 60, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: new Array(35).fill(50), health: 100, maxHealth: 100, fatigue: 100, maxFatigue: 100, magicka: 10, maxMagicka: 10,
  items: [], spells: [], activeEffects: [], equipCountdown: 0 };
const rig = createWeaponRig({ renderer, canvas, fetchBytes: null, palette: null, audio, entity });
let frames = 0, last = performance.now();
const wear = (items) => {
  for (const it of [...entity.items]) if (it.equipSlot != null) unequipItem?.(entity, it);
  entity.items.length = 0;
  for (const it of items) entity.items.push(it);
  entity.items.push(createPellets(30));
  for (const it of items) equipItem(entity, it);
  entity.equipCountdown = 0;
  if (rig.playerWeapon.sheathed) rig.playerWeapon.sheathed = false;
};
globalThis.__wear = (kind) => {
  if (kind === 'pair') wear([createPistolet(), createPistolet()]);
  if (kind === 'gold') wear([mintGilded(SUNKEN_SOVEREIGN), mintGilded(SUNKEN_SOVEREIGN)]);
  if (kind === 'one') wear([createPistolet()]);
  return true;
};
globalThis.__fire = () => rig.clickAttack();
globalThis.__state = () => {
  const pw = rig.playerWeapon;
  return { frames, mode: pw.handsMode, gunPair: pw.gunPair, state: pw.machine.state, frame: pw.machine.frame, strike: pw.strike, now: pw.machine.now,
    loadedR: pw.handLoaded('R'), loadedL: pw.handLoaded('L'), sheathed: pw.sheathed,
    pellets: entity.items.filter((i) => i.templateIndex === 561).reduce((n, i) => n + i.stackCount, 0),
    muzzle: rig.thunderlockMuzzle((60 * Math.PI) / 180), played: audio.played.slice(-6) };
};
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  renderer.setClearColor([0.16, 0.14, 0.12, 1]);
  renderer.beginFrame(perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 100), lookAt([0, 1.6, 0], [0, 1.6, 1], [0, 1, 0]), [0.3, -1, 0.2]);
  rig.frame(dt, {});
  rig.draw({});
  renderer.resolveFrame();
  frames++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
globalThis.__ready = true;
</script></body></html>`;

const server = await createServer({ server: { port: 5194, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
try {
  await writeFile(PAGE, HTML);
  await page.goto(`http://localhost:5194/tools/${PAGE_NAME}`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => globalThis.__ready, null, { timeout: 600000 });
  const st = () => page.evaluate(() => globalThis.__state());
  const waitFrames = async (n) => { const f = (await st()).frames; await page.waitForFunction(([f0, k]) => globalThis.__state().frames > f0 + k, [f, n], { timeout: 120000 }); };
  const waitIdle = () => page.waitForFunction(() => globalThis.__state().state === 'Idle', null, { timeout: 60000 });

  await page.evaluate(() => globalThis.__wear('pair'));
  await waitFrames(40);   // the art loads, the draw slides in
  let s = await st();
  check('a pair of Pistolets is a gun pair on the rig', s.mode === 'dual' && s.gunPair, `${s.mode}, gunPair ${s.gunPair}`);
  const rest = readPng(await page.screenshot({ path: `${OUT}/pair-rest.png` }));
  // THE MIRROR IS THE PICTURE'S: each forearm leaves through its own bottom corner - the right's at the right edge, the
  // left's at the LEFT (an unmirrored left pistol is a right hand moved across: its forearm ends mid-screen and the
  // corner is the room's)
  const px = (x, y) => { const o = (y * rest.width + x) * 4; return [rest.data[o], rest.data[o + 1], rest.data[o + 2]]; };
  const room = px(640, 40);
  const isRoom = (c) => Math.abs(c[0] - room[0]) + Math.abs(c[1] - room[1]) + Math.abs(c[2] - room[2]) < 12;
  const corner = (x0) => { let arm = 0; for (let y = rest.height - 30; y < rest.height; y++) for (let x = x0; x < x0 + 30; x++) if (!isRoom(px(x, y))) arm++; return arm; };
  check('each forearm leaves its own bottom corner - the left pistol is the right in the mirror', corner(0) > 600 && corner(rest.width - 30) > 600,
    `left corner ${corner(0)}/900 drawn, right ${corner(rest.width - 30)}/900`);
  const p0 = s.pellets;
  await page.evaluate(() => globalThis.__fire());
  await waitFrames(2);
  s = await st();
  check('the first pull is the lead’s - the right', s.strike?.hand === 'R', s.strike?.hand);
  await page.screenshot({ path: `${OUT}/shot-right.png` });
  const mR = s.muzzle;
  await waitIdle();
  await page.evaluate(() => globalThis.__fire());
  await waitFrames(2);
  s = await st();
  check('the next is the off hand’s - the left, loaded while the right reloads', s.strike?.hand === 'L' && s.strike?.off && !s.loadedR, `${s.strike?.hand}, R loaded ${s.loadedR}`);
  await page.screenshot({ path: `${OUT}/shot-left.png` });
  const mL = s.muzzle;
  check('each shot leaves its own pistol’s barrel', mR && mL && mR.right > 0 && mL.right < 0, `right ${mR?.right?.toFixed(3)}, left ${mL?.right?.toFixed(3)}`);
  check('the fire clip is the Pistolet’s own', s.played.includes('pistolet:fire'), s.played.join(', '));
  await waitIdle(); await waitFrames(10);
  await page.screenshot({ path: `${OUT}/reloading.png` });
  await page.waitForFunction(() => globalThis.__state().loadedR && globalThis.__state().loadedL, null, { timeout: 60000 });
  s = await st();
  check('the clacks are each hand’s reload', s.played.some((k) => k === 'pistolet:open') && s.played.some((k) => k === 'pistolet:close'), s.played.join(', '));
  // the Pellets are spent by the hosts' shot (the ranged lane), not by the rig - so here the count only must not move
  check('the rig itself spends nothing (the host’s ranged lane does)', s.pellets === p0, `${p0} -> ${s.pellets}`);

  await page.evaluate(() => globalThis.__wear('gold'));
  await waitFrames(40);
  await page.screenshot({ path: `${OUT}/sunken-sovereign-pair.png` });
  await page.evaluate(() => globalThis.__wear('one'));
  await waitFrames(40);
  s = await st();
  check('one Pistolet is one gun, not a pair', s.mode === 'single' && !s.gunPair, s.mode);
  await page.screenshot({ path: `${OUT}/single.png` });
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close(); await server.close();
  await unlink(PAGE).catch(() => { /* gone */ });
}
console.log(`${results.filter(Boolean).length}/${results.length} ok - shots in ${OUT}/`);
process.exit(results.every(Boolean) ? 0 : 1);
