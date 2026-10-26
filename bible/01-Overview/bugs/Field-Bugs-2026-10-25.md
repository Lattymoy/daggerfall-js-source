# FIELD BUGS 2026-10-25 - an artifact's doll layer, and the company's word

Two Discord threads, handed over by the owner as two phone screenshots. In #general, Andink: "My Daggerfall fashion is
broken because artifacts like Spellbreaker looks like a typical Dwarven Tower Dorito instead of the unique texture (like
in the thumbnail). I feel like all the artifacts may be using the wrong texture, the thumbnails are correct but not on
the paper doll." In #suggestions, Grost's "Increase perk selection time for Elite Breaches": "Having only 10 seconds to
read over potentially 16 different options, with a total of 5 different categories, is not enough for time to think for
perk/boss/hall decisions ... At the very least, increase it to 20 seconds, maybe even 30", six thumbs under it; SeQueL:
"10 seconds is far to short. 20 seconds minimum". Read on main's `175f4ff48`, with the freeware's data
(`tools/fetch-data.sh`). The pins are `test/ui/fb1025_artifactdoll.test.js` and
`test/net/eliteGates/fb1025_asklonger.test.js`, the mutants `tools/mutants/fb1025_artifactdoll.json` (9) and
`tools/mutants/fb1025_asklonger.json` (3), all dead.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "artifacts like Spellbreaker looks like a typical Dwarven Tower Dorito ... the thumbnails are correct but not on the paper doll" | The doll resolved an artifact as its base template: Spell Breaker's Tower Shield record from the body's armor archive, dyed by its plate band's Dwarven. The list took DFU's artifact carve-out; the doll never did | ART-DOLL |
| 2 | "only 10 seconds to read over potentially 16 different options" | The company's word (`EG_ASK_MS`, Elite-Gates.md 16.4) was open 10 s; FIELD BUGS 2026-10-18d item 5 had named it tight and left its length to the owner | ASK-LONGER |

## ART-DOLL (1) - `src/ui/paperDoll.js`

WHAT DFU DOES. PaperDollRenderer.BlitItems asks GetItemImage(item, true, true), and GetItemImage reads the item's
InventoryTextureArchive and InventoryTextureRecord (`ItemHelper.cs:405-406`) - the same two virtuals the inventory list
reads. For an artifact those are what SetArtifact wrote: the archive from GetArtifactTextureIndices (432 male, 433
female) and the record from MAGIC.DEF (GetInventoryTextureRecord's carve-out, `DaggerfallUnityItem.cs:1745-1747`), with
the dye left Unchanged (`:611`). So DFU's doll and list draw one picture of an artifact, from TEXTURE.432.

WHAT THE PORT DID. `inventoryItemImage` (systems/item/itemTemplates.js) took the carve-out at AUDIT 63 F21 - the
thumbnails. `paperdollItemImage` resolved by group alone: an artifact shield went down the Armor arm, the base
template's record (the Tower Shield) in the body's armor archive (249/245 + morphology), dyed by its material - Spell
Breaker is `0x204`, Dwarven, so a yellow Tower Shield. Every armor and weapon artifact drew its base the same way: Lord's
Mail and Ebony Mail a plate cuirass, the Ebony Blade a katana, Auriel's Shield a kite shield.

Measured on the player's TEXTURE.432: 27 records. Spell Breaker is artifact 20, mapped to record 22, 57 x 112 at screen
(260, 72) - its own shield, on the doll's left arm. The four records no artifact maps to - 4, 6, 11 and 14 - follow 3, 5,
10 and 13, the Chrysamere's, the Ebony Blade's, the Mace of Molag Bal's and the Mehrunes Razor's: the right-hand
records GetItemImage's Either-hand bump (`ItemHelper.cs:412-414`) reaches, so the bump applies to artifacts as to
any weapon (the Chrysamere is two-handed, so its 4 stays unread).

FIXED. An artifact's armor or weapon draws its own record in the artifact archive, undyed, bumped by one when an
Either-hand artifact weapon is worn right (`paperDoll.js:"if (item.artifact && Number.isFinite(item.playerTextureRecord) && (item.group === 'Armor' || item.group === 'Weapons')) {"`).
One departure, named in Port-Ledger section A: the archive is the WEARER's gender, not the minter's - an item here
changes hands between players, and a woman wearing a man's Ebony Mail would draw his cuirass (433's record 7 is 37 x 54,
432's 38 x 50). The item keeps the minter's fields, so the list's icon and Open.CheckCastByItem's Skeleton's Key law
are unmoved.

NOT DONE. A peer's doll still draws an artifact as its base: the look carries six fields of an item
(`wire.js:"export const LOOK_ITEM_FIELDS = Object.freeze(['templateIndex', 'group', 'material', 'dye', 'variant', 'equipSlot']);"`),
and neither the artifact mark nor its record is one of them. Carrying them is a change to the relay's look, its own
slice.

## ASK-LONGER (2) - `src/net/eliteGates/egRun.js`

WHAT IT WAS. At a Redoubt the rest's window opens 6 s after the fall with the Vestige offer, the next circle's decrees
(up to four families, two cards each), the Ready and the respite together, and every question was open 10 s
(`egRun.js:"export const EG_ASK_MS = 30_000;"`, then 10_000). A decree nobody answered took the first shown. The Ready was
read when its ask closed, so a solo Ready ended the rest about 13 s after the window.

CHANGED. The word is open 30 s - the top of what the thread asked, and well inside the rest's 90 s (`EG_REST_S`), so
every question closes before the rest can end. It is one constant for every ask (Elite-Gates.md 16.4): the decrees, a
Dagon's Bargain at its shrine, the respite and the Ready alike. The screens count from the relay's `until`, so no client
changes. egRun.js rides the relay's bundle, so the law is a new relay: `world259` (`wire.js` RELAY_VERSION, its row in
`test/net/relayversion.test.js`; no frame changes, so a page needs no minimum), NOT YET DEPLOYED. What moves with it: a Ready voted at once now ends the rest 33 s after the window, not 13 s - the time to read
is the point, and it is the same for every company on the season's boards.

NOT DONE. SeQueL's longer answer (its end is cut off in the screenshot) reaches for "a 'ready' button"; the Ready vote
already ends a rest early, read when its word closes. Closing a word early once every member has answered alike is a
change to 16.4's law, left to the owner. FIELD BUGS 2026-10-18d item 5's key clash (Y is FreeMouse and the Ready vote)
stands as that record left it.
