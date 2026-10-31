// IT1 (2026-10-04): IMMERSIVE TRAVEL'S CARRIAGES, AT WHICHEVER GATE THE TOWN STANDS. OWN-WORK2 (2026-10-31, the
// owner: "Wave 2: data and words"): the stand is our own design (CARRIAGE_STAND), and no gate block is edited.
//
// WHAT A GATE NEEDS. The Fast Travel service is a driver's click - a person flat in faction 8642, Carriage Drivers
// (systems/immersiveTravel.js) - so each gate needs a driver outside it, on open ground and off its way out. The
// carriage, the team, the hay and the signpost tell a player from the gate what he is. The classic gate block needs
// nothing: TS7 walls every one of the Bay's 410 walled cities on its outline (world/townOutline.js wallBayCity), so no
// town lays WALLAA08-11 out, and the stand reaches its gates through world/townWalls.js gateFurniture, as it reaches
// a city's past the Bay and a capital's (world/capitalCarriages.js).
//
// OWN-WORK3 (2026-10-31): Beautiful Cities is retired, and with it the layer that laid the stand onto its own gate
// files. Every gate is Daggerfall's (TS7's walls) or a capital's, and the stand stands as drawn on each.

import { isWallCarrier } from './townShape.js';   // TS7: a city walled on its outline carries its carriages

/** The four gate blocks (WALLAA08-11), by a file name of theirs: `WALLAA08.RMB.json` - the gate is the name's first
 *  part (a composite on one, `WALLAA08.FARMAA00.RMB.json`, a town mod's, is read the same). */
export const IT_GATE_FILE = /^(WALLAA(?:08|09|10|11))(?:\.[A-Z0-9]+)?\.RMB\.json$/;
/** OW-HUBS (FIELD BUGS 2026-10-04e): whether a town stands a carriage at its gate - one of its exterior blocks is a
 *  gate the mod edits (`IT_GATE_FILE`, read off the block's own name: 'WALLAA08.RMB', or a composite on it). Pure; the
 *  mod's switch is the caller's (systems/immersiveTravel.js immersiveTravelLoaded). */
export const hasCarriageGate = (loc) => (loc?.exterior?.exteriorData?.blockNames ?? []).some((n) => IT_GATE_FILE.test(`${String(n ?? '').toUpperCase()}.json`) || isWallCarrier(n));   // TS7: or the carrier of a wall on its outline (world/townWalls.js gateFurniture); a capital's: world/capitalCarriages.js isCarriageTown
/** CAPITAL-CARRIAGES: each gate block's frame - its gate model's (446) origin in the block's own metres (x east, z north) and
 *  its outward normal, measured on the freeware (TS7's frames: the subrecord's place, the model 1.6 m in from it). The
 *  stand is set in it, and carried from it to a capital's gate (world/capitalCarriages.js). */
export const IT_GATE_FRAMES = Object.freeze({
  WALLAA08: Object.freeze({ at: Object.freeze([38.4, 11.2]), out: Object.freeze([0, 1]) }),
  WALLAA09: Object.freeze({ at: Object.freeze([11.2, 64]), out: Object.freeze([1, 0]) }),
  WALLAA10: Object.freeze({ at: Object.freeze([38.4, 91.2]), out: Object.freeze([0, -1]) }),
  WALLAA11: Object.freeze({ at: Object.freeze([91.2, 38.4]), out: Object.freeze([-1, 0]) }),
});

/** Carriage Drivers (systems/immersiveTravel.js CARRIAGE_DRIVERS_FACTION_ID), stated here: a world module, it imports no system. */
export const STAND_DRIVER_FACTION = 8642;
/**
 * OWN-WORK2: THE CARRIAGE STAND, ours. Each thing `at` [along, out] metres in its gate's frame: along the wall on the
 * model's +x side (the gate's opening lies on its -x side, GATE_OPENING), out of the town. The carriage stands 26 m along,
 * clear of the road out and the start marker, its shafts pointing down the road; its team between the shafts, the hay
 * beside them, the driver at the front corner nearest the gate, the signpost where the stand begins. Chosen so Solitude's
 * ledge stands it as drawn, and TS7 stands it outside all 410 walls. The carriage is Daggerfall's ARCH3D 41214, the
 * horses TEXTURE.201's, the hay and the signpost 212's.
 */
export const CARRIAGE_STAND = Object.freeze([
  Object.freeze({ what: 'carriage', model: 41214, at: Object.freeze([26, 10]) }),
  Object.freeze({ what: 'horse', flat: Object.freeze([201, 0]), at: Object.freeze([25.4, 12.8]) }),
  Object.freeze({ what: 'horse', flat: Object.freeze([201, 1]), at: Object.freeze([26.6, 12.8]) }),
  Object.freeze({ what: 'hay', flat: Object.freeze([212, 1]), at: Object.freeze([28.2, 12.8]) }),
  Object.freeze({ what: 'driver', at: Object.freeze([23.9, 11.2]) }),
  Object.freeze({ what: 'sign', flat: Object.freeze([212, 6]), at: Object.freeze([23.6, 7.6]) }),
]);
/** Each gate's driver: a townsperson with a face of his own in FLATS.CFG (so the talk window never stands the OOPS
 *  record), and his name seed (the flat's Position, talk's nameSeed) - four gates of one town, four names. */
export const STAND_DRIVERS = Object.freeze({
  WALLAA08: Object.freeze({ flat: Object.freeze([182, 14]), seed: 864208 }),   // a man in a brown hat
  WALLAA09: Object.freeze({ flat: Object.freeze([184, 17]), seed: 864209 }),   // a brawny peasant
  WALLAA10: Object.freeze({ flat: Object.freeze([182, 19]), seed: 864210 }),   // a man in a grey tunic
  WALLAA11: Object.freeze({ flat: Object.freeze([182, 22]), seed: 864211 }),   // a cloaked old man
});
/** Daggerfall's own height for each kind: 41214 at -31 (127 of its 138 classic placements), every misc flat at -4. */
const STAND_Y = Object.freeze({ model: -31, flat: -4 });

/** The stand on gate `gate` (its block's name, 'WALLAA08'), as a block's records, shifted [along, out] metres by
 *  `shift`; null for another name. */
export function standRecords(gate, shift = [0, 0]) {
  const f = IT_GATE_FRAMES[gate], driver = STAND_DRIVERS[gate];
  if (!f || !driver) return null;
  const ut = [f.out[1], -f.out[0]];
  const place = ([a, b]) => {
    const x = f.at[0] + (a + shift[0]) * ut[0] + (b + shift[1]) * f.out[0], z = f.at[1] + (a + shift[0]) * ut[1] + (b + shift[1]) * f.out[1];
    return { XPos: Math.round(x / 0.025), ZPos: Math.round(z / 0.025) - 4096 };
  };
  const yRotation = 0 - Math.round((Math.atan2(f.out[0], f.out[1]) * 1024) / Math.PI);   // the model's +z (its shafts) down the frame's out
  const out = { Misc3dObjectRecords: [], MiscFlatObjectRecords: [] };
  for (const s of CARRIAGE_STAND) {
    const { XPos, ZPos } = place(s.at);
    if (s.model) { out.Misc3dObjectRecords.push({ ModelId: String(s.model), ModelIdNum: s.model, ObjectType: 0, XPos, YPos: STAND_Y.model, ZPos, XRotation: 0, YRotation: yRotation, ZRotation: 0 }); continue; }
    const [archive, record] = s.what === 'driver' ? driver.flat : s.flat;
    out.MiscFlatObjectRecords.push({ Position: s.what === 'driver' ? driver.seed : 0, XPos, YPos: STAND_Y.flat, ZPos, TextureArchive: archive, TextureRecord: record, FactionID: s.what === 'driver' ? STAND_DRIVER_FACTION : 0, Flags: 0 });
  }
  return out;
}

/** TS7: the stand on a gate (its block's name, 'WALLAA08.RMB') as drawn, while the mod is loaded - what a city walled
 *  on its outline carries to that gate (world/townWalls.js gateFurniture) and a capital to its (capitalCarriages.js);
 *  null else. */
let _isOn = null;
export function carriageRecordsOf(gateName) {
  if (!_isOn?.()) return null;
  return standRecords(String(gateName ?? '').toUpperCase().replace(/\.RMB$/, ''));
}

/** The stand, live: `isOn` the mod's switch as loaded for the game. Answers true. OWN-WORK3: no layer is laid on a
 *  served gate file - every gate's stand is TS7's (world/townWalls.js gateFurniture) or a capital's. */
export function installImmersiveTravelGates(isOn) {
  _isOn = typeof isOn === 'function' ? isOn : () => true;
  return true;
}
