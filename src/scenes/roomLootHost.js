// HOST-SPLIT: moved verbatim out of src/scenes/dungeonContext.js's buildDungeonContext (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { addGoldPieces, addItem, isGoldPieces, stacksWith } from '../systems/inventory.js';
import { asTheRoom } from '../systems/online/onlineLane.js';
import { baseSignature, bonusSpent, carriedBase, claimOf, claimWord, composeRoomView, isPersonalLoot, isRoomBaseKind, isRoomWord, judgeRoomClaim, legacyCounts, legacyDelta, legacySig, markPersonal, mergeRoomWord, pieceCount, recentAnswers, roomEmptied, ROOM_ANSWERS_KEPT, ROOM_BASE_FIND, ROOM_BASE_LUCK, ROOM_BASE_MAX, ROOM_BASE_QUARTERS, ROOM_CLAIM_TIMEOUT_MS, ROOM_CLAIMS_MAX, ROOM_PUT_RESAY_MS, ROOM_TAKEN_TEXT, roomBaseGender, roomBaseLevel, roomClaimId, roomClaimOrder, roomContainerName, roomRoller, roomState, roomTermsBeat, roomWord, sameRoomTerms, seededRolls, settleBonusSpent, validRoomWord } from '../systems/roomLoot.js';
import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { grantEliteLoot } from '../systems/eliteFoes.js';
import { isDeepPileKey } from '../systems/rest/restItems.js';
import { isEquipped, unequipItem } from '../systems/equip.js';
import { CLAIM_KEEP_MS, CLAIMS_KEPT_MAX } from '../systems/loot/claimLedger.js';
import { LOOT_LIST_MAX, validLootList } from '../systems/loot/loot.js';
import { SEARCH_COOLDOWN_MINUTES, SEARCH_LOOT_MAX } from '../systems/searchables.js';
import { SEARCH_FOREIGN_PER_OBJECT } from './searchRoom.js';
import { sharedClassicMinutes } from '../net/wire.js';
import { neverPeerHanded, peerHanded, notCarried } from '../systems/peerWord.js';
import { playerEntity } from '../characters/playerEntity.js';
import { raiseEnemyDeath } from './corpseMarker.js';
import { rollCorpseKit } from '../systems/foeLootCap.js';
import { rollRoomBonus, spawnEnemyLoot, wildLootAfter } from './hostCombat.js';
import { setMidScreenText } from '../ui/midScreenText.js';
import { stampWonWeapons } from '../systems/loot/lootRarity.js';
import { wildPileMore } from '../systems/wild/wildZone.js';
import { seaPileMore } from '../systems/sea/seaSpoils.js';

/** @param {any} host */
export function createRoomLoot(host) {
  const {
    _deepCleared, _deepFoeCleared, _sharedFoe, _wildDungeon, _wildRing, eliteLootOpts, fightN, foes, lootKeyOf,
    lootableBody, opts, respawnDue, rollPileItems, roomLootKey, searchHeard, searchables, settleLootFlat, dfLocation
  } = host;
  // ── PARTY-LOOT (2026-10-14, the field: "each of us DO NOT see the same loot"; Mac: "Shared base + personal bonus") ──
  // A ROOM'S CONTAINER IS ONE BASE LIST FOR EVERYONE IN IT (systems/roomLoot.js says the law whole). WORLD4 made a
  // container the room's at its first open, with the opener's OWN roll - and the plaque and Quick Loot showed and took
  // from containers nobody had opened, so each player saw their own roll and the first take's leftovers replaced
  // everyone else's list. Now every client computes the same base for a layout pile, a layout body and a rest
  // encounter's body - the container's chain on dice seeded by its name, on the room's terms - and the room's word is
  // the takes against it, merged and never landed whole. The terms (its generation and the party's level) are minted
  // once: by the host at the container's birth, by another only when no host word has come in ROOM_TERMS_WAIT. Until a
  // container has terms here it is UNBORN: no plaque, no take, no window. Each player's own Luck and Renown roll a
  // bonus over the base that only they see, never said to the room. Offline nothing here runs: DFU's own roll stands.
  const ROOM_TERMS_WAIT_HOST_MS = 1500;   // the host waits this long for the room's memory before it mints a pile's
  const ROOM_TERMS_WAIT_PEER_MS = 6000;   // and another client this long for the host's word before it mints at all
  const _roomBase = new Map();      // canon -> the base this client computed for the container's current terms
  const _roomState = new Map();     // canon -> the room's word as this client knows it (roomLoot.js roomState)
  const _roomBonus = new Map();     // canon -> this player's bonus over that base
  const _roomComposed = new Map();  // canon -> the base the container's list was last composed from
  const _roomUnbornAt = new Map();  // canon -> when the sweep first found the container born with no terms (its own clock)
  const _roomPending = new Map();   // canon -> a word that came before its body fell here
  const _roomNextGen = new Map();   // canon -> the generation a pile's respawn rolls next (the room's emptying stamp)
  const _roomSeen = new Map();      // canon -> { list, at }: the shared pieces its list held at its last compose (a take is read against it)
  const _roomMine = new Map();      // claim id -> this player's own claim or put the host has not answered (or a claim that timed out, still answered late)
  const _roomWon = new Set();       // `canon#g|place` this player's claims were granted - a sibling claim's refusal is then no news
  // OUTDOOR-LOOT slice 3: a dungeon's search find (`srch:<i>`) is a CARRIED kind - its base is the searcher's roll, minted once at the search
  const _roomSees = new Set();      // canon -> this client SEES the find (it is its own or its party's - GRAVE-PARTY); the host keeps a judging state for every find, seen or not
  const _roomSearcher = new Map();  // canon -> { by, bn }: the searching account and character a find's words name (searchRoom.fields)
  const _roomLegacy = new Map();    // `canon|peer` -> an older build's last whole list, as a census (roomLoot.js legacyCounts): its next word is read against it
  const _roomStale = new Set();     // canon -> a find's mint lost its tie-break while this player's window stood open on it: what that window took or laid is put right at its close
  const isCarried = (canon) => typeof canon === 'string' && canon.startsWith('srch:');
  /** Two mints of one container are one base when their terms agree - and, for a carried base (one client's roll), their signature. */
  const sameMint = (a, b) => sameRoomTerms(a, b) && (a?.h ?? null) === (b?.h ?? null);
  /** A room WORD is the mint a state holds when its terms agree and, for a carried base, its signature says the same (a computed base's terms carry none). */
  const wordIsMint = (w, terms) => sameRoomTerms(w, terms) && (terms.h === undefined || w.h === terms.h);
  const roomLootOn = () => host.onlineRoom();
  /** A layout foe's or a rest encounter's body's room key, or null (a quest spawn's, a summon's, a party member's own
   *  foe, a revenant's - RVN8's list holds a player's own pieces, so its body keeps WORLD4's word - and a foe a company
   *  of the living world left picked over, LW14, empty for every reader alike). */
  function roomCanonOfFoe(f) {
    if (!f || f._ownFrom != null || f.entity?.revenant || f.companion != null) return null;
    if (f._encId != null) return host._sharedById.get(f._encId) === f ? `enc:${f._encId}` : null;
    const i = foes.indexOf(f);
    if (i < 0 || i >= host._layoutFoes) return null;
    if (_deepFoeCleared.has(`${f.src?.blockIndex}:${f.src?.loadID}`)) return null;
    return `corpse:${i}`;
  }
  /** The container a room key names when it has a shared base: `{ kind, i, pile }` or `{ kind, i, foe }`, else null. */
  function roomBaseHolder(canon) {
    if (!isRoomBaseKind(canon)) return null;
    const [kind, iStr] = canon.split(':');
    const i = Number(iStr);
    if (kind === 'loot') { const p = host.lootPiles[i]; return p && Array.isArray(p.items) ? { kind, i, pile: p } : null; }
    if (kind === 'srch') { const sb = searchables[i]; return sb && Array.isArray(sb.items) ? { kind, i, search: sb } : null; }   // OUTDOOR-LOOT: a searched object's find - the object's own `items` is the container's list
    const f = kind === 'enc' ? host._sharedById.get(i) : foes[i];
    return f && f.entity && roomCanonOfFoe(f) === canon ? { kind, i, foe: f } : null;
  }
  const holderList = (h) => (h.pile ? h.pile.items : h.search ? h.search.items : h.foe.entity.items);
  /** Whether a room key names a container with a shared base, online in a room. */
  const isRoomBaseContainer = (canon) => roomLootOn() && !!roomBaseHolder(canon);
  /** Whether a room container stands here to be looted at all: a pile always, a body once it has fallen. */
  const roomBorn = (h) => !!h && (h.pile || h.search ? true : lootableBody(h.foe));
  /** UNBORN: a room's container standing here with no terms yet - nothing to show, nothing to take. GRAVE-PARTY (FIELD
   *  BUGS 2026-10-16, "objects in tombs are un lootable"): never one whose room word this build CANNOT READ (another
   *  build's - AUDIT SETS M2's `_lootUnreadable`): that one was unborn for good, its pile standing on the floor with no
   *  plaque and no press, because the mint waits on a word that will never be read. It is a TARGET again, and its press
   *  says M2's own line (dungeonContext.js takeLoot, LOOT_NEWER_TEXT: "Reload to open it") - never opened here. AUDIT
   *  GRAVE-PARTY G2: GRAVE-PARTY opened it as the player's own instead, and that was a dead end or a copy - a pile never
   *  composed here holds nothing online (the pile loop's `onlineRoom() ? [] :`), so it opened EMPTY and its flat went at
   *  the close; one composed here and turned unreadable handed its base pieces out unclaimed beside every other build's. */
  function roomUnborn(key) {
    const canon = roomLootKey(key) ?? lootKeyOf(key);
    if (!canon || !isRoomBaseContainer(canon)) return false;
    return !_roomState.has(canon) && !host._lootUnreadable.has(canon);
  }
  /** What a foe's build left in its list - the pieces and their counts - so its body can tell what reached it alive. */
  function lootBuiltOf(entity) {
    const list = Array.isArray(entity?.items) ? entity.items : null;
    return list ? { list, counts: new Map(list.map((it) => [it, it?.stackCount ?? 1])) } : null;
  }
  /** WHAT REACHED THE BODY ALIVE (a shaft lodged in it - STUCK-ARROWS, a joiner's arrow on the host's copy - WORLD3): the
   *  pieces its build did not leave, and a stack's growth past what it left. The minter says them with the body's birth
   *  as the room's stored pieces; a list some load replaced is no build's list, and tells nothing. */
  function lifeAddsOf(f) {
    const built = f._lootBuilt;
    if (!built || f.entity?.items !== built.list) return [];
    const out = [];
    for (const it of f.entity.items) {
      if (!it) continue;
      const was = built.counts.get(it);
      if (was === undefined) { out.push({ ...it }); continue; }
      const n = (it.stackCount ?? 1) - was;
      if (n > 0) out.push({ ...it, stackCount: n });
    }
    return peerHanded(out) ?? [];
  }
  /** THE BASE: a container's chain on the room's dice and the room's terms, computed here as on every client in the
   *  room (cached for one set of terms). Rolled AS THE ROOM (onlineLane.js asTheRoom): every mod at its shipped
   *  default. Answers `{ name, terms, items, full, rejects, lootCap, h }`. */
  function rollRoomBase(canon, terms) {
    if (isCarried(canon)) {   // OUTDOOR-LOOT: a find's base is the searcher's roll, carried with the state - never computed
      const st = _roomState.get(canon);
      if (!st?.base || !sameMint(st.terms, terms)) return null;
      const was = _roomBase.get(canon);
      if (was?.carried === st.base) return was;
      const rec = { name: canon, terms: { ...st.terms }, items: st.base.items, full: st.base.full, rejects: [], lootCap: null, h: st.base.h, carried: st.base };
      _roomBase.set(canon, rec);
      return rec;
    }
    const name = roomContainerName(host._locationKey, canon, terms.g);
    const was = _roomBase.get(canon);
    if (was && was.name === name && sameRoomTerms(was.terms, terms)) return was;
    const h = roomBaseHolder(canon);
    if (!h) return null;
    const rolls = seededRolls(name);
    const gender = roomBaseGender(name);
    const rejects = [];
    let items = [], lootCap = null;
    asTheRoom(() => {
      if (h.pile) items = roomPileBase(h, terms, rolls, gender);
      else ({ items, lootCap } = roomBodyBase(h.foe, terms, rolls, gender, rejects));
    });
    if (items.length > ROOM_BASE_MAX) items.length = ROOM_BASE_MAX;
    const rec = { name, terms: { ...terms }, items, full: items.map((it) => (Number.isInteger(it?.stackCount) ? it.stackCount : null)), rejects, lootCap, h: baseSignature(items) };
    _roomBase.set(canon, rec);
    _roomBonus.delete(canon);
    return rec;
  }
  /** A pile's base: rollPileItems on the room's terms (the party's level, the name's gender, Luck 50, RENOWN-LOOT's
   *  first stage, no finder), the open zone's share on the same dice, and a pile a company passed empty (LW14). */
  function roomPileBase(h, terms, rolls, gender) {
    const t = { rolls, level: terms.lv, gender, luck: ROOM_BASE_LUCK, quarters: ROOM_BASE_QUARTERS, find: ROOM_BASE_FIND };
    const items = rollPileItems(t);
    if (_wildDungeon) wildPileMore(items, () => rollPileItems(t), _wildRing, rolls);
    seaPileMore(items, dfLocation, rolls);   // SEA-SET: an isle's ruin of the deep - the Tidemail's share, last, on the room's dice
    if (h.pile.stopKey && _deepCleared.has(h.pile.stopKey)) items.length = 0;
    return items;
  }
  /** A body's base: SetEnemyCareer's whole loot chain (spawnEnemyLoot) and its death's (the kit's ladder, the sigils at
   *  the fight's count, OnEnemyDeath's subscribers and the cap), run over the fallen foe's own entity on the room's
   *  dice and terms - a class foe at the party's level, as SetEnemyCareer stands one at the player's - and handed back
   *  without touching what the foe wore or fought with. `rejects` receives what PLAIN-LOOT's keep let go. */
  function roomBodyBase(f, terms, rolls, gender, rejects) {
    const e = f.entity;
    const saved = { items: e.items, weapon: e.weapon, armorValues: e.armorValues, equip: e.equip, level: e.level };
    const roller = roomRoller(terms.lv, gender);
    const o = { rolls, quarters: ROOM_BASE_QUARTERS, luck: ROOM_BASE_LUCK, find: ROOM_BASE_FIND };
    try {
      if (e.isClass) e.level = terms.lv;
      e.items = [];
      e.equip = undefined;   // the base's kit is laid on a table of its own, never over the one the foe wore
      spawnEnemyLoot(e, f.mobileType, ENEMY_BASICS[f.mobileType], roller, { ...eliteLootOpts(f.src), where: 'dungeon', ...o, rejects });
      if (_wildDungeon) wildLootAfter(e);
      if (f.src?.eliteFoe) grantEliteLoot(e, terms.lv, rolls);
      rollCorpseKit(e, o);
      stampWonWeapons(e.items, terms.n ?? 1, { rolls });
      raiseEnemyDeath(e, { ...o, level: terms.lv, room: true });   // `room`: the room's base, every client's - no kill (systems/eliteGates/egFind.js asks at the kill)
      return { items: e.items, lootCap: Number.isInteger(e.lootCap) ? e.lootCap : null };
    } finally {
      e.items = saved.items; e.weapon = saved.weapon; e.armorValues = saved.armorValues; e.equip = saved.equip; e.level = saved.level;
    }
  }
  /** THE BONUS: this player's own layer over a base - on dice seeded by the base's name and the CHARACTER, at their
   *  own Renown and Luck (RENOWN-LOOT, "the roller's own"): the pieces PLAIN-LOOT's keep let go that their Renown's keep
   *  keeps (bonusShare, so the base's keep and theirs together are their own), the supplies their Renown's share adds
   *  over the base's (rollBonusSupplies), each piece on their own ladder (their Luck, their finders, their Renown's plain
   *  weights) and the sigils at the fight's count - inside the cap's room above the base, never past it. Rolled outside
   *  the room's scope: the player's own switches decide what is theirs. Never said to the room. */
  function roomBonusOf(canon, base) {
    const who = playerEntity?.characterId ?? opts.selfId?.() ?? 'me';
    const key = `${base.name}|${who}`;
    const was = _roomBonus.get(canon);
    if (was && was.key === key) return was;
    const h = roomBaseHolder(canon);
    const f = h?.foe ?? null;
    const pieces = rollRoomBonus({   // hostCombat.js: the knobs' one home, at this player's own stage and Luck
      rolls: seededRolls(key), player: playerEntity, pile: !!h?.pile, deepPile: !!h?.pile && isDeepPileKey(host.lootKey), rejects: base.rejects,
      basics: f ? ENEMY_BASICS[f.mobileType] : null, mobileType: f?.mobileType ?? null, champion: f?.entity?.champion ?? null,
      level: f ? (f.entity.isClass ? base.terms.lv : f.entity.level) : base.terms.lv, lootCap: base.lootCap, baseItems: base.items, fighters: base.terms.n ?? 1,
    });
    for (const it of pieces) markPersonal(it);
    const rec = { key, pieces, composed: false };
    _roomBonus.set(canon, rec);
    return rec;
  }
  /** The bonus pieces no longer in the list are spent (the character's save keeps them so), one back in it is not. */
  function settleRoomBonus(canon, list) {
    const b = _roomBonus.get(canon);
    if (!b || !b.composed || b.list !== list) return;   // a list a load replaced holds copies, and says nothing of what was taken
    const held = new Set(list);
    const gone = [], kept = [];
    b.pieces.forEach((it, i) => (held.has(it) ? kept : gone).push(i));
    settleBonusSpent(b.key, gone, kept);
  }
  /** THE LIST: the base's pieces the room has not taken, its stored pieces, this player's unspent bonus - in place, so
   *  every holder of the array reads it (the plaque, Physical Items, a pile tab). Never under this player's open window
   *  (AUDIT WORLD4 C1: a container you have open is yours until you close it). */
  function composeRoomContainer(canon) {
    const st = _roomState.get(canon), h = roomBaseHolder(canon);
    if (!st || !h || canon === host._lootOpenKey) return false;
    if (h.search && !_roomSees.has(canon)) return false;   // OUTDOOR-LOOT: a find this player is not of the party of is judged here, never shown
    const base = rollRoomBase(canon, st.terms);
    if (!base) return false;
    const list = holderList(h);
    if (!h.search) settleRoomBonus(canon, list);
    const bonus = h.search ? { key: '', pieces: [] } : roomBonusOf(canon, base);   // a find has no personal layer: the searcher's roll is the party's
    const spent = bonusSpent(bonus.key);
    const pending = roomPendingOf(canon, st);
    if (h.search) base.items.forEach((it, i) => { if (!st.taken.has(i) && !notCarried([it])?.length) pending.places.set(i, (pending.places.get(i) ?? 0) + (base.full[i] ?? 1)); });   // AUDIT AUTO-HOLD: never offered a piece I carry
    const { list: out, seen } = composeRoomView(base.items, base.full, st, bonus.pieces.filter((_, i) => !spent.has(i)), pending);
    list.length = 0;
    list.push(...out);
    bonus.composed = true;
    bonus.list = list;
    _roomComposed.set(canon, { base, list });
    _roomSeen.set(canon, { list, at: seen });
    for (const [id, m] of [..._roomMine]) if (m.canon === canon && m.put && m.refused) { _roomMine.delete(id); roomGive(m.item, pieceCount(m.item)); }   // a put the host refused comes back, now nothing stands open on it
    if (h.pile) settleLootFlat(h.i);
    return true;
  }
  /** The room's words about a room container as this client would say them now (none: unborn, or nothing to say): its HOST's -
   *  the room's state, its stored pieces and its latest verdicts (the memory's too, which the host publishes) - or, while another
   *  holds the seat, this player's claims and puts in flight, said AGAIN until they are answered (a lost word is the claimer's to
   *  say twice; a Take all past ROOM_CLAIMS_MAX goes in consecutive words - OUTDOOR-LOOT D-2.1: only the newest 32 were said). */
  function roomRecordsOf(canon) {
    if (host._authority) { const rec = roomStateWord(canon, true); return rec ? [rec] : []; }
    const st = _roomState.get(canon), base = st ? rollRoomBase(canon, st.terms) : null;
    if (!st || !base) return [];
    const q = [], a = [];
    for (const m of _roomMine.values()) {
      if (m.canon !== canon || m.refused || !sameMint(m.terms, st.terms)) continue;
      if (m.claim) q.push(m.claim); else if (m.put) a.push(m.put);
    }
    const out = [];
    for (let i = 0; i < Math.max(q.length, a.length); i += ROOM_CLAIMS_MAX) out.push(decorate(canon, claimWord(canon, st, base.h, q.slice(i, i + ROOM_CLAIMS_MAX), a.slice(i, i + ROOM_CLAIMS_MAX), host._lootAt.get(canon) ?? null, st.base?.records ?? null)));
    return out;
  }
  const roomRecordOf = (canon) => roomRecordsOf(canon)[0] ?? null;
  /** A find's words name its searcher (GRAVE-PARTY's `by`, and `bn` the character); every other container's are as they were. */
  const decorate = (canon, rec) => (isCarried(canon) && _roomSearcher.has(canon) ? { ...rec, ..._roomSearcher.get(canon) } : rec);
  /** The room's STATE about a container, as its host (or its minter, at the birth) says it: the terms and the takes, the
   *  stored pieces a peer may be handed and their ids, and - `verdicts` - the answers it carries: `true` the latest, a list the
   *  very ones (the claims a word answers). A carried base's records ride every state word. */
  function roomStateWord(canon, verdicts) {
    const st = _roomState.get(canon), h = roomBaseHolder(canon);
    if (!st || !h) return null;
    const base = rollRoomBase(canon, st.terms);
    if (!base) return null;
    const kept = st.stored.map((it, i) => [it, st.ids[i]]).filter(([it]) => !neverPeerHanded(it));   // SS3/HACKED-GOLD: peerHanded's own rule, pair by pair
    if (kept.length > LOOT_LIST_MAX) {
      if (!host._lootTooBig.has(canon)) { host._lootTooBig.add(canon); console.warn(`[loot] ${canon} holds ${kept.length} stored items, more than the room can carry (${LOOT_LIST_MAX}); it is not said`); }
      return null;
    }
    host._lootTooBig.delete(canon);
    return decorate(canon, roomWord(canon, st, base.h, { s: kept.map((p) => p[0]), si: kept.map((p) => p[1]) }, host._lootAt.get(canon) ?? null, verdicts === true ? recentAnswers(st) : Array.isArray(verdicts) ? verdicts : [], st.base?.records ?? null));
  }
  /** The verdicts a host answers, said in consecutive state words of ROOM_ANSWERS_KEPT - none pushed out of a word by another claimer's. */
  function verdictWords(canon, verdicts) {
    const out = [];
    for (let i = 0; i < Math.max(verdicts.length, 1); i += ROOM_ANSWERS_KEPT) {
      const rec = roomStateWord(canon, verdicts.slice(i, i + ROOM_ANSWERS_KEPT));
      if (!rec) return out;
      out.push(rec);
    }
    return out;
  }
  /** AUDIT OUTDOOR-LOOT D1: A STRANGER'S FIND, JUDGED. The seat judged every find in the room's one state an object - so a stranger's
   *  find beside the one it held (another party's search of the same object in the same period) was dropped whole, its takes lifted
   *  and lapsed for good, and a stranger's held first hid the seat's party's own find from it. A stranger's find is judged in a state
   *  of its own, one a mint (its period and signature, the newest SEARCH_FOREIGN_PER_OBJECT kept), never shown and never the room's
   *  memory: its claims first come, its verdicts said in a word of that mint's own terms - its searcher's party lands it (the same
   *  mint), everyone else keeps it unlanded. A claim word carries the base, so a seat that comes after holds it from the first claim. */
  const _strangerFinds = new Map();
  function judgeStrangerFind(canon, w, rec, from) {
    if (from == null) return 0;
    const held = _strangerFinds.get(canon) ?? [];
    let st = held.find((x) => wordIsMint(w, x.terms) && (x.terms.h === w.h)) ?? null;
    if (!st && !w.b) return 0;   // a claim on a find whose base never reached this seat: nothing to judge it against
    const q = w.q.filter((cl) => claimOf(cl.id, from)), a = w.a.filter((p) => claimOf(p.id, from));
    const reask = st ? [...q, ...a].map((c) => c.id).filter((id) => st.answers.has(id)) : [];
    st = mergeRoomWord(st, { ...w, x: [], c: [], y: [], s: st ? null : (w.s ?? []), si: st ? null : (w.si ?? []), q, a }).state;
    if (!held.includes(st)) { held.push(st); while (held.length > SEARCH_FOREIGN_PER_OBJECT) held.shift(); _strangerFinds.set(canon, held); }
    if (!st.base) return 0;
    const verdicts = [...st.claims.values()].map((cl) => [cl.id, judgeRoomClaim(st, st.base.items.length, st.base.full, tooOldToGrant(cl) ? { ...cl, stale: true } : cl, roomAdmit)]);
    for (const id of reask) if (!verdicts.some(([v]) => v === id)) verdicts.push([id, /** @type {number} */ (st.answers.get(id))]);
    if (!verdicts.length) return 1;
    const kept = st.stored.map((it, i) => [it, st.ids[i]]).filter(([it]) => !neverPeerHanded(it));
    const searcher = host.searchRoom.fields({ by: rec.by, bn: rec.bn });
    for (let i = 0; i < verdicts.length; i += ROOM_ANSWERS_KEPT) {
      opts.onActions?.({ k: host._locationKey, l: [{ ...roomWord(canon, st, st.base.h, { s: kept.map((p) => p[0]), si: kept.map((p) => p[1]) }, host._wallNow(), verdicts.slice(i, i + ROOM_ANSWERS_KEPT)), ...searcher }] });
    }
    return 1;
  }
  /** A room word landed: projected, its base checked against this client's own (the signature), merged into the room's
   *  state and the list recomposed. Answers 1 when it was the room's word about a container here, else 0. */
  function landRoomWord(canon, rec, from = null) {
    const h = roomBaseHolder(canon);
    if (!h) return 0;
    if (!isRoomWord(rec)) return h.search ? landSearchLegacy(canon, h, rec, from) : landLegacyList(canon, h, rec);
    const w = validRoomWord(rec);
    const _now = host._wallNow();
    // OUTDOOR-LOOT: whose a find's word is (GRAVE-PARTY) - `who` when its searcher is this player or their party, else a stranger's
    const who = h.search ? host.searchRoom.whose(rec, from) : null;
    if (h.search && w?.b) { w.b = peerHanded(w.b); if (baseSignature(w.b) !== w.h) return unreadableWord(canon, h, who); }   // a base this build reads differently, or a hostile one: never landed as a list (AUDIT SETS M2)
    if (!w) return unreadableWord(canon, h, h.search ? who : true);   // AUDIT SETS M2: the room's word, in terms this build cannot read
    if (Number.isFinite(rec.t) && respawnDue(rec.t, _now)) { if (h.pile) _roomNextGen.set(canon, Math.max(_roomNextGen.get(canon) ?? 0, Math.trunc(rec.t))); return 0; }   // WORLD8: the room's word is past its hour - the pile's next life is its own
    if (!roomBorn(h)) { _roomPending.set(canon, { rec, from }); return 0; }   // a body that has not fallen here yet: landed when it does
    const st = _roomState.get(canon);
    const same = !!st && wordIsMint(w, st.terms);
    // A FIND this player does not see: its word is KEPT unlanded (the object reads it again once the party is made), and only the
    // dungeon's HOST goes on - it judges every find's claims, the searcher's party's or a stranger's, and shows none (GRAVE-PARTY: who
    // SEES, never who JUDGES) - a stranger's in a state of its own (AUDIT OUTDOOR-LOOT D1, judgeStrangerFind), never the room's
    const sees = !h.search || !!who || (same && _roomSees.has(canon));
    if (!sees) { host.searchRoom.ours(canon, rec, from); return host._authority ? judgeStrangerFind(canon, w, rec, from) : 0; }
    if (h.search && !w.b && !st) return 0;   // terms with no base: UNBORN here until the base arrives
    // WHO SAYS WHAT (host arbitrates): the room's state - its takes, its stored pieces, its verdicts - is the HOST's word,
    // or the memory's (the host publishes it); a birth is anyone's (the mint's own law, roomTermsBeat); a claim and a put
    // are their claimer's own, in their claimer's name (claimOf) - and the memory's claims are nobody's to judge again
    const birth = !st || (!same && roomTermsBeat(w, st.terms));
    if (!roomHostSaid(from)) { w.x = []; w.c = []; w.y = []; if (!birth) { w.s = null; w.si = null; } }
    w.q = from == null ? [] : w.q.filter((cl) => claimOf(cl.id, from));
    w.a = from == null ? [] : w.a.filter((p) => claimOf(p.id, from));
    if (h.search && sees && host._authority && !host.searchRoom.whose({}, from)) { w.q = []; w.a = []; }   // a find this host shows is its party's: a stranger's claim on it is not heard (a stranger never lands a find it was not told of)
    const reask = host._authority && same ? [...w.q, ...w.a].map((c) => c.id).filter((id) => st.answers.has(id)) : [];   // a claim already answered, asked AGAIN (its verdict was lost): answered from the ledger, never judged twice
    if (st && !same && !birth) {   // another mint, which loses to the one here
      if (host._authority && (w.q.length || w.a.length)) { mergeRoomWord(st, w); roomJudge(canon, st); }   // its claims are on a base that is gone: refused
      return 1;
    }
    if (!h.search) {
      const base = rollRoomBase(canon, w);
      if (!base) return 0;
      if (w.h && w.h !== base.h) { host._lootSeen.add(canon); host._lootUnreadable.add(canon); return 0; }   // another build's base: never landed as a list (M2's word)
    }
    const { state, changed, answered } = mergeRoomWord(st, w);
    const reborn = state !== st;
    if (h.search && reborn) {   // a find's NEW mint (the first heard, or one that beat the last): what the last one left is put right, the searcher named
      if (st) dropOldMint(canon, state);
      _roomSearcher.set(canon, host.searchRoom.fields({ by: rec.by ?? who?.acct, bn: rec.bn ?? who?.name }));
    }
    _roomState.set(canon, state);
    host._lootUnreadable.delete(canon);
    _roomUnbornAt.delete(canon);
    host._lootSeen.add(canon);
    { const _t = Number.isFinite(rec.t) ? (_now == null ? rec.t : Math.min(rec.t, _now)) : _now; if (_t != null && (!Number.isFinite(host._lootAt.get(canon)) || _t > host._lootAt.get(canon))) host._lootAt.set(canon, _t); }   // WORLD8's stamp, never ahead of now (AUDIT WORLD7/8 C2)
    const seer = h.search && sees && !_roomSees.has(canon);
    if (h.search && sees) _roomSees.add(canon);
    if ((seer || reborn) && who) searchHeard(h.i, host._lootAt.get(canon), who);   // AUDIT OUTDOOR-LOOT D2: and at EVERY new mint of it (a search after the five hours) - not the first heard alone   // SEARCH1: another's search starts my five hours too - from the room's stamp; GRAVE-PARTY: a partymate's, by name
    for (const [id, g] of answered) roomResolve(id, g, canon);   // the host's verdicts on this player's own claims
    const base = rollRoomBase(canon, state.terms);
    if (changed || seer || answered.length || _roomComposed.get(canon)?.base !== base || _roomComposed.get(canon)?.list !== holderList(h)) composeRoomContainer(canon);
    if (host._authority && (state.claims.size || reask.length)) roomJudge(canon, state, null, reask);   // the host grants them, in the order they reached it
    if (h.pile) h.pile.roomWords = (h.pile.roomWords ?? 0) + 1;   // AUDIT LW-II-2 D5: the room's word counted on the pile
    return 1;
  }
  /** AUDIT SETS M2: the room's word, in terms this build cannot read - the container is the room's, unread here (a find's, only
   *  when it is this player's party's: a stranger's unreadable word is nobody's). */
  function unreadableWord(canon, h, mine) {
    if (mine && roomBorn(h)) { host._lootSeen.add(canon); host._lootUnreadable.add(canon); }
    return 0;
  }
  /** A find's mint was replaced by another's (it lost the tie-break, or a new period's search beat it): this player's claims and
   *  puts on the old one are let go - a piece taken from a roll that never was the room's stays out of the pack, a piece laid
   *  in comes home - and, if their window stands open on it, what that window did is put right at its close (roomSettle). */
  function dropOldMint(canon, state) {
    for (const [id, m] of [..._roomMine]) {
      if (m.canon !== canon || sameMint(m.terms, state.terms)) continue;
      _roomMine.delete(id);
      if (m.put && !m.refused) roomGive(m.item, pieceCount(m.item));
    }
    if (host._lootOpenKey === canon) _roomStale.add(canon);
  }
  /** OUTDOOR-LOOT (DESIGN 5.5): AN OLDER BUILD'S WHOLE LIST about a find (`{ k, r, t, by, bn }`, WORLD4's word) is never landed over the
   *  room's - last writer wins, and a close from a window opened before another's take brought its piece back. It is a BIRTH when
   *  this client holds no find of its period (terms { g: the period its stamp falls in, lv: 1, n: 1, tm: -1 }: no new mint beats an
   *  older build's, which cannot read a new word); otherwise it is that peer's DIFF against its own previous word - a piece that fell
   *  in count is its take (the host judges it as a claim on the matching piece, first come), one that rose its put - and a list as it
   *  was changes nothing. A first word, or the memory's, is a baseline only. Answers 1 when it was the room's word. */
  function landSearchLegacy(canon, h, rec, from) {
    const _now = host._wallNow();
    const who = host.searchRoom.whose(rec, from);
    const items = peerHanded(validLootList(rec?.r));
    if (!items) return unreadableWord(canon, h, who && !respawnDue(rec?.t, _now));   // AUDIT SETS M2: the room has spoken, in words this build cannot read
    if (respawnDue(rec.t, _now) || items.length > SEARCH_LOOT_MAX) return 0;
    const st = _roomState.get(canon);
    const stamp = Number.isFinite(rec.t) ? (_now == null ? rec.t : Math.min(rec.t, _now)) : _now;
    const terms = { g: Number.isFinite(stamp) ? Math.max(0, Math.floor(sharedClassicMinutes(stamp) / SEARCH_COOLDOWN_MINUTES)) : 0, lv: 1, n: 1, tm: -1, h: baseSignature(items) };
    const key = `${canon}|${typeof from === 'string' ? from : 'memory'}`;
    const prev = _roomLegacy.get(key);
    _roomLegacy.set(key, legacyCounts(items));
    if (!st || terms.g > st.terms.g) {   // a BIRTH: this client holds no find of the word's period (a NEWER period's search is a new find)
      return landRoomWord(canon, { k: canon, g: terms.g, lv: 1, n: 1, tm: -1, h: terms.h, b: items.map((it) => ({ ...it })), ...(Number.isFinite(rec.t) ? { t: rec.t } : {}), ...(rec.by ? { by: rec.by } : {}), ...(rec.bn ? { bn: rec.bn } : {}) }, from);
    }
    if (!prev || from == null || !host._authority || !(who || (rec.by && rec.by === _roomSearcher.get(canon)?.by))) return 1;   // a baseline only - and only the host, for the searcher's own party, reads a diff
    const base = rollRoomBase(canon, st.terms);
    if (!base) return 0;
    const d = legacyDelta(prev, items);
    const { list, seen } = composeRoomView(base.items, base.full, st, [], null);
    const id = () => roomClaimId(String(from).slice(0, 40), `old${host._sharedStamp}`, ++host._roomClaimN);   // AUDIT OUTDOOR-LOOT D6: this context's stamp - a new seat's count would meet an answer the last seat left (st.answers), and its verdict came back without moving the state
    const tm = host._wallNow() ?? 0;
    for (const t of d.takes) {
      let left = t.n;
      for (const piece of list) {
        const info = seen.get(piece);
        if (left <= 0) break;
        if (!info || legacySig(piece) !== t.sig) continue;
        left -= judgeRoomClaim(st, base.items.length, base.full, { id: id(), ...(info.p !== undefined ? { p: info.p } : { sp: info.sp }), n: Math.min(left, info.n), tm }, roomAdmit);
      }
    }
    for (const p of d.puts) {
      const stack = Number.isInteger(p.it?.stackCount);
      for (let k = 0; k < (stack ? 1 : p.n); k++) judgeRoomClaim(st, base.items.length, base.full, { id: id(), it: stack ? { ...p.it, stackCount: p.n } : { ...p.it }, tm }, roomAdmit);
    }
    if (d.takes.length || d.puts.length) { composeRoomContainer(canon); roomSayNow(canon, () => verdictWords(canon, [])); }
    return 1;
  }
  /** WORLD4's LIST off the wire about a room container - an older build's word, or a memory written before PARTY-LOOT
   *  (the relay keeps one WORLD_TTL_MS): the room's word in the old law, so it is MIGRATED, never landed over the base:
   *  the room's terms are the earliest any mint can name (generation 0, the first level, minted at nought), every base
   *  piece is gone, and the list is the container's stored pieces - the same state on every client that hears it. */
  function landLegacyList(canon, h, rec) {
    const items = peerHanded(validLootList(rec?.r));
    const _now = host._wallNow();
    if (!items) { if (roomBorn(h) && !respawnDue(rec?.t, _now)) { host._lootSeen.add(canon); host._lootUnreadable.add(canon); } return 0; }
    if (respawnDue(rec.t, _now)) return 0;
    if (!roomBorn(h)) { _roomPending.set(canon, rec); return 0; }
    const terms = { g: 0, lv: 1, n: 1, tm: -1 };
    const base = rollRoomBase(canon, terms);
    if (!base) return 0;
    const st = roomState(terms);
    base.items.forEach((_, i) => st.taken.add(i));
    st.stored = items;
    st.ids = items.map((_, i) => `s:${i}`);   // named by place, as a word without ids names them - the same on every client
    const was = _roomState.get(canon);
    if (was && !roomTermsBeat(terms, was.terms) && !sameRoomTerms(terms, was.terms)) return 1;
    _roomState.set(canon, st);
    host._lootUnreadable.delete(canon);
    host._lootSeen.add(canon);
    if (Number.isFinite(rec.t)) host._lootAt.set(canon, _now == null ? rec.t : Math.min(rec.t, _now));
    composeRoomContainer(canon);
    return 1;
  }
  // ── THE CLAIMS (Mac, 2026-10-15: "Host arbitrates") ──
  // A TAKE OF A SHARED PIECE IS A CLAIM, AND THE ROOM'S HOST GRANTS IT. Two players taking the same piece in the same
  // breath both kept it while each machine took on its own word. Now the room's host - WORLD2's, the seat that runs its
  // foes (`_authority`) - is the one that says who has it: a claim reaching it takes what is left of the piece, the first
  // first, and a later one is told ROOM_TAKEN_TEXT. Whatever door took the piece (the window, the quick door, Physical
  // Items' one-item door), the take is read the same way - against what the list held at its last compose (`_roomSeen`)
  // - by roomSettle: the host judges its own at once (no round trip: alone in a room, or offline, nothing waits), and
  // anyone else takes the piece back out of its pack, claims it, and has it only on the grant - in the meantime it reads
  // as taken for them alone, and on a refusal or after ROOM_CLAIM_TIMEOUT_MS it comes back. A PUT is the host's to land
  // as well, so the stored pieces have one writer. The bonus is never a claim's: it is the player's, at once. Every
  // client keeps the claims it hears until their verdict, so a seat that changes hands judges what the last host left
  // unanswered (roomTakeSeat), in one order whoever takes it.
  /** A piece no peer may be handed (a bound piece, a letter of credit - systems/peerWord.js) never lands as a put. */
  const roomAdmit = (it) => !neverPeerHanded(it);
  /** Whose word the room's state is: the memory's (no sender - the host publishes it), the HOST's - the relay's seat
   *  (opts.roomHost) or the stream this client follows (WORLD2's `_foesFrom`, which an ex-host's last words still name) -
   *  and nobody's else: a peer says claims. With neither known, any word (a room with no seat said yet). */
  function roomHostSaid(from) {
    if (from == null || from === host._foesFrom) return true;
    if (host._authority) return false;
    const seat = opts.roomHost?.() ?? null;
    return seat == null ? host._foesFrom == null : from === seat;
  }
  /** This player's claims in flight on a container, read as taken in its list until the verdict, and its puts. */
  function roomPendingOf(canon, st) {
    const places = new Map(), stored = new Map(), puts = [];
    for (const m of _roomMine.values()) {
      if (m.canon !== canon || !sameMint(m.terms, st.terms)) continue;
      if (m.claim && !m.lapsed) { const k = m.claim.p ?? m.claim.sp, at = m.claim.p !== undefined ? places : stored; at.set(k, (at.get(k) ?? 0) + m.claim.n); }
      else if (m.put && !m.refused) puts.push({ it: m.item, id: m.put.id });
    }
    return { places, stored, puts };
  }
  /** Say a room container's word now, stamped before it is minted (WORLD8; AUDIT WORLD7/8 C1). */
  function roomSayNow(canon, mint = () => roomRecordsOf(canon)) {
    const _t = host._wallNow(); if (_t != null) host._lootAt.set(canon, _t);
    const made = mint();
    const recs = Array.isArray(made) ? made : made ? [made] : [];
    if (!recs.length) return false;
    const first = !host._lootSeen.has(canon);
    host._lootSeen.add(canon);
    if (first) opts.onLootClaimed?.();   // D5: the memory goes out now
    let ok = true;
    for (const rec of recs) ok = !!opts.onActions?.({ k: host._locationKey, l: [rec] }) && ok;   // one act frame a word: each is its own to lose, and to say again
    return ok;
  }
  /** `n` of a piece back out of this player's hands - the very record, or the stack it merged into, in the pack or the
   *  bag; a coin out of the purse. Answers how many it found (a piece used straight off the container is found nowhere). */
  function roomLift(item, n) {
    if (isGoldPieces(item)) { const had = playerEntity.goldPieces ?? 0, t = Math.min(had, n); playerEntity.goldPieces = had - t; return t; }
    let left = n;
    const off = (list, at) => {
      const held = list[at], have = pieceCount(held);
      if (have <= left) { if (isEquipped(held)) unequipItem(playerEntity, held); list.splice(at, 1); left -= have; }
      else { held.stackCount = have - left; left = 0; }
    };
    for (const list of [playerEntity.items, playerEntity.bagItems]) {
      if (!Array.isArray(list) || left <= 0) continue;
      const at = list.indexOf(item);
      if (at >= 0) off(list, at);
      for (let i = list.length - 1; i >= 0 && left > 0; i--) if (list[i] !== item && stacksWith(list[i], item)) off(list, i);
    }
    return n - left;
  }
  /** `n` of a piece into this player's hands: coin to the purse, the rest to the pack (it stacks). */
  function roomGive(item, n) {
    if (n <= 0) return;
    if (!notCarried([item])?.length) return;   // AUDIT AUTO-HOLD: never a piece I carry - a second of it is a copy, my own locked with it (systems/peerWord.js)
    if (isGoldPieces(item)) { addGoldPieces(playerEntity, n); return; }
    addItem((playerEntity.items ??= []), Number.isInteger(item?.stackCount) ? { ...item, stackCount: n } : item);
  }
  /** THE TAKES AND THE PUTS a room container's list shows since its last compose, read against what it held then. A
   *  list some load replaced is no list composed here, and says nothing. Answers whether anything was taken or put. */
  function roomSettle(canon) {
    const seen = _roomSeen.get(canon), h = roomBaseHolder(canon), st = _roomState.get(canon), base = _roomComposed.get(canon)?.base;
    if (!seen || !h || !st || !base || seen.list !== holderList(h)) return false;
    if (_roomStale.has(canon)) return host._lootOpenKey === canon ? false : settleStale(canon, seen);   // a find whose mint lost, read at its window's close
    const here = new Set(seen.list);
    let moved = false;
    for (const [obj, info] of [...seen.at]) {
      const cur = here.has(obj) ? pieceCount(obj) : 0;
      if (cur === info.n) continue;
      moved = true;
      if (cur > info.n) { roomPut(canon, st, base, { ...obj, stackCount: cur - info.n }, null); info.n = cur; continue; }   // laid onto one of the room's stacks
      const k = info.n - cur;
      info.n = cur;
      if (!cur) seen.at.delete(obj);
      roomTake(canon, st, base, obj, info, k);
    }
    for (const obj of seen.list) {
      if (seen.at.has(obj) || isPersonalLoot(obj)) continue;   // the bonus is the player's own - taken and put back at will
      moved = true;
      roomPut(canon, st, base, obj, seen);
    }
    return moved;
  }
  /** OUTDOOR-LOOT: a find's mint LOST while this player's window stood open on it (its tie-break: the other search was earlier by the
   *  relay's clock). What that window took from the roll that never was the room's is lifted back out of the pack and told, what it laid
   *  in comes home; the list is composed afresh from the winner's right after (sayRoomWord). */
  function settleStale(canon, seen) {
    _roomStale.delete(canon);
    const here = new Set(seen.list);
    let said = false;
    for (const [obj, info] of [...seen.at]) {
      const cur = here.has(obj) ? pieceCount(obj) : 0;
      if (cur < info.n) { roomLift(obj, info.n - cur); said = true; }
    }
    for (const obj of seen.list) if (!seen.at.has(obj) && !isPersonalLoot(obj)) roomGive(obj, pieceCount(obj));
    if (said) setMidScreenText(ROOM_TAKEN_TEXT);
    _roomSeen.delete(canon); _roomComposed.delete(canon);
    return false;
  }
  /** `k` of a shared piece taken: the host's judged where it stands (what another was granted first goes back out of
   *  its pack), anyone else's taken back out of the pack and claimed of the host. */
  function roomTake(canon, st, base, obj, info, k) {
    const mine = info.sp != null ? _roomMine.get(info.sp) : null;
    if (mine?.put && mine.refused) { _roomMine.delete(info.sp); return; }   // a put the host refused, taken back: it was never the room's
    const claim = { id: roomClaimId(opts.selfId?.() ?? 'self', host._sharedStamp, ++host._roomClaimN), ...(info.p !== undefined ? { p: info.p } : { sp: info.sp }), n: k, tm: host._wallNow() ?? 0 };
    if (host._authority) {
      const g = judgeRoomClaim(st, base.items.length, base.full, claim, roomAdmit);
      if (g < k) { roomLift(obj, k - g); if (!g) setMidScreenText(ROOM_TAKEN_TEXT); }
      return;
    }
    const give = roomLift(obj, k);
    _roomMine.set(claim.id, { canon, terms: st.terms, claim, item: obj, give, at: host._roomNowMs, saidAt: host._roomNowMs, lapsed: false });
    st.claims.set(claim.id, claim);   // heard here too: a seat that comes to this client judges it with the rest
  }
  /** A piece laid in a room container: the host lands it at once (a refusal comes back once nothing stands open on it);
   *  anyone else's stands in their list as theirs and is said to the host, again until it is answered. */
  function roomPut(canon, st, base, obj, seen) {
    const put = { id: roomClaimId(opts.selfId?.() ?? 'self', host._sharedStamp, ++host._roomClaimN), it: { ...obj }, tm: host._wallNow() ?? 0 };
    if (host._authority) {
      const g = judgeRoomClaim(st, base.items.length, base.full, put, roomAdmit);   // AUDIT OUTDOOR-LOOT D4: the put's own copy is stored, never the window's record - a split of it under the same window took from the judge's record and lost the pieces
      if (g) seen?.at.set(obj, { sp: put.id, n: pieceCount(obj) });
      else { _roomMine.set(put.id, { canon, terms: st.terms, put, item: obj, refused: true }); seen?.at.set(obj, { sp: put.id, n: pieceCount(obj) }); }
      return;
    }
    _roomMine.set(put.id, { canon, terms: st.terms, put, item: obj, saidAt: host._roomNowMs, refused: false });
    st.claims.set(put.id, put);
    seen?.at.set(obj, { sp: put.id, n: pieceCount(obj) });
  }
  /** A verdict on one of this player's own claims or puts: the piece comes to the pack on a grant (no more than came out
   *  of it), a refusal is said (unless a claim of theirs already holds that piece); a refused put comes back. */
  function roomResolve(id, g, canon) {
    const m = _roomMine.get(id);
    if (!m) return;
    if (m.put) {
      if (g) _roomMine.delete(id);
      else m.refused = true;   // back to the pack at the next compose - never from under an open window (AUDIT WORLD4 C1)
      return;
    }
    _roomMine.delete(id);
    const key = `${canon}#${m.terms.g}|${m.claim.p ?? m.claim.sp}`;
    if (g > 0) { roomGive(m.item, Math.min(g, m.give)); _roomWon.add(key); if (_roomWon.size > ROOM_CLAIMS_MAX * 4) _roomWon.delete(_roomWon.values().next().value); }
    else if (!_roomWon.has(key)) setMidScreenText(ROOM_TAKEN_TEXT);
  }
  /** THE HOST GRANTS: every claim and put a container's state holds unanswered, in the order they reached it (or, at a
   *  seat's change, roomClaimOrder's), judged - this player's own landing as any verdict does - then the list composed
   *  and the verdicts said. */
  function roomJudge(canon, st, order = null, reask = []) {
    const base = rollRoomBase(canon, st.terms);
    if (!base || (!st.claims.size && !reask.length)) return false;
    const claims = [...st.claims.values()];
    if (order) claims.sort(order);
    const verdicts = claims.map((cl) => [cl.id, judgeRoomClaim(st, base.items.length, base.full, tooOldToGrant(cl) ? { ...cl, stale: true } : cl, roomAdmit)]);
    for (const id of reask) if (st.answers.has(id) && !verdicts.some(([v]) => v === id)) verdicts.push([id, /** @type {number} */ (st.answers.get(id))]);   // OUTDOOR-LOOT D-2.1: a claim asked again is answered again from the ledger
    for (const [id, g] of verdicts) roomResolve(id, g, canon);
    composeRoomContainer(canon);
    return roomSayNow(canon, () => verdictWords(canon, verdicts));   // the verdicts of THESE claims, in words of ROOM_ANSWERS_KEPT: none pushed out by another claimer's
  }
  /** AUDIT OUTDOOR-LOOT D5: a take claim made more than half of CLAIM_KEEP_MS ago (the shared clock) is refused, never granted - its
   *  claimer gives a claim up at CLAIM_KEEP_MS, and a grant after that (a seat that heard it long ago and takes the seat, or the
   *  claimer's last re-say landing late) moves the piece out of the room for nobody. A claimer still waiting is told and may take again. */
  const tooOldToGrant = (cl) => { const now = host._wallNow(); return !('it' in cl) && now != null && Number.isFinite(cl.tm) && now - cl.tm >= CLAIM_KEEP_MS / 2; };
  /** THE SEAT CHANGES HANDS (setAuthority's handover): what the last host left unanswered is judged here now. */
  function roomTakeSeat() {
    if (!roomLootOn()) return;
    for (const [canon, st] of [..._roomState]) if (st.claims.size) roomJudge(canon, st, roomClaimOrder);
  }
  /** THE CLAIMS' FRAME: every room container's takes and puts read (the host's verdicts said, anyone else's claims), a
   *  claim with no verdict past ROOM_CLAIM_TIMEOUT_MS let go - its piece back in the list, its verdict still landed if it
   *  comes late - and a put with none said again. */
  function roomClaimTick(nowMs) {
    host._roomNowMs = nowMs;
    if (!roomLootOn() || host._roomMintHold) return;
    const due = new Set();
    for (const canon of [..._roomSeen.keys()]) if (roomSettle(canon)) due.add(canon);
    for (const m of _roomMine.values()) {
      if (m.claim && !m.lapsed && nowMs - m.at >= ROOM_CLAIM_TIMEOUT_MS) { m.lapsed = true; composeRoomContainer(m.canon); }
      if (host._authority || m.refused || nowMs - m.saidAt < ROOM_PUT_RESAY_MS) continue;
      m.saidAt = nowMs; due.add(m.canon);   // OUTDOOR-LOOT D-2.1: a claim with no verdict is said AGAIN, as a put is - a lapsed one too, which the host may still grant (a dropped word lost the piece)
    }
    for (const canon of due) roomSayNow(canon);
    for (const [id, m] of [..._roomMine]) if (m.claim && nowMs - m.at >= CLAIM_KEEP_MS) { _roomMine.delete(id); _roomState.get(m.canon)?.claims.delete(id); }   // given up: nothing lands after it, and nothing dupes - and out of the claims heard here, or this client taking the seat would grant it and the piece leave the room for nobody (interiorRoomLoot.js does the same)
    const lapsed = [..._roomMine].filter(([, m]) => m.lapsed);
    for (const [id] of lapsed.slice(0, Math.max(0, lapsed.length - CLAIMS_KEPT_MAX))) _roomMine.delete(id);
  }
  /** THE MINT: a room container's terms, once - its generation, the party's level (roomLoot.js roomBaseLevel off the
   *  outer host's party levels, the poses' `cl`), the fight's count for a body, the relay's clock - landed here and said
   *  to the room with the body's life adds as its stored pieces. */
  function mintRoomTerms(canon, g) {
    const h = roomBaseHolder(canon);
    if (!h || !roomBorn(h) || _roomState.has(canon)) return false;
    const lv = roomBaseLevel(playerEntity?.level ?? 1, opts.partyLevels?.() ?? []);
    const n = h.foe ? Math.max(1, Math.min(8, (_sharedFoe(h.foe) ? fightN(h.foe) : 1) | 0)) : 1;
    const adds = h.foe ? lifeAddsOf(h.foe) : [];
    const w = { g: Math.max(0, Math.trunc(Number(g) || 0)), lv, n, tm: host._wallNow() ?? 0, x: [], c: [], s: adds };
    const base = rollRoomBase(canon, w);
    if (!base) return false;
    const { state } = mergeRoomWord(null, { ...w, h: base.h });
    _roomState.set(canon, state);
    _roomUnbornAt.delete(canon);
    _roomNextGen.delete(canon);
    composeRoomContainer(canon);
    return roomSayNow(canon, () => roomStateWord(canon, false));   // the BIRTH: its terms and its stored pieces, whoever minted (a claimer says no state but this)
  }
  /** OUTDOOR-LOOT: THE BIRTH AT THE SEARCH (DESIGN 5.2). A searched object's find is rolled once, by its searcher, on the searcher's own
   *  level, gender, Luck and dice - nobody can compute it - so it is MINTED here: its records are the container's carried base, its
   *  generation the search's period (`minute` the shared world minute, over SEARCH_COOLDOWN_MINUTES: a new search after the five hours
   *  is a newer mint, two in one breath are one period and the earlier by the relay's clock wins), and said to the room as the birth.
   *  From then on the room's word is takes against it. An outcome of nothing, or a foe, is a birth with an empty base. Answers whether
   *  it is handled (false: offline, or no such object - the caller says WORLD4's whole list, as it always did). */
  function searchFound(i, find, minute) {
    const canon = `srch:${i}`;
    const h = roomBaseHolder(canon);
    if (!h || !roomLootOn()) return false;
    const records = peerHanded(Array.isArray(find) ? find : []).slice(0, SEARCH_LOOT_MAX).map((it) => ({ ...it }));
    const w = { g: Number.isFinite(minute) ? Math.max(0, Math.floor(minute / SEARCH_COOLDOWN_MINUTES)) : 0, lv: 1, n: 1, tm: host._wallNow() ?? 0, h: baseSignature(records), b: records, x: [], c: [], s: [] };
    const was = _roomState.get(canon) ?? null;
    const { state } = mergeRoomWord(was, w);
    if (state === was) { composeRoomContainer(canon); return true; }   // a find of this period that beat this one is the room's: AUDIT OUTDOOR-LOOT D2 - the room's list is composed back over the roll the search wrote in place (left there, every room piece read as a take granted to nobody)
    _roomState.set(canon, state);
    _roomSearcher.set(canon, host.searchRoom.fields(h.search));
    _roomSees.add(canon);
    host._lootUnreadable.delete(canon);
    if (was) dropOldMint(canon, state);
    composeRoomContainer(canon);
    return roomSayNow(canon, () => roomStateWord(canon, false));   // the BIRTH: its terms, its records, its searcher
  }
  /** A body has fallen here: the room's word for it lands (one that came first), else the host mints its terms, else it
   *  holds nothing until the room's word comes - none of this copy's own roll is the room's. */
  function roomBodyBorn(f) {
    if (!roomLootOn()) return;
    const canon = roomCanonOfFoe(f);
    if (!canon || !isRoomBaseContainer(canon)) return;
    const pend = _roomPending.get(canon);
    if (pend) { _roomPending.delete(canon); landRoomWord(canon, pend.rec, pend.from); }
    if (_roomState.has(canon)) { composeRoomContainer(canon); return; }
    if (host._authority && !host._roomMintHold) { mintRoomTerms(canon, Number.isFinite(f._diedAt) ? f._diedAt : 0); return; }
    f.entity.items.length = 0;   // UNBORN holds nothing: this copy's own roll is no reader's (LOOT11's light, Hunting's body key, the save); the sweep counts its wait from here (mintUnbornRoom)
  }
  /** OUTDOOR-LOOT: a search find the room lets go at its hour (WORLD8's sweep), once it is emptied. Answers whether `h` (the canon's
   *  holder) was a find. */
  function letFindGo(canon, h) {
    if (!h?.search) return false;
    const st = _roomState.get(canon), base = st ? rollRoomBase(canon, st.terms) : null;
    if (st && base && !roomEmptied(st, base.items.length)) return true;   // AUDIT OUTDOOR-LOOT D3: a find still holding pieces stays the room's - let go, its list stood on every machine unshared and two partymates each took the same piece; a new search's mint is its next life, as an emptied pile's
    host._lootSeen.delete(canon); host._lootAt.delete(canon); forgetRoomContainer(canon);
    return true;
  }
  /** The room's bookkeeping for a container forgotten (a body stood up again, a pile's life over). */
  function forgetRoomContainer(canon) {
    _roomState.delete(canon); _roomBase.delete(canon); _roomBonus.delete(canon); _roomComposed.delete(canon);
    _roomUnbornAt.delete(canon); _roomPending.delete(canon); _roomSeen.delete(canon);
    _roomSees.delete(canon); _roomSearcher.delete(canon); _roomStale.delete(canon);
  }
  /** THE SWEEP'S HALF (once a second, beside WORLD8's): every room container standing here with no terms gets them -
   *  the host's at once for a body, after ROOM_TERMS_WAIT_HOST_MS for a pile (the room's memory comes first); another
   *  client's only after ROOM_TERMS_WAIT_PEER_MS with no word (an older host, a dropped frame) - two such mints agree by
   *  roomTermsBeat. A pile's generation is the room's emptying stamp after WORLD8's hour, else 0; a body's its death. */
  function mintUnbornRoom(nowMs) {
    if (!roomLootOn() || host._roomMintHold) return;
    const wait = host._authority ? ROOM_TERMS_WAIT_HOST_MS : ROOM_TERMS_WAIT_PEER_MS;
    const due = (canon) => {
      if (!_roomUnbornAt.has(canon)) { _roomUnbornAt.set(canon, nowMs); return false; }
      return nowMs - _roomUnbornAt.get(canon) >= wait;
    };
    host.lootPiles.forEach((p, i) => {
      const canon = `loot:${i}`;
      if (_roomState.has(canon) || host._lootUnreadable.has(canon) || canon === host._lootOpenKey || !due(canon)) return;
      mintRoomTerms(canon, _roomNextGen.get(canon) ?? 0);
    });
    for (const f of foes) {
      if (!lootableBody(f)) continue;
      const canon = roomCanonOfFoe(f);
      if (!canon || _roomState.has(canon) || host._lootUnreadable.has(canon) || canon === host._lootOpenKey) continue;
      if (host._authority || due(canon)) mintRoomTerms(canon, Number.isFinite(f._diedAt) ? f._diedAt : 0);
    }
  }
  return { _roomBase, _roomMine, _roomNextGen, _roomState, composeRoomContainer, forgetRoomContainer, holderList, isRoomBaseContainer, landRoomWord, letFindGo, lootBuiltOf, mintUnbornRoom, roomBaseHolder, roomBodyBorn, roomCanonOfFoe, roomClaimTick, roomGive, roomLootOn, roomRecordOf, roomRecordsOf, roomSayNow, roomSettle, roomTakeSeat, roomUnborn, searchFound, settleRoomBonus };
}
