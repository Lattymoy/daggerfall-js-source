# AUDIT HERALD-CARDS / TIMERS2 - the world events' cards and the Timers in groups, read cold (2026-10-22)

The owner: *"Audit this"*, of HERALD-CARDS and TIMERS2 (`de6d3518e` and `b3a99473d` - `11-Multiplayer/World-Bosses.md`
THE HERALD, HERALD-CARDS; `10-UI/UI-Arc.md` TIMERS2). Three lenses. The two cold ones read a frozen worktree of
`b3a99473d`, so the fixes in the working tree never changed what a reader saw (`Home.md`, DO NOT FIX WHILE THE VERIFIER
IS READING):

- **H** - the herald, read cold. Every post's body was checked against Discord's Execute Webhook and embed limits,
  using 195 worst-case inputs over all fourteen kinds. The pings and the owed/retried/let-go law were compared with
  the base, kind by kind. The thread routing was traced through `_heraldSend` to the herald's state. Mutants were run
  on a copy.
- **T** - the Timers window, read cold. It was the real pause face in Chromium (`mountEnhancedMenu`, pause mode) with a
  live fixture, at 1280x800, 390x844 and 844x390. The lens covered the keyboard, a coarse pointer, contrast on the
  screenshots' own pixels, and mutants injected in memory.
- **R** - the records. The bible's, the ledger's and the comments' claims were held to the code, along with the
  sheet's own laws (`enhancedStyle.js`'s 44px query, FONT3's floor).

Every finding was reproduced before it was fixed. Each fix is pinned where it was fixed (`AUDIT HERALD-CARDS <ID>` in
`test/net/herald/heraldcards.test.js`, `AUDIT TIMERS2 <ID>` in `test/ui/enhanced/timers2.test.js`), and each pin has a
mutant that dies: `tools/mutants/heraldcards.json` 28/28, `tools/mutants/timers2.json` 28/28. The records that the
fixes moved were re-aimed by content, and every list they touch was run again.

## Fixed - the herald (HERALD-CARDS)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H1 | high | A thread Discord refuses - an id that names no thread of the channel (the channel's own, pasted), or a thread deleted, locked or private - answered a 4xx, and `_heraldSend` took it as the post's refusal "for good". So every post of that family was let go unposted, the omen's ping with it, and through the gate's thread all four families were. The log said only "Discord said 404". | Refused in its thread, the card is posted to the channel itself, once, and the refusal is said with the family, the thread and Discord's own reason. It is let go only if the channel refuses it too (a forum channel takes no post without its thread). A busy Discord (429, 5xx) is still owed and tried again, never sent to the channel instead. |
| M1 | med | No pin saw a beat route its card to the wrong family's thread. Dropping the family from all four beats' sends passed 89 of 89 herald tests: the relay pin called `_heraldSend` by hand. | Every send names its family (no default), and each beat is driven with all four threads set: the gate's omen, the serpent's bells, the Abyss Dungeon's rise and the Spire's Redoubt, each URL checked against the card's own family. |
| L1 | low | The card cut each part to its bound but not the whole to Discord's 6000. A field with a blank name or value passed. The bounds pin's own card was 32,080 characters, which Discord would refuse whole. | The whole is held to 6000, with the text cut before a fact is dropped. A field needs both halves. Real posts are far inside (the widest is 430). |
| L2 | low | A name like "- Ann" (`sanitizeName` keeps it) begins a field's value, where Discord draws a list. | `heraldName` never begins with a hyphen. |
| L3 | low | A thread setting that is no Discord id fell back to the gate's thread without a word, where a webhook put wrong is said. | Said in the hub's log. |
| L4 | low | The omen's pin held the card's words under 2000 - the content's bound, not the embed's, so it could catch nothing. | The pin measures the embed against 6000 and the content against 2000. |
| S1 | low-med | The threads' relay floor (`RELAY_CFG_KEY_MIN`, 243) is a number apart from `RELAY_VERSION`. A renumber at a merge (this repo's custom) would leave it behind, and a client would say a thread to another branch's world243, which closes the hub link on it. | Pinned to the version row: the row `RELAY_CFG_KEY_MIN` names must be HERALD-CARDS's own (`test/net/relayversion.test.js`). |
| R1 | low | `World-Bosses.md` said a card's footer is "one word a kind" (Rite broken, First of the Spire). It said every reachable name passes `heraldName` (the gate's place is the wire's word), and that each part is "never refused" (the whole could be). `wrangler.toml` read as one forum post an event (it is one a family). | Said as they are. |

`RELAY_VERSION` world243 re-hashed in place (undeployed). At the merge it was renumbered world250, past main's world243 to
world249, and `RELAY_CFG_KEY_MIN` moved to 250 with it: S1's pin failed on the floor left at 243, as it was written to.

## Fixed - the Timers window (TIMERS2)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H1 | high | The window was sized to its rows and centred. A filter's press shrank it (680 to 469px at 1280x800) and centred it again: the bar left the pointer, a second press fell on Close (after Resets) or on the scrim (twice on World, on a phone), and the window shut. | One height (`min(680px, 86dvh)`; a short screen's whole height). Measured: a press on Raids leaves the window and the button where they were, and a second press there does not close it. |
| H2 | med-high | The bar's buttons measured 30px on a touch screen, and TIMERS2's own phone rule had taken the Boards from 46px to 36px - under the sheet's 44px law (AUDIT UI 2026-08-27's `(max-width: 860px), (pointer: coarse)`). | 44px buttons under that query; the door at its own 46px. Measured at 390x844 and 844x390. |
| M3 | med | The bar moved while it was watched: a live row's first start gave its button and All's a 12px dot, moving the buttons after them; a tenth raid widened Raids and wrapped Resets to a second line, dropping the list 36px. Every change rebuilt the buttons, so a press caught between its down and its up was lost. | The live mark drawn under a button (`box-shadow`), never beside its word; the count two figures wide; the buttons written in place, built again only when a group comes or goes; at 8px a side the six fit one line at 1280. Measured: no button moves as a raid goes live or a tenth arrives. |
| M4 | med | The fall-back to All was this window's alone. Raids shown, emptied, then back, and the next redraw of the pause face (a quest's clock, a tab) showed Raids alone again; so did the next opening. | The fall-back is the choice: All. |
| M5 | med | A redraw of the pause face put the focus back on the filter's button (`ui/domRepaint.js`), and the window's own "focus Close" took it away a frame later (TIMERS1's line, which the bar now meets on every redraw). | Close takes the focus only from outside the window; the buttons carry `data-focus` keys for the redraw. |
| M6 | med | The whole body scrolled, so the bar went up with the rows (1,185px off the top on a long raid day). On a phone on its side the head and bar took 180 of 370px. | The list alone scrolls under a bar that stands (measured: thirty raids scrolled 2,495px, the bar unmoved); another group starts at its top; a short screen gives the lead's line to the list. |
| L7 | low | The count at 0.75 opacity read 4.1:1 on Stone's light patches and 4.52 on a pressed Slate button; the live dot on the pressed (brass) button read 2.1:1, 1.06:1 on Stone - under 3:1 for a mark. | The count in the button's own colour; the mark dark on the pressed button, Stone's light green elsewhere. |
| L8 | low | The bar's name was "Show". The live mark was missing from the button's name (colour alone). German said "1 laufen". The Battlespire's head was a plain "Spire" where the questlines name the Battlespire (de "Die Kampfspitze", fr "La Flèche de bataille", ru "Боевой Шпиль"...). A translated "Now" stood over the English "ends 22:54". A "Now" on a coming row with a door was unpinned. | "Which timers to show"; the mark said in each button's `aria-label`; German's plural; the head in each language's own name; `timers.ends` and `timers.at` through the text core, drafted for the thirteen; the door rows pinned. |
| L9 | low | The row's diamond stood at the row's top: 10px above a live row's title (its clock three lines with the "Now"), 11px above a one-line row's. | Set by the title's own line. |
| L10 | low | The record said "above", the code "beside"; `show()` was a test's alone (it reset the remembered choice between tests). | Said as it is; `show()` gone - the pins press the buttons. |
| R2 | low | The "Now" badge was 10px, under FONT3's 11px floor (found by the full suite after the push; fixed in `b3a99473d`). | 11px. |

## Left, recorded

- **French "Sièges et batailles"** reads "sieges" as well as "seats". It follows the language's own glossary (seat ->
  siège), which every seat string uses; a translator's call, not a draft's.
- **The window's own words** - its title, lead, rows and the weekday in "Sun 18:00" (`systems/eventTimers.js`,
  `localWhenText`) - are English, as TIMERS1 left them. The fifty strings of the row law are owed their localization wave.
- **Safari** does not focus a button on a click, so the focus on a pressed button is the browser's there (only Chromium
  measured). A focused Boards whose row ends falls to the page, and the next Tab brings it back (TIMERS1's, seen again).
- **Not seen**: the cards in a real Discord channel (no webhook here) - the first omen after the relay's deploy is the
  eyeball; Discord's exact answers for a locked or private thread (400 or 403 - both are taken alike).
- **Two `wb12d.json` survivors** (`WB12d-the-gold-s-dress-moved-by-r`, `AUDIT-WB12d-T-relay-herald-next-at-ignores-rite`)
  survive identically on `828bf96ba`, before either slice. They are not this audit's, and are said here so they are
  not taken for its.
