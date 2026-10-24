# AUDIT FB1018f (2026-10-18) - the day's second field bugs, read cold

Mac, of the branch for `01-Overview/bugs/Field-Bugs-2026-10-18f.md` (at fd57d382b7, before its pull request): **"Audit
everything first"**. This page is the audit: the ten fixes on the branch (HELD-BASE, SPELL-SCROLL, RELAY-SHARE,
DUNGEON-DIGITS, TURNED-BLOW, VAMPIRIC-WARD, HOUSE-BUSH, ROCK-SMEAR, WOD-SEA-TEST, CRAFT-LIMIT-SAID), the one not proven
(UNSEEN-KEEPER), their pins, their mutants and their records. Each finding has its verdict here. What it changed is
written into the pages it touched, marked `AUDIT FB1018f` with the finding's id, and in the code beside the fix.

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN head (fd57d382b7, detached worktrees - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING; a mutant edits files in place, so no two lanes shared a tree), told to reproduce a finding
before reporting it and to end on what it checked and found sound. Four stopped on a usage limit and were resumed on
the same head.

| Lane | Over | How |
|---|---|---|
| L1 | HELD-BASE and VAMPIRIC-WARD: the redraw's rolls, the save's repair, the realm ledger's reading of it, every heal of a landed blow | 7 findings; the real producer over DFU's table, 600 days of shelves pre- and post-fix, a real-shape pre-fix tome through `repairItemLists` and `ledgerStep` |
| L2 | SPELL-SCROLL and DUNGEON-DIGITS: the repaint helper, the book and the Chronicle in every dress and skin, the hotbar's gate | 8 findings; Chromium over seven viewports, the plain and grimoire dresses, the real hotbar listener under the dungeon's slot |
| L3 | RELAY-SHARE and TURNED-BLOW: every body the relay runs, the strike rule on both ends, every power a landed blow answers | 9 findings; the real relay brain and bodies through the real link into the real fight driver over a stub renderer |
| L4 | HOUSE-BUSH, ROCK-SMEAR, WOD-SEA-TEST: the town packs' blocks and rocks, the WoD loader and its sea arm | 8 findings; every block the packs carry whole, the pre-fix sources beside HEAD, 39 one-site mutants |
| L5 | CRAFT-LIMIT-SAID: the limit's law against the Worker's credit at every station, the words in every whole language | 9 findings; the real Worker, book and pages, two acts' batches raced |
| L6 | across them: the records' claims and cites, the seams two fixes share, the locales, the gates | 10 findings; 704 mutants judged, cross-fix mutants, 472 test files around the change |

Every finding was verified against the code before anything was fixed: a bug by a pin that fails on fd57d382b7 and
passes at the fix, a gap by its surviving mutant, a doc by the line it misstates. L1's and L4's were fixed on the
branch; L2's, L3's and L5's (with L6-6, L6-7 and L6-10) each by a lane of its own in a worktree off the branch, then
merged.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L1-1 | HELD-BASE's load repair moved a held piece's base, and with it its ledger print (`templateIndex:material`, `judge.js` ledgerPrintOf); the realm ledger reads a print that moved as forged (`ledger.js` ledgerStep) - a law hold on an honest character at its next checkpoint. Reproduced on a real-shape pre-fix tome: `271:-` before the load, `133:-` after, `forged: [its uid]` | FIXED by taking the repair out: the mint alone is mended, a piece already held keeps its base. Pinned on the real ledger (stamped, checkpointed, loaded: its print unmoved, nothing forged). Held pieces are not mended (decided). RARITY-WEAR's older 140-to-133 repair had the same gap for a Wand the service held through it: FIXED - the ledger takes that one move as the piece (`lootRarity.js` rehomedPrint), pinned |
| L1-2 | The Mace of Molag Bal still drained Strength or magicka off a warded blow (VAMPIRIC-WARD's sibling): 20 blows into the Warden's ward gave +62 Strength | FIXED: `artifactEffects.js`'s guard reads the ward; pinned beside VAMPIRIC-WARD |
| L1-3 | Nothing pinned the redraw's and the armour fallback's arguments (the other gender, level 1): three survivors | FIXED: pinned, recorded, dead |
| L1-4 | `worksUnworn` was tested on 6 of 27 kinds: Feather Weight and Extra Weight alone read as needing wearing, Health Leech's Used flag (a cost) as working unworn, a mixed Used-and-held row stays on a Wand. Latent - MAGIC.DEF's regular rows carry none of these | FIXED: the whole table pinned (`CastWhenUsed`, `HealthLeech`, `SpecialArtifactEffect` work unworn), the comment corrected; a mixed row takes a wearable base (decided; `powersNeedWearing`: any row worn), pinned |
| L1-5 | Nothing pinned the repair's count or its reach past the pack | MOOT: the repair is gone (L1-1), its records with it |
| L1-6 | HELD-BASE's ledger row stands in section A ("Approved departures") but says "the departure itself is his to review" | DECIDED: both departures kept as built (Mac, 2026-10-19: "Stop with the decisions for me") |
| L1-7 | The record's "c4fa0b1, 2017" cannot be checked here (no DFU history); the old repair test's "pre-fix" tome was an armour mint relabelled | NOTED; the ledger pin uses the real shape (no material) |
| L2-1 | A key on an ancestor pane is load-bearing (the grimoire dress's Chronicle scrolls its `.px-qdetail` inside the keyed `.px-body`) and nothing pinned it | FIXED: pinned (same key keeps the child at 70, another puts it at 0), its mutant dead |
| L2-2 | After a delete the next spell inherited the deleted one's page scroll: the page was keyed by its row, which a delete keeps | FIXED: keyed by the spell's own index (a rename keeps the page, a delete misses); pinned |
| L2-3 | The book's CSS pins read the first matching rule, not the cascade: a later rule giving the body its scroll back survived | FIXED: each `.sb-shell` column rule stands once in ENHANCED_CSS and never in PLUS_CSS or UI_CALM_CSS; four mutants dead |
| L2-4 | The repaint's second pass mapped every element's path, building each step's sibling list - quadratic: one fold in a scrolled Chronicle of 500 notes ~400 ms in Chromium (1,000: ~1.4 s) | FIXED: a saved pane is found by walking down its own indices and checking that one element (69 ms; 121 ms - the unscrolled press's cost); pinned by key reads, three mutants dead |
| L2-5 | The record's first found-and-left reproduces: a digit in the frame a window opens fires a hotbar slot (the potion drunk behind the use-magic-item list) - the bar asked the HUD's last frame | FIXED: the bar's keys, mouse slot and the crossbar ask the host's own pause at the press (`input.js` hostPaused - the hooks every host hands the finger and the pad); eight mutants dead |
| L2-6 | The record's second found-and-left is reachable: Recall's prompt in the street's slot over ?world's dungeon arm leaves the bar its digits while the pad's crossbar stands down | FIXED by L2-5's one pause (keyboard and pad agree). Left: the enhanced HUD still paints under that window - drawFoes knows only the dungeon's slot, and the door would add a host line |
| L2-7 | "The pad's crossbar's too" overstated the fix: the crossbar already stood down under every dungeon window | FIXED in the record |
| L2-8 | Under the grimoire dress at phone width the stacked rail keeps 31% (40 rows 4,902 px tall); the pack book runs off-screen below ~480 px - both before this branch | RECORDED, not this slice's |
| L3-1 | For up to 2 s after a Court lord woke the screen turned blows the relay landed: the wake sent no phase, and `egLordAsleep` read the screen's `ph` off the next whole word (r1: 1.8 s warded, the relay landing 40) | FIXED: the wake says its first phase in that beat (`eph`, `egLords.js` egLordsWake); the link takes it as a wake, no phase card. Pinned on the first frame after the wake |
| L3-2 | A spell on a turned body still fed the arcane riders and popped a plain number: Siphon Life healed 380 of ten casts on a turned Harrier, the relay landing 0; Cast When Strikes still procced | FIXED: `pathLanded` and Cast When Strikes refuse a warded target; the three spell doors (`dungeonContext.js`, existing lines) pop their number by the body met. Pinned |
| L3-3 | The sets' strike answered turned blows: Battlemage's Panoply returned 200 magicka, Coilscale built 5 Constrict stacks that carried to the first real blows | FIXED: `setStrike` refuses a warded target; pinned |
| L3-4 | The screen judged a struck object at radius 1; the relay's objects are their own (0.6 to 2.2) - no generated object sat in the band (8,760 swept), but the law was two | FIXED: each body's radius rides beside its row (`ead`/`efs` `r`, egRadiusWire; wire.js egRadii) - not by kind (the Wellspring's spring is a rift of 2.2), outside the row so an older build drops it. Pinned |
| L3-5 | Headsman's Chop kept its own share and read the placeholder: a lord at a fifth got x1.20 for x2.00 - the RELAY-SHARE family not swept | FIXED: `techniqueBlow.js` reads healthShare; the sweep holds six readers. Pinned |
| L3-6 | The relay's storey refusal was not mirrored: a Harrier on an island 14 m up was offered, the relay landed 0 of five shafts, a leech healed the claim | FIXED: one law, `egStoreyApart`, called by egHitBody and egStrikeTurned (the body where its walk has carried it). The relayshare fixture's bodies, left at y 0 under an 18 m disc, now stand on the fight ground as the relay stands them |
| L3-7 | "The hit number says 'No footing' or 'Warded'" held for melee only: a turned shaft rang silently | FIXED: the turned shaft says its word, and so does a shaft into the Warden's ward (one line each, no host grows) |
| L3-8 | Pose lag: the screen judges this frame's feet, the relay the socket's last pose (POSE_HZ 10 plus transit) - at a platform's edge the two differ for about 100 ms | RECORDED in the record and Elite-Gates 11.7; only the relay's word of each blow would close it |
| L3-9 | Five survivors: a struck object's reader stale, the serpent's reader any fight and any day, the turn judged in plan, no feet saying footing, objects sent anyway | FIXED: each pinned (relayshare, turnedblow, law9_height's call sites), all dead |
| L4-1 | HOUSE-BUSH took 8 bushes standing in open ground: Beautiful Villages' TEMPBSE0 and TEMPBSC0 draw houses on their automaps that the blocks do not have | FIXED: a footprint counts only where a building of the block stands on it (`heldFootprints`, a subrecord's origin); 18 cells, not 26 |
| L4-2 | The sweep built its blocks with no subrecords, so it could not see L4-1, and its 16 locked the defect in | FIXED: the sweep carries the blocks' subrecords; TEMPBSE0's phantoms pinned |
| L4-3 | FLOW2's walk-versus-scan check named the dead `mapRegionIndex`, so the branch silently switched off its sea arm | FIXED: its tiles name `regionIndex`; three mutants now die there |
| L4-4 | "Nothing on the relay or the account service reads a WoD site" - the account service's camp claims (`seatHolding.js` claimBounty, `seatInfluence.js` claimOrcCamp) take a WoD camp's site id | FIXED in the record and the ledger: they read only its form and pixel and list no site |
| L4-5 | "The WoD half is closed" overstated it: a sea pixel at WOODS 3 to 5, which the port's water reads as sea, keeps its sites, as the mod's own test does | FIXED in the record, the ledger and the patch notes; not measured (WOODS is ARENA2's) |
| L4-6 | Two ROCK-SMEAR rules unpinned: a face read against the boulder's axis, not its origin; prismZ's area in every winding and quadrant | FIXED: `prismZ` exported; both pinned, two mutants dead |
| L4-7 | Six equivalent survivors (the north and far rim guards, the face sign's tie, boulderUv's raw normal, the prism reversed in place, pickState's `?? -1`) | RECORDED as `equivalent`, each with why |
| L4-8 | HOUSE-BUSH's test 2 and ROCK-SMEAR's test 4 are data evidence and pass on the old code | FIXED in the record |
| L5-1 | The crafter's limit was not one decision: each act bound `craftXpCap` of a track read several awaits before its batch, so two crafts at once could raise a third past 50 - and then all three were held at 26,009 for good (reproduced at all five stations on the real Worker) | FIXED: `craftCapSql` counts the other crafts past Journeyman inside each decision and its track's write (a D1 batch is one transaction) - the anvil, the forge, the temper, the brew, the disenchant. Pinned with both acts' batches held and run in both orders, and the SQL equal to craftXpCap over every craft and standing |
| L5-2 | In that three-past state every new word was false ("holds Smithing at rank 50" at rank 60) | FIXED: `craftLimit` answers the rank it holds; a craft past its ceiling is said at its own rank |
| L5-3 | The tab showed the ceiling line for a third craft below 50 ("1,005 / 26,009 XP - ... holds it at rank 50" at rank 10) | FIXED: the line only at the rank it is held at; below it, the next rank's figure |
| L5-4 | At Master's top the craft's word said "with the first-time bonus" for a bonus the top ate ("+0", and "+200" at 99,800) | FIXED: Master's word, `prof.craft.xpTop`, in the thirteen whole languages |
| L5-5 | The record's `PROF12-book-dis-unapplied` survivor was misdiagnosed: its text ran on into the reforge's | FIXED: re-aimed at the disenchant, dead; the reforge is `craft4.json`'s |
| L5-6 | The Firmament's percent was unpinned at the fire, alchemy, enchanting, the works and the held lines (seven survivors) | FIXED: pinned, all dead |
| L5-7 | "At most N" was unpinned for rooms between an act's XP and its first's 500 (four survivors) | FIXED: pinned, all dead |
| L5-8 | No test rendered a new row in another language | FIXED: German and Russian rendered through formatMessage (the lists, both arms of the rule, Master's word, the ceiling) |
| L5-9 | Craft and rank names stay English in every language | NOTED: the older convention (`professionName`, `rankName`), not this slice's |
| L6-1 | Testing.md's `fb1015f_firstcraft` row described its pin from before it moved | FIXED |
| L6-2 | HOUSE-BUSH's ledger row had one cell and named no approval | FIXED: the row as HELD-BASE's, its approval named |
| L6-3 | The sea refusal was written wider than the code (the sea without its height; the coastal shore unsaid) | FIXED with L4-5 |
| L6-4 | The patch notes' "an Amulet with the same name" was false (the stored name's `%it` fills from the new base) | MOOT: the repair is gone (L1-1), the line with it |
| L6-5 | "Beside it, on desktop and phone": on a phone the page stands below the list | FIXED in the patch notes |
| L6-6 | Five languages called a craft "a made item" in the limit's rule (bg, cs, it, ro, ru), de "Arbeiten" in its count | FIXED: the house's word for a craft in each |
| L6-7 | "Standing nowhere turns every blow" was pinned by neither lane (a cross mutant survived both) | FIXED: the fixture takes its feet; with none, warded, "Warded", the plain blow, nothing sent. Recorded, dead |
| L6-8 | `egz_legion.json`'s EGZ-the-divers-dont-wait survives, on main too, unrecorded | RECORDED as found and left (TURNED-BLOW) |
| L6-9 | WOD-SEA-TEST missing from `03-World/World-Of-Daggerfall.md` and its record without THE FOUR HOSTS | FIXED |
| L6-10 | cs `prof.page.xpHeld`'s pronoun had no noun; every language shows English craft and rank names | FIXED the pronoun; the names as L5-9 |

## After

Tests: the eleven `fb1018f_*` files hold 73 (44 before) - `heldbase` 8, `spellscroll` 8, `relayshare` 9,
`dungeondigits` 5, `turnedblow` 9, `vampiricward` 6, `unseenkeeper` 2, `housebush` 5, `rocksmear` 5, `craftlimit` 13,
`wodsea` 3; and `fb1004e_padarrange` 9 (8). Mutants: `tools/mutants/fb1018f_*.json` 267 records (161 before), 261 dead
and 6 equivalent as recorded (L4-7); older records the fixes moved, re-aimed by content and dead, in `audit29`, `craft3`,
`egz_state`, `law9_height`, `prof3`, `prof4`, `prof12`, `schools`, `serpentset`, `tech1`.

Code: `loot.js` and `save.js` (the load's repair out, a mixed piece's base), `lootRarity.js` and
`server-account/src/ledger.js` (the load's one move taken), `artifactEffects.js` (the Mace); `domRepaint.js` (the path found,
not mapped), `enhancedSpellbook.js` (the page's key), `input.js`, `touch.js`, `gamepadInput.js` and `enhancedHotbar.js`
(one pause); `egBodies.js`, `egLords.js`, `egLink.js`, `egLegion.js`, `wire.js`, `egFight.js`, `arcanePowers.js`,
`enchantments.js`, `sigilSetPowers.js`, `techniqueBlow.js`, and `dungeonContext.js` (existing lines only); `rmbFlats.js`
(heldFootprints), `townStandIns.js` (prismZ exported); `server-account/src/professions.js` and `alchemy.js`
(craftCapSql), `professionLaw.js`, `craftXpWords.js`, `profPages.js`, `profBook.js`; `locales/*` (one key new, twelve
rows mended). No host grew: `bootWorld` stands at its ceiling. The relay moved to `world219` - TURNED-BLOW had changed
its bundle under world218's name (`test/net/relayversion.test.js` red since), and L3's wake, storey and radius are in it.

DECIDED (Mac, 2026-10-19: "Stop with the decisions for me", of every call left open here): the HELD-BASE and HOUSE-BUSH departures kept as built (L1-6); the realm
ledger takes RARITY-WEAR's one load move as the piece, and pieces already held are not mended (L1-1); a mixed
Used-and-held row takes a wearable base (L1-4); a sea pixel at WOODS 3 to 5 keeps the mod's line (L4-5); Leaping's
and Venom Spitting's powers stay classic's; a craft is not let go back to 50.

Found and left: `egz_legion.json`'s EGZ-the-divers-dont-wait survives, on main too (L6-8); the enhanced HUD paints under
a street-slot window over ?world's dungeon arm (L2-6); pose lag at a platform's edge (L3-8); the grimoire dress's phone
layouts (L2-8). Not checked here: a live game (no ARENA2 data in the container) and the relay end to end.
