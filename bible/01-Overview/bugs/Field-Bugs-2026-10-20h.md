# FIELD BUGS 2026-10-20h - the Discord's bug-reports, read to their roots

Nine threads from the Discord's #bug-reports (2026-10-20), handed over as screenshots with no word beside them: nine
reports, from Flylighter, PanickedTofu, SaberGGaming, MD-Geist, Afelipe, ATLAS, fogs (with sovot), CosmicBooty and
Kikkirik - and a tenth in the chat behind Kikkirik's crash, from Ballvald Steel-Hewer. Each was traced end to end on
the real producers, with the freeware's data (`tools/fetch-data.sh`) where the map, the blocks or the bodies decide, and
Daggerfall Unity's own C# beside it. Read on main's `ccfb3c135`, and built on `a6cd40934` (#1091's merge). The calls the
reports left open are taken here under the owner's standing word on these threads (Mac, 2026-10-19: "Stop with the
decisions for me") - except where the owner's own number decides, which is left to the owner with its measurements; each
section says which it took and why. The pins are `fb1020h_*`, the mutants `tools/mutants/fb1020h_*.json`.
Named 20h: begun as 20f, it was renumbered at its merge of main, which by then held 20 through 20g (20f, the Elite
Breach's stones, #1093; 20g, SWAP-CYCLE, #1094).
The first session traced reports 9 and 10 and handed the other eight on as a line each; the screenshots did not come
with them, so which of the eight players wrote which is not in this record, and each section below works from that line
and the code. Reports 1-7 were traced in parallel lanes on 2026-10-21, each on main's `4bba28c6c` and merged here.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "the new creatures' hides (bats, wolves and the rest)" | Daggerfall Enemy Expansion's animals carry ids of their own, and the knife asked a hide of the classic MobileTypes alone: a DEX bat, wolf, boar or mudcrab was never a body to skin (no stamp, no node, no Tracker mark), and the account service would have refused it (`prof-foe`) | DEX-HIDES |
| 2 | "the Orrery quest's blank building name" | The Hour That Was Not's steps draw a remote temple wherever the line's runner finds the player, and the town host's name bag gave nothing outside a town: a temple or guild hall drawn on the road was named '' for good ("Meet Prior Anselm Vey at  in Wildertown"), in the sheet, letter, journal, talk and map; nine more questline steps and the main story's S0000008 and S0000503 too | SITE-NAMED |
| 3 | "the PvP remains and gold pile" | A take of part of a gold pile (all a pack has room for) came off the taker's pile twice, and a room word between the take and the frame let him keep coin the room still held; a gold share over the wire's 65,535 never showed for anyone and was lost | REMAINS-TAKE; REMAINS-GOLD |
| 4 | "the Temple of Mara's giant statue and invisible walls" | Not reproduced: the classic statue (TEXTURE.097 record 7) draws at DFU's 1.375 x 2.275 m; the packs' statue (1230.11) is not carried and draws nothing, as in DFU, on an empty pedestal in all 448 temples; every solid body stands inside a drawn flat | not reproducible |
| 5 | "the Arcana Essence marked 'bought with gold'" (the item is Arcane Essence) | A piece crafted or tempered with goods put in from the pack is walled to gold for the market by `products.bought_with = 'gold'`, and the disenchant read that column as a gold purchase: its Essence went into the Stores as gold's - "bought with gold", "It can go to your pack" - and the Reforge with Essence refused it | ESSENCE-LOOSE |
| 6 | "TAB focusing the Socials button" | The hosts prevented Tab only when the QuickDial answered it; on the classic skin, before the boot finished, or with the dial rebound, the browser walked the page's focus onto the only control over the world, the chat's Social button, and the next Space (Jump) pressed it; a mouse press left it focused the same way | TAB-WALK; HUD-FOCUS |
| 7 | "the Soul Trap (Ogre) trade freeze" | Not a hang: the realm's trade hold. An Ogre is Daggerfall Enemy Expansion's 282, and item law 8 took only DFU's souls, so the judge found the trapper's gem "a Soul Trap the game could not have made" and froze its trading, with a strike (three gems sold made a week's hold). On the way: an offer the law refused stood on the giver's side of the trade's table but never rode the wire, and a trade could finish without it | SOUL-LAW (law 9, acct166, migration 0143); TRADE-WHOLE |
| 8 | "the revenants' defects" | Not traced: the report is not in hand, and the owner chose to leave it open (2026-10-21) | open |
| 9 | Kikkirik: "crash on talking with the fast traveler" (the CRASH panel: `TypeError: Cannot read properties of undefined (reading '0')` at `Qv` <- `bye` <- `i` <- `oy` <- `iy` <- `Object.Wh [as exteriorActivationHit]`) | A Hearth Offering's ray target carried the culling box's 6-array where the street's ray reads `{ min, max }`: every press in a town where one stood threw out of `rayAabb` | fixed on main by #1091 (FIELD BUGS 2026-10-20e OFFERING-RAY); nothing here |
| 10 | Ballvald Steel-Hewer, in the chat of another player's crash screenshot: "there are many instances where insert here names are not appearing. meaning when i ask about the work they say go to talk to 'insert name here' :D" | The Work answer names whoever the questor pool's selection points at. Two things left that selection on someone the pool no longer held: the offer window spends the questor it was opened for, and a load brings in a pool without the selection. The answer then read "Go to a place called  and talk to someone named ." Found on the way: every woman with work was "him" | QUESTOR-HELD; QUESTOR-SHE |

## QUESTOR-HELD: the Work answer names a questor the pool holds (10)

`src/systems/npcSession.js` (`_holdSelection`, run at the end of `removeNpcQuestor` and `restoreSaveData`).

FOUND. The Work answers, TEXT.RSC 8076 (6 variants) and 8077 (8), each name the potential questor through `%pqn` and
their building through `%pqp`. Both read the pool's selection, and `npcSession.js:"    if (!entry) return '';"` answers
the empty string for a selection the pool does not hold. The answer is expanded first and the next questor is picked
after it (`answerPipeline.js:"        this.deps.setRandomQuestor?.();"`), which is DFU's own order
(TalkManager.cs:2033-2036). So an answer names the selection that stood BEFORE the ask. The build keeps that selection
in the pool: it selects the last questor it adds (`npcSession.js:"        this.selectedNpcWorkKey = npc.nameSeed;"`,
TalkManager.cs:2869). The other two writers did not:
- THE OFFER. A click on a pool member opens the quest offer, and the offer window's constructor takes them out of the
  pool, whether the job is accepted, declined or never drawn:
  `offerFlow.js:"    if (!this.deps.isPlayerInsideCastle?.()) this.deps.removeNpcQuestor?.(npcData.nameSeed);"`,
  DaggerfallQuestOfferWindow.cs:33-35. Nothing moved the selection off the spent questor. The selection is a uniform pick
  made after the previous answer, so a player who goes to the person that answer named, and takes or declines their
  job, makes the next answer blank with a chance of 1 in N, N being the pool's size. Pools are small where most players
  ask. Over every location in Daggerfall's data, in its own layouts and in the town packs', the median village has 12
  candidates, a roadside tavern 10 (5 in Beautiful Villages' rebuild) and a manor 7 (11). The 25% roll leaves pools of
  about 3, 2.5 (1.25) and 1.75 (2.75). Driven over a sample of real locations, a player who follows each answer until the
  pool is spent read a blank in 7% (cities) to 20% (taverns) of all Work answers. At least one blank came in 56-89% of
  visits to a tavern, village, hamlet or city: "many instances". The blank happens once per stale selection, because the pick after it lands on a live questor.
- THE LOAD. `save.js:"    talk.session.restoreSaveData(extras.talk);"` brings the save's pool in, but neither the
  selection nor the pool's location is saved (DFU's SaveDataConversation carries neither). The arrival does not rebuild
  the pool in the same town (`world.js:"    if (key === _topicsKey) {"`, then the location gate,
  `npcSession.js:"    if (this.exteriorUsedForQuestors === locationIndex) return false;"`). The 25% draw is another
  session's, so this session's selection is rarely in the restored pool. 72% of first answers after loading an earlier
  session's save in the same town were blank, and 100% after a boot load in a location at index 0. The dungeon
  quickload takes the same restore with no arrival at all
  (`dungeonContext.js:"      if (session && restoreSessionState(extras, { questBridge: opts.questBridge, talk: opts.talkSave"`).
  Online refuses an in-session load, so an online player like Ballvald met the offer's blank.

Everything else that could print a blank was measured and does not occur, over all 12,068 locations with people in both
layouts. No questor's building name is empty: only named buildings enter the pool, and a guild hall takes its guild's
name. No questor's name is empty: the name bank is always a race bank, because the region index is clamped to 0..61. A
town with no questor answers "There's no work available at all." The first answer after a build names the last questor
added (200 of 200). The people named are real: in four cities, all 381 questors are a person the interior stands, with
the same identity and name, and each opens the offer when clicked.

DFU cannot print the blank, because it throws there. GetQuestorName, GetQuestorGender and GetQuestorLocation index the
pool with no guard (TalkManager.cs:2586-2600). The first macro's GetMacroDataSource reads GetQuestorGender
(TalkManagerMCP.cs:32-34), and MacroHelper.GetValue catches only NotImplementedException (MacroHelper.cs:503-528). So the
next Work answer throws KeyNotFoundException before SetRandomQuestor (TalkManager.cs:2036) can move the selection, and
the topic stays dead in that town until the pool is rebuilt. DFU's RemoveNpcQuestor (TalkManager.cs:2602-2605) and
RestoreConversationData (TalkManager.cs:2541-2542) both leave the selection where it stood.

FIXED. Both writers end in `npcSession.js:"  _holdSelection() {"`. While the pool holds questors and none of them is the
selection, it selects the last one it holds, the build's own rule. A selection the pool still holds is left alone, and
an empty pool still answers the no-work record. Nothing is drawn: neither DFRandom nor the talk's rolls. DFU's order
stays: the answer names the selection that stood before the ask, and the pick follows it. A departure from DFU's
KeyNotFoundException (a dead Work topic), with its Port-Ledger A row (THE WORK ANSWER NAMES A QUESTOR THE POOL HOLDS)
and its line in `06-Systems/Talk-Arc.md` (QUESTOR-HELD). The one new Ledger row moved every Ledger line below it:
`tools/citeShift.mjs --apply` moved the 19 line cites it maps. Port-Status' section-2 identifiers and its section A tally
(326 rows, 311 standing) were moved by hand, each checked against the base row it named, as were the struck
`.SAV`-reader cite and the struck keybinding-registry one. Two of its identifiers were already one row off before this
change (`:975`, A MOD'S MATERIALS, and `:976`, AN ENEMY'S GLOW), and are aimed at their rows now.

QUESTOR-SHE (found on the way). The four pronouns of the Work answer are the questor's
(`talkMacros.js:"  const female = () => ctx.questorGender?.() === GENDERS.Female;"`). That helper compared the string
`'female'`, but the pool's NPCData carries the Genders enum
(`staticNpc.js:"    gender: ((pn.flags ?? 0) & 32) === 32 ? GENDERS.Female : GENDERS.Male,"`), and the world host hands
it on unchanged (`world.js:"      return npcSession.getQuestorGender();"`). So every woman with work, 44.8% of questors,
was "he/him/his" in four of 8076's six variants and three of 8077's eight. The pins had handed the helper the string,
which no producer mints. DFU switches on the enum (TalkManagerMCP.cs:146-195), so this restores DFU and departs from
nothing.

THE FOUR HOSTS: none changed. `world.js` mounts the pool and the talk MCP, `worldModes.js` opens the offer that spends a
questor, and `dungeonContext.js`'s quickload restores the pool, each through the module. `exterior.js` runs no NPC session
(`exterior.js:"  //     %f-faction NAME getters, removeNpcQuestor). This route runs no"`).

PINS. `test/systems/talk/fb1020h_questor.test.js` (7). The fixtures come from their producers: the town's people from
questorCandidateBuildings over an RMB block, the pool from NPCSession, the offer from QuestOfferFlow.offerSocialQuest,
the save from composeSessionState and restoreSessionState, and the answer from AnswerPipeline over the talk macros:
- the build selects the last questor added, and the first answer names them;
- the offer spends the questor the selection names, and the next answer names the last one standing;
- an offer from another questor leaves the selection where it stood;
- the pool spent to its last questor answers the no-work record;
- a load whose pool lacks the standing selection selects the last questor it carries;
- a woman with work is "her", with the world host's seam handing the pool's own value on;
- with ARENA2, every variant of the real 8076 and 8077 names the held questor and their building after the offer.

Before the fix, four of them fail, the last with the field's own sentence
(`8076[0] names nobody the pool holds: " might have work. You can find him in ."`). The three DFU laws pass either way.
Mutants `tools/mutants/fb1020h_questor.json` (9, all dead): either writer unhooked, the empty-pool guard flipped, a held
selection moved, the first questor instead of the last, the selection never written, the female arm made Male, the
female arm inverted, and the string back.

PIN MOVED: `test/systems/talkmacros.test.js`'s pronoun pin and its `%pqn` pin hand the questor's gender and bank as the
pool mints them (`GENDERS`, `BANK_TYPES`), not as the strings `'female'`/`'Breton'`. `test/systems/audit26_talk.test.js`'s
F097 source pin reads the enum comparison. No existing mutant record named the lines this changes.

NOT CHANGED (recorded as found, the coordinator's call for this batch):
- THE POOL CAN OUTLIVE ITS TOWN. A restore carries no location, and the gate compares the per-region location index
  alone (DFU's too). A save made outside any town that carries town A's pool, loaded and then followed into a town
  whose index equals the session's stamp, keeps A's pool, and its answers name A's people and buildings. Two of the
  3,231 neighbouring cross-region pairs of locations share an index.
- THE WILDERNESS POOL. DFU's OnMapPixelChanged reaches GetBuildingList on a wilderness pixel, where CurrentLocationIndex
  is -1 (PlayerGPS.cs:191-194), and clears the pool. The port keeps it: `townTalk.js:"    if (!topics || !factions) return;"`
  never reaches the pool with no location. DFU, back in that town, then has no work at all, so the port's keeping is
  arguably the better law, but it is an unrecorded departure.
- THE INDEX-0 LOCATIONS. A fresh session's location stamp is 0 (DFU's Awake, TalkManager.cs:514), so the first visit to
  a location at index 0 (14 hold questors, among them Arkmore, Crosswich, Warborne and Lamwych Hall) builds no pool and
  answers "no work". After a boot load there, the stale selection is now held, so no blank.
- THE BUILD'S DFRANDOM DRAW. DFU's GetBuildingList logs every questor it adds through GetQuestorName (TalkManager.cs:2870),
  which srands DFRandom by that questor's seed and draws their name. The port's build draws nothing. Whether any
  unseeded DFRandom reader follows a pool build was not checked.

Not seen in play here. The pins and the measurements drive the real modules headless, the real records and towns
from the player's data, and the real save envelope.

## OFFERING-RAY, again: the fast traveler's crash is 2026-10-20e's (9)

No file changed for this report.

FOUND. The panel's build is Update 0.0.296 (`a0ba01168`, the release `app-v0.1.10373`). Rebuilt from `git archive` with
the release's own build stamp, its chunks are `worldTick-CEm_09Ca.js` - the panel's, exactly - with `arenaGate-GhJErWMY`
and `world-6d1hmgxx` beside it, which the blurred names on the panel match; the world chunk carries the build tag, so
the hash names that one build. The rebuilt sourcemaps map every frame of the panel, column for column:
`activate.js:"let t0 = (aabb.min[a] - origin[a]) * inv;"` in `rayAabb` <- `nearestActivatableHit` <- `nearest` <-
`firmFirst` <- `pickActivatableHit` <- `worldModes.js` `exteriorActivationHit` <- the press's `raceActivation` in
`world.js`'s `frameMotor`. The rebuilt chunk's own `pickActivatableHit`, handed a person and one target as WITCH1 minted
it, throws the panel's five frames at the panel's columns.

So it is OFFERING-RAY (`Field-Bugs-2026-10-20e.md`), found the same evening from Temegast's and Boar's panels: a Hearth
Offering's target (`witchesHost.js` `targets`) handed the ray the batch's culling box, and the pick tests every
entrant's box before it races them, so the throw did not depend on what the press was aimed at. "The fast traveler"
is Immersive Travel's carriage driver at the city gate (faction 8642, its "Fast Travel" service): a static NPC in the
same door set, whose press threw in the race before `activateStaticNpc` was reached. Any press in that town would have.

FIXED by #1091 (merged as `a6cd40934`, before this record was written), the same fix this trace had drafted: the
offering mints the ray's `{ min, max }`, and `player/activate.js`'s `RayBox`/`RayTarget` types make the 6-array a type
error at the producer. Checked on that merge: the trace's own end-to-end run (the real `createWitchesHost` standing two
offerings, the real `createWorldModes` with them wired as `world.js` wires them, the carriage driver among its
people, and `world.js`'s own press race cut out and run) threw the panel's TypeError on `a0ba01168` and on
`ccfb3c135`; on `a6cd40934` the offerings carry `{ min, max }`, the press at the driver picks `person:0` at 3.12 m, and
the hover pick throws nothing.

## DEX-HIDES: the Enemy Expansion's animals are skinned (1)

`src/net/professionLaw.js` (HIDES: the mod's ids, three new hides; CURE_RECIPES by tier), `src/net/recipeLaw.js`
(PELTS), `src/ui/professions/profPages.js` (the Hunting and Outfitting unlock lines, drafted in the fifteen machine-made
languages).

FOUND. A body is skinned by its foe's id and nothing else: `professionLaw.js:"export const hideOfFoe = (mobileType) =>"`
finds the hide whose `foes` hold the id, and the ten hides held PROF0 4.4's classic foes by DFU's MobileTypes
(DaggerfallUnityEnums.cs:142-211, "Monster IDs are 0-42"). Daggerfall Enemy Expansion (#1067) adds fifty rows past the
classic table (BestiaryMod.cs:665 and 1343; `enemyBasics.js:"export function registerEnemyRows(rows) {"`): its monsters
are 256-290 and its classes 384-398 (the 128 bit, DaggerfallEntity.cs:976-979), and each of its foes carries the mod's
own id - a DEX Wolf stood by the street's real pool (`exteriorFoes.js` spawnFoe) has `mobileType` 262. Every step a hide
takes refused it:
- THE KILL. `huntHost.js:"const hide = hideOfFoe(entity.mobileType);"` answered null, so the world host's kill listener
  (`world.js:"registerPlayerKillListener('hunting', (entity) => { bodyStamps.stamp(entity); });"`) stamped no body, and a
  body with no stamp is never a node (`huntHost.js:"if (!s) continue;"`): no "Skin the Wolf", E opened the loot and the
  knife's Use did nothing - in the street's pool, a building's and a dungeon's alike.
- THE TRACKER. `huntHost.js:"!hideOfFoe(f.entity?.mobileType ?? f.mobileType)) continue;"` marked none of them.
- THE SERVICE. `professions.js:"if (isBody && !hide) return { error: 'prof-foe' };"` refuses a harvest that names one
  ("That body cannot be skinned."). The client never got that far, but a fix on the client alone would have met it: both
  ends read the one law (the account Worker bundles `src/net/professionLaw.js` and `src/net/recipeLaw.js`, and
  `account-deploy.yml` lists both, so this merge deploys the service).

Measured over the mod's own tables as the port reads them (`dexInstall.js` dexRead): nine of the fifty rows are of Animal
affinity - the Bat (260), Wolf (262), Snow Wolf (263), Dog (267), Blood Spider (271), Boar (278), Land Dreugh (279),
Mountain Lion (280) and Mudcrab (281). The classic ten skin exactly DFU's six rows of `MobileAffinity.Animal`
(EnemyBasics.cs: the Rat, the Giant Bat, the Grizzly Bear, the Sabretooth Tiger, the Spider and the Giant Scorpion), plus
the Slaughterfish, the Harpy, the Dreugh and the Dragonling. With Meaner Monsters and the mod both on (the default) the
game reads MUDEX's tables after the mod's, and there the nine are 144 of 639 animal entries (22.5%) in 39 of 90 tables:
the mod's Bat has 70 entries against the classic Giant Bat's 111 (39% of the bats), and the canines 44 (Wolf 19, Snow Wolf
3, Dog 22), where Daggerfall has none of its own. These count table entries, not weighted by how often a table is picked.

FIXED. Every DEX row of Animal affinity gives the hide of its family, and no other row gives one:

| id | creature | hide | why |
|---|---|---|---|
| 260 | Bat | Bat Leather (656) | its career is the Giant Bat's |
| 262, 263 | Wolf, Snow Wolf | **Wolf Pelt (681)** | no canine among the ten |
| 267 | Dog | **Wolf Pelt (681)** | the mod draws it as one of the wolves: their frames, move and attack sounds (142, 144), team |
| 271 | Blood Spider | Spider Silk (659) | a spider (and its venom) |
| 278 | Boar | **Boar Hide (682)** | no swine among the ten |
| 279 | Land Dreugh | Dreugh Shell (663) | a dreugh (tier 5: one of the day's rare hides) |
| 280 | Mountain Lion | Tiger Pelt (658) | a big cat (the mod's own team for it is the Tigers) |
| 281 | Mudcrab | **Mudcrab Chitin (683)** | no crab among the ten |
| 264 | Hell Hound | none | a daedra, as no classic daedra gives a hide |
| the rest | people, undead, daedra, golems, spirits; the fifteen classes 384-398 | none | not animals |

Calls taken under the owner's standing word. Three new hides, not the nearest of the ten: each of the ten is one
creature's own, and the harvest's line names it (`gatherHost.js` storesLine: "+1 Bear Hide, a Big Tooth and 2 Raw Meat to
your Stores"), so a wolf mapped to the nearest fur would say it skinned a bear. The Wolf Pelt and the Boar Hide are tier
2, as the furs of the Bear and the Bat; the Mudcrab Chitin tier 1, as the Rat Pelt (the mudcrab is level 2). The two furs
carry the Big Tooth one body in four, as the Bear's and the Tiger's do, and cut Large and Small Skins (PELTS); the chitin
carries no part and cuts none. All three give Raw Meat (C&C gives every body of Animal affinity its meat,
`survival/loot.js:"export const isAnimal = (entity) =>"`) and cure to Cured Leather (4.4, tiers 1-3). Templates 681-683
were free in the registry and in 4.8's table and sit after Arcane Essence (680); they take the pictures the ten borrow
(a pelt is Nymph Hair's lock, a chitin Fairy Dragon's Scales'). The cures now stand by tier
(`professionLaw.js:"HIDES.filter((h) => h.cures).sort((a, b) => a.tier - b.tier"`), since a chain plans a leather's cures
cheapest first (`chainLaw.js:"export const producersOf = "`, CRAFT1's order); the ten keep their order - but the Bear
Hide's last of its tier since AUDIT FB1021 L2-1 (`01-Overview/audits/Audit-Field-Bugs-2026-10-21.md`: it is the Ram Kit's
too, and a chain spent every one before a Wolf Pelt). The profession page
names the new hides at Hunting 0 and 10 and the two furs' skins at Outfitting 10. No departure from DFU: DFU has no
skinning (the professions are PROF0's), and the mod's ids are its own data, read off the vendored table and pinned
against it.

THE FOUR HOSTS: no seam touched. `world.js` stamps the kill and stands the bodies for all of its modes (bodiesHere: the
street's pool, a building's and the dungeon's, which `worldModes.js` and `dungeonContext.js` own); `exterior.js` runs no
professions (section 29's law). Every host reads the law through `huntHost.js`, unchanged.

PINS. `test/net/fb1020h_dexhides.test.js` (5): every one of the mod's fifty and its hide, an exact table read from the
mod's own rows; the DEX rows that give a hide are exactly those of Animal affinity; the three new hides' rows, templates
(price, weight, stackable, rarity), pack form and picture (mintMaterialItem, inventoryItemImage), market, cures, the cured
leather's chain order and the skins; a DEX Wolf, Bat and Mudcrab stood by the real street pool and felled by its damage
door are stamped by the world host's listener and listed by bodiesHere, the knife's plan reading "Skin the Wolf" at
Hunting 10 and the Mudcrab open to a Novice, and the Tracker marks a living Boar; and through the real account Worker
over node:sqlite a Wolf gives a Wolf Pelt with its Big Tooth and Raw Meat at tier 2's XP, a Bat Bat Leather, a Land
Dreugh a Dreugh Shell counted among the day's rare hides, and a Hell Hound is refused `prof-foe`. All five fail with the
two law files at HEAD. Mutants `tools/mutants/fb1020h_dexhides.json` (19, all dead).

PIN MOVED, each by content: `prof7_law` (the hides' rows, templates, cures by tier, PELTS, Outfitting's skins 8 to 12),
`prof7_client` (the hide rows' templates), `craft1_chain` (the chain's works; the cured leather's producers cheapest
first), `craft2_patterns` (MEASURED: the recipes that pay a first 663 to 667, the firsts paid 561 to 565; the 446
patterns at a tier unchanged), `prof4_law` (the loom's works 9 to 12), `audit32_pages` (the Outfitting rank-10 line),
`l10n4_hardcoded` (professionLaw.js 109 to 112, the three names); `tools/mutants/prof7.json` PROF7-spider-cured re-aimed
(the Spider's row now carries the Blood Spider), dead.

NOT CHANGED:
- THE LAND DREUGH'S BUTCHERY follows its hide's row: the Dreugh Shell gives none, as C&C gives the classic Dreugh's body
  none. C&C's own corpse loot still gives the Land Dreugh's corpse its Raw Meat (its affinity is Animal), so no food is
  lost; only the Stores' extra follows the hide.
- THE SNOW WOLF shares the Wolf's pelt at level 10 against the Wolf's 5.
- WHERE A MUDCRAB IS MET. MUDEX's tables name no Mudcrab and its water table replaces the mod's, so with Meaner Monsters
  on (the default) a Mudcrab comes only as a quest's foe; with it off, from the mod's water table (4 of 20) and the
  Natural Cave's (1). Its hide is skinned either way.
- The revenants' errands (`revenantErrands.js`) still want only the classic hides.

## SITE-NAMED: the Orrery's temple has its name, wherever the line finds the player (2)

`src/scenes/townTalk.js` (`nameOpts`), `src/systems/quest/place.js` (`nameSiteAgain`), `src/systems/quest/machine.js`
(`_reseatMovedOf`).

FOUND. The quest is The Hour That Was Not (`qlLines.js` `hourThatWasNot`: level 12, online, a registered account).
Both of its steps, Brass at Dusk (QLHR01) and The Orrery of Endings (QLHR02), draw `Place _temple_ remote temple`.
Every line that names the place says `_temple_ in __temple_` or `at _temple_`: the sheet's objectives, the letter
(1011), the journal (1010, 1020, 1021), the failure (1003) and the Prior's anyInfo (1014, 1016: "Prior Anselm Vey is at
_temple_."). `_symbol_` is the site's `buildingName` (`place.js:"      case 1: return sd.buildingName;           // NameMacro1"`,
Place.cs:279-281), so the macro read the right field. The field itself was ''.

The line's runner starts a step on the tick it falls due, wherever the player stands. The first step starts when the
line opens. Each later step starts an hour of the character's time after the one before ended (`STEP_GAP_S`), so The
Orrery of Endings starts an hour after the Prior is met in his temple, and its letter says "Come when you have rested".
The Place is resolved at the parse (`scheduleQuest`), and that is when the temple gets its name:
`_collectQuestSitesOfBuildingType` -> `_getBuildingName` -> `generateBuildingName`, through the quest world's name bag
(`place.js:"      ...(world.buildingNameOpts?.() ?? {}), locationName: location.name, regionName: location.regionName,"`).
A temple is named for its god's first child and a guild hall for its own faction
(`buildingNames.js:"      a = shownTempleName?.(factionId) ?? templeName?.(factionId) ?? '';   // L10N3e: FormulaHelper.cs:3036, as shown"`),
and only the bag holds those resolvers. The world host's bag comes from the town host
(`world.js:"    buildingNameOpts: () => townTalk.nameOpts?.() ?? {},"`), and that bag answered null whenever no town's
topics stood. The world host clears the topics on every map pixel without a location
(`world.js:"    if (!cur || !dfLocation || !cur.locBlocks) { _talkPlayerPos = () => null; townTalk.setTopics(null); return; }"`).
So on the road, in the wilds or at sea, a temple or guild hall drawn then got `a = ''`, which a singleton name returns
as it stands. It was saved that way and kept until the quest ended (QLHR01's wait is 30 days, QLHR02's 60).

Reproduced with the real script, the real Place resolution and the real town host (`createTownTalk` over the player's
FACTION.TXT), with MAPS.BSA and BLOCKS.BSA. The player stood on the road in the Daggerfall region, with seeded rolls.
QLHR02 drew the temple of Infinite Idol of Kynareth. Its letter read "I have gone on to  in Infinite Idol of Kynareth,"
and its sheet read "Meet Prior Anselm Vey at in Infinite Idol of Kynareth" (the window folds the double space). The
talk's Tell Me About list carried a row with no caption (`topicTree.js:"            // a NULL test: an empty buildingName is still the caption"`).
A temple first found by the player while its quest held the blank got '' as its map name, because the quest's override
name is ''.

The families named for this lane, each checked:
- A PLACE RESOLVED BEFORE ITS TOWN'S BUILDINGS ARE KNOWN: this is the cause, but only on the naming side. The walk that
  picks the building (`_townBuildingsOfType`) reads MAPS.BSA and the blocks through the world and needs no topics. Only
  the name's faction resolvers rode on the current town.
- A BUILDING THE TOWN PACKS REMOVED OR RENAMED, OR A LOCATION WITH NONE OF THAT TYPE: neither applies. Over all 15,251
  locations, the quest walk offers 2,970 temples and 1,478 guild halls in Daggerfall's own layouts, and 2,941 and 1,543
  under both town packs. The bag names every one, and none is empty. Temples: Kynareth 641, Mara 445, Arkay 396,
  Julianos 357, Z'en 327, Stendarr 320, the Order of the Hour 235, Dibella 196, and 53 more of two other factions.
  Before the fix, every one of those, drawn on the road, was ''. A location with no temple is never drawn, because the
  darts land somewhere else.
- A GUILD HALL'S NAME: the same law gave the same blank. Nine more steps of the lines draw `remote magery`: the Burning
  Doors' QLBD01-05, the Covens' QLCH01-03 and the Frostfall's QLTF04.
- A MACRO GIVEN THE WRONG FIELD: no (above).
- A STALE SELECTION (QUESTOR-HELD's family): no. The Place is resolved once and kept. What was missing was the resolver
  at that moment.

The main story's S0000008 (started by S0000015's `start quest 8 8`) and S0000503 (started by S0000502) also draw a
remote temple and a Mages Guild hall wherever their parent fires. With the fix, S0000008 drawn on the road names "The
School of Julianos". DFU's own guild and temple quests are offered by a questor inside a town, where the bag stood, so
they never had the blank. DFU never shows it: GenerateBuildingName reads both names from PlayerEntity.FactionData
wherever the player stands (FormulaHelper.cs:3139-3162).

Two more found on the way, fixed by the same change. A remote palace drawn on the road was named "Palace" rather than
"Castle Daggerfall", "Castle Wayrest" or "Castle Sentinel" (the bag's `palaceName`, TEXT.RSC 475-477,
FormulaHelper.cs:3164-3193). Eleven DFU quests draw `remote palace`, among them the main story's courier, S0000012.
And a shop whose name holds %ef or %rt was named with name bank 0 and ruler 0, where DFU uses the player's region
(FormulaHelper.cs:3225, MacroHelper.cs:644-650).

FIXED. Once FACTION.TXT has been read, the bag answers in a town or out of one
(`townTalk.js:"    if (!factions) return null;"`). It always carries its faction resolvers, its palace names, and its
bank and regent by the player's region. The town pair is there only while a town stands; otherwise it is undefined, and
every caller passes its own (place.js the site's town, person.js the questor's). The directory still builds nothing
outside a town (`rebuildDirectory`'s own gate). This restores DFU and departs from nothing.

A save that already holds the blank has it named at the load. The load's re-seat (`world.js` applyLayoutPins ->
`reseatMovedSites` -> `machine.js:"    for (const resource of quest.resources.values()) if (resource.isPlace) resource.nameSiteAgain?.(world);   // FB1020h SITE-NAMED: a site the bag named '' off a town - not counted: no site moved"`)
names it from its building through the same bag (`place.js:"  nameSiteAgain(world) {"`). That applies only to a
Building site named exactly '' whose record stands in its town's layout. A residence is never renamed (its surname is a
roll), and a kind DFU names '' itself stays ''. GetName seeds DFRandom, so the state is put back afterwards. If the
load runs before FACTION.TXT is read, nothing changes and the next load tries again. The map record that took the
blank is re-stamped from the live quest's name the next time the building is discovered or the town map opens
(`discovery.js` restampQuestName, DISC28-K). This is the port's repair of its own saves; DFU has no such blank to mend.

THE FOUR HOSTS: none changed. `world.js` wires the bag into the quest world (`buildingNameOpts`) and %cbd
(`currentBuildingName`). Both now get the faction half off a town, and its applyLayoutPins runs the re-seat that
carries the mend. `dungeonContext.js` has no quest world of its own (`opts.questBridge` is world.js's), and its
quickload restores the save's towns through world.js's applyLayoutPins
(`dungeonContext.js:"      if (session) opts.layoutPinsLoaded?.(extras);   // WD3: the save's towns in their layouts (world.js applyLayoutPins) - a world load does its own"`),
so the mend runs there too. `worldModes.js` reads no name bag; the interiors use world.js's quest world. `exterior.js`
wires the same bag line (`exterior.js:"    buildingNameOpts: () => townTalk.nameOpts?.() ?? {},"`). Its fixed city
always has a town's topics, so nothing changes there. FLAGGED: it runs no load re-seat, so a dev-host save that holds
the blank stays blank there.

PINS. `test/systems/quest/fb1020h_sitenamed.test.js` (4). Fixtures come from their producers: the bag from
`createTownTalk` reading FACTION.TXT through the game's own reader (`FactionFile`); the sites from the real
`Place` resolution of the real QLHR01/QLHR02 scripts through `packMachine`; the town from an RMB block and its MAPS
directory entry (`fb1004dTowns.mjs`); the save from `getSaveData`/`restoreSaveData`.
- Off a town, the bag names a temple for its god's first child and a guild hall for its faction, uses the player's
  region for its name bank, and has no town pair. In a town it carries the town pair, as before.
- Both steps started on the road name Gothham's temple "The Akatosh Chantry" in the letter, the sheet and the journal.
- A save holding '' is named at the load's re-seat, DFRandom is put back, and the Prior's home is kept. An unseated
  site, a record from another layout, a house, and a bag with no faction to name it by are all left as they are.
- With ARENA2: QLHR02 on the road in the Daggerfall region reads "I have gone on to The Temple of Kynareth in Infinite
  Idol of Kynareth,". S0000008, QLHR01, QLBD01, QLCH01 and QLTF04 each name their site. Every one of the region's
  temples and guild halls that the walk offers is named off a town. Castle Daggerfall is named from the road.

All four fail before the fix, the second with the field's own sentence (`'I am a guest of  in Gothham.'`) and the last
with `'I have gone on to  in Infinite Idol of Kynareth,'`. Mutants `tools/mutants/fb1020h_sitenamed.json` (9, all
dead): the topics gate restored; the town pair or the region read from a missing town; the re-seat unhooked; a named
site named again; the layout gate dropped; a residence named again; the seed left moved; an empty name taken.

PIN MOVED: none. No existing pin or mutant record quotes the lines this changes (`interiorseams.test.js` quotes the
bag's wiring and `rebuildDirectory`, both unchanged).

NOT CHANGED (recorded as found, the coordinator's call for this batch):
- THE BOOT'S FIRST TICKS. FACTION.TXT is fetched at the world host's boot (`world.js` `townTalk.ensureLoaded()`), but
  nothing makes the quest bridge wait for it. A step the runner starts in the first ticks of a session, before the file
  lands, still draws its temple as ''. The next load names it. Not measured in a browser.
- THE PRIOR'S TEMPLE IS ANY GOD'S. `remote temple` (p3 0) takes any temple, so Akatosh's Order of the Hour waits at the
  Temple of Kynareth as often as at its own. The lines already carry a god's own row (`qlActions.js` QL_PLACE_ROWS'
  `templeArkay`). That is a choice of the script's words, left to the owner: a `templeHour` row (`0, 14, 92`) would hold the Prior to the
  Order's own temples, which are 235 of the map's 2,970 and 11 of the Daggerfall region's 334; 13 of the 43 regions that
  have temples have none of the Order's, where a step would fail to start and be offered again a day later.
- THE QUESTOR'S HALL, SHOWN NAMES. `person.js` reseatMovedQuestor hands the bag its own canonical pair but not the
  shown pair, so in a town the shown names are the current town's. Only a shop's %cn in another language can differ.
  This is older than this change, and not this report.

## REMAINS-TAKE and REMAINS-GOLD: the gold pile in a fallen player's remains shows what it holds (3)

`src/net/wild/wildRemains.js` (`mintOne`, `settle`, `follow`, the `rm` word); `bible/11-Multiplayer/Wild-Zone.md` section 5
gains one line.

FOUND. A death in the open zone drops one gold record into the fallen's remains: half the purse, plus the cart's coin and
the coin of a companion at their side (`wildDropLaw.js:"export function takeWildGold"`). It comes after the killer's worn
piece and before the bag's drop, which is sorted by worth. The account service takes the record off the fallen and signs
an order over it, and the relay says a remains only once its records digest to that order
(`wildLaw.js:"export function remainsWords"`). Every player's game then stands the remains as a ground pile through one
book (`wildRemains.js:"export function createWildRemains"`, wired at `world.js:"const wildRemains = createWildRemains({"`),
in the pool of the host the player stands in: the street's, a building's (`worldModes.js:"droppedPool() {"`) or a
dungeon's (`dungeonContext.js:"droppedPool: () => droppedLoot,"`). A take goes through the window every pile opens with,
and the book asks the room for what the window moved. Traced end to end on the real code: the account service's
`/v1/wild/fall`, the relay's Room driven in-process (`server/src/index.js:"async _wildWord(ws, a, d, now) {"`), the street's pool
(`droppedLoot.js:"function seedPile("`) and the window's take (`itemTransfer.js:"export function planTake(item, {"` and
`applyTransfer`, called as `enhancedInventory.js`'s `take()` calls them, through the encumbrance gate). Two faults:

- A TAKE OF PART OF THE PILE (REMAINS-TAKE). The window takes only what the pack has room for: CanCarryAmount caps it
  (DaggerfallInventoryWindow.cs:1414-1422; `itemTransfer.js:"const canCarry = entity"`) and the how-many popup splits the
  stack (DaggerfallInventoryWindow.cs:1510-1559); the rest stays on the pile. Gold weighs 400 coins a kilogram
  (`inventory.js:"export const GOLD_PIECE_WEIGHT_KG = 0.0025;"`), so a killer carrying his own gear often takes only part
  of a gold pile. The book skipped the room's `rm` while its own take was in flight, and subtracted any other `rm` from
  what the pile showed. The relay answers the taker with `got` first and then sends `rm` to everyone, the taker included
  (`server/src/index.js:"this._send(ws, JSON.stringify({ t: 'wild', k: 'got'"`); the `got` had already ended the take, so the taker's
  own `rm` came off his pile a second time. Measured with a killer of strength 50, a 4,000 purse and eight iron
  claymores (room for 2,000 coins): taking 2,000 of a 10,050 pile left his pile at 6,050 while the room and a stranger's
  pile held 8,050. Once he had room he took the 6,050 he saw; the gold left his pile with 2,000 still in the room, and
  the stranger's pile still showed it. It could also COPY gold: the book reconciles once a frame and room words arrive
  between frames, so a word heard between the window's take and the next frame overwrote that take's count - a
  stranger's 1,000 heard at that moment left the room 9,050, the taker 2,000 and the stranger 1,000: 12,050 coins from
  10,050. The remains said again under a take (a socket's hello) rebuilt the pile and lost the take the same way (the
  room 10,050, the taker 2,000).
- THE GOLD PAST 65,535 (REMAINS-GOLD). The book minted every record through `validLootList`, the projection for a
  stranger's word, whose stack bound is the wire's 65,535 (`systems/loot/loot.js:"export const LOOT_STACK_MAX = 65535;"`). The item law
  already allows a coin pile to one int (`itemLaw.js:"const stackMax = "`; its comment names "a death in the wild" as a
  pile past the wire's bound), as DFU keeps the count (DaggerfallUnityItem.cs:51; ItemBuilder.CreateGoldPieces,
  ItemBuilder.cs:790-797). So a gold share over 65,535 showed on nobody's pile - not the killer's, not a stranger's, not
  the fallen's own "Your remains" - and the gold the service took lay in the room for nobody until the remains expired; a
  grant of it would have minted nothing. Measured: a purse of 140,100 laid one 70,050-coin record, and the killer's pile
  showed the katana, broadsword, cloak and shoes but no coin; after he took everything the room still held the 70,050. A
  purse of 20,100 with a cart of 200,000 laid 110,050, the same. A pack tops out at 225 kg and DFU's trade window pays in
  letters past that (DaggerfallTradeWindow.cs:1038-1048), so a purse past 131,070 is rare - but a wagon carries 300,000
  to 800,000 coins (`wagonKinds.js:"export const SMALL_CART_KG = 750;"`, to the Caravan's 2,000 kg), and its coin drops
  whenever the wagon is with the fallen (CART-AWAY).

FIXED, both in the book, which every host reaches. REMAINS-TAKE: a pile shows what the room holds less my takes still
waiting on an answer. The book keeps the count of each take it has asked, in order (`asked`); each `got`, `no` or `cr`
ends the oldest. Every `rm` sets the pile to the room's count less those takes, in place
(`wildRemains.js:"const follow = "`), and before any room word moves a pile, and before a pile is rebuilt, the book first
asks the room for what the window took since the last frame (`wildRemains.js:"const settle = "`). The room grants at most
what is left (`wildLaw.js:"export function takeFrom(rec, i, n, sub = null) {"`), so a take larger than the pile is a `got`
of the rest, never a `no`. REMAINS-GOLD: a coin record is minted by its count, in the pile and in the room's grant
(`wildRemains.js:"const mintOne = "`, through `goldStack`, the service's own minter), any whole count to `GOLD_INT_MAX`;
every other record keeps the host's mint. The remains are the service's word, never a peer's, so the stranger's bound
(HACKED-GOLD) is not theirs; the 65,535 stands for every peer's word. Neither is a DFU member (WILD1's remains), so
nothing departs from DFU, and the coin's count now follows DFU's int.

THE FOUR HOSTS: none changed. `world.js` wires the one book; its pool is the street's (`world.js`), a building's
(`worldModes.js` `droppedPool`) or a dungeon's (`dungeonContext.js`), and all three take the fix through the book.
`exterior.js`, the fixed-city bench, is offline and stands no zone.

PINS. `test/net/fb1020h_remains.test.js` (4), each end to end: the fallen as the game dresses her, her record as the save
writes it, the fall as the relay signs it, the drop through the real account service, the remains in the real relay
room, each player's book over the street's real pool, and the window's take through the encumbrance gate:
- a 70,050 gold share shows for the killer, a stranger and the fallen ("Your remains"), and a killer with room for it
  (strength 100, a ring of Increased Weight Allowance) takes it whole - the room's grant puts all 70,050 in his purse;
- taking 2,000 of 10,050 leaves the taker's pile at the room's 8,050, and the rest, taken once he has room, is the 8,050,
  with no gold left anywhere;
- a stranger's take heard between the window's take and the next frame: the pile shows the room's count less the take in
  flight, and the coin adds up (room 7,050, taker 2,000, stranger 1,000);
- the remains said again during a take rebuild the pile without that take, and lose none of it.

All four fail before the fix (no coin on any of the three piles; 6,050 where 8,050 is right; 9,050 where 7,050; 10,050
where 8,050). Mutants `tools/mutants/fb1020h_remains.json` (10, all dead): the coin through the stranger's projection,
its bound the wire's, the grant through it, an answer never ending a take, a take not counted in flight, a word moving
the pile without the takes in flight, a word over a take not yet asked, the old skip of every word while a take is in
flight, a pile said again over a take not yet asked, and a pile rebuilt with the takes in flight.

PIN MOVED: `test/net/wild1_fight.test.js` ("the room's word stands a pile...") played another player's take of 4 after
mine of 2 had been refused - an order no room sends (a refusal means the record was already gone) - and pinned the old
arithmetic. It now plays the room's order: another's take of 1 while my 2 are in flight (6 - 1 - 2 = 3), then another's
5 (the pile goes), then my refusal. `tools/mutants/haloremains.json` HALOREM-take-to-primary re-aimed by content (the
take moved into `settle`): dead, as are int_lane2's four mutants on the book.

NOT CHANGED:
- THE PILE'S PLACE. It stands a fixed step from where the fallen fell, at their feet's height
  (`wildRemains.js:"const feet = [f0[0] + 1.8, f0[1], f0[2] + 1.2];"`). Over the zone's real terrain (DFU's kernel, no
  landforms; 6,000 points in 300 of its 12,564 pixels) the ground there sits a median 0.135 m off (90% within 0.32 m,
  worst 1.16 m). Underground a step that size could put the pile in a wall; not measured.
- A TAKE PAST A MILLION. The wire bounds a take at 1,000,000 (`wire.js:"export const WILD_STACK_MAX = 1_000_000;"`); a
  larger one is refused at the socket and goes back on the pile, so nothing is lost, and no pack carries that much.
- THE FRIEND LAW'S MIRROR (read, not run). `canTake` reads the guild off the room's drawable sockets
  (`world.js:"canTake: (rec) =>"`): once the fallen's socket has left the cell, a guildmate's game shows her pile and the
  room refuses the take with "Someone took that first."

Which of the two the report showed is not known. REMAINS-TAKE fires whenever the killer cannot carry the whole pile, so
it is the likelier; REMAINS-GOLD needs a share over 65,535, in practice a gold-laden wagon taken into the zone.

## MARA-STATUE: not reproduced - every Temple of Mara's statue is DFU's size or not drawn, and nothing collides unseen (4)

No file changed.

FOUND. A temple of Mara is a building of type Temple (14) whose faction is 24 (`FactionFile.cs:78`, `Mara = 24`; faction
88, the Benevolence of Mara, is its priestess). In Daggerfall's own layout all 445 are TEMPAAC0.RMB #21 (each god has
its own block: Kynareth TEMPAAH0 #13, 641; Arkay TEMPAAA0 #0, 396; Akatosh TEMPAAD0 #22, 235; and so on). The statue
there is flat TEXTURE.097 record 7, 55 x 91 px, record scale 0, at (64, 0, -48), and
`rmbFlats.js:"export function billboardSize(t, record) {"` draws it 1.375 x 2.275 m - DFU's size (MeshReader.cs:324-332,
DaggerfallBillboard.cs:257-260, DaggerfallInterior.cs:869). With both town packs served (the default offline, and online
by the room's settings) there are 448: 282 in Beautiful Villages' TEMPASC0 #9 (151 of them the wilderness temples named
"... of Mara"), 122 in Beautiful Cities' TEMPAAC0 #21, 26 in TEMPBSC0 #12 and 18 in TEMPBAC0 #21. The four pack blocks
share one interior design (254-275 models, 105-118 flats), whose god's statue is flat 1230.11, a metre up on the stone
pedestal 74091. Archive 1230 is the RMB Resource Pack's statues, which the port does not carry (its 1230 stand-in holds
only Detailed Ships' 1230_30), so 1230_11 measures 1 x 1 px (0.025 m) and `dataPipeline.js:"    if (!swap && t.vendor) {"`
uploads one clear pixel. DFU draws nothing there either (it finds no TEXTURE.1230); `03-World/Beautiful-Towns.md`
already lists it under "Not stood in". The pedestal stands empty in all 448.

Every interior flat of BLOCKS.BSA and both packs was swept: one alone is taller than a storey (3.2 m) or wider than 3 m,
TEXTURE.210 record 24, a 4.55 m lamp in the classic data (1,498 placements) - no statue. Every scaled model in the Mara
rooms is scaled as the pack's author wrote it, by `rmbLayout.js:"export function modelScaleVector(obj) {"`'s rule
(RMBLayout.cs:74-77, DaggerfallInterior.cs:445), Mara's tapestry 45147 at 1.3 and 1.5 among them, and each placement is
drawn and collided from the same mesh and matrix. In the five room variants every flat's solid body (PROP-BODIES) sits
inside its drawn picture, at its foot (`propBodies.js:"  return body(c, (footShare(t, record, size) * w) / 2, h * COVER_HEIGHT_FRAC);"`,
from `interiorContext.js:"collider.cover.add('prop-bodies', flatBodies(t, archive, record, size, centers));"`); no flat
without a picture has one (the 0.025 m statue is under STEP_OFFSET), and no floor or ceiling cuts a body but one 2 cm
ceiling touch (211.47, the pack design's lower storey). Outside, the Mara blocks hold no statue: the tallest flats are
the 4 m lamps (210.29) and a 3.68 m signpost (212.5).

Not seen in play: the real renderer (`?interior=TEMPAAC0.RMB:21`, SwiftShader) built the room (275 models, 106 flats, 10
people) but drew no frame in 15 minutes.

NOT CHANGED (for the owner, with the reporter's word):
- WHAT THE PLAYER SAW. Only the reporter can say - the town, whether the packs were on, and whether a .dfmod was attached.
  The real RMB Resource Pack attached would draw 1230_11 through the attached-mod path at its own xml's scale; the
  Detailed Ships statue beside it (1230_30) suggests the pack's statues are drawn at a fifth of their pixels (xml 0.20),
  so one would look giant only from a bundle with no xml.
- THE EMPTY PEDESTAL. All 448 pack temples of Mara, and every pack temple of the Eight (39 statues), stand an empty
  pedestal where the god's statue was meant to be. Standing Daggerfall's own statue there instead (Mara's, TEXTURE.097
  record 7) is the owner's call.
- GARDEN PLANTS ARE SOLID. PROP-BODIES decides plant life by archive alone (the nature archives 500-511), so TEXTURE.301's
  garden plants (berry bushes, cabbages) stand solid, though its own header says flowers and bushes are walked through:
  20,047 placements across the pack blocks, 10 in each TEMPASC0 temple garden. Their bodies sit inside drawn plants, so
  nothing is unseen, but a player may feel them as walls. Whether they are walked through is the owner's call.

## ESSENCE-LOOSE: Arcane Essence from a piece made of pack goods is a station's, never "bought with gold" (5)

`server-account/src/alchemy.js` (disenchantPiece's origin and its full-Stores word; reforgeWithEssence's spend),
`server-account/src/professions.js` (craftAtAnvil and temperPiece mark the piece), `server-account/src/market.js`
(buyWithGold clears the mark), `server-account/migrations/0142_essence_loose.sql`, `server-account/src/service.js` and
`wrangler.toml` (acct166), `src/ui/professions/profPages.js` (the split, its lines, the station's room, the Reforge's
count), the English catalog and the thirteen complete languages' drafts.

FOUND. The Stores keep four origins, not three: own, bought, gold, and since AUDIT BAG-CRAFT A1
(`06-Systems/Materials-Bag.md` 15, migration 0097) `loose` (`bagLaw.js:"export const LOOSE_ORIGIN = 'loose';"`) - units a
put-in brought from the pack that the service never handed out. Two doors make them: a station's own shortfall
(`profBook.js` ensureInStores with `work`) and the Stores page's Put in of uncounted goods
(`profPages.js:"LOOT-LOOSE: what the service counts by"`) - every looted, traded or counter-bought stack. A station spends
them first (`bagLaw.js:"export const STATION_ORIGINS = "`), and one loose unit among a craft's inputs walls the whole
piece: A1 marked it `products.bought_with = 'gold'` (`professions.js:"const boughtWith = "`), so it lists for gold alone,
as a pack's piece does; a temper with a loose input does the same. But migration 0041 wrote that column as "A PIECE'S
LAST PURCHASE", and the disenchant read it so - its origin was `p.bought_with === 'gold' ? 'gold' : ...` (alchemy.js line
220 at 4bba28c6c7). Reproduced through the real Worker on 4bba28c6c7: a Gold Ruby Ring made of one Gold Bar put in from
the pack and an own Ruby, taken apart, answered `origin: 'gold'`, `store: { own: 0, bought: 0, gold: 21 }`. The page
mirrored the row: "21 bought with gold" on the card, GOLD_GOODS_LINE under it ("Bought with gold. It can go to your
pack..." - Arcane Essence has no pack form, AUDIT PROF12 E1), and the Reforge with Essence (CRAFT4), which counted own and
bought alone (`spendableSql`), said "Needs 2 Arcane Essence; your Stores hold 0." beside a card of 21, its press shut.

The four places the report could come from, each checked: the disenchant writing `gold` - yes, for a piece walled by its
goods: the defect; a piece bought with gold giving gold's Essence - right, and kept, by the wall's own law
(`marketLaw.js` GOLD-MARKET, law 8: goods bought with gold "go to the pack or back on the market for gold, and nowhere
else"; Professions-Arc 10.8 and 37: "gold where gold bought it"); the page counting something as gold that is not - no,
the split's gold is the service's `gold` row alone, mirrored by the book (`profBook.js` applyStore); a migration or
back-fill - none wrote it (0041 added the column with no back-fill; 0097 widened the Stores alone). Whether the player's
piece was bought with gold cannot be read from the summary; a gold purchase takes a realm character buying a gold
listing, a loose input only crafting with anything from the pack, so the label is true for the first alone.

DFU has no member here: no disenchanting and no Stores ("disenchant" appears nowhere in DFU's Assets/Scripts). The
Stores, their origins and Arcane Essence are PROF0's and PROF12's own, so nothing departs from DFU.

FIXED. The piece says what walled it: `products.loose` (migration 0142), 1 where its gold wall is its goods' - written by
the craft beside `bought_with` (`professions.js:"const looseWall = "`), and by a temper with a loose input unless a gold
purchase walled the piece first (`professions.js:"AND (bought_with IS NOT 'gold' OR loose = 1)"`); a gold purchase clears
it (`market.js:"bought_with = 'gold', loose = 0 WHERE"`). The market's doors still read `bought_with` alone, so the piece
lists for gold alone, as A1 walls it. The disenchant reads both
(`alchemy.js:"(Number(p.loose) === 1 ? LOOSE_ORIGIN : 'gold')"`): a goods-walled piece's Essence is LOOSE - a station's,
as a smelt's products of loose goods are (A1's own rule), reaching no writ, guild Stores or sale - and a gold-bought
piece's stays gold's. The Reforge with Essence spends as every station does
(`alchemy.js:"WHERE ${workableSql('?1', '?2', '?9')} >= ?5"`, workStatements): loose first, then bought, then own, never
gold's; its refusal and the disenchant's full-Stores word count the loose units
(`alchemy.js:"if (workHeld(room) + (room.gold ?? 0) + essence > STORES_MAX)"`). The page counts them for the Reforge
(`profPages.js:"const have = (ess.own | 0) + (ess.bought | 0) + (ess.loose | 0);"`) and the station's room
(`profPages.js:"const room = storesRoomOf(book, ess);"`), and a material with no pack form (Arcane Essence, a Ram Kit)
says its loose units were made of pack goods (`profPages.js:"const fromPack = () =>"`: "21 made from pack goods"), under
LOOSE_MADE_LINE ("Made from goods from your pack. Stations can use it, but writs, guilds and sales only take what you
gathered or took from your Stores."); its gold units take GOLD_STAYS_LINE ("Bought with gold, or made from a piece bought
with gold. It can be sold on the market for gold, but no station, craft, writ or silver sale takes it."). Neither offers
the pack now. Three new strings (`prof.page.stores.fromPackGoods`, `.looseMade`, `.goldStays`), drafted in the thirteen
complete languages (`tools/l10nInSession.mjs`).

THE DATA. Migration 0142 (applied before acct166, the Worker that reads it, as the deploy runs them) mends the live rows.
A standing piece walled to gold that its owner never bought with gold is marked loose: every gold purchase of a piece is a
`market_sales` row (kind 'piece', currency 'gold', its buyer the new owner), the market keeps them 90 days, and
GOLD-MARKET opened on 2026-09-30, so every one is still there. `prof_disenchants` is rebuilt with `loose` in its origin's
CHECK (0041's and 0097's way), and a past disenchant of such a piece is named loose by the same rule. Each character's
gold Essence moves to loose as far as those disenchants gave it, and never more than its Stores still hold of gold's.
ACCOUNT_VERSION acct166, one release with SOUL-LAW (whose migration is 0143, after this one): service.js and wrangler.toml, the history line naming both, and every version pin moved (30 pins
in 19 test files, 10 records in 9 mutant lists). The same deploy carries DEX-HIDES' law to the Worker.

THE FOUR HOSTS: none changed. `world.js` wires the Stores page and the enchanting station's acts through the module
(`world.js:"      setProfessionsPages({"`), and `worldModes.js` stands the station
(`worldModes.js:"    enchantHere() {"`); the change is the account service's, the book's mirror reads it as before, and the
page draws it. `exterior.js` and `dungeonContext.js` stand no enchanting station and wire no Stores page
(Professions-Arc 37, the four hosts).

PINS. `test/net/fb1020h_essence.test.js` (6), through the real Worker over every migration, the client's own book over
it, and the Stores page that book draws (the pieces made by the craft route, the loose units by the service's `work`
put-in and the book's own ensureInStores of a bag's uncounted Gold Bar, the gold purchases by the market's gold listing
and buy):
- the report: the ring of a loose Gold Bar, taken apart, gives 21 Essence loose (the answer, its row, the Stores); a ring
  so made is walled to gold for the market and marked; a ring of own goods gives own;
- the Reforge spends loose, then bought, then own, never gold's; its refusals count the loose; a disenchant past the room
  the loose units fill is `stores-full`;
- a piece bought with gold - and one made of loose goods, then sold for gold - gives gold's Essence, which the Reforge
  refuses;
- a temper with a loose ingot marks an own piece (its Essence loose), and a gold-bought piece tempered so stays gold's;
- the client: the book's Stores loose; the card "21 made from pack goods" with LOOSE_MADE_LINE and none of the gold or
  pack lines; the Reforge pressed, the book moving with its answer; gold Essence's GOLD_STAYS_LINE; the station's room
  counting the loose;
- migration 0142 over the rows the old service wrote: the marks, the origins, the Essence moved and no more than held,
  another character untouched, and the service reading them after.

Before the fix all six fail: the report's with the field's own answer (`origin` 'gold', `store` `{ gold: 21 }`); the
Reforge's and the client's on the Stores holding gold's 21; the gold-purchase, temper and migration pins on the mark that
did not exist (`no such column: loose`). Mutants `tools/mutants/fb1020h_essence.json` (20, all dead).

PIN MOVED: the account version's pins (acct166). `test/net/goldmarket_client.test.js`'s two source pins on the gold line
read its new reader (`goldGoodsLine(pick.material)`). Eight mutant records re-aimed by content, all dead: `prof12.json`
PROF12-svc-dis-origin-gold, `fb1018f_craftlimit.json` L5-svc-dis-cap-stale, `craft4.json` CRAFT4-svc-reforge-gold and
CRAFT4-svc-reforge-gold-word, `auditbagcraft.json` AUDITBAGCRAFT-A1-pages-split-silent and
AUDITBAGCRAFT-A1-pages-line-undrawn, `prof3.json` PROF3-svc-product-owner, `goldmarket.json` GOLDMARKET-piece-unmarked.

NOT CHANGED:
- THE PIECE'S OWN WALL. A piece made of loose goods still lists for gold alone, never Drakes (A1's law, MARKET-ANY's pack
  piece).
- LOOSE ESSENCE LISTS NOWHERE: loose goods never list, and Essence has no pack form - A1's stations' wall, as a loose Ram
  Kit's. Before the fix the same Essence, mislabelled gold, could be listed for gold, and the piece it came from still
  can be. The owner may prefer loose Essence to list for gold, as the piece does.
- THE BACK-FILL'S EDGES. A piece bought with gold, traded away and back by Drakes, auction or commission, then tempered
  with a loose ingot, reads as gold-bought (an older gold sale to its owner stands) - gold's, as before. Gold Essence
  already on a gold listing stays gold's there. Which gold units a character sold is not kept; the ones still held are
  taken as the misnamed ones first. The back-fill leans on `market_sales` holding every gold sale of a piece: kept 90 days
  from 2026-09-30, so until about 2026-12-29 - 0142 shipped after that needs another source.
- ESSENCE_STAYS_LINE still ends "Sell it on the Market tab." over loose Essence; the loose line under it says sales take
  none of those units.
- `professionLaw.js` storesFullIn sums own, bought and gold without loose - for a book that does not carry, which no live
  book is.

Before the deploy, how many players this touched (the disenchants 0142 renames), on the live database:
`SELECT COUNT(DISTINCT d.player), COUNT(*), SUM(d.essence) FROM prof_disenchants d WHERE d.origin = 'gold' AND NOT EXISTS (SELECT 1 FROM market_sales s WHERE s.kind = 'piece' AND s.currency = 'gold' AND s.provenance = d.provenance AND s.buyer = d.player);`

## TAB-WALK, HUD-FOCUS: a Tab no longer puts the keyboard on the Social button, and Space no longer presses it (6)

`src/ui/input.js` (`isPageTarget`, `isPageFocusWalk` and `neverTheFocus`, plus the walk added to `swallowBrowserKey`),
`src/ui/chatPanel.js` (the controls the chat stands over the world).

FOUND. The game's Tab is the QuickDial (`inputActions.js:"['Tab', 'QuickDial'],"`, KB1). Daggerfall Unity binds nothing
to Tab. ResetDefaults (InputManager.cs:954-1048) sets no KeyCode.Tab, and the only Tab DFU reads is a window's own: the
advanced settings' page turn (DaggerfallAdvancedSettingsWindow.cs:224). A host prevented Tab only when the dial answered
it: `world.js:"if (act === 'QuickDial' && hudCtx.toggleDial()) { e.preventDefault(); return true; }"` (PX17b: "preventDefault
only when the dial answers, so classic Tab keeps its default"), and for the interior, dungeon and bench hosts
`input.js:"if (act === 'QuickDial') { return ctx.toggleDial?.() === true; }"`. The dial does not answer:
- on the classic skin (`pixelDial.js:"if (!isEnhanced() || typeof document === 'undefined') return false;"`; online plays
  either skin since OVH3);
- before the boot's last await (`world.js:"if (!_worldKeysLive) return;"`, KEY-BOOT);
- when a player has moved the QuickDial off Tab.

In each of these the browser's own default ran: its walk of the page's focus. That walk was never DFU's classic
behaviour. The hosts' one list of the keys the browser would steal (U47, `input.js:"export function swallowBrowserKey(e) {"`)
held F6 because F6 moves the focus. Tab moves it too, and the list did not hold it.

Where the walk lands, measured in headless Chromium on the real world host (`?world` at Knightstale, classic skin, the
freeware ARENA2, on `4bba28c6c`). In play, offline, nothing takes the walk. With the real chat mounted as `world.js`
mounts it online (`createChatPanel` with its `social`), the walk has one stop: `button.dfchat-social.dfchat-social-out
"Social"`. The sheet hides every other control while the chat is shut. The Chat button is the touch skin's alone
(`chatPanel.js:".dfchat-open { display: none; pointer-events: auto;"`). Play online here shows only while another tab
holds the seat (`chatPanel.js:".dfchat-here.on { display: inline-flex; }"`), and Show only while the chat is put away.
So the report's button is the first and only control a Tab can land on. Then (Chromium, measured): a focused button is
pressed by Enter at the keydown and by Space at the keyup unless the keydown is prevented. A Tab from the body focuses
the first such button. A mouse press focuses it unless the mousedown (or the pointerdown) is prevented, and the click
fires either way (a plain page, `focuslaw.mjs` in the lane's scratchpad). Space is Jump, a polled action no ladder
prevents. On the real host, a mouse press on Social gave it the focus and the next Space pressed it again (two presses
in all). That run went under the window the classic boot stands: F12 was taken there, and neither Enter nor Escape
cleared it, so the press reached the button through AUDIT 28 H11. The same window took the Tab in both trees (townTalk
prevents every key under it). The walk itself on the real host, with no window up, was not reached in the time the
shared machine allowed. It stands on the code path above and the measured Chromium law. Enter mostly goes to the chat, its open key
(`chatPanel.js:"if (!takesKey(e)) return;"`). AUDIT 28 H11 lets Enter and Space reach a focused DOM control under a
window (`townTalk.js:"if ((e.key === 'Enter' || e.key === ' ') && isDomControlTarget(e.target)) return true;"`).

The family. Earlier fixes each wrote the rule out for themselves, and no helper held it:
- STEED-UI's saddle and helm panels (`enhancedSaddle.js:"// AUDIT STEED-UI: a button never keeps the keyboard's focus"`);
- the held map's filters (`heldMap.js:"// NEVER THE FOCUS - out of the tab order"`) and the wild map's buttons;
- the pace steppers (`travelPaceControls.js:"b.tabIndex = -1;   // never the focus"`);
- the enhanced dialog and port (`enhancedDialog.js:"btn.tabIndex = -1;   // the keys are the game's"`).

The chat's own field already kept Tab (C7, `chatPanel.js:"else if (e.code === 'Tab') e.preventDefault();   // C7"`).
AUDIT LEGACY III U2 wrote the law down: with the focus on the page's body "every Tab was the game's". The pause door
brings the keyboard in itself (`pauseDoor.js:"document.addEventListener?.('keydown', tabIn, true);"`).

Every in-game DOM button, read from every module that builds one, by where it stands:
- AFFECTED, the report's surface: the chat's Play online here, Chat (touch), both Social buttons and Show. Tabbable and
  standing over play. Social stays after its own press, so its focus was pressed again by the next Space.
- AFFECTED by the walk only: each of these goes when it is pressed, so its focus falls back to the page.
  - the friends panel's invitation toast, Accept and Decline (`socialPanel.js:"const toastYes = el('button', 'dfsocial-btn', 'Accept'); toastYes.type = 'button';"`);
  - the duel prompt (`duelPrompt.js:"const yes = el('button', 'dfduel-btn', 'Accept'); yes.type = 'button';"`);
  - the Elite Breach's call (`egCall.js:"const btn = el('button', 'dfegcall-btn', 'Answer');"`);
  - the Code of Conduct card;
  - the arena session's button (`arenaSessionButton.js:"Hidden under any window"`);
  - the siege readout's Claim, Close and Leave;
  - the journey panel's Map, Camp and Exit (a window over it hides it:
    `enhancedTravelControl.js:"if (last.covered !== true) { last.covered = true;"`);
  - the `/unstuck` wait's Cancel (`world.js:"const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Cancel';"`).
- ALREADY NEVER THE FOCUS: the family above.
- OWN KEYBOARD BY DESIGN: the seated card tables. The Iliac and Gambit roots take the focus and stop Tab
  (`iliacTableHud.js:"root.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter') e.stopPropagation?.(); });"`),
  and the card table's fold is `tabindex="0"`.

FIXED.
- TAB-WALK: `input.js:"export function isPageFocusWalk(e) {"` is a Tab or Shift+Tab, with no Ctrl, Alt or Meta, aimed at
  the page itself (`input.js:"export function isPageTarget(t) {"`: the body, the root element, the document, no target).
  That is where the focus stands while the game has the keyboard. swallowBrowserKey takes it beside F6
  (`input.js:"if (!BROWSER_STEALS.includes(e.code) && !isPageFocusWalk(e)) return false;"`). It prevents the default
  alone: the QuickDial still hears the key, and the dial still opens on the enhanced skin. Left alone:
  - a field's Tab (CG2);
  - a window whose control has the focus (`input.js:"export function isDomFocusWalk(e) {"`), and the seated tables;
  - Ctrl+Tab, which is the browser's, and Alt+Tab, which is the system's.

  An unanswered Tab now does nothing, as DFU's does. This restores DFU and departs from nothing (the QuickDial is the
  port's own).
- HUD-FOCUS: `input.js:"export function neverTheFocus(n) {"` is the one copy of the family's rule. It takes a control out
  of the walk (tabIndex -1), keeps a mouse press from giving it the focus (the press's default prevented; the click
  still fires, as measured), and gives back at once a focus it gets another way: a script's focus(), or the pad cursor's
  press (`plusPad.js:"if (button === 0) el.closest?.('input, select, textarea, [tabindex], button')?.focus?.({ preventScroll: true });"`).
  The chat applies it to all five of its controls
  (`chatPanel.js:"for (const b of [here, openBtn, show]) neverTheFocus(b);"` and
  `chatPanel.js:"neverTheFocus(b);   // FB1020h HUD-FOCUS: a Tab walked onto it"`). The open box's own controls are the
  field's, as C7 has them, and are unchanged.

Measured after the fix on the same host, the same way: the shut chat offers the walk nothing (tabbable: none). A mouse
press on Social opens it once and leaves the focus on the page, and the next Space presses nothing (one press in all).

THE FOUR HOSTS: none changed. The swallow is the seam every host-level keydown calls (test/ui/nativeinventory.test.js
sweeps the five). `world.js` calls it under the window rung and above the boot's gate and the dial's arm
(`world.js:"swallowBrowserKey(e);   // U47: F5/F6/F11 - one list, in ui/input.js"`). `worldModes.js` and `exterior.js`
call it too (worldModes first, exterior under its window rung). `dungeonContext.js` registers no keydown: its keys come
through `worldModes.js` and `dungeon.js`, and both swallow first. The chat stands in `world.js` alone (online is
`?world`).

PINS. `test/ui/fb1020h_tabwalk.test.js` (6), on the real chat panel and the real swallow, run in `world.js`'s order (the
panel's capture listener, then the host's bubble listener):
- a Tab from the page, and a Shift+Tab, is swallowed with the shut chat in front of it, still reaches the ladder, and
  leaves the focus on the page;
- every other Tab stays where it was: C7's field, a field outside every window, the pause door's walk, Ctrl+Tab, Alt+Tab,
  Cmd+Tab, W, and F6 still swallowed;
- the five controls are out of the walk on both skins, and the chat's field is not;
- a mouse press on Social opens the panel once and leaves it no focus, and the next two Spaces press nothing (the open
  chat's Social the same);
- a focus given another way is given back, and Space presses nothing;
- `world.js` calls the swallow above the boot's gate and the dial's arm, and routeKey no longer says the walk is the
  classic default.

Before the fix five of them fail. The tabIndex pin reads `[0, 0, 0, 0, 0]`. The press pin reads a press that kept the
focus and a second press from Space. The second pin (what the swallow must not take) passes either way. Mutants
`tools/mutants/fb1020h_tabwalk.json` (13, all dead):
- the swallow without the walk; the body not the page; every target the page;
- Ctrl+Tab, Alt+Tab and Cmd+Tab each swallowed;
- the helper writing 0, keeping a press's focus, or keeping a given focus;
- the Social buttons, Play online here, Chat and Show each out of the helper.

PIN MOVED: none. No existing pin or mutant record quotes a line this moved (mutantdrift, citedrift and citeanchor green).

NOT CHANGED (recorded as found):
- THE ARENA STANDS' CHEER AND BOO keep the focus on purpose, so that a keyboard user's press keeps its place
  (`arenaHud.js:"// AUDIT PRE-MERGE 1003 U15: SHUT, NOT DISABLED"`). A Tab from the page no longer reaches them. After a
  mouse press, though, the next Space shouts again (they have their own keys, = and -). That call is the owner's.
- THE SURFACES A PLAYER OPENS keep a press's focus while the player can still walk and jump: the friends panel, the
  F-menu, the profile and the page windows, and the Overworld's own HUD. Their Tab from the page is now the game's, as
  on the enhanced skin it already was (the dial's). Making them never the focus would take their keyboard away.
- THE EXISTING COPIES (saddle, helm, held map, wild map, pace steppers, enhanced dialog and port) keep their own lines.
  Each holds the rule, and their pins and mutants quote them. Moving them onto the helper is churn with no change to a
  player.
- THE ELITE SPIRE'S FOLD AND TOUCH BUTTONS are a phone's (`egSpireHud.js:".eg-fold:empty { display: none; }"` on a desk).
- THE CLASSIC-START WIZARD in the standalone `?dungeon` bench: a Tab from the page no longer walks into the enhanced
  wizard (a Tab from one of its controls still does). In `?world` and `?exterior` the wizard stands in townTalk's slot,
  which already took every Tab under it. That predates this fix, and the wizard's own note wants the walk.

Seen on the real world host in headless Chromium, before and after: the chat was mounted on the running host as
`world.js` mounts it, and the online session itself was not stood up. The Tab walk was seen on a plain page and not on
the host, because the classic boot's own window held every key through the probe.

## SOUL-LAW and TRADE-WHOLE: an Ogre's soul in a Soul Gem froze its trapper's trading (7)

`src/systems/item/itemLaw.js` (soulLawful, MOD_SOULS, ITEM_LAW_VERSION 9); `src/systems/enemyExpansion/dexIds.js` (new);
`server-account/migrations/0143_soul_lift.sql` (new); `server-account/src/service.js` and `server-account/wrangler.toml`
(acct166, shared with ESSENCE-LOOSE); `.github/workflows/account-deploy.yml` (the Worker's paths). TRADE-WHOLE:
`src/systems/tradePack.js` (wholeLot).

FOUND. The "freeze" was the realm's trade hold, not a hang. The Ogre is not one of DFU's MobileTypes: it is Daggerfall
Enemy Expansion's 282, a line of the mod's own MonsterBase table. DEX1 merged as #1067 on the day of the report and is on
by default (`modSettings.js:"  'daggerfall-enemy-expansion': Object.freeze({"`); its fifty enemies are 256-290 (monsters)
and 384-398 (people), joined to the bestiary at the game's load (`dexInstall.js:"  registerEnemyRows(rows);"`). The soul
trap's kill door hands the foe's own mobile id to the trap
(`exteriorFoes.js:"const trap = peer || _peerTrap ? { allowDeath: true } : attemptSoulTrap(f.entity, f.mobileType, playerEntity.items, Math.random());"`,
`dungeonContext.js:"const trap = peer || _peerTrap ? { allowDeath: true } : attemptSoulTrap(foe.entity, foe.mobileType, playerEntity.items, Math.random());"`),
and the gem takes it (`mysticism.js:"  trap.trappedSoulType = soulType;"`) - DFU's own law: EnemyEntity.cs:217 hands
`SoulTrap.FillEmptyTrapItem((MobileTypes)mobileEnemy.ID)` and SoulTrap.cs:158 writes it. With the mod installed DFU's
EnemyBasics holds the custom id, and ItemHelper.cs:352-368 names the gem "Soul Trap (Ogre)", as the port does
(`itemInfo.js:"const shownSoulName = (soul) => getLocalizedEnemyName(soul, enemyDisplayName(soul));"`).

Item law 8 took only DFU's ranges (`itemLaw.js:"const soulLawful = "`: 0-42 and 128-146), so a gem holding any of the
fifty was a `soul` finding (`itemLaw.js:"&& soulLawful(item.trappedSoulType))) out.add('soul');"`). The account service
judges every realm checkpoint headless with that law
(`judge.js:"for (const code of findingsOf(it)) keep({ code, list: li, at: i, t: it?.templateIndex ?? null });"`), the
verdict holds the character and adds a strike (`verdict.js:"  if (law > 0 || (until != null && until > nowS)) return 'law';"`),
and the client announces the hold (`realmHoldHost.js:"session.onTradeHeld = "`) by the template's name
(`itemIds.js:"  const name = now === 'law' && why ? lawTemplate(why.t)?.name : null;"`). Reproduced word for word through
the real Worker: "The realm is reviewing this character: it carries a Soul Trap the game could not have made. Trading is
frozen until it is gone. Holds add up: from the third, trading stays frozen for a week even after it is gone, and for a
month each time after that." While the hold stands every route that hands the character's value to another player
refuses it (`trade-held`); three gems filled and sold make three strikes and a week's hold. Measured over every creature
a gem can hold - the 112 in the bestiary after the mod's install, DFU's 62 and the mod's 50 - filling the Mages Guild's
Soul Gem through the kill law: under law 8 DFU's 62 were lawful and all 50 of the mod's findings (35 monsters, 15 people).
Azura's Star the same.

The trading windows were not the freeze. Driven with a pack of 152 Soul Gems (one per creature and 40 empty, past
TRADE-VIRT's 120-row threshold), the merchant's counter in Sell and Buy drew every row named "Soul Trap (<creature>)" and
priced it (5,000 gold to sell, 5,625 to buy at quality 10) in 52-78 ms, and moved the Ogre's gem onto the counter and back
by double click; the trade between players drew all 152 rows. Filling a gem writes no value (SoulTrap.cs:158 writes only
the soul), its picture is the template's, virtualRows' aim loop is bounded
(`virtualRows.js:"    for (let pass = 0; pass < AIM_PASSES && steer(); pass++);"`), and a landing pass walks the waiting
tiles once (`landingTiles.js:"export function landingTiles(draw, { alive = () => true, later = nextFrame } = {}) {"`).

TRADE-WHOLE (found on the way). The trade between players writes the giver's offer for the wire through validLootList,
and since AUDIT INT that clamp drops a piece the law refuses and keeps the rest
(`systems/loot/loot.js:"    if (!lawRefuses(it)) out.push(lawPriced(it));"`) - right for a chest, wrong for a trade: the offer was
never refused (`tradeSession.js:"      if (!wired) return { ok: false, why: 'That cannot be traded.' };"`), so the gem stood
in the giver's offer while the wire carried nothing. Driven hand to hand on the real sessions: offered alone, the peer
saw an empty table and its lock answered "Nothing is being traded."
(`tradeSession.js:"    if (!this.hasContent) return { ok: false, why: 'Nothing is being traded.' };"`), the trade left
open with nothing either side could do; offered beside 10 gold, both sides confirmed and read "Trade with B complete." -
the take reserves the offered entries, gem included, while the commit sends only what the wire carries
(`tradeSession.js:"    this._enqueue({ k: 'commit', r: this.rev, o: this.theirRev, items: this._mineWire, g: this.mine.gold }, {"`),
so the gem left the giver's pack and the peer got the gold alone. Through the realm the half's `give` lacked the gem
(`tradeSession.js:"    const half = { sid: this.sid, give: { items: this._mineWire, gold: this.mine.gold }, get: { items: this._theirRaw, gold: this.theirs.gold }, pick };"`)
and the hold refused the trade first; and `unwire` showed a peer's lot less the piece the law refuses.

FIXED.
- LAW 9 (`itemLaw.js:"const MOD_SOULS = new Set(DEX_ENEMY_IDS);"`): a Soul Gem or Azura's Star may hold the soul of any
  of the mod's fifty. The service installs no mod, so the ids are read headless from the mod's own tables
  (`dexIds.js:"export const DEX_ENEMY_IDS = Object.freeze((() => {"`): every `.mdb.csv` line's ID that is not one of DFU's
  MobileTypes (`enemyBasics.js:"export const isClassicEnemyId = "`), with MUDEX's tables read after the mod's - the same
  reading the install registers, and a pin holds the two equal. A soul no creature has is still a finding.
- THE SERVICE. acct166 carries law 9 (`service.js`'s ACCOUNT_VERSION, `'acct166'` at `1feee3838` - FIELD BUGS 2026-10-21b
  CAKE-CAP-SAID's acct167 after it, renumbered past this at its merge - and wrangler.toml), one
  release with ESSENCE-LOOSE. The deploy's path list names the four files the Worker now bundles (dexIds.js,
  dexTableText.js, mudexTableText.js and dexCsv.js; 33 KB, mostly the mod's table text), and tech1_roster's LAW_SERVICE
  names law 9 as acct166's.
- MIGRATION 0143 (0142 on its lane, renumbered past ESSENCE-LOOSE's at the merge) lifts what law 8's soul finding alone
  laid, reading the record as 0130 (KEY-LIFT) does, with three differences: 0130's own lift ends no count, because it
  kept strikes; a Weir Key's finding (575, already lifted twice) never counts as one that could strike; and the soul's
  signature is kept, as 0125 kept the key's - the migration runs before the Worker that carries law 9, so a checkpoint law
  8 judges in that gap finds the same gem and is no new strike. Written as a staff act (`by: 'soul-lift'`); an untimed hold
  lifts at the character's first checkpoint under law 9 in any case.
- TRADE-WHOLE (`tradePack.js:"function wholeLot(records) {"`): the trade's pack clamps its lot whole or not at all, which
  is what `wire` and `unwire` were documented to do ("or null if any is no item"). An offer holding a refused piece is
  refused with "That cannot be traded." and the piece stays in the pack; a peer's lot that carries one ends the trade
  with a message (tradeUnreadableText). validLootList is unchanged for the chests, bodies and shelves AUDIT INT made it
  for.

No departure from DFU: the law, the realm and the trade between players are the port's own (KEY-LAW's footing), and DFU
fills and names the gem as the port now allows.

THE FOUR HOSTS: none changed; none reads the law, each goes through the modules. `world.js` builds the realm's trade pack
(`world.js:"  const tradePack = checkpointedTradePack(createTradePack(playerEntity, { stampIds: stampItemIds }), () => onlineCheckpoint());"`)
and rolls the gate court's soul trap (`world.js:"    soulTrap: ({ chance, mobile }) => {"`); `worldModes.js` and
`dungeonContext.js` open the merchant's counter (createTradeWindow), and `dungeonContext.js` runs its own kill door;
`exterior.js` and `world.js` wire `exteriorFoes.js`, whose kill door fills the gem.

PINS. `test/systems/item/fb1020h_soul.test.js` (6) and `test/server/fb1020h_soullift.test.js` (2), the fixtures the real
producers' (the Mages Guild's Soul Gem by createEmptySoulTrap, Azura's Star by createArtifact over DFU's MAGIC.DEF, each
filled by attemptSoulTrap with the mod's ids read by dexRead; the realm trade through the real createTradeManager and the
account Worker over node:sqlite; law 8's findings in the shape the verdict writes):
- the Ogre is the mod's 282, and its gem has no finding, in the service's judge too;
- all 112 creatures fill the Soul Gem and Azura's Star lawfully, the 112 are exactly the creatures the install fields,
  and the gem reads "Soul Trap (Ogre)";
- the law's list is the mod's tables' own, with MUDEX and without; eight souls no creature has stay findings;
- headless, in a process that imports only the judge, the fifty's gems give no finding;
- through the realm the trapper checkpoints, is not held, hears no notice, and trades the gem; the realm settles it and
  the receiver holds the Ogre's soul;
- hand to hand, a refused piece is refused with a message and kept off the table, and a peer's lot carrying one is
  refused whole;
- migration 0143 lifts the report's week whole, and the next checkpoint carrying the gem holds nothing;
- what 0143 counts and leaves over eleven characters: a forged piece's strike kept, with its own fade; a hold another
  piece makes kept; three other findings, a timed act, staff's hold, a soul in a dagger and no soul at all left as they
  were; 0130's kept strike kept.

All eight fail before the fix: the realm pin with the field's own notice, the hand-to-hand pin with `{ ok: true }` for
the offer, the two lift pins on the migration file's absence. With the law fixed and TRADE-WHOLE not, the hand-to-hand
pin alone fails. Mutants `tools/mutants/fb1020h_soul.json` (21, all dead): the law (4: the mod's list unread, the list
empty, the ranges widened, the law version unmoved), the id reading (3: classic lines kept, ClassBase unread, the wrong
column), the trade's clamp (3: wire, unwire, the count check piece by piece) and the migration (11).

PIN MOVED: the account version's pins (acct166, one release with ESSENCE-LOOSE); `ITEM_LAW_VERSION`/`JUDGE_VERSION` read 9
in five files; 15 mutant records in 11 files re-aimed by content at acct166 and law 9, and ss1.json's `unwire` record at
wholeLot, all dead; `06-Systems/Systems.md`'s module count is 761.

NOT CHANGED:
- THE NOTICE NAMES THE TEMPLATE. A law hold names the piece by `lawTemplate(why.t)` ("a Soul Trap", not "Soul Trap
  (Ogre)"): the finding records the template alone. Naming it as the pack does would need the judge to record the soul.
- THE ITEM MAKER OVER AZURA'S STAR. EnumerateFilledTraps counts a Star's soul unbounded
  (`mysticism.js:"    else if (isAzurasStar(it)) found.add(soul);   // :121-125, unbounded"`, SoulBound.cs:121-125), so a
  Star holding one of the fifty lists Bound Soul, and its chooser, held to SoulBound's 43 costed souls
  (`enchantmentCatalogue.js:"    params = params.filter((p) => soulSet.has(p.param));   // SoulBound.cs:52-55"`), is empty:
  pressing it does nothing. DFU with the mod throws IndexOutOfRangeException there (SoulBound.cs:125). A gem's soul past
  43 is counted in neither game (`mysticism.js:"    if (isSoulTrap(it) && soul < SOUL_BOUND_MONSTER_ID_COUNT) found.add(soul);"`,
  SoulBound.cs:115); the mod's souls bind nothing. Whether the Star should refuse or say so is the owner's call.
- A FORGED SOUL'S STRIKE IS LIFTED TOO. The finding records the template, never the soul, so 0143 cannot tell a soul of
  the fifty from one no creature has. A forged soul gains nothing (the fill writes no value, the item maker reads only
  the first 43), and law 9 finds it again at the next checkpoint.
- THE KEPT SIGNATURE. A character whose next finding comes before any clean checkpoint takes no strike for it - 0125's
  trade-off, kept for the deploy gap.
- THE MOD'S SOUL POINTS. The mod's tables carry no SoulPts column, so its creatures' souls are worth 0 to
  ItemBuilder.CreateRandomlyFilledSoulTrap's `5000 + SoulPts`; the port's random fill (`shopStock.js`
  createRandomlyFilledSoulTrap) draws only DFU's 0-42, as DFU's does.

## The revenants (8): left open

The report reached this session as one line, "the revenants' defects", without its screenshot or its words, and
the owner chose to leave it open rather than have the revenants audited blind (2026-10-21). It stays on the pull
request's list until the report is in hand.

## Seen on the way

Two ARENA2-gated pins fail on main's `4bba28c6c` as they fail here, on this machine's freeware data, and CI (which runs
without ARENA2) never reaches them: `test/systems/quest/fb1004d_cratefree.test.js` "CRATE-FREE real data: every RDB block..." (an
extra `N0000005.RDB quest@29157 in 62330` beside the three it expects) and `test/formats/worldData/wd1_worlddata.test.js`
"every vendored patch rebuilds the author's file sha256" (WALLAA08.RMB.json). Each was run on a `git archive` of the base
and fails there the same way. Not this batch's; recorded so the next reader does not take them for its.
