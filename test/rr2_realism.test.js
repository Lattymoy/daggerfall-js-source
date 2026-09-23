// RR2 - Roleplay & Realism 1.8 (Hazelnut): the NPC sprite variants
// (RoleplayRealism.cs:775-1077), EnhancedRiding.cs and
// GuildServiceTrainingRR.cs - each law against the C#, each behind the
// mod's own switch, and the seam it hangs on in the port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setModSetting, _resetModSettings, MOD_SETTINGS } from '../src/systems/modSettings.js';
import {
  RR_RIDING, rrRidingOn, rrRidingSetting, rrCanRunRiding, rrRidingInputLimits, rrTerrainAngle, rrTerrainFollow, rrRidingYAdj,
  rrRidingNeckBand, rrChargeDamage, rrTrampleOutcome, RR_WEEK_BUTTON, RR_INTENSIVE_DAYS, RR_INTENSIVE_SKILL_POINTS, rrRefinedTrainingOn,
  rrTrainingCost, rrIntensiveCost, rrIntensiveOffered, RR_TRAINING_LINES,
} from '../src/systems/rrRealism.js';
import {
  RR_NPC_XML_SCALE, RR_NPC_ARCHIVE, RR_NPC_RECORDS, RR_BUTTON_RECORDS, rrArtUrl, rrRecord182_0, rrShopTavernRecord, rrResidentGender,
  rrClimateRace, rrResidentVariant, rrVariantPerson, installRoleplayRealismArt, _resetRoleplayRealismArt,
} from '../src/systems/rrVariants.js';
import { installRoleplayRealism, setRrHostSeams, rrHostSeams } from '../src/systems/rrInstall.js';
import { PERSON_TEXTURES, PERSON_FACE_RECORDS, PERSON_IDLE_RECORD, NUM_PERSON_FACE_VARIANTS, MobilePerson } from '../src/characters/mobilePerson.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { flatFaceOverride, _resetFlatFaceOverrides } from '../src/characters/staticNpc.js';
import { billboardXmlScale } from '../src/world/billboardXml.js';
import { hasTextureReplacement, clearVendorTextures } from '../src/systems/textureReplacement.js';
import { buttonArtRegistered, registerButtonArt } from '../src/ui/messageBox.js';
import { canRunUnlessRiding, TRANSPORT_MODES } from '../src/systems/transport.js';
import { MoveAxes, setAxisLimitsProvider } from '../src/player/moveAxes.js';
import { LookFilter, pitchFloor, PITCH_FLOOR, setPitchFloorProvider } from '../src/player/lookFilter.js';
import { createMountRig } from '../src/player/mountRig.js';
import { NATIVE_SCREEN_HEIGHT, SCALE_FACTOR_X } from '../src/systems/riding.js';
import { TownPopulation } from '../src/systems/townPopulation.js';
import { CityNavigation } from '../src/world/cityNavigation.js';
import { buildRefinedTrainingFlow, spliceSkillName } from '../src/ui/guildServiceWindows.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';
import { GUILDS } from '../src/systems/guilds.js';
import { SKILLS, SKILL_NAMES, permanentSkillValue } from '../src/systems/skills.js';
import { TRAINING_SKILLS, trainingPrice, trainingMax } from '../src/systems/guildServices.js';
import { NOT_ENOUGH_GOLD_ID } from '../src/systems/guildServiceActions.js';
import { handToHandMinDamage, handToHandMaxDamage } from '../src/combat/formulas.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = 'roleplay-realism';
const on = (key, v = true) => setModSetting(V, key, v);
// MO1: every vendored mod's Enabled defaults TRUE, so "off" is said, not assumed
const reset = () => { _resetModSettings(); _resetFlatFaceOverrides(); };
const off = () => { reset(); on('Enabled', false); };

installRoleplayRealism();

// ---- the record --------------------------------------------------------------
test('RR2 the record: the seven XML scales verbatim, the 24 sprites the manifest names under public/art, the eleven switches', () => {
  for (const r of RR_NPC_RECORDS) {
    const xml = rd(`vendor/roleplay-realism/Textures/${RR_NPC_ARCHIVE}_${r}-0.xml`);
    const sx = Number(/<scaleX>([\d.]+)<\/scaleX>/.exec(xml)[1]), sy = Number(/<scaleY>([\d.]+)<\/scaleY>/.exec(xml)[1]);
    assert.deepEqual(RR_NPC_XML_SCALE[r], [sx, sy], `197_${r}-0.xml`);
  }
  const manifest = JSON.parse(rd('vendor/roleplay-realism/roleplay-realism.dfmod.json'));
  const named = new Set(manifest.Files.filter((f) => f.endsWith('.png')).map((f) => f.split('/').pop()));
  const shipped = readdirSync(join(ROOT, 'public/art/roleplay-realism')).filter((f) => f.endsWith('.png')).sort();
  assert.equal(shipped.length, 24, '7 sprites + 17 buttons');
  for (const f of shipped) assert.ok(named.has(f), `${f} is the mod's own`);
  assert.deepEqual(RR_BUTTON_RECORDS, Array.from({ length: 17 }, (_, i) => 21 + i));
  assert.ok(!existsSync(join(ROOT, 'vendor/roleplay-realism/Textures/197_0-0.png')), 'one copy: the served one');
  assert.equal(rrArtUrl('197_3-0', 'http://h/x/'), 'http://h/x/art/roleplay-realism/197_3-0.png');
  const keys = MOD_SETTINGS[V].keys;
  for (const k of ['variantNpcs', 'variantResidents', 'EnhancedRiding.enhancedRiding', 'EnhancedRiding.RealisticMovement', 'EnhancedRiding.followTerrainEnabled',
    'EnhancedRiding.followTerrainSoftenFactor', 'EnhancedRiding.GallopingInTowns', 'EnhancedRiding.TrampleCivilians', 'RefinedTraining.refinedTraining',
    'RefinedTraining.variableTrainingPrice', 'RefinedTraining.intensiveTraining']) assert.ok(keys[k], k);
  assert.equal(RR_RIDING.lookPitchRatio, 2.6); assert.equal(RR_RIDING.samples, 16); assert.equal(RR_RIDING.pitchMaxOffset, 18);
  assert.equal(RR_RIDING.chargeKnockback, 100); assert.equal(RR_RIDING.chargeFatigueMultiplier, 15);
  // the csv's training lines
  const csv = rd('vendor/roleplay-realism/RoleplayRealismModData.csv');
  for (const [k, v] of Object.entries(RR_TRAINING_LINES)) assert.ok(csv.includes(`${k},"${v}"`), k);
});

// ---- the shop and tavern keeper (:775-849) -----------------------------------------
test('RR2 the keeper: GetRecord_182_0 by quality, the tavern keeper and the 182_2 arms, only in a shop or a tavern', () => {
  assert.deepEqual([5, 6, 9, 10, 13, 14, 17, 18, 20, 21].map(rrRecord182_0), [-1, 0, 0, 1, 1, 2, 2, 3, 3, -1]);
  const T = BUILDING_TYPES.Tavern, S = BUILDING_TYPES.GeneralStore, H = BUILDING_TYPES.House1;
  assert.equal(rrShopTavernRecord(182, 0, T, 12), 1);
  assert.equal(rrShopTavernRecord(182, 0, S, 19), 3);
  assert.equal(rrShopTavernRecord(182, 1, T, 11), 4, 'under 12');
  assert.equal(rrShopTavernRecord(182, 1, T, 12), -1, '12-14 keeps the classic');
  assert.equal(rrShopTavernRecord(182, 1, T, 14), -1);
  assert.equal(rrShopTavernRecord(182, 1, T, 15), 5, 'past 14');
  assert.equal(rrShopTavernRecord(182, 2, T, 12), -1);
  assert.equal(rrShopTavernRecord(182, 2, T, 13), 6, 'past 12');
  assert.equal(rrShopTavernRecord(182, 3, T, 20), -1, 'no other record');
  assert.equal(rrShopTavernRecord(184, 0, T, 20), -1, 'no other archive');
  assert.equal(rrShopTavernRecord(182, 0, H, 20), -1, 'not a house');
  assert.equal(rrShopTavernRecord(182, 0, BUILDING_TYPES.Temple, 20), -1, 'not a temple');
});

// ---- the residents (:851-1077) --------------------------------------------------
test('RR2 the resident: the gender tables, the climate race, the walker and its face by the name seed', () => {
  assert.deepEqual([10, 12, 28, 41, 45].map((r) => rrResidentGender(182, r)), [1, 1, 1, 1, 1]);
  assert.deepEqual([15, 17, 19, 20, 35, 39, 46].map((r) => rrResidentGender(182, r)), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([1, 7, 9, 10, 19, 22, 23, 26, 28, 29, 30, 33].map((r) => rrResidentGender(184, r)), Array(12).fill(1));
  assert.deepEqual([0, 4, 16, 17, 20, 21, 24, 25].map((r) => rrResidentGender(184, r)), Array(8).fill(0));
  assert.equal(rrResidentGender(182, 0), -1); assert.equal(rrResidentGender(184, 2), -1); assert.equal(rrResidentGender(183, 1), -1);
  assert.equal(rrClimateRace(CLIMATES.Desert), 'Redguard'); assert.equal(rrClimateRace(CLIMATES.Rainforest), 'Redguard');
  assert.equal(rrClimateRace(CLIMATES.Mountain), 'Nord');
  assert.equal(rrClimateRace(CLIMATES.Woodlands), 'Breton'); assert.equal(rrClimateRace(CLIMATES.Swamp), 'Breton');
  assert.equal(rrClimateRace(null), 'Breton', 'the default arm');
  assert.equal(NUM_PERSON_FACE_VARIANTS, 24);
  // a woman of 182_10, seed 5: faceVariant 5, outfit 1
  let v = rrResidentVariant({ archive: 182, record: 10, factionID: 0, nameSeed: 5 }, 'Breton');
  assert.deepEqual(v, { textureArchive: PERSON_TEXTURES.Breton.female[1], textureRecord: PERSON_IDLE_RECORD, faceIndex: PERSON_FACE_RECORDS.Breton.female[1] + 5, gender: 1 });
  assert.equal(v.textureArchive, 454); assert.equal(v.textureRecord, 5); assert.equal(v.faceIndex, 77);
  // a man of 184_0, seed 30: 30 % 29 = 1, outfit 2, a Nord
  v = rrResidentVariant({ archive: 184, record: 0, nameSeed: 30 }, 'Nord');
  assert.deepEqual(v, { textureArchive: 389, textureRecord: 5, faceIndex: 168 + 1, gender: 0 });
  // one in five keeps the classic: faceVariant 24..28
  assert.equal(rrResidentVariant({ archive: 182, record: 10, nameSeed: 24 }), null);
  assert.equal(rrResidentVariant({ archive: 182, record: 10, nameSeed: 28 }), null);
  assert.notEqual(rrResidentVariant({ archive: 182, record: 10, nameSeed: 29 }), null, '29 % 29 = 0');
  assert.equal(rrResidentVariant({ archive: 182, record: 10, factionID: 5, nameSeed: 5 }), null, 'a faction person is not a resident');
  assert.equal(rrResidentVariant({ archive: 182, record: 0, nameSeed: 5 }), null, 'not a known gender');
});

test('RR2 the decision per person: the two switches, the face override for the born flat, the interior context draws the answer', () => {
  off();
  const keeper = { textureArchive: 182, textureRecord: 0, factionID: 0 };
  const resident = { textureArchive: 182, textureRecord: 10, factionID: 0 };
  assert.equal(rrVariantPerson(keeper, { buildingType: BUILDING_TYPES.Tavern, quality: 15 }), null, 'off');
  on('Enabled'); on('variantNpcs'); on('variantResidents', false);
  assert.deepEqual(rrVariantPerson(keeper, { buildingType: BUILDING_TYPES.Tavern, quality: 15 }), { textureArchive: 197, textureRecord: 2 });
  assert.equal(rrVariantPerson(keeper, { buildingType: BUILDING_TYPES.Tavern, quality: 3 }), null, 'a quality under 6 keeps the classic');
  assert.equal(rrVariantPerson(resident, { buildingType: BUILDING_TYPES.House2, quality: 10, nameSeed: 5, worldClimate: CLIMATES.Desert }), null, 'variantResidents is off');
  assert.equal(flatFaceOverride(182, 10), null);
  on('variantResidents');
  assert.deepEqual(rrVariantPerson(resident, { buildingType: BUILDING_TYPES.House2, quality: 10, nameSeed: 5, worldClimate: CLIMATES.Desert }),
    { textureArchive: PERSON_TEXTURES.Redguard.female[1], textureRecord: 5 });
  assert.equal(flatFaceOverride(182, 10), PERSON_FACE_RECORDS.Redguard.female[1] + 5, 'flatsDict[182_10] = { faceIndex } - the born flat, so the talk portrait matches');
  assert.equal(rrVariantPerson(resident, { buildingType: BUILDING_TYPES.Tavern, quality: 10, nameSeed: 5 }), null, 'a resident is only swapped in a house');
  assert.equal(rrVariantPerson(null), null);
  // the interior context asks per person and draws the answer; identity keeps the born flat
  const ic = rd('src/scenes/interiorContext.js');
  assert.match(ic, /const v = opts\.variantPerson\?\.\(pn\) \?\? null;/);
  assert.match(ic, /\.\.\.\(v \? \{ drawArchive: v\.textureArchive, drawRecord: v\.textureRecord \} : \{\}\)/);
  assert.ok((ic.match(/pn\.drawArchive \?\? pn\.textureArchive/g) ?? []).length >= 5, 'every draw read');
  assert.match(rd('src/scenes/dataPipeline.js'), /flatFaceOverride\(archive, record\) \?\? flats\?\.faceIndex\(archive, record\) \?\? -1/, 'the face lookup reads the override first');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /variantPerson: \(pn\) => rrVariantPerson\(pn, \{\s*buildingType: interiorBuilding\?\.buildingType \?\? -1, quality: interiorBuilding\?\.quality \?\? 0,/);
  assert.match(wm, /worldClimate: hit\.dfLocation\?\.climate\?\.worldClimate \?\? null,/, 'AUDIT-RR F13: the WORLD climate (223-232), not the base type');
  reset();
});

test('RR2 the art on its doors: the XML scale and the 197 sprites under variantNpcs, the seventeen buttons under refinedTraining, once', async () => {
  off(); clearVendorTextures(); _resetRoleplayRealismArt();
  const asked = [];
  const n = installRoleplayRealismArt({ fetchBytes: async (name) => { asked.push(name); return new Uint8Array(); } });
  assert.equal(n, 7);
  assert.equal(installRoleplayRealismArt(), 0, 'once');
  assert.equal(hasTextureReplacement(197, 2), false, 'gated: off');
  assert.equal(billboardXmlScale(197, 2), null);
  on('Enabled'); on('variantNpcs');
  for (const r of RR_NPC_RECORDS) assert.equal(hasTextureReplacement(197, r), true, `197_${r}`);
  on('variantNpcs', false);
  assert.equal(hasTextureReplacement(197, 2), false, 'the module alone gates it');
  on('variantNpcs');
  assert.deepEqual(billboardXmlScale(197, 1), { x: 1.516, y: 0.950 });
  assert.deepEqual(billboardXmlScale(197, 6), { x: 3, y: 0.8 });
  for (const r of RR_BUTTON_RECORDS) assert.equal(buttonArtRegistered(r), true, `button ${r}`);
  assert.equal(buttonArtRegistered(20), false, 'the classic file ends at 20 and is not touched');
  assert.equal(asked.length, 0, 'lazy: nothing fetched at install');
  reset(); clearVendorTextures();
  for (const r of RR_BUTTON_RECORDS) registerButtonArt(r, null);
});

// ---- EnhancedRiding.cs ----------------------------------------------------------
test('RR2 riding laws: CanRun, the axis limits, the terrain angle and its average, the lift, the neck band, the charge, the trample', () => {
  // CanRunUnlessRidingCart (:95-99)
  assert.equal(rrCanRunRiding({ mode: 'Horse', riding: true }), true);
  assert.equal(rrCanRunRiding({ mode: 'Cart', riding: true }), false, 'no galloping with the cart');
  assert.equal(rrCanRunRiding({ mode: 'Horse', riding: true, inTown: true }), false, 'nor in a town');
  assert.equal(rrCanRunRiding({ mode: 'Horse', riding: true, inTown: true, gallopingInTowns: true }), true, 'unless GallopingInTowns');
  assert.equal(rrCanRunRiding({ mode: 'Cart', riding: false, inTown: true }), true, 'on foot the mount is not asked');
  // RealisticMovement (:128-136)
  assert.deepEqual(rrRidingInputLimits({ riding: true, mode: 'Horse' }), { negVertical: 0.5, negHorizontal: 0.4, posHorizontal: 0.4 });
  assert.deepEqual(rrRidingInputLimits({ riding: true, mode: 'Cart' }), { negVertical: 0.2, negHorizontal: 0.1, posHorizontal: 0.1 });
  assert.deepEqual(rrRidingInputLimits({ riding: false, mode: 'Cart' }), { negVertical: 1, negHorizontal: 1, posHorizontal: 1 });
  // the terrain sample (:139-146) and OnGUI's average (:281-287)
  assert.equal(rrTerrainAngle(10, 10), 0);
  assert.ok(Math.abs(rrTerrainAngle(10, 11) - Math.atan2(-1, 1) * 100) < 1e-9, 'uphill ahead is negative');
  assert.equal(rrTerrainFollow([10, 20, 30, 40], 0), 25);
  assert.equal(rrTerrainFollow([10, 20, 30, 40], 8), 100 / 12, 'the soften factor pads the divisor');
  assert.equal(rrTerrainFollow([10, 20], 0, false), 0, 'not following: 0');
  assert.equal(rrTerrainFollow([], 0), 0);
  // yAdj = (Pitch - terrainAngle - 10) * 2.6 (:289)
  assert.ok(Math.abs(rrRidingYAdj(0, 0) - -26) < 1e-9);
  assert.ok(Math.abs(rrRidingYAdj(30, 5) - 39) < 1e-9);
  // the band (:303-320)
  const band = rrRidingNeckBand(50);
  assert.ok(Math.abs(band.u1 - 0.84) < 1e-12 && band.u0 === 0.06 && band.widthTrim === 14);
  assert.ok(Math.abs(band.v0 - 0.8) < 1e-12 && Math.abs(band.v1 - (0.8 + 0.5)) < 1e-12, 'AUDIT-RR F14: the bottom fifth of the sprite - Unity\'s v = 0 is the bottom row, the port\'s the top');
  // HandleCharge's blow (:206-210): Range(min, max + 1) + Agility / 10 + Willpower / 10
  assert.equal(rrChargeDamage({ minBase: 3, maxBase: 7, agility: 55, willpower: 68, roll: 0 }), 3 + 5 + 6);
  assert.equal(rrChargeDamage({ minBase: 3, maxBase: 7, agility: 55, willpower: 68, roll: 0.999 }), 7 + 5 + 6, 'the max is reachable');
  assert.equal(rrChargeDamage({ minBase: 3, maxBase: 7, agility: 9, willpower: 9, roll: 0.5 }), 5, 'int division');
  assert.equal(handToHandMinDamage(40), 5); assert.equal(handToHandMaxDamage(40), 9);
  // the trample (:157-186)
  assert.deepEqual(rrTrampleOutcome({ isGuard: false, female: true }), { chargeGuard: false, spawnGuards: true, blood: true, clip: 'BretonFemalePain3', crime: 'Assault', remove: true });
  assert.deepEqual(rrTrampleOutcome({ isGuard: false, female: false }).clip, 'BretonMalePain3');
  assert.deepEqual(rrTrampleOutcome({ isGuard: true }), { chargeGuard: true, spawnGuards: false, blood: false, clip: null, crime: 'Assault', remove: true });
});

test('RR2 riding seams: CanRun through the host reads, the axes clamped, the look floor, the mount lifted and banded, off by the switch', () => {
  off();
  setRrHostSeams({ inTown: () => true, transportMode: () => TRANSPORT_MODES.Horse, riding: () => true });
  assert.equal(rrRidingOn(), false);
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false, 'DFU: no running while riding');
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Foot), true);
  on('Enabled'); on('EnhancedRiding.enhancedRiding'); on('EnhancedRiding.GallopingInTowns', false);
  assert.equal(rrRidingOn(), true);
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), false, 'in town, no GallopingInTowns');
  on('EnhancedRiding.GallopingInTowns');
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Horse), true, 'a gallop');
  assert.equal(canRunUnlessRiding(TRANSPORT_MODES.Cart), false, 'never with the cart');
  assert.equal(rrRidingSetting('GallopingInTowns'), true);
  // the axes (RealisticMovement)
  const none = { forwards: false, backwards: false, left: false, right: false };
  const a = new MoveAxes();
  on('EnhancedRiding.RealisticMovement', false);
  assert.deepEqual(a.update(1 / 60, { ...none, backwards: true, left: true }, { acceleration: false }), { forward: -1, strafe: -1 });
  on('EnhancedRiding.RealisticMovement', true);
  assert.deepEqual(a.update(1 / 60, { ...none, backwards: true, left: true }, { acceleration: false }), { forward: -0.5, strafe: -0.4 });
  assert.deepEqual(a.update(1 / 60, { ...none, forwards: true, right: true }, { acceleration: false }), { forward: 1, strafe: 0.4 });
  setRrHostSeams({ transportMode: () => TRANSPORT_MODES.Cart });
  assert.deepEqual(a.update(1 / 60, { ...none, backwards: true, right: true }, { acceleration: false }), { forward: -0.2, strafe: 0.1 });
  setRrHostSeams({ riding: () => false });
  assert.deepEqual(a.update(1 / 60, { ...none, backwards: true, right: true }, { acceleration: false }), { forward: -1, strafe: 1 }, 'off the mount: 1 / 1 / 1');
  // the look floor (`PitchMaxLimit = terrainAngle + 18`)
  assert.equal(pitchFloor(), PITCH_FLOOR, 'no provider: DFU\'s 75');
  setPitchFloorProvider(() => 30);
  assert.ok(Math.abs(pitchFloor() - (30 * Math.PI) / 180) < 1e-12);
  setPitchFloorProvider(() => 500);
  assert.equal(pitchFloor(), PITCH_FLOOR, 'never past the reference\'s floor');
  setPitchFloorProvider(() => 20);
  const f = new LookFilter(); const cam = { yaw: 0, pitch: 0 };
  f.add(0, -2); f.tick(1 / 60, cam, { smoothing: 0 });
  assert.ok(Math.abs(cam.pitch - -(20 * Math.PI) / 180) < 1e-9, 'the look down stops at the floor');
  setPitchFloorProvider(null);
  // the mount: the rig samples the ground into the ring, lifts the sprite by the look and fills the gap
  const drawn = [];
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Horse, standing: false, isRunning: false, movingLessThanHalfSpeed: false, pos: [0, 0, 0], setTransportMode() {} };
  let enhanced = null;
  const rig = createMountRig({
    renderer: { drawScreenQuad: (tex, rect, uv) => drawn.push({ rect: { ...rect }, uv: uv ?? null }) },
    canvas: { width: 640, height: 400 }, fetchBytes: async () => new Uint8Array(), palette: null,
    audio: { playOneShot() {}, setLoop() {} }, player, playerEntity: { items: [] }, showOverlay: () => {},
    lookPitch: () => 0, lookYaw: () => 0, groundHeightAt: (x, z) => (z > 0.5 ? 1 : 0),   // uphill ahead
    enhancedRiding: () => enhanced,
  });
  rig._setArt({ width: 100, height: 50, frames: [{}, {}, {}, {}] });
  rig.frame(1 / 60);
  assert.equal(drawn.length, 1, 'DFU\'s draw');
  assert.equal(drawn[0].rect.y, 400 - 50 * 2, 'at DFU\'s rect');
  assert.equal(rig.terrainAngle(), 0);
  drawn.length = 0;
  enhanced = { terrainFollowing: true, softenFollow: 0 };
  for (let i = 0; i < 16; i++) rig.frame(1 / 60);   // the ring fills with atan2(-1, 1) * 100
  const angle = Math.atan2(-1, 1) * 100;
  assert.ok(Math.abs(rig.terrainAngle() - angle) < 1e-9, 'the average of a full ring');
  const yAdj = (0 - angle - 10) * 2.6;
  const last = drawn.slice(-2);
  assert.ok(Math.abs(last[0].rect.y - (400 - (50 + yAdj) * 2)) < 1e-9, 'lifted by yAdj x scaleY');
  assert.equal(last[0].uv, null);
  assert.ok(last[1], 'and the band under it');
  assert.ok(Math.abs(last[1].rect.w - (100 - 14) * (last[0].rect.w / 100)) < 1e-9, 'width - 14');
  assert.ok(last[1].uv.u0 === 0.06 && Math.abs(last[1].uv.u1 - 0.84) < 1e-12 && last[1].uv.v0 === 0.8);
  assert.ok(Math.abs(last[1].uv.v1 - (0.8 + yAdj / 100)) < 1e-9, 'AUDIT-RR F14');
  assert.ok(Math.abs(pitchFloor() - Math.min(((angle + 18) * Math.PI) / 180, PITCH_FLOOR)) < 1e-9, 'the rig set the floor at terrainAngle + 18');
  enhanced = null;
  assert.equal(pitchFloor(), PITCH_FLOOR, 'off: DFU\'s floor');
  assert.equal(SCALE_FACTOR_X, 0.8); assert.equal(NATIVE_SCREEN_HEIGHT, 200);
  setPitchFloorProvider(null); setAxisLimitsProvider(null);
  reset();
});

test('RR2 the trample and the charge on the hosts: the contacts each frame, the walker retired, the watchman minted where they stood, the installs', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(rrRidingOn\(\) && player\.riding && player\.isRunning\) rrRidingContacts\(\);/, 'TrampleCivilians && IsRiding && IsRunning, after the rig\'s frame');
  // AUDIT-RR F15: the contacts live in systems/rrRidingHost.js now and BOTH outdoor hosts stand one on their own reads
  const rh = rd('src/systems/rrRidingHost.js');
  assert.match(rh, /latch\.pickpocketAttempted = true;/, 'PickpocketByPlayerAttempted, the latch (AUDIT-RR2 G24: the pickpocket\'s own)');
  assert.match(rh, /f\.ai\.knockbackSpeed = RR_RIDING\.chargeKnockback; f\.ai\.knockbackDir = \[\.\.\.direction\];/);
  assert.match(rh, /playerEntity\.fatigue = Math\.max\(0, \(playerEntity\.fatigue \?\? 0\) - FATIGUE_LOSS\.Default \* RR_RIDING\.chargeFatigueMultiplier\);/);
  assert.match(rh, /rrChargeDamage\(\{ minBase: handToHandMinDamage\(h2h\), maxBase: handToHandMaxDamage\(h2h\), agility: liveStat\(playerEntity, 'agility'\), willpower: liveStat\(playerEntity, 'willpower'\), roll: rolls\(\) \}\)/);
  assert.match(rh, /if \(isGuardRecord\(f\)\) hurtGuard\(f, damage, at\);\s*else damageFoe\(f, damage, at\);/, 'AUDIT-RR F17: DamageHealthFromSource - no knock direction handed to the weapon path');
  assert.match(rh, /const out = rrTrampleOutcome\(\{ isGuard: !!person\.guard, female: person\.gender === GENDERS\.Female \}\);/);
  assert.match(rh, /if \(out\.clip\) playClip\(SOUND\[out\.clip\], ridingVolumeScale\(\)\);/, 'AUDIT-RR F16: RidingVolumeScale');
  assert.match(rh, /spawnCityGuard\(\[\.\.\.seat\.pos\], person\.facingYaw \?\? yaw\(\), \[\.\.\.at\]\)\)\.then\(\(g\) => \{ if \(g\) chargeFoe\(g, fwd\); \}\)/, 'SpawnCityGuard + HandleCharge');
  assert.match(rh, /if \(out\.remove\) \{ person\.trampled = true; retire\(person\); \}/);
  for (const h of ['world', 'exterior']) {
    const s = rd(`src/scenes/${h}.js`);
    assert.match(s, /const rrRiding = createRrRidingContacts\(\{/, `${h}: stands the contacts`);
    assert.match(s, /damageFoe: \(f, damage, feet\) => exteriorFoes\.damageFoe\(f, damage, feet, null, \{ kind: 'melee' \}\),/, `${h}: no knock direction`);
    assert.match(s, /voice: \(f\) => enemyHeavyPainVoice\(f\),/, `${h}: AUDIT-RR F18 - the heavy pain cry`);
    assert.match(s, /setRrHostSeams\(\{ inTown: \(\) => _isPlayerInTownStrict\(\), transportMode: \(\) => player\.transportMode, riding: \(\) => player\.riding \}\);/, `${h}: the seams`);
  }
  assert.match(rd('src/scenes/exterior.js'), /if \(rrRidingOn\(\) && player\.riding && player\.isRunning\) rrRiding\.contacts\(\);/, 'the fixed-city host runs them too (AUDIT-RR F15)');
  assert.match(w, /ridingVolumeScale: \(\) => \(_travelSoundsOff \? 0 : RIDING_VOLUME_SCALE\),/);
  for (const h of ['world', 'exterior']) {
    const s = rd(`src/scenes/${h}.js`);
    assert.match(s, /lookPitch: \(\) => cam\.pitch, lookYaw: \(\) => cam\.yaw, groundHeightAt: \(x, z\) => (heightAt|collider\.heightAt)\(x, z\),/, `${h}: the rig's reads`);
    assert.match(s, /enhancedRiding: \(\) => \(rrRidingOn\(\) \? \{ terrainFollowing: rrRidingSetting\('followTerrainEnabled'\) === true, softenFollow: rrRidingSetting\('followTerrainSoftenFactor'\) \?\? 8 \} : null\),/, h);
  }
  assert.match(rd('src/scenes/cityGuards.js'), /spawnCityGuard: \(pos, yaw, attackerFeet = null\) => spawnGuardAt\(\[\.\.\.pos\], yaw, attackerFeet\),/);
  const inst = rd('src/systems/rrInstall.js');
  assert.match(inst, /setCanRunOverride\(\(mode\) => \(rrRidingOn\(\)\s*\? rrCanRunRiding\(\{ mode, riding: !!_host\.riding\?\.\(\), inTown: !!_host\.inTown\?\.\(\), gallopingInTowns: rrRidingSetting\('GallopingInTowns'\) === true \}\)\s*: null\)\);/);
  assert.match(inst, /setAxisLimitsProvider\(\(\) => \(rrRidingOn\(\) && rrRidingSetting\('RealisticMovement'\) === true\s*\? rrRidingInputLimits\(\{ riding: !!_host\.riding\?\.\(\), mode: _host\.transportMode\?\.\(\) \?\? 'Foot' \}\)\s*: null\)\);/);
  assert.match(inst, /installRoleplayRealismArt\(\);/);
  assert.match(rd('src/systems/transport.js'), /export const canRunUnlessRiding = \(mode\) => _canRun\?\.\(mode\) \?\? !isRiding\(mode\);/);
  assert.match(rd('src/player/lookFilter.js'), /Math\.max\(-pitchFloor\(\), Math\.min\(PITCH_LIMIT, cam\.pitch \+ this\.residualPitch\)\)/);
  assert.ok(typeof rrHostSeams().spawnFoe !== 'undefined');
  // the walker leaves the street at once and its slot is free
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, new Uint8Array(64 * 64), () => 46);
  const pop = new TownPopulation(nav, { totalBlocks: 16, race: 'Breton', rand: () => 0.4, makePerson: (a) => new MobilePerson(nav, { archive: a, frameCount: () => 4, groundY: () => 0 }) });
  const item = pop._freeItem();
  item.active = true; item.visible = true;
  assert.equal(pop.retire(item.person), true);
  assert.equal(item.active, false); assert.equal(item.visible, false);
  assert.equal(pop.retire({}), false, 'not in this pool');
});

// ---- GuildServiceTrainingRR.cs -----------------------------------------------------
test('RR2 refined training laws: the variable price, the intensive cost, the offer gate, the spliced name, the constants', () => {
  assert.equal(rrTrainingCost(200, 0, 50), 100, 'a raw skill trains for half');
  assert.equal(rrTrainingCost(200, 50, 50), 200, 'at the cap, full');
  assert.equal(rrTrainingCost(200, 25, 50), 150);
  assert.equal(rrTrainingCost(333, 10, 50), 333 - Math.trunc(333 * 0.8 / 2), 'the (int) cast');
  assert.equal(rrTrainingCost(201, 0, 50), 101, '100.5 truncates, not rounds');
  assert.equal(rrTrainingCost(200, 0, 50, false), 200, 'variableTrainingPrice off');
  assert.equal(rrIntensiveCost(100, 2), (100 + 16 + 72) * 5);
  assert.equal(rrIntensiveOffered(true, 45, 50), true);
  assert.equal(rrIntensiveOffered(true, 46, 50), false, 'skillValue < trainingMax - 4');
  assert.equal(rrIntensiveOffered(false, 10, 50), false);
  assert.equal(spliceSkillName('Training will cost %a gold', 'Axe'), 'Training Axe will cost %a gold');
  assert.equal(spliceSkillName('Training', 'Axe'), 'Training', 'no space, no splice');
  assert.equal(RR_WEEK_BUTTON, 21); assert.equal(RR_INTENSIVE_DAYS, 4); assert.equal(RR_INTENSIVE_SKILL_POINTS, 4);
  assert.equal(trainingMax(), 50);
});

const rows = (id) => [{ text: `rsc:${id} %a`, center: true }];
const player = (over = {}) => ({
  name: 'Bob', isPlayer: true, level: 2, health: 30, maxHealth: 30, goldPieces: 5000, items: [],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 20])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 50 }, activeEffects: [], fatigue: 3200, timeOfLastSkillTraining: 0, ...over,
});
const member = { guild: 'FightersGuild', rank: 0 };

test('RR2 refined training flow: the picker first, the offer with the skill spliced in, the variable price', () => {
  const e = player();
  const applied = [];
  const f = buildRefinedTrainingFlow(e, GUILDS.FightersGuild, member, { rows, now: () => 100000, rolls: () => 0, applyTraining: (r, price) => applied.push([r.skill, price]), variablePrice: true, intensive: false });
  assert.deepEqual(f.top.picker, TRAINING_SKILLS.FightersGuild.map((sk) => SKILL_NAMES[sk]), 'the picker opens first (:39-41)');
  f.input('Enter');   // row 0
  const skill = TRAINING_SKILLS.FightersGuild[0];
  const base = trainingPrice(member, 2);
  const cost = rrTrainingCost(base, 20, 50, true);
  assert.equal(cost, base - Math.trunc(base * 0.6 / 2));
  assert.equal(f.top.buttons, 'YesNo');
  assert.match(f.top.rows[0].text, new RegExp(`^rsc:\\d+ ${SKILL_NAMES[skill]} ${cost}$`), 'the record\'s own line, the name after its first word, %a the variable price');
  f.input('KeyY');
  assert.deepEqual(applied, [[skill, cost]], 'trained once at the variable price');
  assert.equal(f.done, false, 'the session\'s own record shows');
  f.input('Enter');
  assert.equal(f.done, true);
  // variableTrainingPrice off: the base price
  const g = buildRefinedTrainingFlow(player(), GUILDS.FightersGuild, member, { rows, now: () => 100000, rolls: () => 0, variablePrice: false, intensive: false });
  g.input('Enter');
  assert.ok(g.top.rows[0].text.endsWith(` ${base}`));
});

test('RR2 refined training flow: the intensive offer, the week button - four days and four points then the fifth session - and the gold gate', () => {
  const e = player({ level: 3 });
  const applied = []; const intensive = [];
  const f = buildRefinedTrainingFlow(e, GUILDS.FightersGuild, member, {
    rows, now: () => 100000, rolls: () => 0, variablePrice: true, intensive: true, level: 3,
    applyTraining: (r, price) => applied.push([r.skill, price]), applyIntensive: (skill, days, points) => { intensive.push([skill, days, points]); e.skills[skill] += points; },
  });
  f.input('Enter');
  const skill = TRAINING_SKILLS.FightersGuild[0];
  const cost = rrTrainingCost(trainingPrice(member, 3), 20, 50, true);
  const iCost = rrIntensiveCost(cost, 3);
  assert.deepEqual(f.top.buttonsMulti, [MB_BUTTONS.Yes, RR_WEEK_BUTTON, MB_BUTTONS.No], 'Yes, "5 Days", No');
  assert.equal(f.top.rows[0].text, `Training your ${SKILL_NAMES[skill]} skill will cost ${cost} gold for a single session.`);
  assert.equal(f.top.rows[3].text, `with a training session each day, this will cost ${iCost} gold in total.`);
  assert.equal(f.top.rows[5].text, `So, would you like to train your ${SKILL_NAMES[skill]} skill with me?`);
  assert.equal(f.top.onButton(MB_BUTTONS.No), null, 'No: nothing');
  const next = f.top.onButton(RR_WEEK_BUTTON);
  assert.deepEqual(intensive, [[skill, 4, 4]], 'RaiseTime(SecondsPerDay * 4) and SetPermanentSkillValue(+4) before the fifth session');
  assert.deepEqual(applied, [[skill, iCost]], 'then TrainSkill, paid the intensive cost');
  assert.equal(permanentSkillValue(e, skill), 24);
  assert.deepEqual(next[0].rows.map((r) => r.text), [RR_TRAINING_LINES.trainingSkillIntense1, RR_TRAINING_LINES.trainingSkillIntense2.replace('{0}', SKILL_NAMES[skill]), RR_TRAINING_LINES.trainingSkillIntense3]);
  // too skilled for the week: 46 of 50
  const g = buildRefinedTrainingFlow(player({ skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 46])) }), GUILDS.FightersGuild, member, { rows, now: () => 100000, variablePrice: false, intensive: true });
  g.input('Enter');
  assert.equal(g.top.buttons, 'YesNo', 'the plain offer');
  // the gold gate on the week
  const poor = player({ goldPieces: cost + 1 });
  const h = buildRefinedTrainingFlow(poor, GUILDS.FightersGuild, member, { rows, now: () => 100000, rolls: () => 0, variablePrice: true, intensive: true, level: 2 });
  h.input('Enter');
  const r = h.top.onButton(RR_WEEK_BUTTON);
  assert.equal(r[0].rows[0].text.startsWith(`rsc:${NOT_ENOUGH_GOLD_ID}`), true, 'NOT_ENOUGH_GOLD');
  assert.equal(poor.skills[skill], 20, 'nothing trained');
});

test('RR2 refined training wiring: the window swapped under the switch, the host\'s clock and skill store, the button art seam', () => {
  off();
  assert.equal(rrRefinedTrainingOn(), false);
  on('Enabled'); on('RefinedTraining.refinedTraining');
  assert.equal(rrRefinedTrainingOn(), true);
  reset();
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /const refined = rrRefinedTrainingOn\(\);\s*flow = \(refined \? buildRefinedTrainingFlow : buildTrainingFlow\)\(playerEntity, guild, membership, \{/, 'RegisterCustomUIWindow(GuildServiceTraining, GuildServiceTrainingRR)');
  assert.match(wm, /variablePrice: rrSetting\('RefinedTraining\.variableTrainingPrice'\) === true, intensive: rrSetting\('RefinedTraining\.intensiveTraining'\) === true,/);
  assert.match(wm, /applyIntensive: \(skill, days, points\) => \{\s*interiorTicker\.advance\(days \* MINUTES_PER_DAY\);[^\n]*\n\s*if \(playerEntity\.skills && typeof playerEntity\.skills === 'object'\) playerEntity\.skills\[skill\] = permanentSkillValue\(playerEntity, skill\) \+ points;/, 'AUDIT-RR F30: RaiseTime first, then the +4 (:171-172)');
  const mb = rd('src/ui/messageBox.js');
  assert.match(mb, /const custom = _buttonArt\.get\(record\);\s*if \(custom && \(custom\.isOn\?\.\(\) \?\? true\)\) \{/, 'a registered record past the classic 20');
  assert.match(mb, /_art\.buttons\.set\(record, _art\.renderer\.uploadTexture\('img', `buttons:\$\{record\}`, \{ width: img\.width, height: img\.height, colors \}\)\);/);
  assert.match(rd('src/ui/guildServiceWindows.js'), /buttonsMulti: \[MB_BUTTONS\.Yes, RR_WEEK_BUTTON, MB_BUTTONS\.No\]/);
});
