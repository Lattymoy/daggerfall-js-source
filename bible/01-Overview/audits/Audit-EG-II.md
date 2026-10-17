# AUDIT EG II - the Elite Gates design page, polished

Mac, 2026-10-11, of `11-Multiplayer/Elite-Gates.md` after AUDIT EG0 and the fragments (EG0b): *"Im really looking for
AAA grace quality when it comes to everything implemented. Do a detailed polish pass and audit"*.

## Method

The audit ran six cold lanes, each a separate reader, on a FROZEN snapshot of the page: commit 14b3b172f, copied to the
scratchpad before any lane started. No edit was made until every lane had returned (Home.md's 17l: *DO NOT FIX WHILE THE
VERIFIER IS READING*). Then every finding was verified by hand:

- a code claim, against the tree (the file and the symbol), at 14b3b172f;
- a number, by recomputing it: `deepIn` swept over bearings with the real function, the motor's carries, the floors,
  and a new pace model (`pace3`, below);
- a design proposal, by weighing it against Mac's own words, the page's hard constraints (the relay judges in 2D on
  flat fight floors; NOTHING GETS FASTER; no Daggerfall data ships; one to eight members), and the names already taken
  in `src/`.

| lane | reads | findings |
|---|---|---|
| 1. code truth | every claim about the shipped tree, about 240 checked | 25 (1 HIGH, 9 MEDIUM, 15 LOW) |
| 2. numbers and consistency | every formula and table recomputed; the pace, the motor's carries and `deepIn` simulated | 37 |
| 3. AAA game design | against Hades, FFXIV's deep dungeons, Mythic+, Torghast, Destiny, Elden Ring, Diablo IV, Risk of Rain 2, Deep Rock Galactic, Spelunky, Lost Ark | 44 |
| 4. architecture, performance, netcode and failure | the swap, the clock, the judge, the budgets; the collider, the mesh build and the reverb measured | 46 |
| 5. prose, structure and the bible's rules | clarity, the words, the slices, Home.md's rules, the doc tests | 90 |
| 6. presentation, feel and accessibility | readability, feedback, the HUD, the camera, the sound, the controls, the options | 40 |

There were **282 findings**, and a re-verification found 61 more (below). Verdicts:

- for a claim (lanes 1, 2, 4 and 5): **CONFIRMED** (true as stated), **PARTIAL** (true in substance, wrong in a detail,
  which is named), **REFUTED** (false);
- for a proposal (lanes 3 and 6, and the proposals inside the others): **ADOPTED**, **ADAPTED** (adopted with a change,
  which is named), **DECLINED** (with the reason).

None was refuted and none declined. Every resolution names the section of the polished page that carries it; the page
was renumbered once (the fragments became section 11), and the resolutions use the new numbers.

**`pace3`**, the model behind section 18, is AUDIT EG0's `pace.mjs` with the polished rules: the count runs only the
closing's first 15 s and holds from the pull to the wake; the Covenant's patience lets a Court finish, bounded by the
Weight (a Court that would outlast the count by more than 120 s is a wipe); the combined bucket is capped at 1.6. It
answers, from Hall 1: about 6 / 11 / 12 / 15 Redoubts for a company at reference, twice reference, the cap and the cap
with Vestiges; and a season's ceiling, starting each breach at the last one's deepest Redoubt, of about 16 / 39 / 57 /
88.

## Lane 1 - code truth

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L1-1 | HIGH | TEXTURE.356 does not draw emissive: `dataPipeline.js` skips `FIRE_WALLS_ARCHIVE` (DFU lights it through the unported `GetFireWallColors32`), pinned by audit39 | CONFIRMED (`emissiveTextures.js`, `dataPipeline.js` both upload arms) | 11.6: EG6b ports `GetFireWallColors32` and re-pins audit39; 25.8 |
| L1-2 | MED | `retireShare` is the absence law; the Remnant keeps a fallen body's share | CONFIRMED (`gateBrain.js`, `sdRemnant.js`) | 13.2: retiring at a fall is new; the seen-and-restore step skips the fallen |
| L1-3 | MED | `fbxMesh.mjs` feeds only the Morrowind lane's NIFs; the gate and ships bake through `shipBake.mjs` | CONFIRMED | 11.6: `fragBake.mjs`, EG6c |
| L1-4 | MED | the Jump spell restores air control; technique leaps fly their own arc | CONFIRMED (`motor.js` `enhancedJumping`, AUDIT 64 F2; `techniqueLaunch`) | 10.2 THE FAST BUILD; 10.4 the Drop's walls; 10.7 |
| L1-5 | MED | `perilAt`/`wayOut` are client code outside `RELAY_GRAPH` | CONFIRMED | 9: `net/eliteGates/egFloor.js`; 13.2 |
| L1-6 | MED | the court already draws several shapes a frame (host cap 8); a tether is a lane in the path pool | CONFIRMED (`gateHost.js` `HOST_SHAPES_MAX`, `HOST_PATH_HALF_W`) | 25.4 |
| L1-7 | MED | Stendarr's AvoidDeath is not refused and would cancel a fall | CONFIRMED (`guildServices.js` `avoidDeath`, `setAvoidDeathHook`) | 15 (death saves); 24; 28 |
| L1-8 | MED | a 3 m lane is counted only on its centre line | CONFIRMED (`deepIn`, `inAttack`'s `<= width/2`) | 11.7 THE WIDTH RULE at 4 m (with L2-2) |
| L1-9 | MED | the beacon's height, foot and colour are compiled in; `GATE_PASS_MAX` 2 | CONFIRMED (`gatePass.js`) | 6.3 |
| L1-10 | LOW | the Ghost-King's Vigil is a low-health heal, not a death save | CONFIRMED (`lootHurt`) | 15 (death saves) |
| L1-11 | LOW | natural regeneration is already off in the Hour | CONFIRMED (`world.js` SD5a) | 24's table; 8 |
| L1-12 | LOW | the lab's 38990 and the mods' 112358/112359/112395 are archives too | CONFIRMED | 11.6 the registry |
| L1-13 | LOW | `PORTAL_OPEN_MS` is in `portalStone.js`; the portal is `portalGates.js` | CONFIRMED | 6.4 |
| L1-14 | LOW | `_killedBy` is a peer id, null when the owner struck | CONFIRMED (`dungeonContext.js`) | 5 the dungeon's find |
| L1-15 | LOW | no arena-week helper exists | CONFIRMED (`arenaLaw.js`) | 19 `arenaWeekOf`; EG5 |
| L1-16 | LOW | the symbol is `BOSS_TTK_S` | CONFIRMED | 18 |
| L1-17 | LOW | the trials also carry `shieldMs`, `threatDecay`, `heal`, `feeds` | CONFIRMED (`gateMods.js`) | 14 the merge |
| L1-18 | LOW | any turner may turn any stone; the rights only hold back a lengthener | CONFIRMED (`orreryMayTurn`) | 8.4 |
| L1-19 | LOW | "Pendulum" is the Drift's `SD_PENDULUM` dressing in code | CONFIRMED | 10.3 `egPendulum` |
| L1-20 | LOW | `createSdSteps` and `sdStepsModel`'s builders read the course too | CONFIRMED | 10.1 |
| L1-21 | LOW | `shipBake.mjs` drops normals too | CONFIRMED | 11.6 |
| L1-22 | LOW | `realmLightsWith` sorts by distance outside reach; 48 is `EL_MAX_LIGHTS` | CONFIRMED | 11.9 |
| L1-23 | LOW | the judges are handed trails without y | CONFIRMED (`_trailOf`, `posAt`) | 11.7; EG3 |
| L1-24 | LOW | `RELAY_VERSION` is `world193` now | CONFIRMED | 23 |
| L1-25 | LOW | the trust-law column depends on `BOSS_TTK_S` | CONFIRMED | folded into L1-16 |

## Lane 2 - numbers and consistency

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L2-1 | HIGH | "the count alone stops a cap company around 20-32" ignores that each deeper start resets the count | CONFIRMED (lane 2's ratchet; `pace3` re-run) | 18: the season's ceiling, about 16 / 39 / 57 / 88 |
| L2-2 | HIGH | `deepIn` counts nothing in a 3 m lane laid on a probe bearing | CONFIRMED (re-swept: 3 m none at 0° and 45°; 4 m 1.0-1.2 m strip) | 11.7 THE WIDTH RULE at 4 m, floor 0.79 s; every lane widened |
| L2-3 | HIGH | the havens' wind-ups meet the 0.5 s slack, not the errand floor a CHECK carries | CONFIRMED | 13.3: 5.3 / 4.3 / 3.9 s; Grath's crack named as the wind-up floor's class |
| L2-4 | HIGH | a 1.2 m parapet stops no running jump; the Jump spell steers | CONFIRMED (carries 6.7-17.9 m) | 10.4: a landing 6 m deep walled to 7.5 m |
| L2-5 | HIGH | a crossing bound from the slowest build refuses every faster honest player | CONFIRMED | 10.5: the fast build less 15%, per road, a measure until EG21 |
| L2-6 | HIGH | the Deepway's four fragments break a three-fragment cap | CONFIRMED | 11.9: four a hall, the Low Road counted; 8.8 |
| L2-7 | MED | three fragments exceed the hall's triangles and the light cap | CONFIRMED | 11.9: 12,000 / 4 lights / 12 draws a fragment; 50,000 a hall; measured at EG6b |
| L2-8 | MED | the Riposte cone is under the width rule | CONFIRMED | 13.3: a cone of 5 m, 0.9 s |
| L2-9 | MED | "0.8 SIZE" either breaks the width rule or does nothing | CONFIRMED | 8.5: the body at 0.8, the shapes the Warden's, the Charge at 4 m |
| L2-10 | MED | the bucket's two caps multiply to 2.0 | CONFIRMED | 13.2, 15: `EG_BUCKET_ALL_MAX` 1.6; 18's clock column |
| L2-11 | MED | the quoted stops leave out four rules | CONFIRMED | 18: read as 5-7 / 10-11 / 12 / 14-15 |
| L2-12 | MED | the Yard's rifts scale with *n* | CONFIRMED | 8.1: 36 s together, split over the rifts |
| L2-13 | MED | "nothing shortens a period" is contradicted by the wave cadence and decrees | CONFIRMED | 8.1, 14, 18: a piece's timing; cadence is "more at once" |
| L2-14 | MED | two Bargains can land in one circle | CONFIRMED | 8.7: one a circle, none at five |
| L2-15 | MED | Reliquaries from re-taken Redoubts undo the weekly pay | CONFIRMED (5.1 Panoply pieces a week) | 16.3, 19 |
| L2-16 | MED | the fork's toll, heal, closing, Gold Run and crossing bound clash | CONFIRMED | 10.6 the toll by distance; 11.4 the fork; 8.2 |
| L2-17 | MED | the Deepway's closing, objective and count are undefined | CONFIRMED | 8.8 |
| L2-18 | MED | the Shade and the Forge Gut have no shaft | CONFIRMED | 11.2: the Hollow Trunk, the Slag Chute |
| L2-19 | MED | the Soul Tithe's bound holds only for an unfilled gem | CONFIRMED | 13.3 |
| L2-20 | MED | nine floors were rounded below the law | CONFIRMED | 12, 13: ceiled to 10 ms |
| L2-21 | MED | Active-Arcs said twelve lords and three season boards | CONFIRMED | the index lines |
| L2-22 | MED | Grath's narrow bridges have no width or class | CONFIRMED | 13.3: 6 m fight floors, no lane along them |
| L2-23 | LOW | the herald's 1:42:10 is faster than any modelled company | CONFIRMED | 20: 1:51:20 |
| L2-24 | LOW | the count table's game column held real times | CONFIRMED | 6.2: the phase and event tables split |
| L2-25 | LOW | "early circles bank time" is false at reference | CONFIRMED | 6.2 |
| L2-26 | LOW | the width record omitted the vents | CONFIRMED | 11.7 names every widened blow; EG0b's record |
| L2-27 | LOW | the legion cap's lower clamp never binds | CONFIRMED | 8.1, 18: `min(14, ...)`, said |
| L2-28 | LOW | `max(0.6 s, floor)` never binds | CONFIRMED | 13.2, 14: `max(1.0 s, floor + 0.3 s)` |
| L2-29 | LOW | fury turns before a reference company's kill | CONFIRMED | 13.2: `EG_FURY_RATIO` 1.5 |
| L2-30 | LOW | depth alone reaches the share cap at circle 18 | CONFIRMED | 13.2, 18: 2% a circle, the cap at 26 |
| L2-31 | LOW | two Challenges leave the brazier count unchanged | CONFIRMED | 13.3 |
| L2-32 | LOW | THE GOLD RUN is automatic for one | CONFIRMED | 8.2: a company of one is exempt |
| L2-33 | LOW | recast Colossal gives 8.4 m, not 8.5 | CONFIRMED | 14 |
| L2-34 | LOW | 24 shapes can be exceeded | CONFIRMED | 25.4 THE TELEGRAPH BUDGET |
| L2-35 | LOW | fragment hazards had no sizes; a Vent under a Drift is under 3 m | CONFIRMED | 11.2 sizes; 10.3, 10.5 |
| L2-36 | LOW | "past four" for decree ranks is ambiguous | CONFIRMED | 14: from circle 10 |
| L2-37 | LOW | EG20 omits the Vent and the elite add; the fork needs EG11's Lurkers | CONFIRMED | 31 |

## Lane 3 - AAA game design

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L3-1 | HIGH | every circle is nearly the same circle | ADAPTED: three variants each for the Yard and the Rampart, one more a band; the Holdfast's broken relic opens rifts rather than casting a CHECK | 7, 8.1, 8.3, 9 |
| L3-2 | HIGH | the four band climaxes rerun the gate's fight | ADOPTED | 13.4: grounds, two blows each, signatures, set-pieces, looks |
| L3-3 | HIGH | six lords have no phases | ADOPTED | 13.2 the beats; 13.3 phases for every lord |
| L3-4 | HIGH | Vestiges change numbers, not play | ADAPTED: "Overflow" is taken in code, so **Spillover** | 15: Masteries, Accords |
| L3-5 | HIGH | the fallen sit out with one thing to do | ADOPTED; still one recall a breach | 16.5: the Memento, niches, the witness's sight, pings, the vote |
| L3-6 | HIGH | the typical run ends by cutting off its own climax | ADOPTED, bounded by the Weight | 18 THE COVENANT'S PATIENCE |
| L3-7 | HIGH | keys are too scarce for a one-life mode | ADAPTED: the Valkynaz's key has its own weekly cap, not a raised find cap | 5: the pity, the first breach's mercy, the Valkynaz's key |
| L3-8 | HIGH | the solver allows 11.5 s queues | ADOPTED | 10.5: `EG_WAIT_MAX` 4 s, the median |
| L3-9 | HIGH | the weakest platformer bleeds every hall | ADOPTED | 10.6 the waiver; 8.2 the trail, Harriers, peers |
| L3-10 | HIGH | three fragments have no signature; one verb for six hazards | ADOPTED | 11.2 |
| L3-11 | HIGH | passages are corridors | ADOPTED | 11.3 the set-piece passages |
| L3-12 | HIGH | the first breach may show no fragment | ADOPTED | 7: the fixed first circle, a passage in every early span |
| L3-13 | HIGH | unlimited potions erase the attrition | ADAPTED: THE POTION LAW (the port's rest items already own "Draught"), and the Spire Tonic | 17.4, 17.1, 24 |
| L3-14 | HIGH | the best players see the least new content | ADAPTED: the Old Masters raise the two masters together, needing no new lord | 18: strata, the Wager |
| L3-15 | HIGH | the endless mode would launch as a loop of one band | ADOPTED | 13.3 THE SEAL; 20 |
| L3-16 | MED | the fork has no tension and is rare | ADAPTED: a fork at every span from circle 2; the niche heals 15% and holds a shard | 11.4 |
| L3-17 | MED | the fastest member meets the lord alone | ADAPTED: named the wake ring (`SD_THRESHOLD` is the Hour's) | 8.6 |
| L3-18 | MED | eight strangers cannot divide errands | ADOPTED | 6.1 numerals; 13.2 errands by numeral; 23 `mark` |
| L3-19 | MED | half the decrees are invisible and none chosen | ADAPTED: Legion's Tithe and Rift-Torn replaced; the count's two kept as the Covenant family and made visible | 14 |
| L3-20 | MED | company choices have no rule | ADOPTED | 16.4 the company's word |
| L3-21 | MED | rewards come once every five halls | ADOPTED | 17.1 caches, shards |
| L3-22 | MED | no run-only consumables or currency | ADOPTED | 17.2, 17.3 |
| L3-23 | MED | the Proving champion is one bag for eight | ADOPTED | 8.5 |
| L3-24 | MED | the Scent outruns slow builds | ADOPTED | 13.3: 5.2 m/s, the Maul, Scorched |
| L3-25 | MED | eight do not fit the Rampart or the Athenaeum | ADOPTED | 8.3 width, bastions; 8.4 |
| L3-26 | MED | chambers are discs inside walls | ADOPTED | 11.4 `play` |
| L3-27 | MED | nothing in a hall can be used | ADOPTED | 11.10 engines |
| L3-28 | MED | the lore never reaches play | ADOPTED | 11.10 alcoves, the Annals, vignettes; 3 |
| L3-29 | MED | the count penalises big companies | ADOPTED | 6.2 the closing's hold |
| L3-30 | MED | no breaks for 100 minutes | ADOPTED | 6.2 the respite budget |
| L3-31 | MED | an affix named for speed | ADOPTED | 8.7 Unshaken; numbers for all four |
| L3-32 | MED | nothing serves a healer | ADOPTED | 15 Mender's Grace, Lifeline, the Healed column |
| L3-33 | MED | onboarding is a four-line card | ADOPTED | 27.7: first-time lines, the Rehearsal; 27.3 the objective |
| L3-34 | MED | no lord has a chase of its own | ADAPTED: the named piece's technique is rolled (TECH1 law 4: found, never chosen) | 19: named Legendaries, feats |
| L3-35 | MED | the Galleries are replayed with nothing fresh | ADOPTED | 20 the Proclamation |
| L3-36 | MED | chained blows give 0.4 s to read | ADOPTED | 13.2 fury; 14 |
| L3-37 | MED | strong companies burn past signatures | ADOPTED | 13.2 phases |
| L3-38 | MED | blind jumps and inescapable tethers | ADOPTED | 11.2 the mist, the wisps; 10.5 shafts |
| L3-39 | LOW | band changes have no moment | ADOPTED | 8.9 the Brink halls, the sky |
| L3-40 | LOW | a clutch save goes unmarked | ADAPTED: *the Lone Beacon* ("Last Light" occurs in code) | 16.5, 19, 20 |
| L3-41 | LOW | the push-or-go-home choice is blind | ADOPTED | 16.3 the stake shown |
| L3-42 | LOW | the shape aimed at you is buried | ADOPTED | 25.4 THE QUIET COMPANY |
| L3-43 | LOW | the Deepway is one template | ADAPTED: four fragments, the hall's cap | 8.8 |
| L3-44 | LOW | twists come late and tilt rewards | ADAPTED: the Deserter is unnamed (a canon figure is not tied to an invention) | 8.7 |

## Lane 4 - architecture, performance, netcode and failure

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L4-1 | HIGH | a per-hall stair would round-trip to the exterior | CONFIRMED (`enterSdRealm` refuses outside `'exterior'`; `sdEnterRealm`) | 7 THE SWAP; EG10 |
| L4-2 | HIGH | peers float off moving platforms; the clock is not RTT-corrected | CONFIRMED (`online.js` `clockOffsetMs`) | 10.8 RIDDEN POSES, the corrected clock |
| L4-3 | HIGH | `spanFair` flags honest players four ways | CONFIRMED | 21 THE FAIR TRAIL's law; 11.5 ramps |
| L4-4 | HIGH | the crossing bound and air control | CONFIRMED | 10.2, 10.5, 10.7 |
| L4-5 | HIGH | `deepIn` is blind to lanes at 3 m | PARTIAL: true; resolved by widening to 4 m with the 1.5 m margin kept, since a pose interval at the escape build moves 0.7 m; a counted share of 25% is pinned | 11.7 |
| L4-6 | HIGH | arrival-timed trails count honest dodges | CONFIRMED (`posAt`/`posAfter`, `BODY_DEFAULT.enforce` false) | 21 time before enforcement |
| L4-7 | HIGH | receipt seeds are predictable from `st` | CONFIRMED | 22: `HMAC(rs, ...)` |
| L4-8 | HIGH | with the clamp off, walls become perches | CONFIRMED | 11.7 the fragment's own clamp |
| L4-9 | HIGH | the draw budget is broken by the Steps alone | CONFIRMED (79 dynamic draws, 82 GL) | 11.9 instanced pieces, GL-draw budget, measured |
| L4-10 | HIGH | a union test with no time axis drops sequenced blows | CONFIRMED | 13.2 THE UNION FLOOR in time, `untell` |
| L4-11 | MED | no y in the trails; the band is lopsided | CONFIRMED | 11.7 [floor - 0.5, floor + 3.0] |
| L4-12 | MED | the spec is not guaranteed equal across engines | CONFIRMED | 9: integers, `lawSin`, the sweep, `sd` |
| L4-13 | MED | two laws are too few; no-`egv` clients | CONFIRMED | 22: seven days, `{k:'spec'}`, the previous law swept |
| L4-14 | MED | the relay bundle would pull in client art | CONFIRMED (`sdSteps.js` imports `sdHall.js`) | 9; EG4 |
| L4-15 | MED | hazards are judged by no one | CONFIRMED | 21 |
| L4-16 | MED | poses off spans are trusted | CONFIRMED | 21 THE FAIR TRAIL on every pose |
| L4-17 | MED | pose-gated rewards can be teleported to | CONFIRMED | 21 |
| L4-18 | MED | "active" is a wiggle | CONFIRMED | 16.1 |
| L4-19 | MED | no clipping method; fill risk | CONFIRMED | 11.7 the CPU clip; 32 draws |
| L4-20 | MED | a culled draw leaves the shadow record | CONFIRMED | 11.9 the cull |
| L4-21 | MED | the reverb rebuilds and fights Better Ambience | CONFIRMED (25-41 ms Cave impulse) | 11.9 the hold and crossfade |
| L4-22 | MED | "apart in plan" cannot be built | PARTIAL: true; the rule became a measured cell bound | 11.6: at most 64 a cell |
| L4-23 | MED | visible rock inside the proxy | CONFIRMED | 11.6 noise outward, the pin |
| L4-24 | MED | `fbxMesh.mjs` cannot bake a scene | CONFIRMED ("expected exactly one Mesh Geometry") | 11.6 `fragBake.mjs` |
| L4-25 | MED | the Deepway breaks the fragment cap | CONFIRMED | with L2-6 |
| L4-26 | MED | nothing keeps volumes apart | CONFIRMED | 11.5 |
| L4-27 | MED | the hall's build freezes the veil | CONFIRMED (41-53 ms, 21-30 MB at 40k) | 7 the build during the closing |
| L4-28 | MED | freeing on transitions only | CONFIRMED | 11.9, 29 |
| L4-29 | MED | an absent body draws aimed blows | CONFIRMED | 6.1, 13.2 |
| L4-30 | MED | resume mid-air in traversal | CONFIRMED | 22, 11.8 |
| L4-31 | MED | every deploy drains for three hours | CONFIRMED | 22 THE HOLD |
| L4-32 | MED | a wake after the last island deadlocks the door | CONFIRMED | 21 |
| L4-33 | MED | the cell word is unauthenticated | CONFIRMED | 6.3, 23 the signed call |
| L4-34 | MED | Harriers over untargetable spans | CONFIRMED | 8.2, 12 |
| L4-35 | MED | the fork is unspecified | CONFIRMED | 11.4 |
| L4-36 | MED | no Court lord before EG13 | CONFIRMED | 31: EG8c's INTERIM lord; `EG_OPEN` |
| L4-37 | MED | stakes before their settlement | CONFIRMED | 31: EG8b ships `x` and `v` |
| L4-38 | MED | systems with no slice | CONFIRMED | 31 |
| L4-39 | MED | band art after the fragments; the registry after the key | CONFIRMED | 31: each kit its art; the registry in EG1 |
| L4-40 | MED | the 500-seed sweep is costly and early | CONFIRMED (182 ms a course) | 10.5 the sweep |
| L4-41 | MED | budgets measured too late | CONFIRMED | 11.9 at EG6b |
| L4-42 | MED | two key-loss paths | CONFIRMED | 22 a key's loss |
| L4-43 | LOW | lights pop and shadow caches burst | CONFIRMED | 11.9 |
| L4-44 | LOW | the feint flag leaks | CONFIRMED | 13.2 `cut`; 23 |
| L4-45 | LOW | a withheld `here` costs 30 s a hall | CONFIRMED | 7 the gather |
| L4-46 | LOW | the fast build's apex exceeds 3.5 m headroom | CONFIRMED | 11.8: 4.5 m with an inner course; 10.5 ceilings |

## Lane 5 - prose, structure and the bible's rules

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L5-1 | HIGH | the doctrine test's rule was misstated | CONFIRMED | the Ledger paragraph after the decisions |
| L5-2 | HIGH | section 29 missed rules | CONFIRMED | 29: the native-window rule, the one construction seam, patch notes, updates, 17l, probes, asserted edits, source sweeps |
| L5-3 | HIGH | the index lines carried fixed claims | CONFIRMED | Home.md, Active-Arcs, Page-Index |
| L5-4 | HIGH | Mac's WBX words were misquoted | CONFIRMED | 13.2; "Mac, WBX:" throughout |
| L5-5 | MED | unnumbered parts cannot be cited | CONFIRMED | 6.1-6.4; 10 and 11 split; renumbered once |
| L5-6 | HIGH | "the gate" defined wrongly | CONFIRMED | 4: the gate, the arch; 6.2's line |
| L5-7 | HIGH | "Descent" had three meanings | CONFIRMED | 4: the closing, the Drop; the board keeps the name |
| L5-8 | MED | "floor" had five meanings | CONFIRMED | 4 the hall's row; "wind-up floor" in full; 7 "endless depth" |
| L5-9 | MED | "beat" had four meanings | CONFIRMED | 4: slot, stage, tick |
| L5-10 | MED | "the count" still meant several counts | CONFIRMED | 4 the census; 8.8, 14, 16.3 |
| L5-11 | MED | "court" meant two things | CONFIRMED | 4 the Burning Court; chambers named chambers |
| L5-12 | MED | marks against Marks | CONFIRMED | 4 |
| L5-13 | MED | the Legion-Lord unexplained | CONFIRMED | the decisions; 4 |
| L5-14 | MED | imported words unlinked | CONFIRMED | 4 imported words |
| L5-15 | MED | the words table overclaimed | CONFIRMED | 4 retitled and widened |
| L5-16 | MED | "checkpoint" meant three things | CONFIRMED | 4 islands; 22 saves to storage |
| L5-17 | MED | "shaft" meant an arrow | CONFIRMED | 15, 21 arrows |
| L5-18 | MED | "trial" meant the gate's modifiers | CONFIRMED | 4; 14 |
| L5-19 | MED | Span against span | CONFIRMED | 4; 14 |
| L5-20 | MED | rising and sealed merged | CONFIRMED | 6.2 |
| L5-21 | MED | *w* undefined; `x` and `st` reused | PARTIAL: formulas use *R*; `ew` names the start Redoubt everywhere; the share is `sh`; the receipt kind `w` stays (its own context) | 4, 19, 23 |
| L5-22 | MED | "aura" meant two things | CONFIRMED | 15 Vestige auras; 25.4 |
| L5-23 | LOW | "the rest" meant the others | CONFIRMED | throughout |
| L5-24 | LOW | "the key law", "the key is E Phrygian" | CONFIRMED | 23, 26 |
| L5-25 | LOW | "wake" for a relay | CONFIRMED | 21, 22 |
| L5-26 | LOW | "band" for a range | PARTIAL: most rewritten; "the engine's range" kept | 8.4, 11.7 |
| L5-27 | LOW | champion and Kyn names collide | PARTIAL: Kynval elites; Kyn Levy became the Warband; *Spire Champion* kept | 4, 8.7, 18 |
| L5-28 | LOW | "card" meant three things | CONFIRMED | the first breach's card removed (27.7) |
| L5-29 | LOW | the open words | CONFIRMED | 4 |
| L5-30 | LOW | tier, Shade, lane | CONFIRMED | 16.3 depth; 8.7 A Battlemage's Ghost; 11.8 |
| L5-31 | MED | "two floors" when there are five laws | CONFIRMED | the decisions |
| L5-32 | MED | the summary nested three deep | CONFIRMED | the decisions |
| L5-33 | MED | rules stated in several places | PARTIAL: the cadence and cap live in 8.1 and are pointed to; short restatements remain where a reader needs them | 8.1, 18 |
| L5-34 | LOW | section 6's order | CONFIRMED | 6.1-6.4 |
| L5-35 | LOW | the fork under the toll | CONFIRMED | 10.6 |
| L5-36 | LOW | the band groups were not headings | CONFIRMED | 13.3 |
| L5-37 | LOW | the HUD in two places | CONFIRMED | 27.1 |
| L5-38 | LOW | the fragments' ask missing from the top | CONFIRMED | What Mac asked for; the header |
| L5-39 | MED | systems with no slice | CONFIRMED | 31 |
| L5-40 | MED | slices naming undesigned things | CONFIRMED | 31 EG8c; 28; 8.9 |
| L5-41 | LOW | EG0b's row; the audit heading; EG21's name | CONFIRMED | 31 EG0a-c; EG21 |
| L5-42 | LOW | EG8 was a phase | CONFIRMED | 31 EG8a-e |
| L5-43 | HIGH | the quest warning in real hours | CONFIRMED | 5, 24 |
| L5-44 | HIGH | "harder and faster" | CONFIRMED | 11.4 |
| L5-45 | MED | the slack's rationale read backwards | CONFIRMED | 13.2 |
| L5-46 | MED | the clock table's columns | CONFIRMED | 6.2 |
| L5-47 | MED | the gather cell | CONFIRMED | 7 |
| L5-48 | MED | a Redoubt called a lord | CONFIRMED | 13.3 |
| L5-49 | MED | one lord, two names | CONFIRMED | Grath, the Hound |
| L5-50 | MED | the ways out | CONFIRMED | 16.3 |
| L5-51 | MED | no end reason for a wipe | CONFIRMED | 23 `'wipe'` |
| L5-52 | MED | the gap "added to the count" | CONFIRMED | 22 |
| L5-53 | MED | the blue pip sentence | CONFIRMED | 15 |
| L5-54 | MED | the herald sentence | CONFIRMED | 20 |
| L5-55 | MED | THE GOLD RUN's unit | CONFIRMED | 8.2 |
| L5-56 | MED | the find's passive | CONFIRMED | 5 |
| L5-57 | MED | captives or undead | CONFIRMED | 3 |
| L5-58 | LOW | the Harriers sentence | CONFIRMED | 8.2 |
| L5-59 | LOW | the door frame | CONFIRMED | 23 |
| L5-60 | LOW | "one life one a minute" | CONFIRMED | 15 |
| L5-61 | LOW | unclear quantities | CONFIRMED | 8.4, 8.8, 8.6, 14, 18 |
| L5-62 | LOW | "reaches the Soul Cairn at reference" | CONFIRMED | 18 |
| L5-63 | LOW | small ambiguities | CONFIRMED | 6.4, 10.7, 10.8 |
| L5-64 | LOW | the INT ledger unlinked | CONFIRMED | 5 |
| L5-65 | LOW | terms before their definition | CONFIRMED | 4 CHECK; 13.3 999%; 13.2 WIND |
| L5-66 | LOW | the escape build's second name | CONFIRMED | 10.2 |
| L5-67 | LOW | redundant columns | CONFIRMED | 9, 18 |
| L5-68 | LOW | player strings disagree | CONFIRMED | 2, 6.2 |
| L5-69 | LOW | the fair trail sent to section 7 | CONFIRMED | 8.2 |
| L5-70 | MED | the Faydra and Moath allusion is unsourced | CONFIRMED (not re-verifiable) | 13.3: dropped |
| L5-71 | LOW | Dark Seducer and Winged Twilight | CONFIRMED | 3, 13.3 |
| L5-72 | LOW | "Hound of the Wellhead" in the Galleries | CONFIRMED | 13.3 |
| L5-73 | LOW | Eye Of The Beholder's casing | CONFIRMED | 11.8 |
| L5-74 | LOW | the Valkynaz' name styles | CONFIRMED | 13.3, 13.4 |
| L5-75 | LOW | "Elite Gates" as player text | CONFIRMED | 4 |
| L5-76 | LOW | backticks inside the diagram | CONFIRMED | 1 |
| L5-77 | LOW | the diagram's way home arrow | CONFIRMED | 1 |
| L5-78 | LOW | lines past 120 columns | CONFIRMED | re-wrapped |
| L5-79 | LOW | stray punctuation after italics | CONFIRMED | 5, 16.5, 20 |
| L5-80 | LOW | modelled and modeled | CONFIRMED | "modelled", Mac's words kept |
| L5-81 | LOW | Dungeon's capital | CONFIRMED | 2, 5 |
| L5-82 | LOW | capitalisation drift | CONFIRMED | 4 the capitalisation note |
| L5-83 | LOW | shouted names inconsistent | CONFIRMED | 4 the shouted rules |
| L5-84 | LOW | units and notation | PARTIAL: multipliers written x3; units added; a wind-up keeps its one decimal | throughout |
| L5-85 | LOW | `eg:<16 hex>` | CONFIRMED | 23 |
| L5-86 | LOW | the first person | CONFIRMED | the decisions; 15 |
| L5-87 | LOW | the path convention unstated | CONFIRMED | the header |
| L5-88 | LOW | the legion's "is not"; Underway | CONFIRMED | 4 |
| L5-89 | LOW | gatebreaker and gate-goer | CONFIRMED | 5 |
| L5-90 | LOW | grammar | CONFIRMED | 13.3, 14 |

## Lane 6 - presentation, feel and accessibility

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L6-1 | HIGH | the telegraph edge is the magma's orange | ADOPTED | 25.2 THE SPIRE DANGER EDGE; 11.9 the kerb and the cap |
| L6-2 | HIGH | no rule for dropped telegraphs | ADOPTED | 25.4 THE TELEGRAPH BUDGET |
| L6-3 | HIGH | the way home is walked through by the spoils | ADOPTED | 16.3 |
| L6-4 | HIGH | a fall shows a respawn that never comes | ADOPTED | 16.5 THE FALL |
| L6-5 | HIGH | dressing throws away the Steps' tells | ADAPTED: the Beat's last 0.4 s is white, the Spire's timed-hazard light, not the Hour's ember | 10.3 |
| L6-6 | HIGH | the five lights contradict themselves | ADOPTED | 25.2 |
| L6-7 | HIGH | three tethers share one look | ADOPTED | 25.5 |
| L6-8 | HIGH | the Eclipse has no tell | ADOPTED | 11.2, 25.5 |
| L6-9 | HIGH | the edge rule half-written | ADOPTED | 25.3 THE EDGE LINE |
| L6-10 | HIGH | no colour-blind option | ADOPTED | 25.7 |
| L6-11 | HIGH | one sprite, several roles | ADAPTED: sprites reassigned so no band uses one for two roles, and every role has a mark | 12 ROLE READS |
| L6-12 | HIGH | the phone HUD overloaded | ADOPTED | 27.1 |
| L6-13 | HIGH | the count has no display rules | ADOPTED | 27.2 THE COUNT CHIP |
| L6-14 | HIGH | no objective; an unmarked door | ADOPTED | 27.3, 7 |
| L6-15 | HIGH | no recap | ADOPTED | 27.6 THE RECAP |
| L6-16 | HIGH | the witness seat is one sentence | ADOPTED | 16.5 THE WITNESS VIEW |
| L6-17 | HIGH | touch platforming needs two thumbs | ADOPTED | 27.8 |
| L6-18 | MED | personal mechanic states have no HUD | ADOPTED | 13.2, 25.5 |
| L6-19 | MED | events with no beat | ADAPTED: sound ids named only where the code already holds them | 27.5 |
| L6-20 | MED | the Redoubt fires all at once | ADOPTED | 16.2 |
| L6-21 | MED | party frames blind to the Spire | ADOPTED | 27.4 |
| L6-22 | MED | eight players' effects drown the lights | ADOPTED | 25.4 THE QUIET COMPANY |
| L6-23 | MED | the move arrow points through walls | ADOPTED | 25.5, 11.7 |
| L6-24 | MED | fog and mist hide telegraphs | ADOPTED | 25.6 |
| L6-25 | MED | stings become a metronome | ADOPTED | 26 THE SPIRE MIX |
| L6-26 | MED | latency forgiveness undefined | ADOPTED | 10.8; 21 the footprint's slack |
| L6-27 | MED | the start window hides its refusals | ADOPTED | 5 |
| L6-28 | MED | the stair cannot be the same every time | ADOPTED | 7 |
| L6-29 | MED | loading comes out of the count | ADOPTED | 6.2 |
| L6-30 | MED | cameras snap in tunnels | ADOPTED | 11.8, 11.6 |
| L6-31 | MED | the music loops; lords sound alike | ADOPTED | 26 |
| L6-32 | MED | the rim light spoils the Lurker | ADOPTED | 12 |
| L6-33 | MED | a Rampart push sends you back 160 m | ADOPTED | 8.3 waystones |
| L6-34 | MED | the call has no UX | ADOPTED | 6.4 |
| L6-35 | MED | the first-breach card teaches nothing | ADOPTED | 27.7 |
| L6-36 | MED | the boards have no UI | ADOPTED | 20 |
| L6-37 | LOW | the reverb snaps at mouths | ADOPTED | 11.9 (with L4-21) |
| L6-38 | LOW | the voice drifts | ADOPTED | 5, 6.2, 6.4, 14, 4 |
| L6-39 | LOW | the true Seyth hard to tell | ADOPTED | 13.4 |
| L6-40 | LOW | small feel items | ADOPTED | 25.8 |

## The re-verification

Two more cold lanes then read the revision itself (bcf61019b, frozen), against the tree and against every row above:
R1, code truth (about 230 claims, about 150 rows sampled, all 57 HIGH rows among them), and R2, numbers and
consistency (every floor, the clock, the pace, all 248 section pointers, the slices). They found **61** more: R1 25
(2 HIGH), R2 36 (5 HIGH). Every one was CONFIRMED, and each was fixed in place:

| id | sev | finding | resolution |
|---|---|---|---|
| R1-1 | HIGH | a culled draw leaves the shadow record today; no shadow-only draw exists | 11.9: EG6b adds the shadow-only draw |
| R1-2 | HIGH | `iliacTableHud.js` is a DOM panel, not a DFU window | 20: the classic skin from DFU windows |
| R1-3 | MED | the online death screen counts 60 s (`deathScreen.js`) | 16.5 |
| R1-4 | MED | the Steps' rim line is mesh art (`SD_STEP_LINE`) | 25.3 |
| R1-5 | MED | no reduced-motion setting exists | 7, 25.7: `port:reducedMotion`, new |
| R1-6 | MED | a double keyline and a hatch need a shader bit | 25.7 |
| R1-7 | MED | the beacon stands 800 m; its colour is a per-frame uniform | 6.3 |
| R1-8 | MED | lords share add sprites | 12 ROLE READS: among the legion's kinds |
| R1-9 | MED | touch and the living ping had no slice | 31 |
| R1-10 | LOW | 2.3 needs Improved Athleticism | 10.2 |
| R1-11 | LOW | `bakeCloak.mjs`, the helpers, the wagons | 11.6 |
| R1-12 | LOW | 38001-38221 are mostly not made levels | 11.6 |
| R1-13 | LOW | the lift is over the court frame's origin | 11.7 |
| R1-14 | LOW | `realmClamp` is the Hour's | 11.8 |
| R1-15 | LOW | Better Ambience re-asserts on a change, not every frame | 11.9 |
| R1-16 | LOW | `spanFair` is new | 21 |
| R1-17 | LOW | the versions moved (`world194`, `acct114`) | 23 |
| R1-18 | LOW | some lord outlines already draw the crimson | 25.2 |
| R1-19 | LOW | `ASPECT_COLORS.rime` is six colours | 25.2 |
| R1-20 | LOW | the tab has a health-and-fatigue colour swap | 25.7 |
| R1-21 | LOW | Legion-Lord carries `legion` | 14 |
| R1-22 | LOW | the Wellhead unlocked no variant | 8.1, 8.3: the Wellmouth, the Forge Bridge |
| R1-23 | LOW | Shed Skin and the Reprieve are timers too | 15 |
| R1-24 | LOW | a code line past 128 columns | 11.5 |
| R1-25 | LOW | EG0b's record named no widened blow | 31 EG0b |
| R2-1 | HIGH | the variant draw ran out in circle 2 | 9: `min(2, unlocked - 1)`; the Wellhead's variants; the summary |
| R2-2 | HIGH | four Reliquary sources escaped the weekly law | 16.3: every Reliquary gated, and its depth stated |
| R2-3 | HIGH | Reliquaries at THE SEAL, the last word and a void | 16.3, 23: they open |
| R2-4 | HIGH | the Wager and the Proclamation broke the decree cap and had no data path | 14 standing decrees, nine in the frames; 5; 23 `wg` |
| R2-5 | HIGH | a chained fill counted down faster than the blow | 13.2, 14: `max(the blow's own wind-up, floor + 0.3 s, 1.0 s)` |
| R2-6 | MED | the fork's two closings unknown to the door, the count and the pull | 11.4; 23 `ul` |
| R2-7 | MED | Watchfire III with Far Watch passed the committed lead | 15: +0.05 s, never past 0.4 s |
| R2-8 | MED | Paired Hearts with an odd count | 13.3: `4 + 2·floor(n/3)`, pairs within 6 m |
| R2-9 | MED | the Old Masters' arena collided | 18 |
| R2-10 | MED | `PHASE3_WINDUP` still applied | 13.2: not applied in the Spire |
| R2-11 | MED | the relay could not know a Rehearsal | 23 `rh`, `'rehearsal'`; 27.7 |
| R2-12 | MED | the Proclamation could lay a Cairn piece | 20: Crumbling Halls in Gale-Swept's place |
| R2-13 | MED | which niches heal | 11.4, 8: only the Low Road's |
| R2-14 | MED | the Soul Tithe's 12 m bound was impossible | 13.3: the crypt's width, 7.02 s |
| R2-15 | MED | vents on a narrow walkway under 4 m | 8.3 |
| R2-16 | MED | three hazards without their numbers | 11.2 |
| R2-17 | MED | lord blows without numbers | 13.3, 13.4 |
| R2-18 | MED | systems with no slice | 31 |
| R2-19 | MED | the shelf and the Brinks before their art | 31 |
| R2-20 | MED | honours and the board needed receipt facts | 23 `fl`, `lb`, `ft`, `td` |
| R2-21 | MED | the Sutler and Spirebridge had no frame | 23 `buy`, `mast` |
| R2-22 | LOW | the living ping was undesigned | 16.4; 23 `lping` |
| R2-23 | LOW | the Cracked Gem broke four tithes | 13.3 |
| R2-24 | LOW | words against the table | 27.7, 15, 27.3, 4 |
| R2-25 | LOW | the shouted rules list incomplete | 4 |
| R2-26 | LOW | the Markynaz champion's body | 8.5: 2.5 scale and the ring |
| R2-27 | LOW | the ridden drift figure | 10.8: 0.5-1.7 m |
| R2-28 | LOW | two examples outran the model | 20, 7 |
| R2-29 | LOW | the Spire Tonic's magicka | 17.1 |
| R2-30 | LOW | the arch's sealed hour | 6.3 |
| R2-31 | LOW | the numeral split | 13.2: at `ceil(n/2)` |
| R2-32 | LOW | the gather could outlast the stair's hold | 6.2: 40 s |
| R2-33 | LOW | three fourth cards | 15: they stack, six at most |
| R2-34 | LOW | the Weight had no pin | 13.2: the one exception |
| R2-35 | LOW | small inconsistencies | 1, 14, 25.4 |
| R2-36 | LOW | one rounding | 18: 33 s |

## What changed, in short

The page was rebuilt whole from the frozen snapshot and the verified findings (sections 1-31): the structure
renumbered once before any code cites it; the words split where they were overloaded; the netcode made fit for one
life (THE SWAP, RIDDEN POSES, the corrected clock, the fair trail's time law, secret receipt seeds, an exact law, THE
UNION FLOOR in time, THE HOLD); THE WIDTH RULE at 4 m; the halls given variants and the Brink; the fragments given
signatures, set-pieces, engines, alcoves and measured budgets; every lord given phases and the Valkynaz their own
ground; the run given the Covenant's patience, the Memento, the witness view, the company's word, Masteries, Accords,
caches, Cantrips and THE POTION LAW; the presentation given its danger edge, its edge line, its telegraph budget, its
palette, its count chip, its beats and its recap; the slices split and filled. Section 31's EG0c record lists it.

## Sources

- The tree at 14b3b172f: every file and symbol named in the tables above.
- The lanes' measurements: `deepIn` over bearings (the real function), the motor's carries (`runSpeed`, `GRAVITY`,
  `JUMP_SPEED`, `jumpSpeedMultiplier`), the collider in synthetic passages (the real `PlayerMotor` and `Collider`), the
  mesh build (`faces()` and `packRealmFaces`), the reverb's impulse synthesis, the Hour's draws.
- `pace3`, AUDIT EG0's model with the polished rules (section 18).
- The genre's practice, as each lane-3 and lane-6 row names it.
