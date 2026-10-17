# FIELD BUGS 2026-10-15c - eleven threads, one pull request

Eleven Discord threads handed over by Mac on 2026-10-15 with: "Please tackle all bugs in ONE PR". Two of them are one
bug (the market's bodies). Read on the code as it stands at main's `bd385fc6` (the FIELD BUGS 2026-10-14 roll-up merged).
Two calls were Mac's, asked: "Store as loose" (LOOT-LOOSE) and "One body per account" (ONE-BODY).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Random encounter from box - Slaughter fish" | SEARCH1's crate foe drew from the dungeon's layout roster, swimmers and all | SLAUGHTER-BOX |
| 2 | "Happened after a server restart ... friend who is a duplicate of them" | a cell's room kept two sockets of one account | ONE-BODY (relay world207) |
| 3 | "the town of penbrugh every animal and food stand item turned into freaks" | a town mod's factioned market flats stood Morrowind bodies | STALL-FLATS |
| 4 | "The NPC's are clustered into groups and all have their heads down and they just rotate" | the same | STALL-FLATS |
| 5 | "No boots model on legendary boots" | chain boots have no imperial chain model; the figure stood bare skin | BARE-BOOTS |
| 6 | "alchemy and some other ingredients when looted from a dungeon are unstorable" | law 3, as written - looted units are never counted | LOOT-LOOSE |
| 7 | "Quest enemy spawned inside object" | a body inside a pillar to the ceiling read free | QUEST-FOE-WALL |
| 8 | "Crafting arrows at the workbench is useless" | a mod's Arrow weight made a Twig five arrows, not two | BENCH-ARROWS |
| 9 | "NONE are the Tambeth Hawkley Residence" | a residence picked in another player's home before QUEST-HOME | QUEST-RESIDENCE |
| 10 | "Morrowind Axes Registered Wrong Due to Reversed Naming Convention" | DF_TO_MW_WEAPON matched the axes' names, not their hands | MW-AXES |
| 11 | "Boulder's glint offset is way off" | a boulder's aim point was half its rock's height | BOULDER-GLINT |

The four hosts (THE FOUR HOSTS RULE): every fix sits in a module the hosts share, save three in-place edits - `world.js`'s
Stores deposit hands the page's order through (LOOT-LOOSE), `worldModes.js`'s quest stand marks its person
(STALL-FLATS) and its two home door titles read the quest's name (QUEST-RESIDENCE) - each the same line, none grown.
`exterior.js` and `dungeonContext.js` take nothing new: the market bodies stand in `world.js` and `exterior.js` through
the one `personLook`; the crate's foe in `dungeonContext.js` through `pickRosterFoe`; the pillar's free in every host
through `freeLodgedFeet`. And PVP-ESCROW's handoff leaves `bootWorld` for `scenes/wildEscrowHost.js`, the host back
under the ceiling it had before FB1015's raise (`01-Overview/Host-Split.md`).

## SLAUGHTER-BOX: a crate's foe stands on the floor, never a swimmer (1)

`src/systems/searchables.js` pickRosterFoe; `src/characters/dungeonEnemies.js` WATER_SPECIES (exported, the one home);
`src/systems/wild/wildDungeons.js` (its own `new Set([11, 41, 42])` retired for it).

FOUND. SEARCH1 (our own - DFU has no searchables) wakes two foes a third of the time a chest or a crate is searched, and
a chest's or a crate's draws from the dungeon's layout roster (`collectDungeonEnemies`). That roster holds RDBLayout's
Slaughterfish, Dreugh and Lamia for markers under water (RDBLayout.AddEnemy's water veto keeps them there and nowhere
else), and nothing took them out before the pick: two Slaughterfish on the dry floor by the crates. The rest ambush reads
ENCOUNTER_TABLES 0-18 (table 19 holds the swimmers) and the outdoor hosts roll nothing while swimming.

CHANGED. The pick leaves out WATER_SPECIES; a roster of swimmers alone wakes the grave's undead, as an empty one did.
Pinned in `test/systems/search1_searchables.test.js` (the Aquatic species of EnemyBasics are the layout's three, one home);
`tools/mutants/fb1015c_slaughterbox.json` 3, all dead. Online: the search is rolled on the searcher's page and its foes
are loose stands, so the fix holds for the room; no relay change. `06-Systems/Searchables.md`.

## ONE-BODY: a place stands one body an account (2)

`server/src/index.js` the hello's one-socket law; `src/net/wire.js` RELAY_VERSION `world207` (`world206` on its branch, renumbered past main's SERPENT5 `world206` at the merge).

FOUND. A relay deploy restarts every room and drops every socket (`relay-deploy.yml`). Peers are kept by peer id, and
a cell's room (`world:x,y` - the open country and the towns) or a world room (a dungeon, an interior) let one account
stand under two ids: only a gate's court, a siege's field and a Super dungeon's realm closed an account's older socket
on a new hello (PVP-REF, SD3), and the hub's one seat (ONESEAT) leaves a hung or half-open socket in its cells. So a tab
that outlived the restart's gap stood beside the account's new one - frozen, clickable, and seen by the friend's own
page, whose welcome named it (`rosterFor` carries no account, and since NAME-AS a name is not unique, so no client could
tell them apart). The client's own staleness (80 s, four heartbeats) hides a silent peer, but a welcome names it again,
and a socket still heartbeating stands for good. AUDIT ONESEAT R3 had recorded the gap, not fixed it.

CHANGED (Mac, asked: "One body per account"). A cell's room and a world room close an account's older socket when it
says hello again under another id (CLOSE_REPLACED, its leave sent to the room), as the gate's, the siege's and the Super
dungeon's rooms already did. Two tabs of one account in a place are one player now - the older rule ("two players")
reversed. Relay `world207`, its law row in `test/net/relayversion.test.js`; the deploy drops every player once. Pinned in
`test/net/fb1015c_onebody.test.js`; five relay pins that modelled two tabs of one account in a place moved (PIN MOVED in
each); `tools/mutants/fb1015c_onebody.json`.

## STALL-FLATS: a body stands only for a person's picture (3, 4)

`src/characters/peopleBodies.js` personLook; `src/scenes/worldModes.js` questStandLook (`questPerson`).

FOUND. Beautiful Villages gives its market blocks' food, goods and animals a faction (TVRNAS02, TEMPASB0, TEMPBSB0,
RESIAS02: faction 584, flags 6), and RMBLayout makes every factioned flat a StaticNPC - DFU's own rule, kept. MWNPC8b's
people lane then stood a Morrowind body for each: in TVRNAS02 alone 101 of 112 bodies stood for scenery (TEXTURE.213,
10021, 205, 204, 211, 214 and the rest), a heap of men at each stall, idle and turning to the eye (`PERSON_TURN_RATE`).
DFU draws a person only of RDBLayout.NPCFlatArchives (FlatTypes.NPC) and the rest as their billboards; AUDIT WD3 G1 had
carried that law into the click ray alone. The bowed heads in the second report are likely MW-HEADS1's backwards Breton
heads (re-baked by MW-HEADS2) - not proven.

CHANGED. `personLook` stands no body for a flat outside NPC_FLAT_ARCHIVES (`world/npcFlatArchives.js` isNpcFlat) - the
editor's 199 with the rest, so MWNPC8b's own marker check folds into it. A quest's person keeps a body whatever FLATS.CFG
pictures them with (`questPerson`). The StaticNPC list is DFU's still. Pinned in `test/scenes/mwnpc8b_streetdungeon.test.js` on
the vendored pack's TVRNAS02 (113 StaticNPCs, 11 bodies, none for scenery); `fb1015c_stallflats.json` 2, dead;
`mwnpc8b.json`'s MWNPC8b-marker-bodied re-aimed by content. `04-Characters/Morrowind-NPCs.md` 13b.

## BARE-BOOTS: what imperial chain lacks, iron (5)

`src/formats/morrowind/mwItemMap.js` DF_TO_MW_ARMOR_MATERIAL, mwArmorRecords.

FOUND. The Legendary was innocent: "The Wayrest Courier's Treads" is Boots (108) on whatever material the loot made it,
and DFU's RandomArmorMaterial makes one boot in five Chain. Imperial chain is a cuirass, greaves and coif in Morrowind,
and the figure's armour (`composeWornArmor`) answered "the classic sprite stands" for the rest - on a figure that has no
sprite, so the skin stood. Every chain boot, gauntlet and pauldron, Legendary or not. And the material chain was walked
by material, not by piece: Tribunal attached, Adamantium boots stopped at adamantium (no boots) and never reached ebony.

CHANGED. Chain's second token is iron (the NPCs' wardrobe's own stand-in, `wardrobe.js` CHAIN_PIECES), and the chain
is walked by piece. A departure from MW-D28's recorded judgement ("instead of a wrong metal standing in"), named in
`mwItemMap.js` and `04-Characters/Morrowind-NPCs.md`. Pinned in `test/systems/fb1015c_bareboots.test.js` (every armour Legendary
on every base and material, through `applyRarity` and the equip door); `fb1015c_bareboots.json` 2, dead.

## LOOT-LOOSE: a looted material goes into the Stores as loose (6)

`src/ui/professions/profPages.js` the Stores page's Put in and Put everything in; `src/scenes/world.js` the deposit's order.

FOUND. Law 3 as written (`06-Systems/Materials-Bag.md` 5): the service counts only what it handed out, and a looted
unit - rolled on the client - is held and never counted, so the page named it "unstorable" and Put in moved nothing.
The third report of it (FIELD BUGS 2026-10-09c, 2026-10-09f, 2026-10-13e), each leaving the call to Mac.

CHANGED (Mac, asked: "Store as loose"). Put in and Put everything in take what is held past the count as loose - BAG-
CRAFT's origin, by its `work` order: the counted first by `all`, then the rest by `work`. Loose units serve every
crafting station and never a writ, the guild Stores or a Drakes sale, so nothing past the count reaches the economy. The
card says "N loose". No service change. Pinned in `test/systems/professions/fb1009c_uncounted.test.js` (PIN MOVED: Put in had been shut);
`fb1009c_uncounted.json` 11, dead. `06-Systems/Materials-Bag.md` 4.

## QUEST-FOE-WALL: a body inside a pillar to the ceiling is freed (7)

`src/characters/foeSpacing.js` lodgedIn.

FOUND. B0B70Y16 Dragonslayer places its Dragonling at a random QuestSpawn marker, as DFU's GetSiteMarker does, and the
port's stand is DFU's (GameObjectHelper.CreateEnemy at the marker; no free-spot search - DFU's controller pushes out
of an overlap on its first move). CRATE-FREE (FIELD BUGS 2026-10-04d) frees a body stood inside a model, but asked a lid
within LODGE_REACH over the knee: a pillar running to the ceiling (uncapped, or capped past the reach) holds a body for
good - the collider's push is facing-blind - and measured, a flyer stood in a 1 m, 6 m pillar was still in it after ten
seconds of chase. No ARENA2 here: whether the Elyrrya Tradition's marker stands in a pillar is not measured; the other
reading (Meaner Monsters' 2.5x Dragonling sprite over a 0.35 m capsule, half the billboard behind a wall it stands by)
is DFU's too and is not changed.

CHANGED. With no lid in reach, a body is lodged when every bearing meets a face's back - inside a column. Pinned in
`test/systems/quest/fb1004d_cratefree.test.js` (the column, the capped pillar, beside it, a sleeve open at both ends, the free, and a
tall crate in a corner); `fb1004d_cratefree.json` 24, dead (two re-aimed by content, two new).

## BENCH-ARROWS: a Twig fletches two arrows, as written (8)

`src/systems/fletching.js` fletchYield.

FOUND. FLETCH's law is a piece's weight over the Arrow's 0.25 kg - Twigs two, a Pine Branch four, a Wood Bundle ten,
"the workbench's twenty stay the better trade" (`05-Combat/Arrow-Supply.md` 3). `templateByIndex` answers a mod's patch
first, and Roleplay & Realism: Items (on by default, forced online) makes the Arrow 0.1 kg: a Twig was five arrows, four
the bench's twenty without its plank and its ingot. The suite never registered the mod's patches.

CHANGED. The Arrow's weight is the classic Arrow's (`ITEM_TEMPLATES`). The bench is untouched. Pinned in
`test/systems/arrowsupply.test.js` with the mod's patches registered; `arrowsupply.json` 52, dead.

## QUEST-RESIDENCE: a home a quest names says the quest's name (9)

`src/systems/online/onlineHomes.js` homeDoorTitle; `src/scenes/worldModes.js` the door's plaque and the info click.

FOUND. N0B00Y09 "Research Notes" sets its scholar in `Place _scholar_home_ remote house` - a nearby town's house, named
"The <surname> Residence". Before QUEST-HOME (main, 2026-10-15) `isPlayerHome` asked `homeAt`, which knew no town the
page had not asked, so the pick could land in another player's online home - whose door says its owner's name over the
building's. No door in Tambeth said "The Hawkley Residence". QUEST-HOME's re-pick moves such a site on the next online
boot (the residence takes a new name - the journal says it); it cannot move one in a town with no other house, or one
the player has stood in. Not reproduced on the reporter's save.

CHANGED. A home a quest still names says the quest's name first: "The Hawkley Residence (Aldric's home)". Pinned in
`test/systems/online/fb1015c_questresidence.test.js`; `fb1015c_questresidence.json` 3, dead; `home1.test.js`'s hover pin moved.

## MW-AXES: the Morrowind axes cross Daggerfall's names (10)

`src/formats/morrowind/mwFirstPerson.js` DF_TO_MW_WEAPON, dfWeaponShape.

FOUND. Daggerfall's Battle Axe is its one-hander and its War Axe its two-hander (DFU's ItemTemplates; WEAPON_HANDS 127
'Either', 128 'Both') - the reverse of every later game. DF_TO_MW_WEAPON matched the names (War_Axe -> AxeOneHand,
Battle_Axe -> AxeTwoHand), and the type picks the mesh, the icon, the clips, the grip and the sheath: a War Axe swung
one-handed beside a torch, a Battle Axe took both hands.

CHANGED. Battle_Axe -> AxeOneHand (Morrowind's war axes), War_Axe -> AxeTwoHand (its battle axes); the shape tie-break
crosses the two names. Every row now holds the hands its weapon has, the Flail the one declared fudge. A material
Morrowind has no two-handed axe in falls back to the type's first record (off-metal) - not measured without the
retail data; the Wood-Axe (128) now swings two-handed on the Morrowind body, as its rule says. Pinned in
`test/characters/fb1015c_mwaxes.test.js`; `fb1015c_mwaxes.json` 3, dead; `fparm`, `daedric_model_shape` and `mwattackclip` pins
moved. `Port-Ledger.md` MW-D9's row corrected.

## BOULDER-GLINT: a boulder's glint stands on its stones (11)

`src/scenes/mineHost.js` BOULDER_LIFT.

FOUND. A node's act - its face and its glint (`ui/professions/profReticle.js`) - stands at the node's aim point, its foot plus its
`lift`. A boulder's lift was half its ROCK's height (to 1.2 m), set over the loose stones the player sees as the boulder:
the face stood 30 degrees over the stones at a metre and a half, against 8.7 for a vein. Not changed, recorded: a
boulder's stones stand off the rock's box (`rockFoot`), which for a turned rock can be far from the rock as it shows.

CHANGED. A boulder's lift is BOULDER_LIFT, 0.4 m - the stones' scale against a vein's 0.5 over its ore. The look still
meets the node up to its glow's top. Pinned in `test/scenes/fb1001_mining.test.js` (NODE-AIM's lift pin moved);
`fb1015c_boulderglint.json` 1, dead.
