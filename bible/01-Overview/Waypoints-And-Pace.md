# WAYPOINTS, PACE-DIALS AND THE ANTI-FLICKER PATCH - three patch files, integrated

2026-10-06. The user handed over three archives of whole files - `overworld-waypoints-patch.zip`,
`anti-flicker-patch.zip` and `waypoints-antiflicker-merged-files.zip` - written against copies of the tree from
2026-10-04 to 2026-10-06, and asked for them in. This page records what they carry, how they were brought onto main,
what was changed to make them stand under this tree's laws, and what was pinned. The players' words quoted below are the
patches' own, from their comments.

## How they came in

The archives are snapshots, not diffs, and no two files share one base: each file was matched against every commit
that touched it, and its closest version is its base (the waypoints' `world.js` differs from `d595ca9e` by 109 lines,
the merged archive's from `224e88db` by the same 109; the merged `shadowPass.js` from `c42bbc20`, main's own, by 79;
`features.js` from `e8273d16` by 6). The merged archive is the other two: its twenty-three files are the waypoints'
sixteen and the anti-flicker's five (two shared), and where a file differs from its single archive the difference is
main's newer lines, the patch's own lines alike. Each of the eighteen files main already had was brought onto main by a
three-way merge from its own base (`git merge-file`), so every line main wrote since stands: all eighteen merged with no
conflict, and each file's change on main came out exactly its patch's lines. Copying the files over would have reverted
what main wrote since in nine of them - CITE-ANCHOR's anchors, Project Legacy, the watch's merge and LEVEL-ONLINE.

## What they carry

**WAYPOINTS** (the player: "Let players add waypoints, partywaypoints and guild waypoints to the overworld map and
Worldmap(V) with right mouseclick context menu ... They can be small flags with different colors. Add the waypoints you
want to mark (to follow) to the filter list on the overworld map with a dropdown menu. Add Waypoints to the filter on
the worldmap"). `systems/mapWaypoints.js` is ONE STORE for both maps: a point on the bay in map pixels, a name, a flag
colour (eight) and a kind - personal (this device's), party or guild. A party's or a guild's is said on the hub's own
party or guild channel (CHAT-CHAN, GUILD1c - no relay change) as one line the chat never shows (`[WP1] add|ren|col|del`),
kept by every member who heard it, and moved only by its author (a line's sender must be the one that made it; anyone
may rename or drop one on their own screen alone). `ui/waypointMenu.js` is the right-click box both maps open - add one
where the map was pressed (a name, the kind, the colour), or a flag's own menu: rename, recolour, follow, travel there,
share again, remove. `ui/waypointFlags.js` paints the flag once for both (a party's pip, a guild's bar - the kind never
told by colour alone). The Overworld (`ui/travelViewHud.js`) draws every shown waypoint where it lies and a FOLLOWED one
held at the screen's edge with its distance; its filter block has a switch per kind, a dropdown that follows one and the
followed list (Go, unfollow). The held map (`ui/heldMap.js`) draws the flags on the bay, names one under the pointer,
and its key has the kinds' switches. GROUP-LEAVE ("i hope the waypoints are removed when leaving party"): the world host
tells the store the party and guild the hub says the player stands in, only while the hub is open (a dropped link
removes nothing); leaving one takes its waypoints, mine and theirs.

**PACE-DIALS** (the player: "Revert back to the overworld timer multiplier for ppl to set to 60x and 100x on roads and
the nearby enemy timer to set to 60x max ... speed settings should be 5x 10x 20x 30x 40x 60x and 100x should be only
setable when on a road and it has to go to 60 instantly again when leaving the road. Same for enemies nearby
multiplier ... should have the same rules in other uis in online mode"). `systems/travelPace.js`: two dials on one
ladder (5, 10, 20, 30, 40, 60, 100) - the journey's Speed and the Near enemies floor (ENEMY-PACE's) - kept on the device.
RATE-LAW's x100 and x60 are the dial's two ceilings now: x100 is chosen on a road alone, and leaving a road takes a dial
at x100 to x60 at once, never climbing back. Every reader asks this module (`systems/timeScale.js` travelRateOf,
`systems/travelThreat.js` foePaced), and the world host tells it the ground every frame a journey or the Overworld runs,
so every skin runs under one law. `ui/travelPaceControls.js` builds the steppers for the Overworld's block, the enhanced
journey bar and - for the classic strip and GrimoireUI - a pace box of its own while a journey runs. The default is x60:
RATE-LAW's road ran at x100 by itself; under the dials a road is x100 when the player sets it there.

**The Overworld's furniture.** FILTERS-LEFT ("move the filters for the overworld to the left bottom side"): the filters
stand in a block of their own at the bottom left (it folds; HUD-MOVE knows it as "Overworld filters"); SIDE-CORNER: the
HUD's quick slots step to its right while the view is up, never under it; PLUS-PICK: the waypoint dropdown is the
Enhanced Plus kit's own switch, not a browser select.

**The foe's bar.** POISE-QUIET ("the block under the monsters hp must go"): an EMPTY poise track - no wind-up, no iron,
no stagger, no opening - is not drawn; the bar stands alone until the foe's poise has something to say. FOE-SHADOW ("dont
let the foe health bar have 2 shadows"): the track wears the kit's ring alone.

**The anti-flicker patch** (the player: every shadow in the tavern blinking at once with Enhanced Lighting on, on every
card, and none with `&shadowcache=off`). CACHE-OFF: the shadow cache is OFF unless asked ON - by the address
(`shadowcache=on`; `off` still wins), by the device (`dfjs.shadowCache`) or by Enhanced Lighting's new "Shadow cache
(faster, may flicker)" part (`shadowCache`, off); the renderer's own default is the page's door. EMPTY-HOLD: a run of up
to 30 frames that recorded no caster (a hitch, a chunk swapped mid-frame) keeps the last frame's maps instead of
clearing every lamp's and redrawing every cube on the next. IDLER-STICKY: a flat whose LOOK changed where it stands (an
idle, a 211 prop) is a mover for good - its shadow drawn with the movers', never the reason a static cache rebuilds; a
walker that stops is still the hold's alone. STATIC-WHO: with the shadow debug log on, a rebuild frame names what came
into and went out of the static set.

## What integration changed

Each against a law of this tree the patches did not know:

- **EMPTY-HOLD over a door** (`render/renderer.js`, `render/shadowPass.js`). A door crossed is a cut - DISC15 drops the
  other side's records on its first frame - and that empty frame was held: the street's lamps' maps stood in the room
  (and the room's lo-tier table out in the street). The renderer hands the pass `cut`, and a cut is never held.
- **The storage seam** (`render/shadowPass.js`). The device's switch read `globalThis.localStorage`; it reads
  `appStorage()` (AUDIT DA's pin: one storage seam, so the desktop app's file store sees it too).
- **One shape for a batch** (`render/renderer.js`, `render/contract.js`). IDLER-STICKY's `_shIdler` is minted undefined
  in createBillboardBatch's literal and declared in the contract (PERF-EXT10, HARD3: 53 fields).
- **The held map never asks which sheet** (`ui/heldMap.js`, `ui/mapStrip.js`, `ui/automapSheet.js`, `ui/townSheet.js`).
  The waypoints' right click branched on the 'world' sheet by name (EM1); the sheet contract grew `context` - the world
  sheet's opens the waypoint menu, the dungeon plan's and the street's answer false - and the flag's hover is the world
  sheet's own `_hoverLabel`.
- **The ONE context-menu guard** (MAC-L3). The held map and the menu rolled their own `contextmenu` handling; the held
  map takes a right PRESS on a flat sheet through the sheet's `context`, and the menu leaves the browser's menu to the
  document's guard (so its name field keeps its paste menu, as every field does).
- **The type floor and the picker's rank.** Text under 11px lifted to 11 (FONT3; the menu and the pace box joined the
  floor's sheets); the menu stands at the in-game top tier, 39, under the asset picker's 40 (MWFIX 1; it stood at
  2,147,483,000).
- **One home for the rates** (`systems/travelPace.js`, `systems/timeScale.js`). The dial's two ceilings were a second
  pair of literals beside TRAVEL_ROAD_RATE and TRAVEL_OPEN_RATE; travelPace.js (a leaf) declares them and timeScale.js
  reads them, the road's pinned equal to MAX_TIME_SCALE; the panel's bare 60 is OPEN_PACE_MAX.
- **Source the pins read.** The pace listener moved above the frame's claim (FB0930-FRAME: the claim, the boot's last
  step and `frame` stand together - it reads the token when a dial turns, as the travel view's `alive` does); the
  Overworld's `onLower` is main's one line again (its menu goes down with the view's HUD); the hub's `onChat` is one line
  with the waypoint's take first; the comments the patches had pushed onto their neighbours' lines put back.

## Pins

Laws the patches CHANGED, the pins re-aimed with their reasons: the RATE-LAW files (ratelawfix, travel_speed_preference,
to1_travelOptions, tv_wasd, ow6_slowdown - each drives the lanes' law at the dial's top, x100 set on a road, which is
what they pin: which ground the journey stands on); AUDIT REACH B3 (a record's or a flip's change is a move - and now a
look change sticks, a walk does not); AUDIT 68 S17 (an empty RUN past the hold clears and the returning sun draws its far
cascade at once; one empty frame is held); TELL9 (the empty track is no track); EDGE-FURNITURE (a measure reads the
filters' block too: five boxes where it read four); MAP-KEY (the key's FILTER rows); CHAT1 and GUILD1c (the hub's line);
DEEP2 (the menu holds the keys); TV2 (the click's own ray, read at the click's site - the menu casts the same one); EL1
(the row's new part); HARD3 (the batch's fields); FONT3 (the floor's sheets); and the arc pages' module counts AUDIT18
reads (Systems.md 428, UI.md 316). The anti-flicker patch's own two moves stand as written (`test/perfurl_doors.test.js`,
`test/sc1_shadowcache.test.js`: the door asked by nothing answers off).

New: `test/pacedials.test.js` (8), `test/waypoints.test.js` (9), `test/antiflicker.test.js` (3).
`tools/mutants/waypoints_pace.json` (23) and `tools/mutants/antiflicker.json` (10), all dead; thirteen records of other
lists re-aimed by content and dead (auditlight, audit_flicker, disc15, disc17, disc24, el3, guild1c, ow1, ratelaw x3,
tv1, tv2).

## The four hosts

`scenes/world.js` is wired: the Overworld's marks and right click, the held map's waypoint context, the hub's channels,
the groups, the pace ground and the pace box. `scenes/exterior.js` (the fixed city) runs no streamer and no Overworld -
its journeys' rates read the same dials through timeScale.js, and no waypoint is drawn there; `scenes/worldModes.js`
(interiors) and `scenes/dungeonContext.js` run no journey and draw no Overworld - FLAGGED by name, nothing to wire. The
shadow changes are the renderer's, under every host alike.

## Not verified here

Nothing was rendered, clicked or played: the flags, the menu, the filter block and the pace box are pinned on fake
documents; the waypoint wire was never sent through a live hub; the anti-flicker patch was not measured against the
reported tavern. The patches' own player quotes were not checked against the threads they came from.
