// ARENA3, SEEN (2026-10-02, Mac: "join a team (red and blue)"; "Joining a team comes with it's own enhanced UI where you
// can view your ranking and even player leaderboards"): the banners, the Arena window and the bookmaker over the real
// game on the world host - the Red Banner's recruiter at the gate and his choice, joining (the window opening on its
// Team page), the window's every page over the real save, the bookmaker's stall and a wager paid from the purse, the
// Herald's choice with the window's door, the pause window's Arena door once joined, and a ladder bout under the
// banner - its pennant on the versus bar and its point for the banner. test/arena3_*.test.js hold the laws headless;
// this stands them over the real game and photographs what a fake cannot.
//
//     ARENA2_PATH=<the game's ARENA2> SHOTS=<dir> node tools/arena3Probe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS ?? 'tools/shots/arena3';
mkdirSync(SHOTS, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SKIN = process.env.SKIN ?? 'enhanced';

const server = await createServer({ root: process.cwd(), server: { port: 5241, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { if (m.type() === 'error' && !/CURSOR\.IMG|status of 404/.test(m.text())) errors.push(`[console] ${m.text().slice(0, 300)}`); });

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; return !!ok; };
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const shot = async (name) => { try { await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 90000 }); console.log(`  shot ${name}`); } catch (e) { console.log(`(screenshot ${name} skipped: ${e.message.split('\n')[0]})`); } };
const arena = () => ev(() => window.__arena?.() ?? null);
const league = () => ev(() => window.__arenaLeague?.() ?? null);
const dialog = () => ev(() => [...document.querySelectorAll('.dlg-choice .dlg-btn .dlg-label')].map((n) => n.textContent));
const dialogLines = () => ev(() => [...document.querySelectorAll('.dlg-choice .dlg-win')].map((n) => n.textContent).join(' | '));
const waitFor = async (pred, ms, step = 500) => { for (const until = Date.now() + ms; Date.now() < until;) { const a = await arena(); if (a && pred(a)) return a; await page.waitForTimeout(step); } return arena(); };
const windowUp = () => ev(() => !!document.querySelector('.aw-shell'));

await page.goto(`http://localhost:5241/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12:02&skin=${SKIN}&touch=off`);
let mode = null;
for (const until = Date.now() + 300000; Date.now() < until;) {
  mode = await ev(() => (window.__mode ? window.__mode() : null));
  const idle = await ev(() => (window.__streamIdle ? window.__streamIdle() : false));
  if (mode && idle) break;
  await page.waitForTimeout(1000);
}
check(mode === 'exterior', `booted in Daggerfall (mode: ${mode})`);
await page.waitForTimeout(3000);
await ev(() => window.__arenaCloseOverlays());
let a = await arena();
check(!!a?.herald, `the gate stands (the Herald at ${JSON.stringify(a?.herald?.map((v) => +v.toFixed(1)))})`);
const h = a.herald;
await ev(([p]) => window.__pose(p[0], p[1] + 0.3, p[2] + 4, Math.PI, 0), [h]);
await page.waitForTimeout(2000);
await ev(() => window.__arenaCloseOverlays());

// THE RED BANNER'S RECRUITER: his choice, then join
check(await ev(() => window.__arenaGate.recruiter('redRecruiter')), 'the Red Banner\'s recruiter answers');
await page.waitForTimeout(3000);
const rc = await dialog();
console.log(`  choices: ${JSON.stringify(rc)}`);
console.log(`  lines: ${(await dialogLines()).slice(0, 300)}`);
check(rc.some((l) => /Join the Red Banner/.test(l)) && rc.some((l) => /The Arena window/.test(l)), 'he offers the banner and the window');
await shot('1-recruiter.png');
const gold0 = (await league()).gold;
await page.keyboard.press('KeyJ');
await page.waitForTimeout(2500);
let L = await league();
check(L?.league?.team === 'red', `joined the Red Banner (team ${L?.league?.team}, season ${L?.league?.season})`);
check(await windowUp(), 'the Arena window opened on joining');
const onPage = await ev(() => document.querySelector('.aw-tab.on')?.dataset.page);
check(onPage === 'team', `on its Team page (${onPage})`);
await shot('2-window-team.png');
// every page, over the real save
for (const pg of ['bouts', 'ladder', 'boards', 'records', 'rules']) {
  await ev((p) => [...document.querySelectorAll('.aw-tab')].find((t) => t.dataset.page === p)?.click(), pg);
  await page.waitForTimeout(400);
  const info = await ev(() => { const w = document.querySelector('.aw-win').getBoundingClientRect(); return { r: [w.left, w.top, w.right, w.bottom], words: document.querySelector('.aw-body').textContent.length, x: document.documentElement.scrollWidth - innerWidth }; });
  check(info.r[0] >= 0 && info.r[2] <= 1280 && info.r[3] <= 800 && info.x <= 0 && info.words > 40, `the ${pg} page stands in the viewport (${info.words} characters)`);
  await shot(`3-window-${pg}.png`);
}
const watchWhy = await ev(() => document.querySelector('.aw-act[data-act="watch"]')?.getAttribute('title') ?? null);
console.log(`  the exhibition's Watch: ${watchWhy ? `refused - ${watchWhy}` : 'pressable at the gate'}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
check(!(await windowUp()), 'Escape puts the window away');

// THE BOOKMAKER: back the first fighter, the third stake
await ev(() => window.__arenaCloseOverlays());
check(await ev(() => window.__arenaGate.bookmaker()), 'the bookmaker\'s stall answers');
await page.waitForTimeout(3000);
const bc = await dialog();
console.log(`  choices: ${JSON.stringify(bc)}`);
await shot('4-bookmaker.png');
if (bc.some((l) => /^A - Back /.test(l))) {
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(3000);
  console.log(`  stakes: ${JSON.stringify(await dialog())}`);
  await shot('5-stake.png');
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(800);
  L = await league();
  const w = L?.league?.book?.wagers?.[0];
  check(!!w && w.stake === 50 && L.gold === gold0 - 50, `a wager of 50 gold placed and paid (${JSON.stringify(w && { stake: w.stake, on: w.names[w.side], price: `${w.num}/${w.den}` })}, purse ${gold0} -> ${L?.gold})`);
} else console.log('  (no book open this hour)');

// THE HERALD: the window's door in his choice; the pause window's door once joined
await ev(() => window.__arenaCloseOverlays());
await ev(() => window.__arenaHerald());
await page.waitForTimeout(3000);
const hc = await dialog();
check(hc.includes('The Arena window'), `the Herald's choice carries the window (${JSON.stringify(hc)})`);
await shot('6-herald.png');
check((await league()).pauseDoor, 'the pause window\'s Arena door stands, once joined');

// A LADDER BOUT UNDER THE BANNER: the pennant on the versus bar, the point for the banner
await page.keyboard.press('KeyF');
for (const until = Date.now() + 180000; Date.now() < until;) {
  mode = await ev(() => window.__mode());
  if (mode === 'dungeon') break;
  await page.waitForTimeout(500);
}
check(mode === 'dungeon', `down onto the floor's instance (mode ${mode})`);
a = await waitFor((x) => x.phase === 'fight', 180000);
await page.waitForTimeout(4000);
console.log(`  the bout: ${JSON.stringify({ phase: a?.phase, stage: a?.stage, kind: a?.kind, fighters: a?.fighters?.map((f) => f.name) })}`);
console.log(`  the HUD: ${await ev(() => { const h = document.querySelector('.arena-hud'); return h ? `display '${h.style.display}', rows ${document.querySelectorAll('.arena-ftr').length}` : 'not built'; })}`);
const pennant = await ev(() => [...document.querySelectorAll('.arena-ftr')].filter((r) => r.style.display !== 'none').map((r) => r.dataset.team ?? ''));
check(pennant[0] === 'red', `my pennant on the versus bar (${JSON.stringify(pennant)})`);
await shot('7-floor-pennant.png');
for (let i = 0; i < 40; i++) {
  a = await arena();
  if (a?.phase !== 'fight') break;
  await ev(() => window.__arenaStrike(9));
  await page.waitForTimeout(700);
}
a = await waitFor((x) => x.phase === 'done' || x.phase === 'heal', 30000);
L = await league();
console.log(`  bout kept: ${JSON.stringify(L?.league?.bouts?.[0] && { opp: L.league.bouts[0].opp, won: L.league.bouts[0].won, points: L.league.bouts[0].points })}, the banner's points ${JSON.stringify(L?.league?.points)}`);
check(L?.league?.bouts?.length >= 1, 'the bout kept for the Records page');
check(!L?.league?.bouts?.[0]?.won || L.league.points.red >= 1, 'a win is a point for the Red Banner');
await shot('8-floor-verdict.png');

console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) console.log(`  ${e.split('\n')[0]}`);
check(errors.filter((e) => /arena/i.test(e)).length === 0, 'no arena error on the page');
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
