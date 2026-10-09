// @ts-check
// LEGACY1-LEGACY4 (2026-10-05, bible/06-Systems/Legacy-Arc.md): PROJECT LEGACY IN THE WORLD - the host's half.
//
// The law is systems/legacy/ (family.js the record and its inheritance, age.js the span and the toll, store.js where a
// family lives and the birth's handoff, places.js the town an heir is born in, heirloom.js the heirloom, the remains
// and the blessing); the windows are ui/familyPages.js (the pause window's Family tab) and ui/legacyDoor.js (the
// Succession). This file reaches the world only through the deps the world host (scenes/world.js) hands it, so a test
// drives it headless.
//
// WHAT IT DOES, END TO END:
//   - FOUNDS a family around the character played (D9: at creation, or offline at the first load of an older save), its
//     model the chargen's answer (`entity.legacyChoice`, kept on the character) or its Features tile's - never one who
//     answered no lineage, and online never at a load (LEGACY-CHOICE) - and FINDS the family a save made before its
//     founding belongs to, rather than founding a second (AUDIT LEGACY A3);
//   - keeps the record in the save (`modData.ProjectLegacy`, the mod's IHasModSaveData) and in the store;
//   - RECORDS A DEATH THE INSTANT IT HAPPENS (`onDeath`, the death door's listener - characters/playerEntity.js
//     onPlayerDeath, DFU's PlayerEntity.OnDeath the mod subscribed to): an Enduring member pays Arkay's toll, a member
//     who falls for good is recorded dead with the Succession left WAITING ON THE RECORD (`family.pending`). The death
//     screen's reset only presents what was decided (AUDIT LEGACY A1/B3: it was decided at the reset, and an F11 or a
//     closed tab under the screen undid a permadeath);
//   - BIRTHS a member through the boot (`?legacyborn=`) and the construction seam, and LOADS a member who has been
//     played (their newest save) - a switch is the same two doors (S1-S4);
//   - PLAYS THE PAST BACK AS THE PAST: a save of a member who is dead or retired, under either model, is refused for as
//     long as it stands - nothing it does is written into the line, and the Succession (or the line's living) is offered
//     until it is answered (AUDIT LEGACY A2/A5/B2/H2).
//
// TWO AUTHORITIES, AND WHICH ANSWERS WHAT (AUDIT LEGACY A6/H3). The STORE answers the world's facts - who lived, who
// died, Arkay's toll, who is played, which remains exist: no reload undoes a death. A SAVE answers what its character
// was given - the estate and the bequest paid to them, the remains they gathered, carried or laid to rest: a reload
// rewinds those with the bag they went into, so nothing is ever lost between the store and an unsaved game, and
// nothing is given twice (mergeFamily).
import {
  LEGACY_VENDOR, MODELS, foundFamily, readFamily, personOf, currentOf, writePlayer, recordDeath, successors,
  newbornAllowed, addChild, rollSiblings, setCurrent, endFamily, touch, estateOf, bornValues, fullNameOf, isCustomCareer,
  isAlive, memberLook, nameAtSeat, lineSurnameOf, isModel, NO_LINEAGE,
} from '../systems/legacy/family.js';
import { houseWord } from '../systems/legacy/houseName.js';   // LEGACY-NAME: "the house of Sentinel", never "of of"
import { loadFamily, storeFamily, leaveBirth, readBirth, clearBirth, listFamilies, mergeFacts, noteSeen, seenRevOf } from '../systems/legacy/store.js';
import { birthSearch } from '../systems/legacy/places.js';
import { payToll, tollLine, ageOf, isElder, isSpent } from '../systems/legacy/age.js';
import { liveVampirism } from '../systems/racialLive.js';   // AGELESS-CURSE
import { liveLycanthropy } from '../systems/lycanthropy.js';   // AGELESS-CURSE
import { legacySettings } from '../systems/legacy/settings.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { repairItemLists } from '../systems/save.js';   // ITEM-WALK B: the load's item repairs, on what leaves the line's record
import { rollStats, rollSkills, spendPoolLowest, STAT_KEYS_ORDER } from '../systems/chargen.js';
import { LEVELING_CLASSIC } from '../systems/oblivionLeveling.js';
import { pickHeirloom, markHeirloom, mintRemainsItem, isRemainsItem, isHeirloom, attuneHeirloom, blessingOf, blessedIn, remainsGoldOf, REMAINS_LIST, BLESSING_POINTS } from '../systems/legacy/heirloom.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { syncHouses, householdOf, residentOf, familyResOf, kinGreeting, setFamilyHome, familyHome, sameHouse, deedsDue, houseKeyOf } from '../systems/legacy/household.js';
import { goldStack } from '../systems/inventory.js';
import {
  topicsFor, topicLabel, topicQuestion, court, propose, betrothalOf, wed, childStep, childLine, spouseOf, childrenTogether,
  splitName, dayOf as courtDayOf, MARRIAGE_TEXT, TOPIC, wedPlayer, unionSpouse, playerSpouseLost, residentInHouse, forgetCourtship,
} from '../systems/legacy/marriage.js';
import { memberStanding, inheritStanding, inheritRegards, noteNews, newsFor as houseNewsFor, hearNews } from '../systems/legacy/influence.js';

/** The reflexes a born member starts with - the wizard's own default (ui/chargenArt.js PLAYER_REFLEXES.Average). */
export const BORN_REFLEXES = 2;

/** The words. One home, so the windows and the HUD say one thing. */
export const LEGACY_TEXT = Object.freeze({
  founded: (sur, model) => `${houseWord(sur) ? `The house of ${houseWord(sur)}` : 'Your house'} is founded - ${model === MODELS.bloodline ? 'a Bloodline: a death is final' : 'an Enduring line: a death costs years'}.`,   // LEGACY-NAME: named at its seat, or not yet
  seat: (loc) => `${loc} is your family's seat.`,
  // FAMILY-SEAT (FIELD BUGS 2026-10-07b): the seat moved where the one played stands (the House page)
  seatMoved: (loc) => `The house moves its seat: ${loc} is your family's seat.`,
  seatNowhere: 'Stand in another town - its streets or one of its buildings - to make it the family\'s seat.',   // AUDIT FB1007b S5: and the House page's hint
  named: (sur) => `Your house takes its seat's name: the house of ${houseWord(sur)}.`,   // LEGACY-NAME: a house founded nameless, named
  elder: (name, age) => `${name} is ${age} - an elder of the house now. The years ahead are fewer than those behind.`,
  born: (name, loc) => `${name} takes up the family's name in ${loc}.`,
  hunted: (foe, given) => `${foe}, who ended ${given}, will come for the house's heir.`,
  lore: (given, from, to) => `Lore surname change: ${given} chose ${to} instead of ${from}.`,   // RandomizeCharacterData's own HUD line
  noHeir: 'You died without a descendant.',   // HandlePlayerDeath's own words
  heir: 'You died. Your descendant will take your place.',   // ...and the other branch's
  kin: 'You died. One of your house will take your place.',   // AUDIT LEGACY III F11c: no descendant offered - a sibling, a parent
  deadLoad: (name) => `${name} is dead. Their story is the past.`,
  retiredLoad: (name) => `${name} has passed the mantle on. Their story is the past.`,
  fight: 'Not while you are in a fight.',
  // LEGACY7: the realm's tombstone refused or unheard - the fall stands on the record; the realm is asked again
  unTombed: 'The realm did not hear of this death yet. It will be told again before anyone carries on.',
  pending: 'The house waits on its Succession.',
  notSaved: 'Your journey could not be saved here - not now.',
  estate: (n) => `The estate left you a letter of credit for ${n} gold.`,
  bequest: (item) => `Your elder's bequest is yours: ${item}.`,
  // PERMADEATH-HOUSES: a house of the line's dead, taken up by whoever carries the line - or waiting on a bank's one deed a region
  deed: (loc, given) => `${given}'s house${loc ? ` in ${loc}` : ''} passes to you. Its deed is yours now.`,
  deedWaits: (loc, given) => `${given}'s house${loc ? ` in ${loc}` : ''} waits for you - you keep a house in that region already, and the bank deeds one a region. Sell yours there to take it up.`,
  remainsFound: (name) => `You have found the remains of ${name}.`,
  remainsTaken: (name) => `You carry the remains of ${name}. Lay them to rest at a temple, or at the family's seat.`,
  remainsReturned: (name) => `The remains of ${name} are no longer with you. They lie where ${name} fell.`,
  // AUDIT LEGACY III F11a: what the blessing gave - the house's dead bless a skill so far (heirloom.js BLESSING_SKILL_MAX)
  rested: (name, skill, gain = BLESSING_POINTS) => (gain > 0 ? `${name} is laid to rest. Their blessing stays with you: +${gain} ${skill}.`
    : `${name} is laid to rest. Your ${skill} is as blessed as the house's dead can make it.`),
  attuned: (item, gen) => `${item} remembers the hand that carried it home (generation ${gen}).`,
  ended: (sur) => `${houseWord(sur) ? `The house of ${houseWord(sur)}` : 'Your house'} goes on.`,
  kinSlain: (name) => `${name} is dead by your hand. The house will remember it.`,   // LEGACY-HOME
  kinKilled: (name) => `${name} has been killed. The house mourns.`,   // a beast of the street (WATCH-PROTECTS)
  playAs: (name) => `Play as ${name}`,
  notNow: 'Not now - the house has another matter to settle first.',
  notStored: 'Your family\'s record could not be written - the browser\'s storage refused it. Free some space (old saves); it will be tried again.',   // AUDIT LEGACY II P1
  notBorn: (given) => `${given}'s first day could not be saved here. Reload to begin it again - nothing of the house is lost.`,   // AUDIT LEGACY II A2
  claimed: (name, by) => `${by} has taken up the search for ${name}'s remains.`,   // AUDIT LEGACY II H5
  retiredKin: (given) => `${given} has passed the mantle on, and keeps the house now.`,
  minor: (given) => `${given} is a child yet - they come of age when the mantle passes to them.`,   // LEGACY5
  spouseKin: (given) => `${given} is wed into the house - not of the blood to carry it.`,   // LEGACY5
  // AUDIT LEGACY III A1: a betrothed townsperson another member wed first - the courtship is over
  wedElsewhere: (name) => `${name} is wed into the house already. Your betrothal is over.`,
  // AUDIT LEGACY III O2/P1: online, the realm would not take the line's record (systems/legacy/realmLine.js onRefused)
  lineRefused: (why) => `The realm would not keep your family's record. ${why} This device keeps it.`,
});

/** LEGACY4: the death quest's id prefix in the quest log, and its map ring's radius (the bounty board's). */
export const LEGACY_QUEST_PREFIX = 'legacy:';
export const LEGACY_RING_R = 1.5;

/** The remains' own picture - the template's world flat (systems/legacy/heirloom.js REMAINS_ROW). */
export const REMAINS_FLAT = Object.freeze({ archive: 254, record: 56 });

/**
 * OF TWO COPIES OF ONE FAMILY, THE ONE TO PLAY ON (AUDIT LEGACY A6/H3): the store's world facts, the save's grants to
 * the character it is of (`cid`). `stored` and `saved` are read records; either may be null. Pure.
 *   - the newer by `rev` is the base - a death, a toll, a birth, a remains row made after the save all stand;
 *   - the character's own `estatePaid` and `bequestPaid` are the save's: what was paid after it is unpaid again, with the
 *     bag it went into;
 *   - AUDIT LEGACY II H2/A3: a remains row the character CLAIMED (the store's `by`) carries the save's progress - its
 *     list, its state - when the save holds it, else its first state; the claim itself is the store's and stands (a
 *     rewind that dropped it let a second member empty the same list, and both saves held the heirloom). Every other
 *     row - nobody's, or another member's - is the store's: a save's older copy of a list it never claimed is no grant.
 */
export function mergeFamily(stored, saved, cid) {
  if (!saved) return stored ?? null;
  if (!stored || stored.id !== saved.id) return saved;
  const base = saved.rev > stored.rev ? saved : stored;
  const out = JSON.parse(JSON.stringify(base));
  out.rev = Math.max(stored.rev, saved.rev);
  // AUDIT LEGACY III A2: a save's copy newer than the store's takes the store's facts in - the page's copy is made from
  // the store as it stands (adopt notes it), so its first write never drops a death another tab stored meanwhile
  if (base === saved) mergeFacts(out, stored);
  // AUDIT FB1007b T3: and the store's copy the newer, the save's LATER MOVE of the seat stands all the same (FAMILY-SEAT's
  // stamp, as every merge reads it) - a save that carries a move its store never took (another device's) lost it here
  else if (saved.seat && (Number(saved.seat.at) || 0) > (Number(out.seat?.at) || 0)) out.seat = { ...saved.seat };
  const me = cid ? out.people.find((p) => p.characterId === cid) : null;
  if (!me) return out;
  // the save's own word on them, by who they are - never by an id the store may have given another (store.js rekeyClashes)
  const was = saved.people.find((p) => p.characterId === cid) ?? saved.people.find((p) => p.id === me.id);
  me.estatePaid = Math.max(0, Math.floor(Number(was?.estatePaid) || 0));
  me.bequestPaid = Math.max(0, Math.floor(Number(was?.bequestPaid) || 0));
  // PERMADEATH-HOUSES: the dead's deeds taken up are the save's too - a reload before the save that holds one hands it again
  me.deedsTaken = Array.isArray(was?.deedsTaken) ? was.deedsTaken.filter((k) => typeof k === 'string') : [];
  for (const r of out.remains ?? []) {
    if (r.by !== me.id) continue;   // nobody's, or another member's: the store's
    const s = (saved.remains ?? []).find((x) => x.id === r.id);
    if (s) Object.assign(r, { items: JSON.parse(JSON.stringify(s.items ?? [])), state: s.state, restedAt: s.restedAt ?? null, found: !!s.found });
    else Object.assign(r, { items: JSON.parse(JSON.stringify(r.first ?? [])), state: 'lying', restedAt: null, found: false });
  }
  return out;
}

/**
 * @param {{
 *   entity:any, storage:() => any, tab:() => any, on:() => boolean, online:() => boolean,
 *   killer?:() => (string|null), atPlace?:(place:any) => boolean, openRemains?:(rec:any, items:any[]) => boolean,
 *   atRest?:() => boolean, askRest?:(name:string, yes:() => void) => boolean, takeItem?:(item:any) => void,
 *   carried?:() => any[], giveItems?:(items:any[]) => void,
 *   now:() => number, own:() => number, here:() => any, town:(here:any) => ({region:string, loc:string, mapId?:number}|null),
 *   nearestTown:(here:any) => ({region:string, loc:string}|null), gold:() => number, say:(line:string) => void,
 *   boot:(search:string) => void, search:() => string, loadCharacter:(characterId:string) => boolean,
 *   saveNow:() => boolean, inFight:() => boolean, payEstate?:(gold:number) => void, rng?:() => number,
 *   heldHouses?:() => any[], houseHere?:() => ({mapId:number, buildingKey:number}|null),
 *   inheritHouse?:(row:any, fallen:any) => ('given'|'waits'|'gone'|'asking'|null),
 *   hasSave?:(characterId:string) => boolean, livingWorld?:() => boolean,
 *   templeOf?:() => (number|null), askWed?:(name:string, house:string, done:(takeName:boolean) => void) => boolean,
 *   regards?:() => any, regardDay?:() => number, sky?:() => number,
 *   killerOf?:(characterId:string, ownAt:number) => any, inheritFoe?:(rec:any) => boolean,
 *   stored?:(family:any) => void, tombstone?:(why?:'fell'|'retired') => (boolean|Promise<boolean>),
 *   realmId?:() => (string|null), look?:() => any, wall?:() => number,
 * }} deps - AUDIT LEGACY II: `hasSave(cid)` whether a save of that character stands (a person's id stands only with one);
 *   `livingWorld()` whether the Living World runs (the line stands only in its towns). LEGACY6: `regards()` the Living
 *   World's relations of the one played and `regardDay()` their day; `sky()` the towns' minute (the house's news is
 *   stamped by it); `killerOf(cid, ownAt)` the revenant that ended a character (revenant.js killerOf) and
 *   `inheritFoe(rec)` it handed to the one played (inheritRevenant). LEGACY7: `stored(family)` each write of the device's,
 *   which online the realm's copy follows (systems/legacy/realmLine.js); `tombstone()` the playing realm character
 *   fallen for good (realmSaves.js session die) - `why` 'retired' for an elder's mantle passed; part three: `realmId()` the
 *   realm character this tab plays (two players wed: wedRefusal); part four: `look()` what the one played wears (the
 *   hello's recipe, net/remotePlayers.js composeLook), written on them at every write. AUDIT LEGACY III P5: `wall()` the
 *   wall clock (Date.now by default) - when a member's own save last wrote them. PERMADEATH-HOUSES: `inheritHouse(row,
 *   fallen)` a house of the line's dead handed to the one played (takeDeeds)
 */
export function createLegacyHost(deps) {
  const rng = deps.rng ?? Math.random;
  /** @type {any} */ let family = null;
  /** A birth read from the boot: the family to start the new game with, and who is born. */
  /** @type {any} */ let born = null;
  /** LEGACY6: the share of a parent's standing the member born on this page took - a new game's fresh relations take it
   *  again (seedRegards), whichever of the birth and the new game's reset lands first. */
  /** @type {{ personId:number, standing:any }|null} */ let bornShare = null;
  /** THE PAST PLAYED BACK: a dead or retired member's save is loaded - their person. Lasts until another load. */
  /** @type {any} */ let past = null;
  /** The death the door saw, decided: the reset presents it. `deathSeen` - the door was heard for this death. */
  /** @type {any} */ let outcome = null;
  let deathSeen = false;
  let elderSaid = false;
  /** The remains opened this visit, and the rests asked this visit - by remains id (AUDIT LEGACY H8). */
  const openedThisVisit = new Set();
  const restAskedThisVisit = new Set();
  let remainsSig = '';

  /** AUDIT LEGACY II P1: a write the storage refused (its quota full, a private mode) is NOT dropped silently - the
   *  store is the authority for a death, and a reload would have played the dead on. Retried every tick until it
   *  lands, and said once. Answers whether it wrote. */
  let unstored = false;
  let unstoredSaid = false;
  /** STORM-SHED 2: the line as the device's store last took it from this page, the played member's stamps and the rev
   *  left out (lineBody) - null until a write lands, and after one the storage refused. A save that would write the
   *  same, over a store nobody wrote since, writes nothing (getSaveData). */
  let storedBody = /** @type {string|null} */ (null);
  /** STORM-SHED 2: the line's record without what every save moves - its rev, and the played member's `savedAt` and
   *  `lived` (the clock's, as the save's own clocks are). */
  const lineBody = () => {
    const p = current();
    return JSON.stringify(family, function (k, v) { return (this === family && k === 'rev') || (p && this === p && (k === 'savedAt' || k === 'lived')) ? undefined : v; });
  };
  const store = (f = family) => {
    if (!f) return true;
    const ok = storeFamily(deps.storage(), f);
    if (f === family) { unstored = !ok; storedBody = ok ? lineBody() : null; }   // STORM-SHED 2: as written - another tab's facts merged in
    if (!ok && !unstoredSaid) { unstoredSaid = true; deps.say(LEGACY_TEXT.notStored); }
    if (ok) unstoredSaid = false;
    // LEGACY7: online, the realm's copy is written after the device's (systems/legacy/realmLine.js). AUDIT LEGACY III P8:
    // whether or not the device took it - online the realm is the line's authority, and a full device left a fall and
    // its heir out of the realm's record until space was freed
    if (f === family && (ok || deps.online())) deps.stored?.(family);
    return ok;
  };
  const current = () => currentOf(family);
  const lived = () => {
    const p = current();
    return p ? Math.max(0, Math.floor((deps.own() ?? 0) - (p.bornOwn ?? 0))) : 0;
  };
  /** The played character into their person, and the lived minutes - every save and every death. Never the past's.
   *  `saving` - AUDIT LEGACY II A7: only a SAVE says where the member was saved (`parked`); a rise, or a switch whose
   *  save then failed, made none, and wrote them standing in a house their newest save is not in. */
  function writeCurrent({ saving = false } = {}) {
    const p = current();
    if (past || !p || !deps.entity?.chargenDone || !isAlive(p) || p.retired != null) return;
    if (p.characterId && deps.entity.characterId && p.characterId !== String(deps.entity.characterId)) return;   // never another character's into this person
    writePlayer(p, deps.entity);
    p.lived = lived();
    p.savedAt = Math.max((Number(p.savedAt) || 0) + 1, Math.floor(deps.wall?.() ?? Date.now()));   // AUDIT LEGACY III P5: this page's word on them, the newest
    // LEGACY6: what the world thinks of them - the law, the guilds, the town's regard (influence.js) - for a child's share
    p.standing = memberStanding(deps.entity, deps.regards?.() ?? null, deps.regardDay?.() ?? 0);
    // LEGACY7 part four: what they wear - how the world draws them while another is played (world/familyBodies.js)
    const look = deps.look ? memberLook(deps.look()) : null;
    if (look) p.look = look;
    if (!saving) return;
    // LEGACY-HOME + AUDIT LEGACY II A6: the houses the one played holds are the line's - a deed is the character's own,
    // so the line learns it with the save that holds it (an unsaved purchase or sale moved the line, and another
    // member's load found it in a house that member's save does not own). LEGACY7 part five: online too - the realm
    // keeps the line, and a realm character's online homes are its houses (Legacy-Arc 10b; the world hands which)
    syncHousesNow(p);
    // where this save is made - in one of the family's houses the member is PARKED there, and stands in it while
    // another is played; anywhere else they are on their own journey (systems/legacy/household.js homeOf)
    const here = deps.houseHere?.() ?? null;
    p.parked = here && (family.houses ?? []).some((h) => sameHouse(h, here)) ? { mapId: here.mapId, buildingKey: here.buildingKey } : null;
  }
  /** The played member's held houses into the line's - offline their deeds, online their online homes (the world hands
   *  which). Null held is not known yet (online: the realm's homes not read): nothing learned, nothing dropped. Answers
   *  whether they changed. */
  function syncHousesNow(p) {
    const held = deps.heldHouses?.() ?? null;
    if (held == null) return false;
    return syncHouses(family, p.id, held, p.deedsTaken ?? []);   // PERMADEATH-HOUSES: the dead's deeds their save took up
  }
  /** AUDIT LEGACY II A1: whether the character in the world IS the one the record plays - after a choice hands the line
   *  to another (the Succession, a switch) the page runs on under the old character until the boot lands, and the slow
   *  tick paid the heir's estate into the dying page and claimed the fallen's remains as the heir's. */
  const playedHere = (p) => {
    const cid = cidOf();
    return !cid || p.characterId === cid;
  };
  const cidOf = () => (deps.entity?.characterId ? String(deps.entity.characterId) : null);
  /** The stored family a character is of, or null - a save made before its family was founded (AUDIT LEGACY A3). */
  const familyOfCharacter = (cid) => (cid ? listFamilies(deps.storage()).find((f) => f.people.some((p) => p.characterId === cid)) ?? null : null);

  // THE MOD'S IHasModSaveData (Project_Legacy.GetSaveData / RestoreSaveData / NewSaveData).
  registerModSaveData(LEGACY_VENDOR, {
    newSaveData: () => null,
    getSaveData: () => {
      if (!family) return null;
      // STORM-SHED 2 (2026-10-06, the account database's follow-ups): A SAVE THAT CHANGES NOTHING LEAVES THE LINE AS IT
      // WAS. Every save stamped the played member (`savedAt`, `lived` - the clock's) and moved the line's rev, so the
      // record was never the one the realm held: online, every two-minute checkpoint wrote the line again
      // (/v1/realm/lineage, up to 128 KiB), and the checkpoint itself - which carries the record - was never idle
      // (realmSaves.js idleKeyOf). Measured against what the store last took from this page, never against the line
      // before this save (a write that changed the line and left its storing to the next save - a death recorded - is
      // stored by it), and only while the store still holds that write: another tab's since is merged in as before.
      // The clock's stamps ride the next save that changes anything, as the save's own clocks do; the realm's copy is
      // asked again (realmLine.js push: none when it landed, the dropped write's retry when it did not).
      const was = current();
      const stamps = was ? { savedAt: was.savedAt, lived: was.lived } : null;
      writeCurrent({ saving: true });   // never the past's (its own guard): the past's save carries the line as it stands
      if (!past && current() && playedHere(current())) claimTouched();   // a list changed since the last tick is claimed by the save that holds it
      if (storedBody != null && lineBody() === storedBody && loadFamily(deps.storage(), family.id)?.rev === seenRevOf(family)) {
        if (was && stamps) for (const k of /** @type {const} */ (['savedAt', 'lived'])) { if (stamps[k] === undefined) delete was[k]; else was[k] = stamps[k]; }
        deps.stored?.(family);
        return JSON.parse(JSON.stringify(family));
      }
      touch(family);
      store();
      return JSON.parse(JSON.stringify(family));
    },
    restoreSaveData: (rec) => adopt(rec),
    // a new game: a born member's family, or none (the chargen's onCharacterMade founds one)
    newGame: () => {
      past = null; outcome = null; deathSeen = false;
      residentsKept.clear();
      if (born) { family = born.family; return; }
      const cid = cidOf();
      if (!(family && cid && currentOf(family)?.characterId === cid)) family = null;   // the wizard's founding may land first
    },
  });

  /** A save's copy beside the store's (mergeFamily); the played character is the one this save is of. */
  function adopt(rec) {
    past = null; outcome = null; deathSeen = false; elderSaid = false; bornShare = null;
    openedThisVisit.clear(); restAskedThisVisit.clear(); remainsSig = ''; residentsKept.clear(); openedSig.clear(); deedsSaid.clear();
    const cid = cidOf();
    const saved = readFamily(rec);
    const stored = saved ? loadFamily(deps.storage(), saved.id) : familyOfCharacter(cid);
    family = mergeFamily(stored, saved, cid);
    if (!family) return;
    if (stored && family.id === stored.id) noteSeen(family, stored.rev);   // AUDIT LEGACY III A2: made from the store as it stands
    const me = cid ? family.people.find((p) => p.characterId === cid) : null;
    // AUDIT LEGACY II H1: a record that has no person for the character played is not theirs - a copy brought across the
    // lanes carried its original's, and played as them. Let go: the character founds its own house (found).
    if (!me) { family = null; return; }
    if (!isAlive(me) || me.retired != null) { past = me; return; }   // THE PAST: refused under either model, for good
    if (family.pending && family.pending.fallenId !== me.id) settlePending(me);   // a living member loaded: they take the mantle
    if (family.ended != null) { family.ended = null; deps.say?.(LEGACY_TEXT.ended(family.surname)); }   // AUDIT LEGACY A8: a member plays on - the line goes on
    setCurrent(family, me.id);
    syncHousesNow(me);   // the loaded character's deeds, the line's (AUDIT LEGACY II A6)
    // AUDIT LEGACY III A6: a house left nameless with its seat noted (before LEGACY-NAME) is named at its next load
    const named = nameAtSeat(family);
    touch(family);
    store();
    if (named) deps.say(LEGACY_TEXT.named(family.surname));
  }

  /** FOUND the family around the character being played - a new character's answer, or its Features tile's model. LEGACY7:
   *  online too - the realm keeps the line and a Bloodline's tombstone (server-account/src/legacy.js). `atLoad` - the
   *  boot's own call (afterBoot), for a character loaded with no house; else a character's birth. */
  function found(model = null, { atLoad = false } = {}) {
    if (family || past || !deps.on() || !deps.entity?.chargenDone) return family;
    const known = familyOfCharacter(cidOf());
    if (known) { adopt(known); return family; }   // the store knows this character's house - never a second
    // LEGACY-CHOICE (Mac: "the option that skips the liniage system entirely"): the character's own answer, kept on them -
    // one who answered no lineage founds no house, at their birth or at any load, in either lane
    const chose = model ?? deps.entity?.legacyChoice ?? null;
    if (chose === NO_LINEAGE) return null;
    // LEGACY-CHOICE (Mac: "Current characters already created start without this system and requires a new game"):
    // ONLINE A HOUSE IS FOUNDED AT A CHARACTER'S BIRTH ALONE - one made before the question was put online, or copied in
    // from the offline lane, plays without one (it was founded Enduring at its first load: AUDIT LEGACY B4's law, gone
    // with it). Offline an older character is founded at its first load as ever (D9).
    if (atLoad && deps.online()) return null;
    const s = legacySettings();
    // a birth no question was put to (the headless door) founds online's safe answer, offline its Features tile's
    const asked = isModel(chose) ? chose : deps.online() ? MODELS.enduring : s.model;
    family = foundFamily(deps.entity, { model: asked, seat: deps.town(deps.here()), at: deps.now(), rng, settings: s });
    const p = current();
    p.bornOwn = Math.floor(deps.own() ?? 0);
    rollSiblings(family, p.id, { rng, at: deps.now(), settings: s });   // SaveCurrentCharacter(firstTime) -> CreateRandomSiblings
    store();
    deps.say(LEGACY_TEXT.founded(family.surname, family.model));
    if (family.seat) deps.say(LEGACY_TEXT.seat(family.seat.loc));
    return family;
  }

  /** What was set aside for a member - the estate's gold and an elder's bequest - is paid on their days as the one
   *  played: a letter of credit and the pieces themselves. `estatePaid`/`bequestPaid` are the save's (mergeFamily). */
  function payEstateOf(p, { write = true } = {}) {
    if (!p) return;
    const due = Math.max(0, (p.estate | 0) - (p.estatePaid | 0));
    const pieces = (p.bequest ?? []).slice(p.bequestPaid | 0);
    if (!due && !pieces.length) return;
    p.estatePaid = p.estate | 0;
    p.bequestPaid = (p.bequest ?? []).length;
    touch(family);
    if (due) { deps.payEstate?.(due); deps.say(LEGACY_TEXT.estate(due)); }
    if (pieces.length) {
      // ITEM-WALK B (2026-10-07): A BEQUEST IS REPAIRED AS IT IS PAID. It reaches its heir from the line's record, by no
      // load - at the heir's birth, or on their first days played - and that record may be the device's copy, never the
      // save's (mergeFamily). So the load's item repairs (systems/save.js repairItemLists) run on the pieces paid, as a
      // load runs them on every list a save holds; the line's record keeps its own, paid once.
      const given = pieces.map((it) => JSON.parse(JSON.stringify(it)));
      repairItemLists([given]);
      deps.giveItems?.(given);
      for (const it of given) deps.say(LEGACY_TEXT.bequest(it.heirloom?.base ?? it.name ?? 'an heirloom'));
    }
    if (write) store();
  }

  /**
   * PERMADEATH-HOUSES (2026-10-09, the owner: "what happens to houses owned by dead permadeath characters" - the heir
   * inherits): THE DEAD'S DEEDS TAKEN UP by the one who carries the line (household.js deedsDue) - the Succession's heir
   * once they land, or the one played when one of the line dies in the street - each handed to the world
   * (`inheritHouse`: offline the bank's deed and the house's things out of the dead's own save, online the account
   * service's home and its cupboards out of the dead's realm record):
   *   - 'given': theirs - `deedsTaken`, the save's, so a reload before the save that holds it hands it again;
   *   - 'waits': a house of theirs stands in that region already (the bank deeds one a region) - said once a page, and
   *     taken up the first tick the region is free;
   *   - 'gone': the dead hold it no more (online, a home sold after their last save reached the line) - the row goes;
   *   - anything else (online, the service still asked): asked again next tick.
   */
  const deedsSaid = new Set();
  function takeDeeds(p) {
    if (!deps.inheritHouse) return;
    let changed = false;
    for (const h of deedsDue(family, p)) {
      const fallen = personOf(family, h.by);
      const key = houseKeyOf(h);
      const r = deps.inheritHouse(h, fallen);
      if (r === 'given') {
        (p.deedsTaken ??= []).push(key);
        changed = true;
        deps.say(LEGACY_TEXT.deed(h.location, fallen.given));
      } else if (r === 'gone') {
        family.houses = (family.houses ?? []).filter((x) => !sameHouse(x, h));
        changed = true;
      } else if (r === 'waits' && !deedsSaid.has(key)) {
        deedsSaid.add(key);
        deps.say(LEGACY_TEXT.deedWaits(h.location, fallen.given));
      }
    }
    if (changed) { touch(family); store(); }
  }

  /** The waiting Succession answered by `heir` - the estate and the bequest theirs, the mantle theirs. */
  function settlePending(heir) {
    const pend = family.pending;
    if (!pend) return;
    heir.estate = (heir.estate | 0) + (pend.estate | 0);
    heir.bequest = [...(heir.bequest ?? []), ...(pend.bequest ?? [])];
    family.pending = null;
    touch(family);
    huntHeir(heir, personOf(family, pend.fallenId));
  }
  /** LEGACY6: THE KILLER REMEMBERED - the revenant that ended the fallen (their own mirror, revenant.js killerOf) hunts
   *  the one who took the mantle (inheritRevenant), and the record and the death quest name it. */
  function huntHeir(heir, fallen) {
    if (!fallen?.characterId || !fallen.died) return;
    const foe = deps.killerOf?.(fallen.characterId, (fallen.bornOwn | 0) + (fallen.lived | 0)) ?? null;
    if (!foe?.name) return;
    fallen.died.by = foe.name;
    for (const r of family.remains ?? []) if (r.of === fallen.id) r.killer = foe.name;
    if (deps.inheritFoe?.(foe)) deps.say(LEGACY_TEXT.hunted(foe.name, fallen.given));
  }
  /** LEGACY6: something the house's towns will talk of - at the town's minute, in `mapId` (and in the seat). */
  function tellNews(kind, who, mapId) {
    if (noteNews(family, kind, who, deps.sky?.() ?? deps.now(), mapId ?? null)) touch(family);
  }

  // ---- the death -------------------------------------------------------------------------------------------------

  /** The Succession the waiting fall offers: its fallen, the estate, every living member of the blood, a newborn. */
  function fallOutcome() {
    const pend = family?.pending;
    const fallen = pend ? personOf(family, pend.fallenId) : null;
    if (!fallen) return null;
    return {
      kind: 'fall', fallen, estate: pend.estate | 0, choices: successors(family).filter((p) => p.id !== fallen.id),
      newborn: fallen.retired != null || newbornAllowed(family, fallen, legacySettings()),
    };
  }

  /**
   * THE DEATH, AT THE DOOR (characters/playerEntity.js onPlayerDeath - every host's one damage door, the blow that
   * crosses to zero): decided and written now, before any screen, mode exit or reload can intervene.
   *   - Enduring: Arkay's toll is paid, and the member will rise - unless their span was already spent, when they die of
   *     their years and fall. ONLINE a spent member rises at the last breath: the final death waits on LEGACY7.
   *   - Bloodline: the member falls - recorded dead (B13), the remains laid, the Succession left waiting on the
   *     record. ONLINE Project Legacy has no say until the realm keeps lineages (LEGACY7): the room's respawn stands.
   * Answers the outcome (the reset presents it), or null when Project Legacy has none.
   */
  function onDeath() {
    if (deathSeen) return outcome;   // one death, one decision - the door and the DEATH-KEPT re-ask both reach here
    deathSeen = true;
    outcome = null;
    const p = current();
    if (!family || !p || !deps.on() || past || family.pending || !isAlive(p) || p.retired != null || !deps.entity?.chargenDone) return null;
    writeCurrent();
    const d = { at: deps.now(), place: deps.here(), gold: deps.gold(), by: deps.killer?.() ?? null, cause: 'fell' };
    if (family.model === MODELS.enduring) {
      const cursed = !!(deps.entity && (liveVampirism(deps.entity) || liveLycanthropy(deps.entity)));   // AGELESS-CURSE: a vampire or a lycanthrope pays no toll
      const paid = payToll(p, legacySettings().tollShare, p.lived, { ageless: cursed });
      touch(family);
      store();
      if (!paid.final) { outcome = { kind: 'rise', line: tollLine(p.given, paid) }; return outcome; }
      d.cause = 'years';
    }
    // PERMADEATH-HOUSES: the deeds they die holding are the line's to hand on, as their purse is - the live ones (a house
    // bought since their last save is theirs too: the gold it cost left the estate with it)
    syncHousesNow(p);
    recordDeath(family, p.id, { at: d.at, cause: d.cause, place: d.place, by: d.by });
    tellNews('died', fullNameOf(p.given, p.surname), d.place?.mapId);
    layDeathRemains(p, d);
    family.pending = { fallenId: p.id, at: d.at, estate: estateOf(d.gold), bequest: [] };
    touch(family);
    store();
    entomb();
    outcome = fallOutcome();
    return outcome;
  }
  /** LEGACY7: ONLINE, A FALL IS THE REALM'S TOMBSTONE (server-account/src/legacy.js realmDie) - and an elder's
   *  retirement, the other way a member is never played again - asked at the door, and
   *  again before anyone carries on (`succeed` waits on it): a character whose death the realm never heard could be
   *  joined again from an older save. */
  let tomb = null;
  function entomb() {
    if (!deps.online() || !deps.tombstone) return null;
    // LEGACY7 part three: an elder's retirement says so - the realm keeps their union with another player's character
    const fallen = personOf(family, family?.pending?.fallenId);
    const why = fallen && !fallen.died && fallen.retired != null ? 'retired' : 'fell';
    tomb = Promise.resolve(deps.tombstone(why)).then((ok) => { if (!ok) { tomb = null; deps.say(LEGACY_TEXT.unTombed); } return !!ok; }, () => { tomb = null; deps.say(LEGACY_TEXT.unTombed); return false; });
    return tomb;
  }

  /**
   * THE DEATH'S OUTCOME, asked by the host at the death screen's reset - what the door decided:
   *   - `{ kind: 'none' }`: Project Legacy has no say (off, no family, the past played back, online Bloodline) - the
   *     host's own death stands;
   *   - `{ kind: 'rise', line }`: an Enduring member paid the toll - the host respawns them and says `line`;
   *   - `{ kind: 'fall', fallen, estate, choices, newborn }`: the member is dead for good - the host shows the
   *     Succession (it waits on the record until answered).
   */
  function deathOutcome() {
    if (!deathSeen) onDeath();   // a host whose door is not heard (a test, a death raised around the door) - decided now
    deathSeen = false;
    const out = outcome ?? (family?.pending && !past ? fallOutcome() : null) ?? { kind: 'none' };
    outcome = null;
    return out;
  }
  /** Whether the next reset will raise the dead (an Enduring rise) - the dungeon's start-marker arm reads it. */
  const willRise = () => outcome?.kind === 'rise';

  // ---- LEGACY4: the remains and the death quest -------------------------------------------------------------------

  /** At a final death: THE REMAINS lie where the fallen fell - their bones, the heirloom (Bloodline: its Features tile's
   *  chance; an Enduring elder dead of their years: always) and a tenth of the purse - a list the RECORD owns, opened as
   *  a container where they lie (AUDIT LEGACY H1/H6: a world pile was laid again at every visit and every reload, the
   *  heirloom with it, and a pile collected with its pixel took its purse with it). `first` keeps the list as laid. */
  function layDeathRemains(p, d) {
    const chance = family.model === MODELS.bloodline ? legacySettings().heirloomChance : 1;
    const piece = rng() < chance ? pickHeirloom(deps.entity?.items) : null;
    const name = fullNameOf(p.given, p.surname);
    const gold = remainsGoldOf(d.gold);
    const items = [
      mintRemainsItem({ line: family.id, of: p.id, name }),
      ...(piece ? [markHeirloom(piece, { line: family.id, house: family.surname, of: p.id, from: name })] : []),
      ...(gold > 0 ? [goldStack(gold)] : []),
    ];
    (family.remains ??= []).push({
      id: `r${p.id}`, of: p.id, name, place: d.place ?? null, items, first: JSON.parse(JSON.stringify(items)),
      killer: d.by ?? null, at: d.at, state: 'lying', by: null, found: false,
    });
  }
  /** The remains the one played may seek: every one of the line's still lying or carried - by them, by nobody, or by a
   *  member no longer there to carry them (dead or retired: the claim lapses, and the bones lie again). */
  const openRemains = () => {
    const me = current();
    const rows = (family?.remains ?? []).filter((r) => r.state === 'lying' || r.state === 'taken');
    let lapsed = false;
    for (const r of rows) {
      const by = r.by != null ? personOf(family, r.by) : null;
      if (r.by != null && r.by !== me?.id && (!by || !isAlive(by) || by.retired != null)) {
        // AUDIT LEGACY II A3: the list as the lapsed claimant LEFT it is what lies now - the next claimant's rewinds
        // return to it, never to the list as first laid (which still held what the lapsed one took)
        r.by = null; r.state = 'lying'; r.first = JSON.parse(JSON.stringify(r.items)); lapsed = true;
      }
    }
    if (lapsed) { touch(family); store(); }
    return rows.filter((r) => r.by == null || r.by === me?.id);
  };
  /** AUDIT LEGACY II H5: the remains another living member has claimed - the one played's log says whose search it is. */
  const claimedByOthers = () => {
    const me = current();
    return (family?.remains ?? []).filter((r) => (r.state === 'lying' || r.state === 'taken') && r.by != null && r.by !== me?.id);
  };
  /** AUDIT LEGACY II H5: a list is CLAIMED by the member who CHANGES it, not by one who opens it and walks away (the
   *  quest left every other member's log for nothing). Each list as it stood when opened, by remains id. */
  const openedSig = new Map();
  const itemsSig = (items) => JSON.stringify(items);
  function claimTouched() {
    const me = current();
    if (!me) return;
    for (const r of family?.remains ?? []) {
      if (r.by != null || !openedSig.has(r.id) || itemsSig(r.items) === openedSig.get(r.id)) continue;
      r.by = me.id;
      openedSig.delete(r.id);
      touch(family);
    }
  }
  const bonesOf = (r) => (it) => isRemainsItem(it) && it.legacyRemains.line === family.id && it.legacyRemains.of === r.of;
  const carriedNow = () => deps.carried?.() ?? deps.entity?.items ?? [];

  /** The death quest's step (the host's slow tick). The list is the record's: what the heir took from it is theirs, and
   *  the bones say where the quest stands - in the list (lying), in the heir's keeping (taken; the pack, the wagon or
   *  the bag), or gone from both, when they lie again where the fallen fell (AUDIT LEGACY H4: sold, dropped or left on
   *  a body, they stranded the quest). */
  function remainsStep() {
    const me = current();
    const carried = carriedNow();
    for (const r of openRemains()) {
      const inList = r.items.some(bonesOf(r));
      const kept = carried.some(bonesOf(r));
      if (r.state === 'lying' && !inList && kept) {
        r.state = 'taken'; r.by = me.id;
        touch(family); store();
        deps.say(LEGACY_TEXT.remainsTaken(r.name));
      } else if (!inList && !kept) {
        r.items.unshift(mintRemainsItem({ line: family.id, of: r.of, name: r.name }));
        const was = r.state;
        r.state = 'lying';   // AUDIT LEGACY II H2: the claim stays the claimant's - the bones lie again for them to find
        touch(family); store();
        if (was === 'taken') deps.say(LEGACY_TEXT.remainsReturned(r.name));
      }
      if (r.state === 'lying') {
        const here = deps.atPlace?.(r.place) ?? false;
        if (!here) { openedThisVisit.delete(r.id); continue; }
        if (openedThisVisit.has(r.id) || deps.inFight()) continue;
        // AUDIT LEGACY II H4: the list wears its remains' mark while open - the bones go back into it, and into nothing
        // that is not the character's own keeping (systems/itemTransfer.js planStore)
        Object.defineProperty(r.items, REMAINS_LIST, { value: r.of, configurable: true, writable: true, enumerable: false });
        repairItemLists([r.items]);   // ITEM-WALK B: the load's item repairs on the list as it opens, whichever copy it came from - before its claim's mark
        if (deps.openRemains?.(r, r.items)) {
          openedThisVisit.add(r.id);
          if (r.by == null && !openedSig.has(r.id)) openedSig.set(r.id, itemsSig(r.items));   // claimed once changed (claimTouched)
          if (!r.found) { r.found = true; deps.say(LEGACY_TEXT.remainsFound(r.name)); touch(family); store(); }
        }
      } else if (r.state === 'taken' && !restAskedThisVisit.has(r.id) && deps.atRest?.()) {
        if (deps.askRest?.(r.name, () => layToRest(r))) restAskedThisVisit.add(r.id);   // asked only once it was SHOWN
      }
    }
    if (!deps.atRest?.()) restAskedThisVisit.clear();
    claimTouched();
    // what the heir took from an open list is the record's to keep - written as it changes
    const sig = JSON.stringify((family.remains ?? []).map((r) => [r.id, r.items.length, r.state]));
    if (sig !== remainsSig) { if (remainsSig) { touch(family); store(); } remainsSig = sig; }
  }
  /** THE REST: the remains given up, the heirloom carried home attuned, the blessing on the one who laid them. */
  function layToRest(r) {
    const carried = carriedNow();
    const bones = carried.find(bonesOf(r));
    if (!bones || r.state !== 'taken') return false;
    deps.takeItem?.(bones);
    const fallen = personOf(family, r.of);
    if (fallen) {
      const b = blessingOf(fallen, r.name);
      const before = blessedIn(deps.entity, b.skill);
      (deps.entity.legacyBlessings ??= []).push(b);
      deps.say(LEGACY_TEXT.rested(r.name, SKILL_NAMES[b.skill] ?? 'skill', blessedIn(deps.entity, b.skill) - before));
    }
    const heirloom = carried.find((it) => isHeirloom(it) && it.heirloom.line === family.id && it.heirloom.of === r.of);
    if (heirloom) { attuneHeirloom(heirloom); deps.say(LEGACY_TEXT.attuned(heirloom.heirloom.base, heirloom.heirloom.gen)); }
    r.state = 'rested';
    r.restedAt = deps.now();
    // AUDIT LEGACY II P6: what was left with them is laid to rest with them - a rested row's lists were kept forever,
    // two copies of each, in the store and in every save
    r.items = [];
    delete r.first;
    tellNews('rested', r.name, deps.here()?.mapId);   // LEGACY6: the towns hear of it
    touch(family);
    store();
    return true;
  }
  /** The death quests in the quest log - the Quest Guide's tracker and marks read them (GUIDE4, GUIDE5). */
  function questLogEntries() {
    if (!family || !deps.on() || past) return [];
    return openRemains().map((r) => {
      const where = r.place?.loc ? `${r.place.loc}${r.place.region ? `, ${r.place.region}` : ''}` : (r.place?.region || 'the Bay');
      const lines = r.state === 'lying'
        ? [`${r.name} fell at ${where}${r.place?.mode === 'dungeon' ? ', deep inside' : ''}. Their remains lie there still - marked on your map.`,
          ...(r.killer ? [`It was ${r.killer} that struck them down.`] : []),
          ...(r.items.some((it) => isHeirloom(it)) ? ['Something of theirs lies with them - a piece the house will want back.'] : []),
          'Find them, and carry them home.']
        : [`You carry the remains of ${r.name}.`, 'Lay them to rest at any temple, or at the family’s seat, and their blessing will stay with you.'];
      return { id: `${LEGACY_QUEST_PREFIX}${r.id}`, name: `The Bones of ${r.name}`, questName: 'LEGACY', legacy: true, messages: [lines] };
    }).concat(claimedByOthers().map((r) => {
      const by = personOf(family, r.by);
      return { id: `${LEGACY_QUEST_PREFIX}${r.id}`, name: `The Bones of ${r.name}`, questName: 'LEGACY', legacy: true,
        messages: [[LEGACY_TEXT.claimed(r.name, by ? fullNameOf(by.given, by.surname) : 'Another of the house'), 'Play as them to carry it on.']] };
    }));
  }
  /** The remains still lying, ringed on the maps where the fallen fell - while the mod is on (AUDIT LEGACY B8). */
  const mapMarks = () => (family && deps.on() && !past ? openRemains() : []).filter((r) => r.state === 'lying' && r.place?.pixel).map((r) => ({
    cx: r.place.pixel.x + 0.5, cy: r.place.pixel.y + 0.5, r: LEGACY_RING_R, label: `The remains of ${r.name}`, id: `${LEGACY_QUEST_PREFIX}${r.id}`, place: r.place.mode === 'dungeon', farmKey: null,
  }));

  /**
   * THE SUCCESSION'S CHOICE: `{ personId }` a living member, or `{ newborn: true }` a child of the fallen - the waiting
   * fall's (`family.pending`): its estate and bequest go to whoever takes the mantle. A member already played is
   * LOADED; one never played is BORN. Answers whether the boot was asked. LEGACY7: online too - the boot waits on the
   * realm's tombstone of the fallen (and on the line's write, the world host's boot) first.
   */
  function succeed(choice) {
    if (!family) return false;
    if (deps.online() && family.pending && !tomb) entomb();   // a tombstone refused or unheard at the door, asked again
    const s = legacySettings();
    const fallenId = family.pending?.fallenId ?? family.currentId;
    let heir = null;
    let lore = null;
    if (choice?.newborn) {
      const made = addChild(family, fallenId, { rng, at: deps.now(), settings: s });
      heir = made.person;
      if (made.changed) lore = LEGACY_TEXT.lore(heir.given, made.from, heir.surname);   // AUDIT LEGACY III A5/F1: the line it left
      rollSiblings(family, heir.id, { rng, at: deps.now(), settings: s });   // HandlePlayerDeath -> CreateRandomSiblings
    } else {
      heir = personOf(family, choice?.personId);
      if (!heir || !isAlive(heir) || heir.kind !== 'member' || heir.retired != null) return false;
    }
    heir.minor = false;   // LEGACY5: they come of age in the telling (Legacy-Arc section 10's departure)
    // AUDIT LEGACY II B1: the waiting fall is answered when the heir LANDS (a member's load: adopt; a birth: onBorn), not
    // at the choice - a boot that never landed (a member whose saves were deleted, a birth whose files failed) settled
    // the fall and moved the estate to someone who could not be played, and the line had no Succession left to answer
    setCurrent(family, heir.id);
    touch(family);
    store();
    if (lore) deps.say(lore);
    const newborn = !!choice?.newborn;
    if (tomb) { const t = tomb; tomb = null; t.then((ok) => { if (ok) play(heir, null, { newborn }); }); return true; }
    return play(heir, null, { newborn });
  }

  /** Into the world as `p`: their newest save, or their birth. */
  function play(p, at = null, { newborn = false } = {}) {
    if (p.characterId && deps.loadCharacter(p.characterId)) return true;
    // AUDIT LEGACY II A2/B1: a character id no save holds (their saves deleted, a first save the storage refused) is no
    // character - they are born again, from their person
    if (p.characterId && deps.hasSave && !deps.hasSave(p.characterId)) { p.characterId = null; touch(family); store(); }
    const place = at ?? family.seat ?? deps.nearestTown(deps.here()) ?? { region: 'Daggerfall', loc: 'Daggerfall' };
    leaveBirth(deps.tab(), { familyId: family.id, personId: p.id, region: place.region, loc: place.loc, estate: 0, ...(newborn ? { newborn: true } : {}) });
    deps.boot(birthSearch(deps.search(), p.id, place));
    return true;
  }

  /** The line ends (no member, no heir - or the player's word): kept in the Hall, closed. */
  function endLine() {
    if (!family) return;
    endFamily(family, deps.now());
    store();
  }

  // ---- the switch (FamilyLegacyInformationPanel's double-click, SwitchCharacterManager) -----------------------------

  /** Why a switch to `id` is refused, or null. S3: never mid-fight. LEGACY7: online too - a member is the realm's
   *  character of their own (born at the service as that person, joined as any realm character is). */
  function switchRefusal(id) {
    const t = personOf(family, id);
    if (!family || past || !t || !isAlive(t) || t.kind !== 'member' || t.id === family.currentId || t.retired != null) return 'none';
    if (family.pending) return LEGACY_TEXT.pending;
    if (t.minor) return LEGACY_TEXT.minor(t.given);   // LEGACY5: a child is played only once the mantle passes to them
    if (deps.inFight()) return LEGACY_TEXT.fight;
    return null;
  }
  /** Save the one played where they stand (the mod's anchor, D7), then play the other - never without the save
   *  (AUDIT LEGACY B6: a refused save on a deck lost the member left behind). LEGACY-HOME: `here` - met in the world, a
   *  member never played is born in the town they were met in, not the seat's. */
  function switchTo(id, { here = false } = {}) {
    const why = switchRefusal(id);
    if (why) return { ok: false, why };
    writeCurrent();
    if (!deps.saveNow()) return { ok: false, why: LEGACY_TEXT.notSaved };
    setCurrent(family, id);
    touch(family);
    store();
    return { ok: play(personOf(family, id), here ? deps.town(deps.here()) : null) };
  }

  /** Why the played elder may not pass the mantle now, or null. */
  function mantleRefusal() {
    const p = current();
    if (!family || past || !p || !deps.on() || family.model !== MODELS.enduring) return 'Only an Enduring house passes its mantle.';
    if (family.pending) return LEGACY_TEXT.pending;
    if (!isElder(p, lived())) return `${p.given} is not yet an elder of the house.`;
    if (deps.inFight()) return LEGACY_TEXT.fight;
    return null;
  }
  /** LEGACY2: AN ELDER PASSES THE MANTLE - an Enduring family's played member, an elder, retires to the seat (alive, kept
   *  on the tree, never played again) and hands their heirloom down (the arc's section 6: always one - the bequest,
   *  paid to whoever takes the mantle), saved where they stand WITH the retirement in the save (AUDIT LEGACY A5: the
   *  save came first, and loading it played the elder again). The Succession is the host's to open with the outcome. */
  function passMantle() {
    const why = mantleRefusal();
    if (why) return { ok: false, why };
    const p = current();
    writeCurrent();
    const at = deps.now();
    const piece = pickHeirloom(deps.entity?.items);
    const name = fullNameOf(p.given, p.surname);
    p.retired = at;
    family.pending = { fallenId: p.id, at, estate: 0, bequest: piece ? [markHeirloom(piece, { line: family.id, house: family.surname, of: p.id, from: name })] : [] };
    touch(family);
    if (!deps.saveNow()) {
      p.retired = null;
      family.pending = null;
      touch(family);
      return { ok: false, why: LEGACY_TEXT.notSaved };
    }
    store();
    entomb();   // LEGACY7: online, a retired elder's character is the realm's tombstone too - never played again
    past = p;   // the elder's own world stands under the Succession; nothing more is theirs to write
    return { ok: true, outcome: fallOutcome() };
  }

  // ---- the boot's birth --------------------------------------------------------------------------------------------

  /** `?legacyborn=<id>`: the waiting birth, read - its family is the new game's. Null when none waits. */
  function takeBorn(personId) {
    const b = readBirth(deps.tab(), personId);
    if (!b) return null;
    const f = loadFamily(deps.storage(), b.familyId);
    const p = personOf(f, b.personId);
    if (!f || !p || !isAlive(p)) return null;
    // a person already born is loaded, never born twice - one whose character id no save holds was never born
    // (AUDIT LEGACY II A2/B1: the birth door and the play door now ask the same question)
    if (p.characterId && (!deps.hasSave || deps.hasSave(p.characterId))) return null;
    p.characterId = null;
    setCurrent(f, p.id);
    born = { family: f, person: p, newborn: b.newborn === true };
    family = f;
    noteSeen(f, f.rev);   // AUDIT LEGACY III A2: the store's own record, as it stands
    return born;
  }

  /**
   * THE BORN MEMBER'S CHARGEN RESULT - what the wizard hands finishChargen, built from the person (the arc's section
   * 4): their career (a custom one whole, else the CLASS*.CFG the flow loaded), DFU's own roll for it with its pools
   * spent lowest-first (createCharacter's headless policy), the blood and the hearth on top (bornValues), their name,
   * race, sex and face, and their parent's leveling system.
   */
  function bornResult({ careers, factionDict }) {
    const p = born?.person;
    if (!p) return null;
    const custom = isCustomCareer(p);
    const career = custom ? p.career : careers?.[p.careerIndex]?.career;
    if (!career) return null;
    const { stats, bonusPool } = rollStats(career, rng);
    spendPoolLowest(stats, STAT_KEYS_ORDER, bonusPool);
    const { skills, groupPools } = rollSkills(career, rng);
    spendPoolLowest(skills, career.primarySkills, groupPools.primary);
    spendPoolLowest(skills, career.majorSkills, groupPools.major);
    spendPoolLowest(skills, career.minorSkills, groupPools.minor);
    const values = bornValues(p, { stats, skills });
    const parent = p.parents.length ? personOf(family, p.parents[0]) : null;
    return {
      name: fullNameOf(p.given, p.surname), gender: p.gender, race: p.race, raceId: p.raceId, faceIndex: p.face,
      careerIndex: p.careerIndex, career, stats: values.stats, skills: values.skills, isCustom: custom, customReps: null,
      biographyEffects: [], reflexes: BORN_REFLEXES, factionDict,
      backStory: [`${parent ? `Child of ${fullNameOf(parent.given, parent.surname)}, of` : 'Of'} the house${houseWord(family.surname) ? ` of ${houseWord(family.surname)}` : ''}.`],   // LEGACY-NAME
      levelingSystem: p.leveling ?? LEVELING_CLASSIC,
    };
  }

  /** After finishChargen built the born member: their character is their person's, their first day pays - and the
   *  game is SAVED there (the mod's SaveCurrentCharacter(firstTime)), so the birth, the estate and the letter stand
   *  together (AUDIT LEGACY A6: a reload before the first save lost all three) and the boot's handoff is answered. */
  function onBorn() {
    const p = born?.person;
    if (!p) return;
    const newborn = born.newborn === true;
    born = null;
    const seen = seenRevOf(family);
    // AUDIT LEGACY II A2/H3/B1: the birth stands only with its save - the person's character id and the estate paid were
    // written first, so a first save the storage refused left a person with an id no save held, whom the birth door
    // then refused for good, and the estate with them. The fall the birth answers is settled here, as it lands.
    // Undone if the save fails: the handoff stays, and the reload bears them again.
    const was = JSON.parse(JSON.stringify(family));
    if (family.pending && family.pending.fallenId !== p.id) settlePending(p);
    writePlayer(p, deps.entity);
    p.bornOwn = Math.floor(deps.own() ?? 0);
    p.lived = 0;
    // LEGACY6: THE BIRTH'S SHARE of what the world thought of the parent - the law and the guilds a quarter, the town's
    // regard a half (influence.js); kept for the page, so a new game's fresh relations take it too (seedRegards)
    const parent = (p.parents ?? []).map((id) => personOf(family, id)).find((q) => q?.standing) ?? null;
    bornShare = parent?.standing ? { personId: p.id, standing: parent.standing } : null;
    inheritStanding(deps.entity, bornShare?.standing ?? null);
    inheritRegards(deps.regards?.() ?? null, bornShare?.standing ?? null, deps.regardDay?.() ?? 0);
    touch(family);
    const here = deps.here();
    // AUDIT LEGACY III A9/F9: a NEW child is news - the Succession's newborn heir; a member long of the house played for
    // the first time (an adult sibling, a child of a marriage the towns already heard of) is no birth
    if (newborn) tellNews('born', fullNameOf(p.given, p.surname), here?.mapId);
    const loc = deps.town(here)?.loc ?? family.seat?.loc ?? '';
    deps.say(LEGACY_TEXT.born(fullNameOf(p.given, p.surname), loc || 'the Bay'));
    payEstateOf(p, { write: false });
    const landed = (ok) => {
      if (ok) { store(); clearBirth(deps.tab()); return true; }
      family = readFamily(was);
      noteSeen(family, seen);   // the copy as it was, made from the store as that one was
      deps.say(LEGACY_TEXT.notBorn(p.given));
      return false;
    };
    // LEGACY7: online the first save is the realm's checkpoint, answered later - the birth stands with it all the same
    const saved = deps.saveNow();
    return saved && typeof /** @type {any} */ (saved).then === 'function' ? Promise.resolve(saved).then((ok) => landed(!!ok), () => landed(false)) : landed(!!saved);
  }
  /** LEGACY7: THE REALM NAMED THE CHARACTER (scenes/world.js realmBirth: its id is the service's, never the client's) -
   *  the person played under `was` is played under `now` from here, so the record and the save agree on who they are
   *  (a founder born online kept the client's id, and their next load founded a second house). */
  function rebind(was, now) {
    const p = family && was ? family.people.find((x) => x.characterId === String(was)) : null;
    if (!p || !now || p.characterId === String(now)) return false;
    p.characterId = String(now);
    touch(family);
    store();
    return true;
  }

  // ---- the frame ---------------------------------------------------------------------------------------------------

  /**
   * The host's slow tick. Answers what the host must show, every tick until it is answered (the host shows it when
   * nothing else stands - AUDIT LEGACY A2: a one-shot answer was dropped under another window):
   *   - `{ past: person, fall }`: the past played back - the line's waiting Succession (`fall`), else its living;
   *   - `{ fall }`: the line's Succession waits (a fall whose window went, a crash under it, a failed birth);
   *   - null: nothing - and the seat noted, the elder said once, the estate paid, the death quest stepped.
   */
  function tick() {
    // a death decided and never reset - a party's Resurrect raises the fallen where they lie - is over once they live
    if (deathSeen && (deps.entity?.health ?? 0) > 0) { deathSeen = false; outcome = null; }
    if (!family || !deps.on()) return null;
    if (unstored) store();   // AUDIT LEGACY II P1: a refused write, tried again - first: a death's above all
    if (past) return { past, fall: family.pending ? fallOutcome() : null };
    if (family.pending) return deps.entity?.chargenDone ? { fall: fallOutcome() } : null;
    if (!deps.entity?.chargenDone) return null;
    const p = current();
    if (!p || !isAlive(p) || !playedHere(p)) return null;   // AUDIT LEGACY II A1: nothing of the one handed the line, on a page not theirs
    if (!family.seat) {
      const t = deps.town(deps.here());
      if (t) { family.seat = t; const named = nameAtSeat(family); touch(family); store(); deps.say(LEGACY_TEXT.seat(t.loc)); if (named) deps.say(LEGACY_TEXT.named(family.surname)); }   // LEGACY-NAME: a nameless house takes its seat's name
    } else if (nameAtSeat(family)) {
      touch(family); store(); deps.say(LEGACY_TEXT.named(family.surname));   // AUDIT LEGACY III A6: a seat noted with the house left nameless
    } else if (family.seat.mapId == null) {
      // LEGACY-HOME: a seat noted before it carried its town's map id learns it the next time the house stands there
      const t = deps.town(deps.here());
      if (t?.mapId != null && t.loc === family.seat.loc && t.region === family.seat.region) { family.seat.mapId = t.mapId; touch(family); store(); }
    }
    // AUDIT LEGACY III A8: the house's news heard on the one played's own clock - its week is theirs
    if (hearNews(family, p, deps.sky?.() ?? deps.now())) store();
    payEstateOf(p);
    takeDeeds(p);
    remainsStep();
    weddingStep(p);
    childrenStep(p);
    if (family.model === MODELS.enduring && !elderSaid && isElder(p, lived())) {
      elderSaid = true;
      deps.say(LEGACY_TEXT.elder(p.given, ageOf(p, lived())));
    }
    return null;
  }

  // ---- LEGACY5: courting, the wedding, children ------------------------------------------------------------------
  // (Legacy-Arc section 8; the law is systems/legacy/marriage.js)

  /** The day a courtship or a child is counted by: the one played's own clock (section 8). */
  const ownDay = () => courtDayOf(deps.own() ?? 0);
  /**
   * THE TALK'S ROWS for a Living World resident (scenes/townTalk.js legacyTopics): courtship, a proposal, the wedding's
   * word, the family - each `{ label, legacy: { question(tone), answer(tone) } }`. `ctx`: the resident's regard of the
   * one played today, the one played's Personality and Etiquette, the town's name.
   * @param {any} res @param {{ regard:number, personality?:number, etiquette?:number, townName?:string }} ctx
   */
  function topicRows(res, ctx) {
    const me = current();
    if (!family || past || !me || !deps.on() || !playedHere(me) || !res?.id) return [];
    return topicsFor(family, me, res, ctx.regard | 0).map((t) => ({
      label: topicLabel(t),
      legacy: { question: (tone) => topicQuestion(t, tone), answer: (tone) => answerTopic(t, res, tone, ctx) },
    }));
  }
  function answerTopic(t, res, tone, ctx) {
    const me = current();
    const first = splitName(res.name)[0];
    if (!me) return '';
    if (t === TOPIC.court) {
      const r = court(me, res, { day: ownDay(), townName: ctx.townName, personality: ctx.personality, etiquette: ctx.etiquette, tone, roll: rng() });
      if (!r.again) { touch(family); store(); }
      return r.again ? MARRIAGE_TEXT.again(first) : MARRIAGE_TEXT.courted(first, r.affection);
    }
    if (t === TOPIC.propose) {
      if (!propose(me, res.id)) return MARRIAGE_TEXT.again(first);
      touch(family); store();
      return MARRIAGE_TEXT.accepted(first, me.courting[res.id]?.town ?? '');
    }
    if (t === TOPIC.wedding) return MARRIAGE_TEXT.wedding(me.courting?.[res.id]?.town ?? '');
    const spouse = spouseOf(family, me);
    return MARRIAGE_TEXT.family(spouse ? childrenTogether(family, me, spouse) : 0);
  }
  /** THE WEDDING, at the temple of the betrothed's town - asked once a visit (the rest's shape), the name asked with it. */
  let weddingAsked = false;
  function weddingStep(p) {
    const b = betrothalOf(p);
    const temple = deps.templeOf?.() ?? null;
    if (temple == null) { weddingAsked = false; return; }
    if (!b || weddingAsked || (temple >>> 0) !== (b[1].mapId >>> 0)) return;
    const [rid, c] = b;
    if (deps.askWed?.(c.name, family.surname, (takeName) => weddingNow(p, rid, c, takeName))) weddingAsked = true;
  }
  function weddingNow(p, rid, c, takeName) {
    if (!family || spouseOf(family, p) || !betrothalOf(p)) return null;
    // AUDIT LEGACY III A1: one of the house already - another member wed them first: the betrothal is over, and said
    if (residentInHouse(family, rid)) { forgetCourtship(p, rid); touch(family); store(); deps.say(LEGACY_TEXT.wedElsewhere(splitName(c.name)[0])); return null; }
    const s = wed(family, p, { id: rid, name: c.name, sex: c.sex, race: c.race, face: c.face, mapId: c.mapId }, deps.now(), { takeName });
    if (!s) return null;
    p.childDay = ownDay();
    tellNews('wed', fullNameOf(s.given, s.surname), c.mapId);
    touch(family);
    store();
    deps.say(MARRIAGE_TEXT.wed(fullNameOf(s.given, s.surname), family.surname));
    return s;
  }
  /** CHILDREN: on the one played's own clock, while the spouse lives (marriage.js childStep). */
  function childrenStep(p) {
    const rev = family.rev;
    const kid = childStep(family, p, { day: ownDay(), rng, at: deps.now(), settings: legacySettings() });
    if (kid) {
      deps.say(childLine(kid, spouseOf(family, p)));
      // AUDIT LEGACY III A5/F1: a child who took a lore surname founds a cadet branch - said, as the Succession's newborn is
      const line = lineSurnameOf(family, p);
      if (line && kid.surname && kid.surname !== line) deps.say(LEGACY_TEXT.lore(kid.given, line, kid.surname));
      tellNews('born', fullNameOf(kid.given, kid.surname), spouseOf(family, p)?.mapId);
    }
    if (family.rev !== rev) store();
  }
  /** A townsperson's death heard (struck down, or fallen at the one played's side): a courtship of theirs, or a
   *  betrothal, ends with word. Answers whether one did. */
  function residentDied(id) {
    let ended = false;
    for (const p of family?.people ?? []) {
      const c = p.courting?.[id];
      if (!c) continue;
      delete p.courting[id];
      ended = true;
      if (p.id === family.currentId) deps.say(MARRIAGE_TEXT.lost(c.name));
    }
    if (ended) { touch(family); store(); }
    return ended;
  }

  // ---- LEGACY7 part three: two players wed ---------------------------------------------------------------------------

  /** Why the one played cannot wed another player's character now - a code the wire carries (net/wire.js WED_WHY) - or
   *  null: online, the realm character of this house's one played (`realmId`), alive, of the blood, of age, wed to
   *  nobody, no fall waiting on its Succession, out of a fight, standing in a temple. */
  function wedRefusal() {
    const p = current();
    const rid = deps.realmId?.() ?? null;
    if (!family || past || !p || !deps.on() || !deps.online() || !rid || p.characterId !== String(rid)) return 'house';
    if (family.pending || !isAlive(p) || p.retired != null || p.kind !== 'member' || p.minor || deps.inFight()) return 'busy';
    if (spouseOf(family, p)) return 'wed';
    if (deps.templeOf?.() == null) return 'temple';
    return null;
  }
  /**
   * A UNION THE REALM MADE (net/wedSession.js onWed, or a boot's read of the account's unions): the other player's
   * character recorded as the spouse of the member the union names (`union.mine`, their realm character) - once a union
   * (by its sid), never over a living spouse. Said unless `quiet`. Answers the spouse, or null.
   * @param {any} union @param {{ quiet?: boolean }} [o]
   */
  function wedPlayerHeard(union, { quiet = false } = {}) {
    if (!family || !deps.on() || past || !union || typeof union.sid !== 'string' || !union.partner) return null;
    const had = unionSpouse(family, union.sid);
    if (had) return had;
    const m = (family.people ?? []).find((x) => x.kind === 'member' && x.characterId != null && x.characterId === String(union.mine));
    if (!m || !isAlive(m) || spouseOf(family, m)) return null;
    const s = wedPlayer(family, m, union.partner, union.sid, deps.now());
    if (m.id === family.currentId) m.childDay = ownDay();
    tellNews('wed', fullNameOf(s.given, s.surname), deps.templeOf?.() ?? null);
    touch(family);
    store();
    if (!quiet) deps.say(MARRIAGE_TEXT.wedPlayer(fullNameOf(s.given, s.surname)));
    return s;
  }
  /** THE ACCOUNT'S UNIONS as the realm says them (a boot's read - realmSaves.js realmUnions): each union of this house's
   *  members recorded, and each the OTHER's death or delete ended (`endedBy` 'partner') ended in the record - the member
   *  may wed again. A union ended by this house's own member's death needs nothing: that death is this record's own.
   *  Answers how many changed. */
  function unionsHeard(unions) {
    if (!family || !deps.on() || past || !Array.isArray(unions)) return 0;
    let n = 0;
    for (const u of unions) {
      if (!u || typeof u.sid !== 'string') continue;
      let s = unionSpouse(family, u.sid);
      if (!s && (s = wedPlayerHeard(u, { quiet: u.endedAt != null }))) n++;
      if (!s || u.endedAt == null || u.endedBy !== 'partner' || !playerSpouseLost(family, s, deps.now(), u.endedWhy)) continue;
      n++;
      if (s.spouse === family.currentId) deps.say((u.endedWhy === 'gone' ? MARRIAGE_TEXT.gone : MARRIAGE_TEXT.lost)(fullNameOf(s.given, s.surname)));
    }
    if (n) store();
    return n;
  }
  // ---- LEGACY6: what the world remembers ---------------------------------------------------------------------------

  /** What the town `mapId` says of the house at the town's minute `t` (livingTown.js familyNews). */
  /** LEGACY6: what a town of the one played says of the house at its minute `t`. AUDIT LEGACY III A8: heard first, on
   *  their own clock (influence.js hearNews) - the week is theirs, from the moment the news reached them. */
  function newsFor(mapId, t) {
    const me = current();
    if (!family || !deps.on() || past || !me) return [];
    if (isAlive(me) && playedHere(me) && hearNews(family, me, t)) store();
    return houseNewsFor(family, mapId, t, me.heard ?? null);
  }
  /** A new game's fresh relations (scenes/world.js LivingWorld's newGame) take the birth's share of the town's regard -
   *  only while the one born on this page is the one played. Answers how many. */
  function seedRegards(relations) {
    const p = current();
    if (!bornShare || !p || p.id !== bornShare.personId || !playedHere(p)) return 0;
    return inheritRegards(relations, bornShare.standing, deps.regardDay?.() ?? 0);
  }

  /** The census ids the line holds - every spouse who wed in, living or dead: their census place is the line's, never
   *  the census's again (scenes/world.js holderOf). */
  const holdsResident = (id) => !!family && deps.on() && (family.people ?? []).some((x) => x.kind === 'resident' && x.residentId === id);

  // ---- LEGACY-HOME: the bloodline in the world ----------------------------------------------------------------------

  /** Whether the line stands in the world now: the mod on, its "Family in the world" on, a family, not the past - and
   *  (AUDIT LEGACY II B5) the Living World running, whose towns are the only place it stands. */
  const NO_RESIDENTS = Object.freeze([]);
  const inWorld = () => !!family && deps.on() && !past && legacySettings().familyInWorld && (deps.livingWorld?.() ?? true);
  /**
   * The family's residents of the town `mapId` (systems/legacy/household.js residentOf) - the town's own day plans,
   * walkers and rooms carry them. `lend(seed)` the town's house lent to a line with no house (a residence of its
   * census, by the family's id - livingTown.js homeFor), 0 when it has none. AUDIT LEGACY II P3: the SAME residents -
   * each the same object, and the same list - while nothing a resident is made of changed (a save bumps the record's
   * rev, and keyed on it every save dressed each member as a stranger: the street recycled their bodies and dressed
   * them again, two at a time). Kept by what each resident is made of.
   */
  const residentsKept = new Map();
  /** @type {Map<string, { sig: string, res: any }>} */
  const residentOfKept = new Map();
  const residentSig = (p, key) => [p.id, key, p.given, p.surname, p.gender, p.race, p.face | 0, p.careerIndex, isCustomCareer(p), p.level | 0, p.look ? JSON.stringify(p.look) : ''].join('|');   // LEGACY7 part four: and what they wear
  function residentsOf(mapId, lend = null, censusOf = null) {
    const id = mapId >>> 0;
    const spouses = spousesOf(id, censusOf);
    if (!inWorld()) {
      if (!spouses.length) { residentsKept.delete(id); return NO_RESIDENTS; }
      return keptList(id, `${family.id}#s#${spouses.map((x) => x.sig).join('#')}`, () => spouses.map((x) => x.res));
    }
    const rows = householdOf(family).filter(({ home }) => (home.mapId >>> 0) === id);
    const lent = rows.some(({ home }) => home.lent) ? (lend?.(family.id) | 0) : 0;
    const want = rows.map(({ person, home }) => ({ person, key: home.lent ? lent : home.buildingKey })).filter((x) => x.key > 0);
    const sigs = want.map(({ person, key }) => residentSig(person, `${id}:${key}`)).concat(spouses.map((x) => x.sig));
    const listKey = `${family.id}#${sigs.join('#')}`;
    const kept = residentsKept.get(id);
    if (kept?.key === listKey) return kept.list;
    const list = want.map(({ person, key }, i) => {
      const k = `${family.id}:${person.id}`;
      const was = residentOfKept.get(k);
      if (was?.sig === sigs[i]) return was.res;
      const res = residentOf(family, person, { mapId: id, buildingKey: key });
      residentOfKept.set(k, { sig: sigs[i], res });
      return res;
    }).concat(spouses.map((x) => x.res));
    residentsKept.set(id, { key: listKey, list });
    return list;
  }
  /** A list kept by its key (the same list while it stands). */
  function keptList(id, key, make) {
    const kept = residentsKept.get(id);
    if (kept?.key === key) return kept.list;
    const list = make();
    residentsKept.set(id, { key, list });
    return list;
  }
  /**
   * LEGACY5: THE SPOUSES living in town `mapId` - each the census's own resident (`censusOf(id)`: their name, face,
   * outfit, job and day, for life), the line's household now, and at home in a house of the line's in their town
   * when there is one (section 8), else in their own. Each `{ res, sig }`, the same object while nothing changed.
   */
  function spousesOf(mapId, censusOf) {
    if (!family || !deps.on() || !(deps.livingWorld?.() ?? true) || !censusOf) return [];
    const out = [];
    for (const s of family.people) {
      if (s.kind !== 'resident' || !isAlive(s) || (s.mapId >>> 0) !== mapId) continue;
      const census = censusOf(s.residentId);
      if (!census) continue;
      const house = (family.houses ?? []).find((h) => (h.mapId >>> 0) === mapId && sameHouse(h, familyHome(family)))
        ?? (family.houses ?? []).find((h) => (h.mapId >>> 0) === mapId) ?? null;
      const home = house ? house.buildingKey : census.home;
      const sig = `s${s.id}|${s.residentId}|${home}|${s.given}|${s.surname}`;
      const k = `${family.id}:${s.id}`;
      const was = residentOfKept.get(k);
      if (was?.sig === sig) { out.push({ res: was.res, sig }); continue; }
      const res = { ...census, name: fullNameOf(s.given, s.surname), home, household: `F${family.id}`, legacy: { familyId: family.id, personId: s.id } };
      residentOfKept.set(k, { sig, res });
      out.push({ res, sig });
    }
    return out;
  }
  /** The person of the line a family resident is, or null (another family's, or none). */
  function personOfResident(res) {
    const f = res?.legacy ?? familyResOf(res?.id);   // LEGACY5: a spouse keeps their census id - the tag says whose they are
    return f && family && f.familyId === family.id ? personOf(family, f.personId) : null;
  }
  /** A member STRUCK DOWN by the one played (the town's one-hit civilian, livingTown.js slain): dead in the record - a
   *  world fact, the store's - and gone from the town with it. Answers whether one of the line died. */
  function kinSlain(res) {
    const p = personOfResident(res);
    if (!p || !isAlive(p) || p.id === family.currentId) return false;
    const me = current();
    recordDeath(family, p.id, { at: deps.now(), cause: 'slain', place: deps.here(), by: me ? fullNameOf(me.given, me.surname) : null });
    tellNews('died', fullNameOf(p.given, p.surname), deps.here()?.mapId);   // AUDIT LEGACY III A13/F17: a member's death is news
    store();
    deps.say(LEGACY_TEXT.kinSlain(fullNameOf(p.given, p.surname)));
    return true;
  }
  /** A member KILLED BY ANOTHER HAND than the one played's - a beast of the street (WATCH-PROTECTS: livingTown.js killed,
   *  through the quarry's blow): dead in the record as the store's world fact, fallen to nobody named, the town told -
   *  never the census's turn (they were never its). Answers whether one of the line died. */
  function kinKilled(res) {
    const p = personOfResident(res);
    if (!p || !isAlive(p) || p.id === family.currentId) return false;
    recordDeath(family, p.id, { at: deps.now(), cause: 'fell', place: deps.here(), by: null });
    tellNews('died', fullNameOf(p.given, p.surname), deps.here()?.mapId);
    store();
    deps.say(LEGACY_TEXT.kinKilled(fullNameOf(p.given, p.surname)));
    return true;
  }
  /** A family resident spoken to: who they are, how they greet the one played, and why Play as is refused (or null). */
  function kinOfResident(res) {
    const p = personOfResident(res);
    const me = current();
    if (!p || !me) return null;
    const { word, is, lines } = kinGreeting(family, me, p, { elder: family.model === MODELS.enduring && isElder(p, p.lived) });
    // a retired elder lives at home and is never played again (LEGACY2); anyone else, the switch's own refusals
    // AUDIT LEGACY II U11: the switch's 'none' marker is no sentence - said as one
    const why = p.kind === 'resident' ? LEGACY_TEXT.spouseKin(p.given) : p.retired != null ? LEGACY_TEXT.retiredKin(p.given) : switchRefusal(p.id);
    const refusal = why === 'none' ? LEGACY_TEXT.notNow : why;
    return { person: p, word, is, name: fullNameOf(p.given, p.surname), lines, refusal };
  }
  /** Whether a building is one of the family's houses, while the line stands in the world (its rooms hold the line). */
  const isFamilyHouse = (house) => inWorld() && (family.houses ?? []).some((h) => sameHouse(h, house));
  // ---- FAMILY-SEAT (FIELD BUGS 2026-10-07b, afjiz: "the option in the enhanced ui to reset your family seat to a town
  // your currently in") --------------------------------------------------------------------------------------------
  // The seat is the first town the house stands in (tick, above) - a character fresh from Privateer's Hold took it at the
  // first town a road or a journey crossed, and nothing ever moved it. Now the player moves it, from the House page, to
  // the town the one played stands in: the heirs are born there, the fallen laid to rest there, the house's news told
  // there, and a house without a home of its own lives there. The house keeps its name (a house named for its first
  // seat stays that house).
  /** The town the one played stands in, as the seat is noted there (deps.town: its map pixel, never a dungeon under
   *  it) - when it is not the seat already, the line is the one played's and no Succession waits; else null. */
  function familySeatHere() {
    const p = current();
    if (!family || past || family.pending || !deps.on() || !p || !isAlive(p) || !playedHere(p)) return null;
    const t = deps.town(deps.here());
    return t && !(t.loc === family.seat?.loc && t.region === family.seat?.region) ? t : null;
  }
  /** Move the seat to the town the one played stands in. Stamped with when (`at`, the wall clock): the move stands over
   *  an older copy's seat in every merge, whichever copy is the newer by rev (systems/legacy/store.js mergeFacts). */
  function moveFamilySeat() {
    const t = familySeatHere();
    if (!t) return { ok: false, why: family?.pending ? LEGACY_TEXT.pending : LEGACY_TEXT.seatNowhere };
    // AUDIT FB1007b S2: the newest word on the seat, as writeCurrent's savedAt is - after the stamp of the seat it moves,
    // so a move stands over that seat in every merge though this clock run behind the one that stamped it (a device's)
    family.seat = { ...t, at: Math.max((Number(family.seat?.at) || 0) + 1, Math.floor(deps.wall?.() ?? Date.now())) };
    const nameTaken = nameAtSeat(family);   // LEGACY-NAME: a nameless house takes its seat's name, as at the first
    touch(family);
    store();
    deps.say(LEGACY_TEXT.seatMoved(t.loc));
    if (nameTaken) deps.say(LEGACY_TEXT.named(family.surname));
    return { ok: true };
  }
  /** Mark a house of the family's as its home (the House page). */
  function markHome(house) {
    if (!family || !setFamilyHome(family, house)) return false;
    touch(family);
    store();
    return true;
  }

  return {
    get family() { return family; },
    residentsOf,
    topicRows,
    holdsResident,
    residentDied,
    weddingNow: (rid) => { const p = current(); const c = p?.courting?.[rid]; return p && c ? weddingNow(p, rid, c, false) : null; },
    kinOfResident,
    kinSlain,
    kinKilled,
    isFamilyHouse,
    markHome,
    familySeatHere,
    moveFamilySeat,
    familyHome: () => familyHome(family),
    /** The past played back (a dead or retired member's save), or null. */
    get past() { return past; },
    current,
    lived,
    found,
    onCharacterMade: (model = null) => found(model),
    /** The boot's end: a loaded character with no family is found - and offline founded into their own answer or its
     *  Features tile's model (D9); online never (LEGACY-CHOICE). */
    afterBoot: () => found(null, { atLoad: true }),
    onDeath,
    deathOutcome,
    willRise,
    fallOutcome,
    succeed,
    endLine,
    switchRefusal,
    switchTo,
    mantleRefusal,
    passMantle,
    questLogEntries,
    mapMarks,
    layToRest,
    takeBorn,
    bornResult,
    onBorn,
    tick,
    newsFor,
    seedRegards,
    rebind,
    wedRefusal,
    wedPlayer: wedPlayerHeard,
    unionsHeard,
  };
}
