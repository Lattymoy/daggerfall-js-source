# FIELD BUGS 2026-09-28 - the card that ran off the screen

From the Discord (#bug-reports, Cruor), through Mac, with a screenshot of Ruhn's Horned Crown's card on the Enhanced
pack:

1. *"New sigil items descriptor is a bit long! You can still interact with it by right clicking, but notably all the
   buttons on it's pop-up card are.. off the screen, because it's got a bit much on it!"*

Mac: *"1. Audit this properly 2. Ensure online functionality is perfect 3. Address screenshot for current and future
weapons/gear. Want to improve this and reduce text bloat"*.

## CARD-FIT: the card fits its window, and says what a glance needs (1)

**Reproduced first.** `tools/cardFitProbe.mjs` (new) draws the real pack over the real sheets with the heaviest cards
the game has - a piece of Ruhn's Regalia carried (the report's own Horned Crown), a raid set's weapon, Ruhn's
Gatecleaver, a Legendary with an enchantment, a worn set piece held at its stage, a raid piece with the longest name, a
stack with its how-many field, a locked piece - at a 1920x1080 screen, a 1366x768 laptop (the reporter's class), a
1280x720 window, a 1024x600 netbook, a phone on its side (740x360) and a phone upright (390x844), and presses every
button of every card. Before: **the buttons of every set piece's card were below the screen at every size, a 1920x1080
screen included** - the Horned Crown's card stood 1,032 px tall in the pack's 660 px window (the window is capped there
on every screen), placed from the window's top, and the Gatecleaver's 1,117. 80 of 406 checks failed.

**Why.** The card is a tooltip placed beside its row (PX19g), as tall as what it says (PX21f, Mac: no scrolling in the
tooltip), and a set piece says a great deal: its tier and three affixes, its lore, a sigil block of six rows (the rune
and stage, a sentence on what a set's sigil is, five gems, a bar, the numbers, a note on how it grows), a set block of
up to eighteen rows (the name, the Prince and the role, nine places, the stage line, and each tier's whole sentence -
the Wrath of the Warden's alone ran five lines), four rows of numbers, and two rows of buttons under all of it. The
placement clamped the card's top to the window and nothing clamped its height. On a phone two old rules made it worse:
the phone column's sheet (`max-height: 70dvh; bottom: 0`) leaked into the tip, stretching it to the window's foot and
cutting it, and the phone's own sheet rule set `top: auto` with no `bottom`, so the "sheet" stood where the flow left it.

**The fix, for every card and every piece to come:**

- **The buttons are always on screen.** The card is a column: its words in a body of their own (`.card-body`), its
  buttons a row UNDER the body, never inside it. The placement caps the card at the band it may stand in (the window's
  AND the screen's, less what the tip carries beside its card), and `fitCard` sheds the picture's size and then the
  picture while the body will not fit; past that the body scrolls and the buttons stay put. A phone's card is a real
  sheet at the screen's foot, rising to 80% of the screen. Position is written in the tip's own containing block (a
  narrow screen's layout positions a box between the window and the tip).
- **Less text.** Every set tier has a BRIEF - "+15 fire resist, +2 fire a blow", "Cheat death, then half damage 4s",
  "Kill marks next foe: +15% (10s)" - one line of the card, never past 32 characters at any stage (a test holds every
  set's, a new one's too); a recovery is its own number, drawn in the dashed frame a recovering power wears on the HUD
  ("180s"). The set block on a card: the name, the pieces worn and the stage in one head, the nine places as a thin row,
  what would raise it, and three one-line tiers; the whole sentence is under the pointer. The sigil block on a card: two
  rows - the stage and the numbers toward the next, then the five stages as ONE bar with the stage it grows into filled
  as far as it has drunk - and a weapon's blow in one line ("+2.4% damage (up to +12%)"). The lore left the card. The
  numbers are whole pairs flowing two a line. Four buttons share a row (the kit's 104 px a button is a dialog's).
- **The Info box is the whole read**: the tier's lines and the lore, the sigil's and the set's blocks in their whole
  dress (the Prince and the role, every sentence, every note). The classic tooltip, the trade window and a chat post
  say each tier by its brief too ("2 pieces - The Burning Gate: +15 fire resist, +2 fire a blow"), so a set piece's
  lines wrap in two rows at most where they ran to four.

After: 438 of 438 checks. On every screen 720 px tall or more every heavy card reads WHOLE, no scroll - the Horned
Crown's card is 568 px with its full picture, the Gatecleaver's 543; on the netbook two cards scroll their body a
little, on a phone on its side most do, and on every screen every button is pressed. The heaviest card's words fell
from 694 characters to 264. `10-UI/UI-Arc.md` CARD-FIT.

## AUDIT CARD: every surface an item is read on, measured

Mac's "1. Audit this properly": a read-only lens drew every surface an item's words stand on (the click card, the phone
sheet, the 641-860 px band, the hover card, the right-click menu, the Info box, the classic tooltip, the trade
window's strip, the shop counter, the Broker, the doll's set strip, a chat post, the quick-loot plaque) in headless
Chromium at eleven screens and pressed what could be pressed. Its findings against CARD-FIT's tree:

- **Already fixed by CARD-FIT** (U1-U3, U7, U8, U11, U17): the click card taller than the screen at every desktop
  size, the phone sheet that could not scroll, the band where the phone's sheet leaked into the placed card and
  printed a stray "CLOSE" over the title, the pad that could not reach the buttons, the hover card cutting its
  numbers on a 625 px laptop (the probe now runs at 1366x625, 768x1024 and 844x390 too - all whole), the last affix
  dressed as lore, the set block's bloat.
- **U4, the trade window's strip, was the worst left: 1,475 px tall on a phone** (the lists squeezed out, Offer and
  Close 150 px under the window's foot - measured on CARD-FIT's own tree). It says the item in BRIEF now
  (`itemBriefLines`: the tier and its affixes, the sigil's line, the set's name and what I wear of it - the tiers are
  under the pointer, the lore the pack's Info box's), in a box that scrolls; on a phone its buttons wrap under the
  words. 165 px at a desktop, 244 at most on a phone; the probe presses its buttons at nine screens.
- **U10, a chat post**, printed the POSTER's worn count and stage, ran out mid-tier at 240 characters and never said a
  sigil weapon's blow: it posts the brief now, the set by its name ("Ruhn's Regalia set").
- **U6**: Back (Escape, the pad's B) with a card open closed the whole pack; it puts the card away first, as it does
  the Info box, the menu and the gold field.
- **U5**: the pack's host was `overflow: hidden` - still scrolled by the browser to show a focused control, so a Tab
  onto a button under the screen shoved the whole pack up and left it there. It is `overflow: clip`.
- **U9**: the Info box's Close scrolled away with its words on a short screen, and a press on its dim never closed it
  (the dim IS the box's element). The words scroll under a Close that stays; the dim is outside.
- **U14**: hovering the item whose card is open laid its hover card over the card. Not any more.
- **U15**: a pick whose row is not drawn left the card unplaced and unbounded; it is fitted and stands at the window's
  edge.
- **U16**: the doll's strip of worn sets grows a line a set and eight sets can be worn at once; past five lines it
  scrolls.
- **CARD-FIT's own slip**: its body wrapper took the click card's tier line out of its colour and pips (a child
  selector); both selectors take the body now.

Not changed: U12 (the affix says "armor", the stats "Armour"; the fire affix a percent beside the set's points - each
is its own system's word), U13 (the shop counter's strip names no tier or affix - a feature, not a fault). The probe:
685 of 706 checks before these, 706 of 706 after.

## AUDIT ONLINE: the raids, the sets and their rewards, online

Mac's "2. Ensure online functionality is perfect": two more lenses read RAID3-RAID4b online - the relay's raid ledger,
the receipts, the account service's claim, the device's queue and pool, and the sets' powers and pieces against the
running hosts - and reproduced what they reported. Every finding is fixed and pinned; the record is in
`03-World/Raiding-Parties.md` "AUDIT RAID" (R1-R8: a socket's first word decided an honest raid - the worst; an earner
away from the town's cell never had its receipt; a fresh key took a raid being fought out of its cell; a town's thanks
given once a device, not once an account; forged raids paid half an hour's Renown bound again) and
`11-Multiplayer/Sigil-Sets.md` "AUDIT SETS" (M1 "under half health" read the owner's health against this machine's
roll; M2 an older client wiped a container holding a raid piece; L1-L6). One relay deploy (world123) and one account
deploy (acct18, migration 0017).

AUDIT ONLINE 2 (Mac: *"Fix it and do another audit"*) fixed what that audit left "not changed" - the relay now reads
every raid against the day's own roll (RAID-ROLL, world124), a receipt's life is the relay's clock, a load in the
session lets the spoils' crash door ask again, a corpse's pile the taker cannot read goes back to the body, and a
refused trade says whose - `03-World/Raiding-Parties.md` "RAID-ROLL" and "AUDIT ONLINE 2".

## For Mac

- **The words are mine.** Each tier's brief is written to say its numbers in a line - read them on the cards (the Test
  Room's loot ladder lays out every Aetheric piece) and say which to change.
- **The recovery tag** ("180s", dashed) reads like the HUD's recovering chip; the words "Recovers in 180 s" are under
  the pointer and in the Info box.
- **A phone on its side** (740x360) is the one screen where a heavy card still scrolls most of its body: the pack's
  window is 338 px tall there, and two rows of buttons take a third of it.
- **The deploys.** The relay (world123) and the account service (acct18, with its migration) go out together; the relay's
  deploy drops every connected player once. A town's thanks now wait for the account service's answer: with the
  service down they come when it answers. AUDIT ONLINE 2 moves the relay on to **world124** (RAID-ROLL).
- **RAID-ROLL's one step that is yours.** Run `node tools/raidTowns.mjs --arena2 <your ARENA2 folder>` (or read the line
  the game prints to the browser console the first time a hub asks: "[raid] this world's towns table: ...") and put
  the hash in `server/wrangler.toml` as `RAID_TOWNS_SHA256`. Until then the relay reads each raid against the day's
  draws alone - which already refuses any start, party and target the day never rolled - and with it, against the
  day's whole roll.
