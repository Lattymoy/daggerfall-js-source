// DLV3 (bible/03-World/Delve-II.md section 7): THE ENCOUNTERS ONLINE, THE PAGE'S HALF - the host says its plan until
// the room answers, its word every second near a site and at once when it moves, its acts and blows to the room; reads
// the room's state as a ledger (delveOnline.js delveView); stands the foes only on the machine the room names, takes up
// the rest of a running wave when named mid-attempt and lets its own go when it is not; asks the room for its share of
// a won vault. At a relay that keeps no encounter it stands nothing. Held to fail under tools/mutants/dlv3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dungeonOf, seedFor, run } from './delveRig.mjs';
import { _setDelveWireForTests, wireDelve, sendDelveWord, delveWireReady, attachDelveHearer } from '../../../src/net/delve/delveLink.js';
import { delveView, delvePlanWire, phaseMs, VIEW_ME, VIEW_PEER } from '../../../src/scenes/delve/delveOnline.js';
import { DP, FLAME, WEIGHT, HOLD_WAVE_MAX_MS, delvePlanHash, SPRING_MAX_MS, litanyShowMs, sealWindowMs, weighPlates, plateAt, LITANY_STAND_M } from '../../../src/net/delve/delveLaw.js';
import { pieceCrystals, siteFlames, weightPlaces } from '../../../src/scenes/delve/delveProps.js';
import { plateLooks, PLATE_LOOK } from '../../../src/scenes/delve/delveLitany.js';
import { midScreenText, setMidScreenText } from '../../../src/ui/midScreenText.js';
import { breakTargets, createStandIns, delveCrystalC } from '../../../src/scenes/delve/delveBodies.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { DELVE_ACTS, DELVE_NO, validDelveIn, validDelveOut } from '../../../src/net/wire.js';
import { grantKindOf } from '../../../src/net/grantLaw.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
/** A room the pin speaks for: what the page said (each word the wire's own law admits). */
function wire() {
  const sent = [];
  _setDelveWireForTests({ send: (w) => { if (!validDelveIn(w)) return false; sent.push(w); return true; }, ready: () => true });
  return { sent, said: (k) => sent.filter((w) => w.k === k) };
}
/** The room's word of a site: a state (`o` over the defaults) with my part. */
const dl = (i, o = {}, me = {}) => ({ k: 'dl', i, kd: 1, p: DP.idle, w: 0, wz: 0, kn: 0, wl: -1, nd: 0, fo: 0, nx: 0, rs: 0, ...o, me: { fm: 0, hd: -2, ea: 0, pa: 0, ...me } });
/** A dungeon's room online: the host built in it, the room's words heard through the link's own door - each under the
 *  host's plan and through the wire's own law first, as net/online.js hears them (TEST THE SHAPE THE PRODUCER MINTS: a
 *  word the wire would drop fails the pin, AUDIT DLV3 1). */
function online(kind, dungeonType) {
  _resetForTests();
  const door = wireDelve({});   // the hearing door the world wires; the wire itself the pin's
  const W = wire();
  const D = dungeonOf(seedFor(kind), dungeonType, { online: () => true });
  const h = delvePlanHash(D.host.sites);
  const hear = (m) => { const p = validDelveOut({ t: 'dv', ph: h, ...m }); assert.ok(p, `the wire drops ${JSON.stringify(m)}`); door(p); };
  return { D, W, hear, s: D.host.sites[0], h, door };
}

test('DLV3 THE VIEW: the room\'s state read as a ledger - each phase starting at 0 on its clock, `ec` how far into it the room is; my piece the view\'s own, another\'s a peer\'s; a site at rest no view (mutants: the clock from the phase\'s start; the carrier mine for any)', () => {
  const site = { i: 0, kind: 'wellsprings', x: 10, y: 0, z: 20, r: 4, tier: 'regular', vault: [13, 0, 20] };
  assert.equal(delveView(site, dl(0, { p: DP.idle })), null);
  const v = delveView(site, dl(0, { p: DP.spring, kd: 3, n: 3, h: [40, 0, 12], hx: 40, wl: SPRING_MAX_MS - 25_000 }));
  assert.equal(v.ec - v.ss, 25_000, 'twenty-five seconds into the pouring');
  assert.deepEqual([v.k, v.hp, v.hx], [3, [40, 0, 12], 40]);
  const lit = delveView({ ...site, kind: 'litany', tier: 'elite' }, dl(0, { p: DP.show, kd: 2, wl: 2_000, or: [3, 1, 0, 4, 2] }));
  assert.deepEqual([lit.k, lit.ec - lit.sh, lit.order], [5, litanyShowMs(5) - 2_000, [3, 1, 0, 4, 2]], 'an Elite Litany\'s five, the order while shown');
  const b = { ...site, kind: 'brazier' };
  assert.equal(delveView(b, dl(0, { p: DP.work, kd: 5, n: 3, lb: 1, fl: FLAME.carried, fx: [] }, { hd: -1 })).fc, VIEW_ME);
  assert.equal(delveView(b, dl(0, { p: DP.work, kd: 5, n: 3, lb: 1, fl: FLAME.carried, fx: [] }, { hd: -2 })).fc, VIEW_PEER);
  const g = { ...site, kind: 'weighing' };
  const vw = delveView(g, dl(0, { p: DP.work, kd: 6, wt: [[WEIGHT.carried, -1, 1, 2], [WEIGHT.plate, 0, 13, 20], [WEIGHT.home, -1, 0, 0]], hd: -1 }, { hd: 0 }));
  assert.deepEqual(vw.wt.map((t) => [t.s, t.by]), [[WEIGHT.carried, VIEW_ME], [WEIGHT.plate, ''], [WEIGHT.home, '']]);
  assert.equal(phaseMs('hold', { p: DP.wave }, 0), HOLD_WAVE_MAX_MS);
});

test('DLV3 THE LOOKS READ THE VIEW AS THE LEDGER (AUDIT DLV4 F5): the bodies a blow meets, the crystals, the flames and the weights - the same from the room\'s state as from the law\'s own ledger (mutants: the view\'s pieces unnamed)', () => {
  const site = { i: 0, kind: 'seals', x: 10, y: 0, z: 20, r: 4, tier: 'regular', vault: [10, 0, 20] };
  const v = delveView(site, dl(0, { p: DP.work, kd: 7, n: 3, h: [9, 0, 4], hx: 9, wl: 5_000 }));
  assert.equal(v.ec - v.ws, sealWindowMs(3) - 5_000, 'five seconds left of the law\'s own window');
  const stand = createStandIns();
  assert.deepEqual(breakTargets(site, v, stand).map((q) => q.c), [delveCrystalC(0, 0), delveCrystalC(0, 2)], 'the seals still standing meet a blow');
  assert.equal(pieceCrystals(site, v, { look: 'tomb', seed: 1, s: 0, broke: [], rose: 0, won: false }, []).length >= 2, true);
  const b = { ...site, kind: 'brazier' };
  assert.equal(siteFlames(b, delveView(b, dl(0, { p: DP.work, kd: 5, n: 4, lb: 0b0011, fl: FLAME.heart, fx: [] })), false).length, 1 + 2, 'the heart\'s and two lit braziers');
  const g = { ...site, kind: 'weighing' };
  const places = weightPlaces(g, delveView(g, dl(0, { p: DP.work, kd: 6, wt: [[WEIGHT.floor, -1, 9, 19], [WEIGHT.carried, -1, 0, 0], [WEIGHT.home, -1, 0, 0]] })));
  assert.deepEqual(places[0], [9, 0, 19]); assert.equal(places[1], null);
});

test('DLV3 THE WRONG PLATE ON MY CLOCK (AUDIT DLV3 8): its mark stamped on the host\'s own clock and read on it - a room\'s state re-anchors the view\'s, so the mark lasts its 0.7 s whatever the room says; never before its own moment (mutants: the mark on the view\'s clock; no lower bound)', () => {
  const led = { p: DP.show, ec: 0, sh: 0, order: [2, 0, 3, 1], next: 0 };
  const wrong = { j: 1, at: 50_000 };
  assert.deepEqual(plateLooks(led, 4, wrong, [], 49_000), plateLooks(led, 4), 'before its moment: the looks without it');
  assert.equal(plateLooks(led, 4, wrong, [], 50_300)[1], PLATE_LOOK.wrong);
  assert.notEqual(plateLooks(led, 4, wrong, [], 50_700)[1], PLATE_LOOK.wrong, 'gone at 0.7 s');
  const host = rd('src/scenes/delve/delveHost.js');
  assert.match(host, /case 'wrong':\n\s*r\.wrong = \{ j: ev\.j, at: now \};/);
  assert.match(host, /plateLooks\(r\.led, r\.plates\.length, r\.wrong, r\.looks, now\)/);
});

test('DLV3 THE PLAN SAID UNTIL THE ROOM ANSWERS: once at the first frame, again every 3 s unanswered, again when the room asks; its hash the plan\'s own; the chests stood once the room keeps it (mutants: the plan said once; the room\'s ask unread; an Elite plan said regular)', async () => {
  const { D, W, hear, s } = online('hold');
  await run(D, 100, [s.x + 30, s.y, s.z]);
  assert.equal(W.said('pl').length, 1);
  assert.equal(W.said('pl')[0].h, delvePlanHash(D.host.sites));
  assert.deepEqual(W.said('pl')[0], delvePlanWire(D.host.sites, delvePlanHash(D.host.sites), 'regular'));
  assert.equal(delvePlanWire(D.host.sites, 1, 'elite').e, 1, 'an Elite dungeon\'s plan says so');
  assert.equal(D.api.dynamicDraws.length, 0, 'no chest before the room keeps the plan');
  await run(D, 2_500, [s.x + 30, s.y, s.z]);
  assert.equal(W.said('pl').length, 1, 'not before three seconds');
  await run(D, 600, [s.x + 30, s.y, s.z]);
  assert.equal(W.said('pl').length, 2, 'unanswered: said again at three seconds');
  hear(dl(0));
  await run(D, 3_100, [s.x + 30, s.y, s.z]);
  assert.equal(W.said('pl').length, 2, 'answered: said no more');
  hear({ k: 'pl?' });
  await run(D, 100, [s.x + 30, s.y, s.z]);
  assert.equal(W.said('pl').length, 3, 'asked: said again');
  D.host.destroy();
});

test('DLV3 THE WORD: every second near a site and at once when it moves, with my screen\'s ward; with no foes\' machine heard it offers mine, with another\'s it does not; nothing from far away (mutants: the word every frame; the offer over another\'s machine; the screen\'s ward unsaid or always said)', async () => {
  const { D, W, hear, s } = online('hold');
  await run(D, 100, [s.x + 40, s.y, s.z]);
  hear(dl(0));
  await run(D, 2_000, [s.x + 40, s.y, s.z]);
  assert.equal(W.said('w').length, 0, 'far away: no word');
  await run(D, 3_000, [s.x, s.y, s.z]);
  const words = W.said('w');
  assert.ok(words.length >= 3 && words.length <= 5, `a second apart, near (${words.length})`);
  assert.equal(words.at(-1).iw, 1); assert.equal(words.at(-1).o, 1, 'no machine heard: mine offered');
  await run(D, 1_100, [s.x + s.r + 3, s.y, s.z]);
  assert.deepEqual([W.said('w').at(-1).iw, W.said('w').at(-1).o], [0, 0], 'near, out of the ward: my screen says so, and offers nothing');
  await run(D, 1_100, [s.x, s.y, s.z]);
  hear(dl(0, { p: DP.gather, wl: 2_000, fo: 1 }, { fm: 0, pa: 1 }));
  const n = W.said('w').length;
  await run(D, 300, [s.x, s.y, s.z]);
  assert.equal(W.said('w').at(-1).o, 0, 'another\'s machine stands them: none offered');
  assert.ok(W.said('w').length > n, 'the change said at once');
  D.host.destroy();
});

test('DLV3 TOLD APART: at a site another party holds, told once and my words there held back until its state moves; my own attempt at another site said at most twice a minute, my words going on (AUDIT DLV3 6, P3 - mutants: the hold-back unread; the line every word; the refusal\'s site dropped by the wire)', async () => {
  const { D, W, hear, s } = online('hold');
  const text = () => midScreenText.text;
  await run(D, 100, [s.x, s.y, s.z]);
  hear(dl(0, { p: DP.gather, wl: 2_000, fo: 1 }, { pa: 0 }));
  await run(D, 1_100, [s.x, s.y, s.z]);
  const n = W.said('w').length;
  hear({ k: 'no', m: DELVE_NO.party, i: 0 });
  assert.equal(text(), 'Another party holds this encounter.');
  await run(D, 3_000, [s.x, s.y, s.z]);
  assert.equal(W.said('w').length, n, 'my words there held back');
  hear(dl(0, { p: DP.wave, w: 1, wz: 3, wl: HOLD_WAVE_MAX_MS, fo: 1 }, { pa: 0 }));
  await run(D, 1_100, [s.x, s.y, s.z]);
  assert.ok(W.said('w').length > n, 'its state moved: my word again');
  setMidScreenText('');
  hear({ k: 'no', m: DELVE_NO.held, i: 0 });
  assert.equal(text(), 'You hold another encounter here. Finish it or leave it first.');
  setMidScreenText('');
  hear({ k: 'no', m: DELVE_NO.held, i: 0 });
  assert.equal(text(), '', 'said once in thirty seconds');
  const m = W.said('w').length;
  await run(D, 1_100, [s.x, s.y, s.z]);
  assert.ok(W.said('w').length > m, 'and my word goes on: the other may end any time');
  D.host.destroy();
});

test('DLV3 THE FOES\' MACHINE: a wave stands only on the machine the room names; named mid-wave it stands the rest the room has not counted downed and counts on from the room\'s; named no more, it lets its own go; named with none left, it says the wave clear (mutants: the foes stood on every machine; the rest of the wave unstood; the count from nothing; its own kept; a wave with no rest never cleared)', async () => {
  const { D, W, hear, s } = online('hold');
  await run(D, 100, [s.x, s.y, s.z]);
  hear(dl(0, { p: DP.gather, wl: 1_000 }, { fm: 0, pa: 1 }));
  hear({ k: 'ev', i: 0, ev: [{ k: 'wave', w: 1, wz: 5 }] });
  hear(dl(0, { p: DP.wave, w: 1, wz: 5, wl: HOLD_WAVE_MAX_MS }, { fm: 0, pa: 1 }));
  await run(D, 300, [s.x, s.y, s.z]);
  assert.equal(D.stood.length, 0, 'not my machine: nothing stood');
  hear(dl(0, { p: DP.wave, w: 1, wz: 5, kn: 2, wl: HOLD_WAVE_MAX_MS - 10_000, fo: 1 }, { fm: 1, pa: 1 }));
  await run(D, 300, [s.x, s.y, s.z]);
  assert.equal(D.stood.length, 5 - 2, 'named mid-wave: the three the room has not counted');
  assert.ok(D.stood.every((f) => f.opts?.delve === true), 'each asks the encounter\'s own grant kind');
  D.stood[0].dead = true; D.stood[0].entity.health = 0;
  await run(D, 1_100, [s.x, s.y, s.z]);
  assert.equal(W.said('w').at(-1).kn, 3, 'my count on from the room\'s two (AUDIT DLV3 P2)');
  hear(dl(0, { p: DP.wave, w: 1, wz: 5, kn: 2, wl: HOLD_WAVE_MAX_MS - 11_000, fo: 1 }, { fm: 0, pa: 1 }));
  await run(D, 200, [s.x, s.y, s.z]);
  assert.equal(D.removed.length, 2, 'named no more: my living two crumble');
  hear(dl(0, { p: DP.wave, w: 1, wz: 5, kn: 5, wl: HOLD_WAVE_MAX_MS - 12_000, fo: 1 }, { fm: 1, pa: 1 }));
  await run(D, 1_100, [s.x, s.y, s.z]);
  assert.equal(D.stood.length, 3, 'named with every foe of the wave counted: none to stand');
  assert.deepEqual([W.said('w').at(-1).wc, W.said('w').at(-1).kn], [1, 5], 'and the wave said clear - the machine before me left before it did');
  D.host.destroy();
});

test('DLV3 ACTS AND BLOWS GO TO THE ROOM: a blow said with its piece and kind, never folded here; an act said once, again only after 600 ms with the state unmoved (mutants: a blow folded at home; the act every frame; the view\'s clock stopped)', async () => {
  const { D, W, hear, s } = online('wellsprings');
  await run(D, 100, [s.x, s.y, s.z]);
  hear(dl(0, { p: DP.spring, kd: 3, n: 2, h: [40, 40], hx: 40, wl: SPRING_MAX_MS }, { fm: 0, pa: 1 }));
  await run(D, 100, [s.x, s.y, s.z]);
  assert.equal(D.host.hit(delveCrystalC(0, 1), 7, HIT_KINDS.Melee), true, 'it went');
  assert.deepEqual(W.said('x').at(-1), { k: 'x', h: delvePlanHash(D.host.sites), i: 0, j: 1, d: 7, r: HIT_KINDS.Melee, q: W.said('x').at(-1).q });
  assert.deepEqual(D.host.state()[0].hp, [40, 40], 'the room decides what lands');
  const ec = D.host.ledger(0).ec;
  await run(D, 1_000, [s.x, s.y, s.z]);
  assert.ok(D.host.ledger(0).ec - ec >= 900, 'the view\'s clock runs on between the room\'s states');
  const B = online('brazier');
  await run(B.D, 100, [B.s.x + 1, B.s.y, B.s.z]);
  B.hear(dl(0, { p: DP.work, kd: 5, n: 3, lb: 0, fl: FLAME.heart, fx: [] }, { pa: 1 }));
  await run(B.D, 300, [B.s.x, B.s.y, B.s.z]);
  assert.equal(B.W.said('a').length, 1, 'the flame taken: said once');
  assert.equal(B.W.said('a')[0].a, DELVE_ACTS.indexOf('take'));
  await run(B.D, 700, [B.s.x, B.s.y, B.s.z]);
  assert.equal(B.W.said('a').length, 2, 'unmoved after 600 ms: said again');
  D.host.destroy(); B.D.host.destroy();
});

test('DLV3 THE VAULT ONLINE: won, my share asked of the room on a press - an earner\'s alone, rolled when it answers yes; another\'s says whose it is; another plan in the room stands all down (mutants: a share rolled unasked or at the win; the answer unread; a refused plan ignored; a won site saved or restored online)', async () => {
  const { D, W, hear, door, s } = online('hold');
  await run(D, 100, [s.x, s.y, s.z]);
  door(validDelveOut({ t: 'dv', ...dl(0, { p: DP.won }, { ea: 1 }), ph: 12345 }));
  assert.equal(D.host.contents('delve:vault:0'), null, 'another plan\'s state: nothing of it is mine');
  hear({ k: 'ev', i: 0, ev: [{ k: 'won' }] });
  hear(dl(0, { p: DP.won }, { ea: 0 }));
  assert.deepEqual(D.host.contents('delve:vault:0'), [], 'won online: nothing rolled at the win');
  D.host.press('delve:vault:0');
  assert.equal(W.said('v').length, 0);
  assert.equal(D.hud.at(-1), 'Only those who won this vault may open it.');
  hear(dl(0, { p: DP.won }, { ea: 1 }));
  assert.equal(D.host.contents('delve:vault:0').length, 0, 'nothing rolled before the room says');
  D.host.press('delve:vault:0');
  assert.deepEqual(W.said('v').at(-1), { k: 'v', h: delvePlanHash(D.host.sites), i: 0 });
  D.hud.length = 0;
  hear({ k: 'v', i: 0, ok: 0 });
  assert.deepEqual([D.host.contents('delve:vault:0').length, D.hud.at(-1)], [0, 'Only those who won this vault may open it.'], 'refused: nothing rolled');
  hear({ k: 'v', i: 0, ok: 1 });
  assert.ok(D.host.contents('delve:vault:0').length > 0, 'my share, rolled on my machine');
  assert.deepEqual(D.host.snapshot().won, [], 'online the room keeps the won sites, never my save');
  const W0 = W.said('pl').length;
  hear({ k: 'no', m: DELVE_NO.plan });
  await run(D, 200, [s.x, s.y, s.z]);
  assert.deepEqual(D.host.breakables(), []);
  assert.equal(D.host.contents('delve:vault:0'), null, 'no room for my plan: stood down');
  await run(D, 3_100, [s.x, s.y, s.z]);
  assert.equal(W.said('pl').length, W0 + 1, 'and my plan said again - never for good (AUDIT DLV3 2)');
  hear(dl(0, { p: DP.won }, { ea: 0 }));
  await run(D, 100, [s.x, s.y, s.z]);
  assert.notEqual(D.host.contents('delve:vault:0'), null, 'kept at last: the site stands again');
  D.host.destroy();
  const F = online('hold');
  F.D.host.restore({ h: delvePlanHash(F.D.host.sites), won: [{ i: 0, items: [] }] });
  assert.equal(F.D.host.contents('delve:vault:0'), null, 'a save\'s won site is not restored online');
  F.D.host.destroy();
});

test('DLV3 AT A RELAY THAT KEEPS NONE, NOTHING STANDS: no plan said, no word, no chest - the room\'s relay older than DELVE_RELAY_MIN (mutants: the wire unread)', async () => {
  const { D, s } = online('hold');
  const sent = [];
  _setDelveWireForTests({ send: (w) => { sent.push(w); return true; }, ready: () => false });
  await run(D, 1_000, [s.x, s.y, s.z]);
  assert.equal(sent.length, 0);
  assert.equal(D.api.dynamicDraws.length, 0);
  D.host.destroy();
});

test('WEIGH-POSE: online a weight is set on a plate only once the pose the room hears stands on it - last frame\'s feet, the world saying my pose before the dungeon moves me; said on the frame I reach it, the room set it on the floor beside the plate (mutants: the act judged at this frame\'s feet)', async () => {
  const { D, W, hear, s } = online('weighing');
  const p = weighPlates(s)[0], off = [p[0] + (LITANY_STAND_M + 0.3) * Math.sign(s.x - p[0] || 1), p[1], p[2]];
  await run(D, 100, [s.x, s.y, s.z]);
  hear(dl(0, { p: DP.work, kd: 6, wt: [[WEIGHT.carried, -1, 0, 0], [WEIGHT.home, -1, 0, 0], [WEIGHT.home, -1, 0, 0]], hd: -1 }, { hd: 0, pa: 1 }));
  await run(D, 100, off);
  assert.equal(plateAt([p], off[0], off[1], off[2]), -1, 'a step short of the plate');
  await run(D, 100, p);
  assert.equal(W.said('a').length, 0, 'the frame I reach it: the room still hears me a step short - nothing said');
  await run(D, 100, p);
  assert.deepEqual(W.said('a').map((w) => [w.a, w.j]), [[DELVE_ACTS.indexOf('set'), 0]], 'the next: set, where the room hears me on it');
  D.host.destroy();
});

test('DLV3 THE WIRING (HOST-SPLIT): the world wires the session to the link in one line; the session makes its pose current before a word; the context\'s loose stand asks the encounter\'s own grant kind (mutants: the wire unset; the session\'s doors crossed; an old host\'s detaching the new one)', () => {
  assert.match(rd('src/scenes/world.js'), /\n {4}online\.onDelve = wireDelve\(online\);/);
  const on = rd('src/net/online.js');
  assert.match(on, /this\._poseCurrent\(\);   \/\/ the room reads the ward off the pose it last heard\n {4}try \{ this\._ws\.send\(JSON\.stringify\(\{ t: 'dv', \.\.\.w \}\)\); \}/);
  assert.match(rd('src/scenes/delve/delveHost.js'), /spawn: \(type, at, opts\) => api\.spawnLooseFoe\(type, at, linked\(\) \? \{ \.\.\.opts, delve: true \} : opts\),/);
  assert.equal(grantKindOf({ delve: true, loose: true }), 'delve');
  assert.match(rd('src/scenes/dungeonContext.js'), /const h = f\.entity\?\.revenant\?\.id \|\| f\._delve \? null : \(heirOf\(f\) \?\? null\);/, 'an encounter\'s foe is never handed on at a door (AUDIT DLV3 P2)');
  assert.equal(grantKindOf({ loose: true }), 'loose', 'a loose stand of any other');
  // the link: the session's doors, and the host that hears
  const said = [];
  const hear = wireDelve({ sendDelve: (w) => { said.push(w); return true; }, delveReady: () => false });
  assert.deepEqual([sendDelveWord({ k: 'v' }), said.length, delveWireReady()], [true, 1, false], 'the session\'s own send and readiness');
  const heard = [], first = attachDelveHearer((w) => heard.push(['first', w.k])), second = attachDelveHearer((w) => heard.push(['second', w.k]));
  first();   // an old host's detaching leaves the new one
  hear({ k: 'pl?' });
  second();
  hear({ k: 'pl?' });
  assert.deepEqual(heard, [['second', 'pl?']]);
});
