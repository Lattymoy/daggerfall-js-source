// @ts-check
// DELVE II (bible/03-World/Delve-II.md law 9, SAID PLAINLY): EVERY WORD A DUNGEON'S ENCOUNTER SAYS - near it, as it runs,
// over its vault. WB13b's rules (World-Bosses.md section 20): the event, then what to do, and stop; numbers as numerals.
// Every line goes through the text core (`t`, Port_Strings - L10N4). test/systems/delve/dlv2_words.test.js reads them all.
// Not a DFU member (Ledger A: DELVE II).
import { t } from '../textManager.js';

/** Said once an entry, as the player first comes near a site that has not run. */
export const DELVE_NEAR_TEXT = Object.freeze({
  hold: () => t('delve.near.hold', 'An old ward is cut into this floor. Step inside it to wake it.'),
  litany: (k) => t('delve.near.litany', '{k} plates are set in a ring in this floor. Step inside the ring to wake them.', { k }),
});

/** The Hold, as it runs (the mid-screen line). */
export const DELVE_HOLD_TEXT = Object.freeze({
  gather: () => t('delve.hold.gather', 'The ward wakes. Hold the circle.'),
  wave: (w, n) => t('delve.hold.wave', 'Wave {w} of {n}', { w, n }),
  breath: () => t('delve.hold.breath', 'The ward is quiet. Make ready.'),
  captain: () => t('delve.hold.captain', 'Their captain comes.'),
  away: () => t('delve.hold.away', 'Go back into the circle. The ward fails when nobody holds it.'),
  failed: () => t('delve.hold.failed', 'Nobody held the ward. It goes dark and its foes crumble.'),
  won: () => t('delve.hold.won', 'The ward holds. The vault is open.'),
});

/** The Litany, as it runs. */
export const DELVE_LITANY_TEXT = Object.freeze({
  show: () => t('delve.litany.show', 'Watch the plates.'),
  work: () => t('delve.litany.work', 'Step on the plates in the same order.'),
  wrong: () => t('delve.litany.wrong', 'Wrong plate. Watch again.'),
  wake: () => t('delve.litany.wake', 'The wrong plate wakes the guardians.'),
  won: () => t('delve.litany.won', 'All the plates are lit. The vault is open.'),
});

/** The vault, on its plaque and at a press. */
export const DELVE_VAULT_TEXT = Object.freeze({
  sealed: () => t('delve.vault.sealed', 'Sealed Vault'),
  sealedHold: () => t('delve.vault.sealedHold', 'Hold the ward to open it'),
  sealedLitany: () => t('delve.vault.sealedLitany', 'Light the plates to open it'),
  open: () => t('delve.vault.open', 'Vault'),
  empty: () => t('delve.vault.empty', 'Empty'),
  locked: () => t('delve.vault.locked', 'The vault is sealed.'),
});

/** How long a mid-screen line stands (s): a running line, and the near line and the end, read slower. */
export const DELVE_SAY_S = 3;
export const DELVE_SAY_LONG_S = 5;
