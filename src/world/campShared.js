// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW6 - CAMPS ON THE OVERWORLD, THE SAME FOR EVERY PLAYER (bible/06-Systems/Travel-View.md, OW6; 2026-09-29, the
// player: "If a camp is spawned, it should show in the overworld"; "Everything needs that persistence between players
// in the overworld").
//
// A camp (CAMP1: three to five stood close about their fire) or a pack (two to four stood loose), and a roaming band
// once it has stood (TV7), are foes of the pool that stood them - `campId` on each member (the camp's number on the
// client that stood it) - and nothing drew them from the Overworld. They are drawn now: one mark a group, where its
// living members stand, with its kind and its number ("Orc camp, 4").
//
// SHARED WITH THE FOES THEMSELVES. A camp's members already ride their owner's cell foes frame to every player within
// the relay's range (WORLD2 - A FOE IS ITS SPAWNER'S), but as bare records: a reader stood them as loose foes and knew no
// camp. The frame now carries, beside RAID2's `rz` and WOD7's `st`, the camp tags `cz`: `[[i, campId, kind], ...]` for
// the records of camp members in it - the owner's record number, its camp's number on the owner, the kind (1 a camp, 2
// a pack, 3 a band stood). A reader keeps the tag on the puppet, marks the owner's camp from its puppets, and - when the
// owner leaves and hands its foes on (PDEATH-FOES, the heir's `adopt`) - the heir takes the camp as a camp: one number
// of its own for all of it (campmates still spare each other and wake together), its sight and its alert radius as
// they were. No relay change: a frame's other keys are the readers' (the relay reads the record count).
//
// PURE: tags validated, members grouped, words made.
// ═══════════════════════════════════════════════════════════════════
import { FOE_SEQ_MAX } from '../net/wire.js';

/** The kinds a group is, and their codes on the wire. */
export const CAMP_KINDS = Object.freeze(['camp', 'pack', 'band']);
/** A kind's code (1..3), a pack's for anything unknown. */
export const campKindCode = (kind) => {
  const k = CAMP_KINDS.indexOf(kind);
  return k >= 0 ? k + 1 : 2;
};
/** A code's kind, or null. */
export const campKindOf = (code) =>
  Number.isInteger(code) && code >= 1 && code <= CAMP_KINDS.length ? CAMP_KINDS[code - 1] : null;
/** The most tags one frame may carry - a frame's own record bound (wire.js CELL_FRAME_RECORDS_MAX). */
export const CAMP_TAGS_MAX = 64;
/** A camp's number on its owner: a positive whole number. */
const campNumber = (n) => Number.isInteger(n) && n >= 1 && n <= 0x7fffffff;
const recordNumber = (i) => Number.isInteger(i) && i >= 0 && i <= FOE_SEQ_MAX;

/** The camp tags I say for the records in a frame: `[[i, campId, kind], ...]`, a live member's alone. */
export function campTagsOf(records, foeOf) {
  const out = [];
  for (const r of records ?? []) {
    if (out.length >= CAMP_TAGS_MAX) break;
    const f = foeOf(r);
    if (!f || r.d === 1 || !campNumber(f.campId)) continue;
    out.push([r.i, f.campId, campKindCode(f.campKind)]);
  }
  return out;
}

/** A frame's camp tags heard, projected: the owner's record number to `{ id, kind }`. */
export function validCampTags(raw) {
  /** @type {Map<number, {id: number, kind: string}>} */
  const out = new Map();
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (out.size >= CAMP_TAGS_MAX) break;
    if (!Array.isArray(e) || e.length !== 3) continue;
    const [i, id, code] = e;
    const kind = campKindOf(code);
    if (recordNumber(i) && campNumber(id) && kind && !out.has(i)) out.set(i, { id, kind });
  }
  return out;
}

/**
 * THE CAMPS OF A POOL'S LIVE MEMBERS, grouped: `members` is `{ camp, kind, type, feet }` for each living member (`camp`
 * the group's key - my number, or an owner's id and theirs), `nameOf(type)` a kind's display name. One entry a camp:
 * where its members stand (their middle), how many live, and its words - the first member's kind names it.
 * @param {Array<{camp: string, kind: string, type: number, feet: number[]}>} members
 * @param {(type: number) => string} nameOf
 */
export function groupCamps(members, nameOf) {
  /** @type {Map<string, {key: string, kind: string, type: number, n: number, x: number, y: number, z: number}>} */
  const by = new Map();
  for (const m of members ?? []) {
    if (!m?.camp || !Array.isArray(m.feet)) continue;
    let g = by.get(m.camp);
    if (!g) {
      g = { key: m.camp, kind: m.kind, type: m.type, n: 0, x: 0, y: 0, z: 0 };
      by.set(m.camp, g);
    }
    g.n++;
    g.x += m.feet[0];
    g.y += m.feet[1];
    g.z += m.feet[2];
  }
  return [...by.values()].map((g) => ({
    key: g.key,
    kind: g.kind,
    n: g.n,
    at: [g.x / g.n, g.y / g.n, g.z / g.n],
    label: campLabel(nameOf(g.type), g.kind, g.n),
  }));
}

/** A camp's words over its mark: "Orc camp, 4", "Wolf pack, 3", "Orc band, 5" - one alone, its kind alone. */
export function campLabel(name, kind, n) {
  const k = String(name ?? '').trim() || 'Enemy';
  if (n === 1) return k;
  return `${k} ${kind === 'camp' || kind === 'band' ? kind : 'pack'}, ${n}`;
}
