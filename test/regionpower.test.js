// S43 - RegionPowerAndConditionsUpdate's POWER HALF
// (PlayerEntity.cs:1626-1685) and the two arms of the entity update
// that drive it (:460-472).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  regionPowerUpdate, factionPowerStep, isFactionValidForRumorMill, RUMOR_MILL_EXCLUDED,
  bootstrapRegionPower, REGION_BOOTSTRAP_PASSES, ALWAYS_AVAILABLE_RUMORS,
} from '../src/systems/regionPower.js';
import { createRegionConditions } from '../src/systems/regionConditions.js';
import { finishChargen } from '../src/systems/chargenSession.js';
import { SKILLS, SKILL_COUNT } from '../src/systems/skills.js';
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

// ── the BOOTSTRAP, which is the other half that was missing ─────────

test('AUDIT 26 F107: InitializeRegionData ends with TWELVE (false, true) passes', () => {
  // PlayerEntity.cs:2213-2217:
  //     for (int i = 0; i < 12; ++i) {
  //         RegionPowerAndConditionsUpdate(false);
  //         RegionPowerAndConditionsUpdate(true);
  //     }
  assert.equal(REGION_BOOTSTRAP_PASSES, 12);
  const me = f({ id: 1, type: FACTION_TYPES.Group, power: 50 });
  const s = store(me);
  let refreshed = 0;
  const rumors = [];
  const r = bootstrapRegionPower(s, {
    rumorMill: {
      refreshRumorMill: () => refreshed++,
      addNonQuestRumor: (a1, a2, a3, a4, textId) => rumors.push(textId),
    },
    regionConditions: createRegionConditions(),
    rolls: () => 0,
  });
  // RefreshRumorMill is the update's first line, so one per CALL: 12 x 2.
  assert.equal(refreshed, 24, 'twenty-four updates, not twelve');
  // The seven always-available rumors are re-seeded once per CONDITIONS
  // pass (:2112-2118), so twelve of the twenty-four ran with the bool on.
  assert.equal(rumors.length, ALWAYS_AVAILABLE_RUMORS.length * REGION_BOOTSTRAP_PASSES);
  assert.deepEqual(rumors.slice(0, 7), [...ALWAYS_AVAILABLE_RUMORS]);
  // and every pass walks the one valid faction, one power step each
  assert.deepEqual([r.walked, r.changed], [24, 24]);
  assert.equal(me.power, 50 - 24, 'the walk with a certain FailedRoll costs a point a pass');
  // no faction store at all is silence, not a throw - a host that
  // never ran chargen has none
  assert.deepEqual(bootstrapRegionPower(null, {}), { walked: 0, changed: 0 });
});

test('AUDIT 26 F107: a NEW CHARACTER is born with the walk already run (StartGameBehaviour.cs:433)', () => {
  // InitializeRegionData is called at character creation, so a fresh
  // character never starts from the raw FACTION.TXT powers - the
  // merchants-vs-region term of UpdateRegionalPrices reads the walked
  // state from day one. finishChargen is the port's seam for it.
  const dict = new Map([[1, f({ id: 1, type: FACTION_TYPES.Group, power: 50, rep: 0 })]]);
  const entity = {
    isPlayer: true, level: 1, health: 50, maxHealth: 50, items: [],
    sGroupReputations: [0, 0, 0, 0, 0],
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  };
  finishChargen(entity, {
    name: 'Pin', gender: 'male', race: 'Breton', raceId: 1, faceIndex: 0,
    careerIndex: 16,
    career: {
      name: 'Pin',
      primarySkills: [SKILLS.LongBlade, SKILLS.CriticalStrike, SKILLS.Dodging],
      majorSkills: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Running],
      minorSkills: [SKILLS.Swimming, SKILLS.Jumping, SKILLS.Medical, SKILLS.Stealth, SKILLS.Backstabbing, SKILLS.Mercantile],
      hitPointsPerLevel: 10, advancementMultiplier: 0.3, abilityFlagsAndSpellPointsBitfield: 0x1000,
    },
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: new Array(SKILL_COUNT).fill(30),
    reflexes: 2,
    factionDict: dict,
  }, null, { rolls: () => 0 });
  assert.equal(entity.factionRep.dict.get(1).power, 50 - 24,
    'twenty-four power steps before the first frame');
  assert.equal(dict.get(1).power, 50, 'and the reader FACTION.TXT record is untouched');
});
