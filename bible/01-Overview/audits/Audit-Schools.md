# AUDIT SCHOOLS (2026-10-13) - the Arcane Specialisations, audited

The owner, of PR #880 (SCHOOLS - `06-Systems/Arcane-Specialisations.md`; the branch at 2c40b7f5): **"Lets do a
comprehensive audit on everything"**. This page is the findings, each with its verdict. What the audit changed is
written into the design page's sections as they now stand, each change marked AUDIT SCHOOLS and its id.

## How it was run

Five cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 2c40b7f5, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding against the code before reporting it; then every finding
reproduced again by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| L1 - the law and the powers | `arcanePaths.js` and `arcanePowers.js`: every passive and rider against its words and its seam, the line crossings, the reach, the merges, the refunds | each repro through the real cast engine and the real seams (`lane1/r*.mjs`), the test file's own helpers |
| L2 - the spell engine's edits | `effects.js`, `spellPower.js`, `spellcost.js` and `hostMagic.js`: who a school's climb reaches, what freezes, which doors tell the riders, what the price reads | the real `applySpell` and cast engine over a chargen'd mage online, items, duels and mentoring (`lane2/*.mjs`) |
| L3 - online integrity | the judge, the save across builds, the Worker's graph and deploy filter, the wire, the indices, the price | the 455a8d54 `save.js` restoring and snapshotting a new save, the Worker's import graph walked old and new, a hundred spells minted after a load (`lane3/*.mjs`) |
| L4 - the surface and its words | the one ask, the classic sheet, the enhanced card, every English line and six languages, the wire's label | `raisePlayerSkills` and `CharSheet` in node; the enhanced card in Chromium at 360 and 1280 px in four languages (`lane4/specProbe.mjs`) |
| L5 - pins and records | the gates, the committed mutants, what the pins cannot fail, the record against the code | 58 scratch mutants against the suite and 10-39 wider suites each, the nine whole lists the arc moved, the gates |

The scratch scripts are the session's (`scratchpad/lane1` to `lane5`); none is committed. No lane found a way for a
path to act for anyone but its own holder, at a player, or in a refereed fight, and no honest save the judge could
freeze but one (L3 F2). The findings are powers that reached too far or counted too much (the arcs onto allies and
through walls, a class foe burned as undead, overkill and per-foe stacks, a refund for a foe already calm), merges that
swallowed a rider or capped the player's own cast, an older build's save that lost its permanent choice and froze its
trade, a mentored price that turned into Destruction's, doors that never told the riders, a classic key the box named
and the sheet no longer answered, and pins that held less than they said: plausible mutants of the arc's lines
survived its suite in every lane's sample.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1 H1 / L3 F1 | HIGH | Rift Lance and Chain Lightning arced onto my summons, foes I calmed, guards not yet hostile (a stray arc turned the town) and foes behind walls, by distance and rise alone; Chain Lightning's arc ignored a foe's shock immunity | FIXED: the loot's one reach law (`lootPowers.js` near, exported - `friendlyProtected`, `REACH_RISE_M`, the host's wall test) and its element share (`elementShare`, now with magic's flag), no second copy (`NEAR_RISE_M` gone) |
| L1 H2 / L5 H1 | HIGH | The Lightbringer read a class foe's `careerIndex` as a monster's: a Barbarian (15), a Knight (17) and the City Watch (18) were undead to Dawn's Ward and Dawnbolt's second burn; the test's hand-built foes hid it | FIXED: the loot's one foe group (`foeGroup` - Human first); the pins' foes minted by `makeEnemyEntity` |
| L1 M1 / L2 F1 | MED | A rider's bundle on me merged as the player's own: my 6-point Shield swallowed every Aegis Bolt after it (the first bolt of a chain capped the rest), a rider's 40 capped my own 140 Shield cast after it, and Sanctify's ward the same both ways | FIXED: a POWER'S bundle (`castOnPlayer` with `power`, `effects.js` powerCast and the entry's `bundlePower`) merges as DFU's incumbents do and takes the larger pool or chance; every reader keeps DFU's first match (X11 - a separate entry and max-reading readers broke its pin and ALLY-CAST's, and were taken back); between two plain casts DFU's law stands |
| L1 M2 | MED | The Warden's guard left health fractional (183.2 after three 7-point blows) | FIXED: whole points, the fraction carried, as Hold the Line |
| L1 M3 | MED | Foresight ran as a damage modifier after the sets': a foreseen blow spent Iron Hide's ward, Gearward's winding and Hold the Line's carry | FIXED: a BLOW EVASION, asked once a foe's blow reaches the door and before any modifier (`playerEntity.js` registerPlayerBlowEvasion) |
| L1 M4 | MED | Absolution (and Slip Away) answered a death a death save had turned aside - a heal and a 3-minute recovery spent on a death that never happened | FIXED: `saved` read, the Vigil's and Shed Skin's own rule (AUDIT 625 P1) |
| L1 M5 | MED | Beguile refunded a foe already at peace and one with no mind to calm: five free casts at a calm knight, each training two schools | FIXED: only a foe hostile before the cast, with an `ai` the host calms. A guard on `pacifyImmune` written beside it was redundant (`effects.js` refuses the sway, so `pacify` never comes back) - its mutant survived the run and the guard was taken out |
| L1 M6 | MED | "What it lands" counted overkill: Siphon Life on a 3-point rat healed 95, Soul Lance turned magicka-positive on weak foes | FIXED: the landing tells `took` - what the target could lose (`hostMagic.js` tookOf) |
| L2 F2 | MED | A worn item's bundle took the wearer's school past 100: a Cast When Held ward at 70 instead of 50, kept past a duel's start and a mentoring until the item's reroll; Troll's Blood the same | FIXED for a held item (`noSchool`): its bundle and its Regenerate take no school. A Cast When Used item's one-shot spell is my cast and takes it, as BAL9's procs do - KEPT, recorded on the design page |
| L2 F3 | MED | A Regenerate's potency was fixed at the cast: cast before a duel or a mentoring, it kept x1.4 through both | FIXED: its rounds read the school live, as a damage over time's do. KEPT: a Shield's pool and a ward's chance are fixed at the cast by DFU's own law (a recast merges into the incumbent), as BAL9b's are |
| L2 F4 | MED | The relay's stand-ins (the Burning Court's Warden, crystals and host; the serpent's hide) landed my spell through `applySpell` alone: no rider, no Conflux there | FIXED: each tells the landing (`dungeonContext.js` tellStandIn, `world.js` serpentSpellOn) with the cast's wrapper and no foe record |
| L2 F5 | MED | Mentoring flipped a signature spell to its own school: a Necromancer's Siphon Life went from 9 magicka to 105 on joining a lower party, and trained Destruction | FIXED: a path HELD (`pathHeld`) prices, teaches and sells; AWAKE (`pathAwake`) adds the mentoring gate for the powers alone |
| L3 F2 | MED | An older build (no `arcanePath` in its save, a signature spell saved whole) erased the permanent choice, and the judge then froze the honest player's trade - and the new build asked again: a respecialisation door | FIXED: the judge judges what grants the powers alone (the path's two schools mastered), never a spell; a restore with no `arcanePath` key whose book names one path, both schools mastered, gives it back, already asked (`pathWitnessed`) |
| L4 H1 | HIGH | The classic box said "No, then S, for the next", and S did nothing: the plate had closed under the box (and SOFTCAP6's "No, then M" the same) | FIXED: the plate stays behind a choosing box; both keys reach it |
| L4 H2 | HIGH | English said "Become a Elementalist?", "You are now a Enchanter", "You are already a ..." | FIXED: "Specialise as {name}?", "Specialisation chosen: {name}.", "Your specialisation is already chosen: {name}." - no article |
| L4 M1 | MED | The one ask offered only the first open path in table order, and Yes was permanent (Riftwalker asked, the post's own Necromancer never) | FIXED: one path open is asked about; several are named in an OK box sending the player to the skill screen |
| L4 M2 | MED | Meaning errors: de, fr and es sold the GUILD's signature spell; ko's Sunder read as a penalty to the player's own saves; de and es narrowed "a hurt" to a blow | FIXED in the redraft, and the same "its" ambiguity in eight more languages; every rider and passive line redrafted in the thirteen |
| L4 M3 / L5 M6 | MED | Design section 3 named "the M row on the sheet's front page"; the code is an S row on each skill page. (The commit had no patch notes: they are the pull request's description's, as CLAUDE.md says, and #880's carries them) | FIXED: section 3 as the code stands |
| L4 L1-L3 | LOW | Slip Away and Absolution said "leaves you under" (the code answers a crossing); Prismatic Ward's "40% of the time" (nothing at full magicka - DFU's second gate); Beguile's "gives its magicka back" read as the foe's | FIXED: "takes you below", "while your magicka has room for it", "returns its whole cost in magicka" |
| L4 L4 | LOW | A signature spell's name was minted in the buyer's language: the wire's printable-ASCII label sent a Russian or Korean name as nothing, and a language switch split the book from the shelf | FIXED: minted under its English name, shown in the player's language (`loot.js` shownSpellName, by the index band; a name the player gave stays theirs) |
| L4 L5 | LOW | The enhanced card at phone width: a 120 px text column, ten lines a path in German, a long name spilling | FIXED: `px-spec` stacks its side column under the body on phones (`enhancedStyle.js`); not re-measured in Chromium after the fix |
| L4 L6 | LOW | "Choose a specialisation  (S)" - 28 characters on a 126 px plate | FIXED: "Specialise  (S)"; the translations run 8 to 19 characters, inside the plate's own Master Skills row's 22 |
| L4 L7 | LOW | S is DFU's `CharacterSheetSpellbook` hotkey, which the port's classic sheet does not wire today | KEPT, recorded on the design page (section 9) |
| L4 L8 | LOW | The enhanced card never named the two schools or where the spell is sold, and told a class that can never meet a path to master two schools | FIXED: each path with its schools; the sold line; no card for a class with fewer than two schools in its career (`pathPossible`) |
| L3 F4 | LOW | A book holding Shared Cartography (-46001) stepped the maker's next index into the signature band: the hundredth made spell took Aegis Bolt's index, and the quickslots (keyed by index) showed one of the two | FIXED: `spellMaker.js` READY_MADE_INDEX_CEILING (-45000) - every ready-made band at or below it, a made spell never; the seed steps past made spells alone |
| L3 F5 / L5 H5 | LOW | The indices were pinned relative to the base, the slots not at all: a moved band orphans every bought copy | FIXED in the pins: every record literal, index and slots |
| L1 L1 / L2 F6 | LOW | Conflux counted every foe an area spell swept (five stacks from one Fireball) | FIXED: the cast's TOKEN, minted at the release and carried by every landing of it - one stack a cast. KEPT: a Cast When Strikes proc is its own cast (BAL9's "my spell") |
| L1 L2 / L2 F7 | LOW | Unravel's and Beguile's refunds re-priced at the landing (the loot's mastery cut moved it; a free ready refunded magicka never spent); the documented `cost` was never sent | FIXED: the token's `cost`, what the release charged (0 for a free ready) |
| L2 F8 | LOW | The standalone dungeon page (`?dungeon`) built the cast engine without the paths' powers - their price and potency alone | FIXED: `hostMagic.js` imports `arcanePowers.js`, so every page that builds the engine has them (`world.js`'s and `exterior.js`'s own imports gone - one home) |
| L2 F9 | LOW | My own spell a foe turned back at me took the self potency; the Comprehend Languages exclusion had no pin | FIXED: a turned-back spell takes no school (`noSchool`); the exclusion pinned |
| L1 L3 | LOW | The powers' memory outlives a character switch by its windows' seconds | KEPT, recorded: the sets' and the loot's shared pattern |
| L1 L4 | LOW | "No refereed fight" is a duel and arena PvP; in a siege or the Wild Zone the price and speed passives act | KEPT, recorded: the loot's Focus does the same, and no defensive passive reaches the referee's bar |
| L3 F3 | LOW | A forged save listing both schools mastered gets the path's powers with no finding | OPEN, the owner's (SCHOOLS section 9): judging the masteries freezes pre-SOFTCAP4 saves; PvE only |
| L5 H2 | HIGH | Nothing pinned the page hosts' imports of the powers | FIXED: one import, in the engine, pinned |
| L5 H3 | HIGH | The one ask and every choosing door (classic, enhanced) were unpinned: eleven mutants survived the suite and 31-33 wider ones | FIXED in the pins: the ask driven, the classic sheet's S row drawn and pressed, the enhanced pause window mounted and pressed |
| L5 H4 | HIGH | Steadfast was called directly, its seam (the magic round) never | FIXED in the pins: through `runMagicRoundsFor` |
| L5 M1 | MED | Fifteen numbers pinned on one side of their line | FIXED in the pins: each line just under and at it, each window just before and after, each recovery a second short and on the second, Aegis Bolt under its cap |
| L5 M2-M4 | MED | `pathCastSchool`'s pair rule and tie, Chameleon and Shadow past 100, and five rider guards unpinned | FIXED in the pins. The reflected-landing guard is recorded EQUIVALENT: a turned-back spell reaches the riders only as a self landing of a ranged spell, which `self`'s range law already turns away (pinned through a real Spell Reflection) |
| L5 M5 | MED | `reset()` never zeroed the heal and magicka carries; clock, dice and duel set without a finally | FIXED: every test hook reset at each test's start (`schools_arcane`) and at both ends (`audit_schools`) |
| L5 M7 | MED | "By execution" overstated: the shelf and the tally are text pins | FIXED: the record says which are text |
| L5 LOW | LOW | A vacuous line; a made-up reflected shape; Soul Well's Watch and ended trap, the listener that throws, Comprehend scaled - survivors | FIXED: the line and the shape gone, the rest pinned. Recorded unreachable today, no record: a self rider on a failed chance (no self-cast signature effect can fail its chance), a self perk for a peer, a damage over time forgetting its school (no signature spell carries one) |
| L5 LOW | NIT | The design page's PIN MOVED list was short (`spellbookwindow`, `serpentset`); `spellPower.js` called itself a leaf (sigil.js reaches 145 files - none back, so no cycle); the landed doc named a `cost` nobody sent and none of what was sent; `SIGNATURE_INDEX_BASE`'s comment claimed a band the seed walked into; Balance-Arc's "other schools" change sat under RECORDED, NOT CHANGED | FIXED, each |

## Pinned

`test/systems/audit_schools.test.js` (28) - every FIXED finding above, by execution through the producers that mint the
shapes in play (design page section 10 names them). Mutants: `tools/mutants/audit_schools.json` (95, the audit's) and
`tools/mutants/schools.json` (65, the arc's - twelve re-aimed by content, one replaced: the judge reads no spell now,
so its record is the unknown id's), every one dead but the reflected-landing guard recorded equivalent (L5 M4); and
by content `wb4b.json`'s three, `fb1001_regen.json`'s three and `stackcap.json`'s two (one aimed at the Shield arm's
one site, the ward arm now sharing its line), every list run whole: dead. PIN MOVED (AUDIT SCHOOLS): the cast's wrapper
and token in `serpent4`, `wb11_gate_host`, `wb9c_gate_reckoning`, `wb4b_gate_blows`, `auditwbx`, `audit24_scenes` and
`x3casting`; the door's `castOnPlayer` and its `power` word in `set2_seams` (`auditwbx`'s and `set2_seams`' found red by
the pull request's CI, the only two of its whole run).
The first run of the two lists left three survivors - the redundant `pacifyImmune` guard (taken out), the
Comprehend Languages pin cast at the wrong school (Comprehend is Mysticism's; re-cast), and the arc's reflected-guard
record, whose own pin had been the made-up shape (recorded equivalent, its real path pinned). The second left one:
the rider-at-a-player guard, whose pin read a door the test had already replaced (the reflected check beside it was
as blind) - each check now reads the door it set, and the four guards' records were judged again: dead, and the one
equivalent as recorded.
