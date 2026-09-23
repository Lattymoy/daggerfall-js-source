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
