// FIELD BUGS 2026-10-19f - GAUNTLET-PLATES (a player's private report: a company killed all three of a Gauntlet's casters, the
// tracker still said "Casters left: 3", and the run was given up): THE GAUNTLET'S PLATES, MARKED AND NAMED. A Gauntlet Rampart's
// Casters are silenced only by standing EG_SILENCE_MS on each one's plate (Elite-Gates.md section 8.3; net/eliteGates/egBrain.js
// trialStep's Gauntlet - a member within EG_TOUCH_M of `spots.pillar[j].plate`); a blow or a spell silences none, and that rule
// stands (the owner's call, open). But the objective said "Silence the casters.", the line counted casters, and nothing on the
// screen marked a plate - FB1018D's WINCH-PLATES marked the Winch's and left the Gauntlet's. Pinned on the producers: the halls
// the law lays, the relay's director woken in each (egBreachNew, egStep, its Casters slain by egBlow), its state through the wire
// (validEgOut) into a member's (foldEg), the screen's fight and its floor plan, and both trackers' words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, EG_OBJECTIVES, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egStateOf, EG_TOUCH_M, EG_SILENCE_MS } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState, egBodyById } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight, egPlateY } from '../../../src/scenes/eliteGates/egFight.js';
import { egObjectiveText, egProgressText, egHudModel } from '../../../src/ui/eliteGates/egHud.js';
import { egSpireHudModel, egArrivalCard } from '../../../src/ui/eliteGates/egSpireHud.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { TELEGRAPH_KIND } from '../../../src/render/gate/gateTelegraph.js';
import { lookAt, perspective, mirrorProjectionX, UP_Y } from '../../../src/world/mat4.js';
import * as tm from '../../../src/systems/textManager.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const GOLD = [1.0, 0.82, 0.38];
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** The first `n` Gauntlets the build's law lays, found by their circles' plans: `{ seed, h, spec }` each. */
function gauntlets(n) {
  const out = [];
  for (let seed = 1; seed <= 40 && out.length < n; seed++) for (let c = 1; c <= 24 && out.length < n; c++) {
    egCirclePlan(seed, c).forEach((q, k) => { if (q.variant === 'gauntlet' && out.length < n) out.push({ seed, h: egFirstHallOf(c) + k }); });
  }
  assert.equal(out.length, n, 'enough Gauntlets laid');
  return out.map(({ seed, h }) => { const spec = egHallOf(seed, h, 0); assert.deepEqual([spec.kind, spec.variant], ['rampart', 'gauntlet']); return { seed, h, spec }; });
}
/** Gauntlet `h` woken on the director for a company of `size` on its arrival plate: `run(poses)` steps it a beat with the
 *  company where `poses` says (member j at `[x, z, y]`, the hall's frame - the rest on the walkway's start), `hit` strikes a
 *  body with the real blow, `screen()` the member's state folded from the room's words through the wire. */
function woken(seed, h, spec, size) {
  const rng = seeded(seed), co = Array.from({ length: size }, (_, j) => [`acct-${j}`, `M${j}`, j + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100, q = 1;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const run = (poses = []) => {
    now += 250;
    egStep(B, now, co.map(([sub], j) => { const [x, z, y] = poses[j] ?? [spec.arrive.x + j * 0.5, spec.arrive.z, 0]; return { sub, sx: spec.x0 + x, y, z, dead: false, at: now }; }), rng);
  };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) run();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const hit = (i, [x, z, y], r) => { now += 50; egBlow(B, 'acct-0', { k: 'hit', i, q: q++, d: 500, r }, { sx: spec.x0 + x, y, z }, now); };
  const screen = () => { const { k: _k, ...st } = egStateOf(B, now); return foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now); };
  return { B, run, hit, screen, now: () => now };
}
/** One frame of the screen's fight over state `E`, my feet on the walkway beside plate `at`, looking down it: its shapes (copied -
 *  the fight keeps its slots) with whether the floor plan draws each. */
function frameOf(spec, E, now, at) {
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => egToDungeon(spec, spec.walk.x, 0, at.z), peerAt: () => null });
  fight.frame();
  const eye = egToDungeon(spec, spec.walk.x, 1.6, at.z - 6);
  fight.drawPass(mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500)), lookAt(eye, egToDungeon(spec, spec.walk.x, 0, at.z + 6), UP_Y), eye, 1);
  const plan = fight.plan();
  return fight.shapes().map((s) => ({ kind: s.kind, x: s.origin[0], z: s.origin[1], r: s.r, y: s.y, color: [...s.color], alpha: s.alpha, drawn: plan.draws.some((d) => d.sh === s) }));
}
// the plate's own marks: gold discs on it (a Caster crumbled by its held plate - GAUNTLET-SLAIN's egGone - leaves its body's
// pooled disc there, undrawn and grey, which is no plate's mark)
const atPlate = (shapes, p) => shapes.filter((s) => s.kind === TELEGRAPH_KIND.disc && Math.hypot(s.x - p.plate[0], s.z - p.plate[1]) < 1e-6 && s.color.slice(0, 3).every((v, i) => v === GOLD[i])).map(({ r, y, color, alpha, drawn }) => ({ r, y, color, alpha, drawn }));
const mark = (alpha) => ({ r: EG_TOUCH_M, y: 2, color: GOLD, alpha, drawn: true });

test('GAUNTLET-PLATES (FIELD BUGS 2026-10-19f): A GAUNTLET\'S PLATES ARE MARKED, AND A HELD ONE SAYS SO - in the Gauntlets the law lays, woken for a company of one and of three, the room says each plate\'s word from the wake (`silenced`, plate by plate in `spots.pillar`\'s order, through the wire); through the trial each plate in play stands gold on its pillar\'s top, EG_TOUCH_M about, drawn - and no pillar the company was not given; a plate held EG_SILENCE_MS dims (the rune\'s unlit 0.35) while the rest stay bright, the line counting the Casters down and naming both ways; a Caster slain by real blows is silenced on the relay\'s next beat (GAUNTLET-SLAIN) and its plate dims too; the last held, the door opens and no plate is marked; arriving, none (mutants: the plates never drawn; drawn on no surface of their own; at the walkway\'s floor; short of the room\'s reach; a held plate still bright; the word left out at the wake or the step; every laid pillar drawn though the word says the company\'s; drawn past the trial; drawn before it)', () => {
  for (const [{ seed, h, spec }, size] of gauntlets(2).map((g, j) => [g, j === 0 ? 3 : 1])) {
    const R = woken(seed, h, spec, size), pillars = spec.spots.pillar, k = R.B.F.gauntlet.length, at = `seed ${seed} hall ${h}, a company of ${size}`;
    assert.equal(k, Math.min(pillars.length, 2 + Math.ceil(size / 2)), `${at}: the director's count`);
    assert.ok(k < pillars.length, `${at}: some laid pillar is not the company's`);
    for (const p of pillars) assert.equal(spec.discs.find((d) => d.role === 'pillar' && d.x === p.x && d.z === p.z).y, 2, `${at}: a pillar's top 2 m up`);
    let E = R.screen();
    assert.deepEqual([E.fight.pg.obj, E.fight.pg.left, E.fight.pg.silenced], ['gauntlet', k, Array(k).fill(0)], `${at}: the wake's word, plate by plate`);
    const bright = (E, why) => {
      const shapes = frameOf(spec, E, R.now(), pillars[0]);
      pillars.forEach((p, j) => assert.deepEqual(atPlate(shapes, p), j < k ? [mark(0.85)] : [], `${at}: ${why} - plate ${j} ${j < k ? 'marked gold on its pillar\'s top at the room\'s reach, drawn' : 'not the company\'s, unmarked'}`));
    };
    bright(E, 'the wake');
    assert.deepEqual(pillars.flatMap((p) => atPlate(frameOf(spec, { ...E, sg: 'arrive' }, R.now(), pillars[0]), p)), [], `${at}: arriving, before the trial, no plate marked`);
    const line = (n) => `Casters left: ${n}. Hold a plate 3 s or slay its caster`;
    assert.equal(egProgressText(spec, E.fight.pg), line(k), `${at}: the line counts the Casters, and names both ways`);
    // plate 0 held, its Caster standing: it dims, the rest stay bright
    const g0 = R.B.F.gauntlet[0];
    for (let n = 0; n <= EG_SILENCE_MS / 250 + 1 && !g0.done; n++) R.run([[g0.p.plate[0], g0.p.plate[1], 2]]);
    E = R.screen();
    assert.deepEqual([E.fight.pg.left, E.fight.pg.silenced], [k - 1, [1, ...Array(k - 1).fill(0)]], `${at}: plate 0 held, its word says so`);
    assert.equal(egProgressText(spec, E.fight.pg), line(k - 1));
    let shapes = frameOf(spec, E, R.now(), pillars[0]);
    pillars.forEach((p, j) => assert.deepEqual(atPlate(shapes, p), j === 0 ? [mark(0.35)] : j < k ? [mark(0.85)] : [], `${at}: plate ${j} after plate 0 was held`));
    // Caster 1 slain by real blows from beside it: GAUNTLET-SLAIN silences its pillar on the relay's next beat, and its plate dims
    const g1 = R.B.F.gauntlet[1];
    for (let n = 0; n < 400 && egBodyById(R.B.F, g1.i); n++) {
      const c = egBodyById(R.B.F, g1.i);
      R.hit(g1.i, [c.x + 1.2, c.z, c.y], HIT_KINDS.Melee);
      if (egBodyById(R.B.F, g1.i)) R.hit(g1.i, [spec.walk.x, c.z, 0], HIT_KINDS.Spell);
      R.run([[spec.walk.x, c.z, 0]]);
    }
    assert.equal(egBodyById(R.B.F, g1.i), null, `${at}: Caster ${g1.i} slain`);
    for (let n = 0; n < 8; n++) R.run([[spec.walk.x, pillars[0].z - 4, 0]]);
    E = R.screen();
    assert.deepEqual([R.B.sg, E.fight.pg.left, E.fight.pg.silenced], k > 2 ? ['trial', k - 2, [1, 1, ...Array(k - 2).fill(0)]] : ['closing', 0, [1, 1]], `${at}: Caster 1 slain, its plate's word silenced`);
    if (k > 2) {
      assert.equal(egProgressText(spec, E.fight.pg), line(k - 2));
      shapes = frameOf(spec, E, R.now(), pillars[0]);
      pillars.forEach((p, j) => assert.deepEqual(atPlate(shapes, p), j < 2 ? [mark(0.35)] : j < k ? [mark(0.85)] : [], `${at}: plate ${j} after Caster 1 was slain`));
    }
    // the rest held: the door
    for (const g of R.B.F.gauntlet.slice(2)) for (let n = 0; n <= EG_SILENCE_MS / 250 + 1 && R.B.sg === 'trial' && !g.done; n++) R.run([[g.p.plate[0], g.p.plate[1], 2]]);
    assert.equal(R.B.sg, 'closing', `${at}: every plate held, the door opens`);
    E = R.screen();
    assert.deepEqual(pillars.flatMap((p) => atPlate(frameOf(spec, E, R.now(), pillars[0]), p)), [], `${at}: the closing, no plate marked`);
  }
});

test('GAUNTLET-PLATES - AN OLDER RELAY: one before world232 (world231 or older) says no plate\'s word, so the screen draws every plate the hall lays, bright, while a Caster is left - and none once the line says none (mutants: nothing drawn without the word; drawn with none left)', () => {
  const [{ seed, h, spec }] = gauntlets(1), R = woken(seed, h, spec, 1), E = R.screen(), pillars = spec.spots.pillar;
  const { silenced: _s, ...old } = E.fight.pg;
  const shapes = frameOf(spec, { ...E, fight: { ...E.fight, pg: old } }, R.now(), pillars[0]);
  pillars.forEach((p, j) => assert.deepEqual(atPlate(shapes, p), [mark(0.85)], `plate ${j}: marked, the room saying no plate's word`));
  const none = frameOf(spec, { ...E, fight: { ...E.fight, pg: { ...old, left: 0 } } }, R.now(), pillars[0]);
  assert.deepEqual(pillars.flatMap((p) => atPlate(none, p)), [], 'no Caster left: none');
});

test('GAUNTLET-PLATES - THE PLATE\'S OWN HEIGHT (egPlateY): from spec law 10 each plate stands on its pillar\'s top (2 m); law 9 laid it 3 m up its stair, at the stair\'s height there (EG-PERFECT\'s 0.63 m for seed 1\'s hall 66, plate 0); law 7 on a flat side span at the walkway\'s floor (mutants: the pillar\'s top never found; the stair read at its foot or its head)', () => {
  const law = (v) => egHallOf(1, 66, 0, v);
  for (const p of law(10).spots.pillar) assert.equal(egPlateY(law(10), p), 2, 'law 10: the pillar\'s top');
  const L9 = law(9), ys = L9.spots.pillar.map((p) => +egPlateY(L9, p).toFixed(2));
  assert.equal(ys[0], 0.63, 'law 9: plate 0 on its stair, 3 m up 9.5 m');
  for (const [j, p] of L9.spots.pillar.entries()) {
    const s = Math.sign(p.x), ramp = L9.ramps.find((q) => q.az === p.z && Math.sign(q.bx) === s);
    assert.equal(ys[j], +(((p.plate[0] - ramp.ax) / (ramp.bx - ramp.ax)) * ramp.y1).toFixed(2), `law 9: plate ${j} at its own stair's height`);
    assert.ok(ys[j] > 0 && ys[j] < 2, `law 9: plate ${j} between the stair's foot and head`);
  }
  const L7 = law(7);
  assert.equal(L7.variant, 'gauntlet');
  for (const p of L7.spots.pillar) assert.equal(egPlateY(L7, p), 0, 'law 7: the walkway\'s floor');
});

test('GAUNTLET-PLATES - THE WORDS: the screen\'s Gauntlet objective names its plates in place of the law\'s *Silence the casters.* - which every spec keeps as laid, a hall\'s bytes (section 22\'s law pin) - and the line counts the plates with their seconds; both trackers and the arrival card say them in the player\'s language, the catalog\'s (mutants: the old words on the screen; the screen left on the law\'s; a tracker, the chip or the card left on the spec\'s English; the line\'s seconds not the room\'s)', () => {
  const [{ seed, h, spec }] = gauntlets(1), NAMED = "Silence each caster: stand on its plate, or slay it.";
  assert.deepEqual([EG_OBJECTIVES.gauntlet, spec.objective], ['Silence the casters.', 'Silence the casters.'], 'the law\'s word and the hall\'s bytes, as laid');
  assert.equal(egObjectiveText(spec), NAMED, 'the screen names the plates');
  assert.equal(egProgressText(spec, { obj: 'gauntlet', left: 3, silenced: [0, 0, 0] }), 'Casters left: 3. Hold a plate 3 s or slay its caster');
  assert.equal(EG_SILENCE_MS, 3000);
  const R = woken(seed, h, spec, 1), E = R.screen(), was = tm.currentLocale();
  try {
    tm.setLocale(tm.PSEUDO_LOCALE);
    const said = egObjectiveText(spec);
    assert.ok(said !== NAMED && said !== spec.objective, 'the objective drawn in the player\'s language');
    assert.notEqual(egProgressText(spec, E.fight.pg), 'Casters left: 3. Hold a plate 3 s or slay its caster', 'and the line');
    assert.equal(egHudModel(E, 'acct-0', R.now(), { inSpire: true }).line, said, 'the tracker\'s line');
    assert.equal(egSpireHudModel(E, 'acct-0', R.now()).objective, said, 'the Spire HUD\'s objective');
    assert.equal(egArrivalCard(E).sub, said, 'the arrival card');
  } finally { tm.setLocale(was); }
});
