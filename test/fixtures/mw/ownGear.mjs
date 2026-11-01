// OWN-WORK4 (2026-10-31): STOWED GEAR OF OUR OWN, for the pins that hang a weapon on the body. Weapon Sheathing's
// scabbards are retired; a stand-in weapon mesh of each kind (ours, along +Y with its grip at the origin, as a retail
// weapon stands) takes our own scabbard (systems/ownSheathing.js) through the holster's real resolve.
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { writeNifBytes } from '../../../src/formats/morrowind/mwNifWrite.js';
import { MW_WEAPON_TYPE } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { resolveHolsterParts } from '../../../src/systems/weaponSheathing.js';
import { ownScabbardBytes, sheathingAddonBytes, SHEATHING_ADDON_PATH } from '../../../src/systems/ownSheathing.js';

/** A stand-in weapon mesh along +Y: a grip below the origin, a guard on it, a blade (or a stave) above. */
export function weaponMesh({ grip = 6, guard = 3, blade = 30, width = 1.2, thick = 0.3 } = {}) {
  const box = (x, y0, y1, z) => [[-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z], [-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]];
  const pts = [...box(0.5, -grip, 0, 0.5), ...box(guard, 0, 0.8, 0.6), ...box(width, 0.8, blade, thick)];
  const faces = [];
  const quad = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  for (let b = 0; b < 3; b++) for (const f of quad) faces.push(...f.map((i) => i + b * 8));
  return writeNifBytes([
    { type: 'NiNode', name: 'w', children: [1] },
    { type: 'NiTriShape', name: '', data: 2 },
    { type: 'NiTriShapeData', positions: pts.flat(), normals: null, uvs: null, indices: faces },
  ]);
}

/** Each stand-in: its type and its mesh's sizes, in units (a retail longsword is about a metre). */
export const STAND_IN = Object.freeze({
  dagger: { type: MW_WEAPON_TYPE.ShortBladeOneHand, mesh: { grip: 4, guard: 2, blade: 14 } },
  longsword: { type: MW_WEAPON_TYPE.LongBladeOneHand, mesh: { grip: 8, guard: 4, blade: 42 } },
  glassLongsword: { type: MW_WEAPON_TYPE.LongBladeOneHand, mesh: { grip: 8, guard: 3.5, blade: 46, width: 1.4 } },
  saber: { type: MW_WEAPON_TYPE.LongBladeOneHand, mesh: { grip: 7, guard: 3.5, blade: 38, width: 1.1 } },
  claymore: { type: MW_WEAPON_TYPE.LongBladeTwoHand, mesh: { grip: 14, guard: 6, blade: 62, width: 1.8 } },
  bow: { type: MW_WEAPON_TYPE.MarksmanBow, mesh: { grip: 40, guard: 1, blade: 44, width: 1, thick: 1 } },
  crossbow: { type: MW_WEAPON_TYPE.MarksmanCrossbow, mesh: { grip: 12, guard: 14, blade: 18, width: 1.5, thick: 1.5 } },
});

const _weapons = new Map();
/** The stand-in's own mesh bytes, one per kind. */
export const weaponOf = (kind) => {
  if (!_weapons.has(kind)) _weapons.set(kind, weaponMesh(STAND_IN[kind].mesh));
  return _weapons.get(kind);
};
/** Our scabbard for the stand-in. */
export const scabbardOf = (kind) => ownScabbardBytes({ mwType: STAND_IN[kind].type, weaponBytes: weaponOf(kind) });

/** The stand-in's stowed parts through the holster's real resolve: our scabbard, and the weapon in it. */
export function gearParts(kind) {
  const r = resolveHolsterParts({
    mwType: STAND_IN[kind].type, weaponModel: `w\\stand_in_${kind}.nif`, weaponBytes: weaponOf(kind),
    find: () => null, hasBone: () => true, parseNif, ownScabbard: ownScabbardBytes,
  });
  return r.parts;
}

/** Our bone addon, as the assembly takes a bone source. */
export const OWN_BONES = Object.freeze([{ name: SHEATHING_ADDON_PATH, bytes: sheathingAddonBytes() }]);
