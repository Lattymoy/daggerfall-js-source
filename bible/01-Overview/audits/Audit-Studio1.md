# AUDIT STUDIO1 (2026-10-17) - the studio, audited

The owner, of STUDIO1 (`07-Rendering/Studio-Art.md`; branch `ccr-d2d8845e-c45z7z` at daf674f6b): **"Audit this and
ensure perfection"**. This page is the findings, each with its verdict. What the audit changed is written into the
pages and the code as they now stand, each marked AUDIT STUDIO1 and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at daf674f6b - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the branch while the lanes read the snapshot), each told to prove a
finding - a repro against the real code, or the code quoted with a concrete trace - before reporting it; then the
author's pass, every finding reproduced before it was acted on, and every fix pinned by a test that goes red on the
code it replaced:

| Lane | Over | How |
|---|---|---|
| A - the law | `systems/textureReplacement.js`'s vendor tier as STUDIO1 changed it, `systems/studioArt/studioArt.js` | node scripts against the snapshot's own modules (the real `decodePng` over a `createImageBitmap` of `tools/pngIO`'s): every tier order, every failure of the install, the late path, dyes, `lazy`, a real pipeline's first area |
| B - the doors | the five painted doors, the ships' and hangings' texture door, the boot | every painted door's template installed as a studio picture and compared byte for byte with the door's painted path (136 records: the wagons and their paints, the yards, the port, the monument, the caravan room's live records); the caravan room repainted while the install was on its way; `ensureAudio` against a picture that never answers |
| C - the folder | `scripts/studioArtIndex.mjs`, `tools/studioArt.mjs`, `.gitignore`, the doctrine's studio arm, the build | a real `vite build` and `vite preview` at the site root and under a project path; trees of names the web, git and Windows treat apart; the suite's tooling files |
| D - the record | `Studio-Art.md`, the artists' README, the Ledger row, Active-Arcs, every JSDoc that makes a claim | each claim run against the code: the ground's tile sets, the cut-out slots counted, the tiers in each order, the check on misspellings |
| E - the pins | the commit's 12 tests and 33 mutants | the suite at the snapshot from a clean `git archive`; 136 mutants of the lane's own over every STUDIO1 line, run against the commit's pins - 100 survived; the pins that kill them written and run |

What reached a player: nothing (the branch is unmerged). On the branch, the suite was red in three files (E1), every
streamed pixel of the world waited for the last studio picture to download and decode (B2), and the ground never wore
a studio picture at all (D1).

## Findings

### The author's pass

| # | Sev | Finding | Verdict |
|---|---|---|---|
| S1 | HIGH | The full suite at the snapshot: `l10n4_hardcoded`'s ratchet (`studioSlots.js` 0 -> 9, `studioLab.js` 0 -> 3) | FIXED: both rows in HARDCODED, each with its reason (the words the studio page and the tool show the game's artists - no player reads them) |
| S2 | HIGH | `audit68_tools` X5: `tools/studioArt.mjs`'s own main guard, hand-rolled | FIXED: `tools/lib/isMain.mjs` |
| S3 | HIGH | `moduleload_smoke`: `studioLab.js` touched `document` at load | FIXED: the page boots behind `if (globalThis.document)` |

### Lane A - the law

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | MED | A studio picture over a stand-in wiped the stand-in out: while the studio's picture had not loaded (a fetch that failed, a decode not landed), the face drew as a hole, not her painted picture | FIXED: a studio entry keeps what it covers (`under`, textureReplacement.js coverWith), and the stand-in falls back to it; pinned (auditstudio1 S1), mutants |
| A2 | MED | The size and record scale of the stand-in the studio covers were not inherited - a billboard drew at the picture's texel size, a doll piece unfitted | FIXED: the stand-in measures what the studio covers (`getSize`, `getBox`, `recordScale`) and draws the studio's texels; pinned (S1; door D2), mutants |
| A3 | MED | The install's promise held every picture past TEXTURE.511 downloaded and decoded, all at once, and the world's pixel builds waited for it | FIXED: the boot waits for the registration alone; the port's own pictures decode after it, `PRELOAD_CONCURRENCY` at a time (`studioLanded` awaits them); pinned (S2), mutants |
| A4 | LOW | wearPainted's late put was never cancelled: an older ask's picture could land over a newer wear (ASYNC NEVER DROPS), and a throwing put reached the crash overlay | FIXED: a slot's newest wear alone takes a late picture (`_slots`; the caravan room's slot is its live record), and the chain is caught; pinned (S4), mutants |
| A5 | LOW | A studio picture of a Daggerfall archive that landed after its archive's first load was not worn in that area (the renderer keeps the first picture a key is given), and the icons' caches never moved | FIXED: an archive's first load waits for the studio's listing a bounded while (`holdTextureTiers`, `STUDIO_HOLD_MS` 3000, in the pipeline's getTexture), and the icons' caches key on `studioGeneration`; pinned (S3, S6), mutants. LEFT past the bound: a listing slower than 3 s lands at each area's next load - the world never waits on art longer |
| A6 | LOW | A painted archive was decoded once: a key answered later (a loose pick, Replace Game Artwork switched) left neither picture worn | FIXED: wearPainted decodes a picture that answers and is not decoded, and wears it late; pinned (S4), mutants |
| A7 | LOW | Studio entries were never `lazy`: a studio picture over Diverse Weapons' lazy icons brought the AUDIT-DW F1 stall back (280 of 280 fetched at the archive's preload) | FIXED: `lazy` inherited from what it covers; pinned (S5), mutant |
| A8 | LOW | A studio picture of one dye of a stand-in record made every other dye's ask find nothing | FIXED: `standInDye` leaves studio entries out; pinned (S5), mutant |
| A9 | LOW | `studioFile` took dye tokens no door asks by (`_iron`, `_Silver`, `_Unchanged`, `_Iorn`) - listed, registered, never worn | FIXED: `askedDye` - a dye the game prints (characters/dyes.js dyeToken); the listing refuses the rest by name; pinned (S5), mutant |
| A10 | NIT | `CLASSIC_TEXTURE_LAST` duplicated the pipeline's `LAST_CLASSIC_TEXTURE_ARCHIVE` | FIXED: one export, `formats/textureFile.js`; the pipeline re-exports it |
| A11 | NIT | A listing that failed to read was remembered for the page | FIXED: a failed read is no answer - the next boot asks again; a listing not served (404) is an answer; pinned (S6), mutant |
| A12 | NIT | Door D2 asserted one per-archive fact once per record (it could not fail for a record) | FIXED: D2 asserts what the studio's picture does at its record |

### Lane B - the doors

| # | Sev | Finding | Verdict |
|---|---|---|---|
| B1 | HIGH | = S1 | FIXED there |
| B2 | MED | = A3, traced through the hosts: Seasons (on by default) gates every pixel build on `dataReady`, which held the whole install; a picture that never answered stalled the world | FIXED with A3; pinned (S2) |
| B3 | LOW | = A4 on the caravan room: the walls wore a stale paint's studio picture | FIXED with A4; pinned through the real `paintCaravanRoom` (S4) |
| B4 | LOW | A ship's studio night window was lit by her painted glass | FIXED: the night twin's emission is its own `_Emission` picture where it has one (comeSailAwayPool.js uploadFace), else her glass; the README says where the light falls; pinned (S8), mutant |
| B5 | NIT | Ships and hangings had no late path | FIXED with A5: both load through the pipeline's getTexture, which the hold covers |
| B6 | NIT | The Ledger row did not name the four hosts | FIXED: the row names each host's doors (the wagons and the monument in `world.js` and `exterior.js`, the caravan room in `worldModes.js`, the yards and the port in `world.js`, the dungeon none) |

### Lane C - the folder, the build, the doctrine

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | = S2 | FIXED there |
| C2 | HIGH | = S3 | FIXED there |
| C3 | HIGH | = S1 | FIXED there |
| C4 | MED | The commit's `.gitignore` line (`studio-templates`) ignored that name at any depth: an artist's repainted templates in such a folder were never committed, and nothing said so | FIXED: anchored (`/studio-templates/`), and the check refuses any picture git would not commit (`git check-ignore`), naming the pattern; pinned (S10), mutant |
| C5 | MED | The doctrine's sweep read `git ls-files` unquoted: an accented picture name the listing accepted failed CI | FIXED: `git ls-files -z`; and C6 refuses such names |
| C6 | MED | Names were free text: `#`, `?` and `+` broke serving (a dev server answers the page), and Windows' reserved names and trailing dots break the desktop checkout | FIXED: `STUDIO_NAME` (letters, digits, `_ . -`, a letter or digit at each end) and `STUDIO_RESERVED`, for every folder and file; pinned (S10), mutants |
| C7 | LOW | `.DS_Store`, `Thumbs.db`, `desktop.ini` and `._` files failed the local check | FIXED: passed over, never said (`STUDIO_LITTER`); pinned (S10), mutant |
| C8 | LOW | A symlink got past the listing (what it points at is not in the commit) | FIXED: refused; a dangling one no crash; pinned (S10), mutant |
| C9 | LOW | = D16 | FIXED there |
| C10 | LOW | = D6 | FIXED there |
| C11 | NIT | `templates [dir]` resolved a relative folder against the checkout, not where the caller stands | FIXED: resolved against the working directory; the default stays the checkout's ignored folder; pinned (S10) |
| C12 | NIT | The doctrine's studio arm was untested, and read the working tree | FIXED: held on a tree of its own (doctrine's STUDIO1 test) and self-tested over the real arm (E5) |

### Lane D - the record

| # | Sev | Finding | Verdict |
|---|---|---|---|
| D1 | HIGH | The ground never wore a studio picture: its tile sets are built apart (dfmodGroundLayers, the loose pick and the .dfmods only) - so "over every shipped pack" was false where Sands of the Alik'r, Snowfall and Vanilla Enhanced's arrays live | FIXED: the ground's set lays the studio's records in, the gate shut or open, every layer at the largest picture's size (dfmodTextures.js studioGround); pinned (S7), mutants. LEFT: the ghosts' and wraiths' see-through archives take no replacement of any tier - the README says so |
| D2 | HIGH | "Transparent is a hole" was true on 29 slots of 248: the mesh shader clips only a picture uploaded as a cut-out, and a clear texel elsewhere draws black | FIXED: the README's rule says where clear is a hole (the caravan's glass, a ship's stern windows by day, the beacon's flame); the studio page marks those slots; the check notes clear texels on a slot drawn solid; pinned (S9: 29 cut-outs), mutants |
| D3 | HIGH | "A player's own attached texture pack is still drawn over it" - a .dfmod a player attaches is on the bundle tier, which the studio outranks | FIXED: the README, the record and the module's header say which pack wins (a loose folder of pictures, with Replace Game Artwork on) and which does not (a texture mod); pinned (door D2: an attached mod's picture of the studio's key, Replace Game Artwork on), mutant |
| D4 | MED | = A6 | FIXED there |
| D5 | MED | = B4 | FIXED there |
| D6 | MED | The check passed a misspelling that still reads as a texture name (`3818_1-0`, `38181_1-1`) | FIXED: a name of a painted model's archive that is none of its slots is a problem; an archive past 511 that is no model's is a note; the README says a mistyped number of Daggerfall's own textures cannot be caught (they are the player's data); pinned (S9), mutants |
| D7 | LOW | "No archive load will" decode the port's archives - the stand-in archives are decoded at their load | FIXED: the record says which archives need the install's decode (the painted doors'), and the constant's JSDoc that a number past 511 is a mod's or the port's |
| D8 | LOW | "Before any host draws" contradicted the record's own late path | FIXED: `shared.js` and the JSDoc say a picture painted before it lands is handed again late |
| D9 | LOW | = A4 on the caravan room | FIXED there |
| D10 | LOW | "Every picture the game paints itself" - the record's own Not yet list names five painted archives in no set | FIXED: "the eight models the game paints itself", the wagons alone recoloured per paint |
| D11 | LOW | The Not yet list called the lamp, the torches and the waves the port's painted archives | FIXED: split - the port's painted archives; the mods' art uploaded by hand; the lamp, the player's classic 197_6, never replaced |
| D12 | LOW | The 248 was unpinned | FIXED: S9 counts 248 slots and 29 cut-outs; S15 each set's records |
| D13 | NIT | 2048 is "four times" Vanilla Enhanced's largest (941) | FIXED: "a little over twice" |
| D14 | NIT | The wagon's icon does not go through wearPainted | FIXED: the record and DF-Art.md say it asks `paintedReplacement` once the install has landed |
| D15 | NIT | "100 records past the built one" for every paint | FIXED: paint `i` is `i` x 100 past it |
| D16 | NIT | The artists' folders the README drew do not exist until a first picture | FIXED: the README says a first picture makes the folder, and how on GitHub's upload page |
| D17 | NIT | Handheld Torches lists its set at build time too | FIXED: "every other texture pack the port registers on the texture door" |

Lane D's three unproven timings (by reading): U1, the first streamed area = A5, FIXED there; U2, item icons cached
before the install = A5's icons, FIXED there; U3, the wagon's icon asked before any boot - `studioLanded` now asks the
install itself (S6).

### Lane E - the pins

| # | Sev | Finding | Verdict |
|---|---|---|---|
| E1 | HIGH | = S1, S2, S3; and `test:changed` selected none of the three (they sweep folders, they import nothing of STUDIO1's) | FIXED there. The bible's gates passed at the snapshot |
| E2 | HIGH | The install's own `studio: true` and `fileName` were unpinned: D2 tested the law with hand-built entries, and in the game's real order a ship registered after the install took her keys back | FIXED: pinned through the real producers in the real order (S12, lane E's K4 and K6), mutants |
| E3 | HIGH | `studioSlots` was checked only against itself (22 survivors: an archive off by one, the hangings shifted, the night twins dropped, the names) | FIXED: each set's keys and pictures equal its real registration or its host's archive, named, sorted and painted as the game paints them (S15, K16), mutants |
| E4 | HIGH | The plugin's registration in `vite.config.js` was unpinned | FIXED: the config carries `studio-art-index` and builds `studio.html` (S16, K17), mutants |
| E5 | HIGH | The doctrine's studio arm could not fail (`(f) => true \|\| ...` survived) | FIXED: the arm self-tested over the real `STUDIO_WORN` - a stranger's picture, the README, a working file, a picture named for nothing, one loose in the studio's own folder and one outside the studio are not the studio's; every worn entry is an artist's PNG (doctrine's AUDIT STUDIO1 E5 test), mutants. The arm's other four mutants die on the first committed picture |
| E6 | MED | `studioUrl` was unpinned (the fake fetch compared with `studioUrl` itself) | FIXED: its encoding, its segments and its root by literal (S11, K1), mutants |
| E7 | MED | The install's frame, map and dye were unpinned | FIXED (S11, K3), mutants |
| E8 | MED | The fake responses had shapes no fetch mints (TEST THE SHAPE THE PRODUCER MINTS): a listing with no `files`, or a JSON body on a 404, went unread | FIXED: real `Response` objects (S11, K2 - and the door's `served()`), mutants |
| E9 | MED | The classic boundary was unpinned (510, 512, `>=` survived) | FIXED: `LAST_CLASSIC_TEXTURE_ARCHIVE` 511, 511 left to its load and 512 decoded (S11, K9), mutants |
| E10 | MED | `studioLanded` and the late picture under-pinned (a late put upside down, an undecodable picture thrown into a host) | FIXED (S11, K10), mutants |
| E11 | MED | The merge rule half-pinned (`standIn` unconditional, `??=` as `=`, the absorbed count, every later registration absorbed) | FIXED: through `installSurvivalIcons` and `installThunderlockIcons` in the game's real order, and two non-studio registrations (S12, K5, K7, K8), mutants |
| E12 | MED | `studioArtIndex.mjs`: 18 survivors (a roster fixture with two faults in one, the heights, the constants, the byte limit's boundary, `.PNG`, the sort, the header) | FIXED: each limit by number on both sides, each roster fault alone, a roster that is no list (S13, K11-K13), mutants |
| E13 | MED | `tools/studioArt.mjs`: the check's problems, the stretch threshold and `templates` unpinned; `check`'s exit code and `list` unpinnable while the tool read only the checkout | FIXED: `studioCli` takes a root and a log and answers its exit code (0, 1 on a problem, 2 on an unknown command); all pinned (S14, K14, K15), mutants |
| E14 | LOW | Vacuous and over-specified pins (D2's loop, D3's bare `await`, F1's exact roster) | FIXED: D2 as A12; the bare `await` and the bound replaced by S11; F1 asks the founders are on the roster and each approval says something - a new artist breaks nothing |
| E15 | LOW | Hand-built shapes (D2's stand-ins and offsets, `served()`'s listing) | FIXED: the real producers in S11-S12 (`installThunderlockIcons`, `PAPERDOLL_OFFSET`, real `Response`s); D2 keeps its table of the law beside them |
| E16 | LOW | The folder test's `ROOT` was a URL's `pathname` (a checkout under a path with a space fails) | FIXED: `fileURLToPath`. NOT STUDIO1'S: the same pattern in 32 other test files is the house's, left |
| E17 | NIT | `studioFile` hard-coded `--`; the install's `root` never passed; `studioLab.js` and `studio.html` have no behavioural test | FIXED: `STUDIO_LABEL` in the name's pattern (a mutant); `root` is passed by S11. LEFT: the page's behaviour - its build input is pinned (S16), its module loads in the smoke test, and it was driven in Chromium (Studio-Art.md, Verified) |

## What stands

- `test/systems/studioArt/auditstudio1.test.js`: 16 tests, S1-S16 (S11-S16 lane E's killers, K1-K17, in the game's
  real order). `studio1_door.test.js` 6, `studio1_folder.test.js` 6, `doctrine.test.js` 15 (the studio arm on a tree of
  its own, and E5's self-test).
- `tools/mutants/studio1.json`: 140 mutants (33 at the audit's start, then lane E's survivors re-aimed at the fixed
  code, and the fixes' own), all dead. The first run of the whole list found one survivor, in a fix's own code: C6's
  end rule (a folder ending in a dot - Windows drops the dot, and the desktop checkout loses the folder), pinned in
  S10. The records of the slices the studio moved (DF-LOOK, BEACON-TOWER, RRI1, THUNDERLOCK-ART, AUDIT VIRT, VE2)
  re-aimed by content, all dead.
- Not verified here: a studio picture on a wagon in the world - this container has no ARENA2 to boot the game with.
