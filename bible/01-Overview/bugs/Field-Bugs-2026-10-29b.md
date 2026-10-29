# FIELD BUGS 2026-10-29b - a boat that spins, a bowl no sibling may set out, families that never free, and Alinor's furniture

Four player reports from the bug-reports channel, handed over by the owner as screenshots. Read on main's `5995d0bb9`
with the freeware's data. The pins and mutants of each are named in its section; every mutant listed is dead.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "sometimes i cant moove, sometimes my bnoat begins to spin, sometimes it takes a direction and slowly waddles there" | An overladen hull kept its swing and its way for good; a key held as the page lost focus stayed held | LADEN-REST, KEYS-BLUR |
| 2 | "Can't place Hearth Cake: My other character technically owns the place", and "no way to delete or toss" an untradable item | The offering asked for the character that bought the home, not the account; the bowl weighed 2 kg | HEARTH-SIBLING |
| 3 | "i have no characters anymore and i still cannot make another bloodline", "being able to remove old families" | A deleted or fallen character never freed its family's slot, and nothing removed one | FAMILY-REMOVE |
| 4 | Alinor house: "Beds backwards, and the rest just can't be removed or modified in any way" | The town mods write most furniture as scenery, which BASE-HIDE never offered; their beds face half a turn from Daggerfall's mesh | BUILT-IN-MODS, BED-TURN |

## 1. The boat that spins, stops and drifts (LADEN-REST, KEYS-BLUR)

FOUND - THE LOAD. Come Sail Away weighs the captain's load against the hull's hold (ETHER-STRAND,
`Field-Bugs-2026-10-12d.md`), and every rate - way, swing, and the rate each is taken off by - is multiplied by
`boatCargoMod`. At twice the hold that is 0. Weighed again mid-turn (each magic round), the swing and the way she had
were kept for good: she spun, or drifted one way, and no rudder or oar took it off. Below 0 she crawls, and a swing came
off as slowly. The word said so for three seconds once.

FIXED. The load still slows her way and her helm coming on, and never her coming to rest (`comeSailAway.js` `laden`,
`resting`). A hull the load has stopped dead says "You're going to need a bigger boat" every round. Ledger A carries the
departure.

FOUND - THE KEYS. No host let go of a held key when the page lost focus (alt-tab, an overlay's shortcut). A D held
across it swung the helm on, and under oars A could not stop it: MoveRight is asked first. `ui/input.js` `letGoOnBlur` lets every
held key go on blur and when the page is hidden, as its keyup would.

THE FOUR HOSTS. `world.js` wired (it carries `worldModes.js`' and its dungeons' keys); `exterior.js` wired;
`dungeon.js`, the standalone dungeon that builds `dungeonContext.js`, wired; `interior.js` wired.

NOT CHANGED - A CONTROLLER. A stick past its dead zone sends a whole MoveLeft or MoveRight (`systems/gamepad.js`
`movementAxes`, DFU's InputManager), so a worn stick holds the rudder over. DFU does the same. ASKED OF THE REPORTER:
whether a controller is plugged in, what the pack, wagon and gold weigh, and whether "bigger boat" showed. A raised
Gamepad Stick Deadzone is the way round a drifting stick.

Pins: `test/systems/comeSailAway/laden_rest.test.js` (3), `test/ui/keys_blur.test.js` (3). Mutants:
`tools/mutants/laden_rest.json` (5), `tools/mutants/keys_blur.json` (4). Re-aimed by content: `csa_sailing.json`
CSA-D-moveaccel-coast-oars and CSA-D-cargo-said-every-time, `hostsplit.json` HOST-SPLIT-a-ceiling-under-its-host. The
wiring is one statement of `bootWorld`, its ceiling 35,316.

## 2. The Hearth Offering a sibling could not set out (HEARTH-SIBLING)

FOUND. The "Hearth Cake" is the Hearth Offering (template 2001). The pack's bowl is the account's count, so every
character holds it, and the client offers it at any home the account owns (ACCOUNT-HOMES). The service asked for the
character that bought the home (`server-account/src/festival.js` OWNED_HOME), so a sibling was refused "Set it out at
your own home", and its Fill and Take in found "No offering of yours stands here". The bowl is bound and pack-only, so it
could not be dropped either.

FIXED. Any character of the account sets the bowl out at the account's own home, fills it and takes it in - a deed's
home its holder's alone, never a guild's hall, as `homes.js` heldByAccount. The offering is stored under the home's
buyer, so the town's JOIN and the orphan law read it unchanged. The bowl weighs nothing, as CAKE-WEIGHT made the cake.

NOT CHANGED - A DESTROY ACTION. Nothing in the pack destroys an item; a bound piece goes only to the wagon or the
player's own storage, and the festival's faces are rebuilt from the account's counts. A Destroy for bound pieces is a
design of its own, for the owner (DFU has none either).

Pins: `test/server/witch1_festival.test.js` HEARTH-SIBLING (its "another character's" refusal moved),
`test/systems/festival/cake_weight.test.js`. Mutants: `tools/mutants/hearth_sibling.json` (4), `cake_weight.json`
HEARTH-SIBLING-bowl-weight. Re-aimed by content: `witch1.json` WITCH1-a-hall-is-a-home.

## 3. Families that never free (FAMILY-REMOVE)

FOUND. An account holds LINEAGES_MAX (40) families online, counted over every row it ever founded
(`server-account/src/legacy.js` putLineage). Deleting a character never touched its line, and a fallen one is never
deleted, so a one-life player who founds and loses forty houses can found no other. Enduring and Bloodline both found a
family at birth, so both were refused; Casual founds none.

FIXED. `/v1/realm/lineage/remove` lets go a line no living realm character plays (`removeLineage`). Its tombstones stay,
so a line founded again from a device's copy cannot bring its fallen back. The Online page lists the account's lines no
living character plays under **Families with no living character**, each with **Remove family** behind a confirm
(`ui/enhanced/enhancedMenu.js` spareFamiliesCard, `systems/legacy/waitingHouses.js` spareLines). The cap's refusal names
the way past it. The device's own copy stays, for the Hall of Ancestors.

Pins: `test/server/family_remove.test.js` (3, the real Worker), `test/systems/legacy/family_remove_menu.test.js` (2).
Mutants: `tools/mutants/family_remove.json` (8). Account acct220, no migration.

## 4. Alinor's furniture (BUILT-IN-MODS, BED-TURN)

FOUND - THE PIECES. Alinor's houses are classic house blocks drawn from the Bay's own city pool, most of them Beautiful
Cities' rebuilds (its first slice lays RESIGL03, RESIGL01 and RESIBL02). The town mods write most of a room's furniture
as scenery, ObjectType 0 - 105,135 of Beautiful Cities' room pieces against 44,315 written as props. BASE-HIDE built a piece
only of a prop (`scenes/interiorContext.js`), so the rest merged into the room. The Bay's mod houses were the same.
`Field-Bugs-2026-10-26r.md` row 139 closed this AS DESIGNED on another cause.

FIXED. A piece is a prop, or furniture written as scenery: Daggerfall's furniture families (41000-43999) or a piece
the mods stand inside (`systems/decor/decorMods.js` isRoomFurnishing). The room's shell (ObjectType 13), the ladder,
the machinery and a structure such as a beam stay the room's. DFU's prop gate still alone decides a container and a
furniture action. A bed taken out takes its rest with it. Daggerfall's own house blocks hold no furniture as scenery.

FOUND - THE BEDS. The coloured beds (42069-42086) are drawn on Daggerfall's bed mesh (WD3's alias), and the mods'
own bed faces half a turn from it: 244 of the 247 coloured beds laid where a classic bed stood are 1024 off its
YRotation, and a classic id the mods kept is 0 off in all 1,929. So every coloured bed lay backwards.

FIXED. The alias carries the turn (`world/townStandIns.js` TOWN_BED_TURN, `world/customModels.js` aliasTurnOf), and a
room's record of it is turned back by it (`world/interior/interiorLayout.js`): a coloured bed lies as the classic bed it
replaced. A bed a player placed keeps its own turn. Checked by the data, not by a render.

Pins: `test/scenes/builtin_mods.test.js` (3), `test/scenes/builtin_mods_alinor.test.js` (Alinor's RESIGL03 house on the
player's data, beside the Bay's pool it is drawn from). BASE-HIDE's source pin moved (`test/server/basehide.test.js`).
Mutants: `tools/mutants/builtin_mods.json` (8). Re-aimed by content: `fb1014_innbeds.json`
INN-BEDS-the-bed-gated-on-the-prop.

## Past the Bay

Every fix holds in every province. The houses' fix is pinned on Alinor's own block beside the Bay's pool; the sea's,
the offering's and the families' laws read no place.
