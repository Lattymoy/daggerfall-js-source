Warning: truncated output (original token count: 220867)
Total output lines: 15733

# UI-Arc (ACTIVE)

Opened 2026-07-06 after Combat completed. Goal: the classic
Daggerfall UI over our WebGL2 frame - HUD first (the Systems stats
exist, nothing shows them), then the paper windows (chargen, char
sheet, inventory, spellbook) that retire the headless interim
policies one by one.








## HN1 DAMAGE NUMBERS (2026-08-31)

Mac: a new feature that folds into the enhanced UI - damage numbers on
attacking, colour-coded non-crit vs crit, missed text.

THE NUMBERS ARE A READOUT OF THE FORMULA, NOT A SECOND OPINION.
CalculateAttackDamage reports once per player attack through one
seam, and the HUD draws exactly what it was told: the damage in the
HUD's bone; the same damage in brass and larger when Daggerfall's own
critical strike roll succeeded (classic parity - it lands on the
chance to hit, never on the damage, and the numbers do not pretend
otherwise); the tripled backstab, tagged; Miss, Ineffective and a
0 the armour took, dim. Rising from just above the reticle - the
point the player is looking at is the point they struck - with a
little scatter so a flurry fans out. Enhanced only: the enhanced HUD
registers the hook; the classic path never has one.


## INTRO2 THE SCORE-LED INTRO (2026-09-18)

Mac requested a complete overhaul of the unfinished intro, his supplied
Daggerfall Enhanced logo, a precisely timed final splash, and continued
quieter music after tapping into the main menu.

The shared front door in `main.js` now owns one `IntroTheme` session from
Begin through the menu. The recovered recording is decoded before Begin
is enabled. A trusted gesture unlocks audio; the film follows the audio
DEVICE timestamp with the observed display interval, not elapsed wall
time or a guessed tempo. The old U65 capture's corrective audio remuxing
is not retained. No game archive is requested until a game door is chosen.

| Score time | Presentation |
|---|---|
| 0–1.5s | Opening fade over the water |
| 1.25–5.3s | Interkarma / Daggerfall Unity credit |
| 5.65–9.3s | Nexus Mods credit |
| 9.45–12.162s | Continuous perspective camera rises through cloud |
| 11.712s | Measured cloud-break accent |
| 18.9s | Camera settles over the bay; GPU frame is held |
| 19.753333–20.533333s | Supplied logo falls into its final position |
| 20.533333s | Exact title landing on the first decoded beat of the closing pair |
| 21.883333s onward | Tap to continue; final title holds indefinitely |
| Player tap | 1.1s eased visual fade; same source ramps from 0.82 to 0.26 |

The landscape is the restored seeded, data-free bay generator rendered
with a new WebGL2 terrain, water, sky and cloud pass. One perspective
camera replaces the old column-renderer/orthographic handoff. The camera
finishes before the logo arrives; the subtle impact is composited over the
held background so terrain work cannot delay the final title. Rendering
is capped at 900,000 pixels and stops at rest unless the viewport changes.
Reduced motion keeps a fixed camera and reveals the logo on the same cue.

The supplied 1536×512 JPEG bytes are unchanged, correctly named `.jpg`,
and shared by the final splash, main-menu wordmark and sidebar home
button. Screen blending removes the supplied black backdrop without
resampling or redrawing the mark. Source identity is pinned by SHA-256.
The two credit assets and original recording are restored unchanged from
U65e, `8688721e`; no ARENA2-derived pixels are added.

Music levels multiply the live music setting (menu is about 10 dB below
intro). Fade input is swallowed and the mounted menu is inert until the
fade finishes. Starting any game releases the source, decoded buffer,
context and settings listener before classic/game audio can start.
Backgrounding suspends audio, interrupted playback offers Resume, missing
audio offers a truthful final card, and Skip remains usable during load.
The scene's listeners, frame callback and WebGL allocations are disposed
at handoff. The older classic data-backed title/splash remain on Begin.

Verification lives in `test/intro.test.js`, the independent decoded-score
check, and the browser probe/capture under `tools/intro*.mjs`. The rendered
preview evaluates the actual scene at frame/30, muxing the original score
at zero offset; it is a director's preview, not a hardware latency claim.
Live timing and uninterrupted lower-volume menu playback are separate
browser assertions. Desktop, portrait, short landscape, reduced motion,
missing music and skipping during loading are exercised there.
`?nointro` opens the existing front door directly for menu probes.
`?introdebug` and `?introat=seconds` are development-only review controls.

## U65 THE INTRO (2026-08-30) - HISTORICAL REMOVAL

Built through five versions in one day (U65, c, d, e: generated Iliac
flyover, measured beat grid, sync-verified capture) and removed the
same day at Mac's direction after every version failed his eye. The
enhanced door opened directly on the menu until INTRO2 above. History carries the original slice.

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
                        worldModes.js:1859 (the factory) and :1904 (a
                        HAND-ROLLED second one, 342 lines below it in
                        the same file),
                        dungeonContext.js:965, world.js:1850,
                        exterior.js:2200. It is the only window TWO
                        enhanced screens already push - the sheet's
                        button and the pack's USE hand-off, whose
                        close-then-hand-over ordering U55 got
                        backwards. No law needs extracting first.
    THE LOGBOOK         THREE sites: charSheetNav.js:53,
    / NOTEBOOK          world.js:5844, dungeonContext.js:6081. A seam
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


## U64 THE DOMAIN, AND THE HAT (2026-08-27, Mac's call)

Mac: "1. Set up this with my domain I purchased. 2. Set up my kofi
donation page on the website."

THE DOMAIN IS daggerfalljs.dev, NOT daggerfall.dev. Mac named the
latter; the Porkbun account holds the former, registered the same day
beside fightlife.gg. The account is the fact and the record says so,
because a wrong host in a pin is a test that passes against nothing.

DNS, set through Porkbun's API: the two PARKING records Porkbun leaves
on a new domain (an ALIAS and a wildcard CNAME, both to
pixie.porkbun.com) deleted first - they answer before GitHub would -
then GitHub Pages' four apex A records and four AAAA, and www as a
CNAME to lattymoy.github.io. The custom domain went on the repo's Pages
settings by API; the first attempt, which set `https_enforced` at the
same time, was refused with "the certificate does not exist yet" -
GitHub issues the certificate FROM the cname, so the cname goes on
alone and enforcement follows it. `.dev` is on the HSTS preload list,
so HTTPS is not optional there; it is on.

NOTHING WAS REBUILT. `base: './'` has been relative since the site
existed, so the same artifact serves from a project path and from an
apex - the comment above it named the old host and now explains the
rule instead. The page's own links are relative too, so it names no
host at all: the verifier and the README were the only two places that
did, and the pin now holds the PATH (the game is one directory down)
with the host following the domain.

THE HAT IS A PLAQUE. Mac asked for "an icon that's visible near the
top": a link at the door's top right in the About plaque's own shape -
the second box on a page that had one - with a CUP DRAWN IN BOX-SHADOW
PIXELS beside the words. Not an <img>, because a badge would be this
site's only raster and a raster is the one thing it does not carry;
not the Ko-fi widget, because that is a third-party script on a page
whose whole point is that it runs none. Ten art pixels on the same 4px
grid as everything else - a filled body, a lip, a handle, and two
pixels of steam in the dim rather than the brass. The first draft drew
the body as a RING and read as an 'o'; caught at 3x and filled. A
credits line carries the reason ("the port is free and always will be,
and it takes no money to run"), and those two links are the only ask on
the page.

Pins: 2 more (14) - the mark is one link and a credits line and never
an image, it is at the top right, it is a 44px target and the door
makes room for it on a phone, the cup's pixels are all on the grid with
exactly two of steam; and the live host is the domain in both places
that name one while the page names none. 4 mutants, 4 dead.

RESIDUE: www.daggerfalljs.dev was still answering 503 an hour in -
GitHub provisions the apex certificate first and the www alias after,
and it had not landed when this was written. The apex serves; if www is
still 503 tomorrow the fix is to re-save the domain in the repo's Pages
settings, which re-triggers provisioning.

## U63 THE SITE WEARS THE GAME'S FACE (2026-08-27, Mac's call)

Mac: "we've been doing some heavy UI work in another session and I want
to update our website, reorganized and bring it inline with our new UI."

PX1-PX19 made the enhanced UI PIXEL ART - a Bayer-dithered night, a
Jacquard 12 blackletter wordmark, Pixelify Sans lists, the classic
shadowed-label pair, boxless centred faces and framed windows with
corner gems. The site was still wearing the shell that replaced: a left
rail, Grenze Gotisch, brass-outlined panels - AND THREE SCREENSHOTS OF A
MENU THAT NO LONGER EXISTS, which is wrong rather than stale.

REORGANIZED MEANS THE SHELL WENT. The old page was the old menu's shape:
a sticky rail beside a scrolling pane. The home face has no rail - it is
centred and boxless - so the site is now a DOOR: a full-viewport stage
with the wordmark, the tracked ~~JAVASCRIPT~~ ENHANCED sub-line (BR1), a rule with the
brass gem, the one line of what it is, the ARENA2 sentence said before
anything asks for it, and PLAY as THE ONE BOX (the About plaque's own
shape, on a page with no other box). The sections below stack centred,
each opened by its own rule and gem, in the order a stranger needs
them. The foot is the home face's three zones: build and the test count
left, the line count dead centre, Source right.

THE NIGHT IS THE MENU'S NIGHT, NOT A LIKENESS OF IT. The page is a
DOCUMENT - no script, no canvas, and that is a pin - so it cannot run
`ui/pixelGround.js`. `scripts/landingHtml.mjs` builds the same sky in
CSS instead and injects it beside the tokens: the six-step RAMP as a
hard-stopped gradient, the two fog blobs as radials at the same
relative homes, the dither as a 2px checker, and the stars as a
box-shadow list from THE SAME SEED AND THE SAME LCG. Pinned both ways -
the ramp steps, the seed and the LCG against pixelGround's own text,
and the FIRST STAR against pixelGround's own stream, because a shared
seed that lands the field somewhere else is a shared style, not a
shared law. What it has not got is the drift and the twinkle: those
need a clock, and a clock needs a script.

ONE FONTS REQUEST, WHOLE. The site used to take a SUBSET of the skin's
request (the brand + data faces) because it was set in Grenze Gotisch
and the menu was not. It takes the skin's own URL now - one cache entry
for both pages, and no way for the site to be set in a face the game
has not got.

THE COLOUR LAW, RESTATED WHERE IT NOW BITES. U60's rule was "every
colour on this page is a var()", which held while the site wore the
shell's four tokens. The pixel face's palette is LITERALS in
enhancedStyle.js - rgb(243,239,44) over rgb(93,77,12), #d8cfae,
#7d7460 - because they are a drawing's colours, not a theme's. So the
pin is the same intent stated against the new fact: EVERY COLOUR ON THE
PAGE MUST BE ONE THE SKIN USES. It caught three of mine on the first
run (#a99f86, #3a3527, #23202a - invented mid-tones) and they were
replaced with the skin's own.

FOUND ON THE WAY, AND IT WAS IN THE GAME: Pixelify Sans ships an fi
LIGATURE whose glyph reads as a CAPITAL A. Caught on this page's first
render and magnified - "files" read "Ales", "first" read "Arst" - and
then found in the shipped UI, where "Enemies Fight Each Other" was
reading "Enemies Aght Each Other" in the settings list. Every enhanced
screen is set in this face, so `font-variant-ligatures: none` went on
the roots of BOTH pixel faces (`.shell` and `.px-home`) as well as the
site. Verified by eye at 3x on both, before and after.

THE PICTURES WERE RETAKEN, and one was retired. `tools/siteShots.mjs` (RETIRED whole 2026-08-31, see below)
then shot the pixel home, the home on a phone, and the settings shell.
The pack shot is gone: it was reachable only through a test seam (a
hand-built entity with the doll forced to its no-art schematic), and
with PX16's inventory it would need a new seam to pose a screen a
player cannot reach without game files anyway. Three pictures of
screens that draw themselves is a truer set than four with one staged.

THE PROBES FOLLOWED. `enhancedMenuProbe.mjs` was still waiting on
`#enhanced-menu .railbtn` - it had not been runnable since PX1 landed -
and U62's switch check was reading the SHELL's copy of the switch
because it ran after the Settings click. Both fixed: the pixel home's
list, the switch measured on the fresh home where PX1b put it (dead
centre of the foot, the hint hidden, the lit option gold and 44px), and
an Escape back to home before New Game, which is PX2's own ladder.
22/22. The landing probe grew the face and the night: the wordmark's
computed family IS Jacquard 12 and `document.fonts` says it loaded, the
body is Pixelify Sans, and the night is fixed with three gradient
layers and 90 stars. 40/40 on desktop and Pixel 5.

Pins: `test/landing.test.js` 12 (four new), 6 mutants dead.

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

MAP1 (2026-09-18) RETIRED THIS SCREEN WHOLE: ui/overworldMap.js,
render/overworldRenderer.js, tools/overworldProbe.mjs and
test/overworldmap.test.js are gone; the enhanced map is the held
parchment (ui/heldMap.js + ui/inkMap.js, bible/10-UI/Held-Map-Arc.md).
ui/overworldModel.js stays - its water, marker, trace and chain laws are
the ink's. What follows is the record of the screen as it shipped.

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
not a silent mock. `tools/siteShots.mjs` (RETIRED) was the only way the files
were made: it booted its own vite with ARENA2_PATH unset, PROVED the
game's data fetch 404s before it took anything, and threw if the
folder pick was on screen; the doctrine allow-list carried one OURS
row per file naming the tool, and the landing suite pinned every
<img> on the page tracked, allow-listed, produced, sized and
described. RETIRED WHOLE with the DA site cleanup (Mac, 2026-08-31):
the landing page carries no pictures at all now - the pin flipped to
"no <img>, no raster" - so the three files, their rows and the tool
went together, and the doctrine got simpler to hold.

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
JAVASCRIPT (~~the name~~ DAGGERFALL ENHANCED since BR1, 2026-09-13 -
Mac's rebrand; the two structural decisions stand untouched). Everything
below follows from those three.

THE PAGE IS THE SKIN'S OUTERMOST ROOM. The enhanced menu is a rail of
words and a pane that answers them, and it is the first thing a player
sees after Play - so the page in front of it is built on that shell
and not on a landing-page template: the same brand block with one word
swapped (~~JavaScript where the menu says Enhanced~~ - since BR1 both
say ENHANCED, so nothing is swapped), the same rail, the
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
the data picker now say ~~Daggerfall JavaScript~~ Daggerfall Enhanced
(BR1, 2026-09-13); project-dagger is the repo's name and the IndexedDB's,
and those stay.

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
                (:1460-1462). A S…190867 tokens truncated…iring walked host by host, the whole
chain driven by a real browser's keyboard, and the pins and records read
back. Six findings were defects and one was a defect in the pins
themselves. All seven are fixed; each is pinned by something that failed
before the fix and a mutant that dies on it.

### F1 - a cite tool rewrote a number inside a PIN, and found five that nobody had ever read

The merge ran `citeMerge`, which moved a cite number **inside a pick
regex** in `test/citedrift.test.js`. That is WM3's own documented
hazard, written at the top of that file: a literal in the pick decides
whether an entry MATCHES and asserts nothing.

Following it out was worse than the symptom. Five Ledger rows cite a
PAIR - `` `world.js:N`, `exterior.js:M` `` - and the table captured `M`
alone. So `M` was re-resolved at every wave for a year and `N` was never
read: `world.js:4385` named a line that is 8950, `:673` one that is
1215, `:1094` one that is 2194, `:3903` one that is 3066, `:3920` one
that is 8907. `world.js:4121-4153` and `dungeonContext.js:1316` were
stale the same way. Seven numbers re-resolved BY CONTENT, every
uncaptured half de-baked to `\d+`, and eight new entries added so every
number in a pair is captured. The half nobody reads cannot rot in
silence again.

### F2 - a hold that spanned a window drank a potion on the way out

DRIVEN, because it is a sequence and not a line. The player holds `1`;
a window opens and the frame goes `blocked`, which **cleared** every
hold; the window closes WHILE THE KEY IS STILL DOWN; the next tick finds
no state for the slot, reads the key as down, and calls that a rising
edge - so the release a moment later is a tap and a potion is drunk that
the player never asked for.

The guard had moved the bug one step later rather than removing it, and
the pin missed it by releasing the key *during* the blocked stretch. A
blocked frame DISARMS now: held down, already cycled (so its release
performs nothing), stepping never (so it does not walk the book under an
open window). The key has to come up and go down again to mean anything.

### F3 - the finger's timers outlived the HUD

The phone's hold is a `setTimeout` into a `setInterval`. A hold still
cycling when a host tears the HUD down left that interval running for
the life of the page: the node is gone, so no `pointerup` can ever reach
it again. The handles are kept and stopped in `destroyEnhancedHud`,
which is the law QS3 already stated for the listeners.

### F4 - the cycling lamp could never go out

The cell's `.cycling` class was written BELOW the block's signature
guard. A cycle changes a slot's name, so the lamp came on; when the hold
ends **nothing else about the block changes**, so the signature was
identical, the early return fired and the write was unreachable. The
cell stayed lit for the rest of the session. The lamp is part of the
signature now. A cell that cannot stop glowing is a cell that lies about
what the thumb is doing.

### F5 - the RESPAWN1 pin read the wrong publisher, and said "admitted" where it meant "carried"

Two weaknesses in one pin. It read `collectWorld`'s keys and called them
"the record the dungeon really publishes" - they are not: `sharedWorld`
STRIPS that record before the memory is sent (`delete f.items`, because
a corpse's loot is the room's `loot` half, AUDIT WORLD4 D4/B3). And its
field-by-field loop asserted only that a record came back TRUTHY, which
it always did, because `health: 1` rode beside every field. A field the
door has no law for is DROPPED IN SILENCE - which is the exact shape of
the bug RESPAWN1 was. The claim is `k in out` now, the vocabulary is
read off `sharedWorld`, and what the publisher strips the door must
refuse.

### F6 - one host's `blocked` argument was dead, and two more had doors it could not reach

The wiring walk. `scenes/dungeon.js` had its tick INSIDE its own
`walkMode && !overlayHeld` gate, so a blocked frame never reached the
call and the argument was decoration. The two outdoor hosts return above
their tick while a full-screen video holds the frame (`frameHeld`), and
a backgrounded tab gets no frames at all. Three doors, one hazard - and
a law enforced by four hosts is a law enforced by memory.

So the machine defends itself: a gap in the WALL CLOCK past
`QUICK_GAP_MS` disarms every hold, whatever the caller declared. The
dungeon page's tick moved above its gate as well, so its `blocked` is
live again. This is the one place real time is read in the model, and it
is read about FRAMES rather than about the game.

### F7 - ten mutants had quietly stopped applying

A mutant record names the exact source text it replaces. When that text
moves, `mutate.mjs` cannot apply it, says "did not apply" at the end of
a run nobody is reading, and the law it was the only killer of is
checked by nothing - while the slice still reports "N dead, 0 survived",
because a record that never applied is not a survivor. Eight had gone
stale under QS6 itself (five actions where there had been four, a
`blocked` decline added to two host ladders, a tap guard given a name)
and two in `relayversion` had been stale for waves, their anchor having
left `server/src/index.js` entirely.

All ten re-aimed by content. And the class is closed:
`test/mutantdrift.test.js` sweeps all 879 records the way
`test/citedrift.test.js` sweeps the cites, because it is the same claim -
a reference into source rots. Twelve records in four unrelated arcs were
ALREADY stale on the day it was written; they are carried in a named,
dated list that can only shrink, rather than re-aimed inside a quickslot
change.

### Recorded, not fixed

A lycanthropy or vampire spell is granted as a copy of its SPELLS.STD
record and keeps that record's INDEX, so a player who also knew the
standard spell of that number would have two book entries with one
index, and the slot would resolve to whichever came first. The cast
engine's own `setReadiedByIndex` has had exactly this law since S1, and
the save writes the same key - so the slot is CONSISTENT with the engine,
which is what makes the chip honest. Inventing a second identity here
would buy correctness in a case nothing can reach and lose the one
property the chip depends on. Flagged for Mac.

### What was driven

`tools/qs6HoldProbe.mjs` is the chain a player actually uses, in
Chromium, with Playwright pressing the keys: a real keydown, the OS's
own auto-repeat storm, a real keyup, a host's listeners written the way
`scenes/world.js` writes them, `held()` through the binding registry, and
a rAF loop asking the machine once a frame with whatever dt the frame
really took. Seven scenarios, 24 checks: a tap performs once and NOT on
the down edge; a hold cycles and drinks nothing; the spell key readies
and puts away through the engine's own arms; the auto-repeat storm is
declined every time; a window spanned by a held key performs nothing on
the way out; and the hold follows a REBIND, because it is an action and
not a key literal. It cannot boot the game - this container has no
ARENA2 - but every module the arc touched is the real one.

## HT7 + MWT1 + MWT2 - THE TORCH, THREE WAYS (2026-09-17)

Mac: "Take care of both. Also fix morrowind model's torch. It's
positioned incorrectly and isnt lit."

"Both" is HT6's pair - the two laws it recorded rather than departed
from, flagged as decisions and not fixes. He has made them.

### HT7 - a hand holding something is not free, sheathed or drawn

Handheld Torches' `UpdateFreeHand` has a sheathed arm (0x2c91-0x2cb8)
that clears a hand only for a BOW in the left slot, on the premise that
a sheathed weapon is away and takes no hand. HT6 recorded the
consequence - equip a shield with your weapon lowered and the torch
stayed lit in the arm the shield had just gone onto - and DEFENDED it:
"a Daggerfall shield is ARMOUR, strapped rather than gripped, so a torch
in that hand with the sword on your back is a true reading."

**That defence was wrong about this game.** Daggerfall has no back
sheath. "Sheathed" is WeaponManager's stance - the weapon is lowered,
still held, and drawn on screen the moment you swing - and this port
draws it that way. There is no state in which the sword is on your back,
so there is no state in which that hand is free to hold a torch. And it
is exactly the case Mac's ORIGINAL report was about ("When equipping a
shield or other offhand item, the torch in the inventory isnt shown
unequipped and replaced"), because sheathed is how a player walks
around.

So what is WORN takes a hand whether the stance is sheathed or not, and
the one clause that stays stance-bound is the mod's own bare right hand
"in use" (0x2d53): an empty hand you are not swinging with is free,
which is what lets a weaponless player carry a light. One line differs
from the IL.

The first cut of this was nearly INERT and the pins said so: clearing
the left hand alone still left the right one free, so the torch simply
moved across and Mac would have seen no change at all. The fixture that
caught it is the one that equips a sword AND a shield, which is a
player.

### HT7 - and the default that put your torch on the floor

The mod ships `Handling.OnStow = Drop`. HT6 made the hand law run at the
EQUIP MOMENT rather than on the next frame, and recorded what that
means: equipping a shield with your weapon drawn now drops the lit torch
on the floor while the inventory is still open, in front of you. A
player who equips a shield mid-fight has not asked to drop anything, and
a torch on a dungeon floor is an item lost to whoever does not think to
look down.

The port **defaults it to Unequip** - the light goes back to the pack and
`RememberLastLightSource` lights it again when a hand comes free, which
is what the rest of this mod is built around. The mod's own value is one
click away on the Mods pane's dial, nothing about the Drop path is
removed, and the throw is still how you put a torch on the floor on
purpose. It is the fourth entry in `PORT_DEFAULT` and the first that is
not about a key.

### MWT1 - the right bone, the wrong way up

`resolveTorchPart` hangs the Morrowind torch at `Shield Bone`, which is
the reference's own answer (a carried Light is a `PRT_Shield` part, rule
4's table and updateParts' "a carried Light's shield mesh"). The BONE
was never the problem. The ROTATION was missing.

`SceneUtil::attach` puts one PositionAttitudeTransform between the
actor's bone and the attached model, and the only rotation it can carry
is the caller's `attitude` - which `ActorAnimation::attach` passes for
`isLight` ALONE (:97-103) and never for a weapon (:104-105). It is an
extra **-90 degrees about X**, and this port's own reference notes wrote
it down at `02-Formats/Morrowind-Rules.md:3228`, beside the two
engine-injected transforms it DID port. The code never applied it.

It rides `preTransform`, the seam the arrow already uses - the same place
in the chain the reference's PAT sits, and Shield Bone carries no "Left"
so no mirror intervenes. The pin EXECUTES the rotation over the three
axes rather than reading the matrix, because a transposed matrix is a
different wrong answer that looks the same in a literal.

### MWT2 - the emission this port resolved and never read

`mwNifMesh.js` has always ported the reference's two emissive laws
exactly: `LightMode_Emissive` forces the DIFFUSE and the AMBIENT to
BLACK, so the surface "is lit only by its emissive term" (:2895-2902),
and `VertexMode_SrcEmissive` names the vertex colour as that term. It
resolved them into `material.emissive` - and **nothing ever read it.**
`packFpArm` wrote `diffuseAt` alone, and the character fragment had no
emission at all; its own comment said so ("C4b - no emission"), written
when the only meshes on that program were the voxel rigs, before MW-D11
brought real Morrowind meshes through it.

So the port drew a self-illuminated surface as a BLACK diffuse, times a
texture, times the room's light: black. **The torch's flame is exactly
that surface**, and a torch with a black flame is a stick.

`emissiveAt` is `diffuseAt`'s mirror on rule 63's substitution law. The
pack is three floats wider (`FP_FLOATS` 11 -> 14), the character program
takes a fifth attribute at location 4 - additive exactly as MW-D11's UV
channel was, so a VAO that never enables it reads the constant zero and
every voxel caller draws what it drew before - and the fragment adds
`vEmissive * texel.rgb` as the LAST term, after every light. It is the
one term the vertex colour does not gate, because LightMode_Emissive has
already forced that colour to black, which is the whole bug.

### Pinned

`test/mwtorch.test.js` (the attitude, executed over the axes),
`test/mwnifmesh.test.js` (+2: `emissiveAt`'s substitution both ways on
one material, the absent field reading as no light rather than a throw,
and the channel end to end), `test/ht1_handheldtorches.test.js` and
`test/ht6_offhand.test.js` (+1: the equip moment reading the dial FRESH -
a survivor AUDIT QS6 F7's sweep exposed, because every fixture had set
its dial before the first frame and a stale read looked identical).

### The debt AUDIT QS6 F7 carried, paid

The twelve mutant records the sweep found already stale are re-aimed and
the CARRIED list is EMPTY. Two came back on the BOX1/TI3 merge; the
other ten were re-aimed by content here - four of them had to move file
as well as line, because the law had left the module the record named
(`host-world-ungated` now points at `classicFootstepAllowed`, the one
gate BA1 folded both mods' DisableBuiltInFootsteps into).

And re-aiming them was not bookkeeping. Three of the ten, once they
applied again, **SURVIVED** - which is what a stale record hides:

- the classic footstep gate had no pin but a source regex over the call
  site, so nothing checked that Immersive Footsteps owning the stride
  actually silences a clip, or that it outranks Better Ambience;
- the equip moment's fresh settings read had no pin that could fail;
- and `S13` turned out to be genuinely EQUIVALENT - the store is written
  only under `if (gone)` and a friend's presence row never reads
  `rec.seen` while the account is online - so it is recorded as such,
  with the reasoning, rather than pinned by a claim the code does not
  make.

## MWCROUCH - GetKeyDown and GetKeyUp, which the port had been deriving

Mac, 2026-09-17: *"When crouching with the morrowind model. you can't
uncrouch"*.

### It is not the motor, and it is not the Morrowind rig

The diagnosis went the long way round and the long way round is the
record. `player/motor.js`'s `_heightAction` has no view-mode arm and
`get height()` has no Morrowind branch; the collider holds world
geometry buckets only (`addMesh`'s fifteen call sites are all level
meshes and action objects), so nothing about a drawn body can block
`CanStand`'s upward sphere cast; `combat/fpArm.js` reads the SNEAK key
rather than the crouch by a rule of its own (Rule 32(a): "Morrowind has
one sneak stance, and Daggerfall's crouch is a height change the
collider owns"); and `mwCamera.eye`'s third-person focal is
`feet + FOCAL_HEIGHT` with no stance term at all. A crouch/uncrouch
driven against a real `Collider` in a real room stands the player up
every time.

So the Morrowind model reaches the crouch by exactly one route: **it is
the heaviest thing the port draws, and it makes frames long.**

### The bug is one frame wide

All four hosts built every press edge the same way:

```js
crouch: held(keys, 'Crouch') && !latch.crouch
...
latch.crouch = held(keys, 'Crouch');
```

That is a DERIVATION off the held ring, sampled once a render frame. A
press whose keydown AND keyup both land between two frames is never in
the ring on a frame that looks at it, so the edge does not exist and the
tap is swallowed whole. At 60 Hz a 50 ms tap spans three frames and
always lands; at 10 Hz - a loaded scene with the Morrowind body in it -
it often lands in none. Crouching is then a thing that works when it
works, and standing back up is a thing that does not, which is the
sentence Mac wrote.

**Unity does not work that way**, which is why Daggerfall Unity does not
have this bug at any frame rate. `Input.GetKeyDown(k)` answers true on
the frame FOLLOWING the press event whatever the key does afterwards,
because the events are buffered and drained per frame; DFU reads exactly
that through `InputManager` (:1084-1108, one poll a frame in
`FindKeyboardActions`). The port had `GetKey` - `held()` - and no
`GetKeyDown` at all, so every consumer wrote its own out of the only
read there was.

`motor.js:1020` had already named this bug's twin from the other side:
"a render frame that accumulates less than one physics step swallowed
the press" - the fix there moved `_heightAction` out of the fixed-step
loop. The half that remained was the host's.

### The seam

`ui/input.js` gains the missing buffer, not a new rule:

- `keyEdges()` - a host's ring: two live accumulators and two frame
  halves.
- `noteKeyDown(edges, code, repeat)` / `noteKeyUp(edges, code)` - the
  listeners' half, beside the `keys.add` / `keys.delete` they already
  do. `repeat` is the DOM's: auto-repeat is one physical press to Unity
  and fires `GetKeyDown` once.
- `beginInputFrame(edges)` - the frame's ONE rotation, at the head of
  the frame, ABOVE the video hold. Rotating once a frame is what gives
  an edge exactly one frame of life - the single frame Unity gives it -
  so a reader behind a shut overlay still DROPS its edge rather than
  banking it, which is the paused-InputManager law (:487-503) the old
  latches were standing in for.
- `pressed` / `released` - `GetKeyDown` and `GetKeyUp` over the same
  dual-dict fallthrough and the same combo arm `held` takes.
- `pressedCode` - the raw code, for the port's one recorded departure
  that is not a binding at all (E activates beside Mouse0).

`codeDown` took a `ring` parameter to do it, and the comment that
parameter needed was **already in the file**: "the modifier arm reads
HELD whatever edge the caller asked for; only the combo'd key takes
`method`". `ring` IS that `method`. The modifier arm and the plain-key
suppression both keep reading the held Set, because that is what :1695
and :1683 read whatever edge is being asked for.

### Four laws, four hosts, one shape

The same derivation carried four things, and all four are now the edge
they always claimed to be:

| law | was | is |
| --- | --- | --- |
| crouch toggle | `crouchHeld && !latch.crouch` | `pressed(edge, keys, 'Crouch')` |
| ReadyWeapon (Z) | `zNow && !zPrev` | `pressed(edge, keys, 'ReadyWeapon')` |
| SwitchHand (H) | `!hNow && hPrev` | `released(edge, keys, 'SwitchHand')` |
| E activate | `useHeld && !latch.use` | `pressedCode(edge, 'KeyE')` |

The crouch KEY is still read HELD beside it, because the levitate
descent is a held key (AUDIT 26 F031, `LevitateMotor` :88-89) and always
was; only the STANCE toggle is an edge.

`world.js` and `exterior.js` own a frame each and a ring each, on the
`latch` bag whose two fields this retired - and `worldModes.js` READS
that ring off the same shared bag and never rotates it, because the mode
machine does not own a frame. `dungeon.js` is standalone and owns its
own. The MOUSE codes ride the ring too: AUDIT 39r put them in `keys` for
`GetKey`, and an edge read has the same claim on them.

### Pinned

`test/mwcrouch_edges.test.js` (10) - the sub-frame tap both ways, the
one-frame life of an edge, auto-repeat as one press, the combo arm's
split (modifier HELD, key on the ring), a rebind moving the edge, the
raw-code door, a driven motor crouching AND standing at 10 fps, and the
source sweep: no host may derive a press off the held ring again, every
frame-owning host rotates exactly once and feeds both listeners, and the
mode machine must not own a ring. `tools/mutants/mwcrouch.json` (14,
all dead).

And DRIVEN IN CHROMIUM: `tools/mwcrouchProbe.mjs` runs BOTH readers off
the same real key events, in a page whose frame callback busy-waits to
~9 fps, each driving its own real `PlayerMotor` against a real
`Collider` room. Three taps - an odd count, so the two end in different
STANCES rather than differing by a counter - and the old derivation sees
**none** of them while the ring sees all three: `{latch: false, edge:
true}`, which is Mac's sentence in two booleans. At 60 fps the two agree
exactly, which is the other half of the claim: the fix changes nothing
where the old reader worked.

The probe found its own harness lying first. Playwright's
`keyboard.press` AWAITS the keydown, so against a page that busy-waits
it only sends the keyup once the loop has come back for air and already
sampled the key - and the old derivation caught all four taps. That is
not a player's input timing; it is the harness synchronising itself to
the thing under test. The events go through a raw CDP session back to
back now, unawaited, which is what a 50 ms tap inside a 110 ms frame
actually looks like.

## QS7 - one mode, one dispatch

Mac, 2026-09-17: *"if you go into a tavern with a lit torch, pressing 4
does not actually make it go out, it just goes thru the 'douse' and
'ignite' motions"*.

### Two ladders answered one key

The world and exterior hosts each run a keydown ladder, and each MOUNTS
`worldModes` over itself - which runs a keydown ladder of its own
(U43's one dispatch: `routeKey` over `interiorKeyCtx` indoors, over
`dungeonCtx` underground). Both listen on the same window and neither
stops the other's propagation, so a key BOTH can answer is answered
twice.

QS2 put the quickslot arm ABOVE the outer hosts' mode gate on purpose.
At the time the modal contexts carried no quickslot doors at all, and a
quickslot that died at a shop door was exactly the bug AUDIT SOC B4/D1
had just found for F. **QS4 then gave `interiorKeyCtx` and `dungeonCtx`
the whole set - and nothing went back to the arm that had been standing
in for them.** From that commit a Digit4 in a tavern pressed the mod's
`toggleLightPress` twice.

Twice is not nothing and it is not two, because the mod's toggle is a
FLIP: the first press douses the torch, the second re-ignites it, both
clips play, both lines are said, and the player is left holding a lit
torch they just asked to put out. That is WEAPON-VIS2's double-fire
("drawn, then sheathed straight back, net nothing, every time") at a
third door - and it is the third time a COUNT rather than a state is
what makes this class of bug visible.

### The fix, and its bounds

The outer arm takes the exterior-mode gate its siblings take. The
quickslots stay live indoors and underground, through the modal ladder
that already routes them. The `SocialInteract` arm beside it stays
UNGATED, because AUDIT SOC B4/D1's whole finding is that the modal
contexts carry no `socialInteract` - there is no second answer for F to
collide with, and gating it would re-break what that audit fixed.

Only two actions were ever reaching this door: `QuickOffHand` and
`QuickSwap`. The other three are `POLLED_ACTIONS` since QS6 and belong
to the frame's hold machine, which the modal frame owns alone.

### Pinned

`test/qs7_one_dispatch.test.js` (3) - the mechanism DRIVEN through the
real mod (one press puts the torch out with one douse clip; two presses
leave it lit with a douse AND an ignite, which is the sentence Mac
wrote), the gate on both outer hosts with the social arm explicitly
left ungated, and the modal ladders' own doors proved present so the
fix cannot silently delete the key indoors. Four of
`tools/mutants/qs7.json`'s ten.

## TALK-UNKNOWN - a debug sentinel in a tavern

Mac, the same day, with a screenshot: *"Listen up. Know anything about
work possibilities %2com[undefined]?"*

### It is classic's macro, and Daggerfall Unity never implemented it

`MacroHelper.cs`'s dictionary carries `%1com` (:44,
`GreetingOrFollowUpText`) and has **no row for `%2com`** - 217 rows,
diffed cell for cell against the C# by `test/macrocoverage.test.js`,
with `%2com` in neither the handled set nor the null one. So `GetValue`
takes its outermost else (:526-527) and answers `symbolStr +
"[undefined]"`, and TEXT.RSC 7212 - the Work question, which reads
`%1com ... %key %2com?` - puts that in the player's own mouth. DFU,
handed the same TEXT.RSC, does the same thing. **This is not a place
the port drifted**, and the walk is not what gets fixed.

### What gets fixed is the step after it

E7 moved this walk off the empty string and onto the sentinel
deliberately, and was right to: with a 26-row table the empty string
deleted ~190 macros DFU renders for real and made all four of C#'s
error shapes unreachable. But E7's argument - *"the table is all 217
rows now, so the shape is safe to speak"* - holds only for macros DFU
has heard of. The coverage gate is precisely what makes `[undefined]`
mean ONE thing and nothing else: **classic wrote a macro Daggerfall
Unity never implemented.** A tavern is not a debugger.

So `expandTalkMacros` stays verbatim, every sentinel included, and one
step is added between the expansion and the player: `speakable` drops an
`[undefined]` from spoken text and collapses the whitespace around it,
so "possibilities %2com?" reads "possibilities?" rather than
"possibilities ?". The other three sentinels SPEAK, because each of them
names a context the port could actually be getting wrong -
`[nullMCP]`, `[unhandled]` and `[srcDataUnknown]` are diagnoses, not
gaps in the table.

The symbol is not lost: `unknownTalkMacros()` collects every one met and
each warns ONCE, so a macro classic uses and DFU does not is a thing a
reader can find rather than a thing a player reads.

**What this does NOT claim:** it does not say what `%2com` should
render. Classic knows; the port cannot recover it from the data it
ships, and inventing a word would be a departure wearing a port's
clothes. If that text is ever recovered the change is one handler.

### Pinned

`test/talkunknown.test.js` (7) - the table fact that makes the sentinel
readable, Mac's sentence both ways, the whitespace law in each of the
four places a macro can sit, the other three sentinels surviving
(including BESIDE an unknown one, which is the case the early-out hides
and where a widened-sentinel mutant lived), the walk left verbatim, both
player-facing doors taking the step, and one warning per symbol. Six of
`tools/mutants/qs7.json`'s ten.

## MAC-A/C/D/E - four of Mac's five, and the fifth's findings

2026-09-17, five reports in one message. Four are fixed below; the
fifth is investigated and NOT fixed, with what was actually found.

### MAC-A - the camera's obstacle guards are sphere casts

*"Going in some interiors with roof pillars interacts negatively with
the 3rd person camera"*.

The reference casts a SPHERE for both of them - `rayCasting->castSphere`
at `camera.cpp:186` (the focal's ceiling guard, radius
`focalObstacleLimit` = 10) and `:200` (the camera's pull-in, radius
`cameraObstacleLimit` = 5). The port cast a RAY for each and then took
the limit off the END of the distance.

A ray and a five-unit sphere disagree in exactly the place Mac found.
**A pillar is thin.** One ray from the head to the camera threads PAST
one that a sphere of radius 5 hits square, so the camera slides through
the pillar, it fills the frame, and it pops out the far side. And when
the ray *does* catch an edge, `hit - limit` changes by the whole width
of the pillar between one frame and the next, so the camera snaps in
and out as you walk by. Both are one mistake: **a line where the
reference has a volume.**

The distance is the swept sphere's own now, with nothing taken off it.
OpenMW re-derives the sphere's centre at contact
(`hitPos + hitNormal * limit`) and measures that back to the focal -
and that centre is precisely what a swept-sphere cast reports as the
distance travelled, which is what `collider.sphereCast` already returns
("how far the sphere's CENTRE travels before the leading cap touches").
Subtracting the limit again would pay for the clearance twice.

`spherecast` is a new seam beside `raycast`; a host that hands only the
ray keeps the old line, so nothing written before this changes.

### MAC-C - the two window keys

*"you can exit out of the F6 menu (inventory) by pressing F6 again, but
you cannot do the same for the F5 one (char sheet)"* and *"it would be
extra cool if you could like, be on the F5 page, press F6 and then go
straight from char sheet to inv."*

Two faults, one root. The pack's key arm read `e.key !== 'F6'` - the
DFU DEFAULT spelled as a literal, which is I2's and FIX-F's bug twice
over - and the sheet had no key arm at all, because PX27 made the
enhanced sheet the pause window's Stats page and `enhancedMenu`'s
capture handler answers exactly one key: Escape, the back stack's. That
is right for the pause face it shares (F5 must not close a paused
game), which is why the arm belongs on the OVERLAY F5 opened.

All three windows that answer these keys read the REGISTRY now - the
enhanced pack, the enhanced sheet page and the classic canvas sheet -
so a rebind moves them.

And the cross-over is the same law read sideways: a window key naming
ANOTHER window closes this one and opens that one, **in that order**,
because `showOverlay` REPLACES the host's single slot. The sheet
already had the door (its own Items button); the pack needed one, so
every host hands it the same `openCharSheet` it already hands
`openSpellbook`. The dungeon's sheet builder came out of
`toggleCharSheet` to make that possible - U52's argument, applied to
the host that still had it inline.

### MAC-D - a quest names what it asks for

*"I was given a quest to find a book, but the book's name was just
Book"*.

`Item.ExpandMacro` (Item.cs:236-260) answers `_symbol_` and `=symbol_`
with `GetLongName(item)`, and `GetLongName` (:304-307) is one line:
`ItemHelper.ResolveItemLongName(item, false)`. The port returned the
raw `name` field instead, under a note that said so and gave its
reason - the port had no long-name maker when it was written.

**It has had one since D7**, which ported `ResolveItemLongName` whole,
and nothing came back here. So the quest machine went on naming a
Daedric Broadsword "Broadsword", a potion "Glass Bottle", a quest
letter "Parchment" - and a book "Book", which is the one a player read
out loud. The book is the loudest because `ResolveItemName` treats
Books as a case of their own (:277-279): a book's name IS its title,
and the template name is only the fallback for an id no BOOK file
backs.

`differentiatePlantIngredients` is FALSE because :306 passes false - a
quest asking for a plant names the plant, not its (northern) variant.

### MAC-E - a body is opened, not emptied

*"seems like when i click on a dead enemy now, i loot all their items
automatically? ... it lets me exceed my carry weight with no penalty"*.

Not a mod. A RESIDUE this port wrote down and left, in
`scenes/corpseMarker.js`'s own header: *"DFU's general arm opens the
inventory window with the corpse as the remote LootTarget (:957). The
port transfers the lot and reports the count - the pre-existing G3
shape, kept so this wave does not smuggle a UI change into a parity
fix."* **A recorded residue is a bug with a note on it**, and this one
had a note for three waves.

The dungeon host has done it correctly since U26 ("the old takeLoot
vacuumed everything in one keypress"). The two EXTERIOR pools -
`exteriorFoes` and `cityGuards`, which is every body in a street, a
road or a wilderness encounter - never got that change. So a click
emptied the body into the pack past every weight the window shows, and
said "You take 2 items.", a line Daggerfall does not have.

`openCorpseLoot` is :926-955 whole now: the empty body's refusal, the
arrows-only pickup, then the WINDOW. A caller with no window does NOT
fall back to a bulk take - it warns and takes nothing, because a silent
fallback is how the vacuum survived its own note for as long as it did.

What stays a bulk take is the ONLINE grant landing, and not from
laziness: a peer's body is its owner's to empty, the owner has already
chosen what leaves it, and the items are in flight by the time this
client sees them. There is nothing for a window to offer.

**THE CARRY WEIGHT IS NOT A SECOND BUG.** Neither `PlayerSpeedChanger.cs`
nor `PlayerEntity.cs` mentions encumbrance at all - DFU draws the
figure on the target icon and never charges for exceeding it. What the
window restores is the CHOICE, which is the half that was missing.

### MAC-B - the tavern light, investigated and NOT changed

*"Tavern lights have this gloomy blue that only pops in when
approaching the room"*.

Nothing in the interior light path is wrong, and the check was not a
glance:

- `AddLight`'s second switch (`DaggerfallInterior.cs:1034-1151`) is
  transcribed cell for cell in `world/interiorLights.js`, re-read
  against the live C# for this report. Every row matches, including the
  one that is BLUE: **record 8, the "Turkis lamp", is
  `Color(0.68, 1.0, 0.94)` in Daggerfall Unity** - turquoise is what
  that lamp is. It sets the colour ONLY, keeping the prefab's range 15
  and intensity 1, and the port does the same.
- the interior ambient is `PlayerAmbientLight`'s verbatim pair, and the
  night variant's purple tint is DFU's own (`0.20, 0.18, 0.20`).
- the light positions go through the interior's transform, and the
  ranges are in the same metres DFU's are (the port's capsule is 1.8,
  as DFU's controller is).
- `withPlayerLights` keeps the data and colour arrays paired under one
  cap, so no light wears another's colour.

What the port DOES have that DFU does not is a **fixed light-slot cap**
with a nearest-N selection: when the 17th light displaces the 16th the
swap is instant, where Unity's forward renderer fades. That is the best
candidate for "pops in", and it is a hardware-shaped departure rather
than a defect with a line to point at.

So this one is not fixed, and is not being guessed at. Changing DFU's
own light table on a hunch is the same move `%2com` was refused for.
What would settle it: which tavern, and whether the lamp in frame is
the turquoise one.

### Pinned

`test/maca_camera_sphere.test.js` (6), `test/macc_window_keys.test.js`
(5), `test/macd_quest_item_name.test.js` (5),
`test/mace_corpse_window.test.js` (7), plus the grown pins in
`audit24_wave38`, `cityguards` and `nativeinventory`.
`tools/mutants/macbugs.json` (15, all dead).

## MAC-F/MAC-G - a card that folds, and a page that was never drawn

2026-09-17, two reports over two reading screens, with a screenshot of
the Chronicle's Quests tab and an arrow at **MAIN QUEST BACKBONE**.

### MAC-F - the chronicle's quests fold to their heads

*"In the enhanced chronicle. Quests and their tab's should be able to
be minimized."*

The screenshot is the whole argument: twelve quests in the rail, and
the first one's trail filling the column so the other eleven are below
the fold. This is a cost the enhanced window took on deliberately and
never paid. The classic logbook cannot have this problem - it draws
into a 320x200 panel and pages four lines at a time with a Next button
(PX24's own header says so) - and the enhanced one traded that for a
scrolling column, which is better until a quest with a long trail is
the only thing on screen.

Nothing about the MODEL changed. `chronicleModel` still returns the
same rows from the same walks, and `questRail` is still the one quest
walk shared with the pause window's Quests tab. What is new is a place
to put a reading position:

- **the head is the handle.** The caret and the date are ONE button
  (`cr-fold`), so a card folds by clicking the thing already being
  read. The note's remove stays a SIBLING of that button: a button
  inside a button is not HTML, and nesting it would have made every
  removal a fold as well.
- **the body is what folds.** The head, its date and its remove all
  stay - a folded card still says which quest it is and when it was
  written, which is the only reason to fold it.
- **the tab folds at once.** `Collapse all` / `Expand all` sits above
  the cards and READS them (`allFolded`) rather than keeping a flag, so
  shutting the last card by hand flips the control with it. Folding
  twelve quests one at a time to see twelve titles is the same wall
  with extra clicks in it.
- **a fold is a reading position, not a setting.** The store is a
  `Set` of `section:index`, it survives a tab change so walking to
  Notes and back does not undo the work, and it is cleared when the
  window opens. Nothing about it reaches disk: a player who shut every
  quest last night opens the book read this morning.

A shut card drops the rule under its title with the body it was
dividing from - a card that keeps the divider looks like a card whose
body failed to draw.

### MAC-G - the advantages a character was built out of

*"The enhanced stat page on the pause menu doesn't have any listing
for character advantages/disadvantages."*

He is right, and the gap is older and wider than the enhanced page.
DFU HAS this list: `GetClassSpecials`
(`DaggerfallCharacterSheetWindow.cs:459-762`), popped in a message box
by the classic sheet's **History** button before the history window
itself (`:898-903`, `:905-918`). The port had `parseCareerData` - the
WRITE, U20b's whole point, folding a chargen pick list onto a career's
bitfields - and **no read anywhere, in either skin**. So the seven-item
balance a player spends the whole of chargen on became invisible the
moment the game started, and stayed invisible for every hour after.

`classSpecials(career, race)` is that read, and it lives beside the
write on purpose: the two walk the same bitfields, so a bit that moves
breaks both in one file instead of drifting apart across two. It is
NOT the pick list read back - the pick list exists only inside the
chargen window, and a character loaded from a classic save never had
one. The flags are the source, exactly as they are for DFU.

Every section is GetClassSpecials' own, in its order and with its
pairing: the seven tolerances, the six proficiencies, the four attack
modifiers, the two magery arms, the three forbidden sets, the spell
point multiplier, absorption, the four talents, regeneration and rapid
healing, the two damages, and then the blood - the race template's
resistances, immunities, low tolerances, critical weaknesses and
abilities, de-duplicated against what the class already said, because a
Breton mage can carry Resistance To Magic twice.

Three departures, each deliberate:

- **the split.** DFU prints one undifferentiated list; Mac asked for
  advantages and disadvantages, and this page has room for the division
  the player actually made. It is not invented - it is which of the two
  chargen lists (`ADVANTAGE_KEYS` / `DISADVANTAGE_KEYS`) the primary
  belongs to, the same division the difficulty table signs.
- **the source tag.** Resistance To Magic from the class and from the
  blood are different facts about a re-rollable character, so each row
  says which it is, quietly, at the value's right.
- **DFU's own slip is not ported.** Its `raceAbilities` dictionary maps
  `Athleticism` to `HardStrings.acuteHearing` (`:744`) - a copy-paste
  fault that would print the wrong ability's name. It is unreachable in
  DFU and here, because no playable race sets `SpecialAbilities` at all
  (`RaceTemplate.cs:172-345`, and `systems/races.js` says so), and the
  port writes what the flag means. Copying it would be porting a typo
  into a screen a player reads.

What is deliberately NOT here: a vampire's or a werewolf's powers. DFU
gives a transformed character an OVERRIDE race template whose flags
feed this same block; the port has no override templates, and the
curses carry their powers as live effects instead. Writing them in from
here would mean inventing a table. Recorded rather than hidden.

The classic sheet's History button still opens the history directly,
without DFU's specials box in front of it. That is a second, older
parity gap on a different window, and it is not what was asked for.

### Pinned

`test/macfg_fold_and_specials.test.js` (11).
`tools/mutants/macfg.json` (20: 18 dead, 2 recorded equivalent - the
tolerance read's order and the magery guard, both unreachable through
any career the game can build).

Neither report is a law, so the pins are source and model and the CLAIM
that the two windows work is `tools/macfgProbe.mjs`'s: it mounts both
over the live `/play/` page with no ARENA2 anywhere, folds the cards,
walks the tabs and reads the Advantages rows back - 20/20.

## MAC-H/I/J/P - what you hold, and what it is lit by

2026-09-17, three notes and then a fourth while the first three were being
fixed.

### MAC-H - the hand held nothing and drew a torch anyway

*"On the classic sprite, when a torch is unequipped, a random sprite is
shown on the left middle of the screen."*

The torch hand's `OnGUI` had two gates: the module's Sprite switch, and
"is there a texture". `w.currentTexture` is set ONCE - to `list[0]`,
torch frame 0 - the moment `InitializeTextures` finishes, and nothing
ever clears it. So from the first frame after the sprites loaded, every
host drew a torch at `SetGuard`'s rest position with or without a torch
in the player's hand. SetGuard puts it in from the side by half the
screen times Offset.x and up from the bottom by a quarter: the left
middle of the screen, exactly where Mac saw it.

The frame law already knew the answer - `offsetFrame` is -1 for no light
and for a CANDLE, which has no frames - but it is computed in Update and
this is a draw, so the draw asks the LIGHT rather than trusting an
ordering. That is also what makes the sprite go the same frame the torch
leaves the hand, with no frame in between: a window that is open has
stopped the frames a latch would be updated on, which is the trap HT6
already paid for once.

### MAC-I - FPSWeapon.Tint, written

*"The classic sprite should react to lighting (first person)."*

DFU has the channel and leaves it white. `FPSWeapon.Tint`
(`FPSWeapon.cs:108`) is handed to the draw (`:182`) and nothing in DFU
core ever writes it - it is the First-Person Lighting mod's. The port
writes it, from the light the room's own FLATS take.

`renderer.flatLightAt(pos)` is the billboard program's composition, not
a second lighting model: the tint (ambient plus the moon's Lambert-
average half), the sun's half, every point light with the same squared-
linear falloff to its range, and the indirect term - the four terms of
the flat shader's `lit`, with no normal, because a flat has none and a
screen sprite has less than none. It reaches all four first-person
sprites: the weapon, the widget's clone, the casting hands and the torch
hand.

Two things are deliberately NOT in it. THE CLOUD SHADOW is a shader
function over a shadow map and sampling it here would mean a read-back,
so a cloud darkens the land and not the hand. THE LANE'S DECODE is
skipped because a screen quad is drawn by the 2D pass AFTER the enhanced
lane's composite has resolved the frame to display space - the same
classic-space read the water already takes.

A FLOOR of 0.25 is the port's own number and is written down as such: a
flat in a black room goes black and the player reads that as the room,
but a HAND that goes black is a hole in the middle of the screen, and
you cannot tell a drawn weapon from a sheathed one.

### MAC-P - and the Morrowind arms, which were worse

*"morrowind's first person view also doesn't receive lighting and is
consistently dark."*

Right, and for a different reason: the arm is rendered LENS-LOCAL, at
the origin of a camera-local space, while `_pointLights` are in WORLD
space. Every torch, lantern and lamp in the room misses it by exactly
the player's distance from the world origin, so the arm has only ever
had the ambient and the sun's N.L. Measured in the probe: five of 255
in a dark room, holding a lit torch.

The answer is the STUDIO's shape - a key light at the eye, which is what
makes a viewmodel's form read - SCALED by the same `flatLightAt` answer
the classic sprites take. At full daylight the tint is [1,1,1] and the
pass installs exactly the studio it used to, byte for byte; it only ever
takes light away, where the room has none to give. Borrow-and-return in
a `finally`, because a leaked studio is permanent.

One switch for both lanes: Features -> First-person lighting, on by
default, `?fplight=off` the kill door.

### MAC-J - a name wearing the enhanced skin's button

*"The online section where player's names are shown are too large and
shouldn't be large rectangles"* - the chat window's roster column.

A CSS collision, and it could not be seen in either file alone. The
roster marked a clickable name with a bare `act`; `.act` is the enhanced
skin's BUTTON (`padding: 12px 20px`, a 1px iron border, `min-height:
46px`), and that sheet is in the document of every online game because
online forces the enhanced lane. So every name a player could click was
drawn as a button - 46 to 58 pixels tall, measured - and the one name
that is never a door, your own, sat 16px high beside them, which is what
made it read as "too large" rather than as a style.

The marker is `dfchat-act` now. Every other class in that sheet was
already prefixed; this one was the exception. The pin is the general
law, not the instance: no class the chat panel writes may be a bare
selector in the enhanced sheet.

### MAC-Q - the torch's fire, investigated and NOT fixed

*"and the torch doesn't emit fire."*

Not a torch bug and not a light bug - MW-TORCH placed the mesh and MW-D51
lights it. THIS PORT HAS NEVER DRAWN A MORROWIND PARTICLE SYSTEM, and a
Morrowind torch's flame is one. `mwNifFile.js` parses
`NiAutoNormalParticles`, its data and `NiParticleSystemController`'s
emitter terms in full; `mwNifMesh.js` then walks `NiBSParticleNode` as a
NODE and emits nothing from it, because `GEOMETRY_TYPES` is
`NiTriShape` and `NiTriStrips`. The flame is read off the disk, carried
through the graph and dropped.

What it would take is osgParticle's own shape: the emitter off the
controller (rate, lifetime, speed, the emitter node's frame), the
modifier chain (grow/fade, colour, gravity, collider), a billboarded
quad per particle and a sorted additive pass. It is a slice, not a fix,
and it cannot be verified in this container at all - there is no
Morrowind data here. Shipping an unverified flame is what MAC-B was
refused for, so it is written down instead, with the pin that holds the
premise (`test/machij_sprites_and_chat.test.js`).

Worth saying, because it narrows the next attempt: the EMISSION channel
is not the gap. A flame authored as a TRIANGLE with LightMode_Emissive
has drawn correctly since MWT2.

### Pinned

`test/machij_sprites_and_chat.test.js` (14).
`tools/mutants/machijp.json` (20: 18 dead, 2 recorded equivalent).

Two probes, because none of this is a law a node test can settle:
`tools/macfpLightProbe.mjs` builds a REAL Renderer, lights it as a host
does, draws a white texel under the tint and reads the pixel back (a
quarter tint is 64/255), then renders a quad through the ARM's own call
at two light levels - 13/13. `tools/macjRosterProbe.mjs` mounts the chat
panel with BOTH sheets in the document and measures the rows - 6/6.

## MAC-Q - the torch's fire, taken care of

2026-09-17. The MAC-H/I/J/P record above closed this as investigated and
not fixed: *"this port has never drawn a Morrowind particle system, and a
Morrowind torch's flame is one ... it cannot be verified in this container
at all - there is no Morrowind data here."* Mac read that and answered:
*"Please take care of the morrowind torch flame."* His call, and this is
the slice it asked for.

### What was ported, and from where

The particle system is OpenMW's, law by law, out of the files that run it
there: `components/nifosg/particle.cpp` (the shooter, the emitter, the
grow/fade, colour and gravity affectors, both colliders),
`nifloader.cpp`'s `handleParticleSystem` with `handleParticleInitialState`,
`handleParticleEmitter` and `handleParticlePrograms`, the
`ParticleSystemController` and `ControllerFunction` in
`nifosg/controller.cpp`, and under them osgParticle's own
`Particle::update` and the quad `ParticleSystem::drawImplementation`
draws. Every constant is the reference's - the counter's carried
remainder, the speed range at half the variation, the emit rate as slots
over the mean life, GravityAffector's `magic = 1.6f`, the
`orthoNormalize` on the emitter's frame, the strict `x > 1` death test.

### Where it lives

- `formats/mwNifMesh.js` walks the three particle geometries as it always
  walked them and, when a caller brings a sink, hands each one over WHOLE
  - the composed transform, the property chain and the enclosing
  NiBSParticleNode's flags (AutoPlay, LocalSpace), which is what
  `args.mAnimFlags` is in the reference. No sink is the port before this
  change. NiAlphaProperty's blend FUNCTION and NiZBufferProperty's two bits
  reach the material now; nothing had asked for them before a drawable
  that blends.
- `formats/mwParticles.js` is the descriptor and the running system.
  `particleSystemsOf(nif)` answers what a file carries; `createParticleSystem`
  emits, operates and ages in the reference's own update order and answers
  `quads()` - centre, half-extent, colour, alpha - exactly as osgParticle
  would draw them. Pure: no GL, a `rolls` the pins can drive.
- `formats/mwCharacter.js` `bindPart` carries a part's systems out beside
  its batches; `mwFirstPerson.js` `bindPartsInto` puts them on
  `assembly.effects` with the SAME placement the part's rigid shapes take -
  the bone, the mirror, rule 14's offset, the part's attitude - because
  they were authored in the same file at the same origin.
- `combat/fpArm.js` `stepRigEffects` runs them each frame on the part's
  clock (the torch overlay's when it plays, the pose's otherwise; no clock
  is a frozen system, as the reference freezes a controller nobody
  drives), places them through `effectPlacement` - `placeAtBone`'s own
  arithmetic composed rather than applied - packs and uploads them, hides
  the torch's with the torch (MW-D51's carried-left rule) and releases
  them with the mesh. Both rigs: the arm and the body.
- `render/renderer.js` grew one small program. The quad is built in the
  shader off the model-view rotation's rows, so one stream serves the
  first-person pass and the third-person body; the effect draws after the
  body's ranges in the same pass, with the file's own blend function and
  depth flags, never writing depth, never cast as a shadow.

### The two reference frames

`ParticleFlag_LocalSpace` decides them, as it does in the reference
(nifloader.cpp:1476-1483). Under it the particles live in their node's
space and are placed at pack time - the flame rides the hand. Without it
they are kept in the RIG's space, the nearest thing a lens-local arm has to
a world, so a swing leaves them behind for their lifetime: Morrowind's own
trailing fire. That "world" is a recorded departure - it does not include
the player's walk through the real one.

### Not carried, recorded

NiBSPArrayController's emission over a target's vertices or nodes (a
torch emits from one node; the flag is read and the system refused with a
note), NiParticleBomb (in no torch), NiParticleRotation (unused in the
reference too), and the soft-particle effect (a shader feature of the
reference's own).

### The picture's orientation, and why it is written down

osgParticle gives the quad's bottom-left corner the texture's (0,0), and
OSG stores images bottom row first. This port uploads a decoded DDS top
row first, exactly as the NIF's own UVs expect - every textured piece
proves it - so here the TOP corners take v 0. One constant
(`PARTICLE_CORNERS`), so it is one place to look if a flame ever stands on
its head.

### What could be verified here, and what could not

No Morrowind file could be opened in this container, so the torch's own
flame was not seen. What was: every law against the reference's numbers
(`test/macq_flame.test.js`, 20), the whole chain from a hand-built file to
pixels in a real GL context (`tools/macqFlameProbe.mjs` - the flame reads
`[255,140,26]` where it stands, black beside it, black when hidden), and
the seams (`bindPart`, `bindPartsInto`, `stepRigEffects`, the arm's two
frame sites, the renderer's draw). The first look at the real thing is
Mac's.

### Pinned

`test/macq_flame.test.js` (20). `tools/mutants/macq.json` (28: 27 dead,
1 recorded equivalent). `tools/macqFlameProbe.mjs` 7/7.

## MAC-R2/R3/R4 - the doubled line, the hand cells, the hold under a repaint (2026-09-17)

Three of the four bugs on Mac's list (the fourth, the raised blade, is
02-Formats/Morrowind-Rules.md MAC-R1).

**R2 - "The enhanced quickbar sometimes shows double messages."** The
diamond's finger was measured first and acquitted:
`tools/macrHudTapProbe.mjs` draws the HUD over the real module on a
phone context and presses every cell with real touch points through
CDP - one tap is ONE performer call on c1, c2, the off cell and the
main cell, a wandering tap is one, two quick taps are two, a hold is
none, a mouse click is none (19/19). The double is the KEY's: a held key
auto-repeats its `keydown`, and the two quickslot actions that are not
polled - the swap and the off hand - were routed on every repeat by the
two self-routing hosts' arms (world.js, exterior.js) and by `routeKey`
for the modal hosts. A key held a beat too long readied the swap and put
it away again, or lit the torch and doused it: two lines and a net
nothing, "sometimes" because it takes the beat. The polled three were
already edge-only (`noteKeyDown` drops the repeat flag, MWCROUCH), and
DFU's ActionStarted is the press edge alone (InputManager.cs:634-637).
Now `routeKey` swallows a quickslot action's repeat before the table,
and the two arms route the press edge and eat the repeat.

**R3 - "Tapping the equip hand in the quickbar doesn't switch to your
other weapon in hand (still bound to H). Even if a torch isn't equipped a
message still shows up that you can't light the torch."** QS4 gave the
off cell ONE act, the light's toggle, and the main cell none - so a cell
showing the bow on the left said "You have no light source.", and the
weapon in hand answered nothing. A hand cell's own act is DFU's
SwitchHand (WeaponManager.cs:271-273, the H key): the other weapon in
hand. `offHandQuickslot` now presses what the cell SHOWS, in full, over
`quickslotView`'s kinds: a lit light douses; an empty hand with a light
carried ignites it (the mod's own equip-and-light); the shield, the
off-hand weapon and an empty hand with no light SWITCH HANDS through the
rig's `switchHand` (the rig's own refusal over a shield stays silent, as
DFU's ToggleHand); the swap is the caller's arm as before; and the
light's refusal is said only where there is no hand to switch (a host
with no rig door). The four hosts hand `switchHand` beside `toggleLight`
- the world's and the fixed city's `weaponRig`, the interior's
`interiorWeapon`, the dungeon's own rig - and a `quickSwitchHand`
performer through `drawHud` to the diamond, whose MAIN cell now taps it:
one listener, no hold (what is in the hand is not a list). QS3's
"the main cell takes no action" pin is re-aimed to "one action, the hand".

**R4 - "Hold to drag in the enhanced inventory sometimes doesn't work
properly."** INV3 measured the finger's drift; this is the pane's own
repaint. A touch pointer IMPLICITLY CAPTURES the row it lands on, and a
captured row that `render()` detaches raises `lostpointercapture` -
which AUDIT INV2 listened for and read as "the pointer taken back", one
door out of the session. The pane repaints on things a hold cannot see
coming (INV2's own list: an archive icon landing, the doll settling, the
arm rig rebuilding), so a press that overlapped one died with no ghost
and no refusal. The session's listeners are the window's and need no
capture at all, so it is given back the moment it is granted -
synchronously in the press handler and again on `gotpointercapture` -
and the abort that read its loss is retired; a pointer really taken
back still arrives as `pointercancel`. Two more doors a real phone has
that the probe's did not: Android's long-press `contextmenu` is refused
for the session's life on any document (the hosts' guard covers a
host's), and iOS's long-press callout is off the tiles and the panels
(`-webkit-touch-callout: none`).

Said plainly: `tools/macrHoldRepaintProbe.mjs` drives a hold with two
repaints inside it under real CDP touch and it arms, carries and
releases 8/8 - and so did the OLD code, because this headless Chromium
dispatched no implicit capture for CDP touch (no `gotpointercapture` in
the event log either way). The repaint premise stands on the Pointer
Events spec's implicit-capture release on removal and on Android
Chrome, where it is implemented, not on a measurement made here. The
fix costs nothing where the premise is false and the two phone doors
are real either way.

`test/macr_fixes.test.js` - 5 pins across the four. `tools/mutants/macr.json`
- 18 dead. AUDIT INV2's lost-capture pin, QS3's listener count and
main-cell pins, drawHud's signature pins re-aimed.

## FOEBAR1 - the target bar's blade face (2026-09-17, Mac, from a friend's pictures)

Mac: "My friend wants me to implement these as alternate versions of the
enemy health bar we have implemented" - two 1000x1000 pictures, a red
twin-bladed shape and the same shape dark with a skull at the hub, and a
mock of it across the top of a screen.

**What it is.** An alternate FACE for the enhanced HUD's target readout
(the bar under the compass that appears when you strike something and
fades). The dark picture is the empty bar, the red one the fill, and the
fill is clipped from BOTH tips toward the hub as the foe's health falls -
`bladeInset(pct) = (100 - pct) / 2` off each side, so full is the red
shape whole and empty is the dark one with its skull. The two pictures
are one crop of both originals (their union alpha box, 981x130, cut with
pngjs since the container has no image tool), so they register pixel for
pixel; the CSS keeps that aspect and hides the plain track under the
blade. They live in `src/ui/assets/` and ride the module by
`new URL(..., import.meta.url)`, the workers' pattern - a first cut put
them under `public/`, which is served at the root alone: from `/play/`,
where the game runs, a page-relative `./hud/` came back as the SPA page
and a root-absolute `/hud/` is not under the build's `./` base. `prefs.foeBarStyle` ('bar' | 'blade', default 'bar') is the port's
own pref like `hudScale` - DFU draws no enemy health at all, so the
readout is original and the face is an original on it - and the
Interface card offers the two as a two-way row in the stick-position
row's shape. It sits where the target bar sits, under the compass,
rather than across the top as the mock had it: that is where the
readout's name and fade already live.

**Seen.** `tools/foebar1Probe.mjs` draws the HUD over the real module,
strikes a foe at full, half and a tenth, screenshots both faces and reads
the laws off the DOM: the blade shows only under the pref and the track
hides, the clip is `inset(0 X% 0 X%)` with X = (100 - pct) / 2 (Chromium
normalises it to `inset(0px X%)`), both pictures resolve as PNG from the
module's own URL with the probe page written into `play/`, the game's own
directory (U60: no probe drives the root as the game), and the shape keeps
the crop's aspect. Mac has
the three blade shots and the bar for comparison.

**FOEBAR1b (same day).** Mac, with a crop of the friend's screen: "Make
sure you give the drained health background slight transparency like
the image" - in it the sky and trees show through the dark blade. So
`.hud-bladeempty` draws at opacity 0.72 and the red fill stays solid
(the sheet gives `.hud-bladefull` no opacity). The probe reads both off
the computed style.

`test/foebar1_blade.test.js` - 2 pins. `tools/mutants/foebar1.json`.
