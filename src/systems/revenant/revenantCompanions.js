// @ts-check
// REVENANT-COMPANION (2026-10-02, Mac: "Spare should allow you to free the enemy, which then adds them as a companion,
// which you could keep send them away or keep them with you. Reuse the crew companion system. Companion slots should
// still be limited") - THE SWORN. A revenant the player spares is sworn to the player for good: it hunts nobody, and it
// walks at the player's side - or waits, sent away, until it is called.
//
//  - ONE LAYER: the crew's (scenes/crewAshore.js) stands them, places them, brings them along through every door, keeps
//    them to the player's heel, catches one up that falls behind, and carries their health and spells between places.
//    This file is that layer's PARTY for the sworn - the crew's own party shape (systems/naval/crewCompanions.js): who
//    walks ashore, a knock, a hurt - kept in the revenant's own record (systems/revenant/revenant.js `companion`), so it rides the
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
//  - RVN-STARS (bible/06-Systems/Revenants.md section 44): ITS STARS (systems/revenant/revenantStars.js) - its level earned
//    here (a fight won at my side, swornFightWon; an errand home, once an errand, returnFromErrand), its sky set from the
//    page (setSwornStars - never abroad), and read where its numbers are: its health and blows (applySwornStrength), its
//    loyalty's losses and its rests (each site below).
import { wildHere, WILD_TEXT } from '../wild/wildZone.js';   // PVPDUNGEONS (the owner: "Only 1 revenant allowed to summon in the zone"); COMPANION-DROP: the zone's words
// PVPDUNGEONS: how many sworn revenants may stand at the player's side in the open zone - COMPANION-DROP: and which ones
// (wildSwornAtSide), so the zone stands the ones whose packs drop; the drop's law reads the same leaf (wildLeaf.js - no
// imports, so standing a revenant never pulls the drop law's graph, the item law among it, into a client's)
import { WILD_REVENANTS_MAX, wildSwornAtSide } from '../wild/wildLeaf.js';
export { WILD_REVENANTS_MAX };
import { swornRevenants, revenantCompanionUpdate, revenantRecord, setSwornLeftListener, revenantBetrays, revenantPerson, revenantMomentEvent, revenantEvent, revenantSay } from './revenant.js';   // FB1012d ALLY-RACE: its person
import { registerCompanionCount, companionsWithYou, COMPANION_SLOTS } from '../companionSlots.js';
import { addItem, addGoldPieces, isGoldPieces } from '../inventory.js';   // a released one's pack, handed back
import { LOYALTY, DEVOTED, movedLoyalty, isDevoted, sameKin, BETRAY, mayBetray } from './revenantFeud.js';
import { registerPlayerHurtListener } from '../../characters/playerEntity.js';   // RVN11c: the hurt that leaves me under a quarter   // RVN11 (bible/12-Enhanced-AI/Feud-Arc.md 22.1): its loyalty
import { MINUTES_PER_DAY } from '../gameDate.js';   // RVN11: "twice in a day"
import { ownMinutes, raisedMinutes, sharedClockOn, trustedWorldMinutes, sharedClockHeardMark } from '../worldTick.js';   // AUDIT RVN F1: an errand on the lived step; OFFLINE-ROAD: online, on the world's
import { applySwornGear, gearKeyOf, gearRefusal, gearItems, isGearKey } from './revenantGear.js';   // RVN-GEAR: its kit
import { ERRAND, errandPlace, newErrand, errandUntil, errandOnWorld, errandWorldMinute, errandStep, errandHaul, deliverHaul, errandHaulWords, errandWords, errandLeftWords } from './revenantErrands.js';   // RVN-ERRAND: one abroad
import { swornArtStep, swornMendStep, forgetSwornArt } from './revenantArts.js';   // RVN-ARTS: its art, for me
import { playerDoor } from '../playerDoor.js';   // RVN-ARTS: the scene its art reaches through
import { rvnStatsOf, rvnStatScale, rvnLoyaltyMove, rvnRestMinutes, rvnXpWon, rvnXpErrand, rvnStarsOf, rvnHeldStars, rvnXpOf, RVN_XP } from './revenantStars.js';   // RVN-STARS: its sky
import { PAID_KEEP } from './revenant.js';   // AUDIT RVN-STARS S4: the errands' seeds kept as paid
import { t } from '../textManager.js';   // L10N4: RVN-GEAR's and RVN-ERRAND's words through the text core
import { popupMessage } from '../notify.js';   // RVN-ERRAND: an errand's words where the card is not drawn (the line every skin draws)
import { equipTableOf } from '../equip.js';   // RVN-GEAR: never a piece the player wears

/** How many revenants may be sworn to the player at once - with it and away. */
export const REVENANT_RETINUE_MAX = 6;
/** How long a sworn one knocked out rests before it can be called again - the character's minutes (8 hours). */
export const REVENANT_REST_MIN = 8 * 60;
/** A SWORN ONE'S RANK, over the body its place stands for it: health and blows a rank (applySwornStrength). UNQUIET
 *  (bible/06-Systems/Revenants.md section 46): its own - a hostile revenant's grew heavier ("harder", revenant.js
 *  REVENANT_HEALTH_PER_RANK 0.4, REVENANT_DAMAGE_PER_RANK 0.15) and a sworn one's stays as it was, the companions' balance
 *  (RVN-STARS section 44's measure) untouched. */
export const SWORN_HEALTH_PER_RANK = 0.25;
export const SWORN_DAMAGE_PER_RANK = 0.1;
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
/** COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in zone"): THE SWORN AT THE
 *  PLAYER'S SIDE - every one walking with them, and in the open zone the ones it stands (wildDropLaw.js wildSwornAtSide:
 *  the first WILD_REVENANTS_MAX - the rest wait outside it). A death in the zone drops their packs and kits with mine
 *  (wildDropLaw.js wildPacks), so none of them leaves my side there (leaveRefusal). */
export const swornAtYourSide = () => (wildHere() ? wildSwornAtSide(revenantsWithYou()) : revenantsWithYou());
/** COMPANION-DROP: why a sworn one may not leave my side now - sent away or on an errand - or null: the one at my side in
 *  the open zone stays (the zone's teleport refusal, said of a companion). */
export const leaveRefusal = (r) => (wildHere() && swornAtYourSide().includes(r) ? WILD_TEXT.companionStays(r.name) : null);
registerCompanionCount('revenant', () => revenantsWithYou().length);

/** May the player spare one more - a place in the retinue? */
export const retinueHasRoom = () => swornRevenants().length < REVENANT_RETINUE_MAX;
/** Where a newly spared one goes: at the player's side while a slot is free, else away. */
export const swornPlace = () => (companionsWithYou() < COMPANION_SLOTS ? 'with' : 'away');

/** AUDIT (2026-10-02): when a resting one is fit - never more than a rest away. The record outlives a load, and an older
 *  save's clock stands earlier than the minute the fall was stamped on: its eight hours read as days. */
export function restUntil(r, now) {
  let until = r?.companion?.until ?? 0;
  const most = rvnRestMinutes(r, REVENANT_REST_MIN);   // AUDIT RVN-STARS S27: its own rest, as its sky shortens it
  if (stateOf(r) === 'resting' && Number.isFinite(now) && until - now > most) {
    until = now + most;
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
/** RVN-ERRAND: the words an errand owes - said at the party's next frame (the menu shut: the layer runs no frame under a
 *  window), through its card, else the line every skin draws. */
const _errandWords = [];
/** RVN-STARS: the level of the foe each sworn one last beat (swornFightStep - read once by swornFightWon). */
const _wonLevel = new Map();
/** AUDIT RVN-STARS S16: an errand's level words, said after its back card (the party's wake). */
const _levelLines = [];
/** AUDIT RVN F1: the own clock's and the raises' readings at the party's last wake (null: none yet this session - the
 *  first wake only samples), and the part of a minute pushed but not yet written (an errand's minute is whole). */
let _errandClock = null;
let _errandOwed = 0;
/** AUDIT FB1021 L3-1: the monotonic clock an errand's world reading is held to (performance.now's ms; a test's own). */
let _monotonic = () => performance.now();
export function _setErrandMonotonicForTests(fn = null) { _monotonic = typeof fn === 'function' ? fn : () => performance.now(); }
/** AUDIT FB1021 L3-1: the world's minute an errand reads now - the trusted reading, held to the monotonic time since the
 *  relay's clock was last heard (revenantErrands.js errandWorldMinute); NaN before it is heard. */
export const errandWorldNow = () => errandWorldMinute(trustedWorldMinutes(), sharedClockHeardMark(), _monotonic());
export function holdSworn(id, ms) { if (id) _heldUntil.set(id, Date.now() + ms); }
const held = (id) => { const t = _heldUntil.get(id); if (t == null) return false; if (Date.now() < t) return true; _heldUntil.delete(id); return false; };
/** AUDIT (2026-10-02): a member is one stand's - a fall, a sending-away, a release or a load ends it, and its carried
 *  spells with it (the layer keeps those on the member: the crew's hands come ashore new each time, a sworn one did not,
 *  so a poison it wore when it fell stood with it again eight hours later). */
export function forgetSwornMember(id = null) { if (id == null) { _members.clear(); _heldUntil.clear(); _errandWords.length = 0; _levelLines.length = 0; _wonLevel.clear(); _errandClock = null; _errandOwed = 0; forgetSwornArt(); } else _members.delete(id); }   // RVN-ERRAND: a load forgets the words owed, and the clock's last reading (AUDIT RVN F1)
/** Why a sworn one cannot come to the player's side now - words for the roster - or null: it may. */
export function callRefusal(r, now) {
  if (!r?.sworn) return 'It is no longer sworn to you.';
  if (stateOf(r) === 'with') return null;
  if (stateOf(r) === 'resting' && now < restUntil(r, now)) return 'Still recovering.';
  if (stateOf(r) === 'errand') return t('rvn.errand.callAbroad', 'Abroad, {left}.', { left: errandLeftWords(errandUntil(r.companion.errand, now), now, sharedClockOn()) });   // RVN-ERRAND
  if (wildHere() && revenantsWithYou().length >= WILD_REVENANTS_MAX) return 'Only one revenant may walk at your side in the Wrothgarian Mountains.';   // PVPDUNGEONS
  if (companionsWithYou() >= COMPANION_SLOTS) return `Your companions are full (${COMPANION_SLOTS}).`;
  return null;
}
/** CALLED to the player's side (the roster's Call): answers the refusal's words, or null when it comes. RVN11: the first
 *  call after its rest, +10 - AUDIT RVN-STARS S15: less by its `rest` share, as its rest was (a shorter rest is a shorter
 *  bonus: the Oath's path made a fall and a call net +6 every four hours, three times the bare +2 every eight). */
export function callRevenant(id, now) {
  const r = revenantRecord(_player, id);
  const why = callRefusal(r, now);
  if (why) return why;
  revenantCompanionUpdate(_player, id, (c) => {
    c.state = 'with'; c.until = null;
    if (c.rested) { c.rested = false; c.loyalty = movedLoyalty(c.loyalty, Math.round(LOYALTY.CALLED * (1 - rvnStatsOf(r).rest))); }
  });
  tell('arrive', r);
  return null;
}
/** SENT AWAY (the roster's Send away): it leaves the player's side through its portal, and waits to be called. RVN11:
 *  sent by the player (`byYou` - never the slots' own hold) a second time in a day (the character's), -10. */
export function sendRevenantAway(id, { now = Math.floor(ownMinutes()), byYou = true } = {}) {
  const r = revenantRecord(_player, id);
  if (!r?.sworn || stateOf(r) !== 'with') return false;
  if (leaveRefusal(r)) return false;   // COMPANION-DROP: never from my side inside the open zone - by me or by the slots' hold
  revenantCompanionUpdate(_player, id, (c) => {
    c.state = 'away';
    if (!byYou) return;
    const day = Math.floor(now / MINUTES_PER_DAY);
    if (c.sentDay === day) c.loyalty = movedLoyalty(c.loyalty, rvnLoyaltyMove(r, LOYALTY.SENT_TWICE, c));   // RVN-STARS: a loss as its oath bears it
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
  if (stateOf(r) === 'errand') return null;   // RVN-ERRAND: abroad - recalled first, its oath given back to its face
  // AUDIT (2026-10-02): ITS PACK IS HANDED BACK - the release closed the record with whatever the player had stored in
  // it, gone for good. Into the player's own pack, every item (the crew's hand-off stows a pack in the hold the same way)
  const items = [...(r.companion?.items ?? []), ...gearItems(r.companion?.gear)];   // RVN-GEAR: and its kit
  const out = revenantCompanionUpdate(_player, id, () => 'release');
  forgetSwornMember(id);
  forgetSwornArt(id);   // AUDIT RVN B12: and its art's clock - a release is for good
  if (out && items.length && _player) handBack(items);
  if (out) tell('release', out, { items: items.length });
  return out;
}
/** A sworn one's things into my own pack: every item, its gold to my purse (never a Currency row) - the player's own, no
 *  loot word (a release's, and COMPANION-DROP's in the zone). */
function handBack(items) {
  _player.items ??= [];
  for (const it of items) { if (isGoldPieces(it)) addGoldPieces(_player, it.stackCount ?? 1); else addItem(_player.items, it); }
}
/** COMPANION-DROP (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Bag drops; no send-off in zone"): THE ONE AT MY SIDE
 *  CARRIED OFF INSIDE THE OPEN ZONE (knocked out - the party's knock) hands me its pack and its kit before it goes, said:
 *  a death there drops them with mine, and carried off with it they would rest outside the zone's reach. The crew's hand
 *  does the same through his host (crewCompanions.js packStaysAshore). Answers how many items. */
function leftWithYou(r) {
  if (!_player || !wildHere() || !swornAtYourSide().includes(r)) return 0;
  const items = [...(r.companion?.items ?? []), ...gearItems(r.companion?.gear)];
  if (!items.length) return 0;
  revenantCompanionUpdate(_player, r.id, (c) => { c.items = []; c.gear = {}; });
  handBack(items);
  try { popupMessage(WILD_TEXT.companionLeft(r.name, items.length)); } catch { /* a word is nobody's failure */ }
  return items.length;
}

// ── RVN-ERRAND (bible/06-Systems/Revenants.md section 42): a sworn one abroad ──────────────
const sayErrand = (ev) => { try { revenantSay(ev, popupMessage); } catch { /* a word is nobody's failure */ } };
/** How many of the sworn are abroad now. */
export const revenantsAbroad = () => swornRevenants().filter((r) => stateOf(r) === 'errand');
/** Why it may not set out now - the page's words - or null: it may. */
export function errandRefusal(r, now) {
  if (!r?.sworn) return t('rvn.sworn.gone', 'It is no longer sworn to you.');
  if (stateOf(r) === 'errand') return t('rvn.errand.no.abroad', 'It is already abroad.');
  if (stateOf(r) === 'resting' && now < restUntil(r, now)) return t('rvn.errand.no.resting', 'Still recovering.');
  if (revenantsAbroad().length >= ERRAND.MAX) return t('rvn.errand.no.most', '{n} of your sworn are abroad already, the most allowed at once.', { n: ERRAND.MAX });
  return leaveRefusal(r);   // COMPANION-DROP: never from my side inside the open zone
}
/** SENT ON AN ERRAND to `place` (an ERRAND_PLACES key) for `venture`: it leaves (through its portal, if it stood at the
 *  player's side) and is back at the errand's minute. Answers the refusal's words, or null. `seed` the haul's draw (the
 *  page's dice). */
export function sendOnErrand(id, place, venture, { now = Math.floor(ownMinutes()), seed = Math.floor(Math.random() * 0x100000000), world = sharedClockOn() ? errandWorldNow() : NaN } = {}) {
  const r = revenantRecord(_player, id);
  const why = errandRefusal(r, now);
  if (why) return why;
  const e = newErrand(r, place, venture, now, seed, world);   // OFFLINE-ROAD: online, its world's minute
  if (!e) return t('rvn.errand.no.such', 'It knows no such errand.');
  revenantCompanionUpdate(_player, id, (c) => { c.state = 'errand'; c.errand = e; c.until = null; c.rested = false; });
  _errandClock ??= { own: ownMinutes(), raised: raisedMinutes() };   // AUDIT RVN F1: the clock read from its first minute, a raise before the next wake charged as one
  forgetSwornMember(id);
  const p = errandPlace(place);
  const where = e.city ? t('rvn.errand.cityIn', '{city}, in {province}', { city: e.city, province: p?.name }) : p?.name;
  _errandWords.push(revenantMomentEvent('dismiss', r, _player?.name, { as: 'errand', body: t('rvn.errand.setsOut', 'It sets out for {where}, {left}.', { where, left: errandLeftWords(e.until, now, sharedClockOn()) }) }));   // its own leaving words, the errand's card
  return null;
}
/** RECALLED before its errand is done: back at once with nothing, and worn from the road - resting a rest's length
 *  (AUDIT RVN F8: a recall that cost nothing re-rolled an errand's seed for free). Answers whether it was abroad. */
export function recallFromErrand(id, now = Math.floor(ownMinutes())) {
  const r = revenantRecord(_player, id);
  if (!r?.sworn || stateOf(r) !== 'errand') return false;
  revenantCompanionUpdate(_player, id, (c) => { c.state = 'resting'; c.errand = null; c.until = now + rvnRestMinutes(r, REVENANT_REST_MIN); c.worn = true; });   // RVN-STARS: its rest as its sky shortens it
  return true;
}
/** BACK: its haul drawn (revenantErrands.js errandHaul) and handed to the player; won, waiting to be called and
 *  ERRAND.WON_LOYALTY the more loyal - once an errand (AUDIT RVN F7: `paid`, its seed - a reload of a save made abroad
 *  brings the haul back again, never the loyalty; AUDIT RVN-STARS S4: the last PAID_KEEP seeds, so one more errand
 *  between the save and its return pays nothing twice); hard-won, resting a rest's length, worn from the road (AUDIT RVN
 *  F6: no RVN11 call bonus after it). RVN-STARS: its XP, once an errand too, by the days of its own road, while it is under
 *  RVN_XP.ERRAND_LEVEL_MOST (AUDIT RVN-STARS S11, S16). Its words owed, its level's after them. Answers the haul. */
export function returnFromErrand(id, now) {
  const r = revenantRecord(_player, id);
  const e = r?.companion?.errand;
  if (!_player || !r?.sworn || stateOf(r) !== 'errand' || !e) return null;
  const haul = errandHaul(r, e, { level: _player.level ?? 1 });
  const was = rvnStarsOf(r).level;
  revenantCompanionUpdate(_player, id, (c) => {
    c.errand = null;
    const paid = Array.isArray(c.paid) && c.paid.includes(e.seed);
    if (haul.won) {
      c.state = 'away'; c.worn = false;
      if (!paid) c.loyalty = movedLoyalty(c.loyalty, ERRAND.WON_LOYALTY);
    } else { c.state = 'resting'; c.until = now + rvnRestMinutes(r, REVENANT_REST_MIN); c.health = null; c.worn = true; }
    if (!paid && was < RVN_XP.ERRAND_LEVEL_MOST) c.xp = rvnXpOf(rvnXpOf(c.xp) + rvnXpErrand(errandPlace(e.place), haul.won, e.sky?.road ?? 0));   // RVN-STARS: its road's XP - once an errand, as its loyalty
    if (!paid) c.paid = [...(Array.isArray(c.paid) ? c.paid : []), e.seed].slice(-PAID_KEEP);
  });
  const lifted = levelWords(r, was);
  if (lifted) _levelLines.push(lifted);   // AUDIT RVN-STARS S16: said after its back card, not before it
  deliverHaul(_player, haul);
  const p = errandPlace(e.place);
  const body = haul.won
    ? t('rvn.errand.back', 'Back from {place} with {haul}.', { place: p?.name ?? '', haul: errandHaulWords(haul) })
    : t('rvn.errand.backHurt', 'Back, hurt, from {place} with {haul}. It must recover.', { place: p?.name ?? '', haul: errandHaulWords(haul) });
  _errandWords.push(revenantEvent('errand_back', r, { body, line: t('rvn.errand.backLine', '{name}: {body}', { name: r.name, body }) }));   // AUDIT RVN D7: no portal's voice - it waits away
  return haul;
}
/** The errands abroad carried on by one wake. OFFLINE-ROAD: online, once the relay's clock is heard (`world` the world's
 *  minute an errand may read - errandWorldNow, NaN before), each keeps the world's time (revenantErrands.js
 *  errandOnWorld: its `due` and its minute from it) - time away carries it on, a raise never. Before it is heard, AUDIT
 *  RVN F1's lived step (revenantErrands.js errandStep: a raise or time away pushes each one's minute back), and its push
 *  is still counted then, so the first trusted wake takes an errand with no `due` on as the step left it (AUDIT FB1021
 *  L3-2). AUDIT RVN F5: an errand whose minute an older clock stretched past its road's days is written back to them (as
 *  restUntil writes a rest's). The record's minute, written without a revision (as the party's `hurt` writes its
 *  health): the save reads it, and an errand is the save's. */
export function chargeErrands(now, { own = ownMinutes(), raised = raisedMinutes(), online = sharedClockOn(), world = errandWorldNow() } = {}) {
  let push = 0;
  if (!_errandClock) _errandClock = { own, raised };   // the session's first reading: nothing to charge yet
  else {
    if (Number.isFinite(own) && Number.isFinite(_errandClock.own)) {
      _errandOwed += errandStep(own - _errandClock.own, raised >= _errandClock.raised ? raised - _errandClock.raised : 0, online);
      push = Math.floor(_errandOwed);
      _errandOwed -= push;
    }
    _errandClock.own = own; _errandClock.raised = raised;   // nothing made a frame
  }
  const onWorld = online && Number.isFinite(world);
  for (const r of swornRevenants()) {
    if (stateOf(r) !== 'errand' || !r.companion.errand) continue;
    const e = r.companion.errand;
    if (onWorld) {   // OFFLINE-ROAD: the world's time
      // AUDIT FB1021 L3-2: an errand with no `due` takes its minutes left as the lived step leaves them - a raise across the
      // first trusted wake (a rest's window open as the welcome lands) is pushed back, as it always was, never paid
      const o = errandOnWorld(Number.isInteger(e.due) ? e : { ...e, until: errandUntil(e, now - push) + push }, now, world);
      e.due = o.due;
      if (o.until !== e.until) e.until = o.until;
      continue;
    }
    const until = errandUntil(e, now - push) + push;   // its minute pushed, then held to its days from now
    if (until !== e.until && Number.isInteger(until)) e.until = until;
  }
}
/** Where one abroad is, in the page's words. */
export const abroadWords = (r, now) => (stateOf(r) === 'errand' ? errandWords(r.companion.errand, now, sharedClockOn()) : null);   // AUDIT FB1021 L3-5: online in real time

// ── RVN-GEAR (bible/06-Systems/Revenants.md section 40): its kit, from the player's pack and back ──────────────
/** The player's pieces a sworn one might wear (the page's list): in the pack, unworn by the player, of a slot it has. */
export function giftablePieces(player = _player) {
  const worn = new Set(player ? equipTableOf(player).filter(Boolean) : []);
  return (player?.items ?? []).filter((it) => it && !worn.has(it) && gearKeyOf(it) != null);
}
/** GIVEN: `item` from the player's pack into its slot - the piece there before back to the pack - and worn at once by a
 *  body standing here. Answers the refusal's words, or null. */
export function giveSwornGear(id, item, { kindName = null } = {}) {
  const r = revenantRecord(_player, id);
  if (!_player || !r) return t('rvn.sworn.gone', 'It is no longer sworn to you.');
  const key = gearKeyOf(item);
  const why = gearRefusal(r, item, { kindName });
  if (why) return why;
  if (wildHere() && !swornAtYourSide().includes(r)) return WILD_TEXT.companionAway(r.name);   // COMPANION-DROP: one waiting outside the zone - my piece would leave it
  if (equipTableOf(_player).includes(item)) return t('rvn.gear.no.worn', 'You are wearing it.');
  const pack = _player.items ?? [];
  const at = pack.indexOf(item);
  if (at < 0) return t('rvn.gear.no.pack', 'It is not in your pack.');
  pack.splice(at, 1);
  let was = null;
  revenantCompanionUpdate(_player, id, (c) => { c.gear ??= {}; was = c.gear[key] ?? null; c.gear[key] = item; });
  if (was) addItem(pack, was);
  const body = swornBodyOf(id);
  if (body) applySwornGear(body, revenantRecord(_player, id), { taken: was ? [was] : [] });
  return null;
}
/** TAKEN BACK: its piece in `key` into the player's pack (a shield first when its one-handed weapon goes - a shield wants
 *  one). Answers the pieces handed back. */
export function takeSwornGear(id, key) {
  const r = revenantRecord(_player, id);
  if (!_player || !r?.sworn || stateOf(r) === 'errand' || !isGearKey(key) || !r.companion?.gear?.[key]) return [];   // AUDIT RVN F10: abroad, its kit goes with it
  const keys = key === 'weapon' && r.companion.gear.shield ? ['shield', 'weapon'] : [key];
  const back = [];
  revenantCompanionUpdate(_player, id, (c) => { for (const k of keys) { if (c.gear?.[k]) back.push(c.gear[k]); delete c.gear[k]; } });
  _player.items ??= [];
  for (const it of back) addItem(_player.items, it);
  const body = swornBodyOf(id);
  if (body) applySwornGear(body, revenantRecord(_player, id), { taken: back });
  return back;
}

// ── RVN-STARS (bible/06-Systems/Revenants.md section 44): its sky, set from the page ──────────────
/** Why its sky may not change now - abroad (its sky is set at my side, as its kit is), or no longer sworn - or null. */
export function swornStarsRefusal(r) {
  if (!r?.sworn) return t('rvn.sworn.gone', 'It is no longer sworn to you.');
  if (stateOf(r) === 'errand') return t('rvn.stars.no.abroad', 'It\'s away on a mission. Set its stars when it returns.');
  return null;
}
/** SET: its sky as `ids` (through the law: the Oath, each star joined, its points) - its blows and its health at once.
 *  AUDIT RVN-STARS S1: the whole its oath carries between stands (`maxHealth`, `health` - crewAshore stands every body after
 *  the first on them, never fresh) and a body standing here are rescaled by its health's new share over its old, so the
 *  Blade's health reaches every stand and a keystone's price is paid (a sky stood and then given back kept its health).
 *  Answers the sky set, or the refusal's words. */
export function setSwornStars(id, ids) {
  const r = revenantRecord(_player, id);
  const why = swornStarsRefusal(r);
  if (why) return why;
  const before = rvnStatScale(rvnStatsOf(r), 'health');
  let set = ['oath'], k = 1;
  revenantCompanionUpdate(_player, id, (c, rec) => {
    set = rvnHeldStars(ids, rvnStarsOf(r).points);
    c.stars = set;
    k = rvnStatScale(rvnStatsOf(rec), 'health') / before;
    if (k !== 1 && c.maxHealth > 0) {
      c.maxHealth = Math.max(1, Math.round(c.maxHealth * k));
      if (c.health > 0) c.health = Math.min(c.maxHealth, Math.max(1, c.health * k));
    }
  });
  const body = swornBodyOf(id);
  if (body) {
    if (k !== 1) rescaleBody(body, k);
    applySwornStrength(body, revenantRecord(_player, id), { fresh: false });
  }
  return set.slice();
}
/** A standing body's whole by `k` - its health with it (in proportion), and the poise's `healthMult` (TELL1). */
function rescaleBody(e, k) {
  const max = Math.max(1, Math.round((e.maxHealth || 1) * k));
  e.health = Math.min(max, Math.max(e.health > 0 ? 1 : 0, (e.health || 0) * k));
  e.maxHealth = max;
  if (Number.isFinite(e.healthMult)) e.healthMult *= k;
  if (Number.isFinite(e._swornWhole)) e._swornWhole *= k;
}
/** The stars' window's ledger for one sworn one (ui/revenantStarsWindow.js): its reading, its sky, its art, the act. */
export function swornStarsBook(id) {
  const rec = () => revenantRecord(_player, id);
  return {
    record: rec,
    stars: () => rvnStarsOf(rec()),
    tree: () => (Array.isArray(rec()?.companion?.stars) ? rec().companion.stars.slice() : ['oath']),
    refusal: () => swornStarsRefusal(rec()),
    setTree: (ids) => setSwornStars(id, ids),
  };
}

/** A sworn one's whole and blows over the body a place stands for it: its rank's, as it fought the player with, and
 *  (RVN-STARS) its Blade's stars over them. Its health once - a body standing with a carried whole (crewAshore) keeps it
 *  (setSwornStars rescales that whole when its sky changes - AUDIT RVN-STARS S1), and is told what was stood on its kind's
 *  own health all the same (TELL1's `healthMult`, once a body - S1: a carried stand read the inflated whole as the kind's). */
export function applySwornStrength(entity, r, { fresh = true } = {}) {
  if (!entity || !r) return;
  const rank = Math.max(1, r.rank | 0), stars = rvnStatsOf(r);
  const starHealth = rvnStatScale(stars, 'health');
  if (fresh) {
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * (1 + SWORN_HEALTH_PER_RANK * rank) * starHealth));
    entity.healthMult = (entity.healthMult ?? 1) * (1 + SWORN_HEALTH_PER_RANK * rank) * starHealth;   // TELL1: what was stood on the kind's own health (its poise)
    entity.health = entity.maxHealth;
  } else if (!Number.isFinite(entity._swornWhole)) entity.healthMult = (entity.healthMult ?? 1) * (1 + SWORN_HEALTH_PER_RANK * rank) * starHealth;   // a carried whole: the poise told what it carries
  entity._swornWhole = (1 + SWORN_HEALTH_PER_RANK * rank) * starHealth;
  entity.damageScale = (1 + SWORN_DAMAGE_PER_RANK * rank) * (isDevoted(r.companion?.loyalty) ? DEVOTED.BLOWS : 1) * rvnStatScale(stars, 'blows');   // RVN11 (22.1): a Devoted one's blows
  entity.revenant = { id: r.id, name: r.name, rank, sworn: true };   // FOE-TITLE: called by its own name everywhere
  applySwornGear(entity, r);   // RVN-GEAR: its kit over the one its stand rolled
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
  m.person = revenantPerson(r);   // FB1012d ALLY-RACE: the one person it was born as - the layer stands every body of it so (crewAshore.js companionPerson)
  return m;
}
/**
 * The sworn as the companion layer's party. `onWake(r)` - one fit again after its rest (the roster's word).
 */
export function revenantParty({ onWake = null } = {}) {
  return {
    get party() { const list = revenantsWithYou().filter((r) => !held(r.id)); return swornAtYourSide().filter((r) => list.includes(r)).map(memberOf); },   // PVPDUNGEONS: in the zone one stands, the rest wait outside it - COMPANION-DROP: the one whose pack drops with mine
    wake(now) {
      chargeErrands(now);   // OFFLINE-ROAD: online the world's time carries an errand on (AUDIT RVN F1's lived step before the relay is heard)
      for (const r of swornRevenants()) if (stateOf(r) === 'errand' && r.companion.errand && now >= r.companion.errand.until) returnFromErrand(r.id, now);   // RVN-ERRAND: back from abroad
      while (_errandWords.length) sayErrand(_errandWords.shift());   // RVN-ERRAND: its words, the menu shut
      while (_levelLines.length) { try { popupMessage(_levelLines.shift()); } catch { /* a word is nobody's failure */ } }   // RVN-STARS: a level an errand lifted it to, after them
      for (const r of swornRevenants()) {
        if (stateOf(r) === 'resting' && now >= restUntil(r, now)) {
          revenantCompanionUpdate(_player, r.id, (c) => { c.state = 'away'; c.until = null; c.health = null; c.rested = !c.worn; c.worn = false; });   // RVN11: its next call after this rest +10 - AUDIT RVN F6: never after a road's
          onWake?.(r);
        }
      }
    },
    knock(boat, id, now) {
      const r = revenantRecord(_player, id);
      if (!r?.sworn || stateOf(r) !== 'with') return false;
      leftWithYou(r);   // COMPANION-DROP: carried off inside the zone, what it carries stays with me
      revenantCompanionUpdate(_player, id, (c) => { c.state = 'resting'; c.until = now + rvnRestMinutes(r, REVENANT_REST_MIN); c.health = null; c.loyalty = movedLoyalty(c.loyalty, rvnLoyaltyMove(r, LOYALTY.KNOCKED, c)); });   // RVN11: a fall -8 - RVN-STARS: its rest and its loss as its sky bears them
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
  if (rec?.revenantCompanion) { try { const r = revenantRecord(_player, rec.revenantCompanion); if (r) swornArtStep(rec, r, playerDoor(), { say: popupMessage }); } catch { /* an art is no fight's failure */ } }   // RVN-ARTS: its art, frame by frame
  const t = rec?.ai?.target;
  const tgt = t?.entity && !t.dead && t.entity.health > 0 ? t : null;
  if (tgt) { rec._fightLast = tgt; return false; }
  const last = rec?._fightLast ?? null;
  if (!last) return false;
  rec._fightLast = null;
  const won = !(last.entity?.health > 0);   // AUDIT FEUD: killed - a foe that escaped, was culled or scattered is `dead` with its health
  if (won && rec.revenantCompanion) _wonLevel.set(rec.revenantCompanion, last.entity?.level ?? 1);   // RVN-STARS: the foe it beat, its XP's weight
  return won;
}
/** A fight won at the player's side: +3, and (RVN-STARS) its XP by the foe's level. */
export function swornFightWon(id) {
  const r = revenantRecord(_player, id);
  const was = rvnStarsOf(r).level, xp = rvnXpWon(_wonLevel.get(id) ?? 1);
  _wonLevel.delete(id);
  const out = revenantCompanionUpdate(_player, id, (c) => { c.loyalty = movedLoyalty(c.loyalty, LOYALTY.WON); c.xp = rvnXpOf(rvnXpOf(c.xp) + xp); });   // AUDIT RVN-STARS S12: whole, to the top level's
  const lifted = out ? levelWords(out, was) : null;
  if (lifted) { try { popupMessage(lifted); } catch { /* a word is nobody's failure */ } }
  return out;
}
/** RVN-STARS: its level reached, in words - a star or more to set on the Companions page - or null. */
function levelWords(r, was) {
  const s = r ? rvnStarsOf(revenantRecord(_player, r.id)) : null;
  if (!s || s.level <= was) return null;
  return t('rvn.stars.levelUp', '{given} reaches level {level}. Set its new {n, plural, one {star} other {# stars}} on the Companions page.', { given: r.given, level: s.level, n: Math.max(1, s.points - s.set) });
}

/** ONE OF ITS OWN KIND EXECUTED IN ITS SIGHT (systems/revenant/revenantFate.js finishExecution - `mobileType` the executed's): each
 *  sworn one at the player's side whose body stands here (the layer keeps it at the heel - decided here: in its sight)
 *  and is of the same kind or faction, -15. Answers those it cost. */
export function swornWitness(mobileType) {
  const out = [];
  for (const r of revenantsWithYou()) {
    if (!sameKin(r.mobileType, mobileType) || !(swornBodyOf(r.id)?.health > 0)) continue;
    if (revenantCompanionUpdate(_player, r.id, (c) => { c.loyalty = movedLoyalty(c.loyalty, rvnLoyaltyMove(r, LOYALTY.KIN_EXECUTED, c)); })) out.push(r);   // RVN-STARS: a loss as its oath bears it
  }
  return out;
}
/** A Devoted one at the player's side whose body stands here - its warning's voice - or null. */
export const devotedWithYou = () => revenantsWithYou().find((r) => isDevoted(r.companion?.loyalty) && swornBodyOf(r.id)?.health > 0) ?? null;
// RVN11b (Feud-Arc.md 22.2): a deserter's member forgotten - its carried spells are no next oath's
setSwornLeftListener((id) => forgetSwornMember(id));
/** RVN11c (bible/12-Enhanced-AI/Feud-Arc.md 22.3): THE BETRAYAL'S MOMENT - a hurt that leaves me (alive) under
 *  BETRAY.HEALTH: the first sworn one at my side that may betray (mayBetray) and whose body stands here turns - its record
 *  first (systems/revenant/revenant.js revenantBetrays), then the host told ('betray'), which stands it hostile where it stood. One
 *  a hurt. */
export function betrayalStep(entity, after) {
  if (!entity?.isPlayer || entity.peer || !(after > 0) || after >= (entity.maxHealth || 1) * BETRAY.HEALTH) return null;
  const r = revenantsWithYou().find((x) => mayBetray(x) && swornBodyOf(x.id)?.health > 0);
  const t = r ? revenantBetrays(entity, r) : null;
  if (t) tell('betray', t);
  return t;
}
registerPlayerHurtListener('sworn-betrayal', (entity, { after } = /** @type {any} */ ({})) => { betrayalStep(entity, after); });
// RVN-ARTS (Revenants.md section 41): a hurt that leaves me low - a sworn one's Mending answers it
registerPlayerHurtListener('sworn-mending', (entity, { after } = /** @type {any} */ ({})) => { try { swornMendStep(entity, after, revenantsWithYou(), (id) => swornBodyOf(id)?.health > 0, { say: popupMessage }); } catch { /* a heal is no hurt's failure */ } });
/** Tests only. */
export function _resetRetinueForTests() { _members.clear(); _heldUntil.clear(); _errandWords.length = 0; _levelLines.length = 0; _errandClock = null; _errandOwed = 0; _player = null; _listener = null; _bodies = null; _wonLevel.clear(); }
