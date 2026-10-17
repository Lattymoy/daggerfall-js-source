# FIELD BUGS 2026-10-15f - five Discord threads, each fixed at its root

Five threads from the Discord's bug reports, handed over by Mac with: "No band aids". Read on the code as it stands at
main's `bd385fc6` (main merged in four times while this was open: it took `Field-Bugs-2026-10-15b.md` to `-15e.md` for its
own roll-ups meanwhile, so this record is `-15f`), and the temples measured on the real ARENA2 (the freeware
DaggerfallGameFiles, `tools/fetch-data.sh`, outside the tree).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "exploit where you do easy quests for a guild and then ask to join it to farm 100 rep in 1 minute" | nothing mints reputation: a stranger's quests bank DFU's +5 a quest with the guild, and since PROMO-NOW the first review online turned it into every rank it covered at once | fixed (ROLL-PACE), Mac's call: "Pace ranks from joining" |
| 2 | "True Invisibility not working inside dungeons" - "monsters still spot and attack me immediately while the spell is active" | the senses were right; a foe's melee START faced the target's live feet, where DFU's faces the last position it detected - so a foe that never saw the invisible player swung at the one in front of it | fixed (INVIS-SWING) |
| 3 | "The entrance to The School of Julianos in Makehda is blocked" - "The Akatosh Chantry in Merdale also has some small issues" | Makehda: the RMB Resource Pack's foundation and landing stood in at the FBX node's scale - a 16 m block, sunk 2.4 m, that buried the temple's stairs under a six-metre wall (TEMPASF1 in 57 villages, TEMPASH4 in 66 Kynareth temples); Merdale: HILL-SEAT's pads banked grass over the Chantry's flight | fixed (TEMPLE-STEPS) |
| 4 | "The first time craft bonus is not applying to the outfitting. I got somehow it once from...Fishing net?" | not a fault: AUDIT 32 S1 withholds the first-craft bonus from a pattern made only of the counter's cloth - 152 outfitting patterns, the Fishing Net among them - and nothing in the game said so | shown (CRAFT-FIRST-SHOWN), Mac's call: "Keep rule, show it" |
| 5 | "Player is getting wet despite it not raining. Possibly an oversight in reducing the rain?" | the soak read the sim's word at the downpour's rate - RAIN-HEART made most rain a sprinkle, and the front holds a rain word dry before its first drop | fixed (WET-FALL) |

## ROLL-PACE: online, a review promotes no further than the Roll's pace since the membership began (1)

`src/net/npcChapterLaw.js` rollPaceDays, rollPromoteCeiling, rollPaceWait; `src/net/npcRollTracker.js` the tracker's
`standing`, rollPaceOf; `src/systems/guild/guildServiceFlow.js` rankNeedsLines; `src/scenes/worldModes.js` openGuildService;
`src/scenes/world.js` the host's `rollPace`.

THE REPORT. Do a guild's easy quests as a stranger, then join it, and the reputation is ranks at once.

FOUND. Nothing mints reputation. A guild offers a stranger its non-member quests (`questLists.js` getGuildQuestPool,
the 'N' rows) and a success pays DFU's +5 to the guild's own faction whatever the membership (`Quest.cs` EndQuest
:382-386 over `GuildManager.GetGuildFactionId` - "used for non-member quests"). Online the Roll paces that at
ROLL_GAIN_DAY_MAX, 15 a guild a day, a stranger's as a member's. DFU then lets the standing count whole: Join is rank 0
(`Guild.cs` :309), and the next UpdateRank (:74-96) jumps to every rank the reputation covers - after its 28 days.
PROMO-NOW took the 28 days off an online promotion on the word that "the Roll's paced reputation already paces the
ranks". It paces the reputation; the stranger banked it before the membership began, and the hall's first review
turned it into ranks at once. Driven on the real modules: four quests a day for five days (the Roll's 75, 25 owed), then
a join, and the same day's review made the stranger rank 7. A second door stood beside it: the review read the page's
own number, which holds what moved since the Roll's last word unclaimed for up to a minute (longer while claims fail).
Before PROMO-NOW the 28 days ran on the character's own clock (LIVED1), which a fast travel crosses in a minute.

CHANGED (Mac, asked of four shapes - pace ranks from joining, one promotion a day, stranger quests paying no
reputation, the 28 days back - "Pace ranks from joining"):

- **The pace.** Online a review promotes no further than `rollPromoteCeiling`: the rank the Roll's OWN reputation
  allows (never the page's unclaimed number), no more than its pace could have paid since the Roll saw the membership
  begin - 15 a UTC day, that first day counted (`rollPaceDays`; the Roll's view carries the beginning as
  `members[].since`, kept by the tracker and read as `standing(f)`) - and never a seat's (ROLL_BOOK_RANK_MAX). A
  stranger with 75 is rank 1 the day they join, 3 the next, then 4, 6 and 7 - an honest member's own pace from
  nothing. The standing still counts, whole; it is the RANK that waits. A rank already held is never taken
  (updateRank's ceiling never demotes, CHAP4b's law), so a member the Roll was seeded with keeps its rank and is paced
  from the seed for the next.
- **No pace, no skipped wait.** PROMO-NOW's no-wait now stands only while the Roll paces (`rollPaceOf`: null offline,
  or when a refusal ended the Roll); otherwise the review is DFU's whole, 28 days and all. Before the Roll's first word
  on a page the ceiling is 0 - no promotion - where AUDIT CHAP4 C3's was the book's 7.
- **The hall says it.** When the pace is what holds the next rank, the guild popup's line (PROMO-NOW's) ends "Earliest
  promotion: tomorrow" / "in N days" (`rollPaceWait`; `guild.rankNeeds.paced`, drafted in-session in the thirteen whole
  languages).
- **The account service is unchanged.** Its Roll already bounds the rank it records by its own reputation (AUDIT CHAP
  S5), and a rank moves only at the client's review - the door this pace now holds. No relay or account version moves.

THE FOUR HOSTS: the guild popup is worldModes.js's alone (openGuildService) - WIRED; world.js hands it `rollPace`
(its Roll tracker); exterior.js, the offline fixed city, has no Roll and constructs no GuildServiceWindow;
dungeonContext.js stands no guild hall. Recorded in Port-Ledger section A (ROLL-PACE, beside PROMO-NOW's row). Pinned
by `test/systems/guild/fb1015f_rollpace.test.js` (5, the end-to-end one over the real service's Roll and the real tracker);
`tools/mutants/fb1015f_rollpace.json` (13, all dead). PINS MOVED: `test/net/audit_chap4.test.js` C3 and
`test/systems/guild/chap4b_seats.test.js`'s host wiring read `rollPace`; `test/systems/guild/fb1015_promonow.test.js`'s host pin reads the paced
no-wait; `tools/mutants/chap4b.json` CHAP4B-WM-CEILING and CHAP4B-W-CEILING, `audit_chap4.json` AUDIT-CHAP4-C3-CEILING
and `fb1015_promonow.json` PROMO-NOW-the-host-offline re-aimed at the new lines.

What the reporter is owed: the exploit is closed. Reputation earned before joining still counts, but online a new
member rises no faster than the Roll pays - about a rank and a half a day - and the guild hall says when the next rank
can come.

## INVIS-SWING: a foe swings only where it last knew its target stood (2)

`src/characters/enemy/enemyAttack.js` update's melee start; `src/systems/wild/wildAlert.js` noticeRoll, the step;
`src/scenes/world.js` the wild gate's two checks.

THE REPORT. True Invisibility works outdoors; in dungeons monsters "spot and attack me immediately", with no attack,
theft or offensive spell of the player's.

FOUND. The senses were right, in every host: Invisibility (normal or true - they differ only in what breaks them) blocks
every detection - sight, hearing and the stealth roll - of all but DFU's thirteen seers (`EnemySenses.cs`
BlockedByIllusionEffect :659-683, :451-470; the port's `enemyMotor.js` blockedByIllusionEffect and `_classicPostTarget`,
fed `playerInvisible` by `shared.js` sensesContext in all four hosts). A foe that never detected the player never wrote
`lastKnownTargetPos`. But the melee START (`EnemyAttack.update`) tested the 22.5-degree yaw toward the target's LIVE
feet, where DFU's MeleeAnimation tests it toward `senses.LastKnownTargetPos` (`EnemyAttack.cs` :155) - which holds
ResetPlayerPos (float.MaxValue, :28) until a detection, and passes no yaw test. Target selection is not detection (an
invisible player is still the target), so every foe a corridor put in front of the invisible player, inside its
reach, swung - and the blow's own test (MeleeDamage, the live position) landed it. Driven on the real motor and attack:
a foe a step and a half from an invisible player swung nine times in twenty seconds; DFU's swings none. Dungeons are
where foes stand in reach without approaching (corridors, doorways) - and where DFU's seers live (26% of the dungeon
encounter tables against 7% elsewhere: skeletons, ghosts, wraiths, mummies, liches, vampires, Daedra), which see
through it by DFU's own law. The overworld's fast-travel gate (WILD-ALERT) had the same hole by another road: its
notice roll was the stealth formula alone, with no illusion gate.

CHANGED:

- **The swing's bearing.** `EnemyAttack.update` faces `ai.lastKnownTargetPos` - the senses' own record, written on
  detection - and with none, starts no swing. The blow's test is unchanged (DFU's MeleeDamage reads the live position).
  One export every foe pool shares, so no host changes.
- **The wild gate's notice.** `noticeRoll` passes BlockedByIllusionEffect before the stealth roll - an Invisibility
  blocks without a die, a Chameleon or a Shadow rolls its own, a seer rolls as before - and both of world.js's checks
  (the gate's frame and a placed wanderer's first) hand it the traveller's `concealmentFlags` and the enemy's
  `seesThroughInvisibility`.

FLAGGED, not taken: an online joiner's copy of a host's foe observes the joiner through the motor's no-senses path
(`dungeonContext.js` the puppet's `_senses(_pf, null)`), which reads no concealment, so a host's foe that targets an
invisible joiner can still raise the joiner's enemy alert (a refused rest). It strikes nobody: the host's foe decides
on the host, under the host's concealment law.

THE FOUR HOSTS: every foe pool runs the one `EnemyAttack.update` - dungeonContext.js's, exteriorFoes.js's (world.js's and
exterior.js's streets and wilds, and worldModes.js's interiors, IF's one pool factory) and cityGuards.js's - all WIRED by
the one change. The wild
gate is world.js's alone (exterior.js has no fast travel). Pinned by `test/characters/enemy/fb1015f_invisswing.test.js` (4, the first
over the real motor, senses and a True Invisibility cast through the one spell door); `tools/mutants/
fb1015f_invisswing.json` (8, all dead). PINS MOVED: the hand-built foes of `enemyattack.test.js`, `arrows.test.js`,
`audit18_enemies.test.js`, `audit24_characters.test.js` and `audit68_enemies.test.js` that stand DETECTED now carry the
position their senses would have written (TEST THE SHAPE THE PRODUCER MINTS); `encounterplace.test.js`,
`wildalert.test.js` and `wildalertfix.test.js` hand the real `concealmentFlags`.

What the reporter is owed: a monster that cannot see through Invisibility no longer swings at you because you walked in
front of it. The undead, the vampires and the Daedra still can - they see through it in Daggerfall too.

## TEMPLE-STEPS: the pack's pieces at their own size, and a pad buries nothing the author left in the open (3)

`src/world/townStandIns.js` the RMB Resource Pack stand-ins (rmbrpBlock, RMBRP_BLOCK_SCALE, the rocks' boxes and
RMBRP_ROCK_SCALE, the stalls) and blockHillPatch; `src/world/curatedPlacements.js` DOOR_APPROACH_M;
`tools/townSolidsSweep.mjs` (new). The record of the design: `03-World/Beautiful-Towns.md`.

THE REPORT. "The entrance to The School of Julianos in Makehda is blocked. Seen this same problem before with another
temple but forgot where." Then: "The Akatosh Chantry in Merdale also has some small issues." The screenshot: a temple at
night, a sheer stone wall before its door and a pale stair beam crossing it.

FOUND - MAKEHDA. Makehda (Beautiful Villages, `location-1-672`) lays TEMPASF1: the temple 6.1 m up on three foundations
(53170), reached by a landing (53160), a stair (21728), a second landing, the door. Each prefab's MeshFilter names its
mesh, so Unity never applies the FBX node's own Lcl Scaling (250, 125) - MeshReplacement keeps the prefab's scale and
nothing more, as the port already reads the domes. The landing is 3.2 x 1.6 x 3.2 m and the foundation (prefab scale 2)
6.4 x 3.2 x 6.4 m, both centred - the author's own layout agrees (TEMPASH4 tiles its foundations 256 units apart, and a
real landing's top is the stair's foot and the temple's floor). The stand-ins read the node's scale: 4 x 2 x 4 and
16 x 8 x 16 m, and AUDIT WD3 T1 sank the foundation 2.4 m so its top cleared the door point - a cure for the symptom
that kept the footprint. Walked out from the door on the real ARENA2: the landing stood 0.2 m proud of the step, and the
foundation was a shelf at 6.13 m running 4.5 m out that buried the stair's treads (5.82 to 3.00 m) by up to 3.1 m and
dropped as a sheer wall over the lower landing - the reporter's wall, and the beam through it the stair. The same fault
stands TEMPASH4's 66 Kynareth temples behind theirs: the "other temple".

FOUND - MERDALE. TEMPASD1 has no foundation. Its temple stands 7.35 m up on the pack's hills, reached by four stair
pieces. HILL-SEAT's pads (`Field-Bugs-2026-10-13e.md`, merged the day of the follow-up, which listed "whether a bank buries
a neighbour's door" NOT SEEN) banked a 45-degree bank from under a 0.25 m post (43733) over the flight by up to 1.25 m,
and the third piece's pad covered the second's treads. The hill stand-ins cover the bottom piece's sunk foot by 0.36-0.54
m - the pack's own hills by 0.30-0.39, the author's.

FOUND BESIDE IT, measured the same way over every RMB Resource Pack stand-in: the domes, the docks and the city wall were
right; the rocks were the mesh alone, without their prefab's scale (2-8), so 143 of the 245 the packs lay stood wholly
under the ground; the market stalls were at scale 1, 2.35 m off their origin.

CHANGED:

- **The pack's sizes.** The landing and the foundation are the pack's box at each prefab's scale, centred, and T1's sink
  is gone (a real foundation's top IS the temple's floor). The rocks stand over each mesh's own box at its prefab's
  scale (2 of 245 now underground, where the author laid them so); the stalls at 0.75, in Unity's mirrored-x frame.
- **A pad buries nothing the author left in the open.** blockHillPatch skips a model whose pad top would cover another's
  exposed vertex, and its bank steepens (at most 8:1) to pass 0.05 m under every exposed vertex and under every door's
  step and DOOR_APPROACH_M (4 m, HILL-HOUSE's rule) out - the doors read off the meshes the hosts already pass in.
- **The law, swept.** `tools/townSolidsSweep.mjs` (the ARENA2 gate in `test/world/wd3_standins.test.js`, 820 blocks, 10,269
  doors) holds three laws: a stand-in that is the pack's mesh exactly holds only what the pack's own meshes hold (HELD);
  no pad over anything left in the open (PADS); every door's approach clear of every port-made solid but the author's
  own (APPROACH). Before: HELD 31, PADS 7, APPROACH 6. After: 10, 0 and 6, each named in the test - the ten the pack's own
  overlaps, five of the six approaches the author's own hills and rocks (TVRNAS00 house 125's back door under 1.14 m of
  the pack's hill, which the old one-point sweep missed), and one a boulder's rim 0.13 m into a door's approach at
  DARKAA02. HILL-SEAT's own ARENA2 sweep reads the stand-ins the hosts draw now, and counts the author's models under a
  footprint as support; two still hang, named: Merdale's third stair piece 0.43 m at its foot (the pack's hill holds it)
  and TEMPASH4's temple back edge 2.14 m (the pack's hill leaves 2.27 m there too).

THE FOUR HOSTS: world.js and exterior.js lay the town blocks through these stand-ins and blockHillPatch - WIRED,
unchanged (the doors are read off the meshes they already pass in); worldModes.js and dungeonContext.js lay out no town
block. Pinned by `test/world/fb1015f_templesteps.test.js` (7); `tools/mutants/fb1015f_templesteps.json` (21, all dead - three
need ARENA2_PATH). PINS MOVED: `test/world/wd3_standins.test.js`'s sizes for 53160, 53170, the rocks and the stalls, and its
door sweep rewritten as the three laws; `test/world/fb1013e_hillseat.test.js`'s ARENA2 sweep reads the producer's meshes;
`tools/mutants/auditwd3.json` AWD3-FOUNDATION-CENTRED re-aimed. Audit-WD3's T1 retired; Field-Bugs-2026-10-13e's NOT SEEN
narrowed; Port-Ledger's HILL-SEAT row narrowed.

What the reporter is owed: the School of Julianos, and every temple built the same way, stands on its own foundation
again - you walk up its steps to the door. Merdale's Chantry steps are clear of the grass banks.

## CRAFT-FIRST-SHOWN: the first-time bonus said where it is earned (4)

`src/ui/craftXpWords.js` (new) craftXpLine, dishFirstLine, masonWorksFirstLine, craftXpText; `src/ui/professions/profPages.js` the
station boxes; `src/scenes/world.js` the craft's word (one call). The record of the design: `06-Systems/Professions-Arc.md`
41.9.

THE REPORT. The first-time craft bonus does not apply to Outfitting; it came once, from a Fishing Net perhaps, and never
again.

FOUND. Not a fault. AUDIT 32 S1 (`recipeLaw.js` firstCraftPays over `COUNTER_ONLY`; Mac: "Whatever you think is best")
withholds the 500 (FIRST_CRAFT_XP) from a pattern made wholly of goods only a counter sells - the Weavers' Linen and
Wool: 152 of the loom's patterns, every Linen or Wool garment but the boots, the rugs, the tapestries and the Fishing Net,
which never paid (`audit32_law.test.js` lists it). A Linen boot (the bolt and Cured Leather), leather armour, Silk and
the pelts pay. The account service decides and answers `first`, and nothing in the game said any of it: the anvil, the
workbench, the loom and the mason's bench showed no XP, the jeweller's and the fire's showed theirs without the first,
and the craft's word left `first` unread. What paid the reporter once was most likely another of the loom's first
patterns (Rat skins open beside the net at rank 1). The client holds no record of past crafts (`professions.js`
profState sends none), so a page can say what a first craft pays, never whether this one's is still owed.

CHANGED (Mac, asked: keep S1 and show it, or pay it - "Keep rule, show it"): every station box says the picked pattern's
XP and what its first time lays on - or, for the Weavers' cloth, that it lays on none; the mason's works, the fire's
dishes and a potion of the Apothecaries' goods say theirs; and the craft's word says "with the first-time bonus", or, for
a first of the Weavers' cloth, why none came. Eight keys, drafted in-session in the thirteen whole languages (the
alchemy page's `xp` key retired for `xpShop`). Client only: no account or relay version moves.

Pinned by `test/net/fb1015f_firstcraft.test.js` (3, over the real recipe tables, the real Worker's craft answer read through
the real profBook, and every station page drawn from it); `tools/mutants/fb1015f_firstcraft.json` (20, all dead). PINS
MOVED: `craft1_chain` and `prof10_client` read the craft's word through `craftXpText`.

What the reporter is owed: the stations now show each pattern's XP and its 500 first-time bonus, and say plainly that
pieces made only of the Weavers' Linen and Wool - the Fishing Net among them - earn none.

## WET-FALL: the skin reads what falls, and how hard (5)

`src/systems/weather/weatherSim.js` fallingWeather; `src/systems/survival/temperature.js` weatherWetGain, feltTemperature;
`src/systems/survival/env.js` ENV_DEFAULTS; `src/systems/survival/needs.js` the road's fair sky; `src/scenes/world.js`
and `src/scenes/exterior.js` survivalEnvNow.

THE REPORT. Wet with no rain falling, and the reporter's guess - the rain's reduction - was right.

FOUND. The soak (Climates & Calories' every-minute row, `WEATHER_WET`: rain 3 bare, 1 under a cloak, 0 under its hood)
read the sim's WORD. RAIN-HOURS and RAIN-HEART (`07-Rendering/Weather-Arc.md`, 2026-10-13) made rain rarer and most of
it a sprinkle - 63-71% of rain time under 0.15 of the profile - by the front's INTENSITY, which only the drawn drops,
the look (RAIN-SPRINKLE's fallTerms) and the ear (DISC9/DISC11's heard word and level) read. A sprinkle the eye barely
sees soaked at the downpour's three a minute - Wet in ten minutes, Soaked in thirty-four - and the front holds a new
rain word dry until 55% of its arrival (three game minutes on a crossing, up to ninety-nine with the map off), soaking
all the while. AUDIT C&C T2 (2026-10-12) had just made the row three times what SURV1 read, so the gap showed.

CHANGED:

- **One truth.** `fallingWeather(shown)` answers what falls on the player - the street's word and level as the
  outdoor frame wrote them for the ear (`setHeardWeather`, the front's `soundWeather` and intensity; the classic sky's
  word at 1) - and after a jump, or before the first frame, the host's own shown sky whole (world.js's: the Sun Baby's
  clear day, AUDIT TEMP-UI E11).
- **The soak.** `weatherWetGain` scales a rain, storm or snow row by the level (`fall`); fog is not falling and stays
  whole. `feltTemperature` soaks on `env.falling` and keeps the sky's word for the air and the sun. Both open-world
  hosts hand `falling`; a road the clock jumped over clears it with the weather (AUDIT C&C H3's fair sky).
- **The account Worker's filter.** temperature.js is in the account Worker's bundle, so `src/world/weather.js` (the one
  law of which words fall, `precipitationForWeather`) joins `.github/workflows/account-deploy.yml`'s paths
  (`accountdeploy.test.js` ACC1-CI walks the bundle). Nothing the service runs changes.
- **A departure from the mod**, recorded in `06-Systems/Climates-Calories.md`: Climates.cs Weather() soaks by the
  word, as DFU's weather has no level. The classic sky keeps the mod's whole row.

THE FOUR HOSTS: world.js and exterior.js - WIRED; worldModes.js (interiors) and dungeonContext.js soak nothing (a roof,
a dungeon: `weatherWetGain` answers 0 before the row). Pinned by `test/systems/survival/fb1015f_wetfall.test.js` (7, one over the
real front's frames into the minute law); `tools/mutants/fb1015f_wetfall.json` (10, all dead).

What the reporter is owed: you get wet only when rain is actually falling on you, and a light shower soaks you slowly.
