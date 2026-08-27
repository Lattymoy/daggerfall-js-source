# UI-Arc (ACTIVE)

Opened 2026-07-06 after Combat completed. Goal: the classic
Daggerfall UI over our WebGL2 frame - HUD first (the Systems stats
exist, nothing shows them), then the paper windows (chargen, char
sheet, inventory, spellbook) that retire the headless interim
policies one by one.



## THE BOARD, as of U61 (2026-08-26) — OPEN, not shipped

Logged so the queue survives the session that found it. Every count
below is a `grep` over `src/` on this commit; re-run them rather than
trusting them, because they are exactly the kind of number that rots.

### THE ENHANCED LANE

The character sheet has four buttons - Inventory, Spellbook, Logbook,
History. INVENTORY is the enhanced pack now (U53-U59). The other three
still push CLASSIC canvas windows as children under the DOM, and so
does the pack's USE arm.

    THE SPELLBOOK       FIVE construction sites across FOUR hosts:
                        worldModes.js:1562 (the factory) and :1904 (a
                        HAND-ROLLED second one, 342 lines below it in
                        the same file),
                        dungeonContext.js:788, world.js:1388,
                        exterior.js:873. It is the only window TWO
                        enhanced screens already push - the sheet's
                        button and the pack's USE hand-off, whose
                        close-then-hand-over ordering U55 got
                        backwards. No law needs extracting first.
    THE LOGBOOK         THREE sites: charSheetNav.js:53,
    / NOTEBOOK          world.js:1427, dungeonContext.js:3053. A seam
                        wants making, as U52's and U53's did.
    HISTORY             ONE site (charSheetNav.js:61), and it reads
                        only the entity's backStory. The small one.
    THE HUD             No door, and unlike every screen above it is
                        drawn PER FRAME on the canvas rather than
                        mounted as an overlay. The largest surface the
                        player looks at, and the least like the four
                        doors this arc has built. It does not fit the
                        pattern; that is the interesting part.

RECOMMENDED NEXT: THE SPELLBOOK, for the reason each of U50-U53 was -
five sites and a hand-rolled duplicate is the U53 finding again, and
it is the last classic window either enhanced screen pushes twice.
Unlike U56-U58 it should be ONE slice, because the law it needs is
already exported.

### RESIDUE ON WHAT HAS SHIPPED

None of these blocks anything; all are real.

    THE OVERWORLD'S     U61's standing caveat, the U54 shape: the
    REAL BYTES          relief, markers and laws are proven on a
                        SYNTHETIC bay (47/47 in the probe) and the
                        node pins hold the height/water/bucket laws
                        against the owning modules - but the real
                        WOODS.WLD/CLIMATE.PAK render is unproven on
                        CI and always will be, because this repo
                        holds no game data.
    THE TOUCH DOOR      No touch button opens ANY travel map -
                        ui/touch.js's roster carries no V and no M.
                        Pre-existing (map-consumers audit), and U61
                        makes it worth fixing: the overworld is the
                        first map a thumb could actually drive.

    THE SPLIT POPUP     systems/itemTransfer.js:247. TransferItem
                        opens a numeric field DEFAULTED to maxAmount
                        when a stack will not fit whole (:1515);
                        BOTH skins take exactly what fits and never
                        offer the field. A DFU behaviour neither
                        window has - the one item on this board that
                        is a gap rather than a skin.
    THE DOLL'S CLICK    U59 wired GetEquipIndex to the enhanced
                        avatar. It walks the compositor's real item
                        layers, so a synthetic composite cannot reach
                        it: wired, and unproven without ARENA2.
    THE ICONS' DECODE   U54's standing caveat. tools/enhancedIconProbe
                        proves the PIPELINE against a synthetic
                        archive; that a real TEXTURE record decodes to
                        the right PICTURE is unproven on CI and always
                        will be, because this repo holds no game data.


## U62 THE SWITCH ON THE DOOR (2026-08-27, Mac's call)

Mac: "not hide the enhanced version toggle within a settings window and
instead make it more loud. Enhanced is on by default and I want people
to know they can easily switch if they want classic."

Since U49 the way between the two skins was a row under Settings >
Interface on the enhanced side and a footer button on the classic
settings window - correct, and invisible to anyone who did not go
looking. Now the word ENHANCED under the brand, which had been a
label, IS THE CONTROL: the two skins side by side in the brand block's
own tracked caps, the one in effect in brass and aria-pressed, the
other a press away, and "switch anytime" under them, because a pair of
words is not obviously a control until it says so. On a phone the pair
is 44px tall, as every control on a phone is (U51's rule). It is drawn
on the DOOR only - the wizard's and the pause's brand blocks keep their
own subs; a player mid-game switches from Settings as before.

ONE DOOR. The settings row and the brand switch call the same
`switchSkin(to)`: it stores the choice through uiSkin and reloads with
the ?skin= override dropped, because the two skins are two hosts and
there is nothing to hand over in place. The row had carried that logic
inline; it is the one exported function now, and the pin holds that
exactly one place drops the override. The classic side is untouched
(its footer button was always the way back), and the site's "Classic
or enhanced?" line says where the switch is.

Pins: uiSkin.test.js's "way back" test grew the door's half - switchSkin
exported and used by the row, the switch under the brand and the bare
word gone, both skins always shown, the one in effect pressed and
inert, the other switching, the hint present, brass in the style, 44px
on a phone; 1 mutant dead. Live: enhancedMenuProbe 22/22 - the switch
under the brand on desktop and Pixel 5 with Enhanced lit and the hint
present, the phone target 44px, and THE PRESS in a fresh context:
Classic opens the classic door with its data pick first, the URL
carries no override, and uiSkin('') reads classic - the choice is
stored, not a page-load answer.

## U61 THE OVERWORLD: THE TRAVEL MAP IS THE WORLD ITSELF (2026-08-26)

Mac's call, and a re-conception rather than a re-skin: the enhanced
travel map is not a picture OF the world, it is the world. Press the
travel key outside and the view climbs through cloud; above the deck
is the whole Iliac Bay as a live relief - the same 1000x500 WOODS.WLD
bytes every streamed terrain pixel is sampled from, one vertex per
map pixel, tinted by the same CLIMATE.PAK byte the travel calculator
charges. Pan, zoom, search, pick a destination, choose how you
travel, and the camera FLIES the route - then drops back through
cloud into first person at the far end. Hold to skip the flight.
Classic is one toggle away and untouched.

THE CLOUDS ARE LOAD-BEARING. Nothing can draw 800km of streamed
terrain, so there are two worlds - the host's live frame below the
deck, the one-vertex-per-pixel relief above it - and the cloud veil
is what hides both swaps. The window's draw() opens a SECOND
beginFrame (the automap's precedent) only once the camera cut is
made; during the veil phases it draws a single blended quad over the
HOST's still-live frame, which is also what covers the streamer
rebuilding at the destination after the commit. A source pin holds
beginFrame inside the camera-live arm, because the whole transition
design is that ordering.

THE FLIGHT IS THE LAW'S OWN PATH. systems/travel.js grew ONE export -
walkTravelPath, the classic longest-axis stepper extracted whole from
calculateTravelTime, which now iterates it - so the route line and
the camera fly exactly the pixels the time law charges. The pin that
proves the extraction found the stepper's own truth: with `inc > adx`
strict, the (10,-4) diagonal lands a pixel SHY of its destination,
and a >= "fix" is what the pin kills. The flight is seconds of real
time; the CLOCK advances by computed.minutes inside fastTravelTo,
untouched.

WHAT IS LAW HERE IS THE CLASSIC MODULE'S OWN, imported never copied:
calculateTravelTime / calculateTripCost / travelDays behind the
decision panel, recomputed per toggle; the disease box BEFORE the
two-sided gold gate (letters of credit cover the passage and cannot
pay the inn - the notice says so); transports SNAPSHOT at panel open;
the three toggles round-tripping through travelMapPopUpState so the
save envelope never changed shape; the LIVE travelMapFilters() object
edited in place; discovery through checkLocationDiscovered and the
fourteen dot buckets through getPixelColorIndex (both module exports
since U41 - the palette is ours, the BUCKETS are not); gotoPlace and
teleportationTravel as one-shots, No on the teleport box leaving the
map ARMED; teleport = arrival without the journey, so it gets the
veil and NO flight; and the pick handed to onTravel is fastTravelTo's
own {pixel, name, region, mapId, regionIndex, locationIndex}.

THE DOOR is ui/travelMapDoor.js, the sixth of its shape, and the
first whose fork is a STATIC import: the window must answer
gotoPlace/activateTeleportationTravel synchronously (the journal and
the guild service call them the same breath they open it), and the
heavy half is already lazy behind the first draw the veil covers.
Both skins ride world.js's ONE construction seam - buildTravelMapWindow
hands the door what the host HAS (`woods` joined the bag) and both
openers gate on travelMapDoorReady(). Two shipped pins moved with the
gate (teleportpopup's G5 door needle, travelmap's U41 art needle) -
same law, one predicate deeper.

THE FOUR HOSTS, named: scenes/world.js OWNS the map, both openers and
the probe surface (now guarded to the classic shape; the overworld
carries globalThis.__overworld). scenes/exterior.js still refuses -
V retired deliberately at its :1507 note - and hands no opener.
scenes/dungeonContext.js still refuses at its :799 note. scenes/
worldModes.js still owns nothing and borrows host.openTeleportMap for
the guild service, which arms the enhanced window through the same
one-shot. All three refusals pinned by name.

THE SCREEN BREAKS ONE PEER RULE ON PURPOSE: the chrome div is
TRANSPARENT, not #0e1013 - the picture IS the GL frame beneath - and
it owns the pointer at full resolution (pan, zoom-to-cursor, pick,
hold-to-skip), so the host-contract click/hover/wheel arms are no-ops
BY DESIGN with their comments pinned. The search field stops its own
keydown propagation so a typed V never reaches the host's ladder; the
region label under the cursor is the raw politic-128 read,
range-checked, so the sea answers nothing; search is BAY-WIDE - the
find box's own weighted edit distance and MatchesCutOff per name,
discovery-gated per entry - which is a recorded departure from the
classic region-scoped box.

RECORDED DEPARTURES (skin, each stated in the modules): the whole bay
replaces the province/FMAP page flow, so the page arrows, right-click
zoom crop, identify flash, MBRD border and the dots-outline setting
have no meaning here; the climate and dot PALETTES are ours (there is
no data color table in DFU - the classic terrain is baked art);
vertical relief is one documented exaggeration constant; notices are
literal strings where the classic popups read TEXT.RSC 454/1010; and
the countdown-days animation became the flight.

NEW MODULES: ui/overworldModel.js (pure - the relief grid, tints,
markers, route points; synthetic-bay testable), render/
overworldRenderer.js (the self-contained pass: terrain, POINTS
markers, route line, rings, procedural cloud deck, backdrop -
saves/restores program, brackets cull both ways; the camera wraps
mirrorProjectionX like every world pass - see THE REVIEW below for
the first draft's "our data is right-handed" mistake),
ui/overworldMap.js (the window: phases veilin/rise/map/flight/
descend/hold/veilout, the chrome, the laws), ui/travelMapDoor.js.
The relief grid is cached per WOODS buffer across opens.

PROVED: 28 node pins (test/overworldmap.test.js - the walk re-summed
under four option sets AND both stepper arms pinned literal for
literal, the height/water/tint laws against terrainSampler's own
constants with the sun's direction held on a lone peak, buckets
against getPixelColorIndex itself, the door fork both ways, the
stub-document window driving every panel law with BOTH sides of the
gold gate, and the no-second-reading sweeps) and 47/47 browser checks
(tools/overworldProbe.mjs - a synthetic bay through a REAL Renderer:
sea pixels blue and land not, WEST left of EAST on screen, markers
equal to the law's count, the route buffer sized by the walk itself,
drag/wheel/click through real pointer events, the panel's numbers
equal to the law modules imported into the page, Recklessly exactly
the halved minutes, the coinless-purse refusal, the flight whose
hold-to-skip provably ENDS it early, the one commit in fastTravelTo's
shapes, teleport armed/No-keeps-armed/Yes-skips-the-flight, gotoPlace
landing selected with the decision open, the input() hotkey and
Escape ladder rung by rung, Pixel 5 taps with every target 44px -
decision panel included - and ?skin=classic answering null with zero
enhanced DOM). What the probe does NOT prove is on THE BOARD: the
real ARENA2 bytes.

THREE THINGS THE BUILD CAUGHT: drawScreenQuad's dst is an OBJECT
{x,y,w,h}, not an array - the veil drew nothing until the shape
matched (the probe's first run); the probe had no HOST, so nothing
called dispose() on done and the chrome outlived the window - the
probe now runs the done->dispose step townTalk's tick performs, which
is exactly the contract; and the pan assertion first encoded the
wrong SIGN for south (-z), which the probe's own failure corrected -
the map's conventions are the streamed world's, and the pin now says
so.

THE REVIEW (same day, before the merge settled): five lenses, then a
skeptic per finding - 27 raised, 3 refuted with evidence, 24 stood
and every one is fixed and pinned above. The one BLOCKER was this
slice's own founding mistake: the first draft called the relief "our
right-handed data" and skipped mirrorProjectionX - but east +x,
north +z, up +y is LEFT-handed (east x up = south), the exact frame
mat4's HANDEDNESS LAW exists for, and the verifier proved it
numerically: the bay drew east-west FLIPPED, horizontal pan fought
the hand, and _groundAt disagreed with the picture. The probe never
saw it because every check sampled through the window's own
projection - self-consistent with its own mirror - which is why the
west-LEFT-of-east pin now reads absolute screen positions. The rest,
each now a pin: the hillshade's swapped operands lit the shadow side
(executed, not eyeballed); gotoPlace's panel rendered into a
phase-gated card that nothing re-rendered on reaching the map; a
key-closed teleport map left its chrome floating over the guild hall
because worldModes' drain drops a done window without dispose - so
close() owns the teardown now, done-after-DOM-down; two fingers made
the camera oscillate (one pointer pans, the rest are ignored); the
wheel hijacked the search dropdown's scroll; the teleport box was
mouse-only where classic answers Y/Enter/N/E; Escape on the diseased
box ate the whole panel where classic steps back to it; and the
mutation runs showed which pins were decorative - the y-major stepper
arm, the total-pool side of the gold gate, the beginFrame containment
(text ORDER survives a hoist; the pin walks braces now), a
double-escaped forbidden-fragment regex that could match nothing, the
route line's existence, and a hold-to-skip check that passed with the
mechanism deleted. Verdicts in the review workflow's journal; the
lesson for the next slice is the pixel one: a probe that measures a
picture only through that picture's own camera cannot see the camera
being wrong.
## U60c THE LEDGER STRIP, THE PICTURES, AND THE CUT (2026-08-26, Mac's call)

While the js.org request waits, Mac asked for organising, debloat and
detail that makes the site stand out, and picked three of four offers:
a live ledger strip, real screenshots of the enhanced screens, and the
copy cut for repeats. Not picked: moving the prototype pages under
/lab/, so menu.html, enhanced.html, chargen.html and viewer.html stay
at the site root as they were.

DEBLOAT, the unasked half: `probe2.mjs` (empty) and `repro.mjs` (a
one-off reproduction script left at the repo root by a play-report
fix, and driving the root URL - a landing page now) are deleted. The
tab icon is the section fitting - a brass diamond on ink - as an SVG
data URI drawn from the tokens by the plugin, on the landing and on
the game page; no file, so nothing for the doctrine list to weigh.

THE LEDGER STRIP. Beside the sha, two figures the page could not be
trusted to type: the size of the suite and the size of the port,
COUNTED at serve and build from the tree the build is made of. The
test count uses the manifest gate's own definition (top-of-line
`test(` calls in test/*.test.js), which that gate pins equal to
Testing.md - so the strip, the doc and the runner agree or the suite
is red, and the landing suite pins the strip to the doc from its own
side. The line count is tracked `.js` under src/ by `git ls-files`
(122,323 today; the "~63,400" in Audit 25 was that audit's estimate of
REMAINING work, not the port's size - the js.org PR body, which had
repeated it, was corrected). Grouped digits, filled into every
`data-stat` element - the rail foot and the page's end - and an empty
figure is invisible, as an empty stamp is.

THE PICTURES, AND WHAT THEY COULD NOT BE. Mac asked for the menu, the
wizard on a phone, and the pack. The doctrine allows exactly one kind
of picture: a screen drawn with NO game data. The menu qualifies
outright (U49's claim). THE WIZARD DOES NOT - its stages read
CLASS*.CFG, the biographies and the faces out of ARENA2, and
chargen.html asks for the folder before it draws a word - so the phone
picture is the MENU on a phone, which is the picture that proves the
phone claim anyway (the rail in the thumb's arc). THE PACK is
reachable with no data only through the test seam enhancedDollProbe
uses - `_setPaperDollPixelsForTests(null)` and a hand-built entity -
so it is shown with a SAMPLE character, dressed through the pack's
own controls, and the caption says so: "with a sample character. No
game files means no doll and no item pictures." A labelled sample is
not a silent mock. `tools/siteShots.mjs` is the only way the files are
made: it boots its own vite with ARENA2_PATH unset, PROVES the game's
data fetch 404s before it takes anything, and throws if the folder
pick is on screen in a shot; the doctrine allow-list carries one OURS
row per file naming the tool, and the landing suite pins that every
<img> on the page is under ./site/, tracked, allow-listed, produced by
the tool, sized and described. 54, 59 and 51 KB.

FOUND ON THE WAY, NOT FIXED: in the no-art pack the SCHEMATIC does not
show. U59 says it is the fallback and the doll probe counts its 25
nodes, but at 1280x800 the character column shows the worn list and
a strip of ink above it - the SVG is either collapsed or drawn in
strokes too close to the ground to read. The picture on the site is
honest about it; the pack is U59's to look at.

THE CUT. Four things were said three and four times each - that the
port is translated from DFU's C#, that the renderer is from scratch,
that nothing is uploaded, that no game data is served - and each is
now said once, where it belongs: the translation in Ported 1:1, the
renderer in the hero, the upload and the data in the gate. The "three
things at once" lede went; a lede that describes the structure below
it is the rail's own word said again.

Pins: the U60 suite grew its pictures, strip and icon assertions
(still 8 tests; doctrine.test.js's list grew three rows and stays at
5). Probe: 36/36 - the three pictures paint at their declared size,
the strip carries two figures, the fittings and the face as before.

## U60b THE BRAND FACE, AND THE DETAIL (2026-08-26, Mac's call)

Mac's verdict on U60 was "simple and perfect", with two asks: a
Daggerfall-esque face for the site, and "even more detailed". Both
recorded as his; the choices inside them are mine.

THE FACE. The classic game's own fonts are FONT000x.FNT in ARENA2 -
game data, so they cannot be on a page that opens before the folder
pick, and cannot ship at all. What can is a free face that reads as the
title without turning a headline into a fraktur puzzle. A dozen
candidates were RENDERED on the skin's ground (Grenze Gotisch at three
weights, Pirata One, MedievalSharp, Almendra Display, New Rocker,
UnifrakturCook, Cinzel, IM Fell English, Metamorphous, Uncial Antiqua,
beside Cormorant) and eyeballed at the wordmark, the headline and a
20px line. GRENZE GOTISCH, a gothic-roman hybrid, is the one that reads
as the classic title at 92px and still reads as words at 22px; the
frakturs do not survive the small line, Cinzel is Oblivion's Roman
rather than Daggerfall's gothic, and the uncials are Morrowind.

IT IS A TOKEN, `--brand`, declared in ENHANCED_TOKENS beside --display
and --data, so the menu can take the same wordmark in one line if
that is ever wanted; nothing in-game uses it today and nothing in-game
LOADS it. The family strings became three constants (FONT_DISPLAY,
FONT_DATA, FONT_BRAND) with ONE URL builder, `fontsUrl()`; the skin's
ENHANCED_FONTS_URL is composed from display + data and is pinned
byte-identical to the literal it replaced, and the landing's
LANDING_FONTS_URL is brand + data. The page loads Cormorant no more.
Every heading on the page is the brand face; the wordmark and the
headline at weight 300, the rest at 400.

A GOTHIC CAPITAL IS A SHAPE BEFORE IT IS A LETTER. The first render had
"Bring your own ARENA2 folder" with the folder name unreadable - the
one word on the page that must not be. All-capital names inside a
heading (ARENA2, UESP) are set in the data face at 0.74em, stamped into
the gothic line the way a label is stamped into a fitting. It reads,
and it is a detail rather than a workaround.

THE FITTINGS. Daggerfall's chrome is carved stone with metal at the
corners, and the skin renders that flat. The site takes one step
further than the skin, in two places and no more: THE GATE wears four
brass corner brackets (pseudo-elements on the panel and its inner
wrapper, offset outside the border), and every section begins with a
brass DIAMOND sitting on its rule - the one ornament, used as structure
at section boundaries and nowhere else. Both are CSS; the page still
carries no image.

THE DETAIL. Three sections, every claim in them checked against the
arc records before it was written:
  WHAT'S IN IT - nine cards, dated, one per area (world, towns,
    dungeons, combat, magic, character, quests, screens, sound), each
    a sentence of things a player can walk up to and use. The numbers
    are the ledger's: 265 vendored quest scripts, 171 settings keys,
    NINETY OF NINETY-ONE spell effects (Port-Ledger board item 3:
    Morph Self is the last inert one). The claims that did NOT make
    it: "the opening film" (classic-skin only, U49), "the full ladder
    of effects" (one is inert), and voxel characters (U60's finding).
    Under the cards, the NOT-YET box in the menu's anti-lie idiom:
    riding, importing classic or DFU saves, mods - each verified open
    (World arc "Next: riding"; the .SAV reader row; paneMods).
  CONTROLS - DEFAULT_BINDINGS from systems/inputActions.js in three
    groups (moving, fighting, around you), with the RMB-drag swing and
    the F1-F4 modes, and the line that Settings rebinds all of them.
  GOOD TO KNOW - browsers, where files and saves live (and that
    clearing site data takes both), classic vs enhanced with the
    `?skin=classic` override, "is this DFU?", offline, and what to do
    when something is wrong (reload first - the stale-chunk story in
    the player's words - then the issue tracker).
The rail grew to six destinations and wraps on a phone, as U51 ruled.

Pins: the U60 suite absorbed the face - the composed URLs pinned to the
builder and to the old literal, `--brand` pinned as a token, every
heading pinned to it. The probe grew six checks: the fonts link asks
for the brand face, the headline's computed family IS Grenze Gotisch,
`document.fonts.check` says it LOADED (network; the page itself never
traps - Georgia is the fallback), and the gate's four fittings each
draw 2px of brass. 32/32, desktop and Pixel 5, eyeballed at every
section on both.

## U60 THE DOOR IN FRONT OF THE DOOR (2026-08-26, Mac's call)

Mac asked for a proper website for the port. Three decisions were his
and are recorded as his: a LANDING PAGE in front of the game (what it
is, how to play, credits, Play) rather than a docs site or a redesigned
in-game door; the SAME REPO at the GitHub Pages root, with the game
moving one directory down to /play/; and the public name DAGGERFALL
JAVASCRIPT. Everything below follows from those three.

THE PAGE IS THE SKIN'S OUTERMOST ROOM. The enhanced menu is a rail of
words and a pane that answers them, and it is the first thing a player
sees after Play - so the page in front of it is built on that shell
and not on a landing-page template: the same brand block with one word
swapped (JavaScript where the menu says Enhanced), the same rail, the
same one-line heads, the same brass-outlined primary action, the same
phone rule (the rail to the bottom, in the thumb's arc - here it
carries the one door, and the gate's own Play hides on a phone so the
door exists once). The screenshots are the proof: the landing and the
menu behind it read as one product, which was the whole point of U49
and is the whole point here.

IT OWNS NO PALETTE. index.html is a static document - it mounts no
module, so it cannot call injectEnhancedStyle() - and a page that
carries its own eight hex values is the drift the skin module's header
was written against. So the token block came out of ENHANCED_CSS as its
own export, ENHANCED_TOKENS, with ENHANCED_CSS composed FROM it, and
`scripts/landingHtml.mjs` injects that block into the root document at
serve and build the way build-tag-meta injects the sha. The page's own
<style> says var(--brass) and never a colour; the fonts link is the
skin's ENHANCED_FONTS_URL (also a new export - injectEnhancedFonts had
the literal); the phone's theme-color is read out of the ink token
rather than typed. The build sha is stamped into the page too, in the
rail foot and at the page's end (the foot hides on a phone), linking
the commit - and BUILD ONLY, because on a dev serve src/buildTag.js
holds whatever the last build left behind and a page naming a commit
it was not built from is a lie.

THE PAGE CARRIES NO PICTURE, ON PURPOSE. Port-Doctrine: a render of
game data is game data, and every screenshot of this port is one. What
the page has instead is the one thing that is ours to show - the
interface - and its signature is THE GATE: the first thing the game
asks for, said first, in a brass-edged panel that names the ARENA2
folder, says the site carries no game data and nothing is uploaded, and
holds Play. The copy says what SHIPS, not what the doctrine planned:
the doctrine's "characters rebuilt on our voxel system" is not the
shipping game (C11/C17 put classic sprite mobiles on the combat spine
and the voxel foe rig on ice), so the page does not claim it. The
"How to play" steps are a real sequence and are numbered for that
reason; the three download sources were checked live (Steam app
1812390, GOG, the dfworkshop DaggerfallGameFiles thread), and the Steam
folder path and the zip's `arena2/` are the ones dataSource reads. The
credits carry the Daggerfall Unity attribution the doctrine requires of
anything public-facing, the Bethesda non-affiliation, and the fonts
disclosure (Port-Ledger, the F6 row: the site now makes the same one
request the skin does - Mac's ruling on self-hosting covers both).

THE GAME MOVED, AND EVERYTHING THAT KNEW WHERE IT WAS. play/index.html
is the old index.html unchanged but for its title; vite keeps the
`main` input key on it so the entry chunk stays `main-*.js` (staleChunk
and the verifier read that name). EIGHTY-SIX URLs in EIGHTY-ONE tools
drove the game at the root and were rewritten by a scripted pass with a
leftover grep - module imports, the /arena2/ fetch and the prototype
pages stay at the root and were not touched. FOUND ON THE WAY, each a
thing that would have broken quietly: `entryBundle` in verify-deploy
accepted `./` and `/` but not the `../assets/` a nested page writes
under a relative base, so it would have read a perfectly good
dist/play/index.html as having no entry at all; the dev arena2
middleware answered /arena2/* only, and dataSource fetches
`./arena2/*` RELATIVE to its document, so from /play/ every dev boot
would have fallen through to the picker - the mount is doubled, same
handler; and staleChunkProbe's static server had no directory index,
which GitHub Pages does have. The boot title, the menu's About card and
the data picker now say Daggerfall JavaScript; project-dagger is the
repo's name and the IndexedDB's, and those stay.

NOTED, NOT FIXED (Mac's call): there is no LICENSE file, and the
doctrine's attribution rule names one. And test/doctrine.test.js's
allow-list carries a row for public/logo.png, a file that exists
nowhere in the tree's history - harmless (the sweep checks tracked
files against the list, not the reverse) and stale.

Pins: `test/landing.test.js`, 8 tests, plus one in
`verifydeploy.test.js` for the nested entry ref; 8 mutations, 8 dead.
Live: `tools/landingProbe.mjs` boots vite twice - once with no data
folder, once with a fake one holding a fake ART_PAL.COL - and proves
in Chromium that a computed colour on the page IS brass, that Play
opens /play/ and the enhanced menu draws with no ARENA2 and no picker,
that the phone's thumb-bar Play is a 44px target, and that both data
mounts serve the folder: 26/26, desktop and Pixel 5, eyeballed.

## U59 THE AVATAR, AND WHAT YOU ARE WEARING (2026-08-26)
Two complaints, one gap. The pack showed what you CARRY and turned
what you WEAR into twenty-seven 7px circles - so you could not see
your character at all, and you could not read your kit without
hovering dots one at a time.

THE DOLL WAS ALREADY BUILT. `refreshPaperDoll` composites the avatar
CPU-side into an RGBA buffer - the cloak interiors, the censor welds,
the head, the items in ascending drawOrder, every layer at its own
baked offset, the dye bands - and then uploads it as a GL texture and
DROPS THE BUFFER. A DOM screen cannot use a GL texture, and building a
second compositor over the same laws is how a port ends up with two
dolls that disagree. So the compositor keeps its buffer, and
`ui/textureCanvas.js` - which already owned "bitmap to data URL" for
the DOM - turns it into a value. One doll, two consumers, and a sweep
against this file ever growing a `BlitItems` of its own.

THE SCHEMATIC IS NOW THE FALLBACK, and that is the right shape rather
than a demotion: it is the only one of the two that needs no ARENA2,
so a player with no game data still gets a picture of their kit. The
avatar is STICKY at the top of its column, because the whole point of
the slice is seeing it AND the list at once - a doll that scrolls away
when you read past the boots is the small button again.

THE DOTS BECAME ROWS. Every slot, named, with what is in it, in the
BODY's order - read off SLOT_MAP's own y/x rather than a second table,
since EQUIP_SLOTS numbers the jewellery first and enum order would put
a ring above a helm. Empty slots are rows too: a list of only what you
wear cannot answer "what could I still put on", which was half of what
the schematic was for. A row SELECTS rather than unequipping on the
spot - the node's straight-to-unequip is right for a control whose
only meaning is "this one", and a named row has a detail panel behind
it where Take off sits next to Use.

AND THE PANEL IS THE SPACE THE VOXEL RENDER LANDS IN. It owns the
sizing and the sticky behaviour; which picture fills it is one
decision in `figurePanel`, and today that decision has two branches.

FOUR THINGS WERE WRONG IN THE FIRST DRAFT, and each was caught by a
different thing:

    THE PROBE      An empty slot was a DISABLED BUTTON, and the pack
                   probe's 44px touch-target rule failed on twenty-two
                   24px ones. A disabled button is still a button -
                   and this arc keeps deleting controls that can only
                   do nothing. An empty slot is not a control.
    THE SCREEN     `.empty` is already a COMPONENT in the shared
                   stylesheet, a dashed 26px-padded placeholder card,
                   so every unfilled slot drew as one. THIRD collision
                   of this exact shape after `.detail` in U53 and
                   `.packcol` twenty minutes earlier in this same
                   slice. A generic word in a shared stylesheet is a
                   collision waiting for the next screen, and the port
                   has now paid for that lesson three times.
    THE PROBE      Giving the character column `.packcol` broke every
                   list selector - `.packcol:not(.packremote)` matched
                   the doll. Same lesson, from the other side: a class
                   is an interface.
    READING IT     A WORN item offered "Drop". filterByTab IS
                   FilterLocalItems, so an equipped item is never in
                   the list DFU's Remove click can reach; the transfer
                   does not exist for one.

THE MUTATION RUN FOUND THE LAST GAP. Deleting the line that keeps the
composite survived every node pin, because composing needs ARENA2 and
the DOM probe stands up a synthetic buffer through the test seam. The
real-art assertion is in `equipmechanics.test.js` and skips on CI, so
a source sweep runs beside it that a machine with no game data can
still fail - and it holds the thing that matters, that BOTH consumers
read the same `out`.

PROVED IN A REAL BROWSER by `tools/enhancedDollProbe.mjs` - 45/45 on a
desktop, a Pixel 5 and a no-art fallback run. The composite is a RED
half and a GREEN half rather than a picture, on purpose: what has to
be proven is that the buffer reaches the screen UNSCRAMBLED, and a
channel swap or a row-stride slip shows up as the wrong colour on the
wrong side where a pretty test image would hide both. What it does NOT
prove is stated in the file: the compositor's own layer order, dyes
and offsets need ARENA2, and clicking the doll to unequip walks the
real item layers - wired, and unproven here.

## U56-U58 meet AUDIT 26 (2026-08-26)

The audit campaign landed on main while this arc was building the
pack's remote side, and the two changed the same window. The merge is
worth recording, because it is the argument for the extraction making
itself.

AUDIT 26 ADDED A RUNG TO THE LADDER. TransferItem's QUEST arm
(:1480-1505) - the refusal for an undroppable quest item, and the only
writer of the `playerDropped` flag the DroppedItemAtPlace trigger
polls - went into the classic window as a guard between the summoned
one and the choose-one pile, on both callers. The merge had a choice:
resolve it back into a window that no longer holds that law, or put it
on the ladder where the rest of TransferItem now lives. It went on the
ladder, and the enhanced pane runs it as a result - a rung it would
otherwise never have had, silently.

It had to move for a second reason: `nativeTrade.js` imports the arm
because DaggerfallTradeWindow INHERITS TransferItem, and leaving it in
the window would have meant `systems/` importing from `ui/`.

THE DRY RUN IS THE MERGE'S OWN FINDING. That arm WRITES as it passes,
and `canStow` calls `planStore` on every repaint to decide whether to
draw a button. Merged naively, opening the pack with a quest item in
it would have marked that item DROPPED on the first render, and again
on every render after - with nothing on screen looking wrong, and a
quest trigger firing somewhere else entirely. So the two plans take a
`dryRun` that skips the one rung that writes, and it is safe precisely
because the quest refusal SPEAKS: a view asking "would this say
something" gets the same answer either way. Both halves are pinned,
including the fact that the refusal has words - a silent one would
make the dry run a lie.

TWO MORE LAWS THE PANE WOULD HAVE DROPPED IN SILENCE, and one it was
carrying wrong:

    THE REMOTE CLICK   ":2027-2037" is the FIRST act of
                       RemoteItemListScroller_OnItemClick, so LOOKING
                       at a quest item in a pile counts as a click.
                       LocalItemListScroller has no such call - and
                       this pane draws BOTH lists with one row
                       builder, so the guard sits on the SIDE, not
                       the row.
    POPTOHUD           UseItem's :1687-1688 closes the whole window
                       stack and says nothing. Decided above every
                       other arm, because DFU returns before all of
                       them.
    MAXENCUMBRANCE     AUDIT 26 corrected the carry gate and the
                       character sheet to `entityMaxEncumbrance` -
                       PlayerEntity.MaxEncumbrance, enchantment
                       allowance and all. U52 and U53 had mirrored the
                       PRE-audit expression, so the enhanced sheet and
                       the enhanced pack were both reading the bare
                       strength formula. Both corrected, and AUDIT
                       26's own sweep now covers them.

TWO PINS FOLLOWED THEIR LAW rather than being resolved away. AUDIT
26's `entityMaxEncumbrance(e)` sweep of `nativeInventory.js` now reads
`itemTransfer.js`, where the carry gate went - the same move X11b's
summoned pin made in U56. And the settings ledger's reader for
`GUI/CanDropQuestItems` moved with the arm that reads it.

Everything else in the merge was the U53 collapse paying off: main's
loot arms still hand-rolled eleven hooks each, and the resolution was
to keep the host factory and let `getQuest` arrive through it.

Gate on the merge: eslint clean, 3570 tests / 0 fail / 188 skipped,
build clean, and all five browser probes green.

## U58 THE REMOTE PANE, and the boundary comes down (2026-08-26)

The pack had a local list and no remote one, and that single absence
WAS every flow the enhanced screen could not answer: the wagon, a
corpse, a guild's reward tray, and dropping anything at all. U53 named
that a boundary rather than a gap and handed those calls to the
classic window. U56 and U57 moved the law they needed, so the boundary
had nothing left to protect. `CLASSIC_ONLY_MODES` is gone, and the
inventory fork is now the plain skin question every other door asks.

TWO LISTS, AS PEERS. DFU's window is local beside remote, so these
share one grid cell and split it - which leaves the outer
three-column shape, and every phone rule written against it, exactly
as it was. The verb on the button names the DESTINATION, because
"Transfer" tells the player nothing about where: Drop, Stow in wagon,
Put back, and - for a reward tray - "Take this one", which says that
taking IS the choice before the player discovers it by pressing.

WHAT THE PANE DECIDES AND WHAT IT ASKS. It decides the shape: which
column, which verb, whether the wagon button is drawn at all (only
with a cart in the bag - DFU draws it always and answers "You don't
own a wagon.", which is a control whose whole purpose is to refuse).
Everything else it ASKS: `planStore`, `planTake`, `applyTransfer`,
`planDropGold`, `planWagonToggle`, `remoteTarget`, `openState`. The
file carries no 750, no Transportation check, no summoned guard and no
cart check of its own, and a sweep says so.

`canStow` IS THE INTERESTING ONE. It asks the LADDER whether to draw
the button, not whether to allow the press: DFU's transport block and
its choose-one bar are SILENT refusals, so a Stow button there could
only ever do nothing - U53's deleted "worn" badge again, one control
up. A refusal that SPEAKS still gets its button, because the full
wagon has something to say.

TWO BUGS, FROM THE TWO PLACES THAT FIND THEM.

The node pins found a live-list bug before it shipped:
`remoteModel.items` is a filtered COPY, and `useItem` consumes out of
whatever collection it is handed, so a potion drunk from a corpse
through that copy would have vanished from the screen and stayed in
the pile. Every arm reads the live list now. The pin then SURVIVED its
own mutation - a 900-character slice from `stow` ran on into `take`'s
body and passed on ITS call - which is the byte-count slice being a
worse boundary than the next `function`.

The BROWSER found the other, and it is the shape this arc keeps
finding: stacked on a Pixel 5, the remote list started at y=781 in a
727px viewport, under 46vh of slot-map schematic. Perfect at 1440px,
invisible in source. The schematic goes last on a phone now - a player
opening their pack came for their items, and the doll is what they
scroll to - and a CONTAINER or a reward tray puts its own list first,
because being shown your own pack when you opened a corpse is the
screen answering a question nobody asked.

A THIRD, from looking at the screen. "1 items" - a count printed into
a template literal, right eleven times out of twelve and wrong on the
twelfth, which is the one the player is reading when they drop one
thing. The pack's own header had said it since U53. Both use a helper
now, and its pin caught the VACUOUS SHAPE one more time on the way in:
the first draft re-derived the helper inside the test file and
compared the copy to itself, so it is exported and the pin imports the
real one.

PROVED IN A REAL BROWSER by `tools/enhancedRemoteProbe.mjs` - 60/60
across a desktop, a Pixel 5, and three separate mounts for the flows
that only exist once: the drop pile MINTING when the window closes
(AUDIT B-C1, and no screenshot shows a missing mint), a corpse
shrinking the HOST's pile rather than a copy, and a reward tray
closing and firing its callback on the one take. The four existing
probes are still green.

## U57 The remote side comes out too (2026-08-26)

U56 moved the transfer LADDER. A transfer needs somewhere to transfer
TO, and choosing that is its own small pile of window members -
OnPush's default target, SetChooseOne, CheckWagonAccess, ShowWagon,
WagonButton_OnMouseClick, OnPop - every one of which the enhanced
pack's remote pane needs and none of which it should read twice. So
`systems/inventorySession.js` now holds them, and the classic window
opens, targets, toggles and closes through it.

THREE ORDERS AND ONE INVISIBLE EFFECT. The orders are what a second
reading would have got subtly wrong, so each is pinned by a case where
the lower rungs are also present:

    THE REMOTE TARGET  the wagon outranks everything while it is
                       showing (that is what the toggle means), a
                       reward list outranks a container, a container
                       outranks the ground.
    THE WAGON BUTTON   no cart first, THEN the exit rule - so a player
                       with no cart in a dungeon far from the door is
                       told about the cart and never about the door.
    ON OPEN            access needs the cart AND the door AND being
                       inside; with access and no container the window
                       lands ON the cart in Remove, but a LOOT target
                       outranks that, because the corpse you just
                       opened is the one you meant.

The invisible effect is `closeSession` - AUDIT B-C1's drop-pile mint.
It is a function rather than two lines at the end of a close handler
because it has to run on a HAND-OFF too, where the window is being
replaced rather than closed, and the port once skipped it there: items
gone from the bag and never on the ground. A screen that forgets this
does not look broken. It looks like the player misremembered picking
something up. It is pinned from both sides, because an EMPTY session
must mint nothing - a world flat with no items in it is litter that
cannot be picked up.

The classic window's own suites were not edited again, and 22
mutations confirm they bind through the new module - four of them
break only the window's half (faking the toggle, closing without the
mint) and die in wagon and droppedloot.

Next: the pane itself, which is what retires `CLASSIC_ONLY_MODES`.

## U56 TransferItem comes out of the window (2026-08-26)

The enhanced pack has a local list and no REMOTE one. Building that
pane means running DFU's transfer law - the wagon, the loot pile, the
reward picker, drop-gold - and the port had that law as METHODS ON THE
CLASSIC WINDOW, which was fine while exactly one screen did transfers
and stopped being fine the moment a second one needed the same rungs.

The choice at that point is EXTRACT OR COPY, and this port does not
copy law: Port-Doctrine's translation rule allows simplification in
structure and never in behaviour, and `audit24_onehome` is a standing
gate against exactly the other outcome. So `systems/itemTransfer.js`
now holds DaggerfallInventoryWindow.TransferItem, and the classic
window calls it.

THE SPLIT IS DECISIONS HERE, PRESENTATION THERE. `planStore` and
`planTake` are PURE - they read the lists and answer what should
happen - and `applyTransfer` performs the one part that is still law
rather than presentation: the split itself. What a screen does with a
refusal (a parchment box, a DOM notice) and which sound it plays is
the screen's, so the classic window kept a four-line `_refuse` and
lost forty lines of ladder.

THE ORDER WAS THE THING WORTH MOVING. A second reading would have got
the rungs subtly wrong, and the file's pins hold each one with an item
that would refuse at TWO of them:

    TRANSPORT   first, and SILENT - above DoTransferItem's click
                (:1460-1462). A SUMMONED CART refuses as `transport`,
                which is how we know this rung is above the next.
    SUMMONED    second, and it SPEAKS (:1464-1469, X11b). A summoned
                item offered into a reward pile refuses for being
                summoned, not for the pile.
    PILE        third - nothing goes INTO a choose-one list (G6
                :1994) - but the WAGON is not that pile, so a reward
                window with a cart open can still stow.
    CAPACITY    last: WagonCanHoldAmount going out (:1425-1434),
                CanCarryAmount coming in (:1414-1422).

AND A VACUOUS PIN FELL OUT OF PROVING IT. The mutation run rewrote
`CANNOT_HOLD_TEXT` to 'Nope.' and the whole suite stayed green - the
wagon tests had been comparing the constant to itself since the
W-slice, because both the assertion and the source read it through the
same import. Two lines now hold the literal prose, the only place
either refusal string is actually held. This is the second shape of
vacuous pin this arc has found (after the fork pins that ran where
`document` did not exist), and it is the more insidious one: it looks
like a value assertion.

THE PROOF THE CLASSIC WINDOW DID NOT MOVE is that its OWN suites did
not move. wagon, littlelaws, nativeinventory, knightlygifts,
droppedloot and x11b pin that window's behaviour and none of them was
edited; 23 mutations across both files confirm they bind through the
NEW path, including four that break only the window's half - dropping
the refusal box, faking the plan - and die in the old suites. The one
test that did change is x11b's summoned pin, which followed the law it
pins into the new module and gained the half the extraction is for:
the window carries no second reading of `isSummoned`.

One behaviour did unify, deliberately. The window's carry gate went
SILENT when it had no entity to read and SPOKE when it did; there is
one answer now, because the only way to reach it without an entity is
a stack of zero, which nothing in the port can mint (Ledger A).

Next: the enhanced remote pane on top of this, which is what retires
`CLASSIC_ONLY_MODES`.

## U55 USE, in the enhanced pack (2026-08-26)

The pack can USE things. `systems/useItem.js` owns the law - which item
does what - and this is the branching the classic window does on top of
a result, which is presentation except for the two hand-offs, which are
not.

USE IS OFFERED FOR EVERYTHING, exactly as the classic window's Use mode
is. `useItem` has an arm for every group and the honest answer for a
thing with no use is its own "Nothing happens."; a button drawn only
for items this screen BELIEVED were usable would be the screen making a
judgement the law already makes.

THE TWO HAND-OFFS RUN IN OPPOSITE ORDERS, AND THE FIRST DRAFT GOT IT
BACKWARDS. Both exist for AUDIT B-C1's reason - DFU PUSHES the reader
and the spellbook over the inventory, a window stack, while the port's
hosts hold ONE overlay slot, so the inventory must run its own close
law or the pile it was about to drop never mints. But:

    BOOK       hand over, THEN close. The reader takes a FAILURE
               CALLBACK, and "a failed open still reports on this
               window - it is the live overlay until the reader
               actually shows".
    SPELLBOOK  close, THEN hand over. No callback, so free the slot.

This module gave both `closeFirst: true` and its pin asserted the same
thing, because the code and the pin were written from one wrong
reading of the classic window - which is exactly what a pin written
beside the code it pins is worth. THE BROWSER CAUGHT IT, and twice
over: closing first also cleared the deps the hook was about to be read
from, so the book arm threw `deps.openBook is not a function` on the
first real press. The hooks are read before anything closes now, the
pin holds the ASYMMETRY against both windows, and the probe proves each
order by asking the hook itself whether the window was still up when it
ran.

`useResultAction` IS PURE AND SEPARATE so that ordering is testable
rather than retyped from memory. It also carries the classic window's
message ladder in the classic window's order - an explicit text, then a
TEXT.RSC id read through the host's `rows`, then the pending stand-in -
and AUDIT 22 F9's `enchanted` RIDER, which only speaks when the arm
itself said nothing rather than replacing what the arm produced.

EVERY DEP TRAVELS, and a pin counts them. A dep quietly dropped here is
an arm that silently does nothing, which is the shape U44 found when
the potion hook had reached three of five construction sites.

PROVED IN A REAL BROWSER by `tools/enhancedPackProbe.mjs` - 54/54, up
from 44. The probe found two of its own wrong expectations before it
found anything else: a BOOK is not a weapon, so it sits on the CLOTHING
page (filterByTab's default branch is DFU's fourth bucket - everything
not a weapon, not enchanted, not an ingredient) and the pack correctly
opened on an empty Weapons page; and a SPELLBOOK WITH NO SPELLS IN IT
does not open at all - useItem's `noSpells` arm answers TEXT.RSC 12,
which is DFU's own law, so the character had to be taught a spell
before the OPEN arm could be exercised.

STILL CLASSIC, and the door still says so: the WAGON, LOOT PILES, the
guild REWARD PICKER and DROP-GOLD. Those four share one thing this
slice did not need - DFU's TRANSFER LADDER, which lives inside
`ui/nativeInventory.js` as window methods rather than as anything
callable: the summoned-item refusal, the choose-one one-way rule, the
750kg cart limit with its partial split-take, the carry gate and gold's
own arithmetic. An enhanced remote pane needs that ladder, and there
are only two honest ways to get it - extract it into a module both
windows call, or copy it, and this port does not copy law. The
extraction is its own decision because it edits the proven window every
host uses.

## U54 THE ITEM ICONS, and the middle link the port never had (2026-08-26)

The pack draws real item pictures. `ui/textureCanvas.js` is the piece
that was missing, and it is the DOM's own door to the TEXTURE archives.

THE PORT HAD TWO THIRDS OF THIS SINCE U50. `formats/textureFile.js`
reads TEXTURE.### into DFBitmaps and is corpus-gated;
`ui/bitmapCanvas.js` turns a DFBitmap into a canvas and has drawn the
chargen faces since U50. What was missing is the middle - fetch an
archive, keep it, hand a screen the one record it asked for - which is
why U53's pack drew two-letter initials where the classic window draws
the icon.

IT HANDS OUT A DATA URL, NOT A CANVAS. A canvas is a NODE and a node
lives in one place; these screens rebuild their whole DOM on every
repaint and the same icon can appear in several rows at once, so one
canvas would move from row to row and leave the others blank. A data
URL is a VALUE: any number of `<img>` elements carry it and the browser
decodes it once.

U53 GOT THE ICON ADDRESS WRONG AND THIS SLICE FIXES IT. `itemLine` read
`playerTextureArchive ?? worldTextureArchive` off the template, which
looks like the same thing as `inventoryItemImage` and is FOUR PORTED
LAWS short of it, two with audits behind them: GetItemImage draws the
WORLD texture for UselessItems1, ingredients, arrows, ReligiousItems
and MiscItems - 111 of 288 templates differ (AUDIT 17e F9); the player
archive is offset by the WEARER's body morphology, or every list draws
the morphology-0 Argonian row (AUDIT 17f); variants index off the
record with cloaks skipping their interior-first one and armour riding
SetVariant's material-family clamps (AUDIT 23 items-6); and katanas
take +1 on the inventory branch alone. U53's own module header warned
against building a second icon pipeline and then contained a piece of
one. The line takes the WEARER now and both call sites pass it.

`texName` GOT ONE HOME in the same motion. It was declared in
`scenes/shared.js`, and this module cannot import that - 33 imports
including the sky renderer, which a DOM screen must not drag in - so
the first draft restated it and the `audit24_onehome` ratchet caught it
inside the slice. It lives in `formats/textureFile.js` now, beside the
reader, and shared.js re-exports it for its thirty callers.

EVERY FAILURE IS A CACHED MISS. No ARENA2, a missing archive, a record
past the end, a palette that would not load: the caller gets null, the
screen keeps its initials, and the archive is not fetched again on the
next repaint. A screen asking forty times a second for a file that does
not exist is the shape this guards against.

PROVED IN A REAL BROWSER by `tools/enhancedIconProbe.mjs` - 18/18, all
five links, WITH NO GAME DATA. The archive is SYNTHETIC: a valid
minimal uncompressed TEXTURE file built to the reader's own format and
served by intercepting the fetch, which is the device the chargen tests
use ("synthetic pickers so it is provable with no game data"). The
probe reads the PIXELS back out of the resulting `<img>` and finds the
palette colour on the painted half and ALPHA 0 on the other, which is
the port's 1-bit cutout law surviving the whole trip. It also proves
eight records from one archive cost one fetch, a record past the end
answers null rather than throwing, and - with everything 404ing - the
tile falls back to initials, still names the record it wants, and the
detail explains the absence instead of showing a gap.

WHAT IT DOES NOT PROVE, stated rather than implied: that a REAL ARENA2
record decodes to the right picture. That needs a run with ARENA2_PATH
and eyes on the screen. Both halves either side of the new link are
already proven - the reader against the real corpus, bitmapCanvas by
the chargen faces - and the new link is thirty lines.

THE REPAINT COUNT IS PINNED, and it is what killed the one mutation the
probe could not otherwise see. Every cold icon repaints the screen when
it lands, which is what makes the letters give way to the picture; a
cache that forgot its IN-FLIGHT records decodes each icon once per
repaint until the first lands, and the count DOUBLES - four to eight
for a three-item pack. It does not loop forever, because the first
decode to land caches the answer, and the first draft of that comment
claimed a loop it cannot cause. Bounded waste, said precisely.

TWO MORE CAME OUT OF READING THE DIFF BEFORE PUSHING IT, and both
were real. The TEMPLATE-NAME FALLBACK went away with the template read
it replaced, so an item minted with no name of its own - a loot roll, a
quest reward - said "Unknown" where it used to say "Longsword". And the
icon carried a width ATTRIBUTE, which forces every sprite to 30 across
when a dagger is tall and narrow and a cuirass is wide; the CSS caps
both axes instead, which scales to fit and keeps the shape.

AND THE PROBES STOPPED RACING THE BOOT. `main.js`'s top-level catch
does `document.body.textContent = ...` on a failed boot, and assigning
textContent REMOVES EVERY CHILD OF BODY - including an enhanced overlay
opened a moment earlier. With no ARENA2 the world boot always fails in
a probe container, so every in-game probe since U51 has been opening
its screen in a race with a page wipe, and winning it often enough to
look reliable. That is the shape behind this repo's own "the verifier
said TIMEOUT four times against good deploys". All four wait for the
boot to settle now. The behaviour itself is correct - a boot that
failed has nothing to show - so nothing in `src/` changed; it took an
hour to find because the div vanished with no `.remove()` and no
`removeChild` in the trace, which is exactly what assigning
`textContent` looks like from the outside.

ONE RECORDED SURVIVOR: deleting the explicit `record >= recordCount`
check changes nothing observable, because `getDFBitmap` already answers
an out-of-range record with an empty bitmap and `bitmapCanvas` answers
an empty bitmap with null. The check earns only its warning line, which
names the archive and record a screen asked for. Kept, and recorded as
redundant rather than left looking load-bearing.

## U53 THE ENHANCED PACK, AND THE SLOT MAP (2026-08-26)

The overhaul's signature, and the second in-game screen. F6 opens it,
`ui/inventoryDoor.js` chooses, and the classic INVE00I0 window is one
`?skin=classic` away.

THE SEAM, AND THE SAME FINDING TWICE MORE. FIVE sites constructed
`new NativeInventoryWindow({ ... })`: three host factories and TWO
hand-rolled copies of a factory that was already in the same file and
already took the extra keys they needed. The copies were VERBATIM -
eleven identical hooks each, plus `loot` and `onClose`, which is
precisely what `...extra` is for - and their indentation had drifted,
which is what a copy-paste looks like a month later. This one had
already cost something: the pin guarding it records that U42 put
`openSpellbook:` on three of the five sites and the two loot-pile
windows went on printing "You cannot open your spellbook here." over a
Spellbook the player was holding. Both copies are deleted; each host
has one builder and the loot arm calls it.

THE FORK IS NARROW AND SAYS WHERE IT STOPS. The classic window is not
one screen - it is the pack, the LOOT pile, the WAGON, the guild
REWARD picker, drop-gold and the whole USE chain - so the door hands
the classic window every call carrying a `loot` target or a
`chooseOne` list. That is a boundary, not a gap: a player who opens a
corpse gets the window that has always opened it, and what would break
the never-traps law is an enhanced pack that silently dropped the
wagon on the floor.

ONE GATE DID NOT MOVE, and it is the subtle part. Every inventory gate
became `inventoryDoorReady()` except the two PILE arms, which keep
asking `inventoryArtLoaded()` - because the door hands those calls the
CLASSIC window, and a classic window with no INVE00I0 draws nothing.

THE SLOT MAP IS THE POINT. Twenty-seven equip slots, TWO amulets, TWO
bracelets, TWO marks, TWO crystals, and chest armour and chest clothes
as separate layers; the classic paperdoll draws that as a picture of a
person and the player hunts for the slots by clicking at them. Here
every slot is a node on a body schematic, filled nodes are lit and
twice the radius, and the whole state of a kit reads at a glance. A
picture of a person tells you how they look; this tells you what you
are carrying, which is what the screen is for.

IT IS INLINE SVG, NOT THE PROTOTYPE'S THREE.JS. `mountFigure` in
`src/tools/enhancedVisuals.js` builds a small three.js scene and
`enhanced.html` loads that library from a CDN - and the port already
carries exactly one third-party request (Ledger A, the web fonts),
which is one more than it wants. Twenty-seven positioned nodes need no
library, and an SVG scales to a phone where a fixed WebGL canvas does
not.

NOTHING ABOUT ITEMS IS DECIDED HERE. Equipping is `equipItem`, which
carries DFU's whole chain - the two-hander clearing both hands, a
shield bumping a held two-hander, the forbidden and broken refusals,
the swap delay billed per transition, the armour table and the
enchantment hooks. The four tab pages are `TABS`/`filterByTab`. Weight,
condition, material and damage strings are `systems/itemInfo.js`'s.
This module positions nodes and prints rows, and the node tests prove
it by wearing a Claymore and watching both hands empty.

A "WORN" BADGE WAS WRITTEN AND DELETED. `filterByTab` IS
FilterLocalItems, and its first line drops every equipped item - worn
kit leaves the list. So a badge on a row could never render, and a
decoration that cannot render is the same lie as a button that does
nothing. Worn items live on the MAP, which is the argument the screen
makes.

THE BUG ONLY A BROWSER COULD SEE. The detail column was given the
class `detail` - which the SETTINGS pane's phone sheet already owns in
the same stylesheet, as `position: fixed; transform: translateY(101%)`.
On a desktop the screen was perfect; on every phone the third column,
with the Wear button in it, sat 101% below the fold. The source read
correctly and the node pins all passed. It is `packdetail` now, and
because three columns do not fit one phone anyway, the sheet behaviour
is written DELIBERATELY - the detail rises when an item is picked and
closes back down - rather than inherited by accident.

PROVED IN A REAL BROWSER by `tools/enhancedPackProbe.mjs` - 44/44 on a
desktop and a Pixel 5 with no ARENA2, measuring the nodes' real
on-screen radii and spacing, wearing five things, taking one off by
clicking its node, and watching a broken item refuse. The items are
built from the port's OWN `ITEM_TEMPLATES`, which is ported data in
the repo rather than game data on disk, so the weights and conditions
on screen are the game's numbers. 24 pins; 12 mutations, 12 dead.

TWO SWEEPS NEEDED THEIR COMMENTS STRIPPED. "This file contains no icon
pipeline" and "this file uses no three.js" both failed their first run
against the file's own header EXPLAINING why it contains neither -
a sweep reading prose as code, which would have let a real second
pipeline through as long as nobody wrote about it.

NOT DRAWN, recorded rather than dropped: THE ITEM ICONS. The classic
window draws them from the TEXTURE archives through GL textures the
host hands it, which a DOM list cannot use, and the path a DOM screen
would need - archive record to canvas through `ui/bitmapCanvas.js` -
does not exist yet. Inventing a second icon pipeline in this file is
how the port ends up with two. The PROTOTYPE hit the same wall and
answered it the same way, with two initials and the real
archive/record in the tile's title, which is what this does. It is the
next inventory slice's first job, along with the wagon, the loot
piles, the reward picker, drop-gold and USE.

## U52 THE ENHANCED CHARACTER SHEET (2026-08-26)

The first of the port's IN-GAME screens to grow an enhanced twin. F5
opens it, `ui/charSheetDoor.js` chooses, and the classic INFO00I0 sheet
is one `?skin=classic` away as always.

THE SEAM HAD TO BE MADE, not found. U50's fork went inside
`createChargenWindow` and U51's in front of `openPauseFlow`, both of
which already existed; nothing funnelled the sheet. Three hosts each
wrote `new CharSheet(playerEntity, charSheetHooks({ ... }))` by hand -
and `exterior.js` wrote it TWICE, once as `makeCharSheetWindow` for the
interior host to borrow and once inline in its own F5 arm, the second
copy having already lost the first's note about the deliberately
withheld quest hooks. They agreed. That is what drift looks like the
day before it stops being true, and it is AUDIT 17i's finding one
window over. The hosts hand their DEPS to the door now and never see
which sheet that adds up to; the door is the only caller of
`charSheetHooks` left.

THE DENSITY ARGUMENT IS THIS SCREEN'S WHOLE POINT. Daggerfall has 35
skills where Skyrim has 18, and the classic sheet answers that by
showing NINE - keys 1-4 pop a text panel over the art and
`_drawSkillPage` slices to `ids.slice(0, 9)`, because a 320x200 panel
has nowhere else to put them, so comparing a Major against a
Miscellaneous means pressing two keys and remembering the first number.
This shows every skill the character has a career for, in DFU's own
three groups, with the twenty-odd Miscellaneous ones one press away.
Disclosure, not deletion - the prototype's rule, and the reason this is
not "Skyrim's sheet with Daggerfall's words in it".

THE NUMBERS ARE THE CLASSIC SHEET'S, and `sheetModel` is pure and
separate so a node test can prove it: it evaluates ui/charsheet.js's
own expressions beside the model over an entity carrying a DRAIN, which
is where the trap is. The eight attributes and the encumbrance ceiling
both read `liveStat`, so a sheet showing the raw base makes a poisoned
player read a lie, and both mutations die. `carriedWeight` was
module-private in charsheet.js and is EXPORTED rather than re-reduced
here. Writing the /64 divisor as a new constant was caught in the
slice - `FATIGUE_MULTIPLIER` is statMods.js's own export and
charsheet.js's two inline copies are collapsed onto it in the same
motion.

THE CHILD WINDOWS ARE THE HARD PART, and they are what makes this
screen unlike the two before it. The sheet is not a leaf: its four
navigation buttons PUSH a window, the hosts hold ONE overlay slot so
the sheet owns its child and delegates (CharSheet's own note since
U32), and those children are CANVAS windows - drawn on the canvas
underneath an opaque DOM div. So the enhanced overlay HIDES ITSELF on
push, restores on pop, disposes the popped child and re-reads the model
(gold and encumbrance come FROM the pack the inventory just changed),
and forwards ALL SIX arms. U42 is why that list is exhaustive rather
than obvious: the classic sheet forwarded tick, wheel, input and click
and NOT hover, and the spellbook silently lost its list highlight and
all three of its icon tooltips on exactly the route three of the four
hosts take.

THE ART GATE MOVED, as it did at U51: `charSheetDoorReady()` is
`isEnhanced() || charSheetArtLoaded()`, since the enhanced sheet reads
no ARENA2 at all.

ESCAPE AND F5, the two keys the classic sheet closes on. Keys 1-4 have
nothing to do here - all four groups are on the screen at once, so an
arm for them would be a key that appears to do nothing. F5 is NOT in
`overlayAction` (that table is the shared overlay vocabulary and F5 is
a host BINDING) so it is read from the event and CLAIMED: an unclaimed
F5 is a browser reload that destroys the session, which is AUDIT 17e
F41's finding one window over.

PROVED IN A REAL BROWSER by `tools/enhancedSheetProbe.mjs` - 64/64 on a
desktop and a Pixel 5 with no ARENA2, driving a real push with a fake
child, which is where the child contract is actually exercised. It
caught two of its OWN wrong expectations first: History is drawn
whatever the host hands (charSheetNav's host-agnostic half needs only
the entity), and `setUiSkin('classic')` on a page loaded with
`?skin=enhanced` changes nothing, because the URL override outranks the
stored choice - the very property that keeps the 25 classic-geometry
probes honest. 20 pins; 12 mutations, 12 dead.

THE VACUOUS-FORK LESSON WAS NEEDED TWICE. The classic-skin pin ran
headless, where `typeof document` is undefined, so BOTH skins fell to
the classic branch and deleting `isEnhanced()` from the condition
survived - the identical defect the first draft of
`test/enhancedPause.test.js` shipped one slice earlier. It runs under
the same four-property fake document now. Worth recording because it
was not learned the first time.

NOT DRAWN HERE, recorded rather than dropped quietly: THE PAPERDOLL.
The classic sheet composes it at DFU's (200,8) and the prototype
answers the same slot with the 28-node body schematic - but that
schematic is the INVENTORY's signature, it wants
`src/tools/enhancedVisuals.js` and the three.js tag `enhanced.html` loads
from a CDN, and the port's doctrine already carries exactly one
third-party request (Ledger A, the web fonts). It belongs to the
inventory slice with the equip map it explains. The LEVEL-UP screen
stays classic too: a different window, pushed by the hosts themselves,
which mutates stats through chargen's verbatim clamps.

## U51 THE PAUSE DOOR (2026-08-26)

Escape opens the ENHANCED screen. `ui/pauseDoor.js` picks between it
and the classic OPTN00I0 panel, the four hosts call what they always
called, and the screen it mounts is the FRONT DOOR - `ui/enhancedMenu.js`
in pause mode - not a second design.

U49'S OWN COMPLAINT WAS STILL TRUE. Its record says the port's settings
were "reachable only at boot: once you were playing there was no door
back that was not a reload", and that is the sentence that justified
collapsing four boot screens into one. It described the CLASSIC front
door. It went on describing the enhanced one, because `runEnhancedMenu`
is called from exactly one place - `main.js`, before the world boots -
and Escape inside the game went on opening a 320x200 panel with five
hand-placed controls. A player on the default skin met the enhanced
design once, at the door, and then played a classic game.

THE FORK IS IN FRONT OF `openPauseFlow` AND THE HOSTS DID NOT MOVE. It
is THE ONE CONSTRUCTION SEAM for the third time: AUDIT 17i split
`createChargenWindow` out after three bugs came from hosts wiring
chargen by hand, U50 put the skin fork inside it and cost its two
callers no edit at all, and the four pause hosts already funnelled
through one function. What they did change is the GATE - `pauseArtLoaded()`
became `pauseDoorReady()`, one predicate, for the reason `uiSkin.js`
gives for being one: a port that spells the test out at six call sites
is a port where the sixth spells it differently.

THE ART GATE MOVED THE WAY THE DATA GATE DID. The classic window cannot
draw one pixel without OPTN00I0.IMG, so the hosts gated Escape on it.
The enhanced screen reads no game data at all - that is the whole
premise of U49's door - and gating it on classic art would have left a
player whose art load failed holding a game with no pause menu, no
settings and no way out, on a screen that would have rendered
perfectly. `pauseDoorReady` is `isEnhanced() || pauseArtLoaded()`.

A SECOND ENHANCED SCREEN WAS THE OBVIOUS BUILD AND IS THE WRONG ONE.
Classic needs two windows because PICK03I0 and OPTN00I0 are two
different .IMGs; here they would be two copies of a settings view, and
the divergence U49 collapsed four screens to avoid would have grown
back inside the skin that closed it. So the rail changes and nothing
else does: Continue and New Game ask WHICH GAME, which is settled by
the time this mounts over a running one; Resume, Save Game and Exit ask
WHAT NOW. Load, Settings, Mods and About are identical in both. It
opens on Save Game, and Settings - the reason the door exists - is one
press away and permanently on the rail, which is the thing classic
could not do at any price.

THE PANES ANSWER THE HOST, NOT THE RAIL. Two of the four hosts hand
`savingPrevented: () => true` and no save or load hook at all (exterior,
worldModes), so the Save pane draws no button and answers with the
game's own recovered string - "You cannot save now." - rather than a
dimmed control with no explanation attached. The rows STAY on the rail
where they are refused, which is the argument the Mods section is built
on: a rail that drops a row teaches the player the door was never
there. And every exit closes the door BEFORE it fires the hook, which
is classic's own order (`_closeWith()` then the hook) and matters more
here - the port answers a save with a HUD line, and this screen is an
opaque div over the whole canvas, so a hook fired under a live door
hides its own answer. The probe checks that by asking the HOOK whether
the door was still up when it ran.

ESCAPE, AND ONLY ESCAPE, and it says so rather than leaving the gap
looking like an oversight. Escape is the key that opened the screen and
a pause screen you cannot leave by it is the trap the never-traps law
is about; it routes through `overlayAction`, the shared table, so it is
the same Escape rebound the same way as everywhere else, and its back
stack is innermost-first - a confirm card, then a phone's help sheet,
then the screen - or the one press meaning "not that" quits the game.
FLAGGED: the rest of the keyboard. The wizard walks to `done` with no
pointer because a wizard is a LINE; this is three panes with a rail, a
list and a sheet, and arrows over it is a real question about focus
order rather than a table lookup. Half of it would be worse than none.

THE TWO LAWS THE WIZARD PAID FOR ALREADY, inherited whole: the
window-level keydown is on CAPTURE and is REMOVED on unmount (here that
is not a leak but a game that can never be paused again - the dead
listener keeps eating Escape), and the POINTER LOCK is dropped on mount
and kept dropped, because mouselook is the port's resting state so this
screen always mounts over a locked pointer, and a locked pointer never
reaches the DOM at any z-index.

THREE THINGS LOOKING AT IT ON A PIXEL 5 FOUND, and two of them were
U49's bugs rather than this slice's. THE PHONE RAIL WRAPS now: it is a
flex row with `overflow-x: auto` and its scrollbar hidden, so four of
the seven destinations sat off the end of the screen with no affordance
of any kind - SETTINGS and EXIT among them, which is to say the door's
entire reason for existing and the way out of it. That is the AUDIT 24
shape exactly: a control that is drawn, exists, and cannot be reached on
the device that needs it most. SIX never fitted either, so the front
door has carried this since U49 and nobody saw it, because the entry it
hid was About. The WIZARD's rail is exempt and pinned as exempt - that
one is a walk through ten stages in order, and a walk that wraps stops
reading as a line. Second, `.body` had no width at all, so a card of
three lines stretched the full width of a desktop pane and every screen
but Settings read as mostly empty; it is a 720px reading column now,
with the settings pane's own `flush` body pinned UNcapped. Third, the
Save card draws the game it is about to overwrite - the same name, line
and numbers the Continue card shows - because that is precisely what
the press replaces, and the Exit card stopped repeating its own confirm
(both were titled "Leave this game", so the press between them looked
like a screen that had not responded; the heading says where you go,
the button says what you do, and the confirm echoes the button).

FOUR PANES NOW DRAW ONE SLOT - Continue, Load, Save and Exit - so the
character line and the health/gold numbers are written once and the pin
counts the literals to prove no second copy grew back.

PROVED IN A REAL BROWSER by `tools/enhancedPauseProbe.mjs` - 51/51 on a
desktop and a Pixel 5, zero page errors, with no ARENA2 on disk - and
it seeds a quicksave, because four of these panes are built FROM the
save and with an empty slot every claim about what a player is shown
before overwriting a game is vacuously true. It MEASURES every rail
button against the viewport, since reachable and VISIBLE are different
claims and the 44px target check passes either way. What it does NOT
prove is stated in its own header: that the four hosts call it, which
needs a living game and therefore game data. That half is held by
source pins. 20 pins; 20 mutations, 20 dead - and TWO of those
only after the pins they exposed were rewritten. The first draft of the
fork test passed for the wrong reason: the second clause is `typeof
document !== 'undefined'`, node has none, so both skins fell to the
classic branch and deleting `isEnhanced()` survived. It runs under a
four-property fake document now.

ONE EXPORT, ONE HOME. `ui/pauseWindow.js`'s factory is
`openClassicPauseFlow` now; the plain name belongs to the door. Two
modules exporting one name is the drift the `audit24_onehome` ratchet
exists to catch, and it caught this one during the slice rather than in
an audit.

NOT DONE HERE, recorded as real gaps rather than dropped quietly: the
`?dungeon` dev scene's own Escape is wired like the others, but that
host still holds the RAW chargen flow (U50's FLAGGED row) and nothing
about that changed; the CONTROLS grid stays classic-only - the enhanced
settings pane renders all 171 DFU keys, and key REBINDING is not one of
them; and the in-game screens behind this door - inventory, the sheet,
the spellbook, the travel map, the journal - are all still classic. The
prototype for those is `enhanced.html` + `src/tools/enhancedUI.js` and
it is the next frontier, not this slice.

## U50 THE ENHANCED WIZARD (2026-08-25, Mac's call, ONE STAGE AT A TIME)

Character creation in the enhanced skin. ALL TEN journey stages have
their own screen, the wizard reaches `done`, it answers a full
keyboard, and IT IS THE WIZARD THE GAME MOUNTS: New Game on the
enhanced skin lands on the province map. `/chargen.html` remains, as
the place a stage is argued with before it ships.

REVIEW is what closes it, and nothing else sets `done`. Its OK gate is
FOUR pools rather than one, because the summary lets you take points
back down off any of them, and unspent points pop TEXT.RSC 14 instead
of closing the window - proven live by un-spending a point on the
review and watching OK refuse. The name and reflexes there are the
SUMMARY's own (backing out reverts both; only the OK arm writes them
through), and Restart is soft.

THE SEAM IS `createChargenWindow` AND ONLY THAT. It was already THE ONE
CONSTRUCTION SEAM (AUDIT 17i split it out after three separate bugs
came from hosts wiring chargen by hand), so the skin is chosen there
and the two hosts that call it - world and exterior - needed no edit at
all. The enhanced arm answers the same overlay contract and does almost
nothing with it: the div is fixed and opaque so pointers never reach
the host's seam, and the view's own keydown answers keys through the
same table this window uses, so every host arm is a NO-OP BY DESIGN and
says so. `done` stays FALSE until the view is down, because a host
tears an overlay down when it reports done and a DOM node outlives the
object reporting it. THE FOUR HOSTS: world WIRED, exterior WIRED,
worldModes N/A (interiors never run the wizard), dungeonContext FLAGGED
- it holds the RAW flow as its own overlay and cannot reach the fork,
so it keeps the classic wizard; since U31 that is the `?dungeon` dev
scene alone.

PROVED IN THE RUNNING GAME by `tools/enhancedIntegrationProbe.mjs`:
front door, New Game, the world host booting, and the map traced from
the player's own ARENA2 into nine regions - on a desktop and a Pixel 5,
with `?skin=classic` proven never to mount it. 9/9, zero page errors. THE KEYBOARD IS DONE (2026-08-25): keys route through overlayAction,
the shared table ui/input.js already owns, so the flow's own arms
answer and a key does here exactly what it does on the classic screen.
tools/enhancedChargenProbe.mjs walks the whole wizard to `done` with
no pointer event at all.

THE FLOW IS NOT REBUILT. `ui/chargen.js`'s ChargenFlow carries every
law - the stage order in the enum's own sequence, the pools, the
biography grammar, the class questions, the custom-class builder, the
back arms AUDIT 17j spent seven findings on - and exposes `applyHit` as
a semantic action table. The view reads state and speaks through that
and `input()`, the same two doors the classic screens use. ~1,900 lines
of law reused, only the drawing replaced.

THE MAP is `ui/provinceMap.js`: TAMRIEL2.IMG traced at runtime into
vector outlines, marching pixel edges, holes wound opposite for
even-odd fill, collinear runs collapsed without one point moving, the
label hung at the point furthest from any coast. The masks are DFU's
CLICK REGIONS and not its coastlines - overlaying them on TMAP00I0
shows blobs running well past the painted shore - and the module says
so. THE NINTH PROVINCE cannot come from the picker (the eight blobs
never meet in the middle, so no flood isolates Cyrodiil) nor from the
painting by colour (parchment and land share indices); it is the
largest patch claimed by no homeland, painted in no sea colour, that
TOUCHES NO EDGE, and the edge clause is what discards the parchment
without recognising parchment. Province names are transcribed from
TMAP00I0's own painted labels, SUMURSET included.

`ui/bitmapCanvas.js` is what a DOM screen needs and the classic screens
never did: a palettized DFBitmap into a canvas on the 1-bit cutout law,
NEAREST, no renderer and nothing to free.

FOUR SEAM BUGS THE WALK FOUND, all the same shape - a law the flow
reads through a module variable only the CLASSIC art load fills:
describeRace (an empty description makes DFU accept the homeland
outright, so the confirm silently vanished), buildBackstory and
repBoxRows (an empty backstory written once and permanently, and the
one moment the player is told what twelve answers did). All five text
sources are injectable now on the terms describeRace already was, and
`attachChargenText` fills them. The fourth was mine: the reputation box
is not a stage - DFU pushes it over the questions on one route and over
the bio-METHOD screen on the other - so keyed to a state it rendered on
one route and was swallowed on the other, and "let it be written for
you" appeared to do nothing at all.

Probed in a real browser end to end on a desktop and a Pixel 5, and
every target measured at 44px by `tools/enhancedTapProbe.mjs`, which
now walks the wizard as well as the menu. 11 pins; 5 mutations, 5 dead.


## U49 THE ENHANCED FRONT DOOR (2026-08-25, Mac's call)

The port's front door was FOUR screens in a row - `ui/titleScreen.js`,
`scenes/launcherScene.js` + `ui/settingsWindow.js`, ANIM0001.VID, and
`ui/startWindow.js` - three of them separate hosts with their own event
wiring, and settings reachable only at boot: once you were playing there
was no door back that was not a reload. Classic works that way because
classic is a DOS program with a fixed 320x200 screen. Neither reason
survives here.

`ui/enhancedMenu.js` is one screen carrying continue, new game, load,
settings, mods and about. `systems/uiSkin.js` chooses between it and the
classic path, ENHANCED BY DEFAULT, with a toggle in both screens and a
`?skin=` override that persists nothing (the pin that keeps the 25
probes in `tools/` pinning classic geometry).

THE LABELS ARE TYPE. PICK03I0.IMG has Load Game, Start New Game and Exit
painted INTO the bitmap and DFU lays invisible click rects over the
words, which is why U21 had to land those three rects to the pixel or
the hit boxes drifted off the labels. Art that carries text cannot
reflow, scale, localise or be read on a phone.

THE LAW IS BORROWED, NOT REWRITTEN. The settings pane renders through
the same four modules the classic screen uses - `systems/settings.js`,
`ui/settingsMap.js`, `ui/settingsLaw.js`, `ui/settingsCopy.js` - and
`widgetFor` is total over all 171 keys, so the enhanced screen makes no
judgement about any of them. ~850 lines of DFU-cited law reused
untouched, ~650 lines of WebGL drawing replaced. The toggles WRITE:
one store, two views.

THE DATA GATE MOVED BEHIND THE DOOR. Nothing on the enhanced screen
needs ARENA2, so `ensureData()` is now a function every other path calls
first and the enhanced door calls after - a player who opens the page to
change a setting, read the build or check whether their save is still
there is never asked for a folder, which on a phone is a zip upload. The
classic door cannot do this and still gates first: it needs PICK03I0, a
palette and FONT0003 before it can draw one word.

ONE IMPLEMENTATION, TWO HOSTS. `/menu.html` and the game mount the same
module; `src/tools/enhancedMenu.js` is four lines and `menu.html` carries
no tokens or layout at all (`ui/enhancedStyle.js` owns both and injects
them at mount, so a player who chose classic never loads a byte of it).
A prototype with its own copy of the design is a prototype arguing about
a screen the player will never see.

AUDIT 19 F3 IS NOW STRUCTURALLY IMPOSSIBLE rather than guarded: the
classic menu drew Load unconditionally and had to check for a save at
press time (it fell through and silently started a NEW game), where
these panes are built FROM the save, so a button that would load nothing
cannot be drawn.

NOT RUN ON THE ENHANCED DOOR, each recorded as a real loss rather than
dropped quietly: the boot LAUNCHER (settings are one press away, so a
screen in front of the menu would be a screen in front of the menu), and
the TITLE and SPLASH, both of which read ARENA2 - the whole point of this
door is that it opens before the folder pick. `?skin=classic` still plays
both, and giving the enhanced door its own title moment is its own slice.

PROVED LIVE with no game data at all: `tools/enhancedMenuProbe.mjs`
boots index.html on a desktop and a Pixel 5, renders the menu, changes a
setting and reads it back through the store, presses Begin and watches
the ARENA2 pick appear at that moment and not before, then checks
`?skin=classic` still gates first. 16/16, zero page errors.


## U1 (classic HUD - vitals + compass): SHIPPED

The renderer gains ONE screen-space primitive: drawScreenQuad -
positioned pixel-rect destination (top-left origin), source-UV
window, textured (0.5 alpha cut) or solid color; depth off, NEAREST.
src/ui/hud.js is the verbatim DFU-fullscreen HUD: vitals
bottom-left from the classic bar art (MAIN03I0 health / MAIN04I0
fatigue / MAIN05I0 magicka), each cropped BOTTOM-ANCHORED by
current/max (the VerticalProgress shape; fatigue draws FULL,
FLAGGED - the stat pends); the compass bottom-right - COMPBOX frame
over a 64px window into COMPASS.IMG scrolled by trunc(258 x
heading01) (nonWrappedPart; the strip's tail duplicates its head so
scroll 257 + 64 = 321 < 322, no runtime wrap - pinned). Integer
scale floor(canvasHeight/200), min 1, keeps the art crisp. Indexed
IMG pixels convert with the classic index-0 transparency and ride
renderer.uploadTexture under img/name keys. Heading derives from
the view forward the file already uses (0 = +z, wrapped). Art-gated:
absent IMGs disable the HUD loudly. Review catch IN-SLICE: the new
static ImgFile import double-sourced against foeDeps' dynamic - the
06e recidivist class, caught before commit this time.

## U2a (classic text - the FNT reader + drawing): SHIPPED

formats/fntFile.js is the verbatim FNT reader: header {fixedWidth,
fixedHeight u16}, 240 glyph entries {dataOffset, width u16}, 32-byte
glyphs of 16 rows x 2 bytes - with the source's L/R HALF SWAP (the
left 8 pixels come from the ODD byte, the right 8 from the EVEN, each
expanding MSB-first) pinned on crafted bytes. ui/text.js builds ONE
white 256x240 atlas per font through the existing uploadTexture and
draws through drawScreenQuad with per-call tint - one atlas serves
every classic text color; DaggerfallFont's rules carried (glyph =
code - 33, classic 1px spacing, integer scale). The sub-33 / no-glyph
case this sentence used to describe as "advance a fixedWidth space" is
corrected in the AUDIT 18 section at the foot of this
page. Live consumer NOW (infra never ships dead):
the HUD shows the readied spell name + cost in FONT0003 above the
vitals - the U4 spellbook window replaces it. Review catch: the font
load was written as dynamic imports IN THE SLICE AFTER the 06e class
was caught in-slice - rooted static before commit; the pattern's
pull is real and the audits keep earning their keep.

## U2b (the chargen flow): SHIPPED

ui/chargen.js: name -> gender -> class (all 18 careers loaded from
their CLASS*.CFG, names from the files) -> stats -> skills -> done,
with the pool rules VERBATIM from the rollout components: stats +
blocked at MaxStatValue 100 or pool 0, - blocked at the ROLLED value
(points return); skills + blocked only at the group pool, - blocked
at the rolled value; both screens REROLL (the components' own);
confirm gates on pool == 0 (all three groups for skills). The
Warrior-16 default is GONE - no ?class and no chargenDone runs the
flow; ?class=N remains the headless skip (rolls + the loud
lowest-first policy, which now serves ONLY that path and the tests).
systems/chargen.js split at root: applyCharacter takes FINISHED
values (the flow's hand distribution or the headless roll) and owns
the health/magicka/sum derivations ONCE; gender lands on the entity
(clothing loot consumes it). Hosts pause gameplay while the overlay
is active (standalone keeps its RAF alive - a plain return would
have killed the loop, caught in review) and route a small key map;
no font art falls back to the headless roll LOUDLY so the game
stays playable without ARENA2 UI art. Screens are clean classic-text
panels; the classic background ART is FLAGGED pending art-name
verification against real ARENA2 (Mac signs off visuals).

## U3 (level-up screen + char sheet): SHIPPED

The headless auto-apply is RETIRED on the UI path: raiseSkills gains
an onLevelUp sink - with it, ready/pending set and NOTHING applies
until the screen confirms; without it (tests, headless runs) the old
immediate apply stands. applyLevelUp is the single application
(HP roll + the 4..6 pool handed to a distribute hook) - the U3
screen distributes BY HAND through the SAME verbatim clamps chargen
exports (max 100, pool 0, floor at the pre-level value), confirm
gated on pool 0, idempotent after. The char sheet (classic F5) is
the read-only page: name/class/level, HP/MP, the eight stats, skills
by career group - live values. ONE GENERIC OVERLAY SEAM replaced the
chargen-specific host wiring (uiOverlayActive / overlayInput /
drawOverlay serving chargen, level-up, and the sheet - a root
refactor, not a third copy); font-less environments fall back
LOUDLY (chargen -> headless roll, level-up -> headless apply, sheet
closes). Classic INFO background art FLAGGED pending art-name
verification. Review catch: the first font-less branch was
convoluted nonsense and was rewritten sane before commit.

## U4 (inventory + spellbook + death): SHIPPED

ONE PLAYER-DAMAGE DOOR first: hurtPlayer consolidates the four
scattered health-decrement sites (trap sink, enemy melee, enemy
arrows, trap-spell missiles) - floors at 0, surfaces, and opens the
DEATH SCREEN at 0 (Enter restarts by reload; save/load pends
Systems). INVENTORY (classic F6): the player's items with stacks +
the quantized weights and total; Enter on a Weapons item EQUIPS it
through a scene callback - ?weapon is retired as the only path
(loot a bow, use it); arrows refuse equip; drop/use pend.
~~SPELLBOOK (DFU-default Backspace): the KNOWN list - the entity's own
spells when present, else the INTERIM loud fallback of the file's
ranged damage spells (classic starting-spell sets replace it when
their data lands); Enter readies - ?spell retired as the only path.~~
RETIRED at U42, which puts DaggerfallSpellBookWindow on the real
SPBK00I0.IMG; the fallback went with it (chargen has assigned real
starting spells since S3c, so it had been dead for players for
months). Both rode the U3 overlay seam; keys route in every host
BELOW the overlay branch so Backspace still edits the chargen name.
Windows close on ESC. Backgrounds FLAGGED as U2/U3.

## U5 (HUD popup text): SHIPPED

ui/hudText.js is the classic bottom-center message queue
(AddHUDText shape): newest-last, 4-line cap, ~2s per line with a
0.4s fade, drawn just above the vitals in classic text. SEVEN
consumers wired in the scene: pickup ('You take N items.'), skill
raises ('Your X skill has improved.' - the classic phrasing),
level-up ready, self-cast healing ('You are healed N points.'),
weapon equip, spell readied. The literals are honest stand-ins:
TEXT.RSC is FLAGGED - the real records swap in when that reader
lands. The scattered 'feedback pends UI' flags retire.

## TEXT.RSC (the reader): SHIPPED

formats/textRsc.js ports TextFile.cs verbatim: header
TextRecordHeaderLength u16, RecordCount = headerLength/6 - 1, record
headers {id u16, offset u32}, records raw to AND INCLUDING the 0xFE
terminator (GetBytesById's own shape). The Formatting enum's defined
members carried; plainText() flattens faithfully for message
consumers - chars pass, NewLine, SubrecordSeparator splits VARIANTS,
FontPrefix/PositionPrefix each consume their ONE operand byte (so
printable operands never leak into text - pinned), every other
control drops. Full token semantics (positioning, fonts, pages) pend
the book/scroll renderers. CONSUMERS WIRE PER-ID: each U5 literal
swaps only when its classic record ID is verified against DFU usage
- no guessed IDs; the literals stand until then.

## The input map: SHIPPED

ui/input.js owns every binding: overlayAction (the chargen/window
key table - previously DUPLICATED verbatim in both hosts) and
gameAction (F5 sheet, F6 inventory, Backspace spellbook - the
classic/DFU defaults; C cast is OURS, flagged in the one place it
now lives, click-to-cast queued). routeKey routes one keydown with
overlay precedence (Backspace edits a chargen name, never opens the
spellbook mid-flow - pinned) and returns consumed so hosts
preventDefault exactly when something fired. BOTH hosts collapsed
their if-chains + duplicate routers onto it; the scattered 'input
map pends' flags retire.

## Click-to-cast: SHIPPED (+ an S9 fidelity fix)

The classic shape lands: READYING a spell from the spellbook ARMS
the next attack-click - the RMB press CASTS along the look instead
of starting a swing (a OneShotLatch in ui/input.js, pinned:
unarmed nothing, fires once, double-arm single fire; the pending
cast resolves in the frame where eye + view exist). After the cast
the latch is spent and clicks swing again; the readied spell
persists as our lastSpell equivalent - C recasts it directly (the
RecastSpell convenience). FIDELITY FIX FOUND IN THE SOURCE while
verifying: CastReadySpell aborts a ByTouch cast BEFORE
DecreaseMagicka when no target sits in touch range - the S9 'spends
on a whiff' rule was WRONG and dies: touch whiffs now refuse
without spending, verbatim.

## Live-play fix (2026-07-07): the standalone spawn

Mac's first live run spawned wedged - the standalone host put the
CAMERA (the eye) at the RAW start marker, leaving the feet ~1.5
units under the floor inside the under-geometry shaft; 'only look
up and down' was the shaft's walls, one bug wearing two symptoms.
worldModes carried the verbatim spawn (MovePlayerToMarker + up *
0.6h + the FixStanding floor snap) inline; the standalone predates
it and never got the lift. ROOT: ctx.startSpawn() now owns the
verbatim placement ONCE (the context has the marker and the
collider) - both hosts consume it, the inline copy and a dead
binding died.

## Live-play fix II (2026-07-07): overlays now HOLD the world

Mac reproduced the wedge post-spawn-fix - because the spawn was
never the (only) culprit: BOTH hosts ran LIVE MOVEMENT under the
chargen overlay. The keys Set feeds the motor while typing - a name
containing w/a/s/d walks the player, and by skills-confirm the
character has drifted off the start ledge into a pit ('spawned in a
hole', yaw showing shaft walls). The overlay gate only ever skipped
foes/water. ROOT: overlays hold the world everywhere - the
standalone gates actions.update + both movement branches on
uiOverlayActive; the world/exterior shells gate their motor on
modes.dungeonCtx.uiOverlayActive. Plus a [spawn] diagnostic line
(marker -> feet, 'startSpawn build' tag) so console pastes
self-identify the running bundle.

## U6 (the action text boxes - ShowText / ShowTextWithInput / DoorText): SHIPPED (2026-08-16)

The Ledger C row (with its Systems half - the TEXT.RSC database goes
LIVE in the dungeon context). Verbatim from DaggerfallAction's text
delegates:

- **ShowText (0x0b)**: TEXT.RSC record Index + 8600 in a
  click-anywhere-to-close box on the overlay seam (the world holds).
- **ShowTextWithInput (0x0c)**: record Index + 5400 with the 20-char
  ' > ' entry (DaggerfallInputMessageBox shape; digits joined the
  overlay char map - the blind-god answer is "1"). The verbatim
  actionTypeTwelveLookup answers (5404/5406/5423/5424/5464) gate the
  chain: Play SKIPS the up-front cascade for this flag and only a
  case-insensitive match fires ActivateNext - the classic riddle
  doors work end to end.
- **DoorText (0x63, joins ACTION_FLAGS)**: first activation shows
  record Index + 7700 as HUD text (2.0s) and HOLDS the door (the
  Open() special gate, verbatim including the Receive trigger-gate
  interplay for Direct/MultiTrigger-flagged doors); the patch table
  rides along (7701..7704 -> 7705, the known-missing ids skip);
  later activations run the classic trespass check (axisRaw > 5 ->
  MakeEnemiesHostile - logged loudly here: our live foes are already
  hostile-on-sight, passive teams pend the faction model).
- Presentation: clean classic-text panels (ui/actionText.js), art
  FLAGGED with the other windows. A missing TEXT.RSC record logs
  loudly where DFU throws (the crash-class doctrine).

1 net test (action.test.js 5 -> 6). Suite 313/75, ARENA2 corpus
313/313 green pre-commit.

## Queue
- Classic window art, per-ID TEXT.RSC verification (the database is
  now LIVE via U6; the id sweep remains).
- ~~Starting-spell sets: SHIPPED via Systems S6. AUDIT 18 struck this row's
  parenthetical, which read "(the spellbook lists the character's real known
  spells)". It does when the character HAS spells; when `entity.spells` is
  empty or absent, `knownSpells` falls through to an INTERIM fallback that
  returns every ranged damage-health spell in SPELLS.STD - so a Warrior's
  spellbook lists eight attack spells and can cast them. DFU's
  DaggerfallSpellBookWindow.RefreshSpellsList has no fallback of any kind.~~
  CLOSED at U42: the fallback is DELETED along with the window that used it,
  and `SpellbookWindow` now reads `playerEntity.spells` and nothing else,
  exactly as RefreshSpellsList does. A Warrior's book opens EMPTY - no
  rows, no name, no icons and no message, which is what DFU does too
  (GameManager.cs:550-553 posts the open unconditionally). The only
  path that says anything is the ITEM's, whose `noSpells` arm answers
  TEXT.RSC 12.
  (The latch that guarded this row - `audit18_bible_docs`'s "UI-Arc does not
  claim the spellbook lists real spells while the fallback lives" - reads the
  fallback's own source text, so it goes dormant with the fallback rather
  than silently passing over a live one.)

## U7 (the rest window): SHIPPED

The classic rest flow, consuming the S20 rates - recovery finally
has its front door. Ported from DaggerfallRestWindow's rules (the
panel is the U-arc's clean text idiom; backgrounds stay FLAGGED
pending art-name verification):

- **The session machine** (systems/restSession.js, pure + pinned):
  an hour of rest passes in 0.75 REAL seconds (loiter 1.25),
  advanced in six 10-classic-minute sub-ticks so world time - magic
  rounds, diseases, poisons, the once-per-change fatigue drain -
  flows through the rest exactly as RaiseTime does. Each completed
  hour: the RESTING enemies check breaks on TEXT.RSC 354 (an aware
  foe at any spawn-band range, an unaware one only within the
  12-unit resting distance - the P13 senses fields again); then
  vitals tick for timed/full rest (the three S20 per-hour rates +
  a Medical tally; loiter recovers NOTHING) and completion lands -
  full rest ends when fully healed (health AND fatigue full,
  magicka full or NoRegenSpellPoints; 350 "You are healed.", and
  instantly when starting already healed), timed on 353 "You wake
  up.", loiter on 349. Death mid-rest (disease/poison through the
  raised hours) ends at once - the death screen owns that flow
  (DFU's "You never awaken." line rides it).
- **The window** (ui/restWindow.js): selection (rest a while /
  until healed / loiter) -> an hours prompt for the timed modes
  (loiter refused above the classic 3-hour cap with the
  cannot-loiter lines) -> the running page (hours passed + live
  vitals; Escape ends with the mode's finish text) -> the
  click-to-close end box. THE WORLD RUNS UNDER THE OVERLAY - foes
  keep moving while the player rests and genuinely break it.
- **The key + gates**: KeyR (the DFU default) through the input
  map; pre-rest gates in the classic order - enemies nearby (354),
  swimming or airborne (355 "You cannot rest now.", the motor's
  live grounded flag). Building trespass/rent rules pend towns;
  the DFU rest-encounter spawns pend the spawn machinery.

3 tests (restwindow.test.js). Suite 366/83, ARENA2 corpus
pre-commit.

### U7 correction (2026-08-16f audit)

Three parity fixes against DaggerfallRestWindow/DaggerfallUI read
line-by-line: (1) the sub-tick interval is waitTimePerHour /
minutesPerTick VERBATIM (the divisor quirk - an hour rests in 0.45
real seconds, loiter 0.75; the shipped cut divided by ticks-per-hour
and rested ~1.7x slow); (2) the pre-gate's enemy check is the
RESTING AreEnemiesNearby(true) variant, shared with the hourly break
dep (the shipped strict variant refused rest with any unaware foe in
the spawn band); (3) StartRestGroundedCheck's raycast fallback lands
(grounded OR floor within 0.2 below the feet - near-ground
levitators may rest), derived from CAPSULE_HEIGHT. Plus the 0-hour
quirk (resting 0 rests one full hour) and the empty-entry no-op.
ROUTED: SetEnemyAlert on the 354 refusal (no alert state yet);
DFU's youNeverAwaken death text still defers to our death screen
(documented departure); TEXT 26 (>99 hours) is enforced silently by
the 2-digit entry field.

## U8a (2026-08-17): THE NATIVE PANEL - real classic art begins SHIPPED

Mac's call: import the real Daggerfall menus/artwork. The IMG/CIF
readers and all 333 UI art files were already in hand; this slice
lays the foundation and retrofits the FIRST window.

- ui/nativePanel.js - DFU's NativePanel semantics: every classic
  window authors in VIRTUAL 320x200 pixels; the screen mapping is
  integer scale (min 1) + centered letterbox (the hud.js law).
  loadImg (one IMG -> texture + size, deps-injected like loadHud),
  drawImg/drawRect through the mapping, shadowText = DFU's
  AddDefaultShadowedTextLabel (color 243,239,44 / shadow 93,77,12
  at +1,+1 virtual px, verified against DaggerfallUI.cs), SCREEN_DIM
  behind modals, pointToNative for touch hit rects.
- THE CHARACTER SHEET retrofit (the first native window):
  INFO00I0.IMG with DaggerfallCharacterSheetWindow's verbatim label
  geometry - name (41,4) race (41,14) class (46,24) level (45,34)
  gold (39,44) fatigue/64 (57,54) health (52,64) encumbrance (90,74)
  = carried template weight + gold at 0.0025/piece over
  floor(Str*1.5) (FormulaHelper.MaxEncumbrance) - and the 8 stats
  centered in 28-wide panels at (141, 17+i*24). Keys 1-4 pop the
  skill groups as interim text panels (the classic BUTTON popups'
  function); art-less falls back to the old text page (never traps).
- HOST RULE: F5 opens the sheet in BOTH exterior hosts now (it was
  dungeon-only), routed through the townTalk overlay seam
  (isChoiceWindow = raw codes); the dungeon keeps toggleCharSheet
  with a lazy preload; both hosts warm INFO00I0 at boot.

FLAGGED loud: the PORTRAIT (200,8) pends chargen faces; the
level-up screen + every other window stay on the text idiom (one
window per U8 slice: trade/inventory/talk/rest/chargen queue); the
classic buttons draw from the ART (no click/touch rects yet -
pointToNative is ready for them); interior-mode F5 pends worldModes
key routing.

Probed live + EYEBALLED (the doctrine): the real stone page renders
with every label in its engraved field - "RACE: Breton, LEVEL: 1,
FATIGUE: 50/50, ENCUMBRANCE: 0/75", stats in their boxes (the 0s
are the honest pre-chargen interim entity), the portrait window
showing the page art; Digit1 pops the skill panel; F5 toggles
closed. Suite 452/99.

## U8b (2026-08-17): THE NATIVE TALK WINDOW SHIPPED

The second native window - and the most-seen screen in the game:
TALK01I0.IMG replaces the interim ChoiceWindow talk chain in BOTH
exterior hosts (art-less sessions keep the chain - never trap).

- ui/nativeTalk.js: DaggerfallTalkWindow's verbatim geometry as
  TALK_RECTS - the button column (Tell me about 4,4 / Where is 4,14
  / Location 4,26 / People 4,36 / Things 4,46 / Work 4,56, all
  107x10), Okay (4,186), Goodbye (118,183,67x10), the topic list
  (6,71,94x104) at 9px rows, the conversation panel (189,65,
  114x126) wrapped + bottom-anchored, the NPC name strip (117,52),
  the tone radios (258,18/28/38,6x6). The button LABELS are baked
  in the art - DFU overlays invisible hit rects and so do we.
- POINTER ROUTING lands: townTalk.pointerdown maps canvas clicks/
  taps through pointToNative to the window's hit rects, called by
  both hosts BEFORE requestLook (a consumed click never grabs
  pointer lock) - the phone's tap path and the desktop's mouse path
  are the same seam. The session's keyboard accelerators stay: W
  opens Where-is>Location, T cycles tone, digits pick rows, N/P
  page, Esc/E goodbye.
- The session pipeline is UNCHANGED underneath: the same
  categories/directory, answerText (extracted, shared with the
  fallback chain), the T3e knowledge roll, the T3f toned tiers -
  answers append to the conversation history as classic does.

FLAGGED loud: the TFAC portrait pends faces (the art's frame
shows); the TALK02/03 tone-highlight art pends (an interim yellow
mark fills the active radio); People/Things/Work + Tell me about
are hit-consumed no-ops pending their topic sources; the scroll
arrows ride their rects (no INVE06/07 arrow art yet).

Probed live + EYEBALLED: the full classic screen - every baked
button label under its rect, the NORMAL radio marked, the three
alchemists in the topic list (long names truncating at the list
edge), "People of Daggerfall" on the name strip, the greeting +
answer in the conversation panel; the whole circuit driven by MOUSE
CLICKS (Where is -> category -> building -> answer -> tone radio ->
goodbye). Suite 454/100.

## U8c (2026-08-17): THE NATIVE TRADE WINDOW + ITEM ICONS SHIPPED

The third native window - the E2/E3 shop loop on the classic
inventory screen, and the slice that brings ITEM ICONS online (the
capability the inventory window will reuse).

- THE ICON PIPELINE: itemTemplatesData regenerated with
  worldTextureArchive/record per template (the extractor gains the
  fields); icons are plain TEXTURE.### records through the EXISTING
  pipeline (getTexture + uploadRecord), warmed lazily per drawn
  item with the native size captured at warm (the GL handle carries
  no dimensions). Material-DYED weapon/armor icon variants FLAGGED.
- ui/nativeTrade.js: INVE00I0.IMG base + INVE08I0.IMG buy-mode
  action panel at (222,10) + SHOP00I0.IMG cost strip at (49,13)
  with cost/gold labels at +28/+68 (all verified against
  DaggerfallTradeWindow - the FIRST guess TRAD00I0 does not exist;
  the probe caught it). The classic vertical item lists: local
  (163,48,59x152) = the player's shop-accepted sellables, remote
  (261,48,59x152) = the open shelf, four 38px slots each with real
  icons + name/stack labels, 12px top/bottom scroll bands.
- THE TRADE MODEL this slice: clicking a remote item BUYS it
  (doBuy - the E2/E3 transaction core extracted and shared with the
  keyed fallback), clicking a local item SELLS it (onto the shelf,
  buy-backs work); the cost strip shows the last price + live gold;
  Exit/Esc/E close; digits buy visible slots. worldModes gains
  pointerdown (the townTalk shape) and the hosts route it before
  requestLook - interior native windows own the pointer.

FLAGGED loud: the BASKET + mode-action flow (DFU accumulates then
Buy), wagon/info/select/steal consumed no-ops, the sell-mode INVE10
panel art, tab filtering, the paperdoll, scroll-arrow art.

Probed live + EYEBALLED: the full classic screen - the tabs and
jewelry slots of INVE00I0, WAGON/INFO/SELECT/STEAL/BUY/CLEAR/EXIT
on the action panel, COST:0 / 20000 on the strip, and THREE REAL
BOOK ICONS on the shop list; a remote click bought at 3129 (the
book crossing to the local list), a local click sold back at 2968,
Exit closed. Suite 455/101.

### U8c HOTFIX (2026-08-17, Mac's catch): upside-down item icons

The shelf books rendered INVERTED: record textures store BOTTOM-UP
rows (baseImageFile.getColor32 keeps DFU's verbatim GL flip for the
mesh/billboard path) while drawScreenQuad samples v0 at the TOP -
the two paths' V conventions differ, and the icons were the first
record-textures drawn through the screen-quad path. The icon draw
now passes a V-flipped source rect ({v0:1, v1:0}), pinned in
nativetrade.test.js. THE STANDING NOTE for future native windows:
IMG art through loadImg/uploadTexture is top-down (draw plain);
RECORD art through uploadRecord is bottom-up (draw V-flipped).
Suite 456/101; the probe re-run + re-eyeballed - books lying
right-side up.

### U8c HOTFIX 2 (2026-08-17, Mac's catch): icons/text spilling the cells

The list cells were free-styled (59-wide centring, 1.5x upscale, a
name label) and the icons spilled over the art's slot frames. The
VERBATIM ItemListScroller law now stands: four 50x38 item BUTTONS
at x0 of the scroller (the right 9px is the scroll strip - its top
half scrolls up, bottom half down, and it never trades), icons
ScaleToFit with MaxAutoScale 1 - NEVER upscaled - centred in the
button both axes, and the ONLY cell text is the stack count at the
button's top-left when stackCount > 1 (classic lists draw NO item
names - names ride the info/tooltip seam, FLAGGED). Pinned (the
cell metrics, the no-upscale/centring draw, the strip-vs-pick
split). Suite 457/101; re-probed + re-eyeballed - every book
centred inside its own frame.

### AUDIT 17d (2026-08-17, after Mac's third catch): the UI parity audit

Three native-window positioning defects in two days ("dude. come on
how hstd is it to have parity with dfu and positioning") meant the
windows were built from MEMORY of DFU, not from its source. This
audit re-grounded EVERY drawn element of all three native windows
line-by-line against DaggerfallCharacterSheetWindow /
DaggerfallTalkWindow / DaggerfallInventoryWindow + ItemListScroller
+ ListBox. Findings, all fixed + pinned:
- TRADE (the big one): even HOTFIX 2 had the scroller MIRRORED.
  itemListPanelRect is (9,0,50,152) - the four 50x38 buttons sit at
  x=9 and the 9px scroll rail is the LEFT column: up arrow
  (0,0,9,16), down arrow (0,136,9,16), scrollbar (1,18,6,117)
  between. Rail clicks scroll (arrows one slot, the bar pages);
  they never trade. Icons centre in the BUTTON at x9.
- TRADE stack labels: FONT0004 (DFU's Font4 for stack counts), not
  the default FONT0003 - preloaded with the art.
- TALK topic rows: 7px verbatim (ListBox row height = FONT0003
  fixedHeight 7 + RowSpacing 0), not the 9px guess; TOPIC_ROWS
  derives (104/7 = 14 visible rows).
- TALK conversation lines: 11px (RowSpacing 4), not the 8px guess.
- TALK colors: questions render DaggerfallQuestionTextColor
  (0.698,0.812,1) in the PLAYER-SAYS panel (123,8,124,38) - the
  panel was drawn empty before; answers render
  DaggerfallAnswerTextColor (227,223,0), not the default yellow.
- TALK NPC name: centred in its 197-wide panel
  (HorizontalAlignment.Center), not left-aligned.
- CHARSHEET: audited clean - every label already on its verbatim
  DFU coordinate.
Both probes re-run + re-eyeballed: books inside their frames with
the left rail clear, the light-blue question over the yellow
conversation, the centred name. Suite 457/101 (assertions only).

THE NATIVE-WINDOW RULE (standing, from this audit): every drawn
element of a native window - rect, font, color, scale, alignment -
must cite its DFU source line (file + member) in the code comment
or the arc record BEFORE it ships. No free-styled geometry: if the
DFU value is unknown, the element does not draw until it is looked
up. Guessing cost three hotfixes; looking up costs one grep.

## U8d: the native inventory window (2026-08-17)

The classic inventory screen on real art - the FIRST window built
UNDER the native-window rule: every element below cites
DaggerfallInventoryWindow.cs.
- ui/nativeInventory.js: INVE00I0.IMG base; INVE01I0.IMG is DFU's
  SELECTED-state sheet (ImageReader.GetSubTexture cuts each active
  button from it at the button's own rect) - ported as drawImgSub
  on nativePanel (IMG top-down, straight UVs). Verbatim rects
  (#region UI Rects): tabs weaponsAndArmor (0,0,92,10) / magicItems
  (93,0,69,10) / clothingAndMisc (163,0,91,10) / ingredients
  (255,0,65,10); action buttons 31x14 at x226 - wagon y14, info
  y36, equip y58, remove y80, use y103, gold y126; local/remote
  lists (163/261,48,59x152); exit (222,178,39,22).
- THE TAB FILTER (AddLocalItem verbatim): WeaponsAndArmor = groups
  Weapons/Armor not enchanted; MagicItems = enchanted or Spellbook
  (MiscItems.Spellbook = 132); Ingredients = isIngredient not
  enchanted - DFU's ItemTemplates.txt marks EXACTLY template
  indices 0..77 (verified: 78 rows, contiguous); ClothingAndMisc =
  everything else. Defaults verbatim: WeaponsAndArmor tab
  (SelectTabPage on setup), Equip mode (selectedActionMode; Remove
  for loot targets pends with the loot flow).
- ui/itemScroller.js: the ItemListScroller EXTRACTED to one shared
  module (the 17d law - buttons at x9, the LEFT rail, no-upscale
  centring, FONT0004 stack labels) - nativeTrade rewired onto it,
  the inventory rides the same code. One layout, one fix site.
- THE SLICE LINE: this is the VIEW + INFO half. Info-mode clicks
  pop an interim name/weight/value panel (DFU's 1016 info text +
  paperdoll cutout pend); Equip/Use/Remove local clicks and the
  whole remote (dropped-pile) side are FLAGGED loud - equipping
  needs the paperdoll arc, dropping needs the ground loot flat
  (droppedItems in DFU's OnPush). Wagon/gold consumed no-ops.
- F6 opens it in BOTH exterior hosts (DFU's default Inventory
  binding; the F5 host-rule shape), art warmed at boot, art-less
  sessions leave F6 dark (never trap).

Probed live + EYEBALLED (tools/nativeInventoryProbe.mjs): the gold
tab highlight landing exactly on the baked WEAPONS & ARMOR button,
EQUIP lit as the default mode, dagger + buckler inside their slot
frames right-side-up, the Clothing tab swapping to the book with
its FONT0004 "3" at the button top-left, the INFO panel over the
paperdoll space, Escape closing. Suite 460/102.

## U8e: dropped loot - the ground pile (2026-08-17)

The inventory's remote column comes alive: DFU's droppedItems +
CreateDroppedLootContainer, every law cited.
- scenes/droppedLoot.js: dropPile mints a pile at the ground below
  the player with an archive-216 flat (DaggerfallLootDataTables.
  randomTreasureArchive) on a RANDOM record from the verbatim
  20-entry randomTreasureIconIndices; batches ride the hosts'
  person-flat axis (the corpse-batch shape); lootTargets carry the
  corpse activation box. EMPTIED piles vanish from both reads
  (SerializableLootContainer: Items.Count == 0 -> remove).
- nativeInventory REMOTE SIDE: Remove-mode local clicks transfer
  whole stacks into the remote pile (LocalItemListScroller_
  OnItemClick; the stack-split popup pends); remote clicks in Equip
  OR Remove transfer back to the player (RemoteItemListScroller
  verbatim - Equip's equip-after half pends the paperdoll);
  closing with session drops hands them to onDrop (the OnPop mint).
  Loot-target opens default to REMOVE ("so player does not
  accidentially equip when picking up").
- HOSTS (both exteriors): dropFeet raycasts the ground below the
  motor (FindGroundPosition); E on a pile slots between corpse loot
  and doors in the activation order and reopens the inventory WITH
  the pile as remote target; pile batches draw with the person
  flats. FLAGGED loud: save persistence (piles die with the
  session, as guard corpses do), the ?world pixel-destroy frame
  doctrine (piles share the corpse-batch stance), the stack-split
  popup, TrackLooseObject.

PROBE LESSON (tools/droppedLootProbe.mjs): the first run dropped
while the boot collider was still streaming - the motor hung at
spawn height, the ground raycast had no tris, and the pile minted
mid-air. Probes that DROP things must wait for the MOTOR TO SETTLE
(two stable __player.pos reads), not just __shotReady. Probed +
EYEBALLED end to end: the classic treasure sprite lying on the
street, E reopening the window with REMOVE lit and the dagger in
the pile column, the pickup emptying the pile and the flat gone.
Suite 462/103.

## U8f: the equip foundation - ItemEquipTable + the paperdoll base (2026-08-17)

The paperdoll arc opens. Two halves, every law cited:
- systems/equip.js: the MECHANICS half of ItemEquipTable over the
  EXISTING C5a/C5c foundation (characters/paperdoll.js EQUIP_SLOTS
  + characters/equipTable.js's verbatim GetEquipSlot/GetItemHands,
  whose header always deferred "equip/unequip mechanics" to the
  Systems arc): EquipItem (arrows refused, SplitStack ONE off a
  worn stack, a 2H clears both hands, a shield bumps a held 2H, the
  destination swaps its occupant out and returns the unequipped
  list), UnequipItem, the string-group bag shape translated to
  C5c's numeric enum at the boundary (C5c's getItemHands now
  accepts both - worn bag items land in the slots verbatim and the
  2H-replace rule inspects them). Items STAY in the bag and carry
  equipSlot when worn - FilterLocalItems' !IsEquipped gate hides
  them from the tab lists. FLAGGED: equip sounds, enchantment
  payloads.
  THE NEAR-MISS (process): the first draft REBUILT GetEquipSlot/
  GetItemHands from the DFU source without checking the tree - the
  C5c foundation already carried them, and the duplicate overwrote
  test/equip.test.js (the manifest drift guard caught the five
  vanished tests at the gate). BEFORE porting a DFU class, grep the
  bible + tree for an existing port; the manifest guard is load-
  bearing - never bypass it.
- ui/paperDoll.js: the avatar base on the inventory - the context
  SCBG background (town SCBG04I0; dungeon/graveyard/region branches
  cited and pending their contexts) as the subrect (8,7,110,184)
  filling the 110x184 panel at (49,13); the BODY IMG placed by its
  OWN baked header offset minus paperDollOrigin (200,8); BlitBody
  verbatim - nude body, then the NoPlayerNudity censor welds from
  the clothed sheet in waistHeight-40 bands gated on
  IsUpperClothed/IsLowerClothed; the FACE CIF head at the entity's
  faceIndex by its record offset. INTERIM loud: Breton male face 0
  until chargen fronts identity.
- THE SLICE LINE: the equip machine is TESTED but not yet wired to
  the EQUIP button - equip-mode clicks stay flagged no-ops until
  U8g lands the item overlay layers (playerTexture re-extraction +
  dyes) and the paperdoll click-to-unequip mask; the FP-weapon
  binding rides that slice too.

Probed + EYEBALLED: the classic Breton avatar standing on the town
background inside the panel frame - head with its silver band at
the baked offset, the censor underwear from the clothed weld, the
list icons beside him. Suite 464/104.

## U8g: item overlays + LIVE EQUIP (2026-08-17)

The paperdoll dresses and the EQUIP button works. The renderer
moved to DFU's own architecture - the doll composes into ONE
texture (PaperDollRenderer renders to target), done CPU-side over
INDEXED bitmaps, which hands us GetEquipIndex's click resolution
for free. Every law cited:
- LAYER ORDER (Refresh): cloak interiors (the first drawn cloak's
  template record) -> nude body -> the censor welds gated on
  chest/legs slots -> head -> items ascending drawOrder (BlitItems;
  jewellery only when EquipSlot > 11). Each layer places by its OWN
  baked offset minus paperDollOrigin (200,8); TEXTURE.237 records
  52/54 carry DFU's known-bad-offset fix (237,43).
- ITEM IMAGES (GetItemImage forPaperDoll + GetInventoryTexture*):
  clothing = template archive + bodyMorphology (Human +2, Breton
  INTERIM) with cloaks +1 past their interior record; armor =
  firstMale/FemaleArchive (249/245) + morphology with the
  SetVariant MATERIAL-FAMILY CLAMPS (cuirass leather 0 / chain 4 /
  plate 1..3; greaves 0..1/6/2..5; pauldrons 0/4/1..3; gauntlets
  0/1; boots 0/1..2); weapons = the template archive, an
  Either-hand weapon worn RIGHT draws record+1; masks removed
  (ChangeMask 0xFF -> transparent).
- DYES through the C5b tables (ChangeDye): clothing on the 0x60
  band (item.dye, Blue identity default - stock dye variety
  FLAGGED); weapons/armor on the 0x70 band by material
  (GetWeapon/GetArmorDyeColor; leather + chain fall to the identity
  None table).
- THE CLICK MASK (GetEquipIndex): blitted item layers walked
  BACKWARDS, first non-transparent pixel wins its slot. REMOVE mode
  clicks the doll to unequip; INFO pops the item panel.
- LIVE EQUIP: equip-mode list clicks run EquipItem (swap-outs
  reappear in the lists), equip-mode REMOTE clicks transfer AND
  equip (TransferItem equip true), every change recomposes.
FLAGGED loud: the FP-weapon rig binding (the worn RightHand weapon
should drive weaponRig - U8h), light-source Use, stock clothing
dye variety, armor values on the doll (RefreshArmourValues), the
other 7 races/genders (chargen).

Probed live (tools/equipProbe.mjs) + EYEBALLED: the avatar WEARING
the iron plate cuirass with the longsword at his hip and red-dyed
pants (all three left their list rows), then the REMOVE doll-click
stripping exactly the cuirass. Suite 465/104.

## U8h: the worn-weapon FP binding + armor values (2026-08-17)

The equip system grows its TEETH - wearing gear now changes combat.
- THE FP BINDING: both exterior hosts assign
  weaponRig.playerWeapon.weapon = equip.slots[RightHand] ?? null
  every frame - the rig swings the WORN weapon's art and formulas;
  bare hands take the unarmed hand-to-hand path (weaponTypeForItem
  null -> Melee, the C8 formulas' !weapon branch). The C8 INTERIM
  Iron Dagger moved INTO the bag as seedStartingEquipment (equipped
  at boot, idempotent, skips probe-seeded bags; chargen's starting
  gear roll replaces it). The dungeon host keeps its interim weapon
  until its inventory mounts (FLAGGED).
- ARMOR VALUES (UpdateEquippedArmorValues verbatim): the 7-part
  table starts at 100 each (CharacterDocument - no armor); armor
  subtracts GetMaterialArmorValue()*5 on its body part (leather 3,
  chain 6, plate iron 7 .. daedric 21); shields subtract
  GetShieldArmorValue()*5 (1/2/3/4) on their protected parts
  MATERIAL-BLIND (buckler arm+hands; round/kite +legs; tower
  +head); unequip adds back; DFU's clothing branch is a value-0
  no-op and is omitted. calculateSuccessfulHit consumes
  armorValues[struckBodyPart] directly - THE PARITY CHANGE, loud:
  the player entity now carries the verbatim 100-per-part table, so
  an UNARMORED player is far easier to hit than under the old
  armor:0 scalar (the classic law - armor IS the defense). The doll
  shows (100-av)/5 per part at the verbatim armourLabelPos
  ((70,12),(20,38),(86,38),(12,58),(6,90),(18,120),(22,168));
  drained/increased label colors pend their effect channels.

Probed (tools/equipProbe.mjs extended) + EYEBALLED: "7" engraved at
the chest of the iron-cuirassed doll with zeros elsewhere, and the
FP view drawing the LONGSWORD blade after Z - the worn weapon, not
the old interim dagger (the probe clears the boot seed so the
loadout is the whole story). Suite 467/104.

## AUDIT 17e Wave 1: high-impact parity across the U8 arc (2026-08-18)

The comprehensive pass's second wave - ten confirmed parity defects,
each cited and pinned.
- F8 THE PAPERDOLL CLICK WAS INVERTED: PaperDoll_OnMouseClick
  (DaggerfallInventoryWindow.cs:1932-1952) unequips in EQUIP and
  Select, uses in Use, reads in Info - REMOVE has NO branch and is
  INERT. U8g shipped it on Remove, and its probe asserted the
  inversion, so the bug had a green test AND a green probe. The probe
  now asserts BOTH halves (a Remove-mode doll click changes nothing;
  an Equip-mode click strips the piece).
- F9 THE LISTS DREW WORLD SPRITES: GetItemImage draws the PLAYER
  (inventory) texture for everything except UselessItems1 /
  ingredients / arrows / ReligiousItems / MiscItems
  (DaggerfallUnityItem.UseWorldTexture:1830-1855) - 111 of 288
  templates differ. The port only HAD the world texture because
  systems/itemTemplatesData.js was a LOSSY second copy of
  characters/itemTemplates.json. The two were verified identical
  field-for-field, the copy was deleted, and systems/itemTemplates.js
  now reads the verbatim DFU row - which also brings variants,
  drawOrder and enchantment points into the one place. inventoryItemImage
  ports GetInventoryTextureArchive/Record incl. the Katana +1 bump
  and the cloak interior-first record.
- F10 CLOTHING GAVE NO ARMOR: UpdateEquippedArmorValues admits Armor
  AND the FOOTWEAR window of each clothing group (Mens 147..149,
  Womens 186..188). Leather boots are worth 15 on the Feet part; the
  port granted 0. Sandals (150/189) map to Feet but sit outside DFU's
  GroupIndex window and correctly grant nothing - preserved.
- F11/F18 THE CONVERSATION PANEL: RowSpacing 4 is per LIST ITEM, not
  per wrapped line - rows inside one entry sit 7px apart and only the
  gap BETWEEN entries adds 4 (the port applied 11px to every wrapped
  line AND pushed a blank row, doubling the gaps). Colours were one
  flat ANSWER yellow; DFU uses the ListBox default, the question
  colour on question rows, and white on the NEWEST row.
- F12 OKAY CLOSED THE WINDOW: DFU's Okay is the ASK button. Goodbye
  is the only close; Okay is a consumed no-op until the topic
  highlight lands (FLAGGED).
- F13 THE QUESTION WAS AN ENGLISH LITERAL: it is TEXT.RSC
  7225 + toneIndex (TalkManager.cs:1324), with %1com expanding
  through GetPCGreetingOrFollowUpText (:1149-1156) - the FIRST
  question opens with a greeting (7215 + tone), later ones with a
  follow-up (7218 + tone), and the NPC name is "friend"/"stranger"
  (7221 + tone) at reaction <= 0. The tone flavour is real classic
  text: Blunt asks "Where the hell is %key?". DFU also pushes the
  question/answer PAIR into the conversation - the port only ever
  showed the question in the player-says panel.
- F14 ARROWS: CreateWeapon's arrow branch takes NO material roll, so
  a shelf arrow is worth its basePrice (the port multiplied it by
  material, and stocked a hardcoded stack of 1 where DFU stocks
  1..20). loot.js already had this right - a second divergent copy of
  one special case.
- F15 SCROLL INDICES NEVER RE-CLAMPED: equipping, dropping or selling
  under a scrolled list stranded the rest off-screen. Ported as
  ItemListScroller's delayScrollUp semantics - correct ONLY once the
  index runs past the end, which leaves the partly-filled column
  classic keeps (a plain clamp would over-correct).
- F16 refreshPaperDoll DROPPED concurrent requests (ASYNC NEVER
  DROPS): now coalesced.
- F17 THE FOURTH HOST: the worn-weapon bind moved INTO createWeaponRig,
  so the interior host (which owns its own rig and kept swinging the
  interim dagger inside every building) and the dungeon inherit it.
  The dungeon's own inventory now equips through the real table
  instead of assigning the rig's weapon directly - one equip model in
  every host. ?weapon=bow opts out via bindWorn:false.
- F25/F26 CELL LAYOUT: stack labels are Right/Bottom aligned inside
  the 2px margin with NO shadow in the tooltip colour (230,230,200)
  (ItemListScroller.cs:360-365) - the port drew them top-left,
  shadowed, in gold; and ScaleToFit fits the button's INTERIOR
  (46x34 after itemButtonMargin 2), so icons drew ~9% oversized.
- F32/F33 ONE DFU MEMBER, ONE EXPORT: systems/armorMaterials.js now
  owns ArmorMaterialTypes, GetMaterialArmorValue, the shield tables,
  BodyParts and SetVariant's clamps. systems/equip.js and
  ui/paperDoll.js each carried a copy, and both had invented
  Chain2 = 0x0101 where DFU has 0x0103 (so a Chain2 piece would take
  the PLATE variant clamp and a plate armor value). Latent until
  classic-save import, fixed now.

Probed + EYEBALLED: the item lists now draw real INVENTORY sprites -
the dagger with its golden hilt instead of the world drop sprite -
and the equip probe drives the corrected doll-click law end to end.
Suite 477/105.

## AUDIT 17e Wave 2: the leaks, the origin, and the remaining parity (2026-08-18)

- F19 THE CLIPPED TOPIC ROW: DFU's PixelWise ListBox DRAWS the
  partially clipped last row (104/7 = 14.857 -> 15) and its hit test
  selects it. The port drew floor() = 14 while the click rect already
  admitted row 14 - clicking the bottom band selected a row that was
  never rendered. Fixed the DRAW, not the click.
- F20 THE WHERE-IS CATEGORY LIST: CheckBuildingTypeInSkipList
  (TalkManager.cs:2919-2938) drops Palaces, Furniture stores, all six
  house types, HouseForSale, Ship, Town4/23 and the Specials - the
  port offered Palaces and Furniture stores. The list is now built in
  BUILDING_TYPES enum order (DFU walks the enum) with the three
  paraphrased captions corrected (Armorers / Bookstores / Local
  temples).
- F22 COURT REPUTATION, BOTH WAYS: banishment does NOT call
  RaiseReputationForDoingSentence (DaggerfallCourtWindow.cs:263-278)
  and the port did; a successful not-guilty defense DOES (:426) and
  the port did not. DFU's own comment notes classic repairs nothing
  there - we port DFU.
- F23 THE FLOATING ORIGIN LEFT THINGS BEHIND: the ?world recenter
  shifted the camera and player only, so live guards, corpse
  billboards, corpse-loot AABBs and dropped piles stranded 819.2
  units away on every crossing. Live guards rebuild their billboards
  per frame (shifting ai.feet is enough); the PERSISTENT corpse and
  pile batches bake their centers into a STATIC_DRAW buffer, so they
  are REBUILT at the new origin rather than mutated. Pile keys became
  STABLE IDS in the same pass - an index-based key would rebind to a
  different pile after releaseEmptied splices.
- F24 THE MISSING FOV GATE: WeaponManager's melee requires the target
  inside the CAMERA VIEW; the dungeon host had the test inline while
  both exterior hosts passed null and cityGuards defaulted to ACCEPT,
  so a guard standing behind the player could be hit. Extracted to
  player/cameraView.js and passed by both hosts.
- F27/F28/F29 THREE GL LEAKS (EVERY ALLOCATION HAS AN OWNER): the
  paperdoll minted a new versioned texture per refresh and never
  freed the old one (~81 KB per equip click); emptied dropped piles
  kept their billboard batch forever - now freed at WINDOW CLOSE, as
  DFU's RemoveLootContainer fires there and NOT on the empty
  transition (a pile refilled before closing must keep its flat, or
  lootTargets - which gates only on items.length - would offer an
  invisible activatable ghost); and the dungeon never freed its
  per-foe, corpse or missile batches, leaking a VAO + buffers per
  sprite on every enter/exit cycle. renderer.releaseTexture is new.
- F30 CARRIED WEIGHT: the char sheet re-implemented it from the raw
  template baseWeight, ignoring the MATERIAL weight rule
  systems/inventory.js already ports - a daedric warhammer weighed
  its iron base. Now the single-sourced itemWeight plus the gold term.
- F37 THE FRAME COUNTER RAN BACKWARDS: the exterior host ASSIGNED
  window.__frame from its own counter where the world host
  increments, undoing worldModes' modal-frame increments - probes
  frame-syncing across an overlay could stall. Probe-only.
- F41 F5 RELOADED THE PAGE INSIDE BUILDINGS: the mode gate skipped
  the handler AND its preventDefault, so F5 in an interior destroyed
  the session. preventDefault now runs in every mode; routing F5/F6
  into interiors stays its own arc (FLAGGED).

Suite 480/105.

## AUDIT 17e Wave 3: duplicates, vacuous pins, stale flags (2026-08-18)

The cheap half of the pass - no behaviour changes except where a
duplicate had drifted, but this is the wave that keeps the bible
honest.
- F34 ONE DFU MEMBER, ONE EXPORT: droppedLoot.js re-declared
  randomTreasureArchive + randomTreasureIconIndices, regressing the
  single-sourcing the 2026-07-06b audit had already done in
  systems/loot.js. Now imported and re-exported.
- F35 A PIN MUST FAIL: equip.test.js asserted `bows >= 8`, a
  one-sided inequality that survives promoting ANY weapon to
  two-handed (mutation-proven with Mace). The whole 18-row
  GetItemHands table is pinned instead.
- F36 A PIN MUST FAIL: the "(100-av)/5 display law" was pinned by
  `Math.trunc((100-55)/5) === 9` - literal arithmetic touching no
  port code, with a stale 55 besides. The law is now an exported
  armorLabelValue pinned against LIVE armor values, and DFU's
  armorMod term is flagged where it belongs.
- F38/F39 RETIRING A FLAG DELETES THE SENTENCE: both exterior hosts
  still carried "this host has no HUD-text layer yet" three lines
  above the T3b wiring that gave them one, and nativeInventory's
  header still called Equip and equip-after-transfer FLAGGED after
  U8g shipped both. The open-flags list is grep-regenerated, so it
  had been re-publishing all three as live work. Corrected, with what
  is genuinely still open (interior HUD text; Use mode; wagon/gold)
  left standing.
- F40 the pool-exhaustion comment claimed DFU keeps the block's
  placeholder data; DFU copies a ZEROED pool item. Doc-corrected but
  deliberately NOT implemented: the branch is unreachable on classic
  data (39256 draws against 39256 entries across all 15251
  locations) and DFU only reaches it through WorldDataReplacement,
  which this port omits - implementing it would be untestable dead
  code.

DEFERRED with reasons recorded (see Home Open flags): the paperdoll
MASK pass (F31 - DFU's shader erases layers beneath a masked item, so
a helm cuts out the hair; the port only skips the item's own masked
pixels. The obvious fix - writing transparent black - is WRONG for
this architecture because the SCBG is baked into the same buffer, so
it needs either an SCBG restore or a layering restructure; measured
divergence is 6-89 px per item, cosmetic); and Chain2
reachability (the constant is fixed, but nothing mints 0x0103 until
classic-save import exists). The KRAVE01.HS2 Order-of-the-Raven
override (F21) SHIPPED in AUDIT 18 - otherNames needed no threading,
it was already on dfBlock.rmbBlock.fldHeader.

All four native-window probes re-run green. Suite 480/105.

## S3c/U9: CHARGEN - identity, all eight races, and the fourth host (2026-08-18)

The loudest INTERIM in the tree retires: the player is no longer a
Breton male face 0 with flat skills.

FIRST, per the audit's ONE DFU MEMBER ONE EXPORT rule, the tree was
grepped before anything was ported - and most of chargen ALREADY
existed. systems/chargen.js held the verbatim S3 rolling laws
(StatsRollout/SkillsRollout pools, hit points, spell points,
starting spells) and ui/chargen.js held the ChargenFlow with the
pool-distribution rules. What was actually missing was identity, the
other seven races, and three of the four hosts. Nothing was rebuilt.

- systems/races.js: DFU RaceTemplate (RaceTemplate.cs:172-345) for
  all EIGHT races. The art tables are GENERATED from the regular
  scheme (background SCBG0nI0, male BODY0nI0/I1, female BODY1nI0/I1,
  heads FACE0nI0/FACE1nI0) because the Races ENUM is 1-based while
  the art index is 0-based - exactly the off-by-one that makes
  hand-typed tables drift - and pinned against the DFU literals.
  Each FACE CIF carries 10 heads (verified against shipping ARENA2).
- THE PAPERDOLL IS IDENTITY-DRIVEN: it carried a Breton-only table
  and hardcoded the Human body morphology. It now loads the entity's
  race/gender/face and RELOADS when that identity changes (chargen
  picks after boot, so the old bare `if (_art) return` guard would
  have frozen the doll on Breton forever). Clothing, armor and cloak
  archives all take the race's morphology (Argonian 0 / Elf 1 /
  Human 2 / Khajiit 3) instead of assuming Human.
- THE FLOW GAINS RACE + FACE between name and gender/class, in
  classic's order. result() carries race/raceId/faceIndex,
  applyCharacter writes them onto the entity, and the save envelope
  carries them.
- THE FOURTH HOST (the four hosts rule, the audit's own): chargen
  ran ONLY in dungeonContext, so booting straight into a town left
  the player on the pre-chargen INTERIM entity - flat skills 30,
  maxHealth 50 - for the entire session. systems/chargenSession.js
  now owns the career load, the overlay-shaped window (translating
  raw key codes through the SHARED overlayAction table, not a second
  copy) and the finish; both exterior hosts mount it at boot, and
  the dungeon was repointed at the same loader.

Probed live in the EXTERIOR host (tools/chargenProbe.mjs) +
EYEBALLED: the flow drove name -> race -> gender -> face -> class ->
stats -> skills to a finished Khajiit FEMALE face 3 Mage with rolled
maxHealth 31 and a real skills array, and F6 then drew the paperdoll
as a female Khajiit - the striped facial markings and the female
body, entirely different art from the Breton male the port had shown
since U8f.

STILL FLAGGED: the classic chargen ART (the flow draws clean text
panels; the portrait/biography/reflex screens ride the chargen-art
slice), the biography questions, reflexes, and DFU's
starting-equipment roll (seedStartingEquipment's interim dagger
stands in).

Suite 482/106.

## S3d: STARTING EQUIPMENT (2026-08-18)

AssignStartingGear (ItemHelper.cs:1277-1364) verbatim - the INTERIM
iron dagger retires and a new character begins dressed, armed and
funded, which closes the loop chargen -> identity -> gear -> equip
table -> paperdoll art.
- CLOTHES are gender-specific and WORN: men Short_shirt (165) +
  Casual_pants (151), women Short_shirt_closed (206) + Casual_pants
  (190). The shirt takes a RandomClothingDye from the 10-entry
  table, the pants a random variant, and both go through EquipItem.
- a SPELLBOOK for every player, carried not worn.
- the CLASS WEAPON from StartingWeaponTypesByClass with its
  iron/steel choice (the Mage's shortsword is STEEL; the Monk gets a
  staff; the Warrior an iron broadsword). A CUSTOM class gets an
  iron Longsword instead.
- the ARCHER alone also gets a steel Battle Axe and 24 iron arrows -
  proven archer-only against the Ranger, who carries a battle axe as
  its class weapon but no bow and no arrows.
- +100 gold as a Currency stack.
- torches/candles ride DFU's PlayerTorchFromItems SETTING, which is
  a DFU enhancement rather than classic - ported but defaulted OFF,
  the same stance the 17e audit took on the enhanced 16-slot list.
- every minted item carries a NAME and a VALUE (the 17e F2 root fix:
  an item reaching the shop without a value priced at 1, which was
  half of an unbounded gold loop).
- THE SEED ORDER: the interim dagger seed is now the FALLBACK only.
  A character who runs chargen gets the real kit, and finishChargen
  clears the bag/equip table first so a host that seeded at boot
  cannot leave a stray dagger behind. The dungeon's headless
  fallback path gets the real kit too.

Probed + EYEBALLED: the Khajiit female Mage from the S3c probe now
begins with a shirt, pants, spellbook, steel shortsword and 100
gold, and her paperdoll draws her DRESSED - real classic shirt and
trouser art, the censor welds gone because actual clothing covers
chest and legs. Suite 488/107.

## AUDIT 17f: the parity pass over the audit's own changes (2026-08-18)

Mac: "lets first do a comprehensive audit on changes so far and parity
pass" - the same request that produced 17e, now aimed at what 17e
itself (Waves 0-3) plus S3c/U9 and S3d shipped. Read by hand against
DFU source rather than fanned out; the surface is one arc wide, and
the interesting findings are the ones a wave INTRODUCED while fixing
something else. Sixteen confirmed, all in this slice. The full ledger
lives in `bible/Home.md` under Audits - the parts that belong to this
arc:

**The item lists never got SetRace.** 17e F9's whole point was that
the lists must draw the PLAYER texture, not the world sprite - and it
read that archive straight off the TEMPLATE. In DFU the archive is an
INSTANCE field that `SetRace` offsets by the wearer's body morphology
at creation (ItemBuilder.cs:850-854; armor replaces it outright via
ApplyArmorSettings :466-485), and `GetInventoryTextureArchive`
(DaggerfallUnityItem.cs:1728-1735) returns that offset field. So every
list - inventory, trade, loot - drew clothing off the morphology-0
ARGONIAN row and armor off the men's Argonian archive, whoever was
wearing it. The paperdoll had the law since U8g; the list did not,
which is exactly the split ONE DFU MEMBER, ONE EXPORT exists to catch.
`characters/paperdollArt.js` now owns `playerArchiveFor` and both
windows resolve through it; `makeIconDrawer` takes the wearer.
Eyeballed: a Khajiit female's short shirt is archive 238, not 235.

**The gold stack had no template.** Three producers hand-built it
with no `templateIndex` and two spellings of the name, so it drew NO
icon (there was nothing for GetItemImage's world-texture fallback to
fall back FROM) and weighed nothing through `itemWeight` - which is
why `charsheet.js` carried its own 0.0025 constant. It is
Currency.Gold_pieces (276) now: the classic pile icon at 216/1, the
template weight, one name. A pre-17f save upgrades its stack on
restore, because `stacksWith` compares template index and a legacy
stack would otherwise split off a second pile `goldAmount` never
looks past. Eyeballed: the pile icon draws in Clothing & Misc where a
bare "100" had floated in an empty button.

**The paperdoll leaked on identity change.** 17e F27 gave the
composite an owner; S3c then added the identity-reload path and set
`_live = null` directly, orphaning the texture the refresh would have
freed. Chargen hits it on every race/gender/face change. The same
path advanced `_deps` before the art loaded, so a failed load left a
Khajiit identity addressing Breton bitmaps.

**paperdollArt kept a third copy.** 17e F32 collapsed the armor
material tables out of equip.js and paperDoll.js and stopped one file
short. `characters/paperdollArt.js` still held the SetVariant clamps
keyed by material FAMILY and a second export literally named
`armorArchive` whose second argument was a RACE where the other's was
a MORPHOLOGY. Same member, same name, incompatible arguments. It
wraps the single home now, keeping the C6a signature.

**Chargen: the town path was the poor relation.** A Mage created in a
town got an EMPTY spellbook (the exterior hosts called `finishChargen`
with no spell table; only the dungeon host loaded SPELLS.STD), the
`?class=N` headless skip minted an empty bag (S3d landed the kit on
two of three creation paths), and the exterior hosts PARSED `?class`
for the dungeon they might build while ignoring it for their own
chargen - which is why S3c's chargen-on-boot silently wedged the
U8d/U8e/U8g probes and no gate noticed. `loadSpellIndex` and
`applyHeadlessChargen` join `loadCareers`/`finishChargen` as shared
session members; dungeonContext, which had re-grown a hand-inlined
copy of finishChargen one slice after it was extracted, calls the
shared one. `createChargenWindow`'s doc promised onDone fires once and
the code fired it on every key after done, each re-running
applyCharacter and re-rolling the kit.

**AssignStartingGear, three drifted details.** The Spellbook is added
FIRST (ItemHelper.cs:1300-1306) and `AddPosition.Back` makes
collection order the DRAW order, so the port's bag led with the
shirt; the pants variant was hardcoded to 4, the MEN'S count, where
women's Casual pants (190) has FIVE, so a woman could never roll her
last variant; and the names were lower-cased hand copies of
`ItemTemplate.name`. Clothes are equipped where DFU equips them, ahead
of the weapon.

**Checked and CLEARED** - recorded because it reads like a bug: 17e
F15's `safeScrollIndex` only re-clamps when the index is past the end,
which looks like a missing clamp against `GetSafeScrollIndex`. It is
not. That function has two branches, and the port implements the
`delayScrollUp = TRUE` one - which is precisely the branch the `Items`
SETTER takes (ItemListScroller.cs:181), and the setter is what a
refilter runs. The tight clamp belongs to the scrollbar and
mouse-leave paths, which we raise no event for. The partly-filled
column really is classic.

**FLAGGED, not fixed** (reasons at the sites): gold as a bag stack at
all - classic keeps `playerEntity.GoldPieces` as a counter that never
appears in a list, and retiring the port's S2 shape touches
goldAmount, trade and loot; a REMOTE list drawing its clothing on the
PLAYER's morphology, because shop stock carries no owner identity;
quicksave still living only in the dungeon host.

Pins: `test/audit17f.test.js`, ten tests, each mutation-proven.
Probes: the chargen probe now asserts bag ORDER, template names, the
starting spellbook and the wearer-addressed icon archive; the equip
probe clears the derived tables instead of unhooking "the interim
dagger" by hand; all three exterior probes take the `?class=16` skip.

## U10: CHARGEN ART - the classic screens + the portrait (2026-08-18)

Mac: chargen art next. The U2b flow has drawn on clean text panels
since it shipped, with the background art FLAGGED pending name
verification against real ARENA2 - and S3c's face picker chose a face
index BLIND, with the text panel apologising for it in so many words.
This retires both.

`src/ui/chargenArt.js` draws all seven screens on the U8a native
panel, every rect and colour citing its DFU line (THE NATIVE-WINDOW
RULE):

- **name** CHAR00I0.IMG, the text box at (80,5) 214x7 in
  DaggerfallDefaultInputTextColor, OK at (263,172,39,22)
  (CreateCharNameSelect.cs:26,73-85).
- **race** TMAP00I0.IMG, the province map, with the verbatim prompt
  centred at y=16 - and the PROVINCE CLICK is live: TAMRIEL2.IMG is
  never drawn, its palette INDEX at the click point IS the race id,
  because RaceTemplate.GetRaceDictionary keys on ID
  (CreateCharRaceSelect.cs:30-31,93-102). Probed: a click on
  Hammerfell lands on Redguard with no key pressed.
- **gender** the verbatim TEXT.RSC 2200 prompt over the same map.
  FLAGGED: DFU's is a DaggerfallMessageBox and the port has no
  message-box FRAME art, so a plain panel stands behind it.
- **face** CHAR01I0.IMG and THE PORTRAIT - FacePicker's 64x40 display
  panel at (247,25) with the head centred/middle inside it, PREVIOUS
  (245,69,42,9) and NEXT (287,69,26,9) (FacePicker.cs:55-68). The ten
  head records come from the race/gender FACE CIF, and the load
  COALESCES rather than dropping when the identity changes mid-flight.
- **class** PICK00I0.IMG centred/middle, the nine-row list at (26,27)
  138x72 with rowSpacing 1 (ListBox.cs:36-37) and the selected row in
  DaggerfallDefaultSelectedTextColor - over a SCREEN DIM, because the
  list picker is the one chargen screen that is a popup rather than a
  full-panel window.
- **stats** CHAR02I0.IMG + StatsRollout: value panels at (8,33) 34x6
  stepping 22 with CENTRED labels, green when raised above the roll,
  the UpDownSpinner (CHAR02I1.IMG) riding the selected row and
  carrying the bonus pool, the seven derived labels at their verbatim
  positions, REROLL and OK.
- **skills** CHAR03I0.IMG + SkillsRollout: three groups at y 32 / 81 /
  130, labels at x=68, values at x=187, rows 10 apart, the
  LeftRightSpinner (CHAR03I1.IMG) on the cursor row carrying that
  GROUP's pool.

Clicks land on DFU's own buttons through the shared overlay pointer
seam (the U8b law - taps and clicks ride one path), and the whole
keyboard flow is untouched, so the phone, the probe and the mouse all
drive the same window.

**Three things this slice found on the way.**

**Solid quads never blended.** `drawScreenQuad` wrote a solid colour's
alpha straight out with GL blending OFF, so every translucent UI panel
in the port drew OPAQUE - DaggerfallUI.ScreenDimColor (0,0,0,0.5)
BLACKED OUT the screen behind a modal window instead of dimming it,
and the same went for the talk, rest, action-text and char-sheet
backdrops. SIXTEEN call sites had been authoring alpha that never
applied. Blending is enabled for untextured quads with alpha < 1;
textured quads keep their existing discard law, so no art path
changes. Eyeballed on the class picker and the talk window.

**The port printed enum keys where classic prints names.** The skills
screen was the first window to show a skill list at chargen scale and
it read "ShortBlade" and "BluntWeapon". `TextProvider.GetSkillName`
returns "Short Blade" and "Blunt Weapon" (Internal_Strings.csv:380-
400,498), and the char sheet had been printing the raw keys too since
U8a. `SKILL_KEYS` is now the code identity and `SKILL_NAMES` is what a
window prints.

**The derived stats had no home.** Drawing CHAR02I0's right column
needed all seven of FormulaHelper's derived values, and the port had
them scattered - MaxEncumbrance inline in charsheet.js, MagicResist
inline in spellcast.js, HealingRateModifier in rest.js, SpellPoints in
chargen.js - with ToHitModifier and HitPointsModifier missing
entirely. They live in `combat/formulas.js` beside DamageModifier now,
and the old sites import them.

**And three more wedged probes.** AUDIT 17f found that S3c's
chargen-on-boot silently wedged three probes; it wedged SIX. The char
sheet, talk and trade probes take the `?class=16` skip too now. The
trade probe additionally hand-built a Currency literal with no
template index, which stopped MERGING with the starting kit's stack
once 17f gave gold its template - it sat behind it as a second pile
`goldAmount` never reached and the buy was refused for lack of funds.
It adds gold through the real producer now (TEST THE SHAPE THE
PRODUCER MINTS).

Pins: `test/chargenart.test.js`, seven tests, each mutation-proven.
Probed + eyeballed, every screen: "Name thyself" with the OK button,
the Empire of Tamriel map with the verbatim prompt, "Choose thy face"
with a Khajiit female portrait in the picker frame, the class scroll
over a real dim, "Add bonus points" with all eight stats and the
derived block, and the three skill groups with "Short Blade" and the
spinner sitting between its arrows.

FLAGGED, not done: the DaggerfallMessageBox frame (which the gender
screen and the race DESCRIPTION box both want), biography questions,
reflexes, and the custom-class path - none of which the flow has
states for yet.

## U11: THE PARCHMENT MESSAGE BOX (2026-08-18)

The last plain panel in an otherwise native chargen. DFU's
`DaggerfallMessageBox` is the frame behind every popup in the game
and the port had never had it: U6's action boxes, U10's gender screen
and the race description all drew on a flat colour rect.

`src/ui/messageBox.js` ports it whole, every law citing its DFU line:

- **the frame** is a NINE-SLICE over SPOP.RCI
  (DaggerfallUI.cs:48,905-949): records 0-8 are topLeft, top,
  topRight, left, fill, right, bottomLeft, bottom, bottomRight, all
  22x22 in the shipping data - which is WHY the box rounds its size
  to a multiple of 22. Corners draw once, edges and fill tile
  (Panel.cs:243-330), here an exact integer repeat.
- **the sizing law** (UpdatePanelSizes, :506-570): margins 10;
  width = max(button strip, text) + both margins, floored at
  minBoxWidth 132; height = label block + both margins; each rounded
  UP to a slice, or 44 if under 44. Adding buttons grows the label
  block ONCE by the button height + buttonTextDistance 4 - the
  `finalSize.y - buttonPanel.Size.y > 0` gate passes only on the
  first button, so one button and four cost the same height.
- **the buttons** are BUTTONS.RCI records INDEXED BY THE ENUM VALUE
  (:67-90, :369-371), 32x16, laid left to right with buttonSpacing
  32, the strip centred, and the verbatim single-button HACK that
  drops a lone button 11px lower "so that it aligns like two or more
  buttons".

**One deliberate departure, flagged at the site.** DFU computes the
button Y from `messagePanel.Size.y` - which at that moment still holds
the height from the PREVIOUS UpdatePanelSizes call, the panel being
resized three lines later. The strip lands 6px above the last text
row even though the label block reserved exactly stripH + 4 beneath
it. Eyeballed on the Redguard description, whose final line is long
and centred: "Is your [YES]ter to [NO]Redguard?". The reservation is
plainly the intent - 4px under the text is where 16px of button
exactly fills it - so the port clamps the strip to that and never
lets it ride higher. Nothing else in the file departs.

**The TEXT.RSC bug this uncovered.** The race description came back as
one run-on line with words fused across the breaks - "Hammerfell.You
are part of". `plainText` broke only on NewLine (0x00) and dropped
JustifyLeft (0xFC) and JustifyCenter (0xFD) as "every other control
byte". In DFU all three call `NewLine()`
(MultiFormatTextLabel.cs:333-345); JustifyCenter additionally centres
the row it just closed. Most centred records lay their text out with
0xFD, so **every one of them had been rendering as a single fused
line** everywhere the port shows TEXT.RSC. Fixed, with a new
`linesById` returning rows WITH their per-row alignment. The old pin
asserted "justify drops" - it was pinning the bug.

**Wired:** the chargen gender screen (TEXT.RSC 2200 with Male/Female),
the race confirm box (the template's DescriptionID with Yes/No -
Yes accepts and moves on, No returns to the map, and the box is MODAL
over both the map's clicks and its keys), and U6's ActionTextBox and
ActionInputBox. The race table gained `descriptionId` and `clipId`
(RaceTemplate.cs:177-332; note the ids are NOT in enum order - Nord is
2000, Breton 2003). Warmed in all three chargen hosts; worldModes
hosts no popup (its `say` goes to the console, already flagged).

Pins: `test/messagebox.test.js`, six tests, and the corrected
`textrsc` pins - each mutation-proven.
Probed + eyeballed: the gender box on the province map with real MALE
and FEMALE buttons, and the Redguard description reading as seven
proper lines with YES and NO clear beneath it.

FLAGGED, not done: the scrolling variant (a label past MaxTextHeight
gets a scroll bar and clipped rendering, :571-590) - nothing in the
port yet feeds a box more text than fits.

## AUDIT 17g: the deep parity pass over U10 + U11 (2026-08-18)

Mac asked for a deep audit of the two slices just shipped. Read by
hand against DFU source. Six confirmed; the full ledger is in
`bible/Home.md` under Audits, and the parts that belong to this arc:

**The wiring that read right and did nothing.** U11's
`preloadMessageBoxArt` landed inside `dungeonContext.toggleCharSheet()`
- the comment beside it said "for the action boxes" - so a dungeon
trigger popping a ShowText box drew the FLAT fallback unless the
player had pressed F5 earlier in the session. It warms at scene boot
now, beside the TEXT.RSC load whose records it frames. Exactly the
shape of 17e's silently-no-op'd `releaseEmptied`: a line that reads
correct, sits in the wrong scope, and fails without a sound.

**The box centred every row.** `MultiFormatTextLabel` sets
HorizontalAlignment.Center on the rows a JustifyCenter closed and
leaves the rest LEFT (:341-344). U11's own `linesById` carries that
flag and `drawMessageBox` discarded it. Counted over the shipping
TEXT.RSC: of 676 multi-row records, 596 are all-centre - which is
precisely why the race descriptions looked right and hid this - but
**53 are entirely left and 27 mix the two**. Rows flow as
{ text, center } now; a plain string still centres, which is what the
gender prompt (composed in code, not read from a record) wants.

**The class list jumped.** `ListBox` scrolls minimally on a selection
move: `SelectPrevious` pulls the window up only when the selection
falls above it, `SelectNext` pushes it down only when it falls below
(:709-730). U10 recomputed a CENTRED window at draw time, so the whole
list lurched on every arrow and the selection could never sit anywhere
but the middle. The scroll index is the list's own state now, moved by
the verbatim rule, and a click on a row selects it as DFU's list does.

**Three smaller ones.** `chargenHit`'s `class` case derefed the art
directly where every other case returns null, so the ONE state that
needs the art was the one that threw. `ActionInputBox` re-laid its box
out from its own live entry every frame, so the parchment gained a
whole 22px slice mid-word - `layoutMessageBox` takes `sizingRows` and
measures the field at its maximum (maxCharacters 20). And a keyboard
confirm on the race screen walked straight past the description box a
click always opened; DFU has no keyboard path there at all, so both
route through the same box now, with an art-less flow pinned never to
trap.

**Checked and CLEARED**, recorded because both looked like findings:
the ten FACE textures per identity are not a leak - `uploadTexture`
memoises by key, so they are bounded (160 worst case) and shared
exactly like archive art. And the U11 TEXT.RSC line-break fix has no
live regression despite changing 714 of 1408 records: every record the
port currently draws through a single-string path (greetings, tones,
where-is answers, palace names) is single-row, and `drawText` renders
a stray control byte as a blank advance rather than a glyph.

**FLAGGED, not fixed:** the class picker's scrollbar THUMB. The
geometry is verbatim and simple (height = rail x displayed/total,
floored at 10; y = scroll x (rail - height) / (total - displayed)) but
the thumb is three texture slices this port has not identified, and
inventing a colour would break the NATIVE-WINDOW RULE.

Pins: `test/audit17g.test.js`, six tests, each mutation-proven.
Probed: all seven exterior probes green, and the keyboard confirm
opens the Khajiit description at 9 rows live.

## S3e/U12: THE BIOGRAPHY QUESTIONS (2026-08-18)

The chargen screen classic players actually remember, and the one that
makes two characters of the same class play differently. Twelve
questions per class, each answer carrying a list of EFFECTS.

**`src/formats/biogFile.js`** ports BiogFile's StringReader walk
(BiogFile.cs:44-146): blank lines skipped between questions, a
question's first line leading with `N.` and its text being everything
after the FIRST dot, an optional second line, then answers while the
line has `.` at index 1 and starts with a LETTER, each followed by its
effect lines. One trap worth naming: C#'s `Split('.', 2)` keeps the
REMAINDER in the last element where JavaScript's limit argument
DISCARDS it, so a naive port loses everything after a second dot -
"What is it, Mr. Smith?" would come back as "What is it, Mr". Two of
DFU's rules are defensive and unreachable in the shipping data and are
ported but deliberately NOT pinned; the corpus gate is the proof.

**`src/systems/biography.js`** ports ApplyPlayerEffect (:248-445) -
the whole grammar, counted over all 18 shipping files: 692 skill
lines, 589 text tokens, 420 item grants, 136 faction and 111
social-group reputation changes, 84 AF, 55 gold, 38 AE, 18 each of
RP/FT/RD/MR, 14 each of RR/TH, and 12 bare `&` lines. Both gold quirks
are verbatim: "GP + 250" is ONE argument (DFU corrects the spaced
sign), and the player can never carry negative gold. Social reputation
ACCUMULATES while the six single-field mods ASSIGN - a second `RP`
overwrites the first, because every one of those branches reads
`= parseResult`.

**This is not cosmetic.** `biographyReactionMod` and
`sGroupReputations` are already read by `getReactionToPlayer`
(talk.js), so a biography answer changes how townspeople greet you
from the first conversation. Probed live: a walk through all twelve
questions left social reputations at [-5, 0, 5, 5, ...], poison
resistance at -10, and 950 gold instead of the kit's 100.

**Where the effects land.** DFU keeps the answer list on the
CharacterDocument and applies it at StartGameBehaviour.cs:416 - at
GAME START, over the finished character. The port does the same in
`finishChargen`, after `applyCharacter`, so a skill bonus rides on top
of the distributed value instead of being overwritten by the roll. The
SKILLS SCREEN meanwhile DISPLAYS the bonus on top of the working value
(CreateCharAddBonusSkills.cs:67-72) without turning it green, since
that colour compares working against ROLLED and the bonus is not the
player's spend.

**The screen** is BIOG00I0.IMG with the verbatim geometry
(CreateCharBiography.cs:32-42): the two question lines at (30,23)
stepping 11, and TEN answer buttons 149x24 from (10,71) - even indices
in the left column, odd in the right, a row every two - with the
answer label at (21,5) inside its button. Answers past the question's
count leave their buttons BLANK and a click on them is INERT, verbatim.

FLAGGED: `rf` faction reputation queues on the entity for the faction
slice to drain; AE/AF/AO are parsed and logged but NOT applied,
exactly as DFU leaves them (:427-440) - applying a guess would be a
divergence, not a fix; the bare `&` hits DFU's own invalid-command
branch. Also FLAGGED: the port's overall wizard ORDER still differs
from DFU's (we ask the name first and the face early); biography sits
where it does relative to the class choice and the bonus screens,
which is what the effects depend on, but putting the whole wizard on
the classic sequence is its own slice. The backstory TEXT the '#'/'!'
tokens compose, and the reputation-change message box that closes the
screen (reputationToken 35), pend with it.

Pins: `test/biography.test.js`, 16 tests, each mutation-proven, plus a
CORPUS GATE walking all 18 shipping files - twelve full questions each
that fit the ten buttons, and every one of their ~2200 effects a
command we implement bar the twelve `&`.
Probed + eyeballed: the classic BIOGRAPHY screen with "What school of
magic have you been studying the longest?" and its six answers in two
columns, the picked one in the classic dark red.

## U13: REFLEXES + THE BACKSTORY (2026-08-18)

The two pieces S3e left flagged, and the ones that close chargen.

**REFLEXES** (CHAR05I0.IMG + the CHAR05I1.IMG highlight strip). The
info panel at (0,15) carries TEXT.RSC 307 - classic's own explanation
that reflexes set "the overall speed of the game" - and the picker
sits at (127,148): five 66x9 rows stacked, VeryHigh at the top, with
the 66x45 highlight strip banded five ways. DFU draws band
`0.2 * (4 - value)` in Unity's BOTTOM-UP texcoords, which is band
`value` counted from the top; the strip's own baked offset is
(127,148), the picker position exactly.

**This screen was the only missing piece - the mechanics were already
live.** Both consumers have been in the port for slices:
`EnemyAttack`'s melee timer (`+= 450 * (reflexes - 2)`, enemyAttack.js)
and the monster multi-attack gate (`50 - 10 * (reflexes - 2)`,
formulas.js), and both hosts already passed `playerEntity.reflexes`.
They were reading a hardcoded Average because nothing could set it.
Picking Very High now genuinely makes monsters swing sooner and land
fewer of their extra attacks. Probed: the pick reaches the entity.

**THE BACKSTORY.** `GenerateBackstory` (BiogFile.cs:169-232): the
class's TEXT.RSC record (4116 + classIndex) is prose carrying %q1..%q12
and %q1a..%q12a macros, each expanding to the FIRST text line of a
record the player's own answers named. The subtlety worth recording:
both the '#' and the '!' token of a question land in the SAME
per-question list, because `tokenLists` is indexed by the QUESTION and
not by the prefix - so %qN is that list's first entry and %qNa its
second (BiogFileMCP.cs:150-161, :306-317). A question with no token of
that kind expands to NOTHING, which is what leaves the prose reading
cleanly. Live over real data: the Mage backstory is 62 rows, and its
six macros all resolve - "%q1" became "sending sparks of flame and ice
flying around the yard", which is the Destruction answer's own record.

**THE REPUTATION BOX.** The last biography answer composes the
backstory and pops TEXT.RSC 35 in a ClickAnywhereToClose box, its
%r1..%r5 filled from `DigestRepChanges` - the per-group totals the
twelve answers moved. Probed live: "Commoners: -5" over
[-5, 0, 5, 5, 0]. The box is MODAL: any key closes it AND ends the
screen, which is the pin that catches a half-wired dismissal.

Two of DFU's guards here are DEFENSIVE and unreachable, and are ported
WITHOUT pins rather than with fake ones: DigestRepChanges' `rf` arm
(the split never parses a faction id anyway) joins the two BIOG parser
rules S3e already recorded.

Pins: `test/biography.test.js` grows to 21, the five new laws each
mutation-proven.
Probed + eyeballed: the REFLEXES screen with classic's own text and
the highlight band on AVERAGE, and the reputation box carrying the
real deltas.

FLAGGED, still: the custom-class path (CreateCharCustomClass - the
gear law already handles `isCustom`, only the screen is missing) and
the port's overall wizard ORDER, which still asks the name first and
the face early where DFU asks race, gender, class, biography, name,
face. Chargen is otherwise complete.

## AUDIT 17h: the parity pass over S3e + U13 (2026-08-18)

Three findings. The arc-local two, and one that turned out to be
several slices older than the work that exposed it.

**The port had never saved player reputation.** `sGroupReputations`
and `reactionMods` are read by `getReactionToPlayer` on EVERY greeting
and written by the T3f tone tallies, the G2 court sentences and now
the biography - and the quicksave carried neither, nor any of the six
`biography*Mod` fields. DFU writes all of it out field by field
(SerializablePlayer.cs:136-141, :152-162, :305-310). A load reset the
player's standing with every social group to zero.

This gap predates the biography. What S3e changed is that reputation
now matters from the FIRST MINUTE of a new character rather than
accumulating quietly over a session, which is what made a load-wipe
visible enough to find. Persisted now, along with the queued faction
deltas and the composed backstory - and the SNAPSHOT detaches from the
live entity, because the quicksave write happens after
`snapshotPlayer` returns, the same law save.js already stated for its
nested effect entries. A pre-17h save leaves the entity's own state
alone rather than nulling it.

**The dungeon host skipped the biography.** It builds its own
`ChargenFlow` and never received the question sets, so a character
created in a dungeon answered no questions at all. This is the THIRD
time this exact host gap has hit this flow - 17f found it for the
starting spellbook and for the starting kit, and here it is one slice
later for the biography. The lesson is not "remember the dungeon
host". It is that anything the flow needs should be handed to it BY
THE SHARED SESSION, the way `createChargenWindow` takes `biogs`, not
wired per host. The dungeon builds its flow by hand and so keeps
missing each new dependency; folding that construction into
chargenSession is the standing fix, and it is now the obvious next
tidy on this arc.

**The reflex info panel is a parchment popup.**
`CreateCharReflexSelect.cs:60-88` calls `SetDaggerfallPopupStyle` on
it and sizes it to its text plus the margins. U13 drew bare rows over
the province map. U11 already owned that frame - a two-line fix that
should have been the first draft.

**Checked and CLEARED:** the level-up sums anchor before the biography
bonuses in the port, and they do in DFU too (the effects are applied
at game start, after the entity setup that computes the sums). The 18
BIOG files loaded at boot mirror the 18 CLASS files already loaded
beside them, and only when chargen actually runs.

Pins: `test/audit17h.test.js`, four tests, each mutation-proven -
including the greeting compared either side of a save round trip,
which is the assertion that would have caught this years of slices
ago.

## AUDIT 17i: THE ONE CONSTRUCTION SEAM (2026-08-18)

Not a parity slice - a root-cause fix for a bug SHAPE that had
recurred three times.

The dungeon host built its `ChargenFlow` by hand while the exterior
hosts went through `createChargenWindow`. So every dependency the flow
grew had to be remembered twice, and each time it was not:

- 17f: the starting SPELLBOOK (a town-created Mage began with none)
- 17f: the starting KIT (`?class=N` minted an empty bag)
- 17h: the BIOGRAPHY (a dungeon-created character answered no
  questions at all)

Three separate audits, three fixes, one shape. Patching a fourth
instance later is not a plan.

**`createChargenFlow(fetchBytes)`** is now the only place a flow is
built. It loads the careers, SPELLS.STD and the eighteen biography
sets, ATTACHES them, and hands back `{ flow, careers, spellsByIndex,
biogs }`. All three hosts call it; `createChargenWindow` no longer
constructs anything, it WRAPS a flow for the exterior overlay seam.
A dependency added tomorrow is added HERE, once, where no host can
miss it.

**The rule is enforced, not remembered.** `test/chargenseam.test.js`
sweeps `src/scenes` and fails if any host contains
`new ChargenFlow(`. A host that news one up gets whatever
dependencies existed the day it was written and silently misses every
one added since - which is exactly how all three bugs happened. The
companion pin proves the seam attaches everything rather than merely
returning it beside the flow.

Probed: `tools/dungeonChargenProbe.mjs` boots the DUNGEON host with no
`?class` and reads its live flow - 18 careers, 12 biography questions.
The host that kept falling behind is the one the probe watches.

A probe lesson worth keeping: the first draft waited on
`__shotReady`, which never fires while a chargen overlay is up -
the modal pauses the scene before frame 5, correctly. Wait on the
thing the probe is actually about.

## U14: THE MENU BACKDROP + THE POINTER PATH (2026-08-18)

Mac, on seeing chargen run: the true menu backdrop, and the pointer
working rather than the keyboard alone. Both are parity gaps, and
both had the same root - the port grew chargen INSIDE the running
world, where classic runs it from the menu.

**The backdrop.** `DaggerfallBaseWindow.cs:40` paints the parent panel
BLACK behind the 320x200 native panel. Classic never shows the world
around a chargen window because there is no world yet. The port drew
the live town through the letterbox on every screen. Black now, drawn
before the screen - and it is OPAQUE, which the pin states plainly,
because a translucent value would look like a design choice and be
the same bug.

**The class picker sits on the screen it came from.** A
`DaggerfallPopupWindow` is pushed OVER the previous window, which
keeps drawing beneath it - so the list is dimmed over the FACE screen,
not over a bare backdrop. Eyeballed: the Redguard portrait and
PREVIOUS/NEXT show through the dim behind the scroll.

**The pointer.** Three gaps, not one:
- the DUNGEON host had NO pointer path at all. Every click went to
  `requestPointerLock`, so chargen there was keyboard-only while the
  exterior hosts had been clickable since U8b. It has an
  `overlayClick` seam now, taking native coords like townTalk's, and
  an open window withholds the pointer lock instead of grabbing the
  mouse behind itself.
- the GENDER buttons were a selection that then demanded a separate
  confirm. `CreateCharGenderSelect.cs:59-71`: both handlers end in
  `CloseWindow()`. The classic box has no OK for the extra step to
  use, so the button sets AND closes.
- `clickNative` gained a pure `applyHit` half, so the pointer path is
  testable without art the way `chargenHit` already was.

**The guard rail.** A screen that ships keyboard-only is invisible on
a phone, and three of them did. `test/chargenpointer.test.js` walks
every chargen state and requires EVERY one of its own controls to
answer a click - not merely one of them, because a screen whose OK
button works while its controls are dead is still keyboard-only in
practice. That is the pin that would have caught all three.

Probed: `tools/chargenClickProbe.mjs` drives a COMPLETE chargen with
clicks alone - the name OK, a province, the race YES, the gender
button, face NEXT and OK, a class row, twelve biography answers, the
reputation box, the stat spinner, three skill spinners, a reflex row
and the final OK. Only the name's letters are typed, as they are in
classic. Out the other end: a Redguard female with Very High reflexes.

RETIRED by U15: the random-name button is live.

## U15 - THE CLASSIC WIZARD ORDER + THE RANDOM NAME BUTTON (2026-08-18)

The port had invented its own chargen order. DFU's is an enum, and it
is not a suggestion - `DaggerfallStartNewGameWizard.cs:63-79`:

    SelectRace, SelectGender, SelectClassMethod/GenerateClass/
    SelectClassFromList/CustomClassBuilder, SelectBiographyMethod,
    BiographyQuestions, SelectName, SelectFace, AddBonusStats,
    AddBonusSkills, SelectReflexes, Summary

The port asked the NAME first and put the FACE early. `STATES` is now
`race, gender, class, biography, name, face, stats, skills, reflexes`
and every transition and `back` target follows it - the race screen is
first, so its `back` returns rather than moving.

**Why the order is not cosmetic.** Two screens read state that the old
order had not collected yet:

- the FACE screen draws RACE-and-GENDER face art. Running it before
  the race is chosen paints faces from whatever race the flow happened
  to be seeded with. The click probe's `click-face.png` now shows a
  Redguard female head because a Redguard female had already been
  chosen two screens earlier.
- `CreateCharNameSelect.cs:112-119` DISABLES the random-name button
  when `raceTemplate == null`. A name screen that precedes the race
  can only ever draw that button dead. This is what finally forced the
  reorder: the flag U14 left could not be cleared without it.

**The button.** `getNameBank(raceKey)` in `characters/nameHelper.js`
is `MacroHelper.GetNameBank` (`MacroHelper.cs:344-366`) - the eight
player races onto `NameHelper.BankTypes`, with the quirk DFU's own
enum comment spells out: ARGONIAN maps to the IMPERIAL bank, because
"Imperial names appear where one would expect Argonian names"
(`NameHelper.cs:50`). Unknown races fall to Breton, which is the C#
`default` arm sharing the Breton case. The button mints
`fullName(getNameBank(race), gender)` - the same NAMEGEN path the rest
of the port already used for NPCs - and is drawn at
`RECTS.randomName = [279,3,36,10]` on a grey `[0.5,0.5,0.5,0.75]`
backing with the verbatim shadowed label.

**The pin that mattered.** The first draft asserted the button
returned some non-empty string. That passes while wired to the WRONG
bank - a Khajiit handed Breton names is still a name. The pin now
seeds `srand(12345)` and requires the button's output to equal a
direct `fullName(getNameBank(race), gender)` call character for
character, so the bank and the gender are both pinned, not just the
liveness.

Probed: `tools/chargenClickProbe.mjs` walks the new order by clicks
alone and exercises the random button on the way through. Out the
other end, unchanged: a Redguard female with Very High reflexes -
named `Rlillki` by the button, not by the keyboard.

## U17 - THE CLASS PICKER + THE THREE SKILL SPINNERS (2026-08-18)

Mac's report: **double-tapping to select a class does not work.** It
is worse than that - there was no pointer path off the class screen at
all, and the probe had been papering over it with a keyboard press and
a comment admitting why ("no OK button on the picker").

**The list is a ListBox, and a ListBox has two gestures.**
`MouseClick` (`ListBox.cs:500-504`) sets `selectedIndex` and raises
`OnSelectItem` - it SELECTS and nothing more. `MouseDoubleClick`
(`:507-512`) calls `UseSelectedItem`, which is what raises
`OnUseSelectedItem` -> `OnItemPicked`. Return does the same
(`:296-297`). The port had folded both into one click and then wanted
a confirm the picker has no button for.

The double-click window is `doubleClickDelay = 0.3f`
(`BaseScreenComponent.cs:54`), and the test at `:691` is on TIME
ALONE - the second click need not land on the same row, because
`MouseClick` has already moved the selection there by the time
`MouseDoubleClick` reads it. So a fast pair across two rows picks the
second one, verbatim.

**And picking is not choosing.** `DaggerfallClassSelectWindow_OnItemPicked`
(`CreateCharClassSelect.cs:70-96`) opens the class's DESCRIPTION in a
Yes/No box on `TEXT.RSC 2100 + index`, exactly as the race screen does
on its own template id. Yes closes both windows; No drops the
selection and returns to the list. The port had no such box, so it
also never showed the player what the class they were choosing
actually was.

**The three skill spinners.** `SkillsRollout` carries THREE
`LeftRightSpinner`s, not one (`:41-46`, `:240-262`), each with its own
selected skill (`SelectPrimarySkill` and its two siblings, `:356-372`)
and its own `Value` - that group's remaining pool. The port collapsed
the nine rows onto one cursor and drew a single spinner, so two of the
three pools were invisible until the cursor happened to walk into
them. All three draw now, each on its group's own selected row.

The flat cursor survives as the KEYBOARD's walk - classic has no
keyboard on this screen at all - and moving it keeps the group
selection underneath it in step. One consequence worth naming: a walk
necessarily re-selects every row it passes through, where a click
jumps. That is the flat cursor's own artefact, not something DFU has
an opinion about.

Probed: the click walk now selects a row with one tap (and pins that
it does NOT pick), picks it with a double tap, reads the description
box and presses YES - all by pointer. Eyeballed: the Battle Mage
description on the parchment with YES/NO, and the skills screen with
all three spinners showing 6.

## U16 - THE SUMMARY SCREEN (2026-08-18)

`WizardStages.Summary` was the last stage the port did not have, and
it is the one that CLOSES the wizard: `ReflexSelectWindow_OnClose`
goes to `SetSummaryWindow`, and it is `SummaryWindow_OnClose` that
calls `StartNewGame`. The port had been ending on the reflex screen.

`CreateCharSummary` is barely a layout of its own. Setup (:63-96)
COMPOSITES components that already exist onto `CHAR04I0.IMG`:

| component | where | already ported for |
|---|---|---|
| `StatsRollout` | (8,33) step 22 | the stats screen |
| `SkillsRollout` | groups at 32 / 81 / 130 | the skills screen |
| `FacePicker` | (247,25) 64x40 | the face screen |
| `ReflexPicker` | **(246,95)** | the reflex screen, at (127,148) |
| `TextBox` | **(100,5)** 214x7 | the name screen, at (80,5) |

Only the last two move. `ReflexPicker` is a self-contained 66x45 panel
its host merely POSITIONS, so it takes an origin now instead of being
written twice - and the four blocks were EXTRACTED from their screens
rather than copied, which is the whole reason this slice is small.

Worth noting for the stats block: `CreateCharSummary` news up
`StatsRollout()` with `onCharacterSheet` false, so the (141,17)/24-step
alternate layout in that class is the CHARACTER SHEET's, not the
summary's. Same geometry as the stats screen, verbatim.

**What the screen actually does.** Nearly every control is live - this
is a review screen you can still edit on. OK is gated on FOUR pools,
not one, because you can take points back DOWN off any of them; an
unspent point pops TEXT.RSC 14 ("You must distribute your bonus
points") on U11's parchment rather than closing. RESTART is a SOFT
restart: `SetRaceSelectWindow` with the document intact, so a player
who re-picks the same class keeps the roll (the 17j F7 rule).

**Two things the port had to change underneath.**

- The stats and skills rollouts needed INDEPENDENT selections. One
  shared `cursor` was fine while they were separate screens; the
  summary draws both, and a click on a skill row would have moved the
  stat spinner.
- The biography reset moved onto `_enterBiography`. AUDIT 17j F3 put
  it on the NAME screen's cancel, which was the only arrival that
  existed then. RESTART is a second one, and it would have walked back
  through the questions with the previous run's effects still in the
  list, applying every one of them twice. DFU never reuses that window
  - both `SetBiographyWindow` and `SetChooseBioWindow` construct a
  fresh `CreateCharBiography` over a fresh `BiogFile` - so every
  arrival resets, and now every arrival goes through one door.

**One verbatim quirk, ported deliberately.** `SetSummaryWindow`
assigns `CharacterDocument` on every push, and that setter zeroes all
four pools (:119-136). So: un-spend a point ON the summary, back out
to the reflex screen, come forward again, and the pool is zeroed while
the lowered value stands - the point is gone. DFU does exactly that.

**What the screenshot caught.** The seven DERIVED labels (damage,
encumbrance, spell points, magic resistance, to-hit, hit points,
healing rate) had been folded into the shared stats block. They belong
to `CreateCharAddBonusStats`' OWN panel (:94-100) - `StatsRollout` has
never heard of them - so the summary drew them across its skill
panels: "+BRIMARY SKILLS", a stray 110 over the Axe row, a +0 between
two groups. No test would have found that; eyeballing did.

FLAGGED: DFU's `SkillsRollout` carries THREE `LeftRightSpinner`s, one
per group, each with its own selected skill and its own remaining
pool. The port collapses that to one cursor over all nine rows and
draws a single spinner. Every point can still be spent, but classic
shows all three pools at once, and the summary is where the difference
becomes obvious. Its own slice.

Probed: the click probe now walks the summary too - it takes a stat
point back down, watches OK REFUSE with the parchment box up, closes
the box, re-spends, moves the reflex pick at the summary's own picker
origin, and only then confirms. Eyeballed: every panel reads, the
green modified values are right, and the gate screenshot shows STR
70 -> 69 with a 1 in the spinner behind "You must distribute your
bonus points."

**AUDIT 17j corrected the back arms.** U15 got the wizard's ORDER
right and every one of its BACK arms wrong, because the order was read
forwards and the cancels then inferred by reading it backwards. DFU
writes its cancel targets out one handler at a time, and three of them
do not step back one screen: the class screen cancels to RACE, the
name screen cancels to the biography method (and DISCARDS the answers
so far), and the stats and skills screens RESTORE rather than reroll.
The U15 back pin asserted the bug. The random-name button was also
deterministic - `Rlillki` on every boot - because DFU reseeds DFRandom
on every push of the name window and the port never did. See Audits.

## U18 - THE CLASS-QUESTIONS PATH (2026-08-18)

The first item off the U17 queue: `WizardStages.SelectClassMethod` and
`GenerateClass` - the two stages between gender and the class list
that the wizard's enum has always named (:67-68) and the port skipped
straight past. A classic player was never sent to the list; they were
ASKED how they want their class chosen.

**The method screen** (`CreateCharChooseClassGen`). BUTN01I0.IMG
centred on the native panel - headerless 26496 bytes = 184x144, so the
panel sits at (68,28) - with both buttons BAKED in the art:
choose-from-a-list at (8,41,167,43), answer-questions at (8,100,167,34).
Both handlers end in `CloseWindow()` (:63-72), so the click sets AND
closes, the U14 gender law again. The wizard's `ChooseClassGen_OnClose`
(:318-328) has NO cancelled arm - ANY close that is not ChoseGenerate
goes to the class list, Escape included - so `back` lands there too,
ported verbatim rather than "one screen up". The popup draws over the
race map dimmed (`previous = createCharRaceSelectWindow`, :144).

**The questions screen** (`CreateCharClassQuestions`). Three format
finds on the way in:

- THE QUESTIONS LIVE IN TEXT.RSC RECORD 9000 AS LITERAL '{' MARKERS.
  Not subrecord separators (0xFF) - the byte 0x7B, inside the text
  range. DFU's string-table importer splits the record on '{' and keys
  the pieces "9000.1".."9000.40" (`SplitQuestionnaireRecord`); the
  port performs the same split on the record's plain text. Each
  question then loses its leading number through the `\d+[.]` split
  law, quirk included (a number-dot ANYWHERE in a line truncates
  everything before it), and the a)/b)/c) row indices come from
  `Contains`, last match wins - all verbatim from `GetQuestions` /
  `DisplayQuestion`.
- THE SCROLL IS THE ONLY GFX CONSUMER IN THE GAME. SCRL00I0.GFX +
  SCRL01I0.GFX are 8 parchment frames each, 320x80, TEXTURE-style RLE
  rows behind a per-row offset table - `src/formats/gfxFile.js` is the
  ninth format reader, GfxFile.cs verbatim. The two files load as ONE
  contiguous 16-frame list (:103-118) and the frame advances with
  every pixel of text scroll, wrapping.
- CHGN00I0.IMG IS PALETTIZED (its own 768-byte palette after the
  pixels, x4 on load) and ImgFile._readPalette writes INTO the palette
  it is handed - so the screen loads it over its OWN DFPalette, never
  the shared ART_PAL. The scroll frames borrow that palette, exactly
  as DFU assigns `scrollFile.Palette = backgroundBitmap.Palette`.

**The logic, verbatim** (`src/systems/classQuestions.js`): ten UNIQUE
questions picked by random start + linear probe; the 40x3 answer
table ripped from FALL.EXE v1.07.213 at 0x0059820C steering each
answer to Warrior/Rogue/Mage weights; and CLASSES.DAT's results walk -
all 66 possible ten-answer triples from offset 18, four slots per
class, the header byte with its left nibble zeroed past slot 3. The
classic anchors hold on the real file: all-warrior is the KNIGHT,
all-rogue the THIEF, all-mage the MAGE. The ten answers then open the
resolved class's DESCRIPTION on TEXT.RSC 2100 + index - the SAME
describeClass source the list's double-click uses - Yes adopting it
into the flow (the careers array is CLASS00..17.CFG in file order, so
the index IS the load), No dropping it to the class list, exactly
`CreateCharClassQuestions_OnClose`'s two arms.

**The constellations.** Answering brightens the answered path's
constellation: palette slots 192/160/128 hold (0,0,blue), blue 8 +
24 per answer, and the background re-uploads from the mutated palette
(versioned textures, stale ones released - the paperdoll ownership
law). The PRISTINE embedded palette shows until the first answer,
as DFU only writes the slots at the first anim's end.

**FLAGGED loud, three departures recorded in the Ledger:** the three
FLC constellation animations (ROGUE/MAGE/WARRIOR.CEL - an Autodesk
FLIC decoder the port does not have) do not play, so the next question
shows immediately where DFU waits out the CEL, and the Ignite one-shot
that rides the answer waits with them; the question label is clipped
to the text window BY ROW where DFU clips by pixel (until the renderer
grows a scissor seam). The third departure retired: the mouse WHEEL is
wired through the hosts' overlay seam now (canvas `wheel` ->
townTalk/worldModes/dungeonContext -> `overlay.wheel(dir)`), and every
discrete scroll input - wheel notch, arrow key, margin click - steps a
whole text row (`scrollQuestionRow`), since the port has no held-button
per-frame repeat and one pixel per event read as a dead scroll.

**Also on the way through:** the wizard-ORDER flag retired by U15 was
still printed in two file headers (chargen.js, chargenArt.js) - the
sentences deleted, per RETIRING A FLAG DELETES THE SENTENCE. And
tools/chargenProbe.mjs had ROTTED on the pre-U15 order (it typed the
name first, expected the biography to land on stats, and ended before
U16's summary) - the click probe had quietly taken over as the only
live walk. Repaired to the classic sequence; both probes run again.
Port-Ledger housekeeping: a stray `>>>>>>> origin/main` conflict
marker in section C (left by the 2026-08-16 two-lane merge) deleted.

Pins (test/classquestions.test.js, 23 with the pointer sweep): the
answer table deepEqual against the FALL.EXE literal AND every row
covering all three paths; the linear-probe pick under a stuck PRNG;
the nibble law on crafted and real headers; the no-cancel-arm law; the
weights walk (ten a) answers -> [7,1,2] -> Barbarian on the real
file); the description box's Yes/No arms; re-entry freshness; the
blues law; the scroll clamp + frame wrap; the crafted-GFX RLE
round-trip byte-exact; and the corpus gates - all 40 questions parse
with ordered answer rows, all 66 triples resolve on the real
CLASSES.DAT, all 16 scroll frames decode. The U14 pointer sweep now
walks the two new screens too.

Probed by clicks end to end (tools/chargenClickProbe.mjs): the gender
button closes onto the METHOD screen, the questions button opens the
scroll, ten a)-row clicks (auto-scrolled into the click band on long
questions) sum the weights to ten and open the description box, NO
falls to the class list - where the original U17 walk continues
unchanged - and the list path then runs to the finished character.
Eyeballed: the method panel over the dimmed province map, the
parchment scroll under the constellation chart, the description box.

## U19 - THE BIOGRAPHY-METHOD SCREEN (2026-08-18)

`WizardStages.SelectBiographyMethod` - the LAST stage in the wizard's
enum the port skipped. Every class-accept arm in DFU goes to
`SetChooseBioWindow` (:344 for the questions path, :365 for the list,
:401 for the custom builder); the port had collapsed the stage and
sent the class choice straight to the questions.

**The screen** (`CreateCharChooseBio`): BUTN02I0.IMG centred - the
file decodes 184x168, so the panel sits at (68,16) - with both
buttons BAKED in the art: have-your-history-generated at
(8,41,167,54), answer-questions at (8,113,167,46). Both handlers end
in `CloseWindow()`, so the click chooses AND closes (the U14/U18
law); the popup draws over the race map dimmed (previous =
createCharRaceSelectWindow, :180); Escape cancels to the CLASS LIST
(the OnClose cancel arm :458-461).

**The GENERATE arm** (`CreateCharChooseBioWindow_OnClose` :427-452):
a fresh BiogFile, every question answered at `rand.Next(0,
answers.Count)` - `new System.Random(DateTime.Now.Millisecond)` is an
engine PRNG, so it rides the flow's injectable rolls (Ledger A) -
each chosen answer's effects added through the SAME tagEffect the
manual path uses, then DigestRepChanges and the ClickAnywhereToClose
reputation box on TEXT.RSC 35, shown OVER the method screen (the
wizard pushes it over createCharChooseBioWindow, :444). Closing it
goes to the name screen (`ReputationBox_OnClose` :464-467). The
backstory composes from the rolled answers, exactly as the manual
path's does.

**Three cancel arms rewired onto the stage.** The name screen's
cancel returns HERE (:483-493) - 17j F3 had collapsed it onto the
questions; the BIOGRAPHY's own cancel comes here too (:477-480),
which the port simply lacked; and the method screen's Escape falls
to the class list. The fresh-BiogFile reset now rides BOTH arms
(the U16/17j double-apply law), extracted with the biography's
closing tail (`_resetBiography` / `_finishBiography`) so the manual
and auto paths share one implementation - ONE DFU MEMBER, ONE
EXPORT.

**Also: the stale queue entry retired.** "The dungeon-host
worn-weapon binding" had sat in the queue since U8h flagged it -
but AUDIT 17e F17 moved the bind INTO createWeaponRig (every host
that passes an entity inherits it), and 17k's fist crash proved the
dungeon binding live (the null weapon CAME from the bound empty
hand). Retired with this record rather than re-shipped.

Pins (test/biomethod.test.js, 6): every class-accept arm lands on
the method screen and a missing question set skips it; the questions
arm resets; the generate arm's pick law pinned at both PRNG extremes
(rolls 0 -> answer a everywhere, rolls .999 -> the LAST answer, every
effect of a multi-effect answer landing); generating twice cannot
double-apply; the three cancel arms; the pointer path (both DFU
rects, the dead zone, the modal reputation box eating the buttons).
The U14 pointer sweep walks the new screen.

Probed both ways: the KEYBOARD probe takes the generate path -
BUTN02I0 eyeballed, one Enter auto-answers all twelve, the
reputation box shows OVER the method screen with the run's own
totals, and those totals land verbatim on the entity
(sGroupReputations[0..5] deepEqual the digest - the pin is the run's
OWN numbers now that the answers are random). The CLICK probe keeps
the manual path: the questions button by tap, then the twelve
answer clicks as before.

## U20a - THE CUSTOM-CLASS BUILDER (2026-08-18)

`WizardStages.CustomClassBuilder` - the last chargen SCREEN the port
did not have. With it, every stage in DFU's wizard enum exists.

**The way in.** `CreateCharClassSelect` appends ONE row after the
eighteen CLASS*.CFG careers (:66-67) and that row is Custom; picking
it sets `selectedClass = null` and closes with NO description box and
no drums (:72-77). The port's list had only ever known its careers,
so the row is new state (`classRowCount`/`classRowName`) - and the
LIVE PROBE caught both bugs that came with it: `careers[classIndex]`
THREW on the highlighted row (DFU's selectedClass is simply null
there), and the list's click bound was still `careers.length`, so the
row answered the keyboard and NOTHING to a tap - the U14
keyboard-only shape again.

**The builder** (CUST00I0.IMG full-screen): the name TextBox at
(100,5), a StatsRollout in FREE EDIT (values clamp 10..75, the pool
is a zero-sum ledger that may go negative, and modified values do NOT
turn green because freeEdit's modifiedStatTextColor IS the default
colour), twelve skill buttons at their verbatim rects each opening a
list picker of the UNASSIGNED skills alphabetically, the HP spinner
(4..30), the HELP picker over eight TEXT.RSC topics, the REPUTATIONS
window, and EXIT behind four gates in DFU's order: no name (301), a
skill unset (300), an unbalanced pool (302), the dagger in the red
(306).

**The difficulty gauge, verbatim.** Points are +1 per HP above the
default and -2 per HP BELOW it; the advancement multiplier is
`0.3 + 2.7*(points+12)/52` - exactly 0.3 at the legal floor and 3.0
at the ceiling; and the dagger's Y walks 115 up toward 46 or down
toward 186 with C#'s `(int)` TRUNCATION, not rounding.

**The reputation window** (CUST03I0, centred on DFU's half pixel -
Unity's Middle alignment on a 189-tall image really is 5.5): five
columns whose bars are flat colour panels, the click's column picked
by x threshold and its sign by which side of the middle line it fell,
the value `+-(height/5)` after RoundNearestBarHeight's own quirk (a
remainder of exactly 4 rounds UP, 1..3 round DOWN, capped at 50), and
an exit gated on the NEGATED sum being zero (303).

**What the finished class carries out** (`CreateCharCustomClassWindow_
OnClose` :374-401): the typed name onto the career, the working stats
copied onto its base attributes, `BiogFile.GetClassAffinityIndex`'s
best-overlap index onto classIndex - which is what picks the
BIOGRAPHY QUIZ - and the five reputations onto the document, where
they SEED sGroupReputations before the biography's own changes add on
top. A custom class's starting spells follow
`SetStartingSpells`' custom arm: the SPELLSWORD set if any PRIMARY or
MAJOR skill is one of the six magic schools, none otherwise (a magic
MINOR does not qualify).

**Three verbatim quirks ported deliberately, one of them ugly.**
`isCustom` is assigned in exactly ONE place in the whole DFU codebase
- `= true` when the Custom ROW is picked (:358) - and is never
cleared. So opening the builder, cancelling out of it and then
picking a standard class leaves a document that still says custom:
ItemHelper gives it the custom starting kit and StartGameBehaviour
routes it through the custom spell rule. The first draft of this
slice "tidied" that by clearing the flag on every standard accept,
and the parity review caught it. The reputations ride the same rule.
And a click exactly ON the rep window's middle line ZEROES that
group (repVal is computed on every click) while moving no bar.

**Two pre-existing defects the slice's own review surfaced and fixed.**
DFU's `ListBox.SelectPrevious/SelectNext` CLAMP at the list's ends
(:709-740); the port wrapped with a modulo, so the class list ran off
its own ends onto the far one - and this slice's first draft asserted
the wrap in a pin. (The FacePicker's wrap is that component's own law
and stays.) And the stats/skills REROLL MEMO keyed on `classIndex`,
which was equivalent while every class came from the list - but a
custom class carries the AFFINITY index, so a custom whose affinity
matched a previously rolled class restored that class's roll instead
of rolling for the new career. DFU compares the CAREER object
(`DFClass != characterDocument.career`), and so does the port now.

**And one the probe caught in a neighbouring host.** Typing "Scout"
read back "scout": the exterior hosts' key router handed the overlay
only `e.code`, so `codeToKey` lowercased every letter and a typed
character NAME could never carry a capital there. The dungeon host
never had it - `routeKey` passes the real event. The event rides
along now, and a source sweep pins the seam.

FLAGGED to U20b: `CreateCharSpecialAdvantageWindow` - the builder's
two Edit Special Advantages/Disadvantages buttons answer loudly and
the difficulty tally's advantage/disadvantage terms stay 0 until it
ships. Recorded in the Ledger: the hidden ResetBonusPool shortcut,
the dagger's fading trail, and the rep window's stale-bar quirk.

The class-index CONFLATION this paragraph used to carry as a fourth
item is FIXED, not recorded - see AUDIT 17m. The sentence claimed the
Ledger held it and the Ledger never did, which is the drift the
Ledger exists to prevent: a departure narrated in an arc doc but
absent from the table is not recorded at all.

Pins (test/customclass.test.js, 28): the difficulty tally and its
multiplier at both ends of the legal band; the dagger's truncation
and clamps; the picker's alphabetical unassigned list; the built
career's DFCareer defaults, skills and stats, with its x0.50 spell
multiplier decoded through the port's OWN reader; the affinity
index's tie rule; the custom spell rule at every arm including the
magic-MINOR negative; the bar rounding quirk; the column thresholds
and the sign rule; the balance ledger; the Custom row's null career
and its clickability; the freeEdit clamps and the ledger's
conservation; the four exit gates in order; the affinity + reputation
handoff; the isCustom quirk both ways; the sub-windows' modality; and
the typed-capitals seam.

Probed live by clicks (tools/customClassProbe.mjs): eighteen clicks
of the picker's own NEXT arrow to reach Custom, a double click into
the builder, twelve skills through twelve pickers, the HP spinner
moving the difficulty 0 -> 6, the name TYPED with its capital, the
stat gate refusing and clearing, the reputation window's own gate
refusing until balanced, and out through the rest of the wizard. The
entity at the end: career Scout, 11 HP/level, advancement 1.0788
(0.3 + 2.7*15/52), the Spellsword spell set from its magic primary,
the custom starting kit, and sGroupReputations carrying the builder's
seed with the biography's changes added on top. Eyeballed: the stone
window with its three skill panels and the dagger exactly on AVERAGE,
and the reputation window with its green bar and refusal parchment.

## AUDIT 17m - the picker's row is not the document's class

2026-08-18. U20a's own adversarial review came back after the slice
had shipped, and one finding survived every lens: the port carried
DFU's TWO class indices in ONE field.

DFU keeps them apart and the separation is load-bearing.
`characterDocument.classIndex` is the document's class, written in
exactly three places - DaggerfallStartNewGameWizard.cs:343 (the
questions path), :364 (a list pick, copying the window's
SelectedClassIndex across) and :382 (a custom class's biography
AFFINITY). `listBox.SelectedIndex` is CreateCharClassSelect's own
highlighted row; the wizard never writes it, and it SURVIVES a
revisit because SetClassSelectWindow (:158-167) reuses the window
behind a `== null` guard - unlike SetCustomClassWindow (:170-175),
which reconstructs every time.

The port's single `classIndex` was both. So `customExit`, writing the
affinity for the biography quiz, also moved the class picker and
scrolled to it. The consequence was a lost character, not a cosmetic
slip: build a custom class, press Escape off the biography-method
screen (the wizard's own cancel arm, :458-461), and the list came
back with a STANDARD class highlighted. Confirm there and `useClass`
took the non-Custom branch into `_acceptStandardClass`, which nulls
`customCareer` - the built class was gone and the player became a
class they had never picked. DFU, with the Custom row still selected,
re-opens the builder.

The fix is the second field, not a guard: `classListIndex` is the
picker's row and `classIndex` is the document's. Every list gesture -
the arrow clamp, the click, the row hit, the Custom-row test, the
description lookup, both draws - moves the picker; the document is
written only by the three accept arms, and `_acceptStandardClass`
now performs :364's copy explicitly instead of inheriting it from the
shared field. `_adoptCareer` is the shared tail so the two arms cannot
drift apart again.

Found on the way, and fixed with it: the builder's keyboard had a
LIVE `plus` arm against a DEAD `minus` one. The shared overlay table
(ui/input.js:18) matches `-` inside its character class first, so the
minus arm never fired from any host - but `+` is not in that class and
fell through to spend a point. A keyboard could take from the freeEdit
pool and never give back. DFU has no keyboard stat control on this
screen at all (StatsRollout's steps are UpDownSpinner *Button*
handlers, :231-256 and :259-281, mouse only) while the name TextBox
holds focus unfiltered, so a typed `-` belongs in the CLASS NAME,
which is what the port already did. The `plus` arm is gone; the pool
moves by click. Residual, deliberate and small: DFU would type a
literal `+` where the port's shared table has already spent that key
on the stats and skills screens, so `+` is inert here rather than
typed.

And a documentation find that matters more than its size. This arc
doc claimed the conflation was "Recorded in the Ledger". It was not -
there is no such row, and there never was. A departure narrated in an
arc doc but missing from the Ledger table is not recorded at all, and
the claim actively hid the defect: a reviewer checking whether the
behaviour was known would read the sentence and stop. The sentence is
deleted rather than backfilled, because the departure is fixed.

Pins (test/audit17m.test.js, 6), every one mutation-proven - restoring
the original defect fails three of them: the affinity landing on the
document with the picker untouched; the whole back-out path ending in
the BUILDER with the career intact; a list pick copying the row only
on accept; the questions path leaving the picker alone; the builder's
keyboard moving no stat while `-` types; and a source sweep failing if
`customExit` ever writes the picker again or the list art draws the
document index.

## U20b - the special advantages / disadvantages window

2026-08-18. `CreateCharSpecialAdvantageWindow` - the last chargen
window the port lacked, and the one that makes U20a's two difficulty
terms real.

This was never "a missing screen". U20a shipped
`difficultyPoints(hp, advantageAdjust, disadvantageAdjust)` and nothing
ever passed the last two arguments, so the whole
advantage/disadvantage balance was inert: the tally fed
`advancementMultiplier`, which became `career.advancementMultiplier`,
which `advancement.js` consumes in `skillUsesForAdvancement`. Every
custom class advanced at its HP-only rate however many advantages it
took on. A Scout with Immunity To Fire now carries a multiplier of
1.442 where it read 0.923 - the balance lever the builder is FOR.

ONE window serves both lists: CUST01I0 is the body and CUST02I0 (168x31)
lays over its top strip to retitle it from Disadvantages to Special
Advantages (:243-254), which is why only the advantages arm draws the
overlay. The panel is Left/Top (:236-237), NOT the Center/Middle the
reputation window uses (:110-111) - and the screenshot proves that
deliberate rather than a DFU slip: the window covers the left half and
leaves the builder's control column AND THE DIFFICULTY DAGGER visible
on the right, so you watch the dagger climb as you add advantages.
Every rect is relative to that origin, which is why the add button sits
at x=80 and the exit strip spans 6..161 inside a 168-wide panel.

THE STRINGS were the slice's real obstacle. DFU resolves them through
`TextManager` from HardStrings KEYS, and the display text lives in
StreamingAssets, which the sparse Scripts checkout does not carry. They
are not in TEXT.RSC either - I searched every record of the real file
and found nothing, because they were hard-coded in FALL.EXE, which is
in neither the data directory nor DaggerfallGameFiles.zip. The
recovered text is DFU's `Internal_Strings.csv`, fetched out of the repo
tree, whose own header says it "stores text that was hard-coded in
FALL.EXE" - so the labels are classic's, by way of DFU's recovery.

THE BIT LAYOUT was ground-truthed before anything was built on it. The
port keeps a career in its raw CLASS.CFG bitfield form, not DFU's
decoded properties, so `parseCareerData` writes bitfields: forbidden
proficiencies at 0..5 and expert at 16..21 of one u32, armors at 6..8,
shields at 9..12, the special abilities in the ability bitfield's low
byte with light magery at 6..7, darkness at 8..9 and the spell-point
multiplier at 10..12 above them. Decoding the real 18-class corpus
through those positions returns exactly what classic's classes should
be - Archer is the one class expert in missile weapons, Sorcerer
carries noRegenSpellPoints, Monk forbids all three armors, Warrior
forbids nothing, Knight forbids leather - which is the check that the
positions are right rather than merely self-consistent.

The pins decode back through the port's OWN consumers -
`spellPointMultiplier`, `hasSpecialAbility`, `careerAttackModifier` -
rather than re-asserting the literals just written (TEST THE SHAPE THE
PRODUCER MINTS). That is what caught the one real subtlety: Increased
Magery must REPLACE the multiplier bits, not OR into them, because the
builder starts at Times_0_50 and an OR leaves a corrupt value.

Counted rather than remembered: the difficulty table has FIFTY entries,
not the 53 an earlier reading of this slice recorded. The port's table
diffs key-for-key against the C# literal with no duplicates, and the
pin asserts 50.

One departure, recorded in the Ledger: DFU pushes a half-built item
onto the list before opening the secondary picker and pops it on
cancel; the port never pushes it. Same end state, and no frame in which
a redraw could catch a primary with no secondary under it.

Pins (test/specialadvantages.test.js, 27), each mutation-proven -
dropping the two adjust terms from the tally fails four of them, and
the ONLY-ONE limit, the equal-secondary pair rule, the magery replace
and the expert-proficiency shift each fail their own. Probed live by
clicks: the window over the builder, an eleven-row primary list, a
secondary pick landing as Immunity/To Fire with the +6 tandem squish,
the dagger moving off AVERAGE because of it, a label click removing it
and the tally following, and immunityFlags 8 on the built career at the
far end.

## AUDIT 17n - the parity pass over U20b

2026-08-18. Mac asked for a comprehensive audit after U20b shipped.
The data transcription came back clean; the wiring did not.

WHAT WAS CLEAN, checked mechanically rather than by eye: the 50-entry
difficulty table diffs key-for-key AND value-for-value against the C#
literal with no duplicates; all 71 display labels match DFU's recovered
FALL.EXE text exactly; every secondary list matches its DFU array in
order; the builder is reconstructed on re-entry on both sides, so the
pick lists reset; a career's flags survive the save round trip (the
career is spread as plain CFG data, save.js:61,88 - worth checking
because AUDIT 17h caught exactly this shape dropping player
reputation); and parseCareerData leaves every numeric field finite and
unsigned under the maximal fourteen-pick set.

F1 - THE ENEMY-TYPE ATTACK MODIFIER HAD NEVER APPLIED TO ANYBODY, and
it was broken in two independent places, which is why neither half
showed up as an obvious bug.

DFU reads `attacker.Career.<group>AttackModifier` for every attacker
(FormulaHelper.cs:993-1030). The port flattened that byte onto the
entity, and only the FOE builder ever set it (enemyEntity.js:105). A
player carries `career` and no flat field, so
`bonusOrPenaltyByEnemyType`'s null guard returned 0 on every swing.
That alone would have been enough.

Underneath it, a second break: `calculateAttackDamage` resolves
`targetGroup` and threads it to the monster branch and the
hand-to-hand branch, but the WEAPON branch called
`weaponAttackDamage` without it - and that function read
`target.group`, a field NOTHING in the codebase mints. So even a
correctly-flagged attacker got nothing through the path players
actually use. DFU has one call taking the target entity
(FormulaHelper.cs:788) and derives the group inside it; the port split
that apart and only carried the group down one of the two forks.

The target half of the player's swing was PARTLY correct -
playerWeapon.js:159 passed `enemyGroupOf(foe.entity.affinity)` - which
is precisely why this looked wired. AUDIT 18 corrected the rest: DFU
uses TWO discriminants, not one. The Humanoid arm keys on
`MobileEnemy.Affinity == MobileAffinity.Human`, as the port did, but
the Undead/Daedra/Animals arms key on `GetEnemyGroup()`, a per-
careerIndex table (FormulaHelper.cs:1004-1035 and :2746-2805). The two
disagree for five spawnable careers - Slaughterfish 11, Vampire 28,
Vampire Ancient 30, Dragonling 34 and Dragonling_Alternate 40 - all of
which the affinity map scored 0. And `target is PlayerEntity`, DFU's
"player is assumed humanoid" arm, had no port at all: every
enemy->player site passed a null group, so the modifier could never
fire on an attack against the player. `bonusOrPenaltyByEnemyType` now
takes the target ENTITY, as DFU does.

This is NOT a U20b regression. The classic ASSASSIN ships
attackModifierFlags 0x04, a Humanoid bonus, and has never received it;
the gap dates to the combat arc. U20b only made the same modifier
purchasable, at 3-6 difficulty points for a bonus and -4 for a phobia,
which is what turned a dormant gap into one the player pays for.

F2 - WHICH PICKS ACTUALLY DO ANYTHING. A window that writes a career
flag no system reads is not a working feature, and the slice must not
imply otherwise. Catalogued in the Ledger rather than left to be
rediscovered. LIVE: Increased Magery (maxMagicka reads the
multiplier), the tolerance quartet (spellcast.js), Rapid Healing
(rest.js), Inability To Regen Spell Points, and - after F1 and AUDIT
18 - Bonus to hit and Phobia on every fork: the player's melee and
hand-to-hand swing, and (AUDIT 18) an enemy's attack on the player. INERT for want of a consuming subsystem: Spell
Absorption, Regenerate Health, Acute Hearing, Athleticism, Adrenaline
Rush, Damage From Sunlight/Holy Places, and all four Forbidden
categories plus Expertise In. The flags are written correctly and
persist; they simply have no reader yet.

F3 - U20b UNBLOCKS THREE STANDING INTERIMS. Two source notes said the
career advantage flags "pend" a decode - formulas.js on adrenaline
rush and dungeonContext.js on the Athleticism fatigue multiplier.
That decode now exists (SPECIAL_ABILITY_BITS beside
rest.js's hasSpecialAbility), so what actually pends is the EFFECT,
not the read. Both sentences re-pointed rather than left to imply a
missing capability the port now has.

Pins (test/audit17n.test.js, 7), each mutation-proven - reverting
either half of F1 fails three and one respectively, and dropping the
level scaling fails three. F1 is pinned on both entity shapes, on an
attacker carrying neither, through real damage via
calculateAttackDamage, and against the real CLASS11.CFG so the
Assassin claim fails if the corpus ever disagrees.

## AUDIT 18 - doc-truth corrections to this page

**The sub-33 glyph law (U3).** The U3 record described "sub-33 codes advance
a fixedWidth space" as one of DaggerfallFont's rules carried verbatim. It is
not DFU's rule. DaggerfallFont.cs:

- any code with no glyph is REPLACED by SpaceCode 32 before layout
  (`if (!HasGlyph(asciiBytes[i])) asciiBytes[i] = SpaceCode;`, :312-314) -
  it is not "advanced past";
- the space glyph is manufactured at load with `int width =
  fntFile.FixedWidth - 1` (CreateSpaceGlyph, :623-625), so its advance is
  FixedWidth MINUS ONE;
- in DrawText the space branch advances by `rect.width` ONLY, with NO
  GlyphSpacing (:326-328), while every drawn glyph adds GlyphSpacing after
  it (:320-322);
- CalculateTextWidth measures every code, space included, through
  GetGlyphWidth(code, scale, GlyphSpacing) (:381), so the MEASURED width of
  a space does include the 1px spacing that the DRAWN advance does not.

The port's ui/text.js used FixedWidth + 1px spacing for both. The code fix
is routed to the UI lane of this audit; this record now states the DFU law
so the next reader is not measuring against the wrong ruler.

**The custom-class document's isCustom (U20a).** ui/chargen.js's
`_acceptStandardClass` says the never-cleared `isCustom` quirk is "recorded
in the Ledger". It was not - Port-Ledger.md had no such row until AUDIT 18
added one to section B. That is the 17m shape: a comment pointing at a
Ledger row that does not exist, which reads to an auditor as "already
known".

## U23 - THE GUILD SERVICE POPUP, and the static NPC becomes clickable (2026-08-19)

`src/ui/guildServiceWindow.js` + the interior host's static-NPC seam in
`src/scenes/worldModes.js`. `test/guildservicewindow.test.js`, 8 tests.
The law half is `systems/guildServiceFlow.js`, recorded in the Systems
arc; the calendar it needed is S28.

**The thing that did not exist.** The people standing in a building
interior have been spawned since C1 - `collectInteriorPeople` reads
their StaticNPC inputs, factionID included - and NOTHING could click
one. The whole `PlayerActivate.StaticNPCClick` branch had no port. So
every guild hall, temple and knightly order in the game was a room with
furniture in it. That is what this slice closes.

**THE NATIVE-WINDOW RULE, element by element.** The panel is
GILD00I0.IMG for a non-member (it has the Join Guild row baked in) or
GILD01I0.IMG for a member; both are 130x51 in the shipping data, which is
exactly `mainPanel.Size`. The four button rects are the `#region UI
Rects` literals: join (5,5,120,7), talk (5,14,120,7), service
(5,23,120,7), exit (44,33,43,15).

**The position is the pin worth having.** DFU declares
`mainPanel.Position = new Vector2(0, 50)` and then sets BOTH alignments
to Center/Middle - and `BaseScreenComponent` :1217/:1234 make each
alignment IGNORE position on its axis, so the declared line never
applies. The panel sits at ((320-130)/2, (200-51)/2) = (95, 74.5), not
(0, 50). A reader porting the declared line would have put it 25px too
high, so the test asserts `PANEL_Y !== 50` as well as `=== 75`. The half
pixel is real in DFU too (its rect is float); the port rounds it the way
`layoutMessageBox` already rounds its own centring.

**The service label is the only text the window draws** - the rest of
the words are painted into the art. `serviceLabel.Position` is (0,1)
inside the service button, horizontally centred, and
`ShadowPosition = Vector2.zero`: NO SHADOW, unlike every other label in
this port. The string is `Services.GetServiceLabelText`, twenty entries
recovered from DFU's Internal_Strings table.

**A member's join rect is DEAD, not merely unpainted.** `Setup` only
ADDS the join button when `!member`, so the member panel has no button
where that row used to be. The test clicks there and requires nothing
to happen - which is what fails if a later slice swaps the IMG and keeps
the rects.

**The seam, and THE FOUR HOSTS.** Interior people are activation targets
at DFU's own `StaticNPCActivationDistance` (256 classic units, twice a
door's), against the swept box of their billboard - a billboard turns to
face the player, so the volume it occupies over a turn is square in x/z,
and a 0.1-deep collider would miss from the side (Ledger A, ray-only).
`worldModes.js` is WIRED and is the only host that can be: it is the
only one that builds a building interior. `exterior.js` and `world.js`
MOUNT this machine, so a click inside reaches the seam through them.
`dungeonContext.js` has nothing to wire - RDB blocks carry flats and
enemies, not `blockPeopleRecords`.

**RANK TITLES, recovered.** G1 shipped without them and said so: DFU
reads the six lists from its own localization StringTables, which the
sparse clone excluded, so `getTitle` returned the player's name at every
rank. Widening the sparse set to `Assets/Localization` produced all six.
"Master Wizard", "Master Thief", "Dark Brother", "Knight Brother" and
"Master Assassin" are ONE title each - `GetLocalizedTextList` splits on
newlines only - and the compound titles are pinned as such. A NON-member
reads back their own NAME in the three guilds that do not override
`GetTitle`, and the "non-member" string in the three that do. The
Temple's two gendered overrides ship with DFU's own reason in the
source: rank 9 Patriarch becomes Matriarch, rank 6 Brother becomes
Sister.

**Live-probed** (`tools/guildServiceProbe.mjs`): 7 guild/temple doors in
the test city, the Mages Guild has 12 people of whom 11 offer a service,
the popup opens on GILD00I0 with "Make Spells" on its middle button, the
service button answers the members-only refusal, and the join button
raises TEXT.RSC 606 on the U11 parchment with Yes/No. The probe is what
found THE ONE CONSTRUCTION SEAM's fifth occurrence.

FLAGGED here: DFU binds each button to a `DaggerfallShortcut` hotkey read
from the player's own keybind file, which the port has no source for, so
the keyboard accelerators (J/T/S/Esc) are the port's own - Ledger A. The
TALK button and the three non-guild routing destinations are Ledger C
rows of their own.

## U24 - THE THREE GUILD SERVICE FLOWS + THE LIST PICKER (2026-08-19)

`src/ui/listPicker.js` and `src/ui/guildServiceWindows.js`; the law is
S29's `systems/guildServiceActions.js`. `test/guildserviceflows.test.js`,
17 tests.

**None of DFU's three service classes has art of its own.** It says so
about the training one outright - "Note this is not a real UI window,
and is not actually pushed onto the stack. This is so replacements are
not constrained what to present first" - and the other two ARE message
boxes by inheritance. So each is a short chain of U11 parchment boxes,
and one class runs all three: a queue where each box may carry buttons,
an input field, or a list picker, and each may push the next.

**THE LIST PICKER is the reusable half.** PICK00I0.IMG, 200x128 in the
shipping data and exactly `pickerPanel.Size`, Center/Middle at (60,36).
The list is a panel-child at (26,27,138,72); the paging buttons are 9x9
at (179,10) and (179,108) and move a WHOLE PAGE; the scroll bar is
5x82 at (181,23). ListBox's own defaults are rowsDisplayed 9 and
rowSpacing 1, and a row advances by the font's glyph height plus that
spacing - which is the arithmetic a list click resolves against, so a
click is pinned resolving through the SCROLL INDEX rather than the
visible row. The selected row draws in DaggerfallUI's 162,36,12 DARK
RED, not a brighter yellow; that is the one people guess wrong. The
spell maker, the item maker, the travel map's teleport list and the
quest journal all want this window next.

**The chain order is the parity that matters**, and each half is
pinned: training checks gold BEFORE the picker opens, so a player who
cannot pay never sees the list, and checks the skill cap BEFORE taking
payment, so a too-skilled pick costs nothing. The donation field opens
pre-filled on "1000", is numeric-only, caps at 8 characters, and does
NOTHING AT ALL on an unparsable entry - `int.TryParse` has no else.
The free-holiday cure fires on OPEN, before any question and with an
empty purse.

**Two defects the live probe found, both fixed here.** A window that
dispatches to another window was nulling the second one through its own
`onClose` - the port's overlay slot is single, where DFU has a stack -
so the join welcome and every service flow vanished the moment they
opened; the identity guard fixes it. And the picker's handler ran
AFTER the queue advanced, which emptied the queue, closed the window
and threw the result box away: the skill trained and "You and the
trainer practice for 3 hours" never appeared.

**Probed live end to end** (`tools/guildServiceProbe.mjs`): in the
Mages Guild, join -> TEXT.RSC 606 with Yes/No -> the 5293 welcome ->
membership stored under group 10 at rank 0 -> the popup redraws on the
MEMBER art -> "Training will cost you 100." with %a expanded -> the
picker with the guild's twelve TRAINING skills -> 100 gold taken, 15
uses tallied against Alteration, and the 5221 box.

FLAGGED: the scroll bar does not drag (the two paging buttons and the
keyboard cover the list), and DFU's ListBox selects on the first click
and USES on the second, where the port picks straight through - a
one-shot service list has nothing to preview.

## U25 - POINT-AND-CLICK USE, and the real item info (2026-08-19)

`src/systems/useItem.js` (DaggerfallInventoryWindow.UseItem :1661-1817
+ the DaggerfallUnityItem predicates and NextVariant),
`src/systems/itemInfo.js` (ItemHelper.GetItemInfo :748-817 + the
DaggerfallUnityItemMCP macros), and the wiring in
`src/ui/nativeInventory.js`. `test/useitem.test.js` (12),
`test/iteminfo.test.js` (9), `test/nativeinventory.test.js` (+4).

**The Use button has existed since U8d and did nothing.** The mode
selected and every click fell through - the header said so, twice, for
five slices. This is the branch table behind it.

**The ladder's ORDER is the law.** A book is checked before "is it a
potion", a light source before the oil that refuels it, and the
catch-all is NextVariant - which is why clicking an ordinary shirt in
Use mode CYCLES ITS COLOUR rather than doing nothing. Only twenty-four
garments can do that; DFU names them by hand and calls four of the
others "unchangeable" in the enum itself.

**A light source is the one item Equip mode does not equip.** DFU's
local-list click handler routes `IsLightSource` to `UseItem` from the
EQUIP arm (:1976-1985), which is how a torch is lit in play. The port
flagged this from U8g and it is closed here. `IsLightSource` also
spans two groups - the Holy candle is in ReligiousItems, not beside
the torch - which is the sort of thing a hurried port drops.

**THE DRUG BUG, preserved.** DFU's drug arm is
`InflictPoison(player, player, (Poisons)item.TemplateIndex + 66, true)`
under a comment reading "Drug poison IDs are 136 through 139. Template
indexes are 78 through 81, so add to that." 78 + 66 is 144, not 136 -
the constant wants to be 58. `Poisons` has no member 144, so
`GetClassicPoisonEffectKey` formats "Poison-144", nothing is
registered under that key and `AssignBundle` instantiates nothing:
**using a drug in Daggerfall Unity does nothing at all, silently, and
eats the item.** Ported verbatim, recorded in Ledger B, and pinned so
a later reader cannot quietly "fix" it. `startPoison` now refuses an
unregistered type rather than indexing past its own timing tables -
which is the faithful translation of "no effect under that key", not a
guard bolted on.

**The info panel is real at last.** U8e invented three lines (name /
weight / value). DFU picks one of THIRTEEN TEXT.RSC records by group
and template and fills its macros from the item, so a sword, a shield,
an arrow, a soul trap and a letter of credit all read differently -
which is most of what the panel is for. An arrow's record has no
condition line at all; a helm and a shield never show their material
under classic's own setting default; an artifact never shows one at
all. Both of DFU's surfaces now draw: the Info-mode click box on the
U11 parchment (with TEXT.RSC 1016, "Item powers", queued behind it for
an enchanted item), and the small `itemInfoPanel` at (223,145,37,32) -
a 50x37 cutout of ITEM00I0 at `TextScale` 0.43 with `ExtraLeading` 3,
which needed a source-rect-to-destination-rect blit
(`nativePanel.drawImgCrop`) the port did not have.

**WAGON and GOLD were never mode buttons.** They ACT (:1234-1285), so
selecting them as a mode was always wrong. The wagon answers "You
don't own a wagon." - which is the RIGHT answer and not a placeholder,
since the port has no Transportation items - and the gold button opens
the drop-gold field, TEXT.RSC 25, numeric and eight characters, which
REFUSES an amount below 1 or above what the player carries rather than
clamping it.

**THE FOUR HOSTS, named.** `exterior.js` and `world.js` build the
native window (twice each - bare, and over a loot pile), and all four
sites are swept by a test, because a hook added to three of them is
exactly what THE ONE CONSTRUCTION SEAM exists to catch.
`worldModes.js` opens no inventory of its own. `dungeonContext.js`
STILL CONSTRUCTS the old keyed `ui/inventory.js` window, so a dungeon
has no Use mode, no paperdoll and no real info panel - the last host
without the real inventory. Pinned both ways and routed to U26.

**Probed live**: the info box reads "Book by Anonymous | Worth: 2500
gold | Weight: 6 kilograms" off record 1009 with a stack's weight; an
equip-click lights a torch and a use-click douses it; a shirt cycles
its variant; the wagon says its line.

## U26 - THE DUNGEON GETS THE REAL INVENTORY (2026-08-19)

`src/scenes/dungeonContext.js` + `src/scenes/dungeon.js` +
`src/ui/input.js`; the keyed `InventoryWindow` in what was then
`src/ui/inventory.js` (DELETED as a path at U42, when the last window
left in it made it `src/ui/deathScreen.js`) is DELETED.
`test/nativeinventory.test.js` (+2 sweeps).

**The last host without it.** The exterior hosts moved to the classic
window at U8d; the dungeon kept a text list, so underground there were
no tabs, no paperdoll, no info panel and - after U25 - no Use mode,
which is precisely where a torch gets lit. U25 pinned that gap BOTH
ways and the pin went red the moment this slice closed it, which is
what a both-ways pin is for.

**Three things the swap needed, and they are why it was a slice.**

1. **A ground pile.** `droppedLoot` was written host-agnostically at
   U8e (renderer + getTexture + uploadRecordFrame) and had simply
   never been mounted here, so a Remove-mode drop in a dungeon had
   nowhere to land. It now mounts, draws in the same billboard pass as
   the sprite mobiles, offers its piles as activation targets, frees
   emptied ones when the window closes, and frees every batch when the
   dungeon is destroyed.
2. **Raw key codes.** `routeKey` handed every overlay an ACTION
   (`back`/`confirm`/`up`) - the keyed windows' vocabulary, which
   cannot express F6, a mode button or a digit. `ui/input.js` now
   passes the code through for a native window, exactly as townTalk's
   seam has since G2, and `typedChar` is the one reader that
   understands both hosts' vocabularies.
3. **LOOT OPENS THE WINDOW.** `takeLoot` used to vacuum a whole
   container into the pack on one keypress. PlayerActivate makes the
   container the inventory's REMOTE TARGET and lets the player choose,
   with the window opening in Remove mode (the OnPush law U8e already
   ported). Both dungeon hosts - the standalone scene and the
   world-modes machine - route the new `droppedLoot:` prefix; the
   probe found the pickup half missing when only one of them had it.

**Two defects the probe surfaced on the way.** The shot-mode frame
counter sat AFTER the overlay branch's early return, so `__frame`
froze the instant any overlay opened - and this repo's Process rules
forbid a probe from sleeping, so an overlay made frame-syncing
impossible in this host. And a native window handed the VIRTUAL canvas
plus a screen offset letterboxes itself twice: its opaque backdrop
then covers only the virtual rect and the dimmed world shows through
the bars. That is AUDIT 19 F2's defect for the seventh time; a native
window now gets the real canvas and no offset.

**The paperdoll came too**, and this host is the one that can ask for a
non-town backdrop: `CONTEXT_BG` has mapped `dungeon` to SCBG07I0 since
U8f with no caller, because the town hosts only ever want SCBG04I0.

**One equip model, finally.** This host carried its own equip hook with
its own career gate - AUDIT 17e F17's point, made twice. The window
owns equipping now, so the duplicate is gone, and `ui/inventory.js`'s
keyed window with it: nothing imported it any more, and its one law
(EquipItem excludes exactly Weapons/Arrow) was never the window's -
it lives in `systems/equip.js`, which every host reaches.

**Probed live** (`tools/dungeonInventoryProbe.mjs`): F6 through the
real key path opens `NativeInventoryWindow`; the info box reads "Steel
Broadsword | 1 - 12 points of damage | Condition: Used | Weight: 5
kilograms"; an equip-click lights the torch; Remove drops the sword,
the pile mints with its flat, and activating it reopens the window
with the pile as the remote target.

## U27 - THE WIZARD'S BACK DOOR (2026-08-20)

AUDIT 23 ui-chargen-4. Backing out of the race screen - the wizard's
first - was a silent no-op; DFU cancels the WHOLE wizard there:
RaceSelectWindow_OnClose's Cancelled arm nulls the race template and
re-pushes nothing (DaggerfallStartNewGameWizard.cs:299-302), so the
UI stack unwinds to the start screen.

The port's split: the FLOW flags it (`cancelled` - set only by the
race screen's back with no description box open; the box's No still
just closes the box, and deeper backs still walk the wizard),
createChargenWindow fires `onCancel` exactly once on the same
modal-contract latch onDone rides, and each HOST owns its unwind -
a `location.reload()` to the boot flow's front door. On the bare URL
that lands back on title -> main menu, DFU's unwind exactly; on a
dev-scene URL (?world with no ?class) it re-offers the wizard fresh,
which is what SetRaceSelectWindow's Reset() does on re-entry anyway.
The dungeon host's arm rides tickOverlay (it drives the RAW flow,
not the window), so the classic-start path cancels too.

Mutations: 3 run, 3 killed (the flag dropped back to the no-op; the
once-latch dropped so onCancel refires; the modal back cancelling
the wizard).

Pins: test/uicancel.test.js x3 (the flag - first-screen back sets
it, the gender walk-back does not, the description box's No never
does; the window - Escape fires onCancel once and goes dead with
onDone untouched; the host sweep - the dungeon tickOverlay arm and
both exterior hosts' onCancel reloads).

## U28 - THE WAGON (2026-08-20)

The oldest inventory residue clears: U26's button answered "You
don't own a wagon." and nothing else. The W-slice ships
DaggerfallInventoryWindow's whole second inventory:

- **The button ladder** (:1234-1243): no Small Cart (Transportation
  template 93) in the bag -> the noWagon box; inside a dungeon
  without access -> exitTooFar; else ShowWagon toggles. The click
  sound rides every arm.
- **ShowWagon** (:1047-1080): the port's `_remote()` is computed,
  so DFU's lastRemoteItems save/restore collapses into
  `usingWagon ? wagonItems : loot ?? dropped` - the same truth,
  no stored swap. The remote scroll resets on toggle.
- **The 750kg gates**: a local Remove click INTO the wagon runs
  WagonCanHoldAmount (:1425-1434) - ComputeCanHoldAmount over the
  cart's load in GP-units - refusing at zero fit
  (cannotHoldAnymore) with no click sound, split-taking a partial
  stack exactly as the items-9 carry gate does. The drop-gold
  field clamps to the headroom with the wagonFullGold box
  (:1296-1303); DFU would mint a 0-gold stack when the wagon is
  dead full - guarded, Ledger A.
- **CheckWagonAccess** (:1082-1116): the dungeon arm - the cart in
  the bag AND the player within 5 units of an EXIT door
  (DungeonWagonAccessProximityCheck's radius). A no-loot open
  lands straight ON the wagon in Remove mode - the classic
  leave-the-haul-at-the-entrance flow; a loot open keeps the pile
  as the remote with the button now able to toggle. The port
  decides ON OPEN (per-window), collapsing DFU's cross-open flag
  lifecycle into the same observable behavior.
- **The save halves**: playerEntity.wagonItems beside items in the
  envelope (SerializablePlayer carries wagonItems); pre-W saves
  restore an empty cart. All five window constructions hand
  `wagonItems`; the dungeon host hands the exit-door proximity.

Prose flags: exitTooFar/cannotHoldAnymore/wagonFullGold keys cited,
prose ours pending a string source (the established pattern).
RESIDUE: the wagon weight label ("x / 750" on the remote icon) is a
drawing note; DFU's on-foot gate rides the transport arc.

Mutations: 4 run, 4 killed (the exitTooFar gate dropped; the wagon
transfer gate dropped; the no-loot auto-open dropped; the gold
clamp dropped).

Pins: test/wagon.test.js x4 (the ladder incl. the dungeon refusal
and the toggle's remote identity; CheckWagonAccess's three opens -
no-loot-on-the-wagon-in-Remove, loot-keeps-the-pile,
no-cart-never-grants; the 750kg gates - the 375-of-400-books
split-take, the zero-fit refusal, the 4000-gold headroom clamp
with its box; the save/wiring sweep).

## U29 - THE LAUNCHER, and settings that are actually settings (2026-08-21)

The SETT-slice. Mac asked what DFU's pre-splash screen is called; the
answer (`DaggerfallUnitySetupGameWizard`, not the classic start menu)
exposed that the port had no settings at all - every value it branched
on was a constant, recorded that morning as a Ledger row saying so.
The row lasted a few hours.

**The store** (`systems/settings.js`) is DFU's SettingsManager. The 13
sections, 171 keys and every default come from the VENDORED
`defaults.ini.txt` (`vendor/dfu-settings`, MIT, the same route the
quest pack took) baked by `scripts/bakeSettings.mjs` - hand-copying
171 defaults is the lossy-second-copy shape AUDIT 17e F9 caught in the
item templates, so the bake reads the real bytes and a pin asserts
baked === vendored. The typed getters are verbatim INCLUDING their
failure modes, which are quirks rather than accidents: `GetBool` reads
FALSE on an unparseable value (not the default, :921-936); `GetInt`
with a range clamps and reads MIN on failure (:952-964); `GetFloat`
likewise; `GetString` is raw.

**Ours** (the Ledger-A split): where the values live - DFU writes an
ini beside the executable, a browser has none, so the store keeps a
DELTA against the defaults in localStorage, which also means a later
DFU default still reaches a player who never touched that key. And
the TIERS, which are a claim about this port rather than about DFU:
`live`, `stored`, `unavailable`.

**Seven settings went LIVE** - each one a real consumer, because a
toggle that changes nothing is a lie: CombatVoices (the three voice
gates), PlayerTorchFromItems (the kit seam), LoiterLimitInHours (the
cap AND the refusal line that quotes it), SoundVolume (a new master
bus in audio.js - one gain node every source routes through, rather
than four call-site multiplies), MusicVolume (songPlayer's master,
under the port's own MUSIC_GAIN headroom), MouseLookSensitivity and
InvertMouseVertical (`ui/lookSettings.js`, ONE home for the three
hosts that each carried a bare 0.0025). All are read AT THE POINT OF
USE, as DFU reads them, so a change lands on the next swing rather
than the next reload.

**The launcher** (`ui/launcher.js`, DELETED at MENU - see U30 - + `scenes/launcherScene.js`) was one
keyed native screen over all 171: `[`/`]` for sections, arrows to
change, R to reset, Enter to play. It lists settings it will NOT let
you change, with their reason, rather than hiding them - the same
doctrine as the port's INTERIM flags, and the only honest way to show
a player why Daggerfall's enhanced AI is missing here. The boot gate
is verbatim (`SceneControl.cs:46` / wizard `:154`): the ARENA2 pick is
our GameFolder stage, then `GUI/ShowOptionsAtStart` - which DFU ships
TRUE, so the launcher appears every boot until turned off - with
`?launcher` as the held-key analogue.

THE DIVERGENCE SURVIVES AND IS NOW ENFORCED: EnhancedCombatAI ships
True in DFU and is False here (the classic AI). It is tiered
`unavailable` with that reason on screen, not offered as a toggle.

Pins: test/settings.test.js x5 (the bake against the vendored bytes;
the getters' failure modes; the delta/reset behaviour; the LIVE tier
proven by driving each consumer; and the tier map's honesty - which
caught TWO lies in the map while this slice was being written, naming
music.js and input.js for consumers that live in songPlayer.js and
lookSettings.js). Two pins repinned to the evolved truth (c2combat's
COMBAT_VOICES constant, restwindow's LOITER_LIMIT_HOURS).

PROBED LIVE (tools/launcherProbe.mjs): the launcher comes up BEFORE the
game, lists real settings with all three tiers on screen, a keypress
flips PlayerTorchFromItems False -> True with the store agreeing and
the change persisted, an unavailable setting REFUSES with its reason
printed, and Enter launches past it - zero page errors. The first
draft of that probe asserted on document.body.innerText, which is
empty for a canvas app, so three of its four checks were meaningless;
it was rewritten against a new window.__launcher surface (the
__talk/__climb house pattern) that reports the screen's own state.

## AUDIT 24 (2026-08-21): the settings/launcher pass

A comprehensive audit run over the newest code - the SETT slice was
hours old and had never been read adversarially. Five findings, one
severe; one suspicion refuted by measurement; one parity claim
verified.

**F1 - THE FOURTH HOST.** The mouse-look settings reached
world/exterior/dungeon and missed `scenes/interior.js`, which is a
real reachable host (`?interior=`, fly camera): sensitivity and invert
were live in three hosts and dead in the fourth. The FOUR HOSTS rule,
caught again, this time on code a few hours old. Fixed; pinned across
all four with a no-raw-constant assertion.

**F2 - THE LAUNCHER TRAPPED EVERY TOUCH DEVICE (severe).**
`launcherScene.js` registered only `keydown`, while every other
pre-game screen takes `pointerdown` (menu.js:95, :143) and every
playable scene calls `attachTouch`. With `ShowOptionsAtStart` shipping
True, a phone booted straight into a screen it could not dismiss - the
game was unreachable. PROVEN on an emulated Pixel 5 before the fix
(taps and clicks did nothing) and after (dismissable). The file's own
header carries the NEVER TRAPS law it was breaking.
  The first fix was itself wrong and the check caught it: `PLAY` sat at
  a fixed `x + 200 * s`, which falls off a narrow canvas - the button
  was drawn where no finger could reach. The layout is canvas-relative
  now, and the pin asserts every control lands inside a 393px canvas.

**F3 - A TIER THAT LIED.** `GUI/ShowOptionsAtStart` has a real consumer
(main.js reads it as the launcher gate) but was tiered `stored`, so
the launcher told the player "no consumer in this port yet" about the
single setting that controls the launcher.

**F4 - THE PIN THAT LET F3 SHIP.** The tier-honesty pin was
ONE-DIRECTIONAL: it proved every LIVE key has a consumer, and nothing
proved the reverse. That is exactly AUDIT 18's open-flags idiom
("agree BOTH ways") left half-applied. The missing half now re-derives
every settings read under `src/` - walking the tree at test time, never
from a checked-in list - and fails on any key read but not tiered
live. Re-introducing F3 makes it fail by name.

**F5 - NO WAY BACK.** DFU reaches settings in-game from
DaggerfallPauseOptionsWindow; this port has no pause menu, so turning
ShowOptionsAtStart off hides settings for good. Routed as a Ledger row
and MITIGATED: the launcher warns at the moment of the choice and
names `?launcher`. Found unpinned by the audit's own mutation run (m4
survived), which is what the warning's pin now closes.

**REFUTED by measurement.** The suspicion that CH4's senses cadence
change (16Hz -> 60Hz detection) had regressed the C11 lag fix:
tools/colliderBench.mjs on the real Privateer's Hold collider reports
IDLE 60fps 0.63 ms/frame against a ~0.7 baseline and NEAR 10fps 57.31
against ~65. No regression - the FOV and range gates short-circuit
before the raycast for most foes. Recorded because a refuted suspicion
is a finding.

**VERIFIED.** SoundVolume's composition: DFU applies it as a linear
multiply on the source volume (`volumeScale * Settings.SoundVolume` -
EnemySounds.cs:112, AmbientEffectsPlayer.cs:190), which is exactly
what the SETT master bus does (per-source gain upstream of one master
gain). Parity confirmed rather than assumed.

Mutations: 4 run, 3 killed on the first pass and m4 (the lock-out
warning) SURVIVED unpinned - pinned, re-run, killed. Pins: 4 added to
settings.test.js; the touch guard folded into tools/launcherProbe.mjs
so the trap cannot come back silently.

## U30 - THE SETTINGS MENU: a home for every setting (2026-08-21)

U29 gave the port a launcher and a real 171-key store. It was still a
*list*: one flat column of ini keys, tier-filtered, readable by someone
who already knew what `LypyL_GameConsole` meant. The ask was the other
half - "game settings need a home, audio needs a home, graphics needs
a home, the future mod manager needs a home", organised and readable
for a casual player. This is that screen.

**The shape.** Seven categories (`settingsMap.js`), TOTAL and DISJOINT
over all 171 keys: Game, Controls, Audio, Video, Interface,
Accessibility, Mods (21/16/5/66/37/19/7). A key with no home would
simply vanish from the screen, so the totality is pinned, and so is the
count vector - a re-bake that renames a key fails the build instead of
silently dropping a row.

**DEPARTURE (declared in the map itself).** DFU's own settings UI has
five pages (`DaggerfallAdvancedSettingsWindow.cs`), with audio living
inside gamePlay's right column and the mod system inside enhancements.
This port promotes **Audio** and **Mods** to their own categories. The
reason is the ask, not taste: audio is the first thing a player looks
for and the second thing this port can actually honour, and the mod
manager is a room that must exist before it has furniture. Everything
else follows DFU's grouping. The `.ini` sections are untouched - this
is a presentation map over a verbatim store, which is exactly the line
the port draws between logic and presentation.

**TIER IS A GROUP, NOT A FILTER.** The store's three tiers (8 live,
145 stored, 18 unavailable) are three collapsible groups per category
with computed headings - "WORKS NOW (2)", "SAVED FOR LATER (17)",
"NOT AVAILABLE HERE (2)" - and the header sentence is built from the
same tally. Nothing is hidden: a folded group still states its count,
because a setting a player cannot find is worse than one that says it
is waiting. An unavailable row never offers a control that cannot
move, and never prints its stored value - `EnhancedCombatAI` holds
DFU's shipped `True` while this port runs the classic path, so drawing
"On" would be a lie. It reads `classic`, with a sentence saying what
runs instead. All four properties are pinned.

**The words are DFU's.** Labels and help text come from the vendored
`GameSettings.txt` where DFU has them (`settingsText.js`, ~64 of 171
keys - the honest measure of how much of the store DFU's own UI
exposes at all), and from `settingsCopy.js` where it does not. The pin
is negative and total: no label may carry camelCase or an underscore,
and no copy anywhere may call this port's own gaps broken, missing or
unsupported.

**THE RANGE-EQUALS-CLAMP LAW.** A slider offers exactly the travel its
consumer honours - no more. `NUMBER_LAW` states a range and its
source, and the pin re-derives each live consumer's own
`getInt/getFloat` bounds at test time and compares. This caught a real
parity bug on its first run: `LoiterLimitInHours` had been given an
invented 1..24, where DFU's own slider is `AddSlider("loiterLimit
InHours", 3, 12)` (`DaggerfallAdvancedSettingsWindow.cs:354`). The
consumer in `restSession.js` was wrong, not the screen; both now read
3..12. `MouseLookSensitivity` runs to 4.0 here rather than DFU's 16.0
for the same reason in the other direction - `lookSettings.js` clamps
at 4.0, and a slider whose last three quarters did nothing is the same
lie as an inoperable control.

**The phone.** `settingsMetrics.js` exists because `nativeMetrics`
gives scale 1 - seven-pixel text - on every phone the design workflow
measured. It keeps the classic 320-wide page wherever it fits at scale
2+, and falls back to an elastic COMFORT page (a real phone lands at
196x363, scale 2, 14px text) rather than shrinking the type. Then
`tools/settingsProbe.mjs` drives the real screen in a real browser at
1280x800 **and** at phone size with touch emulation, tapping only the
rects the screen itself reports through `window.__settings` - the same
`layout()` that `draw()` and `click()` read. It found a defect on its
first run that eight viewports of unit tests had not: rows were a
44px tap tall, but the control *pill* inside was inset by four, so the
thing a finger actually aims at was 36 CSS px. Drawn size and target
size are two rects now (`ctrlRect` and `ctrlHit`), and both the probe
and a new offline pin hold them apart. The probe also converts canvas
pixels to CSS pixels through the element's real box before judging a
finger, because a DPR-scaled canvas would make a 44-canvas-px target a
16-CSS-px one and the check would pass while the screen stayed
untappable.

`src/ui/launcher.js` is DELETED; `SettingsWindow` replaces it whole,
and `launcherScene.js` routes pointer, wheel and key input to it.

Mutations: 5 run, 5 killed (two needed re-running - the first attempt
edited text that was not there, which is itself the reason a mutation
run reports its own match count now). Pins: 8 in `settingsUI.test.js`,
plus the live probe.

### U30 addendum - what the merge with the F2 lane cost, and found

Two things came back from `origin/main` that this slice had to answer
rather than absorb.

**Carried, not lost.** The launcher's own merge audit had fixed a
defect this rewrite deletes the code for: `stepFor` read the step off
the CURRENT value (`0.1` only while the string contained a `.`), so
stepping `0.9` up stored `"1"`, which has no `.`, and the next press
stepped by ONE - a player who muted SoundVolume could never reach a
fraction again, and the row displayed a `2` the audio bus clamps to 1.
`NUMBER_LAW` kills the first half structurally: the step is declared
per key and never inferred from a value. The second half was still
live here - `formatValue` printed the STORED number, so a store
holding 2 would read "200%" while the bus ran 1. It now shows the
value IN EFFECT, clamped to the same range the consumer's
`getFloat/getInt` clamps to. Both halves are pinned (T15), and the
retired launcher test's end-to-end walk is re-driven through the new
screen's own key input (T16). A defect fixed in deleted code stays
fixed.

**FOUND: the F2 real-seam test was RED, and had never run.** The
incoming lane's `F2 real seam` test is gated on `ARENA2_PATH`, so a
bare `npm test` skips it and reports green - it went in unexecuted.
Run with ARENA2 it failed twice over. First a `TypeError`: its fake
renderer had no `gl`, and `drawMenuBackdrop` measures the live context
when no canvas is passed (`chargenArt.js:82`). With that stubbed, the
real assertion failed - and the assertion was WRONG. It ticked the
player by zero and expected a frame, but `FLCPlayer.cs`'s Update order
displays the current buffer only once a frame delay has ELAPSED, and
`start()` clears the displayed frame; DFU shows its cleared texture
until the first delay passes. Asserting a frame on a zero-length tick
would have pinned the pacing law inside out, and the next person to
keep the law faithfully would have "broken" the suite. The engine was
right; the test is fixed to walk the clock, and it now proves the
whole path (nothing before the first delay, the frame after it, no
upload for a still frame, a new frame releasing the old key).

The lesson is the gate, not the lane: an ARENA2-only test that has
never been run with ARENA2 present is not a pin, it is a claim. Both
modes ran green before this merged.

## U32 - THE SHEET'S FOUR BUTTONS LEAD SOMEWHERE (2026-08-21)

Reported from play, alongside the sealed dungeon: *"the F5 menu, the
ones that have buttons that lead to other UI elements, doesn't
work."* Exactly right, and the code said so in as many words:

```js
// The remaining DFU buttons (... inventory/spellbook/logbook/
// history) pend their popups; consume the click so it never
// escapes the window.
return Object.values(R).some((r) => inRect(r, vx, vy));
```

Hit-tested, consumed, no action - for all four. AUDIT 18 had given
the sheet a `click()` so its EXIT button would stop falling through to
the host's pointer lock, and answered the rest by swallowing them. The
swallow was the right call then and became the bug.

**Two of the four were already built.** `NativeInventoryWindow` has
been the real inventory since U8d/U26, and `SpellbookWindow` has
carried DaggerfallSpellBookWindow's delete/swap/sort since U4/M4. They
were reachable by F6 and Backspace and by nothing else. Wiring them
was finding the caller, not writing a window - and ONE DFU MEMBER, ONE
EXPORT means the spellbook button opens THAT spellbook. A pin asserts
`SpellbookWindow` is declared exactly once, in the file it already
lived in.

**Two were new.** `playerHistory.js` (DaggerfallPlayerHistoryWindow)
and `questJournal.js` (DaggerfallQuestJournalWindow), both on
LGBK00I0.IMG - DFU's own choice: in classic your history and your log
are the same book. Neither needed new state. History reads
`playerEntity.backStory`, which chargen has composed since U13 and
`save.js` has round-tripped since; `chargenSession.js:170` names this
window in its own comment. The journal reads
`QuestMachine.getAllQuestLogMessages()` (already verbatim) and
`PlayerNotebook`, whose module has carried `MAX_LINES_QUESTS` /
`MAX_LINES_SMALL` all along, citing THIS window's `:34-35` for them.
The notebook was ported against a screen that did not exist yet; it
exists now and imports those constants from their one home.

**THE SHEET OWNS ITS CHILD.** DFU pushes these onto the UI stack, so
the sheet stays underneath and closing the child returns to it. The
port's hosts each hold one `activeOverlay` slot. Teaching four hosts a
stack is exactly the shape that produced the FOUR HOSTS rule - chargen
lived in one host once and a town boot ran a whole session on a
pre-chargen entity. So the sheet holds `this.child` and delegates
input, click, draw, tick and wheel to it while it is up; a finished
child pops and the sheet is there again. The host still sees one
window. Zero host divergence, and it is DFU's semantics rather than an
approximation of them.

**THE ANTI-LIE LAW.** The dungeon host has no quest bridge, so it
cannot see the quest log. It does not get an empty logbook - it gets a
refusal. "You have no active quests" told to a player who has three is
a lie, and the port does not report a thing empty when the truth is
that this screen cannot reach it. `charSheetHooks` withholds the
window entirely when there is no quest source, and the sheet says the
logbook is out of reach. Same for any host that cannot build a window:
a stated sentence, never the silent swallow that started this.

Verbatim geometry both ways, including DFU's own oddity: the history
window's previous-page button really is `14x48` at y 188
(`:64`), which runs 36px past a 200-tall panel. Almost certainly a typo
for 8. It is DFU's typo, the panel clips it to the same reachable
strip, and it is ported as written rather than silently corrected.

The journal steps by ONE ENTRY per arrow (`:271-283`), not one page -
the detail most likely to be "tidied" into paging by the next reader,
so it is pinned by name. History pages by whole 21-line pages, and its
exit REWINDS to the first page before closing (`:127`), so reopening
the book opens it at the start.

~~Not done here: the spellbook's native-art retrofit (SPBK00I0.IMG over
its text idiom), which rides its own slice the way the level-up
screen's does.~~ That slice is U42, below.

Pins: 7 in `charsheetnav.test.js`; 5 mutations, 5 killed.

## U33 / I1 - THE INPUT REGISTRY: InputManager's binding law (2026-08-23)

The port's keys were hardcoded twice over - `ui/input.js`'s
`gameAction` if-chain, and every host reading `keys.has('KeyW')` raw -
so nothing could ever be rebound, the settings window's controls
section had nothing to edit, and the main-menu hotkeys row sat on the
Ledger with no registry to land on. Port-Completion-Analysis called
the input layer the highest-leverage move left; this slice is its law
half. `systems/inputActions.js` cites `InputManager.cs` throughout.

**What is DFU's, verbatim.** The `Actions` enum (:324-384), names and
order. The 44-row `ResetDefaults` default table (:979-1032), KeyCode
translated to `KeyboardEvent.code` for the same physical key
('Mouse0'..'Mouse2' kept as Unity names them - left/right/middle).
Both binding dicts are CODE -> ACTION, DFU's orientation, with
SetBinding's exact order of operations (:727-758): steal the code from
the other dict, clear the action's old code in this one, then bind -
and binding a force-removed action un-removes it. The two clears
(:803-846), `AddRemovedPrimaryAction` (:795-798), `GetBinding` /
`GetBindings` (:641-724).

**The reset quirk, kept.** `ResetDefaults` full-mode clears the
primary dict and the removed list but NOT the secondary dict
(:956-960) - each default then steals its own code back out of the
secondary through SetBinding's alt-removal, and a secondary binding on
a non-default code survives the reset. Tidying that into "clear both"
reads more sensible and is not what DFU does; it is pinned as the
quirk it is.

**The autofill pass.** `TestSetBinding` (:1405-1422): a default lands
only if the action is missing, its code is free in BOTH dicts, and the
action was not force-removed. This is DFU's "push new actions into an
old KeyBindings.txt" startup arm (:445-448), and the both-dicts guard
earned its pin by surviving the first mutation round (M5).

**The save file.** `KeyBindData_v1`'s shape (:871-930) minus the
axis/joystick blocks the port has no engine for: `actionKeyBinds` /
`secondaryActionKeyBinds` as {keyString: actionName} plus
`removedPrimaryActions`. A NEWER build's unknown action names are held
and re-serialized rather than stripped (:899-916), unless the key was
rebound here - this build's meaning wins. Loading uses RAW adds
(:1950-1969), never setBinding: a hand-edited file binding two keys to
one action loads both, exactly as DFU's does. A removed-primary mark
only loads for a known action not currently bound (:1985-1991).
Persistence is its own localStorage key beside the settings store's,
as KeyBindings.txt sits beside settings.ini.

**The frame model.** currentActions/previousActions with
HasAction/ActionStarted/ActionComplete (:610-637) and the LateUpdate
swap, as `createActionState`/`endFrame` - the shape I2 wires the hosts
through.

FLAGGED at the module tail: key combos (GetComboCode :1165-1218 - no
default uses one), the axis/joystick layer, and the port's four
standing key departures (C cast, X crouch, E activate, V view) which
reconcile against this table in I2 as adoptions or Ledger-A rows.

Pins: 10 in `inputactions.test.js`; ten mutations, ten dead - two of
them (the alt-dict autofill guard, the unknown round-trip) added after
survivors proved the first pins too soft.

## U34 / I2 - THE HOSTS CONSUME THE REGISTRY (2026-08-23)

I1 shipped the law; this slice makes every gameplay key READ it. The
per-event routers (`routeKey`, the exterior hosts' hand-routed
F5/F6/Backspace arms) resolve through `actionOf(e)` and switch on
DFU's action names; the per-frame polls (`keys.has('KeyW')`, 69 sites
across five files) read `held(keys, action)` / `moveHeld(keys)`. Two
escapes stay raw, each visible in its line: the dev fly-camera
branches (`fly-cam (dev)`, counted exactly per host) and E-activate
(`I2 departure`, one line per host - DFU activates on Mouse0 and E is
AbortSpell; the pointer-parity slice owns that move). The sweep in
`inputmap.test.js` enforces the rule the AUDIT 21 F2 way: any bound
code read raw outside a marked escape is red, and a bogus escape
marker is red too because the counts are exact.

**Departures retired (each sentence deleted at its site):**
- **C-cast / X-crouch.** DFU has no cast key: `CastSpell` (Backspace)
  OPENS THE SPELLBOOK - GameManager.cs:550-553, which is literally
  what the port's Backspace already did under another name - and a
  readied spell fires on the attack click. C now crouches (DFU's
  default), X is unbound, and a player can rebind either.
- **The V third-person toggle** (exterior.js only - ?world never had
  it). V is DFU's TravelMap default and the ?world host already
  consumes it there; third person rides the ?tp URL param in both.
- **The touch cast button.** The armed cast fires on the attack tap,
  same as desktop; the spellbook button stands.

**Three real parity bugs the live probes forced out:**
1. **The click latch could desync from the readied spell.** DFU's
   armed state IS `readySpell != null` (EntityEffectManager.cs:250 -
   CastReadySpell fires on ActivateCenterObject when a spell is
   readied, and casting clears it). The port mirrored that in a
   separate OneShotLatch that only `readySpell` armed -
   `setReadiedByIndex` set the spell and not the latch, so a
   boot-readied spell could never click-cast. The latch is DELETED;
   `spellArmed`/`interceptAttack` derive from `readiedSpell`.
2. **A sheathed player could not cast.** dungeonContext's
   `playerAttackInput` gated on `playerWeapon.sheathed` BEFORE the
   cast intercept. DFU's cast is EntityEffectManager's own Update - a
   separate component from WeaponManager - so the sheath gates only
   the swing. Reordered; the cast probe pins it (mp 140 -> 60 with
   the weapon away).
3. **A ByTouch whiff now KEEPS the ready.** The old latch consumed
   the armed state on a missed touch, so the next click swung. The
   port's own audited ByTouch law ("CastReadySpell aborts BEFORE
   spending when no target sits in touch range") returns without
   clearing `readiedSpell` - DFU's next click retries the touch. The
   cast probe's whiff expectation was re-aimed at the law it already
   cited.

**Probe-fleet repairs riding along** (all red on BASELINE, none ours):
the quest arc's boot boxes - the start letter (any key advances) and
the tutorial YesNo (answers ONLY Y/N/Escape) - eat the keyboard until
dismissed, so castProbe and travelProbe drain them with Escape before
driving keys; `__travelNearest` now honours G8's hidden-dungeon gate
(it named a hidden coven the map's search can no longer list); the
travel probe tolerates this box's CURSOR.IMG 404 the way the others
do. All green after: cast in all three hosts, travel end to end
(clock +1060, pixel exact, gold paid), crouch on C live
(eye 1.7 -> 0.8 -> 1.7), X inert.

Pins: 7 in `inputmap.test.js` (the sweep + exact escape counts + the
registry reads); 3 I2 mutations dead on top of I1's ten.

## U35 / I3 - THE PAUSE OPTIONS WINDOW: Escape finally answers (2026-08-23)

DaggerfallPauseOptionsWindow on the real OPTN00I0.IMG (150x84, centred
with DFU's own y=40 - alignment overrides position PER AXIS, so the
declared y applies where the guild popup's did not). Until this slice
the port had no pause menu at all; the Ledger's "the launcher is the
ONLY door" row is struck.

The geometry is DFU's, rect for rect (`:86-141`), including the two
toggle ticks at (64,3.2,3.7,3.2) and the three 109.1-wide bars with
their (0,1,w,3.5) fills in Color32(146,12,4) - the checkbox toggle
colour every DFU window shares. The bar click law is verbatim
(`:230-241`): the sub-1%/over-99% snaps and the two-place rounding,
with the boundary pinned just inside the band because the exact edge
is a strict float compare no multiplication can land on.

Escape opens it in ALL FOUR HOSTS through I2's registry - routeKey's
Escape case for the two dungeon contexts (threading the host's
position applier so the LOAD arm can move the player), hand-routes in
the exterior pair, and worldModes' own interior arm - and the same
key toggles it closed (`:186-190`; DFU keys on the UP edge, the
port's overlay channel on DOWN, one edge earlier, recorded). PAUSING
COSTS NOTHING: the hosts' overlay-hold law (AUDIT 18 F9) already is
Time.timeScale = 0.

Save/Load ride the quicksave with DFU's IsSavingPrevented gate kept
("You cannot save the game right now." where a host has no save
path - the block-test exterior and interiors today). EXIT confirms on
TEXT.RSC 1069 then takes `exitToTitleMenu` - the ONE bare-URL unwind,
now also the death sequence's last line (dfuiExitGame is
Application.Quit; a browser has no quit - Ledger A). The sound/music
bars write their LIVE keys; the detail bar, FULL SCREEN (DFU's quirk
kept: the button flips LargeHUD, the tick shows its negation) and
HEAD BOBBING write stored-tier keys through `effectiveSettings` - the
settings MENU's own display surface, because the tier doctrine
reserves the typed getters for keys whose value changes play (the
tier guard caught the first draft reading them raw). The saveSettings
LATCH is DFU's: nothing persists until a control was touched, then
the store saves on close - and the probe's first draft "proved" the
bar wrote by reading the DEFAULT back (0.5 IS the ini default and the
sparse store drops default-equal writes); it clicks 0.25 now.

Pending, stated in-window or at the site: the CONTROLS button answers
with a note until I4's rebinding grid; the multi-slot save window;
PauseOptionsDropdown (a DFU-era addition, with the settings arc).

Pins: 7 in `pausewindow.test.js` (geometry literal-for-literal, the
bar and detail laws, the confirm/save/load flows, the four-host
wiring sweep); five mutations, five dead. Live: tools/pauseProbe.mjs
- Escape opens over a real dungeon, the bar write survives the close,
N declines the exit, Escape toggles both ways.

## U36 / I4 - THE CONTROLS GRID: keys rebind at last (2026-08-23)

DaggerfallControlsWindow on CNFG00I0.IMG, with CNFG00I1's
mouse-look-alt panel at (152,100,168,45). The grid I1's registry has
been waiting for since the arc opened, and the last piece of the
Ledger's KEYBINDING REGISTRY row.

**The staging law** (`systems/controlsConfig.js` = ControlsConfigManager
minus its combo arms): the window edits a COPY of both binding dicts,
and nothing reaches the live registry until it closes. `GetDuplicates`
answers which codes repeat (unbound never counts, however many actions
share it); `CheckDuplicateKeyCodes` returns them as data - red for a
clash INSIDE the shown dict, DFU's blue for one across the two - and
`ok` is DFU's own `noRedDupes && cross == 0`: BOTH kinds block the
exit. The cross check dedupes each dict first, so an internal pair
does not double as a cross clash (a mutation proved that arm real).

**THE APPLY CONTRACT, found by a failing fixture.** `SetBinding`
steals a code from whoever holds it, so applying a set where two
actions share one code is ORDER-DEPENDENT: the later action wins and
the earlier ends up unbound. DFU's `SetKeyBindValues` has exactly this
shape and never reaches it, because the window refuses to close while
duplicates exist. That is *why* the gate blocks the exit rather than
merely colouring the labels. Both halves are pinned together so nobody
"fixes" the apply and quietly retires its guard. The removed-primary
mark rides the TRANSITION, not the state - applying an unchanged set
marks nothing, which is what makes reopening the window and pressing
CONTINUE harmless (the mutant that reads it as state survived the
first round and earned its own pin).

**The grid** is Actions[2..40) - thirty-eight buttons in nine groups
at DFU's first-setup anchors, 47x7 on an 11px stride. Six actions are
NOT offered (Escape, ToggleConsole below the range; QuickSave,
QuickLoad, PrintScreen, AutoRun past its end) - DFU's own omission,
kept and pinned by name. Left-click captures the next key (ReservedKeys
is empty in DFU, so Escape binds like any other); right-click prompts
to remove; DEFAULT confirms through the registry's own reset; CONTINUE
on a clean grid applies and saves. The prompts are Internal_Strings'
own, recovered - "You have multiple assignments...", "Are you sure you
want to set default controls?", the removeKeybind format with its
camel-split action name and full key text - and the pause window's
cannotSaveNow line was corrected to the real string in the same pass.

**One construction seam.** `openPauseFlow(show, hooks)` builds the
pause window with its controls round trip once; each host passes only
its own slot assignment. The U24 dispatch law holds at both ends: a
window that opens another marks itself done FIRST and the host's slot
assignment replaces it. A test forbids any host from hand-rolling
`new PauseOptionsWindow` past the factory.

DFU's UpdateKeybindButtons re-anchors every group one pixel up-left
after the first rebind (56,12 against 57,13), so its labels shift by
(1,1) mid-session. The port draws from ONE table; reproducing the
drift would need a second layout table whose only purpose is to lie
identically, so it is recorded here instead.

Pins: 8 in `controlswindow.test.js`; seven mutations, seven dead - two
of them (the unconditional rebind, the per-dict dedupe) added after
survivors showed the first pins too soft. Live: tools/pauseProbe.mjs
now drives the whole trip - Escape, CONTROLS, rebind MoveForwards from
W to P, CONTINUE, back to the pause window, with the new binding in
storage and the old one gone.

## U37 - THE TOOLTIP, and the hover seam it forced (2026-08-23)

ToolTip.cs on the native idiom - and with it THE MOUSE-MOVE SEAM the
port has been missing since U25 flagged it on the inventory's info
panel. DFU's tooltip is a shared component every button points at; the
port has no retained widget tree, so a window owns one, tells it the
hovered text each frame, and draws it LAST - DFU's own order, where
the tooltip is the final component in the canvas.

The law is small and every line of it is pinned: margin 2 all round,
MouseOffset (0,4), rows split on `\r` with the two-character ESCAPED
form collapsed first (text read from a plain-text file carries the
escape, not the control character), and the box sized
`glyph * rows + margins - 1`. That **-1 is DFU's own**, per box rather
than per row, and it is pinned as such so a "rounding cleanup" cannot
quietly take a pixel back.

**The edge handling is a SHIFT, not a flip.** A box past the right or
bottom edge is pushed back by exactly its overflow and ends flush
against the edge; it never mirrors to the other side of the cursor.
That is the detail most likely to be "improved" by someone who has
seen other tooltips, so it has its own pin with the flip as the
mutant.

**Four settings stop being furniture.** `GUI/EnableToolTips`,
`ToolTipDelayInSeconds`, `ToolTipTextColor` and `ToolTipBackgroundColor`
all shipped stored-tier with no consumer. They are LIVE now, and the
two colour defaults (404040D2, E6E6C8FF) are cross-checked against
DaggerfallUI's Color32s - which is what lets the settings store be
their one home instead of a second copy in this module. The delay is a
REST, not a dwell: crossing to a different tip restarts its clock,
resting on the same one keeps accumulating.

**The seam.** `overlayHover(vx, vy)` on the dungeon channel and
`hover(e)` on townTalk's, with all four hosts routing mousemove into
one of them before their look gate - a window frees the mouse, so an
open overlay gets the hover rather than a look delta the pointer lock
would refuse anyway. `tick(dt)` is the clock, which is the name the
hosts' overlay seam ALREADY called: one per-frame hook, not a second
beside it.

**The first consumer is I4's grid**, and it is DFU's own use: a key
button offers a tip only where its label ELONGATED (SuppressToolTip,
:214-216), and the tip is then the full text the `...` stands in for.
The inventory's hover fill is now a narrower flag than it was - the
seam exists; that window needs its own `hover`.

Pins: 7 in `tooltip.test.js`; five mutations, five dead - one of them
(the empty-text clear) only observable because the clear is IMMEDIATE
rather than waiting for a tick, which is exactly what stops a window
drawing a stale tip mid-frame. Live in tools/pauseProbe.mjs: the tip
suppressed on a short label, showing the full text behind an
elongated one, and gone on leave.

## U38 - THE CROSSHAIR AND THE MODE INDICATOR (2026-08-23)

The two HUD components the gap audit found missing outright, and the
first place this arc had to draw rather than load.

**THE ART DEPARTURE (Ledger A), stated first because it shapes the
rest.** Both components load DFU-AUTHORED PNGs out of Unity's
Resources folder - "Crosshair", and four icon sets of four files each.
None of that is ARENA2 data; it is DFU's own artwork, outside the C#
this project translates and absent from the sparse clone. So the port
draws a centred cross of its own geometry, and shows the mode's NAME
in the HUD font where the icon would sit. Every LAW around them is
DFU's, because the law is the half the source actually carries.

**The laws that matter.** The crosshair is not drawn while the cursor
is active (`:62-66`) - a window is up and the player is pointing, not
aiming; a crosshair painted over an open inventory is exactly the bug
that suppress exists to prevent, and it is the pin the live probe
drives. The indicator sits at `(barWidth * scale) * 5 + border * 2`
from the left on the vitals' baseline (`:129`), and `resScale`
(`:107`) shrinks it at low resolutions as a DIVISOR - at scale 1 the
icon is a third of nominal, which reads backwards until you notice
DFU's own comment saying so.

**The xhair suffix.** A style name ENDING in "xhair" means the
indicator is drawn AS the crosshair rather than in the corner
(`:189`), and in that mode Grab alone keeps the plain cross
(`:76-91`) - which is why Grab is the mode you aim in. The branch is
kept, and pinned in both directions: the mutant that lets Grab lose
its cross dies, and so does the one that reads "xhair" as a substring.

**One call, four hosts.** Both components ride `drawHud`, which was
already the one host-agnostic call all four make - so they cannot
drift the way four pasted frame bodies would. The dependency runs ONE
way: `hud.js` calls `hudCrosshair.js` and passes its own two geometry
constants in, because importing them back would make a cycle and
re-declaring them would make a second home for numbers that already
have one. A test pins the direction.

`GUI/Crosshair` and `GUI/InteractionModeIcon` stop being furniture -
the launcher had been offering a toggle and an icon STYLE for
components that did not exist.

Pins: 8 in `hudcrosshair.test.js`, the behavioural ones driving a fake
renderer and COUNTING quads. Six mutations: five dead, one recorded as
a genuine equivalent - `>` vs `>=` on resScale's boundary cannot be
killed, because at scale exactly 3 the reduction arm computes (1/3)*3
and IEEE754 rounds it back to 1. Live: tools/hudCrosshairProbe.mjs
counts the component's own draw calls in a real frame - present while
aiming, zero under the pause window, back when it closes.

## U39 - THE TAVERN (2026-08-24)

The innkeeper's four-button panel, and the first slice of this arc
whose window is genuinely small and whose LAW is not.

**What was already there and unreachable.** `staticNpcRoute` has
answered `{ merchant, service: 'tavern' }` since G8, and nothing
consumed it - the innkeeper fell through to talk, so a player could
stand in an inn and never be offered a bed. `freeTavernRooms` had been
ported with the knightly-order perks and had exactly one caller, the
travel calculator's inn hook. The routing, the perk and the holiday
tables were all waiting on a window that did not exist.

**The law half** (`systems/tavern.js`) is `DaggerfallTavernWindow`'s
handlers plus `FormulaHelper.CalculateRoomCost`. Three pieces of it
are worth naming because none reads the way its name suggests:

- **Heart's Day is a SPAN, not a "today is".** A stay that starts on
  or before day 46 and runs PAST it loses one day's charge; a stay that
  ENDS exactly on it does not (`doy + days > 46`, strictly). Renting
  only Heart's Day is free, and DFU pops that box from INSIDE the
  formula - which a pure function cannot do, so the port answers
  `{ cost, freeForHeartsDay }` and the window shows the box.
- **The 350-day ceiling is tested BEFORE the knightly exemption.** So
  even a free room cannot be booked past it. The order is DFU's and is
  load-bearing; swapping the two arms is the mutant that pin kills.
- **The two holiday arms, neither matching its own description** -
  DFU's own comment says so. New Life skips the gold TEST as well as
  the charge, so a penniless player eats and the meal heals as if
  bought (`price` is never re-read). Harvest's End halves with a floor
  of ONE, so a 1-gold ale does not become free. Verbatim, both.

**The room price is `CalculateTradePrice`, not `CalculateCost`.** The
first draft reached for the item-shop formula and would have charged
every character the same; DFU reads mercantile and personality, so a
silver-tongued character sleeps cheaper.

**Three closing quirks the window exists to preserve.** `DoFoodAndDrink`
calls CloseWindow FIRST and only then tests hunger, so "You are not
hungry." appears with the panel already gone. `ConfirmRenting` likewise
closes before it looks at the button, so declining a price closes the
tavern rather than returning to the panel. And the gold test happens at
the YES, not at the offer - the game shows you a price you cannot
afford and tells you so only after you agree to it.

**ONE CLOCK.** The day of year the room formula reads is derived from
the same classic-minute counter as everything else in the window, not
from a second `date()` hook - two clocks is exactly how a room's
Heart's Day and a meal's holiday end up disagreeing about what day it
is. The arithmetic moved to `gameDate.dayOfYearFromMinutes` and
`getHolidayId` now calls it, so there is one road rather than two.

**THE INDEX TRAP, closed.** The holiday tables are indexed by enum
MINUS ONE (`GetHolidayId` returns its loop counter plus one), so
reading one with the enum value lands on the NEXT holiday's row - a
silently wrong answer, not an error. This slice's first draft made
exactly that mistake, which is why `holidayDayOfYear` and
`holidayRegion` now exist and why the mistake is pinned from both
sides.

**The window half** borrows U24's `ServiceFlowWindow` for its box
chain rather than growing a second one: the room flow is field ->
YesNo -> message and the food flow is picker -> message, which is what
that window already is. The one thing it needed was a field PRE-FILL
(`TextBox.Text = "1"`), which now belongs to the field rather than
being poked into the window after construction - the donation box's
"1000" moved onto the same seam.

**What the live probe caught that no unit test could.** `%ra` printed
RAW. TEXT.RSC 5102 opens "Good day, %ra." and `expandGuildMacros`
filled `%a`, `%gii`, `%god` and `%pct` and left the two IDENTITY
macros alone - so every service window in the port had been showing
them unexpanded since U24, with both readers (`raceDisplayName`,
`honorificOf`) already sitting in `talkSession.js`. Fixed in the
shared expander, so the guild windows get it too. The probe also
exposed `mapId: 0`: the `?exterior` host never passed a scene context,
and a room is keyed by (mapId, buildingKey) where a buildingKey is
only unique WITHIN a location - so two taverns in different cities
could have collided. That host now knows its own location.

Pins: 8 in `tavern.test.js` (8 mutations, 8 dead) and 15 in
`tavernwindow.test.js` (15 mutations, 15 dead), plus the accessor pin
in `holidays.test.js` (3 dead). Live: `tools/tavernProbe.mjs` walks
into a real tavern, rents a room for three days, checks the gold
CHARGED equals the price OFFERED, reopens for the renewal prompt with
`%dwr` filled, buys a meal and proves the four-hour gate closes behind
it.

FLAGGED: the TALK button routes to `TalkToStaticNPC`, which the talk
arc owns; `AddPermanentScene` keeps a rented room's interior loaded
across a save and the port has no permanent-scene set, so a rented
room's CONTENTS are not preserved (the rental is). (RETIRED by S40:
the stored `allocatedBedIndex` is read by `CanRest`, and MoveToBed
lands the sleeper on the marker this rental minted.)

## U40 - THE TRADE WINDOW'S MODE FLOW (2026-08-24)

The largest PARTIAL in the port, and the named blocker at four sites.
U8c shipped the shop screen in Buy mode only and flagged the gap
loud - "the basket + mode-action flow (DFU accumulates then Buy)" -
and three other slices then wrote their own flags pointing at it: the
repair popup's SELL button, the plain-merchant sell arm, and
nativeTrade's own unused INVE10 art.

**The model was wrong, not just incomplete.** DFU does not transact at
the click. A click STAGES: in Buy mode into the BASKET, in every other
mode into the REMOTE list, which in a selling mode starts EMPTY and
fills as you click. The cost strip re-totals the whole staged
collection every frame, and the mode-action button commits the lot
behind one Yes/No. That is why there is a Clear button at all, and why
the strip can show a number for goods the player does not own yet. The
port had been buying one item per click at a fixed price.

**The two lists are LOCAL and REMOTE, not "player" and "shop".** In
Buy mode the basket is drawn in the LOCAL list, ahead of the pack
(`:677-686`), so you can click a basket item back out onto the shelf.
In the selling modes the pack is narrowed - Sell to the groups this
shop actually buys, SellMagic to enchanted items only, and SellMagic
does NOT also apply the shop's accepted groups, so a fence takes what
the shop would refuse.

**Three things that do not read the way they look**, each pinned as
the thing it is:

- **Sell does not price by condition.** The call site passes
  `item.ConditionPercentage` into `CalculateCost`'s third parameter
  and that parameter's body never reads it - it exists only so a mod
  override can see it. A battered sword and a pristine one fetch the
  same price.
- **The Buy-mode holiday discounts are three different predicates.**
  Merchants Festival halves everything but only outside a guild; Tales
  and Tallow only inside the Mages Guild; Warriors Festival only
  weapons and only outside a guild. And unlike U39's tavern meal -
  which passes region 0 as a literal - this one reads the player's
  real region.
- **The halving cannot truncate.** `CalculateCost` ends in `2 * (...)`,
  so every price it returns is even, which makes DFU's integer `/= 2`
  unable to reach an odd number - and makes halve-per-unit vs
  halve-the-total an equivalent mutant. Recorded, swept over eight
  values by six qualities rather than asserted on one case.

**The haggle message turned out to be the temple's.** ShowTradePopup's
three bands are character for character the ones the cure-disease
window uses, which the port already carried as `cureOfferMessageOffset`.
DFU wrote it twice; there is one home, plus the +3 that moves the sell
modes onto their own records.

**What the live probe caught.** The offer box was printing RAW MACROS:
`%cpn`, `%cn` and `%a` - and `%a` is the price, so a player was being
asked to agree to a literal percent-a. The window had never expanded
its rows at all. Fixed in the shared expander (which learned `%cpn`)
and by exposing townTalk's `cityName` accessor, which had existed
since T3 and only its own private `expandRecord` could see.

**A drawn-text harness, new to this repo.** The other UI suites pin
drawn text by reading the source, which cannot tell a live total from
a stale one. `drawText` asks the font for every glyph by INDEX, so a
font that records those indices reconstructs exactly the string the
renderer was asked to paint. That is what kills the mutant where the
cost strip shows the last concluded price - it reads 0 in both states
until something is bought, so only a real draw separates them. It is
ARENA2-gated, because `draw` returns early without art.

Two dead routes now have consumers: the plain-merchant Sell arm (a
shopkeeper in a non-repair shop fell through to talk, so there was no
way to sell without finding a shelf first) and the repair popup's
third button.

Pins: 13 in `trademodes.test.js` and 13 in `nativetrade.test.js`. 34
mutations, 34 dead. Live: `tools/tradeModeProbe.mjs` walks into a real
bookshop, proves a click stages without moving a coin, commits the
basket for the haggled price, sells back through the merchant arm, and
clears the staging back onto the shelf.

**...and for its whole life before T2 (2026-08-25) it proved none of
that**, because it booted the exterior host with no `class=` and the
chargen wizard held townTalk's overlay slot: every
`page.keyboard.press` went into a character-creation screen, so the
Yes on the haggle offer never arrived and the probe reported "the
commit did not charge" against a game that charged correctly. Its
second lie was its own purse - 500,000 gold is 1250 kg at
`goldPieceWeightInKg`, against a MaxEncumbrance near 90, so every sale
correctly took ConfirmTrade's letter-of-credit branch and the probe
asserted coins. It walks BOTH proceeds arms deliberately now, reading
the window's own weighing rather than recomputing it. The same trap
was found in FOURTEEN other probes and is gated in
`test/probehygiene.test.js`.

FLAGGED: the Identify SPELL arm (it pays in magicka and rolls per
item) waits on the magic arc; the letter of credit is minted and
carried but there is nowhere to cash one until banking lands (T2
2026-08-25 closed the OTHER half of that clause - the letter was
minted in SILENCE, where DFU announces it: `DaggerfallUI.MessageBox`
on Internal_Strings' `letterOfCredit` at :1092-1093. Without the line
the only signal reaching a player who sold something valuable while
overloaded was gold that did not move, which reads as a sale that
failed. The window raises it as a click-anywhere box over the still-
open trade screen, which is DFU's own order: a bare `CloseWindow()`
in a message-box handler pops the TOP window - the CONFIRM box, not
the trade window, UserInterfaceWindow.cs:127-132); the
wagon/info/select/steal buttons remain consumed no-ops; and a
guild-run shop passes `guildFactionId: null`, so Tales and Tallow
cannot yet fire - the guild-store arm is its own slice.

## B2 - THE BANKING WINDOW (2026-08-24)

The teller's screen, on B1's law. Audit-25 listed banking among the
six systems at or near zero; `staticNpcRoute` has answered
`{ merchant, 'banking' }` since G8 into a dead arm, so a bank teller
fell through to talk.

**One transaction at a time**, and that is the whole interaction
model. A button chooses a transaction TYPE, the field takes the
amount, Return commits it - and while a field is open EVERY button is
dead, including the one that opened it. A request to switch from one
live transaction straight to another is refused; only a move through
None is allowed. Escape closes the FIELD rather than the window, which
is why the pin needs a second Escape to close the bank at all.

**Three buttons refuse before they open anything.** Borrowing checks
DEFAULTED before it checks HAVE-A-LOAN, so a region with both is told
it defaulted. Buying a ship checks ownership before the port-town
test. Selling what you do not own is a silent no-op, because DFU has
no else there.

**TOO_HEAVY is the one result with no record behind it.** Every other
TransactionResult IS a TEXT.RSC id - 0282-0299 is one contiguous block
of banking dialogue - so the window looks each up by its own value and
supplies its own line only for the weight refusal.

**The inventory label carries the wagon.** One label, two purses:
`1000 (+5000)` when the cart holds gold, because the deposit arm can
reach into it and a player needs to see that at a glance.

The house and ship PURCHASE popups are flagged, not built: they need
the building directory and the permanent-scene set. Both buttons refuse
through the law's own decisions, which is also what DFU answers when
the directory is missing.

Pins: 11 in `bankwindow.test.js`. 15 mutations, 15 dead. Live:
`tools/bankProbe.mjs` mints 62 regional accounts in a real interior,
deposits 20,000 off the entity, withdraws it back, borrows 10,000 at
11,000 owed with a rendered due date ("Middas the 4th of Morning
Star"), and reads the real refusal record back when it asks for a
second loan.

## M2 - THE POTION MAKER (2026-08-24)

The first of the magic crafting windows Audit-25 listed at or near
zero, on M1's law. `SERVICE_DESTINATION.MakePotions` has been a
FLAGGED `null` since G3 - the temple and the Mages Guild both offer
the service and clicking it did nothing.

**MASK00I0 is a full-screen background**, not a centred panel - the
one window in this arc whose art is the whole 320×200 - so every rect
is screen-absolute and there is no alignment to compute. DFU also
paints a 60% black wash on the native panel UNDER the texture, which
is neither the opaque black most windows use nor ScreenDimColor.

**Two grids, and the cauldron's size is not arbitrary.** The
ingredients list is three columns of four on a 56/38 stride; the
cauldron is two columns of the same four rows, which is exactly eight
- and eight is the law's cap, and purification needs all eight. The
window shows precisely what it can hold.

**A failed mix burns the herbs.** Mixing spends the ingredients
whether or not a recipe matched, and the consume walk falls back to
the wagon before giving up. When it gives up it BREAKS mid-loop, so
the pot is left standing with whatever it already took gone - a
partial spend, verbatim.

**The recipes button fills what it can.** A player missing one herb
gets the other three in the pot rather than a refusal, and knowing no
recipes at all is a message box rather than an empty picker.

One Ledger row added, for a departure the port INHERITS rather than
makes: classic creates a useless "Unknown Powers" potion on a failed
mix and DFU refuses instead, with the classic line commented out
beside its own explanation.

Pins: 11 in `potionmakerwindow.test.js`. 8 mutations, 8 dead.

## M4 - THE ITEM MAKER (2026-08-24)

The second magic crafting window, and the one M3 wrote the arithmetic
for. `SERVICE_DESTINATION.MakeMagicItems` has been a FLAGGED `null`
since G3. What M3 left behind was a cost accounting with no COSTS -
every effect declares its own `EnchantmentSettings` inside its effect
class, the way the potion recipes did, so a port with no broker to
register with needs them gathered into one table. That table is
`systems/enchantmentCatalogue.js`, and gathering it corrected M3.

**M3 DESCRIBED THE SIGN BACKWARDS.** Its header said "a side effect
costs enchantment points and costs no gold". A side effect's
`EnchantCost` is NEGATIVE - ItemDeteriorates −3000, UserTakesDamage
−6000, BadRepWith −5000 - so summing it into the enchantment total
REDUCES that total. Taking a drawback BUYS you budget, and because the
gold walk skips the side effects entirely, the budget is free. That is
the whole trade the window offers, and it is why the two lists are
SUMMED rather than subtracted. The header is corrected and the sign is
now pinned against the catalogue's real costs, so the two modules
cannot drift apart.

**FOUR SHAPES, AND `ClassicParam` DOES NOT MEAN THE SAME THING IN
EACH.** This is the thing the table had to get right, and my first
draft got it wrong:

- fourteen effects index a `costs` array BY ClassicParam, 0..n−1;
- six mint ONE cost at ClassicParam **−1**, not 0 - so a flat
  `costs[param]` lookup answers `undefined` for the param they
  actually mint and a real number for one they never do;
- EnhancesSkill has one FLAT cost over all thirty-five skills, and its
  param is the SKILL id;
- the three `CastWhen*` are keyed by classic SPELL id, which is
  neither an index nor dense.

Those last three were FLAGGED as needing the spell list. They do not:
`classicSpellIDs` and `classicSpellCosts` sit side by side in each
effect class, so all twenty-four are here and the flag never shipped.
The tables carry a fact an index lookup could never see - **Ice Storm
costs 1420 cast-on-use and 840 cast-on-strike**, the same spell at two
prices.

**THE TABLE WAS MACHINE-DIFFED, NOT EYEBALLED.** Every cost was
extracted from the C# by script and compared cell for cell: 24 of 24
exact. Re-typing them into a test would only assert my own
transcription back at me, so what the suite adds instead is an
aggregate - 209 settings, 99680 summed, plus a per-effect sum table -
which no single wrong digit in two hundred cells can survive. Both
digit-mutants die there.

**SOULBOUND IS THE ONLY SOURCE OF FORCED ENCHANTMENTS IN THE GAME.**
`GetForcedEnchantments` is overridden by SoulBound and by nothing
else, so M3's whole forced-versus-chosen split exists to serve bound
souls. Nine of the forty-three souls carry a set; binding a Daedra
Lord drags in Potent vs Daedra, User Takes Damage in holy places and
Extra Weight, each marked with the soul's key. DFU sorts those
children by `EnchantCost > 0` - the INSTANCE's cost at its OWN param,
a different question from what the effect IS - and on the nine sets as
shipped the two cannot disagree, because no forced child prices at
zero. That is swept rather than claimed, so a zero-cost child added
later trips the pin instead of sliding into the wrong list.

**THE ROOM CHECK RUNS ONLY FOR A BOUND SOUL.** The overflow test sits
INSIDE `if (forcedEnchantmentSet != null)`, so an enchantment with no
forced children is never checked for room at all. And the picker
buttons' own guard tests `== 10`, not `>= 10`. Put those together and
a player can pile plain enchantments past ten, walk straight past a
guard that no longer matches, and keep going - with M3's
`SetEnchantments` truncation silently dropping the surplus at the end.
Verbatim, and pinned as such.

**THE EXCLUSIONS DEPEND ON WHICH SCREEN YOU ARE ON.** Eight effects
override `IsEnchantmentExclusiveTo`, in two kinds: unconditional pairs
(FeatherWeight/ExtraWeight, StrengthensArmor/WeakensArmor) and
param-matched opposites (PotentVs/LowDamageVs, GoodRepWith/BadRepWith).
DFU calls it with NO comparer param from the primary picker and WITH
one from the secondary - so Potent vs Undead does not remove "Low
Damage Vs" from the effect list at all; it removes "Undead" from that
effect's own param list one screen later, leaving the other three.
Dropping the stage guard bars it a screen early, which is a visible
difference and a dead mutant.

Two names the catalogue does NOT own: EnhancesSkill's params are the
skill names and SoulBound's are the enemy names, read from `skills.js`
and `enemyBasics.js` rather than copied - which is also what makes the
five alpha-sorting effects sort by what the picker actually prints.
It has a consequence worth seeing: the soul list shows **two rows both
named "Dragonling"**, one worth nothing and one worth 5000, because
that is the name both spawns have.

One Ledger row added: the item list rides the port's shared item
scroller rather than this window's own one-pixel-different geometry.

**PROBED LIVE** (`tools/itemMakerProbe.mjs`), through the real
guild-service destination rather than a private opener - the seam that
was the FLAGGED null. An iron Wakizashi reads `0/337` in the real
label, which is M3's flooring quirk visible on screen; Potent vs
Undead leaves Low Damage vs Undead offered but takes Undead out of its
params; adding Low Damage vs Animals moves the label to `-400/337`
while the gold stays at 8000, so the drawback bought budget and cost
nothing; binding a Daedra Lord adds four rows of which three carry
`SoulBound:31`; removing the soul takes all three with it and leaves
the chosen rows standing; enchanting spends 8000 real gold, lands the
enchantments on the item, and the item leaves the list because an
enchanted item is not offered again.

Pins: 16 in `enchantmentcatalogue.test.js` (18 mutations, 16 dead,
2 recorded equivalent) and 3 added to `enchanting.test.js`.
## U41 - THE TRAVEL MAP (2026-08-24)

The classic world map, at last: the province art on V, the region
pages with their location dots, the find box, and the travel popup
behind them. The F-slice shipped the fast-travel LAW in August and
stood a keyed typeahead in front of it, flagged INTERIM in the same
breath; the Ledger row it opened has been the head of the fast-travel
residue ever since. This closes it and DELETES `ui/travelMap.js`.

**The map is three surfaces stacked, and only one of them is art.**
TRAV0I00.IMG is the whole 320x200 window; the region page is a
separate 320x160 IMG drawn into the hole it frames at y=12; and the
location dots are a texture the window GENERATES every time a filter,
a page or a discovery changes - one pixel per map pixel, coloured out
of FMAP_PAL.COL by location type. The dot colours are palette indices
(237/240/243/246/0/53/51/55/96/101/39/33/35/37), not RGB constants,
so they had to come off the real palette file rather than a table.

**Unity's textures are bottom-up and ours are top-down**, which is
the single largest difference between DFU's draw and this one. The
dots walk writes `((height - y - 1) * width + x)`, the crosshair
writes the same flip, the region-shape flash writes
`(height - y - diff) * width + x`, and the zoom's crop rect measures
its Y from the BOTTOM of the texture. The port keeps every one of
those expressions verbatim, builds the buffer in DFU's order, and
flips whole rows at upload - so the arithmetic can be compared line
for line with the C# instead of being re-derived, and the crop
converts with one subtraction at the draw.

**DFU's own offset-times-scale quirk is what makes Betony draw.**
The dots walk multiplies the whole buffer OFFSET by the region's map
scale (`offset = ((height - y - 1) * width + x) * scale`), which is
not a coordinate transform by any reading - but Betony is the one
region with a scale (4), and its page is plotted by that
multiplication plus the -477 crosshair fixup and the +60/+212 mouse
fixup. Kept as written.

**The find box is a DISTANCE, not a match.** DFU runs a weighted edit
distance (`EditDistance.cs`, configured by `DaggerfallDistance.cs`)
over the open region's names: separators cost 3 to insert where a
letter costs 12, an exact prefix seeks for free, and the trim padding
makes a missing last letter cost 0.4 where a missing middle letter
costs the full 12. Two consequences the interim typeahead did not
have: "daggerfal" finds Daggerfall AND Daggerfall Chapel (both inside
MatchesCutOff's half-relevance band, so the LIST PICKER opens), and a
nonsense query still lands on the nearest names - so TEXT.RSC 13,
the "does not exist" box, is reachable only on an EMPTY query
(FindLocation's IsNullOrEmpty arm) or in a region with nothing
discovered at all. The port carries the matcher whole,
including the heap's ordering law: relevance descending, ties by text
ASCENDING, which falls out of `string.Compare(other.text, this.text)`
being dumped in reverse.

**Eighteen regions have no page, and DFU throws on them.**
`offsetLookup` has 51 rows; the eleven wildernesses, the two generic
villages, the four coast strips and Bantha are not among them, so
`UpdateMapLocationDotsTexture` would index a missing key. Nothing
normally clicks one - the region picker does not paint them - but
`UpdateMouseOverLocation` can name one through the politic map, and
one click later DFU is in a KeyNotFoundException. The port REFUSES
the page instead (`hasRegionPage`), which is the same nothing-happens
a player sees, minus the crash. Recorded as a departure.

**The outline is half a SCREEN pixel, not half a virtual one.** DFU
displaces its four outline panels by `disp * thickness /
NativePanel.LocalScale`, so the virtual offset shrinks as the window
grows and the visible offset is always half a real pixel. The port
computes the same thing from the other end - `disp / m.s` virtual,
which is `disp` screen - and the outline colour (0,0,0,128) needs
`{ blend: true }` at the quad, because the screen-quad shader's
default arm is the 1-bit cutout law every piece of classic art wants
and would have painted this one SOLID black.

**checkLocationDiscovered gates three surfaces here, not one.** The
TV slice applied the law to the typeahead, which was the only surface
the port had. The art window asks it for the DOT, for whether a
hovered place can be selected at all, and for the find results - and
`CanFindPlace` asks it through a region+name pair. A hidden dungeon
is invisible, unhoverable and unfindable; one `discoverLocation` call
turns all three on together.

**The popup's ship default had been wrong since the F-slice.** DFU's
`travelShip` field initialises TRUE, and the toggle panel starts on
the ship row; the keyed window defaulted it false. Two more of its
laws land with the real window: a CLICK assigns its own option (a
second click on the live one does nothing) while the HOTKEY toggles
the pair, and the trip does not run when BEGIN is pressed - the days
label counts down one day per 0.05s of real time and only an empty
counter departs.

**DFU keeps ONE window; the port mints one per open.** DaggerfallUI
holds a single DaggerfallTravelMapWindow and re-PUSHES it, so its
four filters and the popup's three choices survive a close - and
SaveLoadManager writes them into every save as TravelMapSaveData.
The port's windows are per-open objects, so that state moved to
`systems/travelMapState.js` (the A2 zoom-memory shape) and rides
`composeSessionState`, the one envelope composer both hosts already
call. Two consequences worth naming: a filter set on the map is
still set the next time V is pressed, and a save from before this
slice restores the struct's own defaults rather than leaving the
live session's filters standing - which is exactly what DFU's
`SetTravelMapFromSaveData(null)` arm does.

**The identify flash is flow control, not decoration.** It runs four
ON states for a region and two for a selected location, and
`StopIdentify(true)` is where the travel confirmation is created - so
after a find, it is the END of the flashing crosshair that asks "do
you wish to travel to %tcn?". Clicking the flashing place skips the
wait to the same door.

**What the parity RE-READ caught, since the probe could not run.**
Five adversarial readers went back over the C# against the port, and
seven of their findings were real:

- **The gold is two pools, not one.** `GetGoldAmount` is coins PLUS
  letters of credit, and `DeductFastTravelGold` takes the inn nights
  out of the coins ALONE before the rest may reach the letters -
  "Taverns only accept gold pieces" is DFU's own comment on the
  test. The F-slice had recorded the port's purse as one pool, but
  `court.js`'s `DeductGoldAmount` has spent letters since B1, so the
  recording was stale and the window was both refusing trips a
  letter could pay for and letting a letter pay for a bed. Both
  halves are live now, and the label shows the COINS, as DFU's does.
- **A POISONED traveller was never warned.** DFU's test is
  `DiseaseCount > 0 || PoisonCount > 0`; the port had only the
  disease half, while its own poison bundles have been on the entity
  since the disease arc.
- **A horse and a cart were invisible to the calculator.** The
  general store sells both and the wagon gate already reads
  `Items.Contains(Transportation, Small_cart)`, but the window was
  wired `hasHorse: false, hasCart: false` - so a mounted player was
  quoted the on-foot day count and the on-foot inn bill.
- **The paging arrows painted on the province map.** DFU creates
  them disabled and only SetupArrowButtons turns them on, so a
  player whose own region pages (Alik'r, Dragontail, Wrothgarian)
  saw two arrows over the world map before opening anything.
- **The first flash was half a second late.** `identifyLastChangeTime
  = 0` works in C# because it is compared against
  `Time.realtimeSinceStartup`, which is never near zero. The port
  stores the same DISTANCE against one monotonic clock instead.
- **The zoomed outline thinned where DFU's thickens**: DFU displaces
  the outline copies' CROP as well as their panel, and the 2x zoom
  magnifies that second half.
- **A third of the C# line citations had drifted** by 10-80 lines,
  including the whole identify block, which pointed into the console
  commands. Swept against the reference file symbol by symbol.
- **A right-click behind the map fired a readied spell.** RMB is the
  map's ZOOM, and both exterior hosts bound RMB to the weapon rig
  and the pending cast without an overlay gate - so one zoom toggle
  spent magicka or loosed an arrow at a world the player could not
  see. The dungeon host has had the gate since I4; the other two
  never got it. Pre-existing, but the travel map is what made it a
  routine gesture.
- **The location picker painted the map out.** DFU's picker is a
  popup over the window that pushed it and DaggerfallPopupWindow
  dims nothing (ScreenDimColor is Color.clear), so the map stays
  visible behind the list; the port's picker filled the canvas with
  opaque black. It now takes a backdrop mode, and the travel map
  asks for none.
- **The poison half of the warning never reached the popup.** The
  host passed `poisonCount` and the popup read it, and the window in
  between did not forward it - the one production path, and the only
  path no pin drove. Pinned through the window now, not the
  constructor.

**What the live probe caught: nothing, because it could not run.**
This machine has no ARENA2, so every art path is build-verified and
unit-pinned rather than seen. `tools/travelProbe.mjs` was rewritten
for the new window - it opens the map on V, opens the player's own
region with Return (falling back to the I'M AT button when the flash
has already stopped), types the nearest real destination into the
find box, waits out the crosshair, answers Y, and presses B - and it
polls the window's own state through a new `__travelMap` probe
surface rather than sleeping, because a click surface cannot be
driven blind. It needs a box with game data; that pass is owed.

Pins: 23 in `travelmapwindow.test.js`, 11 in `travelmap.test.js`, 6 in
`editdistance.test.js`, 2 re-pinned in `travelvisibility.test.js`.
All 51 rows of the offset table are transcribed from the C# into
the pin and deepEqual'd, because nothing else in the port can catch
a mistyped origin - a wrong pair simply puts a region's dots on the
wrong map pixels. 51 mutations, 50 dead and one PROVEN equivalent
(shifting the flash clock by a constant moves the stored stamp with
it, so nothing can observe it). The first round left five alive -
both arrow directions, the pageless refusal, the popup's
assign-not-toggle click, and the map dict's first-wins collision arm
- and each is now its own pin.

FLAGGED: the guild TELEPORT mode (`ActivateTeleportationTravel` +
`DaggerfallTeleportPopUp`) still waits on the guild arc's teleport
service, and `guildServiceFlow`'s `Teleport: null` still points here;
the quest journal's click-through travel (`GotoPlace`) has no journal
door yet; TextureReplacement's custom region maps and region
overlays have no door; and the HUD smash-to-black around the trip
waits on a fade layer the port does not have.

## U42 - THE SPELLBOOK (2026-08-24)

`src/ui/spellbookWindow.js` + `src/ui/spellIcons.js` (both new); the
keyed window and `knownSpells` in `src/ui/inventory.js` are DELETED,
and what is left of that module is the death screen, so the file is
`src/ui/deathScreen.js` now. Wired in all four hosts;
`src/systems/guildServiceFlow.js`'s two BuySpells nulls close;
`src/systems/spellcast.js` gains the probe helper the fallback used
to be. `test/spellbookwindow.test.js` (new), four pins re-aimed.

**The last text stand-in on the daily loop is gone.** Every other
window a player touches hourly had already moved onto its ARENA2 art
- the inventory at U8d/U26, the char sheet at U8a, the trade window
at U8c, the travel map at U41 - and the spellbook, which opens on
EVERY cast, was still a text list on a brown rectangle. It is
`DaggerfallSpellBookWindow.cs` now: SPBK00I0.IMG, sixteen rows with
their live costs, the spell's own icon beside its target and element
icons, three effect panels, and the four buttons painted into the
art itself. DFU loads no cutouts and no highlight sprites for this
window - every button is an invisible hit rect over the base IMG and
selection is a COLOUR SWAP, which is why the port draws no chrome of
its own either.

**ONE WINDOW, TWO MODES, exactly as DFU has it.** The same class the
player opens with Backspace is the one a Mages Guild or temple opens
to sell spells - `buyMode` swaps the background to SPBK01I0.IMG, the
list from the player's book to the guild's offer, the bottom-left
button from DELETE to BUY, the spell-point label to a cost and a
gold label, and removes the swap/sort row entirely. Two of the
seventeen unbuilt guild services close on that one flag, because
`DoGuildService`'s switch falls `BuySpells` straight into
`BuySpellsMages` and pushes the same window with the same `true`.

**The laws that are easy to get wrong, and are pinned:**

- **The cost is recomputed every refresh**, because it rides the
  caster's live skills, and the row reads `"{cost} - {name}"`. A
  spell the player cannot currently pay for is not hidden or
  disabled - all four of its colours lerp 75% toward grey.
- **Lycanthropy casts free**, so its row shows 0 where classic shows
  a cost, and readying it carries `noSpellPointCost` - DFU's own
  comment says it is "setting cost to 0 so it displays correctly".
- **Both confirmations close the book.** `CloseWindow()` sits
  OUTSIDE the Yes arm in `DeleteSpellConfirm` and
  `SortSpellsConfirm` alike, so answering No to "Delete this spell?"
  puts you back in the world with the spell intact. Kept, quirk and
  all - it is the kind of thing a reader "fixes" on sight.
- **Sort is alphabetical, and only if that changed nothing does it
  sort by point cost** - the SequenceEqual arm, which makes the
  button a two-state toggle rather than a single sort.
- **Swap forces one more row into view.** When the moved spell lands
  the selection on the last visible row, the list scrolls one
  further, so you can see where it is going. DFU comments the step;
  the first mutation round proved a pin that could not see it (the
  fixture's scroll index was already at the clamp).
- **The two curse tags refuse before the prompt.** Vampire and
  lycanthrope spells have no way back until the curse is cured, so
  DELETE answers with a message and no YesNo at all.
- **Buy price is the casting cost times four**, halved by a SHIFT on
  Witches Festival with a floor of one, then run through
  `CalculateTradePrice` against the building's quality. The ladder
  is spellbook, then gold, then one of TEXT.RSC 260/261/262 chosen
  by how the asking price compares to what the guild wanted -
  `presentedCost >> 1` and `presentedCost - (presentedCost >> 2)`
  are the two bands. Yes deducts through `DeductGoldAmount`, so a
  letter of credit buys a spell.

**RENAME retires a ledger row rather than idling.** U4 recorded that
rename needed "per-entity spell COPIES + name persistence first",
and both had quietly arrived. DFU's `EffectBundleSettings` is a
STRUCT: `GetSpell` hands the handler a copy, the copy is renamed,
`SetSpell` writes it into the player's slot, and the shared
SPELLS.STD record is never touched. The port's records are objects
shared by every caster, so `confirmRename` copies explicitly and
marks the copy `custom` - which is exactly the flag `save.js` has
read since S1 to store a whole record instead of a bare index. The
rename is real, it is per-character, and it survives a save.

**THE STRINGS WERE NEVER MISSING.** U4 recorded that "the classic en
string table is not in the source snapshot", flagged its prompt
prose as pending one, and every slice since inherited the claim -
including U42's own first pass, which wrote "Delete this spell?" and
"You cannot delete vampiric powers." The table is in the snapshot,
at `StreamingAssets/Text/Master Localization CSV Files/
Internal_Strings.csv`, and every string this window wants is in it:
`deleteSpell` is "Do you want to delete this spell?", `cannotDeleteVamp`
is "Cannot delete special vampire spells.", `enterSpellName` carries a
colon, `effectNotFoundError` is "<effect not found>" with the angle
brackets, and the ten target/element descriptions are sentence case
with no hyphen ("Fire based", not "Fire-based"). All of them are
verbatim now, and the Port-Ledger's "the YesNo/refusal PROSE is
flagged pending a classic string source" residue retires with them.
What is left is a MECHANISM departure, not a content one: the port
holds the en values as constants instead of resolving TextManager
lookups.

**What the audits caught, all of it fixed:**

- **The cost label painted the wrong number.** `spellCostLabel` is
  the PRESENTED cost - the casting cost times four - and the window
  painted `GetTradePrice()` instead. They are deliberately different
  numbers, which is the entire point of the 260/261/262 ladder: the
  bands compare `presentedCost >> 1` and
  `presentedCost - (presentedCost >> 2)` against what the shop is
  actually asking, so the sticker price has to be visible beside it.
  At quality 10 with no Mercantile, a 25-point spell showed 70 where
  classic shows 100. The first pin certified the wrong value, because
  it asserted whatever `tradePrice()` returned.
- **`{}` for the haggle skills.** `tradePrice` passed an empty
  options object to `calculateTradePrice`, which defaults Mercantile
  to 0 and Personality to 50 - so every spell in the game would have
  been priced against a merchant facing a haggler with no skill.
  DFU's three-argument overload reaches for the player's LIVE pair
  inside FormulaHelper; the port passes them in, and the host now
  supplies the same pair every other trade surface does.
- **`goldAmount` for the gold gate.** `GetGoldAmount` is coins PLUS
  letters of credit; the draft read coins alone, which would have
  refused a spell to a character holding a five-thousand-gold
  letter. Both the gate and the gold label read `totalGoldAmount`
  now - the same fix U41 made to the travel popup, in a second
  window that had copied the wrong half.
- **`-1` and `255` are the same "no subtype".** A SPELLS.STD record
  reads the byte SIGNED and stores -1; a spell built in the maker
  copies the catalog's 255; the effect table is keyed on 255. The
  effect labels built their key raw, so a Free Action off the file
  would have printed "Effect not found" in the book. Every other
  consumer in the port already normalizes with `& 0xff`, and this
  one does now.
- **`this._rows` was both a field and a method.** The macro reader
  and the row array collided on one name, and the collision was
  invisible until the buy ladder tried to read TEXT.RSC 1703 and got
  "this._rows is not a function". The reader is `_boxText` now.
- **The two selection methods scrolled where DFU's do not.**
  `ListBox.SelectPrevious`/`SelectNext` put the scroll adjustment
  INSIDE the movement guard and nudge by exactly one row; the port
  ran it unconditionally and SNAPPED. It is reachable because the
  wheel moves the scroll without moving the selection, exactly as
  `SpellsListBox_OnMouseScroll` does: scroll five rows down, press Up
  at the top of the book, and DFU leaves the view alone while the
  port yanked it back to zero.
- **`Enter` bought in buy mode.** `OnUseSelectedItem` - what Return
  raises - is subscribed only OUTSIDE buy mode; the shop wires
  `OnMouseDoubleClick` instead, so Enter does nothing there and B or
  the BUY button is the keyboard path.
- **The rename field had no cap and trimmed.** DFU's text box stops
  at 31 characters (the constant the spell maker already homes), and
  its "must not be blank" guard is `IsNullOrEmpty` on the RAW string -
  so a name of three spaces is legal in classic and the port was
  quietly stricter.
- **DELETE and SORT played their page-turn twice.** `AddButton` sets
  no `ClickSound`; `editSpellBook` plays in the confirm HANDLERS
  only. The arrow buttons really do play it on press, and still do.
- **The icon atlas wrapped where the collection returns null.**
  `GetSpellIcon` answers null outside `[0, Count)` and the panel
  shows its black background; the `index % 69` wrap is
  `SpellMakerWindow.SetIcon`'s law, applied at MINT time in
  `systems/spellMaker.js`. A record carrying a bad icon byte now
  reads as a black square rather than as some other spell's icon.
- **The effect labels read the wrong table.** `SetEffectLabels` goes
  through `EntityEffectBroker.GetEffectTemplate` - the whole registry
  - where the port went through the spell MAKER's catalogue, which
  deliberately omits MorphSelf (`AllowedCraftingStations = None`). A
  spellbook holding a 29,255 effect printed "<effect not found>".
  `spellEffects.js` is the registry now, with a `craftable` flag the
  two picker lists filter on, so the maker still offers exactly 90.
- **The three haggle bands had a second home.** `cureOfferMessageOffset`
  in `guildServiceActions.js` is the one the temple and the trade
  window share; the buy ladder had rewritten the same comparison
  inline. The ONE-HOME sweep in this slice caught five constants and
  missed the law next door.
- **Five names with two homes.** `PANEL_X`, `PANEL_Y`,
  `ROWS_DISPLAYED`, `LABEL_POS` and `TRADE_MESSAGE_BASE_ID` were all
  already declared somewhere else in `src/`. The geometry folded
  into one `SPELLBOOK_LAYOUT` export, and the ids, the row spacing,
  the selected-row colour and the default text colour are imported
  from the modules that already owned them. `SPELL_ICON_COUNT` was
  the same story in the icon collection: `spellMaker.js` had held
  `SpellIconCollection.SpellIconCount` since S1, so `spellIcons.js`
  imports and re-exports it rather than writing 69 twice.

**The item door opened too.** Using the Spellbook ITEM in the
inventory has been a silent no-op since U25 - the useItem law
answered `{ kind: 'spellbook' }` and `_useResult` had no arm for it,
so the window that should open did not exist. It does now, and the
inventory hands off through the same one-overlay-slot discipline the
book reader uses (close law first, then the hook). The first pass
wired three of the FIVE construction sites and left both LOOT-PILE
windows printing "You cannot open your spellbook here." over a
spellbook the player was holding - which is exactly the failure U25's
ONE CONSTRUCTION SEAM rule exists to catch, and its sweep missed it
because the sweep only checks hooks it NAMES. `openSpellbook:` is in
that list now.

**And the verification pass found one more, in a file U42 never
touched.** A second adversarial round - five lenses over the
corrections, each finding handed to a refuter told to default to
"refuted" - killed 24 of its 32 candidates and left eight. Seven were
drifted citations, two of them introduced by the CITATION-FIX commit
itself, on the very law that commit rewrote. The eighth was real and
belongs to the character sheet: `CharSheet` nests a pushed child and
forwards `tick`, `wheel`, `input` and `click` to it, and NOT `hover`.
The hosts' hover seams test for the method on the OVERLAY - which on
that route is the SHEET - so `townTalk.js`'s
`if (!overlay?.hover) return false` bailed and the child was never
reached. Three of the four hosts open the spellbook through the
sheet's button, so THERE it had no list highlight and none of its
three tooltips, while the same window opened on Backspace had all of
them. The fix is four lines of forwarding; the pin sweeps all five
seams by name, because the next seam a child owns would be forgotten
the same way.

**What the live probe caught: nothing, because it could not run.**
This machine has no ARENA2, so SPBK00I0/SPBK01I0/ICON00I0/MASK04I0
are build-verified and unit-pinned rather than seen. Both sheets are
headerless IMGs the port's reader already sizes by byte length
(20480 -> 320x64, 3200 -> 40x80), so no format work was needed; that
is a claim about the reader, not about the pixels.
`tools/spellbookProbe.mjs` is written and waiting for a box with game
data: it clicks the REAL rects through the panel's half-pixel offset
and reads the window's state back through a new `__spellbook` surface
on both exterior hosts, because a window whose buttons are painted
into its background cannot be driven blind. The probe pass is owed,
alongside U41's. One probe that already existed needed repairing
here: `castProbe.mjs` sorted the book and then pressed Enter to ready
a spell, which worked only because the KEYED window stayed open
through its confirmation - the classic one closes on either answer,
so the probe reopens the book first now.

Pins: 46 in `spellbookwindow.test.js`, one new in
`nativeinventory.test.js` for the item door's hand-off order, one in
`charsheetnav.test.js` sweeping all five of the sheet's child seams,
two re-pinned in `spellmakerwindow.test.js` for the registry split,
and five existing pins
re-aimed rather than deleted - `charsheetnav`'s ONE DFU MEMBER, ONE
EXPORT sweep follows the window to its new home, `nativeinventory`'s
four-hosts pin now asserts BOTH keyed windows are gone from the
module and that the spellbook lives on its art, `mysticism`'s cast
engine pin reads the free-cast rider on the ready call, and
`audit18_hosts_dungeon`'s retired-flags pin reads the renamed hook,
and U25's ONE CONSTRUCTION SEAM sweep names `openSpellbook:` so the
loot-pile windows cannot be forgotten again.
103 mutations across two campaigns, 102 dead and one PROVEN
equivalent (a `void 0` after a label draw). The first campaign of 69
left five alive: the top-edge force-reveal step (whose fixture sat at
the scroll clamp, so the step had nothing to do), a click-anywhere
box's dismissal, Enter in buy mode, the selected row's missing
shadow, and the icon size being derived from the atlas width rather
than assumed. The SECOND campaign ran only the laws the adversarial
review had corrected, on the reasoning that a law nobody had got
right was a law nobody had pinned - and 14 of its 34 survived the
first pass, including all seven of the en STRINGS (asserted through
the very constants a rewrite would move), both halves of the
scroll-inside-the-guard rule, and the doubled page turn. Two fixtures
were themselves the bug: the tail case sat at the scroll clamp and
the head case at zero, so in both the mutant and the original had
nothing to do. Every one is its own pin now.

FLAGGED: the ICON PICKER (`SpellIconPickerWindow`, 352 lines of DFU)
is a window of its own, so clicking the icon panel says so rather
than doing nothing; `ShowEffectPopup` reads each effect's
`SpellBookDescription` tokens, which the port's effect table does
not carry, so an effect panel's box shows the group/subgroup pair
alone; the scroll thumb's three-slice art lives in Unity Resources
rather than ARENA2, so the thumb is a flat bar at DFU's own
geometry; DFU fires a list row's use/buy from a DOUBLE click
(ListBox.cs:507-509) where the port takes a second click on the
already-selected row with no timing window, U24's recorded departure;
the three icon TOOLTIPS carry DFU's own en strings as constants
rather than TextManager lookups, since the port has no localization
LOOKUP; and DFU wires the name label's rename in BOTH
modes, where the handler then indexes the PLAYER's book with the
OFFER's index - the port gates rename to cast mode and does not port
the bug.

## G5 - TELEPORT: two flags pointing at each other (2026-08-24)

The Mages Guild's teleport service and the travel map's teleport mode
had each been waiting on the other, in writing:

- `ui/travelMapWindow.js` (U41): *"FLAGGED, idling loudly: … the guild
  TELEPORT mode (ActivateTeleportationTravel + DaggerfallTeleportPopUp),
  **which waits on the guild arc's teleport service**."*
- `systems/guildServiceFlow.js`: `Teleport: null, // FLAGGED: **the
  travel map's teleport mode**`

Neither was waiting on anything that did not exist. Both flags retire
here, and what closed them was 171 lines of C# and a host door.

**THE RECT'S OWN POSITION IS DEAD.** `DaggerfallTeleportPopUp` sets
`Position = mainPanelRect.position` — which is `(0, 50)` — and then
sets `HorizontalAlignment.Center` and `VerticalAlignment.Middle`.
`BaseScreenComponent`'s alignment switches (`:1205-1230`) assign
`rectangle.x`/`.y` outright on every arm but `None`, so the 50 never
reaches the screen. A port that transcribed the rect wholesale would
put the box thirty pixels high and hard against the left edge. It is
centred: (75, 72), both halves landing on .5 and rounding the way
every other centred panel here rounds. Pinned both ways — the real
values, and a not-equal against the rect's own.

**THE TELEPORT BOX IS ITS OWN FIELD, and that is DFU's structure
rather than tidiness.** `CreatePopUpWindow` keeps the travel popup in
the `popUp` **field** and the teleport popup in a **local** — it goes
on the UI stack and the map never holds it. The port has no UI stack,
so the map must hold its sub-window; putting a teleport box in `popUp`
would hand it to `GetTravelMapSaveData`, which reads the three travel
toggles straight off whatever is there and would write `undefined` for
all three into a quicksave taken with the box open. It would also have
crashed on the first mouse move, because the map calls `popUp.hover`
and a yes/no box has none. Separate field, and the *reason* is pinned
rather than the arrangement.

**TELEPORT MODE IS A ONE-SHOT.** `ActivateTeleportationTravel` sets a
flag before the map is pushed and `OnPop` clears it, so it lasts
exactly one visit: a map closed while still armed would teleport the
next traveller for free. Saying **No** to the box, though, leaves the
map open *and* still armed — the destination was declined, not the
service — so another place can be picked and it opens the teleport box
again.

**WHAT TELEPORTING ISN'T.** It reuses the travel map's destination
pick and throws the journey away: no gold, no time, no
speed/transport/lodging choice, no arrival clamp, no cautious heal, no
disease warning. What it keeps is DFU's two calls — `TransitionExterior`
**first** when the player is inside (you cannot teleport out of a
building), then `TeleportToCoordinates`, whose `OnInitWorld` applies
the destination climate's weather slot exactly as fast travel's
arrival does. That last symmetry is why the weather line stays and the
`tickWeather` line goes: no time passed to tick. The host law has no
seam to drive from a unit test, so it is pinned at its source — the
two calls present and in order, the six journey calls absent, and the
same six asserted *present* in `fastTravelTo` so the list is not a
straw man.

**THE HOST DOOR.** The interior arm cannot build this window: the
travel map's dependency list is the world's, and only the world host
has a streaming world to land in. So the service asks
`host.openTeleportMap?.()`, the same shape G8's `revealLocation`
takes, and a host without one gets the popup's own "not available yet"
arm rather than a crash. The world host arms the map before handing it
over; the other two hosts are swept to prove they carry no such door.
The construction of the map itself moved into one
`buildTravelMapWindow` while this was wired, because a second opener
and a twelve-dependency list is exactly how two copies drift.

**PROBED LIVE** (`tools/teleportProbe.mjs`), in the world host: the
map opens armed through the host's own door; finding Burgcester and
picking it opens the **teleport** box and not the travel one, naming
the right place; the save envelope is still three booleans with the
box up; No leaves the map armed; and Yes lands the player at
(204, 210) with **gold 100 → 100 and the clock 523530 → 523530** —
free of gold and free of time, which is the whole difference between
this and the fast travel that shares its map.

Pins: 7 in `teleportpopup.test.js` and 3 added to
`travelmapwindow.test.js`. 10 mutations, 10 dead.

## U43 - ONE DISPATCH: the windows work everywhere (2026-08-24)

`src/ui/input.js` (routeKey grows the two journal doors) +
`src/ui/questJournal.js` (a DisplayMode door) + `src/ui/charsheet.js`
+ the four hosts. `test/inputmap.test.js` and
`test/charsheetnav.test.js` (+2 each), two existing pins re-aimed.

**Step through a shop door and seven windows stopped existing.**
`GameManager.Update` (`:509-557`) is a single flat dispatch chain -
CharacterSheet, Inventory, TravelMap, Rest, Transport, LogBook,
NoteBook, CastSpell, UseMagicItem - with **no scene gate of any
kind**. DFU has one UI stack and it does not care where the player is
standing. The port had THREE chains: the two exterior hosts hand-roll
one each, every arm of it gated on
`(modes?.mode ?? 'exterior') === 'exterior'`, and `worldModes`'
interior arm hand-rolled a third that answered exactly two actions -
CastSpell and Escape. So F5, F6, L and N all died the moment the
player walked into a building, while the windows themselves sat built
and mounted somewhere else.

**The dungeon arm was already right.** `routeKey` in `ui/input.js` is
the port's `Update()`: a table keyed on the action registry, with each
host supplying a ctx of hooks. It has driven the two dungeon contexts
since I2. The interior arm now routes the same table over an
`interiorKeyCtx`, which makes two of the four hosts share one
dispatch and leaves the exterior pair's hand-rolled chain as the
remaining divergence - FLAGGED below rather than half-converted.

**The windows are the OUTER host's, not new ones.** The interior host
already mounted `host.makeInventory` for G6's knightly gift; it now
takes `host.makeCharSheet` and `host.makeJournal` the same way. THE
ONE CONSTRUCTION SEAM holds: the host that owns the dependency list
builds the window, and the interior host only decides which slot it
lands in - `interiorOverlay`, because that is what this mode draws,
clicks, hovers and keys.

**Two of GameManager's own actions had never been read at all.** L
and N have been in the binding table since I1 and `grep` found no
consumer anywhere in `src/` outside the table and the rebinding grid,
while `ui/questJournal.js` sat fully built with all four of its
pages. They are ONE window with two doors:
`dfuiOpenQuestJournalWindow` pushes it as it stands and
`dfuiOpenNotebookWindow` sets `DisplayMode = Notebook` first
(`DaggerfallUI.cs:704-711`), which is now the window's `mode`
argument.

**A comment that had gone false.** `dungeonContext`'s character sheet
withheld its LOGBOOK button on the note "this host has no quest
bridge". True of the standalone `?dungeon` page; false of every
dungeon `worldModes` mounts, where the bridge rides in through `opts`
and the save seam has been reading it since B4. A player standing in
a quest dungeon with three active quests was told the screen could
not see them. The bridge's own null is passed through rather than
substituted with an empty list, so the standalone page still gets
`charSheetHooks`' honest refusal - and `?town`, which mounts no
bridge either, answers neither L nor N for the same reason.

**What the interior arm deliberately does NOT answer.** There is no
`quickSave` hook. Interior saving really is unbuilt - the composer
saves from the exterior and the dungeon contexts - and the pause
window's SAVE button already gives DFU's cannot-save line rather than
pretending. The pin asserts the ABSENCE, so wiring the key without
building the save fails here.

**Two pins re-aimed rather than deleted.** AUDIT 21's F3 pin demanded
the literal `overlayAction(e)` in `worldModes`, and I3's demanded its
hand-rolled `mode === 'interior' && actionOf(e) === 'Escape'` arm.
Both named a SPELLING of a law now satisfied through `routeKey` -
whose overlay branch makes exactly F3's fork, and whose `Escape` case
is exactly the one door I3 was reaching for. The interior arm's own
copy of the fork was the duplication F3 was written about, so it is
deleted and the pin now asserts `worldModes` does NOT map the action
a second time.

**What the mutation campaign caught.** 19 mutants, and the first pass
killed only 11. Every survivor was the same mistake: the pins matched
a method's NAME, so emptying `toggleLogbook`'s body left it answering
the key and opening nothing - which is the gate this slice removed,
wearing a different hat. Each hook is pinned by what it MOUNTS now.
One more survived after that: `questJournalHooks()` appears twice in
`dungeonContext`, so deleting the SHEET's spread still matched, and
the logbook button went dark with the pin green. Scoped to the
sheet's own hook bag.

**U43-ii: and then the messages.** The window half left two seams
still speaking to devtools, both of them one line of plumbing rather
than an arc:

- `townTalk.frame` ticks and draws the HUD TEXT LAYER as well as the
  overlay (`townTalk.js:571, :586`), and both exterior hosts called it
  in their modal branch only WHEN A WINDOW WAS UP. AUDIT F2-I1 added
  that line to tick a window and gated it on the window existing. So
  inside a building a broken weapon, a fatigue warning and a level-up
  all spoke to the console while the player watched a HUD with nothing
  on it. Unconditional now, and the interior host's `say` is the outer
  host's.
- `showQuestOverlay` answered `interior` and returned false for
  `dungeon`, so `world.js`'s `showQuestBox` fell through to a
  `console.warn` saying the dungeon seam "pends". The dungeon context
  has held an overlay since U3 and exposed only a GETTER; nothing
  exported a way in. It has a `showOverlay` that REFUSES rather than
  clobbers a live window, and the fall-through is townTalk's own slot
  - which draws above the modal render in every mode - rather than a
  warning. THE CLASSIC START runs `_TUTOR__` and `_BRISIEN` inside
  Privateer's Hold, so what this was silencing was the first ten
  minutes of a new game.

Pins: 3 added in `inputmap.test.js`, 2 in `charsheetnav.test.js`, 2
re-aimed (`audit21_hosts`, `pausewindow`). 26 mutations, 26 dead.

FLAGGED: the two EXTERIOR hosts still hand-roll their chain rather
than routing `routeKey` - the same seven arms, gated on a mode test
that is now correct only because the interior host answers for
itself. Converting them is the other half of this slice and wants its
own pass, because their ctx is the one with the quicksave, the travel
map and the automap in it. TravelMap and Rest are in DFU's chain and
in neither the interior ctx nor `routeKey`'s table: Rest is its own
slice (`CanRest` + `MoveToBed`, and the tavern's rented room is
waiting on it), and fast travel from inside a building wants the
teleport arm's guards looked at first. Transport and UseMagicItem
have no window to open at all.

## U45 - HUDLARGE: the bar every screenshot of Daggerfall has (2026-08-24)

`HUDLarge.cs`, whole. The classic bottom status bar — the single most
recognisable piece of Daggerfall's screen, and this port drew none of
it. What made this slice worth taking now is not the bar: it is that
**two live seams were already pointing at it and neither had anything
on the other end.**

**THE SETTING NOTHING READ.** `GUI/LargeHUD` has been in the settings
store since the MENU slice, and the pause window's FULL SCREEN button
has been *writing* it since I3 — its own comment said "No large HUD
exists in the port yet". The settings screen was reporting a working
toggle for a feature that did not exist. The settings audit's
both-ways tier map now names `ui/hudLarge.js` as its consumer, along
with the three that shape it.

**THE OTHER DEAD SEAM WAS THE ONE THAT MATTERED.**
`IsLargeHUDInteractable` is `cursorActive && !paused`, and
`cursorActive` is `PlayerMouseLook`'s ActivateCursor toggle — Enter,
bound in the input registry since I1, **with no consumer anywhere in
the port**. So the port had no way to free the mouse during play at
all, and the eleven panels would have been decoration. It lands in
`player/pointerLock.js`, where the lock lifecycle already lives, and
DFU's own precedence rule ("when cursor simply active from closing a
popup, a click will recapture cursor" — but a *deliberately* activated
one is not taken back) is **one line inside `requestLook`**, which
every relock-on-gesture arm in every host already goes through. Eight
call sites, no ninth to remember.

**IT IS AN ALTERNATIVE HUD, NOT AN ADDITION.**
`DaggerfallHUD.cs:214-220` turns off the vitals, the compass *and* the
interaction-mode icon whenever the bar is up, "as they conflict in
space or utility". The crosshair and the breath bar stay. So this is
an early branch inside `drawHud` rather than a fifth draw call at the
end, and the one component that outlives it is drawn there with the
mode icon suppressed.

**ELEVEN CLICKABLE PANELS, EIGHT OF WHICH DRAW NOTHING.** The bar art
already has the buttons painted on it, so options, spellbook,
inventory, sheath, use-magic-item, transport, map and rest are pure
hit rectangles over `MAIN00I0`. Only four things draw over the bar —
the colour field, the compass needle, the head, the mode icon — plus
the three vitals in their own rects inside it. The eleven are proven
**disjoint in both directions**, which is why DFU's component order
cannot matter and neither can this port's loop.

**THE PANELS POST ACTIONS.** DFU's handlers `PostMessage` into the UI
manager; the port's equivalent vocabulary is the input registry, so
`routeAction` was pulled out of `routeKey` and both the keyboard and
the bar now reach **one door per destination**. The exterior hosts'
hand-rolled ladders collapsed onto the same `hudCtx` object in the
process — they had been a second copy of the same list. A hit on the
bar is **consumed whether or not anything answers it**: an unwired
action must still swallow the click, or pressing REST in a host with
no rest door would fall through and swing the player's sword at the
floor.

**THE TWO MODE CYCLES DISAGREE — and it is DFU's, not a slip.**
`PlayerActivate.NextInteractionMode` walks the enum: Steal → Grab →
Info → Talk. This panel's left click walks Steal → **Talk** →
**Grab** → Info, and its right click is the exact inverse of *that*.
So clicking the bar's mode button and pressing the mode key move
through the same four modes in different orders, and a player who does
both gets a sequence neither would produce alone. Ported as two walks,
because they are two.

**THE ART IS ALL CLASSIC** — no Ledger-A departure here, unlike U38's
crosshair and icons, which DFU authors as its own PNGs. `MAIN00I0.IMG`
(320×46), `MAIN01I0.IMG` (the four 47×23 mode icons in one 47×92
sheet), `MCOL00I0.CIF` record 0 (the 66×36 colour field behind the
portrait and vitals), and `CMPA00I0.BSS` — which needed **a new
reader**.

**THE TWELFTH IMAGE FORMAT.** `formats/bssFile.js` is the simplest
file in ARENA2: ten bytes of header (five `Int16`) and then
`FrameCount` frames of raw palette indices, so `10 + n·w·h` *is* the
file size — the corpus gate, exact to the byte on all three shipping
files. All three carry **32 frames** and differ in *size* (48×40,
34×28, 30×25), so a reader that hardcoded the standard needle's
dimensions would decode two of the three as garbage while consuming
exactly the right number of bytes. The header also carries a screen
position — (272, 157) — that nothing reads, because `HUDLarge` places
the compass at its own (275, 2) inside the bar. Ported anyway: a
reader that silently drops two fields cannot be checked against the
bytes. `.BSS` joined the download diet under `dataSource.js`'s own
rule, all three needles for 116KB.

**DOCKED COLLAPSES TO SOMETHING SIMPLE.** `AutoSizeModes.ScaleToFit`
scales by height first, that overflows the width test immediately (a
320×46 bar filling 200 units of height is seven screens wide), and the
fallback wins — so the bar is exactly the screen's width, its height
in proportion, flush to the bottom, and the `CustomScale` term cancels
out of both. Undocked is the native scale times
`LargeHUDUndockedScale`, aligned — with alignment *None* forced to
Centre, so 0 and 2 are the same bar.

**PROBED LIVE** (`tools/hudLargeProbe.mjs`) at 1280×720: with the
setting off the bar reports nothing; flipping it draws a bar 1280 wide
and 184 tall flush to the bottom edge; all four ARENA2 files decode
and upload at their real sizes with a **32-frame** needle and a racial
head; the mode panel walks `steal → dialogue → grab → info` while the
keyboard walks `steal → grab → info → dialogue` **in the same live
session**; all eight probed panels post the right action, with the map
answering AutoMap on the left and TravelMap on the right; and a
synthesised `pointerdown` on the INVENTORY panel opens the real
inventory window in the exterior host.

**FLAGGED, by name:** `HUDActiveSpells` (the buff/debuff icon rows)
and `HUDEscortingNPCFaces` (quest-gated) are the rest of that Ledger
row. `LargeHUDOffsetHorse` and `LargeHUDUndockedOffsetWeapon` move the
bar for a horse sprite this port does not draw and a viewmodel with no
such offset seam, so both settings stay read by nothing and are
recorded that way rather than silently tiered live. The interior
host's char-sheet and inventory panels swallow their click and do
nothing, because F5 and F6 do not reach interiors either — the same
arc, named in the same place.

**AND THE MERGE FOUND A LIVE CRASH ON MAIN.** Re-running the probe
after taking `origin/main` timed out at boot, and the console said
why: `Cannot access 'say' before initialization`, thrown by
`createWorldModes` **on its first statement** — `say` is read inside
`createPlayerTicker`'s options object and declared with `const` forty
lines below. `bootExterior` died with it, so **the exterior host did
not boot at all**. Two declarations move above their use. A gate for
it landed here first and was **removed one slice later**: another
session found the same crash from the other side — by starting the
game, in a first-hour playthrough probe — and wrote
`test/tdz.test.js`, which parses every file in `src/` to an AST and
reports a reference evaluated in the same execution scope as a
declaration it precedes. That is this law done properly over the whole
tree rather than over three boot functions by line, and two gates for
one law is the second copy this project keeps deleting.

Pins: 11 in `hudlarge.test.js`, 4 in `bss.test.js`, 1 added to
`audit24_wave37.test.js`. 16 mutations, 15 dead, 1 recorded
equivalent.

## U46 - HUDACTIVESPELLS: the magic you have been under all along (2026-08-25)

`HUDActiveSpells.cs`, whole. The second of the three components on
U45's Ledger row, and the one that makes the magic the port has
*already been running* visible: every buff, drain, paralysis and
concealment since the S-arc has been invisible on screen unless the
player opened the spellbook and counted.

**IT READS THE BUNDLES X10 ALREADY BUILT.** `systems/mysticism.js`'s
`liveBundles` folds each cast's entries back into one bundle carrying
its name, its type and DFU's per-bundle **ShowIcon** law — and that
law is word for word this window's `ShowIcon` (:177-190). So the
Dispel Magic picker and the HUD read one function, not two: an armed
Open marker is skipped in both, and a held item's bundle shows
whatever its kind, which is the `|| fromEquippedItem != null` half.

**TWO FIELDS JOINED THE BUNDLE STAMP,** because neither is derivable
once the entries are on the list: the spell record's own **icon**, and
whether the **player** cast it. DFU's split is `caster == null ||
caster != player` → the debuff row, so a bundle with no recorded
caster is a debuff — which is what a trap or an RDB action's cast
looks like, and DFU says as much in its own comment. The pin for that
needs a fixture that really leaves the field *absent*, because the law
lives in `liveBundles`' `!!` normaliser and a pin one layer up cannot
see it.

**ONE POOL, TWENTY-FOUR SLOTS, AND THE INDEX IS SHARED.** `poolIndex`
increments across both lists in one walk, *before* the split, and
`AlignIcons` then skips anything past the end. So the cap is on the
total: thirty bundles list thirty and draw twenty-four, and an icon
that overflows is silently absent while still having consumed its
number. A per-row counter draws thirty and fails the pin twice.

**EIGHT LAYOUT SCHEMES, AND THE EIGHTH IS WORTH READING TWICE.**
`smallhorzbottom` sets `iconColumns` to **zero**, against a
`++column == iconColumns` test that a counter starting at 1 can never
satisfy — which is exactly what its own comment ("No wrapping") means.
Ported as written rather than special-cased, because the arithmetic
already says it. It is also the one scheme that puts the **debuffs
above the buffs**, because both its rows are at the bottom and
stacking is the only way to separate them. An unknown scheme name
falls to Classic, where DFU's defaultless switch leaves both
positionings null and throws on the first icon.

**THE BLINK IS THE WARNING, AND IT IS NOT FOR ITEMS.** A bundle whose
*longest* effect has under two rounds left is expiring and blinks at
4Hz — the longest, because "a spell can have multiple effects with
different round durations" and the icon belongs to the whole cast, so
one long member keeps a mixed cast solid. An equipped item's icon
never blinks: its effect is not running out, it is just there. Paused,
everything shows. The clock toggles **once per frame**, DFU's `if` and
not a drain, so a two-second stall makes the blink lag rather than
strobe — a difference that is visible, which is why it is verbatim.

**THE ROWS DODGE THE BAR, UPWARD ONLY.**
`AdjustIconPositionForLargeHUD`: "Icon will remain in default position
unless it needs to avoid being drawn under HUD." The buff row at y=16
is already clear and must not move; the debuff row at y=177 lifts to
the bar's top minus 18. And the rows are drawn on **both** branches of
`drawHud` — `DaggerfallHUD.cs:209` enables them from `ShowActiveSpells`
alone, and the large-HUD block below it turns off the vitals, the
compass and the mode icon without ever touching these.

**A SEAM THAT WAS FEEDING ONE CONSUMER.** The spell icon sheet loaded
with the **spellbook window** — its only reader until now — so the
rows would have been blank until the player happened to open their
book once. It loads with the rest of the HUD's art instead, fired and
not awaited like the registries beside it. That is the F2 shape: a
feature that silently does nothing while every pin stays green.
`GUI/IconsPositioningScheme` is tiered live at last, the third setting
in two slices that the screen was offering with nothing behind it.

**THE POINTER IS ONE STORE.** DFU hangs a ToolTip off every pooled
icon panel and lets each panel's MouseEnter raise it. The HUD is not a
window here and owns no pointer handler — the four hosts own the
mouse — so the virtual position lands in one store on its way past,
before each host's overlay return, because an overlay up is exactly
when the tooltip is allowed to show. One store, one blink clock, one
tooltip: there is one HUD, and four hosts each counting their own
phase would strobe when the player walked through a door.

**PROBED LIVE** (`tools/activeSpellsProbe.mjs`) at 1280×720 on a real
character: the sheet is loaded with the spellbook never opened; a real
**Chameleon** from the starting book, self-cast through `applySpell`,
lands in the buff row at (27, 16) carrying icon 2 with its non-vendor
`!` trimmed; a second spell cast by a *foe* lands in the debuff row at
y=177 (a re-cast of the same spell would not — AddState stacks rounds
onto the incumbent and pushes no entry at all, which the probe says
out loud); turning the large HUD on leaves the buff at 16 and lifts
the debuff from 177 to 160; and the tooltip finds the icon under the
pointer and nothing on empty screen.

**FLAGGED:** `HUDEscortingNPCFaces`, the third component of that row,
is quest-gated and not here. DFU's icon *packs*
(`Resources/SpellIcons`) remain the Ledger note they already were on
`ui/spellIcons.js`.

Pins: 13 in `hudactivespells.test.js`. 10 mutations, 8 dead, 2
recorded equivalent — the wrap test's guarded `>=` (a counter that
resets at N can only reach N, so it is the same program) and the
caster split's `=== false` (`liveBundles` has already normalised the
field, so nothing undefined reaches that line; the pin that matters is
one layer down, and it is there).

## U47 - THE HOVER INFO PANEL, and two doors that leaked (2026-08-25)

Three rows off the Ledger in one sitting, and all three were the same
shape: something drawn, bound or built, with nothing on the other end.

**THE INFO PANEL.** U25 drew the 37×32 cutout at (223, 145) and filled
it from the last Info-mode *click*. DFU fills it from **hover** —
`OnMouseEnter` on every list slot, on the paperdoll's item layers, and
on the gold button. U37 built the mouse-move seam this waited on;
what was left was the window growing its own `hover(vx, vy)`, and now
it has one.

**THE PANEL IS STICKY, and that is the part worth stating.** DFU has
no `OnMouseLeave` arm at all — only two `SetText(empty)` sites, a tab
change (:814-816) and a window push (:663-664). So moving off an item
leaves the panel exactly as it was, which is what makes a panel 37
pixels wide usable: you read it *after* your hand has moved on.

Pinning that took a second pass. The obvious pin hovers over dead
space and asserts nothing changed — and it passes whether or not the
code clears the panel on a miss, because dead space never reaches the
miss branch. The arm that matters is an **empty slot inside the
list**: DFU's scroller raises `OnHover` only for a slot that *holds*
an item, so slot 2 of a two-item bag is the branch a clearing bug
would take. Same correction for the box pin — hovering on *nothing*
behind a box proves nothing; hovering squarely on a **different item**
does.

**THE GOLD BUTTON'S LINES ARE GENERATED,** not TEXT.RSC:
Internal_Strings `goldAmount` and `goldWeight`, with a **conditional**
format — `weight.ToString(weight % 1 == 0 ? "F0" : "F2")`. A whole
number of kilograms shows no decimals, anything else shows exactly
two. At 0.0025 kg a coin, that is every multiple of 400 gold and
nothing between.

**A DOOR THAT LEAKED THE POINTER.** `townTalk.pointerdown` tested
`overlay?.click` where it should test `overlay`, so a click on an open
window that happens to have no click handler fell **through** to the
host's `requestLook` and grabbed pointer lock out from under the menu
the player was reading. `worldModes` carries the corrected shape with
the reasoning spelled out beside it; this host was the copy that never
got it (AUDIT 18, routed 62). The pin has to read the guard *inside*
`pointerdown`: `hover` a few lines below carries the same line, and
the first draft matched that one while the defect was restored.

**AND THREE KEYS THE BROWSER WOULD STEAL.** F5 reloads, F6 moves
focus, F11 goes fullscreen — and all three are DFU bindings
(CharacterSheet, Inventory, QuickLoad). Each host kept its own
two-key list; F11 was in none of them. One list now,
`BROWSER_STEALS` in `ui/input.js`, called **first** by every host that
registers a keydown. Swallowing is deliberately *not* conditional on
the host having a destination — that is exactly what left the exterior
host out, since it has nothing to quickload and must still not go
fullscreen, and `worldModes` returns before any `preventDefault` in a
dozen places.

**PROBED LIVE** (`tools/hoverPanelProbe.mjs`) with a real mouse: F6
opens the real inventory, a `page.mouse.move` onto list slot 0 fills
the panel with **Saber**, moving to dead space leaves it there, the
gold button takes it, and a click on the Ingredients tab empties it.
That is the seam this proves rather than the law: `townTalk`'s hover
channel has gated on `overlay?.hover` since U37, so the inventory was
the window it silently skipped — and a method nothing calls is the
failure this project keeps finding.

Pins: 4 added to `nativeinventory.test.js`, two existing pins re-aimed
(I4's right-click seam and AUDIT 23's hosts-6 swallow, both of which
named a *spelling* of a law that now lives one file over). 7
mutations, 7 dead — three of them only after the pins that should have
caught them were rewritten.

## U48 — the rest dispatch, and the fourth host

V5 landed while this slice was in flight, and it did the same work
from the other end: `CanRest` ported whole, three hosts wired,
`plainLines` for the TEXT.RSC rows, one generic `tick` so no host can
forget the clock. Two implementations of one law cannot both live, so
V5's is the port and U48 is what it left. `canRestHere`,
`makeRestDeps` and a second tick seam were deleted rather than merged.

**THE LADDER THAT RUNS BEFORE CANREST.** `CanRest` answers *where* a
player may sleep. `DaggerfallUI.cs:651-688` answers *whether the
window opens at all*, and it still lived inline inside
`dungeonContext` alone — so above ground the rest window opened while
swimming, while falling, and with a foe in the street. It has no scene
gate: enemies, water, the ground, and nothing else.

Three things in that ladder are worth reading twice. **Enemies outrank
the water**, because DFU's is an `if`/`else if` chain — and it
matters, because only the enemy arm raises the alert that arms the
rest-encounter roll. The **prevented-rest registry's empty string** is
deliberate: `RegisterPreventRestCondition` turns a null message into
`""` so a caller can block rest without wording it, and the dispatch
falls back to TEXT.RSC 355 rather than showing a blank box. And a
**racial override refuses silently** — DFU simply returns, so that
verdict carries no text at all — from the *bottom* of the ladder, so a
swimming vampire is told about the water, which is the arm they can
act on.

**STARTRESTGROUNDEDCHECK MOVED TO ITS DFU HOME.** `PlayerMotor.cs:184-194`
short-circuits on the flag, then casts a ray from the controller
*centre* for `height/2 + 0.2` — DFU's "collision fix for when player
is levitating but feet are close enough to ground to rest". It lived
inline in the dungeon context, which was fine while that was its only
caller; U48 gave it two more, so the copy is gone rather than
duplicated. A hit at distance **zero** is a hit — the ray starts
inside the capsule — which is why the test is `Number.isFinite` and
not truthiness.

The raw `grounded` flag turns out to be wrong up here for a reason DFU
never has: on a page whose motor is never stepped it sits at its
initialiser `false` forever, so the rest key answered *"You cannot
sleep now."* on solid ground. That is what makes the fallback ray
load-bearing outside the levitation case, and it is pinned as the
initialiser for exactly that reason.

**THE ?TOWN PAGE IS THE FOURTH HOST.** V5's own pin says *"every host
that can hold a player now has a rest arm"* and names three. This page
holds one. It goes through the same two laws, the same deps factory
and the same verbatim two-step — and its `CanRest` arm is a
**constant**, because the page *is* a location and its player is
always outdoors: there is no wilderness to step into and no building
to step inside.

**AND THE ENCOUNTER ROLL RIDES INSIDE THE ADVANCE**, in the world host
alone. It is the only host with a mobile foe pool, and its frame body
returns at the overlay gate — so left to the frame, a whole rested
night's rolls fire in one burst the moment the window closes, which is
AUDIT 24 wave 30's finding about the magic rounds, one system over.

**THREE PINS NEEDED A SECOND DRAFT**, each because it matched *prose*
or a neighbour rather than the code: a ban on the raw `grounded` flag
found the world host's probe surface; an ordering pin found the
comment that explains the two-step thirty lines above it; and asking
only that `restDecision` *appeared* in a file passed a toggle that
hardcodes `{ kind: 'rest' }` and leaves the helper unused — both hosts
survived that one.

Pins: `test/restwhere.test.js`, 8 tests, **28 mutations, 28 dead**.
Two pins in `travelmapwindow.test.js` were re-aimed on the way past:
one sliced `frame()` by a magic 900 characters, and the other checked
for a `dispose` anywhere in the function rather than in the drain, and
survived its own mutant.

## FROM PLAY (2026-08-27): Z IN A DUNGEON - the second door to the sheath

Mac: "cannot sheath/desheath in dungeons". Every host polls ReadyWeapon
per frame on an edge - WeaponManager.Update:284's ActionStarted, which
is where DFU reads it; it is not in GameManager's key dispatch chain
(:509-557). U45 gave routeAction a ReadyWeapon arm so the large HUD's
sheath panel could reach the same door, and from that commit the
KEYBOARD reached it too: the two dungeon hosts route keydown through
routeKey -> routeAction, and the dungeon context is the one ctx that
carries toggleSheath. One press, two toggles, net nothing. Above ground
and indoors the ctx had no toggleSheath, so one path fired and it
worked - which is why it read as "dungeons only". routeKey now declines
POLLED_ACTIONS (ReadyWeapon); the panel keeps routeAction. Pinned in
test/sheathkey.test.js (the keyboard OFF, the panel ON, every host's
poll and both dungeon routers present), 2 mutants dead.


## PX1 (2026-08-27, Mac: "this is it. YES"): THE PIXEL HOME

The enhanced boot menu's FRONT FACE, adopted from the menu-pixel.html
prototype: the boot door opens on `section = 'home'` - a boxless
centered list over `src/ui/pixelGround.js`'s Bayer-dithered night
(seeded stars, square pixels derived from the viewport at 1/4 scale,
redrawn on the mount-owned resize listener), Jacquard 12 pixel
blackletter wordmark, Pixelify Sans list, and the focused row wearing
THE CLASSIC SHADOWED-LABEL PAIR - 243,239,44 over 93,77,12 - the idiom
every native window draws. States SNAP; the block declares no
transitions. Every home row NAVIGATES to the pane that already carries
its laws (Continue's restorable card, the Mods waiting-room) rather
than acting - a home that re-decided Continue would be a second
implementation of the Continue pane. Escape backs a section out to
home (a new rung above the pause-resume arm); the brand wordmark in
the section shell is the same door for a finger. The pause door is
UNTOUCHED - its pixel face is its own slice, as are the section
shells' own restyles. The two pixel faces joined the skin's ONE fonts
request (landing.test.js repinned to the new bytes, with a measured
four-family assertion beside it); the pause-open pin repinned to the
new shape with its pause half unchanged. Verified live over the built
bundle: menu.html on desktop + phone, a Settings walk, Escape home,
zero page errors. Prototypes of record: menu-redesign.html (smooth),
menu-pixel.html (adopted).

PX1b (same day, Mac): THE SKY LIVES AND THE FOOT SETTLES.
drawPixelGround takes `t` seconds - the fog blobs orbit their homes on
unequal periods and the bright quarter of the stars twinkle in STEPPED
levels (a pixel star fades in levels, not a ramp); default t=0 is the
prior still frame, and the module never schedules - the home mount
owns an 8fps interval (pixel art's cadence; 60fps dither reads as
noise), cleared by every rebuild and by unmount, skipped under
prefers-reduced-motion. The foot is a three-zone grid: build left,
the skin toggle DEAD CENTER with the 'switch anytime' hint hidden
(the shell keeps it), and ABOUT as the bottom-right plaque - the ONE
box on the boxless face - leaving the center list; the About SECTION
stays on the shell rail so the rail-hole pin and shared-sections law
hold. Under 480px the foot stacks two rows (the three zones made the
toggle wrap into the build line - caught in the phone shot). Probed
live: two canvas frames 1.5s apart differ, the About box opens its
pane with the clock cleared, Escape returns home, zero page errors.

PX2 (same day): THE PAUSE DOOR WEARS THE FACE. Both doors open on
`section = 'home'` now - U51's pause law ('open on Save Game, what
Escape was pressed for') is REPLACED DELIBERATELY, one press of depth
traded for the adopted face, Save Game the second row a thumb meets
and Resume the first; the pin repinned to the new shape with a
MEASURED resume-arm assertion beside it. The pause face draws NO SKY
and NO WORDMARK - the paused frame is the ground (`.px-over`, a 0.78
ink scrim; a masthead on every Escape is a billboard) - and the clock
never starts, so pause costs no interval. The Escape ladder unified:
confirm -> sheet -> any section backs to home -> home resumes (pause)
or stays (boot); the shell wordmark goes home in both modes. Probed
live over a stand-in frame with the module mounted in pause mode:
scrim on, sky and wordmark absent, Save pane opens, Escape home,
Escape resumes exactly once, zero page errors. STANDING CAVEAT: the
scrim is tuned against a stand-in - the first real-ARENA2 eyeball may
move the 0.78.
