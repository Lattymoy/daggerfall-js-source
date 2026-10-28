// AUDIT WORLD-EVENTS L1-4 (2026-10-25; bible/01-Overview/audits/Audit-World-Events.md) - RAISE BEFORE THE FALL, the
// owner's answer to what Resurrect means in the Spire and the Sky-Ketch ("Raise before the fall"): "Resurrect allowed"
// did nothing in either - a death there was caught by a death save and was the fall at once, with no body for a spell.
// Now a death lays the member DOWN where it fell for a minute, and a party member's Resurrect at the body stands it up in
// the fight; otherwise it falls as before. The Spire's brain (net/eliteGates/egBrain.js egLayDown, egRezMember), the
// Ketch's (net/ketch/ketchBrain.js ketchRaise), the wire both ways, and the pages' halves by source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, validEgIn, validKetchIn, validKetchOut } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS, EG_ARRIVE_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';
import { egBreachNew, egEnter, egStep, egWord, EG_DOWN_MS, EG_REZ_REACH_M, EG_REZ_PCT } from '../../../src/net/eliteGates/egBrain.js';
import { ketchRaise, KT_DOWN_MS, KT_REZ_REACH_M, KT_REZ_PCT } from '../../../src/net/ketch/ketchBrain.js';
import { RESURRECT_HEALTH_PCT } from '../../../src/systems/resurrect.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const MIN = 60_000;
const wire = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };

/** egaudit5_a2.test.js's breach of `n`, every member admitted on hall `h`'s plate, its director beaten by `step`. */
function breach(n, h, seed = 12345) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  egGive8(seed, [egCircleOfHall(h), egCircleOfHall(h) + 1]);
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * MIN, at: 0 }; B.pulledAt = now; B.su = now + EG_ARRIVE_MAX_MS;
  const pos = {};
  const spec = () => egHallOf(seed, B.h, 0);
  for (const [sub] of co) pos[sub] = { x: spec().arrive.x + Number(sub.slice(5)) * 0.5, z: spec().arrive.z };
  const frames = [];
  let bad = 0;
  const step = (ms = 250) => {
    now += ms;
    const sp = spec();
    const o = egStep(B, now, co.filter(([sub]) => B.mem[sub].alive && pos[sub]).map(([sub]) => ({ sub, sx: sp.x0 + pos[sub].x, z: pos[sub].z, dead: false, at: now })), rng);
    for (const f of o) if (!wire(f)) bad++;
    frames.push(...o);
    return o;
  };
  const toTrial = () => { for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step(); assert.equal(B.sg, 'trial'); };
  const poseOf = (sub, dx = 0) => ({ sx: spec().x0 + pos[sub].x + dx, y: 0, z: pos[sub].z });
  const word = (sub, m, pose) => { const o = egWord(B, sub, m, pose, now, rng); for (const f of o) if (!wire(f)) bad++; frames.push(...o); return o; };
  return { B, pos, step, toTrial, poseOf, word, frames, bad: () => bad, now: () => now, tick: (ms) => (now += ms) };
}

test('AUDIT WORLD-EVENTS L1-4 THE SPIRE: a death in a hall\'s fight with a companion standing lays the member down where it fell - out of the fight, its Reliquaries kept, the company told; a party member\'s Resurrect at the body stands it there at 30%, named; from afar, from the fallen or past the window nothing (mutants: the fall at once; the reach unread; the window unread; the raised still out)', () => {
  const S = breach(3, 1);
  S.toTrial();
  const m1 = S.B.mem['acct-1'];
  m1.rel = [1];
  const o = S.word('acct-1', { k: 'fell' }, S.poseOf('acct-1'));
  assert.deepEqual(o.map((f) => f.k), ['down', 'co'], 'down, not fallen');
  assert.equal(o[0].until, S.now() + EG_DOWN_MS);
  assert.deepEqual([m1.alive, m1.falls ?? 0, m1.rel, S.B.mementos.length], [0, 0, [1], 0], 'out of the fight; no fall counted, nothing lost, no Memento');
  assert.equal(S.word('acct-0', { k: 'rz', to: 'acct-1' }, S.poseOf('acct-1', EG_REZ_REACH_M + 2)).length, 0, 'from afar: nothing');
  assert.equal(S.word('acct-2', { k: 'rz', to: 'acct-0' }, S.poseOf('acct-0')).length, 0, 'one standing is raised by nobody');
  const m2 = S.B.mem['acct-2'], stood = { alive: m2.alive, down: m2.down };
  Object.assign(m2, { alive: 0, down: S.now() });   // a second member lying down beside it
  assert.equal(S.word('acct-2', { k: 'rz', to: 'acct-1' }, S.poseOf('acct-1', 1)).length, 0, 'one lying down raises nobody');
  Object.assign(m2, stood);
  const r = S.word('acct-0', { k: 'rz', to: 'acct-1' }, S.poseOf('acct-1', 1));
  const rise = r.find((f) => f.k === 'rise');
  assert.ok(rise && rise.to === 'acct-1' && rise.p === EG_REZ_PCT && rise.by === 'M0', 'raised at 30%, by name');
  assert.ok(r.some((f) => f.k === 'esay' && f.w === 'rezzed' && f.n === 'M1' && f.t === 'M0'), 'said to all');
  assert.deepEqual([m1.alive, m1.down], [1, 0], 'in the fight again');
  assert.equal(EG_REZ_PCT, RESURRECT_HEALTH_PCT / 100, 'Resurrect\'s own share');
  // past the window: the fall, where it lay
  S.word('acct-2', { k: 'fell' }, S.poseOf('acct-2'));
  const at = { ...S.B.mem['acct-2'].downAt };
  S.tick(EG_DOWN_MS);
  assert.equal(S.word('acct-0', { k: 'rz', to: 'acct-2' }, S.poseOf('acct-2')).length, 0, 'past the window: nothing');
  S.step();
  assert.ok(S.frames.some((f) => f.k === 'fall' && f.s === 'acct-2'), 'the fall');
  assert.equal(S.B.mem['acct-2'].falls, 1);
  assert.deepEqual(S.B.mementos.map((q) => [q.s, q.x, q.z]), [['acct-2', at.x, at.z]], 'its Memento where it lay');
  assert.equal(S.bad(), 0, 'every frame the wire\'s');
});

test('AUDIT WORLD-EVENTS L1-4 THE SPIRE: the fall given in to (`yield`), a death with nobody else standing, the last standing down, and a hall cleared with one lying down are THE FALL as ever (mutants: the yield unheard; a lone member down; the downs outliving the wipe; the Redoubt passing them)', () => {
  const S = breach(2, 1);
  S.toTrial();
  S.word('acct-1', { k: 'fell' }, S.poseOf('acct-1'));
  S.word('acct-1', { k: 'yield' }, null);
  assert.equal(S.B.mem['acct-1'].falls, 1, 'given in to');
  const L = breach(1, 1);
  L.toTrial();
  assert.ok(L.word('acct-0', { k: 'fell' }, L.poseOf('acct-0')).some((f) => f.k === 'fall'), 'alone: nobody to raise it');
  const W = breach(2, 1);
  W.toTrial();
  W.word('acct-1', { k: 'fell' }, W.poseOf('acct-1'));
  W.word('acct-0', { k: 'fell' }, W.poseOf('acct-0'));
  W.step();
  assert.equal(W.B.mem['acct-1'].falls, 1, 'the last standing gone: the one down falls');
  const src = read('src/net/eliteGates/egBrain.js');
  assert.match(src, /function redoubt\(B, now, rng, out\) \{\n\s*for \(const \[sub, m\] of Object\.entries\(B\.mem\)\) if \(m\.down\) egFall\(B, sub, now, out, null\);/, 'a hall cleared: the downs fall first, for the Redoubt\'s recall');
  assert.match(src, /if \(!m \|\| m\.alive \|\| m\.down \|\| m\.forsaken \|\| !\(m\.recall > 0\)\) return false;/, 'the recall passes one lying down by');
  assert.match(src, /if \(b\.dead\) egLayDown\(B, b\.sub, now, out, spec0 \? local\(spec0, b\) : null\);/, 'the census\'s death lays down');
  assert.match(src, /egLayDown\(B, h\.sub, now, out, at && at\[4\] === B\.h \? \{ x: at\[1\], z: at\[3\] \} : null\);/, 'the count\'s fall lays down');
  assert.deepEqual([validEgIn({ k: 'yield' }), validEgIn({ k: 'rz', to: 'acct-1' }), validEgIn({ k: 'rz', to: '' })], [{ k: 'yield' }, { k: 'rz', to: 'acct-1' }, null]);
});

test('AUDIT WORLD-EVENTS L1-4 THE SKY-KETCH: a crewmate\'s Resurrect at a member lying on the deck raises it - alive aboard, within reach, inside the window - and the relay gives the raised a new life on the count; the wire both ways (mutants: the reach unread; the window unread; no new life)', () => {
  const V = { players: { a: { name: 'Ann' }, b: { name: 'Bo', lay: { x: 10, y: 0, z: 5, at: 1000 } } } };
  assert.equal(ketchRaise(V, 'a', 'b', { x: 10 + KT_REZ_REACH_M + 1, y: 0, z: 5 }, 2000), null, 'out of reach');
  assert.equal(ketchRaise(V, 'a', 'b', null, 2000), null, 'the caster lying too');
  assert.equal(ketchRaise(V, 'a', 'b', { x: 10, y: 0, z: 5 }, 1001 + KT_DOWN_MS), null, 'past the window');
  assert.deepEqual(ketchRaise(V, 'a', 'b', { x: 11, y: 0, z: 5 }, 2000), { k: 'rez', s: 'b', n: 'Bo', by: 'Ann', at: 2000 });
  assert.equal(V.players.b.lay, null, 'once');
  assert.equal(KT_REZ_PCT, RESURRECT_HEALTH_PCT / 100);
  assert.equal(KT_DOWN_MS, EG_DOWN_MS, 'one minute on the ship as in the Spire (the tile says one)');
  assert.deepEqual(validKetchIn({ k: 'rz', to: 'acct-b1' }), { k: 'rz', to: 'acct-b1' });
  assert.deepEqual(validKetchOut({ k: 'rez', s: 'acct-b1', n: 'Bo', by: 'Ann', at: 5 }), { k: 'rez', s: 'acct-b1', n: 'Bo', by: 'Ann', at: 5 });
  assert.match(read('server/src/index.js'), /for \(const r of out\) if \(r\.k === 'rez' && V\.players\[r\.s\]\) \{ bodyLife\(V\.players\[r\.s\], now, line\.body\); V\.players\[r\.s\]\.rzAt = now; \}/);   // PIN MOVED (AUDIT KETCH II L1-5): and the raise's moment kept
  assert.match(read('src/net/ketch/ketchBrain.js'), /p\.lay = b\.dead \? \(p\.lay\?\.at \? \{ \.\.\.p\.lay, x: b\.x, y: b\.y, z: b\.z \} : \{ x: b\.x, y: b\.y, z: b\.z, at: now \}\) : null;/, 'where a member lies, and since when');
});

test('AUDIT WORLD-EVENTS L1-4 THE PAGES, by source: the Spire\'s witness begins lying down (its body\'s pose where it fell, Enter to give in), the room\'s word deciding; the Ketch\'s death save lies down with a crewmate aboard, held still and spared, and falls past the window; a raise said to the room; the pose speaks the body (mutants: the pose of the witness\'s hold; the Ketch falling at once)', () => {
  const eg = read('src/scenes/eliteGates/egClient.js');
  assert.match(eg, /if \(!said && mine\?\.alive && witness\.spot && E\.co\.some\(\(c\) => c\[0\] !== me\(\) && c\[3\] === 1 && c\[4\] === 0 && c\[5\] === 1\)\) lieDown\(t \+ EG_DOWN_MS\);/);
  assert.match(eg, /if \(witness\?\.down && code === 'Enter'\) \{ o\?\.sendEg\?\.\('yield'\); return true; \}/);
  assert.match(eg, /o\.poseDown = inSpire\(\) \? downPose : null;/);
  assert.match(eg, /if \(w\.k === 'fall' && w\.s === me\(\) && witness\?\.down\) \{ witness\.down = 0;/);
  const kt = read('src/scenes/ketch/ketchClient.js');
  assert.match(kt, /registerPlayerDeathSave\('kt-fall', \(\) => \{ if \(!onShip\(\)\) return false; if \(!lieDown\('death'\)\) fall\('death'\); return true; \}\);/);
  assert.match(kt, /if \(Date\.now\(\) >= down\.until\) \{ const why = down\.why; down = null; fall\(why\); return; \}/);
  assert.match(kt, /registerPlayerDamageMod\('kt-down', \(_e, d\) => \(down \? 0 : d\)\);\n\s*registerPlayerHold\('kt-down', \(\) => !!down\);/);
  assert.match(read('src/scenes/worldModes.js'), /const paralyzed = staffFrozen\(\) \|\| playerHeld\(\) \|\|/);
  const on = read('src/net/online.js');
  assert.match(on, /const out = \{ \.\.\.pose, \.\.\.\(dn \? \{ x: dn\[0\], y: dn\[1\], z: dn\[2\], mv: 0, dd: 1 \} : \{\}\),/, 'my pose speaks my body where it lies');
  const rw = read('src/net/raiseWord.js');
  assert.match(rw, /if \(isEgRoom\(room\)\) return !!online\.sendEg\?\.\('rz', \{ to \}\);\n\s*if \(isKetchRoom\(room\)\) return !!online\.sendKetch\?\.\('rz', \{ to \}\);/);
});
