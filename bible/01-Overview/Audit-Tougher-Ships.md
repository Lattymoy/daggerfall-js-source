# AUDIT TOUGHER-SHIPS - ships that last, repairs that need no port, a wreck's salvage, 2026-10-03

Mac: *"Lets audit this. Must be perfect"*, of PR #549 (TOUGHER-SHIPS, QUICK-REPAIRS, SALVAGE - `03-World/Naval-Combat.md`)
at `aa0c22088`. Four lenses read it: the combat's coverage across the whole tree (every road a ship takes harm by, and
every reader of her numbers); the runtime logic of the repairs and the salvage on the real naval host; online, the
saves, the docs and the tests' own honesty; and the mutants - every list a touched test kills, run again over the
change (710 mutants: 708 dead, two survivors below).

Every finding was re-run before it was fixed, and is pinned in `test/tougherships.test.js` or the moved pins (each a
`PIN MOVED` note). Mutation-proven: `tools/mutants/tougherships.json` (28 mutants), the older records the fixes moved
re-aimed (`auditnav2_captains.json` F26, `shipcrew.json` SCH-save-mates-dropped, SCH-the-pace-under-fire-unread - its
name was stale), and the 741 mutants of every list the touched tests kill run again over the fixed tree.

## The combat (every road to a ship's harm)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| TS1 | Bug | **A fire alone took nobody.** FIRE_CREW_S stretched to 16 s outlived a gun's fire (15 s) and a barrel's (12 s), and the burn's count reset when the last fire went out: one fire 1 man to 0, a gun and a barrel 2 to 1, where the toughness meant 0.625 of each. | FIRE_CREW_S 10 again - a man's worth of harm - and a toughened crew loses 1/SHIP_TOUGHNESS of a man for it, carried in the damage's `wound` from fire to fire. |
| TS2 | Risk | **Damage control grew with the fight.** A share of her hull a second against fire that now takes a smaller share: at 0.3 of the pace it made good 70% of a brig's fire on a Small Ship, 76% of a flagship's, 102% of a flagship's on a Carrack. | SEA_REPAIR_UNDER_FIRE 0.125: 29%, 32%, 42% (the strikeTime model's rates). |
| TS3 | Risk | **The casks sank before a fight's second ship struck.** FLOTSAM_LIFE 150 s against a toughened duel of 90-260 s - and the wreckage with them. | FLOTSAM_LIFE 150 x SHIP_TOUGHNESS (240 s). |
| TS4 | Risk | **A running pirate escaped more.** Her band between running (PIRATE_RUNS_AT 0.33) and striking (0.25) took SHIP_TOUGHNESS times the balls while she opened the range. | PIRATE_RUNS_AT 0.3: the band as many balls as it was. |
| TS5 | Nit | **A ram's men rounded, never rolled.** A bow's light ram took nobody, ever (round(22/64)); a galley's took 4 for 3.67. | `ramMen(dealt, roll)` - a ball's law over dealt/RAM_A_MAN. |
| TS6 | Bug | **Online, the shooter reckoned the toughness.** A peer's ball said its men after the toughness on the shooter's build: an older client's balls thinned a newer stander's crew at the old pace against a toughened hull (the 0.95 to 0.66 skew the change set out to remove), and the other way round. | The wire says a blow's men BEFORE the toughness (`shotMen`, `ramMenSaid`); the stander reckons it (`applyPeerHit`'s `ballMen`) - an older build's word the same, so a mixed room agrees. |
| - | Accepted | A Carrack wrecked takes 18 stores (17 before): canvas at 4 gold to a hull point's 7, where it was 6 to 12. The other hulls' counts are as they were; the yard's bills 4-7% cheaper. | Said in the patch notes. |
| - | Checked | Every other road: balls of every gun (chain, rigging, barrels), the barrel's and a gun's fire on hull and canvas, ram recoil, boarding's dead (`CREW_PER_HAND`), the repel's whole crew, PRIZE_COST, the scuttle's torch, the wire's caps (NAVAL_HIT_MAX, `c` 60), every threshold (all shares), every timer (none measures a fight's length but the two above), the HUD, the tags, the yard window; the duel odds of all 81 class pairs, the old build's against this one's - the worst 0.07% apart, none across WARY_ODDS or 1. | - |

## The repairs and the salvage (the naval host)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | Risk | **Her hands' repairs ran for every boat of mine, said for every one.** A Small Ship 7 km off spent four stores and her mate spoke; a crewless Large Boat with nobody aboard spent two and "Repairs done" came from no one. | A crewed boat's hands work wherever she lies; a boat with no hand aboard only under her captain's own (the boat in play). Only the boat in play is heard. |
| R2 | Risk | **Her canvas under the cap held her hull's paid work.** The whole of the paid work waited on the free mending (95 s at a full crew, 381 s at six hands). | `paidDamage`: a part under FIELD_MEND_CAP reads whole, the rest is owed - her hull paid at once while her canvas mends free (a crew all lost: no free mending, so all of it owed). |
| R3 | Risk | **The order poured stores into a fire with no enemy near, and a wreck flickered.** A fire is no quiet, so a burning ship was "under fire": three fires out-burned the patching; and a wreck refloated under fire was wrecked again by the next ball (the crippled word and the spirits' knock each time). | The order works in the quiet, or with a hostile near (DAMAGE CONTROL); with neither it waits, as it did. Under fire a wreck is not refloated. |
| R4 | Nit | **An older save's part-spent store lost its work** (old work points read as new: up to 0.375 of a store). | `savedHurts` scales the credit with her hull. |
| R5 | Nit | **The salvage's words contradicted themselves** when the pack could not take it ("Nothing in it is worth keeping." then "2 stores are too heavy"). | Said once, rightly. |
| R6 | Nit | **A swimmer's salvage was all or nothing, and went to a boat up to 180 m off unsaid.** | A store a piece into the pack; a swimmer's to the boat he is alongside (boatInPlay), never one across the water. |
| R7 | Nit | Dead state (`autoRepairing`); a barrel counted as a "thing" stowed. | Gone; stores only. |

## Online, the saves, the docs and the tests

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | Risk | **A save carried to an older build and back healed her.** Half a Small Ship (336 of 672) read 336 of 420 there. | A boat is saved ON HER FIRST BUILD'S SCALE, her whole said (`savedRecord`); every build reads her right. |
| O2 | Accepted | A ship stood by an older build leaves no wreckage, and an older heir drops one after ORPHAN_S. | Mixed builds only; said in the notes. |
| D1 | Doc | "A wreck is whole in about a minute" held for the order's hull alone. | Measured: the order 54 s her hull, 96 s her canvas, 12 stores; her hands alone 149 s and 178 s, 7 stores. |
| D2 | Doc | "Fewer port trips to hire hands" was false: a fight costs as many men as before, only more slowly. | Struck. |
| D3 | Doc | The SEA-REPAIR section said the order works only while nothing threatens her; the settings did not list the new row; no ledger or arcs rows; the gun table's crew column. | Each brought up to date. |
| T1 | Risk | **COIN_TOSS was open-ended**: a future drift into a near-even pairing would silently lose the wrong-side check. | A toss still fails at seven of eight (a fair coin's one in thirty). |
| T2 | Nit | Two waits between a struck ship's blows cleared STRUCK_GRACE_S by float error; FIRE_HP written as 1.4; "an older build reads none" tested the new door; a tolerance that admitted 0.26-0.35. | STRUCK_GRACE_S + 1; the constant; said as tested; 3%. |

## The mutants

- **AUDIT-NAV2-F24-the-station-inside-the-dead-zones SURVIVED** the change: the duels caught a galley stationed
  inside her great guns' dead zone only by a stall, and with the ships toughened none of the eight stalls whether she
  does or not (the 8-duel runs came out identical with and without the mutant). Re-pinned at its source: a war galley
  on a Large Boat lying still keeps her station off it (78-80 m; the mutant's 61-63 m) -
  `test/auditnav2_captains.test.js`.
- **NAV-B-her-colours-struck SURVIVED** on this change and on its base (`7305011de`) alike - not this change's. RECORDED
  for its own slice.
- The duel bar's samples re-rolled with the toughness. 32 duels a pairing, before and after: cutter on sloop 20-12 and
  16-16 (the model 0.95), war galley on corsair galley 26-6 and 30-2 (1.18), war galley on brig 21-11 and 20-12
  (0.89). At 16 duels the base itself fails the bar (the war galley on the brig 12-4 against 0.89), so the eight
  geometries are the bar's own; they keep it.
