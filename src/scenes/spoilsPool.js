// @ts-check
// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot and bounce (sort of how dropping a
// torch works) and have a sort of rarity glow attached to it"): THE SPOILS ON THE COURT'S FLOOR - one player's share of a
// fallen boss (systems/gate/gateSpoils.js rollSpoils, off the relay's receipt), spewed out of his chest piece by piece
// (world/gate/gateSpew.js - the thrown torch's own flight), each landing with the torch's own clatter, and at rest standing
// in its tier's beam (render/spoilsGlow.js) with a Rare-or-better's light and chime. Pressed, a piece goes into the
// pack (GATE-UX: no longer walked over - below); leaving the court gathers whatever is still on the floor. Design:
// bible/11-Multiplayer/World-Bosses.md section 7.
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
// the player's world as well as the seed - systems/gate/gateSpoils.js - so a re-roll is not the same spoils). AUDIT WB A7: a
// LIST of them, one a day and character - a second burst (another day, another character) before a save no longer
// wrote over the first's. Taking a piece changes nothing there: it is in the pack, and the pack is only as safe as the
// last save. At the next boot the records are asked (`recoverSpoils`): a save of a record's character written since
// its burst holds every piece - the court refuses the save and leaving it gathers the floor - and the record goes;
// else every piece is handed over again, and the record stays until a save holds them.
//
// AUDIT WBX S3/S5 (2026-09-26, Mac: "Do a comprehensive audit on everything so far"): THE RECORD CLEARS ON A SAVE, NOT ON A
// CLOCK. "A save since the burst" was read off two wall clocks (the record's `at` against the slot's realTime), so a
// clock set ahead at the burst handed the same pieces back at every boot, and one set behind dropped a record no save
// held. A record now carries an `id` (v SPOILS_RECORD_V) and is cleared when a save of its character LANDS after its
// pieces entered the pack (`saved`, told by systems/save/saveSlots.js onSlotSaved) - never by comparing clocks; an older
// build's record keeps the old rule. And the record is written BEFORE the receipt is marked spent, and the mark is no
// surer than the record: a record a full store would not hold leaves the mark in this session's memory alone, so a
// crash leaves the receipt unspent for the hub to give again rather than spent with nothing kept.
//
// AUDIT WBX S1: A SPENT RECEIPT IS SAID TO THE HUB (`onSpent` - net/online.js sendGateSpent), once its spoils are safe on
// this device (its record held, or a save holding them): the hub handed its kept copy to every hello for a week, and a
// second device, browser or private window - whose store had spent nothing - rolled the same spoils again. A receipt
// that comes again after it is spent is said spent again, so a word the hub missed is said at the next.
//
// AUDIT WB A2: A RECEIPT THAT COMES OUTSIDE ITS COURT - a fighter cast out before the kill, gone from the game, told
// by the hub's next hello - is its spoils straight into the pack (`grant`): the court's burst was the only door, and it
// never opened for them. The same once, the same record.
//
// WBX3 (2026-09-26, Mac: "Loot drops should show their sprite and have a small colored loot line that extrudes from
// the sprite itself"): EACH PIECE IS ITSELF ON THE FLOOR. WB5 dressed every piece in a treasure pile the seed chose, so
// a Rare blade and a Magic ring lay as the same heap of coins; now an item stands as its own picture - the one the pack
// shows (the host's `iconOf`, ui/textureCanvas.js's own door with the item's dye) - uploaded under the port's own
// pseudo-archive and drawn as a billboard on the floor, and its tier's line leaves the top of that picture
// (render/spoilsGlow.js). Gold keeps its pile; a picture that will not load keeps the pile too. And a resting piece is
// taken only SPOILS_TAKE_AFTER_MS after it came to rest (Swololo on Discord: "loot was not distributed, was instantly
// pillaged by others before I could ever realise boss died" - the spoils are this player's alone, and a fighter
// standing where they fell had walked over them in the second they landed).
//
// RAID4b (2026-09-28): A TOWN'S THANKS COME THROUGH THIS DOOR TOO (systems/raidSpoils.js) - a pool of their own, made
// with their own KEYS (so a town's receipts never push a boss's out of the list of those spent) and handed their own
// roll and words at the grant; the crash's door asks their record by its own key. Its "day" is the raid's
// (raidSpoilsDay - a string), and it tells the hub nothing: no `onSpent` (the hub never kept a raid's receipt).
//
// WB9f (2026-09-30, Mac: "Improve the loot drops that emit on his death and have them spread out more. The player should
// be able to inspect and pick up the ground item, not just walk over it"): THE SPOILS, SPREAD AND HANDLED. The burst
// throws each piece its own slot of a wider fan, kept on the court's floor (world/gate/gateSpew.js keepLaunch, off the
// court's `keep` the burst hands in); and a resting piece is an ACTIVATION TARGET - `spoil:<i>` for an item (a pile of
// one, so the plaque lists it with its tier and, under quick loot's stats, what it is), `spoilGold:<i>` for the gold -
// that the press takes into the pack (`pick`), the hosts' ladder naming it (`nameOf`) and the plaque reading it
// (`contentsOf`). Walking over a piece still takes it. Each piece's rest is told to the court (`frame(onRest)`), which
// throws its tier's sparks where it lands.
//
// GATE-UX (2026-10-01, Mac: "Loot at the end can still be walked over and picked up"): THE PRESS IS THE ONLY HAND. A
// piece on the floor is taken when it is pressed (`pick`) and no other way - a fighter crossing the court to the one
// they wanted swept up every piece in their path, unlooked at. WBX3's wait after a piece came to rest (SPOILS_TAKE_AFTER_MS)
// and the walk-over's reach (SPOILS_TAKE_M) went with it; leaving the court still gathers what is left (`gather`).
//
// LOST-SPOILS (2026-10-22, the owner: "I want to utilize the mailbox as a way to obtain lost items/loot if not picked up
// from a boss"; asked, "Mail the leftovers"): WHAT IS LEFT ON THE FLOOR GOES TO THE MAILBOX. Leaving gathered every piece
// still on the floor into the pack; now, where the host hands a `mail` (net/lostSpoils.js lostSpoilsMail) and its box is
// known to take post, each ITEM still there is owed to the Lost and Found instead (net/lostLaw.js) - claimed from the
// mailbox beside the hourglass, into whichever online character is played - and the gold still goes to the purse. The
// hand-off is ONE WRITE of the spew's crash record: its `pieces` become the ones the pack holds and the rest its `mail`
// (`{ i, piece }`, each piece's place in the spoils as rolled - the service's once-a-piece key), so no crash between two
// writes ever hands a piece to both. The pool sends it (`mailOwed`), asks again LOST_RETRY_MS on while the answer is
// not a yes, and gives the pieces to the pack on a refusal that will never be one, or after LOST_OWED_MAX_MS; a record
// owing the mailbox outlives the save that holds its pack's part and the records' cap. And a new burst over a floor not
// yet left gathers it first: a breach's second Redoubt had thrown its spoils over the first's, whose leftovers were then
// on no floor and in no pack until the next boot handed the whole of it back, pressed pieces too.
//
// Not a DFU member. Ledger A (WB).
import { rollSpoils, nameEmbers, sigilStone } from '../systems/gate/gateSpoils.js';
import { seededRng } from '../systems/wind/wind.js';
import { spewLaunches, spewPiece, flySpew, keepLaunch, floorRayAt } from '../world/gate/gateSpew.js';
import { SpoilsGlowRenderer, tierColour } from '../render/spoilsGlow.js';   // WBX3: the loot line
import { RARITIES } from '../systems/loot/lootRarity.js';
import { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS, validLootItem } from '../systems/loot/loot.js';
import { isIliacCard, iliacCardName } from '../systems/iliac/iliacItems.js';   // AUDIT CARDS-6 A7: a boss's card taken, said by its own name
import { billboardSize } from '../world/rmbFlats.js';
import { SOUND } from '../systems/soundClips.js';
import { CLIPS } from '../systems/handheldTorches.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../player/activate.js';   // WB9f: a piece is pressed as a loot pile is
import { adoptLight } from '../render/lightId.js';   // LIGHT-ID: a piece's light named by its piece
import { LOST_OWED_MAX_MS } from '../net/lostLaw.js';   // LOST-SPOILS: how long a floor's leftovers are asked after
import { t } from '../systems/textManager.js';

/** WBX3: an item's picture stands this many metres a texel tall on the floor, and never taller than the most. */
export const SPOILS_ICON_M_PER_PX = 0.022;
export const SPOILS_ICON_MAX_M = 1.1;
/** WBX3: the port's own pseudo-archive the pieces' pictures are uploaded under (bloodArt.js's law - 38001 the blood,
 *  38101 the gate, 38111 the court). */
export const SPOILS_ICON_ARCHIVE = 38121;
/** WBX3: a picture's size on the floor, metres, from its texels - its own aspect, the most on its longer side. Pure. */
export function iconSize(width, height) {
  const k = Math.min(SPOILS_ICON_M_PER_PX, SPOILS_ICON_MAX_M / Math.max(1, width, height));
  return { w: Math.max(1, width) * k, h: Math.max(1, height) * k };
}
/** WB9f: THE PRESS - the keys a resting piece is pressed by (an item's is itemised: the plaque lists it), and the
 *  half-width of its box about where it rests and the least height of it (a flat coin pile is still a thing to aim at).
 *  It is won at the ray's reach and taken at DFU's TreasureActivationDistance - the loot piles' own
 *  (dungeonContext.js lootTargets): too far, and the ladder says so. */
export const SPOIL_KEY = 'spoil:';
export const SPOIL_GOLD_KEY = 'spoilGold:';
export const SPOIL_BOX_HALF_M = 0.45;
export const SPOIL_BOX_MIN_H = 0.5;
/** The glow rises over this long once a piece rests. */
export const SPOILS_RISE_MS = 400;
/** A Rare-or-better resting piece's light: its reach and its strength. */
export const SPOILS_LIGHT = Object.freeze({ range: 5, k: 1.3, up: 0.6 });
/** The device's record of spoils no save holds yet, and of the last day whose spoils left him. */
export const SPOILS_STORE_KEY = 'wb5.spoils';
export const SPOILS_DAY_KEY = 'wb5.spoilsDay';
/** RAID4b: the two as a pool is made with them - a boss's; a town's thanks keep their own (raidSpoils.js). */
export const SPOILS_KEYS = Object.freeze({ store: SPOILS_STORE_KEY, day: SPOILS_DAY_KEY });
/** The Sigil Stone glows as the rarest thing there is. */
export const SIGIL_TIER = 'artifact';

/** The words. */
export const SPOILS_TEXT = Object.freeze({
  gold: (n) => `You take ${n} gold pieces.`,
  item: (name, tier) => (tier && tier !== 'common' ? `You take ${name} (${RARITIES[tier]?.label ?? tier}).` : `You take ${name}.`),
  gathered: 'The spoils of the Burning Court are in your pack.',
  goldName: (n) => `${n} Gold Pieces`,   // WB9f: the pile's name on the plaque
  granted: 'Your share of the Burning Court\'s spoils is in your pack.',   // AUDIT WB A2: a receipt that came outside its court
  rite: 'An ember from the broken rite is in your pack.',   // WB12d: a receipt of the rite alone
});

/**
 * One player's spoils as the floor holds them - in the order they leave him: the three graded pieces (the Rare-or-better
 * first), the Sigil Stone, then the gold. Each carries its tier (the glow's) and the treasure flat the seed dresses it in.
 * WB12d: `claims`, the receipt's - the faithful's rite alone (`x` 'rite') pays its ember and nothing else; the rite
 * broken too (`r`) an ember more, after the first. A receipt with neither is what it always was, piece for piece.
 * Pure.
 * WB14g: a portent night's (`p`) one more piece for each portent, its picture drawn after every other's.
 * @param {number} seed @param {number} level @param {{ x?: string, r?: number, p?: number }|null} [claims]
 */
export function spoilsList(seed, level, claims = null) {
  const look = seededRng((seed ^ 0x5eed) >>> 0);
  const flat = () => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
  if (claims?.x === 'rite') return [{ kind: 'item', item: sigilStone(), tier: SIGIL_TIER, record: flat() }];
  const s = rollSpoils(seed, level, claims?.p ?? 0);   // WB14g: a portent night's pieces more
  // AUDIT WORLD-REWARDS A1: the Dragonfire Oath's picture is drawn LAST of all (below) - drawn in its place among the pieces,
  // it moved every picture after it (the ember's, the gold's, the card's, the gems') off what the seed gave them, in
  // every spoils it came in. It still leaves among the pieces, its glow's line in the frame's first eight.
  const firstPortent = s.pieces.length - (s.portent ?? 0);   // WB14g: a portent's piece's picture drawn last too, as the Oath's
  const pieces = s.pieces.map((p, i) => ({ kind: 'item', item: p.item, tier: p.tier, record: p.tier === 'gilded' || i >= firstPortent ? null : flat() }));
  const ember = { kind: 'item', item: s.sigil, tier: SIGIL_TIER, record: flat() };
  const gold = { kind: 'gold', gold: s.gold, tier: 'common', record: flat() };
  // AUDIT CARDS-6 A8: the card's picture is drawn LAST, after the gold's - drawn between the ember's and the gold's, it
  // moved the gold pile's picture off what the seed gave it before CARDS9, in every hoard the card came in
  const card = s.card ? [{ kind: 'item', item: s.card, tier: 'aetheric', record: flat() }] : [];
  // GEM2 (bible/06-Systems/Gem-Sockets.md section 4): the Warden's gem, its picture drawn after the card's - so every
  // picture before it is what the seed gave it - and thrown after the card
  const gems = (s.gems ?? []).map((g) => ({ kind: 'item', item: g, tier: 'common', record: flat() }));
  for (const p of pieces) if (p.record === null) p.record = flat();   // AUDIT WORLD-REWARDS A1: the Oath's, last
  return [
    ...pieces,
    ...card,   // CARDS9: the Warden's card, after the pieces
    ...gems,   // GEM2: the Warden's gem, after the card
    ember,
    ...(claims?.r === 1 ? [{ ...ember, item: sigilStone() }] : []),
    gold,
  ];
}

/** A device store (the app's own - systems/appStorage.js, a Storage's getItem/setItem/removeItem) as the pool's JSON
 *  record store; a store that throws or answers junk is a record never kept. AUDIT WB A6: a write the storage refuses
 *  (a full quota, a private window) is kept in this session's memory instead and read back from there - the session
 *  still knows its spent receipts and its records, and a later write that lands takes over. */
/** AUDIT WBX S4: the spoils given outside a court, one tab at a time - two tabs of one account on one device each checked
 *  the store before the other had written it, and both gave them (the Web Locks API; without it, at once). One lock for
 *  every pool's grant: the gate's, the raids', the serpent's, the Hour's, the stars' (STAR7 moved it here from the world
 *  host, so each pool's host takes the same one). */
export const spoilsLock = (fn) => { const locks = globalThis.navigator?.locks; return locks?.request ? locks.request('wb5.spoils', () => fn()) : Promise.resolve().then(fn); };

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
    /** AUDIT WBX S5: a value kept in this session's memory alone (never the device's), and whether the last write of a
     *  key landed on the device. */
    hold(k, v) { mem.set(k, JSON.parse(JSON.stringify(v ?? null))); },
    persisted: (k) => !mem.has(k),
    remove(k) { mem.delete(k); try { storage?.removeItem?.(k); } catch { /* nothing to lose */ } },
  };
}
const NONE = Object.freeze([]);
/** AUDIT WBX S3: the record's version - an `id`, cleared by a save of its character (`saved`), never by a clock. */
export const SPOILS_RECORD_V = 2;
/** AUDIT WBX S2: the level the spoils are rolled at - the player's, never past the level the fight admitted the
 *  receipt's account at (its `l`: a level-1 claim's receipt carried to a level-50 character rolls at 1). Pure. */
export const spoilsLevel = (playerLevel, claimLevel) => Math.max(1, Math.min(Math.max(1, playerLevel | 0), Number.isSafeInteger(claimLevel) && claimLevel >= 1 ? claimLevel : Infinity));
/** AUDIT WB A7: the most crash records the device keeps (one a day and character), and spent receipts it remembers. */
export const SPOILS_RECORDS_MAX = 8;
export const SPOILS_SPENT_MAX = 32;
/** AUDIT SD II (L5 F4): how often a host says again the spent words a pool still owes the hub (`resendSpent`), ms. */
export const SPOILS_SPENT_RESEND_MS = 5000;
/** A spent receipt's key: its day and account (AUDIT WB A9). */
export const spentKey = (day, acct) => `${day}:${acct ?? ''}`;
/** LOST-SPOILS: how long after a send that did not land the pool asks again - twice as long after each round that landed
 *  nothing, to LOST_RETRY_MAX_MS (a kill the service never records is asked a few hundred times in its window, not tens
 *  of thousands) - and how long after it is made it first asks for what an earlier sitting left owed (the box's first
 *  look rides the heartbeat before it). */
export const LOST_RETRY_MS = 30_000;
export const LOST_RETRY_MAX_MS = 30 * 60_000;
export const LOST_FIRST_MS = 20_000;
/** LOST-SPOILS: the words - what was left went to the mailbox, or could not and is in the pack. */
export const LOST_TEXT = Object.freeze({
  mailed: () => t('spoils.lost.mailed', 'What you left on the floor will wait for you in your mailbox, beside the hourglass in the pause menu.'),
  back: () => t('spoils.lost.back', 'What you left on the floor could not be sent to your mailbox, so it is in your pack.'),
});
/** LOST-SPOILS: a record's pieces owed to the mailbox - `{ i, piece }`, an item's - or none. */
export const mailOf = (r) => (Array.isArray(r?.mail) ? r.mail.filter((m) => m && Number.isSafeInteger(m.i) && m.piece?.kind === 'item') : []);
/** The records as a list - an older build's single record is a list of one. */
const recordsOf = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);

/** Whether a save of the character `who` was written after `at` (wall-clock ms, as the slots' realTime) - its pack holds
 *  every piece of a burst before it. `saves` the slots' SaveInfos (systems/save/saveSlots.js enumerateSaves). */
export const savedSince = (saves, who, at) => who != null && [...(saves ?? [])].some((i) => i?.characterId === who && (i.dateAndTime?.realTime ?? 0) > at);

/** A piece off the record as the pack may take it, or null: gold a whole positive sum, an item one the port's own loot
 *  validator admits (systems/loot/loot.js validLootItem - a template it knows, every declared field its kind). */
function keptPiece(p) {
  if (p?.kind === 'gold') return Number.isSafeInteger(p.gold) && p.gold > 0 ? { ...p } : null;
  const item = p?.kind === 'item' ? validLootItem(p.item) : null;
  if (item) nameEmbers([item]);   // WB12a: a stone a crash record kept under its old name lands as a Deadlands Ember
  return item ? { ...p, item } : null;
}

/**
 * THE CRASH'S DOOR, at boot: a record whose pieces no save of its character holds is handed over whole, and kept until
 * one does; a save since the burst holds them, and the record is cleared; another character's record waits for them.
 * Answers how many pieces it handed over.
 * @param {{ get: (k: string) => any, remove: (k: string) => void, set?: (k: string, v: any) => void }} store @param {(piece: any) => void} take
 * @param {{ who?: string|null, saves?: Iterable<any>, onHanded?: ((rec: any) => void)|null, key?: string, inSave?: readonly string[]|null }} [opts] this character's id,
 *   the save slots' infos, who is told of each record of this build handed over (the pool's `adopt` - its next save
 *   clears it), (RAID4b) the key the records are kept under - a boss's by default - and (AUDIT RESCUE-SAVE A1) the
 *   records the loaded save's pack already holds: a realm save the device kept (systems/realmSaves.js openRealmBoot
 *   `held`) was composed holding them, so they are adopted and never handed again; the next save that lands clears them
 */
export function recoverSpoils(store, take, { who = null, saves = [], onHanded = null, key = SPOILS_STORE_KEY, inSave = null } = {}) {
  let v = null;
  try { v = store.get(key); } catch { v = null; }
  if (!v) return 0;
  const infos = [...(saves ?? [])];
  const all = recordsOf(v), left = [];
  let n = 0;
  for (const rec of all) {
    if (!rec || typeof rec !== 'object' || !Array.isArray(rec.pieces) || !Number.isFinite(rec.at)) continue;   // junk is no record
    if (rec.who != null && rec.who !== who) { left.push(rec); continue; }   // another character's waits for them
    // AUDIT WBX S3: a record of this build is cleared by the save that holds it (the pool's `saved`) - never by a clock;
    // an older build's keeps the old rule, the slots' realTime against its own
    if (rec.v !== SPOILS_RECORD_V && savedSince(infos, rec.who ?? who, rec.at)) continue;   // a save since holds them: it goes
    // AUDIT RESCUE-SAVE A1: the loaded save already holds them - adopted, so the save that lands clears the record
    if (rec.v === SPOILS_RECORD_V && inSave?.includes(rec.id)) { left.push(rec); onHanded?.(rec); continue; }
    for (const p of rec.pieces) { const q = keptPiece(p); if (q) { take(q); n++; } }
    left.push(rec);   // and it stays until a save does
    if (rec.v === SPOILS_RECORD_V) onHanded?.(rec);   // in the pack now: the next save of its character clears it
  }
  if (left.length !== all.length || !Array.isArray(v)) {
    try { if (left.length) store.set?.(key, left); else store.remove(key); } catch { /* the pack has them either way */ }
  }
  return n;
}

/**
 * @param {{
 *   renderer?: any, gl?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null, audio?: any,
 *   ray: (from: number[], dir: number[], len: number) => ({dist: number, normal?: number[]}|null),
 *   now: () => number,
 *   take: (piece: any) => void, say?: (text: string) => void,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void, remove: (k: string) => void, hold?: (k: string, v: any) => void, persisted?: (k: string) => boolean }|null,
 *   who?: () => string|null, wall?: () => number,
 *   iconOf?: ((item: any) => Promise<{key: string, width: number, height: number, colors: ArrayLike<number>}|null>)|null,
 *   onSpent?: (day: number|string) => (boolean|void), keys?: { store: string, day: string }, recordsMax?: number, itemName?: ((item: any) => string)|null,
 *   me?: () => (string|null),
 *   gathered?: string,
 *   mail?: { ready: () => boolean, send: (o: { day: any, pieces: Array<{ i: number, item: any }> }) => Promise<'ok'|'refused'|'later'>, sent?: () => void, say?: (text: string) => void } | null,
 *   later?: (fn: () => void, ms: number) => any,
 * }} deps
 *   AUDIT WBX S1: `onSpent` is told each day whose receipt is spent here and safe (its record on the device, or a save
 *   holding its pieces) - and again whenever a spent one is offered - so the hub forgets its kept copy.
 *   AUDIT SD II (L5 F4): it answers false when the word did not go - kept on the device as owed, and said again by
 *   `resendSpent` until it goes.
 *   WBX3: `iconOf` answers an item's own picture - the pack's (color32 order, and a `key` naming the picture: two pieces
 *   that look alike share one upload) - or null when it has none; without it every piece keeps its treasure pile.
 *   RAID4b: `keys` the device keys its records and its spent receipts go under (SPOILS_KEYS, a boss's, by default).
 *   AUDIT RAID R8a: `recordsMax` the crash records it keeps (SPOILS_RECORDS_MAX - a boss's one a day; a town's thanks
 *   come many a session, and a ninth unsaved pushed the first's pieces out of the crash's reach).
 *   WB9f: `itemName` an item's word on the plaque (the host's - systems/worldTooltips.js lootPileName, the loot piles'
 *   own), when a resting piece is under the crosshair.
 *   SD9e: `gathered` the words leaving says when it gathers what is still on the floor (the Burning Court's by default;
 *   the Brass Remnant's arena says its own - systems/superDungeon/sdSpoils.js).
 *   AUDIT SD II (L5 F4): `me` the account the hub's link speaks for now (the signed-in session's - the token's subject),
 *   or null when unknown: a spent word is said only on its own account's socket (AUDIT WBX2 M6's law - said on another's,
 *   the hub forgot that account's copy of a receipt it never had the spoils of), and owed until it can be.
 *   LOST-SPOILS: `mail` the Lost and Found's door (net/lostSpoils.js lostSpoilsMail): `ready` whether its box takes post
 *   now, `send` a record's owed pieces (answering 'ok', 'refused' - never a yes - or 'later'), `sent` told when some
 *   landed, `say` where its words go (the chat). Without it, leaving gathers everything into the pack, as it always did.
 *   `later` the timer the sends are asked again on (setTimeout's shape).
 */
export function createSpoilsPool({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  ray, now, take, say = () => {}, store = null, who = () => null, wall = () => Date.now(), iconOf = null, gathered = SPOILS_TEXT.gathered,
  onSpent = () => {}, keys = SPOILS_KEYS, recordsMax = SPOILS_RECORDS_MAX, itemName = (item) => item?.name ?? 'Something',
  me = () => null, mail = null, later = (fn, ms) => globalThis.setTimeout?.(fn, ms),
}) {
  const STORE_KEY = keys.store, DAY_KEY = keys.day;   // RAID4b: a town's thanks keep their own
  let glow = null;
  try { if (gl) glow = new SpoilsGlowRenderer(gl); } catch (e) { console.warn('[gate] the spoils\' glow would not build', e?.message ?? e); glow = null; }
  /** the spew under way: its day, when it began, where it left from; each piece's flight, rest and batch */
  let rec = null, t0 = 0, from = null, launches = [];
  /** AUDIT WB9 (spoils F1): what the pieces fly over - the world's ray, and under a kept throw the floor it was kept to
   *  besides: the collider takes no hit nearer than a tenth of a millimetre (player/collider.js rayTriangle), so a step
   *  begun that close above the floor missed it and the next began under it - about one kill in fifty let a piece fall
   *  through the court, where keepLaunch had flown it to a rest over the plane */
  let flyRay = ray;
  /** WBX3: `sprite` the piece's own picture once it has loaded ({record, w, h} under SPOILS_ICON_ARCHIVE), 'none' when it
   *  has none (gold, a picture that would not load) - then the treasure pile stands; `batchIcon` what its batch wears.
   *  WB9f: `target` its activation target, made at its rest.
   *  @type {Array<{ piece: any, fly: any, left: boolean, restAt: number, taken: boolean, batch: any, sprite: any, batchIcon: boolean, h: number, target: any }>} */
  let floor = [];
  let lastT = 0, tex = null, texLoading = null;
  /** WB9f: the resting pieces' activation targets (AUDIT WB D10: one list, refilled; each piece's target made once, at
   *  its rest - a resting piece never moves) */
  const _targets = [];

  const keep = (k, v) => { try { store?.set(k, v); } catch { /* the floor still holds them */ } };
  const read = (k) => { try { return store?.get(k) ?? null; } catch { return null; } };
  /** AUDIT WBX S3: the records whose pieces are in the pack (id -> {who, day}) - the next save of their character holds
   *  them - and the days to say spent to the hub once a save has (their record would not land on the device) */
  const held = new Map();
  const ackOnSave = new Map();
  /** the record of the spew under way, until its last piece is in the pack */
  let spewId = null;
  // AUDIT SD II (L5 F4): THE SPENT WORD OWED. `onSpent` answers false when nothing went (the hub's link between sockets,
  // its bucket spent) - and the word was said again only if the hub handed this same device the receipt: past the hold,
  // another device or browser of the account was handed it, and its empty store granted the same spoils. A word that did
  // not go is kept on the device (its pool's own key) with its account, and said again by `resendSpent` until it goes -
  // on its own account's socket alone (`me`).
  const OWED_KEY = `${DAY_KEY}.owed`;
  const owedWords = () => { const v = read(OWED_KEY); return Array.isArray(v) ? v.filter((o) => o && typeof o === 'object' && o.d != null) : []; };
  const meNow = () => { try { return me() ?? null; } catch { return null; } };
  /** Whether the hub's link may say `acct`'s word now - its own socket, or an account unknown (an older record's). */
  const mine = (acct) => { const m = meNow(); return !acct || m == null || m === acct; };
  const said = (day, acct = '') => {
    let went = false;
    if (mine(acct)) { try { went = onSpent(day) !== false; } catch { went = false; } }
    if (!went) { const o = owedWords(); if (!o.some((w) => w.d === day && w.a === acct)) keep(OWED_KEY, [...o, { d: day, a: acct }].slice(-SPOILS_SPENT_MAX)); }
  };
  /** the receipts spent this session - the device's word may be lost (no store), this one is not */
  const spentHere = new Set();
  /** Whether the spoils of `day` for `acct` have left him already - this session's word, or the device's (an older
   *  build's single day spent for anyone). */
  function spentOn(day, acct) {
    if (spentHere.has(spentKey(day, acct))) return true;
    const kept = read(DAY_KEY);
    return kept === day || (Array.isArray(kept) && (kept.includes(spentKey(day, acct)) || kept.includes(spentKey(day, '*'))));
  }
  /** AUDIT WBX2 M6: whether THIS account spent them - the only spend the hub is told of again. An older build's mark
   *  for anyone refuses the spoils here as it did, but said to the hub it made another account forget a receipt it never
   *  had the spoils of, on every device. */
  function spentBy(day, acct) {
    if (spentHere.has(spentKey(day, acct))) return true;
    const kept = read(DAY_KEY);
    return Array.isArray(kept) && kept.includes(spentKey(day, acct));
  }
  /** LOST-SPOILS: the records past the most this pool keeps go, the oldest first - but a record still owing the mailbox is
   *  neither counted nor let go (it goes when its pieces are sent, or given to the pack), so it never takes a crash's
   *  record's place. */
  function trimRecords(list) {
    let over = list.filter((r) => !mailOf(r).length).length - recordsMax;
    return over <= 0 ? list : list.filter((r) => mailOf(r).length > 0 || over-- <= 0);
  }
  /** LOST-SPOILS: one record rewritten where it stands - `fn` answers it as it is to be, or null to let it go. Answers the
   *  record as it was, or null when there is none of that id. */
  function rewrite(id, fn) {
    const all = recordsOf(read(STORE_KEY));
    let was = null;
    const out = [];
    for (const r of all) {
      if (r?.id !== id || was) { out.push(r); continue; }
      was = r;
      const next = fn(r);
      if (next) out.push(next);
    }
    if (!was) return null;
    if (out.length) keep(STORE_KEY, out); else { try { store?.remove(STORE_KEY); } catch { /* nothing to lose */ } }
    return was;
  }
  /** The receipt spent, here and on the device, and its pieces kept as rolled until a save holds them. AUDIT WBX S5: the
   *  record FIRST, and the device's mark no surer than it; AUDIT WBX S1: the hub told once it is safe. Answers the
   *  record's id. */
  function spend(day, acct, list, owner = who()) {
    spentHere.add(spentKey(day, acct));
    const w = owner, at = wall();
    const id = `${day}:${w ?? ''}:${at}`;
    const recs = recordsOf(read(STORE_KEY)).filter((r) => r && !(r.day === day && r.who === w));
    keep(STORE_KEY, trimRecords([...recs, { v: SPOILS_RECORD_V, id, day, at, who: w, pieces: list }]));
    const durable = store?.persisted?.(STORE_KEY) ?? true;
    const kept = read(DAY_KEY);
    const marks = [...(Array.isArray(kept) ? kept : Number.isSafeInteger(kept) ? [spentKey(kept, '*')] : []), spentKey(day, acct)].slice(-SPOILS_SPENT_MAX);
    if (durable) { keep(DAY_KEY, marks); said(day, acct); }
    else { try { store?.hold?.(DAY_KEY, marks); } catch { /* the session's own set holds it */ } ackOnSave.set(id, { day, acct }); }
    return id;
  }

  function loadTex() {
    if (tex || texLoading || !getTexture) return;
    texLoading = Promise.resolve().then(() => getTexture(RANDOM_TREASURE_ARCHIVE)).then((t) => { tex = t ?? null; }, () => { tex = null; });
  }
  /** WBX3: an item's own picture, asked for once at the burst - uploaded under the pool's pseudo-archive (the upload is
   *  keyed by the picture, so two pieces alike share it); a piece with no picture, or one that will not load, keeps its
   *  treasure pile. A picture that lands while the pile stands swaps it on the next frame. */
  function askSprite(f) {
    if (f.sprite || f.piece.kind !== 'item' || !iconOf || !renderer?.uploadTexture) { f.sprite ??= 'none'; return; }
    f.sprite = 'asked';
    Promise.resolve().then(() => iconOf(f.piece.item)).then((img) => {
      if (!img?.colors || !(img.width > 0) || !(img.height > 0)) { f.sprite = 'none'; return; }
      const record = `icon:${img.key ?? floor.indexOf(f)}`;
      renderer.uploadTexture(SPOILS_ICON_ARCHIVE, record, img);
      f.sprite = { record, ...iconSize(img.width, img.height) };
    }, () => { f.sprite = 'none'; });
  }
  function batchOf(f) {
    const icon = f.sprite && typeof f.sprite === 'object';
    if (f.batch && !icon === !f.batchIcon) return f.batch;
    if (f.batch) { renderer?.destroyBillboardBatch?.(f.batch); f.batch = null; }   // the pile gives way to the picture
    if (!renderer?.createBillboardBatch) return null;
    try {
      if (icon) {
        f.batch = renderer.createBillboardBatch(SPOILS_ICON_ARCHIVE, f.sprite.record, { w: f.sprite.w, h: f.sprite.h }, [[0, 0, 0]]);
        f.h = f.sprite.h;
      } else {
        if (!tex) return null;
        if (!renderer.textures?.has?.(`${RANDOM_TREASURE_ARCHIVE}_${f.piece.record}#0`)) uploadRecordFrame?.(RANDOM_TREASURE_ARCHIVE, f.piece.record, 0);
        const size = billboardSize(tex, f.piece.record);
        f.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, f.piece.record, size, [[0, 0, 0]]);
        f.batch.frame = 0;
        f.h = size.h;
      }
      f.batchIcon = icon;
      f.batch.origin = [...f.fly.pos];
    } catch { f.batch = null; }
    return f.batch;
  }
  function takeOne(f) {
    if (f.taken) return;
    f.taken = true;
    take(f.piece);
    // AUDIT CARDS-6 A7: a card by its catalog's name ("Card: Valkynaz Ruhn" - iliacItems.js iliacCardName, the plaque's
    // and the pack's); its stored name is the template's, and the floor said "You take Card (Aetheric)."
    const name = (/** @type {any} */ item) => (isIliacCard(item) ? iliacCardName(item) : item.name);
    say(f.piece.kind === 'gold' ? SPOILS_TEXT.gold(f.piece.gold) : SPOILS_TEXT.item(name(f.piece.item), f.piece.tier));
    if (f.batch) { renderer?.destroyBillboardBatch?.(f.batch); f.batch = null; }
    if (spewId && floor.every((g) => g.taken)) { held.set(spewId, { who: who(), day: rec?.day }); spewId = null; }   // AUDIT WBX S3: all of it in the pack
  }

  // ── LOST-SPOILS: the floor's leftovers owed to the mailbox ────────────────
  /** the records whose send is out, and the timer the sends are asked again on */
  const sending = new Set();
  let retryTimer = null, idleRounds = 0;
  const sayMail = (/** @type {string} */ text) => { try { (mail?.say ?? say)(text); } catch { /* a word is not the spoils' problem */ } };
  const retryMail = (ms = LOST_RETRY_MS) => {
    if (!mail || retryTimer) return;
    try { retryTimer = later(() => { retryTimer = null; sendMail().catch(() => {}); }, ms) ?? null; } catch { retryTimer = null; }
  };
  /** THE FLOOR'S ITEMS LEFT, OWED TO THE MAILBOX in one write of the spew's record (its `pieces` the pack's part, the rest
   *  its `mail`) and off the floor, never into the pack. None - the pack takes them, as ever - with no `mail`, a box not
   *  known to take post (a guest, signed out, not yet looked at), another account's spoils, or a record this device
   *  could not keep. Answers the floor's pieces owed. */
  function owedToMail(left) {
    const items = left.filter((f) => f.piece.kind === 'item');
    if (!mail || !spewId || !rec || !items.length) return [];
    let ready = false;
    try { ready = mail.ready() && mine(rec.acct); } catch { ready = false; }
    // and only onto a record the device holds: one kept in this sitting's memory alone (a full quota, a private window)
    // dies with the tab, and its receipt is given again (AUDIT WBX S5) - so its floor goes to the pack, as ever
    if (!ready || store?.persisted?.(STORE_KEY) === false) return [];
    const at = new Map(items.map((f) => [floor.indexOf(f), f]));
    const acct = rec.acct ?? '';
    const kept = rewrite(spewId, (r) => ({ ...r, acct, pieces: (r.pieces ?? []).filter((/** @type {any} */ _p, /** @type {number} */ i) => !at.has(i)), mail: [...mailOf(r), ...[...at].map(([i, f]) => ({ i, piece: f.piece }))], mailAt: wall() }));
    if (!kept) return [];
    for (const f of items) { f.taken = true; if (f.batch) { renderer?.destroyBillboardBatch?.(f.batch); f.batch = null; } }
    return items;
  }
  /** A send landed: those pieces are the post's. The record goes once it owes nothing more - its pack's part held by a
   *  save, or none - else it waits for that save, as any record does. */
  function mailLanded(id, sent) {
    const gone = new Set(sent.map((/** @type {any} */ x) => x.i));
    rewrite(id, (r) => {
      const owed = mailOf(r).filter((x) => !gone.has(x.i));
      if (owed.length) return { ...r, mail: owed };
      const { mail: _mail, mailAt: _at, ...rest } = r;
      return rest.pieces?.length ? rest : null;
    });
    try { mail?.sent?.(); } catch { /* the box looks again on its own clock */ }
  }
  /** THE MAILBOX WILL NOT TAKE THEM: the pieces into the pack after all - its record's pack part first (one write, so a crash
   *  hands them from there), then the pack, held for the next save. Another character's wait for it to stand up. */
  function mailBack(id) {
    const r0 = recordsOf(read(STORE_KEY)).find((r) => r?.id === id);
    if (!r0 || (r0.who != null && r0.who !== who())) return false;
    const back = mailOf(r0);
    rewrite(id, (r) => { const { mail: _mail, mailAt: _at, ...rest } = r; return { ...rest, pieces: [...(rest.pieces ?? []), ...back.map((x) => x.piece)] }; });
    for (const x of back) { const q = keptPiece(x.piece); if (q) take(q); }
    held.set(id, { who: who(), day: r0.day });
    sayMail(LOST_TEXT.back());
    return true;
  }
  /** WHAT IS OWED TO THE MAILBOX, SENT - each record's pieces in one send, on its own account's session alone. A yes lets
   *  them go; a refusal that will never be one, or LOST_OWED_MAX_MS of asking, gives them to the pack; anything else is
   *  asked again LOST_RETRY_MS on. Answers how many records still owe. */
  async function sendMail() {
    if (!mail) return 0;
    let owing = 0, landed = 0;
    for (const r of recordsOf(read(STORE_KEY))) {
      const owed = mailOf(r);
      if (!owed.length) continue;
      if (sending.has(r.id)) { owing++; continue; }
      const late = !(wall() - (Number(r.mailAt) || 0) < LOST_OWED_MAX_MS);
      /** @type {'ok'|'refused'|'later'} */
      let word = 'refused';
      if (!late) {
        if (!mine(r.acct)) { owing++; continue; }
        sending.add(r.id);
        try { word = await mail.send({ day: r.day, pieces: owed.map((x) => ({ i: x.i, item: x.piece.item })) }); } catch { word = 'later'; } finally { sending.delete(r.id); }
      }
      if (word === 'ok') { mailLanded(r.id, owed); landed++; continue; }
      if (word === 'refused' && mailBack(r.id)) continue;
      owing++;
    }
    if (landed) idleRounds = 0; else if (owing) idleRounds++;   // a round that owed nothing is no round
    if (owing) retryMail(Math.min(LOST_RETRY_MAX_MS, LOST_RETRY_MS * 2 ** Math.max(0, idleRounds - 1)));
    return owing;
  }
  /** Out of the court: whatever is still on its floor (or in the air) goes into the pack - the record stands until a save
   *  holds them. LOST-SPOILS: its items to the mailbox instead, where it takes post. */
  function gatherFloor() {
    const left = floor.filter((f) => !f.taken);
    const mailed = owedToMail(left);
    floor.forEach((f) => takeOne(f));
    if (spewId) { held.set(spewId, { who: who(), day: rec?.day }); spewId = null; }   // AUDIT WBX S3: all of it in the pack now
    rec = null; floor = []; launches = [];
    if (left.length > mailed.length) say(gathered);   // SD9e: the pool's own words
    if (mailed.length) { sayMail(LOST_TEXT.mailed()); sendMail().catch(() => {}); }
    return left.length;
  }
  if (mail) retryMail(LOST_FIRST_MS);   // what an earlier sitting left owed

  /** WB9f: the floor's piece a key names - resting, not yet taken - or null. */
  function pieceAt(key) {
    if (typeof key !== 'string' || !floor.length) return null;
    const gold = key.startsWith(SPOIL_GOLD_KEY);
    if (!gold && !key.startsWith(SPOIL_KEY)) return null;
    const i = Number(key.slice(gold ? SPOIL_GOLD_KEY.length : SPOIL_KEY.length));
    const f = Number.isInteger(i) ? floor[i] : null;
    if (!f || f.taken || !f.fly.rest || (f.piece.kind === 'gold') !== gold) return null;
    return f;
  }

  return {
    /** WB14e: a piece straight into the pack by this pool's own door (`take`, the host's takeGateSpoil) - a Tithe-Imp's
     *  tithe, which never lies on the floor. */
    take(piece) { take(piece); },
    /**
     * THE BURST: the spoils of `day` for this player (the receipt's `seed`, the player's `level`) leave his chest `at`
     * (the dungeon's frame) toward `bearing` (the angle from him to the player). Once a day, on this device: a day
     * already spent is nothing. The pieces as rolled go into the device's record the moment they leave him.
     * WB9f: `keep` the court's floor they must come to rest on (`{ centre, r, floorY }` - world/gate/gateSpew.js keepLaunch).
     * SD9e: `roll` answers the pieces instead, as the grant's does (the Brass Remnant's - systems/superDungeon/sdSpoils.js sdSpoilsList).
     */
    /** AUDIT SD II (L5 F4): the spent words still owed said again (the host's, while its hub link stands) - each on its
     *  own account's socket alone, the rest kept - answers how many are owed still. */
    resendSpent() {
      const list = owedWords();
      if (!list.length) return 0;
      const left = list.filter((w) => { if (!mine(w.a)) return true; try { return onSpent(w.d) === false; } catch { return true; } });
      if (left.length !== list.length) { if (left.length) keep(OWED_KEY, left); else { try { store?.remove(OWED_KEY); } catch { /* nothing owed */ } } }
      return left.length;
    },
    spew({ day, seed, level, at, bearing, acct = '', keep = null, claims = null, roll = null }) {
      if (spentOn(day, acct)) { if (spentBy(day, acct)) said(day, acct); return false; }   // AUDIT WBX S1: spent - said so again, for a hub that missed it
      if (rec) gatherFloor();   // LOST-SPOILS: a floor not yet left goes where leaving sends it - never under this one
      rec = { day, acct };
      t0 = now(); lastT = t0; from = [...at];
      const list = typeof roll === 'function' ? roll() : spoilsList(seed >>> 0, Math.max(1, level | 0), claims);   // WB12d: the receipt's rite; SD9e: or a pool's own roll (the Brass Remnant's)
      launches = spewLaunches(seededRng(((seed >>> 0) ^ 0x5a5a) >>> 0), list.length, bearing);
      if (keep) launches = launches.map((l) => keepLaunch(from, l, keep));   // WB9f: every piece rests on the court's floor
      const plane = keep && Number.isFinite(keep.floorY) ? floorRayAt(keep.floorY) : null;
      flyRay = plane ? (a, d, l) => ray?.(a, d, l) ?? plane(a, d, l) : ray;   // AUDIT WB9 (spoils F1): flown over the floor they were kept to
      floor = list.map((piece, i) => ({ piece, fly: spewPiece(from, launches[i]), left: false, restAt: 0, taken: false, batch: null, sprite: null, batchIcon: false, h: 0, target: null }));
      spewId = spend(day, acct, list);
      loadTex();
      for (const f of floor) askSprite(f);   // WBX3: each item's own picture, asked for while the first pieces are still in the air
      return true;
    },
    /** AUDIT WB A2: THE SPOILS WITH NO FLOOR - a receipt that came while its court was not this player's to stand in
     *  (cast out before the kill, gone, told by the hub's next hello): the same pieces, straight into the pack, said
     *  once. Once a receipt, as the burst is; answers whether they were given. RAID4b: `roll` answers the pieces instead
     *  (a town's thanks - raidSpoils.js raidSpoilsList), asked only for a receipt not yet spent, and `text` is said.
     *  @param {{ day: any, seed?: number, level?: number, acct?: string, roll?: (() => any[]) | null, text?: string, owner?: any, kept?: string | null, claims?: any }} o */
    grant({ day, seed, level, acct = '', roll = null, text = SPOILS_TEXT.granted, owner = undefined, kept = null, claims = null }) {
      if (spentOn(day, acct)) { if (spentBy(day, acct)) said(day, acct); return false; }   // AUDIT WBX S1: spent - said so again
      const list = typeof roll === 'function' ? roll() : spoilsList(seed >>> 0, Math.max(1, level | 0), claims);   // RAID4b: a town's thanks roll their own; WB12d: the receipt's rite
      // AUDIT RAID R4: ANOTHER CHARACTER'S - the one that fought for them, when another stands here: kept on the device
      // as a crash's record is (never in this pack), and the crash's door hands them over when that character stands up
      if (owner !== undefined && owner !== who()) { spend(day, acct, list, owner); if (kept) say(kept); return true; }
      const id = spend(day, acct, list);
      for (const piece of list) take(piece);
      held.set(id, { who: who(), day });   // AUDIT WBX S3: in the pack - the next save holds them
      say(text);
      return true;
    },
    /** AUDIT ONLINE2 F3 (AUDIT RAID R8d): A SAVE WAS LOADED for `whoLoaded` (systems/save/saveSlots.js onSlotLoaded): the pack
     *  is that save's, so the pieces this pool held in the old one are not in it - their records are let go of here, and
     *  kept on the device until the crash's door hands them again (it asks at the load). Answers how many it let go. */
    loaded(whoLoaded) {
      let n = 0;
      for (const [id, h] of held) if (h.who === whoLoaded) { held.delete(id); n++; }
      return n;
    },
    /** AUDIT WBX S3: records the crash's door handed over at boot (recoverSpoils' `onHanded`) - their pieces are in the
     *  pack, and the next save of their character clears them. */
    adopt(recOrId) { const r = typeof recOrId === 'string' ? { id: recOrId } : recOrId; if (r?.id) held.set(r.id, { who: r.who ?? who(), day: r.day }); },
    /** REALM P1.3: the records of `whoSaved` whose pieces are in the pack NOW - what a realm checkpoint composed at this
     *  moment holds, handed back to `saved` when it lands (a realm save lands later than it is made). */
    heldIds(whoSaved) { return [...held].filter(([, h]) => h.who === whoSaved).map(([id]) => id); },
    /** AUDIT WBX S3: A SAVE LANDED for character `whoSaved` (systems/save/saveSlots.js onSlotSaved): every record of theirs
     *  whose pieces are in the pack is held by it - cleared from the device, its receipt's mark made fast, and (AUDIT
     *  WBX S1) said spent to the hub if it was not yet. Answers how many were cleared. REALM P1.3: a realm checkpoint
     *  names the records it was composed holding (`only`, from heldIds), since it lands after pieces may have come in. */
    saved(whoSaved, only = null) {
      if (whoSaved == null || !held.size) return 0;
      const ids = new Set([...held].filter(([id, h]) => h.who === whoSaved && (!only || only.includes(id))).map(([id]) => id));
      if (!ids.size) return 0;
      const all = recordsOf(read(STORE_KEY));
      // LOST-SPOILS: a record still owing the mailbox stays, its pack's part held - nothing of it handed again
      const left = all.flatMap((r) => (!(r && ids.has(r.id)) ? [r] : mailOf(r).length ? [{ ...r, pieces: [] }] : []));
      const cleared = all.filter((r) => r && ids.has(r.id)).length;
      if (cleared) { if (left.length) keep(STORE_KEY, left); else { try { store?.remove(STORE_KEY); } catch { /* nothing to lose */ } } }
      for (const id of ids) {
        held.delete(id);
        const a = ackOnSave.get(id);
        if (a) {
          ackOnSave.delete(id);
          const kept = read(DAY_KEY);
          keep(DAY_KEY, [...(Array.isArray(kept) ? kept : []), spentKey(a.day, a.acct)].filter((v, i, xs) => xs.indexOf(v) === i).slice(-SPOILS_SPENT_MAX));
          said(a.day, a.acct);
        }
      }
      return cleared;
    },
    /** One frame: the pieces leave on their schedule, fly, clatter and rest - and stay where they rest until pressed
     *  (GATE-UX: never taken underfoot). WB9f: `onRest(pos, tier, kind)` is told of each piece the frame it comes to
     *  rest (the court's sparks). */
    frame(onRest = null) {
      if (!rec) return;
      const t = now(), dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000));
      lastT = t;
      loadTex();
      floor.forEach((f, i) => {
        if (f.taken) return;
        if (!f.left) { if (t - t0 < launches[i].at) return; f.left = true; }
        if (!f.fly.rest) {
          const what = flySpew(f.fly, dt, flyRay);
          if (what === 'bounce' || what === 'rest') audio?.play3d?.(CLIPS.drop, [...f.fly.pos], 1, { maxDistance: 24 });
          if (f.fly.rest) {
            f.restAt = t;
            if ((RARITIES[f.piece.tier]?.rank ?? 0) >= RARITIES.rare.rank) audio?.play3d?.(SOUND.MakeItem, [...f.fly.pos], 1, { maxDistance: 30 });   // the rare chime (corpseMarker.js playRareDrop's own)
            try { onRest?.(f.fly.pos, f.piece.tier, f.piece.kind); } catch { /* a spark is not the spoils' problem */ }   // WB9f
          }
        }
        const b = batchOf(f);
        if (b) { b.origin[0] = f.fly.pos[0]; b.origin[1] = f.fly.pos[1]; b.origin[2] = f.fly.pos[2]; }
      });
    },
    /**
     * WB9f: THE RESTING PIECES AS THE RAY SEES THEM - `{ key, aabb, distance, reach }`, the loot piles' own shape
     * (dungeonContext.js lootTargets): a box over the piece's picture, won at the ray's reach and taken at the
     * treasure's. A piece in the air, or taken, is no target. AUDIT WB D10: an empty floor makes nothing, and a full
     * one refills one list.
     */
    targets() {
      if (!floor.length) return NONE;
      _targets.length = 0;
      floor.forEach((f, i) => {
        if (f.taken || !f.left || !f.fly.rest) return;
        if (!f.target) {
          const [x, y, z] = f.fly.pos, h = Math.max(SPOIL_BOX_MIN_H, f.h || 0);
          f.target = { key: `${f.piece.kind === 'gold' ? SPOIL_GOLD_KEY : SPOIL_KEY}${i}`, aabb: { min: [x - SPOIL_BOX_HALF_M, y, z - SPOIL_BOX_HALF_M], max: [x + SPOIL_BOX_HALF_M, y + h, z + SPOIL_BOX_HALF_M] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE };
        } else if (f.h > 0) f.target.aabb.max[1] = f.target.aabb.min[1] + Math.max(SPOIL_BOX_MIN_H, f.h);   // the picture landed after the pile: its box follows
        _targets.push(f.target);
      });
      return _targets;
    },
    /** WB9f: a piece's word under the crosshair - an item's own name (the host's `itemName`) and its tier below it, the
     *  gold as a sum - or null for a key that is not a resting piece's. */
    nameOf(key) {
      const f = pieceAt(key);
      if (!f) return null;
      if (f.piece.kind === 'gold') return { title: SPOILS_TEXT.goldName(f.piece.gold) };
      const label = f.piece.tier && f.piece.tier !== 'common' ? RARITIES[f.piece.tier]?.label : null;
      return { title: itemName(f.piece.item), subs: label ? [label] : [] };
    },
    /** WB9f: what an item's key holds, for the plaque's list - the one item - or null. */
    contentsOf(key) { const f = pieceAt(key); return f && f.piece.kind === 'item' ? [f.piece.item] : null; },
    /** WB9f: THE PRESS - the piece a key names into the pack, and said; false when it is not there. GATE-UX: the only
     *  way a piece leaves the floor short of leaving the court. */
    pick(key) { const f = pieceAt(key); if (!f) return false; takeOne(f); return true; },
    /** The pieces, for the host's billboard pass (AUDIT WB D10: an empty floor - the court's every frame but a kill's -
     *  makes nothing). */
    batches: () => (floor.length ? floor.filter((f) => f.batch && !f.taken && f.left).map((f) => f.batch) : NONE),
    /** A Rare-or-better resting piece's light, in the court's channel. */
    lights() {
      if (!floor.length) return NONE;
      const out = [];
      for (const f of floor) {
        if (f.taken || !f.fly.rest || (RARITIES[f.piece.tier]?.rank ?? 0) < RARITIES.rare.rank) continue;
        const c = tierColour(f.piece.tier), k = SPOILS_LIGHT.k * Math.min(1, (now() - f.restAt) / SPOILS_RISE_MS);
        out.push(adoptLight({ x: f.fly.pos[0], y: f.fly.pos[1] + SPOILS_LIGHT.up, z: f.fly.pos[2], range: SPOILS_LIGHT.range, color: c.map((v) => v * k) }, f));   // LIGHT-ID: the piece's own light
      }
      return out;
    },
    /** WBX3: the loot lines, in the host's world pass - each out of the top of its own sprite. */
    drawPass(proj, view, eye, seconds, fog = null) {
      if (!glow || !floor.length) return false;
      const t = now();
      const lines = floor.filter((f) => !f.taken && f.fly.rest).map((f) => ({ root: [f.fly.pos[0], f.fly.pos[1] + f.h, f.fly.pos[2]], tier: f.piece.tier, alpha: Math.min(1, (t - f.restAt) / SPOILS_RISE_MS) }));
      glow.draw(lines, proj, view, eye, seconds, fog);
      return glow.drawn > 0;
    },
    /** Out of the court: whatever is still on its floor goes into the pack, its items to the mailbox where it takes post
     *  (LOST-SPOILS, `gatherFloor`). Answers how many pieces were left. */
    gather: gatherFloor,
    /** LOST-SPOILS: what is owed to the mailbox sent now (the host's, the tests') - answers how many records still owe. */
    mailOwed: () => sendMail(),
    /** What the pool holds, for the tests and the stats. */
    state: () => ({ day: rec?.day ?? null, pieces: floor.map((f) => ({ kind: f.piece.kind, tier: f.piece.tier, left: f.left, rest: f.fly.rest, taken: f.taken, pos: [...f.fly.pos], icon: !!f.batchIcon, h: f.h })) }),
  };
}
