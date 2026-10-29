# FIELD BUGS 2026-10-29b - a boat that spins, a bowl no sibling may set out, families that never free, and Alinor's furniture

Four player reports from the bug-reports channel, handed over by the owner as screenshots. Read on main's `5995d0bb9`
with the freeware's data. The fixes were then read cold and corrected (`../audits/Audit-FB1029B.md`); this record
states them as they stand after it. Every mutant listed is dead but the two marked equivalent.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "sometimes i cant moove, sometimes my bnoat begins to spin, sometimes it takes a direction and slowly waddles there" | An overladen hull kept its swing and its way for good; a key held as the page lost focus stayed held | LADEN-REST, KEYS-BLUR |
| 2 | "Can't place Hearth Cake: My other character technically owns the place", and "no way to delete or toss" an untradable item | The offering asked for the character that bought the home, not the account; the bowl weighed 2 kg | HEARTH-SIBLING |
| 3 | "i have no characters anymore and i still cannot make another bloodline", "being able to remove old families" | A deleted or fallen character never freed its family's slot, and nothing removed one | FAMILY-REMOVE |
| 4 | Alinor house: "Beds backwards, and the rest just can't be removed or modified in any way" | The town mods write most furniture as scenery, which BASE-HIDE never offered; their beds face half a turn from Daggerfall's mesh | BUILT-IN-MODS, BED-TURN |

## 1. The boat that spins, stops and drifts (LADEN-REST, KEYS-BLUR)

FOUND - THE LOAD. Come Sail Away weighs the captain's load against the hull's hold (ETHER-STRAND,
`Field-Bugs-2026-10-12d.md`), and every rate - way, swing, and the rate each is taken off by - is multiplied by
`boatCargoMod`, 0 at twice the hold. Weighed again mid-turn (each magic round), the swing and the way she had were kept
for good: she spun, or drifted one way, and no rudder or oar took them off. Part laden, a swing came off as slowly.

FIXED. The load still slows her way and her helm coming on, and never her coming to rest - let go, eased, or with the
helm put against her swing, which takes her through 0 at the light rate and the other way at the load's
(`systems/comeSailAway/ladenRest.js` swingStep, wayRests; the runtime's rates take the step's `rest`). A way wanted
across her line, her oars' slide, gathers at the load's rate. A hull stopped dead says "You're going to need a bigger
boat" every round she is asked to move, never one with no hold (the Carrack under Classic). Ledger A carries the
departure.

FOUND - THE KEYS. No host let go of a held key when the page lost focus. A D held across an alt-tab swung the helm on,
and A could not stop it: MoveRight is asked first, at the oars and under sail. `ui/input.js` `letGoOnBlur` gives every
held key its keyup at the document on blur and when the page is hidden, so each host's and each window's own release
runs (the automap's held keys too); a mouse button is left to its own mouseup. The pad lets go of its own on blur
(`ui/gamepadInput.js`), so a stick still held presses again.

THE FOUR HOSTS. `world.js` wired (it carries `worldModes.js`' and its dungeons' keys); `exterior.js` wired;
`dungeon.js`, the standalone dungeon that builds `dungeonContext.js`, wired; `interior.js` wired. Each is one call:
`bootWorld` 35,315 to 35,316 (its ceiling raised by one), `bootExterior` 5,074 to 5,075, and the helm's runtime
`createComeSailAwayRuntime` 2,502 to 2,506 - its call sites; the rules live in the leaf.

NOT CHANGED - A CONTROLLER. A stick past its dead zone sends a whole MoveLeft or MoveRight (`systems/gamepad.js`
`movementAxes`, DFU's InputManager), so a worn stick holds the rudder over. ASKED OF THE REPORTER: whether a controller
is plugged in, what the pack, wagon and gold weigh, and whether "bigger boat" showed. A raised Gamepad Stick Deadzone is
the way round a drifting stick.

Pins: `test/systems/comeSailAway/laden_rest.test.js` (9: Classic and Responsive, oars and canvas, let go and against,
part laden and dead, the slide, the word), `test/ui/keys_blur.test.js` (4). Mutants: `tools/mutants/laden_rest.json`
(22, one equivalent), `tools/mutants/keys_blur.json` (9).

## 2. The Hearth Offering a sibling could not set out (HEARTH-SIBLING)

FOUND. The "Hearth Cake" is the Hearth Offering (template 2001). The pack's bowl is the account's count, so every
character holds it, and the client offers it at any home the account owns (ACCOUNT-HOMES). The service asked for the
character that bought the home (`server-account/src/festival.js` OWNED_HOME), so a sibling was refused "Set it out at
your own home", and its Fill and Take in found "No offering of yours stands here". The bowl is bound and pack-only, so it
could not be dropped either.

FIXED. Any character of the account sets the bowl out at the account's own home and fills it - a deed's home its
holder's alone, never a guild's hall, as `homes.js` heldByAccount - and takes it in wherever it stands. The offering is
stored under the home's buyer, and it stands while the account owns the home by the same law (STANDS_ON), so an heir
taking the home up leaves it standing. The bowl weighs nothing, as CAKE-WEIGHT made the cake.

NOT CHANGED - A DESTROY ACTION. Nothing in the pack destroys an item; a bound piece goes only to the wagon or the
player's own storage, and the festival's faces are rebuilt from the account's counts. A Destroy for bound pieces is a
design of its own, for the owner (DFU has none either).

Pins: `test/server/witch1_festival.test.js` (3 HEARTH-SIBLING tests; its "another character's" refusal moved),
`test/systems/festival/cake_weight.test.js`. Mutants: `tools/mutants/hearth_sibling.json` (7), `cake_weight.json`
HEARTH-SIBLING-bowl-weight.

## 3. Families that never free (FAMILY-REMOVE)

FOUND. An account holds LINEAGES_MAX (40) families online, counted over every row it ever founded
(`server-account/src/legacy.js` putLineage). Deleting a character never touched its line, and a fallen one is never
deleted, so a one-life player who founds and loses forty houses can found no other. Enduring and Bloodline both found a
family at birth, so both were refused; Casual founds none.

FIXED. `/v1/realm/lineage/remove` lets go a line no living realm character plays and none whose fall is held for a
Resurrect (`removeLineage`). Its tombstones stay, so its fallen stay fallen. A copy made from a removed line never
founds it again (`no-lineage`), and a birth on a line removed mid-birth lands nowhere. The Online page lists the lines
no living character plays, from a roster the realm answered, under **Families with no living character**, each with
**Remove family** behind a confirm (`ui/enhanced/enhancedMenu.js`, `systems/legacy/waitingHouses.js` spareFamilies).
The cap's refusal names the way past it. The device's own copy stays, for the Hall of Ancestors.

Pins: `test/server/family_remove.test.js` (7, the real Worker), `test/systems/legacy/family_remove_menu.test.js` (4).
Mutants: `tools/mutants/family_remove.json` (14). Account acct220, no migration.

## 4. Alinor's furniture (BUILT-IN-MODS, BED-TURN)

FOUND - THE PIECES. Alinor's houses are classic house blocks drawn from the Bay's own city pool, most of them Beautiful
Cities' rebuilds (its first slice lays RESIGL03, RESIGL01 and RESIBL02). The town mods write most of a room's furniture
as scenery, ObjectType 0, and BASE-HIDE built a piece only of a prop (`scenes/interiorContext.js`), so the rest merged
into the room. The Bay's mod houses were the same. Daggerfall's own house blocks hold no furniture as scenery.
`Field-Bugs-2026-10-26r.md` row 139 closed this AS DESIGNED on another cause.

FIXED. A piece is a prop, or furniture written as scenery: a model Daggerfall lays as a prop in its own rooms (121,
measured over BLOCKS.BSA), or a piece the mods stand inside that is not their structure (`systems/decor/decorMods.js`
isRoomFurnishing). DET's pillars, the mods' beams and planks, and a ship's rigging stay the room's, and so does a piece
with no floor under it. DFU's prop gate still alone decides a container and a furniture action. A bed taken out takes its
rest with it. A home of Beautiful Cities stands 23.7 of its models one by one on average (10.7 before), 99 at most.

FOUND - THE BEDS. The coloured beds (42069-42086) are drawn on Daggerfall's bed mesh (WD3's alias), and the mods' own
bed faces half a turn from it. FIXED: the alias carries the turn (`world/townStandIns.js` TOWN_BED_TURN), and a room's
record is turned back by it (`world/interior/interiorLayout.js`). Measured on the room's shell: of the 4,029 coloured
beds the packs lay, 2,806 stood through the walls unturned and 141 do turned, none made worse. A bed a player placed
keeps its own turn.

Pins: `test/scenes/builtin_mods.test.js` (5), `test/scenes/builtin_mods_alinor.test.js` (2: Alinor's RESIGL03 house on
the player's data beside the Bay's pool it is drawn from, and the prop table measured again). Moved: BASE-HIDE's source
pin (`test/server/basehide.test.js`) and AUDIT 64 F17's (`test/world/audit64_layout.test.js`). Mutants:
`tools/mutants/builtin_mods.json` (13).

## Past the Bay

Every fix holds in every province. The houses' fix is pinned on Alinor's own block beside the Bay's pool; the sea's,
the offering's and the families' laws read no place.
