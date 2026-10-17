# FIELD BUGS 2026-10-02c - the sea's words laid, the travel dials live, the fatigue strip faint, the loading screen's keys, the swimmer's eye, the flats' mip level

The Discord's bug reports of 2026-10-02, handed over as screenshots: *"1. The sea screen shows an overabundence of ship
text on the high seas"* (a harbour's tags, ItMustBeMonday's photo), *"No difference in cautious/reckless travel with
travel options mod turned on"* (Dimmi), *"Keypress while loading/logging in"* (Misericord), *"Fatigue Bar"* (Swololo),
*"Sinking in water causes clipping underground"* (lumin) and *"Black boxes around sprites in newer builds"* (Martyn
Woodward). Every fix below is pinned by tests that fail on the record's own code (42e50765), the new pins
mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "an overabundence of ship text on the high seas" | every ship's tag stood on its own spar with nothing between them, and every one within TAG_DETAIL_M read its second line - off a harbour five names through five "Wayrest Navy Cutter - patrolling off Joyous Light of Akatosh" | SHIP-CLUTTER |
| 2 | "both cautious and reckless travel initiate time accelerated travel ... requires a relog" | Travel Options' settings were read once at the world's load, so the tile's Cautiously dial answered its boot value all session; Inns, the rule's other half (TO-FIELD2 turned it on), was on no screen | TO-LIVE |
| 3 | "turn the volume up via Fn + F11 keys ... had to reload the game" | the world's key ladder stood before the boot's awaits and read `socialMenuCanOpen` - declared past them - on every key: a ReferenceError into the crash banner | KEY-BOOT |
| 4 | "the pending change on the fatigue bar is white ... you can die from it" | the strip where a vital WAS wore the bar's palest tone under a cream line at 0.55 - on fatigue's mint, a white bar still full - and every fresh loss restarted its hold, so a bar losing a little every few frames never drained it | GHOST-DIM, GHOST-CAP |
| 5 | "I sunk into some water in the overworld and could see sky and mountains underground" | a sunk swimmer's eye stood 0.20 over his feet where DFU's stands 0.50; the swim bounce took it to 0.03 - under the drawn ground and inside the 0.2 near plane, the one-sided terrain gone over the sky - and at the sea's height under Deep Waters' 0.25 underwater band | SWIM-EYE |
| 6 | "Black boxes around sprites in newer builds ... on a Mac M3 ... not resolved when changing texture filter options" | ELITE FOES put the flats' albedo sample under a ?:, and the emission map was read past the cut's discard: a mip level picked off derivatives inside non-uniform control flow is undefined, and along every flat's edge a GPU that keeps no uv in the idle lanes read a tiny dark mip that passed the cut | SPRITE-GRAD (the likeliest cause; not reproduced - no Apple GPU here) |

## SHIP-CLUTTER (1)

`ui/naval/navalHud.js` `layoutNavalTags`, `navalTagBox`; `scenes/world.js` `navalTags`. The tags are laid before they are worn:
one second line - the card's ship's, else the tag nearest the crosshair (the world strip's middle, `focus`) within
TAG_FOCUS_PX, else none; and no tag over another - the line's ship first, then the hostile, then the nearest, a tag
whose box would come within TAG_CLEAR of one laid is not drawn that frame, and one left out needs TAG_HOLD more room to
come back (a bobbing view never flickers it). A box is read off its words with the 11px face's advances, measured on
the game's own page in Chromium (an uppercase name 7.5 px a letter at its 0.08em, a line 7.3 at 0.06em) and rounded up
- never off the page in a frame; 120 random harbours at HUD scales 1, 1.5 and 2, drawn there, put no drawn tag's real
box over another's. `03-World/Naval-Combat.md` SHIP-CLUTTER. `test/ui/naval/shipclutter.test.js`; the
three suites that drew several tags at one point (`shipstance`, `shipfade`, `navaudit_presentation`) now draw them apart.

## TO-LIVE (2)

`systems/travel/travelOptions.js` `readTravelOptionsSettings(read, boot)`, `TRAVEL_OPTIONS_RESTART_KEYS`; `scenes/world.js`
`refreshTravelOptionsSettings`; `ui/travel/travelControlUI.js` `setAccelerationLimit`; `systems/features.js`. DFU re-runs
the mod's LoadSettings on every change of its settings - only the readme's starred keys wait for a restart - and the
port read the whole bag once, at the world's load. Now on a change of any mod setting (`modSettingsGeneration`) the
bag is read afresh with the starred half (the roads integration and its arms, the junction map and its placement,
paid teleportation) carried from the load's, and handed to the mod - at the maps' open (the fare deps' handle) and in
the journey's frame - and the panel's Acceleration Limit follows its dial. Inns (`StopAtInnsTravel.PlayerControlledInnsTravel`)
is on the tile beside Cautiously: TO-FIELD2 turned it on and FT14 took the pane it could be turned off in, so a trip
stopping at inns, Recklessly's too, was always a journey. The rule itself (ui/travel/travelPopUp.js isPlayerControlledTravel,
TravelOptionsMod's IsPlayerControlledTravel) is unchanged: Recklessly camping out is the mod's journey whatever the
dials say (its readme, :11). The mod's own switch stays the load's (AUDIT PRE-MERGE 0928 U7), and the tile's effect
line is the switch's (FT9), unchanged. `test/systems/to_live.test.js`.

## KEY-BOOT (3)

`scenes/world.js`. `bootWorld` registers its key ladder, then awaits the quest pack and the first pixel's people for
seconds behind the loading screen; the ladder's arms read `socialMenuCanOpen` (and, for F, `socialInteract`, which
reads `social`) - bindings made past those awaits - so ANY key in that window (the volume, F11, a pad's button, a touch
button's synthetic key) threw "ReferenceError: Cannot access '..' before initialization" from the listener into the
crash banner (`main.js crashOverlay`: no dismiss), which stood over the session that otherwise ran on. The ladder's
arms now wait on `_worldKeysLive`, set as the boot's last line hands the first frame its turn; before the latch a key
fills the held ring and the browser's own keys are still swallowed, and a window's keys (townTalk, above the ladder)
are its as ever. BOOT-HIDE's walk turned on the keys: `test/scenes/keyboot.test.js` walks the ladder's statements before the
latch through every function of the boot they reach and finds no binding declared past an await (the death screen's
own flag aside, read only under a death screen); with the latch taken out it names `socialMenuCanOpen`.

## GHOST-DIM, GHOST-CAP (4)

`ui/enhanced/enhancedPlusStyle.js` VITALS_CSS; `ui/barLoss.js` `stepGhost`, GHOST_HOLD_MAX. The vitals' strip wears the bar's
own body tone at 0.35 - darker than any band of the fill, lost reading as lost (it was `--v-hi` under `#fff6e4` at
0.55: on fatigue about #6a9073, the brightest and least saturated of the three). And the strip stands GHOST_HOLD_MAX
(1.2 s) in all at the most before it drains, however the losses keep coming - a flurry inside it still reads as one run
of damage (the VB2 law), but fatigue through a fight no longer pins it at the fight's first level. The law is the foe
bar's, the gate boss's and the naval card's too (they share `stepGhost`). The classic HUD's trails are DFU's own dark
colours and unchanged. `test/ui/ghostcap.test.js`.

## SWIM-EYE (5)

`player/motor.js` SWIM_EYE_HEIGHT, SWIM_RIDE_EYE_HEIGHT. DFU's DoSinking sets the camera at ControllerHeightChange's
answer, `controller.height / 2f` (PlayerHeightChanger.cs :417, :477-480) over the controller's centre - and a
controller under 2 * radius is Unity's sphere of that radius, its centre CAPSULE_RADIUS (0.35) over the feet (the
port's collider clamps it the same way, `_resolveCapsule`). So the sunk eye is 0.35 + 0.15 = 0.50 over the feet, 0.65
in the saddle. The port had written its own "0.1 under the top" law over the nominal 0.30 capsule - 0.20, inside the
sphere's foot - and DFU's own swim bounce (headBobber.js ApplySimpleBouncing, re-armed every cycle in the water) dips
BOUNCE_MAX (0.17): the eye went to 0.03, under the drawn terrain (its two triangles a quad up to 0.08 off the bilinear
floor), inside the world's 0.2 near plane, and the terrain - drawn one-sided - vanished over the sky, the far ring's
mountains and the town's walls; at the sea's own height Deep Waters' `fogPresentation` (camera <= sea + 0.25) read it
as underwater. At 0.50 the eye's foot through the bounce is 0.33: the near plane's lowest point at the default field of
view (65) stays 0.09 over flat ground at any pitch, and the eye over the band. MAC2's sink on shallow tiles (docks,
moats, puddles) is unchanged - it is where the report met it, and with the eye where DFU puts it, it no longer clips.

**Said, not fixed.** At a field of view past about 105 the near plane can still graze flat ground at the bounce's foot
(DFU's own lens, the port's 0.2 near plane). Deep Waters' carve and the terrain's clip are read from different masks
(the carve from heights, the clip from water tiles): a carved cell under a non-water tile is drawn as ground and walked
through to the seafloor - a separate path, not reproduced here. `test/player/swimeye.test.js`; `test/player/a6_motor_residue.test.js`
holds the two values.

## SPRITE-GRAD (6)

`render/renderer.js` BB_FS, `render/enhancedLighting.js` EL_BB_FS. A flat's texture keeps its whole mip chain
(`_retroMips`, on outside Retro Picture Mode) and `texture()` picks the level off the 2x2 quad's derivatives, which GLSL
ES 3.00 (8.9) leaves undefined inside non-uniform control flow. ELITE FOES (2b42f1f9, 2026-10-02) sampled the albedo
under a ?: (an elite's widened quad's margin), and the emission map was read past the cut's discard. Along every
sprite's edge half a quad's lanes take the other arm; a GPU that keeps no uv in those lanes (Apple's, under Metal, is
the plausible one - NVIDIA, AMD and SwiftShader keep them, which is why no probe saw it) reads a level whose texels are
palette 0's dark RGB at middling alpha, which passes the 0.5 cut: a dark box round every flat, whatever the filter.
Both maps are now sampled before any branch or discard and the margin (and the chameleon's ripple past the edge,
ECV1's REPEAT-wrap guard) masked after. The real GPU probe (`tools/enhancedLightingProbe.mjs`, ANGLE over SwiftShader)
compiles, links and draws both lanes clean.

**Said, not fixed.** Not reproduced: there is no Apple GPU here. If boxes remain on the M3 after this, the next suspect
is the ambient occlusion's silhouette normal (`render/airPass.js` AO_FS - its derivatives taken against far-plane
positions since AUDIT FLICKER F3, spread by the depth-aware blur): `?air=off` tells the two apart, `?lighting=classic`
rules the lane out. The Video pane's World Texture Filter (`Video/MainFilterMode`) has no consumer in the renderer - it
changes nothing at all, which is why the report's filter change did nothing either way. `test/render/spritegrad.test.js`;
`test/systems/combatVisuals.test.js` ECV1's pin follows the mask.

Mutation list: `tools/mutants/fb1002c.json` - 28 mutants over every fix above, 28 dead.

## PUPPET-GLIDE (FIELD BUGS 2026-10-02d)

The Discord, the same day: *"Ai ships move very janky and quick"* (the reporter could not say where). `scenes/naval/navalHost.js`
(the others' ships, PUPPET_CATCH, PUPPET_CATCH_MPS, PUPPET_CATCH_SHARE). **Measured first.** The captains' own sim is
smooth and frame-rate blind: a galley, a cutter, a brig and a sloop at 60 Hz, 144 Hz and 8-40 ms frames drew no jump, no
turn reversal and 0.002 m/s of speed jitter a frame; a harbour's traffic over fifteen minutes (arriving, berthing,
departing, fighting) the same, but for the berthing's slide (under 2 m/s across her heading over MOOR_EASE_S). AI and
player hulls make the same way (HELM-WAY's 7.6 m/s Small Ship). What moved badly was ANOTHER PLAYER'S ship: her copy was
eased (PUPPET_EASE) straight onto each word and run on from the moment the word ARRIVED, so a word a little late or
early moved her target by her way times the difference. Over a relay that keeps the order and jitters 50-400 ms, a
galley at 4 m/s was drawn at up to 10 (p95 5.9), her speed jumping 3.3 m/s from one frame to the next, a step astern on
86 frames of 5,394; at 50-150 ms she still wobbled 40%. test/navalRoom.mjs had only ever sent at a steady latency, where
she was smooth.

**The fix.** Under way (afloat, not orphaned, her word's way above nought) she sails on at her word's way along her own
heading, the heading eased onto the word's as before, none once the word is PREDICT_MAX_S old; the gap to where the word
puts her is taken up at PUPPET_CATCH (1 a second), never faster than PUPPET_CATCH_MPS + PUPPET_CATCH_SHARE of her way
(0.3 m/s + a tenth). The same relay: drawn at 4.7 m/s at most (p95 4.4), 0.6 m/s a frame at the 99th, never astern,
error 1.1 m at most (it was 2.1); at a steady 80 ms, a third of the old error. A ship lying still, struck, going down or
orphaned is still eased onto her word; a boarding's haul (the stander's own ship moved 20 m at once) still snaps as it did.
`test/scenes/naval/puppetglide.test.js`; `tools/mutants/fb1002d.json`.

