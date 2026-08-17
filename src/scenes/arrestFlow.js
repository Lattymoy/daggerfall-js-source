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

import { ChoiceWindow } from '../ui/talkWindow.js';
import {
  CRIMES, TEXT_SURRENDER, TEXT_COURT_START, TEXT_FOUND_GUILTY,
  TEXT_FREE_TO_GO, TEXT_BANISHED, TEXT_HOW_CONVINCE,
  lowerRepForCrime, surrenderToCityGuards, startCourt, pleaGuilty,
  pleaNotGuilty, resolveGuiltyVerdict, raiseRepForSentence,
} from '../systems/court.js';

export function createArrestFlow({ townTalk, playerEntity, regionIndex, advanceDays = () => {}, rolls = Math.random }) {
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
      lowerRepForCrime(playerEntity, regionIndex, crimeId());
      townTalk.showOverlay(new ChoiceWindow({
        lines: text(TEXT_SURRENDER, 'Halt! You are under arrest. Do you surrender?'),
        options: [
          { code: 'KeyY', label: 'Y - surrender', action: () => { if (surrenderToCityGuards(playerEntity, regionIndex, true, { setHealth1: () => { playerEntity.health = 1; } })) startCourtFlow(); } },
          { code: 'KeyN', label: 'N - fight on', action: () => applyDamage() },
        ],
      }));
      return true;
    }
    // Shown before: a fatal blow forces the surrender attempt
    if (playerEntity.health <= dmg) {
      const accepted = surrenderToCityGuards(playerEntity, regionIndex, false, { setHealth1: () => { playerEntity.health = 1; } });
      if (accepted) { startCourtFlow(); return true; }
    }
    return false;
  }

  function startCourtFlow() {
    const court = startCourt(playerEntity, regionIndex, crimeId(), { rolls });
    townTalk.showOverlay(new ChoiceWindow({
      lines: [...text(TEXT_COURT_START, 'You stand accused. How do you plead?'), '', `Fine: ${court.fine} gold  Prison: ${court.daysInPrison} days`],
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
      playerEntity.crimeCommitted = 0;
      playerEntity.haveShownSurrenderDialogue = false;
      townTalk.showOverlay(new ChoiceWindow({ lines: text(TEXT_FREE_TO_GO, 'The court finds you not guilty. You are free to go.') }));
      return;
    }
    if (r.outcome === 'banished') { finish({ outcome: 'banished' }, court); return; }
    townTalk.showOverlay(new ChoiceWindow({ lines: text(TEXT_FOUND_GUILTY, 'The court finds you guilty.') }),
      () => finish(resolveGuiltyVerdict(court, playerEntity), court));
  }

  function finish(result, court) {
    if (result.outcome === 'banished') {
      // SeverePunishmentFlags |= 1 consequences pend (FLAGGED)
      raiseRepForSentence(playerEntity, court);
      release();
      townTalk.showOverlay(new ChoiceWindow({ lines: text(TEXT_BANISHED, 'You are banished from this region.') }));
      return;
    }
    if (result.outcome === 'prison') {
      advanceDays(result.days);
      raiseRepForSentence(playerEntity, court);
      release();
      townTalk.showOverlay(new ChoiceWindow({ lines: [`You serve ${result.days} days in prison.`] }));
      return;
    }
    release();
    townTalk.showOverlay(new ChoiceWindow({ lines: text(TEXT_FOUND_GUILTY, 'The court releases you.') }));
  }

  function release() {
    playerEntity.crimeCommitted = 0;   // ReleaseFromPrison: the crime clears; guards despawn on the crime-clear law
    playerEntity.haveShownSurrenderDialogue = false;
    playerEntity.health = Math.max(1, playerEntity.health);   // FillVitalSigns' floor (full refill pends vitals wiring)
  }

  return { onGuardHit, startCourtFlow };
}
