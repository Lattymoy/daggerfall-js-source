// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect"; bible/11-Multiplayer/Elite-Gates.md sections 8.3 and 10.3): A VENT BITES THROUGH ITS WHOLE FIRE. The screen's place
// pass (scenes/eliteGates/egFight.js place - `ventJudged`) judged an eruption on the fire's first frame alone and marked it judged
// whether my feet were in it or not: a body that walked into a span Vent's disc (or a Rampart vent's lane) a beat after the
// fire began stood in the flame unhurt. Now feet in it at any frame of the fire are bitten, once an eruption - again the next.
// Fixtures from the producers: the law's own halls, the screen's own fight pass over a state as the link folds it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egVentAt, EG_VENT_FIRE_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egVentState, EG_VENT_R, EG_VENT_FIRE_S } from '../../../src/net/eliteGates/egSpanLaw.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';

/** The screen's fight pass over hall `s` of `seed` in its trial (woken at `hw`), my feet where `feetAt()` says and the clock `now()`:
 *  every share it lands, `[share, element]`. */
function fightOver(seed, s, hw, feetAt, now) {
  const E = { b: '0123456789abcdef', h: s.h, seed, geo: 0, sg: 'trial', end: null, hw, fight: EG_FIGHT_EMPTY, co: [] };
  const hits = [], entity = { health: 100, maxHealth: 100 };
  const fight = createEgFight({ link: { state: () => E }, now, feet: feetAt, player: () => entity, save: () => 100, strike: (d, how) => hits.push([d, how?.el]), me: () => 'acct-mac' });
  return { fight, hits };
}

test('EG-PERFECT A SPAN VENT BITES THROUGH ITS WHOLE FIRE (section 10.3): standing clear as it erupts and stepping into its disc mid-fire takes its share, fire - once that eruption however long I stand there; the next eruption again; clear of it nothing (mutants: judged on the fire\'s first frame alone; judged every frame)', () => {
  let at = null;
  for (let seed = 1; seed < 400 && !at; seed++) for (let h = 76; h <= 100 && !at; h++) { const s = egHallOf(seed, h, 0); const v = s.steps.find((q) => q.kind === 'vent'); if (v) at = { seed, s, v }; }
  assert.ok(at, 'a hall with a Vent');
  const { s, v } = at;
  let t0 = 0;
  for (let k = 0; k < 20000; k++) if (egVentState(v, k * 0.001).fire) { t0 = k; break; }
  assert.ok(t0 > 0 && !egVentState(v, (t0 - 1) / 1000).fire, 'the fire\'s first millisecond');
  const IN = realmToDungeon(s.x0 + v.x, v.y, v.z), OUT = realmToDungeon(s.x0 + v.x + EG_VENT_R + 0.6, v.y, v.z);
  let t = t0 + 5, feet = OUT;
  const { fight, hits } = fightOver(at.seed, s, 1, () => feet, () => t);
  fight.frame();
  assert.equal(hits.length, 0, 'clear of its disc as it erupts: nothing');
  t = t0 + Math.round(EG_VENT_FIRE_S * 1000 * 0.6); feet = IN;
  assert.ok(egVentState(v, t / 1000).fire, 'still burning');
  fight.frame();
  assert.equal(hits.length, 1, 'into its disc mid-fire: bitten');
  assert.equal(hits[0][1], 'fire');
  assert.ok(hits[0][0] > 0);
  t += 50; fight.frame(); t += 50; fight.frame();
  assert.equal(hits.length, 1, 'once that eruption');
  t = t0 + v.period * 1000 + 10; fight.frame();
  assert.equal(hits.length, 2, 'the next eruption again');
  t += v.period * 1000; feet = OUT; fight.frame();
  assert.equal(hits.length, 2, 'clear of it, nothing');
});

test('EG-PERFECT A RAMPART VENT BITES THROUGH ITS WHOLE FIRE (section 8.3): clear of its lane as it erupts, into it mid-fire - its share, fire, once that eruption; the next again (mutants: judged on the fire\'s first frame alone; judged every frame)', () => {
  let at = null;
  for (let seed = 1; seed < 60 && !at; seed++) for (let h = 1; h <= 100 && !at; h++) { const s = egHallOf(seed, h, 0); if (s.vents?.length) at = { seed, s, v: s.vents[0] }; }
  assert.ok(at, 'a Rampart with its vents');
  const { s, v } = at, hw = 1_000_000;
  let t0 = hw;
  while (egVentAt(v, hw, t0).st !== 'fire') t0 += 1;
  const IN = realmToDungeon(s.x0 + v.x, s.walk?.y ?? 0, v.z), OUT = realmToDungeon(s.x0 + v.x, s.walk?.y ?? 0, v.z + v.d / 2 + 1.5);
  let t = t0 + 5, feet = OUT;
  const { fight, hits } = fightOver(at.seed, s, hw, () => feet, () => t);
  fight.frame();
  assert.equal(hits.length, 0, 'clear of its lane as it erupts: nothing');
  t = t0 + Math.round(EG_VENT_FIRE_MS * 0.6); feet = IN;
  assert.equal(egVentAt(v, hw, t).st, 'fire');
  fight.frame();
  assert.equal(hits.length, 1, 'into its lane mid-fire: bitten');
  assert.equal(hits[0][1], 'fire');
  t += 50; fight.frame();
  assert.equal(hits.length, 1, 'once that eruption');
  t = t0 + v.cycle + 10; fight.frame();
  assert.equal(hits.length, 2, 'the next eruption again');
});
