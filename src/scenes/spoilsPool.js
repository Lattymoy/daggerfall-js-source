// @ts-check
// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot and bounce (sort of how dropping a
// torch works) and have a sort of rarity glow attached to it"): THE SPOILS ON THE COURT'S FLOOR - one player's share of a
// fallen boss (systems/gateSpoils.js rollSpoils, off the relay's receipt), spewed out of his chest piece by piece
// (world/gateSpew.js - the thrown torch's own flight), each landing with the torch's own clatter, and at rest standing
// in its tier's beam (render/spoilsGlow.js) with a Rare-or-better's light and chime. Walked over, a piece goes into the
// pack; leaving the court gathers whatever is still on the floor. Design: bible/11-Multiplayer/World-Bosses.md
// section 7.
//
// SEEN BY THIS PLAYER ALONE, and never sent: every other player's spoils are their own seed's, on their own screen.
//
// ONCE A RECEIPT. The relay answers a fighter who comes back to the court after the kill - a reconnect, a second door -
// with his fall and the receipt again, and the court would burst again; so the receipts whose spoils left him ride the
// device (SPOILS_DAY_KEY - AUDIT WB A9: a list of day and ACCOUNT, the receipt's own `d` and `s`: two accounts on one
// device each have their gate), and a receipt already spent spews nothing.
//
// A CRASH LOSES NOTHING. The court refuses the save (WB3b), so from the burst until a save holds them the spoils ride a
// record in this device's storage (SPOILS_STORE_KEY - the day, when, whose, and THE PIECES AS ROLLED: the roll reads
// the player's world as well as the seed - systems/gateSpoils.js - so a re-roll is not the same spoils). AUDIT WB A7: a
// LIST of them, one a day and character - a second burst (another day, another character) before a save no longer
// wrote over the first's. Taking a piece changes nothing there: it is in the pack, and the pack is only as safe as the
// last save. At the next boot the records are asked (`recoverSpoils`): a save of a record's character written since
// its burst holds every piece - the court refuses the save and leaving it gathers the floor - and the record goes;
// else every piece is handed over again, and the record stays until a save holds them.
//
// AUDIT WB A2: A RECEIPT THAT COMES OUTSIDE ITS COURT - a fighter cast out before the kill, gone from the game, told
// by the hub's next hello - is its spoils straight into the pack (`grant`): the court's burst was the only door, and it
// never opened for them. The same once, the same record.
//
// Not a DFU member. Ledger A (WB).
import { rollSpoils } from '../systems/gateSpoils.js';
import { seededRng } from '../systems/wind.js';
import { spewLaunches, spewPiece, flySpew } from '../world/gateSpew.js';
import { SpoilsGlowRenderer, tierColour } from '../render/spoilsGlow.js';
import { RARITIES } from '../systems/lootRarity.js';
import { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS, validLootItem } from '../systems/loot.js';
import { billboardSize } from '../world/rmbFlats.js';
import { SOUND } from '../systems/soundClips.js';
import { CLIPS } from '../systems/handheldTorches.js';

/** A resting piece is taken when the player's feet come within this of it (metres, across the floor). */
export const SPOILS_TAKE_M = 1.3;
/** The glow rises over this long once a piece rests. */
export const SPOILS_RISE_MS = 400;
/** A Rare-or-better resting piece's light: its reach and its strength. */
export const SPOILS_LIGHT = Object.freeze({ range: 5, k: 1.3, up: 0.6 });
/** The device's record of spoils no save holds yet, and of the last day whose spoils left him. */
export const SPOILS_STORE_KEY = 'wb5.spoils';
export const SPOILS_DAY_KEY = 'wb5.spoilsDay';
/** The Sigil Stone glows as the rarest thing there is. */
export const SIGIL_TIER = 'artifact';

/** The words. */
export const SPOILS_TEXT = Object.freeze({
  gold: (n) => `You take ${n} gold pieces.`,
  item: (name, tier) => (tier && tier !== 'common' ? `You take ${name} (${RARITIES[tier]?.label ?? tier}).` : `You take ${name}.`),
  gathered: 'The spoils of the Burning Court are in your pack.',
  granted: 'Your share of the Burning Court\'s spoils is in your pack.',   // AUDIT WB A2: a receipt that came outside its court
});

/**
 * One player's spoils as the floor holds them - in the order they leave him: the three graded pieces (the Rare-or-better
 * first), the Sigil Stone, then the gold. Each carries its tier (the glow's) and the treasure flat the seed dresses it in.
 * Pure.
 * @param {number} seed @param {number} level
 */
export function spoilsList(seed, level) {
  const s = rollSpoils(seed, level);
  const look = seededRng((seed ^ 0x5eed) >>> 0);
  const flat = () => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
  return [
    ...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier, record: flat() })),
    { kind: 'item', item: s.sigil, tier: SIGIL_TIER, record: flat() },
    { kind: 'gold', gold: s.gold, tier: 'common', record: flat() },
  ];
}

/** A device store (the app's own - systems/appStorage.js, a Storage's getItem/setItem/removeItem) as the pool's JSON
 *  record store; a store that throws or answers junk is a record never kept. AUDIT WB A6: a write the storage refuses
 *  (a full quota, a private window) is kept in this session's memory instead and read back from there - the session
 *  still knows its spent receipts and its records, and a later write that lands takes over. */
export function spoilsStore(storage) {
  const mem = new Map();
  return {
    get(k) {
      if (mem.has(k)) return mem.get(k);
      try { const v = storage?.getItem?.(k); return v ? JSON.parse(v) : null; } catch { return null; }
    },
    set(k, v) {
      try { if (!storage?.setItem) throw new Error('no storage'); storage.setItem(k, JSON.stringify(v)); mem.delete(k); }
      catch { mem.set(k, JSON.parse(JSON.stringify(v ?? null))); }
    },
    remove(k) { mem.delete(k); try { storage?.removeItem?.(k); } catch { /* nothing to lose */ } },
  };
}
/** AUDIT WB A7: the most crash records the device keeps (one a day and character), and spent receipts it remembers. */
export const SPOILS_RECORDS_MAX = 8;
export const SPOILS_SPENT_MAX = 32;
/** A spent receipt's key: its day and account (AUDIT WB A9). */
export const spentKey = (day, acct) => `${day}:${acct ?? ''}`;
/** The records as a list - an older build's single record is a list of one. */
const recordsOf = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);

/** Whether a save of the character `who` was written after `at` (wall-clock ms, as the slots' realTime) - its pack holds
 *  every piece of a burst before it. `saves` the slots' SaveInfos (systems/saveSlots.js enumerateSaves). */
export const savedSince = (saves, who, at) => who != null && [...(saves ?? [])].some((i) => i?.characterId === who && (i.dateAndTime?.realTime ?? 0) > at);

/** A piece off the record as the pack may take it, or null: gold a whole positive sum, an item one the port's own loot
 *  validator admits (systems/loot.js validLootItem - a template it knows, every declared field its kind). */
function keptPiece(p) {
  if (p?.kind === 'gold') return Number.isSafeInteger(p.gold) && p.gold > 0 ? { ...p } : null;
  const item = p?.kind === 'item' ? validLootItem(p.item) : null;
  return item ? { ...p, item } : null;
}

/**
 * THE CRASH'S DOOR, at boot: a record whose pieces no save of its character holds is handed over whole, and kept until
 * one does; a save since the burst holds them, and the record is cleared; another character's record waits for them.
 * Answers how many pieces it handed over.
 * @param {{ get: (k: string) => any, remove: (k: string) => void, set?: (k: string, v: any) => void }} store @param {(piece: any) => void} take
 * @param {{ who?: string|null, saves?: Iterable<any> }} [opts] this character's id, and the save slots' infos
 */
export function recoverSpoils(store, take, { who = null, saves = [] } = {}) {
  let v = null;
  try { v = store.get(SPOILS_STORE_KEY); } catch { v = null; }
  if (!v) return 0;
  const infos = [...(saves ?? [])];
  const all = recordsOf(v), left = [];
  let n = 0;
  for (const rec of all) {
    if (!rec || typeof rec !== 'object' || !Array.isArray(rec.pieces) || !Number.isFinite(rec.at)) continue;   // junk is no record
    if (rec.who != null && rec.who !== who) { left.push(rec); continue; }   // another character's waits for them
    if (savedSince(infos, rec.who ?? who, rec.at)) continue;   // a save since holds them: it goes
    for (const p of rec.pieces) { const q = keptPiece(p); if (q) { take(q); n++; } }
    left.push(rec);   // and it stays until a save does
  }
  if (left.length !== all.length || !Array.isArray(v)) {
    try { if (left.length) store.set?.(SPOILS_STORE_KEY, left); else store.remove(SPOILS_STORE_KEY); } catch { /* the pack has them either way */ }
  }
  return n;
}

/**
 * @param {{
 *   renderer?: any, gl?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null, audio?: any,
 *   ray: (from: number[], dir: number[], len: number) => ({dist: number, normal?: number[]}|null),
 *   feet?: () => number[]|null, now: () => number,
 *   take: (piece: any) => void, say?: (text: string) => void,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void, remove: (k: string) => void }|null,
 *   who?: () => string|null, wall?: () => number,
 * }} deps
 */
export function createSpoilsPool({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  ray, feet = () => null, now, take, say = () => {}, store = null, who = () => null, wall = () => Date.now(),
}) {
  let glow = null;
  try { if (gl) glow = new SpoilsGlowRenderer(gl); } catch (e) { console.warn('[gate] the spoils\' glow would not build', e?.message ?? e); glow = null; }
  /** the spew under way: its day, when it began, where it left from; each piece's flight, rest and batch */
  let rec = null, t0 = 0, from = null, launches = [];
  /** @type {Array<{ piece: any, fly: any, left: boolean, restAt: number, taken: boolean, batch: any }>} */
  let floor = [];
  let lastT = 0, tex = null, texLoading = null;

  const keep = (k, v) => { try { store?.set(k, v); } catch { /* the floor still holds them */ } };
  const read = (k) => { try { return store?.get(k) ?? null; } catch { return null; } };
  /** the receipts spent this session - the device's word may be lost (no store), this one is not */
  const spentHere = new Set();
  /** Whether the spoils of `day` for `acct` have left him already - this session's word, or the device's (an older
   *  build's single day spent for anyone). */
  function spentOn(day, acct) {
    if (spentHere.has(spentKey(day, acct))) return true;
    const kept = read(SPOILS_DAY_KEY);
    return kept === day || (Array.isArray(kept) && (kept.includes(spentKey(day, acct)) || kept.includes(spentKey(day, '*'))));
  }
  /** The receipt spent, here and on the device, and its pieces kept as rolled until a save holds them. */
  function spend(day, acct, list) {
    spentHere.add(spentKey(day, acct));
    const kept = read(SPOILS_DAY_KEY);
    keep(SPOILS_DAY_KEY, [...(Array.isArray(kept) ? kept : Number.isSafeInteger(kept) ? [spentKey(kept, '*')] : []), spentKey(day, acct)].slice(-SPOILS_SPENT_MAX));
    const w = who();
    const recs = recordsOf(read(SPOILS_STORE_KEY)).filter((r) => r && !(r.day === day && r.who === w));
    keep(SPOILS_STORE_KEY, [...recs, { day, at: wall(), who: w, pieces: list }].slice(-SPOILS_RECORDS_MAX));
  }

  function loadTex() {
    if (tex || texLoading || !getTexture) return;
    texLoading = Promise.resolve().then(() => getTexture(RANDOM_TREASURE_ARCHIVE)).then((t) => { tex = t ?? null; }, () => { tex = null; });
  }
  function batchOf(f) {
    if (f.batch || !tex || !renderer?.createBillboardBatch) return f.batch;
    try {
      if (!renderer.textures?.has?.(`${RANDOM_TREASURE_ARCHIVE}_${f.piece.record}#0`)) uploadRecordFrame?.(RANDOM_TREASURE_ARCHIVE, f.piece.record, 0);
      const size = billboardSize(tex, f.piece.record);
      f.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, f.piece.record, size, [[0, 0, 0]]);
      f.batch.frame = 0;
      f.batch.origin = [...f.fly.pos];
    } catch { f.batch = null; }
    return f.batch;
  }
  function takeOne(f) {
    if (f.taken) return;
    f.taken = true;
    take(f.piece);
    say(f.piece.kind === 'gold' ? SPOILS_TEXT.gold(f.piece.gold) : SPOILS_TEXT.item(f.piece.item.name, f.piece.tier));
    if (f.batch) { renderer?.destroyBillboardBatch?.(f.batch); f.batch = null; }
  }

  return {
    /**
     * THE BURST: the spoils of `day` for this player (the receipt's `seed`, the player's `level`) leave his chest `at`
     * (the dungeon's frame) toward `bearing` (the angle from him to the player). Once a day, on this device: a day
     * already spent is nothing. The pieces as rolled go into the device's record the moment they leave him.
     */
    spew({ day, seed, level, at, bearing, acct = '' }) {
      if (spentOn(day, acct)) return false;
      rec = { day };
      t0 = now(); lastT = t0; from = [...at];
      const list = spoilsList(seed >>> 0, Math.max(1, level | 0));
      launches = spewLaunches(seededRng(((seed >>> 0) ^ 0x5a5a) >>> 0), list.length, bearing);
      floor = list.map((piece, i) => ({ piece, fly: spewPiece(from, launches[i]), left: false, restAt: 0, taken: false, batch: null }));
      spend(day, acct, list);
      loadTex();
      return true;
    },
    /** AUDIT WB A2: THE SPOILS WITH NO FLOOR - a receipt that came while its court was not this player's to stand in
     *  (cast out before the kill, gone, told by the hub's next hello): the same pieces, straight into the pack, said
     *  once. Once a receipt, as the burst is; answers whether they were given. */
    grant({ day, seed, level, acct = '' }) {
      if (spentOn(day, acct)) return false;
      const list = spoilsList(seed >>> 0, Math.max(1, level | 0));
      spend(day, acct, list);
      for (const piece of list) take(piece);
      say(SPOILS_TEXT.granted);
      return true;
    },
    /** One frame: the pieces leave on their schedule, fly, clatter and rest; a resting piece under the player's feet is
     *  taken. */
    frame() {
      if (!rec) return;
      const t = now(), dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000));
      lastT = t;
      loadTex();
      const f0 = feet();
      floor.forEach((f, i) => {
        if (f.taken) return;
        if (!f.left) { if (t - t0 < launches[i].at) return; f.left = true; }
        if (!f.fly.rest) {
          const what = flySpew(f.fly, dt, ray);
          if (what === 'bounce' || what === 'rest') audio?.play3d?.(CLIPS.drop, [...f.fly.pos], 1, { maxDistance: 24 });
          if (f.fly.rest) {
            f.restAt = t;
            if ((RARITIES[f.piece.tier]?.rank ?? 0) >= RARITIES.rare.rank) audio?.play3d?.(SOUND.MakeItem, [...f.fly.pos], 1, { maxDistance: 30 });   // the rare chime (corpseMarker.js playRareDrop's own)
          }
        }
        const b = batchOf(f);
        if (b) { b.origin[0] = f.fly.pos[0]; b.origin[1] = f.fly.pos[1]; b.origin[2] = f.fly.pos[2]; }
        if (f.fly.rest && f0 && Math.hypot(f.fly.pos[0] - f0[0], f.fly.pos[2] - f0[2]) <= SPOILS_TAKE_M && Math.abs(f.fly.pos[1] - f0[1]) < 2) takeOne(f);
      });
    },
    /** The pieces, for the host's billboard pass. */
    batches: () => floor.filter((f) => f.batch && !f.taken && f.left).map((f) => f.batch),
    /** A Rare-or-better resting piece's light, in the court's channel. */
    lights() {
      const out = [];
      for (const f of floor) {
        if (f.taken || !f.fly.rest || (RARITIES[f.piece.tier]?.rank ?? 0) < RARITIES.rare.rank) continue;
        const c = tierColour(f.piece.tier), k = SPOILS_LIGHT.k * Math.min(1, (now() - f.restAt) / SPOILS_RISE_MS);
        out.push({ x: f.fly.pos[0], y: f.fly.pos[1] + SPOILS_LIGHT.up, z: f.fly.pos[2], range: SPOILS_LIGHT.range, color: c.map((v) => v * k) });
      }
      return out;
    },
    /** The glows, in the host's world pass. */
    drawPass(proj, view, eye, seconds, fog = null) {
      if (!glow) return false;
      const t = now();
      const glows = floor.filter((f) => !f.taken && f.fly.rest).map((f) => ({ foot: [...f.fly.pos], tier: f.piece.tier, alpha: Math.min(1, (t - f.restAt) / SPOILS_RISE_MS) }));
      glow.draw(glows, proj, view, eye, seconds, fog);
      return glow.drawn > 0;
    },
    /** Out of the court: whatever is still on its floor (or in the air) goes into the pack - the record stands until a
     *  save holds them. */
    gather() {
      const left = floor.filter((f) => !f.taken).length;
      floor.forEach((f) => takeOne(f));
      rec = null; floor = []; launches = [];
      if (left) say(SPOILS_TEXT.gathered);
      return left;
    },
    /** What the pool holds, for the tests and the stats. */
    state: () => ({ day: rec?.day ?? null, pieces: floor.map((f) => ({ kind: f.piece.kind, tier: f.piece.tier, left: f.left, rest: f.fly.rest, taken: f.taken, pos: [...f.fly.pos] })) }),
  };
}
