# FIELD BUGS 2026-10-16c - six reports from the Discord's bug-reports channel

Six threads Mac handed over as screenshots, 2026-10-16, read on the code as it stands at main's `0ce25a8ef` (HOST-SPLIT 2
merged). Each was read cold by its own lane first; the causes below are the ones the code shows. (Main took
`Field-Bugs-2026-10-16b.md` meanwhile, so this record is `-16c`, its pins `fb1016c_*`, its service `acct148` and its
migration 0123 - `acct146`, `fb1016b` and 0121 on its branch, renumbered at the merge.)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | slater.mp3, "Can't gain reputation with the guild": "I did few quests because i had - rep there and i get this: ( 21 more i need) and did few quests and its need 36 more!" - the hall read "Reputation -35 of 10 (21 more to come)" | The Roll's pace, read the wrong way round: online a guild's reputation is credited at most 15 a real day and the rest is OWED - the quests' reputation was earned and on its way, and "(21 more to come)" read as 21 more needed. Beside it, a real gap: REP6's review, on the character's own days, expelled over reputation the Roll still owed | fixed (OWED-PACE) |
| 2 | Flylighter, "Grandfathered Items triggering trade lock": "Enchanted a few pieces of Ruhn's set back before the change that disallowed enchanting them. Now, I'm getting a trade lock notice on account of my gear!"; a week on, "I've been wrongly trade-locked for a week" | INT1's item law (law 5) held every Aetheric piece to no enchantment rows at all - AETHERIC-MAKER's record had promised the pieces enchanted before it would keep their rows - so the realm's judge read them as forged and held their owners' trade, a strike each time one was taken up again, the third a timed hold | fixed (MAKER-KEPT): law 6, `acct148`, migration 0123 |
| 3 | æther, "Collection: Clipping Objects": "at Newwark west gate" (a wooden bed against a house's wall, a townsperson beside it); "The King's Attire in Holwych has a tree right in front of the door, not clipping but a bit odd." | Read, not fixed - see CLIP-GATE below: most likely the Immersive Travel carriage team IT1 lays on Beautiful Cities' gate-and-tavern composite; the tree most likely Beautiful Villages' own | flagged to Mac's eye |
| 4 | Phayezorix, "Instances Option: Not Present": "after the recent lil patchy patch its no longer there" | No regression found - see INSTANCE-OFFER below. The offer, its wiring and the relay's version gate are byte-identical since INSTANCES merged, the live relay answers `world211` (past the gate's 208), and report 6's player chose Instance four minutes after this report | asked of the reporter: which place, and which quest |
| 5 | Mona Polca, "Quick loot is not suppressed when skinning": "This makes it a bit hard to see." | While a gathering act plays the profession pick answered null, and every host reads null as "the race's winner" - the body under the knife, its loot rows and the lit row's tooltip drawn over the trace | fixed (SKIN-PLAQUE) |
| 6 | MD-Geist, "Quest Objective only spawned in 'Instance' Dungeon, not 'Public'": "the Objective just did not want to spawn (I tried the dungeon in 'Public' mode) even after 'Quest Repair' ... Also as a side note the automap needed to be revealed again in 'Instance' even though it had been fully explored and revealed in 'Public'" | INSTANCES' own law, said too late and too quietly: a public room the world lays smaller stands none of a quest's things (`Instances.md` 4), the line saying so came once, after Public was chosen, and Quest Repair answered "Nothing was missing". The automap: one record, two layouts, the restore guard wiping each in turn | fixed (QUEST-ELSEWHERE, LAYOUT-KEEP) |

## OWED-PACE: the owed said as earned, and never expelled over

`src/systems/guild/guildServiceFlow.js` reputationLine, onPushEffects; `src/systems/guild/guilds.js` updateRank.

FOUND. Online the account service holds a guild's reputation (`11-Multiplayer/Chapters-Arc.md` 3.3): a gain is credited
up to ROLL_GAIN_DAY_MAX (15) a guild a UTC day and the rest stored as owed (`src/net/npcChapterLaw.js` rollCredit), paid
by rollDrain as each new day opens room. The report's numbers are exactly that: from -50, three quests' +5 credited to
-35 and the day full, seven more owed (20 - the screenshot's 21 with a +1 beside them), three more owed (35 - "its need
36 more"). Nothing lowered the reputation; the row said "(21 more to come)" and was read as 21 more NEEDED. The gap
beside it: REP6's review (updateRank) runs on the character's own calendar, which travel and rest spend far faster than
the Roll's real days, and it read the credited reputation alone - a member at -35 with 36 owed (+1 once paid) could
reach the review the same real day and be expelled. The service already counts the owed at a join
(`joinRecordable(row.rep + row.owed ...)`); the client's review did not.

FIXED. The hall's row says the owed is earned and its pace: "Reputation -35 of 10 (21 more already earned - it arrives at
most 15 a real day)", in the thirteen whole languages. And the review counts what the Roll owes against the EXPULSION
alone (`ctx.owed`, onPushEffects's standingOwedOf): a member it would expel whose standing with the owed is -10 or more
is put on probation again, 28 days on. The owed never ends a probation and never buys a rank - the Roll's pace stands.
Offline nothing is owed and REP6 is as it was. Ledger A: THE ROLL'S OWED KEEPS A MEMBER.

`test/systems/guild/fb1016c_owedpace.test.js` (3); `test/systems/fb1015g_guildwords.test.js`'s two owed rows moved
(PIN MOVED). `tools/mutants/fb1016c.json` OWED-PACE rows.

## MAKER-KEPT: the maker's era keeps its rows

`src/systems/item/itemLaw.js` MAKER_ERA_AETHERIC, aethericFindings, makerFindings; `server-account/migrations/0123_maker_kept.sql`.

FOUND. AETHERIC-MAKER (`Field-Bugs-2026-10-03b.md`, 2026-10-03, d10bd32b81) closed the item maker to an Aetheric piece
(`src/systems/enchanting.js` itemMakerRefuses) and said of the pieces already enchanted: "A piece enchanted before keeps
its rows". INT1's item law (2026-10-09, `06-Systems/Integrity-Arc.md`) did not: aethericFindings answered 'aetheric' for
any Aetheric piece with a row, and makerFindings 'enchantments' for any maker row on one. The account service's judge is
that law (`server-account/src/judge.js` JUDGE_VERSION), so every checkpoint carrying such a piece held its character's
trade ('law', `server-account/src/realm.js` holdRefusal) and showed "a <piece> it carries is not as the game makes it".
Each time the piece was taken up again after a clean checkpoint was a strike; the third, since AUTO-HOLD, a week's timed
hold that no clean checkpoint lifts - and migration 0120 turned every law hold at three strikes into one. No pin caught
it: the honest-producer sweep (`test/honestItems.mjs`) enchants through the maker, which refuses an Aetheric piece now,
so it never minted one of these.

FIXED. Item law 6: an Aetheric piece of a record the maker took before the refusal - Ruhn's Regalia and the raiding
parties' three sets, the 36 records that stood at d10bd32b81 (their ids frozen by the pin) - keeps the rows the maker
laid on it (every row a maker row, `enchantCost`), and makerFindings holds them to the maker's own law (the group, one of
a kind, the exclusions, the budget of the piece's power). Every other Aetheric record (the Serpent's set, Numidium's, came
after the refusal) and every Gilded piece (refused from GILDED1's first day) is held to none, as before; a found row, a
roll's mark or a record's lines moved is still 'aetheric'. The maker's refusal of a NEW row is unchanged.
ITEM_LAW_VERSION 6, carried by `acct148` (the law moves the service: `test/systems/tech1_roster.test.js` LAW_SERVICE).

THE HOLDS ALREADY LAID. An untimed law hold lifts at the first checkpoint under law 6 by itself. Migration 0123 lifts the
rest - every character, not staff's, whose law findings were ONLY 'aetheric' and 'enchantments' on the templates the
era's records stand on, and kept whole (a finding whose count passed the findings it kept is left): the hold, its timed
end, the strikes and the timed holds served, written among the character's findings as a staff act
(`{ act: 'clear', by: 'maker-kept', was, until, strikes, served }`). `law_sig` is left as it was, so a checkpoint in the
deploy's gap between the migration and the Worker is no new strike. The later sets' records share some of those
templates and a finding keeps no record id, so a forged row on one of them is lifted too - and found again, and held, at
its first checkpoint while it is carried.

`test/systems/item/fb1016c_makerkept.test.js` (3), `test/server/fb1016c_makerkept_lift.test.js` (2); the law's version
pins moved in `int1_itemlaw` and `tech1_roster`; every `acct147` pin moved to `acct148` (the version history's newest line, `renown_char`'s, leads with it). `tools/mutants/fb1016c.json`
MAKER-KEPT rows. Deploys with the account service (the judge bundles the law); the relay carries no item law.

## SKIN-PLAQUE: the act owns the look

`src/scenes/gatherHost.js` ACT_OWNS_LOOK, hoverHit.

FOUND. The gathering host's pick (hoverHit) answered null while an act played, and the three hosts that wire it read
null as "no node - the race's own winner" (`world.js` profHoverOver, `worldModes.js` and `dungeonContext.js`'s
`profHoverPick?.(ray) ?? ray`). Mid-skin the winner is the body under the knife, so worldHoverFrame drew its loot plaque -
"Giant Bat (dead)", "2 bodies", its rows and the lit row's tooltip - over the trace, and the wheel and P/J still lit and
armed its rows; E was the act's all along (AUDIT 29 D3). WORLD-HOVER's own rule, "the plaque and the button never
disagree", broken by the plaque.

FIXED. While an act plays hoverHit answers ACT_OWNS_LOOK, a hit naming nothing (`key: null`): the hosts' `??` keeps it,
resolveHover resolves it to no frame, and foldQuickLoot(null) lights nothing for the wheel, the arm or a take - the DOM
plaque, the classic panel and the tooltip all down. Every act, not the knife's alone: the Basket, the vein, the tree and
the net's throw stand the same. No host changed; `exterior.js` (`?exterior`) and the standalone dungeon wire no
gathering host.

`test/systems/prof7_client.test.js` (the real skinning act: the pick mid-skin, and the plaque's again after) and
`test/systems/worldhover.test.js` (the plaque down and nothing lit under the act's pick). `tools/mutants/fb1016c.json`
SKIN-PLAQUE rows.

## QUEST-ELSEWHERE: said before the choice, and by the repair

`src/scenes/instanceDoor.js` dungeonSite, choose, INSTANCE_TEXT.questPublic; `src/scenes/worldModes.js`
mountQuestResources; `src/systems/quest/questRepair.js` repairActiveQuests, questRepairText, questElsewhereLine.

FOUND. As designed (`11-Multiplayer/Instances.md` 4 and 9): online a quest's markers are the dungeon whole's, and a
public room the world lays smaller (`world/smallerDungeons.js` onlineDungeonSize - small or medium for three dungeons in
four) stands none of them (`systems/instancePlaces.js` questMountsHere). The popup asked "Public or your instance?"
without saying so; the line that did ("Your quest's business here waits in your instance.") came once a build, inside,
in the moment of the transition; and Quest Repair's mount hit the same gate, put nothing back (the whole layout's markers
still held every target) and answered "Nothing was missing from your active quest."

FIXED. A dungeon's site knows whether the world lays its public room smaller (`relaid`, dungeonSizeFor online), and where
it does and a running quest names the place, the popup says under the choice: "Your quest's business here is in your
instance alone - the shared dungeon is laid smaller and holds none of it." A public room laid whole (a quarter of the
dungeons, the main story's keeps) stands the quest's things, and the popup says nothing more there. The mount's gate
answers 'elsewhere', and a repair in that room says where the things are and how to reach them, never "nothing was
missing". The design is unchanged: Public at a quest's dungeon is still the public room.

`test/systems/quest/instances3_door.test.js` (QUEST-ELSEWHERE; the gate line's source pin moved). `tools/mutants/fb1016c.json`
QUEST-ELSEWHERE rows; `tools/mutants/instances.json` INSTANCES-MOUNT-UNGATED re-aimed at the moved line.

## LAYOUT-KEEP: one record, every layout's map

`src/systems/automap/automap.js` bindAutomapLayout, keepLayout, AUTOMAP_LAYOUTS_KEPT, snapshotAutomap, restoreAutomap.

FOUND. The automap's record is the place's (automapDungeonKey, `${regionIndex}/${name}`, DFU's "RegionName/Name"), and
online one dungeon stands in two layouts - its public room the world's size, its instance Daggerfall's whole. The restore
guard (RestoreStateAutomapDungeon's, Automap.cs:2378-2386; the port drops the discovery whole on a disagreement, Ledger A
C2) saw the other layout's block names each time the player took the other room, and wiped the map, the notes and the
portals - both ways.

FIXED. On a disagreement the record keeps the discovery it held under its own blocks (`layouts`, at most
AUTOMAP_LAYOUTS_KEPT, the oldest let go first), and takes back the new layout's if one was kept - its map, entrance,
notes, portals, trail and drops - instead of the wipe; a layout no record knows still starts blank, as DFU's guard rules.
The kept layouts ride the save (`layouts`, written only where one is kept; an older reader ignores it). The key is
unchanged, so every save, the castle beacon's read (`worldModes.js`) and PARTY-MAP's wire key are as they were. Ledger
A: A DUNGEON'S MAP IS KEPT PER LAYOUT.

`test/systems/automap/fb1016c_layoutkeep.test.js` (2). `tools/mutants/fb1016c.json` LAYOUT-KEEP rows.

## INSTANCE-OFFER: no regression found

Read against every commit since INSTANCES merged (#940, `27524cb64`): the offer (`src/scenes/instanceDoor.js` choose,
`src/systems/instancePlaces.js` instanceOffer), its version gate (`src/net/instanceRoom.js` relaySupportsInstances,
INSTANCE_RELAY_MIN 208, the welcome's `v` read in `src/net/online.js`) and its wiring (`world.js` createInstanceDoor,
`worldModes.js` enterDungeonDoor and enterBuildingDoor) are unchanged - TIDY moved import paths and comments, HOST-SPLIT
2 moved `buildPixelNow` and nothing the door reads. The relays deployed since are 209, 210 and 211, every one past the
gate, and the live bundle carries the door and the gate. Report 6's player chose Instance four minutes after this one.
What hides the popup by design: a place no running quest names (and not the Hold, nor a party member's instance); a way
in that is not a player's door (a quest's teleport, Recall, a load); the Hold's popup offers no Public row (HOLD-ONCE); and
in the moments after a relay redeploy, before the new socket's welcome, `instanceOk` is false. Nothing to fix without the
place and the moment; the reporter is asked.

## CLIP-GATE and the Holwych tree: read, flagged

Not changed - neither can be measured without the player's ARENA2 (the models' sizes), and a guess at a clearance would
drop carriage teams that stand well.

- **Newwark's west gate.** Newwark is a Beautiful Cities town; its west column is the gate-and-tavern composite
  `WALLAA11.TVRNAS01.RMB`. IT1 (`src/world/immersiveTravelGates.js` layGateRecords) appends Immersive Travel's carriage
  team - a carriage, two carts, a horse, hay and crates, and its driver - at the gate block's own coordinates to every
  gate block and every composite built on one, and tests no ground. Read in one frame, the team stands 4.6-6.6 m from the
  composite's House2 (model 138) centre, against its east wall: a wooden bed in a plaster wall with a person beside it.
  `06-Systems/Immersive-Travel.md` already says "Clipping is likely and unproven", and AUDIT IT1 G4 measured BC's gate
  props, never the composites' houses. The fix is a clearance between the team and the composite's buildings, measured
  with the real model boxes (`tools/townSolidsSweep.mjs` with `ARENA2_PATH`, over the 52 gate composites) - Mac's eye
  first, because a gate that fails it loses its driver.
- **The King's Attire, Holwych.** Holwych is a Beautiful Villages village. No port system stands a tree inside a town
  (wilderness nature keeps off the location rect; VERGE1 is the wilderness's; Low Poly Trees stands a model on the
  record's own spot), so the tree is most likely BV's own flat - left, as BV's curations are - or, online, a player's
  home-yard tree on a neighbouring lot (`src/scenes/homeYards.js` yardWhyNot refuses another building's footprint and
  the road, but tests no door). If it stands offline it is the block's.
