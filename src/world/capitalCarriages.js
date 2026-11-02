// @ts-check
// CAPITAL-CARRIAGES (2026-10-29, the owner: "Ensure all capitals and cities outside the bay properly have the wagon
// transport at their gates"; bible/06-Systems/Immersive-Travel.md departure 14): Immersive Travel's carriage, team and
// driver outside each road gate of a capital past the Bay. A walled city past the Bay stands them already (TS4 and TS7,
// world/townWalls.js gateFurniture); a capital is its own plan and stood none, so its drivers' capital-to-capital trips
// had no driver to start from. Each gate takes the mod's records on Daggerfall's gate of its side, carried from that
// gate's frame to the capital's, then moved the least that stands every one clear: off its models, its approach, its
// water and its rim (the rim's ground is blended, not flat). Pure: the host hands the footprint (world/capitalModels.js).

import { BLOCK_M } from './blockHash.js';
import { CAPITALS, capitalDims, capitalCentre, inCapitalRim, planCell, planRows, planCols } from './tamrielCapitals.js';
import { onCapitalApproach, capitalArrival, APPROACH_HALF } from './capitalApproaches.js';
import { carriageRecordsOf, IT_GATE_FRAMES, hasCarriageGate } from './immersiveTravelGates.js';
import { GATE_CLEAR } from './townWalls.js';
import { CAPITAL_RELIEFS, reliefDrawnAt } from './terrain/capitalRelief.js';

/** Daggerfall's gate block on each side of a walled city's ring (Town-Shapes TS7: WALLAA08 faces north, 09 east, 10 south,
 *  11 west) - a capital's gate on a side takes that gate's records first. */
export const SIDE_GATES = Object.freeze({ N: 'WALLAA08', E: 'WALLAA09', S: 'WALLAA10', W: 'WALLAA11' });
/** Each side's outward normal, the anchor's metres (x east, z south), and the side facing the other way. */
const OUT = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });
const OPPOSITE = Object.freeze({ N: 'S', E: 'W', S: 'N', W: 'E' });
/** The plan's cells a carriage stands on: a capital's gardens and its open ground - never a block's houses or landmarks. */
const OPEN_CELLS = Object.freeze(['G', 'O']);
/** How far a model's ground may rise or fall under its reach on a relief and still stand it, metres. */
export const CARRIAGE_LEVEL = 0.4;
/** The footprint's cell, metres (world/capitalModels.js capitalFootprint: 64 to a block). */
const CELL = BLOCK_M / 64;
/** A thing's centre and eight points round it at its reach (a share of it). */
const REACH_RING = Object.freeze([
  [0, 0],
  ...Array.from({ length: 8 }, (_, i) => Object.freeze([Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)])),
]);

/** Whether no cell `test` marks lies within `reach` of (x, z): each 1.6 m cell asked at its centre. */
function clearOf(test, x, z, reach) {
  if (!test) return true;
  for (let i = Math.floor((x - reach) / CELL); i <= Math.floor((x + reach) / CELL); i++) {
    for (let j = Math.floor((z - reach) / CELL); j <= Math.floor((z + reach) / CELL); j++) {
      const cx = Math.max(i * CELL, Math.min(x, (i + 1) * CELL)),
        cz = Math.max(j * CELL, Math.min(z, (j + 1) * CELL));
      if (Math.hypot(cx - x, cz - z) < reach && test((i + 0.5) * CELL, (j + 0.5) * CELL)) return false;
    }
  }
  return true;
}

/** A capital's road gates: each side's gate (`gateAt`) with its outward normal - for a capital with no wall (Falinesti),
 *  where its road reaches its own ground (its arrival moved in past the rim). Anchor metres. @param {any} cap */
export function capitalGatePoints(cap) {
  const D = capitalDims(cap),
    rim = (cap.rimTiles ?? 11) * (BLOCK_M / 16);
  return (cap.gates ?? [])
    .filter((side) => OUT[side])
    .map((side) => {
      const out = OUT[side],
        g = cap.gateAt?.[side];
      const at = g ? [g[0], g[1]] : capitalArrival(cap, D, side).map((v, i) => v - out[i] * rim);
      return { side, at, out };
    });
}

/** The mod's records on Daggerfall gate `name`, each in its gate's frame: [along, out] from the gate model's origin. */
function gateItems(name, records) {
  const f = IT_GATE_FRAMES[name],
    recs = records(name);
  if (!f || !recs) return [];
  const ut = [f.out[1], -f.out[0]];
  const local = (r) => {
    const dx = r.XPos * 0.025 - f.at[0],
      dz = (r.ZPos + 4096) * 0.025 - f.at[1];
    return [dx * ut[0] + dz * ut[1], dx * f.out[0] + dz * f.out[1]];
  };
  return [
    ...(recs.Misc3dObjectRecords ?? []).map((r) => ({ r, model: true, at: local(r) })),
    ...(recs.MiscFlatObjectRecords ?? []).map((r) => ({ r, model: false, at: local(r) })),
  ];
}

/** THE CARRIAGES AT A CAPITAL'S GATES: at each road gate the mod's records of its side's Daggerfall gate (else the first
 *  other that stands), carried to it as gateFurniture carries them and moved the least GATE_CLEAR step at which each stands
 *  on the capital's gardens or open ground, off its rim, on its side of the gate, clear by its reach of the footprint, the
 *  approach and the gate's lane, and a model level on a relief. Outside as the mod stands them; where the wall stands a few
 *  metres in from the rim, just inside, facing in. Each `{ side, gate, inside, at, items: [{ r, model, x, z, h }] }`, anchor
 *  metres. `footprintOf(x, z)` the capital's models near a point; `records` the mod's.
 *  @param {any} cap @param {{ footprintOf?: (x: number, z: number) => (((x: number, z: number) => boolean) | null), records?: (gate: string) => any }} [o] */
export function capitalCarriages(cap, { footprintOf = () => null, records = carriageRecordsOf } = {}) {
  if (!Object.values(SIDE_GATES).some((g) => records(g))) return []; // the mod not loaded: no footprint built for nothing
  const D = capitalDims(cap),
    way = onCapitalApproach(cap, D),
    relief = CAPITAL_RELIEFS[cap.relief] ?? null;
  const [ax, ar] = cap.anchor,
    rows = planRows(cap),
    cols = planCols(cap);
  // AUDIT CAPITAL-CARRIAGES L4: the ground as the terrain draws it (its vertices'), not the relief's own law between them
  const heightAt = (x, z) => (relief ? reliefDrawnAt(relief, x, z) - relief.flat : 0);
  // AUDIT CAPITAL-CARRIAGES L1/L7: off the rim and on the capital's own flat ground (`flatAt` - the Imperial City's far shore
  // rises to the land's own) under its whole reach, not its centre alone
  const ground = (x, z, reach) => {
    const r = Math.floor(z / BLOCK_M + ar),
      c = Math.floor(x / BLOCK_M + ax);
    if (r < 0 || c < 0 || r >= rows || c >= cols || !OPEN_CELLS.includes(planCell(cap, r, c))) return false;
    if (
      REACH_RING.some(
        ([a, b]) =>
          inCapitalRim(cap, x + a * reach + ax * BLOCK_M, z + b * reach + ar * BLOCK_M) ||
          (cap.flatAt && !cap.flatAt(x + a * reach, z + b * reach)),
      )
    )
      return false;
    return !relief || relief.height(x, z) > 1e-3;
  };
  const level = (x, z, reach) =>
    !relief ||
    REACH_RING.every(([a, b]) => Math.abs(heightAt(x + a * reach, z + b * reach) - heightAt(x, z)) <= CARRIAGE_LEVEL);
  const out = [];
  for (const { side, at, out: o } of capitalGatePoints(cap)) {
    const fp = footprintOf(at[0], at[1]);
    const stood = [false, true].map((inside) => standAt(inside ? OPPOSITE[side] : side, inside)).find(Boolean);
    if (stood) out.push(stood);
    /** The gate's things on one side of its line: `face` the side whose Daggerfall gate faces the way they stand. */
    function standAt(face, inside) {
      // the capital's frame north-up (x east, z north), as the Daggerfall gate's: its normal, and along the wall
      const po = inside ? [-o[0], o[1]] : [o[0], -o[1]],
        up = [po[1], -po[0]];
      const place = (it, da, db) => {
        const a = it.at[0] + da,
          b = it.at[1] + db,
          reach = it.model ? GATE_CLEAR.model : GATE_CLEAR.flat;
        const x = at[0] + a * up[0] + b * po[0],
          z = at[1] - (a * up[1] + b * po[1]);
        const ok =
          b > reach &&
          Math.abs(a) >= APPROACH_HALF + reach &&
          ground(x, z, reach) &&
          clearOf(fp, x, z, reach) &&
          clearOf(way, x, z, reach) &&
          (!it.model || level(x, z, reach));
        return ok ? [x, z] : null;
      };
      for (const gate of [SIDE_GATES[face], ...Object.values(SIDE_GATES).filter((g) => g !== SIDE_GATES[face])]) {
        const items = gateItems(gate, records);
        if (!items.length) continue;
        const f = IT_GATE_FRAMES[gate],
          turn = Math.round(
            (Math.atan2(f.out[0] * po[1] - f.out[1] * po[0], f.out[0] * po[0] + f.out[1] * po[1]) * 1024) / Math.PI,
          );
        const shift = nearestStand((da, db) => items.every((it) => place(it, da, db)));
        if (!shift) continue;
        return {
          side,
          gate,
          inside,
          at,
          items: items.map((it) => {
            const [x, z] = /** @type {number[]} */ (place(it, ...shift));
            return {
              r: it.model ? { ...it.r, YRotation: (it.r.YRotation ?? 0) + turn } : { ...it.r },
              model: it.model,
              x,
              z,
              h: heightAt(x, z),
            };
          }),
        };
      }
      return null;
    }
  }
  return out;
}

/** How far (metres, along and out together) a capital's gate things move to stand: twice TS7's (GATE_CLEAR.most) - AUDIT
 *  CAPITAL-CARRIAGES L4: Solitude's level stand starts 20 m along from its gate, clear of the road's shoulder. */
export const CARRIAGE_MOST = 2 * GATE_CLEAR.most;
/** The nearest shift [along, out] at which `ok` holds - diamonds of GATE_CLEAR.step out to CARRIAGE_MOST, in or out of
 *  the gate; null for none. */
function nearestStand(ok) {
  const { step } = GATE_CLEAR,
    most = CARRIAGE_MOST;
  for (let r = 0; r <= most + 1e-9; r += step) {
    for (let a = -r; a <= r + 1e-9; a += step) {
      const b = r - Math.abs(a);
      for (const db of b > 1e-9 ? [b, -b] : [0]) if (ok(a, db)) return [a, db];
    }
  }
  return null;
}

/** A gate's records as a block of the capital's carries them: `at` the anchor in the block's own metres (x east, z north),
 *  each record at its place by DFU's record law (x * 0.025, z + 4096) and its ground's height over the flatten. */
export function carriageRecordsIn(stands, at) {
  const models = [],
    flats = [];
  for (const { items } of stands) {
    for (const { r, model, x, z, h } of items) {
      const rec = {
        ...r,
        XPos: Math.round((at[0] + x) / 0.025),
        ZPos: Math.round((at[1] - z) / 0.025) - 4096,
        YPos: (r.YPos ?? 0) - Math.round(h / 0.025),
      };
      (model ? models : flats).push(rec);
    }
  }
  return { models, flats };
}

/** The plan's cell (cx, r) a stand's gate stands in - the block of the capital's that carries its records. */
export const carriageCellOf = (cap, stand) => [
  Math.floor(stand.at[0] / BLOCK_M + cap.anchor[0]),
  Math.floor(stand.at[1] / BLOCK_M + cap.anchor[1]),
];

/**
 * What a capital's blocks lay of its carriages (world/tamrielCapitals.js capitalPortBlocks): `recordsAt(cx, r, at)` the
 * records the block at plan cell (cx, r) carries - its gates' (`at` the anchor in the block's own metres) - and
 * `on(x, z)` whether a carriage's thing stands within its reach of a point (anchor metres), so a garden plants no tree
 * there and its walkers go round. @param {any} cap @param {Parameters<typeof capitalCarriages>[1]} [o]
 */
export function capitalGateThings(cap, o) {
  const stands = capitalCarriages(cap, o),
    cells = new Set(),
    key = (i, j) => `${i},${j}`;
  for (const { items } of stands) {
    for (const { model, x, z } of items) {
      const reach = model ? GATE_CLEAR.model : GATE_CLEAR.flat;
      for (let i = Math.floor((x - reach) / CELL); i <= Math.floor((x + reach) / CELL); i++)
        for (let j = Math.floor((z - reach) / CELL); j <= Math.floor((z + reach) / CELL); j++) cells.add(key(i, j));
    }
  }
  return {
    stands,
    recordsAt: (cx, r, at) =>
      carriageRecordsIn(
        stands.filter((s) => {
          const [c, q] = carriageCellOf(cap, s);
          return c === cx && q === r;
        }),
        at,
      ),
    on: (x, z) => cells.has(key(Math.floor(x / CELL), Math.floor(z / CELL))),
  };
}

/** AUDIT CAPITAL-CARRIAGES L6: the slices of a capital its road gates stand in - the Imperial City's west slice for Talos
 *  Bridge's landing, of its 625; a harbour's sea slice none. @param {any} cap */
export function capitalCarriageSlices(cap) {
  const D = capitalDims(cap),
    S = 8 * BLOCK_M;
  return new Set(
    capitalGatePoints(cap).map(
      ({ at }) =>
        Math.floor((at[1] + cap.anchor[1] * BLOCK_M) / S) * D.w + Math.floor((at[0] + cap.anchor[0] * BLOCK_M) / S),
    ),
  );
}
/** Whether a town stands a carriage at its gate (OW-HUBS' wheel, scenes/mapPlacesHost.js carriageTown): a capital's slice
 *  with a road gate in it, else its blocks' word (immersiveTravelGates.js hasCarriageGate). The mod's switch is the caller's. */
export function isCarriageTown(loc) {
  const cap = loc?.capital ? CAPITALS[loc.capital.k] : null;
  if (!cap) return hasCarriageGate(loc);
  return capitalCarriageSlices(cap).has(loc.capital.s ?? capitalCentre(cap));
}
