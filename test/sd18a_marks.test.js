// SD18a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD18a;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE HOUR'S MARKS (net/sdMarks.js) - each Hollow keeps one
// of six Endings (the Orrery's stones) and two of nine omens, its place in a cycle of 216 by its slot, past the gate's 144:
// no two Hollows running share an Ending or an omen, every Ending meets every pair once. Its fight's profile
// (net/sdRemnant.js sdFightProfile) runs by them - the Brazen Hide's health, the Quickened Gears' wind-ups, the Short
// Hour, the Hardened Hearts, the Burning Brass, the Restless Pulse, the Unending Reset, the Twin Hands; each Ending's
// signature (the Lion's Roar, Sunfall, the Turning Tide, the Tusk, the Hungering Heart, the Dragon's Break) and element.
// Every blow whose shape they change carries the change on its own frame (`sh`), so every screen judges, draws and reads
// the blow the relay threw; a fight with no marks frames as it always did. The Orrery frays by them. The wire bounds them;
// the link keeps them; the relay births every fight with its slot's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_ENDINGS, SD_OMENS, SD_ELEMENTS, SD_OMENS_A_HOLLOW, sdMarksCycle, sdMarksOf, sdMarksLaw, validSdMarks, sdEndingOf, sdOmensOf, disjointRing,
} from '../src/net/sdMarks.js';
import {
  SD_BLOWS, SD_BODY, SD_SHARE_X, SD_TTK_S, SD_ENDS_MS, SD_PULSE_EVERY_MS, SD_ECHO_PAIR_MS, SD_RESET_EVERY_MS, SD_ECHO_HAND_EVERY_MS, SD_REM, SD_ECHO,
  SD_PULSE_PCT, SD_PHASE_AT, sdFightProfile, profileOf, blowShape, atkWindup, pulsePctOf, shapeStamp, windupFor, newRemnantFight, joinRemnant,
  stepRemnant, remnantStateOf, stompFrontAt, ringPassed, handSwept, handAngleAt, applyRemnantHit, applyEchoHit, heartHpFor, heartCountFor,
} from '../src/net/sdRemnant.js';
import { sdBlowVerdict, sdVolleyPools } from '../src/net/sdStrike.js';
import { SD_STONES, SD_FRAY_MAX, orreryOf, orreryStep, orreryFresh } from '../src/net/sdBrain.js';
import { validSdOut, SD_TARGETS_MAX } from '../src/net/wire.js';
import { foldSdFight, SD_FIGHT_EMPTY } from '../src/net/sdFightLink.js';
import { dpsRef, HIT_KINDS } from '../src/net/gateBrain.js';
import { sdTelegraphShapes } from '../src/scenes/sdRemnantBlows.js';
import { remnantBarModel } from '../src/ui/sdRemnantBar.js';
import { createSdBeats, sdBreakSub, sdPerilAt } from '../src/scenes/sdArenaRead.js';
import { remnantRig, sdBeamsAt, TWIST } from '../src/scenes/sdRemnantRig.js';

const T0 = 1_800_000_000_000;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const fightOf = (mk, n = 4, lv = 30) => { const f = newRemnantFight(4, 1, T0, mk); for (let k = 0; k < n; k++) joinRemnant(f, `p${k}`, `P${k}`, lv, T0); return f; };
const ringOf = (f, r = 6) => Object.keys(f.players).map((sub, k, all) => { const a = (k / all.length) * Math.PI * 2; return { sub, x: Math.sin(a) * r, z: Math.cos(a) * r, dead: false }; });
function beatTo(f, from, until, bodiesAt, rng = seeded(5)) {
  const out = [];
  for (let now = from; now <= until; now += 250) for (const x of stepRemnant(f, now, bodiesAt(now), rng)) out.push({ now, ...x });
  return out;
}
const atk = (A, more = {}) => ({ k: 'atk', b: 0, i: 3, a: A.id, at: T0, x: 0, z: 0, yw: 0, tg: [], ...more });

test('SD18a THE MARKS: six Endings, the Orrery\'s own stones, each an element and a signature; nine omens; two a Hollow - a cycle of 216 past the gate\'s 144, every one once, no two running sharing an Ending or an omen, every Ending with every pair once, by the slot', () => {
  assert.deepEqual(SD_ENDINGS.map((e) => [e.id, e.stone, e.sign]), SD_STONES.map((s) => [s.key, s.name, s.sign]), 'the Orrery\'s stones');
  assert.ok(SD_ENDINGS.every((e) => SD_ELEMENTS.includes(e.el) && e.light.length === 3 && e.sig && e.text && Object.keys(e.law).length > 0));
  assert.equal(new Set(SD_ENDINGS.map((e) => e.sig)).size, 6, 'six signatures');
  assert.equal(SD_OMENS.length, 9); assert.equal(SD_OMENS_A_HOLLOW, 2);
  assert.ok(SD_OMENS.every((o) => o.name && o.text && Object.keys(o.law).length > 0));
  const known = ['stompR', 'stompR1', 'stompWave', 'handArc', 'handActive', 'volleyMax', 'poolMsX', 'poolRX', 'remSpeedX', 'echoSpeedX', 'pulseMs', 'pairMs', 'hpX', 'windX', 'endsMs', 'heartX', 'fray', 'pulseStep', 'resetMs', 'pairHandMs'];
  assert.ok([...SD_ENDINGS, ...SD_OMENS].every((m) => Object.keys(m.law).every((k) => known.includes(k))), 'every law a profile reads');
  const c = sdMarksCycle();
  assert.equal(c.length, 6 * 36); assert.ok(c.length > 144, 'past the gate\'s');
  assert.equal(new Set(c.map((m) => m.join())).size, 216, 'every one once');
  for (let k = 0; k < c.length; k++) {
    const a = c[k], b = c[(k + 1) % c.length];
    assert.notEqual(a[0], b[0], `no Ending twice running at ${k}`);
    assert.ok(!a.slice(1).some((o) => b.slice(1).includes(o)), `no omen twice running at ${k}`);
    assert.ok(validSdMarks(a));
  }
  for (const e of SD_ENDINGS) assert.equal(c.filter((m) => m[0] === e.id).length, 36);
  for (const o of SD_OMENS) assert.equal(c.filter((m) => m.includes(o.id)).length, 48);
  assert.deepEqual(sdMarksOf(1), c[0]); assert.deepEqual(sdMarksOf(217), c[0]); assert.deepEqual(sdMarksOf(216), c[215]); assert.deepEqual(sdMarksOf(0), c[215]);
  assert.equal(sdMarksCycle(), c, 'kept');
  const ring = disjointRing(9);
  assert.equal(ring.length, 36);
  assert.ok(!validSdMarks(['daggerfall', 'brazen', 'brazen']) && !validSdMarks(['nowhere', 'brazen', 'short']) && !validSdMarks(['daggerfall', 'brazen']) && !validSdMarks(null));
  assert.equal(sdEndingOf(['wayrest', 'twin', 'short']).stone, 'Wayrest');
  assert.deepEqual(sdOmensOf(['wayrest', 'twin', 'short']).map((o) => o.name), ['The Twin Hands', 'The Short Hour']);
  assert.ok(near(sdMarksLaw(['sentinel', 'burning', 'short']).poolMsX, 3), 'multipliers multiplied: Sunfall\'s and the Burning Brass\'s');
});

test('SD18a THE FIGHT\'S PROFILE: with no marks the table\'s own, frame for frame; each Ending\'s signature its number; each omen its own; kept and frozen; stamps only what differs, the element on its own blows alone', () => {
  const P0 = sdFightProfile(null);
  assert.deepEqual([P0.hpX, P0.windX, P0.heartX, P0.endsMs, P0.pulseMs, P0.pairMs, P0.resetMs, P0.pairHandMs, P0.remSpeed, P0.echoSpeed, P0.volleyMax, P0.fray, P0.el],
    [1, 1, 1, SD_ENDS_MS, SD_PULSE_EVERY_MS, SD_ECHO_PAIR_MS, SD_RESET_EVERY_MS, SD_ECHO_HAND_EVERY_MS, SD_REM.speed, SD_ECHO.speed, 5, SD_FRAY_MAX, null]);
  assert.deepEqual(P0.stomp, { r: 7, r1: 22, wave: 10 }); assert.deepEqual(P0.hand, { arc: Math.PI, active: 4000 }); assert.deepEqual(P0.pool, { r: 3, ms: 6000 });
  for (const A of Object.values(SD_BLOWS)) assert.equal(shapeStamp(P0, A, A.windup), null, `${A.key}: nothing stamped`);
  const P = (e, o1 = 'brazen', o2 = 'short') => sdFightProfile([e, o1, o2]);
  assert.deepEqual([P('daggerfall').stomp.r1, P('daggerfall').stomp.wave], [26, 13], 'the Lion\'s Roar');
  assert.deepEqual([P('sentinel').volleyMax, P('sentinel').pool.ms], [7, 9000], 'Sunfall');
  assert.deepEqual([P('wayrest').hand.arc, P('wayrest').hand.active], [1.5 * Math.PI, 5000], 'the Turning Tide');
  assert.deepEqual([P('orsinium').stomp.r, P('orsinium').remSpeed], [8.5, SD_REM.speed * 1.4], 'the Tusk');
  assert.equal(P('underking').pulseMs, 22_000, 'the Hungering Heart');
  assert.deepEqual([P('blades').pairMs, P('blades').echoSpeed], [10_000, SD_ECHO.speed * 1.2], 'the Dragon\'s Break');
  assert.deepEqual([P('wayrest').hpX, P('wayrest').endsMs], [1.25, 12 * 60_000], 'the Brazen Hide, the Short Hour');
  const Q = sdFightProfile(['sentinel', 'quickened', 'burning']);
  assert.deepEqual([Q.windX, Q.pool.ms, Q.pool.r], [0.85, 18_000, 4], 'the Quickened Gears; Sunfall and the Burning Brass together');
  assert.deepEqual([sdFightProfile(['blades', 'hardened', 'fraying']).heartX, sdFightProfile(['blades', 'hardened', 'fraying']).fray], [1.5, 36]);
  assert.deepEqual([sdFightProfile(['blades', 'restless', 'unending']).pulseStep, sdFightProfile(['blades', 'restless', 'unending']).resetMs, sdFightProfile(['blades', 'twin', 'short']).pairHandMs], [0.04, 40_000, 10_000]);
  assert.equal(sdFightProfile(['blades', 'twin', 'short']), sdFightProfile(['blades', 'twin', 'short']), 'kept');
  assert.ok(Object.isFrozen(Q) && Object.isFrozen(Q.pool));
  assert.equal(sdFightProfile(['nowhere', 'twin', 'short']), P0, 'marks that are not marks: the table');
  // the stamps
  assert.deepEqual(shapeStamp(P('daggerfall'), SD_BLOWS.stomp, 1800), { el: 'shock', r1: 26, wave: 13 });
  assert.deepEqual(shapeStamp(Q, SD_BLOWS.volley, 1700), { el: 'fire', w: 1700, pr: 4, pm: 18_000 });
  assert.deepEqual(shapeStamp(P('wayrest'), SD_BLOWS.hand, 1600), { el: 'frost', arc: 1.5 * Math.PI, active: 5000 });
  assert.equal(shapeStamp(P('wayrest'), SD_BLOWS.reset, 8000), null, 'the Reset no-one\'s');
  assert.equal(shapeStamp(P('wayrest'), SD_BLOWS.end, 2000), null);
  assert.deepEqual(shapeStamp(sdFightProfile(['wayrest', 'restless', 'short']), SD_BLOWS.pulse, 2500), { ps: 0.04 }, 'a Restless Pulse its step, no element');
});

test('SD18a THE LAW UNDER ITS MARKS: the Brazen Hide\'s health; the Short Hour; the Hungering Heart\'s Pulse; Sunfall\'s seven; the Quickened Gears\' wind-up stamped; the element on its own blows; the Dragon\'s Break\'s ten seconds; the Hardened Hearts; the Unending Reset; a fight with no marks frames as it did', () => {
  const plain = fightOf(null), brazen = fightOf(['underking', 'brazen', 'short']);
  assert.ok(near(brazen.max, plain.max * 1.25, 1e-6), 'a quarter more');
  assert.ok(near(plain.max, 4 * SD_TTK_S * dpsRef(30) * SD_SHARE_X, 1e-6));
  assert.deepEqual([brazen.endsAt - brazen.op, brazen.pulseAt - brazen.op], [12 * 60_000, 22_000]);
  assert.deepEqual(brazen.mk, ['underking', 'brazen', 'short']); assert.equal(plain.mk, undefined);
  assert.deepEqual(remnantStateOf(brazen).mk, brazen.mk); assert.equal('mk' in remnantStateOf(plain), false);
  // the Pulses come every 22 s, each stamped with nothing (no step changed) - and with the Restless Pulse its step
  const pulses = beatTo(brazen, T0, brazen.op + 50_000, () => ringOf(brazen)).filter((x) => x.k === 'atk' && x.b === SD_BODY.hour);
  assert.deepEqual(pulses.map((x) => x.at - brazen.op), [22_000, 44_000]);
  assert.ok(pulses.every((x) => !x.sh));
  const restless = fightOf(['underking', 'restless', 'short']);
  const rp = beatTo(restless, T0, restless.op + 50_000, () => ringOf(restless)).filter((x) => x.k === 'atk' && x.b === SD_BODY.hour);
  assert.deepEqual(rp.map((x) => x.sh), [{ ps: 0.04 }, { ps: 0.04 }]);
  assert.ok(near(pulsePctOf(rp[1]), SD_PULSE_PCT + 0.04), 'the second strikes four more');
  assert.ok(near(pulsePctOf({ n: 1 }), SD_PULSE_PCT + 0.02), 'unstamped: the table\'s');
  // Sunfall: seven marks, its brass longer; the Quickened Gears: wind-ups stamped, a share of the law's
  const sun = fightOf(['sentinel', 'quickened', 'burning'], 9);
  const blows = beatTo(sun, T0, sun.op + 60_000, () => ringOf(sun, 12), seeded(11)).filter((x) => x.k === 'atk' && x.b === SD_BODY.remnant);
  const volley = blows.find((x) => x.a === SD_BLOWS.volley.id);
  assert.ok(volley, 'it throws a Volley');
  assert.equal(volley.tg.length, 7, 'seven');
  assert.deepEqual([volley.sh.el, volley.sh.w, volley.sh.pm, volley.sh.pr], ['fire', Math.round(SD_BLOWS.volley.windup * 0.85), 18_000, 4]);
  assert.equal(volley.at - volley.now, volley.sh.w, 'its landing the stamped wind-up on');
  assert.ok(blows.every((x) => x.sh?.el === 'fire'), 'every one of its own blows its Ending\'s element');
  // the Tusk walks the faster
  const tusk = fightOf(['orsinium', 'twin', 'short'], 4);
  const walk = beatTo(tusk, T0, tusk.op + 20_000, () => ringOf(tusk, 20), seeded(2)).find((x) => x.k === 'mv' && x.b === SD_BODY.remnant && x.v > 0);
  assert.ok(walk && near(walk.v, SD_REM.speed * 1.4, 1e-9), `its walk: ${walk?.v}`);
  // a fight with no marks: no shape on any frame
  const pf = fightOf(null, 9), pb = beatTo(pf, T0, pf.op + 60_000, () => ringOf(pf, 12), seeded(11));
  assert.ok(pb.filter((x) => x.k === 'atk').every((x) => !('sh' in x)));
  // the Dragon's Break: one Echo felled and left alone rises again ten seconds on, not fifteen
  const bl = fightOf(['blades', 'hardened', 'unending']);
  bl.hp = SD_PHASE_AT[0] * bl.max - 1;
  beatTo(bl, T0, bl.op + 1000, () => ringOf(bl));
  assert.equal(bl.phase, 2);
  const E = bl.ec[0], up = E.up;
  let now = Math.max(up, bl.op + 1000) + 10;
  stepRemnant(bl, now, ringOf(bl), seeded(3));
  const sub = 'p0';
  bl.players[sub].bucket = 1e12; bl.players[sub].rate = 1e9;
  while (E.h > 0) { applyEchoHit(bl, sub, 0, 1e6, HIT_KINDS.Missile, { x: E.body.x, z: E.body.z - 3 }, now, null); now += 300; bl.players[sub].bucket = 1e12; bl.players[sub].rate = 1e9; }
  const downAt = E.downAt;
  stepRemnant(bl, downAt + 9_900, ringOf(bl), seeded(3));
  assert.equal(E.h, 0, 'down at 9.9 s');
  stepRemnant(bl, downAt + 10_000, ringOf(bl), seeded(3));
  assert.ok(E.h > 0, 'risen again at 10 s');
  // the Hardened Hearts: half again; the Unending Reset: forty seconds on from its return
  const hh = fightOf(['blades', 'hardened', 'unending']);
  hh.hp = SD_PHASE_AT[1] * hh.max - 1; hh.phase = 2;
  hh.ec = [0, 1].map((e) => ({ e, h: 0, m: 1, up: T0, downAt: T0, body: { x: 0, z: 0, yw: 0, mv: null, atk: null } }));   // both Echoes down: the Last Moment next beat
  const words = beatTo(hh, T0, hh.op + 60_000, () => ringOf(hh));
  const ph3 = words.find((x) => x.k === 'ph' && x.n === 3), cx = words.find((x) => x.k === 'cx');
  assert.ok(ph3 && cx, 'the Last Moment, the Hearts');
  assert.equal(cx.m, Math.round(heartHpFor(Array(4).fill(30), heartCountFor(4)) * 1.5));
  const reset = words.find((x) => x.k === 'atk' && x.a === SD_BLOWS.reset.id);
  assert.ok(reset.now >= ph3.up + 40_000 && reset.now < ph3.up + SD_RESET_EVERY_MS, `forty seconds from its return (its blow in flight let land first): ${reset.now - ph3.up}`);
  assert.equal(reset.at - reset.now, SD_BLOWS.reset.windup, 'the Reset\'s own wind-up, never quickened');
});

test('SD18a THE BLOW ITS FRAME SAYS: the Lion\'s ring to the rim, the Tusk\'s wider disc, the Turning Tide\'s sweep, Sunfall\'s burning brass, its element on every hit - judged on my feet, drawn on the floor, read under the crosshair, turned in its body', () => {
  // the Lion's Roar
  const lion = atk(SD_BLOWS.stomp, { sh: { el: 'shock', r1: 26, wave: 13 } });
  assert.ok(near(stompFrontAt(lion, T0 + 1500), 26) && near(stompFrontAt(lion, T0 + 1000), 7 + 13), 'faster, to the rim');
  assert.ok(near(stompFrontAt(atk(SD_BLOWS.stomp), T0 + 1500), 22), 'the table\'s to 22');
  assert.ok(ringPassed(lion, 25, T0 + 1200, T0 + 1500) && !ringPassed(atk(SD_BLOWS.stomp), 25, T0 + 1200, T0 + 1500));
  // the Tusk's disc: 8 m out struck by its 8.5, not the table's 7 - in its element
  const tusk = atk(SD_BLOWS.stomp, { sh: { el: 'poison', r: 8.5 } });
  const v = sdBlowVerdict(tusk, 8, 0, T0 - 16, T0 + 1, true);
  assert.deepEqual(v.hits.map((h) => [h.part, h.el]), [['disc', 'poison']]);
  assert.deepEqual(sdBlowVerdict(atk(SD_BLOWS.stomp), 8, 0, T0 - 16, T0 + 1, true).hits, []);
  // the Turning Tide: three quarters of the arena over five seconds - a body at 120 degrees off its facing swept
  const tide = atk(SD_BLOWS.hand, { sw: 1, sh: { el: 'frost', arc: 1.5 * Math.PI, active: 5000 } });
  const bx = Math.sin((2 * Math.PI) / 3) * 10, bz = Math.cos((2 * Math.PI) / 3) * 10;
  assert.ok(handSwept(tide, bx, bz, T0, T0 + 5000) && !handSwept(atk(SD_BLOWS.hand, { sw: 1 }), bx, bz, T0, T0 + 4000));
  assert.ok(near(handAngleAt(tide, T0 + 5000), 0.75 * Math.PI) && handAngleAt(tide, T0 + 4500) != null && handAngleAt(atk(SD_BLOWS.hand), T0 + 4500) === null);
  assert.equal(blowShape(tide), blowShape(tide), 'one shape a frame');
  assert.equal(blowShape(atk(SD_BLOWS.hand)), SD_BLOWS.hand, 'unstamped: the table\'s own');
  // Sunfall's brass: wider and longer, in its element
  const sun = atk(SD_BLOWS.volley, { tg: [[0, 0]], sh: { el: 'fire', pr: 4, pm: 18_000 } });
  assert.deepEqual(sdVolleyPools(sun).map((p) => [p.r, p.until - p.from, p.el]), [[4, 18_000, 'fire']]);
  assert.deepEqual(sdVolleyPools(atk(SD_BLOWS.volley, { tg: [[0, 0]] })).map((p) => [p.r, p.until - p.from, p.el]), [[3, 6000, undefined]]);
  // its wind-up as stamped
  assert.equal(atkWindup(atk(SD_BLOWS.stomp, { sh: { w: 1530 } }), SD_BLOWS.stomp, 1, SD_BODY.remnant), 1530);
  assert.equal(atkWindup(atk(SD_BLOWS.stomp), SD_BLOWS.stomp, 3, SD_BODY.remnant), windupFor(SD_BLOWS.stomp, 3, SD_BODY.remnant));
  // drawn on the floor by its shape
  const disc = sdTelegraphShapes({ ...tusk, at: T0 + 500 }, SD_BODY.remnant, 1, T0)[0];
  assert.equal(disc.r, 8.5);
  const cone = sdTelegraphShapes({ ...tide, at: T0 + 500 }, SD_BODY.remnant, 1, T0)[0];
  assert.ok(near(cone.halfArc, 0.75 * Math.PI));
  const quick = sdTelegraphShapes({ ...atk(SD_BLOWS.stomp, { sh: { w: 1000 } }), at: T0 + 500 }, SD_BODY.remnant, 1, T0)[0];
  assert.ok(near(quick.t, 0.5), 'its fill by the stamped wind-up');
  // read under the crosshair: at 8 m in the Tusk's disc, "in it"
  const s = { ...SD_FIGHT_EMPTY, fi: 1, s: 4, ph: 1, op: T0 - 60_000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: { ...tusk, at: T0 + 500 } } };
  assert.equal(sdPerilAt(s, T0, 8, 0, 0)?.name, SD_BLOWS.stomp.name);
  assert.equal(sdPerilAt({ ...s, rem: { ...s.rem, atk: { ...atk(SD_BLOWS.stomp), at: T0 + 500 } } }, T0, 8, 0, 0), null);
  // its body turns with the Tide: at the sweep's end, three eighths of a turn past its facing
  const rs = { ...s, rem: { ...s.rem, atk: tide } };
  assert.ok(near(remnantRig(rs, -1, T0 + 4999).trunk[TWIST], 0.75 * Math.PI, 1e-3));
  assert.ok(near(sdBeamsAt(rs, T0 + 4999)[0].bearing, 0.75 * Math.PI, 1e-3) && sdBeamsAt(rs, T0 + 4500).length === 1);
});

test('SD18a THE WIRE AND THE PAGE: a blow\'s shape bounded key by key, an element the known ones\'; a state\'s marks projected when they are marks; the link keeps both and reads its Reset\'s clock by them; the bar\'s "rises again" and the Dragon Break\'s card by the Dragon\'s Break\'s ten; the Orrery frays by them; the relay births every fight with its slot\'s', () => {
  const base = { k: 'atk', b: 0, i: 2, a: 0, at: T0, x: 0, z: 0, yw: 0, tg: [] };
  assert.deepEqual(validSdOut({ ...base, sh: { el: 'shock', r1: 26, wave: 13 } }).sh, { el: 'shock', r1: 26, wave: 13 });
  for (const bad of [{ el: 'light' }, { r1: 99 }, { nope: 1 }, { w: -1 }, { arc: 9 }, []]) assert.equal(validSdOut({ ...base, sh: bad }), null, JSON.stringify(bad));
  assert.equal('sh' in validSdOut(base), false);
  assert.equal(SD_TARGETS_MAX, 7);
  const f = fightOf(['blades', 'hardened', 'unending']), st = remnantStateOf(f);
  assert.deepEqual(validSdOut(st).mk, ['blades', 'hardened', 'unending']);
  assert.equal('mk' in validSdOut({ ...st, mk: ['blades', 'blades', 'short'] }), false, 'marks that are not marks dropped');
  let s = foldSdFight(SD_FIGHT_EMPTY, validSdOut(st), T0);
  assert.deepEqual(s.mk, ['blades', 'hardened', 'unending']);
  assert.equal(profileOf(s).pairMs, 10_000);
  s = foldSdFight(s, validSdOut({ ...base, sh: { el: 'fire', w: 900 } }), T0);
  assert.deepEqual(s.rem.atk.sh, { el: 'fire', w: 900 }, 'the blow its shape');
  const stun = foldSdFight(s, validSdOut({ k: 'stun', until: T0 + 8000, at: T0 }), T0);
  assert.equal(stun.rk, T0 + 8000 + 40_000, 'the Unending Reset\'s clock');
  const p3 = foldSdFight(s, validSdOut({ k: 'ph', n: 3, at: T0, up: T0 + 2500 }), T0);
  assert.equal(p3.rk, T0 + 2500 + 40_000);
  // the bar's "rises again" and the card
  const brk = { ...s, ph: 2, op: T0 - 60_000, h: 500, m: 1000, ec: [{ x: 0, z: 0, yw: 0, mv: null, atk: null, h: 0, m: 100, up: T0 - 9000, dn: T0 - 4000 }, { x: 5, z: 0, yw: 0, mv: null, atk: null, h: 80, m: 100, up: T0 - 9000, dn: 0 }] };
  const bar = remnantBarModel(brk, T0);
  assert.equal(bar.callout?.text, 'Gold rises in 6s', 'the callout: six seconds, not eleven');
  const beats = createSdBeats();
  beats.frame({ ...s, ph: 1, op: T0 - 60_000 }, T0);
  const card = beats.frame({ ...s, ph: 2, op: T0 - 60_000 }, T0 + 10);
  assert.equal(card.sub, sdBreakSub(10_000));
  assert.match(card.sub, /within 10 seconds/);
  // the Orrery's fray by its Hollow's marks
  const fraySlot = [...Array(216).keys()].map((k) => k + 1).find((sl) => sdMarksOf(sl).includes('fraying')), plainSlot = [...Array(216).keys()].map((k) => k + 1).find((sl) => !sdMarksOf(sl).includes('fraying'));
  assert.deepEqual([orreryOf(fraySlot).fray, orreryOf(plainSlot).fray], [36, SD_FRAY_MAX]);
  const o = orreryOf(fraySlot);
  let h = orreryFresh(o), snapped = null;
  for (let k = 0; k < 60 && !snapped; k++) { const r = orreryStep(o, h, k % 6, k % 2 ? 1 : -1); if (r.x) snapped = k + 1; h = r; if (r.ok) break; }
  assert.ok(snapped === 36 || h.ok, `snapped back at its thirty-sixth turn: ${snapped}`);
  // the relay
  const src = readFileSync(new URL('../server/src/index.js', import.meta.url), 'utf8');
  assert.match(src, /newRemnantFight\(s, \(f\?\.fi \?\? 0\) \+ 1, now, sdMarksOf\(s\)\);/);
});
