# FIELD BUGS 2026-10-01c - the camps' shrubs in the air, the journey's hold on enemies, the party's ready

Three lines from Mac, the same day as `Field-Bugs-2026-10-01.md`: *"World of daggerfall bush props float above the
ground in bandit camps"*, then *"Also when party readying up, the ui element is hidden. We also need to reduce the
distance at which overworld enemies slow the user down"*.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | the bush props float in bandit camps | the mod's own heights, read off the author's ground, in the band the mod only eases toward the site's level | fixed (WOD-BUSH) |
| 2 | the ready-up element is hidden | the ready-up's own windows closed the Party tab that holds it, and the leader's HUD label stood 4 s of a 60 s round | fixed (PARTY-READY) |
| 3 | overworld enemies slow the traveller too far out | the port's own warning (OW6), 1.2 s since OW6-NEAR | fixed (OW6-HALF) |

## WOD-BUSH: World of Daggerfall's shrubs stand on the ground (1)

World of Daggerfall stands every object of a site at the site's average height plus the author's own height
(`LocationLoader.cs:232-252`, `world/worldOfDaggerfall/wodLocationLoader.js` `placeObjects`). It levels the ground to that average only
inside the prefab's rect; past it, every sample is lerped toward it by `1 / (distance + 1)` - half one sample out, a
third two out (`flattenForLocation`). The camps ring their sites with one shrub model, 60610 - 45 of its 202
placements, every bandit camp among them, never inside the rect - in that band, at heights the author read off the
ground of the one place they were laid out (posY from -27 to +15 at scales of 3 to 10). Where a camp's ground falls
away past its rect, the shrubs hung in the air; where it rises, they sank. DFU does the same: nothing in the mod reads
the terrain after the flatten.

The shrub now stands on the DRAWN ground: its mesh's foot (its transformed box's bottom) goes to the lowest ground under
the middle half of its footprint (`world/terrain/terrainSurface.js` `lowestGroundUnder`, `scenes/world.js` `buildPixelNow`),
read at the footprint's corners, its centre lines and every sample line that crosses it, so no quad under it is
skipped, and held to the pixel (the neighbour's ground is not this pixel's to read). The middle half, because a shrub's
foot is its middle: the whole box would bury a wide one deep on a slope for corners that are empty air. The matrix
moves before the shrub is batched and its collider filed, so what is drawn is what is struck. Every other object keeps
the mod's height: the rocks are embedded on purpose, and a tent, a fire or a wall stands on the levelled rect. A
Ledger A row records the departure.

That 60610 is the shrub was read off the camp layouts (ringing every site with uneven scales and random tilts; the
camps carry no nature-archive flat at all), not off ARCH3D, which this container did not hold, and was not seen on a
GPU. The rock fields build their outcrops of the same model - its other 157 placements, boulders scaled 5.6 to 95 and
set into the piles - and as first shipped this stood those too, as shards up to 377 m tall round every rock field.
ROCK-SUNK (`Field-Bugs-2026-10-02.md`) stands the shrub alone: a site the mod names 'Rocks' or 'Mountains' keeps the
mod's height (`world/worldOfDaggerfall/wodLocationObjects.js` `isWodShrub`).

`test/world/terrain/wodbush.test.js` (5); `tools/mutants/wodbush.json` 7, 7 dead.

## PARTY-READY: the ready-up stays on screen (2)

The ready-up is PARTY-TRAVEL's round (`systems/party/partyTravel.js`, `06-Systems/Online-Arc.md` PARTY-TRAVEL and PARTY-READY):
the leader chooses a destination on the travel map, the gathered members are asked, and the party sets out when nobody
gathered is still waiting. It has three things on screen - the leader's HUD label, a member's Yes/No box and the Party
tab's Journey block (the round's count and Call off; a member's Ready and Stay behind) - and the round took them away
itself:

- **The leader's Party tab.** Its Travel map opens the travel map, a window over the HUD; the Social panel closes under
  any such cover (SOC3) and nothing opened it again, so for the whole round the tab - the count, Call off - was gone.
- **The leader's label.** "Waiting for the party to ready up (n/m ready)." stood PARTY_REST_FAR_SECONDS (4) of a round
  that runs PARTY_READY_TIMEOUT_MS (60); the answers after that reached the chat alone.
- **A member's Party tab.** Open as the round began, it was asked anyway by the box, which pauses the game - and the
  pause takes the tab, the chat and the party's HUD out of the page.

Now the Party tab a cover took mid-journey comes back when it lifts (after the map its Travel map opened, or after any
window over an open round); the leader's label stands for what is left of the round, set again only as the count
moves, and the set-out, a call-off or a lapse says its own line over it; and a member with the tab open answers there,
the box asking only once it is closed unanswered. No regression in the history the clone holds: a gap in PARTY-UI's
design (2026-09-26), not a break.

Found on the way: `test/systems/party/partytravel.test.js` did not parse - two unescaped `'` in its RELAY_VERSION history line,
since the merge before this one - so none of its tests ran and every mutant list naming it (`party-travel.json`,
`auditpartyui.json`, ...) killed nothing. Escaped; the lists that name it run real again (101 dead in the two
re-aimed).

Not changed, and asked: if "the ui element" is the PARTY HUD (the portraits, SOC4), it still hides on a member's
screen while the box stands - a member without the tab open is asked by the box, and the whole enhanced HUD hides
under a pausing window by design.

`test/systems/party/partytravel.test.js` (+3), `test/net/soc3_socialpanel.test.js` (+1); `tools/mutants/partyready.json` 14, 14 dead.

## OW6-HALF: the journey's hold on enemies begins half as far out (3)

The slowdown is the port's own (OW6, `06-Systems/Travel-View.md`): the time scale is held so the traveller has
THREAT_WARN_S real seconds before the nearest enemy's reach, and the lead-in is reach + THREAT_WARN_S x (own pace + the
enemy's chase) x the scale. Mac named no figure; the warning is halved, 1.2 -> 0.6, the one knob that shortens the
lead-in for every threat without moving any band's, raider's, ship's or camp's sight or chase - which would also change
when they spot the traveller. A rider at x40 is held from 384 m short of a band's sight, not 768; on foot 84 m, not
168. The reach is still met at walking pace. The third "too early": 5 -> 2 (OW6-LATE), 2 -> 1.2 (OW6-NEAR), 1.2 -> 0.6.

`test/systems/travel/ow6_slowdown.test.js` re-derived (each threat that would no longer hold at x40 stands nearer, so its pin still
means what it did); `tools/mutants/ow6s.json` 27, 27 dead.
