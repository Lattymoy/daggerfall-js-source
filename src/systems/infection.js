// V1 - THE INFECTION HALF: VampirismInfection.cs and
// LycanthropyInfection.cs (MIT, Daggerfall Workshop), the two
// diseases that end by replacing the player's race rather than by
// wearing off.
//
// THEY ARE DISEASES, and that is the whole trick of the port. DFU
// gives each a DiseaseData of all zeroes with 0xFF days of symptoms -
// "Permanent no-effect disease, will manage custom lifecycle" - so
// the disease machinery carries them (the daily tick, the cure, the
// count) while the effect itself does the counting of days. The port
// already has all of that, so an infection is an activeEffects entry
// with `kind: 'disease'` and nothing else new. What it is NOT is a
// disease with a row: `classicDiseaseType = Diseases.None`, so
// UpdateDisease is overridden and DOES NOT CALL BASE - the daily
// damage walk never runs against it. diseases.js carries that arm.
//
// THE LIFECYCLE IS TWO GATES, and both are off-by-one traps:
//   `daysPast > 0`  schedules the WARNING DREAM. One full day, not
//                   the same day.
//   `daysPast > 3`  turns the player - the FOURTH day, not the third,
//                   whatever DFU's own comment ("after 3 days have
//                   passed") reads like.
// ...and the second gate ALSO requires the dream to have been PLAYED,
// not merely scheduled. A player who never dismisses the dream never
// turns, however long they wait. That is DFU's own wiring: the flag
// is set from the video's OnClose, and the video is modal.
//
// THE TWO DEPLOYMENTS DIFFER IN WHO FIRES THEM. Lycanthropy turns in
// the tick itself, at the gate. Vampirism schedules a SECOND video
// there - a fake DEATH - and turns on ITS close, so the tick's job
// for vampirism ends at pushing the video. Which means the port has
// to keep the close callback, not fold it into the next tick: DFU's
// `fakeDeathVideoPlayed` is set when the window is PUSHED, so a
// player who never dismisses the death video is a vampire who never
// arrives, and the disease sits at that gate for ever. Named
// `deathScheduled` here, because that is what it holds.
//
// THE CANCELS (BecomeIncumbent): an existing racial override cancels
// the incoming infection outright - you cannot catch lycanthropy as a
// vampire - and the two lycanthropy strains cancel each other, so a
// wereboar bite does nothing to someone already becoming a werewolf.
// It is the OPPOSING STRAIN ONLY: a vampirism infection does not bar
// a werewolf bite, and vice versa, so a player can be four days from
// two different fates at once. AddState ends a NON-incumbent
// duplicate immediately, "that it doesn't fire during time
// acceleration"; the port has one entry per key by construction, so
// that arm is the same statement said once.
//
// AND THE PRICE THE TEMPLE CHARGES IS ALREADY RIGHT, which corrects
// the Ledger row that opened this arc. That row said the cure-disease
// count is short by one until a vampirism timer lands, and that the
// arc "lands by filling one parameter". It does not:
// GetDiseaseCount (:1489-1499) counts every bundle of type Disease,
// and an infection IS one, so a DFU-NATIVE infection is already
// counted. `TimeToBecomeVampireOrWerebeast` is read from a CLASSIC
// .SAV character record (CharacterRecord.cs:242) and is set by
// nothing else in DFU, so its `+1` exists to price an IMPORTED
// character who carries the timer without carrying the effect. This
// port has no classic-save reader, so the parameter stays false and
// the count is correct through the disease it already is.
//
// THE RACIAL OVERRIDES ALL SHIPPED: V2a lycanthropy, V2b vampirism
// (the blood hunger, the clan spells, the marker `deploy` lands
// consumed in the same round), V2c the sun/holy damage, V2d the
// quests, V2e the guild-book swap and THIS FILE's cemetery transfer
// (randomCemeteryLocationIndex + the host's transferToCemetery arm,
// below). `entity.racialOverridePending` remains the one hand-off,
// and the thing that makes a SECOND infection impossible.

import { PERMANENT_DISEASE_VALUE, COMPLETED_DISEASE_VALUE, endDisease } from './diseases.js';
// DaggerfallDateTime's two constants for the raise at the bottom of
// this file. Declaring them here is what the one-home guard caught,
// and it was right twice over: both already existed, in two DIFFERENT
// modules, neither of which ports DaggerfallDateTime. V1 gave them
// gameDate.js's roof and left re-exports behind.
import { DUSK_HOUR, SECONDS_PER_WEEK } from './gameDate.js';
import { DUNGEON_TYPES } from '../formats/mapsFile.js';   // V2e: the cemetery pick reads the region's mapTable

/** DaggerfallUnityEnums.LycanthropyTypes (:660-665). */
export const LYCANTHROPY_TYPES = Object.freeze({ None: 0, Werewolf: 1, Wereboar: 2 });

/** DaggerfallUnityEnums.VampireClans (:670-682) - the values ARE the
 *  clan factions' own ids, which is what makes GetVampireClan's
 *  nine-arm switch an identity read plus a membership test. */
export const VAMPIRE_CLANS = Object.freeze({
  None: 0, Vraseth: 150, Haarvenu: 151, Thrafey: 152, Lyrezi: 153,
  Montalion: 154, Khulari: 155, Garlythi: 156, Anthotis: 157, Selenu: 158,
});
const CLAN_IDS = new Set(Object.values(VAMPIRE_CLANS).filter((v) => v !== 0));

/** The three infections, keyed as DFU keys them (:35 and the two
 *  subclasses' own keys). */
export const INFECTION = Object.freeze({
  Vampirism: 'Vampirism-Infection',
  Werewolf: 'Werewolf-Infection',
  Wereboar: 'Wereboar-Infection',
});
export const LYCANTHROPY_OF = Object.freeze({
  [INFECTION.Werewolf]: LYCANTHROPY_TYPES.Werewolf,
  [INFECTION.Wereboar]: LYCANTHROPY_TYPES.Wereboar,
});
export const isLycanthropyInfection = (key) => key in LYCANTHROPY_OF;

/** The videos each stage plays (:109-110, LycanthropyInfection :95). */
export const LYCANTHROPY_DREAM_VIDEO = 'ANIM0002.VID';
export const VAMPIRE_DREAM_VIDEO = 'ANIM0004.VID';
export const VAMPIRE_DEATH_VIDEO = 'ANIM0012.VID';
/** "Death is not eternal" (:150). */
export const DEATH_IS_NOT_ETERNAL_TEXT_ID = 401;

/** The two gates (:121, :131). Named, because both are off by one
 *  against the reading a person would give them. */
export const DREAM_AFTER_DAYS = 0;
export const TURN_AFTER_DAYS = 3;

/**
 * FormulaHelper.GetVampireClan (:400-427): the region's own Province
 * faction record carries a `vam` column naming the clan that holds
 * it, and the enum's values ARE those faction ids - so the switch DFU
 * writes out longhand is an identity read plus a membership test.
 *
 * THE DEFAULT IS LYREZI, NOT NONE - "The Lyrezi are the default like
 * in classic". A region whose vam names no clan, and the missing
 * record GetRegionFaction hands back when it finds none, both turn
 * the player into a Lyrezi rather than into a clanless vampire. None
 * is a value the enum HAS and this function never returns.
 */
export const vampireClanForFaction = (regionFaction) =>
  (CLAN_IDS.has(regionFaction?.vam) ? regionFaction.vam : VAMPIRE_CLANS.Lyrezi);

/**
 * The disease entry an infection is. `kind: 'disease'` is not a
 * convenience - it is what makes the daily tick reach it, the
 * temple's count include it and Cure Disease end it, exactly as DFU's
 * BundleTypes.Disease does.
 *
 * `disease: null` marks classicDiseaseType None: there is no row in
 * the seventeen-disease table to read, which is why diseases.js has
 * to skip the damage walk rather than run it over an absent row.
 */
export function createInfection(key, { day = 0, regionIndex = -1 } = {}) {
  return {
    kind: 'disease',
    infection: key,
    disease: null,                       // classicDiseaseType = Diseases.None
    daysOfSymptomsLeft: PERMANENT_DISEASE_VALUE,
    statMods: {},
    startingDay: day,
    dreamScheduled: false,
    dreamPlayed: false,
    deathScheduled: false,
    deployed: false,
    // "Think classic uses current region at time of turning, this
    // will use current region at time of infection" (:90) - the clan
    // is read from THIS index at deployment, not from where the
    // player happens to be standing when they turn.
    regionIndex,
  };
}

/**
 * BecomeIncumbent's cancels (:65-72, LycanthropyInfection :39-58).
 * Answers whether an incoming infection takes hold at all.
 *  - an existing RACIAL OVERRIDE cancels it outright
 *  - the two lycanthropy strains cancel each other
 *  - the same infection twice is the AddState arm: the duplicate ends
 *    rather than restarting the clock, so a second bite of the same
 *    kind does not buy the player three more days
 */
export function infectionAccepted(entity, key) {
  if (entity?.racialOverride || entity?.racialOverridePending) return false;
  const live = (entity?.activeEffects ?? []).filter((a) => a.infection && !a.ended);
  if (live.some((a) => a.infection === key)) return false;
  if (isLycanthropyInfection(key) && live.some((a) => isLycanthropyInfection(a.infection))) return false;
  return true;
}

/**
 * DiseaseEffect.Start's gate, which VampirismInfection.Start reaches
 * through `base.Start` BEFORE it records its own day (:84-93, :82-92)
 * - so A LEVEL-1 PLAYER CANNOT BE TURNED any more than they can catch
 * plague, and a werewolf that bites a guard infects nothing. The
 * special-infection path skips InflictDisease's saving throw
 * (bypassSavingThrows) but not this.
 */
export function startInfection(target, key, { day = 0, regionIndex = -1 } = {}) {
  if (!target?.isPlayer || (target.level ?? 0) < 2) return null;
  if (!infectionAccepted(target, key)) return null;
  const entry = createInfection(key, { day, regionIndex });
  target.activeEffects = target.activeEffects || [];
  target.activeEffects.push(entry);
  return entry;
}

/** The infection an entity is carrying, or null. */
export const liveInfection = (entity) =>
  (entity?.activeEffects ?? []).find((a) => a.infection && !a.ended) ?? null;

/**
 * ProgressDisease (:107-141 / :95-127) as a decision. `currentDay` is
 * the classic day number, so the caller owns the clock.
 *
 * Answers one of
 *   { kind: 'idle' }
 *   { kind: 'dream', video }   - push the warning dream
 *   { kind: 'death', video }   - push vampirism's fake death; the
 *                                TURN hangs off that video's close
 *   { kind: 'deploy' }         - lycanthropy's turn, here in the tick
 *
 * DFU's `else if` is the order, and it is observable: on the tick
 * that schedules the dream, nothing else happens however many days
 * have passed - a player who fast-travels a week gets the dream, and
 * only turns once they have dismissed it.
 */
export function infectionStep(entry, currentDay) {
  if (!entry || entry.ended) return { kind: 'idle' };
  // `daysOfSymptomsLeft == completedDiseaseValue` (:113) - EndDisease
  // has run, and the lifecycle is over whatever else is set.
  if (entry.daysOfSymptomsLeft === COMPLETED_DISEASE_VALUE) return { kind: 'idle' };
  const daysPast = currentDay - entry.startingDay;
  if (daysPast > DREAM_AFTER_DAYS && !entry.dreamScheduled && !entry.dreamPlayed) {
    return {
      kind: 'dream',
      video: entry.infection === INFECTION.Vampirism ? VAMPIRE_DREAM_VIDEO : LYCANTHROPY_DREAM_VIDEO,
    };
  }
  // THE DREAM MUST HAVE PLAYED, not merely been scheduled: the flag
  // is set from the video's OnClose, so a dream left open holds the
  // infection at this gate for ever.
  if (daysPast > TURN_AFTER_DAYS && entry.dreamPlayed) {
    if (entry.infection === INFECTION.Vampirism) {
      if (!entry.deathScheduled) return { kind: 'death', video: VAMPIRE_DEATH_VIDEO };
    } else if (!entry.deployed) {
      return { kind: 'deploy' };
    }
  }
  return { kind: 'idle' };
}

/** WarningDreamVideoCompleted (:143-146), the ONE line the dream's
 *  close runs. It does NOT clear the scheduled flag - DFU never does
 *  - and it does not have to, because `!dreamPlayed` already bars the
 *  gate from here on. */
export const markDreamPlayed = (entry) => { if (entry) entry.dreamPlayed = true; };

/**
 * DeployFullBlownVampirism (:148-192) and DeployFullBlownLycanthropy
 * (:120-126), reduced to what this slice owns: the marker V2 reads,
 * the vampirism clock raise, the popup, and EndDisease.
 *
 * EndDisease IS THE LAST LINE in both, and it matters: the moment the
 * player turns, the disease stops being curable and stops being
 * counted by the temple. Cure Disease bought one minute earlier still
 * works; one minute later there is nothing left to cure.
 */
export function deployInfection(entry, entity, { hourNow = () => 0, raiseTime = null, messageBox = null, clanOf = null, transferToCemetery = null } = {}) {
  if (!entry || entry.deployed) return null;
  entry.deployed = true;
  const key = entry.infection;
  const pending = { key, lycanthropy: LYCANTHROPY_OF[key] ?? LYCANTHROPY_TYPES.None, clan: VAMPIRE_CLANS.None };
  if (key === INFECTION.Vampirism) {
    pending.clan = clanOf ? clanOf(entry.regionIndex) : VAMPIRE_CLANS.Lyrezi;
    // Raise game time to an evening two weeks later (:159-161),
    // BEFORE the popup, because the popup is what the player reads on
    // the far side of the fortnight.
    raiseTime?.(vampireTurnRaiseSeconds(hourNow()));
    // Transfer player to a random cemetery (:164-175), between the
    // raise and the popup - DFU's own order. The arm is the HOST's
    // (V2e): only the world host can arrive at another location, so
    // everywhere else the member is absent and the player wakes where
    // they fell (recorded in wireInfectionVideos).
    transferToCemetery?.();
    messageBox?.(DEATH_IS_NOT_ETERNAL_TEXT_ID);
  }
  if (entity) entity.racialOverridePending = pending;
  endDisease(entry);
  return pending;
}

/**
 * THE ONE CONSTRUCTION SEAM for the three videos and the clock. The
 * tick that runs the lifecycle lives in worldTick.js and has no
 * renderer, no canvas and no faction dictionary; the host has all
 * three. Registering once - scenes/shared.js's wireInfectionVideos,
 * which every host calls - beats threading four arguments through two
 * tick call sites, and is the shape loot.js's spell-record registry
 * already uses.
 *
 * Unregistered, the null object below still runs the lifecycle: a
 * video that cannot be played counts as watched, so a headless probe
 * and a node test both reach the turn.
 */
let _host = null;
export function setInfectionHost(host) { _host = host ?? null; }

/**
 * UpdateDisease's override, as the per-day pass a host calls. The
 * video seam is a callback pair because DFU's is: the window is
 * PUSHED here and the next stage hangs off its OnClose.
 *
 * A host with no video reader is the null object - `playVideo`
 * defaults to closing immediately - so the lifecycle still runs in a
 * test and in a headless probe. Every real host passes the reader.
 */
export function runInfections(entity, currentDay, opts = {}) {
  const entry = liveInfection(entity);
  if (!entry) return { kind: 'idle' };
  const o = { ..._host, ...opts };
  const playVideo = o.playVideo ?? ((name, onClose) => onClose());
  const step = infectionStep(entry, currentDay);
  if (step.kind === 'dream') {
    entry.dreamScheduled = true;                     // set at PUSH (:129)
    playVideo(step.video, () => markDreamPlayed(entry));
  } else if (step.kind === 'death') {
    entry.deathScheduled = true;                     // fakeDeathVideoPlayed (:139), also at PUSH
    playVideo(step.video, () => deployInfection(entry, entity, o));
  } else if (step.kind === 'deploy') {
    deployInfection(entry, entity, o);
  }
  return step;
}

/**
 * GetRandomCemetery (:194-217), the pick half as pure law: every
 * mapTable row whose dungeonType is Cemetery - "always using a small
 * cemetery, nothing spoils that first vampire moment like being lost
 * in the guts of a massive dungeon" - one picked uniformly (DFU rolls
 * UnityEngine.Random.Range, not DFRandom). Answers the LOCATION
 * INDEX; where DFU would throw (a region with no cemetery, or an
 * unloadable location) the port answers null and the caller skips
 * loudly - the never-traps rule.
 */
export function randomCemeteryLocationIndex(mapTable, roll = Math.random) {
  const found = [];
  for (let i = 0; i < (mapTable?.length ?? 0); i++) {
    if (mapTable[i]?.dungeonType === DUNGEON_TYPES.Cemetery) found.push(i);
  }
  if (!found.length) return null;
  return found[Math.min(found.length - 1, Math.floor(roll() * found.length))];
}

/**
 * DeployFullBlownVampirism's clock raise (:160): two weeks, plus the
 * hours from NOW to one past dusk. The second term is SIGNED -
 * turning at 22:00 gives `18 + 1 - 22 = -3` hours, so the arrival is
 * three hours BEFORE the fortnight mark rather than after it. Every
 * turn lands at 19:00 whatever hour it began, which is the point: a
 * new vampire never wakes in daylight.
 */
export const vampireTurnRaiseSeconds = (hour) =>
  (2 * SECONDS_PER_WEEK) + (DUSK_HOUR + 1 - hour) * 3600;
