// @ts-check
// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): THE ZONE POPULATION MANAGER. A cell a player is near
// wakes with a fixed set of slots from its spawn table (pveSpawnTable.js): each slot stands one foe at a time, so the
// count never grows with the crowd. A fallen slot stands again after its population's wait, and its next foe is drawn
// from the slot's name and turn alone, so every machine draws the same one. A cell nobody has seen for a while sleeps;
// its waits and its lasting marks (a unique foe slain for good) outlive the sleep, so sleeping is never a free respawn.
// Pure: the spawn authority keeps the ledger. Ledger A (FIXED-PVE).
import { POPULATIONS, POP_DENSITY, RESPAWN_S, RARE_CHANCE } from './pveSpawnTable.js';
import { placeRng, drawByShare } from './pveEncounter.js';

/** Seconds a cell stays awake after a player last saw it. */
export const CELL_IDLE_S = 300;

/** A fresh ledger: awake cells, the waits of slots in sleeping cells, and the marks that last. */
export const populationLedger = () => ({
  /** @type {Map<string, { seenAt: number, slots: Map<string, { pop: string, list: Array<{key: string, w: number}>, turn: number, foe: string|null, standsAt: number }> }>} */ cells: new Map(),
  /** @type {Map<string, { turn: number, standsAt: number }>} */ waits: new Map(),
  /** @type {Set<string>} */ gone: new Set(),
});

/** The foe slot `id` stands on its `turn` from `list`, or null (a rare slot's empty turn). */
function drawSlot(id, pop, list, turn) {
  const rng = placeRng(`${id}|${turn}`);
  if (pop === 'rare' && rng() >= RARE_CHANCE) return null;
  return drawByShare(list, 1, rng)[0] ?? null;
}

/**
 * Wake (or touch) cell `key` with its spawn `table` at `now` (seconds). New slots stand at once; a slot still waiting
 * from before its sleep waits on. `key` holds no '|'. Returns the slots that stood: [{ id, foe }].
 * @param {ReturnType<typeof populationLedger>} L @param {string} key @param {{ lists: Record<string, Array<{key: string, w: number}>> }} table @param {number} now
 */
export function wakeCell(L, key, table, now) {
  let cell = L.cells.get(key);
  if (cell) { cell.seenAt = now; return []; }
  cell = { seenAt: now, slots: new Map() };
  L.cells.set(key, cell);
  for (const pop of POPULATIONS) {
    const list = table.lists[pop] ?? [];
    for (let i = 0; list.length && i < POP_DENSITY[pop]; i++) {
      const id = `${key}|${pop}|${i}`;
      if (L.gone.has(id)) continue;
      const w = L.waits.get(id);
      L.waits.delete(id);
      const turn = w?.turn ?? Math.floor(now / RESPAWN_S[pop]);   // a fresh slot's turn is the clock's, so a rare roll is not fixed
      cell.slots.set(id, { pop, list, turn, foe: null, standsAt: w && w.standsAt > now ? w.standsAt : now });
    }
  }
  return populationDue(L, now);
}

/** Slot `id` fell at `now`: it waits its population's time; `lasting` keeps it down for good. @param {ReturnType<typeof populationLedger>} L @param {string} id @param {number} now @param {{ lasting?: boolean }} [o] */
export function slotFell(L, id, now, { lasting = false } = {}) {
  const cell = L.cells.get(id.slice(0, id.indexOf('|')));
  const s = cell?.slots.get(id);
  if (!s || s.foe == null) return;
  s.foe = null; s.turn += 1; s.standsAt = now + RESPAWN_S[s.pop];
  if (lasting) { L.gone.add(id); cell?.slots.delete(id); }
}

/** Every waiting slot of an awake cell whose time has come stands its next foe. @param {ReturnType<typeof populationLedger>} L @param {number} now */
export function populationDue(L, now) {
  const stood = [];
  for (const cell of L.cells.values()) for (const [id, s] of cell.slots) {
    if (s.foe != null || s.standsAt > now) continue;
    s.foe = drawSlot(id, s.pop, s.list, s.turn);
    if (s.foe == null) { s.turn += 1; s.standsAt = now + RESPAWN_S[s.pop]; continue; }
    stood.push({ id, foe: s.foe });
  }
  return stood;
}

/** Put to sleep every cell unseen for CELL_IDLE_S: its standing foes go, its waits are kept, spent waits are let go. @param {ReturnType<typeof populationLedger>} L @param {number} now */
export function sleepCells(L, now) {
  for (const [id, w] of L.waits) if (w.standsAt <= now) L.waits.delete(id);
  const slept = [];
  for (const [key, cell] of L.cells) {
    if (now - cell.seenAt < CELL_IDLE_S) continue;
    for (const [id, s] of cell.slots) if (s.foe == null && s.standsAt > now) L.waits.set(id, { turn: s.turn, standsAt: s.standsAt });
    L.cells.delete(key);
    slept.push(key);
  }
  return slept;
}
