// PVP-REF (2026-10-01, Mac: "Finish the seats"; "Continue"): THE REFEREE'S LAW (net/siege/siegeRef.js) - its copied tables
// pinned EQUAL to DFU's own (characters/weapons.js, combat/formulas.js, combat/playerWeapon.js - the leaf's law: the
// relay bundles every byte it imports, so the tables are copied, never imported), 6.1's buckets against DFU's damage
// ranges for every weapon and material, and every refusal of a blow, a cast and a step.
// bible/11-Multiplayer/Seats-Arc.md 6.1; `06-Systems/Online-Arc.md` PVP-REF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIEGE_ROOM, siegeRoomKey, isSiegeRoom, siegeOfRoom, SIEGE_VITALITY, siegeVitality, SIEGE_UNITS_PER_M, SIEGE_REACH, SIEGE_HIT, SIEGE_BLOWS_HZ,
  SIEGE_CASTS, SIEGE_SPEED, SIEGE_WAVE_MS, SIEGE_PROTECT_MS, SIEGE_FIGHTERS_MAX, SIEGE_WEAPONS, SIEGE_WEAPON_MAX, SIEGE_THUNDERLOCK,
  SIEGE_MATERIAL_MOD, SIEGE_FIST_MAX, SIEGE_BONUS, SIEGE_BONUS_MAX, SIEGE_CRIT_MAX, siegeBlowMax, siegeIsBow, siegeHeld, newFighter,
  refereeBlow, refereeCast, refereeStep, siegeNextWave, siegeRise,
} from '../../src/net/siege/siegeRef.js';
import { WEAPONS, WEAPON_MATERIALS, weaponMaxDamage, weaponMaterialModifier } from '../../src/characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { damageModifier, handToHandMaxDamage } from '../../src/combat/formulas.js';
import { pcaaoDamageModifier } from '../../src/combat/pcaao.js';
import { rrDamageModifierClassic } from '../../src/systems/roleplayRealism/rrRealism.js';
import { WEAPON_REACH, SWING_MODS } from '../../src/combat/playerWeapon.js';
import { NATIVES_PER_M } from '../../src/net/duel/duelSession.js';
import { validSiegeIn, SIEGE_KINDS, SIEGE_OUT_KINDS, SIEGE_DMG_WIRE_MAX, SIEGE_HZ_MAX, relaySupportsSiege, parseClient } from '../../src/net/wire.js';
import { RENOWN_MAX } from '../../src/net/identityToken.js';
import { runSpeed } from '../../src/player/motor.js';
import { MAX_STAT_VALUE } from '../../src/systems/statMods.js';
import { EFFECTIVE_SKILL_MAX } from '../../src/systems/skillSoftcap.js';
import { LYCANTHROPE_SKILL_MOD } from '../../src/systems/lycanthropy.js';
import { ENHANCE_SKILL_MOD } from '../../src/systems/enchantments.js';

const at = (x, z = 0) => ({ x: x * SIEGE_UNITS_PER_M, y: 0, z: z * SIEGE_UNITS_PER_M });

test('PVP-REF THE TABLES ARE DFU\'S: every weapon template\'s top and every material\'s modifier equal characters/weapons.js; the fist\'s top at skill 100, Strength 100\'s modifier and the heaviest swing equal combat/formulas.js and playerWeapon.js; melee reach WEAPON_REACH; the room\'s units NATIVES_PER_M; the level\'s bound the token\'s (mutants: any table entry; any bound)', () => {
  const ids = Object.entries(WEAPONS).filter(([k]) => k !== 'Arrow');
  assert.deepEqual(Object.entries(SIEGE_WEAPONS), ids, 'the same templates, by name');
  for (const [, w] of ids) assert.equal(SIEGE_WEAPON_MAX[w], weaponMaxDamage(w), `template ${w}`);
  assert.deepEqual([SIEGE_THUNDERLOCK.template, SIEGE_THUNDERLOCK.max], [THUNDERLOCK_TEMPLATE, weaponMaxDamage(THUNDERLOCK_TEMPLATE)]);
  assert.deepEqual([...SIEGE_MATERIAL_MOD], Object.values(WEAPON_MATERIALS).filter((m) => m >= 0).map(weaponMaterialModifier));
  assert.equal(SIEGE_FIST_MAX, handToHandMaxDamage(100));
  assert.equal(SIEGE_BONUS.strength, Math.floor((100 - 50) / 5), 'FormulaHelper.DamageModifier(100), stock');
  assert.ok(SIEGE_BONUS.strength >= Math.max(damageModifier(100), pcaaoDamageModifier(100), rrDamageModifierClassic(100)), 'no mod\'s Strength modifier (PCAAO, Roleplay Realism) past the stock\'s');
  assert.equal(SIEGE_BONUS.swing, Math.max(...Object.values(SWING_MODS).map((s) => s.damage)));
  assert.deepEqual([SIEGE_BONUS.proficiency, SIEGE_BONUS.racial], [Math.trunc(30 / 3) + 1, Math.trunc(30 / 3)], 'an expert and a racial bonus at level 30');
  assert.equal(SIEGE_BONUS_MAX, 35);
  assert.equal(SIEGE_REACH.melee, WEAPON_REACH);
  assert.equal(SIEGE_UNITS_PER_M, NATIVES_PER_M);
  assert.equal(SIEGE_VITALITY.levelMax, RENOWN_MAX);
});

test('PVP-REF THE BUCKETS (6.1: "DFU\'s own damage range for that weapon at that material, doubled for a critical, never more"): for every template and every material, the weapon\'s top, its material, the attacker\'s bonuses at their caps, x2 - a Daedric Dai-Katana 124, an Iron Dagger 80, a fist 112; a template the table does not name none (mutants: the material; the bonuses; the critical; the fist; the floor)', () => {
  for (const [, w] of Object.entries(SIEGE_WEAPONS)) {
    for (let m = 0; m <= 9; m++) assert.equal(siegeBlowMax(w, m), (weaponMaxDamage(w) + weaponMaterialModifier(m) + SIEGE_BONUS_MAX) * SIEGE_CRIT_MAX, `${w}/${m}`);
  }
  assert.deepEqual([siegeBlowMax(123, 9), siegeBlowMax(113, 0), siegeBlowMax(-1, 0), siegeBlowMax(null, 0), siegeBlowMax(9999, 0), siegeBlowMax(560, 9)], [124, 80, 112, 112, 0, 134]);
  assert.equal(siegeBlowMax(113, 42), (6 + 0 + 35) * 2, 'a material past the table: no modifier');
  assert.deepEqual([siegeIsBow(129), siegeIsBow(130), siegeIsBow(560), siegeIsBow(123), siegeIsBow(-1)], [true, true, true, false, false]);
  const look = { items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }, { templateIndex: 102, group: 'Armor', equipSlot: 21, material: 9 }] };   // PIN MOVED (AUDIT-SEATS): R8 - held is in a hand (the right's 19; the armour in the left's 21 is still no weapon)
  assert.deepEqual(siegeHeld(look, 123, 9), { w: 123, m: 9 });
  assert.equal(siegeHeld(look, 123, 8), null, 'another material than the one held');
  assert.equal(siegeHeld(look, 102, 9), null, 'armour is no weapon');
  assert.deepEqual(siegeHeld(null, -1, 0), { w: -1, m: 0 }, 'a fist is always held');
});

test('PVP-REF THE ROOM AND VITALITY: `siege:<seat>:<week>`; 300 + 2 x Renown, the level held to 1-50 (302-400); the wire\'s frames projected and bounded (mutants: the key; the formula; the bounds; the projection)', () => {
  assert.deepEqual([siegeRoomKey(3021, 20), isSiegeRoom('siege:3021:20'), isSiegeRoom('siege:3021'), isSiegeRoom('siege:03021:20'), isSiegeRoom('gate:5')], ['siege:3021:20', true, false, false, false]);
  assert.deepEqual(siegeOfRoom('siege:3021:20'), { key: 3021, week: 20 });
  assert.equal(siegeOfRoom('nope'), null);
  assert.ok(SIEGE_ROOM.test('siege:0:0'));
  assert.deepEqual([siegeVitality(1), siegeVitality(50), siegeVitality(99), siegeVitality(0), siegeVitality(undefined), siegeVitality(12.9), siegeVitality(-5)], [302, 400, 400, 302, 302, 324, 302]);
  assert.deepEqual([...SIEGE_KINDS], ['in', 'blow', 'cast', 'ask', 'yes']);   // CROWN1 part two: a Royal Tourney's challenge and accept (PIN MOVED)
  assert.deepEqual([...SIEGE_OUT_KINDS], ['st', 'hp', 'fell', 'up', 'back', 'no', 'f', 'end', 'ask', 'bout', 'bend', 'lad', 'won']);   // SEAT2a: the battle's field and its end (PIN MOVED); CROWN1 part two: a Royal Tourney's (PIN MOVED)
  assert.deepEqual(validSiegeIn({ k: 'in', junk: 1 }), { k: 'in' });
  assert.deepEqual(validSiegeIn({ k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 40, r: 0, x: 1 }), { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 40, r: 0 });
  assert.deepEqual(validSiegeIn({ k: 'blow', to: 'peer-0002', w: -1, m: 0, d: 4, r: 1 }), { k: 'blow', to: 'peer-0002', w: -1, m: 0, d: 4, r: 1 });
  assert.deepEqual(validSiegeIn({ k: 'cast', to: 'peer-0002', d: 30, h: 1 }), { k: 'cast', to: 'peer-0002', d: 30, h: 1 });
  assert.equal(validSiegeIn({ k: 'cast', to: 'peer-0002', d: 30, h: 2 }).h, 0, 'a heal is `h` 1 and nothing else');
  assert.equal(validSiegeIn({ k: 'blow', to: 'peer-0002', w: 123, m: 9, d: SIEGE_DMG_WIRE_MAX, r: 0 }).d, SIEGE_DMG_WIRE_MAX);
  assert.deepEqual([SIEGE_DMG_WIRE_MAX, SIEGE_HZ_MAX], [10_000, 8]);
  assert.ok(SIEGE_HZ_MAX >= 2 * SIEGE_BLOWS_HZ, 'the frame gate holds the referee\'s blows and a cast\'s burst');
  for (const bad of [{ k: 'blow', to: 'p', w: 123, m: 9, d: 4, r: 0 }, { k: 'blow', to: 'peer-0002', w: 123, m: 10, d: 4, r: 0 }, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 0, r: 0 },
    { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: SIEGE_DMG_WIRE_MAX + 1, r: 0 }, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 4, r: SIEGE_HIT.Spell }, { k: 'heal' }]) {
    assert.equal(validSiegeIn(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(parseClient(JSON.stringify({ t: 'siege', k: 'in' }), { hasHello: true }), { t: 'siege', k: 'in' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'siege', k: 'in' })), { error: 'siege before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'siege', k: 'heal' }), { hasHello: true }), { error: 'bad siege' });
  assert.deepEqual([relaySupportsSiege('world145'), relaySupportsSiege('world148')], [false, true]);
});

test('PVP-REF THE BLOW: both standing, the weapon the look holds, its kind its own (a bow a shaft), the reach (2.5 m and 3 of slack; a shaft 60), four a second (one second deep, spent first), a fighter just risen untouched; the damage clipped to the bucket and the vitality left; a fall at none (mutants: each refusal; the clip; the fall; the rate\'s refill)', () => {
  let now = 1_000_000;
  const a = newFighter(10, now), b = newFighter(50, now);
  assert.deepEqual([a.hp, a.max, b.hp], [320, 320, 400]);
  const dk = { w: 123, m: 9 };
  const blow = (o) => refereeBlow(a, b, { from: at(0), at: at(2), held: dk, d: 50, r: SIEGE_HIT.Melee, ...o }, now);
  assert.deepEqual(blow({}), { ok: true, dealt: 50, fell: false, why: null });
  assert.equal(b.hp, 350);
  assert.equal(blow({ d: 500 }).dealt, 124, 'clipped to the bucket');
  assert.equal(a.clipped, 376);
  assert.equal(blow({ at: at(5.6) }).why, 'reach', 'past 2.5 + 3 m');
  assert.equal(blow({ held: null }).why, 'weapon', 'a weapon the look does not hold');
  assert.equal(blow({}).why, 'rate', 'four a second, one second deep');
  now += 250;
  assert.equal(blow({}).ok, true, 'a quarter second refills one');
  now += 1000;
  assert.equal(blow({ r: SIEGE_HIT.Shaft }).why, 'weapon', 'a sword shoots nothing');
  assert.equal(refereeBlow(a, b, { from: at(0), at: at(50), held: { w: 130, m: 0 }, d: 10, r: SIEGE_HIT.Shaft }, now).ok, true, 'a bow at 50 m');
  assert.equal(refereeBlow(a, b, { from: at(0), at: at(64), held: { w: 130, m: 0 }, d: 10, r: SIEGE_HIT.Shaft }, now).why, 'reach');
  assert.equal(refereeBlow(a, b, { from: at(0), at: at(2), held: { w: 130, m: 0 }, d: 10, r: SIEGE_HIT.Melee }, now).why, 'weapon', 'a bow strikes no melee blow');
  now += 1000;
  assert.equal(refereeBlow(a, b, { from: null, at: at(2), held: dk, d: 1 }, now).why, 'reach', 'a striker with no pose');
  assert.equal(refereeBlow(a, a, { from: at(0), at: at(0), held: dk, d: 1 }, now).why, 'no-fighter');
  now += 5000;   // PIN MOVED (BAL8, bible/05-Combat/Balance-Arc.md section 14): past the referee's 5 s harm window - the blows above spent its 180
  b.hp = 30;
  const kill = blow({ d: 60 });
  assert.deepEqual([kill.dealt, kill.fell, b.hp, b.down], [30, true, 0, true], 'never past what is left');
  now += 1000;
  assert.equal(blow({}).why, 'down');
  b.upAt = siegeNextWave(now, SIEGE_WAVE_MS.palace);
  assert.equal(siegeRise(b, b.upAt - 1), false);
  assert.equal(siegeRise(b, b.upAt), true);
  assert.deepEqual([b.down, b.hp, b.safeTo], [false, 400, b.upAt + SIEGE_PROTECT_MS]);
  now = b.upAt + 1;
  assert.equal(blow({}).why, 'protected');
  now = b.upAt + SIEGE_PROTECT_MS;
  assert.equal(blow({}).ok, true);
  // the bucket is spent FIRST (the gate's): four refused at a fighter just risen still empty it for another
  const c = newFighter(1, now);
  b.safeTo = now + 10_000; now += 1000;
  for (let i = 0; i < 4; i++) assert.equal(blow({}).why, 'protected');
  assert.equal(refereeBlow(a, c, { from: at(0), at: at(1), held: dk, d: 5 }, now).why, 'rate', 'the protected blows spent the second');
  b.safeTo = 0; now += 1000;
  assert.equal(blow({ at: at(5.4) }).ok, true, 'inside 2.5 m and the slack');
  assert.equal(blow({ d: 10.7 }).dealt, 10, 'a whole blow');
  assert.deepEqual(blow({ d: -5 }), { ok: true, dealt: 0, fell: false, why: null }, 'a claim below nought deals none, heals none');
  assert.deepEqual([SIEGE_BLOWS_HZ, SIEGE_REACH.shaft, SIEGE_REACH.slack, SIEGE_WAVE_MS.palace, SIEGE_WAVE_MS.crown, SIEGE_PROTECT_MS, SIEGE_FIGHTERS_MAX], [4, 60, 3, 20000, 30000, 3000, 48]);
  assert.equal(siegeNextWave(41_000, 20_000), 60_000);
});

test('PVP-REF THE CAST AND THE STEP: three damaging casts a 5 s, each to 60; a heal to 40 and never past whole, on oneself too, three a 5 s of its own; a spell\'s reach; a step no faster than 18 m/s across the ground and half a metre (MEASURED: 25% above the motor\'s fastest legal run), a first one kept, a fall never judged (mutants: the window; the heal\'s window; the caps; the heal\'s ceiling; the speed; the slack; the height)', () => {
  let now = 5_000_000;
  const a = newFighter(1, now), b = newFighter(1, now);
  const cast = (o) => refereeCast(a, b, { from: at(0), at: at(10), d: 100, ...o }, now);
  assert.deepEqual([cast({}).dealt, cast({}).dealt, cast({}).dealt], [60, 60, 60], 'each to 60');
  assert.equal(cast({}).why, 'rate', 'a fourth in the window');
  now += SIEGE_CASTS.windowMs;
  assert.equal(cast({}).ok, true, 'the window passed');
  assert.equal(b.hp, 302 - 240);
  assert.deepEqual(cast({ heal: true }), { ok: true, dealt: -40, fell: false, why: null }, 'a heal, 40 at most');
  assert.equal(b.hp, 102);
  a.hp = 290;
  assert.equal(refereeCast(a, a, { from: at(0), at: at(0), d: 100, heal: true }, now).dealt, -12, 'never past whole, on oneself');
  assert.equal(cast({ heal: true }).ok, true, 'a third heal in the window');
  assert.equal(cast({ heal: true }).why, 'rate', 'a fourth: a heal has a window of its own');
  assert.equal(b.hp, 142);
  assert.equal(cast({}).ok, true, 'and the heals spent none of the damaging window (one of three)');
  now += SIEGE_CASTS.windowMs;
  assert.equal(cast({ heal: true }).ok, true, 'the heal\'s window passed');
  assert.equal(cast({ at: at(64) }).why, 'reach');
  assert.equal(refereeCast(a, a, { from: at(0), at: at(0), d: 10 }, now).why, 'no-fighter', 'a damaging cast at oneself');
  now += SIEGE_CASTS.windowMs;
  b.safeTo = now + 1;
  assert.equal(cast({}).why, 'protected');
  b.safeTo = 0;
  a.down = true;
  assert.equal(cast({ heal: true }).why, 'down', 'the fallen cast nothing');
  // a rise starts both windows afresh
  a.down = false; now += SIEGE_CASTS.windowMs;
  for (let i = 0; i < 3; i++) { cast({}); cast({ heal: true }); }
  assert.deepEqual([cast({}).why, cast({ heal: true }).why], ['rate', 'rate']);
  a.down = true; a.upAt = now;
  assert.equal(siegeRise(a, now), true);
  a.safeTo = 0;
  assert.deepEqual([cast({}).ok, cast({ heal: true }).ok], [true, true], 'risen, both windows fresh');
  assert.deepEqual([SIEGE_CASTS.max, SIEGE_CASTS.windowMs, SIEGE_CASTS.damageMax, SIEGE_CASTS.healMax], [3, 5000, 60, 40]);
  assert.equal(refereeStep(null, at(500), 10), true, 'a first pose');
  assert.equal(refereeStep(at(0), at(18 + 0.5), 1000), true, '18 m/s and the slack');
  assert.equal(refereeStep(at(0), at(18.6), 1000), false);
  assert.equal(refereeStep(at(0), at(0.5), 0), true, 'the slack alone in no time');
  assert.equal(refereeStep(at(0), at(0.4), -1000), true, 'a clock that ran back earns the slack, never less');
  assert.equal(refereeStep(at(0), at(0, 9.4), 500), true, '9 m in half a second and the slack');
  assert.equal(refereeStep(at(0), at(0, 9.6), 500), false);
  assert.equal(refereeStep(at(0), at(0, 9.4), 400), false);
  assert.equal(refereeStep(at(0), { ...at(1), y: -30 * SIEGE_UNITS_PER_M }, 100), true, 'a fall of thirty metres is gravity\'s');   // PIN MOVED (AUDIT-SEATS): R1 - +y is up (player/motor.js's gravity takes pos[1] down), so a fall is -30 m; +30 m is a climb, judged now
  assert.deepEqual([SIEGE_SPEED.mps, SIEGE_SPEED.slackM], [18, 0.5]);
  // THE MEASUREMENT (6.1): the motor's fastest legal run - live Speed at its cap, Running at the softcap's top, the
  // lycanthrope's +30 and one Enhances Skill item - and the ceiling 25% above it; the starting 12.5 under a mastered run
  const fastest = runSpeed(MAX_STAT_VALUE, EFFECTIVE_SKILL_MAX + LYCANTHROPE_SKILL_MOD + ENHANCE_SKILL_MOD);
  assert.equal(Math.round(fastest * 10) / 10, 14.4);
  assert.equal(SIEGE_SPEED.mps, Math.round(fastest * 1.25 * 2) / 2, 'a quarter above it, to the half metre');
  assert.ok(runSpeed(MAX_STAT_VALUE, EFFECTIVE_SKILL_MAX) > 12.5, 'a mastered runner outran the design\'s starting ceiling');
  assert.ok(runSpeed(MAX_STAT_VALUE, EFFECTIVE_SKILL_MAX + LYCANTHROPE_SKILL_MOD + 8 * ENHANCE_SKILL_MOD) <= SIEGE_SPEED.mps, 'eight Running items still under it');
});
