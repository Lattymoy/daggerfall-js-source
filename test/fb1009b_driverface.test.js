// FIELD BUGS 2026-10-09b - DRIVER-FACE, the Discord's "NPC Shrarton in Tasoparet face sprite missing." (the talk window's
// face a small grey box with a line of tiny writing).
//
// Shrarton is no street walker: he is Immersive Travel's carriage driver at Tasoparet's WALLAA09 gate. The mod stands
// one at each of the four city gates (WorldDataPatches WALLAA08-11), and WALLAA09's is the flat TEXTURE.357 record 3,
// which FLATS.CFG has no row for, under a faction with no flat of its own - so the portrait law
// (GetPortraitIndexFromStaticNPCBillboard, systems/npcSession.js) stood its starting record, 410: TFAC00I0's grey
// "OOPS! Tell Mack NOW!". Every walled city has a WALLAA09 gate. The flat now wears the face FLATS.CFG gives classic's
// own bearded man (182.3, 429), written as a mod writes FLATS.CFG's dictionary, while the mod is loaded.
// `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as it from '../src/systems/immersiveTravel.js';
import { IT_FACTIONS, installImmersiveTravel, _resetImmersiveTravel, IMMERSIVE_TRAVEL_VENDOR, CARRIAGE_DRIVERS_FACTION_ID } from '../src/systems/immersiveTravel.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { _resetCustomFactions } from '../src/formats/factionFile.js';
import { _resetMerchantServices } from '../src/systems/guildServices.js';
import { flatFaceOverride, _resetFlatFaceOverrides } from '../src/characters/staticNpc.js';
import { portraitIndexFromStaticNPCBillboard, OOPS_PORTRAIT_RECORD } from '../src/systems/npcSession.js';

/** The drivers the mod's four gate patches stand: [block, archive, record] off their own JSON. */
const drivers = ['WALLAA08', 'WALLAA09', 'WALLAA10', 'WALLAA11'].map((b) => {
  const s = readFileSync(new URL(`../vendor/immersive-travel/WorldDataPatches/${b}.RMB.json`, import.meta.url), 'utf8');
  const m = /"TextureArchive":(\d+),"TextureRecord":(\d+),"FactionID":8642/.exec(s);
  return [b, Number(m?.[1]), Number(m?.[2])];
});
/** The talk window's face for a driver standing as `flat`, FLATS.CFG's rows read through the dataPipeline's own order
 *  (a mod's write first) - `cfg` the classic rows the pin needs (FLATS.CFG: 357.3 none; the other three's own). */
const CFG = new Map([['184:25', 393], ['182:25', 444], ['184:19', 373]]);
const face = (archive, record) => portraitIndexFromStaticNPCBillboard({ gender: 0, billboardArchiveIndex: archive, billboardRecordIndex: record }, {
  factionData: IT_FACTIONS.find((f) => f.id === CARRIAGE_DRIVERS_FACTION_ID),
  flatFaceIndex: (a, r) => flatFaceOverride(a, r) ?? CFG.get(`${a}:${r}`) ?? -1,
});
const reset = () => { _resetModSettings(); _resetCustomFactions(); _resetMerchantServices(); _resetImmersiveTravel(); _resetFlatFaceOverrides(); };

test('DRIVER-FACE: the WALLAA09 driver wears a face once the mod is loaded - the bearded man\'s 429, never the OOPS record; the other three drivers keep their own rows; a mod off at the start writes none (mutants: the face never written; written with the mod off)', () => {
  assert.deepEqual(drivers, [['WALLAA08', 184, 25], ['WALLAA09', 357, 3], ['WALLAA10', 182, 25], ['WALLAA11', 184, 19]], 'the mod\'s four drivers');
  assert.deepEqual({ ...it.IT_DRIVER_FACE }, { archive: 357, record: 3, faceIndex: 429 });
  reset();
  try {
    assert.equal(face(357, 3).record, OOPS_PORTRAIT_RECORD, 'unwritten: the OOPS face, as the report saw it');
    assert.equal(installImmersiveTravel(), true);
    assert.deepEqual(drivers.map(([, a, r]) => face(a, r)), [
      { archive: 'CommonFaces', record: 393 }, { archive: 'CommonFaces', record: 429 }, { archive: 'CommonFaces', record: 444 }, { archive: 'CommonFaces', record: 373 },
    ]);
    reset();
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', false);
    installImmersiveTravel();
    assert.equal(flatFaceOverride(357, 3), null, 'the mod off at the start: FLATS.CFG as it ships');
  } finally { reset(); }
});
