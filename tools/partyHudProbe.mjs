// PARTY8 (Mac, 2026-09-22: "increase the party limit to 8, and also redesign
// the party UI so it doesnt clutter the screen into a better enhanced
// design") - THE PARTY HUD AT A FULL PARTY, in a real browser.
//
// What only a browser can prove: the stack of seven companions' cards on
// the enhanced skin's sheet - its width, its height against the viewport,
// that a name ellipsizes, that the away card greys - photographed, so a
// person can look at the design. The laws are pinned in node
// (test/soc4_partyhud.test.js); here the numbers the screen shows are read
// back off the DOM.
//
// PARTY8-B (Mac: "B" - quiet rows): the same seven, now with `here` set
// to Daggerfall so the rows read as the design means them to - Bran's
// place line gone (with me), the dungeon seat's kept, the digits drawn
// only on the seats under half health.
//
// Self-hosting: starts its own vite on 5226. No ARENA2: the portraits are
// the plate (the face loader answers null), which is the layout's worst
// case for a face. (The head records themselves, measured off the real
// FACE##I0.CIF files: 20-31 wide, 26-32 tall - the plate is 32x34.)
//     node tools/partyHudProbe.mjs [--shots DIR]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = 5226;
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };

const server = await createServer({ root: new URL('..', import.meta.url).pathname, server: { port: PORT, strictPort: true, hmr: false } });
await server.listen();
const BASE = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const [VW, VH] = (process.env.VIEW ?? '1280x800').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(`${BASE}/menu.html?skin=enhanced`, { waitUntil: 'networkidle' });

const state = await page.evaluate(async () => {
  const { createPartyPanel } = await import('/src/ui/partyPanel.js');
  const { PARTY_MAX } = await import('/src/net/wire.js');
  // the picture a full party's hub frame paints (net/social.js SocialState's own shape, stubbed)
  const pose = (h, hm, f, fm, m, mm, loc, inn = 0) => ({ px: 1, py: 1, in: inn, loc, h, hm, f, fm, m, mm, race: 'Breton', gender: 'male', face: 0 });
  const names = ['Bran', 'Cylandriel of the Long Name', 'Dar', 'Eli', 'Fen', 'Gorm', 'Hal'];
  const members = [{ acct: 'acct-me', name: 'Mac', online: true, seen: 0, peers: ['peer-me'], p: null }];
  names.forEach((n, i) => members.push({ acct: `acct-${i}`, name: n, online: i !== 5, seen: Date.now() - 300000, peers: [`peer-${i}`],
    p: i === 6 ? null : pose(10 + i * 8, 60, 1200 - i * 150, 2000, 5 + i * 3, 30, ['Daggerfall', 'Privateer\'s Hold', 'The Odd Blades', 'Wayrest', '', 'Sentinel', 'Gothway Garden'][i], [0, 1, 2, 0, 0, 0, 2][i]) }));
  const social = { acct: 'acct-me', version: 1, party: { id: 'q-1', leader: 'acct-1', members }, others: () => members.filter((m) => m.acct !== 'acct-me'), now: () => Date.now() };
  const panel = createPartyPanel({ social, faceLoader: async () => null, touch: false, here: () => pose(60, 60, 2000, 2000, 30, 30, 'Daggerfall') });
  panel.render({});
  await new Promise((r) => setTimeout(r, 200));
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const root = panel.root;
  const cards = [...root.querySelectorAll('.dfparty-card')].map(rect);
  const name1 = root.querySelectorAll('.dfparty-name')[1];
  return {
    PARTY_MAX, root: rect(root), cards, title: root.querySelector('.dfparty-title').textContent,
    nameClipped: name1.scrollWidth > name1.clientWidth, nameTitle: name1.getAttribute('title'),
    away: [...root.querySelectorAll('.dfparty-card')].map((c) => c.className), where: [...root.querySelectorAll('.dfparty-where')].map((w) => w.textContent),
    hp: [...root.querySelectorAll('.dfparty-hp')].map((w) => w.textContent),
    hpShown: [...root.querySelectorAll('.dfparty-hp')].map((w) => getComputedStyle(w).display !== 'none'),
    whereShown: [...root.querySelectorAll('.dfparty-where')].map((w) => getComputedStyle(w).display !== 'none'),
    cardStyle: (() => { const c = getComputedStyle(root.querySelector('.dfparty-card')); return { border: c.borderTopWidth, bg: c.backgroundColor }; })(),
  };
});
console.log(JSON.stringify(state));
check('eight seats', state.PARTY_MAX === 8);
check('seven companions, seven cards', state.cards.length === 7);
check('the title counts the seats', state.title === 'Party8/8', state.title);
check('the stack is seven rows at 48px or under - under a third of a 1080p screen (SOC4\'s card was 100 tall, PARTY8\'s 55)', state.root.h <= 14 + 7 * 48, `${state.root.h}px`);
check('the stack is narrow', state.root.w <= 200, `${state.root.w}px`);
check('a row with me is 40px and a row somewhere else 48px or under', state.cards.every((c) => c.h <= 48) && state.cards[0].h <= 40, JSON.stringify(state.cards.map((c) => c.h)));
check('no box behind a row', state.cardStyle.border === '0px' && state.cardStyle.bg === 'rgba(0, 0, 0, 0)', JSON.stringify(state.cardStyle));
check('the digits are drawn only under half health (Bran 10, Cyl 18, Dar 26 of 60; not Eli 34, Fen 42; not the away seat; not the poseless one)', JSON.stringify(state.hpShown) === JSON.stringify([true, true, true, false, false, false, false]), JSON.stringify(state.hpShown));
check('the place line is drawn only for a seat not with me (Bran is in Daggerfall with me: gone; the dungeon, the shop, Wayrest and the wilderness: kept; the away seat says when)', JSON.stringify(state.whereShown) === JSON.stringify([false, true, true, true, true, true, false]), JSON.stringify(state.whereShown));
check('a long name ellipsizes and rides the node as a title', state.nameClipped && state.nameTitle === 'Cylandriel of the Long Name');
check('the away seat greys', state.away[5] === 'dfparty-card away');
check('the digits and the place are written as before', state.hp[0] === '10 / 60' && state.where[0] === 'Daggerfall' && state.where[1] === "Privateer's Hold - dungeon");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/party-hud-${VW}x${VH}.png` });
check('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
await server.close();
console.log(fails === 0 ? 'PARTY HUD PROBE: ALL GREEN' : `PARTY HUD PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
