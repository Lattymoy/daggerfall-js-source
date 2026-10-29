# AUDIT TAMRIEL-WIDE - the integrated tree read cold, and the rule for what comes next (2026-10-28)

The owner, the day PR #1184 merged: *"With the new tamriel integrated, I want to do an audit on anything that could be
broken and ensure pur future development isnt just Daggerfall anymore and is the entirety of tamriel"*.

Two halves. The audit reads main at `41804bd39` (#1184 merged as `1e18a8f64`, and the day's fixes after it) for what
is broken. The rule makes new work answer for all of Tamriel, and a test holds it (TAMRIEL-WIDE, below).

**Status: DONE (2026-10-29).** Twenty-seven findings, each reproduced by its lane and verified again against the tree
before it was fixed: 23 fixed, one stands, one open, and two the owner's calls (below). The PR itself was then read cold
(AUDIT TAMRIEL-WIDE II, at the end): 25 findings, 21 fixed and 4 recorded. Read cold a third time on the integrated
tree (AUDIT TAMRIEL-WIDE III, after it): 15 findings, all fixed.

## The baseline

Run on the audited head with the freeware data (`/home/claude/dfdata/arena2`): `npm run lint` clean, `npm run types`
clean, `npm run build` clean. The whole suite is under "The suite" below.

Three checks fail with ARENA2 and pass without it, so CI never sees them. The third is
`test/world/fb1009_yardfoot.test.js` test 6 (II W5), which fails the same on main `7e6e0af86`; with ARENA2 set,
`tools/mutate.mjs` reads a record naming that file as "its tests fail unmutated". The first two:
`test/formats/worldData/it1_worlddata.test.js` "IT1 with ARENA2_PATH" and `test/formats/worldData/wd1_worlddata.test.js`
"WD1 with ARENA2". Both are the Immersive Travel gate patch `WALLAA08.RMB.json`, which rebuilds to sha256 `5491ffb9...`
where the patch records `a4c5443d...`. It fails the same way at `ca4484772` (the merge that added the test) and at
`edd55fa0c` (main before #1184), so it is not Tamriel's. Field Bugs 2026-10-20h and Quest Audit III recorded it before.
The patch was built without a BLOCKS.BSA (`vendor/immersive-travel/README.md`), and settling it needs the author's
bundle: `node tools/immersiveTravelPatches.mjs <dfmod> <arena2>`. In play the loader warns and serves the rebuild.

## How it was run

Five cold lanes, each reading a frozen worktree of the audited head, told to reproduce a finding before reporting it
and to check the earlier audits first (`Audit-Left-In-The-Bay.md`, `../Audit-TESA.md`, `../../03-World/World-Wide.md`).

| Lane | Over |
|---|---|
| A | the features main merged beside #1184, written for the Bay: the yards, homes, health, remains, saves, the first-visit cache, the snow worker, the cover index, the Abyss parties, the shop |
| B | the wire, the relay, the account service and the saves: every bound and key of a pixel, region, place or map id |
| C | a sweep of `src/` for the Bay-only idioms, a verdict on every hit, and the signal for a gate |
| D | what the player sees and does: text in 13 languages, the maps, quests and the starts, names |
| E | the Tamriel fixes after the merge: FB1028, PROVINCE-FOLK, SEA-SQUARE, COAST-PORT, the Overworld's walks, the homes |

## The findings

Ids are the lanes' own; two lanes that found one thing share a row. HIGH: a player past the Bay sees something broken or
loses data; MEDIUM: wrong in a corner a player reaches; LOW: the record, a cost, a word.

| Id | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | MEDIUM | An Imperial City house's yard lot was its door's box grown 6 m (a fabric house's one model is its door): the owner's own rooms, the neighbours' and the street | FIXED - a terraced house's lot is its door's own box, where nothing places (`scenes/homeYards.js` lotOfFrame, the frame marked at the build); what stood is taken back from the door (II W1) |
| A2 | LOW | The capitals' yard bounds read the Imperial City's blocks off BLOCKS.BSA, which holds none of them: the test guarded nothing, the record's 23 and 794 were 0s | FIXED - counted as served; the record corrected (`11-Multiplayer/Yard-Cells.md`); HOME_TOWN_MAX's margin left open |
| B1 | MEDIUM | SD-PARTY's one life and one win a Hollow kept nothing in a province's Hollow: the hub read the Bay lane's record | FIXED - the hub reads the slot's lane (`server/src/sdCopy.js`; `11-Multiplayer/Super-Dungeons.md`), world284 |
| B2 | MEDIUM | Staff `/tp @player` refused a player in an Ocean Hole's abyss past the Bay (its pit bounded to 0..999) | FIXED - the pit bounded by `worldPixelOk` (`net/staffTeleport.js`; `03-World/Ocean-Holes.md`), world284 |
| B3 = C3 | MEDIUM | Two dungeons past the Bay shared one dungeon-vein identity (`mapId & 0xfffff`): an Eltheric ruin and a lair, two abysses | FIXED - a place the port made keys by its whole id (`scenes/dungeonIdentity.js`; `06-Systems/Professions-Arc.md`), acct217 |
| B4 = C7 | LOW | Staff `/tp x y`, `/tp <place>` and the staff flat map knew the Bay's grid alone | FIXED - the world's grid and the registry (`scenes/staffTp.js`; `06-Systems/Online-Arc.md`); folding the relay's own copy back is a cleanup (II A5) |
| B5 | LOW | The hub's cleansed raids list held 64, two days of the Bay's raids; the world's lanes roll some 300 | FIXED - two days of every lane's slots, 576 (`net/wire.js` RAID_CLEANS_MAX; `03-World/Raiding-Parties.md`), world284 |
| B6 | - | The house cap (HOUSES-3) is three a region, and past the Bay a region is a province | THE OWNER'S CALL |
| C1 | MEDIUM | No raid past the Bay was told: the raid host's region was -1 there (`politicClaimed`, the Bay's 62) | FIXED - a province's politic is its region's |
| C2 | MEDIUM | Camps, bounty farms and trail spots stood on roads past the Bay: ROADS-CLEAR asked the Bay's pixels alone | FIXED - the curves' band past the Bay (`world/road/roadBand.js` nearRoad) |
| C4 = B7 | LOW | A province's Hollow was rumoured at (0,0), its city's MapId read as a Bay pixel | FIXED - the registry place's own pixel |
| C5 | LOW | A Travel Options resume past the Bay read every pixel there as sea, so it never skipped ahead | FIXED - the host's own sea (`tvWater`) |
| C6 | LOW | Map Backgrounds gave the race's backdrop in every town, dungeon and graveyard past the Bay | FIXED - a DEPARTURE, `Port-Ledger.md` section A |
| C8 | LOW | A harbour past the Bay is sounded later than the Bay's (`dryPixel` answers the Bay alone) | STANDS - a delay, never a wrong berth; making it answer past the Bay needs the kernel's lower bound proven under the relief and the towns' eases |
| D1 | HIGH | The Features rows said the continent holds no towns, roads or dungeons and cannot be travelled | FIXED - what stands there, in every language; since TRAVEL-EVERYWHERE the map's note says fast travel reaches it with the land on (II). Whether `tamriel-land` is forced on online is THE OWNER'S CALL |
| D2 | MEDIUM | The held map inked and named every dungeon past the Bay before it was found | FIXED - known as the Overworld knows a place (`03-World/Arena-Provinces.md` TESA13) |
| D3 | MEDIUM | The held map past the Bay was titled "The Bay", every hover "(beyond the Bay)" | FIXED - titled Tamriel where it shows the continent; a hover names the province (`ui/map/mapStrip.js` sheetTitle, `ui/tamrielInk.js`) |
| D4 | LOW | The death screen named the Iliac Bay wherever one died | FIXED - the two lines name no place |
| D5 | LOW | Two help pages told the Bay's limits as the world's | FIXED - the arena page names both arenas, the Imperial City's too (II T1); the travel page's own line is true again since TRAVEL-EVERYWHERE |
| D6 | LOW | Flavour lines named the Bay where the player can be anywhere | FIXED - true wherever the player stands; the live events' own words (rocket, sunbaby) THE OWNER'S CALL |
| D7 | LOW | Cyrodiil is the Imperial Province on some screens, Sumurset Summerset on others | THE OWNER'S CALL - one name each |
| D8 | LOW | `start2_provinces.test.js` composed the climate alone, so every start lair read region 0 | FIXED - composed as `world.js` composes it, each province's start lair pinned to its region |
| E1 | MEDIUM | WILD-CITY-PORT read a teleport's landing by its pixel: a Mark beside a village's walls landed in Cyrodiil's open country | FIXED - the landing's own point (`11-Multiplayer/Wild-Zone.md` section 28) |
| E2 | LOW | A person by a province's border took the people where the player stood when first drawn | FIXED - where they stand (`characters/provinceFolk.js` nativeAt), a yard's figures too (II W2) |
| E3 | MEDIUM | The sea serpent's site moved with every lane added (index modulo the list), the Bay's days too; the site word carries no version | FIXED - a lane scored by its two ends, and the word carries its law (`11-Multiplayer/Sea-Serpent.md` section 18), world284 |
| E4 | LOW | An Imperial City home is keyed by its generator's plot order, which no stamp holds | OPEN - a fabric-law version on a home record, for the day the generator changes |
| E5 | LOW | The line keeping a yard placed again off a port's places had no pin that failed without it | FIXED - pinned (`test/world/fb1028_walls.test.js`) |

Every fix's pins are in `test/world/worldWide/audit_tamrielwide.test.js` and its `_relay`, `_account` and `_text`
siblings, or in its system's own tests. Its mutants are in `tools/mutants/audit_tamrielwide.json` and the three
siblings, every one dead (the D-test mutant with the freeware data alone, as its pin is the freeware's).

**After main's merge (2026-10-29).** TRAVEL-EVERYWHERE (#1390) retired TESA-NO-FAST while this audit ran, so D1's map
note ("not by fast travel") and D5's travel line ("Past the Bay, you go there on the Overworld") were false on the
merge. The note now says fast travel reaches the land past the Bay with the land on, in every language; the travel
page keeps main's own line, true again. E1's bank cabin pin gained the producer's `campToWire` and asserts the landing.
ARMORY (#1392), LODE-HERD (#1394), KEEP-MARK (#1395) and SHED-REPLICA (#1398) took world280 and acct209 to acct212, so this PR held world281 and acct213.

**The last two merges of main (`bcd8ba2a6`, `beb8d8ac8`, 2026-10-29).** By the first, OVERLOAD-EASE 2 (#1405), the PvP
rework (#1389), its follow-up (#1407) and OVERLOAD-EASE 3 (#1413) had taken world281, world282 and acct213 to acct216,
so this PR held world283 and acct217. PVP-SAFE-HIT (#1414) took world283 by the second, so this PR ships world284 and
acct217, and `SERPENT_SITE_RELAY_MIN` moved to 284 with it (II R2). The two resolved 82 and 46 conflicted files.

## The suite

The whole suite with ARENA2, on `0d0446bb8` (before the last merges of main), ran 24,944 tests before its hour ran
out. Beside the three ARENA2 checks above it failed MEND-TIERS (main's, fixed by #1393), FT15 (the Features budget,
set at the merge) and four that pass alone and on main under the same load (`staffmap_e2e`, `rescuesave`,
`audit28_notice`, `staffpanel5message_client`). CI's eight shards ran the rest without ARENA2. `staffpanel1`'s signed
second fails on a second boundary (301 s signed, the service's clock a second later), not this PR's code.

## Deploy order

The relay (world284: the hub's lane keys, the abyss bound, the cleanses list, the serpent's site law), then the account
service (acct217: an older one refuses a dungeon's whole id), then the site - the order the deploys run, as
`account-deploy.yml` waits for the relay's version (II R3). C3 needs only the account before the site.

The desktop release (`release-desktop.yml`) waits on `verify` alone, so it can reach players before the relay and the
service (`Audit-Release-R3.md` step 5). Then a new build says no abyss pit past the Bay to an older hub (III M1), and an
older service refuses C3's whole dungeon id until it deploys: "There is nothing here to gather." for a vein past the Bay.

## Left for the owner, and open

- **B6** - three houses a region, and past the Bay a region is a province: a cap per province, or a cap per region of
  its own?
- **D1** - whether `tamriel-land` is forced on online, or stays each player's setting.
- **D6** - the live events' own words (`rocket.rise`, `rocket.lull`, `rocket.frenzy`, `sunbabySky.js`) name the Bay.
- **D7** - one name each: Cyrodiil or the Imperial Province, Summerset or Sumurset.
- **E4** (open) - a fabric-law version on an Imperial City home record, for the day its generator changes.
- `HOME_TOWN_MAX`'s margin: an Imperial City slice holds up to 3,487 buildings and 2,773 houses.
- `net/staffCommands.js`, in the relay's bundle, still states the Bay's bound; folding `scenes/staffTp.js` back into it
  is a cleanup now, as this PR ships world284 anyway (II A5).
- The audit's second round records four (II, below): W4's cost, a small settlement's dungeon anchor, an old tab's veins
  and the hover's kind words. W1's note leaves the service's missing lot law.

## TAMRIEL-WIDE - the rule

`../Port-Doctrine.md` "The whole of Tamriel", `../../Home.md` THE WORLD IS TAMRIEL, and `CLAUDE.md` carry it. The
pull request template asks where a change works past the Bay.

`tools/tamrielWide.mjs` counts six idioms in code lines (comments are not counted), a file at a time, in `src/`,
`server/src/` and `server-account/src/` - lane C's sweep. A count is a pattern, not a verdict: the baseline holds
Bay-only code beside the Bay's own readers (the road network and terrain on the Bay's grid) and the port's own id
lanes' decoders, which a fix or a marker lowers (II T3). The idioms, in their spellings (II T2: bracketed, reversed, a
named width such as `MAP_WIDTH`, a padded mask):

| Idiom | Matches | The world's way |
|---|---|---|
| `pixel-id` | `py * 1000 + px`, `px + 1000 * py`, `py * MAP_WIDTH + px` | `worldPixelKey` |
| `pixel-mask` | `mapId & 0xfffff` or `0x000fffff` or `% 0x100000`, a MapId's low 20 bits (C3, C4) | `discoveryKeyOf` |
| `region-count` | a bound by MAPS.BSA's `regionCount`, a loop's or a check's | the `worldPlaces` registry |
| `bay-bound` | a pixel against 1000, 999, 500, 499 or `MAP_WIDTH` and its kin, either way round - not a difference (C5, C8) | `worldPixelOk`, or `inBay` for the Bay's own data |
| `bay-clamp` | a pixel clamped into the Bay, `Math.min(px, 999)` too (C2) | the world's grid, `inWorldGrid` |
| `region-62` | a region (`region`, `r`) against 61 or 62 | `BAY_REGION_COUNT`, `theatreOfRegion` |

`test/tooling/tamrielwide.test.js` holds the tree to `tools/tamrielWideBaseline.json`, which only goes down. A line
that reads the Bay's own data on purpose carries a `BAY-OWN:` comment with its why, on it or on a comment line just
above, and is not counted; a marker in a string, a bare one, or a code line's reaching the line below is none (II T4).
The wider spellings measured the baseline once more, 65 lines to 120 in 44 files; the Bay's own readers marked
(`mapsFile.js`, `woodsFile.js`, `inBay`, `bayMapPixel`, `discoveryKeyOf`) left it.

## AUDIT TAMRIEL-WIDE II - the PR read cold (2026-10-29)

The owner, of this PR: *"Audit this"*. Four cold lanes read a frozen worktree of its head (`e7b4db860`): R the relay
and the wire, A the account service and the staff tools, W the client's world fixes, T the text, the gate and the
records. Each reproduced a finding before reporting it, and each was verified again before its fix.

| Id | Sev | Finding | Verdict |
|---|---|---|---|
| W1 | MEDIUM | A1 left the pieces an owner set down by an Imperial City house drawn, and its decorator never opened to take them back | FIXED - the lot is the door's own box: nothing places, the owner at the door opens it |
| T1 | MEDIUM | D5's arena page named one arena; IC-GRAND lays one in the Imperial City's Arena District too | FIXED - both named, as TUT1 allows |
| T2 | MEDIUM | The gate missed spellings of its own idioms: a padded mask (six real lines), `MAP_WIDTH` bounds, reversed and bracketed forms | FIXED - the spellings read, the baseline measured again |
| T- | LOW | The map's note promised fast travel past the Bay with the land off | FIXED - "with Land beyond the Bay on", in every language |
| T3 | LOW | The baseline counted a time, a height, `discoveryKeyOf` and the Bay's own readers as Bay-only code | FIXED - a difference uncounted, the readers marked, the record says what a count is |
| T4 | LOW | A code line's marker reached the line below; a bare marker, or one in a string, counted | FIXED |
| T5 | LOW | Danish and Norwegian raid rows said "merge with the town guard" | FIXED |
| T6 | LOW | The hover's kind word (`farm`, `city-state`) is English in every language | RECORDED - the port's location-type words, shared with the quests' text, an L10N item of their own |
| T7 | LOW | A patch note credited the fix with the hover's province name, which it had before | FIXED in the PR's notes |
| R1 | LOW | A build before world284 reads 64 cleanses, and the hub kept them oldest first: today's lost on release day | FIXED - the hello newest first |
| R2 | LOW | A new build said its serpent site to any relay from world166, which folds it into the old law's vote | FIXED - `SERPENT_SITE_RELAY_MIN` 284 (281, then 283, until the merges of main moved it) |
| R3 = A6 | LOW | This page gave the deploy order as account, relay, site; the deploys run relay, account, site | FIXED - the order above |
| R4 | LOW | Until two new builds name a site, a serpent day's kill is not posted, which no record said | FIXED - recorded (`Sea-Serpent.md` section 11) |
| R5 | LOW | Two mutants on the serpent's lane score survived: one port keyed twice, the tries unbounded | FIXED - pinned |
| A1 | LOW | No pin parsed a ten-digit vein key, and every abyss past the Bay has one | FIXED - pinned |
| A2 | LOW | An old tab keys a dungeon past the Bay by its low 20 bits until it reloads | RECORDED - `Professions-Arc.md` C3; the service cannot tell that id from a Bay one |
| A3 | LOW | The staff flat map's box fell a pixel short of its margin on Sumurset Isle and Cyrodiil | FIXED - the coarse step grown in full |
| A4 | LOW | The flat map's box cache keyed by the fit had no pin | FIXED - pinned |
| A5 | LOW | The staff help said `/tp <place>` finds a place anywhere; the record kept `staffCommands.js` for a relay release this PR makes | FIXED - the line says what it reaches; the fold left a cleanup |
| W2 | LOW | E2 missed a yard's figures (`decorRoom.js` offerDecorFigures) | FIXED - their feet passed |
| W3 | LOW | The host's half of E2 for the townspeople had no pin | FIXED - pinned |
| W4 | LOW | Any find, a Bay one too, stamps every tile past the Bay again | RECORDED - one repaint at the next view; a stamp of the past-Bay finds alone needs every place's id keyed past the Bay, which W6 shows is not held |
| W5 | LOW | This page promised "The suite" and named two ARENA2 failures of three | FIXED |
| W6 | LOW | D2's pin found an id that keys as a Bay pixel, never a real lair's | FIXED - a real lair's whole id |
| W- | LOW | A Mark in a dungeon of a settlement of 4 x 4 blocks or fewer reads as outside it (E1 at the anchor's corner) | RECORDED - no such dungeon stands today; a trap for one |

The pins are in the four `audit_tamrielwide*.test.js` files and `test/tooling/tamrielwide.test.js`, the mutants in
their lists - every one dead. The service has no yard lot law of its own, so an older client can still place by a
terraced house (W1); that is the service's to hold, as it was before A1.

## AUDIT TAMRIEL-WIDE III - the integrated tree read cold (2026-10-29)

The owner, of this PR: *"Pick up this PR and audit it"*. Main had merged twelve pull requests under it - the PvP rework,
its follow-ups, the guards, the safe streets, STAFF-PULL, the overload and perf fixes - and two merges of main had
renumbered its releases. Four cold lanes read a frozen worktree of its head (`beb8d8ac8`): M the merges, P main's PvP
and staff work against the rule, F the PR's own fixes and patch notes on the integrated tree, T the text and the
records. Each reproduced a finding before reporting it, and each was verified again before its fix; V1 was found in that
verification. Five of the fifteen are main's code read under this PR's rule (F1, P2, P3, P4, T8).

| Id | Sev | Finding | Verdict |
|---|---|---|---|
| F1 | HIGH | Unflagged, a Portal Stone into or out of Cyrodiil's open country was spent, then refused: the stone asked the zone by PVP-FLAG, and `teleportTo` asked again without it | FIXED - the arrival tells `teleportTo` the zone was asked (`zoneFree`) |
| M1 | MEDIUM | A new build sent an abyss pit past the Bay (B2) to a hub before world284, which refuses the frame and closes the socket - a desktop build can meet one | FIXED - `STAFF_ABYSS_WORLD_RELAY_MIN` 284: the answer says `unavailable`, no pull goes |
| P1 | MEDIUM | The device kept one copy of a Hollow for every theatre: a province's Hollow forgot the Bay's, and a party split | FIXED - one kept copy a lane (`sdCopyKeyOf`), the Bay's under its old key |
| P2 | MEDIUM | PVP-EDGE read a building's door in the zone as a walk over its edge: a shop left in Cyrodiil granted a minute's safe passage | FIXED - the edge reads the zone's pixel alone |
| T8 | MEDIUM | The level-30 warning named "the sea" a PvP zone; only the open Eltheric Ocean past Veilhaven is one | FIXED - "(Cyrodiil, the open Eltheric Ocean)", the owner's other words kept, every language drafted again |
| V1 | MEDIUM | Staff `/tp` blacked the screen and left it black when `teleportTo` refused - a pixel of Cyrodiil's open country, which B4/C7 now reaches | FIXED - the refusal lifts it (`bootWorld` +1, its ceiling with it) |
| F2 | LOW | C6's patch note held only with Map Backgrounds on, which ships off | FIXED in the PR's notes |
| F3 | LOW | The map's note promised fast travel to the land past the Bay; online, none crosses into or out of Cyrodiil | FIXED - the note says so, every language; the PR's notes too |
| F4 = M2 | LOW | E1's note and record said every teleport in the zone lands in a town's streets; an unflagged stone goes anywhere | FIXED - the notes and `Wild-Zone.md` name the stone |
| P3 = T13 | LOW | STAFF-PULL had no record of where `/tpa` reaches, and no pin past the Bay | FIXED - `Online-Arc.md`, a pull from Skyrim pinned |
| P4 | LOW | `PvP-Rework.md` kept "Orsinium waits" and "the streets say 0"; `zoneSafe.js` justified its kinds by MAPS.BSA, which Cyrodiil has no rows of | FIXED - Cyrodiil's countryside roll named |
| P5 = T9 | LOW | The gate missed `MAP_W`, `MAP_H`, `TP_MAP_W`, `TP_MAP_H` and a bound handed to a call (`ok(px, 999)`, `integer(x, 61)`) | FIXED - the spellings read, the baseline measured again: 161 lines in 55 files |
| T10 | LOW | Round II's tallies said 20 fixed and 5 recorded; its table holds 21 and 4 | FIXED |
| T11 = M3 | LOW | The records called the last two merges the second and third | FIXED - named by commit |
| T12 | LOW | `Online-Arc.md` and `Professions-Arc.md` gave the account pins' old counts | FIXED |

The pins are in `test/world/worldWide/audit_tamrielwide_iii.test.js` and `test/tooling/tamrielwide.test.js`, the
mutants in `tools/mutants/audit_tamrielwide_iii.json` (9) and `tamrielwide.json` (4 more) - every one dead, with the
eight records the fixes re-aimed. `audit18_bible_docs` reads `src/firstVisitPins.js`, a generated file main's
`Performance-Priority.md` names: it fails in a fresh worktree until that file is built, as on main.
