# AUDIT MARTIAL (2026-10-17) - the Martial Specialisations and BAL10, audited

The owner, of PR #990 (MARTIAL + BAL10 - `05-Combat/Martial-Specialisations.md` and `05-Combat/Balance-Arc.md` section
16; the branch at 3866fefae): **"Please audit and ensure everything is perfection"**. This page is the findings, each
with its verdict. What the audit changed is written into the design page's sections as they now stand, each change
marked AUDIT MARTIAL and its id.

## How it was run

Five cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 3866fefae, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding against the code before reporting it and to hunt every
analogue of AUDIT SCHOOLS' findings (`Audit-Schools.md` - MARTIAL was built as SCHOOLS' twin); then every finding
reproduced again by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| L1 - the law and the powers | `martialPaths.js` and `martialPowers.js`: every passive and rider against its words and its seam, the reach, the foe kinds, the lines, the riders' doors, the Chameleon, held and awake | real foes (`makeEnemyEntity`), the real `resolveHit`, `playerArrowHitFoe`, `calculateAttackDamage`, `hurtPlayer`, `reportPlayerKill` and the cast engine's door (`lane1/r*.mjs`) |
| L2 - the engine's edits | `weaponMastery.js`, the swing pace and its three arms, BAL10's fists, the technique runner's signature, the landing's tell, the Firmament's retune, the rig | every weapon the item maker mints through the real swing arms; TECHFX1's own frame measure; the relay's stand-ins (`lane2/*.mjs`) |
| L3 - online integrity | the judge, the save across builds, the Workers' graphs and deploy filter, the wire, refereed fights and PvP, the relay's caps and stand-ins, mentoring | the base build's (fd3f54876) real `save.js` restoring and re-saving a new save; the relay's real `gateBrain.js`; the repo's own `importGraph.mjs` (`lane3/*.mjs`) |
| L4 - the surface and its words | the one ask, the classic W row, the enhanced card, every English line, the thirteen languages | the real `raisePlayerSkills` and `CharSheet` in node; the enhanced card in Chromium at 360 and 1280 px in eight languages; FONT0003's own advances (`lane4/*.mjs`) |
| L5 - pins and records | the gates, the committed mutants, what the pins cannot fail, the record against the code | 68 scratch mutants against the arc's suite and 10-15 wider suites each; the committed lists run whole; the gates (`lane5/*`) |

The scratch scripts are the session's (`scratchpad/lane1` to `lane5`); none is committed. No lane found a power that
acts for anyone but its holder, at a player, or in a refereed fight; no rider that reaches past the foe its technique
struck (SCHOOLS' L1 H1 has no copy here); no foe kind read outside the loot's `foeGroup` (L1 H2 none either); no wire,
judge or Worker the arc moved. The findings are guesses the riders made before the pool's door decided, windows that
opened mid-sweep, a count of shafts for a count of foes, a permanent choice an older build could erase, a placeholder
health read as a real one, allocations a frame, words the screen could not hold or the code did not keep - and pins that
held far less than they said: 59 of lane 5's 68 plausible mutants survived the arc's suite and its wider ones.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1 M1 | MED | The riders judged "a foe it fells" and what a blow LEAVES before the pool's own door landed it - and the door may land less (a party's toughness, the foe's Shield, a bout's floor): the Woodsman healed for a foe still standing, Thousand Cuts skipped a foe that survived, Gutting Lunge fired on one left above 25% | FIXED: nothing guesses. Felling Strike heals at the kill seam within the loot's felling bound (`lootPowers.js` TOLL_REFUND_S - the Undertow's law); Gutting Lunge reads the health before the blow ("already under", the words moved); the second blows go as the loot's `again` does, the door deciding (a corpse takes no blow - AUDIT 68 S19/S20) |
| L1 L1 / L2 F6 / L5 M5 | MED | Windstrike's "from at most 3 foes" counted SHAFTS: one foe under two shafts of a volley paid twice and spent the cap | FIXED: the press's token counts distinct foes (`foeOfUse`); Judgement and Vanishing Strike by the same count |
| L1 L3 / L2 F4 / L1 L7 | MED | A rider's window opened at the LANDING, inside the sweep that opened it: Rallying Cleave's +15% on the cleave's own 2nd and 3rd foes (never its 1st - the pool's order decided), Savage Whirl leeching its own later blows; and four riders' words promised the window "for N seconds" on the press, the code only on a hit | FIXED: the five windows open as the press goes (`techniqueBlow.js` registerTechniqueUsedListener, told by the runner's `pay`) - a sweep's every foe and a whiff alike; Rallying Cleave's words say so |
| L1 L2 | LOW | Flowing Steel took a stack from every off-hand blow (TWO-HANDS AUDIT 2's `info.blow` unread), which the loot's Flow honours | FIXED: a whole blow alone. KEPT: a sweep's foes each a stack (the words: "each blow that lands"; the loot's Flow the same) |
| L1 L4 | LOW | Savage Whirl's leech counted the overkill (a 21-point blow at a 3-point rat healed 2) | FIXED: what the foe could lose (AUDIT SCHOOLS L1 M6's `took`). The loot's own leech has the same overkill - recorded on the design page, its arc's |
| L1 L5 | LOW | The riders fed on the City Watch and my own allies (a summon felled healed the Woodsman; my raised skeleton took Hallowed Strike's burn), which every kill power refuses | FIXED: `neverCounts` at the landing |
| L1 L6 / L2 F2 / L4 L2 | MED | A signature's HUD chip built the path's six lines every frame through the name's getter - about 4.9 KB a frame at rest (TECHFX1's bar: 2) | FIXED: the name kept a text revision (`textManager.js` textRevision); measured 0.1 bytes a frame, pinned by TECHFX1's own measure in a child |
| L1 N1 | NIT | A follow-up owed to a body the relay runs showed no number | FIXED: the number before the record's branch, as the loot's `again` (ROSE-SEEN) |
| L1 N2 / L2 F10 | NIT | The page said Rallying Cleave strikes "an 80-degree arc"; it is a half-angle (160 degrees) | FIXED: the page |
| L1 N3 | NIT | Lines saying "blows" paid on arrows too (Cheap Shot, Frenzy, Flowing Steel, Rallying Cleave) | FIXED: "blows and arrows" / "blow or arrow" |
| L3 F1 | MED | An older build re-saving a new save dropped `martialPath` and `martialPrompted`, and the new build asked again - a second choice of a permanent one among every pair the masteries open (an un-updated desktop app, a tab open across a deploy) | FIXED: a mirror in the one record every build carries whole (`career.martialMirror` `{ path, of }` - the character's id beside it, so an heir's inherited custom career gives nothing), read back only from a save with no `martialPath` key, already asked; the live career never holds it |
| L3 F2 / L2 F1 | MED | MARTIAL2's half line read the relay's stand-ins' placeholder health (1e9 of 1e9) as full: the hammer took x1.8 on every blow of every boss fight, the axe never its own (the Warden, his crystals and host, the Remnant, the Elite Gates' court, the serpent) | FIXED: the stand-in says so (`gateBoss.js` bossStandIn `relayHealth`) and the line is unread there - each half pays the halves' mean, x1.4. KEPT: Gutting Lunge never fires on such a body (its share unread), as the loot's execute and Blood Boil do not |
| L3 F3 | LOW | Grit regrew health inside the courts whose law bars regeneration (WBX6) | FIXED: `regenBarred`. Found, not the arc's: the Firmament's `hpRegen`, the loot's `regen` and the arcane Steadfast do the same - recorded on the design page for their arcs |
| L3 F4 / L2 F8 | LOW | In a siege and the Wild Zone (no refereed fight) the PvP sheet read Light Step's and Windborne's attributes and a Short Blade master swung x1.4 at players | KEPT, recorded (design page sections 3 and 9): the sets' attributes ride the same sheet, AUDIT SCHOOLS L1 L4 kept the same class, the referees bound it; FIRM1 alone takes the sky off |
| L3 F5 | LOW | A forged save with every weapon mastered at 200 judges clean and takes every weapon's past-100 bonus in PvE | OPEN, the owner's (SCHOOLS L3 F3's question): a 2/2/1 judge check caps a forgery at the honest most and moves the account version |
| L2 F3 | LOW | The swing's pace allocated every swing frame: a mod's arm re-read the swing for every wielder, and the climb's milestone loop iterated | FIXED: a modifier reads the weapon only once it may pay (the Short Blade's climb first, then `swingLaw.js` swingFamily - no record built); `milestoneBonus` indexed. A Short Blade master on Items' arm 520 -> 280 bytes a frame (its baseline 232-264) |
| L2 F5 | LOW | A signature's shaft into the sea serpent's hide took no weight from its form and told no rider (SCHOOLS L2 F4's spell, for the shaft) | FIXED: `arrowFlight.js` shaftOnRelayBody - weighed, told, and what the blow owes the body (a rider's, the loot's echo) riding the hand's one claim; `world.js` serpentArrowOn changed in one line, the host not grown |
| L2 F7 | LOW | The Stats page's estimate ran every stateful blow modifier ~500 times a build - carrying their fractions and spending the sets' next-blow windows (Riposte, Battlemage's Discipline): opening the page moved the real blows after it (since SET2 for weapons; BAL10 widened it to the fists) | FIXED: `info.estimate` - every blow modifier (the sigil, the sets, the loot, the sky, the paths, the weapons past 100) answers it and keeps nothing |
| L2 F9 | LOW | BAL10's skill notables traded real stats for skill lines that buy a mastered fighter nothing online (to-hit clamps at 97) | FIXED: each keeps every stat it had, the skill beside it (FIRM2's caps hold) |
| L2 F11 | NIT | Roleplay & Realism's own swing arm kept a long blade's Speed-and-Strength blend for a short blade | FIXED: the dagger's blend too, whatever draws it |
| L4 M1 | MED | The line a Yes says ran ~100 characters past the classic screen's 312 px, unwrapped (the sheet's notice and the HUD) - in fr, de, it and pt-BR the technique's name was what fell off; the arcane line's spell sentence did the same | FIXED: "Martial specialisation chosen: {name}." and "Specialisation chosen: {name}." - the key's and the spell's sentences are the card's and the OK box's; every path in every whole Latin language pinned by FONT0003's advances |
| L4 L1 | LOW | The classic Minor page with Hand-to-Hand and both specialisation rows reached 204 px of 200 | FIXED: the plate never passes the screen's foot |
| L4 L3 | LOW | `martialPossible` (and the arcane `pathPossible`) counted career skills, not mastery slots: two both minor - one slot - showed the card for good | FIXED: `masterSkills.js` masterableCount, both |
| L4 L4 | LOW | The martial ask's title was the arcane ask's, word for word ("Specialise as X?") | FIXED: "Martial specialisation: {name}?" |
| L4 L5 | LOW | de, es, fr, it: Judgement's area blow read as the FOE's ("a foe who strikes every foe"); it: Gutting Lunge the same | FIXED in the redraft (and every changed line redrafted in the thirteen) |
| L4 L6 | LOW | The words never said a weapon's own technique wins; and with the ladder off, a lined weapon refused the key with the ladder's words though the signature needs no ladder | FIXED: the key's line says it; a found line asleep leaves the key to the signature |
| L4 N1 | NIT | The runner's English-only status lines carried the localised signature name ("Mal der Jagd is not ready") | FIXED: a form's `en` |
| L4 N2 | NIT | Two path names repeated Firmament stars (Bladedancer / Blade Dancer; Windrunner / Wind Runner, whose line matched the Bladedancer's passive) | FIXED: the Skirmisher and the Strider (the ids stand - a save's) |
| L4 N3 | NIT | "takes it 2 times"; Hallowed Strike's mace never said its +25 to hit | FIXED |
| L5 H1 | HIGH | BAL10's fixes were unpinned where they run: either core's fist result could be discarded, the overhaul's host word dropped, and both mods' arms' short-blade word were text pins | FIXED in the pins: a +7 probe through both cores' outer calls, landing whole with the host's word; the mods installed as they ship, the frame the dagger's |
| L5 H2 | HIGH | The one ask, the classic W row and the enhanced card were text pins (AUDIT SCHOOLS L5 H3 again): 13 survivors | FIXED in the pins: `raisePlayerSkills` with one, three and an arcane ask due; the sheet drawn, W pressed round the pool, the row clicked, Yes, the about box; the enhanced model and the pause window driven |
| L5 H3 | HIGH | The magic round and the strike listener were never driven - both registrations could be deleted | FIXED in the pins: Grit through `runMagicRoundsFor`; Opening Strike, the leech and Flowing Steel through a real landing |
| L5 H4 | HIGH | The press's token and the signature's blow were hand-built in every pin | FIXED in the pins: a real press's blow (the mace's 1.5, +25, single, the token), a cyclone's two foes told with it, a leap's blow and a volley's every shaft carrying it |
| L5 H5 | HIGH | The never-at-a-player, never-the-ward and never-in-a-duel gates were unpinned for the paths | FIXED in the pins |
| L5 M1 | MED | Lines and windows pinned on one side only (AUDIT SCHOOLS L5 M1 again) | FIXED in the pins: Stand Firm at, from and past its line, a saved and a killing hurt, ready at 180 s not 179; Frenzy at half; seven windows a hundredth before and after their ends |
| L5 M2 / M3 / M4 / M6 | MED | `signatureFor`'s held read and `martialHeld`'s two mastery reads; the City Watch and `mobileTeam` exclusions; the owed blow, the power's merge, the fatigue cap, a shaft told twice; the landing told the raw roll | FIXED in the pins - each through its producer, a landing with a real multiplier |
| L5 M4 (part) | MED | Thousand Cuts and Hallowed Strike on a foe the blow kills | DECIDED (L1 M1): no guess - the follow-up lands as the loot's does and a corpse takes no blow; the records were dropped with the guard |
| L5 M7 / L3 | MED | The record said more than the pins held; it never named the memory across a character switch, open PvP, or the stale "ladder off plays DFU exactly" | FIXED: the design page, Weapon-Techniques, Testing.md as the code stands |
| L5 L1 / L4 | LOW | The Thunderlock's pay, the resting hand, the signature's "ready again" line and feel; the "others" count | FIXED in the pins |
| L5 L2 | LOW | Test hygiene: a vacuous "it landed", a shared-entity write, toggles without `finally`, no end-of-file reset | FIXED: the probe's exact 7, the write gone, `finally`, `after()`; `_resetMartialPowersForTests` restores the clock and dice |
| L5 N1 | NIT | Two scratch mutants equivalent today (a negative pace; the stock core's foe-fist guard) | FIXED in the pins - both now die (a pace below nothing slows nothing; a foe's fists meet no modifier) |
| L5 N2 | NIT | The pace laid over a mod's `TryGetOverride` answer was no named departure | FIXED: named (design page section 9) |

## Pinned

`test/systems/audit_martial.test.js` (35) - every FIXED finding above, by execution through the producers that mint the
shapes in play: real foes (`makeEnemyEntity`), the runner's own press (`stepTechnique` over a real `PlayerWeapon`),
`resolveHit`, `playerArrowHitFoe`, both cores' outer calls, `hurtPlayer`, `reportPlayerKill`, `runMagicRoundsFor`, the
save, the relay's stand-in (`bossStandIn`), `shaftOnRelayBody`, `computeCombatStats`, both mods' arms installed,
`raisePlayerSkills`, `CharSheet`, `sheetModel` and the enhanced pause window; the HUD chip's frame by TECHFX1's measure
in a child. `tools/mutants/audit_martial.json` (112: every fix reverted, and lane 5's survivors re-aimed where the code
moved). PIN MOVED in `martial_paths.test.js` (the riders' windows by the press, Felling Strike's kill, Gutting Lunge
before the blow, a pre-arc save with no mirror, the notables' kept stats, the estimate's word, the ask's title, the
ladder-off signature) and `schools_arcane.test.js` (the chosen line). PIN ADDED for the estimate's guard in
`raid4b_sets`, `eg15_panoply`, `loot4_procs` and `sigil1`. 28 committed records in nine lists were re-aimed by content
(the lines they aimed at moved): `martial.json`'s 21, `audit0929_swing`, `audit_schools`, `eg15`, `firm1`, `loot4`,
`raid4b` and `swinglaw`'s one each.
