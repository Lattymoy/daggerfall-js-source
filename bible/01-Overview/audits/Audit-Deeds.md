# AUDIT DEEDS (2026-10-23) - Deeds and Talents, audited

The owner, of the DEEDS branch (`06-Systems/Deeds-And-Talents.md`; the branch at 583365f37): **"Audit this"**. This page
lists the findings, each with its verdict. What the audit changed is written into the design page's sections as they now
stand, each change marked AUDIT DEEDS and its id.

## How it was run

Four cold lanes. Each was an adversarial reader of a FROZEN snapshot (a git worktree at 583365f37, per Home.md's DO NOT
FIX WHILE THE VERIFIER IS READING), and each was told to reproduce a finding with the real code before reporting it.
Beside them ran the whole suite the change selects (`npm run test:changed`, 3,676 files, ARENA2 fetched): 32,209
tests, 74 failing. Every finding was read again by the author before it was acted on.

| Lane | Over | How |
|---|---|---|
| A - the prices | the two tables, the live multiplier, the chargen window, every career that reaches it | the real CLASS00-18.CFG through `formats/classFile.js`; the encounter tables and the loot rolls re-measured |
| B - the four advantages | Regenerate, Adrenaline Rush in both cores and the blow seam, Athleticism, Acute Hearing's compass | the real Acrobat career against the real `weaponAttackDamage`; 20,000 seeded `resolveDuelStrike` swings; the detect feed |
| C - the party | the pose's `tk`, the relay's bump, care, revival, the tongue, cover, the haggle and the quest purse | every quality, cost and skill to 240 through the online haggle; `hurtPlayer` with a spared blow |
| D - the deeds | the tallies, the slots, the fold, the save across builds, the sheet | real SPELLS.STD and BLOCKS.BSA casts; the base build's own `save.js` (HEAD~1, `git archive`) re-saving a new save |

The scratch scripts are the session's (`scratchpad/laneA` to `laneD`); none is committed.

## The findings

| id | severity | finding | verdict |
|---|---|---|---|
| SUITE | HIGH | 74 tests in 39 files failed. The switch is on by default, so tests that pin Daggerfall's own laws read the new ones (Adrenaline Rush, Athleticism's fatigue, the haggle, the quest purse, the chargen prices). Host harnesses lacked `haggleOf` and `rezHealthPct` in their scope. Source sweeps still pinned the literals the change retired. The registry's count pins and the options map did not know the new row. The account Worker's deploy filter did not list three new files it bundles. `samePlace` and `deedsOf` were declared twice with different meanings. Eleven new sentences were in English only. | FIXED: each test that pins another law switches the arc off and says why; the harnesses, sweeps, counts, map and filter were moved; `samePartyPlace` and `deedTallies` renamed; every sentence through `t()`, drafted in every covered language. |
| A1 | MEDIUM | A class built with the switch off was charged DFU's prices whenever the switch was on, while getting DFO's effects (built-off at x1.390 against built-on at x2.117 for the same class). | FIXED: the table that builds a class prices it for good (section 4.3). |
| A2 | LOW | A class built with the switch on could turn it off for a rest and train at DFU's prices (494 uses against 753). | FIXED: the price never follows the live switch (A1's fix). |
| A3 | LOW | The HUD re-derived the multiplier for every skill every frame (0.21 ms of 0.33 ms). | FIXED: no work without an overcoming, and a memo keyed on what decides it. |
| B1 | HIGH | Five tests in this lane alone failed (SUITE's). | FIXED (SUITE). |
| B2 | MEDIUM | The quarter-health rush and its harder blows reached foes carrying the bit (the Acrobat's class, the atronachs, the Dreugh, the Lamia): an Acrobat foe at 20/100 hit for 12 instead of 10, under the player's switch. | FIXED: the new laws are the player's alone; a foe keeps its core's law. |
| B3 | MEDIUM | The rush's 20% reached refereed fights through the duel sheet's game health (+19.6% a hit at 24/100). | FIXED: never by a peer's sheet, never at a player or a warded body. |
| B4 | LOW | Hearing marked the player's own companion, defenders on the player's side and calmed foes. | FIXED: hostile foes alone (Detect Enemy keeps DFU's own reach). |
| B5 | LOW | No pin held the blow seam's registration, the climb's +15, or the hearing/Detect de-duplication. | FIXED: pinned by execution (`deeds_talents.test.js` AUDIT DEEDS). |
| B6 | LOW | The detect feed rebuilt its markers every frame though the scan moves every 0.33 s. | FIXED: built once a scan and a set of detectors. |
| C1 | MEDIUM | Care healed during an arena ladder bout: a spared blow never reached the hurt listener. | FIXED: care waits on every hurt's door-open word, and never runs in a refereed fight (an arena bout, a duel). |
| C2 | MEDIUM | The player's own skill was not held to the pose's ceiling, so worn Enhances Skill gear lifted the good word and care past the record's +20% at 200 (+35% at a live 350). | FIXED: held to 200, as a member's lent skill is. |
| C3 | LOW | A fallen member still lent care, cover, a tongue and a good word. | FIXED: only a member with health counts. |
| C4 | LOW | A questline's late settlement paid from the purse before the good word, short by the word's share. | FIXED: the word comes before the questline's scale. |
| C5 | LOW | A calm won by a partner's tongue tallied my own tongue as a success (x3), and the line said "your" skill. | FIXED: it tallies as an attempt, and the line names the party. |
| C-nit | - | Section 5.1 said "in SKILLS order"; Stealth stands second. | FIXED. |
| D1 | MEDIUM | Drinking a drug counted as a poison endured (120 Aegrotat, Tempered: Poison). | FIXED: a foe's dose alone. |
| D2 | MEDIUM | A spell counted once per Damage Health effect and once per round of a lasting one (one Wildfire: 31 of 40). | FIXED: once a landing, at the end of `applySpell`. |
| D3 | MEDIUM | An older build's load and re-save wiped every deed, tally and overcoming (`deeds` is a key it never knew). | FIXED: the career carries a mirror for its own character, as the martial path's does. |
| D4 | MEDIUM | Tempered: Magic, and climbing out of a magic weakness, were unreachable: no Magic damage reaches a player in stock play. | FIXED: every hostile spell counts by its element, damage or not (Paralysis, Silence, Sleep). |
| D5 | LOW | The blood's resistance was not counted as carried: a Breton could earn Tempered: Magic. | FIXED: the birth race's tolerances block the deed, as the record says. |
| D6 | LOW | A deed a disadvantage held back was hidden, with no progress shown. | FIXED: shown as blocked, with its tally and what it waits on. |
| D-nit | - | A refereed fight's stand-in for a peer could tell the endured leaf. | FIXED: the leaf hears the player alone. |

## Recorded, not changed

- **The shipyard's sell-back offline** pays more than it charges at Mercantile 62 and Personality 50 (`shipWorth` uses
  the hull's list price, and LAW-3 does not cover ships). It predates this branch, and the online law shuts it. The good
  word lowers the threshold to 58 (+10) or 55 (+20). Its fix is the shipyard's, not this arc's.
- **WD1 with ARENA2**'s vendored-patch hash (`wd1_worlddata.test.js`, Immersive Travel's WALLAA08) fails on the base
  commit too, without this branch. It is an ARENA2-only test that CI runs without data.
