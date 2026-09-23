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
// Self-hosting: starts its own vite on 5226. No ARENA2: the portraits are
// the plate (the face loader answers null), which is the layout's worst
// case for a face.
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
  const panel = createPartyPanel({ social, faceLoader: async () => null, touch: false });
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
  };
});
console.log(JSON.stringify(state));
check('eight seats', state.PARTY_MAX === 8);
check('seven companions, seven cards', state.cards.length === 7);
check('the title counts the seats', state.title === 'Party8/8', state.title);
check('the stack is seven cards at 60px or under - 39% of a 1080p screen, not a column down it (SOC4\'s card was 100 tall)', state.root.h <= 14 + 7 * 60, `${state.root.h}px`);
check('the stack is narrow', state.root.w <= 200, `${state.root.w}px`);
check('a card is compact', state.cards.every((c) => c.h <= 60), JSON.stringify(state.cards.map((c) => c.h)));
check('a long name ellipsizes and rides the node as a title', state.nameClipped && state.nameTitle === 'Cylandriel of the Long Name');
check('the away seat greys', state.away[5] === 'dfparty-card away');
check('the foot line says the health and the place', state.hp[0] === '10 / 60' && state.where[0] === 'Daggerfall' && state.where[1] === "Privateer's Hold - dungeon");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/party-hud-${VW}x${VH}.png` });
check('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
await server.close();
console.log(fails === 0 ? 'PARTY HUD PROBE: ALL GREEN' : `PARTY HUD PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
