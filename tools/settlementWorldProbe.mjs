// A SETTLEMENT IN THE RUNNING GAME. Boots the streaming world in shot
// mode, jumps to a settlement's pixel (window.__tesaJump), waits for its host to stand it (window.__settlementView), and
// shoots it from the air and from a street; then walks to a door and presses it, and says whether the rooms opened.
// Needs ARENA2 (the dev server's /arena2). The shots are of the player's own ground: they stay in scratch/.
//  ARENA2_PATH=... node tools/settlementWorldProbe.mjs [row] [--out scratch/settlement-world] [--season summer] [--size 640x400]   (row: settlements.json's, 1 Sahr Waters)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const named = process.argv.slice(2).filter((arg, i, all) => !arg.startsWith('--') && !['--out', '--season', '--size'].includes(all[i - 1]));   // a flag's value is no row
const ORDINAL = Number(named[0] ?? 1);   // a settlements.json row (1: Sahr Waters, Hammerfell)
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'scratch/settlement-world';
const SEASON = process.argv.includes('--season') ? process.argv[process.argv.indexOf('--season') + 1] : null;   // summer, rain or winter (shared.js seasonOverride)
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const SIZE = process.argv.includes('--size') ? process.argv[process.argv.indexOf('--size') + 1].split('x').map(Number) : [1280, 800];   // a software renderer draws a whole town slowly: a smaller view is quicker
const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/status of 404/.test(t)) errors.push(`[console] ${t}`); if (/\[settlements\]/.test(t)) errors.push(`[warn] ${t}`); });
// a frame count read through a navigation (the boot may reload once): a destroyed context answers 0 and the wait goes on
const frameNow = () => page.evaluate(() => window.__frame ?? 0).catch(() => 0);
const frames = async (n, cap = 60000) => {
  const f0 = await frameNow(), t0 = Date.now();
  while (Date.now() - t0 < cap) { await page.waitForTimeout(200); if (await frameNow() >= f0 + n) break; }
};
/** Close what stands over the view - the boot's boxes, a window - and nothing more: an Escape with none up opens the menu. */
const drain = async () => {
  for (let i = 0, quiet = 0; i < 30 && quiet < 3; i++) {
    const up = await page.evaluate(() => { try { return !!JSON.parse(window.__talk()).overlay; } catch { return false; } }).catch(() => false);
    if (up) { quiet = 0; await page.keyboard.press('Escape'); } else quiet++;
    await frames(2);
  }
};
/** A verdict against the game: said, and the exit code set. */
const fail = (why) => { console.log('FAIL:', why); process.exitCode = 1; };
const until = async (fn, cap = 240000, arg = undefined) => { const t0 = Date.now(); for (;;) { const v = await page.evaluate(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > cap) return null; await frames(1, 10000); } };
try {
  await page.goto(`http://localhost:5241/play/?world&nomenu&class=0&novideo&shot&play&tod=12:00${SEASON ? `&season=${SEASON}` : ''}`);
  await until(() => (window.__frame ?? 0) > 5 && typeof window.__tesaJump === 'function', 300000);
  await page.mouse.click(640, 400);
  await drain();
  // the settlement's pixel under the game's own fit (the same modules the game runs, through the dev server)
  const where = await page.evaluate(async (o) => {
    const places = await import('/src/world/settlement/settlementPlaces.js'), frame = await import('/src/world/tamriel/tamrielFrame.js');
    const row = places.SETTLEMENT_ROWS[o];
    return { name: row.name, pixel: places.settlementPixel(row), fit: frame.tamrielFit() };
  }, ORDINAL);
  const [px, py] = where.pixel;
  console.log('booted; the game fits', JSON.stringify(where.fit), '- jumping to', where.name, 'at', px, py);
  await page.evaluate(([x, y]) => window.__tesaJump(x, y), [px, py]);
  let last = '';
  // the row's own town: a grown town beside it stands in the same view
  const view = await until((name) => { const v = window.__settlementView?.()?.filter((x) => x.name === name); return v?.length && v[0].ready >= v[0].meshes ? v : null; }, 600000, where.name).catch(() => null)
    ?? null;
  if (!view) {
    last = await page.evaluate(() => JSON.stringify({ hook: typeof window.__settlementView, view: window.__settlementView?.() ?? null, at: window.__currentPixel?.() })).catch((e) => e.message);
    throw new Error(`no settlement stood on the pixel: ${last}`);
  }
  await drain();
  const s = view[0];
  console.log(JSON.stringify({ name: s.name, buildings: s.buildings, meshes: `${s.ready}/${s.meshes}`, mid: s.mid.map((v) => +v.toFixed(1)) }));
  const shoot = async (name, x, y, z, yaw, pitch) => {
    await page.evaluate(([a, b, c, d, e]) => window.__pose(a, b, c, d, e), [x, y, z, yaw, pitch]);
    await frames(12); await page.screenshot({ path: join(out, `${name}.png`), timeout: 240000 });
  };
  await shoot('air', s.mid[0], s.mid[1] + 70, s.mid[2] - 110, 0, -0.5);
  await shoot('air-west', s.mid[0] - 110, s.mid[1] + 60, s.mid[2], Math.PI / 2, -0.45);
  const d = s.doors[0];
  const r = (d.facing * Math.PI) / 180, back = [Math.sin(r), Math.cos(r)];
  await shoot('street', d.at[0] + back[0] * 9, d.at[1] + 1.7, d.at[2] + back[1] * 9, Math.atan2(-back[0], -back[1]), -0.05);
  // to the door, facing it, and press it
  await page.evaluate(([a, b, c, yaw]) => window.__pose(a, b, c, yaw, 0), [d.at[0] + back[0] * 1.6, d.at[1] + 0.1, d.at[2] + back[1] * 1.6, Math.atan2(-back[0], -back[1])]);
  await frames(10);
  await drain();
  const before = await page.evaluate(() => window.__mode?.() ?? null);
  await page.screenshot({ path: join(out, 'door.png'), timeout: 240000 });
  const said = [];
  const hear = (m) => said.push(`${m.type()}: ${m.text()}`.slice(0, 200));
  page.on('console', hear);
  const doorsSeen = await page.evaluate(() => { const d = window.__doors?.() ?? []; return { n: d.length, last: JSON.stringify(d.slice(-2)).slice(0, 400) }; });
  // the modes' own tryEnter, from the eye; re-posed and asked again, a step nearer each time, while the eye meets no door
  let entered = 'false';
  for (let k = 0; k < 5 && entered === 'false'; k++) {
    const r = 1.6 - k * 0.2;
    await page.evaluate(([a, b, c, yaw]) => window.__pose(a, b, c, yaw, 0), [d.at[0] + back[0] * r, d.at[1] + 0.1, d.at[2] + back[1] * r, Math.atan2(-back[0], -back[1])]);
    await frames(12);
    entered = await page.evaluate(async () => { try { return String(await window.__enter?.()); } catch (e) { return `threw ${e?.message}`; } });
  }
  console.log(JSON.stringify({ doorsSeen, entered }));
  // a shop's greeting stands over the door: the entry goes on when it closes (activateStaticDoor's ChoiceWindow)
  const greeted = await until(() => { try { return JSON.parse(window.__talk()).overlay ? 'yes' : null; } catch { return null; } }, 30000) ?? 'no';
  await drain();
  const after = await until(() => (window.__mode?.() === 'interior' ? 'interior' : null), 180000) ?? await page.evaluate(() => window.__mode?.() ?? null);
  page.off('console', hear);
  const inside = await page.evaluate(() => window.__building?.() ?? null);
  console.log(JSON.stringify({ door: d.type, greeted, modeBefore: before, modeAfter: after, inside }));
  if (after !== 'interior') { console.log(said.slice(0, 15).join('\n')); fail(`the door opened no rooms (mode ${after})`); }
  else if (!(JSON.parse(inside ?? 'null')?.type > 0)) fail('inside, but no building was read');   // a house has a type and no name
  await drain(); await frames(20, 180000);
  await page.screenshot({ path: join(out, 'inside.png'), timeout: 240000 }).catch((e) => console.log('no shot inside:', e.message.split('\n')[0]));
} catch (e) { fail(e.message); }
if (errors.length) fail(`page errors:\n${errors.slice(0, 12).join('\n')}`);
else console.log('no page errors');
await browser.close(); await server.close();
