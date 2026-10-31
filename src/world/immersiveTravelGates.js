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
// THE LAYER (the owner's "Add carriages to either"): a town mod that serves a gate file of its own - Beautiful Cities'
// four gates and 52 composites on them - takes the stand as a layer on the world-data door
// (formats/worldData/worldDataReplacement.js registerWorldDataLayer), moved the least step that clears that file's
// houses, props, roads and the gate's lane (`standShift`). The author's records stood where his edit put them.

import { registerWorldDataLayer } from '../formats/worldData/worldDataReplacement.js';
import { isWallCarrier } from './townShape.js';   // TS7: a city walled on its outline carries its carriages
import { GATE_CLEAR, GATE_OPENING, WALL_MODELS } from './townWalls.js';   // read in calls only: townWalls reads carriageRecordsOf
import { ROAD_RECORDS } from './road/roadEdge.js';

/** The four gate blocks (WALLAA08-11) and Beautiful Cities' composites on them: `WALLAA08.RMB.json`,
 *  `WALLAA08.FARMAA00.RMB.json` - the gate is the name's first part. */
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
 * beside them, the driver at the front corner nearest the gate, the signpost where the stand begins. Chosen so 48 of
 * Beautiful Cities' 56 gate files and Solitude's ledge stand it as drawn, and TS7 stands it outside all 410 walls. The
 * carriage is Daggerfall's ARCH3D 41214, the horses TEXTURE.201's, the hay and the signpost 212's.
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
const BLOCK_SIDE = 102.4;
const list = (v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? v : []);   // a served file is another mod's: read what is there, never throw

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

/** What a served gate file stands outside its wall, for the stand to keep clear of: `(x, z, reach)`, block metres (x
 *  east, z north) - in the block, and clear by its reach of the file's town-map bytes (a house's or the wall's; a
 *  ground flat's 0xfb none), its models and flats (TS7's reaches, GATE_CLEAR) and its road tiles. */
export function gateFileClear(json) {
  const rmb = json?.RmbBlock ?? {}, am = list(rmb.FldHeader?.AutoMapData), tiles = list(rmb.FldHeader?.GroundData?.GroundTiles);
  const things = [];
  for (const m of list(rmb.Misc3dObjectRecords)) things.push([m.XPos * 0.025, (m.ZPos + 4096) * 0.025, GATE_CLEAR.model]);
  for (const t of list(rmb.MiscFlatObjectRecords)) things.push([t.XPos * 0.025, (t.ZPos + 4096) * 0.025, GATE_CLEAR.flat]);
  for (const s of list(rmb.SubRecords)) {
    // a subrecord's things, as TS7 reads its gate (world/townWalls.js townWall): its place, turned by its rotation
    const sx = (s?.XPos ?? 0) * 0.025, sz = (4096 - (s?.ZPos ?? 0)) * 0.025, r = ((s?.YRotation ?? 0) * Math.PI) / 1024, c = Math.cos(r), n = Math.sin(r);
    const at = (o) => [sx + (o.XPos ?? 0) * 0.025 * c - (o.ZPos ?? 0) * 0.025 * n, sz + (o.XPos ?? 0) * 0.025 * n + (o.ZPos ?? 0) * 0.025 * c];
    for (const o of list(s?.Exterior?.Block3dObjectRecords)) if (!Object.values(WALL_MODELS).includes(o.ModelIdNum)) things.push([...at(o), GATE_CLEAR.model]);
    for (const t of list(s?.Exterior?.BlockFlatObjectRecords)) things.push([...at(t), GATE_CLEAR.flat]);
  }
  const square = (x, z, x0, z0, side) => Math.hypot(Math.max(x0, Math.min(x, x0 + side)) - x, Math.max(z0, Math.min(z, z0 + side)) - z);
  const C = BLOCK_SIDE / 64, T = BLOCK_SIDE / 16;
  return (x, z, reach) => {
    if (x < reach || z < reach || x > BLOCK_SIDE - reach || z > BLOCK_SIDE - reach) return false;
    for (let gz = Math.floor((z - reach) / C); gz <= Math.floor((z + reach) / C); gz++) for (let gx = Math.floor((x - reach) / C); gx <= Math.floor((x + reach) / C); gx++) {
      const v = am[(63 - gz) * 64 + gx] ?? 0;
      if (v && v !== 0xfb && square(x, z, gx * C, gz * C, C) < reach) return false;
    }
    for (let ty = Math.floor((z - reach) / T); ty <= Math.floor((z + reach) / T); ty++) for (let tx = Math.floor((x - reach) / T); tx <= Math.floor((x + reach) / T); tx++) {
      const t = tiles[(15 - ty) * 16 + tx];   // the JSON's tiles y-outer from the north row (formats/worldData/worldDataReplacement.js groundDataFromJson)
      if (t && ROAD_RECORDS.includes(t.TextureRecord ?? ((t.TileBitfield ?? 0) & 0x3f)) && square(x, z, tx * T, ty * T, T) < reach) return false;
    }
    return things.every(([px, pz, r]) => Math.hypot(px - x, pz - z) >= r + reach);
  };
}

/** How far the stand moves to stand clear on a served gate file: [along, out] metres, the nearest in diamonds of
 *  GATE_CLEAR.step out to twice GATE_CLEAR.most (capitalCarriages' CARRIAGE_MOST), every thing outside the gate's line and
 *  off its lane (the opening, straight out) by its reach; [0, 0] - as designed - where none does. */
export function standShift(json, gate) {
  const f = IT_GATE_FRAMES[gate];
  if (!f) return [0, 0];
  const clear = gateFileClear(json), ut = [f.out[1], -f.out[0]], { step } = GATE_CLEAR, most = 2 * GATE_CLEAR.most;
  const items = CARRIAGE_STAND.map((s) => ({ at: s.at, reach: s.model ? GATE_CLEAR.model : GATE_CLEAR.flat }));
  const ok = (da, db) => items.every(({ at: [a, b], reach }) => {
    const p = a + da, q = b + db;
    if (q <= reach || Math.abs(p - GATE_OPENING.along) < GATE_OPENING.half + reach) return false;
    return clear(f.at[0] + p * ut[0] + q * f.out[0], f.at[1] + p * ut[1] + q * f.out[1], reach);
  });
  for (let r = 0; r <= most + 1e-9; r += step) {
    for (let a = -r; a <= r + 1e-9; a += step) {
      const b = r - Math.abs(a);
      for (const db of b > 1e-9 ? [b, -b] : [0]) if (ok(a, db)) return [Math.round(a * 10) / 10 + 0, Math.round(db * 10) / 10 + 0];   // + 0: never -0
    }
  }
  return [0, 0];
}

/** The two arrays the stand appends to. */
const ARRAYS = Object.freeze(['Misc3dObjectRecords', 'MiscFlatObjectRecords']);
/** The served file with the stand's records appended - a new document; the served one is untouched, and its header's
 *  counts as they were (DFU lays a block out by its arrays). */
export function layGateRecords(json, appends) {
  const rmb = json?.RmbBlock;
  if (!rmb || !appends) return json;
  const next = { ...rmb };
  for (const k of ARRAYS) {
    if (!appends[k]?.length) continue;
    next[k] = [...(Array.isArray(rmb[k]) ? rmb[k] : []), ...appends[k].map((r) => ({ ...r }))];
  }
  return { ...json, RmbBlock: next };
}

/** TS7: the stand on a gate (its block's name, 'WALLAA08.RMB') as drawn, while the mod is loaded - what a city walled
 *  on its outline carries to that gate (world/townWalls.js gateFurniture) and a capital to its (capitalCarriages.js);
 *  null else. */
let _isOn = null;
export function carriageRecordsOf(gateName) {
  if (!_isOn?.()) return null;
  return standRecords(String(gateName ?? '').toUpperCase().replace(/\.RMB$/, ''));
}

/** The stand, live: `isOn` the mod's switch as loaded for the game. Registers the layer; answers whether it did. */
export function installImmersiveTravelGates(isOn) {
  _isOn = typeof isOn === 'function' ? isOn : () => true;
  return registerWorldDataLayer({
    vendor: 'immersive-travel',
    isOn: _isOn,
    match: (fileName) => IT_GATE_FILE.test(fileName),
    apply: (json, fileName) => {
      const gate = IT_GATE_FILE.exec(fileName)?.[1];
      return layGateRecords(json, standRecords(gate, standShift(json, gate)));
    },
  });
}
