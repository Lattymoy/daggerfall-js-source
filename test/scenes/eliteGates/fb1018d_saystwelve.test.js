// FIELD BUGS 2026-10-18d - SAYS-PAST-TWELVE (found proving Boar's item 4, "their effect is unclear": the Conquest's word on the
// screen): EVERY BEAT'S WORD SAID, HOWEVER LONG THE FIGHT. The breach's fold keeps a hall's last EG_SAYS_KEPT words
// (net/eliteGates/egLink.js `esay`) and drops the oldest as each comes; the screen's fight said the words past a COUNT of them
// (scenes/eliteGates/egFight.js beats), and the count stood at twelve once the list was full - so from a hall's twelfth word on,
// no Muster-Call, no Conquest, no Challenge was said to anyone for the rest of the fight. Pinned on the producers: a Rotunda
// the law lays woken on the relay's director, the word it says (a `muster` its own), through the wire (validEgOut) into a
// member's state (foldEg) again and again, and the screen's fight over it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState } from '../../../src/net/eliteGates/egBodies.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY, EG_SAYS_KEPT } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight, EG_SAY } from '../../../src/scenes/eliteGates/egFight.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

test('SAYS-PAST-TWELVE (FIELD BUGS 2026-10-18d): EVERY WORD SAID PAST THE FOLD\'S TWELVE - the director\'s Muster-Call said into a member\'s state three times over EG_SAYS_KEPT is said on the screen each time it comes, the fold keeping its twelve; a screen that opens on the fight already running says none of the words before it (mutants: the words past the last said never found; the last said never kept; a new screen saying the whole list)', () => {
  let found = null;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const plan = egCirclePlan(seed, 5);
    for (let k = 0; k < plan.length && !found; k++) { const spec = egHallOf(seed, egFirstHallOf(5) + k, 0); if (spec.kind === 'court' && spec.lord === 'ilthys') found = { seed, spec }; }
  }
  assert.ok(found, 'a Rotunda laid');
  const { seed, spec } = found, h = spec.h, rng = seeded(seed), co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  const { k: _k, ...st } = egStateOf(B, now);
  let E = foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now);
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.fight.x, z: spec.fight.z - 3, y: spec.fight.y };
  // the director's own word: its first Muster-Call
  let muster = null;
  for (let k = 0; k < 400 && !muster; k++) for (const fr of step()) { if (!fr.to || fr.to === 'acct-0') E = foldEg(E, wire(fr), now); if (fr.k === 'esay' && fr.w === 'muster') muster = fr; }
  assert.ok(muster, 'the Muster-Call said');
  const screen = () => {
    const said = [];
    const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
      feet: () => egToDungeon(spec, spec.fight.x, spec.fight.y ?? 0, spec.fight.z - 3), peerAt: () => null, say: (t) => said.push(t) });
    return { fight, said };
  };
  const S = screen();
  S.fight.frame();
  assert.deepEqual(S.said, [], 'a screen opened on the fight running says none of the words before it');
  const n = 3 * EG_SAYS_KEPT;
  for (let j = 0; j < n; j++) { now += 400; E = foldEg(E, wire(muster), now); S.fight.frame(); }
  assert.equal(E.fight.says.length, EG_SAYS_KEPT, 'the fold keeps its twelve');
  assert.deepEqual(S.said, Array(n).fill(EG_SAY.muster()), 'every one of them said as it came');
  // two at once, between two frames
  E = foldEg(foldEg(E, wire(muster), now), wire({ k: 'esay', w: 'conquest' }), now);
  S.fight.frame();
  assert.deepEqual(S.said.slice(n), [EG_SAY.muster(), EG_SAY.conquest()], 'two in one frame, both, in order');
});

test('SAYS-PAST-TWELVE (AUDIT FB1018D L5-5): MORE THAN EG_SAYS_KEPT WORDS BETWEEN TWO FRAMES - a hidden tab\'s fold runs on while its frames stop, and the last word said is dropped from it: the screen says the twelve the fold kept, never none (mutant: a dropped last word read as every word said)', () => {
  let found = null;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const plan = egCirclePlan(seed, 5);
    for (let k = 0; k < plan.length && !found; k++) { const spec = egHallOf(seed, egFirstHallOf(5) + k, 0); if (spec.kind === 'court' && spec.lord === 'ilthys') found = { seed, spec }; }
  }
  const { seed, spec } = found, h = spec.h, rng = seeded(seed), co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
  const { k: _k, ...st } = egStateOf(B, now);
  let E = foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now);
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.fight.x, z: spec.fight.z - 3, y: spec.fight.y };
  let muster = null;
  for (let k = 0; k < 400 && !muster; k++) for (const fr of step()) { if (!fr.to || fr.to === 'acct-0') E = foldEg(E, wire(fr), now); if (fr.k === 'esay' && fr.w === 'muster') muster = fr; }
  assert.ok(muster);
  const said = [];
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => egToDungeon(spec, spec.fight.x, spec.fight.y ?? 0, spec.fight.z - 3), peerAt: () => null, say: (t) => said.push(t) });
  fight.frame();
  now += 400; E = foldEg(E, wire(muster), now); fight.frame();
  assert.equal(said.length, 1, 'one said');
  for (let j = 0; j < EG_SAYS_KEPT + 1; j++) { now += 400; E = foldEg(E, wire(muster), now); }   // the tab hidden: folded, no frame
  fight.frame();
  assert.equal(said.length, 1 + EG_SAYS_KEPT, 'back: the twelve the fold kept are said');
  assert.deepEqual(said.slice(1), Array(EG_SAYS_KEPT).fill(EG_SAY.muster()));
});
