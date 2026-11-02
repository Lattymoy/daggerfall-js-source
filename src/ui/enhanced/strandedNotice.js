// @ts-check
// THE WAY BACK FOR A SAVE SET ASIDE, ON THE ONLINE DOOR (bible/06-Systems/Realm-Arc.md, STRANDED).
//
// A device that kept progress the realm never took, for a character since played elsewhere, holds it apart
// (systems/realmSaves.js). The tile says so APART from its own buttons, as its backup line does (ui/saveTile.js
// `notice`): one sentence and one button. As a fourth button beside "Copy to offline" it read as a second way to copy
// the character, and a player could not tell the two apart. The button asks first, and the question says what happens.

import { t } from '../../systems/textManager.js';

/** The tile's sentence, in the player's language. */
export const strandedNoteText = () =>
  t('menu.realm.strandedNote', 'This device has progress for this character that never reached the realm.');
/** The notice's button, and the question's yes. */
export const strandedRecoverLabel = () => t('menu.realm.strandedRecover', 'Recover it');
/** The question's title. */
export const strandedAskTitle = (/** @type {string} */ name) =>
  t('menu.realm.strandedAsk', 'Recover {name}\u2019s unsaved progress?', { name });
/** The question's body: what is copied, what it becomes, and what does not change. */
export const strandedAskBody = (/** @type {string} */ name) =>
  t(
    'menu.realm.strandedBody',
    'This device kept progress for {name} that never reached the realm. It will be copied as a new offline character. Your online character does not change, and nothing you play on the copy comes back online.',
    { name },
  );

/**
 * The tile's notice for a realm character with a save set aside (saveTile.js `notice`).
 * @param {{ name: string, busy: boolean, ask: (title: string, body: string, yes: string, onYes: () => void) => void, recover: () => void }} o
 *   `ask` the door's question, `recover` the copy itself (systems/online/strandedCopy.js), run on its yes
 * @returns {{ say: string, actions: Array<{ label: string, disabled: boolean, onClick: () => void }> }}
 */
export function strandedNotice({ name, busy, ask, recover }) {
  const label = strandedRecoverLabel();
  return {
    say: strandedNoteText(),
    actions: [
      { label, disabled: busy, onClick: () => ask(strandedAskTitle(name), strandedAskBody(name), label, recover) },
    ],
  };
}
