# AUDIT PEER-RANGE + HALO-THIN (2026-10-10) - the others' draw distance and the halos' poses, audited

The owner, of PR #761 (PEER-RANGE, `07-Rendering/Performance-Priority.md`, and HALO-THIN, `11-Multiplayer/Scale-Arc.md`):
**"audit this"**. This page is the audit of the two changes and its record. What the audit changed is written into the
two records' sections as they now stand; this page is the findings, each with its verdict.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at 1db05661 - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), told to trace every finding from a real caller and reproduce it (a script, a surviving
mutant, a number) before reporting it. Each finding was then read again against the code before a line changed.

| Lane | Over | How |
|---|---|---|
| A | PEER-RANGE as a player meets it | every reader of the cut list and the layers it feeds, re-entry and churn, every door that answers a player on this screen, the frames of reference in every mode, the exemptions, the held set; scratch scripts over the real `RemotePlayers` and the cut |
| B | HALO-THIN against the relay and the receivers | the symmetry claim in space and in time, every relay reader of a socket's pose in a cell room, the `haloWhole` triggers, the receivers' source and silence laws, promotion, reconnects and the keepalive; the real `OnlineSession` over the fake socket |
| C | the pins, the mutants and the probes | mutants of its own over both laws (in `--jobs` workspaces), the fixtures against what the producers mint, the moved pins and the re-aimed records, both probes run and compared to the records |
| D | every word | the records, the comments, the commits and the PR's description against the code; the process gates; older text the changes made false |

No lane found a player-visible break in what shipped at the snapshot beyond F1 below, a stale picture in a window that
opens rarely. The HIGH finding is a pin that let half of the distance law go unread.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C1 | HIGH | Every fixture stood me at x 0 (`ME = [0,0,0]`, the host's `player: { pos: [0, 0, 0] }`), so `const dx = f[0] - me[0]` mutated to `f[0] - 0` or `f[0] + me[0]` survived every pin - in the game the cut would read the wrong players | FIXED: me off the origin on both axes and in height (`ME = [517, 3, -260]`), a cut measured from me moved along x; `PEERRANGE-x-from-origin`, `-x-summed`, `-z-from-origin` recorded, dead |
| B1 | MEDIUM | The symmetry holds in space, not in time: a neighbour whose socket into my cell is still opening (a token's mint), backing off or refused busy hears me through my halo into their cell alone, and that copy was thinned - lane B's probe stood me frozen for 20 s there, my swings, casts and concealment with me | FIXED: `_haloAlone` - a halo whose room reports a player in range of me that my own room does not hears every pose |
| C2 | MEDIUM | The held set forgotten on `range: 0` and on no place of mine was claimed in a title and pinned by no assertion (`range >= 0`, `live` without `!!me` survived) | FIXED: each way the cut stands down asserted not live, the held set empty, and the next cut chosen afresh |
| C3 | MEDIUM | The stop the session records for a halo (`mv: out.mv \| 0`) was unguarded: as `mv: 1`, a player standing and turning sent every pose to every halo, and only the pure law was pinned | FIXED: a session pin standing and turning for thirty poses (the halo hears the place once); `HALOTHIN-last-recorded-moving` recorded, dead |
| C4 | MEDIUM | The "reconnect" pin swapped a halo's socket by hand (`h.ws = fresh`) - a swap no reconnect makes; a real reconnect mints a new entry, which a per-room key passes too | FIXED: AURA-LIVE's real re-hello (`_promote` swaps the socket in place - the one producer that does) and a real drop, backoff and reconnect, each named for what it proves |
| D1 | MEDIUM | "120 neighbours at a corner ... 4,800 copies a second, about 10 ms": SLAM3's `poseHzFor` speaks 4 a second at 120 peers, not 10 | FIXED: 1,920 a second, 480 after |
| D2 | MEDIUM | "the walker's lantern ... DRAWN with no cull at all" (the record, Active-Arcs, `peerRange.js`, the PR, commit 1a80c336): `drawBillboards` frustum-culls every batch (PERF-CROWD2) - only the distance cull was missing | FIXED in the record, Active-Arcs, the code's header and the PR; the commit's message ("unculled lanterns") RECORDED here - a pushed history is not rewritten |
| D3 | MEDIUM | The list of halo-pose readers read as complete and was not: `riteNear` (60 m, the rite's call down the circle's cell socket) and `duelOpen`'s ring (12 m, before `duelMgr.duel` exists) judge the pose a halo socket last brought | FIXED: `_haloCurrent` - a duel's or a rite's word down a halo first brings it my latest pose; both named in the record |
| D4 | MEDIUM | The patch notes' "Nothing changes on screen: you still get every update" and "each update once": a copy let the quickest room win (SCALE2b), the near tier ranks by an 8 m-old pose, and it is 1.05-1.59 copies | FIXED: the record says the three differences; the notes say most updates once instead of two to four times |
| B2 | LOW | A halo's pose no longer kept it busy, and the ping's clock was the primary's: a halo went 20 s without a frame while my own cell's socket spoke at 10 Hz - RELAY-H1's five-second cadence | FIXED: each halo pinged on its own clock (`_haloPinged`, against its last pose, its last ping and the shared ping) |
| B3 | LOW | A walk under 8 m then a stop was never told: the stop arm compared against the halo's last pose, already standing | FIXED: standing at a place the halo has not heard is due |
| B4 | - | Found beside the change, not of it: a duel asked across a cell's edge never opens (the ask and the yes go to the rooms each side hears the other through - two Durable Objects); a blow in the open zone across an edge lands where its striker is no fighter. And `wildHere()` in `haloWhole` protected nothing - the zone's referee holds a fighter by a word my own cell's socket alone says | The zone's term REMOVED (the zone's halos thinned like anywhere); the duel and the zone across an edge RECORDED (Scale-Arc HALO-THIN "Left") |
| A1 | LOW | A player raised in place past the draw distance left their body lying its full minute: the rise test read the cut list | FIXED: `RemotePlayers.sync`'s `room` (the room's whole list) is where a rise is seen |
| A2 | LOW | A stored value that is no tier showed "150 m" on the card while the law read 300 | FIXED: the row reads `peerRangeOf` (choiceRow's `read`) |
| A3 / D6 | LOW | "x1.3 ... 260 m" is a foe archer's aimed shot (`aimedArrowMeta`); another player's arrow or spell reaches 200 m | FIXED: the records, the comments, the row's note and the pin say 200 m, and 260 m as the foe's |
| A4 | LOW | A far player's wagon or boat stands driverless past the range - its model is its own pool's, its driver a peer | RECORDED: a model seen from far off, its driver five pixels; the PR names it. PERF-TEAMS (main's, merged beside this audit) stops drawing a peer's team past `PEER_TEAM_DRAW_M` (400 m), so the driverless band is 300-400 m at the default |
| A5 | LOW | The party was asked before the distance - `social.isPartyPeer` allocates - for every player, every frame | FIXED: the distance first, the party only of a player past it; `PEERRANGE-party-asked-first` recorded, dead |
| A6 | LOW | A class sprite's bundle went with its batch at the cut, so one walking back in stood on the doll path a frame and composed a paperdoll for it | FIXED: a cut player still in the room keeps its bundle (`room`); one who left keeps nothing (AUDIT 68 S14's law, still pinned) |
| C5 | LOW | The duel fixture (`fighting` with `opponent`) was not the duel manager's shape, and `fighting &&` was undocumented | FIXED: the player I duel from its count on (`duelMgr.opponent`), the fixture the manager's shape |
| C6 | LOW | The cut's default range was never read by a pin; the host's "600 m" assertion could not tell 600 from 300; the "whole" pin poked `status` | FIXED: the default pinned, a player at 450 m added, a real drop |
| C7 | LOW | Pre-existing: dropping the halo loop's welcome check, or its `stats.sent++`, survived | The welcome FIXED (a halo open but unwelcomed hears no pose, pinned); the counter RECORDED |
| C8 | LOW | The probes' headers said more than they measure: peerRangeProbe's renderer has no camera (its cull never runs); haloThinProbe named a column it never prints | FIXED: both headers |
| D5 | LOW | "nearly 2,500 m" is pixel centre to pixel centre; three pixels either way reach 3.3 km along an axis | FIXED |
| D7 | LOW | The duel opponent was not exempt in the count, and the row named the party alone | FIXED (C5); the row names both |
| D8 | LOW | `dungeonContext.js` was said to draw the cut list; both dungeon draws are `worldModes.js`'s | FIXED |
| D9 | LOW | HALO-THIN wired `world.js` and named no four hosts | FIXED |
| D10 | LOW | Text made false and left: Scale-Arc NET-SMOOTH's "every halo ... another copy of every nearby pose", Online-Arc NET-SMOOTH 2 and SCALE2b, `online.js`'s header item 2 and its A5 comment left above the new one, World-Bosses' "cut everywhere" | FIXED: each sentence put right where it stands |
| D11 | LOW | `haloPoseDue`'s fall arm was unreachable: the world's pose never carries `dd` (`sendDeath` does, past the law). Lane C read `world.js`'s `...(_deadMark ? { dd: _deadMark } : {})` as the world pose - it is the party pose's | FIXED: the arm removed, and a fall named `sendDeath`'s |
| D12 | LOW | "PERF-ON4 measured about 19 us a message" - a derivation | FIXED: said as one |
| D13 | LOW | The moved pins of MWBODY1 and the boat marker, and SCALE2b's re-aimed record, went unrecorded | FIXED: both records name them |
| D14 | LOW | `gateCrowd.js`'s "this count is taken from those" pointed at the players past the distance | FIXED |
| D15 | LOW | The PR said 2,273 cite anchors; the tree has 2,159 (the larger figure was taken mid-merge) | FIXED in the PR |
| D16 | - | The probe's `sync` milliseconds did not reproduce to the digit | NOT A DEFECT: relative only, as the record says |

Found by the suite while the lanes read, and fixed before they reported: `online.haloWhole = ...` had landed between
`caravanVisitLink.close()` and `if (!key)`, which WAGONS2-VISIT pins adjacent (CI's shard 3, `87923aa2`). And main moved
twice under the branch (two merges, the indexes' conflicts each time).

## Re-measured

Both probes after the fixes: the same counts - PEER-RANGE 229.7 -> 59.0 GL calls and 60 -> 10 draws a frame at 60 players
with 10 near; HALO-THIN 4.00 -> 1.16 copies of each pose walking past a corner. None of the fixes moves a moving player's
halo poses; the new arms answer the windows lane B found.

## Pins

`test/systems/peerrange.test.js` 8 -> 10, `tools/mutants/peerrange.json` 29 -> 42 dead; `test/net/halothin.test.js` 6 -> 11,
`tools/mutants/halothin.json` 21 -> 32 dead (the fall's record retired with its arm; the zone's with its term). Moved: the
INVIS-NET, MWBODY1, OW-PEERS (`fb1001_overworld`) and INVIS-LOOK sync pins (the room's list beside the cut list) -
their own lists run again, OW-PEERS' and INVIS-LOOK's 43 dead. The whole suite on the fixed tree: 25,666 tests, its two
failures those two pins, moved. The 22 records of other arcs within three lines of
an edit - GATE-CROWD's, SCALE2b's, RELAY-H1's, WAGONS2-VISIT's, SLAM9's and SLAM15's among them - run again, 22 dead.
