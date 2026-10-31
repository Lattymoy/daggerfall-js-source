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
  springs: (look, n) => (look === 'tomb' ? t('delve.near.springs.tomb', '{n} cracked tombs stand round this floor. Step inside the circle to wake them.', { n })
    : look === 'pool' ? t('delve.near.springs.pool', '{n} dark pools ring this floor. Step inside the circle to wake them.', { n })
      : t('delve.near.springs.altar', '{n} broken altars stand round this floor. Step inside the circle to wake them.', { n })),
  vigil: () => t('delve.near.vigil', 'A relic stands at the heart of this floor. Step inside the circle to wake it.'),
  brazier: () => t('delve.near.brazier', 'A flame burns at the heart of this floor, with cold braziers round it. Step inside to wake the rite.'),
  weighing: () => t('delve.near.weighing', 'Three plates are set in this floor, and stone weights lie by them. Step inside the circle to wake them.'),
  seals: () => t('delve.near.seals', 'Old seals are cut into this floor. Step inside the circle to raise them.'),
});

/** The Hold, as it runs (the mid-screen line). */
export const DELVE_HOLD_TEXT = Object.freeze({
  gather: () => t('delve.hold.gather', 'The ward wakes. Hold the circle.'),
  wave: (w, n) => t('delve.hold.wave', 'Wave {w} of {n}', { w, n }),
  breath: () => t('delve.hold.breath', 'The ward is quiet. Make ready.'),
  captain: () => t('delve.hold.captain', 'Their captain comes.'),
  away: () => t('delve.hold.away', 'Go back into the circle. The ward fails when nobody holds it.'),
  failed: () => t('delve.hold.failed', 'Nobody held the ward. It goes dark and its foes crumble.'),
  outlasted: () => t('delve.hold.outlasted', 'The captain outlasted the ward. It goes dark and its foes crumble.'),
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

/** The Wellsprings, as they run. */
export const DELVE_SPRINGS_TEXT = Object.freeze({
  spring: () => t('delve.springs.spring', 'Foes pour from the sources. Break every source.'),
  broke: (n) => t('delve.springs.broke', 'A source breaks. {n} left.', { n }),
  outlasted: () => t('delve.springs.outlasted', 'The sources outlasted the ward. It goes dark and its foes crumble.'),
  won: () => t('delve.springs.won', 'The sources are broken. The vault is open.'),
});

/** The Vigil, as it runs. */
export const DELVE_VIGIL_TEXT = Object.freeze({
  gather: () => t('delve.vigil.gather', 'The relic wakes. Keep its light.'),
  breath: () => t('delve.vigil.breath', 'The relic\'s light steadies. Make ready.'),
  low: () => t('delve.vigil.low', 'The relic\'s light is failing.'),
  dark: () => t('delve.vigil.dark', 'The relic\'s light goes out. It wakes again in a minute.'),
  failed: () => t('delve.vigil.failed', 'Nobody kept the relic. It goes dark and its foes crumble.'),
  won: () => t('delve.vigil.won', 'The relic\'s light holds. The vault is open.'),
});

/** The Brazier Rite, as it runs. */
export const DELVE_BRAZIER_TEXT = Object.freeze({
  gather: () => t('delve.brazier.gather', 'The rite wakes.'),
  work: (n) => t('delve.brazier.work', 'Carry the flame from the heart to the {n} braziers.', { n }),
  take: () => t('delve.brazier.take', 'You carry the flame. Your hands are full.'),
  light: (n) => t('delve.brazier.light', 'A brazier is lit. {n} left.', { n }),
  drop: () => t('delve.brazier.drop', 'The flame falls. Take it up again.'),
  gutter: () => t('delve.brazier.gutter', 'The flame goes out. Take another from the heart.'),
  won: () => t('delve.brazier.won', 'Every brazier is lit. The vault is open.'),
});

/** The Weighing, as it runs. */
export const DELVE_WEIGHING_TEXT = Object.freeze({
  work: () => t('delve.weighing.work', 'Hold all three plates at once. Stand on a plate, or set a weight on it.'),
  take: () => t('delve.weighing.take', 'You carry a stone weight. Your hands are full.'),
  held: () => t('delve.weighing.held', 'All three plates are held. Keep them held.'),
  unheld: () => t('delve.weighing.unheld', 'A plate is let go.'),
  won: () => t('delve.weighing.won', 'The plates are held. The vault is open.'),
});

/** The Seals, as they run. */
export const DELVE_SEALS_TEXT = Object.freeze({
  gather: () => t('delve.seals.gather', 'The seals rise.'),
  seals: (n) => t('delve.seals.seals', 'Break the {n} seals before they sink.', { n }),
  broke: (n) => t('delve.seals.broke', 'A seal breaks. {n} left.', { n }),
  sink: () => t('delve.seals.sink', 'The seals sink. They rise again soon.'),
  won: () => t('delve.seals.won', 'Every seal is broken. The vault is open.'),
});

/** A carried piece let go: the weapon readied again. */
export const DELVE_CARRY_TEXT = Object.freeze({
  letGo: () => t('delve.carry.letGo', 'You let it go.'),
});

/** The pieces' own names, on their plaques. */
export const DELVE_PIECE_TEXT = Object.freeze({
  source: () => t('delve.piece.source', 'Wellspring'),
  seal: () => t('delve.piece.seal', 'Seal'),
  weight: () => t('delve.piece.weight', 'Stone Weight'),
});

/** The vault, on its plaque and at a press. */
export const DELVE_VAULT_TEXT = Object.freeze({
  sealed: () => t('delve.vault.sealed', 'Sealed Vault'),
  sealedHold: () => t('delve.vault.sealedHold', 'Hold the ward to open it'),
  sealedLitany: () => t('delve.vault.sealedLitany', 'Light the plates to open it'),
  sealedSprings: () => t('delve.vault.sealedSprings', 'Break the sources to open it'),
  sealedVigil: () => t('delve.vault.sealedVigil', 'Keep the relic lit to open it'),
  sealedBrazier: () => t('delve.vault.sealedBrazier', 'Light the braziers to open it'),
  sealedWeighing: () => t('delve.vault.sealedWeighing', 'Hold the plates to open it'),
  sealedSeals: () => t('delve.vault.sealedSeals', 'Break the seals to open it'),
  open: () => t('delve.vault.open', 'Vault'),
  locked: () => t('delve.vault.locked', 'The vault is sealed.'),
  notYours: () => t('delve.vault.notYours', 'Only those who won this vault may open it.'),
});
/** Online: why the room does not count my word at a site (DLV3). */
export const DELVE_ROOM_TEXT = Object.freeze({
  others: () => t('delve.room.others', 'Another party holds this encounter.'),
  held: () => t('delve.room.held', 'You hold another encounter here. Finish it or leave it first.'),
});

/** How long a mid-screen line stands (s): a running line, and the near line and the end, read slower. */
export const DELVE_SAY_S = 3;
export const DELVE_SAY_LONG_S = 5;
