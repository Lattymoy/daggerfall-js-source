# DFO Online - the bible

**DFO Online** is its own game, built on The Elder Scrolls II: Daggerfall's data. It uses hand-rolled WebGL2, Vite
and Node ESM, with no framework. It began as a port of Daggerfall Unity's C#. Since SCOPE1, DFU is the reference we
read first, not the target (`01-Overview/Port-Doctrine.md`). Read Port-Doctrine before you change code.

The bible says how the game works now. Each page covers one system: how it works, its rules, how it relates to DFU,
and the code and tests that hold it. History lives in git and in pull request descriptions, never here
(HISTORY-OUT). Pages before this rule are in git at `8d1563b4c8a9a76fdd9def292d2a248370dce536`.

## Writing a page

- Say how it works now. When a change alters behaviour, update its page in the same change.
- No slice tags, dates, "was / used to", or quotes from the conversation. A standing owner decision is a rule: write
  it as one and name who made it (Mac, the owner, Dudey).
- Name code by path and symbol in backticks: `src/scenes/fishHost.js` `fishKind`. Every path must exist
  (`test/bible/audit18_bible_docs.test.js`).
- A cite into a line of our code is an anchor, never a line number (A CITE NAMES WHAT IT POINTS AT, below).
- A paragraph is at most 150 words (PLAIN-TEXT). Edits by script assert that the text they replace was found.

## Rules

These bind every change. A rule's name is how code, tests and pages refer to it.

**SCOPE1.** DFO Online is its own game. DFU is the reference: read it first, name each departure at its site (Mac).

**TAMRIEL-WIDE.** The world is all of Tamriel; the Iliac Bay is one theatre of ten (the owner). New work works in
every province, or its page says where it does not and why. Key a pixel by `worldPixelKey`, bound it by
`worldPixelOk`, find a place in `worldPlaces`, read regions 0..70. MapsFile's `y * 1000 + x` and 0..999 bounds are
the Bay's own data, read behind `inBay` with a `BAY-OWN:` comment. Pins hold a case past the Bay.
`test/tooling/tamrielwide.test.js` holds the tree to `tools/tamrielWideBaseline.json`, which only goes down.

**HOST-SPLIT: the hosts do not grow.** `bootWorld`, `createWorldModes`, `buildDungeonContext`, `bootExterior`,
`createNavalHost` and `createComeSailAwayRuntime` keep their state in one function's scope. New behaviour goes into a
module the host wires (`src/scenes/fishHost.js` is the shape), and on the relay into a Room method of its own, never
into `_message`. `test/scenes/hostceiling.test.js` holds each to a ceiling in logical lines. A change that moves code
out lowers the ceiling in the same change (`01-Overview/Host-Split.md`).

**THE FOUR HOSTS.** Four files own a motor: `src/scenes/exterior.js`, `src/scenes/world.js`,
`src/scenes/worldModes.js` (interiors) and `src/scenes/dungeonContext.js`. A change that wires a seam into one names
all four, each wired or FLAGGED.

**PLAIN-TEXT: say it once, plainly** (the owner). Player text says what the player needs, once: at most 40 words a
string and 25 a sentence, no padding. A comment says why in at most 8 lines: not what the next line does, not its
history. A bible paragraph is at most 150 words. `test/tooling/plaintext.test.js` holds all three to
`tools/plainTextBaseline.json`, which only goes down (`node tools/plainText.mjs --lower` after a cleanup).

**HISTORY-OUT.** History lives in git and PR descriptions. No slice log in the bible, no ticket tag, date or quote in
a comment.

**THE CEILING HOLDS (POWER-CEILING)** (the owner: "No exceptions and no band aids"). No line of any piece goes past the
Legendary band's top, and the rarity ladder keeps its seven rungs. New content adds sideways (a set for another build,
a power that changes play, a look), never higher numbers. A new rung, a higher band or a stronger number needs the
owner's explicit approval, quoted in `05-Combat/Power-Ceiling.md`. `src/systems/powerCeiling.js` holds the law;
`test/combat/powerceiling_walk.test.js` walks every record and minted item against it.

**LOOT-GATE** (Dudey). Public text never gives the levels, factors or chances in `src/systems/loot/lootLevelGate.js`.

**PROMPT-HIDDEN** (Mac). The repository is public, so a model's prompt never lives in it. A service's prompt is a Worker
secret that the account deploy puts from a repository secret of the same name (`MOD_AI_PROMPT`, `CLAUDE_STAFF_PROMPT`).
A tool run on a person's machine reads its prompt from an env var or the ignored `.prompts/` folder
(`TRANSLATE_PROMPT`). Without its prompt, a model is never called. No page, test, commit or PR quotes a prompt.
`test/tooling/prompthidden.test.js` holds the code to it.

**ONE DFU MEMBER, ONE EXPORT.** Before porting a DFU class or method, grep the tree for its name and its constants. If
two files need it, one exports and the other imports.

**A PIN MUST FAIL.** A test that pins a law must fail under a one-character change to that law. Prefer `deepEqual`
against the literal over spot checks and inequalities, and mutation-check new pins (`tools/mutate.mjs`).

**TEST THE SHAPE THE PRODUCER MINTS.** Build fixtures from the real producer, or assert the producer's own output. A
hand-built literal can pass while nothing in the game makes that shape.

**THE MODAL CONTRACT.** A function whose return value gates a host frame returns the same type from every exit.
Assert it in a test.

**THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD.** A host slot that holds one thing (an overlay, a context, a
window) is cleared, or given its successor, before the occupant is disposed or notified. A close that dispatches a
callback dispatches it once, however many paths call it.

**ASYNC NEVER DROPS.** Where we await and DFU did not, a request that arrives mid-flight is coalesced, never dropped.

**EVERY ALLOCATION HAS AN OWNER.** Every GPU allocation (`createBillboardBatch`, `uploadTexture`) has a matching free
in its owner's teardown, reachable from the path that ends the object's life.

**THE ONE CONSTRUCTION SEAM.** A thing two hosts build gets one constructor that attaches every dependency. Hosts
call it and never build it themselves; where it matters, a test sweeps the source to enforce it.

**THE NATIVE-WINDOW RULE.** A window that keeps DFU's layout cites the DFU source (file and member) of every drawn
element: rect, font, colour, scale, alignment. An unknown value is looked up before the element draws. Check it
against the classic art's own frames. A window redesigned on purpose cites its own design page.

**RETIRING A FLAG DELETES THE SENTENCE.** When a change closes a FLAGGED or INTERIM site, it removes the old sentence
rather than adding a retiring one beneath it. The open-flags list below is generated from those sites.

**A CITE NAMES WHAT IT POINTS AT.** A cite into a line of our code is an anchor that quotes the line:
`world.js:"const livingQuarry = () =>"`. Never a line number. Write a number and `npm run cites -- --apply` converts
it; `test/tooling/citeanchor.test.js` resolves every anchor and refuses a live number. A C# line names its file
(`StaticNPC.cs:309`).

**PATCH NOTES** live in the PR description under `## Patch notes: <title>`, in ASD-STE100 Simplified Technical
English, checked by `scripts/steNotes.mjs` (STE-NOTES, the owner). Never commit a patch-notes file
(`01-Overview/Desktop-App.md`).

**UPDATES ARE NUMBERED, AND NOBODY BUMPS THEM** (Mac). Every merge to main is the next update, MAJOR.MINOR.PATCH. The
line is in `scripts/updateLine.mjs`; the patch is counted from git (`scripts/updateNumber.mjs`). No PR writes a
number.

## How we verify

- **Probes frame-sync.** A Playwright probe of the live frame loop waits on the shot-mode `__frame` counter, never a
  sleep: SwiftShader renders at seconds per frame.
- **Compare close-ups against the raw art.** Sprite orientation and native-window layout are checked on close-up
  crops beside the record's own art, never on a distant screenshot.
- **Ground-truth a renderer diff.** When theory stalls, rebuild the scene and camera in Node, project known points to
  screen and read the framebuffer on near tiles. Check that every draw pass is still in the frame before explaining a
  large diff away. A draw entry point binds its own program.
- **Do not fix while a verifier reads.** An adversarial review reads the working tree. Let its verify pass finish, or
  give it a snapshot, before you change the code it quotes.
- **Before a push:** `npm run lint`, `npm run types`, `npm run gates`, `npm run test:changed`. CI's `verify` runs the
  whole gate on every PR.

## Sections

- `01-Overview/` - doctrine, code map, host split, desktop app, mod registry
- `02-Formats/` - the binary readers, Morrowind's formats, world-data patches
- `03-World/` - terrain, places, streaming, the provinces, the sea
- `04-Characters/` - bodies, NPCs, the Morrowind look
- `05-Combat/` - formulas, weapons, the power ceiling
- `06-Systems/` - quests, items, magic, guilds, professions, accounts, the online world's systems
- `07-Rendering/` - the WebGL2 renderer, sky, water, lighting, performance
- `08-Audio/` - music and sound
- `09-Testing/` - how the suite runs and what a test must do
- `10-UI/` - HUD, menus, windows, controls
- `11-Multiplayer/` - the relay, rooms, Elite Gates, world bosses, scale
- `12-Enhanced-AI/` - NPC and foe behaviour beyond DFU

## Deploy

Production is GitHub Pages via `.github/workflows/deploy.yml`, gated on CI's `verify`. Builds contain no game data.
At runtime `src/scenes/dataSource.js` resolves files from memory, then IndexedDB, then `./arena2/`. On the deployed
site a boot overlay asks once for the player's ARENA2 folder and keeps it in IndexedDB.

## Repo layout

`01-Overview/Code-Map.md` maps every directory, where a new file goes, and how a file moves (`tools/moveModule.mjs`).
Code is filed by layer, then feature; tests mirror it. `src/main.js` is the entry point and scene router. Prototype
HTML pages at the repo root register in `vite.config.js` `rollupOptions.input`. One feature at a time; grep first.

## Open flags

Generated from the FLAGGED and INTERIM sites in `src/` by `node tools/regenOpenFlags.mjs`. Do not edit by hand.

- `src/combat/fpsSpellCasting.js` - * FLAGGED: TextureReplacement.TryImportCifRci (:179) - the loose-file
- `src/net/professionLaw.js` - *  metal's, and a twig's picture is neither's (unverified without the player's data - FLAGGED to Mac's eye). */
- `src/player/mwView.js` - FLAGGED: Eye Of The Beholder has no sitting art - on that lane the driver's sprite stands on the bench's footboard, still (bible/06-Systems/Wagons.md WAGONS3).
- `src/player/seatPose.js` - FLAGGED (Tavern-Cards.md section 12, CARDS2c): the seat poses the Morrowind body alone - Eye Of The Beholder has no sitting art, so a sprite body (a peer's walker, their paperdoll) stands at its seat facing the table.
- `src/scenes/craftWritHost.js` - scenes/exterior.js - FLAGGED: the fixed-city bench never goes online, so it posts no crafting writ, as no Court writ.
- `src/scenes/dungeonContext.js` - FLAGGED (bible/12-Enhanced-AI/Feud-Arc.md 10.1, section 32): this stream carries none of the street record's z, nm, yd, ex or sp - FEUD adds its own fields alone (RVN13: so no band follower's rt either)
- `src/scenes/exterior.js` - NOTICE-PANEL: a town's board (RMBLayout's standalone 41739) does not stand. FLAGGED: the bench stands no town panel.
- `src/scenes/exterior.js` - TP2 INTERIM - THE ONE ARM THIS HOST CANNOT TAKE: a jump to an anchor on ANOTHER map pixel. Teleport.cs:145-163 respawns at the anchor's world position, which is StreamingWorld's job (scenes/world.js's `_teleportToPixel`, the door `teleportPrompt -> teleportTo` opens); `?exterior` loads ONE fixed city and runs no streamer, so there is no arrival to build - and it says so instead of eating the cast, the way the standalone dungeon says so about its two windows.
- `src/scenes/horseCartPool.js` - FLAGGED: a peer's word does not say how many horses they own - their parked pair is drawn whole, and their second horse is not drawn at their parked wagon while they ride the first (bible/06-Systems/Wagons.md WAGONS3).
- `src/scenes/horseCartPool.js` - FLAGGED: the horses are billboards, so a trace's collar and a rein's bit are measured points on the picture, not on a body - from some angles a trace meets the picture beside the horse's chest (bible/06-Systems/Wagons.md WAGONS3).
- `src/scenes/jungleHost.js` - scenes/exterior.js (the fixed city), scenes/worldModes.js (interiors), scenes/dungeonContext.js (dungeons) - FLAGGED: none stands the wilderness the jungle grows in
- `src/scenes/ketch/ketchFight.js` - BOSS-TRAITS (bible/05-Combat/Boss-Traits.md section 3; AUDIT WORLD-EVENTS L5-16) - FLAGGED: the Tonal Warden carries no boss traits; its health and blows are the ship's room's, and this deck host has no striker's half yet.
- `src/scenes/ketch/ketchFight.js` - /** THE INTERIM WARDEN'S DARKS (KETCH-LOOK KL2, Sky-Ketch-Look.md section 10, until its baked sheets land - KL15): the Ketch's
- `src/scenes/landPropsHost.js` - FLAGGED: none stands the wilderness past the Bay the landmarks stand in.
- `src/scenes/merchantYardsHost.js` - scenes/exterior.js - FLAGGED: the single-town bench stands no yard; the streaming host is where its towns are played.
- `src/scenes/poiHost.js` - scenes/exterior.js - FLAGGED: the fixed-city bench (`?exterior`, `?region&loc`) has no feed; a POI stands in the streamed world.
- `src/scenes/portHost.js` - scenes/exterior.js - FLAGGED: the single-town bench stands no port; the streaming host is where its towns are played.
- `src/scenes/raidSitesHost.js` - scenes/exterior.js - FLAGGED: the fixed-city bench runs no raid; the streaming host is where its towns are raided.
- `src/scenes/raidSitesHost.js` - scenes/worldModes.js and scenes/dungeonContext.js - FLAGGED: a raid is the street's, and stands nothing indoors (RAID1).
- `src/scenes/seatBanners.js` - and dungeonContext.js stand no street; exterior.js (the bench) FLAGGED -
- `src/scenes/soundscapeHost.js` - scenes/exterior.js - FLAGGED: the fixed-city bench stands no sea, no boats and no streamed shore - its ambience is DFU's.
- `src/scenes/wagon/wagonWardenHost.js` - scenes/exterior.js - FLAGGED: the single-town bench runs no town watch (its wagon is never stamped nor thrown).
- `src/scenes/world.js` - FLAGGED (Legacy-Arc.md section 3): exterior.js, the fixed city, keeps DFU's death - no streamer to birth an heir into.
- `src/systems/playerTorch.js` - arm is FLAGGED here rather than guessed - see the note below.
- `src/systems/playerTorch.js` - FLAGGED (blocked on data this reference tree does not carry): the
- `src/ui/enhanced/enhancedMenu.js` - FLAGGED: the rest of the keyboard. The wizard walks to `done` with
- `src/ui/pauseWindow.js` - FLAGGED: PauseOptionsDropdown (:83-84) - DFU's own quick-settings
- `src/world/wagonModels.js` - FLAGGED: the Small Cart has no bench (Mac's choice) - its driver rides its horse the mod's way, and RIDE-POV keeps the Morrowind body in the head on it (bible/06-Systems/Wagons.md WAGONS3).

