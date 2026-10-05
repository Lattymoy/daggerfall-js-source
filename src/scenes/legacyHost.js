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
//   - FOUNDS a family around the character played (D9: at creation, or at the first load of an older save), its model
//     the chargen's answer (`entity.legacyModel`) or the Mods pane's - and FINDS the family a save made before its
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
  isAlive,
} from '../systems/legacy/family.js';
import { loadFamily, storeFamily, leaveBirth, readBirth, clearBirth, listFamilies } from '../systems/legacy/store.js';
import { birthSearch } from '../systems/legacy/places.js';
import { payToll, tollLine, ageOf, isElder, isSpent } from '../systems/legacy/age.js';
import { legacySettings } from '../systems/legacy/settings.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { rollStats, rollSkills, spendPoolLowest, STAT_KEYS_ORDER } from '../systems/chargen.js';
import { LEVELING_CLASSIC } from '../systems/oblivionLeveling.js';
import { pickHeirloom, markHeirloom, mintRemainsItem, isRemainsItem, isHeirloom, attuneHeirloom, blessingOf, remainsGoldOf } from '../systems/legacy/heirloom.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { goldStack } from '../systems/inventory.js';

/** The reflexes a born member starts with - the wizard's own default (ui/chargenArt.js PLAYER_REFLEXES.Average). */
export const BORN_REFLEXES = 2;

/** The words. One home, so the windows and the HUD say one thing. */
export const LEGACY_TEXT = Object.freeze({
  founded: (sur, model) => `The house of ${sur || 'your name'} is founded - ${model === MODELS.bloodline ? 'a Bloodline: a death is final' : 'an Enduring line: a death costs years'}.`,
  seat: (loc) => `${loc} is your family's seat.`,
  elder: (name, age) => `${name} is ${age} - an elder of the house now. The years ahead are fewer than those behind.`,
  born: (name, loc) => `${name} takes up the family's name in ${loc}.`,
  lore: (given, from, to) => `Lore surname change: ${given} chose ${to} instead of ${from}.`,   // RandomizeCharacterData's own HUD line
  noHeir: 'You died without a descendant.',   // HandlePlayerDeath's own words
  heir: 'You died. Your descendant will take your place.',   // ...and the other branch's
  deadLoad: (name) => `${name} is dead. Their story is the past.`,
  retiredLoad: (name) => `${name} has passed the mantle on. Their story is the past.`,
  fight: 'Not while you are in a fight.',
  online: 'Online, your family is changed from the Family window between journeys.',
  onlineSpent: (name) => `Arkay waits for ${name}. Online, a life's last breath waits on the realm's lineage - pass the mantle when you next play offline.`,
  pending: 'The house waits on its Succession.',
  notSaved: 'Your journey could not be saved here - not now.',
  estate: (n) => `The estate left you a letter of credit for ${n} gold.`,
  bequest: (item) => `Your elder's bequest is yours: ${item}.`,
  remainsFound: (name) => `You have found the remains of ${name}.`,
  remainsTaken: (name) => `You carry the remains of ${name}. Lay them to rest at a temple, or at the family's seat.`,
  remainsReturned: (name) => `The remains of ${name} are no longer with you. They lie where ${name} fell.`,
  rested: (name, skill) => `${name} is laid to rest. Their blessing stays with you: +3 ${skill}.`,
  attuned: (item, gen) => `${item} remembers the hand that carried it home (generation ${gen}).`,
  ended: (sur) => `The house of ${sur} goes on.`,
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
 *   - every remains row the character claimed (`by`), or nobody did, carries the save's progress - its list, its state,
 *     its claim - when the save holds it, else its first state (made, or claimed, after the save).
 */
export function mergeFamily(stored, saved, cid) {
  if (!saved) return stored ?? null;
  if (!stored || stored.id !== saved.id) return saved;
  const base = saved.rev > stored.rev ? saved : stored;
  const out = JSON.parse(JSON.stringify(base));
  out.rev = Math.max(stored.rev, saved.rev);
  const me = cid ? out.people.find((p) => p.characterId === cid) : null;
  if (!me) return out;
  const was = saved.people.find((p) => p.id === me.id);
  me.estatePaid = Math.max(0, Math.floor(Number(was?.estatePaid) || 0));
  me.bequestPaid = Math.max(0, Math.floor(Number(was?.bequestPaid) || 0));
  for (const r of out.remains ?? []) {
    if (r.by != null && r.by !== me.id) continue;   // another member's claim is a world fact to this one
    const s = (saved.remains ?? []).find((x) => x.id === r.id);
    if (s) Object.assign(r, { items: JSON.parse(JSON.stringify(s.items ?? [])), state: s.state, by: s.by ?? null, restedAt: s.restedAt ?? null, found: !!s.found });
    else if (r.by === me.id) Object.assign(r, { items: JSON.parse(JSON.stringify(r.first ?? [])), state: 'lying', by: null, restedAt: null, found: false });
  }
  return out;
}

/**
 * @param {{
 *   entity:any, storage:() => any, tab:() => any, on:() => boolean, online:() => boolean,
 *   killer?:() => (string|null), atPlace?:(place:any) => boolean, openRemains?:(rec:any, items:any[]) => boolean,
 *   atRest?:() => boolean, askRest?:(name:string, yes:() => void) => boolean, takeItem?:(item:any) => void,
 *   carried?:() => any[], giveItems?:(items:any[]) => void,
 *   now:() => number, own:() => number, here:() => any, town:(here:any) => ({region:string, loc:string}|null),
 *   nearestTown:(here:any) => ({region:string, loc:string}|null), gold:() => number, say:(line:string) => void,
 *   boot:(search:string) => void, search:() => string, loadCharacter:(characterId:string) => boolean,
 *   saveNow:() => boolean, inFight:() => boolean, payEstate?:(gold:number) => void, rng?:() => number,
 * }} deps
 */
export function createLegacyHost(deps) {
  const rng = deps.rng ?? Math.random;
  /** @type {any} */ let family = null;
  /** A birth read from the boot: the family to start the new game with, and who is born. */
  /** @type {any} */ let born = null;
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

  const store = (f = family) => { if (f) storeFamily(deps.storage(), f); };
  const current = () => currentOf(family);
  const lived = () => {
    const p = current();
    return p ? Math.max(0, Math.floor((deps.own() ?? 0) - (p.bornOwn ?? 0))) : 0;
  };
  /** The played character into their person, and the lived minutes - every save and every death. Never the past's. */
  function writeCurrent() {
    const p = current();
    if (past || !p || !deps.entity?.chargenDone || !isAlive(p) || p.retired != null) return;
    if (p.characterId && deps.entity.characterId && p.characterId !== String(deps.entity.characterId)) return;   // never another character's into this person
    writePlayer(p, deps.entity);
    p.lived = lived();
  }
  const cidOf = () => (deps.entity?.characterId ? String(deps.entity.characterId) : null);
  /** The stored family a character is of, or null - a save made before its family was founded (AUDIT LEGACY A3). */
  const familyOfCharacter = (cid) => (cid ? listFamilies(deps.storage()).find((f) => f.people.some((p) => p.characterId === cid)) ?? null : null);

  // THE MOD'S IHasModSaveData (Project_Legacy.GetSaveData / RestoreSaveData / NewSaveData).
  registerModSaveData(LEGACY_VENDOR, {
    newSaveData: () => null,
    getSaveData: () => {
      if (!family) return null;
      writeCurrent();   // never the past's (its own guard): the past's save carries the line as it stands
      touch(family);
      store();
      return JSON.parse(JSON.stringify(family));
    },
    restoreSaveData: (rec) => adopt(rec),
    // a new game: a born member's family, or none (the chargen's onCharacterMade founds one)
    newGame: () => {
      past = null; outcome = null; deathSeen = false;
      if (born) { family = born.family; return; }
      const cid = cidOf();
      if (!(family && cid && currentOf(family)?.characterId === cid)) family = null;   // the wizard's founding may land first
    },
  });

  /** A save's copy beside the store's (mergeFamily); the played character is the one this save is of. */
  function adopt(rec) {
    past = null; outcome = null; deathSeen = false; elderSaid = false;
    openedThisVisit.clear(); restAskedThisVisit.clear(); remainsSig = '';
    const cid = cidOf();
    const saved = readFamily(rec);
    const stored = saved ? loadFamily(deps.storage(), saved.id) : familyOfCharacter(cid);
    family = mergeFamily(stored, saved, cid);
    if (!family) return;
    const me = cid ? family.people.find((p) => p.characterId === cid) : null;
    if (!me) return;
    if (!isAlive(me) || me.retired != null) { past = me; return; }   // THE PAST: refused under either model, for good
    if (family.pending && family.pending.fallenId !== me.id) settlePending(me);   // a living member loaded: they take the mantle
    if (family.ended != null) { family.ended = null; deps.say?.(LEGACY_TEXT.ended(family.surname)); }   // AUDIT LEGACY A8: a member plays on - the line goes on
    setCurrent(family, me.id);
    touch(family);
    store();
  }

  /** FOUND the family around the character being played - a new character's answer, or the Mods pane's model. Online
   *  a house is Enduring until the realm keeps lineages (LEGACY7): a Bloodline's permadeath has no authority there. */
  function found(model = null) {
    if (family || past || !deps.on() || !deps.entity?.chargenDone) return family;
    const known = familyOfCharacter(cidOf());
    if (known) { adopt(known); return family; }   // the store knows this character's house - never a second
    const s = legacySettings();
    const asked = model ?? deps.entity?.legacyModel ?? s.model;
    const m = deps.online() ? MODELS.enduring : asked;
    family = foundFamily(deps.entity, { model: m, seat: deps.town(deps.here()), at: deps.now(), rng, settings: s });
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
  function payEstateOf(p) {
    if (!p) return;
    const due = Math.max(0, (p.estate | 0) - (p.estatePaid | 0));
    const pieces = (p.bequest ?? []).slice(p.bequestPaid | 0);
    if (!due && !pieces.length) return;
    p.estatePaid = p.estate | 0;
    p.bequestPaid = (p.bequest ?? []).length;
    touch(family);
    if (due) { deps.payEstate?.(due); deps.say(LEGACY_TEXT.estate(due)); }
    if (pieces.length) {
      deps.giveItems?.(pieces.map((it) => JSON.parse(JSON.stringify(it))));
      for (const it of pieces) deps.say(LEGACY_TEXT.bequest(it.heirloom?.base ?? it.name ?? 'an heirloom'));
    }
    store();
  }

  /** The waiting Succession answered by `heir` - the estate and the bequest theirs, the mantle theirs. */
  function settlePending(heir) {
    const pend = family.pending;
    if (!pend) return;
    heir.estate = (heir.estate | 0) + (pend.estate | 0);
    heir.bequest = [...(heir.bequest ?? []), ...(pend.bequest ?? [])];
    family.pending = null;
    touch(family);
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
    const online = deps.online();
    if (family.model === MODELS.enduring) {
      if (online && isSpent(p, p.lived)) { outcome = { kind: 'rise', line: LEGACY_TEXT.onlineSpent(p.given) }; return outcome; }
      const paid = payToll(p, legacySettings().tollShare, p.lived);
      touch(family);
      store();
      if (!paid.final) { outcome = { kind: 'rise', line: tollLine(p.given, paid) }; return outcome; }
      d.cause = 'years';
    } else if (online) {
      outcome = { kind: 'none' };
      return outcome;
    }
    recordDeath(family, p.id, { at: d.at, cause: d.cause, place: d.place, by: d.by });
    layDeathRemains(p, d);
    family.pending = { fallenId: p.id, at: d.at, estate: estateOf(d.gold), bequest: [] };
    touch(family);
    store();
    outcome = fallOutcome();
    return outcome;
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

  /** At a final death: THE REMAINS lie where the fallen fell - their bones, the heirloom (Bloodline: the Mods pane's
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
    for (const r of rows) {
      const by = r.by != null ? personOf(family, r.by) : null;
      if (r.by != null && r.by !== me?.id && (!by || !isAlive(by) || by.retired != null)) { r.by = null; r.state = 'lying'; touch(family); }
    }
    return rows.filter((r) => r.by == null || r.by === me?.id);
  };
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
        r.state = 'lying'; r.by = null;
        touch(family); store();
        if (was === 'taken') deps.say(LEGACY_TEXT.remainsReturned(r.name));
      }
      if (r.state === 'lying') {
        const here = deps.atPlace?.(r.place) ?? false;
        if (!here) { openedThisVisit.delete(r.id); continue; }
        if (openedThisVisit.has(r.id) || deps.inFight()) continue;
        if (deps.openRemains?.(r, r.items)) {
          openedThisVisit.add(r.id);
          r.by = me.id;   // opened: this member's claim (mergeFamily)
          if (!r.found) { r.found = true; deps.say(LEGACY_TEXT.remainsFound(r.name)); }
          touch(family); store();
        }
      } else if (r.state === 'taken' && !restAskedThisVisit.has(r.id) && deps.atRest?.()) {
        if (deps.askRest?.(r.name, () => layToRest(r))) restAskedThisVisit.add(r.id);   // asked only once it was SHOWN
      }
    }
    if (!deps.atRest?.()) restAskedThisVisit.clear();
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
      (deps.entity.legacyBlessings ??= []).push(b);
      deps.say(LEGACY_TEXT.rested(r.name, SKILL_NAMES[b.skill] ?? 'skill'));
    }
    const heirloom = carried.find((it) => isHeirloom(it) && it.heirloom.line === family.id && it.heirloom.of === r.of);
    if (heirloom) { attuneHeirloom(heirloom); deps.say(LEGACY_TEXT.attuned(heirloom.heirloom.base, heirloom.heirloom.gen)); }
    r.state = 'rested';
    r.restedAt = deps.now();
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
    });
  }
  /** The remains still lying, ringed on the maps where the fallen fell - while the mod is on (AUDIT LEGACY B8). */
  const mapMarks = () => (family && deps.on() && !past ? openRemains() : []).filter((r) => r.state === 'lying' && r.place?.pixel).map((r) => ({
    cx: r.place.pixel.x + 0.5, cy: r.place.pixel.y + 0.5, r: LEGACY_RING_R, label: `The remains of ${r.name}`, id: `${LEGACY_QUEST_PREFIX}${r.id}`, place: r.place.mode === 'dungeon', farmKey: null,
  }));

  /**
   * THE SUCCESSION'S CHOICE: `{ personId }` a living member, or `{ newborn: true }` a child of the fallen - the waiting
   * fall's (`family.pending`): its estate and bequest go to whoever takes the mantle. A member already played is
   * LOADED; one never played is BORN. Answers whether the boot was asked. Online, never (LEGACY7).
   */
  function succeed(choice) {
    if (!family || deps.online()) return false;
    const s = legacySettings();
    const fallenId = family.pending?.fallenId ?? family.currentId;
    let heir = null;
    let lore = null;
    if (choice?.newborn) {
      const made = addChild(family, fallenId, { rng, at: deps.now(), settings: s });
      heir = made.person;
      if (made.changed) lore = LEGACY_TEXT.lore(heir.given, family.surname, heir.surname);
      rollSiblings(family, heir.id, { rng, at: deps.now(), settings: s });   // HandlePlayerDeath -> CreateRandomSiblings
    } else {
      heir = personOf(family, choice?.personId);
      if (!heir || !isAlive(heir) || heir.kind !== 'member' || heir.retired != null) return false;
    }
    settlePending(heir);
    setCurrent(family, heir.id);
    touch(family);
    store();
    if (lore) deps.say(lore);
    return play(heir);
  }

  /** Into the world as `p`: their newest save, or their birth. */
  function play(p) {
    if (p.characterId && deps.loadCharacter(p.characterId)) return true;
    const place = family.seat ?? deps.nearestTown(deps.here()) ?? { region: 'Daggerfall', loc: 'Daggerfall' };
    leaveBirth(deps.tab(), { familyId: family.id, personId: p.id, region: place.region, loc: place.loc, estate: 0 });
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

  /** Why a switch to `id` is refused, or null. S3: never mid-fight; online, never (the realm's birth law - LEGACY7). */
  function switchRefusal(id) {
    const t = personOf(family, id);
    if (!family || past || !t || !isAlive(t) || t.kind !== 'member' || t.id === family.currentId || t.retired != null) return 'none';
    if (family.pending) return LEGACY_TEXT.pending;
    if (deps.online()) return LEGACY_TEXT.online;
    if (deps.inFight()) return LEGACY_TEXT.fight;
    return null;
  }
  /** Save the one played where they stand (the mod's anchor, D7), then play the other - never without the save
   *  (AUDIT LEGACY B6: a refused save on a deck lost the member left behind). */
  function switchTo(id) {
    const why = switchRefusal(id);
    if (why) return { ok: false, why };
    writeCurrent();
    if (!deps.saveNow()) return { ok: false, why: LEGACY_TEXT.notSaved };
    setCurrent(family, id);
    touch(family);
    store();
    return { ok: play(personOf(family, id)) };
  }

  /** Why the played elder may not pass the mantle now, or null. */
  function mantleRefusal() {
    const p = current();
    if (!family || past || !p || !deps.on() || family.model !== MODELS.enduring) return 'Only an Enduring house passes its mantle.';
    if (family.pending) return LEGACY_TEXT.pending;
    if (!isElder(p, lived())) return `${p.given} is not yet an elder of the house.`;
    if (deps.online()) return LEGACY_TEXT.online;
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
    if (!f || !p || !isAlive(p) || p.characterId) return null;   // a person already born is loaded, never born twice
    setCurrent(f, p.id);
    born = { family: f, person: p };
    family = f;
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
      backStory: [parent ? `Child of ${fullNameOf(parent.given, parent.surname)}, of the house of ${family.surname}.` : `Of the house of ${family.surname}.`],
      levelingSystem: p.leveling ?? LEVELING_CLASSIC,
    };
  }

  /** After finishChargen built the born member: their character is their person's, their first day pays - and the
   *  game is SAVED there (the mod's SaveCurrentCharacter(firstTime)), so the birth, the estate and the letter stand
   *  together (AUDIT LEGACY A6: a reload before the first save lost all three) and the boot's handoff is answered. */
  function onBorn() {
    const p = born?.person;
    if (!p) return;
    writePlayer(p, deps.entity);
    p.bornOwn = Math.floor(deps.own() ?? 0);
    p.lived = 0;
    touch(family);
    store();
    const loc = deps.town(deps.here())?.loc ?? family.seat?.loc ?? '';
    deps.say(LEGACY_TEXT.born(fullNameOf(p.given, p.surname), loc || 'the Bay'));
    payEstateOf(p);
    born = null;
    if (deps.saveNow()) clearBirth(deps.tab());
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
    if (past) return { past, fall: family.pending ? fallOutcome() : null };
    if (family.pending) return deps.entity?.chargenDone ? { fall: fallOutcome() } : null;
    if (!deps.entity?.chargenDone) return null;
    const p = current();
    if (!p || !isAlive(p)) return null;
    if (!family.seat) {
      const t = deps.town(deps.here());
      if (t) { family.seat = t; touch(family); store(); deps.say(LEGACY_TEXT.seat(t.loc)); }
    }
    payEstateOf(p);
    remainsStep();
    if (family.model === MODELS.enduring && !elderSaid && isElder(p, lived())) {
      elderSaid = true;
      deps.say(LEGACY_TEXT.elder(p.given, ageOf(p, lived())));
    }
    return null;
  }

  return {
    get family() { return family; },
    /** The past played back (a dead or retired member's save), or null. */
    get past() { return past; },
    current,
    lived,
    found,
    onCharacterMade: (model = null) => found(model),
    /** The boot's end: a loaded character with no family is found, or founded into the Mods pane's model (D9). */
    afterBoot: () => found(),
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
  };
}
