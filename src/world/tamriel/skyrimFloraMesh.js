// @ts-check
// SKYRIM-FLORA: crossed ground plants (meadow 3@60°) and HangingMoss drapes from trees/rocks.
import { MeshBuilder } from '../detStandIns.js';
import { PIXEL_FRAME } from '../road/bridgeModels.js';
import { tileDraw } from '../terrain/terrainNature.js';
import { LAND_PROP_FLOATS, landMeasures } from '../lands/landProps.js';
import { LAND_KINDS } from '../lands/landPropMesh.js';
import { localAabb, transformedAabb } from '../../render/frustum.js';
import {
  SKYRIM_FLORA_ARCHIVE, SKYRIM_FLORA_CARDS, SKYRIM_HANGING_RECORDS,
} from './skyrimFlora.js';

/** Classic mountain-rock records on TEXTURE.510 (tamrielLands MOUNTAIN_ROCKS) - moss may drape from them. */
const ROCK_RECORDS = Object.freeze(new Set([1, 6, 17, 18, 27]));

// Billboard law (renderer BB_VS): textures are bottom-up, ground/tips v=0, crown/attach v=1.
// MeshBuilder's classic [[0,0]..[1,-1]] negated-V was flipping every plant.
const UV = /** @type {const} */ ([[0, 0], [1, 0], [1, 1], [0, 1]]);
const HANG_SALT = 81;
const HANG_RATE = 0.55;

/**
 * @param {number} baseArchive summer nature archive
 * @param {number} record
 */
export function isSkyrimMossRock(baseArchive, record) {
  return (baseArchive === 510 || baseArchive === 511) && ROCK_RECORDS.has(record);
}

/**
 * Three vertical cards at 60° (grassMeadow MEADOW_CARDS), foot at (x,y,z).
 * @param {MeshBuilder} mb @param {readonly [number, number]} tex
 * @param {number} x @param {number} y @param {number} z @param {number} w @param {number} h @param {number} yaw
 */
export function crossedPlantAt(mb, tex, x, y, z, w, h, yaw) {
  const hw = w / 2;
  for (let k = 0; k < SKYRIM_FLORA_CARDS; k++) {
    const a = yaw + (k / SKYRIM_FLORA_CARDS) * Math.PI;
    const dx = Math.cos(a) * hw, dz = Math.sin(a) * hw;
    const n = [-Math.sin(a), 0, Math.cos(a)];
    mb.sheet(tex, [x - dx, y, z - dz], [x + dx, y, z + dz], [x + dx, y + h, z + dz], [x - dx, y + h, z - dz], n, UV);
  }
}

/**
 * Two crossed strips hung from (x,y,z) down `len` (capitalTrees liana).
 * @param {MeshBuilder} mb @param {readonly [number, number]} tex
 * @param {number} x @param {number} y @param {number} z @param {number} w @param {number} len @param {number} turn
 */
export function hangingMossAt(mb, tex, x, y, z, w, len, turn) {
  const hw = w / 2;
  for (const a of [turn, turn + Math.PI / 2]) {
    const dx = Math.cos(a) * hw, dz = Math.sin(a) * hw;
    const n = [-Math.sin(a), 0, Math.cos(a)];
    mb.sheet(
      tex,
      [x - dx, y - len, z - dz], [x + dx, y - len, z + dz], [x + dx, y, z + dz], [x - dx, y, z - dz],
      n, UV,
    );
  }
}

/**
 * @param {{ record: number, centers: number[][], size: { w: number, h: number } }[]} plants
 * @param {{ c: number[], h: number, tree?: boolean }[]} hosts
 * @param {ArrayLike<number>|null|undefined} landProps
 * @param {number} px @param {number} py
 * @param {{ addStatic: (mesh: any, at: Float32Array, own?: boolean) => void, unionBox: (b: number[]) => void }} doors
 * @returns {number} sheets stood (plant cards + hang strips)
 */
export function standSkyrimFlora(plants, hosts, landProps, px, py, doors) {
  const mb = new MeshBuilder();
  let n = 0;
  for (const p of plants) {
    const tex = /** @type {const} */ ([SKYRIM_FLORA_ARCHIVE, p.record]);
    for (const c of p.centers) {
      const yaw = tileDraw(Math.floor(c[0] * 4 + px), Math.floor(c[2] * 4 + py), HANG_SALT) * Math.PI;
      crossedPlantAt(mb, tex, c[0], c[1], c[2], p.size.w, p.size.h, yaw);
      n += SKYRIM_FLORA_CARDS;
    }
  }
  const hangRecs = SKYRIM_HANGING_RECORDS;
  if (hangRecs.length) {
    const place = (x, y, z, hostH) => {
      const u = tileDraw(Math.floor(x * 4 + px), Math.floor(z * 4 + py), HANG_SALT);
      if (u >= HANG_RATE) return;
      const record = hangRecs[Math.floor(tileDraw(Math.floor(x * 4 + px), Math.floor(z * 4 + py), HANG_SALT + 1) * hangRecs.length) % hangRecs.length];
      const len = Math.min(hostH * 0.55, 1.4), w = len * 0.35;
      const turn = u * Math.PI * 2;
      hangingMossAt(mb, [SKYRIM_FLORA_ARCHIVE, record], x, y, z, w, len, turn);
      n += 2;
    };
    for (const h of hosts) {
      const [x, y, z] = h.c;
      // tree: mid-crown; rock flat: near top
      place(x, y + h.h * (h.tree ? 0.72 : 0.88), z, h.h);
    }
    if (landProps?.length) {
      for (let i = 0; i < landProps.length; i += LAND_PROP_FLOATS) {
        const kind = LAND_KINDS[landProps[i + 5]];
        if (kind !== 'spire' && kind !== 'grove') continue;
        const m = landMeasures(kind, landProps[i + 6]), s = landProps[i + 4];
        const top = m.top * s;
        if (top < 1.2) continue;
        place(landProps[i], landProps[i + 1] + top * 0.92, landProps[i + 2], top);
      }
    }
  }
  if (!n) return 0;
  const mesh = mb.build();
  doors.addStatic(mesh, PIXEL_FRAME, true);
  doors.unionBox(transformedAabb(localAabb(mesh.positions), PIXEL_FRAME));
  return n;
}
