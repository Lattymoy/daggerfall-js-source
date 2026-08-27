// S43 - RegionPowerAndConditionsUpdate's POWER HALF
// (PlayerEntity.cs:1626-1685) and the two arms of the entity update
// that drive it (:460-472).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  regionPowerUpdate, factionPowerStep, isFactionValidForRumorMill, RUMOR_MILL_EXCLUDED,
} from '../src/systems/regionPower.js';
import {
  tickPlayerMinutes, CLASSIC_MINUTES_PER_SECOND,
  FACTION_POWER_INTERVAL_MINUTES, REGION_CONDITIONS_INTERVAL_MINUTES,
} from '../src/systems/worldTick.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const f = (o) => ({
  id: 1, parent: 0, type: FACTION_TYPES.Group, power: 50, rulerPowerBonus: 0,
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, ...o,
});
const store = (...fs) => ({ dict: new Map(fs.map((x) => [x.id, x])) });

// ── isFactionValidForRumorMill ──────────────────────────────────────

test('S43 validity: Province, Group and Subgroup only, minus DFU\'s thirteen', () => {
  for (const t of [FACTION_TYPES.Province, FACTION_TYPES.Group, FACTION_TYPES.Subgroup]) {
    assert.equal(isFactionValidForRumorMill(f({ id: 1, type: t })), true, `type ${t}`);
  }
  for (const t of [FACTION_TYPES.God, FACTION_TYPES.Temple, FACTION_TYPES.People,
    FACTION_TYPES.Individual, FACTION_TYPES.Daedra]) {
    assert.equal(isFactionValidForRumorMill(f({ id: 1, type: t })), false, `type ${t}`);
  }
  // the thirteen, by id, whatever their type
  assert.deepEqual([...RUMOR_MILL_EXCLUDED].sort((a, b) => a - b),
    [17, 240, 350, 514, 810, 811, 813, 844, 845, 846, 847, 848, 852]);
  for (const id of RUMOR_MILL_EXCLUDED) {
    assert.equal(isFactionValidForRumorMill(f({ id, type: FACTION_TYPES.Group })), false, `id ${id}`);
  }
  assert.equal(isFactionValidForRumorMill(null), false);
});

// ── the power step ──────────────────────────────────────────────────

test('S43 power: a FAILED roll costs a point and a passed one gains it', () => {
  // chance = 0 + 0 + 0 - 0 = 0, so dice100(0, r) is always false ->
  // FailedRoll is always TRUE -> the faction sinks.
  const a = f({ power: 50 });
  assert.equal(factionPowerStep(store(a).dict, a, () => 0), -1);
  assert.equal(a.power, 49);
  // A rulerPowerBonus of 100 makes the chance certain, so it climbs.
  const b = f({ power: 50, rulerPowerBonus: 100 });
  assert.equal(factionPowerStep(store(b).dict, b, () => 0.99), 1);
  assert.equal(b.power, 51);
});

test('S43 power: allies and a parent RAISE the chance, enemies LOWER it, all at a tenth', () => {
  // three allies at 100 -> 300/10 = 30. A roll of exactly 0.29 passes
  // (29 < 30) and 0.30 fails (30 < 30 is false), which pins the /10.
  const mk = (roll) => {
    const me = f({ id: 1, power: 50, ally1: 2, ally2: 3, ally3: 4 });
    const d = store(me, f({ id: 2, power: 100 }), f({ id: 3, power: 100 }), f({ id: 4, power: 100 })).dict;
    factionPowerStep(d, me, () => roll);
    return me.power;
  };
  assert.equal(mk(0.29), 51, '29 < 30 passes');
  assert.equal(mk(0.30), 49, '30 < 30 fails - the mod really is 30, not 300');

  // Enemies subtract. Three at 100 against three allies at 100 nets 0.
  const me = f({ id: 1, power: 50, ally1: 2, enemy1: 3 });
  const d = store(me, f({ id: 2, power: 100 }), f({ id: 3, power: 100 })).dict;
  factionPowerStep(d, me, () => 0.05);   // 5 < (10 - 10) = 0 -> false -> sinks
  assert.equal(me.power, 49, 'a matched ally and enemy cancel');

  // A parent contributes power/10 too, and ONLY when parent != 0.
  const kid = f({ id: 1, power: 50, parent: 9 });
  const kd = store(kid, f({ id: 9, power: 100 })).dict;
  factionPowerStep(kd, kid, () => 0.09);   // 9 < 10 -> passes
  assert.equal(kid.power, 51);
});

test('S43 power: a parent id NOT in the dictionary contributes ZERO, it does not skip the term', () => {
  // :1664 is `GetFactionData(parent, out parent)` with no `if`, so a
  // miss leaves C#'s zero struct and parentPowerMod = 0/10 = 0. A port
  // that skipped the lookup would read the same here - what it must NOT
  // do is throw, and what it must not do is treat the miss as the
  // faction's own power.
  const me = f({ id: 1, power: 90, parent: 4242 });
  const d = store(me).dict;
  assert.doesNotThrow(() => factionPowerStep(d, me, () => 0.01));
  assert.equal(me.power, 89, '1 < 0 is false -> FailedRoll -> sinks; the absent parent added nothing');
});

test('S43 power: `parent != 0` is a real gate, not a convenience - id 0 is NOT a parent', () => {
  // Dropping the gate survives a dictionary with no faction 0, because
  // the lookup misses and contributes 0 either way. It stops being
  // equivalent the moment something IS keyed at 0, and DFU's gate is
  // what says "0 means no parent" rather than "faction zero".
  const zero = f({ id: 0, power: 100 });
  const orphan = f({ id: 1, power: 50, parent: 0 });
  const d = store(orphan, zero).dict;
  factionPowerStep(d, orphan, () => 0.05);
  assert.equal(orphan.power, 49,
    'chance is 0 with the gate (5 < 0 fails -> sinks); without it faction 0 would lend 10 and it would climb');
});

test('S43 power: the CHILDREN bonus is ONE point however many outrank, and it reads power AFTER the roll', () => {
  // Three children all more powerful: DFU breaks on the first, so the
  // faction gains exactly one extra point, not three.
  const me = f({ id: 1, power: 50, rulerPowerBonus: 100, children: [2, 3, 4] });
  const d = store(me, f({ id: 2, power: 99 }), f({ id: 3, power: 99 }), f({ id: 4, power: 99 })).dict;
  assert.equal(factionPowerStep(d, me, () => 0.5), 2, '+1 from the roll, +1 from the children, and no more');
  assert.equal(me.power, 52);

  // THE ORDER MATTERS: the comparison sees the post-roll power. A child
  // at exactly the PRE-roll power triggers when the faction sank (49 <
  // 50) and does not when it climbed (51 > 50).
  const sank = f({ id: 1, power: 50, children: [2] });
  const sd = store(sank, f({ id: 2, power: 50 })).dict;
  factionPowerStep(sd, sank, () => 0);            // chance 0 -> sinks to 49
  assert.equal(sank.power, 50, '49, then the child at 50 outranks it -> +1');

  const rose = f({ id: 1, power: 50, rulerPowerBonus: 100, children: [2] });
  const rd = store(rose, f({ id: 2, power: 50 })).dict;
  factionPowerStep(rd, rose, () => 0.5);          // climbs to 51
  assert.equal(rose.power, 51, '51, and the child at 50 no longer outranks it - no bonus');

  // STRICTLY greater: a child EXACTLY LEVEL with the post-roll power
  // earns nothing. Every other fixture here straddles that, so `>` and
  // `>=` read the same in them.
  const level = f({ id: 1, power: 50, children: [2] });
  const ld = store(level, f({ id: 2, power: 49 })).dict;
  factionPowerStep(ld, level, () => 0);           // chance 0 -> sinks to 49
  assert.equal(level.power, 49, 'child 49 vs power 49 - `>` gives no bonus, `>=` would give one');
});

test('S43 power: changePower\'s 1..100 clamp still bounds the walk', () => {
  const low = f({ power: 1 });
  factionPowerStep(store(low).dict, low, () => 0);
  assert.equal(low.power, 1, 'the floor is 1, not 0');
  const high = f({ power: 100, rulerPowerBonus: 100, children: [2] });
  const hd = store(high, f({ id: 2, power: 100 })).dict;
  factionPowerStep(hd, high, () => 0.5);
  assert.equal(high.power, 100);
});

// ── the whole walk ──────────────────────────────────────────────────

test('S43 walk: every valid faction draws exactly ONE roll, in dictionary order, and invalid ones draw none', () => {
  const valid1 = f({ id: 1, type: FACTION_TYPES.Group, power: 50 });
  const skipped = f({ id: 17, type: FACTION_TYPES.Group, power: 50 });        // Oblivion
  const wrongType = f({ id: 2, type: FACTION_TYPES.Temple, power: 50 });
  const valid2 = f({ id: 3, type: FACTION_TYPES.Province, power: 50 });
  const s = store(valid1, skipped, wrongType, valid2);
  let draws = 0;
  const r = regionPowerUpdate(s, { rolls: () => { draws++; return 0; } });
  assert.equal(r.walked, 2, 'two valid factions');
  assert.equal(draws, 2, 'one roll each - a roll drawn for a skipped faction would shift the stream');
  assert.equal(valid1.power, 49);
  assert.equal(valid2.power, 49);
  assert.equal(skipped.power, 50, 'Oblivion is excluded');
  assert.equal(wrongType.power, 50, 'a Temple is not a rumour-mill faction');
});

test('S43 walk: RefreshRumorMill is the member\'s FIRST line, and it had no caller before this slice', () => {
  let refreshed = 0;
  const s = store(f({ id: 1, power: 50 }));
  regionPowerUpdate(s, { rumorMill: { refreshRumorMill: () => refreshed++ }, rolls: () => 0 });
  assert.equal(refreshed, 1, 'PlayerEntity.cs:1630');
  // and it is optional - a host that has not parked a mill is not a crash
  assert.doesNotThrow(() => regionPowerUpdate(s, { rolls: () => 0 }));
  assert.deepEqual(regionPowerUpdate(null, {}), { walked: 0, changed: 0 });
});

// ── the wiring, which is the half that was missing ──────────────────

test('S43 wiring: the tick walks the powers every 7 days and again every 38', () => {
  assert.equal(FACTION_POWER_INTERVAL_MINUTES, 10080, ':462 - seven days');
  assert.equal(REGION_CONDITIONS_INTERVAL_MINUTES, 54720, ':469 - thirty-eight days');

  const me = f({ id: 1, type: FACTION_TYPES.Group, power: 50 });
  const entity = {
    health: 20, maxHealth: 20, fatigue: 500, stats: {}, skills: [30], skillUses: [],
    items: [], activeEffects: [], regionPrices: {}, legalRep: {},
    factionRep: store(me), lastGameMinutes: 1,
  };
  // Cross ONE 7-day boundary (minute 10080) and nothing else.
  tickPlayerMinutes({
    entity, classicMinutes: 1, dt: (FACTION_POWER_INTERVAL_MINUTES + 5) / CLASSIC_MINUTES_PER_SECOND,
    sinks: {}, rolls: () => 0, say: () => {},
  });
  assert.equal(me.power, 49, 'the 7-day arm fired once');

  // The 266-day minute is divisible by BOTH intervals, so DFU's two
  // separate ifs both call a member that always walks the powers - it
  // fires TWICE there.
  const both = 383040;   // lcm(10080, 54720)
  assert.equal(both % FACTION_POWER_INTERVAL_MINUTES, 0);
  assert.equal(both % REGION_CONDITIONS_INTERVAL_MINUTES, 0);
  const solo = f({ id: 1, type: FACTION_TYPES.Group, power: 50 });
  const e2 = { ...entity, factionRep: store(solo), lastGameMinutes: both, preventNormalizingReputations: true };
  tickPlayerMinutes({
    entity: e2, classicMinutes: both, dt: 1 / CLASSIC_MINUTES_PER_SECOND,
    sinks: {}, rolls: () => 0, say: () => {},
  });
  assert.equal(solo.power, 48, 'both arms fired on the aligned minute - two points, not one');
});

// ── RS1: THE STRUCT-COPY LAW (2026-08-27) ───────────────────────────
// The re-sweep of the shipped conditions body against PlayerEntity.cs
// found three places where C# copies a FactionData STRUCT and later
// reads its power - so the read sees the value AT THE COPY, not the
// record ChangePower has since mutated. The port's dict hands out LIVE
// references, which silently read the post-mutation value at all three
// sites until this slice snapshotted them:
//   - the won-war spoils (:1845) read warEnemy.power from the :1791
//     copy, PRE-battle - while the lost-war arm reads the faction
//     fresh from the dict (:1851), POST-battle. DFU's own asymmetry.
//   - the persecuted-temple roll (:2024/:2026) reads temple.power from
//     the :1974 copy, before the plague arms billed it.
//   - the witch-burnings roll (:2059) reads witches.power from the
//     :2057 copy, before the standing-burnings bill above it.
// Each test scripts the WHOLE roll stream and asserts it is consumed
// exactly - a change to the arm walk fails here first, not silently.

const { factionConditionsStep } = await import('../src/systems/regionPower.js');
const { createRegionConditions, turnOnConditionFlag, conditionFlag, REGION_FLAGS } =
  await import('../src/systems/regionConditions.js');

const rollQueue = (vals) => {
  const q = [...vals];
  const fn = () => {
    if (!q.length) throw new Error('roll queue exhausted - the arm walk changed shape');
    return q.shift();
  };
  fn.left = () => q.length;
  return fn;
};
const province = (o) => f({ type: FACTION_TYPES.Province, ...o });
const stepSnapshot = (dict, a) => {
  const allies = [a.ally1, a.ally2, a.ally3];
  const enemies = [a.enemy1, a.enemy2, a.enemy3];
  let alliesPower = 0;
  for (const id of allies) alliesPower += dict.get(id)?.power ?? 0;
  return { allies, enemies, alliesPower };
};

test('RS1 war: the spoils are the PRE-battle copy, and WarWon\'s group-clear drops WarOngoing', () => {
  // Region 0 borders region 44 (BORDER_REGIONS[0] = 44), so B is a
  // potential war enemy of A and the standing rivalry is permanent
  // until the war is over (no end-rivalry roll).
  const A = province({ id: 201, region: 0, power: 60, enemy1: 202 });
  const B = province({ id: 202, region: 44, power: 2, enemy1: 201 });
  const dict = store(A, B).dict;
  const rc = createRegionConditions();
  turnOnConditionFlag(rc, 0, REGION_FLAGS.WarOngoing, () => 0.5);
  // The stream: alliance pick (B, an enemy - refused), the 95% battle
  // gate, powerLoss (1 + floor(r*0) = 1 always), enemyPowerLoss
  // (1 + floor(0.4*6) = 3), the two flag-value rolls of the won-war
  // arm, the rivalry pick (B again, refused), the ruler roll (passes,
  // no new ruler), famine/plague 2% starts (miss), the persecuted and
  // crime rolls (negative chances, both turn off nothing).
  const rolls = rollQueue([0.0, 0.99, 0.0, 0.4, 0.5, 0.5, 0.0, 0.0, 0.99, 0.99, 0.5, 0.5]);
  factionConditionsStep(dict, A, [202], stepSnapshot(dict, A), { regionConditions: rc, rolls });
  assert.equal(rolls.left(), 0, 'the whole stream was consumed');
  // The battle: A +1 (the positive powerLoss, DFU's own), then the
  // spoils trunc(2/2)=1 off B's PRE-battle power 2 - a live read of
  // the post-battle 5 would have paid trunc(5/2)=2 and left A at 63.
  assert.equal(A.power, 62, 'the spoils read the :1791 struct copy');
  assert.equal(B.power, 5, 'B gained its enemyPowerLoss of 3');
  assert.equal(conditionFlag(rc, 0, REGION_FLAGS.WarWon), true, 'A\'s region won');
  assert.equal(conditionFlag(rc, 44, REGION_FLAGS.WarLost), true, 'B\'s region lost');
  // TurnOnConditionFlag's group-clear: WarWon shares group 0 with the
  // WarOngoing set at the top, so raising it dropped the old flag.
  assert.equal(conditionFlag(rc, 0, REGION_FLAGS.WarOngoing), false, 'the group-clear ran');
});

test('RS1 temple: the persecution roll reads the PRE-plague copy of the temple\'s power', () => {
  // REGION_TEMPLES[0] = 106. Temple power 5 at the copy; the ongoing
  // plague bills it to 4 before the persecution roll. The pre-copy
  // chance trunc((5-5+5)/5) = 1 beats a floor-0 roll; the live 4 gives
  // chance 0, which nothing beats - the bug turned persecution OFF on
  // exactly this boundary.
  const A = province({ id: 301, region: 0, power: 6 });
  const T = f({ id: 106, type: FACTION_TYPES.Temple, power: 5, region: -1 });
  const dict = store(A, T).dict;
  const rc = createRegionConditions();
  turnOnConditionFlag(rc, 0, REGION_FLAGS.PlagueOngoing, () => 0.5);
  // alliance pick (the temple - invalid for the mill, taken anyway) +
  // its refused roll, rivalry pick + its passed roll, ruler, famine,
  // the plague end-roll (fails, plague continues), the persecution
  // roll (floor 0 < chance 1), the flag-value roll, the crime roll.
  const rolls = rollQueue([0.0, 0.5, 0.0, 0.0, 0.0, 0.99, 0.99, 0.001, 0.5, 0.5]);
  factionConditionsStep(dict, A, [106], stepSnapshot(dict, A), { regionConditions: rc, rolls });
  assert.equal(rolls.left(), 0, 'the whole stream was consumed');
  assert.equal(conditionFlag(rc, 0, REGION_FLAGS.PersecutedTemple), true,
    'the roll used the :1974 copy - the live post-plague power would have turned it off');
  assert.equal(T.power, 3, 'billed once by the plague, once by the persecution');
  assert.equal(rc[0].idOfPersecutedTemple, 106);
  assert.equal(A.power, 5, 'the province paid the plague point');
});

test('RS1 witches: the burnings roll reads the coven\'s power from BEFORE the standing bill', () => {
  // Region 2 has no temple (REGION_TEMPLES[2] = 0 - the persecution
  // arm is skipped whole). Coven power 10 at the copy; the standing
  // burnings bill it to 9 first. Pre-copy chance trunc((10-10+5)/5)=1
  // beats a floor-0 roll and the burnings CONTINUE; the live 9 gives
  // chance 0 and the bug ended them.
  const A = province({ id: 401, region: 2, power: 10 });
  const W = f({ id: 402, type: FACTION_TYPES.WitchesCoven, power: 10, region: 2 });
  const dict = store(A, W).dict;
  const rc = createRegionConditions();
  turnOnConditionFlag(rc, 2, REGION_FLAGS.WitchBurnings, () => 0.5);
  // alliance pick + refused roll, rivalry pick + passed roll, ruler,
  // famine, plague 2% start (miss), crime, the burnings roll, the
  // flag-value roll of the re-raised burnings.
  const rolls = rollQueue([0.0, 0.5, 0.0, 0.0, 0.0, 0.99, 0.99, 0.5, 0.001, 0.5]);
  factionConditionsStep(dict, A, [402], stepSnapshot(dict, A), { regionConditions: rc, rolls });
  assert.equal(rolls.left(), 0, 'the whole stream was consumed');
  assert.equal(conditionFlag(rc, 2, REGION_FLAGS.WitchBurnings), true,
    'the roll used the :2057 copy - the live post-bill power would have ended the burnings');
  assert.equal(W.power, 8, 'billed by the standing wave AND the survived roll');
});

test('RS1 temple: the double-power mercy gate reads the copy too (>= 2x on the boundary)', () => {
  // Temple copy 10 = exactly 2x the post-plague province power 5, so
  // the C# else-if turns persecution OFF; the live post-plague 9 sits
  // below the bar and the bug fell through to persecution ON. The
  // first roll passes either way (chances 2 and 1 both beat floor 0),
  // so the branches split on the gate alone - and the OFF arm draws no
  // flag-value roll, which the queue length pins.
  const A = province({ id: 311, region: 0, power: 6 });
  const T = f({ id: 106, type: FACTION_TYPES.Temple, power: 10, region: -1 });
  const dict = store(A, T).dict;
  const rc = createRegionConditions();
  turnOnConditionFlag(rc, 0, REGION_FLAGS.PlagueOngoing, () => 0.5);
  const rolls = rollQueue([0.0, 0.5, 0.0, 0.0, 0.0, 0.99, 0.99, 0.001, 0.5]);
  factionConditionsStep(dict, A, [106], stepSnapshot(dict, A), { regionConditions: rc, rolls });
  assert.equal(rolls.left(), 0, 'the whole stream was consumed - no persecution value roll');
  assert.equal(conditionFlag(rc, 0, REGION_FLAGS.PersecutedTemple), false,
    'copy 10 >= 2*5 turns persecution off; the live 9 would have persecuted');
  assert.equal(T.power, 9, 'billed by the plague alone');
  assert.equal(rc[0].idOfPersecutedTemple, 0, 'no persecuted temple recorded');
});
