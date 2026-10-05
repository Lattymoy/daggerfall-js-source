// @ts-check
// LEGACY1-LEGACY2 (2026-10-05, bible/06-Systems/Legacy-Arc.md): PROJECT LEGACY IN THE WORLD - the host's half.
//
// The law is systems/legacy/ (family.js the record and its inheritance, age.js the span and the toll, store.js where a
// family lives and the birth's handoff, places.js the town an heir is born in); the windows are ui/legacyWindow.js
// through ui/legacyDoor.js. This file reaches the world only through the deps the world host (scenes/world.js) hands
// it, so a test drives it headless.
//
// WHAT IT DOES, END TO END:
//   - FOUNDS a family around the character played (D9: at creation, or at the first load of an older save), its model
//     the chargen's answer (`entity.legacyModel`) or the Mods pane's;
//   - keeps the record in the save (`modData.ProjectLegacy`, the mod's IHasModSaveData) and in the store, the newer
//     winning;
//   - notes the family's SEAT - the first town its founder stands in;
//   - at a death, ANSWERS THE HOST: an Enduring member pays Arkay's toll and rises (the host's respawn), a Bloodline
//     member or an Enduring one whose span is spent FALLS - recorded dead (B13), the estate set aside, and the
//     Succession opened: a living member, or a newborn heir, or the line's end;
//   - BIRTHS a member through the boot (`?legacyborn=`) and the construction seam, and LOADS a member who has been
//     played (their newest save) - a switch is the same two doors (S1-S4);
//   - REFUSES a dead Bloodline member's save: a death is final, and the player is offered the line's living.
import {
  LEGACY_VENDOR, MODELS, foundFamily, readFamily, newerFamily, personOf, currentOf, writePlayer, recordDeath, successors,
  newbornAllowed, addChild, rollSiblings, setCurrent, endFamily, touch, estateOf, bornValues, fullNameOf, isCustomCareer,
  isAlive,
} from '../systems/legacy/family.js';
import { loadFamily, storeFamily, leaveBirth, takeBirth } from '../systems/legacy/store.js';
import { birthSearch } from '../systems/legacy/places.js';
import { payToll, tollLine, ageOf, isElder } from '../systems/legacy/age.js';
import { legacySettings } from '../systems/legacy/settings.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { rollStats, rollSkills, spendPoolLowest, STAT_KEYS_ORDER } from '../systems/chargen.js';
import { LEVELING_CLASSIC } from '../systems/oblivionLeveling.js';
import { pickHeirloom, markHeirloom, mintRemainsItem, isRemainsItem, isHeirloom, attuneHeirloom, blessingOf, REMAINS_GOLD_SHARE } from '../systems/legacy/heirloom.js';
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
  deadLoad: (name) => `${name} is dead. In a Bloodline a death is final - their story is the past.`,
  fight: 'Not while you are in a fight.',
  online: 'Online, your family is changed from the Family window between journeys.',
  estate: (n) => `The estate left you a letter of credit for ${n} gold.`,
  remainsFound: (name) => `You have found the remains of ${name}.`,
  remainsTaken: (name) => `You carry the remains of ${name}. Lay them to rest at a temple, or at the family's seat.`,
  rested: (name, skill) => `${name} is laid to rest. Their blessing stays with you: +3 ${skill}.`,
  attuned: (item, gen) => `${item} remembers the hand that carried it home (generation ${gen}).`,
});

/** LEGACY4: the death quest's id prefix in the quest log, and its map ring's radius (the bounty board's). */
export const LEGACY_QUEST_PREFIX = 'legacy:';
export const LEGACY_RING_R = 1.5;

/**
 * @param {{
 *   entity:any, storage:() => any, tab:() => any, on:() => boolean, online:() => boolean,
 *   killer?:() => (string|null), atPlace?:(place:any) => boolean, layRemains?:(rec:any, items:any[]) => boolean,
 *   atRest?:() => boolean, askRest?:(name:string, yes:() => void) => void, takeItem?:(item:any) => void,
 *   now:() => number, own:() => number, here:() => any, town:(here:any) => ({region:string, loc:string}|null),
 *   nearestTown:(here:any) => ({region:string, loc:string}|null), gold:() => number, say:(line:string) => void,
 *   boot:(search:string) => void, search:() => string, loadCharacter:(characterId:string) => boolean,
 *   saveNow:() => void, inFight:() => boolean, payEstate?:(gold:number) => void, rng?:() => number,
 * }} deps
 */
export function createLegacyHost(deps) {
  const rng = deps.rng ?? Math.random;
  /** @type {any} */ let family = null;
  /** A birth taken from the boot: the family to start the new game with, and who is born. */
  /** @type {any} */ let born = null;
  /** The death the presenter saw: where and when, the purse - read before the host tears the mode down. */
  /** @type {any} */ let death = null;
  /** A dead Bloodline member's save was restored - said and acted on at the next tick. */
  /** @type {any} */ let deadLoaded = null;
  let elderSaid = false;

  const store = (f = family) => { if (f) storeFamily(deps.storage(), f); };
  const current = () => currentOf(family);
  const lived = () => {
    const p = current();
    return p ? Math.max(0, Math.floor((deps.own() ?? 0) - (p.bornOwn ?? 0))) : 0;
  };
  /** The played character into their person, and the lived minutes - every save and every death. */
  function writeCurrent() {
    const p = current();
    if (!p || !deps.entity?.chargenDone) return;
    writePlayer(p, deps.entity);
    p.lived = lived();
  }

  // THE MOD'S IHasModSaveData (Project_Legacy.GetSaveData / RestoreSaveData / NewSaveData).
  registerModSaveData(LEGACY_VENDOR, {
    newSaveData: () => null,
    getSaveData: () => {
      if (!family) return null;
      writeCurrent();
      store();
      return JSON.parse(JSON.stringify(family));
    },
    restoreSaveData: (rec) => adopt(rec),
    // a new game: a born member's family, or none (the chargen's onCharacterMade founds one)
    newGame: () => {
      if (born) { family = born.family; return; }
      const cid = deps.entity?.characterId ? String(deps.entity.characterId) : null;
      if (!(family && cid && currentOf(family)?.characterId === cid)) family = null;   // the wizard's founding may land first
    },
  });

  /** A save's copy beside the store's: the newer stands; the played character is the one this save is of. */
  function adopt(rec) {
    deadLoaded = null;
    elderSaid = false;
    const saved = readFamily(rec);
    if (!saved) { family = null; return; }
    const stored = loadFamily(deps.storage(), saved.id);
    family = newerFamily(stored, saved) ?? saved;
    const cid = deps.entity?.characterId ? String(deps.entity.characterId) : null;
    const me = cid ? family.people.find((p) => p.characterId === cid) : null;
    if (me) {
      if (me.died && family.model === MODELS.bloodline) { deadLoaded = me; return; }
      setCurrent(family, me.id);
    }
  }

  /** FOUND the family around the character being played - a new character's answer, or the Mods pane's model. */
  function found(model = null) {
    if (family || !deps.on() || !deps.entity?.chargenDone) return family;
    const s = legacySettings();
    const m = model ?? deps.entity?.legacyModel ?? s.model;
    family = foundFamily(deps.entity, { model: m, seat: deps.town(deps.here()), at: deps.now(), rng, settings: s });
    const p = current();
    p.bornOwn = Math.floor(deps.own() ?? 0);
    rollSiblings(family, p.id, { rng, at: deps.now(), settings: s });   // SaveCurrentCharacter(firstTime) -> CreateRandomSiblings
    store();
    deps.say(LEGACY_TEXT.founded(family.surname, family.model));
    if (family.seat) deps.say(LEGACY_TEXT.seat(family.seat.loc));
    return family;
  }

  /** The estate set aside for a member is paid on their first day as the one played - a letter of credit. */
  function payEstateOf(p) {
    if (!p || !(p.estate > 0)) return;
    const n = p.estate;
    p.estate = 0;
    touch(family);
    deps.payEstate?.(n);
    deps.say(LEGACY_TEXT.estate(n));
    store();
  }

  // ---- the death -------------------------------------------------------------------------------------------------

  /** The presenter's moment: where, when, the purse - before any mode is left. */
  function onDeathPresented() {
    death = family && deps.on() && current() ? { at: deps.now(), place: deps.here(), gold: deps.gold() } : null;
  }

  /**
   * THE DEATH'S OUTCOME, asked by the host at the death screen's reset:
   *   - `{ kind: 'none' }`: Project Legacy has no say (off, no family, a dead load) - the host's own death stands;
   *   - `{ kind: 'rise', line }`: an Enduring member paid the toll - the host respawns them and says `line`;
   *   - `{ kind: 'fall', fallen, choices, newborn }`: the member is dead for good - the host shows the Succession.
   */
  function deathOutcome() {
    const p = current();
    if (!family || !p || !deps.on() || deadLoaded || !isAlive(p)) return { kind: 'none' };
    writeCurrent();
    const d = death ?? { at: deps.now(), place: deps.here(), gold: deps.gold() };
    death = null;
    if (family.model === MODELS.enduring) {
      const paid = payToll(p, legacySettings().tollShare, p.lived);
      touch(family);
      store();
      if (!paid.final) return { kind: 'rise', line: tollLine(p.given, paid) };
      d.cause = 'years';
    }
    recordDeath(family, p.id, { at: d.at, cause: d.cause ?? 'fell', place: d.place, by: deps.killer?.() ?? null });
    layDeathRemains(p, d);
    store();
    return { kind: 'fall', fallen: p, estate: estateOf(d.gold), choices: successors(family), newborn: newbornAllowed(family, p) };
  }

  // ---- LEGACY4: the remains and the death quest -------------------------------------------------------------------

  /** At a final death: THE REMAINS lie where the fallen fell - the heirloom (Bloodline: the Mods pane's chance; an
   *  Enduring elder dead of their years: always), and a tenth of the purse. Written into the family, for the heir. */
  function layDeathRemains(p, d) {
    const chance = family.model === MODELS.bloodline ? legacySettings().heirloomChance : 1;
    const piece = rng() < chance ? pickHeirloom(deps.entity?.items) : null;
    const name = fullNameOf(p.given, p.surname);
    const items = piece ? [markHeirloom(piece, { line: family.id, house: family.surname, of: p.id, from: name })] : [];
    (family.remains ??= []).push({
      id: `r${p.id}`, of: p.id, name, place: d.place ?? null, items, gold: Math.floor((d.gold | 0) * REMAINS_GOLD_SHARE),
      killer: deps.killer?.() ?? null, at: d.at, state: 'lying',
    });
  }
  /** The remains the one played may seek: every one of the line's still lying or carried. */
  const openRemains = () => (family?.remains ?? []).filter((r) => r.state === 'lying' || r.state === 'taken');
  const laidThisVisit = new Set();
  /** The death quest's step (the host's slow tick): lay the remains when the heir stands where they fell, notice what
   *  they took from the pile, and offer the rest when the remains are carried to a temple or the seat. */
  function remainsStep() {
    const carried = deps.entity?.items ?? [];
    for (const r of openRemains()) {
      // what was taken from the pile is the heir's now - never laid again (no heirloom twice for a walk away and back)
      if (r.items.length && carried.some((it) => isHeirloom(it) && it.heirloom.line === family.id && it.heirloom.of === r.of)) { r.items = []; touch(family); store(); }
      if (r.state === 'lying' && carried.some((it) => isRemainsItem(it) && it.legacyRemains.line === family.id && it.legacyRemains.of === r.of)) {
        r.state = 'taken';
        touch(family);
        store();
        deps.say(LEGACY_TEXT.remainsTaken(r.name));
      }
      if (r.state === 'lying') {
        const here = deps.atPlace?.(r.place) ?? false;
        if (!here) { laidThisVisit.delete(r.id); continue; }
        if (laidThisVisit.has(r.id)) continue;
        const pile = [...r.items, mintRemainsItem({ line: family.id, of: r.of, name: r.name }), ...(r.gold > 0 ? [goldStack(r.gold)] : [])];
        if (deps.layRemains?.(r, pile)) {
          laidThisVisit.add(r.id);
          if (r.gold > 0) { r.gold = 0; touch(family); store(); }   // the purse lies once - a walk away and back finds the bones, not a second purse
          if (!r.found) { r.found = true; touch(family); store(); deps.say(LEGACY_TEXT.remainsFound(r.name)); }
        }
      } else if (r.state === 'taken' && !restAsked && deps.atRest?.()) {
        restAsked = true;
        deps.askRest?.(r.name, () => layToRest(r));
      }
    }
    if (!deps.atRest?.()) restAsked = false;
  }
  let restAsked = false;
  /** THE REST: the remains given up, the heirloom carried home attuned, the blessing on the one who laid them. */
  function layToRest(r) {
    const carried = deps.entity?.items ?? [];
    const bones = carried.find((it) => isRemainsItem(it) && it.legacyRemains.line === family.id && it.legacyRemains.of === r.of);
    if (!bones || r.state !== 'taken') return false;
    deps.takeItem?.(bones);
    const fallen = personOf(family, r.of);
    if (fallen) {
      const b = blessingOf(fallen, r.name);
      (deps.entity.legacyBlessings ??= []).push(b);
      deps.say(LEGACY_TEXT.rested(r.name, SKILL_NAMES[b.skill] ?? 'skill'));
    }
    const heirloom = carried.find((it) => isHeirloom(it) && it.heirloom.line === family.id && it.heirloom.of === r.of);
    if (heirloom) { attuneHeirloom(heirloom); deps.say(LEGACY_TEXT.attuned(heirloom.name, heirloom.heirloom.gen)); }
    r.state = 'rested';
    r.restedAt = deps.now();
    touch(family);
    store();
    return true;
  }
  /** The death quests in the quest log - the Quest Guide's tracker and marks read them (GUIDE4, GUIDE5). */
  function questLogEntries() {
    if (!family || !deps.on()) return [];
    return openRemains().map((r) => {
      const where = r.place?.loc ? `${r.place.loc}${r.place.region ? `, ${r.place.region}` : ''}` : (r.place?.region || 'the Bay');
      const lines = r.state === 'lying'
        ? [`${r.name} fell at ${where}${r.place?.mode === 'dungeon' ? ', deep inside' : ''}. Their remains lie there still - marked on your map.`,
          ...(r.killer ? [`It was ${r.killer} that struck them down.`] : []),
          ...(r.items.length ? ['Something of theirs lies with them - a piece the house will want back.'] : []),
          'Find them, and carry them home.']
        : [`You carry the remains of ${r.name}.`, 'Lay them to rest at any temple, or at the family’s seat, and their blessing will stay with you.'];
      return { id: `${LEGACY_QUEST_PREFIX}${r.id}`, name: `The Bones of ${r.name}`, questName: 'LEGACY', legacy: true, messages: [lines] };
    });
  }
  /** The remains still lying, ringed on the maps where the fallen fell. */
  const mapMarks = () => openRemains().filter((r) => r.state === 'lying' && r.place?.pixel).map((r) => ({
    cx: r.place.pixel.x + 0.5, cy: r.place.pixel.y + 0.5, r: LEGACY_RING_R, label: `The remains of ${r.name}`, id: `${LEGACY_QUEST_PREFIX}${r.id}`, place: r.place.mode === 'dungeon', farmKey: null,
  }));

  /**
   * THE SUCCESSION'S CHOICE: `{ personId }` a living member, or `{ newborn: true }` a child of the fallen. The estate
   * goes to whoever takes the mantle. A member already played is LOADED; one never played is BORN. Answers whether
   * the boot was asked (false: nothing to do - the caller ends the line).
   */
  function succeed(choice, { estate = 0, fallenId = null } = {}) {
    if (!family) return false;
    const s = legacySettings();
    let heir = null;
    let lore = null;
    if (choice?.newborn) {
      const parentId = fallenId ?? family.currentId;
      const made = addChild(family, parentId, { rng, at: deps.now(), settings: s });
      heir = made.person;
      if (made.changed) lore = LEGACY_TEXT.lore(heir.given, family.surname, heir.surname);
      rollSiblings(family, heir.id, { rng, at: deps.now(), settings: s });   // HandlePlayerDeath -> CreateRandomSiblings
    } else {
      heir = personOf(family, choice?.personId);
      if (!heir || !isAlive(heir)) return false;
    }
    heir.estate = (heir.estate | 0) + Math.max(0, estate | 0);
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

  /** The line ends (no member, no heir): kept in the Hall, closed. */
  function endLine() {
    if (!family) return;
    endFamily(family, deps.now());
    store();
  }

  // ---- the switch (FamilyLegacyInformationPanel's double-click, SwitchCharacterManager) -----------------------------

  /** Why a switch to `id` is refused, or null. S3: never mid-fight; online, never (the realm's birth law - LEGACY7). */
  function switchRefusal(id) {
    const t = personOf(family, id);
    if (!family || !t || !isAlive(t) || t.kind !== 'member' || t.id === family.currentId || t.retired != null) return 'none';
    if (deps.online()) return LEGACY_TEXT.online;
    if (deps.inFight()) return LEGACY_TEXT.fight;
    return null;
  }
  /** Save the one played where they stand (the mod's anchor, D7), then play the other. */
  function switchTo(id) {
    const why = switchRefusal(id);
    if (why) return { ok: false, why };
    writeCurrent();
    deps.saveNow();
    setCurrent(family, id);
    touch(family);
    store();
    return { ok: play(personOf(family, id)) };
  }

  /** LEGACY2: AN ELDER PASSES THE MANTLE - an Enduring family's played member, an elder, retires to the seat (alive, kept
   *  on the tree, never played again), saved where they stand; the Succession is the host's to open with the outcome. */
  function passMantle() {
    const p = current();
    if (!family || !p || !deps.on() || family.model !== MODELS.enduring) return { ok: false, why: 'Only an Enduring house passes its mantle.' };
    writeCurrent();
    if (!isElder(p, p.lived)) return { ok: false, why: `${p.given} is not yet an elder of the house.` };
    if (deps.online()) return { ok: false, why: LEGACY_TEXT.online };
    if (deps.inFight()) return { ok: false, why: LEGACY_TEXT.fight };
    deps.saveNow();
    p.retired = deps.now();
    touch(family);
    store();
    return { ok: true, outcome: { kind: 'fall', fallen: p, estate: 0, choices: successors(family), newborn: true } };
  }

  // ---- the boot's birth --------------------------------------------------------------------------------------------

  /** `?legacyborn=<id>`: the waiting birth, taken - its family is the new game's. Null when none waits. */
  function takeBorn(personId) {
    const b = takeBirth(deps.tab(), personId);
    if (!b) return null;
    const f = loadFamily(deps.storage(), b.familyId);
    const p = personOf(f, b.personId);
    if (!f || !p || !isAlive(p)) return null;
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

  /** After finishChargen built the born member: their character is their person's, and their first day pays. */
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
  }

  // ---- the frame ---------------------------------------------------------------------------------------------------

  /** The host's slow tick: a dead load acted on, the seat noted, the elder said once, the estate paid. Answers the
   *  dead load's person once (the host shows its window), else null. */
  function tick() {
    if (deadLoaded) { const d = deadLoaded; deadLoaded = null; return { deadLoad: d }; }
    if (!family || !deps.on() || !deps.entity?.chargenDone) return null;
    const p = current();
    if (!p) return null;
    if (!family.seat) {
      const t = deps.town(deps.here());
      if (t) { family.seat = t; touch(family); store(); deps.say(LEGACY_TEXT.seat(t.loc)); }
    }
    if (p.estate > 0) payEstateOf(p);
    remainsStep();
    if (family.model === MODELS.enduring && !elderSaid && isElder(p, lived())) {
      elderSaid = true;
      deps.say(LEGACY_TEXT.elder(p.given, ageOf(p, lived())));
    }
    return null;
  }

  return {
    get family() { return family; },
    current,
    lived,
    found,
    onCharacterMade: (model = null) => found(model),
    /** The boot's end: a loaded character with no family is founded into the Mods pane's model (D9). */
    afterBoot: () => found(),
    onDeathPresented,
    deathOutcome,
    succeed,
    endLine,
    switchRefusal,
    switchTo,
    passMantle,
    questLogEntries,
    mapMarks,
    layToRest,
    takeBorn,
    bornResult,
    onBorn,
    tick,
    /** A test's seam: the death the presenter saw. */
    get pendingDeath() { return death; },
  };
}
