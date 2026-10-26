// @ts-check
// The Bring online button on an offline character's tile in the Online pane (ui/enhanced/enhancedMenu.js paneOnline).
// A character that can only play offline gets a dead button whose words say why, instead of a live button that fails
// at the service or does nothing (ACC1g's rule, which AUDIT SET D4 applied to the Test Room).

import { t } from '../../systems/textManager.js';

/**
 * The button's words, and whether the character can only play offline.
 * - A Test Room character: the realm boot refuses it whatever door it comes by (systems/testRoom.js).
 * - A copy of a realm character: customs can never let its new id in (systems/realmCopyMark.js).
 * @param {{ testRoom: boolean }} save
 * @param {{ realmCopy: boolean }} character
 * @returns {{ label: string, offlineOnly: boolean }}
 */
export function bringOnlineButton(save, { realmCopy }) {
  if (save.testRoom) return { label: t('menu.online.testRoomOffline', 'Test Room: offline only'), offlineOnly: true };
  if (realmCopy) return { label: t('menu.online.realmCopyOffline', 'Copied from online: offline only'), offlineOnly: true };
  return { label: t('menu.online.bring', 'Bring online'), offlineOnly: false };
}
