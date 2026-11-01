// FIELD BUGS 2026-10-09b - DRIVER-FACE, the Discord's "NPC Shrarton in Tasoparet face sprite missing." (the talk window's
// face a small grey box with a line of tiny writing).
//
// Shrarton is no street walker: he was Immersive Travel's carriage driver at Tasoparet's WALLAA09 gate - the mod's
// flat TEXTURE.357 record 3, which FLATS.CFG has no row for, under a faction with no flat of its own - so the portrait
// law (GetPortraitIndexFromStaticNPCBillboard, systems/npcSession.js) stood its starting record, 410: TFAC00I0's grey
// "OOPS! Tell Mack NOW!". The flat wears the face FLATS.CFG gives classic's own bearded man (182.3, 429), written as a
// mod writes FLATS.CFG's dictionary, while the mod is loaded. OWN-WORK2: the stand is ours now
// (world/immersiveTravelGates.js STAND_DRIVERS), and each of its four drivers has a FLATS.CFG row of his own.
// `01-Overview/bugs/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as it from '../../src/systems/immersiveTravel.js';
import { standRecords } from '../../src/world/immersiveTravelGates.js';
import { IT_FACTIONS, installImmersiveTravel, _resetImmersiveTravel, IMMERSIVE_TRAVEL_VENDOR, CARRIAGE_DRIVERS_FACTION_ID } from '../../src/systems/immersiveTravel.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { _resetCustomFactions } from '../../src/formats/factionFile.js';
import { _resetMerchantServices } from '../../src/systems/guild/guildServices.js';
import { flatFaceOverride, _resetFlatFaceOverrides } from '../../src/characters/staticNpc.js';
import { portraitIndexFromStaticNPCBillboard, OOPS_PORTRAIT_RECORD } from '../../src/systems/npcSession.js';

/** The drivers our stand puts at the four gates: [block, archive, record] off its own records. */
const drivers = ['WALLAA08', 'WALLAA09', 'WALLAA10', 'WALLAA11'].map((b) => {
  const d = standRecords(b).MiscFlatObjectRecords.find((f) => f.FactionID === 8642);
  return [b, d.TextureArchive, d.TextureRecord];
});
/** The talk window's face for a driver standing as `flat`, FLATS.CFG's rows read through the dataPipeline's own order
 *  (a mod's write first) - `cfg` the classic rows the pin needs (FLATS.CFG: 357.3 none; our four drivers' own). */
const CFG = new Map([['182:14', 415], ['184:17', 473], ['182:19', 438], ['182:22', 441]]);
const face = (archive, record) => portraitIndexFromStaticNPCBillboard({ gender: 0, billboardArchiveIndex: archive, billboardRecordIndex: record }, {
  factionData: IT_FACTIONS.find((f) => f.id === CARRIAGE_DRIVERS_FACTION_ID),
  flatFaceIndex: (a, r) => flatFaceOverride(a, r) ?? CFG.get(`${a}:${r}`) ?? -1,
});
const reset = () => { _resetModSettings(); _resetCustomFactions(); _resetMerchantServices(); _resetImmersiveTravel(); _resetFlatFaceOverrides(); };

test('DRIVER-FACE: the 357.3 flat wears a face once the mod is loaded - the bearded man\'s 429, never the OOPS record; OWN-WORK2: our four drivers each wear their own row; a mod off at the start writes none (mutants: the face never written; written with the mod off)', () => {
  assert.deepEqual(drivers, [['WALLAA08', 182, 14], ['WALLAA09', 184, 17], ['WALLAA10', 182, 19], ['WALLAA11', 182, 22]], 'our four drivers, none 357.3');
  assert.deepEqual({ ...it.IT_DRIVER_FACE }, { archive: 357, record: 3, faceIndex: 429 });
  reset();
  try {
    assert.equal(face(357, 3).record, OOPS_PORTRAIT_RECORD, 'unwritten: the OOPS face, as the report saw it');
    assert.equal(installImmersiveTravel(), true);
    assert.deepEqual(face(357, 3), { archive: 'CommonFaces', record: 429 }, 'the override written');
    assert.deepEqual(drivers.map(([, a, r]) => face(a, r)), [
      { archive: 'CommonFaces', record: 415 }, { archive: 'CommonFaces', record: 473 }, { archive: 'CommonFaces', record: 438 }, { archive: 'CommonFaces', record: 441 },
    ]);
    reset();
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', false);
    installImmersiveTravel();
    assert.equal(flatFaceOverride(357, 3), null, 'the mod off at the start: FLATS.CFG as it ships');
  } finally { reset(); }
});
