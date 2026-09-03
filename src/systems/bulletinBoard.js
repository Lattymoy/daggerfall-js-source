// THE BULLETIN BOARD (PlayerActivate.ActivateBulletinBoard,
// PlayerActivate.cs:706-739 - MIT, Daggerfall Workshop). The town
// sign every Daggerfall street corner carries: click it and the
// current location's name heads a parchment, with the first rumour
// the mill considers fit for a SIGN written under it.
//
// The pieces this file owns are the two that are pure - the reach
// gate and the token composition. The rumour itself is the mill's
// (rumorMill.getNewsOrRumorsForBulletinBoard, TalkManager.cs:1355-
// 1386, ported since TK-i); the ray that finds the board and the box
// that shows it are the scene host's.
//
// THE REACH: :709-713 gates on MobileNPCActivationDistance - 256
// classic units, TWICE a door's, the same reach a wandering
// townsperson answers from - and a board further than that consumes
// the click with the refusal rather than falling through to whatever
// stands behind it. The ray that reaches it is the ordinary
// activation ray (RayDistance), so the gate is a SEPARATE test from
// the pick, exactly as C# tests hit.distance after the raycast.

import { MOBILE_NPC_ACTIVATION_DISTANCE, TOO_FAR_AWAY_TEXT } from '../player/activate.js';
import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';

/** PlayerActivate.cs:709-710 - `hit.distance > MobileNPCActivationDistance`. */
export const BULLETIN_BOARD_ACTIVATION_DISTANCE = MOBILE_NPC_ACTIVATION_DISTANCE;

/** TextManager 'youAreTooFarAway' (Internal_Strings.csv:22), the
 *  mid-screen refusal :712 - the string as the table spells it,
 *  ellipsis and all.
 *
 *  AUDIT 54 (talk lane) CLOSED THE STRAY THIS NOTE RECORDED: the
 *  string is ONE key, so it is now one constant, in PlayerActivate's
 *  own module (player/activate.js). scenes/townTalk.js's three reach
 *  refusals spoke the same key as 'You are too far away.' with a full
 *  stop; they import this same value now, and test/audit23_ui.test.js's
 *  literal pins moved with them. Re-exported here because this file's
 *  own consumers (and its pin) name it. */
export { TOO_FAR_AWAY_TEXT };

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
