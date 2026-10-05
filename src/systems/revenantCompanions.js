// @ts-check
// REVENANT-COMPANION (2026-10-02, Mac: "Spare should allow you to free the enemy, which then adds them as a companion,
// which you could keep send them away or keep them with you. Reuse the crew companion system. Companion slots should
// still be limited") - THE SWORN. A revenant the player spares is sworn to the player for good: it hunts nobody, and it
// walks at the player's side - or waits, sent away, until it is called.
//
//  - ONE LAYER: the crew's (scenes/crewAshore.js) stands them, places them, brings them along through every door, keeps
//    them to the player's heel, catches one up that falls behind, and carries their health and spells between places.
//    This file is that layer's PARTY for the sworn - the crew's own party shape (systems/naval/crewCompanions.js): who
//    walks ashore, a knock, a hurt - kept in the revenant's own record (systems/revenant.js `companion`), so it rides the
//    character's save and app storage with everything else the revenant is.
//  - THE PLAYER'S SIDE HAS SLOTS (systems/companionSlots.js COMPANION_SLOTS, the crew's hands ashore counted with
//    them). A spared one past them is sworn all the same and waits AWAY until there is room and the player calls it.
//  - AT MOST REVENANT_RETINUE_MAX sworn at once, with the player and away together; past it the player must release
//    one before sparing another.
//  - KNOCKED OUT it is carried off to rest, as a hand is carried aboard: REVENANT_REST_MIN of the character's minutes,
//    then it waits, fit again, to be called.
//  - RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.1): ITS LOYALTY (the record's `companion.loyalty`, 0-100) moves with how
//    it is kept - a fight won at the player's side, a day with the player, a call after its rest; a day sent away, a
//    fall, a second sending-away in a day, one of its own kind executed in its sight. Devoted (90 and up), it strikes
//    harder and warns of a blow from behind.
import { swornRevenants, revenantCompanionUpdate, revenantRecord, REVENANT_HEALTH_PER_RANK, REVENANT_DAMAGE_PER_RANK, setSwornLeftListener, revenantBetrays } from './revenant.js';
import { registerCompanionCount, companionsWithYou, COMPANION_SLOTS } from './companionSlots.js';
import { addItem, addGoldPieces, isGoldPieces } from './inventory.js';   // a released one's pack, handed back
import { LOYALTY, DEVOTED, movedLoyalty, isDevoted, sameKin, BETRAY, mayBetray } from './revenantFeud.js';
import { registerPlayerHurtListener } from '../characters/playerEntity.js';   // RVN11c: the hurt that leaves me under a quarter   // RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.1): its loyalty
import { MINUTES_PER_DAY } from './gameDate.js';   // RVN11: "twice in a day"
import { ownMinutes } from './worldTick.js';

/** How many revenants may be sworn to the player at once - with it and away. */
export const REVENANT_RETINUE_MAX = 6;
/** How long a sworn one knocked out rests before it can be called again - the character's minutes (8 hours). */
export const REVENANT_REST_MIN = 8 * 60;
/** A sworn one's key in the companion layer (crewAshore.js companionKeyOf) - never a boat's. */
export const revenantCompanionKey = (id) => `rv:${id}`;
export const isRevenantCompanionKey = (k) => typeof k === 'string' && k.startsWith('rv:');
export const revenantIdOfKey = (k) => (isRevenantCompanionKey(k) ? k.slice(3) : null);

let _player = null;
/** @type {((kind: 'arrive'|'dismiss'|'release'|'betray', r: any, extra?: { items?: number } | null) => void) | null} */
let _listener = null;
/** The host's ear for the roster's acts (its portal's words as the body steps through - ui/companionRoster.js). */
export function setRetinueListener(fn) { _listener = typeof fn === 'function' ? fn : null; }
const tell = (kind, r, extra = null) => { try { _listener?.(kind, r, extra); } catch { /* a word is nobody's failure */ } };
/** @type {((id: string) => any) | null} */
let _bodies = null;
/** The host's answer to "where does this sworn one stand now" - its live entity (the roster's health bar). */
export function setRetinueBodies(fn) { _bodies = typeof fn === 'function' ? fn : null; }
/** A sworn one's live body's entity, where one stands, else null. */
export const swornBodyOf = (id) => { try { return _bodies?.(id) ?? null; } catch { return null; } };
/** The player whose sworn these are (the host's, once it stands one). */
export function setRetinuePlayer(player) { _player = player ?? null; }

const stateOf = (r) => r?.companion?.state ?? 'with';
/** The sworn, every one, the strongest first. */
export const retinue = () => swornRevenants().slice().sort((a, b) => b.rank - a.rank || (a.swornAt ?? 0) - (b.swornAt ?? 0));
/** The sworn walking with the player. */
export const revenantsWithYou = () => swornRevenants().filter((r) => stateOf(r) === 'with');
/** The sworn sent away, or resting after a fall. */
export const revenantsAway = () => swornRevenants().filter((r) => stateOf(r) !== 'with');
registerCompanionCount('revenant', () => revenantsWithYou().length);

/** May the player spare one more - a place in the retinue? */
export const retinueHasRoom = () => swornRevenants().length < REVENANT_RETINUE_MAX;
/** Where a newly spared one goes: at the player's side while a slot is free, else away. */
export const swornPlace = () => (companionsWithYou() < COMPANION_SLOTS ? 'with' : 'away');

/** AUDIT (2026-10-02): when a resting one is fit - never more than a rest away. The record outlives a load, and an older
 *  save's clock stands earlier than the minute the fall was stamped on: its eight hours read as days. */
export function restUntil(r, now) {
  let until = r?.companion?.until ?? 0;
  if (stateOf(r) === 'resting' && Number.isFinite(now) && until - now > REVENANT_REST_MIN) {
    until = now + REVENANT_REST_MIN;
    r.companion.until = until;
    // Keep the correction in the save and device mirror. Merely clamping the returned value
    // moves the eight-hour deadline forward on every frame and never completes that rest.
    if (_player && r.id && revenantRecord(_player, r.id) === r) {
      revenantCompanionUpdate(_player, r.id, (c) => { c.until = until; });
    }
  }
  return until;
}
/** AUDIT (2026-10-02): a sworn one's body held back a moment (wall ms) - the kneeling one still gathering into its portal
 *  as the oath is given: the layer stood the companion beside it, two of it for the oath's length. */
const _heldUntil = new Map();
export function holdSworn(id, ms) { if (id) _heldUntil.set(id, Date.now() + ms); }
const held = (id) => { const t = _heldUntil.get(id); if (t == null) return false; if (Date.now() < t) return true; _heldUntil.delete(id); return false; };
/** AUDIT (2026-10-02): a member is one stand's - a fall, a sending-away, a release or a load ends it, and its carried
 *  spells with it (the layer keeps those on the member: the crew's hands come ashore new each time, a sworn one did not,
 *  so a poison it wore when it fell stood with it again eight hours later). */
export function forgetSwornMember(id = null) { if (id == null) { _members.clear(); _heldUntil.clear(); } else _members.delete(id); }
/** Why a sworn one cannot come to the player's side now - words for the roster - or null: it may. */
export function callRefusal(r, now) {
  if (!r?.sworn) return 'It is no longer sworn to you.';
  if (stateOf(r) === 'with') return null;
  if (stateOf(r) === 'resting' && now < restUntil(r, now)) return 'Still recovering.';
  if (companionsWithYou() >= COMPANION_SLOTS) return `Your companions are full (${COMPANION_SLOTS}).`;
  return null;
}
/** CALLED to the player's side (the roster's Call): answers the refusal's words, or null when it comes. RVN11: the first
 *  call after its rest, +10. */
export function callRevenant(id, now) {
  const r = revenantRecord(_player, id);
  const why = callRefusal(r, now);
  if (why) return why;
  revenantCompanionUpdate(_player, id, (c) => {
    c.state = 'with'; c.until = null;
    if (c.rested) { c.rested = false; c.loyalty = movedLoyalty(c.loyalty, LOYALTY.CALLED); }
  });
  tell('arrive', r);
  return null;
}
/** SENT AWAY (the roster's Send away): it leaves the player's side through its portal, and waits to be called. RVN11:
 *  sent by the player (`byYou` - never the slots' own hold) a second time in a day (the character's), -10. */
export function sendRevenantAway(id, { now = Math.floor(ownMinutes()), byYou = true } = {}) {
  const r = revenantRecord(_player, id);
  if (!r?.sworn || stateOf(r) !== 'with') return false;
  revenantCompanionUpdate(_player, id, (c) => {
    c.state = 'away';
    if (!byYou) return;
    const day = Math.floor(now / MINUTES_PER_DAY);
    if (c.sentDay === day) c.loyalty = movedLoyalty(c.loyalty, LOYALTY.SENT_TWICE);
    c.sentDay = day;
  });
  forgetSwornMember(id);
  tell('dismiss', r);
  return true;
}
/** RELEASED (the roster's Release, confirmed): its oath given back - it leaves for good. */
export function releaseRevenant(id) {
  const r = revenantRecord(_player, id);
  if (!r?.sworn) return null;
  // AUDIT (2026-10-02): ITS PACK IS HANDED BACK - the release closed the record with whatever the player had stored in
  // it, gone for good. Into the player's own pack, every item (the crew's hand-off stows a pack in the hold the same way)
  const items = (r.companion?.items ?? []).slice();
  const out = revenantCompanionUpdate(_player, id, () => 'release');
  forgetSwornMember(id);
  if (out && items.length && _player) {
    _player.items ??= [];
    for (const it of items) { if (isGoldPieces(it)) addGoldPieces(_player, it.stackCount ?? 1); else addItem(_player.items, it); }   // gold to the purse (never a Currency row), the player's own - no loot word
  }
  if (out) tell('release', out, { items: items.length });
  return out;
}

/** A sworn one's whole and blows over the body a place stands for it: its rank's, as it fought the player with. Its
 *  health once - a body standing with a carried whole (crewAshore) keeps it. */
export function applySwornStrength(entity, r, { fresh = true } = {}) {
  if (!entity || !r) return;
  const rank = Math.max(1, r.rank | 0);
  if (fresh) {
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * (1 + REVENANT_HEALTH_PER_RANK * rank)));
    entity.healthMult = (entity.healthMult ?? 1) * (1 + REVENANT_HEALTH_PER_RANK * rank);   // TELL1: what was stood on the kind's own health (its poise)
    entity.health = entity.maxHealth;
  }
  entity.damageScale = (1 + REVENANT_DAMAGE_PER_RANK * rank) * (isDevoted(r.companion?.loyalty) ? DEVOTED.BLOWS : 1);   // RVN11 (22.1): a Devoted one's blows
  entity.revenant = { id: r.id, name: r.name, rank, sworn: true };   // FOE-TITLE: called by its own name everywhere
}

// ── THE PARTY, in the crew's shape (crewAshore.js reads `party`, `wake`, `knock`, `hurt`, `isAshore`) ──────────────
/** @type {Map<string, any>} - one member object per sworn one, kept: the layer keys its carried spells and its follow
 *  slot on the object itself */
const _members = new Map();
function memberOf(r) {
  let m = _members.get(r.id);
  if (!m) { m = { boat: 'rv', name: r.id, key: revenantCompanionKey(r.id) }; _members.set(r.id, m); }
  m.title = r.name;
  m.mobile = r.mobileType;
  m.gender = r.gender;
  m.health = r.companion?.health ?? null;
  m.maxHealth = r.companion?.maxHealth ?? null;
  m.items = r.companion?.items ?? [];
  m.rank = r.rank;
  m.personality = r.personality;
  return m;
}
/**
 * The sworn as the companion layer's party. `onWake(r)` - one fit again after its rest (the roster's word).
 */
export function revenantParty({ onWake = null } = {}) {
  return {
    get party() { return revenantsWithYou().filter((r) => !held(r.id)).map(memberOf); },
    wake(now) {
      for (const r of swornRevenants()) {
        if (stateOf(r) === 'resting' && now >= restUntil(r, now)) {
          revenantCompanionUpdate(_player, r.id, (c) => { c.state = 'away'; c.until = null; c.health = null; c.rested = true; });   // RVN11: its next call after this rest +10
          onWake?.(r);
        }
      }
    },
    knock(boat, id, now) {
      const r = revenantRecord(_player, id);
      if (!r?.sworn || stateOf(r) !== 'with') return false;
      revenantCompanionUpdate(_player, id, (c) => { c.state = 'resting'; c.until = now + REVENANT_REST_MIN; c.health = null; c.loyalty = movedLoyalty(c.loyalty, LOYALTY.KNOCKED); });   // RVN11: a fall -8
      forgetSwornMember(id);
      return true;
    },
    hurt(boat, id, health, maxHealth) {
      const r = revenantRecord(_player, id);
      const c = r?.companion;
      if (!c || (c.health === health && c.maxHealth === maxHealth)) return;
      // the body's own numbers, kept without a revision each frame: the save reads them, and the next stand does
      c.health = Number.isFinite(health) && health > 0 ? Math.min(health, maxHealth || health) : null;
      c.maxHealth = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : null;
    },
    isAshore(boat, id) { const r = revenantRecord(_player, id); return !!r?.sworn && stateOf(r) === 'with'; },
    /** Its pack (the companion's storage), as the crew's is - the record's own list. */
    packOf(id) { const r = revenantRecord(_player, id); return r?.sworn ? (r.companion.items ??= []) : null; },
  };
}
// ── RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.1): loyalty's moves from a fight ──────────────
/** A sworn one's FIGHT, frame by frame on its body (`rec`, the layer's): begun when it takes a target, WON on the frame
 *  it stands with none standing and the last it fought is down (a target that walked off, or one still standing, is no
 *  win; a target held after its death is none). Answers true on that frame. */
export function swornFightStep(rec) {
  const t = rec?.ai?.target;
  const tgt = t?.entity && !t.dead && t.entity.health > 0 ? t : null;
  if (tgt) { rec._fightLast = tgt; return false; }
  const last = rec?._fightLast ?? null;
  if (!last) return false;
  rec._fightLast = null;
  return !(last.entity?.health > 0);   // AUDIT FEUD: killed - a foe that escaped, was culled or scattered is `dead` with its health
}
/** A fight won at the player's side: +3. */
export function swornFightWon(id) {
  return revenantCompanionUpdate(_player, id, (c) => { c.loyalty = movedLoyalty(c.loyalty, LOYALTY.WON); });
}
/** ONE OF ITS OWN KIND EXECUTED IN ITS SIGHT (systems/revenantFate.js finishExecution - `mobileType` the executed's): each
 *  sworn one at the player's side whose body stands here (the layer keeps it at the heel - decided here: in its sight)
 *  and is of the same kind or faction, -15. Answers those it cost. */
export function swornWitness(mobileType) {
  const out = [];
  for (const r of revenantsWithYou()) {
    if (!sameKin(r.mobileType, mobileType) || !(swornBodyOf(r.id)?.health > 0)) continue;
    if (revenantCompanionUpdate(_player, r.id, (c) => { c.loyalty = movedLoyalty(c.loyalty, LOYALTY.KIN_EXECUTED); })) out.push(r);
  }
  return out;
}
/** A Devoted one at the player's side whose body stands here - its warning's voice - or null. */
export const devotedWithYou = () => revenantsWithYou().find((r) => isDevoted(r.companion?.loyalty) && swornBodyOf(r.id)?.health > 0) ?? null;
// RVN11b (Feud-Arc.md 22.2): a deserter's member forgotten - its carried spells are no next oath's
setSwornLeftListener((id) => forgetSwornMember(id));
/** RVN11c (bible/12-Enhanced-AI/Feud-Arc.md 22.3): THE BETRAYAL'S MOMENT - a hurt that leaves me (alive) under
 *  BETRAY.HEALTH: the first sworn one at my side that may betray (mayBetray) and whose body stands here turns - its record
 *  first (systems/revenant.js revenantBetrays), then the host told ('betray'), which stands it hostile where it stood. One
 *  a hurt. */
export function betrayalStep(entity, after) {
  if (!entity?.isPlayer || entity.peer || !(after > 0) || after >= (entity.maxHealth || 1) * BETRAY.HEALTH) return null;
  const r = revenantsWithYou().find((x) => mayBetray(x) && swornBodyOf(x.id)?.health > 0);
  const t = r ? revenantBetrays(entity, r) : null;
  if (t) tell('betray', t);
  return t;
}
registerPlayerHurtListener('sworn-betrayal', (entity, { after } = /** @type {any} */ ({})) => { betrayalStep(entity, after); });
/** Tests only. */
export function _resetRetinueForTests() { _members.clear(); _heldUntil.clear(); _player = null; _listener = null; _bodies = null; }
