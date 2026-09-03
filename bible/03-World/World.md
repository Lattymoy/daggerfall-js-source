# World

ACTIVE again - TOWNS. The M1-M9 build queue is COMPLETE, and the arc reopened
for the T-series (T1 the wandering population, T2 the streaming mount, T3
talk); see `World-Arc.md` for the live record. All world-assembly state lives
there (milestones, conventions, queue). Deviations and quirks are ledgered in
`01-Overview/Port-Ledger.md`.
(AUDIT 18: this page said "COMPLETE (build queue empty)" while Home.md's arc
index had the arc ACTIVE again. Home.md is the index; this page must agree
with it.)

Shipped: RMB block assembly, full location layout, ground tilemaps, flats,
building interiors + static doors, RDB dungeons + action records,
WOODS.WLD terrain heightfields, terrain tile texturing + locations
placed and leveled on terrain, nature flat scatter, floating-origin
streaming (?world walks the whole province).
The World-Arc build queue is COMPLETE. Follow-on work in this section:
the Player arc (`Player-Arc.md`) - movement, collision, and the door/
ladder activation that consumes staticDoors.js.

**TL1 (2026-09-03, Mac: "you don't remain on the ground after traveling, you spawn in the air and drop").** The arrival's floor ray was a door step's: ten units down from the raw. The raw is the location's flattened height and the edge landing stands ten units OUTSIDE the location, on terrain the blend has not fully flattened - a steep site puts it more than ten units below (the ray missed, the raw stood in the air) or above (the ray started inside the hill). StreamingWorld's FixStanding starts its ray high and reaches far for exactly this; the arrival now passes a lift of 40 and a reach of 240, the first hit still the surface, and a flat site lands exactly as before. Door steps keep their ten. Pinned in enterexit.test.js.
