# The community arc - the players' own requests (COMM, opened 2026-09-23)

Mac, handing over a batch of Discord suggestions: "I wanna tackle each of these head on and be extremely thorough
and detailed", with two of his own - "For the profile suggestion. I think we develop a new enhanced UI element for the
player inspect interaction. Showing their glyph, name, title, stats and worn gear" and "I want to implement the
ability to click and drag the chat to resize/along with the text".

The requests, each with the slice that answers it:

| Who | Request | Slice |
|---|---|---|
| Starempire42 | "when you open the chat It automatically scrolls to the newest message" | CHAT-SCROLL |
| Mac | "click and drag the chat to resize/along with the text" | CHAT-SIZE |
| kurkku | "Global chat ... regional chat ... party chat" | CHAT-CHAN |
| Addison Knox | "Roleplay chat channels (IC/OOC)" | CHAT-CHAN |
| Addison Knox | "Chat dice-rolling" | DICE1 |
| Addison Knox | "Emotes, be it emojis or additional animations" | EMOTE1 |
| Janome | "a toggle key to switch between the inventories of enemies stacked on top of each other" | LOOT-STACK |
| kurkku, Mac | "a profile page that you can bring up when you're near them" / "glyph, name, title, stats and worn gear" | INSPECT1 |
| Addison Knox | "In-game mail lets players leave notes, contracts, or invitations even when the recipient is offline" | MAIL1 |
| Addison Knox | "Player journals ... shared in-world for storytelling" | JOURNAL1 |

None of these is a DFU member - Daggerfall Unity has no chat, no online and no stacked-body cycle - so every slice is
the port's own and rides Port-Ledger A's ONLINE row (the chat and the social slices) or a row of its own (LOOT-STACK).

## CHAT-SCROLL - an open lands on the newest line

Starempire42 on Discord, 2026-09-23: "Make it so when you open the chat It automatically scrolls to the newest message.
Currently when you open the chat it just stays idle so you have to manually scroll down to the newest message every
single time."

**The law it broke.** `ui/chatPanel.js paintList` decided whether the list follows the conversation by asking the list
where the reader was - "at the bottom, within 8px" - and that question was asked on the first paint after an OPEN, of a
scroller that was `display: none` until that paint. What a hidden scroller remembers is the engine's business:
Chromium keeps the offset (tools/chatScrollProbe.mjs measures it), other engines drop it to the top, and a top taller
than the box reads as "the reader scrolled up". A reader who HAD scrolled up before closing met the old place on every
open. Both are AUDIT CHAT C8's rule - keep a reader's scroll when lines arrive under them - applied to a moment it was
never written for: coming back is a new look, and the newest line is what a player opens the chat to read.

**The second cause.** The badge pass (CHAT-FIT) lays a title and glyphs into a line AFTER the list scrolled to its
bottom; a line that wraps under its badge grows, and the growth pushed the newest line under the fold on the very
paint that scrolled to it. The scroll is now the paint's last act, after every pass that can change a line's height,
and a badge that arrives on a later frame (a title equipped mid-conversation) measures the reader's place before it
re-lays a line and keeps a reader at the bottom there.

**What stands.** While the panel is open, C8 is untouched: a reader who scrolled up is left where they are. What
arrives under them is counted on a bar under the list - `N new - jump to newest` - which takes them down, and which a
reader who scrolls down on their own clears the same way. A tab change reads from its newest line (another
conversation). Both listeners are the elements' own; the panel still adds exactly one window listener (D5).

**Pins.** `test/chatscroll.test.js` (4) drives the panel over a fake that LAYS OUT - lines as tall as their text wraps,
badge parts included, a clamped scrollTop - so a hidden box that forgets its place, a badge that wraps after the
scroll and a reader who scrolled up are all real there. `tools/mutants/chatscroll.json`: 7, 7 dead.
`tools/chatScrollProbe.mjs` reads the real panel in Chromium: every open lands on the newest line, badged or not; a
reader who scrolled up keeps their place with the bar counting 3; the bar's click lands.

## CHAT-SIZE - the chat dragged to size, the text along with it

Mac, 2026-09-23: "I want to implement the ability to click and drag the chat to resize/along with the text".

**The corner.** A grip stands at the chat box's bottom-right corner - the BOX's, past the roster column (the first cut
put it at the end of the form's row, which the Chromium probe found in the middle of the box, 227px short of the
corner). A press captures the pointer to the grip, and the box is anchored at its top-left, so the grip's travel IS
the size's change: the WIDTH, and the text's scale with it - `width / 440`, the sheet's own width, bounded 0.8..1.8,
so the width runs 352..792 - and the HEIGHT, the list's lines (80px at the least, three quarters of the screen at the
most; the sheet caps it too). "Along with the text" is the width: every size the chat's TEXT is drawn at is
`calc(Npx * var(--dfchat-scale, 1))` - the lines, their tags, times, titles and glyphs, the hint, the status, the jump
bar, the roster's head, rows, tags and glyphs and its column's width, the field - so a wider chat is a bigger chat
whose lines wrap where they did, and a taller one is more history at the same size. What a THUMB presses does not
scale: the buttons and the tabs are AUDIT SOC C8's targets. Arrow keys on the focused grip step the two sizes by 20px
(stopped at the grip - the host's ring never walks), and a double click gives the sheet's own size back. A reader on
the newest line stays on it through the drag; a reader who scrolled up is not moved.

**The player's.** `uiPrefs` `chatWidth` / `chatListHeight`, CSS pixels, null for the sheet's own (so a player who never
drags gets the sheet byte for byte: nothing is written). Both are numbers, so the online lane's boolean pin (OL1) has
nothing to say about them.

**The friends panel.** `ui/socialPanel.js` stood beside the chat at a FIXED 466px (14 + 440 + 12) over 840px and under
it at a fixed 390px below that (AUDIT SOC C13, which found the two sharing a corner). A resized chat would have slid
under both numbers. The chat now publishes its footprint on the document - its width and its list height as the same
custom properties its own rules read, and `data-dfchat-fit` for the side: beside when 14 + the box + 12 + the panel's
360 + 14 fits the screen, which at the sheet's own size is exactly the old 840 - and the panel places itself off them:
beside, past the box's right edge; below, past the open box's floor (`min(220px, 34vh) + 170` IS the old 390 at the
chat's own size). The old two rules stand for a page with no chat. The fit is re-said on the frame the screen changes
(a rotate, a resized window), on a change only; the chat's one window listener stays the key's.

**Pins.** `test/chatsize.test.js` (5): the law (the scale IS the width; the fit at the sheet's size is the old
breakpoint), the drag (captured, both axes, kept across a session, published), the bounds, the keys and the reset, a
reader kept on the newest line (and one who scrolled up left alone, another pointer's move and a right press
ignored), the fit following the screen, and by source every text size on the scale and no button on it.
`tools/mutants/chatsize.json`: 13, 13 dead. Re-aimed: `chatfit.json`'s badge-pass record and `font1.json`'s chat-line
record (the line's size is the scale's now); two CSS pins moved to the new forms, `chatfit` (the roster column) and
`soc3` (the list's height), each with its default unchanged. `tools/chatSizeProbe.mjs` drags the real grip in Chromium
at 1440x900 and 900x900: 660px and 19.5px after a 220px drag, the list taller by exactly the travel, Send still 14px,
the grip clear of the Close button, the friends panel beside the box at 1440 and under it at 900 and over it at
neither, the size back after a reload, and the sheet's own size after a double click - 24 checks.
