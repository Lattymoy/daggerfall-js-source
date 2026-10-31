// @ts-check
// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): A GUILD HALL'S OWN PIECES PRESSED - the hall's board (GUILD1e, the
// guild's notes) and the Guild Banker (the guild's vault, as the hall's cupboards open it: scenes/worldModes.js
// openHallChest). Out of createWorldModes' activateDecor so the host does not grow (HOST-SPLIT): one call answers whether
// the press was a hall piece's.
import { isGuildBanker } from '../world/guildFurniture.js';
import { t } from '../systems/textManager.js';

/** What a visitor is told at another guild's banker. */
export const GUILD_BANKER_SHUT = () => t('guild.banker.shut', "The banker serves this guild's members alone.");

/**
 * A HALL PIECE PRESSED: the board's notes (`board` - the host's own isHallBoard), or the banker's vault for a member
 * and its refusal for anyone else. Answers whether it was a hall piece's press.
 * @param {any} piece @param {boolean} board @param {() => void} openBoard @param {() => void} openVault
 * @param {boolean} member @param {(text: string) => void} say
 */
export function hallPiecePress(piece, board, openBoard, openVault, member, say) {
  if (board) {
    openBoard();
    return true;
  }
  if (!isGuildBanker(piece)) return false;
  if (member) openVault();
  else say(GUILD_BANKER_SHUT());
  return true;
}
