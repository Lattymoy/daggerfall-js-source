# AUDIT WORLD-EVENTS (2026-10-25) - the world events' rules, the boss traits and the town raids, audited

The owner, of the branch's three slices - EVENT-RULES (regeneration held, Resurrect allowed, the rules said -
`11-Multiplayer/Elite-Gates.md` section 24, `11-Multiplayer/Super-Dungeons.md` SD-REZ), BOSS-TRAITS
(`05-Combat/Boss-Traits.md`) and RAID5 (the raid kinds - `03-World/Raiding-Parties.md`): **"Audit this. Ensure
perfection"**. This page is the findings, each with its verdict. What the audit changed is written into the record's
sections as they now stand, each marked AUDIT WORLD-EVENTS and its id, and every fix in code carries an
`AUDIT WORLD-EVENTS L<lane>-<n>` comment.

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN snapshot (`dca2dd322`, the slices `31adeb5d7..dca2dd322` - `Home.md`'s
DO NOT FIX WHILE THE VERIFIER IS READING: the fixes went into the tree while the lanes read the snapshot), each given the
owner's asks and the files, never the record's conclusions, and told to prove a finding - a probe run against the real
code, or the code quoted with a concrete trace - before reporting it. Then the author's pass: every finding re-run on its
lane's probe against the head before it was acted on, every fix pinned by a test that fails on the code as it stood, with
a recorded mutant (`tools/mutants/auditwe_*.json`) the pin kills.

| Lane | Read | Found |
|---|---|---|
| L1 | the event rules: the held regeneration, the Hour's window and its relay, Resurrect in each made level, the tile | 11 - 1 BLOCKER, 4 MAJOR, 6 MINOR |
| L2 | the boss traits in the real flow: both halves, every host, the wire, saves, the relay bosses' stand-ins | 14 - 6 MAJOR, 8 MINOR |
| L3 | the raid runner and its online and relay arm (the real Room over `test/fakeRoom.mjs`) | 14 - 1 BLOCKER, 5 MAJOR, 8 MINOR |
| L4 | the raid kinds in the real world host - the real pools, motors and streets, the map on ARENA2 | 9 - 2 BLOCKER, 3 MAJOR, 4 MINOR |
| L5 | the record, the words in every language, what a player sees, the process | 18 - 7 MAJOR, 11 MINOR |
| L6 | the tests, the pins, the mutants, regressions (the whole suite on the head) | 9 - 1 BLOCKER, 4 MAJOR, 4 MINOR |

75 reported. Eighteen are one defect seen from two or three lanes (L3-1 = L4-4, L3-2 = L4-3, L3-3 = L4-2 = L6-4, L5-1 =
L1-4, L5-2 = L1-5, L5-5 = L1-3, L5-9 = L2-14, L5-10 = L2-7, L5-11 = L1-11, L5-18 = L3-6, L6-2 = L1-1, L6-3 = L1-7, L6-6
= L2-2, L6-7 = L2-7 and L2-9, L6-8 = L4-6 and L4-7) and one was not reproduced (L5-3, below): 57 defects. Six more were
the whole suite's on the snapshot (A0, below, four of them L6-1's), and the suite's runs on the fixed tree found fourteen
pins the fixes had moved (A1). Two findings are left, each with its reason (L1-11, L2-12). One was the owner's to decide
(L1-4): asked what "Resurrect allowed" means where a death is a fall, the owner chose **"Raise before the fall"**.

What reached a player: nothing yet - the audit's fixes landed with the slices, before any deploy (relay `world260` on the
branch, re-hashed in place for the fixes, then `world261` past THE FOLD's `world260` at the merge -
`test/net/relayversion.test.js`). On the branch, the Hour's one life rested on the device alone (L1-1: a second
device walked back into the fight inside the window), "Resurrect allowed" did nothing in two of the three places the owner
named (L1-4), a raid's exodus could not run in any city of the game (L4-3) and its refugees, when they stood at all, never
walked and were culled and counted lost (L4-1, L4-2).

## Fixed - the event rules (L1)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L1-1 (= L6-2) | BLOCKER | **Any hello inside the Hour's window was a rise** - nobody's Resurrect checked: a death, a second device or a cleared store, and the fighter was back in the Hour whole, any time in two minutes. | The raise is the realm's to record: a living fighter's Resurrect at the body says so to the realm (`sd` `rz`, `net/raiseWord.js` from the world host's Resurrect door; `sdMayRaise` - admitted, neither down nor dead, within `SD_REZ_REACH_M` of where the body fell, inside the window), kept in `raised`; a down account rises only once raised, and one nobody raised is held at the door (busy - its page asks again) and buried past the window. | `test/net/superDungeon/auditwe_rez.test.js`; `sd12_onelife` moved (its "a friend raised her" had no friend) |
| L1-2 | MAJOR | **Under BOSS_BODY's enforcement the count fell the raised again** - the dying pose left with its socket, so the count never stamped the death, and told the raised page `bd` every 3 s. | A rise is a new life on the count (`_sdRose` - `bodyLife`). | `auditwe_rez` |
| L1-3 (= L5-5) | MAJOR | **Hist-Sap, the Warden's Steadfast and the Firmament's hpRegen healed whole** inside a made level's pause - the tile and section 24 said every natural source was held. | Each through `regenShare`, as Grit is. | `test/systems/auditwe_rules.test.js` |
| L1-4 (= L5-1) | MAJOR | **"Resurrect allowed" did nothing in the Spire and on the Sky-Ketch**: a lethal blow there is caught by the fall's death save, so no body ever lay for a spell - and the tile promised a raise. | THE OWNER'S CHOICE, "Raise before the fall": a death there with a companion standing lies DOWN where it fell for 60 s - the Spire's `egLayDown`, the Ketch's lying page (`ketchRaise`); out of the fight, held still and dying on every screen (`net/online.js poseDown`); a party member's Resurrect at it stands it at 30%, a new life on the count; past the window, given up, or with nobody left to raise it, THE FALL as ever (`Elite-Gates.md` section 24, `Sky-Ketch.md`). | `test/net/eliteGates/auditwe_down.test.js` |
| L1-5 (= L5-2) | MAJOR | **The Hour's window was 60 s in truth, told two minutes**: a friend's screen keeps a body `CORPSE_MS`, the death screen stands `ONLINE_RESPAWN_SECONDS` - both a minute. The relay's second minute served only L1-1. | `SD_REZ_MS` the body's minute and the page's ten seconds (70 s), pinned equal to both; the tile says "within 60 seconds". | `auditwe_rez` |
| L1-6 | MINOR | The page's window never shut: the world host adds the slot every frame of the death screen, so its moment was stamped anew each frame. | Stamped once, at the death. Its other half - an SD_NO_FALLEN cast-out after a rise let the slot go - is moot under L1-1: a hello the realm will not raise is held busy, never refused, until the window is out, and the cast-out then is the truth. | `auditwe_rez` |
| L1-7 (= L6-3) | MINOR | More than SD_FIGHTERS_MAX deaths in one window dropped the oldest down account unburied - AUDIT SD III R2's hole, reopened: its next hello was a fresh admission. | What the list cannot hold is buried. | `auditwe_rez` |
| L1-8 | MINOR | A rise came off `down` (and storage) before the admission's later refusals - a refused raise erased the death. | Off the lying only once the door has let it in. | `auditwe_rez` |
| L1-9 | MINOR | The carried fraction was one for every body: two foes split one Regenerate's halves, a foe's ring round ate the player's. | Each body its own carry. | `auditwe_rules` |
| L1-10 | MINOR | The pause began off a frame's health fall: a maximum let go with its share kept started it, a hit healed in the same frame started none, a frame of the mode's change ended it. | Begun at the player's hurt door (`systems/courtRulesDoor.js` - the account Worker bundles `courtRules.js`, so the client's door is its own module). | `auditwe_rules` |

## Fixed - the boss traits (L2)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L2-1 | MAJOR | A peer's Cast-When-Strikes spell, and a reflected spell, lost their element: never resisted, on either machine. | The element kept to the owner. | `test/scenes/auditwe_traits.test.js` |
| L2-2 (= L6-6) | MAJOR | A relay boss's resistances skipped every carried damage-over-time round and Open Hand's owed blows. | Each resisted as the blow it follows. | `auditwe_traits` |
| L2-3 | MAJOR | A Wrathful dungeon elite turned on the host alone (the wrath unsent); the dungeon's own lane's elites were never seeded, and their puppets never elite. | `bw` streamed; seeded off the pick; the puppets elite. | `auditwe_traits` |
| L2-4 | MAJOR | The ward was sized before the host's later health scaling - far under its 30%. | A share of the live maximum (`WARD_SHARE`). | `auditwe_traits` |
| L2-5 | MAJOR | The owner's half took falls and every other wound; the wrath ran on the wall clock, began at any damage, never cooled and turned only when struck. | The player's blows alone; the game clock, from a player's first blow, cooled after 30 s unstruck, turned on its own tick. | `auditwe_traits` |
| L2-6 | MAJOR | A raid's leader dropped no elite's loot, and one whose stand rolled elite kept one trait. | An elite's drop; its two traits alone. | `auditwe_traits` |
| L2-7 (= L5-10, L6-7) | MINOR | The ward's state and the trait lines never left the owner; a joiner's copy kept a ward that never drained. | `bv` on the record, the ward drawn off its owner's word. | `auditwe_traits` |
| L2-8 | MINOR | A foe handed over (adopted) stood no ward. | Stood on the adopted foe. | `auditwe_traits` |
| L2-9 (= L6-7) | MINOR | Traits were never saved: a load re-rolled an elite's - a save-scum re-roll. | Saved with the foe and read back. | `auditwe_traits` |
| L2-10 | MINOR | A SetHealth(0) was curbed and warded. | A kill. | `auditwe_traits` |
| L2-11 | MINOR | Any mask a record sent stood in full - more traits than an elite or a leader carries. | Trimmed as it is read. | `auditwe_traits` |
| L2-13 | MINOR | The floating numbers showed the unresisted blow. | Retold as what landed, tagged Resisted (`ui/hitNumbers.js retellHit`). | `auditwe_traits` |
| L2-14 (= L5-9) | MINOR | The relay bosses drew any two of eight - two proofs a third of the time; section 3 described them wrongly. | One element and one blow trait; the record rewritten. | `auditwe_traits` |
| L5-4 | MAJOR | The Spire's lords and the Valkynaz were said to carry traits; they carried none (the host-body seam). | They carry them, through the stand-ins' door. | `auditwe_traits` |
| L5-6 | MAJOR | A trait's rule was never shown; a relay boss's traits were said once and never again. | Each trait's rule on hovering it in the target frame, each trait taught once. | `auditwe_traits` |
| L5-12 | MINOR | "Warded Elite Orc" was composed in English word order in every language, a word could stand twice, and lines had no article. | Composed by `bossTraits.title` in the player's language (the noun first where its adjectives follow it); each word once. | `auditwe_traits` |

## Fixed - the raids (L3, L4)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L4-1 | BLOCKER | **A follower whose leader is not the player never walked while it could see the player**: the motor's pursuit tick fought the follow. Refugees stalled; the bearer never got back to his post. | The follow decided before the classic tick, which stands aside while it walks. | `test/systems/auditwe_raid.test.js` |
| L4-2 (= L3-3, L6-4) | BLOCKER | **Refugees were taken by the street pool's 120 m cull and each counted lost** - in any town three blocks wide, all three within a few frames. | Exempt from the cull; lost only with a body. | `auditwe_raid` |
| L4-4 (= L3-1) | BLOCKER | The square and the way were read once off the runner's feet and a null kept for the raid: a player who walked or rode in found Siege and Exodus turned classic. | The raid's own town read off its pixel; a site not found is asked again. | `auditwe_raid` |
| L4-3 (= L3-2) | MAJOR | **No exodus could run in any of the game's 410 cities** - its way started off the streets. | The way starts on the city's street net (`gridStreets`). | `auditwe_raid` |
| L4-5 | MAJOR | The player's own harm reached refugees, and one blow turned a refugee hostile. | Spared by the player's swing, shaft and spell (`combat/friendlyFire.js sparedBySwing`, `sparedByPlayer`). | `auditwe_raid` |
| L3-4 | MAJOR | A takeover forgot what was said if this machine had run the raid before. | The runner's word folded into the raid as heard. | `auditwe_raid` |
| L3-5 | MAJOR | A leader taken over from a fallen runner was a plain raider. | The leader. | `auditwe_raid` |
| L3-6 (= L5-18) | MAJOR | A reader's "held" for an assault rode a word that raced the cleanse. | Read off the raid's own state. | `auditwe_raid` |
| L6-5 | MAJOR | With EnemyInfighting off the target machine undid every raider's aim: the standard never sacked, refugees never lost - every Standard and Exodus HELD. | A raid's goal its raiders' quarry first, whatever infighting reads (`enemyTargets.js huntsRaidGoal`, `RAID_GOAL_PRIORITY`); never once turned. | `auditwe_raid` |
| L4-6 (= L6-8) | MINOR | The bearer went through the watch's whole lifecycle - counted a defender, dismissed in a lull. | No part of it. | `auditwe_raid` |
| L4-7 (= L6-8) | MINOR | The raid's cached points never followed the floating origin. | They do (`raidOffsetAll`, beside the pool's). | `auditwe_raid` |
| L4-8 | MINOR | In six hamlets the square stood in a closed pocket. | Never a pocket. | `auditwe_raid` |
| L4-9 | MINOR | All three refugees stood on one point; a runner leaving kept its refugees and bearer. | A pace apart, the guide held until all stand; let go with the claim. | `auditwe_raid` |
| L3-7 | MINOR | A relay late-comer stood packs before the ledger answered. | It waits for the ledger. | `auditwe_raid` |
| L3-8 | MINOR | A Siege runner who stepped out before the cleanse lost "held". | Held off the raid's state. | `auditwe_raid` |
| L3-9 | MINOR | A peer's word was never checked against the raid's own kind. | Its own kind only. | `auditwe_raid` |
| L3-10 | MINOR | An assault wave never replaced a raider that could not be reached. | A stalled wave stands again. | `auditwe_raid` |
| L3-11 | MINOR | Lines said again after a load. | Off a saved high-water mark. | `auditwe_raid` |
| L3-12 | MINOR | A pause ate the assault's breather; the kinds stood foes at dt 0. | A paused frame stands nothing; the breather on the raid's clock. | `auditwe_raid` |
| L3-13 | MINOR | A peer's word never aged; overlapping words repeated lines. | Aged; lines off the high-water mark. | `auditwe_raid` |
| L3-14 | MINOR | The held thanks were rolled off the standing character's held list. | Held rides the receipt, for the character that fought. | `auditwe_raid` |

## Fixed - the words and the record (L5)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| L5-7 | MAJOR | In Czech the core rule said regeneration heals "at all" for the pause - its negation lost. | Both rows rewritten ("...neléčí vůbec", "...vůbec ne"). | the catalog's rows |
| L5-8 | MINOR | The leader's line began with a lowercase "the" composed in front of it. | The line's own article (`raid.leaderCharge`). | `test/systems/raid5_kinds.test.js` |
| L5-13 | MINOR | The event board's row overflowed with the kind and read awkwardly; the refugees' count read wrongly. | The kind in the row's title (`events.raid.titleKind`), the objective alone before the count; "{safe} of {of} safe, {lost} lost". | `raid5_kinds` |
| L5-14 | MINOR | Comments untrue: a `madeRulesTip` that does not exist, madeLevel's "unchanged", the map said to name a kind, `RAID_AIM_MS` that is ticks; the tile's "every rule" never said `unstuck`. | Each corrected (`RAID_AIM_TICKS`); the tile says `/unstuck`'s rule. | `test/ui/hud/eventrules_tile.test.js` |
| L5-15 | MINOR | `raid.kind.classic` and `raid.kind.staff` were never shown, in fourteen catalogs. | Dropped. | `test/systems/l10n1b.test.js` |
| L5-16 | MINOR | Boss-Traits' host table missed `scenes/world.js`; the Ketch's Warden was FLAGGED in the record and nowhere in `src`. | The table names the four hosts; the Warden's FLAGGED line stands in `scenes/ketch/ketchFight.js` (the Spire's seam is L5-4's, fixed); the open flags regenerated. | `test/bible/audit18_bible_docs.test.js` (the open flags) |
| L5-17 | MINOR | The draft pull request's description: a placeholder, the re-aimed records, three claims wider than the code. | Rewritten. | - |
| L6-9 | MINOR | Coverage: no test of the refugees on the wire or of a puppet raid leader; sites pinned by a regex and no mutant; test titles claiming mutants with no record. | `test/scenes/auditwe_wire.test.js` (two real pools: `rf`, the reader's stand and its stats judge, the leader on a reader's screen); `tools/mutants/auditwe_cover.json` - a record for every site and claim named. | `auditwe_wire`, the records |

Every new or changed line is in the thirteen in-session languages (`tools/l10nInSession.mjs`).

## The whole suite (A0, A1)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A0-1..A0-6 (= L6-1) | MAJOR | Six pins red at the snapshot: WORLD2's hit door, FEUD H4's own-line notes, CSA-K's harness, FOEBAR1's foe row, FONT3's floor (the trait line at 10 px), and RAID_KINDS declared twice (audit24). | Each moved with its PIN MOVED note; the kinds' order `RAID_KIND_ORDER`; the trait line at 11 px. |
| A1 | MAJOR | The suite on the fixed tree: fourteen pins the fixes moved - DEX5-5, REZ-BLOODLINE's harness (the Resurrect door's raise word), LW12, RVN10 and the drops audit (the cull's refugee), the revenant audit (`sparedBySwing`), RAID2 (a token pin that read the raise word's kind as a foes frame's field), RAID4b and STAFF-EVENT (the receipt's `held`), L10N1b (the catalog), SD3 (the raise kind and the realm's `raised`), STAFF-PANEL5 and AUDIT 39 (the paralysis gate's `playerHeld`), and the Spire's own (a death with a companion standing lies down first). | Each moved with its PIN MOVED note, the pin's intent kept. |

IT1 and WD1 (the ARENA2 patch hashes) are red on main with this ARENA2, unchanged by the branch. Four more - AUDIT 28 N9/N13,
GRANT3 THE READER, EG-PLAY THE CLIENT ON THE RELAY and PARTY-LOOT OVER THE WIRE - failed only under the whole suite's load
and pass run alone. The last whole-suite run was stopped short (the owner: "Skip the suite"); CI's `verify` runs it whole.

## Left, each with its reason

| ID | Sev | Finding | Why left |
|---|---|---|---|
| L1-11 (= L5-11) | MINOR | The made level's rules tile is the enhanced HUD's alone. | The classic skin is Daggerfall's own status row, which has no tile for any rule; its player hears each rule where it bites - a refusal's own words, the death's card (`Elite-Gates.md` section 24). |
| L2-12 | MINOR | A companion's, a watchman's or another foe's blow takes no striker's half. | The traits answer the player's blows: a departure of degree, written (`Boss-Traits.md` section 2). |

## Not reproduced

| ID | Finding | Why |
|---|---|---|
| L5-3 (= L6-2's third case) | "A raise sends no hello, so the Hour's rise never comes." | The dead page leaves the realm's room (AUDIT ONLINE D12, the world host's death branch `online.leave()`), and its rise rejoins with a hello. The census half of it was real, and is L1-2. |
