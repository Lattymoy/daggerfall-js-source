// AUDIT EG-FALL (2026-10-21, bible/01-Overview/audits/Audit-EG-FALL.md; the owner: "Audit this"): A LORD'S FALL AS THE RELAY
// SAYS IT. EG-FALL's own pins (eg_lordfall.test.js) stood their lords on rows built by hand, and two of the fall's faults
// lived only in the words the relay really sends: a lord that is not its fight's last to fall is told by `efl` alone, which
// the link stamps with the screen's clock, and the next whole fight (`efs`) brings the relay's own instant - the screen
// read the moved instant as a second fall (L1-1, L2-1); and the relay carried a felled lord on along its walk, so the next
// `efs` moved its falling body away from its own burst and corpse, and a screen that came later laid the corpse elsewhere
// (L1-2, L2-2). Here the director runs the hall (net/eliteGates/egBrain.js egStep), the lords' law fells the lord
// (net/eliteGates/egLords.js egLordHit), every word crosses the wire's own check and folds at its own arrival
// (net/eliteGates/egLink.js foldEg), and the fight draws it frame by frame over a recording renderer (scenes/eliteGates/egFight.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egBodiesOf, egBodyAt, egFightState, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { egLordHit } from '../../../src/net/eliteGates/egLords.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight, egLookOf } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { stateAnims } from '../../../src/characters/mobile/mobileUnit.js';
import { BOSS_CUES, FALL_MS, THUD_AT_MS } from '../../../src/world/gate/gateBoss.js';
import { COLUMN_BURSTS } from '../../../src/scenes/gate/gateCourt.js';
import { FX_KINDS } from '../../../src/render/gate/gateFx.js';
import { egGive8 } from '../../egGive8.mjs';

const T0 = 1_800_000_000_000, SEED = 12345;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
/** THE TWIN COURT: hall 30 of SEED (the Soul Cairn's Court of Vael and Isk). */
const TWINS_HALL = 30;
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
egGive8(SEED, [1, 6, 10]);

/** A company of `n` woken in hall `h`'s trial, standing about its ring, `steps` beats in; every word the director says kept
 *  with its instant. */
function court(h, n = 4, steps = 0) {
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(SEED, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const beat = () => { now += 250; for (const o of egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng)) frames.push([now, o]); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) beat();
  assert.equal(B.sg, 'trial', 'the hall\'s trial woke');
  co.forEach(([sub], i) => { pos[sub] = { sx: spec.x0 + spec.ring.x + (i % 2) + (i >= 2 ? 6 : -6), z: spec.ring.z }; });
  for (let k = 0; k < steps; k++) beat();
  return { B, spec, now: () => now, beat, frames };
}
/** A screen holding the breach as it stands at `t` (its state and its whole fight), drawing over a recording renderer. */
function screenAt(C, t) {
  let E = foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...(({ k: _k, ...r }) => r)(egStateOf(C.B, t)) }), t);
  E = foldEg(E, wire(egFightState(C.B.F, t)), t);
  const clock = { t }, batches = [], freed = [], sounds = [], shakes = [];
  const renderer = { textures: new Set(), createBillboardBatch: (archive, record, size, centres) => { const b = { archive, record, size: { ...size }, centres, origin: null, bounds: [0, 0, 0, 1] }; batches.push(b); return b; }, destroyBillboardBatch: (b) => freed.push(b) };
  const getTexture = async (archive) => ({ archive, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const audio = { play3d: (clip, at, volume, o) => sounds.push({ clip, at, volume, pitch: o?.pitch, t: clock.t }), play3dId: () => {}, playOneShot: () => {} };
  const S = { clock, batches, freed, sounds, shakes, E: () => E, fold: (f, at) => { E = foldEg(E, wire(f), at); } };
  S.fight = createEgFight({ renderer, getTexture, uploadRecordFrame: () => {}, audio, link: { state: () => E }, now: () => clock.t, feet: () => null, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', shake: (k) => shakes.push({ k, t: clock.t }) });
  return S;
}
/** The words said from `cursor` on, each folded `lat` ms after it was said, frames every 16 ms up to `until`. */
async function pump(S, queue, until) {
  while (S.clock.t + 16 <= until) {
    S.clock.t += 16;
    queue.sort((a, b) => a[0] - b[0]);
    while (queue.length && queue[0][0] <= S.clock.t) { const [at, f] = queue.shift(); if (!f.to || f.to === 'acct-0') S.fold(f, at); }
    S.fight.frame();
    await new Promise((r) => setTimeout(r, 0));
  }
}

test('AUDIT EG-FALL L1-1/L2-1 ONE FALL IS ONE FALL (the relay\'s own words): a Twin felled while her sister stands is told by `efl` alone, the link stamps her fall at its arrival, and the next whole fight (`efs`) brings the relay\'s own instant - every phase of that whole fight against the fall, 120 ms late, plays her death cry once, the camera shaken once, one burst of Dagon\'s size, one thud and the column\'s three embers (mutants: the moved instant read as a new fall)', async () => {
  for (let phase = 0; phase < 8; phase++) {
    const C = court(TWINS_HALL, 4, 20);
    for (let k = 0; k < phase; k++) C.beat();
    const S = screenAt(C, C.now());
    const vael = egBodiesOf(C.B.F, EG_ROLE.lord).find((L) => L.pt === 0);
    const cry = ENEMY_BASICS[egLookOf({ role: EG_ROLE.lord, k: vael.k, pt: 0, fl: 0 }, C.spec.band).mobile].barkSound;
    const queue = [];
    let cursor = C.frames.length, killedAt = 0;
    const bursts = new Map();
    for (let k = 0; k < 16; k++) {
      if (k === 4) { const out = []; vael.hp = 0; killedAt = C.now(); egLordHit(C.B.F, C.spec, vael, 'acct-1', 'M1', 0, null, killedAt, [], out); assert.ok(out.some((f) => f.k === 'efl') && !out.some((f) => f.k === 'efell'), 'her sister stands: no efell'); for (const f of out) queue.push([killedAt + 120, f]); }
      C.beat();
      for (; cursor < C.frames.length; cursor++) { const [at, f] = C.frames[cursor]; queue.push([at + 120, f]); }
      await pump(S, queue, C.now());
      for (const q of S.fight.fall().bursts(S.clock.t)) bursts.set(`${q.kind === FX_KINDS.dagon ? 'dagon' : 'ember'}@${q.at0}`, q);
    }
    assert.ok(C.frames.some(([at, f]) => f.k === 'efs' && at > killedAt && at < killedAt + FALL_MS), `phase ${phase}: a whole fight said inside her fall`);
    const said = (c) => S.sounds.filter((s) => s.clip === c.clip && s.pitch === c.pitch && s.volume === c.volume).length;
    assert.deepEqual([S.sounds.filter((s) => s.clip === cry && s.pitch === BOSS_CUES.fall.pitch).length, S.shakes.length, said(BOSS_CUES.thud)], [1, 1, 1], `phase ${phase}: one cry, one shake, one thud`);
    const kinds = [...bursts.keys()].map((k) => k.split('@')[0]);
    assert.deepEqual([kinds.filter((k) => k === 'dagon').length, kinds.filter((k) => k === 'ember').length], [1, COLUMN_BURSTS], `phase ${phase}: one kill burst, one column (${[...bursts.keys()]})`);
  }
});

test('AUDIT EG-FALL L1-2/L2-2 A LORD LIES WHERE IT FELL, ON EVERY SCREEN: the relay stops a felled lord\'s walk at its fall (`egStop` - the room\'s row stands still, said as a walk of no speed), the live screen draws its falling body at one place from the kill to its corpse and lays the corpse there, and a screen that comes to the hall after the fall lays it in the same place (mutants: the walk carried on; the screen\'s body re-placed by the next whole fight)', async () => {
  const C = court(TWINS_HALL, 4, 20);
  for (let k = 0; k < 4; k++) C.beat();
  const vael = egBodiesOf(C.B.F, EG_ROLE.lord).find((L) => L.pt === 0);
  const S = screenAt(C, C.now()), centre = egHallCentre(C.spec);
  const look = egLookOf({ role: EG_ROLE.lord, k: vael.k, pt: 0, fl: 0 }, C.spec.band), ct = ENEMY_BASICS[look.mobile].corpseTexture, body = ENEMY_BASICS[look.mobile].maleTexture;
  // her own batch, falling: her sprite's archive (the legion's Fire Daedra share it) on one of her hurt records
  const hurt = new Set(stateAnims('hurt', look.mobile, !!ENEMY_BASICS[look.mobile].hasIdle, false, false, true, false, false).map((a) => `${a.record}#0`));
  const queue = [];
  let cursor = C.frames.length;
  await pump(S, queue, C.now() + 600);
  // walking when she falls - the law's own walk toward the company, with metres of it still to run
  const left = () => (vael.mv && vael.mv.v > 0 ? Math.hypot(vael.mv.tx - egBodyAt(vael, C.now())[0], vael.mv.tz - egBodyAt(vael, C.now())[1]) : 0);
  for (let k = 0; k < 80 && left() < 2; k++) { C.beat(); for (; cursor < C.frames.length; cursor++) { const [at, f] = C.frames[cursor]; queue.push([at + 60, f]); } await pump(S, queue, C.now()); }
  assert.ok(left() >= 2, `she walks, metres to go (${left()})`);
  const tf = C.now(), [fx, fz] = egBodyAt(vael, tf), out = [];
  vael.hp = 0; egLordHit(C.B.F, C.spec, vael, 'acct-1', 'M1', 0, null, tf, [], out);
  assert.equal(vael.mv, null, 'the relay stops her walk at her fall');
  assert.ok(Math.abs(vael.x - fx) < 0.011 && Math.abs(vael.z - fz) < 0.011, 'where she stood at the blow');
  for (const f of out) queue.push([tf + 60, f]);
  const xs = new Set(), corpses = new Set();
  for (let k = 0; k < 16; k++) {
    C.beat(); for (; cursor < C.frames.length; cursor++) { const [at, f] = C.frames[cursor]; queue.push([at + 60, f]); }
    await pump(S, queue, C.now());
    const bs = S.fight.batches(), lying = bs.find((q) => q.archive === ct.archive && q.record === `${ct.record}#0`);
    const standing = bs.find((q) => q.archive === body && hurt.has(q.record));
    if (S.clock.t < tf + FALL_MS && S.clock.t > tf + 100 && standing) xs.add((standing.origin[0] - centre[0]).toFixed(3));
    if (lying) corpses.add((lying.origin[0] - centre[0]).toFixed(3));
  }
  assert.ok(C.frames.some(([at, f]) => f.k === 'efs' && at > tf + 100 && at < tf + FALL_MS), 'a whole fight said inside her fall');
  assert.equal(xs.size, 1, `her falling body at one place (${[...xs]})`);
  assert.deepEqual([...corpses], [...xs], 'her corpse where her body fell');
  // a screen that comes after: the room's row says the same place
  const late = screenAt(C, C.now());
  late.fight.frame(); await new Promise((r) => setTimeout(r, 0)); late.fight.frame();
  const theirs = late.fight.batches().find((q) => q.archive === ct.archive && q.record === `${ct.record}#0`);
  assert.ok(theirs, 'the late screen lays her corpse');
  assert.equal((theirs.origin[0] - centre[0]).toFixed(3), [...corpses][0], 'in the place the live screen laid it');
  assert.ok(Math.abs(theirs.origin[0] - centre[0] - fx) < 0.011, 'where she fell');
  assert.ok(S.sounds.length > 0 && THUD_AT_MS < FALL_MS);
});
