// MW-CLOAK1 / AUDIT MW-CLOAK: THE CLOAKED BODY'S FIXTURE, shared by the cloak's pins. A body in the port's own plate
// and the red cloak on the vendored retail skeleton (retailRig.mjs), with whatever of the Weapon Sheathing addon's own
// scabbards a pin asks for; poses of whole turns about a bone's own axis over its rest; and the two measures every
// cloak pin reads - how far a piece stands through the cloak's sheet, and how many of its edges pass through a
// triangle of the cloak (the clip itself, counted).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { assembleFirstPersonArm } from '../../../src/formats/mwFirstPerson.js';
import { composeWornArmor } from '../../../src/formats/mwItemMap.js';
import { CLASSIC_ARMOR_TEMPLATE } from '../../../src/characters/ownArmorModels.js';
import { isCloakSlot } from '../../../src/characters/ownClothingModels.js';
import { cloakSheet, cellKey, surfaceSamples } from '../../../src/formats/mwCloakFit.js';
import { HOLSTER_SLOTS } from '../../../src/systems/weaponSheathing.js';
import { retailSkeleton } from './retailRig.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../../../${p}`, import.meta.url)));
export const SHEATHED = (f) => onDisk(`vendor/weapon-sheathing/Data Files/Meshes/w/${f}`);
export const set = (material) => Object.values(CLASSIC_ARMOR_TEMPLATE).map((templateIndex) => ({ templateIndex, material }));
export const CLOAK = Object.freeze({ kind: 'clothing', templateIndex: 154, name: 'Casual Cloak', dye: 2 });
export const isCloak = (p) => isCloakSlot(p.slot);
export const isGear = (p) => HOLSTER_SLOTS.includes(p.slot);
export const isUnder = (p) => !isCloak(p) && !isGear(p);

/** A body in `material`'s plate and the red cloak, on retail's rig - and whatever stowed gear `gear` names
 *  (`[file, bone]` pairs of the addon's scabbards). */
export async function body(material, gear = []) {
  const worn = composeWornArmor({ pieces: [...set(material), CLOAK], armors: [], bodyPool: [], helmStyle: 'open' });
  const parts = worn.adds.map((a) => ({ slot: a.slot, partName: a.partName, bones: a.bones, bytes: onDisk(`src/assets/mw/meshes/${a.model}`) }));
  for (const [file, bone] of gear) parts.push({ slot: 'sheath', bones: [bone], bytes: SHEATHED(file), bare: true });
  const asm = await assembleFirstPersonArm({ skeletonBytes: retailSkeleton(), parts });
  assert.ok(asm.ok, asm.error);
  assert.deepEqual(asm.notes, []);
  return asm;
}

/** A pose of whole turns over each bone's rest - `{ bone: degrees }` about its own z (the axis a thigh steps forward
 *  on and an upper arm swings on), or `{ bone: [axis, degrees] }`. */
export function turned(asm, turns) {
  const sk = asm.skeleton;
  const rots = new Map(Object.entries(turns).map(([name, turn]) => {
    const [axis, deg] = Array.isArray(turn) ? turn : ['z', turn];
    const rest = Array.from(sk.nodes.get(sk.byName.get(name)).rest.rotation);
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const r = axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
    const m = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => rest[i * 3] * r[j] + rest[i * 3 + 1] * r[3 + j] + rest[i * 3 + 2] * r[6 + j]));
    return [name, quat(m)];
  }));
  return { tracks: new Map([...rots.keys()].map((k) => [k, k])), sampleTrack: (k) => ({ rotation: rots.get(k) }) };
}

/** AUDIT MW-CLOAK: the poses every motion pin sweeps - the rest; each arm swung back 20; the upper spine leant back 5
 *  and 10 and forward 8; a walk (thighs 22 and -20, the back knee 30) and a stride (35 and -30, the back knee 45),
 *  each leg back in turn. */
export const SWEEP = Object.freeze({
  rest: {},
  armL: { 'bip01 l upperarm': 20 },
  armR: { 'bip01 r upperarm': -20 },
  leanBack5: { 'bip01 spine2': -5 },
  leanBack10: { 'bip01 spine2': -10 },
  leanForward: { 'bip01 spine1': 8 },
  walkL: { 'bip01 r thigh': 22, 'bip01 l thigh': -20, 'bip01 l calf': 30 },
  walkR: { 'bip01 l thigh': 22, 'bip01 r thigh': -20, 'bip01 r calf': 30 },
  strideL: { 'bip01 r thigh': 35, 'bip01 l thigh': -30, 'bip01 l calf': 45 },
  strideR: { 'bip01 l thigh': 35, 'bip01 r thigh': -30, 'bip01 r calf': 45 },
});

/** A rotation (row-major) as a track's quaternion [w, x, y, z] - Shepperd's, any angle. */
function quat(m) {
  const tr = m[0] + m[4] + m[8];
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; return [s / 4, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s]; }
  if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; return [(m[7] - m[5]) / s, s / 4, (m[1] + m[3]) / s, (m[2] + m[6]) / s]; }
  if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; return [(m[2] - m[6]) / s, (m[1] + m[3]) / s, s / 4, (m[5] + m[7]) / s]; }
  const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
  return [(m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, s / 4];
}

/** How far each piece `which` names stands BEHIND the cloak's front - through it - at its worst (0: nowhere). */
export function through(asm, which) {
  const cloak = asm.pieces.find(isCloak);
  const sheet = cloakSheet(cloak.positions, cloak.indices);
  let worst = 0;
  for (const p of asm.pieces.filter((q) => q !== cloak && which(q))) {
    const pts = surfaceSamples(p.positions, p.indices);
    for (let v = 0; v < pts.length; v += 3) {
      const c = sheet.get(cellKey(pts[v], pts[v + 2]));
      if (c) worst = Math.max(worst, c.front - pts[v + 1]);
    }
  }
  return worst;
}

/** Edges of the pieces `which` names that pass through a triangle of the cloak - the clip itself, counted. */
export function crossings(asm, which) {
  const cloak = asm.pieces.find(isCloak);
  const C = cloak.positions; const T = cloak.indices;
  const box = new Float32Array(T.length * 2);   // each triangle's box: min x y z, max x y z
  for (let k = 0; k < T.length; k += 3) {
    for (let c = 0; c < 3; c++) {
      const v = [C[T[k] * 3 + c], C[T[k + 1] * 3 + c], C[T[k + 2] * 3 + c]];
      box[k * 2 + c] = Math.min(...v); box[k * 2 + 3 + c] = Math.max(...v);
    }
  }
  let n = 0;
  for (const p of asm.pieces.filter((q) => q !== cloak && which(q))) {
    const P = p.positions; const I = p.indices;
    for (let t = 0; t < I.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = I[t + e] * 3, b = I[t + (e + 1) % 3] * 3;
        const o = [P[a], P[a + 1], P[a + 2]], d = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
        const lo = [0, 1, 2].map((c) => Math.min(P[a + c], P[b + c])), hi = [0, 1, 2].map((c) => Math.max(P[a + c], P[b + c]));
        for (let k = 0; k < T.length; k += 3) {
          if (box[k * 2] > hi[0] || box[k * 2 + 1] > hi[1] || box[k * 2 + 2] > hi[2] || box[k * 2 + 3] < lo[0] || box[k * 2 + 4] < lo[1] || box[k * 2 + 5] < lo[2]) continue;
          const v0 = T[k] * 3, v1 = T[k + 1] * 3, v2 = T[k + 2] * 3;
          const e1 = [C[v1] - C[v0], C[v1 + 1] - C[v0 + 1], C[v1 + 2] - C[v0 + 2]], e2 = [C[v2] - C[v0], C[v2 + 1] - C[v0 + 1], C[v2 + 2] - C[v0 + 2]];
          const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
          const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
          if (Math.abs(det) < 1e-9) continue;
          const s = [o[0] - C[v0], o[1] - C[v0 + 1], o[2] - C[v0 + 2]];
          const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
          if (u < 0 || u > 1) continue;
          const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
          const w = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
          if (w < 0 || u + w > 1) continue;
          const f = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
          if (f > 0 && f < 1) n++;
        }
      }
    }
  }
  return n;
}
