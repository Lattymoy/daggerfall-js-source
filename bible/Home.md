# project-dagger

**Daggerfall Online** - an open-source reimplementation of The Elder Scrolls II: Daggerfall (BR4, 2026-09-27; it was DAGGERFALL ENHANCED from BR1, 2026-09-13, and DAGGERFALL JAVASCRIPT from U60 until then). A 1:1 port, built the way we build: hand-rolled WebGL2, Vite, Node ESM, no framework. Data layer and game logic ported faithfully from Daggerfall Unity's reverse-engineered C#; presentation rebuilt on our stack; characters rebuilt on our voxel system.

Read `01-Overview/Port-Doctrine.md` before touching anything.

## Process

Doc edits are part of the change: every scripted bible edit must ASSERT
the needle matched (a silent `.replace` no-op shipped a stale
Rendering.md queue in the M6 audit and was only caught in the M7 audit).
Verify doc diffs in `git diff` before committing, same as code.
Sprite-orientation checks must compare close-up render crops against
the raw record art - a distant screenshot passed a vertically flipped
billboard shader for six milestones (caught by Mac after M8).
Playwright probes of the live frame loop must frame-sync on the
shot-mode __frame counter, never sleep - SwiftShader renders the
streaming scene at seconds per frame, so sleeps sample stale state
(M9 audit probe initially reported zero crossings for a real flight).
Unity asset values (prefab lights, AnimationCurve keys) are groundable
without widening the sparse clone: git show HEAD:Assets/Prefabs/....prefab
reads the YAML from the object store (used to verify the R5 constants).
When a renderer change diffs against a baseline and theory stalls,
build a screen-projection ground-truth probe: rebuild the scene's data
+ exact camera in Node, project known world points to screen, and read
the framebuffer pixels - single far pixels are rounding-limited, so
verify laws on NEAR tiles (a shot-mode override hook can force test
bytes). The R9 HLSL-row-major/GLSL-column-major transpose was only
provable this way. But probes verify what they sample: R9 initially
shipped with every building missing because the probes only ever read
terrain fragments - when a diff spans a large frame fraction, check
full-frame composition (every draw pass still present?) before
explaining the diff away. Draw entry points must own their program
binding; interleaving a new pass exposed drawMesh's assumption.
DO NOT FIX WHILE THE VERIFIER IS READING (17l). An adversarial
review reads the WORKING TREE. Fixing its findings while its
verify pass is still running makes every verdict come back
"refuted - the code you quote does not exist", which is
indistinguishable from "the finding was wrong". 17l's eighteen
verdicts all landed that way and had to be re-read by hand to
tell the two apart (one of them says outright that the DFU
reading was accurate). Either let the verify pass finish before
touching the tree, or hand the verifiers a snapshot.

THE FOUR HOSTS RULE (17e). Four files own a motor:
scenes/exterior.js, scenes/world.js, scenes/worldModes.js
(interiors), scenes/dungeonContext.js. A slice wiring a seam into
one must NAME ALL FOUR in its record - each either wired or FLAGGED
by name. U8h enumerated "both exterior hosts" and flagged the
dungeon; the interior host owns a fourth weapon rig and went
unmentioned, so buildings still swing the interim dagger. The same
omission produced the missing FOV gate and the unshifted guards in
?world.

THE MODAL CONTRACT (17e). A function whose return value gates a
host frame must return the same type from EVERY exit. One branch of
ten in worldModes.frame() returned undefined; the hosts read that
as "not handled" and ran a whole exterior frame on top of the
dungeon. Assert the contract in a test, not a comment.

ONE DFU MEMBER, ONE EXPORT (17e; restated after U8f's near-miss and
violated by the very next slice). Before porting a DFU class or
method, grep the tree for its name AND its constants. U8h rebuilt
GetMaterialArmorValue in systems/equip.js and drifted; droppedLoot.js
re-declared the treasure table the 2026-07-06b audit had already
single-sourced. If two files legitimately need it, one exports and
the other imports - never two literals.

A PIN MUST FAIL (17e). Every assertion claiming to pin a DFU law
must fail under a one-character mutation of that law. Three shipped
pins did not: `assert.ok(bows >= 8)` survives promoting any weapon
to two-handed; `Math.trunc((100-55)/5) === 9` touches no port code;
and `ANSWERS_TO_DIRECTIONS[15] === 7261` certified the WRONG table
and would have blocked its own fix. Prefer deepEqual against DFU
literals over spot checks and inequalities, and mutation-check new
pins.

TEST THE SHAPE THE PRODUCER MINTS (17e). A test that hand-builds an
item/entity literal can pass while nothing in the running game
satisfies it. Three suites asserted on `{ enchanted: true }` - a
property no producer writes - so the enchanted paths were dead in
the shipping game and green in CI. Build fixtures from the real
producer, or assert the producer's own output.

THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD (from play,
2026-08-29). A host slot that holds ONE thing - an overlay, a
context, a live window - must be nulled BEFORE the thing in it is
disposed, closed or notified, because a teardown runs the
occupant's code and the occupant may ask the host to clear the
slot. townTalk disposed first and cleared after, S40 had opened a
door for exactly that callback (DFU's PopToHUD before
RaiseSkills), and the re-entrant close read a slot still pointing
at the window being disposed: fifty frames of
closeOverlay -> onClose -> _close -> dispose -> closeOverlay, on
EVERY close path of the rest window, off the live site. Clearing
first makes the re-entrant call answer with the truth - the slot
IS free - and it is the same law for a REPLACEMENT: put the
successor in the slot before telling the outgoing occupant, so
its identity guard sees the new one and leaves it alone. The
occupant owes the other half: a close that dispatches a callback
dispatches it ONCE, however many doors call it, so a window is
safe to close from either side and no future host has to know the
rule. Pin both halves against the other being broken, or the next
window finds the half nobody fixed.

ASYNC NEVER DROPS (17e). DFU is synchronous; where the port awaits,
a request arriving mid-flight must be COALESCED, never discarded.
refreshPaperDoll's boolean re-entrancy guard silently threw away
equip updates, leaving the doll and its click mask stale.

EVERY ALLOCATION HAS AN OWNER (17e). DFU relies on Destroy/GC; the
port does not. Every createBillboardBatch / uploadTexture needs a
matching free in the owning module's teardown, and that teardown
must be reachable from the path that ends the object's life.

RETIRING A FLAG DELETES THE SENTENCE (17e). When a slice closes an
INTERIM/FLAGGED site, remove the old sentence - do not append the
retiring one beneath it. The open-flags list is grep-regenerated
and lifts stale half-sentences out of their retiring context.

A CITE NAMES WHAT IT POINTS AT (CITE-ANCHOR, 2026-10-06; Mac, "Im so
fucking tired of conflicts"). A cite into our own code is an anchor:
`world.js:"const livingQuarry = () =>"` is the one line of world.js that
holds that text; a line too common to quote is named after the quotable
line above it, `world.js:"if (modes.frame(dt, now)) {".."}"` (with its
indentation, `.."  }"`, past an inner block's twin). Never a line
number: `world.js:N` was a claim about every line above N, so every
change to a host rewrote the docs that cited below it, and two branches
that touched one conflicted on the same doc lines. Write a number and
`npm run cites -- --apply` converts it (tools/citeAnchor.mjs);
test/citeanchor.test.js resolves every anchor (CA1) and refuses a live
number (CA2). Records keep their numbers: struck text is the
measurement's, a renumbering told as history is written as plain
numbers (`world.js line 6142`), not as a cite, and a line the code no
longer has is a record of where it stood (`teleportPopUp.js` line 87 at
0fc1d9e92). A C# line beside one of ours names its file
(`StaticNPC.cs:309`) or says it is C# (`(C# :309)`): a bare `(:N)` after
a cite reads as a line of the cite's own file, so citeShift moved C#
numbers as if they were ours, and the conversion's review found them.
After prose that names other code - DFU or C# by name, a PascalCase name,
another file of ours - the tool holds a bare `(:N)` for its writer to
spell out (headOwns).

A SLICE CLOSES ITS LEDGER ROW (2026-08-19). Port-Ledger section C
is not a memo, it is a CLAIM that something is unported - so a
stale row is worse than a missing one: it sends the next slice off
to build what already ships. Before closing, grep section C for
the DFU members you touched and strike, narrow, or update every
row you moved. `node tools/ledgerSweep.mjs` narrows the read: it
cross-references each unstruck row against the arc docs' own
SHIPPED/CLOSED headings and against non-comment src/. Run against
the pre-sweep ledger it caught 2 of the 4, with 2 standing false
positives - A CLEAN RUN IS NOT PROOF. It missed the two that a
matcher structurally cannot catch: one where the port RENAMED the
member (MakeHouseContainer -> isHouseContainerModel) and one where
the closing slice used its own vocabulary. Those need the eye.
The failure mode is specific and it is NOT forgetfulness: all four
rows found stale in the 2026-08-19 sweep were closed by a slice in
a DIFFERENT arc from the row's Target column. P12 (Player) shipped
breath/drowning; Audio closed the transition stingers as verbatim
N/A; S2b and E2 (Systems) shipped two thirds of the interior
container row; S23/S24 moved five career flags from INERT to LIVE.
Every author updated their OWN arc doc and none thought to touch a
ledger row filed under someone else's. So the sweep is owned by the
slice, not by the arc - if you shipped a DFU member, the row naming
that member is yours to close no matter whose column it sits in.
NARROW, do not strike, when a slice ships part of a row: say what
landed and what is still open, or the next reader reads a partial
close as a whole one.

THE NATIVE-WINDOW RULE (from the 17d UI audit, after three
positioning hotfixes in two days): every drawn element of a native
window - rect, font, color, scale, alignment - must cite its DFU
source (file + member) before it ships; no free-styled geometry. If
the DFU value is unknown, the element does not draw until it is
looked up. And native-window screenshots are eyeballed against the
CLASSIC layout (the art's own frames are the ruler - an icon
crossing a baked slot border is a positioning bug even when the
code "looks right").

**THE ONE CONSTRUCTION SEAM** (AUDIT 17i). When two hosts build the
same object, every dependency it grows must be remembered twice - and
one of them will forget. The chargen flow proved it three times over
three audits. A shared thing gets ONE constructor that attaches
everything; hosts call it and never `new` it themselves, and where the
rule matters a test SWEEPS THE SOURCE to enforce it rather than
trusting the next author to recall it.

THE HISTORY WAS REWRITTEN ON 2026-08-27, before the repository went
public as daggerfall-js-source (Mac's call, with the MIT licence and
DFU's notice). Four paths that had once been committed and later
deleted still sat in every old commit - the classic BODY00I0 sprite
under src/characters/paint/, the AUDIT 21 gallery frames under
public/visual-changes/, and the two traced-silhouette JSONs under
src/characters/backs/ - and a public repository publishes its
history, not its tree. `git filter-repo` removed those paths from
every commit on every ref; 1,420 commits changed sha. Every sha this
bible cited was rewritten to its new value from the commit map (36
of them; the map itself is NOT committed - it is a list of the old
shas, which is the one thing that must not be published). The
previous repository was kept private under another name. If a sha
cited anywhere fails to resolve, that is why, and Mac holds the map.

PATCH NOTES LIVE ON THE PULL REQUEST (REL6, 2026-10-01, Mac: "somehow
refrain from patch notes filling up the codebase"). A change players
will notice says so in its pull request's description, under `## Patch
notes: <title>` - the template asks, the release reads it there
(`scripts/desktopRelease.mjs notes`), and the published release is the
archive. Never commit a patch-notes file: 147 piled up at the root, each
read once, and `test/rel4_release.test.js` now fails the suite on one.
A description fixed after its release was cut reaches it on its own:
editing a merged pull request's description has
`.github/workflows/release-notes.yml` rewrite that release's notes (REL7).

## Sections

- `01-Overview/` - vision, port doctrine, phase plan, Port-Ledger (departures/quirks/unported)
- `02-Formats/` - binary format readers (BSA, TEXTURE, IMG/CIF, ARCH3D, BLOCKS, MAPS, SND, SKY)
- `03-World/` - block assembly, terrain, location layout, streaming
- `04-Characters/` - voxel rigs, paperdoll-as-outfits, NPCs
- `05-Combat/` - FormulaHelper port, weapons, hit resolution
- `06-Systems/` - quests, items, magic, guilds, calendar, save format
- `07-Rendering/` - WebGL2 renderer, palettes, lighting, sky
- `08-Audio/` - music (HMI/XMI), sound effects, audio state machine
- `09-Testing/` - test doctrine, harnesses, data validation
- `10-UI/` - HUD, menus, native Daggerfall UI reproduction
- `11-Multiplayer/` - co-op: the three locked decisions, the architecture, the arc (the design the ONLINE arc grows into - presence, then chat, then the room's memory (WORLD1), then the room's simulation (WORLD2), then the room's events (WORLD3), then the room's loot (WORLD4) - `06-Systems/Online-Arc.md`); and `World-Bosses.md` (WB, 2026-09-25) - the Oblivion Gate: a world boss on the shared clock, the relay's first authority over a foe; and `Sigil-Sets.md` (SET, 2026-09-26) - SIGIL SETS: armour, shields and weapons whose sigils name a Daedric Prince's set, 2 / 4 / 6-piece abilities that grow with the set's lowest piece, the gate boss's Aetheric Ruhn's Regalia, and the Sigil Broker beside the gate; and `Super-Dungeons-Look.md` (SD-LOOK, 2026-10-08) - the Abyss Dungeon's visual spec: the Rift, the Return, the step through and the Hour's set pieces rebuilt in Daggerfall's pixel art, five lights with five meanings, and the build order its slices ship in
- `01-Overview/Active-Arcs.md` - ACTIVE ARCS, one line per arc, each naming its own page (HARD5, 2026-09-15: moved out of this file, which was 291 KB)
- `01-Overview/Audit-Log.md` - THE AUDIT LOG, newest first: every audit that has no page of its own (HARD5, same move)

Moved to `01-Overview/Page-Index.md` (HARD5's ceiling, at WALLET1's merge of main,
2026-10-05; the last eight lines, AUDIT 625) - 63 KB of it, in 61 lines: the pages with a
record of their own, one line each. A new page's line goes there.

## Active arcs

Moved to `01-Overview/Active-Arcs.md` (HARD5, 2026-09-15) - 172 KB of it,
in 89 lines. One line per arc, each naming its own page.

## Open flags (regenerated 2026-08-19, AUDIT 18)

Regenerated mechanically at the AUDIT 18 close, from the FLAGGED/INTERIM
sites themselves. The audit retired 30+ flags whose text had gone false and
the eleven fix domains moved many more, so every line number and quotation
here was re-derived rather than edited. test/audit18_bible_docs.test.js now
pins this list BOTH ways: a citation that drifts, a flag retired without its
sentence, or a new flag never listed all fail the suite.

AUDIT 18: "Line numbers refreshed" used to close this paragraph as a hand
kept promise, and six of the 109 citations had already drifted (up to 41
lines) when 9036e49 moved chargenArt.js. The promise is gone; the list is
now checked mechanically both ways by test/audit18_bible_docs.test.js -
every citation's quoted text must sit on the cited line, and every
FLAGGED/INTERIM site in `src/` must appear here. A slice that moves a
flagged site turns that test red until the list is regenerated.

CITE-ANCHOR (2026-10-06): the entries carry no line numbers. An entry
names its file and quotes its flag, and the quote is the address -
test/audit18_bible_docs.test.js matches each entry to a line of its file
that reads so, and the flags in `src/` to the entries both ways, counted.
A number here was a claim about every line above the flag: any edit above
one rewrote this list, and two branches that both made one conflicted on it.

AUDIT 18 (combat) RETIRED the racial/proficiency half of
playerWeapon.js's INTERIM sentence and DELETED it: chargen writes the
DFU-numbered raceId, so CalculateRacialModifiers is ported and LIVE
(formulas.js). What still pends there is CalculateProficiencyModifiers
alone, flagged at its new site inside calculateAttackDamage.

- `src/combat/fpsSpellCasting.js` - * FLAGGED: TextureReplacement.TryImportCifRci (:179) - the loose-file
- `src/net/professionLaw.js` - *  metal's, and a twig's picture is neither's (unverified without the player's data - FLAGGED to Mac's eye). */
- `src/player/seatPose.js` - FLAGGED (Tavern-Cards.md section 12, CARDS2c): the seat poses the Morrowind body alone - Eye Of The Beholder has no sitting art, so a sprite body (a peer's walker, their paperdoll) stands at its seat facing the table.
- `src/scenes/dungeonContext.js` - FLAGGED (bible/12-Enhanced-AI/Feud-Arc.md 10.1, section 32): this stream carries none of the street record's z, nm, yd, ex or sp - FEUD adds its own fields alone (RVN13: so no band follower's rt either)
- `src/scenes/exterior.js` - TP2 INTERIM - THE ONE ARM THIS HOST CANNOT TAKE: a jump to an anchor on ANOTHER map pixel. Teleport.cs:145-163 respawns at the anchor's world position, which is StreamingWorld's job (scenes/world.js's `_teleportToPixel`, the door `teleportPrompt -> teleportTo` opens); `?exterior` loads ONE fixed city and runs no streamer, so there is no arrival to build - and it says so instead of eating the cast, the way the standalone dungeon says so about its two windows.
- `src/scenes/seatBanners.js` - and dungeonContext.js stand no street; exterior.js (the bench) FLAGGED -
- `src/scenes/world.js` - FLAGGED (Legacy-Arc.md section 3): exterior.js, the fixed city, keeps DFU's death - no streamer to birth an heir into.
- `src/systems/playerTorch.js` - arm is FLAGGED here rather than guessed - see the note below.
- `src/systems/playerTorch.js` - FLAGGED (blocked on data this reference tree does not carry): the
- `src/ui/enhancedMenu.js` - FLAGGED: the rest of the keyboard. The wizard walks to `done` with
- `src/ui/pauseWindow.js` - FLAGGED: PauseOptionsDropdown (:83-84) - DFU's own quick-settings

## Audits

Moved to `01-Overview/Audit-Log.md` (HARD5, 2026-09-15) - the running log,
newest first, of every audit that has no page of its own. The ones that do
are in `01-Overview/Active-Arcs.md`.

## Deploy

Production is GitHub Pages via `.github/workflows/deploy.yml` (push to
main or manual dispatch), gated on `npm run check` - a red suite never
ships. Builds contain NO game data (Port-Doctrine: ARENA2 is
non-redistributable). The runtime data path is
`src/scenes/dataSource.js`: getBytes resolves memory -> IndexedDB ->
network `./arena2/*` (the dev middleware unchanged); on the deployed
site a boot overlay asks for the local ARENA2 folder ONCE (directory
input or drag-drop) and persists it in IndexedDB. Every reader routes
through the fetchBytes seam, signature unchanged.

## Repo layout

`src/main.js` is the entry point and scene router - no longer thin: it
builds the Renderer, holds the ARENA2 data gate, installs the cursor,
the settings/skin front-door choice and the stale-chunk recovery, then
dispatches on the query string to the scene boots it imports. Those live
in `src/scenes/` (exterior, interior, dungeon, world) with shared helpers
in `src/scenes/shared.js`; each file carries its milestone header. Data
readers in `src/formats/`, world assembly in `src/world/`, GL in
`src/render/`. `main.js` is one of the modules the module-body smoke
cannot import (`import.meta.glob` is a bundler transform), so its body is
held by text pins - tdz_selfreference.test.js is the standing guard.

## Ground rules carried from project-final

- Desktop-first. A mobile touch layer (`src/ui/touch.js`: virtual stick +
  look/attack drag + button row speaking the desktop input language) ships
  for on-device testing and is wired into all four hosts - Port-Doctrine.md:19,
  approved by Mac 2026-08-13. (AUDIT 18: this bullet denied the touch
  layer outright for six days after it landed (approved 2026-08-13). The
  open-flags list below is grep-regenerated from `src/`, so it can never catch
  a false claim in this file's own prose.)
- Bible is flat under `bible/`. This file is the index. No Dashboard.md.
- Prototype HTMLs at repo root must register in `vite.config.js` rollupOptions.input.
- One feature at a time. Grep first. str_replace over rewrites.
