# AUDIT PISTOLET (2026-10-22) - the Dwarven Pistolet, audited

The owner, of PISTOLET (`05-Combat/Dwarven-Pistolet.md`, `05-Combat/Pistol-Lab.md`; branch `ccr-a6d650c5-oyn0eb` at
8d88d79fc, cut from 883d13f27): **"Perfect. Now lets do a comprehensive audit on everything."** This page is the
findings, each with its verdict. What the audit changed is written into the record's sections as they now stand, each
marked AUDIT PISTOLET and its id.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 8d88d79fc - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: nothing was fixed while the lanes read), each told to prove a finding - a repro against the
real code, or the code quoted with a concrete trace - before reporting it. Then the author's own pass (M), and every
finding reproduced or traced before it was acted on:

| Lane | Over | How |
|---|---|---|
| A - the gun's law | the item, the machine (`playerWeapon.js` `gunPair`, the reloads, the fallback pull), `handsLaw.js`, the four hosts' ranged arms, the shot's damage, the find | probes against the real machine, `playerArrowHitFoe` with fixed rolls, the four hosts' source read side by side, seeded loot draws |
| B - the screen, the art, the sound | `weaponRig.js`'s gun paths, `gunPair.js`, `pistoletArt.js`, `pistolStrip.js`, the lab | the real rig in Node with a stub renderer, and in Chromium; the strip's pixels measured; the lab's settings path traced |
| C - the item and the world | saves, the item law, the Gilded record, loot and rarity, shops, the account Worker, the Morrowind arm, names | save round-trips, the realm judge on old and new Sovereigns, 6,000 seeded rolls, the Legendary ladder, the off-hand arm's parts |
| D - the record and the pins | every sentence the slice wrote against the code; the suite at the head against the base; a mutation campaign | 58 candidate mutants, then the survivors again against 28 rig, doll and texture suites; ARENA2's TEXTURE.234 measured |
| M - the author | the merge with main, CI's view, and the record of the fixes | the merge rehearsed; the mutant record run whole after the fixes |

**What reached a player: nothing** - the branch was unmerged and its relay and account service undeployed. On the
branch:
- the suite was red on six files the lanes found and four more the whole check found, and the branch conflicted with
  main, so CI would have run nothing (D1-D5, D19, M2, M8, M9);
- the off hand's shot landed whole - DUAL's terms were written on the page and applied nowhere, and a pair ran at x1.32
  the Thunderlock, past the ceiling its own test claimed to hold (A1, A4);
- the two gun finds at half weight were neither half as often (a tier-14 boss turned up a gun twice as often) nor
  seed-stable (every seeded loot list at tier 4 and up re-rolled) (A5, A8);
- a Sunken Sovereign minted as a saber read as a forgery to the item law: a trade hold at every checkpoint (A7);
- a pair broken for a frame reloaded the pistol left at once (A3);
- a left-handed player's muzzle light came from the wrong side (A9);
- the gold Sovereign gilded its own muzzle flame (B3).

71 findings, 56 distinct (lanes cross-reported the worst of them). Every one is fixed or recorded below.

## Findings

### Lane A - the gun's law

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | An off-hand shot took none of DUAL's terms - no 0.8 share, no Agility to-hit, no 0.8 blow (so it charged Undertow and Struck every shot): a shot's damage is rolled where it LANDS, the shot carried no `off`, and the duel's roll took `off` for melee alone | FIXED: the impact asks the gun the shot left (`PlayerWeapon.isOffHandItem`, read in `arrowFlight.js playerArrowHitFoe`); the duel takes `off` for a shot (`duelCombat.js`, relay world245 - world242 on its branch, renumbered past main's world242-244 at the merge); pinned (`test/combat/pistolet_law.test.js` A1, A1b), mutants OH-* |
| A2 | MED | `world.js` and `exterior.js` tallied an off-hand shot's skill as a whole blow; `worldModes.js` and `dungeonContext.js` weighed it (THE FOUR HOSTS RULE) | FIXED: both pass `playerWeapon.blowWeight`; pinned (`twohands.test.js`'s tally counts), mutant OH-tally-unweighed |
| A3 | MED | Any frame the pair was broken (a light lit, one pistol taken off) wiped both hands' reloads - the late hand fired inside its own reload - and a fresh second pistol was held back by the first's | FIXED: each hand's `_reload` is kept; the lone gun is gated by its own, the pair by the soonest; pinned (A3, A3b, A3c), mutants RL-* (PISTOL-PORT: each pistol's own machine keeps it now, `playerWeapon.pistols`; the RL-* records RETIRED with `_reload`, the law re-aimed in `pistolport.json` and AUDIT PISTOL-PORT's) |
| A4 | MED | The balance test applied 0.8 by arithmetic and touched no damage code - green while the game ran at x1.32 | FIXED: measured through the machine and `playerArrowHitFoe` (A4: the share 14/17 at the span's top, a pair 9.2/s against 7.7, x1.20); the page's table re-measured |
| A5 | MED | The Pistolet's find was a second `rolls()` draw inside `rollUniqueFinds` at every tier-4+ source, moving every later draw (Loot-II-Arc law 9) | FIXED: ONE gun find, the Thunderlock's at its old weight; its one mint draw picks the gun (`GUN_SHARE` 0.5) and counts the Pellets - every seed its seed; pinned (`pistolet.test.js`, LOOT8 green unmoved), mutants GF-* |
| A6 | LOW | A technique (the lead hand's) was thrown by the off hand while the lead reloaded | FIXED: the fallback refuses a technique; pinned (A6), mutant TQ-technique-to-the-off-hand (PISTOL-PORT: `pistolPair.js fireHand`, the record RETIRED and re-aimed as PW-technique-to-the-off-hand and PP-technique-to-the-law) |
| A7 | HIGH | A Sovereign minted before PISTOLET (an Ebony Saber, Long Blade) failed `validGildedMarks` under the same item law: the judge's `gilded` finding, a trade hold, a week's then a month's hold after three | FIXED: the record's saber era (`SOVEREIGN_SABER_ERA`, read through `gildedRecordOf` by the law and the lore); `ITEM_LAW_VERSION` 10, the account service acct170 (acct168 on its branch, renumbered past main's acct168-169 at the merge); pinned, mutants SE-* |
| A8 | MED | "Together about as often as the Thunderlock" held only at Luck 50 below the cap: the cap and Luck's nudge are per find, unscaled by weight | FIXED with A5: one find - each gun exactly half at every source, cap and Luck included |
| A9 | LOW | The muzzle light's side ignored Handedness | FIXED: the side the firing gun is drawn on (`gunPair.flipOf(hand, handedFlip())`); pinned on the real rig (`pistoletRig.test.js`, both handednesses, pair and single), mutant TL-light-side-ignored (PISTOL-PORT: `pistolLane.js flipOf`; the brightest flash's side since AUDIT PISTOL-PORT B4) |
| A10 | LOW | `SIEGE_PISTOLET.max` was held only by a literal `15 + 2` | FIXED: pinned to `weaponMaxDamage(562)` as the Thunderlock's is (`pistolet_pins.test.js`), mutants SR-* |

Checked clean: the item's rows and proficiency; the fallback never fires an unloaded hand and cannot double-fire; one
Pellet a shot; the weapon at `hit` is the hand that fired; the cadence (32, 64, 28 a minute); the guard at 0-2 Pellets.

### Lane B - the screen, the art, the sound

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | MED | A left-handed player's light opposite the gun that fired | FIXED with A9 |
| B2 | MED | The lab laid Diverse Weapons' preset OVER its own Bob and Inertia (the game lays the weapon's over the preset), reading the player's stored mod settings - its sliders dead with the preset on | FIXED: `gunWidgetSettings(..., { preset: false })` in `pistol-proto.html`; mutant GV-preset-over-the-tuning |
| B3 | MED | The gold Pistolet gilded its own muzzle flame - 178 flame texels pale gold (GILDED1: the flash stays the flash) | FIXED: `flashMask` (the flash's core body grown through its burnt-out red) excluded from `pistoletGildKeep`; pinned (`pistolet_pins.test.js`, the flame's size bounded), mutants FM-* |
| B4 | LOW | The glow field was laid on the Pistolet's union box in DESIGN pixels over a native texture | FIXED: the art says its native size; mutant GLOW-design-pixels |
| B5 | LOW | `PISTOLET_FEEL.offset` moved the lab and not the game; the lab's light opened on a literal | FIXED: the offset rides the art's `pose`; `PISTOL_OPENING.light` reads the feel; `pistolLab.test.js` |
| B6 | LOW | Two literals for one reload-clack lead | FIXED: `gunFeel.js RELOAD_CLOSE_LEAD`, read by both; pinned |
| B7 | LOW | The rig probe's header named a script that does not exist and three checks it does not make | FIXED: the header says what it checks; those three are pinned in Node (`pistoletRig.test.js`) |
| B8 | LOW | `Pistol-Lab.md` kept its graduation list beside GRADUATED, saying things no longer true | FIXED: the answered items deleted, the two open kept |
| B9 | LOW | Unequipping the off pistol mid-reload reloaded the one left at once | FIXED with A3 |

Checked clean: the striking pistol drawn over; the mirror; the guard's lowering; each hand's dip; the frames at 12 fps;
the barrel each shot leaves; one fire clip a shot, each hand's clacks; the holster's slide; no texture uploaded per
equip; the enchanted shimmer.

### Lane C - the item and the world

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | The old Sovereign saber a forgery | FIXED with A7 |
| C2 | HIGH | The rarity's claim false where guns drop most - the late game's bosses | FIXED with A8 |
| C3 | MED | The second find's draw broke law 9 (133 of 400 seeded tier-6 lists differ) | FIXED with A5 |
| C4 | MED | `account-deploy.yml`'s paths lacked `src/systems/pistolet.js`, which the account Worker bundles | FIXED; ACC1-CI green |
| C5 | MED | No exclusive Legendary claimed 562: every Legendary Pistolet was Wyrmbane, "Forged for a dragon hunt" | FIXED: The Last Lock claims both guns; pinned, mutant LL-*. A Legendary of the Pistolet's own is the owner's call (open) |
| C6 | MED | The Morrowind arm's left Pistolet dropped its `preTransform`, hanging in the raw mesh's frame | FIXED: `fpArm.js resolveOffWeaponParts` carries it; pinned, mutant OFF-* |
| C7 | MED | The relay's graph edited under a shipped version | FIXED with D1 |
| C8 | MED | Five pins not moved: CI red | FIXED with D2-D5 and A5 |
| C9 | LOW | Every Pistolet (and Thunderlock) named "Dwarven Dwarven ..." | FIXED: a name that says its metal takes no second (`itemInfo.js namesItsMetal`); `rf6` pin moved, mutant NM-metal-twice |

Checked clean: saves (a damaged pair, a gilded one, Pellets); the new Sovereign lawful on the wire and to the judge;
6,000 seeded rolls lawful; no shelf stocks it; repair, groups, registries, decor; each hand's doll file and offset; the
Morrowind assets parse and resolve; the bakes byte-exact; the account Worker loads it.

### Lane D - the record and the pins

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | `siegeRef.js` changed under RELAY_VERSION with no bump (SLAM8 red) | FIXED: world245 (world242 on its branch), with `duelCombat.js` (A1) - NOT YET DEPLOYED |
| D2 | HIGH | `auditrealm.test.js` lacked the new registrar | FIXED |
| D3 | HIGH | L10N4's ratchet: `ownWeaponModels.js` 3 -> 6 | FIXED: the count moved (the model names feed developer reports only) |
| D4 | HIGH | `loot7check.test.js` counted Thunderlocks alone at the old rate | FIXED: counts either gun |
| D5 | HIGH | `weaponglow1.test.js`'s rig pin not moved | FIXED |
| D6 | HIGH | Law 9 broken (seed 43 grew a Welkynd Stone) | FIXED with A5 |
| D7 | HIGH | The page's off-hand line and balance table false in the game | FIXED with A1/A4; the page rewritten |
| D8 | HIGH | The old saber unlawful, and `Gilded.md` silent | FIXED with A7; `Gilded.md` section 7's saber era |
| D9 | HIGH | The install test could never fail | FIXED: six records, each a stand-in with its offset; mutants PLD-install-* |
| D10 | HIGH | The per-hand doll records unpinned (a gold Sovereign in the right hand could show plain) | FIXED: every (record, file, offset) and the gilded right hand; mutants PLD-* |
| D11 | HIGH | Twelve mutants of the rig's Pistolet paths survived every suite | FIXED: the real rig in Node (`test/combat/weapon/pistolRigHarness.js`, `pistoletRig.test.js`, 7 tests); mutants WR-*, all dead (one after M3) |
| D12 | MED | `gunPair.js` pinned only for its guard | FIXED: `test/combat/gun/gunPair.test.js` (5) steps a real pair; mutants GP-*. RETIRED by PISTOL-PORT (2026-10-22) with the module: the page's own frame is pinned by `test/combat/gun/pistolport.test.js`, mutants in `tools/mutants/pistolport.json` |
| D13 | MED | No committed mutant record | FIXED: `tools/mutants/pistolet.json` (81) |
| D14 | MED | The light's side false for a left-handed player | FIXED with A9 |
| D15 | MED | "24x17, a classic dagger's doll record" - those are 56x17 and 36x45 | FIXED: the page, the tool and the test's message |
| D16 | MED | "Rendered in the preview sheet; bound in the tests" - the sheet is the atlas, and only the Thunderlock's mesh was bound | FIXED: both Pistolet NIFs BIND (`fieldgunmw.test.js`), `PISTOL_GRIP_ATTITUDE` pinned, the wording true; mutants OWM-* |
| D17 | MED | "Checked on six bodies" - the committed probe drew one | FIXED: the probe takes `--body`; the six drawn again, no page errors |
| D18 | MED | Gilding "on EVERY frame" and the enchanted type unpinned | FIXED: loaded gilded and magic in the test; mutants PA-* |
| D19 | MED | The branch conflicted with main | FIXED with M1 |
| D20 | LOW | `pistoletArt.mjs`: "6 px lower" - the pick is 2 px | FIXED |
| D21 | LOW | `pistolet.test.js`: "NOT MIRRORED" over a flipped right hand | FIXED |
| D22 | LOW | `loadPistoletArt`'s doc: the muzzle "the frame the shot GAINED" | FIXED: the flash alone |
| D23 | LOW | A cite to a section "The gold" that does not exist | FIXED |
| D24 | LOW | `gunFeel.js` named `pistoletWidgetSettings` | FIXED: `gunWidgetSettings` |
| D25 | LOW | `bakePistolet.mjs` named a test file that does not exist | FIXED (the PISTOLET-MODEL rewrite) |
| D26 | LOW | `DUAL_TYPES` cited for the pair | FIXED: `DUAL_GUN_TYPES` |
| D27 | LOW | `Gilded.md`: "(below)" for a paragraph above | FIXED |
| D28 | LOW | The out-of-Pellets guard said to read `heldFeel` | FIXED: it asks `isGunType` |
| D29 | LOW | Luck counted twice across two finds | FIXED with A8 |
| D30 | LOW | "...and the player weapon reads it as a gun pair" built no PlayerWeapon | FIXED: `handsMode` and `gunPair` asserted |
| D31 | LOW | The lab's "nothing the game runs imports it" sweep missed the graduated modules | FIXED: widened; mutant LAB-* |
| D32 | LOW | The find's 6-18 Pellets and `SIEGE_PISTOLET` unpinned | FIXED with A10; the range pinned, mutants GF-* |
| D33 | LOW | A left-handed player's Thunderlock mirror fix recorded nowhere in the bible | FIXED: `Dwarven-Thunderlock.md`; the pull request's patch notes |
| D34 | LOW | Active-Arcs: "placed on the fists measured"; `pistoletArt.js`: "the laws live HERE" | FIXED: the right hand 2 px off by the owner's pick; the strip's laws in `pistolStrip.js` |

### Lane M - the author

| # | Sev | Finding | Verdict |
|---|---|---|---|
| M1 | MED | `Active-Arcs.md` and `Systems.md` conflicted with main | FIXED: main merged (fa9fe9235, and 3b581dc34 for DAY-TURN), both lists kept |
| M2 | HIGH | L10N4 red on the branch - the author's pre-push gates had skipped it | FIXED with D3 |
| M3 | MED | The mutant record's whole run (78 dead, 2 equivalent) left WR-resting-pistol-flashes alive: the pair test's "the resting pistol stays unlit" compared two null tints - the harness renderer had no room light, so no quad was ever tinted | FIXED: the harness lights the room (`flatLightAt`), the test asserts the firing pistol IS lit; the mutant dead |
| M4 | LOW | C9's fix rewrote a line `06-Systems/Loot-Rarity.md` cites by its text - `citeanchor` red, caught at the record's gates before any push | FIXED: re-anchored to the line as it reads, the page saying why |
| M5 | MED | The fixes' version moves (item law 10, acct168, world242) and A1's two lines left 19 mutant records in 15 earlier lists aimed at text no longer there (`mutantdrift` QS6 F7 red): the laws they alone kill checked by nothing - caught at the record's gates before any push | FIXED: re-aimed by content, the same mutation each, and all 19 run again: dead |
| M6 | MED | Two server pins of the judge's version (`test/server/fb1017_keylaw_lift.test.js`, `fb1016c_makerkept_lift.test.js`) still said law 9 after A7 moved it to 10 - CI red, and KEY-LAW's mutant no verdict; found by M5's run | FIXED: both moved, KEY-LAW's mutant judged again: dead |
| M7 | MED | AUDIT 23's host pin (`test/systems/audit23_hosts.test.js` C14) still read A2's line as the unweighed tally - CI red; found by the whole `npm run check` | FIXED: PIN MOVED to the weighed arm |
| M8 | MED | `systems/pistolet.js` declared seven names `systems/thunderlock.js` declares - `PAPERDOLL_OFFSET`, `ART_RECORDS`, `ICON_FILES`, `SFX`, `SFX_FILES`, `iconUrl`, `sfxUrl` - each a different value, so AUDIT 24's ONE HOME gate (`test/systems/talk/audit24_onehome.test.js`) failed twice: they DISAGREE, and the duplicate count went 42 to 49. Red at the frozen head; no lane ran that file; found by the whole check | FIXED: the Pistolet's own names (`PISTOLET_PAPERDOLL_OFFSET`, `PISTOLET_ART_RECORDS`, `PISTOLET_ICON_FILES`, `PISTOLET_SFX`, `PISTOLET_SFX_FILES`, `pistoletIconUrl`, `pistoletSfxUrl`) - the count back to 42, no ratchet moved; the four mutant records that name them re-aimed, dead |
| M9 | MED | The slice's two page-writing probes broke three tooling rules, red at the frozen head: each wrote its page before its try (`audit68_tools` X2 - a failed browser launch leaves it behind) and drove it at the site's root, which is the landing page (`landing.test.js` U60); and the doll probe judged nothing - exit 0 whatever happened (`probehygiene` T3) | FIXED: both pages under `tools/`, written inside the try whose finally unlinks them, driven at their own path; the doll probe checks every body's three dolls, both hands worn and no page errors, and exits 1 on a failure. Both run again: 3/3 and 10/10, nothing left behind |

## Outside the slice

- `test/systems/professions/fb1013e_writwall.test.js` (WRIT-WALL mined Iron) failed once in the whole check: its `workTab` waits at most 400 `setImmediate` turns for a card, and under a loaded machine the card took up to 583 - on `main` as on this branch (six concurrent runs of each, measured). A wait bounded in turns, not time; not this slice's, and left to its own slice.

## What stands

- New pins: `test/combat/pistolet_law.test.js` (7), `test/combat/gun/gunPair.test.js` (5, RETIRED by PISTOL-PORT),
  `test/combat/weapon/pistoletRig.test.js` (7, over `pistolRigHarness.js`), `test/systems/pistolet_pins.test.js` (10);
  `pistolet.test.js`, `fieldgunmw.test.js`, `pistolLab.test.js` and `twohands.test.js` extended.
- `tools/mutants/pistolet.json`: 81 mutants over `pistolet.js`, `thunderlock.js`, `gilded.js`, `playerWeapon.js`,
  `handsLaw.js`, `arrowFlight.js`, `duelCombat.js`, `gunPair.js`, `weaponRig.js`, `pistoletArt.js`, `fpArm.js`,
  `ownWeaponModels.js`, `siegeRef.js`, `itemInfo.js` and the lab - 79 dead, 2 equivalent and recorded with their
  reason (`PW-both-empty-still-fires`: the machine's gate already refuses; `PW-pistolet-on-the-rifle-hit-frame`: both
  feels fire on frame 1). PISTOL-PORT RETIRED 33 of them with the code they named - both equivalent ones among them - so
  `pistolet.json` holds 50; their laws are held by `pistolport.json` and `audit_pistolport.json`
  (`Audit-Pistol-Port.md` D8, D9).
- To deploy: the relay (world245; world242 on its branch) and the account service (acct170; acct168 on its branch; item law 10). An older relay rolls an off-hand shot
  at a player whole; an older judge reads an old Sovereign saber as a forgery.

## Still open

- **The model and its stance unseen on Morrowind's own bodies**: Morrowind's data is not freeware and not here. The
  stance itself was built after the audit (PISTOL-STANCE, 2026-10-22, `Dwarven-Pistolet.md`), picked by the owner on the
  vendored retail skeleton.
- **The mixed pair**, a Pistolet beside a sword.
- **A Legendary of the Pistolet's own** - it borrows The Last Lock (C5): the owner's call.
- **A pistol's own sounds**, and the flash's canvas edge (`Pistol-Lab.md`).
