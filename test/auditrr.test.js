// AUDIT-RR (2026-09-23, Mac: "Lets do one more audit") - the adversarial
// audit of the six Roleplay & Realism slices: RRI1 (the fourteen item
// classes), RRI2 (the nine modules past the items), RR1 (the formula
// overrides and rule modules), RR2 (the sprite variants, EnhancedRiding,
// RefinedTraining), RR3a (the Master Armorer registrations) and RR3b (the
// world data). Four reviewers, each with the author's C# open beside the
// port, then every finding re-read against the source before it was paid.
// The findings are numbered in the code comments (`AUDIT-RR Fn`); this
// suite pins the paid ones by execution where the law is a pure function
// and by source where the payment is a host's wiring. The record is the
// AUDIT-RR section of Roleplay-Realism.md and Roleplay-Realism-Items.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { createWeaponMachine, machineStep, registerMeleeWeaponAnimTime, CLASSIC_FRAME_UPDATE } from '../src/characters/weaponStates.js';
import { rrEncumbranceEffect, rrTrainingCost, rrRidingNeckBand, RR_RIDING, rrUnderworldRule } from '../src/systems/rrRealism.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { GUILDS, guildInitiationQuestEnded, membershipOf, underworldRuleOf } from '../src/systems/guilds.js';
import { createFactionRep, getReputation } from '../src/systems/factionRep.js';
import { createRrRidingContacts, RR_TRAMPLE_REACH } from '../src/systems/rrRidingHost.js';
import { SOUND } from '../src/systems/soundClips.js';
import { CRIMES } from '../src/systems/court.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { SKILLS } from '../src/systems/skills.js';
import { enemyHeavyPainVoice } from '../src/scenes/hostCombat.js';
import { setLastLocationKeyTo, getBlockVariantHere, setBlockVariant, clearWorldDataVariants, NO_VARIANT, lastLocationKeyOf, makeLocationKey } from '../src/systems/worldDataVariants.js';
import { rriNativeMaterialValue, rriEquipSound, customItemsForGroup, RRI_VENDOR, RRI_CLASSES } from '../src/systems/rriItems.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { unitWeightInKg } from '../src/systems/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = 'roleplay-realism';

installRoleplayRealism();

test('AUDIT-RR F1: the swing clock hands the rig\'s { entity, weaponType, usingRightHand } to GetMeleeWeaponAnimTime - machineStep(m, dt, speed, animCtx), the rig sets the thunk, playerWeapon reads it each step', () => {
  const seen = [];
  registerMeleeWeaponAnimTime((speed, ctx) => { seen.push(ctx); return 0.05; });
  try {
    const m = createWeaponMachine(false);
    m.state = 'StrikeDown';
    const ctx = { entity: { level: 3 }, weaponType: 'LongBlade', usingRightHand: true };
    machineStep(m, 0.016, 50, ctx);
    assert.ok(seen.length >= 1, 'the override was asked');
    assert.equal(seen[0], ctx, 'with the rig\'s context, the same object');
    machineStep(m, 0.016, 50);
    assert.equal(seen.at(-1), null, 'a caller without one hands null (the widget clone\'s path)');
  } finally { registerMeleeWeaponAnimTime(null); }
  assert.match(rd('src/characters/weaponStates.js'), /export function machineStep\(m, dt, liveSpeed, animCtx = null\)/);
  assert.match(rd('src/characters/weaponStates.js'), /getMeleeWeaponAnimTime\(liveSpeed, animCtx\)/);
  assert.match(rd('src/combat/playerWeapon.js'), /machineStep\(this\.machine, dt, this\.liveSpeed, this\.animCtx\?\.\(\) \?\? null\)/);
  assert.match(rd('src/combat/weaponRig.js'), /playerWeapon\.animCtx = \(\) => \(\{ entity, weaponType: weaponTypeForItem\(playerWeapon\.weapon\), usingRightHand: playerWeapon\.usingRightHand \}\)/);
  assert.equal(typeof CLASSIC_FRAME_UPDATE, 'number');
});

test('AUDIT-RR F2: a guild joined through its initiation quest\'s end runs the class\'s Join() with the store - the underworld floor lands (ThievesGuildRR.cs:91-99) - and world.js hands the quest store', () => {
  _resetModSettings();
  setModSetting(V, 'underworldExpulsion', true);
  const tg = GUILDS.ThievesGuild;
  assert.equal(underworldRuleOf(tg)?.joinReputationFloor, 2, 'the rule stands while the module is on');
  assert.equal(rrUnderworldRule('ThievesGuild')?.joinReputationFloor, 2);
  const store = createFactionRep(new Map([[tg.factionId, { id: tg.factionId, rep: 0 }]]));
  const memberships = {};
  const initiated = guildInitiationQuestEnded(memberships, tg.initiationQuest ?? 'O0A0AL00', true, 0, store);
  if (initiated) {
    assert.ok(membershipOf(memberships, tg), 'joined');
    assert.equal(getReputation(store, tg.factionId), 2, 'the floor');
  }
  const noStore = {};
  guildInitiationQuestEnded(noStore, tg.initiationQuest ?? 'O0A0AL00', true, 0);
  assert.match(rd('src/systems/guilds.js'), /export function guildInitiationQuestEnded\(memberships, questName, questSuccess, now, store = null\)/);
  assert.match(rd('src/systems/guilds.js'), /joinGuild\(memberships, guild, now, store\);\s+\/\/ AUDIT-RR F2/);
  assert.match(rd('src/scenes/world.js'), /guildInitiationQuestEnded\(activeMemberships\(playerEntity\), q\?\.questName \?\? '',[\s\S]{0,200}_questStore\(\)/, 'the host hands the store');
  _resetModSettings();
});

test('AUDIT-RR F4: the expulsion squad places with CreateFoeSpawner\'s own arguments - no line-of-sight check, the mod\'s distances, a long attempt budget - and standLooseFoe takes all four', () => {
  const he = rd('src/scenes/hostEnchant.js');
  assert.match(he, /mobileType, \{ allied = false, lineOfSightCheck = true, minDistance = 4, maxDistance = 20, attempts = LOOSE_FOE_PLACE_ATTEMPTS \} = \{\}\)/);
  assert.match(he, /for \(let i = 0; i < attempts && !spot; i\+\+\) \{\s+spot = placeFoeFreely\(env, \{ minDistance, maxDistance, lineOfSightCheck \}\);/);
  const ri = rd('src/systems/rrInstall.js');
  assert.match(ri, /export const RR_SQUAD_PLACE_ATTEMPTS = 600;/);
  assert.match(ri, /_host\.spawnFoe\(wave\.mobileType, \{ minDistance: wave\.minDistance, maxDistance: wave\.maxDistance, lineOfSightCheck: false, attempts: RR_SQUAD_PLACE_ATTEMPTS \}\)/);
});

test('AUDIT-RR F5/F8: encumbranceEffects reads the PLAYER alone (RoleplayRealism.cs:582) and SetFatigue clamps both ways; F9: the purification potion\'s install-time read is recorded', () => {
  const ri = rd('src/systems/rrInstall.js');
  assert.match(ri, /if \(!rrModule\('encumbranceEffects'\) \|\| !entity\?\.isPlayer \|\| !entity\?\.stats/);
  assert.match(ri, /entity\.fatigue = Math\.min\(maxFatigue\(entity\), Math\.max\(0, \(entity\.fatigue \?\? 0\) - e\.fatigueEffect\)\)/);
  const dup = ri.match(/^import \{[^}]*\} from '\.\/rrRealism\.js'/gm) || [];
  assert.equal(dup.length, 1, 'one import from rrRealism.js, not two');
});

test('AUDIT-RR F7: EncumbranceEffects_OnNewMagicRound is float arithmetic - the band edges land where the C#\'s do (double arithmetic put 38/50 one off)', () => {
  // double: encOver 0.020000000000000018 -> speed 1, fatigue 2; float32: 0.01999998 -> speed 0, fatigue 1
  const a = rrEncumbranceEffect({ carriedWeight: 38, maxEncumbrance: 50, liveSpeed: 50, permanentSpeed: 50, currentFatigue: 6400 });
  assert.equal(a.encOver, Math.fround(Math.fround(Math.fround(38 / 50) - 0.75) * 2));
  assert.equal(a.speedEffect, 0);
  assert.equal(a.fatigueEffect, 1);
  // and the other way: 43/50 - double says 10/21, float32 11/22
  const b = rrEncumbranceEffect({ carriedWeight: 43, maxEncumbrance: 50, liveSpeed: 50, permanentSpeed: 50, currentFatigue: 6400 });
  assert.equal(b.speedEffect, 11);
  assert.equal(b.fatigueEffect, 22);
  assert.equal(rrEncumbranceEffect({ carriedWeight: 37, maxEncumbrance: 50 }), null, 'under three quarters, nothing');
});

test('AUDIT-RR F26: TrainingSkillPicker_OnItemPicked\'s `(float)skillValue / trainingMax` is float32 too - 3 gold at 20/60 is 3, not 2', () => {
  assert.equal(rrTrainingCost(3, 20, 60), 3);
  assert.equal(rrTrainingCost(5, 30, 50), 5);
  assert.equal(rrTrainingCost(5, 90, 50), 6);
  assert.equal(rrTrainingCost(100, 0, 50), 50, 'a raw skill trains for half');
  assert.equal(rrTrainingCost(100, 25, 50, false), 100, 'variableTrainingPrice off');
});

test('AUDIT-RR F10: an ENEMY_BASICS row the mod cannot write is said, not skipped in silence', () => {
  assert.match(rd('src/systems/rrRealism.js'), /if \(!target \|\| Object\.isFrozen\(target\)\) \{ if \(target\) console\.warn\(`\[rr\] enemyAppearance: ENEMY_BASICS row \$\{id\} is frozen/);
});

test('AUDIT-RR F13: the sprite-variant race reads the location\'s climate SETTINGS\' worldClimate (223-232), not the climate type 0-3 that fell to the Breton arm everywhere', () => {
  assert.match(rd('src/scenes/worldModes.js'), /worldClimate: hit\.dfLocation\?\.climate\?\.worldClimate \?\? null,\s+\/\/ AUDIT-RR F13/);
});

test('AUDIT-RR F14/F25: the neck band is the sprite\'s BOTTOM fifth (Unity v = 0 is the bottom row; the port samples v = 0 at the top) and the docked large HUD lifts the mount by its own height', () => {
  const band = rrRidingNeckBand(10);
  assert.deepEqual(band, { u0: RR_RIDING.extX, u1: RR_RIDING.extX + RR_RIDING.extW, v0: 0.8, v1: 0.8 + 0.1, widthTrim: 14 });
  assert.equal(rrRidingNeckBand(0).v1, 0.8, 'no lift, no band');
  const mr = rd('src/player/mountRig.js');
  assert.match(mr, /import \{ horseOffsetHeight, dockedLargeHudHeight \} from '\.\.\/ui\/hudLarge\.js'/);
  assert.match(mr, /const offset = Math\.trunc\(dockedLargeHudHeight\(\)\);[^\n]*\n\s+rect\.y = c\.height - \(\(art\.height \+ yAdj\) \* scaleY\) - offset;\s+return \{ yAdj, scaleY, c, offset \};/);   // AUDIT-RR2 G4: `(int)` (EnhancedRiding.cs:257)
  assert.match(mr, /function drawNeckBand\(\{ yAdj, scaleY, c, offset \}, rect, art, r\)/);
  assert.match(mr, /\{ u0: band\.u0, v0: band\.v0, u1: band\.u1, v1: band\.v1 \}/);
});

test('AUDIT-RR F15/F16/F17/F18: the riding component\'s contacts - a civilian under the hooves bleeds LETHAL, cries at RidingVolumeScale, is retired; a foe is charged ONCE with the component\'s own knockback and the heavy pain voice, the blow handed down with no knock direction', () => {
  _resetModSettings();
  setModSetting(V, 'EnhancedRiding.TrampleCivilians', true);
  const log = [];
  const person = { gender: GENDERS.Female, facingYaw: 1 };
  const seat = { person, pos: [0.5, 0, 0] };
  const foe = { ai: { feet: [0, 0, 0.5] }, entity: { isClass: true } };
  const far = { ai: { feet: [5, 0, 5] } };
  const playerEntity = { fatigue: 64 * 100, skills: { [SKILLS.HandToHand]: 50 }, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, level: 5 };
  const rig = createRrRidingContacts({
    playerEntity, feet: () => [0, 0, 0], yaw: () => 0, livePersons: () => [seat], foes: () => [foe, far], guards: () => [], isGuardRecord: () => false,
    splashBlood: (pos, fwd) => log.push(['blood', pos, fwd]), playClip: (clip, vol) => log.push(['clip', clip, vol]), ridingVolumeScale: () => 0.6,
    spawnGuards: () => log.push(['spawnGuards']), spawnCityGuard: () => null, setCrime: (c) => log.push(['crime', c]), retire: (p) => log.push(['retire', p]),
    hurtGuard: () => log.push(['hurtGuard']), damageFoe: (f, damage, at, ...rest) => log.push(['damageFoe', f, damage, at, rest]), voice: () => ({ clip: 7 }), rolls: () => 0.5,
  });
  rig.contacts();
  assert.deepEqual(log.find((l) => l[0] === 'blood'), ['blood', [0, 1, 2], [0, 0, 1]], 'BloodPos: 2 ahead, 1 up');
  assert.deepEqual(log.find((l) => l[0] === 'clip' && l[1] === SOUND.BretonFemalePain3), ['clip', SOUND.BretonFemalePain3, 0.6], 'RidingVolumeScale, the master bus carries SoundVolume');
  assert.ok(log.some((l) => l[0] === 'spawnGuards'));
  assert.deepEqual(log.find((l) => l[0] === 'crime'), ['crime', CRIMES.Assault]);
  assert.deepEqual(log.find((l) => l[0] === 'retire'), ['retire', person]);
  assert.equal(person.trampled, true);
  const charge = log.find((l) => l[0] === 'damageFoe');
  assert.ok(charge, 'the foe in reach was charged');
  assert.equal(charge[1], foe);
  assert.ok(charge[2] > 0, 'the charge damage');
  assert.deepEqual(charge[3], [0, 0, 0], 'BloodPos');
  assert.deepEqual(charge[4], [], 'no knock direction handed down (F17) - the component wrote its own');
  assert.equal(foe.ai.knockbackSpeed, RR_RIDING.chargeKnockback);
  assert.deepEqual(foe.ai.knockbackDir, [0, 0, 1]);
  assert.ok(log.some((l) => l[0] === 'clip' && l[1] === 7 && l[2] === 1), 'the heavy pain voice at full');
  assert.equal(foe.entity.pickpocketAttempted, true, 'AUDIT-RR2 G24: the pickpocket latch');
  assert.equal(log.filter((l) => l[0] === 'damageFoe').length, 1, 'the far foe was not');
  rig.contacts();
  assert.equal(log.filter((l) => l[0] === 'damageFoe').length, 1, 'once');
  assert.equal(rig.chargeFoe(foe, [1, 0, 0]), false);
  assert.equal(RR_TRAMPLE_REACH, 0.9);
  // F18: the voice is the heavy pain cry with no CombatVoices gate and no dice - a monster too
  const monster = { entity: { isClass: false }, mobileType: 0 };
  const v = enemyHeavyPainVoice(monster, () => 0.99);
  assert.ok(v && typeof v.clip === 'number', 'a monster answers');
  assert.match(rd('src/scenes/hostCombat.js'), /export function enemyHeavyPainVoice\(f, rolls = Math\.random\) \{\s+if \(!f\) return null;[\s\S]{0,400}const gender = \(f\.gender === 'male' \|\| f\.mobileType === KNIGHT_CITY_WATCH\) \? 'male' : 'female';\s+return combatVoice\(\{ race: foeVoiceRace\(f, rolls\), gender, isAttack: false, heavyDamage: true, rolls \}\);/);   // AUDIT-RR2 G2: the component's own pick (:190-194)
  // F15: both hosts hand LETHAL_HIT to the splash; both stand the component; the standalone exterior runs its contacts
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(h);
    assert.match(s, /splashBlood: \(pos, fwd\) => hitEffects\.showBloodSplash\(0, pos, fwd, LETHAL_HIT\)/, `${h}: LETHAL_HIT`);
    assert.match(s, /createRrRidingContacts\(\{/, `${h}: the component`);
    assert.match(s, /voice: \(f\) => enemyHeavyPainVoice\(f\)/, `${h}: the voice`);
  }
  assert.match(rd('src/scenes/world.js'), /ridingVolumeScale: \(\) => \(_travelSoundsOff \? 0 : RIDING_VOLUME_SCALE\)/);
  assert.match(rd('src/scenes/exterior.js'), /if \(rrRidingOn\(\) && player\.riding && player\.isRunning\) rrRiding\.contacts\(\);/);
  _resetModSettings();
});

test('AUDIT-RR F6/F23/F24/F30: the bed\'s click rests in THAT bed (ignoreAllocatedBed), the intense box rides over DFU\'s own TrainSkill box, the gold gate counts letters of credit, RaiseTime before the skill write', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /interiorKeyCtx\.toggleRest\(\{ ignoreAllocatedBed: true \}\);/);
  assert.match(wm, /toggleRest\(\{ ignoreAllocatedBed = false \} = \{\}\) \{/);
  assert.match(wm, /createRestWindow\(interiorRestDeps, ignoreAllocatedBed\)/);   // through main's rest door (RESTDOOR1), the flag riding
  const intensive = wm.indexOf('interiorTicker.advance(days * MINUTES_PER_DAY);   // RaiseTime(SecondsPerDay * 4) first');
  assert.ok(intensive > 0);
  assert.ok(wm.indexOf('playerEntity.skills[skill] = permanentSkillValue(playerEntity, skill) + points;   // SetPermanentSkillValue', intensive) > intensive, 'the days pass, then the +4');
  const gw = rd('src/ui/guildServiceWindows.js');
  assert.match(gw, /import \{ goldAmount, totalGoldAmount \} from '\.\.\/systems\/court\.js'/);
  assert.match(gw, /if \(totalGoldAmount\(entity\) < cost\) return \[\{ rows: macroRows\(rows, NOT_ENOUGH_GOLD_ID, ctx\) \}\];/);
  assert.match(gw, /AUDIT-RR F23: TrainSkill pushes DFU's own MessageBox\(TrainSkillId\)/);
});

test('AUDIT-RR F32/F35: WorldDataVariants\' last key is THIS location\'s before its blocks are read, and a negative key asks nothing', () => {
  clearWorldDataVariants();
  setBlockVariant('TVRNAS02.RMB', '_rr');
  setLastLocationKeyTo(17, 42);
  assert.equal(lastLocationKeyOf(), makeLocationKey(17, 42));
  assert.equal(getBlockVariantHere('TVRNAS02.RMB'), '_rr', 'AnyLocationKey answers for a live key');
  setLastLocationKeyTo(-1, 0);
  assert.ok(lastLocationKeyOf() < 0);
  assert.equal(getBlockVariantHere('TVRNAS02.RMB'), NO_VARIANT, '`if (lastLocationKey >= 0)` (WorldDataVariants.cs:192)');
  clearWorldDataVariants();
  assert.match(rd('src/scenes/world.js'), /setLastLocationKeyTo\(dfLocation\.regionIndex, dfLocation\.locationIndex \?\? 0\);\s+\/\/ AUDIT-RR F32/);
  assert.match(rd('src/scenes/exterior.js'), /setLastLocationKeyTo\(dfLocation\.regionIndex, dfLocation\.locationIndex \?\? 0\);\s+\/\/ AUDIT-RR F32/);
  const w = rd('src/scenes/world.js');
  const key = w.indexOf('setLastLocationKeyTo(dfLocation.regionIndex, dfLocation.locationIndex ?? 0);   // AUDIT-RR F32');
  const layout = w.indexOf('layoutLocation(', key);
  assert.ok(key > 0 && layout > key && layout - key < 4000, 'the key is set before the layout that reads it');
});

test('AUDIT-RR F33/F34/F36/F37/F38/F39: the locationnew resolver is wired at install, place.js seeds the merge with the location index, no phantom discovery record, a duplicate location throws, a stored replacement block is read again, a new game clears the variants', () => {
  assert.match(rd('src/formats/worldDataReplacement.js'), /export function installWorldDataReplacement\(\) \{[\s\S]{0,200}setNewLocationIndexResolver\(getNewDFLocationIndex\);/);
  assert.match(rd('src/formats/worldDataReplacement.js'), /if \(dfRegion\.mapIdLookup\.has\(dfLocation\.mapTableData\.mapId\)\) throw new Error/);
  assert.match(rd('src/formats/worldDataReplacement.js'), /if \(dfRegion\.mapNameLookup\.has\(dfLocation\.name\)\) throw new Error/);
  assert.match(rd('src/systems/quest/place.js'), /mergeNamedBuildings\(location\.exterior\.buildings, blocks\.filter\(\(b\) => b\.dfBlock\), \{ locationIndex: location\.locationIndex \?\? 0 \}\)/);
  assert.match(rd('src/scenes/world.js'), /const armRec = arm \? \(topicTree\.listBuildings \?\? \[\]\)\.find\(\(b\) => b\.buildingKey === arm\.buildingKey\) : null;\s+if \(arm && armRec\) discoverBuilding\(/);
  assert.match(rd('src/formats/blocksFile.js'), /if \(this\._blocks\[block\] !== null && this\._blocks\[block\]\.bytes !== null\) return true;\s+\/\/ AUDIT-RR F38/);
  const cg = rd('src/systems/chargenSession.js');
  assert.equal((cg.match(/^\s+clearWorldDataVariants\(\);\s+\/\/ AUDIT-RR F39/gm) || []).length, 2, 'both new-game paths');
});

test('AUDIT-RR (RRI) F3/F5/F6/F7/F8/F9/F10: shops stock the registered custom items; a fur piece\'s weight is its own field; random armor is named; NativeMaterialValue and GetEquipSound are the class\'s; a mod spell survives the save; ConvertOrcish walks the loot', () => {
  _resetModSettings();
  assert.deepEqual(customItemsForGroup('Weapons'), [513, 514]);
  assert.deepEqual(customItemsForGroup('Armor'), [515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526]);
  setModSetting(RRI_VENDOR, 'newArmor', false);
  assert.deepEqual(customItemsForGroup('Armor'), [], 'off, none registered');
  _resetModSettings();
  // F7: a mail hauberk's NativeMaterialValue is the chain family's (its forbidden-armor bit), a classic item its own
  const hauberk = { group: 'Armor', templateIndex: 515, material: ARMOR_MATERIAL.Steel };
  assert.equal(rriNativeMaterialValue(hauberk), RRI_CLASSES[515].nativeMaterialValue(hauberk));
  assert.equal(rriNativeMaterialValue({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Steel }), ARMOR_MATERIAL.Steel);
  // F8: the jerkin equips as leather whatever its material; the archer's axe as an axe; a classic item answers null
  assert.equal(rriEquipSound({ templateIndex: 520, material: ARMOR_MATERIAL.Steel }), 'EquipLeather');
  assert.equal(rriEquipSound({ templateIndex: 513 }), 'EquipAxe');
  assert.equal(rriEquipSound({ templateIndex: 102 }), null);
  assert.ok(!/soundClips|itemTemplates|\/equip\.js|equipTable/.test(rd('src/systems/rriItems.js').match(/^import[^\n]*$/gm).join('\n')), 'the law stays a leaf');
  // F5: an item carrying weightInKg answers it
  assert.equal(unitWeightInKg({ group: 'Armor', templateIndex: 523, material: ARMOR_MATERIAL.Leather, weightInKg: 1.4 }), 1.4);
  assert.equal(unitWeightInKg({ group: 'Armor', templateIndex: 523, material: ARMOR_MATERIAL.Leather, weightInKg: 1.4, water: 0.5 }), 1.9);
  assert.match(rd('src/systems/inventory.js'), /if \(Number\.isFinite\(item\.weightInKg\)\) return item\.weightInKg \+/);
  assert.match(rd('src/systems/itemTemplates.js'), /AUDIT-RR F5: ApplyArmorMaterial runs BEFORE the class's SetVariant/);
  // F3: the shelf's second loop
  const shop = rd('src/systems/shopStock.js');
  assert.match(shop, /const customs = customItemsForGroup\(group\);\s+let customChanceMod = chanceMod;\s+if \(customChanceMod === 0 && group === 'Transportation'\) customChanceMod = 20;/);
  assert.match(shop, /const stockChance = Math\.trunc\(customChanceMod \* 5 \* \(21 - t\.rarity\) \/ 100\);\s+if \(!dice100\(stockChance, rolls\(\)\)\) continue;\s+if \(group === 'Weapons'\) add\(\{ group, templateIndex, material: randomMaterial\(level, rolls\), flags: 0 \}\);\s+else if \(group === 'Armor'\) add\(\{ group, templateIndex, material: randomArmorMaterial\(level, rolls\) \}\);/);
  // F6: random armor minted through setItemFields (named); F9: a mod spell serialised whole; F10: loot items converted too
  assert.match(rd('src/systems/loot.js'), /AUDIT-RR F6: the class ctor names the item from its template BEFORE SetVariant/);
  assert.ok(!/rriVariantFields/.test(rd('src/systems/loot.js')), 'the mint runs the variant fold, not the loot');
  assert.match(rd('src/systems/save.js'), /\(sp\?\.custom \|\| sp\?\.rri\) \? JSON\.parse\(JSON\.stringify\(sp\)\) : sp\.index/);
  assert.match(rd('src/systems/equip.js'), /\(1 << \(rriNativeMaterialValue\(item\) >> 8\)\) & forbiddenArmors/);
  assert.match(rd('src/systems/equip.js'), /const own = rriEquipSound\(item\);\s+\/\/ AUDIT-RR F8/);
  assert.match(rd('src/combat/rriEnemyEquipment.js'), /AUDIT-RR F10: `Items\.SearchItems\(Weapons\)` \+ `\(Armor\)` \(:691-692\)/);
});

test('AUDIT-RR: checked and standing - the named-not-changed departures are recorded where they live', () => {
  const rr = rd('bible/06-Systems/Roleplay-Realism.md');
  const rri = rd('bible/06-Systems/Roleplay-Realism-Items.md');
  assert.match(rr, /^## AUDIT-RR \(2026-09-23\)/m);
  assert.match(rri, /^## AUDIT-RR \(2026-09-23\)/m);
  for (const f of ['F1', 'F2', 'F4', 'F5', 'F6', 'F7', 'F8', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F23', 'F24', 'F25', 'F26', 'F30', 'F32', 'F33', 'F34', 'F35', 'F36', 'F37', 'F38', 'F39']) assert.match(rr, new RegExp(`\\*\\*${f} `), `${f} recorded`);
  for (const f of ['F3', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']) assert.match(rri, new RegExp(`\\*\\*${f} `), `RRI ${f} recorded`);
  assert.match(rr, /named, not changed/i);
  assert.match(rd('bible/06-Systems/Systems.md'), /\d+ modules live under/);   // the count is U42's to pin
});
