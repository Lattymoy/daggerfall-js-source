# AUDIT TAMRIEL-WIDE - the integrated tree read cold, and the rule for what comes next (2026-10-28)

The owner, the day PR #1184 merged: *"With the new tamriel integrated, I want to do an audit on anything that could be
broken and ensure pur future development isnt just Daggerfall anymore and is the entirety of tamriel"*.

Two halves. The audit reads main at `41804bd39` (#1184 merged as `1e18a8f64`, and the day's fixes after it) for what
is broken. The rule makes new work answer for all of Tamriel, and a test holds it (TAMRIEL-WIDE, below).

**Status: DONE (2026-10-29).** Twenty-seven findings, each reproduced by its lane and verified again against the tree
before it was fixed: 23 fixed, one stands, one open, and two the owner's calls (below).

## The baseline

Run on the audited head with the freeware data (`/home/claude/dfdata/arena2`): `npm run lint` clean, `npm run types`
clean, `npm run build` clean. The whole suite in one shard is recorded under "The suite" once it ends.

Two checks fail with ARENA2 and pass without it, so CI never sees them:
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
| A1 | MEDIUM | An Imperial City house's yard lot was its door's box grown 6 m (a fabric house's one model is its door): the owner's own rooms, the neighbours' and the street | FIXED - a terraced house has no yard (`scenes/homeYards.js` lotOfFrame, the frame marked at the build) |
| A2 | LOW | The capitals' yard bounds read the Imperial City's blocks off BLOCKS.BSA, which holds none of them: the test guarded nothing, the record's 23 and 794 were 0s | FIXED - counted as served; the record corrected (`11-Multiplayer/Yard-Cells.md`); HOME_TOWN_MAX's margin left open |
| B1 | MEDIUM | SD-PARTY's one life and one win a Hollow kept nothing in a province's Hollow: the hub read the Bay lane's record | FIXED - the hub reads the slot's lane (`server/src/sdCopy.js`; `11-Multiplayer/Super-Dungeons.md`), world280 |
| B2 | MEDIUM | Staff `/tp @player` refused a player in an Ocean Hole's abyss past the Bay (its pit bounded to 0..999) | FIXED - the pit bounded by `worldPixelOk` (`net/staffTeleport.js`; `03-World/Ocean-Holes.md`), world280 |
| B3 = C3 | MEDIUM | Two dungeons past the Bay shared one dungeon-vein identity (`mapId & 0xfffff`): an Eltheric ruin and a lair, two abysses | FIXED - a place the port made keys by its whole id (`scenes/dungeonIdentity.js`; `06-Systems/Professions-Arc.md`), acct209 |
| B4 = C7 | LOW | Staff `/tp x y`, `/tp <place>` and the staff flat map knew the Bay's grid alone | FIXED - the world's grid and the registry (`scenes/staffTp.js`; `06-Systems/Online-Arc.md`); the relay's own copy waits for its next version |
| B5 | LOW | The hub's cleansed raids list held 64, two days of the Bay's raids; the world's lanes roll some 300 | FIXED - two days of every lane's slots, 576 (`net/wire.js` RAID_CLEANS_MAX; `03-World/Raiding-Parties.md`), world280 |
| B6 | - | The house cap (HOUSES-3) is three a region, and past the Bay a region is a province | THE OWNER'S CALL |
| C1 | MEDIUM | No raid past the Bay was told: the raid host's region was -1 there (`politicClaimed`, the Bay's 62) | FIXED - a province's politic is its region's |
| C2 | MEDIUM | Camps, bounty farms and trail spots stood on roads past the Bay: ROADS-CLEAR asked the Bay's pixels alone | FIXED - the curves' band past the Bay (`world/road/roadBand.js` nearRoad) |
| C4 = B7 | LOW | A province's Hollow was rumoured at (0,0), its city's MapId read as a Bay pixel | FIXED - the registry place's own pixel |
| C5 | LOW | A Travel Options resume past the Bay read every pixel there as sea, so it never skipped ahead | FIXED - the host's own sea (`tvWater`) |
| C6 | LOW | Map Backgrounds gave the race's backdrop in every town, dungeon and graveyard past the Bay | FIXED - a DEPARTURE, `Port-Ledger.md` section A |
| C8 | LOW | A harbour past the Bay is sounded later than the Bay's (`dryPixel` answers the Bay alone) | STANDS - a delay, never a wrong berth; making it answer past the Bay needs the kernel's lower bound proven under the relief and the towns' eases |
| D1 | HIGH | The Features rows said the continent holds no towns, roads or dungeons and cannot be travelled | FIXED - what stands there, in every language; since TRAVEL-EVERYWHERE the map's note says a journey reaches it. Whether `tamriel-land` is forced on online is THE OWNER'S CALL |
| D2 | MEDIUM | The held map inked and named every dungeon past the Bay before it was found | FIXED - known as the Overworld knows a place (`03-World/Arena-Provinces.md` TESA13) |
| D3 | MEDIUM | The held map past the Bay was titled "The Bay", every hover "(beyond the Bay)" | FIXED - titled Tamriel where it shows the continent; a hover names the province (`ui/map/mapStrip.js` sheetTitle, `ui/tamrielInk.js`) |
| D4 | LOW | The death screen named the Iliac Bay wherever one died | FIXED - the two lines name no place |
| D5 | LOW | Two help pages told the Bay's limits as the world's | FIXED - the arena page names its one city; the travel page's own line is true again since TRAVEL-EVERYWHERE |
| D6 | LOW | Flavour lines named the Bay where the player can be anywhere | FIXED - true wherever the player stands; the live events' own words (rocket, sunbaby) THE OWNER'S CALL |
| D7 | LOW | Cyrodiil is the Imperial Province on some screens, Sumurset Summerset on others | THE OWNER'S CALL - one name each |
| D8 | LOW | `start2_provinces.test.js` composed the climate alone, so every start lair read region 0 | FIXED - composed as `world.js` composes it, each province's start lair pinned to its region |
| E1 | MEDIUM | WILD-CITY-PORT read a teleport's landing by its pixel: a Mark beside a village's walls landed in Cyrodiil's open country | FIXED - the landing's own point (`11-Multiplayer/Wild-Zone.md` section 28) |
| E2 | LOW | A person by a province's border took the people where the player stood when first drawn | FIXED - where they stand (`characters/provinceFolk.js` nativeAt) |
| E3 | MEDIUM | The sea serpent's site moved with every lane added (index modulo the list), the Bay's days too; the site word carries no version | FIXED - a lane scored by its two ends, and the word carries its law (`11-Multiplayer/Sea-Serpent.md` section 18), world280 |
| E4 | LOW | An Imperial City home is keyed by its generator's plot order, which no stamp holds | OPEN - a fabric-law version on a home record, for the day the generator changes |
| E5 | LOW | The line keeping a yard placed again off a port's places had no pin that failed without it | FIXED - pinned (`test/world/fb1028_walls.test.js`) |

Every fix's pins are in `test/world/worldWide/audit_tamrielwide.test.js` and its `_relay`, `_account` and `_text`
siblings, or in its system's own tests. Its mutants are in `tools/mutants/audit_tamrielwide.json` and the three
siblings, every one dead (the D-test mutant with the freeware data alone, as its pin is the freeware's).

**After main's merge (2026-10-29).** TRAVEL-EVERYWHERE (#1390) retired TESA-NO-FAST while this audit ran, so D1's map
note ("not by fast travel") and D5's travel line ("Past the Bay, you go there on the Overworld") were false on the
merge. The note now says a journey reaches a place past the Bay, in every language; the travel page keeps main's own
line, true again. E1's bank cabin pin gained the producer's `campToWire` and asserts the landing.

## Deploy order

The account service first (acct209: an older service refuses a dungeon's whole id), then the relay (world280: the
hub's lane keys, the abyss bound, the cleanses list, the serpent's site law), then the site.

## Left for the owner, and open

- **B6** - three houses a region, and past the Bay a region is a province: a cap per province, or a cap per region of
  its own?
- **D1** - whether `tamriel-land` is forced on online, or stays each player's setting.
- **D6** - the live events' own words (`rocket.rise`, `rocket.lull`, `rocket.frenzy`, `sunbabySky.js`) name the Bay.
- **D7** - one name each: Cyrodiil or the Imperial Province, Summerset or Sumurset.
- **E4** (open) - a fabric-law version on an Imperial City home record, for the day its generator changes.
- `HOME_TOWN_MAX`'s margin: an Imperial City slice holds up to 3,487 buildings and 2,773 houses.
- `net/staffCommands.js`, in the relay's bundle, shows the Bay's bound until the relay's next version.

## TAMRIEL-WIDE - the rule

`../Port-Doctrine.md` "The whole of Tamriel", `../../Home.md` THE WORLD IS TAMRIEL, and `CLAUDE.md` carry it. The
pull request template asks where a change works past the Bay.

`tools/tamrielWide.mjs` counts six idioms in code lines (comments are not counted), a file at a time, in `src/`,
`server/src/` and `server-account/src/` - lane C's sweep, the families whose hits were Bay-only code and almost never
anything else:

| Idiom | Matches | The world's way |
|---|---|---|
| `pixel-id` | `py * 1000 + px` and its spellings | `worldPixelKey` |
| `pixel-mask` | `mapId & 0xfffff`, a MapId's low 20 bits as an identity (C3, C4) | `discoveryKeyOf` |
| `region-count` | a bound by MAPS.BSA's `regionCount`, a loop's or a check's | the `worldPlaces` registry |
| `bay-bound` | a pixel compared with 1000, 999, 500 or 499 (C5, C8) | `worldPixelOk`, or `inBay` for the Bay's own data |
| `bay-clamp` | a pixel clamped into the Bay (C2) | the world's grid, `inWorldGrid` |
| `region-62` | a region compared with 61 or 62 | `BAY_REGION_COUNT`, `theatreOfRegion` |

`test/tooling/tamrielwide.test.js` holds the tree to `tools/tamrielWideBaseline.json`, which only goes down. A line
that reads the Bay's own data on purpose carries a `BAY-OWN:` comment, on it or the line above, and is not counted.
