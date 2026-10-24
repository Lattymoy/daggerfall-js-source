# FIELD BUGS 2026-10-20e - OFFERING-RAY: a press in a street with a Hearth Offering crashed the game

Three screenshots from the Discord's #bug-reports (2026-10-20), handed over with no word beside them: two from Temegast
(5:59 PM and 6:08 PM, "crash on interact" in the chat behind the second) and one from Boar (6:12 PM, "ehh"). Each is the
CRASH panel over a town street - a body on the ground under the crosshair in Temegast's two, a townsman beside a stable's
horse in Boar's - and each carries the same stack: `TypeError: Cannot read properties of undefined (reading '0')` at
`Qv` <- `bye` <- `i` <- `oy` <- `fy` <- `Object.Wh [as exteriorActivationHit]` <- the world chunk. Read on the code as it
stands at main's `ccfb3c135`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Temegast: "crash on interact" (two screenshots); Boar: the same panel and stack | A Hearth Offering's target (WITCH1, #1079, merged that day) handed the street's one ray its batch's culling box, a 6-array, where the ray reads `{ min, max }`. The pick tests every entrant's box before it races them, so every press in a street where one stood threw | fixed (OFFERING-RAY) |

## OFFERING-RAY: an offering's box is the ray's

`src/scenes/witchesHost.js` (`targets`), `src/player/activate.js` (`RayBox`, `RayTarget`).

FOUND. The stack is the pick in `player/activate.js`, frame for frame. The names are the bundler's, but the columns fall
in source order: `exteriorActivationHit` (`scenes/worldModes.js`) -> `pickActivatableHit` -> `firmFirst` -> its `nearest`
-> `nearestActivatableHit` -> `rayAabb`, and the pin below throws the same TypeError through the same five frames.
`rayAabb` reads `aabb.min[a]` and `aabb.max[a]`, and "reading '0'" is its first axis on an entrant with no `min`. The
street's one list (`exteriorActivationTargets`) holds eight families: the doors, the street's people, the boards, the
graves, the monument, the yards, the ports and the offerings. Seven mint `{ min, max }`. The offerings pushed the batch's
culling box, `render/frustum.js` flatBatchAabb's `[minX, minY, minZ, maxX, maxY, maxZ]`, with the pixel's translation
added. The streaming host's boards and graves convert that same 6-array by hand, and world.js says so beside them:
"pickActivatable takes {min,max}; the pixel keeps the 6-array the culling box uses".

WHY EVERY PRESS, not only a press at a bowl. The pick runs the slab test over every entrant before it races them, so one
box it cannot read throws wherever the ray points: at a body to loot (Temegast's two), at a person (Boar's), at a door.
Every press asks the street's pick - the race's `door` is `modes.exteriorActivationHit`, built beside the corpse and pile
picks - so the throw reached the frame uncontained and the game stopped. `targets` walks every built pixel's stood
offerings, not only the one underfoot, so a press beside such a town crashed too, for as long as its pixel stayed built.
It needed an offering stood - online, a home's owner having set one out, asked while the festival is live (or while
one's own bowl stands there) - which is why it began the day the festival opened, and only in some towns.

THE PLAQUE, silently. `exteriorHoverPick` asks the same pick every frame, inside worldHoverFrame's containment
(`ui/worldPlaque.js`, ONCRASH1's law), which caught the throw, warned once and stood the plaque down: in such a street
the World Tooltips plaque named nothing at all.

WHY IT SHIPPED GREEN. `test/scenes/witch1_host.test.js` read the 6-array back off the producer (`targets[0].aabb[0]`)
and never handed it to the ray: Home.md's TEST THE SHAPE THE PRODUCER MINTS, from the other side. And nothing typed the
boundary: `witchesHost.js` is `// @ts-check`, but its list was an untyped `[]`.

FIXED. The offering's target carries its corners as `{ min, max }`, with the pixel's translation on each: the boards'
and graves' conversion. `player/activate.js` writes the ray's box down once, as the type `RayBox` (and `RayTarget`, one
entrant of the pick) beside rayAabb, and the offerings' list is typed with it. So the 6-array is now a type error at the
producer: put back, `npm run types` (CI's `verify`) answers `TS2739: Type 'any[]' is missing the following properties
from type 'RayBox': min, max`. A type, because this is HARD3's own class (`01-Overview/Hardening.md`): a shape crossing a
boundary where a wrong one throws rather than misbehaves. The ray itself is unchanged. It is not taught to read a
6-array, nor to skip a box it cannot read: that box is its producer's defect, and a ray that hid it would leave the
offering unpressable and the next such defect silent.

Not a DFU member (WITCH1 is Ledger A, THE WITCHES' FESTIVAL), so this departs from nothing. THE FOUR HOSTS: the
offerings stand in world.js alone and reach the street's ray through worldModes.js, neither changed; exterior.js and
dungeonContext.js stand none.

PINS. `test/scenes/fb1020e_offeringray.test.js` (2):
- the real host's stood targets carry `{ min, max }`, the pixel's translation on every corner (a translation that moves
  every axis);
- the real pick over the street's list (a door's box and the offerings') takes the door at the door, each offering at
  its bowl at its near face with a door's reach, and nothing at the sky, without a throw. Before: the TypeError, at the
  door's press first.

`test/scenes/witch1_host.test.js` THE RAY AND THE PLAQUE re-aimed at `aabb.min[0]`. Mutants
`tools/mutants/fb1020e_offeringray.json` (6, all dead): the 6-array back, the corners crossed, either corner left in the
pixel's frame, the foot's and the top's height unmoved.

Not seen in play here: the offerings are the account service's, online alone. The pins drive the real producer and the
real pick, and the pick's stack is the field's frame for frame.
