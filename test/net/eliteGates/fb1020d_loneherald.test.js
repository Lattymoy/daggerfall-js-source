// FIELD BUGS 2026-10-20d LONE-HERALD (bible/01-Overview/bugs/Field-Bugs-2026-10-20d.md; bible/11-Multiplayer/Elite-Gates.md
// section 20, "The herald"): A COMPANY OF ONE IS POSTED AS ONE. A player says they took Redoubt 20 alone and that the Spire
// counted it a company; the channel said "<name>'s company took Redoubt 20" - the words it gives a company of eight, because a
// Redoubt's news carried no size. The news now carries the company's entrants (`n`, the Descent's count) and the name its post
// leads with (an entrant's: the opener's where the opener entered), the hub's read keeps the size, its reckoning hands it to the
// post, and the tenth Redoubt's post, First of the Spire and a seal's post say a company of one alone. Driven from a breach played
// to its Court (net/eliteGates/egBrain.js), through the hub's read and reckoning (net/eliteGates/egHerald.js), to the words.
// AUDIT FB1020d (bible/01-Overview/audits/Audit-Field-Bugs-2026-10-20d.md): a company that went without its opener led by an
// entrant (L1-1); a member gone home or forsaken still counted (L2-2); the tracker counting the entrants once the door is shut
// (L1-3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egBreachNew, egEnter, egStep, egFall, egForsake, egHome, egStateOf, EG_RD_WINDOW_MS } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS, EG_ARRIVE_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egRedoubtPost, egFirstPost, egSealPost, egHeraldPost, egHeraldFold, readEgHeraldState, validEgHeraldTell } from '../../../src/net/eliteGates/egHerald.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egHudModel } from '../../../src/ui/eliteGates/egHud.js';
import { validEgOut } from '../../../src/net/wire.js';
import { egGive8 } from '../../egGive8.mjs';

const T0 = 1_800_000_000_000;
const MIN = 60_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };

/** A breach of `n` on seed 12345 opened by `acct-0` ("M0"), the members `enter` admitted. `court(h, before)` stands the company
 *  on Court hall `h`'s arrival plate a beat after its pull (the count from the breach's first wake), runs `before` once its
 *  trial woke, and fells its lord 20 minutes on (the fight's own flag, as AUDIT EG V's pins fell it): that Redoubt. */
function breachOf({ n, enter = Array.from({ length: n }, (_, i) => `acct-${i}`) }) {
  const seed = 12345;
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const sub of enter) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  const pos = {};
  const court = (h, before = () => {}) => {
    egGive8(seed, [egCircleOfHall(h)]);
    const spec = egHallOf(seed, h, 0);
    B.h = h; B.sg = 'arrive'; B.pulledAt = now; B.su = now + EG_ARRIVE_MAX_MS;
    if (!B.wk) { B.wk = now; B.cnt = { left: 30 * MIN, at: 0 }; }
    for (const sub of enter) if (B.mem[sub].alive && !B.mem[sub].home) pos[sub] = { x: spec.arrive.x + Number(sub.slice(5)) * 0.5, z: spec.arrive.z };
    const step = () => { now += 250; egStep(B, now, enter.filter((sub) => B.mem[sub].alive && !B.mem[sub].home && pos[sub]).map((sub) => ({ sub, sx: spec.x0 + pos[sub].x, z: pos[sub].z, dead: false, at: now })), rng); };
    for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
    assert.equal(B.sg, 'trial', `Hall ${h} woke`);
    before(spec);
    now += 20 * MIN;
    B.F.mem.lordsFell = 1;
    step();
    assert.equal(B.rd, egCircleOfHall(h), `Redoubt ${egCircleOfHall(h)} taken`);
  };
  const fall = (sub, spec) => { egFall(B, sub, now, [], { x: spec.arrive.x, z: spec.arrive.z }); delete pos[sub]; };
  return { B, court, fall, now: () => now, tick: (ms) => (now += ms), rd: (w) => (B.hq ?? []).find((e) => e.k === 'rd' && e.w === w) };
}
/** Redoubt 10 (Hall 50) taken by a breach of `n` whose members `enter` came, `fall` fallen (and `forsake` forsaken) before its
 *  lord: the breach and its Redoubt news. */
function redoubtTen({ n, enter, fall = [], forsake = [] }) {
  const S = breachOf({ n, enter });
  S.court(50, (spec) => { for (const sub of [...fall, ...forsake]) S.fall(sub, spec); for (const sub of forsake) assert.equal(egForsake(S.B, sub, S.now(), []), true); });
  return { ...S, news: S.rd(10) };
}
/** The posts a breach's news makes: the first company ever's, and another breach's after it (the plain Redoubt post). */
function postsOf({ B, now }) {
  const tell = validEgHeraldTell({ b: B.b, ev: B.hq });
  const st = egHeraldFold(readEgHeraldState(null), tell, { nowMs: now() });
  const again = egHeraldFold({ ...st, q: [] }, { b: 'fedcba9876543210', ev: tell.ev }, { nowMs: now() });
  return [...st.q, ...again.q].filter((p) => p.kind === 'first' || p.kind === 'rd').map((p) => egHeraldPost(p).content);
}

test('LONE-HERALD the director\'s news: a Valkynaz Redoubt\'s news says the company\'s entrants (`n`) - one alone, three, and a pair with one fallen, forsaken or gone home still two (the Descent\'s count, section 20: every member admitted, earning or not) - and leads with an entrant: the opener where the opener entered, else the first who did, alone or not (mutants: the size left off the news; the opener named for a company it is not in; the living counted, not the entrants; a member gone home or forsaken not counted)', () => {
  const one = redoubtTen({ n: 1 });
  assert.deepEqual([one.news.n, one.news.o, one.news.by], [1, 'M0', ['M0']]);
  const three = redoubtTen({ n: 3 });
  assert.deepEqual([three.news.n, three.news.o], [3, 'M0']);
  const pair = redoubtTen({ n: 2, fall: ['acct-1'] });
  assert.deepEqual([pair.news.n, pair.news.o, pair.news.by], [2, 'M0', ['M0']], 'a fallen member is still of the company');
  const forsook = redoubtTen({ n: 2, forsake: ['acct-1'] });
  assert.deepEqual([forsook.news.n, forsook.news.o, forsook.news.by], [2, 'M0', ['M0']], 'a forsaken member too');
  // AUDIT FB1020d L2-2: one goes home at Redoubt 5's rest (egHome, the producer's own door), the other takes Redoubt 10
  const home = breachOf({ n: 2 });
  home.court(25);
  home.tick(EG_RD_WINDOW_MS);
  assert.equal(egHome(home.B, 'acct-1', home.now(), []), true, 'home at the rest');
  home.court(50);
  assert.deepEqual([home.rd(10).n, home.rd(10).o, home.rd(10).by], [2, 'M0', ['M0']], 'a member gone home is still of the company');
  // the opener never stepped in: the one who went is the one the post names - and AUDIT FB1020d L1-1, two who went are led by the first of them
  const theirs = redoubtTen({ n: 2, enter: ['acct-1'] });
  assert.deepEqual([theirs.news.n, theirs.news.o, theirs.news.by], [1, 'M1', ['M1']]);
  const twoOfThree = redoubtTen({ n: 3, enter: ['acct-1', 'acct-2'] });
  assert.deepEqual([twoOfThree.news.n, twoOfThree.news.o, twoOfThree.news.by], [2, 'M1', ['M1', 'M2']]);
});

test('LONE-HERALD the posts from a played breach: a company of one\'s First of the Spire and its tenth Redoubt say its member alone; a company of three and a pair with one fallen keep "<opener>\'s company" and every earner\'s name; a company that went without its opener is its first entrant\'s (mutants: the read dropping the size; the fold dropping it from either post; "alone" unsaid)', () => {
  const [first, rd] = postsOf(redoubtTen({ n: 1 }));
  assert.equal(first, '**First of the Spire:** M0 is the first ever to take Redoubt 10 of the Battlespire (Hall 50), alone, in 20:08.');
  assert.equal(rd, '**M0 took Redoubt 10 of the Battlespire (Hall 50) alone** in 20:08.');
  assert.equal(postsOf(redoubtTen({ n: 2, enter: ['acct-1'] }))[1], '**M1 took Redoubt 10 of the Battlespire (Hall 50) alone** in 20:08.', 'the one who went, not the opener');
  const [first3, rd3] = postsOf(redoubtTen({ n: 3 }));
  assert.equal(first3, '**First of the Spire:** M0\'s company is the first ever to take Redoubt 10 of the Battlespire (Hall 50), in 20:08 - M0, M1 and M2.');
  assert.equal(rd3, '**M0\'s company took Redoubt 10 of the Battlespire (Hall 50)** in 20:08.');
  assert.equal(postsOf(redoubtTen({ n: 2, fall: ['acct-1'] }))[1], '**M0\'s company took Redoubt 10 of the Battlespire (Hall 50)** in 20:08.', 'one left standing of two is still a company');
  assert.deepEqual(postsOf(redoubtTen({ n: 3, enter: ['acct-1', 'acct-2'] })), [
    '**First of the Spire:** M1\'s company is the first ever to take Redoubt 10 of the Battlespire (Hall 50), in 20:08 - M1 and M2.',
    '**M1\'s company took Redoubt 10 of the Battlespire (Hall 50)** in 20:08.',
  ], 'AUDIT FB1020d L1-1: never an opener who is not of it');
});

test('LONE-HERALD the words: a company of one by its name, alone - the tenth Redoubt (its start said, as a Redoubt 20 from a deeper start would be), First of the Spire with no list of one name, a seal lifted; a company of two or more, and news that did not say its size (a room before this relay), as "<opener>\'s company"; a name held to the herald\'s letters, and none said as "Someone" (mutants: an unsaid size read as one; the name taken raw; no name for nobody; "alone" unsaid on First of the Spire or a seal; the list of one name kept)', () => {
  assert.equal(egRedoubtPost({ o: 'Mara', n: 1, w: 20, h: 100, t: 2400, ew: 10 }).content, '**Mara took Redoubt 20 of the Battlespire (Hall 100) alone** in 40:00, from Redoubt 10.');
  assert.equal(egRedoubtPost({ o: 'Mara', n: 1, w: 20, h: 100, t: 7810 }).content, '**Mara took Redoubt 20 of the Battlespire (Hall 100) alone** in 2:10:10.');
  for (const n of [0, 2, 8, undefined]) assert.equal(egRedoubtPost({ o: 'Mac', n, w: 10, h: 50, t: 6680 }).content, '**Mac\'s company took Redoubt 10 of the Battlespire (Hall 50)** in 1:51:20.', `n ${n}`);
  assert.equal(egFirstPost({ o: 'Mara', n: 1, by: ['Mara'], w: 10, h: 50, t: 4660 }).content, '**First of the Spire:** Mara is the first ever to take Redoubt 10 of the Battlespire (Hall 50), alone, in 1:17:40.');
  assert.equal(egFirstPost({ o: 'Mac', n: 2, by: ['Mac', 'Ann'], w: 10, h: 50, t: 6680 }).content, '**First of the Spire:** Mac\'s company is the first ever to take Redoubt 10 of the Battlespire (Hall 50), in 1:51:20 - Mac and Ann.');
  assert.equal(egSealPost({ band: 0, o: 'Mara', n: 1 }).content, '**The way below the Galleries is open.** Mara is the first through, alone.');
  assert.equal(egSealPost({ band: 0, o: 'Mac', n: 3 }).content, '**The way below the Galleries is open.** Mac\'s company is the first through.');
  assert.equal(egRedoubtPost({ o: '**@everyone** <@&1>', n: 1, w: 20, h: 100, t: 59 }).content, '**everyone 1 took Redoubt 20 of the Battlespire (Hall 100) alone** in 0:59.');
  assert.equal(egRedoubtPost({ o: '', n: 1, w: 20, h: 100, t: 59 }).content, '**Someone took Redoubt 20 of the Battlespire (Hall 100) alone** in 0:59.');
  assert.ok(egFirstPost({ o: '@@', n: 1, w: 10, h: 50, t: 1 }).content.startsWith('**First of the Spire:** Someone is the first ever'));
});

test('LONE-HERALD the hub\'s read and reckoning: a Redoubt\'s size is kept from 1 to 8, and read as unsaid (0) when absent or out of shape; the reckoning hands it to the tenth Redoubt, First of the Spire and a seal lifted (mutants: the read dropping the size; any number taken; the fold dropping it from the Redoubt, First of the Spire or the seal)', () => {
  const ev = (i, extra) => ({ i, at: T0, k: 'rd', w: 10, h: 50, t: 6680, ew: 0, o: 'Mara', by: ['Mara'], ...extra });
  const read = validEgHeraldTell({ b: '0123456789abcdef', ev: [ev(1, { n: 1 }), ev(2, { n: 8 }), ev(3, {}), ev(4, { n: 9 }), ev(5, { n: 0 }), ev(6, { n: '1' }), ev(7, { n: 1.5 })] });
  assert.deepEqual(read.ev.map((e) => e.n), [1, 8, 0, 0, 0, 0, 0]);
  // a deploy that opens the Soul Cairn (the hub first heard of the Spire with the Galleries alone open): the first breach
  // through says the seal, then Redoubt 10 is First of the Spire, then another breach's is the plain post - each a company of one
  let st = egHeraldFold(readEgHeraldState(null), { b: '0123456789abcdef', ev: [] }, { nowMs: T0, open: 1 });
  st = egHeraldFold(st, { b: 'aaaaaaaaaaaaaaaa', ev: validEgHeraldTell({ b: 'aaaaaaaaaaaaaaaa', ev: [ev(1, { n: 1, w: 5, h: 25 })] }).ev }, { nowMs: T0, open: 2 });
  st = egHeraldFold(st, validEgHeraldTell({ b: 'bbbbbbbbbbbbbbbb', ev: [ev(1, { n: 1 })] }), { nowMs: T0, open: 2 });
  st = egHeraldFold(st, validEgHeraldTell({ b: 'cccccccccccccccc', ev: [ev(1, { n: 1 })] }), { nowMs: T0, open: 2 });
  assert.deepEqual(st.q.map((p) => [p.kind, p.n]), [['seal', 1], ['first', 1], ['rd', 1]]);
  assert.deepEqual(st.q.map((p) => egHeraldPost(p).content), [
    '**The way below the Galleries is open.** Mara is the first through, alone.',
    '**First of the Spire:** Mara is the first ever to take Redoubt 10 of the Battlespire (Hall 50), alone, in 1:51:20.',
    '**Mara took Redoubt 10 of the Battlespire (Hall 50) alone** in 1:51:20.',
  ]);
  // news from a room before this relay (no size): the company's words, as it was posted
  const old = egHeraldFold(readEgHeraldState(null), validEgHeraldTell({ b: '0123456789abcdef', ev: [ev(1, { w: 20, h: 100 })] }), { nowMs: T0 });
  assert.equal(egHeraldPost(old.q[0]).content, '**Mara\'s company took Redoubt 20 of the Battlespire (Hall 100)** in 1:51:20.');
});

test('AUDIT FB1020d L1-3 THE TRACKER COUNTS WHO CAME: the relay\'s own state, through the wire and the client\'s fold - a called pair of whom only the opener stepped in reads as a company of one once the first hall woke (no "1 of 2 standing", no row for the one who never came), as the herald and the Descent count it; before the first wake the whole called company is still gathered; a pair that both came keeps its count with one fallen (mutants: the tracker counting the called company after the wake; counting only the entrants before it)', () => {
  const hud = (S) => {
    const st = validEgOut(JSON.parse(JSON.stringify(egStateOf(S.B, S.now()))));
    assert.ok(st, 'the state crosses the wire');
    return egHudModel(foldEg(EG_STATE_EMPTY, st, S.now()), 'acct-0', S.now(), { inSpire: true });
  };
  // before the first wake: the pair called, the opener in - the gather still counts the companion who may yet come
  const early = breachOf({ n: 2, enter: ['acct-0'] });
  early.B.h = 50; early.B.sg = 'arrive'; early.B.pulledAt = early.now(); early.B.su = early.now() + EG_ARRIVE_MAX_MS;
  egGive8(12345, [egCircleOfHall(50)]);
  assert.equal(hud(early).company, '1 of 2 standing\nI M0\nII M1');
  // the hall woke: the door is shut to the one who never came
  const alone = breachOf({ n: 2, enter: ['acct-0'] });
  alone.court(50);
  assert.ok(alone.B.wk > 0);
  assert.equal(hud(alone).company, '', 'a company of one shows no company');
  const two = breachOf({ n: 3, enter: ['acct-0', 'acct-1'] });
  two.court(50);
  assert.equal(hud(two).company, '2 of 2 standing\nI M0\nII M1', 'three called, two came: two, and their rows alone');
  // two who came, one fallen: still two
  const pair = breachOf({ n: 2 });
  pair.court(50, (spec) => pair.fall('acct-1', spec));
  assert.match(hud(pair).company, /^1 of 2 standing\nI M0\nII M1 - watching$/);
});
