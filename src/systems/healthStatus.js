// F198 - THE HEALTH STATUS BOX (DaggerfallUI.CreateHealthStatusBox,
// :1631-1703, MIT Daggerfall Workshop). The box the Status action
// chains after the record-22 status text, and the ONLY place the
// player can learn WHICH disease they carry - the daily tick says
// only "You feel somewhat bad."
//
// The decision, verbatim:
//   - no diseases AND no poisons -> record 18, "You are healthy."
//   - each disease whose INCUBATION IS OVER appends its classic
//     contracted message (record 100 + diseaseType); one still
//     incubating shows nothing, which is DFU's own tell-nothing
//     window between the bite and the first symptom day.
//   - "You have been poisoned." (record 117) appends when one or
//     more poisons exist AND at least one has left the Waiting
//     state - a poison still counting minutesToStart is as silent
//     as an incubating disease.
//   - if nothing qualified after all that, record 18 again (the
//     `if (tokens == null)` tail).
//
// ST1: the record-22 STATUS box that precedes this one in DFU's
// DisplayStatusInfo (:1615-1628) is statusInfoRows below. Its text -
// "You are in %cn. / It is %tim on %dat. / In the eyes of the law of
// %crn, / you are %ltn." (Internal_RSC.csv record 22) - is
// macro-heavy, and every producer it needs already lives in the
// quest arc's ONE macro table (questMacros HANDLERS: %cn, %tim,
// %dat, %crn, %ltn), so the expansion goes through
// expandQuestMessage with the machine's quest-shaped macroContext()
// rather than a second expander. DFU chains the two boxes with
// AddNextMessageBox; the port's ActionTextBox.addNext is that chain.

import { diseaseCount, contractedMessageRecord } from './diseases.js';
import { poisonCount } from './poisons.js';
import { expandQuestMessage } from './quest/questMacros.js';

export const STATUS_INFO_ID = 22;   // SetTextTokens(22) (DaggerfallUI.cs:1620)

/** DisplayStatusInfo's first box (:1617-1620): record 22 expanded.
 *  `questLike` is machine.macroContext() - null (a headless host)
 *  leaves each macro as its bracketed placeholder, which is exactly
 *  MacroHelper's own null-MCP posture, never a throw. */
export function statusInfoRows(rows, questLike = null) {
  const tokens = (rows(STATUS_INFO_ID) ?? []).map((text) => ({ text }));
  expandQuestMessage(questLike, tokens);
  return tokens.map((t) => t.text);
}

export const YOU_ARE_HEALTHY_ID = 18;        // youAreHealthyID (:1632)
export const YOU_HAVE_BEEN_POISONED_ID = 117;   // youHaveBeenPoisoned (:1633)

/** CreateHealthStatusBox's row decision. `rows(id)` is the host's
 *  TEXT.RSC reader; answers the box's row list. */
export function healthStatusRows(entity, rows) {
  if (diseaseCount(entity) === 0 && poisonCount(entity) === 0) return rows(YOU_ARE_HEALTHY_ID) ?? [];
  let tokens = null;
  for (const a of (entity?.activeEffects ?? [])) {
    if (a.kind === 'disease' && !a.ended && a.incubationOver) {
      tokens = [...(tokens ?? []), ...(rows(contractedMessageRecord(a.diseaseType)) ?? [])];
    }
  }
  const poisonActive = (entity?.activeEffects ?? [])
    .some((a) => a.kind === 'poison' && !a.ended && a.state !== 'waiting');
  if (poisonCount(entity) > 0 && poisonActive) {
    tokens = [...(tokens ?? []), ...(rows(YOU_HAVE_BEEN_POISONED_ID) ?? [])];
  }
  return tokens ?? rows(YOU_ARE_HEALTHY_ID) ?? [];
}
