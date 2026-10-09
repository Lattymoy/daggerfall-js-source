# FIELD BUGS 2026-10-01d - the professions' acts on the loot list and the crosshair, the pickups at the centre

Mac, the same day as `Field-Bugs-2026-10-01c.md`: *"Can you also overhaul the profession minigames? They should use the
same menu the loot menu uses and not an interaction button. And all minigames should be overhauled to be more detailed
and use the enhanced plus UI look"* (asked, "One loot-style list" and "Richer visuals, same rules"); then *"ALSO, a
better center screen notification for pickups"*; then, the illustrated panels built and seen, *"I feel like maybe we
should move away from the overcomplicated minigame visuals and instead use the mechanics on something that doesnt cover
the screen"* (asked, "Around the crosshair"; the stations, "Yes, keep them simple").

| | Report | What it was | Done |
|---|---|---|---|
| 1 | the minigames start from an interaction button, not the loot menu | a node's act was the E prompt's alone | fixed (PROF-MENU) |
| 2 | the minigames, more detailed, in the Plus look - then: nothing that covers the screen | the old meter, a plain box under the crosshair | built (PROF-SCENES), replaced (PROF-RETICLE) |
| 3 | the stations kept simple | the heat, stitch and plane bars in the older brass | dressed (PROF-STATIONS) |
| 4 | a better centre-screen pickup notice | a quick-loot take said one mid-screen line, the classic's | built (PICKUP-FEED) |

The rules, the timings and what the counting-house is told are untouched throughout: every act is still its own module
(`systems/herbAct.js`, `mineAct.js`, `chopAct.js`, `traceAct.js`, `fishAct.js`; `heatAct`, `planeAct`, `stitchAct`), and
the server reads only their reports.

## PROF-MENU: a node is the loot plaque's list (1)

A profession node under the look is a list on the world plaque (`ui/worldPlaque.js`), the loot pile's own: its name, its
profession's word and its acts as verb rows - "Pick Red Rose", "Skin the Grizzly Bear", "Search the Grizzly Bear" - a
refused act with its reason beside it (none where its label already says it), the first pressable one lit first
(`scenes/gatherHost.js` `hoverHit`, `hoverName`; `systems/worldHover.js` `resolveHover`'s 'actions' frame). A row is
pressed as a loot row is - the click, the activate key, a tap - and starts that act; a hold-act started from the list is
held by the press as a tool's Use holds it (`heldByUse`), so it does not cancel the moment E is not down. The ActChoice
key walks the rows (`systems/quickLoot.js` `plaqueStep`; its Controls row). Where the plaque does not stand - the classic
skin, touch - the node asks through a list window (`ListPickerWindow`, the boat menu's precedent). The hover yields to a
ray winner in reach when no row of the node is pressable, so a door or a body behind a spent patch is still the press.

`test/fb0930b_toolsaid.test.js` (+5); `tools/mutants/profmenu.json`.

## PROF-SCENES, then PROF-RETICLE: the act on the crosshair (2)

PROF-SCENES first drew each act as an illustrated scene in the plaque's frame - the rock's face, the trunk and its
notch, the plant, the leaf litter, the pelt, the water. Mac saw it and asked for less: nothing that covers the screen.
PROF-RETICLE replaced it (`ui/profScenes.js` deleted): no box, no title, no picture. Each act's mechanic is drawn on and
about the reticle (`ui/profReticle.js`, dressed by `ui/profActStyle.js`), round the crosshair's middle as the world
draws it (`ui/worldPlaque.js` `reticleAnchor`: the middle under a docked large HUD, and the frame's focal length through
`fieldOfView`, so an angle `a` off the look stands `focal x tan(a)` from the middle):

- **mine** - the face's five points marked where they stand on the rock, moving as the look does; the glinting one
  shows the reach a blow counts double in (MINE_ACT.radiusDeg); a blow's flash on the crosshair, gold on the glint.
- **chop** - the notch a ring round the crosshair, the band a Clean Cut stands in, the ring closing on it and lit in
  the band; a short still bar under reduced motion.
- **hand, steady, a Gentle trace** - the hold, an arc round the crosshair; a bruise turns it.
- **basket** - the glint at its spot about the crosshair, lifted clear of the pips, its time left an arc round it, the
  three finds as pips.
- **trace** - the knife's line laid on the body, the tolerance it is scored in a faint band under it, the first point's
  reach until the knife starts, the points passed lit, the line drawn behind the knife.
- **fish** - the throw an arc while it winds, its metres beside it; the float under the crosshair while it waits (an
  over-a-school ring); a ring's flash and the float's dip at the tug; the haul's band and weight a bar beside the
  crosshair, slipping marked, the net's fill an arc.

Under the crosshair the count's pips and one line of hint - the act's own words, unchanged - fading once it has stood
2.5 s unchanged (`HINT_MS`); a number moving in it (the throw's metres) does not bring it back, a new line does. Every
cue is a shape and a sound (`actCues`, `systems/profSounds.js`, DFU's own clips). The node's name is the menu's; the act
carries none.

`test/profreticle.test.js` (10); `test/audit32_pages.test.js` P11 (the line's degree the same across as up, now the
lens's) and `test/prof7_client.test.js` (the Gentle hold an arc) re-aimed; `tools/mutants/profreticle.json` 57, all
dead; `tools/profReticleProbe.mjs` (every act over a sky and a field, desk, phone and reduced motion). NOT SEEN IN THE
WORLD ON A GPU: the probe draws the marks over a flat ground through a 65 degree lens, not the frame.

## PROF-STATIONS: the stations' bars, dressed (3)

The anvil's heat, the loom's beat (both the heat's bar) and the workbench's board keep their markup and their rules,
dressed in the plaque's frame and the kit's tones (`ui/profStationStyle.js`): the craft box the plaque's ink ground and
stone border, the bar a carved well, the band and the marker edged in ink, the strikes the acts' diamond pips. No
picture: an illustrated forge, cloth and board were built aside and left out at Mac's word.

## PICKUP-FEED: what a take put in the pack, at the centre (4)

(LOOT-BANNER, 2026-10-09: a piece new to the player in Rare or better takes no card here now - its banner at the right
edge announces it, `10-UI/Loot-Banner.md` section 4. The feed's tiers are Common and Magic, and a Rare piece of the
player's own picked back up.)

On the enhanced skin every quick-loot take - one row or take-all, from a body, a dropped pile or a fish, gold included -
shows a card per item at the centre of the screen (`ui/pickupFeed.js`): its icon (the pack's own cached lookup, asked once
a card), "+" and the name in its rarity's colour, "x N" past one, gold as "+N Gold". Taking the same item while its card
stands adds to its count, restarts its clock and brings it to the front; four at most, each 2.5 s and a 0.4 s fade,
the newest nearest the middle, a take-all in pile order. The feed starts on the mid-screen label's line and stands clear
of the crosshair, the plaque and its stats, the act's marks and the mid-screen line above, and the HUD's bottom, the
profession prompt and a docked large HUD below; short of room it moves up, then shows only the newest. The take tells it
through `quickLootTake`'s `took` hook, the take itself free of the DOM: shown, the success line is not said; on the
classic skin, off a document or if the hook throws, Daggerfall's line is said as before; a refusal is always said; gold
counts what moved. The plaque's hide and teardown take the cards down. Not here: a loot window's clicks (the item moves
in the window), DFU's arrows line, torches and the Burning Court's spoils, which keep their own words.

`test/pickupfeed.test.js` (22); `test/quickloot.test.js`, `discord5`, `audit24_wave38` and `disc7` re-aimed;
`tools/mutants/pickupfeed.json` 54, all dead; `tools/pickupFeedProbe.mjs` (202 layout checks at desk and phone).
