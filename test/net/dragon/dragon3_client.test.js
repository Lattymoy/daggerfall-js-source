// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md sections 2, 6 and 9): THE CLIENT'S PURE HALVES - the link's fold of the cell's
// words (net/dragon/dragonLink.js), the site over the gate's scans (systems/dragon/dragonSite.js), the bar's model
// (ui/dragonBar.js), the draped grid (render/dragon/dragonTelegraph.js) and the sky's own law (scenes/dragonHost.js
// dragonSkyAt, skyWatchAt). tools/mutants/dragon3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDragonLink, foldDragon, DRAGON_STATE_EMPTY, sameDragonSite } from '../../../src/net/dragon/dragonLink.js';
import { dragonSiteOf, createDragonSites } from '../../../src/systems/dragon/dragonSite.js';
import { dragonBarModel, DRAGON_PHASE_AT, DRAGON_LEAVE_WARN_MS } from '../../../src/ui/dragonBar.js';
import { drapeGrid, drapeBounds, DRAPE_CELLS_MAX } from '../../../src/render/dragon/dragonTelegraph.js';
import { dragonSkyAt, skyWatchAt } from '../../../src/scenes/dragonHost.js';
import { DRAGON_NO_TEXT, DRAGON_WORDS } from '../../../src/systems/dragon/dragonWords.js';
import { COMPASS_WORDS } from '../../../src/systems/compassWords.js';
import * as tm from '../../../src/systems/textManager.js';
import { isDragonOmen, dragonTimes, pixelCentreNative, dragonCellOf, dragonSitePick, DRAGON_CELL_PX, DRAGON_CLIMB_MS, DRAGON_REMAINS_MS } from '../../../src/net/dragon/dragonLaw.js';
import { worldPixelKey, worldPixelOfKey } from '../../../src/world/worldWide/worldGrid.js';   // DRAGON-CELL: a square's ground is keyed so
import { roostLeg, dragonLegAt, orbitLeg, CLIMB_ALT } from '../../../src/net/dragon/dragonBody.js';
import { validDragonOut, DRAGON_NO_WORDS } from '../../../src/net/wire.js';
import { sitePixelOfNative } from '../../../src/systems/serpent/serpentSite.js';
import { TELEGRAPH_KIND } from '../../../src/render/gate/gateTelegraph.js';

/** DRAGON-HIDDEN: a watch's omen under the tests' seed (the relay's is its secret's - net/dragon/dragonSeed.js). */
const om = (w, s = 0x5eed1234) => ({ w, s });
let W = 500_000;
while (!isDragonOmen(om(W))) W++;
const TT = { ...dragonTimes(om(W)), s: om(W).s };
const SITE = { w: W, ...pixelCentreNative(205, 214) };
const word = (o) => validDragonOut({ t: 'dragon', w: W, sx: SITE.sx, sz: SITE.sz, ...o });
const ST = (o = {}) => word({ k: 'st', b: 0, ph: 1, h: 1000, m: 1000, md: 0, mu: 0, sh: 0, legs: [orbitLeg(TT.landAt, 0, 0, 55, 0, 1, 30)], blows: [], n: 1, lv: TT.leaveAt, op: 0, fell: null, gone: null, ...o });

test('DRAGON3 link: ONLY MY SITE\'S WORDS ARE FOLDED - a whole state taken, a blow taken once, its fall kept with its chart; another site\'s word, another watch\'s, or a word with no site this machine knows changes nothing (mutants: the site unread; a blow taken twice)', () => {
  let site = SITE;
  const L = createDragonLink({ now: () => TT.landAt + 1000, site: () => site });
  L.word(ST());
  assert.equal(L.state().w, W);
  assert.equal(L.state().hp, 1000);
  const atk = word({ k: 'atk', i: 3, a: 1, at: TT.landAt + 3000, wu: 2000, s: [['d', 1, 2, 4]] });
  L.word(atk); L.word(atk);
  assert.equal(L.state().blows.length, 1, 'once');
  L.word(validDragonOut({ t: 'dragon', ...ST({ h: 1 }), sx: SITE.sx + 40 }));
  assert.equal(L.state().hp, 1000, 'another site');
  L.word(validDragonOut({ t: 'dragon', ...ST({ h: 1 }), w: W + 3 }));
  assert.equal(L.state().hp, 1000, 'another watch');
  site = null;
  L.word(ST({ h: 2 }));
  assert.equal(L.state().hp, 1000, 'no site known');
  site = SITE;
  L.word(word({ k: 'fell', at: TT.landAt + 9000, top: ['Ama'], n: 2 }));
  L.word(word({ k: 'fell', at: TT.landAt + 9000, top: ['Ama'], n: 2, dm: [{ n: 'Ama', l: 20, d: 900, h: 9, b: 120 }] }));
  assert.deepEqual([L.state().hp, L.state().blows.length, L.state().fell.dm.length], [0, 0, 1], 'its fall, the chart kept when it comes');
  assert.ok(sameDragonSite(SITE, { sx: SITE.sx + 0.3, sz: SITE.sz }) && !sameDragonSite(SITE, { sx: SITE.sx + 2, sz: SITE.sz }));
});

test('DRAGON3 link: A REFUSAL IS SAID ONCE until the fight is left, every code has its words; a receipt is kept by its watch and heard once (mutants: a refusal said each time)', () => {
  const said = [], heard = [];
  const L = createDragonLink({ now: () => 0, site: () => SITE, say: (c) => said.push(c), onReceipt: (r) => heard.push(r) });
  L.word(validDragonOut({ t: 'dragon', k: 'no', m: 'far' })); L.word(validDragonOut({ t: 'dragon', k: 'no', m: 'far' }));
  assert.deepEqual(said, ['far']);
  L.leave();
  L.word(validDragonOut({ t: 'dragon', k: 'no', m: 'far' }));
  assert.deepEqual(said, ['far', 'far'], 'again once left');
  for (const c of DRAGON_NO_WORDS) assert.ok(DRAGON_NO_TEXT[c], `words for ${c}`);
  const body = Buffer.from(JSON.stringify({ q: W, b: 0, s: 'acct-0001', c: 7, x: 'dealt', l: 20, i: 1000, e: 2000 })).toString('base64url');
  const r = `z1.${body}.`;
  L.word(validDragonOut({ t: 'dragon', k: 'rcpt', r })); L.word(validDragonOut({ t: 'dragon', k: 'rcpt', r }));
  assert.deepEqual(heard, [r]);
  assert.equal(L.receipt(W), r);
});

test('DRAGON3 fold: the mode\'s turn is kept at its word\'s moment (`ma`), a whole state of the same mode keeps it; a word before any state is nothing', () => {
  assert.equal(foldDragon(DRAGON_STATE_EMPTY, word({ k: 'hp', h: 1, m: 2 }), 0), DRAGON_STATE_EMPTY);
  let s = foldDragon(DRAGON_STATE_EMPTY, ST(), 0);
  s = foldDragon(s, word({ k: 'md', m: 1, at: 5000, until: 17000 }), 10);
  assert.deepEqual([s.md, s.ma, s.mu], [1, 5000, 17000]);
  s = foldDragon(s, ST({ md: 1, mu: 17000 }), 20);
  assert.equal(s.ma, 5000);
});

test('DRAGON3 site (DRAGON-CELL - PIN MOVED: the gate\'s law on a lane, until the relay told the omen to the whole world): an omen\'s site is one of its cell\'s grounds by its own roll - the Bay\'s scan\'s pixels in the cell where it has any (AUDIT DRAGON-CELL D7), else the square\'s ground past the Bay (groundIn, asked for that cell alone) - at its pixel\'s centre; null while a scan is not whole, false where the cell has none; found once and kept; a scan not whole and a cell with none asked again after the retry (mutants: a pixel outside the cell taken; the pick the first; the square another\'s)', () => {
  const cellOf = (o) => dragonCellOf(o), corner = (o) => [cellOf(o).cx * DRAGON_CELL_PX, cellOf(o).cy * DRAGON_CELL_PX];
  const onBay = (o) => { const [x0, y0] = corner(o); return x0 >= 0 && y0 >= 0 && x0 + DRAGON_CELL_PX <= 1000 && y0 + DRAGON_CELL_PX <= 500; };
  const offBay = (o) => { const [x0, y0] = corner(o); return x0 + DRAGON_CELL_PX <= 0 || y0 + DRAGON_CELL_PX <= 0 || x0 >= 1000 || y0 >= 500; };
  const find = (pred) => { let w = W; while (!pred(om(w))) w++; return om(w); };
  // past the Bay: the square asked is the cell's; its ground's pixels sorted, one by the omen's roll
  const far = find((o) => offBay(o) && dragonSitePick(o) % 3 !== 0), [fx, fy] = corner(far);   // a pick that is not the first
  let asked = null;
  const keys = [[fx + 9, fy + 2], [fx + 1, fy + 7], [fx + 4, fy + 4]].map(([x, y]) => worldPixelKey(x, y));
  const square = { byArea: new Map([[70, Int32Array.from(keys.slice(0, 2))], [71, Int32Array.from(keys.slice(2))]]), towns: [{ name: 'Helbenar' }], townOf: new Map(keys.map((k) => [k, 0])) };
  const farSite = dragonSiteOf(far, { bayScan: () => { throw new Error('no Bay pixel in it'); }, theatres: () => ({ groundIn: (x0, y0, side) => { asked = [x0, y0, side]; return square; } }) });
  assert.deepEqual(asked, [fx, fy, DRAGON_CELL_PX]);
  const sorted = [...keys].sort((a, b) => a - b), pick = worldPixelOfKey(sorted[dragonSitePick(far) % 3]);
  assert.deepEqual([sitePixelOfNative(farSite.sx, farSite.sz), farSite.near], [pick, 'Helbenar']);
  // on the Bay: the Bay's scan's pixels in the cell alone, every region's list (AUDIT DRAGON-CELL D10: the Bay's scan holds no open zone)
  const bay = find(onBay), [bx, by] = corner(bay);
  const id = (x, y) => y * 1000 + x;
  const scan = { byRegion: new Map([[3, [id(bx + 2, by + 3), id(bx + 20, by + 3)]]]), towns: [{ name: 'Daggerfall' }], townAt: { [id(bx + 2, by + 3)]: 0 } };
  const bs = dragonSiteOf(bay, { bayScan: () => scan, theatres: () => { throw new Error('no square past the Bay in it'); } });
  assert.deepEqual([sitePixelOfNative(bs.sx, bs.sz), bs.near], [[bx + 2, by + 3], 'Daggerfall'], 'its one ground in the cell');
  // AUDIT DRAGON-CELL D7: a cell across the Bay's edge takes the Bay's ground alone where it has any - every screen holds the
  // Bay's scan, whatever its land past the Bay - and the square's only where it has none
  const edge = { w: W, s: 0 };
  while (!(corner(edge)[0] === 992 && corner(edge)[1] >= 0 && corner(edge)[1] < 480)) edge.s++;
  const [ex, ey] = corner(edge);
  let squares = 0;
  const past = { groundIn: () => { squares++; return square; } };
  const es = dragonSiteOf(edge, { bayScan: () => ({ byRegion: new Map([[5, [id(ex + 3, ey + 4)]]]), towns: [], townAt: {} }), theatres: () => past });
  assert.deepEqual([sitePixelOfNative(es.sx, es.sz), squares], [[ex + 3, ey + 4], 0], 'the Bay\'s, the square unasked');
  assert.ok(dragonSiteOf(edge, { bayScan: () => ({ byRegion: new Map(), towns: [], townAt: {} }), theatres: () => past }));
  assert.equal(squares, 1, 'no Bay ground in it: the square asked');
  assert.equal(dragonSiteOf(bay, { bayScan: () => null, theatres: () => null }), null, 'no scan yet');
  assert.equal(dragonSiteOf(bay, { bayScan: () => ({ byRegion: new Map(), towns: [], townAt: [] }), theatres: () => null }), false, 'no ground: no dragon');
  let t = 0, calls = 0;
  const S = createDragonSites({ bayScan: () => null, theatres: () => ({ groundIn: () => { calls++; return square; } }) }, { now: () => t, retryMs: 1000 });
  assert.ok(S.of(far)); assert.ok(S.of(far));
  assert.equal(calls, 1, 'found once');
  const empty = { byArea: new Map(), towns: [], townOf: new Map() };
  const E = createDragonSites({ bayScan: () => null, theatres: () => ({ groundIn: () => { calls++; return empty; } }) }, { now: () => t, retryMs: 1000 });
  calls = 0; assert.equal(E.of(far), null); E.of(far); t = 5000; E.of(far);
  assert.equal(calls, 2, 'a cell with no ground asked again after its retry - the land past the Bay may stand later (AUDIT DRAGON-CELL D8)');
  const N = createDragonSites({ bayScan: () => null, theatres: () => ({ groundIn: () => { calls++; return null; } }) }, { now: () => t, retryMs: 1000 });
  calls = 0; N.of(far); N.of(far); t += 1001; N.of(far);
  assert.equal(calls, 2, 'asked again after its retry');
});
test('DRAGON3 bar: brass, its phase marks at 66% and 33%, ALOFT or GROUNDED with its seconds, the blow named in its element\'s colour with MOVE when it holds my feet, the climb away counted in its last five minutes (mutants: MOVE never; the climb always)', () => {
  const b = { b: 0, name: 'The Dwarven Dragon', title: 'Rourken Outrider', hp: 500, max: 1000, phase: 2, fighters: 3, warded: false, grounded: true, groundLeft: 7200,
    atk: { key: 'breath', name: 'Scalding Breath', el: 'fire', t: 0.5, aimed: true }, fell: null, gone: null, leaveIn: DRAGON_LEAVE_WARN_MS + 1, now: 0 };
  const m = dragonBarModel(b);
  assert.deepEqual([m.theme, m.frac, m.marks, m.spent], ['brass', 0.5, [...DRAGON_PHASE_AT], [true, false]]);
  assert.equal(m.host, 'Grounded 8s');
  assert.deepEqual([m.callout.text, m.callout.color, m.callout.move], ['Scalding Breath', '#ff8a4c', true]);
  assert.equal(m.wrath, null);
  const late = dragonBarModel({ ...b, grounded: false, leaveIn: 61_000, atk: { ...b.atk, aimed: false } });
  assert.deepEqual([late.host, late.wrath, late.wrathNear, late.callout.move], ['Aloft', 'It climbs away in 1:01', false, false]);
  assert.equal(dragonBarModel(null), null);
});

test('DRAGON3 drape: the grid lies on the land - every vertex\'s height the ground\'s under it, a hole in the land the fallback\'s and said `missing`; its cells bounded; a ring\'s ground its outer circle (mutants: the ground unread)', () => {
  const ground = (x, z) => (x > 5 ? NaN : x * 0.5 + z * 0.25);
  const g = drapeGrid([-4, -4, 8, 4], ground, -7);
  assert.equal(g.n % 6, 0);
  let holes = 0;
  for (let k = 0; k < g.n; k++) {
    const x = g.buf[k * 3], y = g.buf[k * 3 + 1], z = g.buf[k * 3 + 2];
    if (x > 5) { assert.equal(y, -7); holes++; } else assert.ok(Math.abs(y - (x * 0.5 + z * 0.25)) < 1e-4, `on the land at ${x},${z}`);
  }
  assert.ok(holes > 0 && g.missing);
  assert.equal(drapeGrid([0, 0, 10, 10], () => 1, 0).missing, false);
  const big = drapeGrid([0, 0, 1000, 1000], () => 0, 0);
  assert.equal(big.n, DRAPE_CELLS_MAX * DRAPE_CELLS_MAX * 6);
  assert.deepEqual(drapeBounds({ kind: TELEGRAPH_KIND.ring, origin: [10, 20], r0: 6, r1: 32 }).map((v) => Math.round(v)), [-26, -16, 46, 56]);
});

test('DRAGON3 sky: with no fight heard it roosts on its own clock, then climbs away from its leaving; a dragon slain late in its watch is still about while its remains may lie (mutants: the climb from nowhere; the remains forgotten at the watch\'s turn)', () => {
  const at = TT.landAt + 123_456;
  assert.deepEqual(dragonSkyAt(TT, at), dragonLegAt(roostLeg(om(W)), at));
  const up = dragonSkyAt(TT, TT.leaveAt + DRAGON_CLIMB_MS), from = dragonLegAt(roostLeg(om(W)), TT.leaveAt), leaving = dragonSkyAt(TT, TT.leaveAt);
  assert.ok(Math.abs(up.a - CLIMB_ALT) < 1e-6, 'it climbs out of sight');
  assert.ok(Math.hypot(leaving.x - from.x, leaving.z - from.z) < 0.05 && Math.abs(leaving.a - from.a) < 0.05, 'from where it roosted, no jump');
  const told = (w) => (w === W ? TT.s : undefined);   // DRAGON-HIDDEN: the omen its cell told, and no other
  assert.equal(skyWatchAt(TT.landAt - 1, told), null, 'before it lands: nothing in the sky');
  assert.equal(skyWatchAt(TT.landAt, told).w, W);
  assert.equal(skyWatchAt(TT.leaveAt + 60_000, told).w, W, 'past its climb, its remains may still lie');
  assert.equal(skyWatchAt(TT.leaveAt + 6 * 60_000, told).w, W, 'past its watch\'s turn too, while they may lie');
  assert.equal(skyWatchAt(TT.leaveAt + DRAGON_REMAINS_MS + 1, told), null);
  assert.equal(skyWatchAt(TT.landAt, () => undefined), null, 'no omen told, no dragon drawn - the source rolls none');
});

test('DRAGON3 the sighting\'s way: every compass way a whole phrase of its own, so a language never reads an English word inside its sentence (mutants: the way left English)', () => {
  for (const w of COMPASS_WORDS) assert.equal(DRAGON_WORDS.circles(w, 0), `A dragon circles in the sky to the ${w}.`, w);
  assert.equal(DRAGON_WORDS.circles('east', 1), 'A blue dragon circles in the sky to the east.');
  tm.patchLocaleTable('fr', 'Port_Strings', tm.loadStringTableCsv(readFileSync(new URL('../../../locales/fr/Port_Strings.csv', import.meta.url), 'utf8')));
  tm.setLocale('fr');
  try { assert.equal(DRAGON_WORDS.circles('north', 0), tm.t('dragon.circles', '', { way: tm.t('dragon.way.north', '') })); assert.doesNotMatch(DRAGON_WORDS.circles('north', 0), /north/); } finally { tm.setLocale('en'); }
});
