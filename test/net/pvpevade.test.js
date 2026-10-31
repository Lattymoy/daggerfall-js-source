// PVP-EVADE (2026-10-30, as the owner asked): a swing or a shaft that hit a player is still evaded whole - live Dodging 0.05% a point to 25%, 2% a level
// over the striker to 20%, a gear power's evade, all to 40%. The relay rolls it; a spell is never evaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PVP_EVADE, pvpEvadeChance, takeHealthReport, newHealthShare } from '../../src/net/siege/refereeHealthShare.js';
import { newWildRef, wildZone, wildBlow, WILD_GRACE } from '../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M, SIEGE_HIT, newFighter } from '../../src/net/siege/siegeRef.js';
import { validVitIn, validWildRefOut, VIT_DODGE_MAX, VIT_EVADE_MAX } from '../../src/net/wire.js';
import { createRefereeHealthMirror } from '../../src/net/siege/refereeHealthMirror.js';

const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
const FIST = { w: -1, m: 0 };
const body = (dodge = 0, evade = 0) => ({ share: { ...newHealthShare(0), dodge, evade } });
function zone(clA = 40, clB = 40, now = 10_000) {
  const st = newWildRef();
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, cl: clA, fl: 1 }, true, at(-0.5), now - WILD_GRACE.ms);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, cl: clB, fl: 1 }, true, at(0.5), now - WILD_GRACE.ms);
  st.fighters.get('acct-a').flag = true;
  return st;
}

test('PVP-EVADE the chance: 0.05% a Dodging point to 25% at 500, 2% a level over the striker to 20%, a gear power\'s on top, the whole to 40% (mutants: a cap, the level backwards)', () => {
  assert.deepEqual({ ...PVP_EVADE }, { perDodge: 0.05, dodgeMax: 25, perLevel: 2, levelMax: 20, max: 40, dodgeTop: 1000 });
  assert.equal(pvpEvadeChance(body(100), 40, 40), 5);
  assert.equal(pvpEvadeChance(body(500), 40, 40), 25);
  assert.equal(pvpEvadeChance(body(900), 40, 40), 25, 'Dodging past 500 adds nothing');
  assert.equal(pvpEvadeChance(body(0), 35, 40), 10, 'five levels over: 10%');
  assert.equal(pvpEvadeChance(body(0), 40, 35), 0, 'under the striker: nothing');
  assert.equal(pvpEvadeChance(body(0), 30, 45), 20, 'fifteen levels over: held to 20%');
  assert.equal(pvpEvadeChance(body(0), null, 45), 0, 'an unsigned level: no level part');
  assert.equal(pvpEvadeChance(body(500), 30, 45), 40, '25 + 20 held to 40');
  assert.equal(pvpEvadeChance(body(200, 15), 40, 40), 25, 'the Raven\'s 15 on Dodging\'s 10');
  assert.equal(pvpEvadeChance(body(400, 15), 30, 40), 40, '20 + 20 + 15 held to 40');
  assert.equal(pvpEvadeChance({}, 30, 40), 20, 'nothing reported: the level alone');
});

test('PVP-EVADE the report: `dg` and `pe` ride the health report, bounded, kept on the share; an older report leaves them (mutants: no bound)', () => {
  assert.equal(VIT_DODGE_MAX, PVP_EVADE.dodgeTop);
  assert.equal(VIT_EVADE_MAX, PVP_EVADE.max);
  const ok = validVitIn({ n: 1, s: 10_000, seen: [], dg: 480, pe: 15 });
  assert.equal(ok.dodge, 480); assert.equal(ok.evade, 15);
  assert.equal(validVitIn({ n: 1, s: 10_000, seen: [], dg: VIT_DODGE_MAX + 1 }), null);
  assert.equal(validVitIn({ n: 1, s: 10_000, seen: [], pe: 41 }), null);
  assert.equal(validVitIn({ n: 1, s: 10_000, seen: [], dg: 1.5 }), null);
  const f = newFighter(10, 0);
  takeHealthReport(f, ok, 100);
  assert.equal(f.share.dodge, 480); assert.equal(f.share.evade, 15);
  takeHealthReport(f, validVitIn({ n: 2, s: 10_000, seen: [] }), 200);
  assert.equal(f.share.dodge, 480, 'a report without it keeps the last');
});

test('PVP-EVADE the client: the mirror sends my Dodging and gear evade, and a change in them is a report of its own', () => {
  const sent = [];
  let dg = 120, t = 0;
  const m = createRefereeHealthMirror({ read: () => ({ health: 50, maxHealth: 100 }), write: () => {}, send: (r) => { sent.push(r); return true; }, now: () => t, evasion: () => ({ dg, pe: 15 }) });
  m.frame(true);
  assert.equal(sent.length, 1); assert.equal(sent[0].dg, 120); assert.equal(sent[0].pe, 15);
  t += 1000; m.frame(true);
  assert.equal(sent.length, 1, 'nothing moved, nothing sent');
  dg = 300; t += 1000; m.frame(true);
  assert.equal(sent.length, 2); assert.equal(sent[1].dg, 300);
});

test('PVP-EVADE the roll: after the hit, a swing or a shaft the roll evades lands nothing (`why` evade, the fight still opened), one it misses lands; a spell is never evaded (mutants: the roll skipped, a spell evaded)', () => {
  let st = zone(30, 40);   // b ten levels over: 20%
  const roll = (v) => () => v;
  const evaded = wildBlow(st, 'acct-a', 'acct-b', { d: 8, held: FIST, rid: 'eeeeeeeeee01', roll: roll(0.19) }, 10_000);
  assert.equal(evaded.why, 'evade'); assert.equal(evaded.dealt, 0); assert.equal(evaded.ok, true);
  assert.equal(st.fighters.get('acct-b').f.hp, st.fighters.get('acct-b').f.max, 'no health lost');
  assert.equal(st.fighters.get('acct-b').fightAt, 10_000, 'the fight is open');
  const landed = wildBlow(st, 'acct-a', 'acct-b', { d: 8, held: FIST, rid: 'eeeeeeeeee02', roll: roll(0.2) }, 12_000);
  assert.equal(landed.why, null); assert.ok(landed.dealt > 0);
  st = zone(30, 40);
  const cast = wildBlow(st, 'acct-a', 'acct-b', { d: 8, r: SIEGE_HIT.Spell, rid: 'eeeeeeeeee03', roll: roll(0) }, 10_000);
  assert.notEqual(cast.why, 'evade', 'a spell is not evaded');
  st = zone(40, 40);
  assert.notEqual(wildBlow(st, 'acct-a', 'acct-b', { d: 8, held: FIST, rid: 'eeeeeeeeee04', roll: roll(0) }, 10_000).why, 'evade', 'equal levels, no Dodging: nothing to evade');
  st = zone(30, 40);
  st.fighters.get('acct-b').pose = at(40);
  assert.equal(wildBlow(st, 'acct-a', 'acct-b', { d: 8, held: FIST, rid: 'eeeeeeeeee05', roll: roll(0) }, 10_000).why, 'reach', 'out of reach is no evade');
});

test('PVP-EVADE the word: `wref` `hp` carries `ev` 1 with `d` 0, and nothing else', () => {
  const h = [['peer-a', 100, 100], ['peer-b', 100, 100]];
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'hp', by: 'peer-a', to: 'peer-b', d: 0, r: 0, h, ev: 1 })?.ev, 1);
  assert.equal(validWildRefOut({ t: 'wref', k: 'hp', by: 'peer-a', to: 'peer-b', d: 0, r: 0, h, ev: 2 }), null);
  assert.equal(validWildRefOut({ t: 'wref', k: 'hp', by: 'peer-a', to: 'peer-b', d: 5, r: 0, h })?.ev, undefined);
});
