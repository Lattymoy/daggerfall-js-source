# AUDIT FB1029f - FIELD BUGS 2026-10-29f read cold, 2026-10-29

The owner: *"Audit this"*, of `7048bb485` - the fixes of `../bugs/Field-Bugs-2026-10-29f.md` (the housing thread, the
Gilded weapons, the off hand and Long Blade). Four cold lanes read a frozen worktree of that commit, each given the
files and one brief (what to hunt, how to prove it), never a conclusion. Each finding was proven on the real code - a
probe, a test that fails at the commit, or quoted lines - before it was reported, and proven again here before its
fix. Fixes carry an `AUDIT FB1029f <id>` comment; the pins name their mutants, `tools/mutants/auditfb1029f.json`.

| Lane | Read | Found |
|---|---|---|
| A | the account service: the rest row, the ground, the caps, the doors' list, the migrations | 7 |
| B | the yard's geometry: the house's foundation, the drawn border, two homes joined | 10 |
| C | the decorator, the catalogue and the hosts' wiring | 10 |
| D | the hands, the hand drop and the Gilded weapons | 8 |

## The account service (A)

**A1 (MEDIUM). A home's rest row outlived the home.** `decor_access` has no key to `homes`, and a character's delete
and a deed given up never cleared it. A chest's row named a piece the next owner never had; the rest row's id is the
home's, so the old owner's friend rested in the next owner's house. A character's delete now clears its homes' rows,
every claim clears what no home holds (`server-account/src/accessOrphans.js`), and an arena move carries the rest row.

**A2 (MEDIUM, recorded). A ground is held to the price and the town's blocks, both the client's word.** A forged
client naming fewer blocks keeps a wider ground for the same price. The price was always the client's word (HOME-PRICE),
so this widens nothing a forged client could not already do; DECOR_CAP_MAX bounds the gain. Only the service knowing
each town's blocks closes it; the record says so (section 2).

**A3 (MEDIUM) = C1 (HIGH). A door put back on one device stayed out on another,** whose save's scene record stood the
door and whose next furniture write put it out again for everyone. The service's list now sets the doors exactly
(`decorInteriorDoors.js` apply), and an online home's save record is kept whole and never stood.

**A4 (LOW). The pin said "a sale clears it" and never sold.** It sells now, and a mutant on the sale's clear dies.
The ground's `IS NULL` race guard is recorded `equivalent` with its reason.

**A5 (LOW). A piece could take the rest row's id** and, removed, take the row with it. decorPieceOf refuses it.

**A6 (LOW). A home priced by another law asked for its ground every visit,** refused each time. Asked once a session.

**A7 (process).** Main took world287 to world289, acct222 to acct224, item law 15 and migrations 0194 and 0195 since. At
the merges of main this branch's relay is world290, its account service acct225, its item law 16, its migrations 0196
and 0197.

## The yard's geometry (B)

**B1 (HIGH). The edge froze the frame for seconds in Hammerfell's towns.** Every pair of the house's walls and a
neighbour's was a cut, so a desert house's trace ran up to 4 s on the main thread, at the first placement and each
recentre. Only walls that face are cut now, at most YARD_BORDER_CUTS_MAX of them. Sentinel's worst trace is 38 ms; a
test counts the trace's work, as a clock on a shared runner cannot.

**B2 (MEDIUM). The edge's memo signed every line of a town's pixel each frame,** 1 to 6 ms. It keys on the yard held.

**B3 (MEDIUM) and B4 (MEDIUM). A joined yard stood pieces on the other house's lot,** past the service's bound where the
law refused them, and a sale of that house left them in the next owner's yard. A piece stands on its own lot alone:
joining draws no midline between one owner's houses and nothing more.

**B5 (LOW). The edge read lines within 12 m; the law reads every line.** Sentinel drew 1,558 refused points inside its
edge. It reads every line nearer than the lot's farthest point from the house now (a wall's farthest point is a corner).

**B6 (LOW). A joined edge passed the decal batch's 64 bands** and lost the rest. Joined edges peak at 39 now; past 64,
the slopes are read coarser.

**B7 (LOW). EAVE-FOOT counted two walls meeting at a V's point as one crossing.** A plane is keyed by its line.

**B8 (LOW, recorded). A portico open on one side reads as the house** on some big manors. No cheap law does better.

**B9 (LOW, recorded). Two homes across a capital's slice border never join:** each slice is a map.

**B10 (LOW). Float noise drew a hairline band twice** (Wayrest's house 131846). A cut a hundredth of a metre from
another is the same cut.

After, over every house a player could own in Sentinel, Daggerfall and Wayrest, no point more than 0.9 m from the edge
disagrees with the law, read with every line as the law reads them.

## The decorator, the catalogue and the hosts (C)

**C1 = A3.**

**C2 (MEDIUM). Two pieces in a yard's Trees and plants shared a name:** the re-filed potted plants and crops numbered
"Plant N" beside the climate's. They are Houseplant and Crop now, Daggerfall's own words ("Plants", "Crops"), and a
measure over every block pins that no offer holds two of one name.

**C3 (MEDIUM). A town mod's street pieces skipped the new filing,** so its crops and animals stayed Outdoors. Filed by
what they stand in as; a mod's room keeps its own kind.

**C4 (LOW). Mixed archives.** TEXTURE.100's skulls, bones and bodies are Remains and TEXTURE.190's gargoyle and
columns Statues, record by record; TEXTURE.218, "Pots and Pans", goes with the boxes as Pot.

**C5 (LOW). The ghost cast a shadow,** and a held figure under the people lane drew nothing. Its draw casts nothing and
the figure's flat is drawn. A hung piece still shows no ghost: the decal pass has no dither (recorded).

**C6 (LOW). The nudge.** Windows lets Shift go for a numpad key under NumLock, so Ctrl is a fine step too; on the grid a
step is the grid's. A room does not bound the nudge, so a piece can be pushed through an outer wall (recorded: it stays
in the room's list).

**C7 (LOW). The rest chip.** An answer landing after the owner opened another home's decorator set that one's chip;
it is its own room's now, and a press on a chest while it writes is not dropped. The words Me, Friends, Party and
Guild are in the player's language now. A guest re-entering a home keeps the last visit's grant until the room's list
answers (recorded: seconds, and only what the service granted).

**C8 (LOW, recorded).** 629 of 1,255 names moved with the filing; nothing keeps a name (favourites key by id), and the
furniture looks offer the dungeons' tables and benches now.

**C9 (LOW). "Nudge back" read "backwards" in several languages;** every language says "closer" now.

**C10 (LOW, recorded).** The climate's nature is a room's by the filing and a yard's by its own set alone.

## The hands and the Gilded weapons (D)

**D1 (HIGH). The swap key undid HAND-FOLLOWS.** The hand had already followed the new weapon when the swap's own step
toggled it back to the empty hand: a Longsword readied over fists, training Hand-to-Hand. The swap sets the hand where
the weapon landed (`weaponRig.js` handDoor useHand), pinned on the real rig.

**D2 (MEDIUM). The swap's bare hands readied the off hand's dagger.** A bared hand is kept (handDoor keepHand).

**D3 (MEDIUM, the owner's call).** A Gilded weapon's crimson shows over a paid Aura Armory weapon piece, as an element
already does. `04-Characters/Aura-Armory.md` section 8 says so now; the owner may turn it round.

**D4 (LOW). A save made under the bug kept the empty hand.** A pose now says it was chosen under HAND-FOLLOWS
(`handKept`); one from before follows once on load.

**D5 (LOW). A two-hander dropped on the left hand was refused.** A piece goes to the hand that holds it.

**D6 (LOW).** Weapon-Glow.md named world286; it names world290, the relay this branch ships, now.

**D7 (LOW, recorded).** The item maker refuses a Legendary and takes a Gilded piece; the record keeps the reports' ask.

**D8 (info, recorded).** The glow's field key holds eight looks and Gilded is the eighth: the next one widens it.

## Met, not this change's

The whole suite on the merged head (38,191 tests, this session's freeware download of ARENA2): FB1002 CRACK-LIP fails,
its test and the code it reads main's own; `staffpanel5` failed once and passes alone. WD1's patch hash failed once
under load in an earlier run and passed here.
