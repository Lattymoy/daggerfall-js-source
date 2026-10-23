// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-VAULTS (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Wrothgarian
// Mountains' daily elite halls for the Eltheric Ocean's Deep Aether and Abyss; bible/03-World/Eltheric-Ocean.md SEA-VAULTS) -
// THE VAULTS OF THE DEEP: which ruin isles are vaults today.
//
// A VAULT is an isle's ruin of the Deep Aether or the Abyss that the day has chosen (the relay's day, WDUN_DAY_MS - every
// player sees the same vaults): SEA_VAULTS of them a band, each the ruin isle nearest a point the day's hash draws in its
// band's waters (the legends' haunts' corridor: HAUNT_SPREAD rows north and south of Veilhaven, the Abyss's first
// ABYSS_HAUNT_LEAGUES), SEA_VAULT_SPACING_CELLS apart at least. A vault is the mountains' hall on the sea: an elite
// dungeon whose foes are its ring's high tier (systems/wild/wildDungeons.js wildHallFoes), its chests keyed by its reset's
// epoch, an hour's lock on whoever leaves it, the crows over it while a body lies in it, wiped twenty minutes empty - the
// social hub's record (net/wild/wildLaw.js wdun*, keyed `"e<cx>,<cy>"` - net/wire.js seaVaultKey). Every other ruin of the
// sea stays open and itself.
//
// Pure: the day in, the vaults out; no map files, no clock. Every client and the hub could draw them alike.
// ═══════════════════════════════════════════════════════════════════
import { BANDS, VEIL_X, LEAGUE_PX, veilhaven, etherCellOf, isleOfCell, etherHash, etherRng, etherBandAt } from '../../world/ethericSea.js';
import { HAUNT_SPREAD, ABYSS_HAUNT_LEAGUES } from '../naval/etherShips.js';
import { seaVaultKey } from '../../net/wire.js';

/** The day's vaults a band - the Deep Aether's four, the Abyss's three. */
export const SEA_VAULTS = Object.freeze({ deep: 4, abyss: 3 });
/** The day's hash's own salt. */
export const SEA_VAULT_SALT = 0x5ea7;
/** Two of a day's vaults stand at least this many cells apart (Chebyshev; a cell is ten pixels, eight kilometres). */
export const SEA_VAULT_SPACING_CELLS = 6;
/** From the point the day draws, the nearest ruin isle within this many cells (Chebyshev) - a ring at a time. */
export const SEA_VAULT_SEARCH_CELLS = 10;
/** A slot's draws before it gives up (a corridor with no ruin near any of them - never met over the sea's own law). */
export const SEA_VAULT_TRIES = 8;

/** A band's waters for its vaults: its depths (the Abyss's first ABYSS_HAUNT_LEAGUES), within HAUNT_SPREAD of Veilhaven's
 *  row - `{ x0, x1, y0, y1 }` in pixels. */
export function vaultWaters(band) {
  const i = BANDS.findIndex((b) => b.id === band);
  const from = BANDS[i].from, to = BANDS[i + 1]?.from ?? from + ABYSS_HAUNT_LEAGUES;
  const row = veilhaven().py, spread = HAUNT_SPREAD[band] ?? HAUNT_SPREAD.deep;
  return { x0: Math.ceil(VEIL_X - to * LEAGUE_PX), x1: Math.floor(VEIL_X - from * LEAGUE_PX), y0: row - spread, y1: row + spread };
}

/** @typedef {{ key: string, cx: number, cy: number, x: number, y: number, band: string, ring: number, name: string }} SeaVault */
/** @type {Map<number, readonly SeaVault[]>} */
const _days = new Map();

/**
 * THE DAY'S VAULTS: the Deep Aether's, then the Abyss's, each slot the ruin isle of its band nearest the point its hash
 * draws (ring by ring of cells about it, each ring in the lattice's order), never within SEA_VAULT_SPACING_CELLS of one
 * already chosen, its ring the band's (3 the Deep Aether, 4 the Abyss - the mountains' High Crags and Heart). Kept a day.
 * @param {number} day @returns {readonly SeaVault[]}
 */
export function seaVaultPicks(day) {
  const d = Math.trunc(Number(day)) || 0;
  const had = _days.get(d);
  if (had) return had;
  /** @type {SeaVault[]} */
  const out = [];
  for (const band of Object.keys(SEA_VAULTS)) {
    const bi = BANDS.findIndex((b) => b.id === band);
    const w = vaultWaters(band);
    for (let slot = 0; slot < SEA_VAULTS[band]; slot++) {
      for (let tryN = 0; tryN < SEA_VAULT_TRIES; tryN++) {
        const r = etherRng(etherHash(SEA_VAULT_SALT, d, bi, slot, tryN));
        const [sx, sy] = etherCellOf(w.x0 + r() * (w.x1 - w.x0), w.y0 + r() * (w.y1 - w.y0));
        const v = nearestRuin(sx, sy, band, out);
        if (v) { out.push({ ...v, ring: bi + 1 }); break; }
      }
    }
  }
  if (_days.size > 4) _days.clear();
  _days.set(d, Object.freeze(out.map((v) => Object.freeze(v))));
  return /** @type {readonly SeaVault[]} */ (_days.get(d));
}

/** The ruin isle of `band` nearest cell (sx, sy) within SEA_VAULT_SEARCH_CELLS, clear of `taken` - or null. */
function nearestRuin(sx, sy, band, taken) {
  for (let ring = 0; ring <= SEA_VAULT_SEARCH_CELLS; ring++) {
    for (let cy = sy - ring; cy <= sy + ring; cy++) {
      for (let cx = sx - ring; cx <= sx + ring; cx++) {
        if (Math.max(Math.abs(cx - sx), Math.abs(cy - sy)) !== ring) continue;   // the ring's own cells
        const isle = isleOfCell(cx, cy);
        if (!isle || isle.kind !== 'ruin' || etherBandAt(isle.px).id !== band) continue;
        if (taken.some((t) => Math.max(Math.abs(t.cx - cx), Math.abs(t.cy - cy)) < SEA_VAULT_SPACING_CELLS)) continue;
        return { key: seaVaultKey(cx, cy), cx, cy, x: isle.px, y: isle.py, band, ring: 0, name: isle.name };
      }
    }
  }
  return null;
}

/** The vault whose ruin stands on map pixel (x, y) - its place's pixel, the isle's own - among `vaults`, or null. */
export const seaVaultAt = (vaults, x, y) => (vaults ?? []).find((v) => v.x === x && v.y === y) ?? null;
/** The vault a key names among `vaults`, or null. */
export const seaVaultByKey = (vaults, key) => (vaults ?? []).find((v) => v.key === key) ?? null;
/** Drop the kept days (the pins). */
export const _resetSeaVaultsForTests = () => _days.clear();
