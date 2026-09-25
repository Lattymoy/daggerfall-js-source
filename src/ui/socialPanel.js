// SOC3 (2026-09-16, Mac: "A social button next to the chat UI, that when tapped opens the new friends list + party
// interface. Players should now be able to friend other users, see if they are online/last online + be able to
// invite friends or other individuals to the new 4 person party system. Party system: Upon joining a party, the
// players name who are in a party together should turn green"): THE PANEL ITSELF.
//
// WHAT IT IS. A DOM panel beside the chat - the enhanced skin's, like ui/chatPanel.js - with two tabs and nothing
// else: FRIENDS (the requests waiting on me, then everyone I have, online first, each saying when they were last
// seen) and PARTY (the seats (PARTY_MAX), who leads, where each member stands and how they fare, and the invitations
// standing). Plus one TOAST, which is the only part that draws while the panel is CLOSED: an invitation is good for
// INVITE_TTL_MS and a player who never opened the panel would otherwise watch it lapse without ever being asked.
// The toast has its OWN strip, centred at the top of the screen, and it takes no pointer but its two buttons
// (AUDIT SOC C3: it used to sit on the chat's corner at z 7 and swallow the open chat's tab bar).
//
// IT KNOWS NOTHING AND DECIDES NOTHING. Every question it asks is net/social.js's - `actionsFor` for what may be
// done with a peer and why not, `seatsFree`/`inMyParty`/`leads` for the party's own rules, `lastOnlineText` for the
// words on a row - and every answer it sends goes out through ONE arrow, `send(act)`, which the host points at the
// hub's link (net/online.js sendSocial). So the whole surface drives headless over a fake document with plain
// objects for the picture, which is what lets the awkward cases be written down: a party seat that lapsed while the
// panel was open, an invite that expired mid-countdown, a friend with no tab in the world, an act the rate gate
// refused.
//
// A REFUSAL IS A SENTENCE, NOT A MISSING BUTTON. A button that cannot go is DISABLED and carries the reason BESIDE
// ITS LABEL and on its `title` ("already friends", "the party is full", "offline") - AUDIT SOC C11: the title alone
// is a mouse hover, and half the machines this runs on have no mouse - because a control that quietly vanishes
// teaches a player nothing about the rule they just met. And the one refusal that is not about the player - the rate gate,
// where `send` answers false - leaves the button ENABLED and says "try again", since the act was right and only the
// moment was wrong.
//
// TEXT, NEVER MARKUP. Every word on this panel arrives from the relay by way of another player's keyboard; it is
// written with `textContent` and nothing else, which is the chat's own rule (AUDIT CHAT) and the reason a name is
// not an injection.
//
// REPAINTED ON A CHANGE, NOT A FRAME. `render` runs once a frame from the host's chat frame, and the body is
// rebuilt only when `social.version` moved or the panel's own state did (a tab, a confirm, an act just sent). What
// IS redrawn every frame is the handful of things that move on their own: the invite countdowns, the hub's last
// refusal, the toast, the tab badges (AUDIT SOC C5: an invitation lapses on the CLOCK, and `liveInvites` sheds it
// as it is read without moving the version) and the friend rows' "last online" (AUDIT SOC B8, the same reason).
// Every one of those is WRITTEN only where the words actually changed, so a quiet frame still costs nothing. That
// is ChatLog's law (ui/chatPanel.js paintWho) applied before it can be missed.
//
// Not a DFU member: Daggerfall Unity has no friends and no parties. Ledger A row (ONLINE).
import { overlayOpen } from './enhancedOverlays.js';
import { isTextEntryTarget, swallowBrowserKey } from './input.js';   // DISC25-E: a letter's keys are the letter's
import { isTouchDevice } from './touch.js';
import { PARTY_MAX } from '../net/wire.js';
import { lastOnlineText, PARTY_GREEN_CSS, FRIEND_CSS } from '../net/social.js';
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';   // FONT1: the enhanced skin's own face, unsmoothed, with Silkscreen's five
import { accountRefusalText, handleShapeOk, HANDLE_MAX_LEN } from '../net/accountClient.js';   // MAIL1: the service's sentences, and a handle's shape
import { letterAgeText, replySubject } from '../net/mail.js';   // MAIL1: the box the Letters tab draws
import { LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, cleanBody } from '../net/letterLaw.js';   // MAIL1: the form's caps are the service's
import { glyphBadges, glyphSvgNode } from './playerBadge.js';   // MAIL1: a sender's glyphs, in the one drawing every DOM face uses

export const SOCIAL_STYLE_ID = 'dagger-social-style';

/** How long a "try again" note stands after a refused act, ms - long enough to read, short enough not to lie. */
export const SOCIAL_NOTE_MS = 2500;
/** How long Remove stays armed before it disarms itself, ms. A confirm that waits forever is a confirm a player
 *  walks into by accident on their next visit to the row. */
export const SOCIAL_CONFIRM_MS = 4000;
/** The words a friends list with nobody in it says - and where to go to change that.
 *
 *  AUDIT SOC D10/C19: THE ROSTER LEADS, AND THE KEY IS NOT SPELLED. It used to open with "press F", which is a lie
 *  on two machines out of three: F is a rebindable action (systems/inputActions.js SocialInteract, and a player who
 *  had already spent F keeps it and gets the action UNBOUND), and a phone has no F at all. The roster row is the one
 *  door that is always there, so it is named first and the key is named by what it does. */
export const NO_FRIENDS_TEXT = 'No friends yet - click a name in the chat roster, or press the interact key on a player.';
/** The words for no party. */
export const NO_PARTY_TEXT = 'You are not in a party.';
/** The note a rate-gated act leaves (net/online.js sendSocial answered false: the act never left this machine).
 *
 *  AUDIT SOC C19: ONE SENTENCE FOR ONE REFUSAL. This panel said "Too quick - try again" and scenes/world.js said
 *  "Try again in a moment" on the world tab for the very same gate, so a player who pressed a button and read both
 *  had two different answers for one event. The world tab's wording wins (it is the one a player reads without
 *  opening anything) and the host imports THIS constant rather than keeping a second copy of the words. */
export const TRY_AGAIN_TEXT = 'Try again in a moment';
/** JOURNAL1: a letter kept in the journal, and a keep the journal could not take. */
export const LETTER_KEPT_NOTE = 'A copy is in your journal, under Notes.';
export const LETTER_KEEP_FAILED_TEXT = 'Your journal cannot take it right now.';
/** MAIL1: the Letters tab's own sentences - the states the box can be in before there is anything to list. */
export const NO_LETTERS_TEXT = 'No letters yet. A letter waits here for you while you are away.';
export const LETTERS_SIGNED_OUT_TEXT = 'Sign in to an account to send and read letters.';
export const LETTERS_LOOKING_TEXT = 'Looking for letters...';
/** How recent a look the Letters tab trusts when it opens; older, and opening it looks again. */
export const LETTERS_FRESH_MS = 30_000;

/** The panel's sheet: the enhanced tokens (enhancedStyle.js) where they exist, a fallback where the skin's sheet is
 *  not loaded - the same bargain ui/chatPanel.js strikes.
 *
 *  FONT1 (2026-09-16, Mac: "Especially the new online interfaces font use our enhanced font"): the face is the
 *  skin's pixel stack, not `--data` - see ui/chatPanel.js's CHAT_CSS header for the whole reading. The five's
 *  @font-face rides this sheet for the same reason it rides that one: each is injected on its own.
 *
 *  THE BODY IS A FIXED-HEIGHT FLEX-COLUMN SCROLLER, which is the shape CHAT2 was a bug in: a flex item that hides
 *  its own overflow resolves `min-height: auto` to zero and is squeezed to nothing by the default `flex-shrink: 1`
 *  rather than overflowing into the scroll. So every row, section and empty line in here states `flex: none` from
 *  the first commit. */
export const SOCIAL_CSS = `
${PIXELIFY_FIVE_FACE}
.dfsocial { position: fixed; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(44px + env(safe-area-inset-top, 0px));
  width: min(360px, calc(100vw - 28px)); max-height: min(460px, 70vh); z-index: 6; display: none; flex-direction: column;
  background: rgba(14, 16, 19, .92); border: 1px solid var(--iron, #2b323b); border-radius: 6px; backdrop-filter: blur(4px);
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfsocial[data-open="1"] { display: flex; }
.dfsocial.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
/* beside the chat where there is room for both (14 + 440 + 12) */
@media (min-width: 840px) { .dfsocial { left: calc(466px + env(safe-area-inset-left, 0px)); } }
/* AUDIT SOC C13: ...and BELOW it where there is not. Under 840px the panel and the open chat box shared the same
   corner to the pixel (both left 14, top 44), and the panel - z 6 over the chat's 5 - took the whole box: the lines,
   the field, the tab bar. Measured at 800x900 with both open, elementFromPoint at the box's centre answered
   the panel's own section heading. 390 clears the box's own ceiling (top 44 + tabs 34 + list min(220px, 34vh) + form ~45 = 343) on a
   desktop and the touch skin's 72 + 299 = 371, with room to spare; the max-height follows so the panel still ends
   on the screen it started on. */
@media (max-width: 839px) {
  .dfsocial, .dfsocial.touch { top: calc(390px + env(safe-area-inset-top, 0px)); max-height: min(460px, calc(100vh - 398px)); }
}
/* CHAT-SIZE (2026-09-23, Mac: "click and drag the chat to resize"): the chat is dragged to size now, so the two rules
   above are only a page's with no chat panel. The chat says which side of it this panel fits on (data-dfchat-fit on
   the document: beside when 14 + its box + 12 + this panel's 360 + 14 fits the screen, which at the chat's own size
   is exactly the 840px above) and publishes the width and the list height its own rules read. BESIDE: past the box's
   right edge, at the box's own top. BELOW: past the open box's floor - the list's height plus the box's fixed parts
   (top 44, tabs 34, the form, the jump bar), with the old 390's room to spare: min(220px, 34vh) + 170 IS 390 at the
   chat's own size - and a scaled field's growth on top. */
:root[data-dfchat-fit="beside"] .dfsocial { left: calc(26px + min(var(--dfchat-w, 440px), 100vw - 28px) + env(safe-area-inset-left, 0px));
  top: calc(44px + env(safe-area-inset-top, 0px)); max-height: min(460px, 70vh); }
:root[data-dfchat-fit="beside"] .dfsocial.touch { top: calc(72px + env(safe-area-inset-top, 0px)); }
:root[data-dfchat-fit="below"] .dfsocial, :root[data-dfchat-fit="below"] .dfsocial.touch { left: calc(14px + env(safe-area-inset-left, 0px));
  top: calc(var(--dfchat-list-h, min(220px, 34vh)) + 170px + 20px * (var(--dfchat-scale, 1) - 1) + env(safe-area-inset-top, 0px));
  max-height: min(460px, calc(100vh - var(--dfchat-list-h, min(220px, 34vh)) - 178px - 20px * (var(--dfchat-scale, 1) - 1))); }
.dfsocial-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-title { flex: 1; min-width: 0; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; }
.dfsocial-close { flex: none; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit; font-size: 13px; padding: 2px 8px; cursor: pointer; }
.dfsocial-err { flex: none; padding: 4px 8px; font-size: 12px; color: #e0704a; overflow-wrap: anywhere; }
.dfsocial-err:empty { display: none; }
.dfsocial-note { flex: none; padding: 4px 8px; font-size: 12px; color: #e0b070; }
.dfsocial-note:empty { display: none; }
.dfsocial-tabs { flex: none; display: flex; gap: 2px; padding: 4px 4px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-tab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--dim, #8b8578); font: inherit; font-size: 13px;
  letter-spacing: .05em; text-transform: uppercase; padding: 6px 10px; cursor: pointer; }
.dfsocial-tab.active { color: var(--bone, #e9e4d9); border-bottom-color: var(--brass, #c08a3e); }
.dfsocial-badge { margin-left: 6px; background: #c8503c; color: #f6efe2; border-radius: 8px; padding: 0 6px; font-size: 11px; }
.dfsocial-badge:empty { display: none; }
.dfsocial-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 8px; display: flex; flex-direction: column; }
.dfsocial-sec { flex: none; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #8b8578); padding: 8px 0 2px; }
.dfsocial-row { flex: none; display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.dfsocial-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #5a6068; }
.dfsocial-dot.on { background: ${PARTY_GREEN_CSS}; }
.dfsocial-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dfsocial-name { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.dfsocial-sub { font-size: 11px; color: var(--dim, #8b8578); overflow-wrap: anywhere; }
.dfsocial-lead { flex: none; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--brass, #c08a3e); }
.dfsocial-left { flex: none; font-size: 11px; color: var(--dim, #8b8578); }
.dfsocial-btn { flex: none; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9); border: 0; border-radius: 3px; font: inherit; font-size: 12px; padding: 4px 8px; cursor: pointer; }
.dfsocial-btn[disabled] { opacity: .45; cursor: default; }
.dfsocial-btn.warn { background: #6b2f28; }
/* AUDIT SOC C11: the reason a button is dead, BESIDE the label and not only on its title - a title needs a mouse to
   hover, and half the machines this panel runs on have none. The F-menu's own shape (ui/socialMenu.js .dfpeer-why). */
.dfsocial-why { flex: none; font-size: 10px; font-style: italic; color: var(--dim, #8b8578); margin-left: 4px; }
.dfsocial-empty { flex: none; font-size: 13px; color: var(--dim, #8b8578); padding: 6px 0; overflow-wrap: anywhere; }
/* MAIL1 (tools/mailProbe.mjs photographed it): A FRIEND'S ACTS ARE ONE GROUP THAT WRAPS. Letter made them three - Invite,
   Letter, Remove - and at the touch skin's 44px buttons, each with its reason beside its label, three are wider than a
   phone's panel: the name beside them was squeezed to one letter a line. The row wraps its acts BELOW the name when it
   cannot hold both at a readable width, and the group wraps within itself when even it is wider than the panel; on a
   desktop the three still stand beside the name. */
.dfsocial-row.wrap { flex-wrap: wrap; }
.dfsocial-row.wrap .dfsocial-who { flex: 1 1 140px; }
.dfsocial-rowacts { flex: none; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-left: auto; max-width: 100%; }
/* MAIL1: THE LETTERS TAB. A letter's row is a BUTTON (the keyboard reaches it, Enter opens it), drawn as a row: the
   brass dot for one not yet opened, who and what about, how long ago. The letter itself keeps its lines (pre-wrap)
   and breaks a word too long for the panel rather than widening it. The form's fields are the panel's own dress. */
.dfsocial-letter { flex: none; display: flex; align-items: flex-start; gap: 6px; padding: 4px 2px; width: 100%; box-sizing: border-box;
  background: none; border: 0; border-radius: 3px; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dfsocial-letter:hover, .dfsocial-letter:focus-visible { background: rgba(125, 116, 96, .18); outline: none; }
.dfsocial-letter .dfsocial-dot { margin-top: 5px; background: transparent; }
.dfsocial-letter .dfsocial-dot.unread { background: var(--brass, #c08a3e); }
.dfsocial-letter.read .dfsocial-name { font-weight: 400; color: var(--dim, #8b8578); }
.dfsocial-glyph { width: 12px; height: 12px; margin-left: 4px; vertical-align: -1px; }
.dfsocial-age { flex: none; font-size: 11px; color: var(--dim, #8b8578); padding-top: 2px; }
.dfsocial-letterhead { flex: none; display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-bottom: 1px solid var(--iron, #2b323b); }
.dfsocial-subject { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.dfsocial-lettertext { flex: none; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.45; padding: 8px 0; }
.dfsocial-acts { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
.dfsocial-form { flex: none; display: flex; flex-direction: column; gap: 4px; padding: 6px 0; }
.dfsocial-label { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim, #8b8578); margin-top: 4px; }
.dfsocial-field { box-sizing: border-box; width: 100%; background: rgba(0, 0, 0, .35); color: var(--bone, #e9e4d9); border: 1px solid var(--iron, #2b323b);
  border-radius: 3px; font: inherit; font-size: 13px; padding: 5px 6px; }
.dfsocial-field:focus { outline: none; border-color: var(--brass, #c08a3e); }
textarea.dfsocial-field { resize: vertical; min-height: 120px; line-height: 1.4; }
.dfsocial-count { font-size: 11px; color: var(--dim, #8b8578); text-align: right; }
.dfsocial-count.over { color: #e0704a; }

/* AUDIT SOC C8: THE FINGER'S OWN SIZES. Every control this panel draws was built at the mouse's scale - the tabs 29
   tall, Close 27x19, Invite and Remove 22 - and online forces the enhanced lane on a phone as readily as on a
   desktop. Under the touch skin each one is at least the 44px the platforms ask for (ui/touch.js draws its own
   buttons at 48), and nothing moves on a desktop. */
.dfsocial.touch .dfsocial-tab { min-height: 44px; padding: 10px 12px; }
.dfsocial.touch .dfsocial-close { min-height: 44px; min-width: 44px; padding: 4px 12px; }
.dfsocial.touch .dfsocial-btn, .dfsocial-toast.touch .dfsocial-btn { min-height: 44px; padding: 8px 12px; font-size: 13px; }
/* MAIL1: a letter's row is a finger's target too, and a field under 16px makes a phone zoom the page into it */
.dfsocial.touch .dfsocial-letter { min-height: 44px; }
.dfsocial.touch .dfsocial-field { min-height: 44px; font-size: 16px; }

/* THE TOAST stands in ITS OWN STRIP, centred at the top of the screen, because an invitation that lapses in two
   minutes is worth reading first - and because it must work with the panel closed, which is where a player who has
   not found the button yet will be.
   AUDIT SOC C3: it used to take the chat's own corner (left 14, top 44) at z 7, which is the chat's open TAB BAR to
   the pixel and, under 840px, the panel's own header: elementFromPoint over the World tab and over the panel's
   Close both answered the toast. Two things changed. It has its own strip now, and the STRIP TAKES NO POINTER at
   all - only its two buttons do, which is ui/chatPanel.js's own split (.dfchat none, .dfchat-box auto) and is what
   keeps a phone's top-left touch buttons pressable underneath a toast that is merely being read. */
.dfsocial-toast { position: fixed; left: 50%; transform: translateX(-50%); top: calc(8px + env(safe-area-inset-top, 0px));
  width: min(440px, calc(100vw - 28px)); z-index: 7; display: none; align-items: center; gap: 8px; box-sizing: border-box;
  pointer-events: none;
  background: rgba(14, 16, 19, .92); border: 1px solid var(--brass, #c08a3e); border-radius: 6px; padding: 6px 8px;
  ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfsocial-toast[data-up="1"] { display: flex; }
.dfsocial-toast .dfsocial-btn { pointer-events: auto; }
`;

/** The sheet, once. */
export function injectSocialStyle(doc = document) {
  if (doc.getElementById?.(SOCIAL_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = SOCIAL_STYLE_ID;
  el.textContent = SOCIAL_CSS;
  (doc.head ?? doc.body).append(el);
}

/** What is left of an invitation, in a row's words: "1:58 left", "12s left", "expired" at the end. `ms` is what
 *  remains of it, on the relay's clock (net/social.js now()). */
export function inviteLeftText(ms) {
  const s = Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000);
  if (s <= 0) return 'expired';
  if (s < 60) return `${s}s left`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
}

/** A party member's LAST POSE in a row's words - "Daggerfall - 50/60 HP". The place is the pose's own label (the
 *  relay bounded and filtered it, net/wire.js PARTY_LOC_MAX) and the vitals are health, because health is the one a
 *  party reads at a glance. A member who has sent no pose yet says nothing rather than "0/0". */
export function partyPoseText(p) {
  if (!p) return '';
  const hp = `${Math.round(p.h ?? 0)}/${Math.round(p.hm ?? 0)} HP`;
  const loc = typeof p.loc === 'string' ? p.loc.trim() : '';
  return loc ? `${loc} - ${hp}` : hp;
}

/**
 * The friends list's order: ONLINE FIRST, then by name.
 *
 * "see if they are online/last online" is the question this list exists to answer, and the friend a player is
 * looking for is almost always one they could talk to right now - so presence is the first clause and the rest of
 * the list is a directory under it. The name clause is net/roster.js's exactly (case-insensitive and numeric, so
 * `bob` sits with `Bob` and `Player10` after `Player9`), and the account id is the last tie-break, because two
 * friends may share a name and a list that reshuffles when a presence frame lands is the defect that clause
 * prevents.
 *
 * Pure, and takes the Map or anything iterable of rows.
 */
export function friendOrder(friends) {
  const rows = friends?.values ? [...friends.values()] : [...(friends ?? [])];
  return rows.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)
    || String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' })
    || (a.acct < b.acct ? -1 : a.acct > b.acct ? 1 : 0));
}

/**
 * The panel over a SocialState (net/social.js).
 *
 * `send(act)` takes one social act (`{k, acct?|peer?|party?}`) and answers false when it did not leave this machine
 * - the host points it at the hub link's `sendSocial`. `canOpen()` is the host's word on whether the game can take
 * a pointer surface right now; `onOpen`/`onClose` are its pointer-lock door (free the cursor on open, take it back
 * on close, inside the gesture) - the same three ui/chatPanel.js is handed, because this panel is the same kind of
 * thing. Handed the document and the window so the tests drive it headless.
 *
 * AUDIT SOC C2/C14: `above()` is the host's word on whether a surface stands OVER this one (the F-menu). All three
 * social surfaces listen for Escape on the window in capture, so one press closed two of them. The topmost answers:
 * a panel with something above it IGNORES the key (does not close, does not stop it), and the one that handles it
 * calls `stopImmediatePropagation` so no other window listener - the host's pause door included - sees that press.
 */
export function createSocialPanel({ social, send = null, mail = null, keepLetter = null, canOpen = () => true, onOpen = null, onClose = null, above = () => false, overlay = overlayOpen, doc = document, win = globalThis, touch = isTouchDevice() } = {}) {
  injectSocialStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };

  const root = el('div', `dfsocial${touch ? ' touch' : ''}`);
  root.dataset.open = '0';
  // AUDIT SOC C21: a labelled DIALOG, not an unnamed div with a stray aria-label - this panel takes the pointer and
  // the keyboard off the world while it stands, which is the one thing `role="dialog"` says.
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Friends and party');
  const head = el('div', 'dfsocial-head');
  const closeBtn = el('button', 'dfsocial-close', '✕');
  closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', 'Close social');
  head.append(el('div', 'dfsocial-title', 'Social'), closeBtn);
  // the hub's last refusal, in the hub's own words - the world tab gets it as a system line too (world.js
  // socialStart), and a player reading the panel should not have to look away from it to find out why nothing moved
  const err = el('div', 'dfsocial-err');
  const note = el('div', 'dfsocial-note');
  const tabs = el('div', 'dfsocial-tabs');
  const body = el('div', 'dfsocial-body');
  const tabBtns = new Map();
  tabs.setAttribute('role', 'tablist');
  // MAIL1: the third tab, where the host has a letterbox to hand (net/mail.js) - a panel without one is the two it was
  for (const [id, label] of [['friends', 'Friends'], ['party', 'Party'], ...(mail ? [['letters', 'Letters']] : [])]) {
    const b = el('button', 'dfsocial-tab', label);
    b.type = 'button'; b.dataset.tab = id;
    b.setAttribute('role', 'tab');                    // AUDIT SOC C21: a tab that says it is one...
    b.setAttribute('aria-selected', id === 'friends' ? 'true' : 'false');   // ...and which one is up (Friends opens)
    const badge = el('span', 'dfsocial-badge');
    b.append(badge);
    b.addEventListener('click', () => { if (tab === id) return; tab = id; confirm = null; ui++; if (id === 'letters') lookAtLetters(); if (open) repaint(); });
    tabs.append(b);
    tabBtns.set(id, { b, badge });
  }
  root.append(head, err, note, tabs, body);
  doc.body.append(root);

  const toast = el('div', `dfsocial-toast${touch ? ' touch' : ''}`);
  toast.dataset.up = '0';
  const toastWho = el('div', 'dfsocial-who');
  const toastName = el('div', 'dfsocial-name');
  const toastSub = el('div', 'dfsocial-sub');
  toastWho.append(toastName, toastSub);
  const toastYes = el('button', 'dfsocial-btn', 'Accept'); toastYes.type = 'button';
  const toastNo = el('button', 'dfsocial-btn', 'Decline'); toastNo.type = 'button';
  toast.append(toastWho, toastYes, toastNo);
  doc.body.append(toast);

  let alive = true;
  let open = false;
  let tab = 'friends';
  let confirm = null, confirmAt = -Infinity;   // the account whose Remove is armed, and when it was armed
  let noteMsg = '', noteAt = -Infinity;
  let ui = 0;                                  // the panel's OWN version - a tab, a confirm, an act just sent
  let painted = -1, paintedUi = -1, paintedMail = -1;
  let ticking = [];                            // [{ el, expires }] - the countdowns drawn right now
  let liveSubs = [];                           // [{ el, of() }] - the sub-texts that go stale on the CLOCK alone (B8)
  let toasted = null;                          // the invitation the toast is showing, or null
  // MAIL1: the Letters tab's own state. `mode` is the view (the box, one letter, the form); `draft` is the form's words,
  // kept HERE and written on every keystroke, so a repaint - or a close and a reopen - never loses a letter half
  // written; `sending` holds the Send button down while one is out; `del` is the letter whose Delete is armed.
  // JOURNAL1: `kept` - the letters this sitting has copied into the journal, so Keep says it has and is not pressed twice
  const letters = { mode: 'list', id: null, draft: { to: '', subject: '', body: '' }, sending: false, del: null, delAt: -Infinity, word: '', kept: new Set() };
  /** A look at the box when the tab opens - unless one landed a moment ago (the host's poll, or the last opening). The
   *  box's own clock, not the relay's (`social.now()`): `at` is stamped by it. What the look finds repaints on the
   *  next frame, off `mail.version`, like everything else here. */
  const lookAtLetters = () => { if (mail && (!mail.at || mail.now() - mail.at > LETTERS_FRESH_MS)) mail.refresh(); };

  /** One act out. A refusal that is the RATE GATE's (`send` answered false) is not the player's fault and not the
   *  row's: the button stays as it was and the note says so, because the act was right and the moment was not. */
  const act = (a) => {
    const ok = send?.(a) === true;
    noteMsg = ok ? '' : TRY_AGAIN_TEXT;
    noteAt = social.now();
    ui++;
    if (open) repaint();
    return ok;
  };

  const btn = (label, { enabled = true, why = null, warn = false, run = null } = {}) => {
    const b = el('button', `dfsocial-btn${warn ? ' warn' : ''}`, label);
    b.type = 'button';
    if (!enabled) {
      b.disabled = true;
      // AUDIT SOC C11: the reason is DRAWN as well as titled. A `title` is a desktop hover and nothing at all on a
      // phone, so "offline" and "the party is full" were invisible on exactly the machines where a player cannot
      // hover to find out. The title stays for the mouse; the span is for everyone else (the F-menu's own shape).
      if (why) { b.setAttribute('title', String(why)); b.append(el('span', 'dfsocial-why', String(why))); }
    } else b.addEventListener('click', () => run?.());
    return b;
  };

  /** A person's row: the presence dot, the name (in the colour their standing earns), what they are doing under it.
   *  The sub-text node is left ON the row (`subNode`) because some of those sentences go stale where nothing in the
   *  picture changed - see `liveSubs` and AUDIT SOC B8. */
  const personRow = ({ name, sub = '', online = null, colour = null, lead = false }) => {
    const r = el('div', 'dfsocial-row');
    if (online !== null) r.append(el('div', `dfsocial-dot${online ? ' on' : ''}`));
    const who = el('div', 'dfsocial-who');
    const nameEl = el('div', 'dfsocial-name', String(name ?? ''));
    if (colour) nameEl.style.color = colour;
    who.append(nameEl);
    if (sub) { const s = el('div', 'dfsocial-sub', String(sub)); who.append(s); r.subNode = s; }
    r.append(who);
    if (lead) r.append(el('span', 'dfsocial-lead', 'Leader'));
    return r;
  };

  /** Can this friend be invited, and if not, why not. The reasons are net/social.js's own (actionsFor over one of
   *  their tabs - it is the one that knows the party's seats), with OFFLINE ahead of them: a friend with no tab in
   *  the world has no socket for the hub to reach, and "offline" is a truer sentence than "the party is full". */
  const inviteState = (r) => {
    const peer = r.peers?.[0] ?? null;
    if (!r.online || !peer) return { can: false, why: 'offline' };
    const a = social.actionsFor(peer);
    return { can: a.canInvite, why: a.whyNotInvite };
  };

  /** THE FRIENDS TAB: what is waiting on me first, then everyone I have. */
  const friendsBody = () => {
    const out = [];
    const ins = social.in ?? [], outs = social.out ?? [];
    if (ins.length || outs.length) {
      out.push(el('div', 'dfsocial-sec', 'Requests'));
      // AUDIT ONLINE A6: A PENDING REQUEST CARRIES NO PRESENCE. The hub sends `online: false`, `seen: null` and no
      // peers on an `in`/`out` row either way - a stranger who asked to be your friend must not learn when you are
      // at your desk from the asking. So the row draws NO DOT (`online: null`) and this panel reads neither `seen`
      // nor `peers` off one: the only presence it draws is a friend's, which is a friendship both sides agreed to.
      for (const r of ins) {
        const n = personRow({ name: r.name, sub: 'wants to be your friend', online: null });
        n.append(btn('Accept', { run: () => act({ k: 'friend.accept', acct: r.acct }) }),
          btn('Decline', { run: () => act({ k: 'friend.decline', acct: r.acct }) }));
        out.push(n);
      }
      for (const r of outs) {
        const n = personRow({ name: r.name, sub: 'request sent', online: null });
        n.append(btn('Cancel', { run: () => act({ k: 'friend.cancel', acct: r.acct }) }));
        out.push(n);
      }
    }
    const rows = friendOrder(social.friends);
    out.push(el('div', 'dfsocial-sec', `Friends (${rows.length})`));
    if (!rows.length) out.push(el('div', 'dfsocial-empty', NO_FRIENDS_TEXT));
    for (const r of rows) {
      const seated = social.inMyParty(r.acct);
      const n = personRow({
        name: r.name,
        sub: lastOnlineText(r.online, r.seen, social.now()),
        online: r.online,
        colour: seated ? PARTY_GREEN_CSS : FRIEND_CSS,
      });
      // AUDIT SOC B8: "Last online 5 min ago" is a sentence about the CLOCK, and the clock moves with nothing in the
      // picture changing - so it is re-read on the live pass, written only where the words actually differ.
      if (n.subNode) liveSubs.push({ el: n.subNode, of: () => lastOnlineText(r.online, r.seen, social.now()) });
      const inv = inviteState(r);
      // MAIL1: the row's acts are one group (.dfsocial-rowacts), which wraps below the name where the row cannot hold both
      n.className += ' wrap';
      const acts = el('div', 'dfsocial-rowacts');
      n.append(acts);
      // a friend is invited by ACCOUNT - the person, not whichever tab they happen to have open (net/wire.js
      // SOCIAL_ACTS: party.invite takes either, and the hub resolves a peer to the account behind it anyway)
      acts.append(btn('Invite', { enabled: inv.can, why: inv.why, run: () => act({ k: 'party.invite', acct: r.acct }) }));
      // MAIL1: a letter, online or not - which is the point of one. A friend who is still a guest has no username a
      // letter can find (their name is generated, and carries the one space a handle never does: net/handleShape.js)
      if (mail) {
        const named = handleShapeOk(r.name);
        acts.append(btn('Letter', { enabled: named, why: named ? null : 'no username', run: () => { tab = 'letters'; writeTo(r.name); } }));
      }
      // ONE CLICK ARMS, THE SECOND SENDS. No `window.confirm`: it is a modal the game cannot dismiss, it steals the
      // pointer this panel just freed, and on a touch device it is a different surface entirely.
      acts.append(confirm === r.acct
        ? btn('Sure?', { warn: true, run: () => { confirm = null; act({ k: 'friend.remove', acct: r.acct }); } })
        : btn('Remove', { run: () => { confirm = r.acct; confirmAt = social.now(); ui++; if (open) repaint(); } }));
      out.push(n);
    }
    return out;
  };

  /** THE INVITATIONS, on the Party tab - where a player who accepts one is about to be looking anyway. The toast
   *  carries the same two buttons for a player who never opened the panel. */
  const invitesBody = () => {
    const out = [];
    const invites = social.liveInvites();
    if (!invites.length) return out;
    out.push(el('div', 'dfsocial-sec', 'Party invitations'));
    for (const inv of invites) {
      const n = personRow({ name: `${inv.from.name} invites you`, sub: inv.members.map((m) => m.name).join(', ') });
      const left = el('span', 'dfsocial-left', inviteLeftText(inv.expires - social.now()));
      ticking.push({ el: left, expires: inv.expires });
      n.append(left,
        btn('Accept', { run: () => act({ k: 'party.accept', party: inv.party }) }),
        btn('Decline', { run: () => act({ k: 'party.decline', party: inv.party }) }));
      out.push(n);
    }
    return out;
  };

  /** THE PARTY TAB: the seats, or the sentence that says there are none. */
  const partyBody = () => {
    const out = [];
    const p = social.party;
    if (!p) out.push(el('div', 'dfsocial-empty', NO_PARTY_TEXT));
    else {
      out.push(el('div', 'dfsocial-sec', `Your party (${p.members.length}/${PARTY_MAX})`));
      const leads = social.leads();
      for (const m of p.members) {
        const me = m.acct === social.acct;
        const n = personRow({
          name: m.name,
          sub: partyPoseText(m.p),
          online: m.online,
          colour: me ? null : PARTY_GREEN_CSS,   // "the players name who are in a party together should turn green"
          lead: m.acct === p.leader,
        });
        // AUDIT PARTY8 (2026-09-23): a member's POSE writes this one line in place on the live pass - it used to raise
        // the picture's version, and a repaint rebuilds every button, so with the panel open a click that straddled a
        // companion's pose (up to seven a second at eight seats) landed on a node that was no longer there: Kick,
        // Leave and Accept silently did nothing. The row object `m` is the picture's own and applyParty writes its `p`.
        if (n.subNode) liveSubs.push({ el: n.subNode, of: () => partyPoseText(m.p) });
        // KICK IS THE LEADER'S (SOC1's law, and the hub refuses anyone else) - so it is drawn for nobody else
        if (!me && leads) n.append(btn('Kick', { warn: true, run: () => act({ k: 'party.kick', acct: m.acct }) }));
        out.push(n);
      }
      const leave = el('div', 'dfsocial-row');
      leave.append(btn('Leave party', { warn: true, run: () => act({ k: 'party.leave' }) }));
      out.push(leave);
    }
    out.push(...invitesBody());
    return out;
  };

  // ── MAIL1: THE LETTERS TAB ────────────────────────────────────────────────────────────────────────────────────
  // The box (net/mail.js MailBox) decides everything about the letters; this draws it. Three views: the LIST (the
  // box, newest first), ONE LETTER, and the FORM. Every word on them came from another player's keyboard and is
  // written with textContent, like everything else on this panel.

  /** The sentence for a letter's refusal: the service's own table, and the one state the box names itself. */
  const letterWordText = (error) => (error === 'signed-out' ? LETTERS_SIGNED_OUT_TEXT : accountRefusalText(error));
  /** A sender's name with their glyphs after it, in the one drawing (ui/playerBadge.js glyphSvgNode). */
  const senderNode = (cls, text, l) => {
    const n = el('div', cls, text);
    for (const g of glyphBadges(l)) { const svg = glyphSvgNode(doc, g, 'dfsocial-glyph', 1.6); if (svg) n.append(svg); }
    return n;
  };
  /** Into one of the tab's views. */
  const lettersTo = (mode, id = null) => { letters.mode = mode; letters.id = id; letters.del = null; ui++; if (open) repaint(); };
  /** THE FORM, on a draft: a fresh one to `to` (a friend's row, a reply), or - named nothing - the words already there. */
  const writeTo = (to = null, subject = '') => {
    if (to != null) letters.draft = { to: String(to), subject: String(subject ?? ''), body: '' };
    letters.word = '';
    lettersTo('write');
  };
  /** OPEN ONE: the view first, the letter when it comes (from this sitting's copy, or the service, which marks it read). */
  const openLetter = (id) => {
    letters.word = '';
    lettersTo('read', id);
    mail.open(id).then((r) => {
      if (r.ok) return;
      letters.word = letterWordText(r.error);
      if (r.error === 'no-letter') letters.mode = 'list';
      ui++;
    });
  };

  const listBody = () => {
    if (mail.state === 'signed-out') return [el('div', 'dfsocial-empty', LETTERS_SIGNED_OUT_TEXT)];
    if (mail.state === 'guest') return [el('div', 'dfsocial-empty', accountRefusalText('mail-needs-account'))];
    const out = [];
    const acts = el('div', 'dfsocial-acts');
    acts.append(btn('Write a letter', { run: () => writeTo('') }));
    out.push(acts);
    if (letters.word) out.push(el('div', 'dfsocial-empty', letters.word));
    if (mail.state === 'error') out.push(el('div', 'dfsocial-err', letterWordText(mail.error)));
    if (mail.state === 'unknown') { out.push(el('div', 'dfsocial-empty', LETTERS_LOOKING_TEXT)); return out; }
    // the box's fill beside its name: a reader should see a full box coming, because at the bound a sender is refused
    out.push(el('div', 'dfsocial-sec', `Letters (${mail.letters.length}/${mail.max})`));
    if (!mail.letters.length) out.push(el('div', 'dfsocial-empty', NO_LETTERS_TEXT));
    for (const l of mail.letters) {
      const row = el('button', `dfsocial-letter${l.read ? ' read' : ''}`);
      row.type = 'button';
      row.setAttribute('aria-label', `${l.read ? '' : 'Unread. '}From ${l.from}: ${l.subject}`);
      row.append(el('div', `dfsocial-dot${l.read ? '' : ' unread'}`));
      const who = el('div', 'dfsocial-who');
      who.append(senderNode('dfsocial-name', l.from, l), el('div', 'dfsocial-sub', l.subject));
      const age = el('span', 'dfsocial-age', letterAgeText(l.sentAt, mail.now()));
      liveSubs.push({ el: age, of: () => letterAgeText(l.sentAt, mail.now()) });   // "5 min ago" moves on the clock alone
      row.append(who, age);
      row.addEventListener('click', () => openLetter(l.id));
      out.push(row);
    }
    return out;
  };

  const readBody = () => {
    const out = [];
    const top = el('div', 'dfsocial-acts');
    top.append(btn('Back', { run: () => { letters.word = ''; lettersTo('list'); } }));
    out.push(top);
    const l = mail.opened.get(letters.id);
    if (!l) { out.push(el('div', letters.word ? 'dfsocial-err' : 'dfsocial-empty', letters.word || LETTERS_LOOKING_TEXT)); return out; }
    const head = el('div', 'dfsocial-letterhead');
    const age = el('div', 'dfsocial-sub', `Sent ${letterAgeText(l.sentAt, mail.now())}`);
    liveSubs.push({ el: age, of: () => `Sent ${letterAgeText(l.sentAt, mail.now())}` });
    head.append(el('div', 'dfsocial-subject', l.subject), senderNode('dfsocial-sub', `From ${l.from}${l.title ? ` - ${l.title}` : ''}`, l), age);
    out.push(head, el('div', 'dfsocial-lettertext', l.body));
    if (letters.word) out.push(el('div', 'dfsocial-err', letters.word));
    if (keepLetter && letters.kept.has(l.id)) out.push(el('div', 'dfsocial-empty', LETTER_KEPT_NOTE));
    const acts = el('div', 'dfsocial-acts');
    // a reply goes to whoever wrote - their name as the letter carries it is the handle it came from
    acts.append(btn('Reply', { enabled: handleShapeOk(l.from), why: 'no username', run: () => writeTo(l.from, replySubject(l.subject)) }));
    // JOURNAL1 (Addison Knox: "Player journals ... shared"): a letter KEPT in my journal - a note, dated when I kept it,
    // that says who wrote it and what about (net/journalPage.js keptLetterTokens); once, where the host has a journal
    if (keepLetter) {
      const kept = letters.kept.has(l.id);
      acts.append(btn(kept ? 'Kept in your journal' : 'Keep in my journal', { enabled: !kept, run: () => {
        if (keepLetter(l) === true) { letters.kept.add(l.id); letters.word = ''; } else letters.word = LETTER_KEEP_FAILED_TEXT;
        ui++; if (open) repaint();
      } }));
    }
    // ONE CLICK ARMS, THE SECOND THROWS IT AWAY - the friends list's Remove, for the same reasons
    acts.append(letters.del === l.id
      ? btn('Sure?', { warn: true, run: () => {
        letters.del = null;
        mail.remove(l.id).then((r) => { letters.word = r.ok ? 'Letter thrown away.' : letterWordText(r.error); if (r.ok) letters.mode = 'list'; ui++; });
      } })
      : btn('Delete', { run: () => { letters.del = l.id; letters.delAt = social.now(); ui++; if (open) repaint(); } }));
    out.push(acts);
    return out;
  };

  const writeBody = () => {
    const d = letters.draft;
    const form = el('div', 'dfsocial-form');
    const field = (tag, label, value, max) => {
      const f = doc.createElement(tag);
      f.className = 'dfsocial-field';
      if (tag === 'input') f.type = 'text';
      f.maxLength = max;
      f.value = value;
      f.setAttribute('aria-label', label);
      f.setAttribute('autocomplete', 'off');
      form.append(el('div', 'dfsocial-label', label), f);
      return f;
    };
    const to = field('input', 'To', d.to, HANDLE_MAX_LEN);
    to.setAttribute('spellcheck', 'false');
    const subject = field('input', 'Subject', d.subject, LETTER_SUBJECT_MAX);
    const body = field('textarea', 'Letter', d.body, LETTER_BODY_MAX);
    body.rows = 8;
    const count = el('div', 'dfsocial-count', '');
    form.append(count);
    // THE COUNT IS WHAT THE SERVICE WILL COUNT: the characters as typed (the field's own cap is the bound) and, past
    // LETTER_LINES_MAX, the lines as they will be kept - cleanBody's, blank runs folded - so the number that turns red
    // is the number the refusal would name.
    const paintCount = () => {
      const lines = cleanBody(body.value).split('\n').length;
      const over = lines > LETTER_LINES_MAX;
      const t = `${body.value.length}/${LETTER_BODY_MAX}${over ? ` - ${lines}/${LETTER_LINES_MAX} lines` : ''}`;
      if (count.textContent !== t) count.textContent = t;
      count.className = `dfsocial-count${over ? ' over' : ''}`;
    };
    paintCount();
    // THE DRAFT IS WRITTEN ON EVERY KEYSTROKE and the form is NOT rebuilt by one - only a view change or a send
    // rebuilds it - so the caret stays where the player put it and nothing typed is ever lost to a repaint.
    to.addEventListener('input', () => { d.to = to.value; });
    subject.addEventListener('input', () => { d.subject = subject.value; });
    body.addEventListener('input', () => { d.body = body.value; paintCount(); });
    const out = [form];
    if (letters.word) out.push(el('div', 'dfsocial-err', letters.word));
    const send = () => {
      if (letters.sending) return;
      letters.sending = true; letters.word = ''; ui++; if (open) repaint();
      mail.send({ to: d.to, subject: d.subject, body: d.body }).then((r) => {
        letters.sending = false;
        if (r.ok) {
          letters.draft = { to: '', subject: '', body: '' };
          letters.word = `Your letter to ${r.to} is on its way.`;
          letters.mode = 'list';
        } else letters.word = letterWordText(r.error);
        ui++;
      });
    };
    // Ctrl or Cmd with Enter sends from the letter itself - the one field where a plain Enter is a new line
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    const acts = el('div', 'dfsocial-acts');
    acts.append(
      btn(letters.sending ? 'Sending...' : 'Send', { enabled: !letters.sending, run: send }),
      btn('Cancel', { enabled: !letters.sending, run: () => { letters.draft = { to: '', subject: '', body: '' }; letters.word = ''; lettersTo('list'); } }));
    out.push(acts);
    // the first empty field takes the keyboard: the name on a fresh letter, the words on a reply
    Promise.resolve().then(() => { if (letters.mode === 'write' && open) (d.to ? (d.subject ? body : subject) : to).focus?.(); });
    return out;
  };

  const lettersBody = () => (letters.mode === 'write' ? writeBody() : letters.mode === 'read' ? readBody() : listBody());

  /** What a tab's badge should say right now: requests waiting on Friends, invitations standing on Party, letters
   *  unopened on Letters (MAIL1). ONE reading, because the live pass and the repaint must never disagree about the
   *  number (AUDIT SOC C5). */
  const badgeText = (id) => {
    const n = id === 'friends' ? (social.in?.length ?? 0) : id === 'letters' ? (mail?.unread ?? 0) : social.liveInvites().length;
    return n > 0 ? String(n) : '';
  };

  /** The whole body, and the tab badges over it. */
  const repaint = () => {
    painted = social.version; paintedUi = ui; paintedMail = mail?.version ?? 0;
    ticking = []; liveSubs = [];
    for (const [id, t] of tabBtns) {
      t.b.className = `dfsocial-tab${id === tab ? ' active' : ''}`;
      t.b.setAttribute('aria-selected', id === tab ? 'true' : 'false');   // C21
      t.badge.textContent = badgeText(id);
    }
    body.replaceChildren(...(tab === 'party' ? partyBody() : tab === 'letters' ? lettersBody() : friendsBody()));
    paintLive();
  };

  /**
   * The handful of things that move without the picture changing: the countdowns, the hub's last refusal, the note,
   * and the two self-disarming timers. Cheap enough for every frame; nothing here touches a row.
   *
   * AND A LAPSED INVITATION ASKS FOR A REBUILD. `liveInvites` sheds an expired one as it is READ and does not move
   * the version (net/social.js: nothing happened, time merely passed), so a body painted on the version alone would
   * keep drawing a row for an invitation that is already nothing. The countdown reaching zero is the one event that
   * has no frame behind it, so it raises the panel's own version and `render` rebuilds on the same pass.
   */
  const paintLive = () => {
    const now = social.now();
    if (confirm && now - confirmAt > SOCIAL_CONFIRM_MS) { confirm = null; ui++; }
    if (letters.del && now - letters.delAt > SOCIAL_CONFIRM_MS) { letters.del = null; ui++; }   // MAIL1: Delete disarms as Remove does
    if (noteMsg && now - noteAt > SOCIAL_NOTE_MS) noteMsg = '';
    const e = social.lastError ? String(social.lastError) : '';
    if (err.textContent !== e) err.textContent = e;
    if (note.textContent !== noteMsg) note.textContent = noteMsg;
    // AUDIT SOC C5: THE BADGES ARE READ BACK, NOT REMEMBERED. `liveInvites()` sheds a lapsed invitation as it is
    // READ and moves no version (time merely passed), so an invitation that expired while the FRIENDS tab was up
    // left the Party badge standing at a number that was no longer true - the body it belonged to was not even
    // drawn. Comparing the live count against what is on the badge costs two integers a frame and cannot go stale.
    for (const [id, t] of tabBtns) { const want = badgeText(id); if (t.badge.textContent !== want) t.badge.textContent = want; }
    // AUDIT SOC B8: the sentences that go stale on the clock alone ("Last online 5 min ago"), written only when the
    // words changed - so the pins that count writes still hold and a quiet minute costs a string compare a row.
    for (const s of liveSubs) { const t = s.of(); if (s.el.textContent !== t) s.el.textContent = t; }
    let lapsed = false;
    for (const c of ticking) {
      const t = inviteLeftText(c.expires - now);
      if (c.el.textContent !== t) c.el.textContent = t;
      if (now >= c.expires) lapsed = true;
    }
    if (lapsed) ui++;
  };

  /** THE TOAST, which is the panel's one part that draws while the panel is shut. It goes away on either button, at
   *  expiry, and the moment the picture stops holding that invitation at all (the seat was taken, the party filled,
   *  the asker left) - so it can never stand for something that is no longer true. */
  const paintToast = () => {
    const now = social.now();
    // AUDIT SOC C4: the note expires HERE too. `paintLive` clears it, and `paintLive` runs only while the panel is
    // open - so a "try again" raised by a toast button with the panel shut stood under the invitation until the
    // invitation itself lapsed, long past the two and a half seconds it is meant to live.
    if (noteMsg && now - noteAt > SOCIAL_NOTE_MS) noteMsg = '';
    if (toasted && (now >= toasted.expires || !social.invites.has(toasted.party))) toasted = null;
    const up = !!toasted;
    if (toast.dataset.up !== (up ? '1' : '0')) toast.dataset.up = up ? '1' : '0';
    if (!up) return;
    const name = `${toasted.from.name} invites you to a party`;
    if (toastName.textContent !== name) toastName.textContent = name;
    const sub = noteMsg || `${toasted.members.map((m) => m.name).join(', ')} - ${inviteLeftText(toasted.expires - now)}`;
    if (toastSub.textContent !== sub) toastSub.textContent = sub;
  };
  // a toast the rate gate refused STAYS UP with its note - the invitation is still standing and the player still
  // means to answer it, so the one thing that must not happen is the buttons going away
  const toastAct = (k) => { const inv = toasted; if (!inv) return; if (act({ k, party: inv.party })) toasted = null; paintToast(); };

  toastYes.addEventListener('click', () => toastAct('party.accept'));
  toastNo.addEventListener('click', () => toastAct('party.decline'));

  // SOC3: the invitation in. `onInvite` may already belong to someone (a later slice's HUD), so it is CHAINED
  // rather than taken - this panel adds a toast to whatever else the host does with one.
  const priorInvite = social.onInvite;
  const mineInvite = (inv) => { toasted = inv; ui++; if (open) repaint(); paintToast(); priorInvite?.(inv); };
  social.onInvite = mineInvite;

  const openPanel = () => {
    if (!alive || open || !canOpen() || overlay()) return false;
    open = true; ui++;
    root.dataset.open = '1';
    repaint();
    onOpen?.();   // the host frees the pointer - inside the gesture that opened (AUDIT CHAT C2's law, again)
    return true;
  };
  const closePanel = () => {
    if (!alive || !open) return false;
    open = false; confirm = null; ui++;
    root.dataset.open = '0';
    onClose?.();   // and takes it back inside the closing gesture, the only place a lock request is honoured
    return true;
  };
  closeBtn.addEventListener('click', () => closePanel());

  // Escape closes, and closes NOTHING ELSE: the key is stopped here, so it never reaches the host's pause door
  // behind an open panel (the chat's own Escape rule, ui/chatPanel.js onKey) - nor any SIBLING surface's listener,
  // which is what `stopImmediatePropagation` adds over `stopPropagation` and what AUDIT SOC C14 was.
  const onKey = (e) => {
    if (!open || e.code !== 'Escape') return;
    if (above()) return;   // the F-menu is over this panel: its Escape, untouched and unstopped
    e.preventDefault();
    e.stopImmediatePropagation();
    closePanel();
  };
  win.addEventListener('keydown', onKey, true);

  // a PRESS inside the panel or the toast is theirs; a RELEASE is never stopped (AUDIT CHAT C5: the host's mouseup
  // clears its ring, and a press begun on the canvas must still let go)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) { root.addEventListener(t, swallow); toast.addEventListener(t, swallow); }
  // DISC25-E (Sir McMobdon on Discord, "Cant send letters": "Game still takes input making u jump and move and close
  // the letter if u hit f"): A KEY TYPED INTO THIS PANEL'S FIELDS IS THE FIELD'S. The panel is not a window in any
  // host's slot - it stands open while the player walks - so no overlay gate stood between a letter and the world's
  // key ladder: every W walked, every space jumped, and F (SocialInteract) toggled the panel shut mid-word. Stopped
  // on the panel's own root, in the bubble phase, the chat's rule (ui/chatPanel.js onKey): the field's own listeners
  // (Ctrl/Cmd+Enter sends) have already run, and the browser's own keys (F5, F11) are swallowed first, since the host
  // that swallows them will not see this one.
  root.addEventListener('keydown', (e) => {
    if (!isTextEntryTarget(e.target)) return;
    swallowBrowserKey(e);
    e.stopPropagation();
  });

  return {
    root, toast,
    open: openPanel, close: closePanel,
    toggle: () => (open ? closePanel() : openPanel()),
    isOpen: () => open,
    /** Which tab is up - for the host and for the pins. */
    tab: () => tab,
    /** MAIL1: open on the Letters tab - on the form to `to` when a name is given, on the box otherwise; JOURNAL1: on the
     *  form with a whole `draft` ({to, subject, body}) when one is given. False where the host handed no letterbox, or
     *  the panel cannot open now. */
    openLetters({ to = null, draft = null } = {}) {
      if (!mail) return false;
      tab = 'letters'; confirm = null;
      // JOURNAL1: a whole draft - a page of the journal sent as a letter (net/journalPage.js letterOfPage), to anyone
      if (draft) { letters.draft = { to: String(draft.to ?? ''), subject: String(draft.subject ?? ''), body: String(draft.body ?? '') }; letters.word = ''; lettersTo('write'); }
      else if (to != null) writeTo(to); else { letters.mode = 'list'; letters.id = null; ui++; }
      lookAtLetters();
      if (open) { repaint(); return true; }
      return openPanel();
    },
    /** MAIL1: which view the Letters tab is on - for the pins. */
    lettersView: () => letters.mode,
    /**
     * Once a frame, from the host's chat frame.
     *
     * `covered` is the HOST's word - a window over the HUD, the pause door - and it takes the panel AND the toast
     * out of the page while it holds, exactly as it does the chat (ui/chatPanel.js render, AUDIT-CHATR F1: it is
     * never the player's own state and must not share a name with it).
     */
    render({ covered = false } = {}) {
      if (!alive) return;
      if (covered || overlay()) {
        if (open) closePanel();
        if (root.style.display !== 'none') root.style.display = 'none';
        if (toast.style.display !== 'none') toast.style.display = 'none';
        return;
      }
      if (root.style.display !== '') root.style.display = '';
      if (toast.style.display !== '') toast.style.display = '';
      if (open) {
        // MAIL1: the Letters tab is drawn from the BOX, not the social picture - and the form from neither, so a presence
        // frame or a poll landing while a player types rebuilds nothing under their caret
        const moved = tab !== 'letters' ? social.version !== painted : letters.mode !== 'write' && (mail?.version ?? 0) !== paintedMail;
        if (moved || ui !== paintedUi) repaint();
        // a countdown that just hit zero raises the panel's version from inside `paintLive`, and the row it belongs
        // to has to go on THIS pass rather than the next one - `liveInvites` has already shed it by now
        else { paintLive(); if (ui !== paintedUi) repaint(); }
      }
      paintToast();
    },
    destroy() {
      if (!alive) return;
      alive = false;
      win.removeEventListener('keydown', onKey, true);
      if (social.onInvite === mineInvite) social.onInvite = priorInvite;
      root.remove?.();
      toast.remove?.();
    },
  };
}
