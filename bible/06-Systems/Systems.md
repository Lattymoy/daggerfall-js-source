# Systems

ACTIVE - see `Systems-Arc.md` for the live record. S1-S22 SHIPPED (effects
and the spell/effect library, chargen, biography, items and equip, loot,
containers, talk, crime and the court, rest and recovery, diseases, poisons,
the Cure family, concealment, FreeAction) plus the economy sub-arc E1-E3
(shop templates and stock, the shelf mount, selling, the guild bookshelf, the health status box), plus ORL1's OBLIVION-REMASTER-LIKE LEVELING - the alternative leveling system a character chooses at creation, plus the DWARVEN THUNDERLOCK (`thunderlock.js`) - the port's own weapon, the first item in this port that Daggerfall does not have, with its two custom templates and the Dwemer Pellet it spends, and `appRoot.js` - the SITE ROOT off a module's own URL, which MAP-FIELD found the hard way on the held map and AUDIT-THUNDERLOCK F7 found again on the weapon's art, plus FIELD-GUN-MW2's pair for the port's OWN Morrowind assets - `urlArchive.js` (the `{has, get, load, loaded}` duck over files that ship with the build, moved out of `weaponSheathing.js` once it had a second caller) and `ownMwAssets.js` (the Thunderlock's NIF and DDS, mounted after the player's loose files so their own replacer still wins). `gravestoneLore.js` (GRAVE1: the epitaph pool an Info-mode activation that hit nothing reads from while the player stands in a Graveyard location - location-gated rather than per-headstone, because the stones are block models with no record of their own).  `mapTabs.js` (EM1: the tab law of the one held map - which sheets a place offers, DERIVED off the flags every host keeps rather than declared) and `automapFloors.js` (EM2: the storeys a Daggerfall dungeon does not record, derived off the reveal index's own triangles - a flat floor votes, a ramp only gets drawn). `characterId.js` (CHARID1: a character is an ID rather than a name, so a new character can never overwrite an old one's save) and `saveTransfer.js` (SP1: saves move between the website and the app - a whole set exported as one zip, and a zip or a Saves folder imported back). and `notify.js` (ENH-NOTICE3, 2026-09-21: THE ONE DOOR EVERY MESSAGE GOES THROUGH - DaggerfallUI's static `MessageBox` written once (`AddHUDText`/`PopupMessage` have a door there too, unwalked by any shipping producer yet - AUDIT ENH-NOTICE3 F4; SetMidScreenText stays `ui/midScreenText.js`'s); the hosts register a PRESENTER for their one overlay slot and their PopupText, a box is offered by priority then recency - the dungeon context, the modal modes, the outdoor slot, which is world.js's showQuestBox ladder written once - and falls to the HUD line rather than vanishing; the door never forks on the skin, the draw does), and `worldHover.js` (WORLD-HOVER, 2026-09-21: WHAT THE CROSSHAIR IS ON, as a record - World Tooltips 1.1's naming ladder over the SAME activation race the press walks, so the plaque and the button can never disagree; pure of the page, with `ui/worldPlaque.js` owning the node, the dress and the skin gate). and `worldTooltips.js` (WORLD-HOVER: World Tooltips 1.1's NAMING LADDER - jefetienne's own source ported arm by arm and cited line by line: the sixteen Daedra by billboard record, the action models, the house containers by full model id, the doors and what they say is shut. The WORDS only, because the ray, the pick and the reach are `worldHover.js`'s and the face is the plaque's). `cloudSaves.js` (ACC2: the cloud is a THIRD DESTINATION for the carrier SP1 already built - a slot pushed to the account service's R2 under (characterId, saveName), and one pulled back down through `saveTransfer.js`'s own import law, so there is no second merge rule and the cloud is a backup rather than the truth). 195 modules live under
`src/systems/`. Items still routed here are collected in
`01-Overview/Port-Ledger.md` section C; scope in
`01-Overview/Port-Doctrine.md` phase plan.

AUDIT 18 rewrote this page: its opening paragraph declared the arc
unstarted, with the Readers/World prerequisites its only news, through the
whole S and E arcs. A section
index nobody opens goes stale silently, so
`test/audit18_bible_docs.test.js` now fails if a section index says "Not
started" while its own `*-Arc.md` records a SHIPPED slice.

## HT1 - HANDHELD TORCHES, THE MOD, 1:1 (2026-09-14, Mac's call) - SHIPPED

Mac: "Next mod to integrate 1:1 is this." The whole account is
`Handheld-Torches.md` beside this file; the ledger row is Port-Ledger A.
The short of it: RedRoryOTheGlen's Handheld Torches 1.4.1 - four
MonoBehaviours in a compiled DLL read off the IL method by method -
ported into `systems/handheldTorches.js` (the component the weapon rig
runs beside the Weapon Widget clone: the hand law over the player's
light, the ignite / drop / throw keys as Unity KeyCode names through
`systems/keyCodes.js`, the first-person hand sprite on Weapon Widget's
Bob and Inertia laws) and `scenes/droppedTorches.js` (the pool each of
the five hosts owns: the dropped and thrown torches burning on the
world clock, picked back up, saved; the foe set alight with DFU's own
Continuous Damage-Health and the mod's light and flame riding it). The
mod's 39 textures are vendored - the author's own art, not a render of
ARENA2. TextKey and the two Tuple kinds are new to the Mods pane. Under
the Morrowind arms the law runs and the held torch is the classic
lane's; a Morrowind LIGH mesh on the `torch` animation group pends
Mac's word. Pins: 19 in `test/ht1_handheldtorches.test.js`. Not
filmed: a game.
