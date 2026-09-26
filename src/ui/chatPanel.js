// CHAT1 (2026-09-12, Mac: "I want to add a new UI element. The live chat
// in enhanced format. Players will be able to type and chat live with
// other players. Currently I just want one world tab with the ability
// to add more tabs at a later time"): THE PANEL - the enhanced skin's
// DOM chat, top-left over the world, under the touch layer's corner
// buttons.
//
// TWO STATES. Closed: the active tab's last few lines stand over the
// world and fade (net/chat.js peek), with a one-word hint (Enter) or,
// on a touch device, a button. Open: a tab bar (one tab per row of
// CHAT_TABS - the World tab alone today - a badge on each with unread
// lines), the tab's lines, and the field. Enter opens the panel and
// puts the caret in the field; Enter in the field sends the line and
// closes the panel (the MMO gesture: type, send, back to the world);
// an empty Enter and Escape close it. The touch layer's Send keeps the
// panel open (a thumb typed it; the next line is likely).
//
// THE KEYS ARE THE FIELD'S (CG2). One capture listener on the window,
// alive while the panel exists: a key typed into the field is stopped
// there, so the host's ring (scenes/world.js `keys.add`) never fills
// from a chat line and typing 'w' walks no one - the browser's own
// reload keys stay swallowed (ui/input.js swallowBrowserKey) so F5 in
// the field does not destroy the session. The key UP is not stopped:
// a key held when the panel opened leaves the ring the moment it is
// released. Enter opens the panel only when no enhanced overlay is up
// (enhancedOverlays), no other field owns the key, the host says the
// game is not paused (canOpen), and the event is the keyboard's own -
// the touch layer's ⏎ button synthesizes an untrusted Enter for the
// windows it drives, and that one must not open the chat.
//
// THE MOUSE IS THE PANEL'S. The host adds every window mousedown to
// its ring and swings on the left button outdoors; a PRESS inside the
// open box is stopped at the box, so tapping Send draws no weapon. A
// RELEASE is never stopped (AUDIT CHAT C5): the host's mouseup clears
// its ring, and a press begun on the canvas and let go over the box
// must still let go, or the weapon swings until the next click.
//
// AUDIT CHAT (2026-09-12, before the merge). The open key is the
// ActivateCursor binding (Enter by default), resolved through the
// registry, not a literal (C4: the panel was eating DFU's cursor key
// at the window, and its own key could not be rebound); opening frees
// the pointer and closing takes it back inside the same gesture (C2:
// the panel opened under pointer lock, so the mouse kept looking and
// swinging while the player typed and nothing in the box could be
// clicked - the hosts' onOpen/onClose); an Enter that commits an IME
// candidate is the IME's (C3: the first Enter of every Japanese word
// shipped the half-composed line); a held Enter opens once and its
// repeats send nothing (C6); Tab stays in the field (C7: it walked
// focus onto Send and gave the keyboard back to the game); the list
// grows by the lines that arrived and keeps a reader's scroll (C8);
// the root is no live region (C9: every repaint re-announced the
// whole panel); a refused line keeps the field and the panel (B2); a
// name carries a tag from the guarded id (A5); the dial counts as an
// overlay (C1, in pixelDial.js) and an open overlay hides the panel.
//
// CHAT-FIT (2026-09-22, Mac: "names sometimes take up 2 rows, the
// list isnt scrollable and continues to grow, enlarging the chat.
// Glyphs should also show on chat names in the chat itself"): THREE
// DEFECTS, and the first two have one cause. The roster column was a
// flex child that CONTRIBUTED ITS HEIGHT: `.dfchat-cols` has no height
// of its own, so a column of nineteen rows stretched the row, the box
// grew with it, and a list that can always grow never scrolls - the
// `overflow-y: auto` on it was true and never reached. The column's
// content is absolute inside it now (`.dfchat-who-inner`), so the
// column is exactly as tall as the conversation beside it and the
// list scrolls inside that. A row is ONE LINE: the title, the name,
// the glyphs and the tag stand in a nowrap flex line and the NAME is
// the one that gives (ellipsis, the full name as its title), because
// a title and a glyph are a few pixels and a name is what the row is
// for - `overflow-wrap: anywhere` had every long name folding under
// its own title. And a chat LINE wears the author's badge the way the
// roster row does: the title before the name, the glyphs after it,
// drawn by the one SVG door the roster already had, asked of the host
// (`badgeOf`, net/online.js's answer for me, a peer, or a peer this
// session once met) on the same pass that asks the name's colour, so a
// title equipped mid-conversation reaches the lines already said.
//
// SOC3 (2026-09-16, Mac: "A social button next to the chat UI, that
// when tapped opens the new friends list + party interface ... be able
// to invite friends or other individuals to the new 4 person party
// system. Party system: Upon joining a party, the players name who are
// in a party together should turn green"): THREE SEAMS, AND NO NET.
//
// This file still imports no socket and no social module. What SOC3
// adds is three OPTIONS the host fills from the picture it already
// holds (net/social.js, over the hub's link):
//   `social`  - the button beside the chat's controls, in BOTH states,
//               with a badge counting what is waiting on the player
//               (requests to me + live invites). The button only opens
//               something the HOST owns (ui/socialPanel.js), so the
//               chat neither knows nor imports the panel.
//   `nameColor` - a peer id in, a CSS colour or null out. The chat
//               lines' author names and the roster rows wear it, which
//               is where "the players name ... should turn green"
//               lands in the DOM. The colour is the HOST's answer, not
//               a class this file invents, because who is in my party
//               is the hub's word and nothing the panel can see.
//   `rowActions` - what a click on a roster row offers for that PEER.
//               The roster is the one place a stranger has a name, and
//               "other individuals" is exactly that column; the labels,
//               their enabled state and the REASON a disabled one gives
//               all come from the host (net/social.js actionsFor).
// A host that passes none of the three gets the chat it had, byte for
// byte: no button is built, no colour is asked for, no row is a door.
//
// CHAT-SIZE (2026-09-23, Mac: "I want to implement the ability to click and
// drag the chat to resize/along with the text"): THE CORNER. A grip at the
// box's bottom-right corner drags it from there: the WIDTH is
// the text's scale (width / 440, the sheet's own width, between 0.8 and
// 1.8 - every size the chat's TEXT is drawn at is `calc(Npx * scale)`:
// the lines, the tags and the times, the roster's rows and its column,
// the field) and the HEIGHT is how many lines the list shows. So a wider
// chat is a bigger chat, its lines wrapping where they did, and a taller
// one is more history. What a THUMB presses does not scale (the buttons,
// the tabs: AUDIT SOC C8's 44px targets are the targets). The two numbers
// are the player's (uiPrefs chatWidth/chatListHeight; null is the sheet's
// own size), arrow keys on the focused grip step them, and a double click
// on it gives the sheet's size back. The panel publishes its footprint on
// the document - the width and the list height as the same custom
// properties its own rules read, and `data-dfchat-fit` for whether the
// friends panel (ui/socialPanel.js) still fits BESIDE it - because that
// panel was placed off the chat's old fixed size (AUDIT SOC C13) and a
// resized chat would have slid under it.
//
// CHAT-SCROLL (2026-09-23, Starempire42 on Discord: "Make it so when you
// open the chat it automatically scrolls to the newest message ...
// Currently when you open the chat it just stays idle so you have to
// manually scroll down to the newest message every single time"): AN
// OPEN LANDS ON THE NEWEST LINE, and the list stays there while it is
// read at the bottom. Two causes, one law. (1) The follow rule asked the
// LIST where the reader was - "at the bottom, within 8px" - on the first
// paint after an open, which is a box that was `display: none` a moment
// ago. What a hidden scroller remembers is the engine's to decide: Chromium
// keeps the offset, other engines drop it to the top, and a top that is
// taller than the box reads as "the reader scrolled up" - so the list was
// left on the oldest line. And a reader who HAD scrolled up before closing
// found the old place again on every open, which is AUDIT CHAT C8's rule
// (keep a reader's scroll) applied to a moment it was never written for:
// C8 is about lines arriving under a reader, not about coming back. So an
// open, and a tab change, land on the newest line whatever the box says.
// (2) The badge pass lays a title and glyphs into a line AFTER the list
// scrolled to its bottom, and a line that wraps under its badge pushed the
// newest out of view by its own growth - so the scroll to the newest is
// the paint's LAST act, after every pass that can change a line's height,
// and a later badge that re-lays a line keeps a reader at the bottom there.
// While the panel is open C8 stands: a reader who scrolled up is left
// where they are, and the lines that arrive under them are counted on a
// bar under the list (`N new - jump to newest`) that takes them there.
//
// Not a DFU member: Daggerfall Unity has no chat. Ledger A row (ONLINE).
import { isTextEntryTarget, swallowBrowserKey, bindings } from './input.js';
import { actionForCode, codeMeans } from '../systems/inputActions.js';
import { overlayOpen } from './enhancedOverlays.js';
import { claimCursorKey } from '../player/pointerLock.js';   // KB1: while the panel stands, ActivateCursor's key is its open key and not the cursor toggle
import { isTouchDevice } from './touch.js';
import { CHAT_MAX } from '../net/wire.js';
import { tagOf } from '../net/chat.js';
import { guildTagText } from '../net/guildLaw.js';   // GUILD1c: the guild's tag beside a name, as over a head
import { titleBadge, glyphBadges, glyphSvgNode, cssRgba, TITLE_RGBA } from './playerBadge.js';   // ACC3c: the same table the name over a head reads - a name wears one title everywhere it is drawn; cssRgba comes from HERE and not ui/nameLayer.js, which would pull the whole remote-player pass into this panel
import { rosterRows, rosterTitle } from '../net/roster.js';   // CHAT-R1: who is online, in order (the cap is the model's own - AUDIT-CHATR F4: this file imported it and never used it, and lint could not see that: no-unused-vars is on for server/src and not for src)
import { PARTY_GREEN_CSS } from '../net/social.js';   // CHAT-CHAN: the Party tab's mark wears the party's one green
import { SHORTCODE_LIST } from '../net/chatCommands.js';   // EMOTE1: the picker offers the shortcodes' own emoji, in their order, so a pick and a :code: say the same thing
import { getPref, setPref } from '../systems/uiPrefs.js';   // CHAT-R2: the hidden state outlives the session
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';   // FONT1: the enhanced skin's own face, unsmoothed, with Silkscreen's five

/** The action whose key opens the chat: DFU's own cursor key (Enter by default), since opening frees the cursor. */
export const CHAT_OPEN_ACTION = 'ActivateCursor';

/** CHAT-SIZE: the sheet's own width, which is the text's scale 1 - the scale is the dragged width over it, inside these
 *  bounds, so the width bounds are the scale's. */
export const CHAT_WIDTH_BASE = 440;
export const CHAT_SCALE_MIN = 0.8;
export const CHAT_SCALE_MAX = 1.8;
export const CHAT_WIDTH_MIN = Math.round(CHAT_WIDTH_BASE * CHAT_SCALE_MIN);
export const CHAT_WIDTH_MAX = Math.round(CHAT_WIDTH_BASE * CHAT_SCALE_MAX);
/** EMOTE1: the box's border, one number for the rule that draws it and the query that measures inside it - a container
 *  query sees the box's CONTENT width, so asking after the width a drag sets takes the border off both sides. */
const CHAT_BOX_BORDER = 1;
/** CHAT-SIZE: the list's height - a few lines at the least, never past three quarters of the screen (the sheet says so too). */
export const CHAT_LIST_MIN = 80;
export const CHAT_LIST_MAX_VH = 75;
/** CHAT-SIZE: one arrow key on the focused grip, in CSS pixels. */
export const CHAT_SIZE_STEP = 20;
/** CHAT-SIZE: the friends panel's width (ui/socialPanel.js SOCIAL_CSS - a pin holds the two equal): the chat is what
 *  knows its own size, so it is the chat that says whether that panel still fits beside it. */
export const SOCIAL_PANEL_WIDTH = 360;
/** CHAT-SIZE: the text's scale for a dragged width. */
export const chatScaleFor = (width) => Math.min(CHAT_SCALE_MAX, Math.max(CHAT_SCALE_MIN, width / CHAT_WIDTH_BASE));
/** CHAT-SIZE: 'beside' when the friends panel fits to the right of the chat box on this screen (14 + the box + 12 +
 *  the panel + 14 - the sheet's own gutters), else 'below'. `width` null is the sheet's own. At the sheet's size this
 *  is the friends panel's old 840px breakpoint exactly. */
export function chatFit(viewportWidth, width = null) {
  const vw = Number(viewportWidth) || 0;
  const box = Math.min(width ?? CHAT_WIDTH_BASE, vw - 28);
  return vw >= 14 + box + 12 + SOCIAL_PANEL_WIDTH + 14 ? 'beside' : 'below';
}

export const CHAT_STYLE_ID = 'dagger-chat-style';

/** The panel's sheet: the enhanced tokens (enhancedStyle.js) where they exist, a fallback where the skin's sheet is not loaded.
 *
 *  FONT1 (2026-09-16, Mac: "Especially the new online interfaces font use our enhanced font"): THE FACE IS THE
 *  SKIN'S, NOT THE LAUNCHER'S. This sheet set `--data` (Barlow Semi Condensed) - which is the MENU's face, the one
 *  the boot screens and the settings pages are set in - so the chat stood over an enhanced world in a font nothing
 *  else in that world uses. In-game the enhanced skin is the pixel stack (ui/pixelifyFive.js PIXEL_STACK, the same
 *  face ui/enhancedHud.js and every floating window wear), unsmoothed, and text laid over the world takes the HUD's
 *  hard shadow pair rather than a blur: a blurred drop shadow under a pixel glyph reads as a rendering fault.
 *  The @font-face for the FIVE rides this sheet too (FIX-D), because this sheet is injected on its own and a
 *  document that never mounted the skin's stylesheet would otherwise draw Pixelify's 5 - the glyph that reads as 8.
 *
 *  AND THE SIZES CAME DOWN A STEP where the line is long. Pixelify Sans measures about 1.29x the width of Barlow
 *  Semi Condensed at one size (measured in Chromium, tools/font1Probe.mjs), so every size here is really a size and
 *  a quarter: the chat line is 13px where it was 14, the tag/time/hint/status 10-11 where they were 11-12, the
 *  roster row 12 where it was 13. Nothing a THUMB presses moved - AUDIT SOC C8's 44px targets and the button type
 *  (14px / 6px 10px, pinned) are untouched, because a pixel face is not a reason to shrink a target. */
export const CHAT_CSS = `
${PIXELIFY_FIVE_FACE}
.dfchat { position: fixed; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(44px + env(safe-area-inset-top, 0px));
  width: min(var(--dfchat-w, 440px), calc(100vw - 28px)); z-index: 5; pointer-events: none;
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfchat.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
.dfchat-peek { display: flex; flex-direction: column; gap: 3px; }
.dfchat-line { flex: none; font-size: calc(13px * var(--dfchat-scale, 1)); line-height: 1.35; overflow-wrap: anywhere; overflow: hidden; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.dfchat-name { color: var(--brass, #c08a3e); font-weight: 600; }
.dfchat-tag { color: var(--dim, #8b8578); font-size: calc(10px * var(--dfchat-scale, 1)); margin: 0 6px 0 2px; }
.dfchat-line.mine .dfchat-name { color: #dcc27c; }
.dfchat-line.system .dfchat-text { color: #8fb8d8; font-style: italic; }
/* CHAT-CHAN: an aside out of character - (( )) - is drawn as one: dimmed and leaning, the words kept readable */
.dfchat-line.ooc .dfchat-text { color: #b3ab9c; font-style: italic; }
/* EMOTE1: THE PICKER - a button in the form, a grid over it */
.dfchat-emoji { background: none; border: 0; cursor: pointer; font-size: 16px; line-height: 1; padding: 4px 6px; flex: none; }
.dfchat-emojis { display: none; flex: none; flex-wrap: wrap; gap: 2px; padding: 6px; border-top: 1px solid var(--iron, #2b323b);
  max-height: 132px; overflow-y: auto; }
.dfchat-emojis.on { display: flex; }
.dfchat-emoji-pick { background: none; border: 0; border-radius: 3px; cursor: pointer; font-size: 18px; line-height: 1; width: 32px; height: 32px; padding: 0; }
.dfchat-emoji-pick:hover, .dfchat-emoji-pick:focus-visible { background: var(--iron, #2b323b); }
/* ...and it is the DESKTOP's: every phone keyboard carries an emoji key of its own, and on a 320px phone this button
   took the field down to 67px (tools/chatChanProbe.mjs). The touch skin keeps the field; the shortcodes work on both. */
.dfchat.touch .dfchat-emoji, .dfchat.touch .dfchat-emojis { display: none; }
/* ...and in a box the SCREEN narrowed below any width a drag can choose (CHAT_WIDTH_MIN: a phone-wide window on the
   desktop skin), the button gives its 36px back to the field - there it took the field from 129px to 93px, narrower
   than any skin's field before it (the touch skin's at 320px, 115px; tools/chatChanProbe.mjs). The grid is not hidden
   with it: one opened in a wider box stays inside this one, and a pick or Escape still closes it. */
@container (width < ${CHAT_WIDTH_MIN - 2 * CHAT_BOX_BORDER}px) { .dfchat-emoji { display: none; } }
/* EMOTE1: an action - "Bran waves at Ann." - the words leaning after the name, in the name's own warmth */
.dfchat-line.me .dfchat-text { font-style: italic; color: #dccfae; }
/* DICE1: a roll the relay made - its own colour, which no typed line can wear (the kind is set from the FRAME's type) */
.dfchat-line.roll .dfchat-text { color: #e7c46a; }
/* CHAT-CHAN: the channel a peek line came from, when it is not the tab the chat opens on */
.dfchat-chan { font-size: calc(10px * var(--dfchat-scale, 1)); letter-spacing: .05em; text-transform: uppercase; margin-right: 6px; color: var(--dim, #8b8578); }
.dfchat-chan[data-tab="world"] { color: #d9c089; }
.dfchat-chan[data-tab="region"] { color: #e0a45a; }
.dfchat-chan[data-tab="party"] { color: ${PARTY_GREEN_CSS}; }
.dfchat-chan[data-tab="local"] { color: #e9e4d9; }
/* RED1 - THE SERVER SPEAKING. Every red line is a system line too
   (nobody is speaking it), so this rule follows that one and wins on
   specificity rather than fighting it. Not italic: the system's own
   notices are asides and this is an announcement, which is the whole
   difference Mac is asking for. The red is the skin's own alarm
   colour, the one a refusal already wears. */
.dfchat-line.red .dfchat-text { color: #e2453a; font-style: normal; font-weight: 600;
  letter-spacing: .01em; }
/* TITLE-N (Mac: "/dm to message chat with orange text (similar to /red)"): the Dungeon Master's line - /red's weight,
   in the Dungeon Master title's own orange (ui/playerBadge.js TITLE_RGBA.dungeonmaster). */
.dfchat-line.dm .dfchat-text { color: ${cssRgba(TITLE_RGBA.dungeonmaster)}; font-style: normal; font-weight: 600;
  letter-spacing: .01em; }
.dfchat-time { color: var(--dim, #8b8578); font-size: calc(10px * var(--dfchat-scale, 1)); margin-right: 6px; }
.dfchat-hint { margin-top: 4px; font-size: calc(11px * var(--dfchat-scale, 1)); color: var(--dim, #8b8578); opacity: .75; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.dfchat-status { margin-top: 4px; font-size: calc(11px * var(--dfchat-scale, 1)); color: #e0b070; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.dfchat-status:empty { display: none; }
.dfchat-open { display: none; pointer-events: auto; margin-top: 4px; align-items: center; gap: 6px; }
.dfchat.touch .dfchat-open { display: inline-flex; }
.dfchat.touch .dfchat-hint { display: none; }
.dfchat-box { display: none; position: relative; pointer-events: auto; background: rgba(14, 16, 19, .84); border: ${CHAT_BOX_BORDER}px solid var(--iron, #2b323b); border-radius: 6px; backdrop-filter: blur(4px); }
.dfchat[data-state="open"] .dfchat-box { display: flex; flex-direction: column; }
.dfchat[data-state="open"] .dfchat-peek, .dfchat[data-state="open"] .dfchat-hint, .dfchat[data-state="open"] .dfchat-open { display: none; }
.dfchat-tabs { display: flex; gap: 2px; padding: 4px 4px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfchat-tab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--dim, #8b8578); font: inherit; font-size: 13px;
  letter-spacing: .05em; text-transform: uppercase; padding: 6px 10px; cursor: pointer; flex: none; white-space: nowrap; }
/* CHAT-CHAN: FOUR TABS AND THE SOCIAL BUTTON IN ONE BAR - measured in Chromium, and looked at (tools/chatChanProbe.mjs).
   The tabs stand in a strip of their own and the Social button beside it, OUTSIDE it, so Social is always in the box.
   A tab never shrinks (a label cut by its own badge read "PARTY..." and a smear), and an UNREAD tab wears a DOT, not a
   count: four count pills asked 468px of the sheet's own 440 box, and the count is the button's spoken name instead
   (panel: aria-label) - the Chat button still counts every line while the chat is closed. In a box narrower than 400
   (a phone's, or one dragged down to CHAT_WIDTH_MIN - which is why this asks the BOX, a container query, and not the
   screen) the labels drop the capitals' spacing; and only where even that cannot fit (a phone under 380px wide) does
   the strip scroll sideways, a finger's swipe. The strip scrolls rather than hides, so it is no box CHAT2's law is
   about: it is a row, and nothing in it is squeezed across the column. (Measured at 352px with three tabs unread: the
   tabs asked 254px of a 241px strip until the labels closed up and the Social count became a dot too.) */
.dfchat-box { container-type: inline-size; }
.dfchat-tablist { display: flex; gap: 2px; min-width: 0; flex: 1 1 auto; overflow-x: auto; scrollbar-width: none; }
.dfchat-tablist::-webkit-scrollbar { display: none; }
.dfchat-tab .dfchat-badge:not(:empty) { display: inline-block; width: 7px; height: 7px; padding: 0; margin-left: 5px; border-radius: 50%;
  font-size: 0; line-height: 0; vertical-align: middle; }
@container (max-width: 400px) {
  .dfchat-tab { padding: 6px 5px; letter-spacing: 0; text-transform: none; }
  .dfchat-tab .dfchat-badge:not(:empty) { margin-left: 3px; }
  .dfchat-tabs .dfchat-social-tab { padding: 6px 8px; }
  /* the Social count a dot as well - its own label still says it ("2 waiting", AUDIT SOC C21) */
  .dfchat-tabs .dfchat-social-tab .dfchat-badge:not(:empty) { display: inline-block; width: 7px; height: 7px; padding: 0; margin-left: 4px;
    border-radius: 50%; font-size: 0; line-height: 0; vertical-align: middle; }
}
.dfchat-tab.active { color: var(--bone, #e9e4d9); border-bottom-color: var(--brass, #c08a3e); }
.dfchat-badge { margin-left: 6px; background: var(--brass, #c08a3e); color: var(--ink, #0e1013); border-radius: 8px; padding: 0 6px; font-size: 11px; }
.dfchat-badge:empty { display: none; }
.dfchat-list { height: var(--dfchat-list-h, min(220px, 34vh)); overflow-y: auto; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; }
.dfchat-list .dfchat-line { text-shadow: none; }
/* CHAT-SCROLL: the lines that arrived under a reader who scrolled up, and the way back down to them */
.dfchat-jump { display: none; flex: none; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-top: 1px solid var(--iron, #2b323b);
  font: inherit; font-size: calc(11px * var(--dfchat-scale, 1)); padding: 3px 8px; cursor: pointer; text-align: center; }
.dfchat-jump.on { display: block; }
.dfchat-form { display: flex; gap: 4px; padding: 6px 16px 6px 6px; border-top: 1px solid var(--iron, #2b323b); }
.dfchat-input { flex: 1; min-width: 0; background: var(--ink, #0e1013); color: var(--bone, #e9e4d9); border: 1px solid var(--iron, #2b323b); border-radius: 3px; padding: 6px 8px; font: inherit; font-size: calc(14px * var(--dfchat-scale, 1)); }
.dfchat-input:focus { outline: 1px solid var(--brass, #c08a3e); }
.dfchat-send, .dfchat-close, .dfchat-open, .dfchat-hide, .dfchat-show { background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit; font-size: 14px; padding: 6px 10px; cursor: pointer; }
/* CHAT-SIZE: the corner the box is dragged from - the BOX's own bottom-right, over both columns (the form's row ends
   where the conversation column does, and the roster stands beyond it). The width it gives is the text's scale
   (--dfchat-scale), the height the list's lines; arrow keys on it step the same two, and a double click puts the
   sheet's own size back. The form keeps its last button clear of it, and the roster its last row. */
.dfchat-grip { position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; cursor: nwse-resize; touch-action: none; border-bottom-right-radius: 6px;
  background: linear-gradient(135deg, transparent 0 50%, var(--dim, #8b8578) 50% 58%, transparent 58% 70%, var(--dim, #8b8578) 70% 78%, transparent 78%); opacity: .75; }
.dfchat-grip:hover, .dfchat-grip:focus-visible { opacity: 1; outline: none; }
.dfchat.touch .dfchat-grip { width: 26px; height: 26px; }
.dfchat.touch .dfchat-form { padding-right: 30px; }

/* CHAT-R2: THE BOX IS TWO COLUMNS - the conversation and who is in it.
   The roster is a SIBLING of the list rather than a floating panel, so
   it scrolls on its own and the box keeps one border and one corner
   radius however long either column gets. */
.dfchat-cols { display: flex; min-height: 0; }
.dfchat-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
/* CHAT-FIT: THE COLUMN DOES NOT SET THE BOX'S HEIGHT. .dfchat-cols is
   as tall as its tallest child and had no height of its own, so the
   roster - nineteen rows and growing - was the tallest child, the box
   grew with it and overflow-y: auto on the list never had anything to
   do. The column's content is ABSOLUTE inside it now: the column is
   exactly as tall as the conversation beside it, whatever the room
   holds, and the list scrolls inside that. */
.dfchat-who { flex: none; width: calc(148px * var(--dfchat-scale, 1)); border-left: 1px solid var(--iron, #2b323b); position: relative; min-height: 0; }
.dfchat-who-inner { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }
.dfchat-whohead { flex: none; padding: 6px 8px 4px; font-size: calc(11px * var(--dfchat-scale, 1)); letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #8b8578); }
.dfchat-wholist { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 14px; display: flex; flex-direction: column; gap: 1px; }
/* CHAT-FIT: A ROW IS ONE LINE. Title, name, glyphs and tag stand in a
   nowrap flex line; the NAME is the part that gives (ellipsis, the full
   name in its title), because a title and a glyph are a few pixels and
   the name is what the row is for. overflow-wrap: anywhere had every
   long name folding under its own title. The row itself stays a block,
   so SOC3's action menu opens UNDER the line and not beside it. */
.dfchat-who-row { font-size: calc(12px * var(--dfchat-scale, 1)); line-height: 1.35; color: var(--bone, #e9e4d9); }
.dfchat-who-line { display: flex; align-items: baseline; white-space: nowrap; min-width: 0; }
.dfchat-who-row.me .dfchat-who-name { color: #dcc27c; }
.dfchat-who-name { font-weight: 600; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dfchat-who-glyph, .dfchat-who-tag { flex: none; }
.dfchat-who-tag { color: var(--dim, #8b8578); font-size: calc(10px * var(--dfchat-scale, 1)); margin-left: 4px; }
/* ACC3c: the glyphs AFTER the name, the world label read left to right (TITLE-R: the roster wears no title). */
.dfchat-who-glyph { width: calc(11px * var(--dfchat-scale, 1)); height: calc(11px * var(--dfchat-scale, 1)); display: inline-block; vertical-align: -1px;
  margin-left: 3px; }
/* CHAT-FIT: the same badge on a chat LINE - the title before the name
   at the tag's size, the glyphs after it at the roster's size. */
.dfchat-line-title { font-size: calc(10px * var(--dfchat-scale, 1)); letter-spacing: .05em; text-transform: uppercase; margin-right: 4px; }
.dfchat-line-glyph { width: calc(11px * var(--dfchat-scale, 1)); height: calc(11px * var(--dfchat-scale, 1)); display: inline-block; vertical-align: -1px; margin-left: 3px; }
/* GUILD1c: the guild's tag right of the name, before the glyphs - the name layer's own steel, on a line and in the roster */
.dfchat-line-guild, .dfchat-who-guild { flex: none; color: #a9c4dd; font-size: calc(10px * var(--dfchat-scale, 1)); letter-spacing: .04em; margin-left: 4px; }
.dfchat-who-more { font-size: calc(11px * var(--dfchat-scale, 1)); color: var(--dim, #8b8578); padding-top: 4px; }
/* the roster is the first thing to go when there is no width for it */
@media (max-width: 560px) { .dfchat-who { display: none; } }

/* SOC3: THE SOCIAL BUTTON, IN BOTH STATES - one class in two places,
   so the badge's law is written once. Closed it stands beside the Chat
   button, and unlike that one it is drawn on a DESKTOP too: Enter
   opens the chat and until SOC5 nothing opens the social panel, so a
   button that only existed on a touch device would be the feature's
   only door on half the machines. Open it sits at the far end of the
   tab bar, where an MMO puts it. */
/* AUDIT SOC C24: the closed-state Social button stands on the Chat button's own line, so it wears the Chat button's
   own font-size and padding (14px / 6px 10px - .dfchat-open, in the shared rule above) instead of a smaller pair
   that made the two different heights, and the Chat button carries a 6px right margin so they are not flush. */
.dfchat-social { background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit;
  font-size: 14px; padding: 6px 10px; cursor: pointer; align-items: center; }
.dfchat.touch .dfchat-open { margin-right: 6px; }
.dfchat-social-out { display: inline-flex; pointer-events: auto; margin-top: 4px; }
.dfchat[data-state="open"] .dfchat-social-out { display: none; }
.dfchat-social-tab { display: inline-flex; margin: 2px 4px 4px auto; }
/* a request waiting on YOU is not an unread line: its own colour, so the two badges never read as one count */
.dfchat-social .dfchat-badge { background: #c8503c; color: #f6efe2; }

/* SOC3: A ROSTER ROW IS A DOOR (Mac: "invite friends or other
   individuals"). The "other individuals" are the names in this column,
   so a click on one opens a small menu of what can be done with that
   peer; what cannot carries the reason as its title rather than
   vanishing, because a missing button teaches nothing.

   MAC-J (2026-09-17, Mac: "the online section where player's names are
   shown are too large and shouldn't be large rectangles"): the marker
   class is dfchat-act, and the prefix is the whole fix. It was a bare
   "act" - and .act is the ENHANCED SKIN'S BUTTON (ui/enhancedStyle.js:
   padding 12px 20px, a 1px iron border, min-height 46px), which is
   loaded in every online game because online forces the enhanced lane
   (OL1). So every name a player could click wore a 46px bordered
   button: four names filled the column, and the one name that is never
   a door - your own - sat 16px high beside them, which is how the
   collision reads as "too large" rather than as a style. Every other
   class in this sheet was already prefixed; this one was the
   exception, and an unprefixed class in a sheet that shares a document
   with another sheet is a collision waiting for the other sheet to
   grow the name. */
.dfchat-who-row.dfchat-act { cursor: pointer; }
.dfchat-rowmenu { display: flex; flex-direction: column; gap: 2px; padding: 3px 0 4px; }
.dfchat-rowbtn { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit;
  font-size: 11px; text-align: left; padding: 3px 6px; cursor: pointer; }
/* THE LABEL AND ITS REASON WRAP (tools/font1Probe.mjs's touch spill, older than the community arc): a row button is one
   line of a label and, when the act is refused, its reason beside it (AUDIT SOC C11) - in a roster column 148px wide at
   the chat's own scale. On the touch skin the label is 13px for a thumb (AUDIT SOC C8) and "Invite to party" beside
   "already in a party" is 94px of text in an 89px box, so it ran out of the button. The reason drops under the label
   when the two do not fit, and a label wider than the column breaks at its spaces. */
.dfchat-rowbtn[disabled] { opacity: .45; cursor: default; }
/* AUDIT SOC C11: the reason a row is dead, drawn beside its label - a title is a hover, and a finger cannot hover. */
.dfchat-rowwhy { font-size: 10px; font-style: italic; color: var(--dim, #8b8578); margin-left: auto; }
/* AUDIT SOC C8: the finger's own sizes for the two controls SOC3 added to this panel - the Social button (23 tall)
   and a roster row's menu buttons (18) - on the touch skin alone, where every one of them is pressed by a thumb. */
.dfchat.touch .dfchat-social { min-height: 44px; }
.dfchat.touch .dfchat-who-row.dfchat-act { min-height: 44px; padding: 12px 0 0; }
.dfchat.touch .dfchat-rowbtn { min-height: 44px; font-size: 13px; padding: 8px 8px; }

/* CHAT-R2: HIDDEN. Not display:none on the root - the panel must
   keep its listeners and its log - but every VISIBLE part away, with
   one small control left to bring it back. */
.dfchat-hide { padding: 2px 8px; font-size: 12px; }
.dfchat-show { display: none; pointer-events: auto; align-self: flex-start; font-size: 12px; padding: 4px 10px; }
.dfchat[data-hidden="1"] .dfchat-peek,
.dfchat[data-hidden="1"] .dfchat-hint,
.dfchat[data-hidden="1"] .dfchat-open,
.dfchat[data-hidden="1"] .dfchat-status,
.dfchat[data-hidden="1"] .dfchat-social-out,
.dfchat[data-hidden="1"] .dfchat-box { display: none; }
.dfchat[data-hidden="1"] .dfchat-show { display: inline-flex; }
`;

/** The sheet, once. */
export function injectChatStyle(doc = document) {
  if (doc.getElementById?.(CHAT_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = CHAT_STYLE_ID;
  el.textContent = CHAT_CSS;
  (doc.head ?? doc.body).append(el);
}

/** HH:MM of a stamp, for the open list. */
export const clockOf = (at) => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** The action a keydown resolves to through the registry (the default; the tests hand their own in). */
export const actionOfKey = (e) => (codeMeans(bindings(), e.code, CHAT_OPEN_ACTION) ? CHAT_OPEN_ACTION : actionForCode(bindings(), e.code));   // UXB1-S: the chat's key opens it, shared or not

/** Is this keydown the one that opens the panel: the cursor key (CHAT_OPEN_ACTION), unmodified, not a repeat,
 *  the keyboard's own, owned by no field and no overlay, the host willing? */
export function isOpenKey(e, { canOpen = () => true, overlay = overlayOpen, action = actionOfKey } = {}) {
  return action(e) === CHAT_OPEN_ACTION && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat && e.isTrusted !== false
    && !isTextEntryTarget(e.target) && !overlay() && !!canOpen();
}

/**
 * The panel over `log` (net/chat.js). `onSend(tabId, text)` takes a
 * typed line and answers false when it did not go (the field keeps
 * it), or - CHAT-CHAN - 'read' when what it did is lines to READ (the
 * command list): the field clears and the chat stays open, where any
 * other answer closes it; `canOpen()` is the host's word on whether the game can take a
 * chat right now; `onOpen`/`onClose` are the host's pointer-lock door
 * (release on open, take back on close - inside the gesture). Handed
 * the document and the window so the tests drive it headless.
 *
 * SOC3's three, all optional and all the HOST's answers (see the
 * header): `social` is `{ onToggle, pending }` - the button beside the
 * chat's controls and the number on its badge; `nameColor(peerId)` is
 * a CSS colour or null for an author's name and a roster row;
 * `rowActions(peerId)` is `[{ label, enabled, why, run }]` - the menu a
 * click on a roster row opens.
 *
 * AUDIT SOC C2/C14: `above()` is the host's word on whether a social
 * surface stands OVER the chat (the friends panel, the F-menu). All
 * three listen for Escape on the window in capture, so ONE press used
 * to close two of them. The topmost answers: with something above it
 * the chat IGNORES Escape - it does not close and it does not stop the
 * key - and when it does handle one it calls stopImmediatePropagation,
 * so neither a sibling surface nor the host's pause door sees it.
 */
export function createChatPanel({ log, onSend, roster = null, canOpen = () => true, onOpen = null, onClose = null, above = () => false, action = actionOfKey, overlay = overlayOpen, doc = document, win = globalThis, touch = isTouchDevice(), social = null, nameColor = null, rowActions = null, badgeOf = null } = {}) {
  injectChatStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', `dfchat${touch ? ' touch' : ''}`);
  root.dataset.state = 'closed';
  const peek = el('div', 'dfchat-peek');
  const hint = el('div', 'dfchat-hint', 'Enter to chat');
  const status = el('div', 'dfchat-status');
  const openBtn = el('button', 'dfchat-open', 'Chat');
  openBtn.type = 'button';
  const badgeOut = el('span', 'dfchat-badge');
  openBtn.append(badgeOut);
  const box = el('div', 'dfchat-box');
  box.setAttribute('role', 'log');
  const tabs = el('div', 'dfchat-tabs');
  const list = el('div', 'dfchat-list');
  const jump = el('button', 'dfchat-jump');   // CHAT-SCROLL: `N new - jump to newest`, under a reader who scrolled up
  jump.type = 'button';
  const form = el('form', 'dfchat-form');
  const input = el('input', 'dfchat-input');
  input.type = 'text'; input.maxLength = CHAT_MAX; input.placeholder = 'Say something'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label', 'Chat');
  const send = el('button', 'dfchat-send', 'Send'); send.type = 'submit';
  const close = el('button', 'dfchat-close', '✕'); close.type = 'button';
  close.setAttribute('aria-label', 'Close chat');
  // CHAT-SIZE: the corner the box is dragged from - the last thing in the form's row, so it stands at the box's corner
  const grip = el('div', 'dfchat-grip');
  grip.tabIndex = 0;
  grip.setAttribute('role', 'button');
  grip.setAttribute('aria-label', 'Resize chat');
  grip.setAttribute('title', 'Drag to resize - wider is larger text, taller is more lines. Double-click for the usual size.');
  const hide = el('button', 'dfchat-hide', 'Hide'); hide.type = 'button';
  hide.setAttribute('aria-label', 'Hide chat');
  const show = el('button', 'dfchat-show', 'Chat'); show.type = 'button';
  show.setAttribute('aria-label', 'Show chat');
  // EMOTE1 (Addison Knox: "Emotes, be it emojis ..."): THE PICKER - a button in the form and a grid over it. Every
  // listener is the element's own (the panel keeps its one window listener, AUDIT CHAT D5): a pick lands at the caret
  // and closes the grid, the button toggles it, and Escape in the field and the panel's close take it down.
  const emojiBtn = el('button', 'dfchat-emoji', '\u{1F642}'); emojiBtn.type = 'button';
  emojiBtn.setAttribute('aria-label', 'Emoji'); emojiBtn.title = 'Emoji - or type a shortcode like :smile:';
  const emojiGrid = el('div', 'dfchat-emojis');
  emojiGrid.setAttribute('role', 'group'); emojiGrid.setAttribute('aria-label', 'Emoji');   // a set of buttons - a listbox's children would have to be options
  const picked = new Set();
  for (const [code, ch] of SHORTCODE_LIST) {   // one button an emoji, named by its FIRST code, in the table's order
    if (picked.has(ch)) continue;
    picked.add(ch);
    const b = el('button', 'dfchat-emoji-pick', ch); b.type = 'button';
    b.title = `:${code}:`; b.setAttribute('aria-label', code.replace(/_/g, ' '));
    b.addEventListener('click', () => { insertAtCaret(ch); setEmojiOpen(false); });
    emojiGrid.append(b);
  }
  form.append(input, emojiBtn, send, hide, close);
  // CHAT-R2: the two columns. `main` holds what was there before, so
  // nothing about the list, the tabs or the form moved; `who` is new
  // beside it and scrolls on its own.
  let emojiOpen = false;
  const setEmojiOpen = (on) => {
    emojiOpen = !!on;
    const cls = emojiOpen ? 'dfchat-emojis on' : 'dfchat-emojis';
    if (emojiGrid.className !== cls) emojiGrid.className = cls;
    emojiBtn.setAttribute('aria-expanded', emojiOpen ? 'true' : 'false');
  };
  /** EMOTE1: the pick into the field where the caret stands (or at its end), the caret after it, the field bounded. */
  const insertAtCaret = (ch) => {
    const v = String(input.value ?? '');
    const a = Number.isInteger(input.selectionStart) ? input.selectionStart : v.length;
    const b = Number.isInteger(input.selectionEnd) ? input.selectionEnd : a;
    const next = v.slice(0, a) + ch + v.slice(b);
    if (next.length > CHAT_MAX) return;
    input.value = next;
    const at = a + ch.length;
    input.setSelectionRange?.(at, at);
    input.focus?.();
  };
  emojiBtn.addEventListener('click', () => { setEmojiOpen(!emojiOpen); input.focus?.(); });
  const cols = el('div', 'dfchat-cols');
  const main = el('div', 'dfchat-main');
  const who = el('div', 'dfchat-who');
  const whoHead = el('div', 'dfchat-whohead', rosterTitle(0));
  const whoList = el('div', 'dfchat-wholist');
  const whoMore = el('div', 'dfchat-who-more');
  const whoInner = el('div', 'dfchat-who-inner');   // CHAT-FIT: absolute inside the column, so the column takes the conversation's height and not the room's
  whoInner.append(whoHead, whoList, whoMore);
  who.append(whoInner);
  const tabButtons = new Map();
  const tabList = el('div', 'dfchat-tablist');   // CHAT-CHAN: the tabs' own strip - the Social button stands beside it, in the bar
  for (const tab of log.tabs) {
    const b = el('button', 'dfchat-tab', tab.label);
    b.type = 'button'; b.dataset.tab = tab.id;
    const badge = el('span', 'dfchat-badge');
    badge.setAttribute('aria-hidden', 'true');   // CHAT-CHAN: a dot to the eye - the count is the button's name (paint)
    b.append(badge);
    b.addEventListener('click', () => { log.select(tab.id); paint(); input.focus?.(); });
    tabList.append(b);
    tabButtons.set(tab.id, { b, badge, name: null });
  }
  tabs.append(tabList);
  // SOC3: the two Social buttons - one for each state of the panel, built only when the host asked for them. The
  // badge is a SPAN of the chat's own badge class, so a request waiting on the player counts the way an unread line
  // does; its colour in the sheet is what keeps the two from reading as one number.
  const socialBadges = [];
  const socialButton = (cls) => {
    const b = el('button', `dfchat-social ${cls}`, 'Social');
    b.type = 'button';
    // AUDIT SOC C21: NO aria-label ON THE BUTTON. One overrode the whole of its content, so the badge - the count of
    // requests and invitations waiting on this player, the only thing on the button that ever changes - was read as
    // "Friends and party" and nothing else. The word stays a title for the mouse; the badge names ITSELF, and the
    // button's accessible name becomes "Social 3" the moment there is a 3.
    b.setAttribute('title', 'Friends and party');
    const badge = el('span', 'dfchat-badge');
    b.append(badge); socialBadges.push(badge);
    b.addEventListener('click', () => social.onToggle?.());
    return b;
  };
  const socialOut = social ? socialButton('dfchat-social-out') : null;
  if (social) tabs.append(socialButton('dfchat-social-tab'));
  main.append(list, jump, emojiGrid, form);
  cols.append(main, who);
  box.append(tabs, cols, grip);   // CHAT-SIZE: the grip stands at the BOX's corner, over both columns
  // the Social button follows the Chat button (they share a line when both are drawn); `show` and the box keep their places
  root.append(peek, hint, status, openBtn, ...(socialOut ? [socialOut] : []), show, box);
  doc.body.append(root);

  let painted = -1;
  let socialBadgeLabel = null;   // SOC3/C21: the badge's last spoken label, so the attribute is written on a change
  let peekNodes = [];
  let listNodes = [];      // the open list's rows, in order: [{ seq, node }] - grown, not rebuilt (AUDIT CHAT C8)
  let listTab = null;
  let alive = true;
  // CHAT-R2: hidden across sessions - a player who puts the chat away
  // wants it away next time too, not one reload later.
  let hidden = getPref('chatHidden') === true;
  let whoRows = [];        // the drawn rows, keyed so an unchanged roster repaints nothing
  let whoKey = '';
  let whoNames = [];       // SOC3: [{ id, nameEl, css }] - the roster's name spans, for the colour pass
  let menuFor = null;      // SOC3: the roster row whose action menu is open (a peer id), or null
  let unseen = 0;          // CHAT-SCROLL: lines that arrived below a reader who had scrolled up

  /** CHAT-SCROLL: is the open list read at its bottom - measured only while the list is SHOWN (an open's first paint
   *  never asks it: see the header), within the 8px a wrapped line's rounding leaves. */
  const atNewest = () => (list.scrollHeight - list.scrollTop - (list.clientHeight ?? 0)) <= 8;
  /** CHAT-SCROLL: the bar under the list - drawn only while there is something below the reader. */
  const paintJump = () => {
    const on = log.open && unseen > 0;
    const text = on ? `${unseen} new - jump to newest` : '';
    if (jump.textContent !== text) jump.textContent = text;
    const cls = on ? 'dfchat-jump on' : 'dfchat-jump';
    if (jump.className !== cls) jump.className = cls;
  };
  /** CHAT-SCROLL: to the newest line, and nothing is left unseen below it. */
  const toNewest = () => { list.scrollTop = list.scrollHeight ?? 0; unseen = 0; paintJump(); };

  // CHAT-SIZE: the player's two numbers - the box's width and the list's height, CSS pixels, null for the sheet's own.
  // They are written as the custom properties the sheet reads, on the DOCUMENT (the friends panel places itself off the
  // same two), falling back to the panel's own root where a document has no element of its own (the tests' fakes).
  const sizeOf = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  let sizeW = sizeOf(getPref('chatWidth'));
  let sizeH = sizeOf(getPref('chatListHeight'));
  let fit = null;
  const docEl = doc.documentElement ?? null;
  const vw = () => Number(win.innerWidth) || 1280;
  const vh = () => Number(win.innerHeight) || 800;
  const clampW = (w) => Math.round(Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, w)));
  const clampH = (h) => Math.round(Math.max(CHAT_LIST_MIN, Math.min(h, vh() * CHAT_LIST_MAX_VH / 100)));
  const setVar = (k, v) => { const st = docEl?.style ?? root.style; if (v == null) st.removeProperty?.(k); else st.setProperty?.(k, v); };
  /** The friends panel's side of the chat, said once per change. */
  const publishFit = () => {
    const next = chatFit(vw(), sizeW);
    if (next === fit) return;
    fit = next;
    docEl?.setAttribute?.('data-dfchat-fit', fit);
  };
  const applySize = () => {
    setVar('--dfchat-w', sizeW == null ? null : `${sizeW}px`);
    setVar('--dfchat-scale', sizeW == null ? null : String(Math.round(chatScaleFor(sizeW) * 1000) / 1000));
    setVar('--dfchat-list-h', sizeH == null ? null : `min(${sizeH}px, ${CHAT_LIST_MAX_VH}vh)`);
    publishFit();
  };
  const keepSize = () => { setPref('chatWidth', sizeW); setPref('chatListHeight', sizeH); };
  /** The size a drag or a key starts from: the player's, or the box as the sheet drew it. */
  const widthNow = () => sizeW ?? clampW(Math.min(CHAT_WIDTH_BASE, vw() - 28));
  /** The list's own padding, top and bottom: its clientHeight carries it, and the height the sheet sets does not. */
  const listPadY = () => { try { const cs = win.getComputedStyle?.(list); return cs ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) : 0; } catch { return 0; } };
  const listNow = () => sizeH ?? clampH((Number(list.clientHeight) || Math.min(220, vh() * 0.34)) - listPadY());
  /** To a size, keeping a reader who was on the newest line on it (a list that shrinks under them hides it). */
  const resizeTo = (w, h, follow) => {
    sizeW = clampW(w); sizeH = clampH(h);
    applySize();
    if (follow) list.scrollTop = list.scrollHeight ?? 0;
  };
  const resetSize = () => { sizeW = null; sizeH = null; applySize(); keepSize(); if (log.open && unseen === 0) list.scrollTop = list.scrollHeight ?? 0; };
  let drag = null;   // { id, x, y, w, h, follow } while the grip is held
  applySize();

  /** A drawn line, and the span its AUTHOR's name is in - SOC3 colours that span from the host's `nameColor` without
   *  rebuilding the row, so a party formed while the chat is open turns the names green where they already stand. */
  /** ACC3c / CHAT-FIT: ONE GLYPH AS AN SVG - the roster's drawing, shared with the chat line. Null where the
   *  document has no SVG door: such a document draws NO glyph rather than throwing under somebody's name. */
  const glyphSvg = (g, cls) => glyphSvgNode(doc, g, cls);   // INSPECT1: the one drawing, ui/playerBadge.js - shared with the name over a head and the profile card
  const titleSpan = (badge, cls) => { const t = el('span', cls, badge.text); t.style.color = cssRgba(badge.rgba) ?? ''; return t; };
  /** CHAT-FIT: the badge nodes a chat line's author wears - the title BEFORE the name, the glyphs AFTER it, the
   *  roster row's own order (ACC3c) - for a { title, glyphs } record, or none for null. */
  const badgeNodes = (peer, prefix) => {
    const badge = titleBadge(peer);
    const before = badge ? [titleSpan(badge, `${prefix}-title`)] : [];
    const after = [];
    const gt = guildTagText(peer?.gt);   // GUILD1c: the guild's tag first after the name, before the glyphs
    if (gt) after.push(el('span', `${prefix}-guild`, gt));
    for (const g of glyphBadges(peer)) { const svg = glyphSvg(g, `${prefix}-glyph`); if (!svg) break; after.push(svg); }
    return { before, after };
  };
  const badgeKeyOf = (b) => (b ? `${b.title ?? ''}|${(Array.isArray(b.glyphs) ? b.glyphs : []).join('+')}|${b.gt ?? ''}` : '');   // GUILD1c: a tag that moved re-lays the line
  /** CHAT-FIT: a line is laid from its PARTS - time, the badge's title, the name, the badge's glyphs, the tag, the
   *  text - so the badge pass can re-lay one line when its author's badge changes, without rebuilding the list. */
  const layLine = (r) => { r.node.replaceChildren(...[r.chan, r.time, ...r.before, r.nameEl, ...r.after, r.tag, r.text].filter(Boolean)); };
  /** CHAT-CHAN: the mark a PEEK line wears when it was said on a tab other than the one the chat opens on - the
   *  peek is every tab's (net/chat.js peek), and a line with no mark is the open tab's own. A line the game said on
   *  every tab (`tab` null) is everybody's and wears none. */
  const chanOf = (line) => {
    const tab = line.tab === log.active ? null : log.tab(line.tab);   // the game's line has no tab of its own (`tab` null): none
    if (!tab) return null;
    const c = el('span', 'dfchat-chan', tab.label);
    c.dataset.tab = tab.id;
    return c;
  };
  const lineNode = (line, withTime, withChan = false) => {
    const n = el('div', `dfchat-line${line.mine ? ' mine' : ''}${line.system ? ' system' : ''}${line.red ? ' red' : ''}${line.dm ? ' dm' : ''}${line.kind === 'ooc' ? ' ooc' : ''}${line.kind === 'roll' ? ' roll' : ''}${line.kind === 'me' ? ' me' : ''}`);
    const chan = withChan ? chanOf(line) : null;
    if (chan) n.append(chan);
    const time = withTime ? el('span', 'dfchat-time', clockOf(line.at)) : null;
    if (time) n.append(time);
    // SRV-N: a notice is NOT ATTRIBUTED. No name and no `#tag`, because
    // both are the marks of a person having spoken - a notice drawn with
    // them would read as a player called 'Server' with a tag of its own,
    // and the tag would be `tagOf('')`: a real-looking four-character
    // hash off an empty id, identical on every notice and therefore
    // exactly the thing a player could be fooled by. Its own colour
    // instead, which is a mark no player's line can wear.
    if (line.system) { const text = el('span', 'dfchat-text', line.text); n.append(text); return { node: n, chan, time, nameEl: null, tag: null, text }; }
    const nameEl = el('span', 'dfchat-name', line.name || '?'), tag = el('span', 'dfchat-tag', `#${tagOf(line.id)}`), text = el('span', 'dfchat-text', line.text);
    n.append(nameEl, tag, text);
    return { node: n, chan, time, nameEl, tag, text };
  };
  /** One drawn row of the two line lists: the node, its parts, and the record the colour and badge passes walk.
   *  `badgeKey` starts null so the first pass lays the badge the author wears NOW (or none), and after that only a
   *  change touches the line. */
  const lineRow = (line, withTime, extra, withChan = false) => {
    const parts = lineNode(line, withTime, withChan);
    return { ...parts, id: line.id, css: null, badgeKey: null, before: [], after: [], ...extra };
  };

  /**
   * SOC3 (Mac: "the players name who are in a party together should
   * turn green"): THE COLOUR PASS.
   *
   * Who is in my party is the HUB's word (net/social.js isPartyPeer),
   * which this file cannot see and must not cache - a seat can change
   * between two frames with no line said and no peer joining, so a
   * colour baked in at build time would be wrong until the next
   * message. So the spans that are drawn are asked again each pass and
   * the ones whose answer did not change are not touched at all - the
   * same law the roster column repaints under (CHAT-R2).
   *
   * The answer is cached PER PEER ID for the pass: two hundred rows are
   * a handful of distinct authors, and `nameColor` walks the party's
   * seats on every call.
   */
  const paintNames = () => {
    if (nameColor) {
      const asked = new Map();
      const of = (id) => { if (!asked.has(id)) asked.set(id, nameColor(id) || ''); return asked.get(id); };
      const pass = (rows) => { for (const r of rows) { if (!r.nameEl) continue; const css = of(r.id); if (r.css === css) continue; r.css = css; r.nameEl.style.color = css; } };
      pass(listNodes); pass(peekNodes); pass(whoNames);
    }
    paintBadges();
  };
  /** CHAT-FIT: THE BADGE PASS over the two line lists, on the colour pass's law - the host is asked once per author
   *  per pass, and a line is re-laid only when its author's badge CHANGED (the first pass lays what the author wears
   *  now, which for most lines is nothing and costs one replaceChildren). Without `badgeOf` no line wears one. */
  const paintBadges = () => {
    if (!badgeOf) return;
    const asked = new Map();
    const of = (id) => { if (!asked.has(id)) asked.set(id, badgeOf(id) ?? null); return asked.get(id); };
    // CHAT-SCROLL: a badge laid into an OPEN list's line can wrap it, and the growth pushes the newest line out of
    // view under a reader who was reading it - so the reader's place is measured before the first such re-lay and
    // the bottom is kept after the pass. Measured once, and only when a list line is actually re-laid.
    let keep = null;
    const pass = (rows, inList) => {
      for (const r of rows) {
        if (!r.nameEl) continue;
        const b = of(r.id), key = badgeKeyOf(b);
        if (r.badgeKey === key) continue;
        if (inList && keep === null) keep = log.open && unseen === 0 && atNewest();
        r.badgeKey = key;
        ({ before: r.before, after: r.after } = badgeNodes(b ?? {}, 'dfchat-line'));
        layLine(r);
      }
    };
    pass(listNodes, true); pass(peekNodes, false);
    if (keep) list.scrollTop = list.scrollHeight ?? 0;
  };

  /** SOC3: the badge on both Social buttons - what is waiting on the player (requests to me + live invites). */
  const paintSocial = () => {
    if (!social) return;
    const n = Number(social.pending?.() ?? 0);
    const text = Number.isFinite(n) && n > 0 ? String(n) : '';
    // C21: the badge says what its number MEANS, so "3" is not read out as a bare digit beside "Social". Written on
    // a CHANGE, like everything else on this frame - `setAttribute` is a write whatever the value.
    const label = text ? `${text} waiting` : '';
    const moved = label !== socialBadgeLabel;
    socialBadgeLabel = label;
    for (const b of socialBadges) {
      if (b.textContent !== text) b.textContent = text;
      if (moved) b.setAttribute('aria-label', label);
    }
  };

  /** The open list: the rows that left the cap dropped from the front, the rows that arrived appended at the
   *  back, and the scroll kept where the reader had it unless it sat at the bottom (AUDIT CHAT C8: every line
   *  rebuilt two hundred rows and yanked a reader who had scrolled up). A tab change rebuilds.
   *
   *  CHAT-SCROLL: answers whether the list FOLLOWS - lands on its newest line once the paint is done (the paint's
   *  last act, after the passes that can grow a line). `newest` is an open's: the list was hidden until this paint,
   *  and what it remembers of the reader's place is the engine's, not the reader's. A tab change is another
   *  conversation and starts at its newest too. Otherwise the reader's place is measured BEFORE the new rows go in. */
  const paintList = (newest = false) => {
    const tab = log.tab(log.active);
    const msgs = tab ? tab.messages : [];
    const follow = newest || listTab !== log.active || !listNodes.length || atNewest();
    const contiguous = listTab === log.active && listNodes.length && msgs.length && msgs.some((m) => m.seq === listNodes[listNodes.length - 1].seq);
    let arrived = 0;
    if (!contiguous) {
      listNodes = msgs.map((line) => lineRow(line, true, { seq: line.seq }));
      list.replaceChildren(...listNodes.map((r) => r.node));
    } else {
      while (listNodes.length && listNodes[0].seq < msgs[0].seq) listNodes.shift().node.remove();
      const lastSeq = listNodes.length ? listNodes[listNodes.length - 1].seq : -1;
      for (const line of msgs) if (line.seq > lastSeq) { const row = lineRow(line, true, { seq: line.seq }); listNodes.push(row); list.append(row.node); arrived++; }
    }
    listTab = log.active;
    if (!follow) unseen += arrived;   // C8 stands: the reader keeps their place, and the bar counts what came in under it
    return follow;
  };

  /**
   * SOC3: the menu under an opened roster row. Every label, its enabled
   * state and the REASON a disabled one carries come from the host
   * (net/social.js actionsFor), so this file decides nothing about who
   * may be friended or invited - it draws an answer and calls back.
   *
   * A refused act is a SENTENCE, never a missing button: "already
   * friends" and "the party is full" are the two things a player most
   * wants to be told, and a row that silently drops the option teaches
   * neither. AUDIT SOC C11: the sentence is DRAWN beside the label as
   * well as titled - a `title` is a mouse hover, and the touch skin
   * this panel also runs in has no hover at all.
   */
  const rowMenu = (peerId) => {
    const menu = el('div', 'dfchat-rowmenu');
    for (const a of rowActions(peerId) ?? []) {
      const b = el('button', 'dfchat-rowbtn', String(a.label ?? ''));
      b.type = 'button';
      if (a.enabled === false) {
        b.disabled = true;
        if (a.why) { b.setAttribute('title', String(a.why)); b.append(el('span', 'dfchat-rowwhy', String(a.why))); }
      } else b.addEventListener('click', (e) => { e.stopPropagation?.(); a.run?.(); menuFor = null; paintWho(); });
      menu.append(b);
    }
    return menu;
  };

  /**
   * CHAT-R1/R2: WHO IS HERE. The order is net/roster.js's, not this
   * file's - the panel only draws it.
   *
   * REPAINTED ON A CHANGE, NOT EVERY FRAME. `render` runs each frame
   * and a peer's pose moves constantly, so the rows are keyed by what
   * is actually DRAWN (id, name, self) and an unchanged key touches no
   * DOM at all. Without that, a reader's scroll in this column would
   * be fighting a rebuild sixty times a second.
   */
  const paintWho = () => {
    if (!roster) { who.style.display = 'none'; return; }
    const { rows, total, shown, label } = rosterRows(roster());
    // SOC3: the open menu is part of what is DRAWN, so it joins the key - a roster that did not change still has to
    // repaint when a row is opened or closed, and nothing else about this law moved.
    // ACC3c: THE BADGE JOINS THE KEY. This list repaints only when the
    // key moves, so a sprout that aged out would otherwise sit on
    // screen, stale, until somebody else joined the room - the same
    // reason SOC3 put the open menu in here. TITLE-R: the glyphs alone,
    // as the row draws them.
    // CHAT-CHAN: and the list's own word - a tab change can bring the same people under another heading
    const key = label + '|' + total + '|' + (menuFor ?? '') + '|' + rows.map((r) => r.id + ':' + r.name + ':' + (r.me ? 1 : 0) + ':' + (r.glyphs ?? []).join('+') + ':' + (r.gt ?? '')).join(',');   // GUILD1c: and the guild's tag
    if (key === whoKey) return;
    whoKey = key;
    whoHead.textContent = rosterTitle(total, label);
    // ROSTER-G (Mac: "the roster naming itself seems hardcoded"): the #tag is the tie-breaker for two players with ONE
    // name (net/roster.js's second sort clause, the chat line's own suffix), and it read as a fixed code stuck to every
    // name. It is drawn only where it does that work - beside a name another row shares.
    const dup = new Set(); const seen = new Set();
    for (const r of rows) { const k = r.name.toLowerCase(); if (seen.has(k)) dup.add(k); seen.add(k); }
    whoNames = [];
    whoRows = rows.map((r) => {
      // SOC3: a row is a door for everyone but ME - "Add friend" on my own name is the one action that can never mean
      // anything, and net/social.js would refuse it in words a player should not have to read. A host whose picture
      // is not up yet (no account, no hub) offers nothing, and a row with nothing behind it is not a door either.
      const acts = !!rowActions && !r.me && (rowActions(r.id) ?? []).length > 0;
      const n = el('div', 'dfchat-who-row' + (r.me ? ' me' : '') + (acts ? ' dfchat-act' : ''));   // MAC-J: prefixed, because a bare `act` IS the enhanced skin's button
      const nameEl = el('span', 'dfchat-who-name', r.name);
      nameEl.title = r.name;   // CHAT-FIT: the row is one line and a long name is cut with an ellipsis; the whole of it is a hover away
      whoNames.push({ id: r.id, nameEl, css: null });
      // CHAT-FIT: the row's ONE LINE - name, glyphs, tag in a nowrap flex line the name gives way in; the row itself
      // stays a block so SOC3's menu opens under it.
      const line = el('div', 'dfchat-who-line');
      // TITLE-R (2026-09-24, Mac: "Titles shouldnt show in the online panel. Only glyphs. Titles should remain over
      // names and within chat itself"): the roster is a list of who is here - the glyphs AFTER the name are what is
      // true of each; the title a player chose to wear is theirs to show over their head and beside their lines.
      line.append(nameEl);
      const gt = guildTagText(r.gt);   // GUILD1c: the guild's tag right of the name, as over a head
      if (gt) line.append(el('span', 'dfchat-who-guild', gt));
      for (const g of glyphBadges(r)) {
        const svg = glyphSvg(g, 'dfchat-who-glyph');
        if (!svg) break;   // a document that cannot make one draws none, rather than throwing in a repaint
        line.append(svg);
      }
      if (dup.has(r.name.toLowerCase())) line.append(el('span', 'dfchat-who-tag', '#' + r.tag));
      n.append(line);
      if (acts) {
        n.addEventListener('click', () => { menuFor = menuFor === r.id ? null : r.id; paintWho(); });
        if (menuFor === r.id) n.append(rowMenu(r.id));
      }
      return n;
    });
    whoList.replaceChildren(...whoRows);
    // a cut list says so rather than quietly under-reporting the room
    whoMore.textContent = total > shown ? '+' + (total - shown) + ' more' : '';
    paintNames();   // SOC3: the spans are new, so the colours they wear are asked for once, here
  };

  /** `newest` (CHAT-SCROLL): an open's paint - the list lands on its newest line whatever the hidden box kept. */
  const paint = (newest = false) => {
    painted = log.version;
    root.dataset.state = log.open ? 'open' : 'closed';
    root.dataset.hidden = hidden ? '1' : '0';
    for (const tab of log.tabs) {
      const t = tabButtons.get(tab.id);
      const display = tab.shown ? '' : 'none';   // CHAT-P: a tab off the bar (the Party tab outside a party) is not drawn
      if (t.b.style.display !== display) t.b.style.display = display;
      t.b.className = `dfchat-tab${tab.id === log.active ? ' active' : ''}`;
      t.badge.textContent = tab.unread ? String(tab.unread) : '';
      // CHAT-CHAN: who a tab reaches, a hover away - and the place a moving channel is (the Region tab's region)
      const title = tab.place ? `${tab.place} - ${tab.hint ?? ''}` : (tab.hint ?? '');
      if (t.b.title !== title) t.b.title = title;
      // CHAT-CHAN: and the unread count is the tab's spoken NAME - the eye gets a dot (the sheet), a reader the number
      const name = tab.unread ? `${tab.label}, ${tab.unread} unread` : tab.label;
      if (t.name !== name) { t.name = name; t.b.setAttribute('aria-label', name); }
    }
    // CHAT-CHAN: the field says where a line typed into it goes
    const on = log.tab(log.active);
    const ph = on ? `Say something - ${on.place ?? on.label}` : 'Say something';
    if (input.placeholder !== ph) input.placeholder = ph;
    const unread = log.unreadTotal();
    badgeOut.textContent = unread ? String(unread) : '';
    let follow = false;
    if (log.open) { follow = paintList(newest); paintWho(); }
    peekNodes = [];
    peek.replaceChildren();
    paintSocial();   // SOC3
    paintNames();
    // CHAT-SCROLL: LAST, after the badge pass - a title laid into a new line can wrap it, and a scroll taken before
    // that growth left the newest line under the fold
    if (follow) toNewest(); else paintJump();
  };

  /** The closed state's lines: rebuilt when the set changes, their alpha stepped every frame. */
  const paintPeek = () => {
    const shown = log.open ? [] : log.peek();
    if (shown.length !== peekNodes.length || shown.some((p, i) => peekNodes[i].line !== p.line)) {
      peekNodes = shown.map((p) => lineRow(p.line, false, { line: p.line, alpha: -1 }, true));
      peek.replaceChildren(...peekNodes.map((p) => p.node));
    }
    for (let i = 0; i < shown.length; i++) {
      const a = Math.round(shown[i].alpha * 20) / 20;
      if (peekNodes[i].alpha !== a) { peekNodes[i].alpha = a; peekNodes[i].node.style.opacity = String(a); }
    }
  };

  const open = () => {
    if (!alive || log.open || !canOpen()) return false;
    log.setOpen(true);
    paint(true);   // CHAT-SCROLL: an open lands on the newest line
    input.focus?.();
    onOpen?.();   // the host frees the pointer (C2) - inside the gesture that opened
    return true;
  };
  const closePanel = () => {
    if (!alive || !log.open) return false;
    setEmojiOpen(false);   // EMOTE1: the picker goes with the panel
    log.setOpen(false);
    input.blur?.();
    paint();
    onClose?.();   // and takes it back - inside the gesture that closed, the only place a lock request is honoured
    return true;
  };
  /** The field's line out; a line the host could not send (no socket, over the rate) stays in the field and the panel stays up (B2). */
  const submit = ({ keep = false } = {}) => {
    const text = String(input.value ?? '');
    const went = text.trim() ? onSend?.(log.active, text) : true;
    if (went === false) return;
    input.value = '';
    if (!keep && went !== 'read') closePanel();
  };

  const onKey = (e) => {
    if (e.target === input) {
      // the field's key (CG2): stopped here, so the host's ring never fills from a chat line
      if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }   // C3: the IME's own Enter commits a candidate, not a line
      // AUDIT SOC C2/C14: a surface OVER the chat owns Escape - the key is left whole for it, and the field keeps its line
      if (e.code === 'Escape') { if (above()) { e.stopPropagation(); return; } e.preventDefault(); e.stopImmediatePropagation(); if (emojiOpen) { setEmojiOpen(false); return; } closePanel(); return; }   // EMOTE1: the picker is the innermost surface - its Escape first
      else if (e.code === 'Enter' && !e.shiftKey && !e.repeat) { e.preventDefault(); submit(); }   // C6: a held Enter opened once; its repeats send nothing
      else if (e.code === 'Tab') e.preventDefault();   // C7: focus stays in the field - Tab walked it onto Send and gave the keyboard back to the game
      else swallowBrowserKey(e);
      e.stopPropagation();
      return;
    }
    if (!takesKey(e)) return;
    e.preventDefault(); e.stopPropagation();
    if (log.open) input.focus?.();   // open but the caret wandered (a tap on the canvas): the open key brings it back rather than reaching the game
    else open();
  };
  /** Whether a key outside the field is this panel's: the open key while it is closed (and not put away), or the
   *  same key bringing the caret back while it is open. AUDIT KB1 (the UI lens' first finding): ONE predicate, read
   *  by the handler above AND by the cursor toggle through the claim below - the claim used to stand for the panel's
   *  whole life, so with the chat HIDDEN (CHAT-R2: "a key the game itself wants") or unable to open, Enter neither
   *  opened it nor freed the mouse: a dead key, saved across sessions with the hidden pref. */
  const takesKey = (e) => {
    if (log.open) return action(e) === CHAT_OPEN_ACTION && e.isTrusted !== false && !isTextEntryTarget(e.target);
    if (hidden) return false;   // CHAT-R2: put away means put away - the key does not pull it back
    return isOpenKey(e, { canOpen, overlay, action });
  };
  win.addEventListener('keydown', onKey, true);
  // KB1: one key, one action - Enter opens this panel online, FreeMouse (Y) frees the mouse. The toggle's capture
  // listener is registered first (at host boot, before online starts), so it asks the claim, and the claim is
  // exactly the press this panel will take.
  const releaseCursorKey = claimCursorKey(takesKey);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit({ keep: touch }); });
  close.addEventListener('click', () => closePanel());
  openBtn.addEventListener('click', () => open());
  // CHAT-SCROLL: the bar takes the reader down; a reader who scrolls down on their own clears it the same way. Both
  // are the ELEMENTS' listeners - the panel's one window listener stays the key's (AUDIT CHAT D5).
  jump.addEventListener('click', () => { toNewest(); input.focus?.(); });
  list.addEventListener('scroll', () => { if (unseen && log.open && atNewest()) { unseen = 0; paintJump(); } });
  // CHAT-SIZE: THE GRIP. A press captures the pointer to the grip, so the drag keeps its target however far the hand
  // travels and the host never sees the moves as a press anywhere else (the box already swallows the press itself,
  // and a release is never stopped - AUDIT CHAT C5). The box is anchored at its top-left, so the grip's travel IS the
  // size's change. All of it is the grip's own listeners: the panel's one window listener stays the key's (D5).
  grip.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault?.();
    drag = { id: e.pointerId ?? null, x: Number(e.clientX) || 0, y: Number(e.clientY) || 0, w: widthNow(), h: listNow(), follow: unseen === 0 && atNewest() };
    if (e.pointerId != null) grip.setPointerCapture?.(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag || (drag.id != null && e.pointerId != null && e.pointerId !== drag.id)) return;
    resizeTo(drag.w + ((Number(e.clientX) || 0) - drag.x), drag.h + ((Number(e.clientY) || 0) - drag.y), drag.follow);
  });
  const endDrag = () => {
    if (!drag) return;
    const id = drag.id;
    drag = null;
    if (id != null) grip.releasePointerCapture?.(id);
    keepSize();
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);
  grip.addEventListener('dblclick', () => resetSize());
  // the keyboard's way: arrows step the width and the list's height, stopped here so the host's ring never walks
  grip.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [-CHAT_SIZE_STEP, 0], ArrowRight: [CHAT_SIZE_STEP, 0], ArrowUp: [0, -CHAT_SIZE_STEP], ArrowDown: [0, CHAT_SIZE_STEP] }[e.code];
    if (!step) return;
    e.preventDefault?.(); e.stopPropagation?.();
    resizeTo(widthNow() + step[0], listNow() + step[1], unseen === 0 && atNewest());
    keepSize();
  });

  /**
   * CHAT-R2: PUT IT AWAY, and bring it back.
   *
   * Hidden takes the peek, the hint, the open button, the status line
   * and the box - everything that draws over the world - and leaves
   * ONE small control. It does not destroy the panel: the log keeps
   * filling, the unread counts keep counting, and the key listener
   * stays on, because a player who hid the chat has not left the room
   * and the badge should be waiting when they bring it back.
   *
   * AND THE OPEN KEY STANDS DOWN WHILE HIDDEN. `isOpenKey` would
   * otherwise pull the box back up on the next Enter, which is the
   * opposite of what the button was pressed for - and Enter is
   * ActivateCursor, a key the game itself wants.
   */
  const setHidden = (next) => {
    const want = !!next;
    if (want === hidden) return false;
    hidden = want;
    if (hidden && log.open) closePanel();
    setPref('chatHidden', hidden);
    paint();
    return true;
  };
  hide.addEventListener('click', () => setHidden(true));
  show.addEventListener('click', () => { setHidden(false); open(); });
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) show.addEventListener(t, (e) => e.stopPropagation());
  // a PRESS inside the panel is the panel's; a RELEASE is never stopped (C5: the host's mouseup clears its ring)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) box.addEventListener(t, swallow);
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) openBtn.addEventListener(t, swallow);
  // SOC3: the closed-state Social button is outside the box, so it carries the box's own press rule - a thumb that
  // taps it must not also draw a weapon (D7). The tab-bar one is inside the box and already has it.
  if (socialOut) for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) socialOut.addEventListener(t, swallow);

  return {
    root, input,
    open, close: closePanel, toggle: () => (log.open ? closePanel() : open()),
    isOpen: () => log.open,
    /** CHAT-R2: the hidden state, for the host and for the pins. */
    isHidden: () => hidden,
    setHidden,
    /** CHAT-SIZE: the player's size (null: the sheet's own), and the way back to the sheet's. */
    size: () => ({ width: sizeW, listHeight: sizeH, scale: sizeW == null ? 1 : chatScaleFor(sizeW), fit }),
    resetSize,
    // AUDIT-CHATR F5: a `whoRows()` accessor stood here, labelled "for
    // the pins". No pin ever called it - they read the drawn column out
    // of the fake document, which is the stronger reading anyway - so it
    // was an export whose only justification was a use that did not
    // exist. Deleted rather than pinned into life.
    /**
     * Once a frame.
     *
     * `covered` is THE HOST'S word - a window over the HUD, an enhanced
     * overlay, the pause door - and it takes the whole panel out of the
     * page while it holds. It is NOT the player's `hidden`, and the two
     * must never share a name here: AUDIT-CHATR F1 found this parameter
     * called `hidden`, shadowing the closure of the same name, so the
     * dataset line below wrote the host's word into the player's slot
     * and every frame quietly undid the Hide button. The feature was
     * inert in the only host that has one, and every CHAT-R2 pin passed,
     * because they drove `setHidden` and never drove a FRAME.
     */
    render({ covered = false, status: line = null } = {}) {
      if (!alive) return;
      if (covered || overlay()) { if (log.open) closePanel(); if (root.style.display !== 'none') root.style.display = 'none'; return; }
      if (root.style.display !== '') root.style.display = '';
      publishFit();   // CHAT-SIZE: the screen can change under the chat (a rotate, a resized window) - said on a change only
      if (log.version !== painted) paint();
      // CHAT-R2/R1: the dataset the sheet reads, and the roster - both
      // every frame, because neither rides the log's version: a peer
      // can join without a line being said.
      if (root.dataset.hidden !== (hidden ? '1' : '0')) root.dataset.hidden = hidden ? '1' : '0';
      if (log.open) paintWho();
      paintPeek();
      // SOC3: neither of these rides the log's version either - a friend request lands and a party forms with nothing
      // said in the chat at all, so the badge and the name colours are asked for on the frame like the roster is.
      paintSocial();
      paintNames();
      const s = line ? String(line) : '';
      if (status.textContent !== s) status.textContent = s;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      win.removeEventListener('keydown', onKey, true);
      releaseCursorKey();
      // CHAT-SIZE: the footprint it published goes with it - a page with no chat places the friends panel by the sheet
      for (const k of ['--dfchat-w', '--dfchat-scale', '--dfchat-list-h']) setVar(k, null);
      docEl?.removeAttribute?.('data-dfchat-fit');
      root.remove?.();
    },
  };
}
