// @ts-check
// PARTY-LOOT (2026-10-14, the field - "Loot | Data Sync Bug?": "In a dungeon with multiple people OR party, each of us
// DO NOT see the same loot on Mobs/Containers/Floor etc." - and Mac, asked: "I want a delicate balance... the best of
// both worlds", then "Shared base + personal bonus"): A ROOM'S CONTAINER IS ONE LIST FOR EVERYONE IN IT, AND EACH
// PLAYER'S OWN LUCK AND RENOWN ADD A LAYER ONLY THEY SEE.
//
// WHY IT WAS BROKEN. WORLD4 let every client roll a dungeon's containers on its own dice and its own player
// (Math.random, the player's level, Luck and Renown) and made a container the room's at its first OPEN, the first
// opener's roll adopted by the rest. The plaque (PX21c) and Quick Loot (QUICK-LOOT B4) then showed and took from a
// container nobody had opened: every player saw their own roll, and the first take sent the taker's leftover list to the
// room, which replaced everyone else's whole.
//
// THE LAW NOW (bible/06-Systems/Online-Arc.md PARTY-LOOT, and WORLD4's LAW rewritten):
// - THE BASE. A room's container - a layout pile (`loot:<i>`), a layout body (`corpse:<i>`), a rest encounter's body
//   (`enc:<n>`) - has ONE base list, which every client COMPUTES: the container's chain run on dice seeded by its NAME
//   (the room, the container's key and its generation - roomContainerName) and on the room's TERMS, never a player's:
//   the party's level fixed at the container's birth (`lv`), a gender drawn off the name, Luck 50, RENOWN-LOOT's first
//   stage, no finder's multiplier, and every mod read as the room's whole (onlineLane.js asTheRoom). Nothing of the base
//   crosses the wire but its terms: they ride the room's own words (WORLD4's act frame and the memory), minted ONCE - by
//   the room's host at the container's birth (a pile at the room's, a body at its death), and by another client only
//   when no host word has come (ROOM_TERMS_WAIT_MS); two mints for one generation agree by roomTermsBeat, the earlier.
// - THE TAKES. The room's word about a container is no longer its list: it is the takes against the shared one - the
//   base pieces gone (`x`, a set that only grows), the base stacks drawn down (`c`, a count that only falls), and what
//   players have stored in it (`s`, full records, and their ids `si`). Two words merge the same in any order, so two
//   players taking different pieces in the same breath both see both gone; nothing a peer says overwrites a list. A word
//   carries its base's signature (`h`): a client whose own computation differs (another build) reads it as AUDIT SETS
//   M2's unreadable word, never as a list to land. The room's memory is the exception on its host: a remembered word
//   was the room's own, an earlier visit's, so the host starts that container over one generation on
//   (scenes/roomLootHost.js restartStaleContainer).
// - THE CLAIMS (Mac, 2026-10-15: "Host arbitrates"). A take of a shared piece is a claim the room's host grants, first
//   come first served; the loser is told so and the piece reaches the winner's pack alone. The takes, the stored pieces
//   and the verdicts are the HOST's word; a claimer says only its claims and its puts (below, validRoomWord's `q`, `a`
//   and `y`).
// - THE BONUS. Each player's own Renown and Luck - "the roller's own" (RENOWN-LOOT) - roll a layer over the base on dice
//   seeded by the container's name and the CHARACTER: the pieces PLAIN-LOOT's keep let go that the player's Renown
//   keeps, and the supplies their Renown's share adds over the first stage's, laddered at their Luck and their finders.
//   It is never said to the room and never touches another list, and what a character has taken of it is kept in the
//   character's save (the record below), so a reload or a walk back in rolls nothing again.
//
// Pure but for the spent record's state and the personal mark. Not a DFU member: Daggerfall has one player. Ledger A
// (PARTY-LOOT).
import { groupReferenceLevel } from './mentorMode.js';
import { RENOWN_LOOT_QUARTERS } from './renownLoot.js';
import { validLootList, LOOT_LIST_MAX, LOOT_STACK_MAX } from './loot/loot.js';
import { addGoldPieces, addItem, isGoldPieces, stacksWith } from './inventory.js';   // OUTDOOR-LOOT: the player's hands (liftPiece, givePiece) - none of the three imports this file
import { isEquipped, unequipItem } from './equip.js';
import { notCarried } from './peerWord.js';
import { registerModSaveData } from './modSaveData.js';
import { healingSupplyChances, mintHealingPotion, mintMagickaPotion } from './healingSupply.js';
import { restLootChances, restItemsAvailable, createRestItem, REST_PILE_CHANCES, REST_FOE_CHANCES } from './rest/restItems.js';
import { WILD_TEXT } from './wild/wildZone.js';

// ---- the dice -------------------------------------------------------------------------------------------------------

/** xmur3: a 32-bit hash stream of a string (each call the next word). */
function hashStream(/** @type {string} */ str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** THE ROOM'S DICE: a stream in [0, 1) that is the same on every machine for the same name - sfc32 seeded by the name's
 *  hash, warmed a dozen draws. Every client that asks for `name` gets the same draws in the same order. */
export function seededRolls(/** @type {string} */ name) {
  const h = hashStream(String(name));
  let a = h(), b = h(), c = h(), d = h();
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** A short signature of a string (base 36), for a base list's `h`. */
export const signatureOf = (/** @type {string} */ s) => { const h = hashStream(String(s)); return h().toString(36) + h().toString(36); };

// ---- the container and its terms ------------------------------------------------------------------------------------

/** The kinds of key whose container has a shared base (takeLoot's vocabulary): a layout pile, a layout body, a rest
 *  encounter's body - and (OUTDOOR-LOOT slice 3) a searched object's find (`srch:`), whose base is CARRIED: the searcher's roll,
 *  minted once at the search (carriedBase below), not computed. */
export const ROOM_BASE_KINDS = Object.freeze(['loot', 'corpse', 'enc', 'srch']);
export const isRoomBaseKind = (/** @type {string} */ canon) => typeof canon === 'string' && ROOM_BASE_KINDS.includes(canon.split(':')[0]);

/** THE CONTAINER'S NAME, which its dice are seeded by: the room (its key - every client in it the same), the container's
 *  canonical key, and its generation (`g`: a pile's 0 until the hour's respawn rolls it again, a body's its death). */
export const roomContainerName = (/** @type {string} */ room, /** @type {string} */ canon, /** @type {number} */ g) => `${room}|${canon}#${g}`;

/** The base's terms, every client the same: Luck 50 (DFU's tables read no Luck; the port's ladder's floor) and
 *  RENOWN-LOOT's first stage (online before the page knows its Renown - "no roll is ever richer than the Renown behind
 *  it"). A player's own Luck and Renown above these are their bonus. */
export const ROOM_BASE_LUCK = 50;
export const ROOM_BASE_QUARTERS = RENOWN_LOOT_QUARTERS[0];
/** The base's finders' multiplier: none (the drought and a worn find are a player's own). */
export const ROOM_BASE_FIND = 1;
/** The highest level a term names (net/wire.js FOE_LEVEL_MAX's bound, read here without the relay's bundle). */
export const ROOM_LEVEL_MAX = 100;
/** The most pieces a base may hold for its takes to name them by place. */
export const ROOM_BASE_MAX = 255;

/** THE PARTY'S LEVEL, as the minter computes it at the container's birth: SOFTCAP1's group reference (mentorMode.js
 *  groupReferenceLevel - the harmonic mean, leaning to the lowest member) of the minter's own level and its party's
 *  online members' (their poses' `cl`), rounded, at least 1. It is fixed in the container's terms and carried in the
 *  room's word, so no client computes it from a list that could differ from another's. */
export function roomBaseLevel(/** @type {number} */ own, /** @type {number[]} */ partners = []) {
  const ref = groupReferenceLevel([own, ...(Array.isArray(partners) ? partners : [])]);
  const lv = Math.round(Number.isFinite(ref) ? /** @type {number} */ (ref) : Number(own) || 1);
  return Math.max(1, Math.min(ROOM_LEVEL_MAX, lv));
}

/** The base's gender (clothing and a magic item's cut read one): a draw off the container's own name, so the room's
 *  piles and bodies hold both and every client agrees which. */
export const roomBaseGender = (/** @type {string} */ name) => (seededRolls(`${name}|gender`)() < 0.5 ? 'male' : 'female');

/** The ROLLER the base's chain is handed where it reads a player: the terms' level, the name's gender, Luck 50, no
 *  effect, no mentor - a stand-in no client's own character can colour. */
export const roomRoller = (/** @type {number} */ lv, /** @type {string} */ gender) => ({
  level: lv, gender, stats: { luck: ROOM_BASE_LUCK }, activeEffects: [], items: [],
});

/** Terms off a word, or null: `g` the generation, `lv` the level, `n` the fight's count (a body's sigils), `tm` when it
 *  was minted (the relay's clock). */
export function validRoomTerms(/** @type {any} */ t) {
  if (!t || typeof t !== 'object') return null;
  if (!Number.isSafeInteger(t.g) || t.g < 0) return null;
  if (!Number.isInteger(t.lv) || t.lv < 1 || t.lv > ROOM_LEVEL_MAX) return null;
  if (t.n !== undefined && (!Number.isInteger(t.n) || t.n < 1 || t.n > 8)) return null;
  if (t.tm !== undefined && !Number.isFinite(t.tm)) return null;
  return { g: t.g, lv: t.lv, n: t.n ?? 1, tm: t.tm ?? 0 };
}
export const sameRoomTerms = (/** @type {any} */ a, /** @type {any} */ b) => !!a && !!b && a.g === b.g && a.lv === b.lv && (a.n ?? 1) === (b.n ?? 1);
/** Whether terms `a` replace terms `b` for one container: a newer generation always; in one generation the earlier mint,
 *  then the lower level, then the lower count - a total order, so every client that hears both keeps the same.
 *  OUTDOOR-LOOT: a CARRIED base (a cupboard's first roll - below) is one client's roll, not a function of its terms, so two
 *  mints of one day at one instant, one level and one count are still two bases; the lower signature `h` decides, and the
 *  order stays total. A computed base's terms carry no `h`, and nothing changes for it. */
export function roomTermsBeat(/** @type {any} */ a, /** @type {any} */ b) {
  if (!b) return true;
  if (a.g !== b.g) return a.g > b.g;
  if (a.tm !== b.tm) return a.tm < b.tm;
  if (a.lv !== b.lv) return a.lv < b.lv;
  if ((a.n ?? 1) !== (b.n ?? 1)) return (a.n ?? 1) < (b.n ?? 1);
  return typeof a.h === 'string' && typeof b.h === 'string' && a.h < b.h;
}

// ---- the base's signature -------------------------------------------------------------------------------------------

/** A base list's signature - what each piece IS (its template, material, count, tier and enchantment count), in order. */
export function baseSignature(/** @type {any[]} */ items) {
  return signatureOf((items ?? []).map((it) => `${it?.group ?? ''}.${it?.templateIndex ?? ''}.${it?.material ?? ''}.${it?.stackCount ?? 1}.${it?.rarity ?? ''}.${Array.isArray(it?.enchantments) ? it.enchantments.length : 0}`).join(','));
}

// ---- the word -------------------------------------------------------------------------------------------------------

/** Whether a room's loot record is a PARTY-LOOT word (terms and takes) rather than WORLD4's list. */
export const isRoomWord = (/** @type {any} */ rec) => !!rec && typeof rec === 'object' && Number.isSafeInteger(rec.g) && Number.isInteger(rec.lv);

// THE CLAIMS (Mac, 2026-10-15, asked how two players taking the same piece in one breath should end: "Host arbitrates").
// A take of a shared piece - a base piece or a stored one - is a CLAIM, and the room's host (WORLD2's, the one that runs
// its foes) is the one that grants it: in the order the claims reach it, the first takes the piece and every later one
// is told ROOM_TAKEN_TEXT. A claimer's piece comes into its pack only on the grant; the host's own take is judged where
// it stands, with no round trip. A PUT (a piece laid in a container) is the host's to land too, so the stored pieces have
// one writer. Every word carries its claims' ids, and the host's word its verdicts, so a seat that changes hands judges
// what the last host left unanswered (roomClaimOrder) and never what it answered.

/** What a loser is told - the remains' own line (systems/wild/wildZone.js), one string for one refusal. */
export const ROOM_TAKEN_TEXT = WILD_TEXT.taken;
/** How long a claim stands taken in its claimer's view with no verdict before the piece comes back. */
export const ROOM_CLAIM_TIMEOUT_MS = 4000;
/** How often a put with no verdict is said again (a put never comes back on its own: the piece is the room's). */
export const ROOM_PUT_RESAY_MS = 1500;
/** The most claims (and the most puts) one word carries. */
export const ROOM_CLAIMS_MAX = 32;
/** The verdicts a host's word carries (the latest), and four times as many a state remembers. */
export const ROOM_ANSWERS_KEPT = 32;
/** A claim's id (and a stored piece's): the claimer's peer id, its context's stamp and a count - unique in a room. */
const ROOM_ID_RE = /^[A-Za-z0-9_.:-]{3,80}$/;
export const validRoomId = (/** @type {any} */ id) => typeof id === 'string' && ROOM_ID_RE.test(id);
export const roomClaimId = (/** @type {string} */ who, /** @type {string} */ stamp, /** @type {number} */ n) => `${who}:${stamp}:${n}`;
/** Whether peer `from` made claim `id` - an id names its claimer first, so no peer claims or puts in another's name. */
export const claimOf = (/** @type {any} */ id, /** @type {any} */ from) => typeof id === 'string' && typeof from === 'string' && id.startsWith(`${from}:`);
/** A piece's count, as a take and a claim count it: its stack, or one. */
export const pieceCount = (/** @type {any} */ it) => (Number.isInteger(it?.stackCount) && it.stackCount > 0 ? it.stackCount : 1);

/**
 * A word off the wire, projected (AUDIT WORLD3 A2's law, WORLD4's projection for its stored pieces) - or null. The
 * terms; `h` the base's signature; `x` the base places gone (whole numbers under ROOM_BASE_MAX, each once); `c` a base
 * stack's count where it was drawn down (`[place, count]`, a count of at least one); `s` the stored pieces through
 * validLootList, at most LOOT_LIST_MAX, and `si` their ids (one each, in order - a word without them names them by
 * place, `s:<i>`); `q` the claims (`{ id, p | sp, n, tm }`: a base place or a stored piece's id, a count), `a` the puts
 * (`{ id, it, tm }` - a piece the item law refuses is a put of nothing, refused), `y` the host's verdicts (`[id, count
 * granted]`, nought refused). A word with no `s` says nothing of the stored pieces (a claim, a birth with none).
 * OUTDOOR-LOOT: `b` a CARRIED base's records (a cupboard's first roll, a find - the birth's, and the host's memory of it):
 * each through validLootList, at most LOOT_LIST_MAX, and a record this build cannot read (null) or whose place the item
 * law would take (an empty answer: a place dropped is every later place shifted) makes the word unreadable - AUDIT SETS
 * M2's refusal, null here - and a base always says its signature `h`.
 */
export function validRoomWord(/** @type {any} */ rec) {
  if (!isRoomWord(rec)) return null;
  const terms = validRoomTerms(rec);
  if (!terms) return null;
  if (rec.h !== undefined && (typeof rec.h !== 'string' || !/^[0-9a-z]{1,16}$/.test(rec.h))) return null;
  /** @type {any[] | null} */
  let b = null;
  if (rec.b !== undefined) {
    if (rec.h === undefined || !Array.isArray(rec.b) || rec.b.length > LOOT_LIST_MAX) return null;
    b = [];
    for (const r of rec.b) {
      const one = validLootList([r]);
      if (!one || one.length !== 1) return null;
      b.push(one[0]);
    }
  }
  const x = [];
  if (rec.x !== undefined) {
    if (!Array.isArray(rec.x) || rec.x.length > ROOM_BASE_MAX) return null;
    const seen = new Set();
    for (const i of rec.x) { if (!Number.isInteger(i) || i < 0 || i >= ROOM_BASE_MAX || seen.has(i)) return null; seen.add(i); x.push(i); }
  }
  /** @type {[number, number][]} */
  const c = [];
  if (rec.c !== undefined) {
    if (!Array.isArray(rec.c) || rec.c.length > ROOM_BASE_MAX) return null;
    for (const p of rec.c) {
      if (!Array.isArray(p) || p.length !== 2) return null;
      const [i, n] = p;
      if (!Number.isInteger(i) || i < 0 || i >= ROOM_BASE_MAX || !Number.isInteger(n) || n < 1 || n > LOOT_STACK_MAX) return null;
      c.push([i, n]);
    }
  }
  /** @type {any[] | null} */
  let s = null;
  /** @type {string[] | null} */
  let si = null;
  if (rec.s !== undefined) {
    if (!Array.isArray(rec.s) || rec.s.length > LOOT_LIST_MAX) return null;
    if (rec.si !== undefined && (!Array.isArray(rec.si) || rec.si.length !== rec.s.length)) return null;
    s = []; si = [];
    const ids = new Set();
    for (let i = 0; i < rec.s.length; i++) {
      const one = validLootList([rec.s[i]]);
      const id = rec.si === undefined ? `s:${i}` : rec.si[i];
      if (!one || !validRoomId(id) || ids.has(id)) return null;
      ids.add(id);
      if (one.length) { s.push(one[0]); si.push(id); }   // INT1: a piece the item law refuses goes, never the word
    }
  }
  const q = [];
  if (rec.q !== undefined) {
    if (!Array.isArray(rec.q) || rec.q.length > ROOM_CLAIMS_MAX) return null;
    for (const cl of rec.q) {
      if (!cl || typeof cl !== 'object' || !validRoomId(cl.id) || !Number.isInteger(cl.n) || cl.n < 1 || cl.n > LOOT_STACK_MAX) return null;
      if (cl.tm !== undefined && !Number.isFinite(cl.tm)) return null;
      if ((cl.p === undefined) === (cl.sp === undefined)) return null;
      if (cl.p !== undefined && (!Number.isInteger(cl.p) || cl.p < 0 || cl.p >= ROOM_BASE_MAX)) return null;
      if (cl.sp !== undefined && !validRoomId(cl.sp)) return null;
      q.push({ id: cl.id, ...(cl.p !== undefined ? { p: cl.p } : { sp: cl.sp }), n: cl.n, tm: cl.tm ?? 0 });
    }
  }
  const a = [];
  if (rec.a !== undefined) {
    if (!Array.isArray(rec.a) || rec.a.length > ROOM_CLAIMS_MAX) return null;
    for (const p of rec.a) {
      if (!p || typeof p !== 'object' || !validRoomId(p.id) || (p.tm !== undefined && !Number.isFinite(p.tm))) return null;
      const one = validLootList([p.it]);
      if (!one) return null;
      a.push({ id: p.id, it: one[0] ?? null, tm: p.tm ?? 0 });
    }
  }
  /** @type {[string, number][]} */
  const y = [];
  if (rec.y !== undefined) {
    if (!Array.isArray(rec.y) || rec.y.length > ROOM_ANSWERS_KEPT) return null;
    for (const p of rec.y) {
      if (!Array.isArray(p) || p.length !== 2 || !validRoomId(p[0]) || !Number.isInteger(p[1]) || p[1] < 0 || p[1] > LOOT_STACK_MAX) return null;
      y.push([p[0], p[1]]);
    }
  }
  return { ...terms, ...(rec.h !== undefined ? { h: rec.h } : {}), ...(b ? { b } : {}), x, c, s, si, q, a, y };
}

// ---- the room's state of one container ------------------------------------------------------------------------------

/** A container's state as this client knows the room's word: its terms, the base places gone, the drawn-down counts,
 *  the stored pieces and their ids, the verdicts it has heard (id -> count granted) and the claims and puts it has
 *  heard that no verdict has answered yet (id -> claim). `base` is a CARRIED base (carriedBase below), null for a
 *  computed one - every client computes that. */
export const roomState = (/** @type {any} */ terms) => ({
  terms, taken: new Set(), counts: new Map(), stored: /** @type {any[]} */ ([]), ids: /** @type {string[]} */ ([]),
  answers: /** @type {Map<string, number>} */ (new Map()), claims: /** @type {Map<string, any>} */ (new Map()),
  base: /** @type {{ items: any[], full: (number|null)[], h: string, records: any[] } | null} */ (null),
});

/**
 * OUTDOOR-LOOT: A CARRIED BASE. PARTY-LOOT's base is COMPUTED - every client rolls the same dice off the container's name.
 * A building's cupboard cannot be: its stock is `stockHouseContainer` for the player who opened it first, and a dungeon's
 * search find is the searcher's (their level, gender, Luck and dice). So its first roll is MINTED ONCE by whoever rolled it
 * and its records travel once, in the word `b` that carries the birth (and the host's memory of it); from then on the
 * room's word about the container is the takes against it, as for any other. The records through validRoomWord, ready:
 * `items` the live pieces by place (the same objects every compose, so a take holds the piece it took), `full` their counts
 * as minted, `h` their signature (baseSignature - the word's own `h` must say the same), and `records` the pieces as the
 * word said them, kept to be said again.
 */
export function carriedBase(/** @type {any[]} */ records) {
  const records0 = JSON.parse(JSON.stringify(records));
  const items = records0.map((/** @type {any} */ r) => ({ ...r }));
  return { items, full: items.map((/** @type {any} */ it) => (Number.isInteger(it?.stackCount) ? /** @type {number} */ (it.stackCount) : null)), h: baseSignature(items), records: records0 };
}

/** A verdict recorded: the claim answered, the oldest verdicts let go past four times what a word carries. */
export function answerRoomClaim(/** @type {any} */ state, /** @type {string} */ id, /** @type {number} */ g) {
  state.answers.set(id, g);
  state.claims.delete(id);
  while (state.answers.size > ROOM_ANSWERS_KEPT * 4) state.answers.delete(/** @type {string} */ (state.answers.keys().next().value));
}
/** A claim heard (the claimer's own, or another's) and kept for a verdict - bounded, the oldest let go. */
function hearRoomClaim(/** @type {any} */ state, /** @type {any} */ cl) {
  if (state.answers.has(cl.id) || state.claims.has(cl.id)) return;
  state.claims.set(cl.id, cl);
  while (state.claims.size > ROOM_CLAIMS_MAX * 2) state.claims.delete(state.claims.keys().next().value);
}

/**
 * THE MERGE: a projected word into a state - or a fresh state, when the word names another base whose terms beat the
 * state's (a newer generation, an earlier mint). Answers `{ state, changed, answered }`; a word for a base that loses
 * is dropped (`changed` false), its claims heard as claims on a base that is gone (`stale`, refused at their verdict),
 * and a word for the SAME base (its generation, level and count) merges whichever was minted first. The places gone are
 * a union and the counts a minimum, so two words land the same in either order and a take is never undone by an older
 * word; the stored pieces are the word's, when it says them (the host's - one writer); a verdict is the first heard for
 * its claim, and `answered` the verdicts new here.
 */
export function mergeRoomWord(/** @type {any} */ state, /** @type {any} */ w) {
  let st = state;
  let changed = false;
  // OUTDOOR-LOOT: a CARRIED base (carriedBase) is part of the mint - its terms say its signature `h` - and the base is the
  // first heard for its terms, never replaced by a later word's; a word that beats the state's terms with no base to
  // adopt (a claim, a verdict) is a mint this client cannot hold, and is heard as a loser's
  const carried = st?.terms.h !== undefined;
  if (st && sameRoomTerms(w, st.terms) && (!carried || w.h === st.terms.h)) {
    // one base (one name, one level, one count): its takes are takes against the same pieces, whoever minted first
    if ((w.tm ?? 0) < st.terms.tm) st.terms = { ...st.terms, tm: w.tm ?? 0 };
  } else if (!st || (roomTermsBeat(w, st.terms) && (!carried || w.b))) {
    st = roomState({ g: w.g, lv: w.lv, n: w.n ?? 1, tm: w.tm ?? 0, ...(w.b ? { h: w.h } : {}) });
    if (w.b) st.base = carriedBase(w.b);
    changed = true;
  } else {
    for (const cl of [...(w.q ?? []), ...(w.a ?? [])]) hearRoomClaim(st, { ...cl, stale: true });
    return { state: st, changed: false, answered: [] };
  }
  for (const i of w.x ?? []) if (!st.taken.has(i)) { st.taken.add(i); changed = true; }
  for (const [i, n] of w.c ?? []) { const was = st.counts.get(i); if (was === undefined || n < was) { st.counts.set(i, n); changed = true; } }
  if (Array.isArray(w.s)) { st.stored = w.s; st.ids = Array.isArray(w.si) ? w.si : w.s.map((_, i) => `s:${i}`); changed = true; }
  /** @type {[string, number][]} */
  const answered = [];
  for (const [id, g] of w.y ?? []) if (!st.answers.has(id)) { answerRoomClaim(st, id, g); answered.push([id, g]); changed = true; }
  for (const cl of [...(w.q ?? []), ...(w.a ?? [])]) hearRoomClaim(st, cl);
  return { state: st, changed, answered };
}

/** THE ORDER a seat that changes hands judges the claims the last host left unanswered in - the claim's own clock (the
 *  relay's), then its id: a total order, so it is the same order whichever client takes the seat. */
export const roomClaimOrder = (/** @type {any} */ a, /** @type {any} */ b) => ((a.tm ?? 0) - (b.tm ?? 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * THE HOST'S VERDICT on one claim or put, against a state and its base (`baseLength` places, `full` their minted
 * counts): the count granted, nought refused - and the state moved by it. A claim on a base place takes what is left
 * of it, up to its count, so the first claim to reach the host is the one that holds the piece; a claim on a stored
 * piece the same, by its id; a put is landed (`admit` its gate - a piece no peer may be handed never lands - and the
 * cap's), its id the piece's. A claim already answered answers the same again; a claim on a base that is gone (`stale`)
 * is refused. The stored list is written new, never in place: the host's own open window keeps the pieces it shows.
 */
export function judgeRoomClaim(/** @type {any} */ state, /** @type {number} */ baseLength, /** @type {(number|null)[]} */ full, /** @type {any} */ cl, /** @type {(it: any) => boolean} */ admit = () => true) {
  if (state.answers.has(cl.id)) return /** @type {number} */ (state.answers.get(cl.id));
  let g = 0;
  if (cl.stale) g = 0;
  else if ('it' in cl) {
    if (cl.it && admit(cl.it) && state.stored.length < LOOT_LIST_MAX && !state.ids.includes(cl.id)) { state.stored = [...state.stored, cl.it]; state.ids = [...state.ids, cl.id]; g = 1; }
  } else if (cl.p !== undefined) {
    if (cl.p < baseLength && !state.taken.has(cl.p)) {
      const have = state.counts.get(cl.p) ?? (Number.isInteger(full[cl.p]) ? /** @type {number} */ (full[cl.p]) : 1);
      g = Math.min(cl.n, have);
      if (g >= have) { state.taken.add(cl.p); state.counts.delete(cl.p); } else state.counts.set(cl.p, have - g);
    }
  } else {
    const at = state.ids.indexOf(cl.sp);
    if (at >= 0) {
      const it = state.stored[at];
      const have = pieceCount(it);
      g = Math.min(cl.n, have);
      const stored = [...state.stored], ids = [...state.ids];
      if (g >= have) { stored.splice(at, 1); ids.splice(at, 1); } else stored[at] = { ...it, stackCount: have - g };
      state.stored = stored; state.ids = ids;
    }
  }
  answerRoomClaim(state, cl.id, g);
  return g;
}

/**
 * THE LIST a client holds for a container, and what it holds of whose: the base pieces still in it (in the base's
 * order, a drawn-down stack at its count), then the stored pieces, then this player's puts the host has not landed
 * yet, then this player's own (their bonus, never the room's). `pending` is this player's claims in flight - a base
 * place's count (`places`), a stored piece's (`stored`) - read as taken here until the host's verdict, and its puts
 * (`puts`, `{ it, id }`). `base` the base's pieces (the same objects every compose, so a take holds the piece it took);
 * `full` their counts as minted. Answers `{ list, seen }`: `seen` each shared piece of the list -> `{ p }` or `{ sp }`
 * and its count, which is what a take is read against (the bonus is no claim's).
 */
export function composeRoomView(/** @type {any[]} */ base, /** @type {(number|null)[]} */ full, /** @type {any} */ state, /** @type {any[]} */ personal = [], /** @type {any} */ pending = null) {
  const places = pending?.places ?? new Map(), storedOut = pending?.stored ?? new Map();
  const list = [];
  /** @type {Map<any, any>} */
  const seen = new Map();
  base.forEach((it, i) => {
    if (state.taken.has(i)) return;
    const counted = Number.isInteger(full[i]);
    const left = (state.counts.get(i) ?? (counted ? /** @type {number} */ (full[i]) : 1)) - (places.get(i) ?? 0);
    if (left <= 0) return;
    if (counted) it.stackCount = Math.min(left, /** @type {number} */ (full[i]));
    list.push(it);
    seen.set(it, { p: i, n: pieceCount(it) });
  });
  const shown = (/** @type {any} */ it, /** @type {string} */ id) => {
    const left = pieceCount(it) - (storedOut.get(id) ?? 0);
    if (left <= 0) return;
    const piece = { ...it, stackCount: left };   // OUTDOOR-LOOT (DESIGN 6.2): ALWAYS A COPY - a window that splits an undrawn stack mutates the record it was handed, and the state's own record is the judge's: a partial take read the mutated count and spliced the whole piece, destroying the remainder
    list.push(piece);
    seen.set(piece, { sp: id, n: left });
  };
  state.stored.forEach((/** @type {any} */ it, /** @type {number} */ k) => shown(it, state.ids[k]));
  for (const p of pending?.puts ?? []) shown(p.it, p.id);
  list.push(...personal);
  return { list, seen };
}

/** The room's word for a container as its HOST says it: its terms, its base's signature, its takes (`x`, `c`), its
 *  stored pieces and their ids, and its latest verdicts. */
export const roomWord = (/** @type {string} */ k, /** @type {any} */ state, /** @type {string} */ h, /** @type {{ s: any[], si: string[] }} */ stored, /** @type {number|null} */ t = null, /** @type {[string, number][]} */ y = [], /** @type {any[] | null} */ base = null) => {
  const x = [...state.taken].sort((a, b) => a - b);
  const c = [...state.counts].filter(([i]) => !state.taken.has(i)).sort((a, b) => a[0] - b[0]);
  return {
    k, g: state.terms.g, lv: state.terms.lv, ...(state.terms.n > 1 ? { n: state.terms.n } : {}), tm: state.terms.tm, h,
    ...(base ? { b: base.map((r) => ({ ...r })) } : {}),   // OUTDOOR-LOOT: a carried base's records - the birth's, and the host's memory of it
    ...(x.length ? { x } : {}), ...(c.length ? { c } : {}), s: stored.s.map((it) => ({ ...it })), si: [...stored.si],
    ...(y.length ? { y } : {}), ...(Number.isFinite(t) ? { t } : {}),
  };
};
/** A claimer's word: the container's terms and base, and its claims and puts in flight - never the room's state. `b`: the
 *  carried base's records (`base`), when this word is the container's birth. */
export const claimWord = (/** @type {string} */ k, /** @type {any} */ state, /** @type {string} */ h, /** @type {any[]} */ q, /** @type {any[]} */ a, /** @type {number|null} */ t = null, /** @type {any[] | null} */ base = null) => ({
  k, g: state.terms.g, lv: state.terms.lv, ...(state.terms.n > 1 ? { n: state.terms.n } : {}), tm: state.terms.tm, h,
  ...(base ? { b: base.map((r) => ({ ...r })) } : {}),
  ...(q.length ? { q: q.map((cl) => ({ ...cl })) } : {}), ...(a.length ? { a: a.map((p) => ({ id: p.id, it: { ...p.it }, tm: p.tm })) } : {}),
  ...(Number.isFinite(t) ? { t } : {}),
});
/** The latest verdicts a host's word carries. */
export const recentAnswers = (/** @type {any} */ state) => [...state.answers].slice(-ROOM_ANSWERS_KEPT);

// ---- the player's hands: a claim's lift and its give ----------------------------------------------------------------
// OUTDOOR-LOOT (2026-10-17): roomLootHost.js's roomLift and roomGive, parameterised by the ENTITY whose hands they are - the
// dungeon's block holds the module's one player, the street's pool its own (a test's, a second pool's) - so the street's
// bodies and a building's cupboards claim by the dungeon's own law. A take of a shared piece is read out of the pack and
// held as a claim until its verdict: lifted now, given on the grant.

/** `n` of a piece back out of `entity`'s hands - the very record, or the stack it merged into, in the pack or the bag; a coin
 *  out of the purse. Answers how many it found (a piece used straight off the container is found nowhere, and a claim
 *  that lifts nothing still goes). */
export function liftPiece(/** @type {any} */ entity, /** @type {any} */ item, /** @type {number} */ n) {
  if (isGoldPieces(item)) { const had = entity.goldPieces ?? 0, t = Math.min(had, n); entity.goldPieces = had - t; return t; }
  let left = n;
  const off = (/** @type {any[]} */ list, /** @type {number} */ at) => {
    const held = list[at], have = pieceCount(held);
    if (have <= left) { if (isEquipped(held)) unequipItem(entity, held); list.splice(at, 1); left -= have; }
    else { held.stackCount = have - left; left = 0; }
  };
  for (const list of [entity.items, entity.bagItems]) {
    if (!Array.isArray(list) || left <= 0) continue;
    const at = list.indexOf(item);
    if (at >= 0) off(list, at);
    for (let i = list.length - 1; i >= 0 && left > 0; i--) if (list[i] !== item && stacksWith(list[i], item)) off(list, i);
  }
  return n - left;
}
/** `n` of a piece into `entity`'s hands: coin to the purse, the rest to the pack (it stacks). Never a piece the entity
 *  carries already (AUDIT AUTO-HOLD: a second of it is a copy, its own locked with it - systems/peerWord.js). */
export function givePiece(/** @type {any} */ entity, /** @type {any} */ item, /** @type {number} */ n) {
  if (n <= 0) return;
  if (!notCarried([item])?.length) return;
  if (isGoldPieces(item)) { addGoldPieces(entity, n); return; }
  addItem((entity.items ??= []), Number.isInteger(item?.stackCount) ? { ...item, stackCount: n } : item);
}

/**
 * THE SETTLE'S DIFF: what a container's list shows since it was last composed, read by IDENTITY (never a row - a filtered
 * window's row 0 is not the container's place 0) against the shared pieces it held then. `seen` is `composeRoomView`'s
 * map, piece -> `{ p | sp, n }`; `skip` names the pieces that were never the room's (the player's own bonus, the owner's
 * pieces that never ride). Answers the three things a list can show:
 *   takes: a shared piece gone or fallen in count - `{ obj, info, k }`, `k` the count taken (a stack split by the
 *          window mutates the piece's own count, so a partial take reads as a fall);
 *   grows: a shared stack that grew - something laid onto it - `{ obj, info, by }`;
 *   puts:  a piece in the list `seen` never held - a piece laid in.
 * `seen` is moved to what the list holds now, a piece gone forgotten and a count updated, so a second call reads only what
 * changed after the first; the PUTS are the caller's to enter into `seen` (it names them). roomLootHost.js roomSettle's
 * two loops as one law.
 */
export function listMovesSince(/** @type {Map<any, any>} */ seen, /** @type {any[]} */ list, /** @type {(it: any) => boolean} */ skip = () => false) {
  const here = new Set(list);
  const takes = [], grows = [], puts = [];
  for (const [obj, info] of [...seen]) {
    const cur = here.has(obj) ? pieceCount(obj) : 0;
    if (cur === info.n) continue;
    if (cur > info.n) { grows.push({ obj, info, by: cur - info.n }); info.n = cur; continue; }
    const k = info.n - cur;
    info.n = cur;
    if (!cur) seen.delete(obj);
    takes.push({ obj, info, k });
  }
  for (const obj of list) if (obj && !seen.has(obj) && !skip(obj)) puts.push(obj);
  return { takes, grows, puts };
}

/**
 * OUTDOOR-LOOT: AN OLDER BUILD'S WHOLE LIST IS A DIFF, NEVER A LIST TO LAND (DESIGN 4.8). An older build says a cupboard's
 * (or a find's) list whole - what it holds after its window - and a list landed over the room's is the last-writer-wins
 * that lost pieces and brought taken ones back. So a peer's list is read against ITS OWN previous one: a piece that fell in
 * count is that peer's take, one that rose is its put, and a list as it was changes nothing. Pieces are told apart by what
 * they ARE (their template, material, tier, enchantments and ledger id - a piece's count apart). `legacyCounts` reads a
 * list as that census, signature -> { n: the pieces of it, it: the first of them }; `legacyDelta` answers what changed
 * between a census and a list - `takes` { sig, n }, `puts` { sig, n, it } - and the list's own census, the peer's next
 * baseline.
 */
export const legacySig = (/** @type {any} */ it) => [it?.group, it?.templateIndex, it?.material, it?.rarity, Array.isArray(it?.enchantments) ? it.enchantments.length : 0, it?.uid].map((v) => v ?? '').join('.');
export function legacyCounts(/** @type {any[]} */ list) {
  /** @type {Map<string, { n: number, it: any }>} */
  const m = new Map();
  for (const it of list ?? []) {
    const k = legacySig(it), e = m.get(k);
    if (e) e.n += pieceCount(it); else m.set(k, { n: pieceCount(it), it });
  }
  return m;
}
export function legacyDelta(/** @type {Map<string, { n: number, it: any }> | null} */ prev, /** @type {any[]} */ list) {
  const counts = legacyCounts(list);
  /** @type {{ sig: string, n: number }[]} */ const takes = [];
  /** @type {{ sig: string, n: number, it: any }[]} */ const puts = [];
  for (const [sig, was] of prev ?? []) { const now = counts.get(sig)?.n ?? 0; if (now < was.n) takes.push({ sig, n: was.n - now }); }
  for (const [sig, is] of counts) { const was = prev?.get(sig)?.n ?? 0; if (is.n > was) puts.push({ sig, n: is.n - was, it: is.it }); }
  return { takes, puts, counts };
}

/** Whether a container holds nothing of the room's: every base piece gone and nothing stored (WORLD8's "emptied"). */
export const roomEmptied = (/** @type {any} */ state, /** @type {number} */ baseLength) => state.stored.length === 0 && state.taken.size >= baseLength;

// ---- the personal bonus ---------------------------------------------------------------------------------------------

/** The share of what the base's step let go that a player's own step keeps: from `baseP` to `ownP` of one chance, as a
 *  chance over what the base did NOT keep - so the base's keep and the bonus together are the player's own keep. */
export const bonusShare = (/** @type {number} */ baseP, /** @type {number} */ ownP) => (ownP > baseP && baseP < 1 ? Math.min(1, (ownP - baseP) / (1 - baseP)) : 0);

/**
 * THE SUPPLIES' SHARE OF A BONUS: each of RENOWN-LOOT's supply chances (the healing and Restore Power potions, the rest
 * supplies - systems/healingSupply.js, systems/rest/restItems.js) from the base's share to the player's own, as one more draw
 * at the step between them (bonusShare) - so the base's draw and the bonus's together hold a supply at the player's own
 * chance. `side` 'enemy' (a looting foe) or 'pile' (a deep pile, J-O - the caller's gate, as the subscribers' own). A
 * draw is taken for every chance whatever it lands, so the dice a later draw reads never move. Answers the items.
 */
export function rollBonusSupplies(/** @type {any[]} */ items, /** @type {'enemy'|'pile'} */ side, /** @type {number} */ baseQ, /** @type {number} */ ownQ, /** @type {() => number} */ rolls) {
  const b = healingSupplyChances(baseQ)[side], o = healingSupplyChances(ownQ)[side];
  if (rolls() < bonusShare(b.healing / 100, o.healing / 100)) items.push(mintHealingPotion());
  if (rolls() < bonusShare(b.magicka / 100, o.magicka / 100)) items.push(mintMagickaPotion());
  const table = side === 'pile' ? REST_PILE_CHANCES : REST_FOE_CHANCES;
  const was = new Map(restLootChances(table, baseQ));
  const open = restItemsAvailable();
  for (const [t, pct] of restLootChances(table, ownQ)) {
    const hit = rolls() < bonusShare((was.get(t) ?? 0) / 100, pct / 100);
    if (hit && open) { const it = createRestItem(t); if (it) items.push(it); }
  }
  return items;
}

/** The tag a row of this player's own bonus wears on the plaque and the classic loot panel (the room's rows wear none). */
export const PLAQUE_MINE_TAG = 'yours';

/** THE PERSONAL MARK: a piece of this player's bonus (and any other piece that is theirs alone in a room's container).
 *  The plaque reads it to say whose a row is; the word leaves it out. Weakly held - a piece gone is a mark gone. */
let _personal = new WeakSet();
export const markPersonal = (/** @type {any} */ it) => { if (it && typeof it === 'object') _personal.add(it); return it; };
export const isPersonalLoot = (/** @type {any} */ it) => !!it && typeof it === 'object' && _personal.has(it);

/** THE SPENT RECORD, in the character's save: for each container's bonus (`name|character`), the places of it the
 *  character holds no longer. Bounded (the oldest let go past ROOM_BONUS_KEPT - a container that old has respawned). */
export const ROOM_BONUS_KEPT = 2048;
export const ROOM_BONUS_SAVE_VENDOR = 'RoomLootBonus';
/** @type {Map<string, Set<number>>} */
let _spent = new Map();
export const bonusSpent = (/** @type {string} */ key) => _spent.get(key) ?? new Set();
/** The places of `key`'s bonus no longer in the list; a place back in it (stored back) is unspent. */
export function settleBonusSpent(/** @type {string} */ key, /** @type {number[]} */ gone, /** @type {number[]} */ held = []) {
  let s = _spent.get(key);
  if (!s) { if (!gone.length) return; s = new Set(); }
  for (const i of gone) s.add(i);
  for (const i of held) s.delete(i);
  _spent.delete(key);
  if (s.size) _spent.set(key, s);
  while (_spent.size > ROOM_BONUS_KEPT) _spent.delete(/** @type {string} */ (_spent.keys().next().value));
}
/** A record off a save: `{ spent: [[key, [place, ...]], ...] }`, each bounded, the rest refused. */
export function validBonusRecord(/** @type {any} */ r) {
  /** @type {Map<string, Set<number>>} */
  const out = new Map();
  for (const row of Array.isArray(r?.spent) ? r.spent.slice(-ROOM_BONUS_KEPT) : []) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || row[0].length > 256 || !Array.isArray(row[1])) continue;
    const s = new Set(row[1].filter((i) => Number.isInteger(i) && i >= 0 && i < LOOT_LIST_MAX));
    if (s.size) out.set(row[0], s);
  }
  return out;
}
registerModSaveData(ROOM_BONUS_SAVE_VENDOR, {
  newSaveData: () => ({ spent: [] }),
  getSaveData: () => ({ spent: [..._spent].map(([k, s]) => [k, [...s]]) }),
  restoreSaveData: (r) => { _spent = validBonusRecord(r); },
});
/** Tests only. */
export function _resetRoomLootForTests() { _spent = new Map(); _personal = new WeakSet(); }
