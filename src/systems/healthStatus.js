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
// The record-22 STATUS box that precedes this one in DFU's
// DisplayStatusInfo chain is NOT here: its text is macro-heavy
// (%reg and friends) and the port has no producer set for it yet -
// FLAGGED at the host seam, so the Status key opens the health half
// alone rather than printing raw macros.

import { diseaseCount, contractedMessageRecord } from './diseases.js';
import { poisonCount } from './poisons.js';

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
