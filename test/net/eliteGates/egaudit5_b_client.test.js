// AUDIT EG V (2026-10-15, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 13.2, 13.3, 25.6 and 27) - FIX GROUP
// B, THE LORDS ON THE SCREEN: lane 1's findings whose half is the screen's - L1-14 every lord's phase card drawn (the numeral, the
// phase's name, its order); L1-13 Gutterdark and the Long Night darkening the floor, every foe keeping its rim, and the Bound
// Colossus's Rails drawn; L1-12 the Night-Stalker's true umbra glinting with its WIND; L1-18 a chained shape's dim outline before
// its fill; L1-22 a bar for each lord standing. Every fixture the producers': the breach and its Court from the director
// (egBreachNew, egEnter, egStep; the lords' own kits), all through the wire (validEgOut) into the link's fold (foldEg); the screen
// createEgFight; the HUD's model egSpireHudModel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsOf, egObjsOf, moonShafts, EG_LORD_PHASES, EG_GAROTH_SIG_CARDS, EG_GAROTH_SIG_ORDERS, egGarothSig, egBossLook } from '../../../src/net/eliteGates/egLords.js';
import { egFightState, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight, egPhaseCard, egDarkAt, egRailsAt, EG_OUTLINE_DIM, EG_DARK_EASE_MS } from '../../../src/scenes/eliteGates/egFight.js';
import { egLordBar, egLordBars, egSpireHudModel, EG_LORD_BARS_MAX } from '../../../src/ui/eliteGates/egSpireHud.js';
import { EG_ECLIPSE_LOOK } from '../../../src/world/eliteGates/egTelegraph.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL_SPIRE } from '../../../src/render/gate/gateTelegraph.js';
import { hostCue } from '../../../src/world/gate/gateBoss.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** A breach of `n` at hall `h` of `seed`, its Court's lords woken by the company in the wake ring: `step` beats the director,
 *  every frame kept; `at` stands a member. */
function courtOf(seed, h, { n = 2, strata = [], tide = null } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.strata = strata; B.tide = tide;
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = () => { now += 250; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 120 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  for (const [sub] of co) at(sub, spec.ring.x, spec.ring.z);
  for (let k = 0; k < 40 && !egLordsOf(B.F).some((L) => L.up2); k++) step();
  assert.ok(egLordsOf(B.F).some((L) => L.up2), 'the lords woke');
  let q = 1;
  const blow = (sub, i, d, [x, z], y = 0) => { now += 50; return egBlow(B, sub, { k: 'hit', i, q: q++, d, r: HIT_KINDS.Shaft }, { sx: spec.x0 + x, y, z }, now); };
  return { B, spec, frames, step, at, blow, subs: co.map(([sub]) => sub), now: () => now };
}
/** My screen's hold of the breach at `t`: its state, the whole fight, then every word since `from` (an index of the frames). */
function held(C, t, from = 0) {
  let E = foldEg(EG_STATE_EMPTY, wire(egStateOf(C.B, t)), t);
  E = foldEg(E, wire(egFightState(C.B.F, t)), t);
  for (const f of C.frames.slice(from)) if (f.k !== 'efs' && f.k !== 'st') E = foldEg(E, wire(f), t);
  return E;
}
/** The screen over state `E` (my feet at member `me`'s place), its clock `clock.t`; its 3-D sounds kept (`heard`). */
function screen(C, E, clock, me = 'acct-0') {
  const heard = [];
  const audio = { play3d: (clip, at) => heard.push({ clip, at }), play3dId: (id, at) => heard.push({ id, at }), playOneShot: () => {} };
  const fight = createEgFight({ link: { state: () => E, now: () => clock.t }, now: () => clock.t, audio, player: () => ({ health: 1000, maxHealth: 1000 }), me: () => me,
    feet: () => realmToDungeon(C.spec.x0 + C.spec.ring.x, 0, C.spec.ring.z), peerAt: () => null });
  return { fight, heard };
}

// ── L1-14: THE PHASE CARD ──────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-14 EVERY LORD\'S TURN ITS PHASE CARD (section 13.2: "turns each phase with the gate\'s phase card (the numeral, the phase\'s name, one order)"; section 27.5): Ilthys\'s second phase - once silent - turns on every screen with *II - The Conquest - Break her banners.*, its name said; every lord\'s second and third phase carries a name and an order, Garoth\'s third the signature he borrows (mutants: no card on the turn; the order dropped; Garoth\'s borrowed name lost; a Valkynaz\'s second unnamed)', () => {
  const C = courtOf(1, 25);
  const I = egLordsOf(C.B.F)[0];
  assert.equal(I.key, 'ilthys');
  const f0 = C.frames.length;
  I.hp = Math.floor(I.max * 0.6);
  C.step();
  assert.deepEqual(C.frames.slice(f0).filter((f) => f.k === 'esay' && f.w === 'phase').map((f) => f.t), ['The Conquest.'], 'its turn named');
  const clock = { t: C.now() }, E = held(C, clock.t), { fight } = screen(C, E, clock);
  fight.frame();
  const card = fight.card();
  assert.deepEqual([card?.kicker, card?.main, card?.sub], ['II', 'The Conquest', 'Break her banners.'], 'the phase card: numeral, name, order');
  // every lord's two turns named and ordered
  for (const [key, P] of Object.entries(EG_LORD_PHASES)) for (const ph of [2, 3]) {
    if (key === 'garoth' && ph === 3) continue;
    const c = egPhaseCard(key, ph, 20);
    assert.ok(c && c.kicker === ['', 'I', 'II', 'III'][ph] && c.main === P[ph - 2][0] && /\.$/.test(c.sub) && c.sub.length <= 48, `${key} ${ph}`);
  }
  for (const c of [20, 25, 30]) { const g = egGarothSig(c); assert.deepEqual(egPhaseCard('garoth', 3, c), { kicker: 'III', main: EG_GAROTH_SIG_CARDS[g].replace(/\.$/, ''), sub: EG_GAROTH_SIG_ORDERS[g] }); }
  assert.equal(egPhaseCard('kynreeve', 2, 20), null, 'a champion turns no phase');
});

// ── L1-13: THE PLACE'S DARK AND THE RAILS ─────────────────────────────────────────────────────────────────────────────
const darkShape = (fight) => fight.shapes().find((s) => s.kind === TELEGRAPH_KIND.all && s.pool === TELEGRAPH_POOL_SPIRE.dark);
test('AUDIT EG V L1-13 GUTTERDARK, THE LONG NIGHT AND THE RAILS ON EVERY SCREEN (section 13.3: "The floor goes dark; telegraphs keep their light, and every foe keeps a rim light"; "Rails rise along its flank every 15 s"): the Mother of Dusk\'s Gutterdark darkens the floor (the Eclipse\'s dark pool, its depth eased) while it lasts and never after; Seyth\'s Long Night keeps the moon-shafts lit in it; the Colossus\'s Rails stand gold along its flanks while they rise (mutants: the dark undrawn; the shafts unkept; the Rails undrawn; the dark past its end)', () => {
  const D = courtOf(1, 70);
  const f0 = D.frames.length;
  let dark = null;
  for (let k = 0; k < 4 * 40 && !dark; k++) dark = D.step().find((f) => f.k === 'edark') ?? null;
  assert.ok(dark, 'Gutterdark said');
  const clock = { t: D.now() }, { fight } = screen(D, held(D, clock.t, f0), clock);
  fight.frame();
  clock.t += EG_DARK_EASE_MS + 100; fight.frame();
  const sh = darkShape(fight);
  assert.ok(sh && Math.abs(sh.t - EG_ECLIPSE_LOOK.deep) < 1e-9 && sh.points.length === 0, 'the floor dark at the Eclipse\'s depth');
  clock.t = dark.until + 100; fight.frame();
  assert.equal(darkShape(fight), undefined, 'and light again after');
  assert.deepEqual([egDarkAt(dark.until, dark.until - 10_000, dark.until - 10_000), egDarkAt(dark.until, dark.until + 1)], [0, 0]);
  // the Long Night: the moon-shafts kept lit
  const S = courtOf(1, 75), L = egLordsOf(S.B.F)[0], s0 = S.frames.length;
  L.hp = Math.floor(L.max * 0.3);
  S.step();
  assert.ok(S.frames.slice(s0).some((f) => f.k === 'edark'), 'the Long Night said');
  const ck = { t: S.now() + EG_DARK_EASE_MS + 100 }, sc = screen(S, held(S, ck.t, s0), ck);
  sc.fight.frame(); ck.t += EG_DARK_EASE_MS + 100; sc.fight.frame();
  const night = darkShape(sc.fight), shafts = moonShafts(S.spec.spots.shafts[0], ck.t);
  assert.ok(night && night.points.length === 3 && night.r === 3, 'dark, three shafts kept');
  assert.deepEqual(night.points.map((p) => p.map((v) => Math.round(v * 10))), shafts.map((p) => p.map((v) => Math.round(v * 10))), 'where the shafts walk now');
  // the Rails
  const K = courtOf(1, 130), Co = egLordsOf(K.B.F)[0], k0 = K.frames.length;
  assert.equal(Co.key, 'colossus');
  let rail = null;
  for (let k = 0; k < 4 * 20 && !rail; k++) rail = K.step().find((f) => f.k === 'erail') ?? null;
  assert.ok(rail, 'the Rails rise');
  const rk = { t: K.now() + 100 }, rs = screen(K, held(K, rk.t, k0), rk);
  rs.fight.frame();
  const lanes = rs.fight.shapes().filter((s) => s.kind === TELEGRAPH_KIND.lane && s.halfW === 0.6), want = egRailsAt(Co.x, Co.z);
  assert.equal(lanes.length, 2, 'two rails');
  for (const [ax, az] of want) assert.ok(lanes.some((s) => Math.abs(s.origin[0] - ax) < 0.5 && Math.abs(s.origin[1] - az) < 0.5), 'along its flanks');
  rk.t = rail.until + 100; rs.fight.frame();
  assert.equal(rs.fight.shapes().filter((s) => s.kind === TELEGRAPH_KIND.lane && s.halfW === 0.6).length, 0, 'gone as they sink');
});

// ── L1-12: THE TRUE UMBRA'S GLINT ─────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-12 THE TRUE UMBRA GLINTS WITH ITS WIND ON EVERY SCREEN (section 13.3: "Three Shadows: three umbral discs; the true one glints with its WIND"): the room says the true disc\'s glint, and every screen lights it and plays the Night-Stalker\'s WIND from it once; the others stay dark (mutants: the glint undrawn; no WIND)', () => {
  const C = courtOf(1, 55);
  const L = egLordsOf(C.B.F)[0];
  L.hp = Math.floor(L.max * 0.6);
  let glint = null;
  for (let k = 0; k < 4 * 60 && !glint; k++) glint = C.step().find((f) => f.k === 'eob' && f.st === 1) ?? null;
  assert.ok(glint, 'the glint said');
  const u = egObjsOf(C.B.F, 'umbra').find((o) => o.i === glint.i);
  const clock = { t: C.now() }, { fight, heard } = screen(C, held(C, clock.t), clock);
  fight.frame(); fight.frame();
  const cue = hostCue('windup', egBossLook('stalker').mobile);
  const winds = heard.filter((h) => (h.id ?? h.clip) === (cue.id ?? cue.clip));
  assert.equal(winds.length, 1, 'its WIND once');
  const dz = realmToDungeon(C.spec.x0 + u.x, 1, u.z);
  assert.ok(winds.every((w) => Math.hypot(w.at[0] - dz[0], w.at[2] - dz[2]) < 1), 'from the true disc');
  const at = (o) => fight.shapes().find((s) => s.kind === TELEGRAPH_KIND.disc && Math.hypot(s.origin[0] - o.x, s.origin[1] - o.z) < 0.01);
  const discs = egObjsOf(C.B.F, 'umbra').map((o) => [o.i, at(o)]);
  assert.ok(discs.length === 3 && discs.every(([, s]) => s), 'three discs drawn');
  assert.deepEqual(discs.filter(([, s]) => s.flash > 0).map(([i]) => i), [u.i], 'the true one alone lit');
});

// ── L1-18: A CHAINED SHAPE'S DIM OUTLINE ──────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-18 A CHAINED SHAPE DRAWN DIM UNTIL THE FIRST LANDS (sections 13.2 and 25.4, the gate\'s "dim outline at once"): fury\'s chained shape stands on the screen from the first\'s word as an outline at EG_OUTLINE_DIM, its fill nought, and fills from the first\'s landing (mutants: the outline\'s lead undrawn; drawn full)', () => {
  const C = courtOf(12345, 5, { n: 1 });
  C.B.covenant = 1;
  let pair = null;
  for (let k = 0; k < 4 * 120 && !pair; k++) { const o = C.step(); const ch = o.find((f) => f.k === 'eb' && f.nm.endsWith('(fury)')); if (ch) pair = [C.frames.find((f) => f.k === 'eb' && `${f.nm} (fury)` === ch.nm && f.at === ch.at - ch.wu), ch]; const G = egLordsOf(C.B.F)[0]; C.at('acct-0', G.x + G.r + 1, G.z); }
  assert.ok(pair?.[0] && pair[1].ol > 0, 'fury\'s chain said with its outline\'s lead');
  const [first, ch] = pair, clock = { t: first.at - 200 };
  let E = foldEg(EG_STATE_EMPTY, wire(egStateOf(C.B, clock.t)), clock.t);
  E = foldEg(E, wire({ ...egFightState(C.B.F, clock.t), bl: [] }), clock.t);
  E = foldEg(foldEg(E, wire(first), clock.t), wire(ch), clock.t);
  const { fight } = screen(C, E, clock);
  fight.frame();
  const dim = fight.shapes().filter((s) => s.alpha === EG_OUTLINE_DIM && s.t === 0);
  assert.equal(dim.length, ch.s.length, 'its outline, dim and unfilled, while the first fills');
  clock.t = first.at + 100; fight.frame();
  assert.equal(fight.shapes().filter((s) => s.alpha === EG_OUTLINE_DIM).length, 0, 'filling once the first has landed');
});

// ── L1-22: A BAR FOR EACH LORD STANDING ───────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L1-22 THE LORD BAR IN A COURT OF TWO (sections 18 and 27.1): Clan Feud\'s Markynaz beside the Wellhead Wyrm - both bars while both stand; the Wyrm felled, the bar is the Markynaz\'s, never the Wyrm\'s at nought (mutants: a fallen lord\'s bar; one bar alone)', () => {
  const C = courtOf(1, 105, { tide: 'feud' });
  const [W, M] = egLordsOf(C.B.F);
  assert.deepEqual([W.key, M.key], ['wyrm', 'markynaz']);
  let E = held(C, C.now());
  assert.deepEqual(egLordBars(E).map((b) => b.name), ['The Wellhead Wyrm', 'The Markynaz'], 'both standing');
  const m = egSpireHudModel(E, 'acct-0', C.now());
  assert.deepEqual([m.lord?.name, m.lord2?.name], ['The Wellhead Wyrm', 'The Markynaz']);
  const f0 = C.frames.length;
  W.ward = 0; W.fl &= ~EG_FL.ward; W.fl &= ~EG_FL.fly; W.hp = 1;
  C.at('acct-0', W.x + 2, W.z);
  C.frames.push(...(C.blow('acct-0', W.i, 500, [W.x + 2, W.z], W.y ?? 0) ?? []));   // PIN MOVED (AUDIT EG V, the merge of fix group F: spec law 8's perch has its sides and its stair - the Wyrm struck from its own height)
  C.step();
  assert.ok(!(W.hp > 0) && M.hp > 0, 'the Wyrm felled, the Markynaz standing');
  E = held(C, C.now(), f0);
  assert.deepEqual([egLordBar(E)?.name, egLordBars(E).length], ['The Markynaz', 1], 'the bar is the lord still standing');
  assert.equal(egSpireHudModel(E, 'acct-0', C.now()).lord2, null);
  assert.equal(EG_LORD_BARS_MAX, 2);
});
