// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 6.2, 8.4, 8.7, 14,
// 15, 16.2 to 16.4; fix group A1, "director-company" - the rest, the company's word, the decrees and the offers):
//   L2-1  the decrees the company chose reach the next circle (each family's ask closes at its 10 s, its choice kept);
//   L2-11 the rest's beacon names the next circle's decrees and its Court (the state's `nx`, ui/eliteGates/egHud.js egNextCircleText);
//   L2-4, L3-5 Dagon's Bargain asked only with a family free - and no screen offers its shrine then (egTwistShown);
//   L2-5  a Bargain draws what the circle's draw may (never Swarm-Mother before the Cairn);
//   L2-10 THE FRAYING built: a decree of the ground drawn only for a circle with an Athenaeum, its fray fed to the Orrery;
//   L2-13 the Lean at the breach's first Redoubt (a deeper start's too), none for a member who landed no blow;
//   L2-15 every pick in hand taken at the rest's end, the offer closed with it; a pick and a Surplus the rest's alone;
//   L3-17 the respite asked again after each yes (and the Ready with it), and a Ready and a respite in one word settled.
// Every fixture is the producers' own: the halls and the plans from the law (egHallOf, egCirclePlan), the breach from the
// director (egBreachNew, egEnter, egStep, egWord), the decrees from net/eliteGates/egRun.js (egDecreesAsk, egDecreesChosen), the words
// through the wire (validEgOut) and the link (foldEg), the lines from the HUD's own models.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egCircleOfHall, egBossOf, egLordCard, egDecreeCount, EG_DECREES, EG_DECREE_BY_KEY, EG_TWIST_LINES, EG_TWIST_NAMES, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egWord, egGeo, egNextOf, egStrataSecond, EG_RESPITE_BUDGET_MS, EG_RESPITE_STEP_MS, EG_RESPITE_MIN_MS, EG_READY_MS } from '../../../src/net/eliteGates/egBrain.js';
import { egDecreesAsk, egDecreesChosen, egDecreesInForce, egBargainFams, egBargainOpen, egBargainDecree, egTwistShown, egFrayOf, egFrayingOpen, egLeanOf, EG_FRAYING_FRAY, EG_FRAYING_II_TURNS, EG_ASK_MS } from '../../../src/net/eliteGates/egRun.js';
import { EG_VESTIGES, EG_SHARDS_PER } from '../../../src/net/eliteGates/egVestige.js';
import { EG_WAGER_FAMILY_OF } from '../../../src/net/eliteGates/egStartLaw.js';
import { SD_OMENS } from '../../../src/net/superDungeon/sdMarks.js';
import { SD_FRAY_MAX } from '../../../src/net/superDungeon/sdBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egHudModel, egNextCircleText } from '../../../src/ui/eliteGates/egHud.js';
import { egSpireHudModel, egArrivalCard } from '../../../src/ui/eliteGates/egSpireHud.js';
import { egWitnessTwist } from '../../../src/world/eliteGates/egLights.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/**
 * Breach `seed` for a company of `n` (level 40) stood at hall `h` - by default circle `c`'s Court - on its arrival plate,
 * stepped by the director: `toTrial` (its wake), `toRest` (the Court's lord felled - the fight's own mark, net/eliteGates/egLords.js
 * egLordsFell - so the director takes the Redoubt), `toWindow` (the rest's window), `stepUntil`, `voteAll`, `word`; the frames
 * said, and the screen's state folded from them through the wire and the link (`E`).
 */
function breach({ seed = 12345, c = 1, h = 5 * c, n = 3, ew = 0, wg = [], pr = 'pyre', dc = null, pre = null } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew, rh: 0, seed, op: T0, co, site: SITE, wg, pr });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  if (dc) B.dc = dc;
  pre?.(B);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const frames = [];
  const plate = (i) => { const s = egHallOf(seed, B.h, egGeo(B)); return { sx: s.x0 + s.arrive.x + i * 0.5, z: s.arrive.z }; };
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub], i) => ({ sub, ...plate(i), dead: false, at: now })), rng); frames.push(...o); return o; };
  const stepUntil = (pred, max = 2400) => { for (let k = 0; k < max && !pred(); k++) step(); assert.ok(pred(), 'reached'); };
  const word = (sub, m) => { const o = egWord(B, sub, m, null, now, rng); frames.push(...o); return o; };
  const voteAll = (q, y) => { for (const [sub] of co) word(sub, { k: 'vote', q, y }); };
  const P = {
    B, co, frames, rng, step, stepUntil, word, voteAll, now: () => now,
    toTrial: () => stepUntil(() => B.sg === 'trial'),
    toRest: () => { P.toTrial(); B.F.mem.lordsFell = 1; step(); assert.equal(B.sg, 'rest', 'the Redoubt taken'); },
    toWindow: () => { if (B.sg !== 'rest') P.toRest(); stepUntil(() => B.rdSeq?.window === 1); },
    /** The screen's state: every frame said, through the wire (validEgOut) and the link (foldEg), as a member's client folds it. */
    E: () => frames.reduce((s, f) => { const { to, ...w } = f; void to; const v = validEgOut(JSON.parse(JSON.stringify(w))); return v ? foldEg(s, v, now) : s; }, EG_STATE_EMPTY),
  };
  return P;
}
/** The first hall of a plan (seeds `from` on) at circle `c0..c1` whose plan slot satisfies `pred` - `{ seed, h, c, slot }`. */
function planHall(pred, { seeds = [1, 300], c0 = 2, c1 = 12 } = {}) {
  for (let seed = seeds[0]; seed < seeds[1]; seed++) for (let c = c0; c <= c1; c++) {
    const plan = egCirclePlan(seed, c);
    for (let i = 0; i < 5; i++) if (pred(plan[i], c, i + 1, plan)) return { seed, c, slot: i + 1, h: 5 * (c - 1) + i + 1 };
  }
  throw new Error('no such hall');
}
const names = (dc) => dc.map(([id, rank]) => `${EG_DECREES[id].name}${rank >= 2 ? ' II' : ''}`).join(', ');

// ── L2-1: THE CHOSEN DECREES REACH THE NEXT CIRCLE ────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-1 THE COMPANY\'S CHOSEN DECREES REACH THE NEXT CIRCLE (sections 14 and 16.4): at circle 9\'s rest the next circle\'s four families are asked, the company votes each family\'s SECOND decree, and each ask closes at its EG_ASK_MS as every ask does - its choice kept (`B.next.dc`, one ranked II from circle 10) and said (`asked`, r 1); the Ready ends the rest, circle 10 bears exactly those decrees beside the Proclamation, and its first hall\'s fight wakes under them (mutants: the decrees\' asks dropped unread; the vote ignored; the rank lost; the chosen not carried to the next circle)', () => {
  const P = court(9);
  P.toWindow();
  const decs = P.B.asks.filter((a) => a.q.startsWith('dec:'));
  assert.equal(decs.length, egDecreeCount(10), 'four families asked');
  for (const a of decs) assert.equal(a.until, P.now() + EG_ASK_MS, 'open its ten seconds');
  for (const a of decs) P.voteAll(a.q, 1);
  P.voteAll('ready', 1);
  const up = P.B.next.up, want = decs.map((a) => [a.o[1], a.q.slice(4) === up ? 2 : 1]);
  assert.ok(want.some(([, r]) => r === 2), 'one ranked II from circle 10');
  P.stepUntil(() => !P.B.asks.some((a) => a.q.startsWith('dec:')));
  assert.equal(P.B.sg, 'rest', 'chosen within the rest');
  assert.deepEqual(P.B.next.dc, want, 'the company\'s choice kept');
  for (const a of decs) assert.ok(P.frames.some((f) => f.k === 'asked' && f.q === a.q && f.r === 1), `${a.q} said chosen`);
  P.stepUntil(() => P.B.sg !== 'rest');
  assert.equal(egCircleOfHall(P.B.h), 10, 'into circle 10');
  assert.deepEqual(P.B.dc, want, 'the next circle bears them');
  const force = egDecreesInForce(P.B);
  for (const [id, r] of want) assert.ok(force.some((q) => q[0] === id && q[1] === r), `${EG_DECREES[id].key} in force`);
  assert.ok(force.some((q) => q[0] === EG_DECREE_BY_KEY.pyre.id), 'the Proclamation beside them');
  P.toTrial();
  for (const [id, r] of want) assert.equal(P.B.F.D[EG_DECREES[id].key], r, `the hall's fight bears ${EG_DECREES[id].key}`);
});
/** Circle `c`'s Court of seed 12345 for a company of three. */
function court(c, o = {}) { return breach({ seed: 12345, c, ...o }); }

// ── L2-11: THE BEACON'S WORD ──────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-11 THE BEACON NAMES THE NEXT CIRCLE (sections 14 and 16.3: *The next circle bears: ...* and *The next Court: Grath, the Hound.*): in a rest every screen says the next Court\'s lord from the window on, and once the company\'s word closes the decrees it chose - the state\'s `nx` through the wire and the link - on both HUDs\' rest lines; none outside a rest (mutants: `nx` never said; the wire dropping it; the lord of this circle named; the line kept past the rest)', () => {
  const P = court(1);
  P.toWindow();
  const L2 = egLordCard(egBossOf(12345, 2)), court2 = `The next Court: ${L2.name}, ${L2.epithet}.`;
  assert.equal(egNextCircleText(P.E()), court2, 'the next Court from the window on');
  assert.deepEqual(egNextOf(P.B), [], 'no decree before the word closes');
  const dec = P.B.asks.find((a) => a.q.startsWith('dec:'));
  P.voteAll(dec.q, 1);
  P.stepUntil(() => !P.B.asks.some((a) => a.q.startsWith('dec:')));
  const chosen = [[dec.o[1], 1]];
  const st = P.frames.filter((f) => f.k === 'st').at(-1);
  assert.deepEqual(st.nx, chosen, 'the room says them');
  assert.deepEqual(validEgOut(JSON.parse(JSON.stringify(st))).nx, chosen, 'the wire carries them');
  const E = P.E(), line = `The next circle bears: ${names(chosen)}. ${court2}`;
  assert.deepEqual(E.nx, chosen, 'the link keeps them');
  assert.equal(egNextCircleText(E), line);
  assert.equal(egHudModel(E, 'acct-0', P.now(), { inSpire: true }).dec, line, 'the classic HUD\'s rest line');
  assert.ok(egSpireHudModel(E, 'acct-0', P.now()).stage.includes(line), 'the Spire HUD\'s stage line');
  // under the Twin Court the next Court's second lord beside it (the strata the state says)
  const two = egLordCard(egStrataSecond(['twincourt'], egBossOf(12345, 2), 2));
  assert.ok(egNextCircleText({ ...E, sr: ['twincourt'] }).endsWith(`The next Court: ${L2.name}, ${L2.epithet} - and ${two.name}, ${two.epithet}.`), 'the Twin Court\'s second lord named');
  P.voteAll('ready', 1);
  P.stepUntil(() => P.B.sg !== 'rest');
  assert.deepEqual(egNextOf(P.B), [], 'none outside a rest');
  assert.equal(egNextCircleText(P.E()), '');
  assert.equal(egNextCircleText({ ...E, sg: 'trial' }), '');
});

// ── L2-4, L3-5: A BARGAIN ONLY WITH A FAMILY FREE ─────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-4 L3-5 DAGON\'S BARGAIN ONLY WITH A FAMILY FREE (section 8.7: "none when no family is free"): a Bargain hall of circle 8 or deeper whose drawn decrees and the Proclamation hold all five families asks nothing, and no screen shows its shrine\'s line; with one family free it asks, passes on the company\'s yes, draws from that family, and seals a Reliquary for each yes (mutants: the free family unasked; the twist line shown with none free; a Bargain\'s draw from a held family)', () => {
  const at = planHall((p, c, slot) => p.twist === 'bargain' && c >= 8 && slot > 1 && (p.kind === 'yard' || p.kind === 'rampart' || p.kind === 'proving'), { c0: 8, c1: 12 });
  const drawn = (B) => { const asks = egDecreesAsk(B, at.c, seeded(3), 0, []); return egDecreesChosen(B, asks); };
  const full = breach({ seed: at.seed, h: at.h, pre: (B) => { B.dc = drawn(B); B.asks = []; } });
  assert.deepEqual(new Set(full.B.dc.map(([id]) => EG_DECREES[id].fam)), new Set(['legion', 'ground', 'covenant', 'lord']), 'four drawn beside the Proclamation\'s blows');
  full.toTrial();
  assert.deepEqual(egBargainFams(full.B), [], 'no family free');
  assert.equal(egBargainOpen(full.B), false);
  assert.ok(!full.frames.some((f) => f.k === 'ask' && f.q === 'bargain'), 'no Bargain asked');
  const spec = egHallOf(at.seed, at.h, egGeo(full.B));
  assert.equal(spec.twist, 'bargain', 'the law lays the shrine');
  assert.equal(egTwistShown(spec, egDecreesInForce(full.B)), null, 'no screen shows it');
  const E0 = full.E(), quiet = { ...E0, fight: { ...E0.fight, pg: {} } };
  assert.equal(egArrivalCard(E0).twist, '', 'the arrival card says no shrine');
  assert.equal(egHudModel(quiet, 'acct-0', full.now(), { inSpire: true }).sub, '', 'nor the classic HUD');
  assert.equal(egWitnessTwist({ ...E0, h: at.h - 1 }), '', 'nor a witness\'s sight of it');
  // one family free (the lord's): asked, passed, drawn from it, a Reliquary for each yes
  const one = breach({ seed: at.seed, h: at.h, pre: (B) => { B.dc = drawn(B).filter(([id]) => EG_DECREES[id].fam !== 'lord'); B.asks = []; } });
  one.toTrial();
  assert.deepEqual(egBargainFams(one.B), ['lord']);
  assert.ok(one.frames.some((f) => f.k === 'ask' && f.q === 'bargain'), 'the Bargain asked');
  const E1 = one.E();
  assert.equal(egArrivalCard(E1).twist, EG_TWIST_LINES.bargain, 'its shrine on the card');
  assert.equal(egHudModel({ ...E1, fight: { ...E1.fight, pg: {} } }, 'acct-0', one.now(), { inSpire: true }).sub, EG_TWIST_NAMES.bargain, 'on the classic HUD');
  assert.equal(egWitnessTwist({ ...E1, h: at.h - 1 }), EG_TWIST_LINES.bargain, 'to a witness');
  const rel0 = one.co.map(([sub]) => one.B.mem[sub].rel.length);
  one.word('acct-0', { k: 'vote', q: 'bargain', y: 1 }); one.word('acct-1', { k: 'vote', q: 'bargain', y: 1 }); one.word('acct-2', { k: 'vote', q: 'bargain', y: 0 });
  one.stepUntil(() => !one.B.asks.some((a) => a.q === 'bargain'));
  assert.equal(one.B.bargainDc.length, 1);
  assert.equal(EG_DECREES[one.B.bargainDc[0][0]].fam, 'lord', 'from the free family');
  assert.ok(one.frames.some((f) => f.k === 'esay' && f.w === 'bargain' && f.t === EG_DECREES[one.B.bargainDc[0][0]].name), 'said');
  assert.deepEqual(one.co.map(([sub], i) => one.B.mem[sub].rel.length - rel0[i]), [1, 1, 0], 'a Reliquary to each yes');
});

// ── L2-5: A BARGAIN DRAWS WHAT THE CIRCLE MAY ─────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-5 A BARGAIN DRAWS WHAT THE CIRCLE\'S DRAW MAY (sections 12 and 14: Swarm-Mother "from the Cairn"): with the legion the one free family, a Bargain in the Galleries never draws Swarm-Mother over 300 rolls, and in the Cairn it does; it never draws Gale-Swept or Crumbling Halls (the level is laid) (mutants: the band unasked; the spans redrawn)', () => {
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [], pr: 'pyre' });
  const draws = (h, dc) => { B.h = h; B.dc = dc; const got = new Set(); for (let s = 1; s <= 300; s++) { B.bargainDc = []; got.add(egBargainDecree(B, seeded(s))?.key); } return got; };
  const legionFree = [[EG_DECREE_BY_KEY.ashfall.id, 1], [EG_DECREE_BY_KEY.press.id, 1], [EG_DECREE_BY_KEY.colossal.id, 1]];
  const galleries = draws(11, legionFree), cairn = draws(31, legionFree);
  assert.ok(!galleries.has('swarm') && galleries.size >= 3, `the Galleries: ${[...galleries]}`);
  assert.ok(cairn.has('swarm'), 'the Cairn draws it');
  for (const k of galleries) assert.equal(EG_DECREE_BY_KEY[k].fam, 'legion');
  const groundFree = [[EG_DECREE_BY_KEY.pack.id, 1], [EG_DECREE_BY_KEY.press.id, 1], [EG_DECREE_BY_KEY.colossal.id, 1]];
  const ground = draws(31, groundFree);
  assert.ok(!ground.has('gale') && !ground.has('crumbling') && ground.has('ashfall') && ground.has('sparks'), `the ground: ${[...ground]}`);
});

// ── L2-10: THE FRAYING ────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-10 THE FRAYING BUILT (sections 8.4 and 14): the Hour\'s omen (SD_OMENS\' own name and 36, read) is a decree of the ground, drawn only for a circle with an Athenaeum while its fray is short of the Hour\'s default; its fray is eight turns past the Orrery\'s longest road at rank I (36 in the first five circles, two more every five Redoubts) and four at rank II, never past SD_FRAY_MAX; a Bargain draws it only with an Athenaeum still ahead (mutants: drawn in any circle; drawn past circle 30; a Bargain\'s Fraying behind its Athenaeum; the fray not rising with the road; rank II\'s fray rank I\'s)', () => {
  const omen = SD_OMENS.find((o) => o.id === 'fraying');
  const D = EG_DECREE_BY_KEY.fraying;
  assert.deepEqual([D.name, D.fam, EG_WAGER_FAMILY_OF[D.id], EG_FRAYING_FRAY, EG_FRAYING_II_TURNS], [omen.name, 'ground', 'ground', omen.law.fray, 4]);
  for (let c = 1; c <= 30; c++) {
    const longest = 28 + 2 * Math.floor((c - 1) / 5);
    assert.equal(egFrayOf(c, 1), longest + 8, `circle ${c}: eight past the road`);
    assert.equal(egFrayOf(c, 2), longest + 4, `circle ${c} rank II: four`);
  }
  assert.deepEqual([egFrayOf(1), egFrayOf(5), egFrayOf(6), egFrayOf(31), egFrayOf(60)], [36, 36, 38, SD_FRAY_MAX, SD_FRAY_MAX]);
  // drawn only for a circle with an Athenaeum (and only to circle 30)
  let offered = 0;
  for (let seed = 1; seed <= 40; seed++) for (const c of [2, 3, 4, 5, 8, 12, 31, 33]) {
    const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [], pr: 'pack' });
    const has = egCirclePlan(seed, c).some((p) => p.kind === 'athenaeum');
    for (let s = 1; s <= 4; s++) {
      const on = egDecreesAsk(B, c, seeded(seed * 31 + s), 0, []).some((a) => a.o.includes(D.id));
      if (on) { offered++; assert.ok(has && c <= 30, `seed ${seed} circle ${c}: only with an Athenaeum, to circle 30`); }
    }
    assert.equal(egFrayingOpen(seed, c), has && c <= 30);
  }
  assert.ok(offered > 0, 'it is drawn');
  // the Orrery's fray: The Fraying's at its rank, the Hour's default without
  const ath = planHall((p, c) => p.kind === 'athenaeum' && c >= 2 && c <= 5, { c0: 2, c1: 5 });
  const ath2 = planHall((p, c) => p.kind === 'athenaeum' && c >= 11 && c <= 15, { c0: 11, c1: 15 });
  const fray = (at, dc) => { const P = breach({ seed: at.seed, h: at.h, dc }); P.toTrial(); return P.B.F.orrery.fray; };
  assert.equal(fray(ath, [[D.id, 1]]), 36, 'The Fraying: 36 in the first circles');
  assert.equal(fray(ath, []), SD_FRAY_MAX, 'the Hour\'s default without it');
  assert.equal(fray(ath2, [[D.id, 2]]), egFrayOf(ath2.c, 2), 'rank II deeper');
  // a Bargain's Fraying only with the Athenaeum still ahead of its hall (the ground the one family free)
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: ath.seed, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [], pr: 'pyre' });
  B.dc = [[EG_DECREE_BY_KEY.pack.id, 1], [EG_DECREE_BY_KEY.press.id, 1], [EG_DECREE_BY_KEY.colossal.id, 1]];
  const bargain = (h) => { B.h = h; const got = new Set(); for (let s = 1; s <= 200; s++) { B.bargainDc = []; got.add(egBargainDecree(B, seeded(s))?.key); } return got; };
  assert.ok(bargain(ath.h - ath.slot + 1).has('fraying'), 'ahead of the Athenaeum');
  assert.ok(!bargain(ath.h + 1).has('fraying'), 'past it');
});

// ── L2-13: THE LEAN ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-13 THE LEAN AT THE BREACH\'S FIRST REDOUBT (sections 15 and 16.6): a breach started at Redoubt 3 leans its first offer, Redoubt 4\'s - an archer\'s first card a Hunt Vestige - and a member who has landed no blow leans to nothing (never Blade by default); a breach from Hall 1 leans at Redoubt 1 and not at Redoubt 2 (mutants: the Lean at Redoubt 1 alone; a blowless member leaned to Blade; the most-used kind misread)', () => {
  assert.deepEqual([egLeanOf([0, 0, 0]), egLeanOf([2, 5, 1]), egLeanOf([0, 0, 3]), egLeanOf([4, 4, 0]), egLeanOf(null)], [null, 1, 2, 0, null]);
  const P = breach({ seed: 12345, c: 4, ew: 3, pre: (B) => { B.mem['acct-0'].kinds = [1, 6, 0]; B.mem['acct-1'].kinds = [0, 0, 0]; B.mem['acct-2'].kinds = [0, 0, 7]; } });
  P.toWindow();
  const m0 = P.B.mem['acct-0'], m1 = P.B.mem['acct-1'], m2 = P.B.mem['acct-2'];
  assert.deepEqual([m0.offerO.lean, m1.offerO.lean, m2.offerO.lean], [1, null, 2], 'the deeper start\'s first Redoubt leans');
  assert.equal(EG_VESTIGES[P.frames.find((f) => f.k === 'offer' && f.to === 'acct-0').v[0]].fam, 'hunt', 'an archer\'s first card a Hunt Vestige');
  assert.equal(EG_VESTIGES[P.frames.find((f) => f.k === 'offer' && f.to === 'acct-2').v[0]].fam, 'arcana');
  const one = court(1, { pre: (B) => { B.mem['acct-0'].kinds = [0, 3, 0]; } });
  one.toWindow();
  assert.equal(one.B.mem['acct-0'].offerO.lean, 1, 'Redoubt 1 of a breach from Hall 1');
  const two = court(2, { pre: (B) => { B.mem['acct-0'].kinds = [0, 3, 0]; } });
  two.toWindow();
  assert.equal(two.B.mem['acct-0'].offerO.lean, null, 'none past the first');
});

// ── L2-15: THE PICKS CLOSE WITH THE REST ──────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L2-15 EVERY PICK IS THE REST\'S (section 15: "takes one within the rest; unpicked, the first is taken"): a member whose shards buy a second pick and who takes none has both taken at the rest\'s end, its shards spent and its offer closed; a pick and a Surplus are refused outside the rest, even with an offer left in hand (mutants: one pick taken at the close; the offer left open; a pick in a trial; a Surplus in a trial)', () => {
  const P = court(1, { pre: (B) => { B.mem['acct-0'].shards = EG_SHARDS_PER; B.mem['acct-1'].shards = 4 * EG_SHARDS_PER; } });
  P.toWindow();
  const m = P.B.mem['acct-0'], offer = [...m.offer];
  assert.equal(m.picks, 2, 'a second pick');
  P.voteAll('ready', 1);
  P.stepUntil(() => P.B.sg !== 'rest');
  assert.equal(m.vs.length, 2, 'both picks taken');
  assert.deepEqual(m.vs.map(([id]) => id), [offer[0], offer[1]], 'each the first card left');
  assert.deepEqual([m.offer, m.picks, m.shards], [null, 0, 0], 'the offer closed, the shards spent');
  const m1 = P.B.mem['acct-1'];
  assert.deepEqual([m1.offer, m1.picks], [null, 0], 'more picks than cards: the offer closed all the same');
  P.toTrial();
  m.offer = [EG_VESTIGES[5].id]; m.picks = 1; P.B.sur = 1;
  assert.deepEqual(P.word('acct-0', { k: 'pick', v: EG_VESTIGES[5].id }), [], 'no pick in a trial');
  assert.equal(m.vs.length, 2);
  assert.deepEqual(P.word('acct-0', { k: 'surplus', use: 0 }), [], 'no Surplus in a trial');
  assert.equal(P.B.sur, 1, 'the Surplus kept');
});

// ── L3-17: THE RESPITE, EACH YES ──────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-17 THE RESPITE IS ASKED AGAIN AFTER EACH YES (section 6.2: "each yes lengthening the rest by two minutes"): every yes lengthens the rest by EG_RESPITE_STEP_MS (the last by what is left) and puts the respite and the Ready again while EG_RESPITE_MIN_MS of the budget is left, so the whole budget can be spent at one rest and a lengthened rest still ended early; a Ready and a respite passed in one word take the respite whole and end the rest EG_READY_MS after it (mutants: asked once a rest; the Ready not put again; the Ready cutting the respite short; the budget overspent)', () => {
  const P = court(1);
  P.toWindow();
  const su0 = P.B.su;
  let yes = 0;
  while (P.B.asks.some((a) => a.q === 'respite') && yes < 20) {
    P.voteAll('respite', 1);
    P.stepUntil(() => !P.B.asks.some((a) => a.q === 'respite' && a.v['acct-0'] === 1));
    yes++;
    assert.ok(P.B.asks.some((a) => a.q === 'ready'), 'the Ready put again');
  }
  assert.equal(yes, Math.ceil(EG_RESPITE_BUDGET_MS / EG_RESPITE_STEP_MS), 'asked after each yes until the budget ran short');
  assert.equal(P.B.resp, 0, 'the whole budget spent');
  assert.ok(P.B.su - su0 === EG_RESPITE_BUDGET_MS, 'the rest lengthened by it');
  assert.ok(EG_RESPITE_MIN_MS === 30_000);
  P.voteAll('ready', 1);
  P.stepUntil(() => !P.B.asks.some((a) => a.q === 'ready'));
  assert.equal(P.B.su, P.now() + EG_READY_MS, 'the lengthened rest ended early');
  // a Ready and a respite in one word: the respite taken whole, the rest ending EG_READY_MS after it
  const Q = court(1);
  Q.toWindow();
  Q.voteAll('ready', 1); Q.voteAll('respite', 1);
  Q.stepUntil(() => !Q.B.asks.some((a) => a.q === 'respite' && a.v['acct-0'] === 1));
  assert.equal(Q.B.su, Q.now() + EG_READY_MS + EG_RESPITE_STEP_MS);
  assert.equal(Q.B.resp, EG_RESPITE_BUDGET_MS - EG_RESPITE_STEP_MS);
});
