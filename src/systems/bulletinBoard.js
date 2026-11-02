// THE BULLETIN BOARD (PlayerActivate.ActivateBulletinBoard,
// PlayerActivate.cs:706-739 - MIT, Daggerfall Workshop). The town
// sign every Daggerfall street corner carries: click it and the
// current location's name heads a parchment, with the first rumour
// the mill considers fit for a SIGN written under it.
//
// This file owns the token composition, which is pure. The rumour
// itself is the mill's (rumorMill.getNewsOrRumorsForBulletinBoard,
// TalkManager.cs:1355-1386, ported since TK-i); the box that shows
// it is the scene host's.
//
// NOTICE-PANEL (2026-10-29, a departure): no board stands in a town -
// the town panel's Notice Board is the press (scenes/townPanelHost.js),
// so DFU's reach gate (:709-713, MobileNPCActivationDistance) has no
// ray to gate and went with the boards.

import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';

const text = (s) => ({ formatting: TOKEN_TEXT, text: s, x: 0, y: 0 });
const justifyCenter = () => ({ formatting: RSC.JustifyCenter, text: '', x: 0, y: 0 });
// TextFile.Formatting.NewLineOffset IS 0x00 (TextFile.cs:106, :119 -
// the same byte as NewLine), which MultiFormatTextLabel closes a row
// on. Named as C# names it at the call site.
const newLineOffset = () => ({ formatting: RSC.NewLine, text: '', x: 0, y: 0 });

/**
 * ActivateBulletinBoard's token composition (:715-736), verbatim.
 *
 * The head is always three tokens - JustifyCenter, the location name,
 * JustifyCenter - so the name closes a CENTRED row (the trailing
 * JustifyCenter reaches back and centres the label it just finished,
 * MultiFormatTextLabel.cs:342-344). The leading one closes the empty
 * starter label DFU's MultiFormatTextLabel is born holding (:40,
 * `lastLabel = new TextLabel()`): a blank row's worth of lead, not a
 * line of text.
 *
 * "formatting message is split into 2 parts, depending whether we got
 * any news or not" (:726): with a rumour, a blank line goes between
 * the heading and the rumour's own tokens; with none, the box is the
 * location name alone. C# shows the box EITHER WAY - a town with
 * nothing posted still opens a sign bearing its name.
 *
 * @param {string} locationName - PlayerGPS.CurrentLocalizedLocationName
 * @param {Array|null} message - getNewsOrRumorsForBulletinBoard()
 * @returns {Array} RSC tokens for the message box
 */
export function bulletinBoardTokens(locationName, message) {
  const tokens = [justifyCenter(), text(locationName ?? ''), justifyCenter()];
  if (message != null) {
    tokens.push(newLineOffset(), text(''), newLineOffset());
    tokens.push(...message);
  }
  return tokens;
}

/**
 * The rows DaggerfallUI.MessageBox(tokens) (:738) draws, ready for a
 * box that takes lines - tokenRows over the composition above, with
 * the LEADING row dropped.
 *
 * That row is the empty STARTER label MultiFormatTextLabel is born
 * holding (`lastLabel = new TextLabel()`, :40), closed by the opening
 * JustifyCenter. It has never laid out, so its totalHeight is still 0
 * and NewLine() advances the cursor by nothing: a row of no height,
 * drawn as nothing. The two blank rows the news separator makes are
 * NOT that case and stay - an empty TextLabel that HAS laid out is a
 * full glyph high (TextLabel.cs:543 sets totalHeight = GlyphHeight
 * before it looks at the text).
 *
 * @param {(tokens:Array) => Array<{text:string, center:boolean}>} rowsOf
 *   the token->row law (ui/messageBox.tokenRows), injected so this
 *   system file does not reach up into the UI lane.
 */
export function bulletinBoardRows(locationName, message, rowsOf) {
  const rows = rowsOf(bulletinBoardTokens(locationName, message));
  if (rows.length && rows[0].text === '') rows.shift();
  return rows;
}
