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
// guilty (8055) with the fine roll. Prison serves through the host's
// advanceDays; banishment shows 8063. Release clears the crime (the
// guards despawn on the crime-clear law in cityGuards).

import { expandMacroValues } from '../systems/quest/questMacros.js';   // MH1: the ONE macro walk
import { ChoiceWindow } from '../ui/talkWindow.js';
import {
  CRIMES, CRIME_NAMES, penaltyText, TEXT_SURRENDER, TEXT_COURT_START, TEXT_FOUND_GUILTY,
  TEXT_FREE_TO_GO, TEXT_BANISHED, TEXT_HOW_CONVINCE,
  lowerRepForCrime, surrenderToCityGuards, startCourt, pleaGuilty,
  pleaNotGuilty, resolveGuiltyVerdict, raiseRepForSentence, TEXT_EXECUTED,
  guildRescue,
} from '../systems/court.js';
import { guildOfFaction, membershipOf, activeMemberships } from '../systems/guilds.js';   // CR1: the rescue arms' member reads
import { resolveVariantGuild } from '../systems/guildVariants.js';
import { advanceWorldMinutes, MINUTES_PER_DAY } from '../systems/worldTick.js';
import { fillVitalSigns } from '../systems/statMods.js';   // F038: the acquittal's refill

/** ReleaseFromPrison (DaggerfallCourtWindow.cs:482-491) opens with
 *      DaggerfallUnity.WorldTime.DaggerfallDateTime.RaiseTime(240 * 60);
 *  - four hours, on EVERY release. It is the mechanism by which the guards
 *  are gone and the day has moved when you step back outside. */
export const RELEASE_MINUTES = 240;

// AUDIT 21 F8: `advanceDays` used to default to `() => {}` AND BOTH HOSTS
// CONSTRUCTED THE FLOW WITHOUT IT, so a thirty-day sentence advanced the
// clock by zero - you walked out of court on the same afternoon you walked
// in. The fix is not host wiring: AUDIT 21 F2 gave the port ONE world clock,
// so the flow can move time itself and there is no argument left to forget.
// A host may still pass its own hook (a save-game driver, a test), but the
// default is now the real thing.
export function createArrestFlow({
  townTalk, playerEntity, regionIndex,
  advanceDays = (days) => advanceWorldMinutes(days * MINUTES_PER_DAY),
  advanceMinutes = (m) => advanceWorldMinutes(m),
  rolls = Math.random,
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

  function crimeId() {
    const c = playerEntity.crimeCommitted;
    return typeof c === 'string' ? (CRIMES[c] ?? 0) : (c ?? 0);
  }

  /** The guard-hit interception. Returns true when the hit was
   *  WITHHELD (the surrender box owns the moment). */
  function onGuardHit(dmg, applyDamage) {
    if (crimeId() === 0) return false;
    if (!playerEntity.haveShownSurrenderDialogue) {
      playerEntity.haveShownSurrenderDialogue = true;
      lowerRepForCrime(playerEntity, region(), crimeId());
      townTalk.showOverlay(new ChoiceWindow({
        lines: text(TEXT_SURRENDER, 'Halt! You are under arrest. Do you surrender?'),
        options: [
          { code: 'KeyY', label: 'Y - surrender', action: () => { if (surrenderToCityGuards(playerEntity, region(), true, { setHealth1: () => { playerEntity.health = 1; } })) startCourtFlow(); } },
          { code: 'KeyN', label: 'N - fight on', action: () => applyDamage() },
        ],
      }));
      return true;
    }
    // Shown before: a fatal blow forces the surrender attempt
    if (playerEntity.health <= dmg) {
      const accepted = surrenderToCityGuards(playerEntity, region(), false, { setHealth1: () => { playerEntity.health = 1; } });
      if (accepted) { startCourtFlow(); return true; }
    }
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
    // PlayerEntity.CourtWindow (:2341) sets `arrested` immediately before
    // the court window opens, and DaggerfallCourtWindow.OnPop (:435)
    // clears it. Its ONE consumer is the music: SongManager checks
    // `arrested` FIRST in AssignPlaylist and it overrides the environment
    // entirely, so the court has its own song. The flag existed nowhere in
    // the port, which left CourtSongs unreachable.
    playerEntity.arrested = true;
    const court = startCourt(playerEntity, region(), crimeId(), { rolls });
    // CR1: the guild rescue arms (DaggerfallCourtWindow.cs:177-221),
    // BEFORE the plead box - a rescued player never pleads. The exit
    // is the acquittal's own trio (:191-193): FillVitalSigns,
    // RaiseReputationForDoingSentence, then state 100's release.
    const rescue = court ? guildRescue(court, { guildRankOf, roll: rolls }) : null;
    if (rescue) {
      clearArrest();
      fillVitalSigns(playerEntity);
      raiseRepForSentence(playerEntity, court);
      townTalk.showOverlay(new ChoiceWindow({
        lines: courtLines(rescue.textId, 'Your guild has arranged your release.', court),
      }));
      return;
    }
    townTalk.showOverlay(new ChoiceWindow({
      lines: [courtMacros(text(TEXT_COURT_START, 'You stand accused. How do you plead?')[0] ?? '', court)],
      options: [
        { code: 'KeyG', label: 'G - guilty', action: () => finish(pleaGuilty(court, playerEntity), court) },
        { code: 'KeyN', label: 'N - not guilty', action: () => notGuilty(court) },
      ],
    }));
  }

  function notGuilty(court) {
    townTalk.showOverlay(new ChoiceWindow({
      lines: text(TEXT_HOW_CONVINCE, 'How will you convince the court?'),
      options: [
        { code: 'KeyD', label: 'D - debate (Etiquette)', action: () => verdict(court, true) },
        { code: 'KeyL', label: 'L - lie (Streetwise)', action: () => verdict(court, false) },
      ],
    }));
  }

  function verdict(court, useDebate) {
    const r = pleaNotGuilty(court, playerEntity, useDebate, { rolls });
    if (r.outcome === 'free') {
      clearArrest();                   // AUDIT 21 F2: including `arrested`
      // AUDIT 26 F038: the acquittal calls FillVitalSigns explicitly
      // (DaggerfallCourtWindow.cs:191) - a FULL refill of all three
      // pools. Surrender forces health to 1 (PlayerEntity.cs:2321,
      // the setHealth1 hook above), so without this the acquitted
      // player walked out of court on exactly 1 HP.
      fillVitalSigns(playerEntity);
      // AUDIT 17e F22: DFU raises reputation on a successful defense
      // (DaggerfallCourtWindow.cs:426) - and says so against classic
      // in its own comment two lines up ("Also does not repair
      // reputation"). We port DFU.
      raiseRepForSentence(playerEntity, court);
      townTalk.showOverlay(new ChoiceWindow({ lines: courtLines(TEXT_FREE_TO_GO, 'The court finds you not guilty. You are free to go.', court) }));
      return;
    }
    if (r.outcome === 'banished') { finish({ outcome: 'banished' }, court); return; }
    townTalk.showOverlay(new ChoiceWindow({ lines: courtLines(TEXT_FOUND_GUILTY, 'The court finds you guilty.', court) }),
      () => finish(resolveGuiltyVerdict(court, playerEntity), court));
  }

  function finish(result, court) {
    if (result.outcome === 'banished') {
      // SeverePunishmentFlags |= 1 consequences pend (FLAGGED)
      // AUDIT 17e F22: state 4 (Banished) does NOT call
      // RaiseReputationForDoingSentence (DaggerfallCourtWindow.cs:263-278)
      // - being run out of the region repairs nothing.
      release();
      townTalk.showOverlay(new ChoiceWindow({ lines: courtLines(TEXT_BANISHED, 'You are banished from this region.', court) }));
      return;
    }
    if (result.outcome === 'executed') {
      // State 5 (:280-291). SeverePunishmentFlags |= 2 pends with the rest
      // of the severe-punishment consequences; state 6 then repositions the
      // player at the location entrance, which is the same reposition the
      // banishment arm owes. UNREACHABLE - startCourt cannot mint a 1 - but
      // present, so it cannot be mistaken for verified. See court.js F7.
      release();
      townTalk.showOverlay(new ChoiceWindow({ lines: courtLines(TEXT_EXECUTED, 'You have been executed.', court) }));
      return;
    }
    if (result.outcome === 'prison') {
      // DFU's ORDER, which the port had backwards. State 3 credits the
      // sentence (:259) and only THEN does the countdown elapse the days
      // (:475) - and it sets PreventNormalizingReputations across the skip
      // precisely so the elapsed days cannot decay what it just credited.
      // Harmless while NormalizeReputations was unported; not harmless now
      // that it is.
      raiseRepForSentence(playerEntity, court);
      // AUDIT 24 (the seven-slice sweep): and here is the line the
      // comment above has been describing. UpdatePrisonScreen
      // (DaggerfallCourtWindow.cs:473-474) sets BOTH prevent flags
      // immediately before RaiseTime; worldTick clears this one at the
      // end of the same update, exactly as PlayerEntity.cs:528-530
      // does. Without it a sentence long enough to cross a 112-day
      // boundary normalized away the reputation it had just credited.
      playerEntity.preventNormalizingReputations = true;
      advanceDays(result.days);
      release();
      townTalk.showOverlay(new ChoiceWindow({ lines: [`You serve ${result.days} days in prison.`] }));
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
    release();
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
    // FLAGGED, still owed to their own slices: PreventEnemySpawns across the
    // skip, ClearEnemies, and PositionPlayerAtLocationEntrance.
    advanceMinutes(RELEASE_MINUTES);
    playerEntity.arrested = false;
    playerEntity.crimeCommitted = 0;   // ReleaseFromPrison: the crime clears; guards despawn on the crime-clear law
    playerEntity.haveShownSurrenderDialogue = false;
  }

  /** Leaving CUSTODY - the court exit plus the prison vitals floor. An
   *  acquitted player never went to prison, so they take clearArrest
   *  alone. AUDIT 26 F038: the old note here called the line below
   *  "FillVitalSigns' floor" and said it belonged to release - both
   *  halves were wrong. FillVitalSigns is a FULL refill (health,
   *  fatigue and magicka to their maxima, DaggerfallEntity.cs
   *  :442-447) and DFU calls it on the ACQUITTAL and the Thieves
   *  Guild rescue, never on release: ReleaseFromPrison (:482-490)
   *  does not touch health at all. The clamp below is the port's own
   *  safeguard against walking out of a sentence at 0 HP, kept and
   *  named as such. (The TG rescue's refill rides the guild-rescue
   *  pend with the rest of that branch.) */
  function release() {
    clearArrest();
    playerEntity.health = Math.max(1, playerEntity.health);   // the port's own floor, not DFU's
  }

  return { onGuardHit, startCourtFlow };
}
