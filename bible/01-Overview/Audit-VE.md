# AUDIT VE - Vanilla Enhanced, shipped and on by default, 2026-10-05

Mac: *"Audit this. Ensure this is on by default. And performance isn't affected"*, of PR #621 (VE1-VE4,
`07-Rendering/Vanilla-Enhanced.md`): carademono's Vanilla Enhanced shipped under Port-Doctrine's one exception, the
texture-mod door given DFU's load order and terrain import, the Texture Overhaul card. Four lenses:
- **the default:** Mac's call;
- **performance:** measured, in Chromium on this session's machine and in node;
- **the door against DFU:** an independent adversarial review of a snapshot of the pushed head, with the DFU C# beside
  it, and this session's own reading;
- **the tests' own honesty:** fresh mutants on every new line.

Every finding was re-run before it was fixed and is pinned by a test that fails on the code as it stood:
`test/auditve.test.js` (D1, P1, P2, and the review's R findings), with the moved pins in `ve1_vanillaEnhanced`,
`ve4_vanillaEnhancedShipped` and `overhauls` each carrying a `PIN MOVED` note. Mutation-proven: `tools/mutants/auditve.json`,
and every older record the fixes moved re-aimed and killed again (`ve1.json`, `ve4.json`). Each fix carries an
`AUDIT VE` comment.

## The default (Mac's call)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Mac's call | **Vanilla Enhanced shipped off until worn** (VE4 departure 7): a fresh game drew Daggerfall's own textures. | **The shipped Base is ON by default** (`vanillaEnhancedPack.js` `ON_BY_DEFAULT`), as a mod in DFU's Mods folder is, and Replace Game Artwork is on by default (DFU's own default) - a fresh game wears Vanilla Enhanced. Its add-ons (Masked Roads, Snowless Swamps and Jungles) ship off until picked on the card. A shipped mod's switch is now the player's CHOICE either way (`dfmodShipped`, `{ key: on }`), so Classic's off is kept through every boot after; a key with no choice reads the mod's default. Classic stays one choice away on the card. |

## Performance (measured)

Chromium (Playwright) on this session's machine, through the port's own decode path; node for the registration. The
world itself cannot be drawn here (no ARENA2, SwiftShader only), so the frame is reasoned from the renderer, not timed.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | Major | **The shipped pack decoded on the main thread.** An attached .dfmod decodes in its bundle worker; the shipped PNGs' readback (drawImage + getImageData, about 1.7 ms a 256-pixel tile) and the texture detail's box filter (86 of its pictures are bigger than 256 - trees up to 726x941) ran on the page's thread while the world streams. Measured over one ground set (56 tiles) and every flat and wall (390): **worst main-thread stall 29-39 ms, 5-16 stalls over 16 ms** - dropped frames - in two runs. | **The decode is a worker's** (`vanillaEnhancedDecodeWorker.js`, two of them): the fetch, the decode and the fit run off the main thread and the pixels come back moved, not copied; the same pixels as the page's own path (checked equal in Chromium, a fitted tree included). A browser with no OffscreenCanvas in a worker decodes on the page's thread instead, and a worker that dies is never asked again - an ask after its death is the page's at once, never a wait for ever. **After: worst stall 8-10 ms, none over 16 ms;** the ground set 139-144 ms (was 165-171), the 390 flats and walls 1.08 s (was 1.25-1.40 s). |
| P2 | Minor | **The ground cache kept every decoded tile set for the session.** A set stands on the GPU once uploaded; the door's copy only spares a re-decode when PLACE-LRU lets the array go - and it was kept for every archive ever drawn: 14.7 MB a set at Vanilla Enhanced's 256 pixels, eleven archives 162 MB. | **Bounded to three** (`GROUND_CACHE_SETS`), the least recently asked let go - a junction of climates still re-enters at once; an older set is decoded again if asked (off the main thread, P1). |

Measured and holding:
- **Registration:** putting the Base's 1,238 names on the doors takes 3.4 ms, a boot's registration 2.9 ms, the card's
  reads 16 µs; with the pack switched off, 0.04 ms.
- **The download:** the JavaScript grows by 73.6 KB (15.3 KB gzipped - 0.34% of the whole), the game page's entry chunk by
  0.1 KB; the index rides the lazily loaded chunks and the worker is its own. The pictures come only as they are drawn
  (a ground set 1.24 MB), from the browser's cache after the first visit.
- **The frame:** unchanged in kind. The ground's tile array is mipmapped with a nearest magnifier (GRAIN1), so a 256-pixel
  tile costs what a 64-pixel one does at distance; flats are uploaded per record, not packed into fixed atlas pages, so
  larger flats add no draw calls.
- **Memory, the honest cost of four times the texels:** a resident ground archive is 19.6 MB of GPU memory (mipped)
  where Daggerfall's is 1.2 MB, and PLACE-LRU frees one no place holds; an area's flats decode to about a megabyte an
  archive (all 390 flats and walls, every climate, 17.2 MB). The DFMOD3 budget bounds the decoded pictures as it does any
  texture mod's; Classic is one choice away on a low-memory device.
- **A new climate's first load** awaits its ground set (0.11-0.14 s here, through the worker; longer on a slow first
  download). Only the first pixel of a climate pays it; moving it earlier would reorder all four hosts' loads for little.

## The door against DFU (the review)

An independent adversarial reviewer read a snapshot of the pushed head (`d1c38864`) against DFU's own C#
(ModManager.cs, TextureReplacement.cs, TextureReader.cs). **What held:** the load order (AutoSortMods and
TopologicalSort, ModManager.cs:1059-1082, :1261-1288), the TryGetAsset walk (:404-442, :1146-1153) on every door, and
the terrain import (TextureReplacement.cs:325-352, TextureReader.cs:757-803), checked against the real shipped index
too; the key case; the port's vendored art (no name shared with Vanilla Enhanced); the other doors (the paper doll,
item icons, Weapon Widget, Diverse Weapons, Improved Interior Lighting); no IndexedDB; the caches; the shipped files;
the AssetInjection gate. **What did not** is below - each reproduced as a pin red on the code it read
(`test/auditve.test.js`), fixed at its root, and mutation-proven.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | Major | **A switch mid-game made a patchwork.** `setBundleTextures` let go of every mod picture decoded at each install - a switch, an add-on, a switch pressed again, a background index landing - while a scene preloads an archive's pictures once: whatever was not yet uploaded drew classic for the rest of the page, beside what was already on the GPU. A mod switched on never reached an archive the scene already held. | **A decoded picture knows the entry it came from** (`textureReplacement.js`; a mod's entry carries `src` - its key, its index's content and the name): it answers only while that entry answers its key, so a switch never draws a stale picture and never costs one whose source still answers, and the sweep lets go of what no tier registers. **A scene's archives are current with the tiers** (`textureTierEpoch`, `dataPipeline.js` `getTexture`): the next ask of an archive after a change decodes what answers now, only what changed. The same walk again keeps the ground sets and the IMG/CIF pictures. What is already drawn keeps its pictures until its area loads again, as the card says. |
| R2 | Major | **The main menu's card read a door holding the shipped mods alone.** The enhanced main menu runs before any host boots, and the store registered only at a host's boot (the boot seam's own copy of the registration) or a pick: an attached DREAM read as "Classic, in use", and Use Classic switched off only the shipped mods. | **One registration of the store** (`dataSource.js` `registerTextureStore`): the boot seam calls it, its copy gone; the menus' door (`textureStoreRegistered`) begins it if no boot or pick has; the Overhauls pane and the packs card wait for it and draw again when it lands, and the texture card offers no Use while it reads. |
| R3 | Minor | **A copy over a shipped mod switched a switch of its own.** Classic worn over the player's copy was a key on the attached shelf; the copy removed, the shipped Base came back on. | **One switch a mod**, as DFU keeps one Mod.Enabled a Title (ModManager.cs:859-868): a copy wears the shipped mod's switch, and the attach's own step (`noteDfmodAttached`) switches it on - a mod attached is on (VE3). |
| R4 | Minor | **A mod attached again under its own name was the "same set"** - the signature was the key list, so a newer version stood unread behind the old index, and the bundle opened under it, for the session. | **The signature is the indexes' content**: they are read first, and a registration that reads the same keeps its opened bundles. |
| R5 | Minor | **A copy still being indexed, or one that would not index, shadowed the shipped mod** and was listed nowhere - no Base, no row, no Remove. | Only a **registered** copy shadows; a stored mod not registered is listed on the packs card with its state (being read, not working and why, or ?nomods) and its Remove (`unregisteredDfmods`). |
| R6 | Minor | **VE1's index bump unregistered every attached mod** on the first boot after the update, until its rebuild landed; one that could not be rebuilt vanished. | An index of the version before **registers at once** (the listing's order) and is rebuilt in the background; a failed rebuild keeps it registered. |
| R7 | Minor | **A picture asked while a registration read its indexes cached the old registration's client** for the new one: the shipped client served the copy that replaced it, or a removed copy's null blanked the Base. | The opened clients are let go **where the new registration replaces the old**, in one step, not before the reads. |
| R8 | Minor | **A decode in flight when its mod was switched off landed anyway**: Classic chosen while an area loaded drew Vanilla Enhanced there, and counted against the budget. | A decode lands only if its entry still answers; the budget counts a picture where it is kept. |
| R9 | Minor | **A copy under another file name** (the browser's "(1)" download) did not shadow the shipped mod: both registered, the shipped one loading later and winning every name, while the card named the copy's version. | Shadowing by **key or Title** - DFU loads one mod a Title (ModManager.cs:590-595) - and the copy wears the shipped mod's switch. |
| R10 | Minor | **With a loose texture pack attached, Classic could not be worn**: Use Classic did nothing seen, and the card stood on Custom saying "a mix of texture mods is switched on" with every mod off. | The card says why (`classicBlocked`) and offers no Use while a loose pack is attached; the Custom note names the loose pack. |
| R11 | Minor | **?nomods depended on the pane opened**: the boot skipped the shipped pack under it, and a menu registered the pack and could register the attached mods. | The rule is the door's (`noModsPage`): no attached mod registers on that page from anywhere, each listed to be removed; the shipped pack is the port's own and registers either way. |
| R12 | Minor | **One slice that would not load cost the climate**: the shipped array's fetches were all or nothing, and the failure stood for the page. | A lost slice stands as the classic record, as a record-built set's missing record does; a set that lost a picture is answered, not kept. |
| R13 | Nit | **The doll composed at four times for mods that carry no doll art** - the lighting mod, a mod switched off, a copy of Vanilla Enhanced. | Four times only while a mod switched on carries doll art - an IMG, a CIF/RCI, an item picture (233-252) (`dfmodCarriesDollArt`). |
| R14 | Nit | **A test claimed more than it checked**: ve4's "each proved within BC7's error" read the numbers the tool wrote; R1, R2 and R4 had no pin. | The test says what it reads - the tool's recorded proof and the bytes; the decode proof is the vendoring tool's, re-run against a clone by its check. R1, R2 and R4 are pinned. |

**Also found while fixing.** The first cut of R1's "entry that answers now" put the port's own art before a loose pick;
DW3's pin caught it (a loose `233_7-0_Iron` over Diverse Weapons' icon). The order stays `entryFor`'s - the loose pick,
the port's own, the mods' - which is DFU's (the loose folder before any mod).

**Outside the code: the permission record.** `vendor/vanilla-enhanced/README.md` records Mac's word of carademono's
permission (Mac: "Approved and yes"); carademono's own words or a link, and Kokey's for Masked Roads, are Mac's to paste
in - the line stays RECORD OPEN until then.

## The tests' own honesty, and the record

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | Nit | **The VE4 commit carried a stray build stamp:** `npm run build` writes HEAD's sha into `src/buildTag.js` (`scripts/buildTag.mjs`, at prebuild), and the run before the commit put `3194de87f6b3` over main's value - a change to a tracked file that is no part of the work (the CI build stamps its own at every deploy). | Restored to main's value: the PR no longer touches the file. |

Every new line has a mutant, and every mutant dies: `tools/mutants/auditve.json` (44 - the review's thirty with them),
`ve4.json` (22) and `ve1.json` (35, one recorded equivalent: VE3's count-zero early return, whose law R1's walk
signature now holds - the record says why) killed again; the review's fixes re-aimed eighteen older records by content
(`dw1.json`, `surv2.json` among them), and the pins they moved carry `PIN MOVED` notes - the records this audit's lines moved re-aimed (`VE4-detail-not-honoured` to the page's
fallback fit, `VE4-fit-not-a-mip` to `formats/resample.js`, where the mip rule now lives once for the page and the
worker), and VE4's two on the old switch (`VE4-shipped-on-by-default`, `VE4-shipped-switch-on-the-attached-shelf`)
replaced by `AUDITVE-*` on the new one. The browser half, `tools/overhaulsProbe.mjs`, reads the card as a fresh game sees
it - Vanilla Enhanced in use - and the decode worker made and used in Chromium.
