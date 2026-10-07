# AUDIT LANDFORMS - the landforms, audited before the merge, 2026-10-07

Mac: *"Dont worry about it. Instead let's do just an audit and ensure this is perfect"*, of LANDFORM1-3 (#655,
`03-World/Landforms.md`): the heightmap raised, the roads cut in, the rivers in channels, online too. Five lenses:

- **the law and the math, on the real data** - this session's own reading of `world/landforms.js` and the kernel,
  every claim re-measured on the freeware WOODS.WLD (`tools/fetch-data.sh`) and the vendored Basic Roads network;
- **every reader of the ground** (lane A), **the saves and the re-stand** (lane B), **online, the switch and the
  pipeline** (lane C), **the tests' honesty and the record** (lane D) - four independent adversarial reviewers, each
  reading a snapshot of the pushed head (`5ff49b36`, a detached worktree) so the fixes never moved under a verdict
  (Home.md, 17l).

Every finding was reproduced before it was fixed and is pinned by a test that fails on the code as it stood
(`test/auditlandforms.test.js`); the pins the fixes moved carry a `PIN MOVED` note. Mutation-proven:
`tools/mutants/auditlandforms.json`, and every older record the fixes moved re-aimed and killed again. Each fix carries
an `AUDIT LANDFORMS` comment.

## The law and the math, on the real data

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E2 | Major | **The painted water climbed out of its channel at every crossing.** A road's or a track's cut ran its whole reach - floor, bank and verge, up to 62 m from its centre line - and lerped after the rivers (paint order), so it refilled the channel it crossed or ran beside. The painter still paints the river's water up to the road's own tiles, so the water there lay on the road's fill: on the real WOODS.WLD 55,096 wet corners stood half a metre or more over their channel's floor, 23,692 of them 2 m or more, the worst 19 m, beside 629 river and stream pixels. | **A channel is the water's** (`landforms.js`, the shaper's lerp): where a sample lies in a river's or a stream's channel - 1 on its floor, falling to 0 up its bank - a road or a track stands there on its own bed alone, the causeway's top, and its bank and verge give way by as much. After: 11,191 corners over half a metre, the worst 7.9 m, every one a corner a water tile shares with the road's own bed (the one row of water against a causeway, which a heightfield cannot hold level); away from water the road's bank and verge are whole, as before. |
| E1 | Minor | **A road on a hillside stood on a level shelf 32 m wide.** The cross-section's top was `max(smoothLand, floor + drop)` for every layer - the river's levee rule. With a road's `drop` of 0 its low side was the floor itself the bank's whole width (2.5 samples), then a fill eased down over the verge: on the real data fills to 11-13 m beside a 13 m road. | **A road's or a track's bank runs to the smooth land on both sides** - cut up into the high side, filled down to the low side over the same width; a river's and a stream's low bank keep the levee. After: a fill's height median 0.3 m, worst 5.9 m (was 0.6 and 12.8 m); across the painted road it is still level to the float (tilt 0.00 m on 300 roads). |

Measured and holding (scratch scripts, nothing kept):
- **The knee** over 6,656,400 coastal samples and **the seams** over 38,700 shared edge samples: 0 violations, 0
  differ, with both fixes in.
- **The painted water of every river and stream pixel** (3,048): every wet corner over the coast fade lies on its
  channel's flat floor - bends, junctions, joins and mouths alike. A tile's corners differ only along a river's own
  course (the steepest, a river down a 47% slope, DFU's ground too).
- **The cost**, on the real network: a path-heavy pixel (20-32 arms in its 3 x 3) 12.7 -> 14.3 ms on the worker
  (+13%); a pixel with one arm near it 11.4 -> 12.0 ms (+5%).
- **The far ring** stands a pixel's byte at its centre with no large-heightmap term (EV8's own law): the streamed ground
  at a pixel's centre stands a median 213 m over the ring's vertex there with the row off, 212 m with it on. The lift
  scales that gap, it does not open one (the extremes widen with the relief, 726 -> 1,174 m). Not this slice's; named
  in Landforms.md's residues.

## The review lanes

Reported as they are verified, below.

## Pins

`test/auditlandforms.test.js` - E1, E2. `tools/mutants/auditlandforms.json` - E1 and E2's six, six dead. Re-aimed:
`landform.json` LANDFORM-no-levee (the levee is the water layers' arm of the new top) - 40 records, 39 dead, 1
equivalent as recorded. PIN MOVED: `test/landform.test.js`'s road bank, which compared the low side with the land and
passed the level shelf trivially - the bank now lies between the bed and the smooth land, up on the high side and down
on the low.
