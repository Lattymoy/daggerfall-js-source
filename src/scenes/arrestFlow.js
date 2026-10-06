// G2: the arrest + court flow driver (DFU EnemyAttack's surrender
// interception + DaggerfallCourtWindow's state machine), shared by
// both exterior hosts. The court math is Node-pure (systems/court.js);
// this module owns the window sequence through townTalk's overlay
// slot and the guard-hit interception.
//
// The verbatim interception (EnemyAttack): a guard's landed hit on a
// player with an active crime, before the surrender dialogue has been
// shown, WITHHOLDS the damage - LowerRepForCrime fires and the
// "do you surrender?" box (TEXT.RSC 15) opens; No lands the damage;
// later hits damage normally EXCEPT a would-be-fatal hit forces
// SurrenderToCityGuards(false), which can refuse (legalRep/coin) and
// let the blow kill. Yes -> SurrenderToCityGuards(true) -> court.
//
// The court sequence: 8050 (Guilty/Not Guilty) -> guilty: halve+pay,
// serve or walk; not guilty: 8064 (Debate/Lie) -> free (8062) or
// guilty (8055) with the fine roll; banishment shows 8063.
//
// THE SENTENCE IS SERVED, not summarised. State 3 (:254-262) sets
// InPrison, switches the panel to PRIS00I0 and hands state 100 a
// countdown: one day per 0.3 real seconds (ui/prisonScreen.js). Only
// when the counter empties does UpdatePrisonScreen raise the clock -
// the whole sentence at once, behind both prevent flags (:471-479) -
// and only then does ReleaseFromPrison run.
//
// RELEASE (:482-491) is five lines and the port now owes all five:
// PreventEnemySpawns, RaiseTime(240 minutes), the crime clears (the
// guards despawn on the crime-clear law in cityGuards),
// PositionPlayerAtLocationEntrance when the arm asked for it, and
// ClearEnemies. The last two are the host's, through the seams named
// on createArrestFlow.

import { expandMacroValues } from '../systems/quest/questMacros.js';   // MH1: the ONE macro walk
import { ChoiceWindow } from '../ui/talkWindow.js';
import {
  CRIMES, CRIME_NAMES, penaltyText, TEXT_SURRENDER, TEXT_COURT_START, TEXT_FOUND_GUILTY,
  TEXT_FREE_TO_GO, TEXT_BANISHED, TEXT_HOW_CONVINCE,
  lowerRepForCrime, surrenderToCityGuards, startCourt, pleaGuilty,
  pleaNotGuilty, resolveGuiltyVerdict, raiseRepForSentence, TEXT_EXECUTED,
  guildRescue, setCrimeCommitted,
} from '../systems/court.js';
import { isTransformedLycanthrope, frightenChance, frightenRoar } from '../systems/lycanthropy.js';   // WERE-FRIGHT: the beast cannot surrender
import { guildOfFaction, membershipOf, activeMemberships } from '../systems/guilds.js';   // CR1: the rescue arms' member reads
import { resolveVariantGuild } from '../systems/guildVariants.js';
import { advanceOwnMinutes, MINUTES_PER_DAY, ownMinutes, trustedWorldMinutes } from '../systems/worldTick.js';   // LIVED1: a sentence is served on the prisoner's own clock, online too
import { banish, grantGrace, warningDue, noteWarning } from '../systems/standing.js';   // REP3: a banishment's term; REP1: the grace an answered law gives; WATCH-KNOWS: a first offence warned
import { setSyntheticTimeIncrease } from '../systems/effectBroker.js';   // AUDIT 63 F13: DaggerfallCourtWindow_OnEndPrisonTime (EntityEffectBroker.cs:841-842)
import { fillVitalSigns } from '../systems/statMods.js';
import { registerPlayerDamageVeto } from '../characters/playerEntity.js';   // ARREST-SHIELD: the one damage door consults this flow while a trial is up online
import { SEVERE_PUNISHMENT_EXECUTED } from '../systems/encounters.js';   // F99: the court's own two bits
import { PrisonScreenWindow, CourtScreenWindow } from '../ui/prisonScreen.js';   // the serving-time presentation (SwitchToPrisonScreen + UpdatePrisonScreen)   // ROAD-B B5: Setup's courtPanel, the backdrop the trial stands on

/** ReleaseFromPrison (DaggerfallCourtWindow.cs:482-491) opens with
 *      DaggerfallUnity.WorldTime.DaggerfallDateTime.RaiseTime(240 * 60);
 *  - four hours, on EVERY release. It is the mechanism by which the guards
 *  are gone and the day has moved when you step back outside. */
export const RELEASE_MINUTES = 240;

/** WERE-FRIGHT: the beast's halt box and its two outcomes, the port's own words (DFU has no such box). */
export const BEAST_HALT_LINES = Object.freeze(['Halt! The watch has you cornered.', 'You cannot surrender in this form.']);
export const BEAST_FRIGHTENED_TEXT = 'The watch flees in terror. Your crime is forgotten.';
export const BEAST_STOOD_TEXT = 'The watch stands its ground.';

// AUDIT 21 F8: `advanceDays` used to default to `() => {}` AND BOTH HOSTS
// CONSTRUCTED THE FLOW WITHOUT IT, so a thirty-day sentence advanced the
// clock by zero - you walked out of court on the same afternoon you walked
// in. The fix is not host wiring: AUDIT 21 F2 gave the port ONE world clock,
// so the flow can move time itself and there is no argument left to forget.
// A host may still pass its own hook (a save-game driver, a test), but the
// default is now the real thing.
export function createArrestFlow({
  townTalk, playerEntity, regionIndex,
  // LIVED1: the days are the PRISONER's - their own clock, which is the world's offline and theirs online, where the
  // world's sky does not wait for anyone's sentence. [SUPERSEDES AUDIT WORLD5 C9's "a sentence online serves no days".]
  advanceDays = (days) => advanceOwnMinutes(days * MINUTES_PER_DAY),
  advanceMinutes = (m) => advanceOwnMinutes(m),
  rolls = Math.random,
  // DaggerfallCourtWindow.OnCourtScreen, whose one subscriber is
  // CameraRecoiler (:193-197) - the sway is cleared when the court
  // screen opens. Hosts that own a camera pass their recoiler's reset.
  onCourtScreen = () => {},
  // THE JAIL-SKIP TRIO, ReleaseFromPrison's own three lines
  // (DaggerfallCourtWindow.cs:482-491), each of which needs the host:
  //
  //   GameManager.Instance.ClearEnemies()          (:489)
  //   PositionPlayerAtLocationEntrance()           (:488, when repositioning)
  //   PlayerEntity.PreventEnemySpawns = true       (:484)
  //
  // The third is a plain entity flag and is written here; the first
  // two are the world's and arrive as seams. A host that hands
  // neither still gets the flag and the clock - the flow refuses
  // nothing - which is what the probe hosts and every test do.
  clearEnemies = () => {},
  positionPlayerAtLocationEntrance = () => {},
  // TextManager.GetLocalizedText, for the prison screen's
  // `daysUntilFreedom` row. Absent, the shipped Internal_Strings
  // literal stands.
  localizedText = null,
  // ROAD-B B5 - InputManager.GetBackButton() (:1075-1078), read every
  // frame of state 100 (:301-304) to speed the prison countdown up.
  // It is `Input.GetKey(KeyCode.Escape)`: the RAW key, HELD, neither a
  // rebindable action nor a thing any window can swallow - which is
  // why it arrives as its own seam rather than through the overlay's
  // input(). A host that hands none serves its days at classic speed,
  // which is what DFU's own "Not in classic" comment says the absence
  // is worth.
  backButtonHeld = null,
  // CR1: GuildManager.GetGuild(factionId).IsMember()/Rank for the
  // rescue arms - the member's rank, or null for a non-member. The
  // default is the same guildOfFaction/membershipOf read the quest
  // world's getGuild makes, over townTalk's faction tree.
  guildRankOf = (factionId) => {
    const dict = townTalk.factionDict ?? null;
    const g = guildOfFaction(factionId, resolveVariantGuild(dict), dict);
    const m = g ? membershipOf(activeMemberships(playerEntity), g) : null;
    return m ? (m.rank ?? 0) : null;
  },
  // WERE-FRIGHT: the host's three doors for the beast's roar - the HUD line, the roar itself, and every watchman
  // it commands to run (each of the host's guard pools; answers how many ran). A host that hands none still gets
  // the box, the roll and the crime; nothing is said, heard or run from.
  say = () => {},
  playSound = () => {},
  watchFlees = () => 0,
  // WATCH-KNOWS: whether the living world's watch is the one that comes (scenes/world.js: livingWorldOn) - it warns a
  // first minor offence in a region rather than arrest it (systems/standing.js warningDue); none, DFU's watch, always
  // the box. The region's name for the warning's words, and the world's calendar a banishment runs on (AUDIT REP F2).
  warnsFirst = () => false,
  regionName = () => 'this region',
  worldNow = () => ownMinutes(),
}) {
  /** AUDIT 39 (#21): every DFU consumer of this number reads
   *  PlayerGPS.CurrentRegionIndex AT THE MOMENT it acts - the crime,
   *  the surrender, the sentence - so a host that can travel hands a
   *  getter and the read stays live. A plain number is still accepted
   *  (the single-location probe host has nowhere to travel to). */
  const region = () => (typeof regionIndex === 'function' ? regionIndex() : regionIndex);

  const text = (id, fallback) => {
    const v = townTalk.texts(id);
    return v?.length && v[0] ? v : [fallback];
  };

  // ---- ROAD-B B5: THE COURTROOM BACKDROP ----
  //
  // DaggerfallCourtWindow is ONE window that OPENS on CORT01I0 (Setup
  // :75-84) and pushes every box of the trial OVER itself
  // (DaggerfallUI.MessageBox -> uiManager.PushWindow). The port used
  // townTalk's single overlay slot, so each box REPLACED the last and
  // there was never a courtroom behind any of them - the FLAG
  // ui/prisonScreen.js carried in so many words until B1 landed the
  // stack.
  //
  // Two doors, because DFU has two moments: the FIRST box is a real
  // PushWindow onto the live court window, and each LATER box is
  // DFU's own `sender.CloseWindow(); MessageBox(next);` - a
  // one-level replacement that leaves the backdrop beneath, which is
  // exactly what townTalk.showOverlay does now.
  let courtScreen = null;
  /** AUDIT DISC28 AR-1: THE TRIAL UNDER WAY, as a token - the windows it has put up, and the one thing every step it
   *  armed (a plea's answer, the verdict box's close, the prison's end and its close) asks before it acts: is my trial
   *  still the one standing? A load ends it (`abandon`, below) without running it to its release, and a step armed for
   *  a trial that is no longer standing does nothing at all - the boxes it drains and the keys that reach them before
   *  the drain act on no game. Null between trials. */
  let trial = null;
  /** A window the trial puts up, remembered so `abandon` can take it down. */
  const own = (win) => { trial?.windows.add(win); return win; };
  /** A step of the trial now standing: it runs only while that same trial stands. */
  const step = (fn) => { const t = trial; return (...args) => (t && trial === t ? fn(...args) : undefined); };
  function openCourtScreen() {
    courtScreen = own(new CourtScreenWindow());
    townTalk.showOverlay(courtScreen);
  }
  /** One box of the trial, over the courtroom. */
  function courtBox(win, onClosed = null) {
    own(win);
    if (courtScreen && townTalk.overlay === courtScreen) townTalk.pushOverlay(win, onClosed);
    else townTalk.showOverlay(win, onClosed);
  }
  /** State 100's tail: ReleaseFromPrison ends in CancelWindow (:490),
   *  which pops the court window itself. The flag is enough - townTalk's
   *  frame drains a `done` overlay every tick, and the backdrop is not
   *  the top until the last box has popped off it, so the courtroom
   *  goes exactly one frame after the final box and not before. The
   *  reference is KEPT: the terminal arms call release() BEFORE they
   *  show their box (the AUDIT 21/26/39 ordering), and courtBox still
   *  has to know that box is the first one over the backdrop. */
  function closeCourtScreen() { if (courtScreen) courtScreen.done = true; }

  function crimeId() {
    const c = playerEntity.crimeCommitted;
    return typeof c === 'string' ? (CRIMES[c] ?? 0) : (c ?? 0);
  }

  /** The guard-hit interception. Returns true when the hit was
   *  WITHHELD (the surrender box owns the moment).
   *
   *  MOD (player report, online mode): WINFOE1 runs every guard's
   *  clock on the frame's real dt regardless of any window this
   *  client has open - which is right for a fight (an inventory tab
   *  must not stop a swing), but the surrender box, and every later
   *  court box, are not a fight the player is choosing to pause: they
   *  are THIS interception's own moment. Online other clients' guards
   *  are real, server-clocked actors that don't know a local Y/N box
   *  is up, and offline the watch keeps WINFOE1's clock too (JAIL-HIT,
   *  below), so without this a guard can land several more full-damage hits
   *  while the player is still reading the box - and once accepted,
   *  through the whole court sequence below (verdict, sentencing),
   *  the player can still be standing in the street. `awaitingSurrenderAnswer`
   *  covers the box itself; `playerEntity.arrested` (set the instant
   *  startCourtFlow runs, cleared by clearArrest on every exit) covers
   *  everything after. Choosing "N - fight on" drops the flag and the
   *  ORIGINAL blow (the one that opened the box) lands via
   *  `applyDamage` exactly as DFU's "No lands the damage" always did;
   *  every guard swing that landed WHILE the box was up is simply
   *  never delivered, not queued for later. */
  let awaitingSurrenderAnswer = false;
  /** DISC28-B: the surrender box while it stands unanswered, so a cleared crime can withdraw it. */
  let surrenderBox = null;

  /**
   * ARREST-SHIELD (2026-09-22, Revverie: "when guards come to arrest
   * you and you go to trial, you still can die ... idk if a guard
   * continue to aggro me or if it was a bandit of sorts ... the game
   * ... just froze and I had to kill it"): THE QUESTION, ONCE.
   *
   * The clause below was written for a GUARD and it was right about
   * the situation and too narrow about the attacker. Online the court
   * sequence cannot pause the world (WORLD5: the clock is the room's),
   * so the boxes are read standing in the open street - and a town's
   * foes hunt every player in the cell (WORLD6b-ii). A bandit's blow,
   * a spell, a fall, drowning: none was a guard, so none was withheld,
   * and a death inside the court sequence puts a death screen and a
   * modal trial on one window. That is the freeze in the report.
   *
   * So the predicate is named and the ONE player damage door consults
   * it (characters/playerEntity.js registerPlayerDamageVeto), which is
   * the same shape as the shield pool that already sits there. A
   * second copy of "am I in a trial" is a second chance to disagree
   * with the first, so `onGuardHit` reads THIS and nothing of its own.
   *
   * JAIL-HIT (2026-09-27, Discord: "Guards will still chase you down
   * and kill you, even if you have already been to prison for the
   * crime committed"). The shield was ONLINE-only on the belief that
   * offline the court "already reads as a pause" - true in DFU, whose
   * surrender box and court are pushed windows that stop the world
   * (UserInterfaceManager.cs:183-184) until ReleaseFromPrison clears
   * the crime (DaggerfallCourtWindow.cs:482-491), and false here since
   * WINFOE1 put the watch on the frame's clock under any window. So
   * offline the watch swung through the trial and the prison days: a
   * blow on the surrender's 1 health killed the player inside the
   * court, or forced a SECOND surrender whose court replaced the prison
   * screen and its release - the crime never cleared and the watch
   * hunted on. The trial is DFU's paused window in both modes now.
   */
  const inCourt = () => awaitingSurrenderAnswer || !!playerEntity.arrested;
  registerPlayerDamageVeto(inCourt);

  /** REP2: A CRIME IS CHARGED ONCE PER CHASE. DFU's surrender box - the one caller of LowerRepForCrime - is re-armed
   *  whenever no watchman stands (cityGuards.js, PlayerEntity.cs:533-537), so a criminal who outran one wave paid the
   *  whole charge again to the next: a Murder fled twice was -60. The charge is the crime's now, once, until the crime
   *  clears (cityGuards.js clears `chargedCrime` with it); a WORSE crime committed in the chase is charged as itself. */
  function chargeOnce() {
    if (playerEntity.chargedCrime === crimeId()) return;
    playerEntity.chargedCrime = crimeId();
    lowerRepForCrime(playerEntity, region(), crimeId());
  }

  /** WATCH-KNOWS: the watch's warning, in its words. @param {number} crime @param {string} name */
  function warningLines(crime, name) {
    return [`Hold! ${CRIME_NAMES[crime] ?? 'That'} is against the law of ${name}.`, 'This once, you have a warning. The next time, it is the court.'];
  }

  function onGuardHit(dmg, applyDamage, { guardLevel = null } = {}) {
    if (crimeId() === 0) return false;
    if (inCourt()) return true;
    // WERE-FRIGHT: a transformed lycanthrope is halted like anyone - the same one moment, the same reputation lost
    // for the crime - but it is never asked to surrender; it may roar instead (beastHaltBox, below). `guardLevel` is
    // the striking watchman's, for the roll.
    const beast = isTransformedLycanthrope(playerEntity);
    // WATCH-KNOWS: THE FIRST MINOR OFFENCE IS WARNED - the living world's watch, come for a minor crime the character has
    // never been warned for in this region (no known criminal), halts them with a word instead of the box: the crime
    // charged as the box would (chargeOnce), the warning noted, the crime let go - and the watch walks off with it
    // (cityGuards.js's crime-clear law). The next minor offence there is the box's. The blow is withheld.
    if (!beast && !playerEntity.haveShownSurrenderDialogue && warnsFirst() && warningDue(playerEntity, region(), crimeId(), { ownNow: ownMinutes(), worldNow: worldNow() })) {
      const crime = crimeId();
      chargeOnce();
      noteWarning(playerEntity, region(), ownMinutes());
      setCrimeCommitted(playerEntity, 0);
      townTalk.showOverlay(new ChoiceWindow({ lines: warningLines(crime, regionName(region())) }));
      return true;
    }
    if (!playerEntity.haveShownSurrenderDialogue) {
      playerEntity.haveShownSurrenderDialogue = true;
      chargeOnce();
      awaitingSurrenderAnswer = true;
      // DISC28-B: the question is about THIS crime. Online the world runs under the box (WORLD5), so the crime can
      // clear while it stands - the guard's blow lands as the travel map commits, and the arrival clears the crime
      // (PostFastTravel, world.js) with the box still up. An answer read after that is a surrender to nothing: Y used
      // to march the player into a court with no crime. The answer re-reads the crime, and crimeCleared() below
      // withdraws the question the moment the crime goes - DFU cannot reach either, its box pauses the world.
      // AUDIT DISC28 AR-1: and a WITHDRAWN question answers nothing. The box is withdrawn (withdrawQuestion, below: a
      // cleared crime, or a load) by being marked done, and it drains on the next frame - a key, or the enhanced
      // dialog's button, that reaches it before then must not surrender a character the box never asked (a load's,
      // wanted for a crime of its own) nor land the departed guard's blow on them.
      const box = beast ? beastHaltBox(() => box, applyDamage, guardLevel) : new ChoiceWindow({
        lines: text(TEXT_SURRENDER, 'Halt! You are under arrest. Do you surrender?'),
        options: [
          { code: 'KeyY', label: 'Y - surrender', action: () => {
            if (surrenderBox !== box) return;
            awaitingSurrenderAnswer = false;
            if (crimeId() === 0) return;
            // WERE-FRIGHT: the question was a man's, and the answer is the beast's - a change while it stood (online
            // the moon's round runs under it) cannot walk into court; it fights, as a beast must
            if (isTransformedLycanthrope(playerEntity)) { applyDamage(); return; }
            if (surrenderToCityGuards(playerEntity, region(), true, { setHealth1: () => { playerEntity.health = 1; } })) startCourtFlow();
          } },
          { code: 'KeyN', label: 'N - fight on', action: () => { if (surrenderBox !== box) return; awaitingSurrenderAnswer = false; if (crimeId() !== 0) applyDamage(); } },
        ],
      });
      // JAIL-HIT: the question is the box's. A box thrown away unanswered - another window REPLACED it, and
      // townTalk.showOverlay disposes the outgoing - ends the question with it: a flag left standing would withhold
      // every blow for the rest of the session, offline now as online
      box.dispose = () => { if (!box.done) awaitingSurrenderAnswer = false; if (surrenderBox === box) surrenderBox = null; };
      surrenderBox = box;
      townTalk.showOverlay(box);
      return true;
    }
    // Shown before: a fatal blow forces the surrender attempt - a man's. WERE-FRIGHT: a beast cannot surrender, so
    // the blow that would kill it lands.
    if (!beast && playerEntity.health <= dmg) {
      const accepted = surrenderToCityGuards(playerEntity, region(), false, { setHealth1: () => { playerEntity.health = 1; } });
      if (accepted) { startCourtFlow(); return true; }
    }
    return false;
  }

  /**
   * WERE-FRIGHT (2026-09-29, Mac: "being a werewolf has a different interaction with guards ... you cannot
   * surrender, but instead a chance to frighten"): THE BEAST'S HALT. The surrender question's own box in every way
   * but its answers - it withholds the blow while it stands, a load or a cleared crime withdraws it, and it is shown
   * once a watch - and its answers are the beast's: F roars at the watch, N fights on.
   *
   * The roar (Mac's picks, of the options offered): the strain's bark is heard, and `frightenChance` is rolled on the
   * beast's level against the striking guard's. Frightened, the watch gives the beast up entirely - the crime is
   * forgotten and every watchman the host has runs (`watchFlees`). Unafraid, it stands its ground and the blow the
   * question withheld lands, exactly as N lands it. `box` is read through a getter because the window must exist
   * before its answers can ask whether it is still the question standing.
   */
  function beastHaltBox(boxOf, applyDamage, guardLevel) {
    return new ChoiceWindow({
      lines: [...BEAST_HALT_LINES],
      options: [
        { code: 'KeyF', label: 'F - frighten', action: () => { if (surrenderBox !== boxOf()) return; awaitingSurrenderAnswer = false; if (crimeId() !== 0) roarAtTheWatch(applyDamage, guardLevel); } },
        { code: 'KeyN', label: 'N - fight on', action: () => { if (surrenderBox !== boxOf()) return; awaitingSurrenderAnswer = false; if (crimeId() !== 0) applyDamage(); } },
      ],
    });
  }

  /** WERE-FRIGHT: the roar and its roll. Answers whether the watch fled. AUDIT WERE-FRIGHT F2: the roar is the FORM's,
   *  read at the answer as the man's Y reads it - online the change can end under the box, and a man has no roar: he
   *  fights (the blow lands, as N lands it), his crime untouched and the watch unrouted. */
  function roarAtTheWatch(applyDamage, guardLevel) {
    if (!isTransformedLycanthrope(playerEntity)) { applyDamage(); return false; }
    const roar = frightenRoar(playerEntity);
    if (roar != null) playSound(roar);
    const chance = frightenChance(playerEntity.level, guardLevel ?? playerEntity.level);
    if (rolls() * 100 < chance) {
      // The crime is forgotten through the one setter (V4) - transformed, it writes None whatever it is handed. The
      // watch does NOT walk away on that alone: GUARD1's fourth clause keeps it standing while the player is a beast
      // (cityGuards update), so the host sends it running.
      setCrimeCommitted(playerEntity, 0);
      watchFlees();
      say(BEAST_FRIGHTENED_TEXT);
      return true;
    }
    say(BEAST_STOOD_TEXT);
    applyDamage();
    return false;
  }

  // audit 2026-08-17c: the court records carry %pcn/%cri/%pen (the
  // probe showed them raw on screen) - expand per MacroHelper: the
  // crime name table, the Regular_Punishment_String with the live
  // fine/days, the player's full name.
  // AUDIT 18 F2: every court box is built with SetTextTokens, and
  // DaggerfallMessageBox.SetTextTokens defaults expandMacros = true
  // (DaggerfallMessageBox.cs:432-438), so DFU runs MacroHelper over
  // ALL of them - 8055 (%dip), 8062 (%pcn) and 8063 (%pcn, %cn) went
  // out raw here. %cn is MacroHelper.CityName (:566-573): the current
  // location, or the region name when there is no location.
  function courtLines(id, fallback, court) {
    return text(id, fallback).map((line) => courtMacros(line, court));
  }

  function courtMacros(t, court) {
    // %pcn is the player's FULL NAME - always set post-chargen in DFU.
    // Pre-chargen (the exterior hosts today) it is unset; collapse the
    // ", %pcn," appositive so the line reads "You are accused..."
    // instead of "You, , are..." - reachable only pre-chargen now
    // (chargen runs in every host and writes the name; AUDIT 23).
    const name = playerEntity.name ?? '';
    if (!name) t = t.replace(/,\s*%pcn\s*,/g, '');
    // MH1: the court record rides the ONE walk with its value map -
    // %cri/%pen/%gtp/%dip are MacroHelper's own court symbols.
    return expandMacroValues(t, {
      pcn: name,
      cri: CRIME_NAMES[crimeId()] ?? 'None',
      pen: penaltyText(court),
      cn: townTalk.locationName ?? '',
      gtp: String(court.fine),
      dip: String(court.daysInPrison),
    });
  }

  function startCourtFlow() {
    // JAIL-HIT: one trial at a time - DFU's court is a modal window, so nothing reaches a second surrender while one
    // stands; a nested court here would replace the first's screen and drop its release
    if (playerEntity.arrested) return;
    // AUDIT REP F1: THE COURT CHARGES THE CRIME IT TRIES. The surrender box charges the crime it asks about - but the
    // fatal blow's surrender (and a Y read after the world moved under the box) takes the player to court for the crime
    // held NOW, which can be a worse one committed after the box: a townsperson murdered in the chase was tried, never
    // charged, and its sentence CREDITED (DFU +9, REP2's mark +10) - a murder that raised the name. Charged once, here,
    // before startCourt prices the fine off the standing the charge leaves (DFU's order: the loss, then the court).
    if (crimeId() !== 0) chargeOnce();
    // DISC28-B (Discord: "the game locks up if guards hit you the moment you fast travel"): the trial is read BEFORE
    // anything is armed. DFU's court closes itself when no crime is assigned (DaggerfallCourtWindow.cs:109-114) and its
    // OnPop (:432-438) clears Arrested - so a court over no crime is no court at all. The port set `arrested`, opened
    // the modal courtroom and THEN asked startCourt, whose null was dereferenced by the plead box: the throw left a
    // courtroom with no box and `arrested` standing, which is every damage veto on and nothing that can close it.
    const court = startCourt(playerEntity, region(), crimeId(), { rolls });
    if (!court) return;
    trial = { windows: new Set() };   // AUDIT DISC28 AR-1: this trial's token - its windows and its steps are its own
    // PlayerEntity.CourtWindow (:2341) sets `arrested` immediately before
    // the court window opens, and DaggerfallCourtWindow.OnPop (:435)
    // clears it. Its ONE consumer is the music: SongManager checks
    // `arrested` FIRST in AssignPlaylist and it overrides the environment
    // entirely, so the court has its own song. The flag existed nowhere in
    // the port, which left CourtSongs unreachable.
    playerEntity.arrested = true;
    onCourtScreen();
    // Setup runs before any box: the courtroom is up first, and
    // RaiseOnCourtScreenEvent (:86) fires from inside it - which is
    // the line above, kept where it already stood.
    openCourtScreen();
    // CR1: the guild rescue arms (DaggerfallCourtWindow.cs:177-221),
    // BEFORE the plead box - a rescued player never pleads. The exit
    // is the acquittal's own trio (:191-193): FillVitalSigns,
    // RaiseReputationForDoingSentence, then state 100's release.
    const rescue = guildRescue(court, { guildRankOf, roll: rolls });
    if (rescue) {
      // (:191-193) FillVitalSigns, RaiseReputationForDoingSentence,
      // state = 100 - and state 100 with InPrison false is
      // ReleaseFromPrison. The release used to be `clearArrest()`
      // ABOVE this pair, which cost nothing while release was only a
      // clock jump; now that it carries ClearEnemies and the
      // reposition, the order is the law's. WITHOUT the reposition:
      // this is the ONE arm that never sets repositionPlayer.
      fillVitalSigns(playerEntity);
      raiseRepForSentence(playerEntity, court);
      release({ reposition: false });
      courtBox(new ChoiceWindow({
        lines: courtLines(rescue.textId, 'Your guild has arranged your release.', court),
      }));
      return;
    }
    courtBox(new ChoiceWindow({
      lines: [courtMacros(text(TEXT_COURT_START, 'You stand accused. How do you plead?')[0] ?? '', court)],
      options: [
        { code: 'KeyG', label: 'G - guilty', action: step(() => finish(pleaGuilty(court, playerEntity), court)) },
        { code: 'KeyN', label: 'N - not guilty', action: step(() => notGuilty(court)) },
      ],
    }));
  }

  function notGuilty(court) {
    courtBox(new ChoiceWindow({
      lines: text(TEXT_HOW_CONVINCE, 'How will you convince the court?'),
      options: [
        { code: 'KeyD', label: 'D - debate (Etiquette)', action: step(() => verdict(court, true)) },
        { code: 'KeyL', label: 'L - lie (Streetwise)', action: step(() => verdict(court, false)) },
      ],
    }));
  }

  function verdict(court, useDebate) {
    const r = pleaNotGuilty(court, playerEntity, useDebate, { rolls });
    if (r.outcome === 'free') {
      // AUDIT 26 F038: the acquittal calls FillVitalSigns explicitly
      // (DaggerfallCourtWindow.cs:191) - a FULL refill of all three
      // pools. Surrender forces health to 1 (PlayerEntity.cs:2321,
      // the setHealth1 hook above), so without this the acquitted
      // player walked out of court on exactly 1 HP.
      fillVitalSigns(playerEntity);
      // AUDIT 17e F22: DFU raises reputation on a successful defense
      // (DaggerfallCourtWindow.cs:426) - and says so against classic
      // in its own comment two lines up ("Also does not repair
      // reputation"). We port DFU. REP2: and an acquittal gives the WHOLE charge back - no crime found, no mark.
      raiseRepForSentence(playerEntity, court, { acquitted: true });
      // AUDIT 21 F2: including `arrested`. The bare clearArrest() used
      // to run ABOVE the pair; DFU's free arm ends `state = 6` (:427),
      // and state 6 is `repositionPlayer = true; state = 100` (:292-296)
      // - so the acquitted player IS put down at the entrance, after
      // the refill and the reputation, not before.
      release();
      courtBox(new ChoiceWindow({ lines: courtLines(TEXT_FREE_TO_GO, 'The court finds you not guilty. You are free to go.', court) }));
      return;
    }
    if (r.outcome === 'banished') { finish({ outcome: 'banished' }, court); return; }
    courtBox(new ChoiceWindow({ lines: courtLines(TEXT_FOUND_GUILTY, 'The court finds you guilty.', court) }),
      step(() => finish(resolveGuiltyVerdict(court, playerEntity), court)));
  }

  function finish(result, court) {
    if (result.outcome === 'banished') {
      // AUDIT 17e F22: state 4 (Banished) does NOT call
      // RaiseReputationForDoingSentence (DaggerfallCourtWindow.cs:263-278)
      // - being run out of the region repairs nothing.
      // REP3 (Mac: "Timed or pardoned"): the bit DFU sets, and its term - thirty days of the world's calendar, or a
      // pardon bought at a temple (systems/standing.js). DFU's bit alone was for ever.
      banish(playerEntity, region(), trustedWorldMinutes());   // AUDIT REP F2: an unheard relay stamps no term - the first trusted read does
      // ":276 - Refill player vitals after banishment, otherwise player
      // left with 1HP outside city gates", DFU's own comment.
      fillVitalSigns(playerEntity);
      release();
      courtBox(new ChoiceWindow({ lines: courtLines(TEXT_BANISHED, 'You are banished from this region.', court) }));
      return;
    }
    if (result.outcome === 'executed') {
      // State 5 (:280-291); state 6 (:292-296) then sets
      // repositionPlayer, which is the same reposition the banishment
      // arm sets at :273 - both land through release() below. NO
      // FillVitalSigns here - state 5 is the one exit DFU does not
      // refill. UNREACHABLE
      // - startCourt cannot mint a 1 - but present, so it cannot be
      // mistaken for verified. See court.js F7.
      severePunishment(SEVERE_PUNISHMENT_EXECUTED);
      release();
      courtBox(new ChoiceWindow({ lines: courtLines(TEXT_EXECUTED, 'You have been executed.', court) }));
      return;
    }
    if (result.outcome === 'prison') {
      // STATE 3 (DaggerfallCourtWindow.cs:254-262), line for line:
      //     playerEntity.InPrison = true;
      //     SwitchToPrisonScreen();
      //     daysInPrisonLeft = daysInPrison;
      //     playerEntity.RaiseReputationForDoingSentence();
      //     repositionPlayer = true;
      //     state = 100;
      // and NOTHING else. The days do not pass here. The port used to
      // credit the sentence, jump the clock, refill and release in one
      // breath behind a "You serve N days in prison." line of text -
      // which is the RESULT of the sequence with the sequence itself
      // deleted. Classic sits you in front of PRIS00I0 and counts the
      // days down at one every 0.3s; that is the window below, and the
      // clock jump is its LAST tick, not its first.
      //
      // InPrison is what tells state 100 which arm to run: while it is
      // set, the countdown ticks; the update that clears it releases.
      playerEntity.inPrison = true;
      // DFU's ORDER, which the port had backwards. State 3 credits the
      // sentence (:259) and only THEN does the countdown elapse the days
      // (:475) - and it sets PreventNormalizingReputations across the skip
      // precisely so the elapsed days cannot decay what it just credited.
      // Harmless while NormalizeReputations was unported; not harmless now
      // that it is.
      raiseRepForSentence(playerEntity, court);
      const days = result.days;
      // SwitchToPrisonScreen (:511-524). DFU swaps the background on
      // the court window itself; the port lays the prison panel at the
      // SAME stack level (showOverlay's one-level replacement), so the
      // found-guilty box it replaces is gone and the courtroom is still
      // underneath. Same screen, a different owner - named in
      // ui/prisonScreen.js's header.
      townTalk.showOverlay(own(new PrisonScreenWindow({
        daysInPrison: days,
        localizedText,
        speedUp: backButtonHeld,
        // UpdatePrisonScreen's zero arm (:471-479), in ITS order:
        // both prevent flags, THEN the one RaiseTime of the whole
        // sentence, then InPrison clears and the vitals refill.
        onEndPrisonTime: step(() => {
          // AUDIT 24 (the seven-slice sweep) put the normalizing flag
          // here; :473 is its twin, and the twin had no port at all.
          // The catch-up spawn loop reads it (encounters.js's
          // intermittentEnemySpawn, and the host loop that wraps it),
          // so without it a thirty-day sentence rolled thirty days of
          // encounters onto the courthouse steps the moment the door
          // opened.
          playerEntity.preventEnemySpawns = true;
          playerEntity.preventNormalizingReputations = true;
          advanceDays(days);
          // AUDIT 63 F13: RaiseOnEndPrisonTimeEvent (:476), which comes
          // straight after that RaiseTime (:475) and whose ONE
          // subscriber is the broker raising SyntheticTimeIncrease
          // (EntityEffectBroker.cs:841-842). The order is DFU's own and
          // costs nothing either way here: advanceDays moves the clock
          // without running a round, so the sentence's window is
          // claimed by the next host frame - which is also the frame
          // that carries release()'s four hours (ReleaseFromPrison's
          // own RaiseTime, :485, is the SAME DFU frame and is
          // deliberately not shielded on its own: a zero-day plea or an
          // acquittal runs its 240 minutes of rounds in full).
          setSyntheticTimeIncrease(true);
          playerEntity.inPrison = false;
          // (:478) the refill lands when daysInPrisonLeft hits 0,
          // AFTER the RaiseTime - the day the sentence ends, not the
          // day it began.
          // AUDIT WORLD5 C9 withheld the refill online because the sentence
          // served no days there, and DEATHLOOP1 then put a floor under it
          // (trashBattery, 2026-09-22: arrested while dying of a fall, let
          // out dead into a deathloop). LIVED1: the days are served online
          // too - on the prisoner's own clock, advanceDays above - so the
          // refill is their price again, as DFU pays it, in both lanes; the
          // floor it replaced is inside the refill (a full pool is above it).
          fillVitalSigns(playerEntity);
        }),
      // The window closes into state 100 with InPrison false, which is
      // ReleaseFromPrison (:318) - and repositionPlayer was set back
      // at :260, so the release puts the player at the entrance.
      })), step(() => release()));
      return;
    }
    // AUDIT 18 F6: NO box here. The zero-days arms - the guilty plea
    // (DaggerfallCourtWindow.cs:340-348) and state 2's own release
    // (:243-250) - both go straight to RaiseReputationForDoingSentence
    // + FillVitalSigns + ReleaseFromPrison with nothing pushed. 8055
    // (courtTextFoundGuilty) is raised from state 2 ONLY (:232-240),
    // which a guilty PLEA never reaches; pushing it here both invented
    // a "sentenced to 0 days in prison" record on the plea path and
    // showed 8055 TWICE on the failed-defense path.
    //
    // AUDIT 39 F98: both of those arms DO refill - :249 on state 2 and
    // :347 on the plea, where DFU names the divergence it is fixing
    // ("Oversight in classic: Does not refill vital signs when
    // releasing in this case, so player is left with 1 health").
    fillVitalSigns(playerEntity);
    release();
  }

  /** DaggerfallCourtWindow's two severe-punishment writes: state 4
   *  (Banished) `RegionData[regionIndex].SeverePunishmentFlags |= 1`
   *  (:272) and state 5 (Execution) `|= 2` (:289). Bit 1 is not a
   *  record - PlayerEntity.cs:506-511 reads it every catch-up minute
   *  and rolls a 10% Criminal_Conspiracy guard spawn in that region
   *  for ever after, which is the whole cost of being banished. (REP3:
   *  bit 1 is written by systems/standing.js banish, with its term, and
   *  DFU's roll has no caller since REP1 - AUDIT REP F6; this writes
   *  bit 2 alone.)
   *  A host whose region store is absent writes nothing rather than
   *  minting one - DFU's RegionData is allocated at chargen.
   *
   *  AUDIT-39r: through region(), like every other consumer. DFU reads
   *  regionIndex live (DaggerfallCourtWindow.cs:118) and the streaming
   *  host hands this flow a getter, so keying the store by the raw
   *  parameter indexed it by a Function and both bits no-oped exactly
   *  where fast travel makes banishment reachable. */
  function severePunishment(bit) {
    const r = playerEntity.regionConditions?.[region()];
    if (r) r.severePunishmentFlags |= bit;
  }

  /** OnPop (DaggerfallCourtWindow.cs:427-441). EVERY court exit funnels
   *  through it in DFU - guilty, acquitted, banished alike - which is why
   *  the flags live here and not on one arm.
   *
   *  AUDIT 21 F2: the acquittal arm used to clear the crime INLINE and
   *  never come through here, so `arrested` stayed set for the rest of
   *  the session. Its one consumer is the music, and AssignPlaylist tests
   *  it FIRST, so winning your case left court music playing over
   *  everything, forever. */
  function clearArrest() {
    // AUDIT 21 F8: RaiseTime(240 * 60) - FOUR HOURS - and it belongs HERE,
    // not on the prison arm. ReleaseFromPrison is reached from state 100,
    // and EVERY exit funnels through state 100: the guilty plea, the state-2
    // verdict, banishment (:277) and the acquittal (:425-427 -> state 6 ->
    // state 100) alike. It is the mechanism by which the guards are gone and
    // the afternoon has moved when you step back outside, and the prison
    // day-skip does not cover it - a zero-day plea still costs four hours.
    //
    // ReleaseFromPrison opens with PreventEnemySpawns (:484) and the
    // RaiseTime is the SECOND line, not the first. Four hours of
    // suppressed catch-up: the release itself is a clock jump, and DFU
    // shields every one of them.
    playerEntity.preventEnemySpawns = true;
    advanceMinutes(RELEASE_MINUTES);
    playerEntity.arrested = false;
    playerEntity.crimeCommitted = 0;   // ReleaseFromPrison: the crime clears; guards despawn on the crime-clear law
    playerEntity.chargedCrime = 0;     // REP2: the chase is over with it
    playerEntity.watchSlain = false;
    playerEntity.haveShownSurrenderDialogue = false;
    grantGrace(playerEntity, region(), ownMinutes());   // REP1: a day's grace from the watch's stops - the law is answered
    playerEntity.inPrison = false;     // OnPop (:438) - the flag never outlives the window
  }

  /** Leaving CUSTODY. ReleaseFromPrison (:482-490) does not touch
   *  health at all, so the clamp below is the port's own safeguard
   *  against walking out at 0 HP and nothing more.
   *
   *  THE REFILL BELONGS TO THE ARMS, NOT HERE. FillVitalSigns is a
   *  FULL refill - health, fatigue and magicka to their maxima
   *  (DaggerfallEntity.cs:442-447) - and DFU calls it from every court
   *  exit EXCEPT the execution: the acquittal (:191), the guild rescue
   *  (:213), state 2's zero-day release (:249), banishment (:276), the
   *  guilty plea's zero-day arm (:347) and the end of a prison
   *  sentence (:478). AUDIT 39 F98: four of those six were missing
   *  here, and surrender forces health to 1, so a player who pleaded
   *  guilty, lost their case, served their days or was banished walked
   *  back outside on exactly 1 HP with fatigue and magicka untouched.
   *
   *  THE REPOSITION IS NOT UNIVERSAL. `repositionPlayer` is set by the
   *  arms that put you back on the street - state 2's zero-day release
   *  (:248), the prison sentence (:260), banishment (:273), state 6
   *  after an acquittal or an execution (:294) and the guilty plea's
   *  zero-day arm (:345) - and the GUILD RESCUE is the one exit that
   *  never sets it (:191-194 goes straight to state 100). A rescued
   *  member walks out of the courthouse where they stood; everyone
   *  else is put down at the location entrance. */
  function release({ reposition = true } = {}) {
    clearArrest();
    // ReleaseFromPrison ends in CancelWindow (:490) - the court window
    // itself pops. EVERY court exit funnels through release(), which is
    // why the courtroom is closed here and not on one arm.
    closeCourtScreen();
    // ReleaseFromPrison's tail, in ITS order (:487-489): the
    // reposition FIRST, then ClearEnemies - so the sweep runs in the
    // world the player has just landed in, not the one they left.
    if (reposition) positionPlayerAtLocationEntrance();
    clearEnemies();
    playerEntity.health = Math.max(1, playerEntity.health);   // the port's own floor, not DFU's
  }

  /** ARREST-SHIELD: a host that tears this flow down takes its veto
   *  with it - a stale closure over a dead entity must never shield a
   *  live one. */
  function dispose() { registerPlayerDamageVeto(null); }

  /** THE QUESTION WITHDRAWN, one home for the two doors that end it with no answer - a cleared crime
   *  (`crimeCleared`) and a load (`abandon`). The box is closed the way an answer closes it (`done`, drained by
   *  townTalk's frame), its two arms answer nothing from here on (AUDIT DISC28 AR-1's guard in onGuardHit), and the
   *  damage veto it held drops now: a question nobody can usefully answer must not keep the player unhittable. */
  function withdrawQuestion() {
    const box = surrenderBox;
    surrenderBox = null;
    awaitingSurrenderAnswer = false;
    if (box) box.done = true;
  }

  /** DISC28-B: the crime a standing surrender question asks about is gone (the fast-travel arrival clears it,
   *  world.js) - the question goes with it. A trial already under way is not a question and is left to its own
   *  release. */
  function crimeCleared() {
    if (crimeId() !== 0 || !surrenderBox) return;
    withdrawQuestion();
  }

  /**
   * AUDIT DISC28 AR-1: A LOAD ENDS THE ARREST IT DID NOT SAVE.
   *
   * DFU never loads under the court: InputManager.Update returns before it reads any action while a window pauses
   * the game - the surrender box and DaggerfallCourtWindow both do - and admits QuickLoad there only while
   * PlayerDeath.DeathInProgress. The port takes a load from under any window (world.js's FIX-E arm: the death
   * screen's F11 is every host's), so the flow has to be told. Offline, F11 under the plea box carried the trial into
   * the loaded game: `arrested` stood, the old sentence was served on the loaded clock, and its release cleared the
   * loaded save's own crime. Under the surrender box it asked the loaded character the departed guard's question.
   *
   * So the question is withdrawn and the trial ends the way DaggerfallCourtWindow.OnPop ends one - Arrested and
   * InPrison false, the court's windows closed - and NOTHING of ReleaseFromPrison runs: no RaiseTime, no crime
   * cleared, no PositionPlayerAtLocationEntrance, no ClearEnemies. Those belonged to the game that was replaced; the
   * loaded one keeps its own clock, crime and place. The windows are marked done and drain on townTalk's frame; the
   * trial's steps (the plea's answers, the verdict box's close, the prison's end and its close) no longer belong to
   * the trial standing, so what drains - or a key that reaches a box before it drains - acts on nothing.
   */
  function abandon() {
    withdrawQuestion();
    const t = trial;
    trial = null;
    for (const win of t?.windows ?? []) win.done = true;
    courtScreen = null;
    playerEntity.arrested = false;   // OnPop
    playerEntity.inPrison = false;   // OnPop
    // REP2: and the chase it was part of - the loaded save's own crime is a chase of its own, charged at its first box
    playerEntity.chargedCrime = 0;
    playerEntity.watchSlain = false;
  }
  /** REP1: "come quietly" at the watch's stop - the known criminal surrenders to a Criminal Conspiracy (DFU's own charge
   *  for the levy this stop replaces), charged once, and goes to court as a voluntary surrender does. A crime already
   *  held is the one answered. Answers whether a court opened. AUDIT WERE-FRIGHT F4: never a beast's - the stop is never
   *  made of one (standingHost: nobody's face), and a change under its box (online) leaves the surrender WERE-FRIGHT
   *  denies a beast; the stop lapses with nothing written, charged or tried, as if it had not begun. */
  function surrenderToChallenge() {
    if (inCourt() || isTransformedLycanthrope(playerEntity)) return false;
    if (crimeId() === 0) playerEntity.crimeCommitted = CRIMES.Criminal_Conspiracy;   // the levy's own write (WERE-LEVY: the field)
    playerEntity.haveShownSurrenderDialogue = true;
    chargeOnce();
    if (!surrenderToCityGuards(playerEntity, region(), true, { setHealth1: () => { playerEntity.health = 1; } })) return false;
    startCourtFlow();
    return !!playerEntity.arrested;
  }

  return { onGuardHit, startCourtFlow, inCourt, crimeCleared, abandon, dispose, surrenderToChallenge };
}
