import fs from 'node:fs';
const edits = [
  ['bible/03-World/Tamriel.md',
   "**Not done, and why.** No ship berths at a particular pier: a packet lands at the harbour slice's roadstead, as every\nharbour's does.",
   "**AUDIT BAY-LEFT F1 - the bake's city off its law** (2026-10-27, `01-Overview/audits/Audit-Left-In-The-Bay.md`). The\nbake classed all 625 of the span's slices mixed, so every cell flood ran each of them through the kernel (11-13 ms a\nslice: the samples, the flatten, `capitalSeaGround`), and kept nothing past an eviction: a promote at the Waterfront\nwaited 17.5 s on a fresh bake, 8.3 s at (2058, 664) and 23 s at the span's north edge (2069, 646). Now:\n- `world/tamrielWatersBake.js` rumareWaterSampler reads the plan's law at every vertex (`world/rumareWaters.js`\n  rumareSeaGrid - capitalSeaGround's own arithmetic, the city found once a slice) but the span's outer edge, where the\n  plain sampler answers as the kernel does there. On the freeware: the kernel's answer at every vertex of all 625\n  slices, and the same coarse and fine bits (0 differences).\n- rumareClass: a slice wholly inside City Isle's shore or wholly past the far shore clear of the mouth is LAND with no\n  vertex asked (rumareSliceAllLand, a metre's margin either side); else its grid's all-land, all-sea or MIXED. The bake\n  keeps each slice's class and bits for its life (the constructor's cityBits memo), a mixed slice's grid packed until\n  both its bit sets are made.\n- `world/imperialCity.js` imperialLand: the Prison's and the University's centres made once a plan (landCompounds).\n- After: 1.0 s the first promote at the Waterfront (the lake's cell, once a bake), 36-137 ms the others; a cell flooded\n  again after an eviction 54 ms (6.4 s before).\n\n**Not done, and why.** No ship berths at a particular pier: a packet lands at the harbour slice's roadstead, as every\nharbour's does."],
  ['bible/03-World/Tamriel.md',
   "- `test/world/rumarewater.test.js` (11): the plan's mouth;",
   "- `test/world/rumarewater.test.js` (13): AUDIT BAY-LEFT F1's two (the sampler the kernel's on 11 slices, the classes,\n  the all-land slices, the memo kept past an eviction; imperialLand's compounds at the University's corner); the plan's mouth;"],
  ['bible/03-World/Tamriel.md',
   "- Mutants: `tools/mutants/rumarewater.json` (42, all dead).",
   "- Mutants: `tools/mutants/rumarewater.json` (49: 47 dead, and AUDIT BAY-LEFT F1's RW-F1-the-all-land-test-unread and\n  RW-F1-the-outer-edge-the-law's equivalent - the first a fast path the grid answers the same, the second the outer edge's\n  law and kernel agreeing on the freeware's span - recorded `equivalent`)."],
  ['bible/03-World/Town-Shapes.md',
   "DEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): the mod paves its rect's padding square and whole; the outline's\nring (TS2) is blended where it runs at an angle. Tests `test/world/terrain/townring.test.js` (3, its last on ARENA2: both\ntowns' rings painted whole, their angled edges blended). Mutants `tools/mutants/townring.json` (8, all dead).",
   "**AUDIT BAY-LEFT F2 - the half tiles past the Bay** (2026-10-27, `01-Overview/audits/Audit-Left-In-The-Bay.md`). A pixel\npast the Bay takes VOYAGER2's curved painter (`world/road/roadCurves.js` paintCurvedPaths), whose ring pass paved the\nring's whole tiles alone, and the straight pass after it is handed no road: on three pixels past the Bay 2 of 72 half\ntiles were laid, 72 of 72 on the Bay. The ring pass now lays them as `roadPainter.js` paintPath does - the diagonal's own\nedge by the ground, turned by RING_HALF, never over the sea - and RING_HALF's home is `roadCurves.js`, both painters\nreading it. After: 72 of 72 past the Bay.\n\nDEPARTURE (named; Port-Ledger section A, TOWN-SHAPES): the mod paves its rect's padding square and whole; the outline's\nring (TS2) is blended where it runs at an angle. Tests `test/world/terrain/townring.test.js` (4, its last on ARENA2: both\ntowns' rings painted whole, their angled edges blended, and a third built on a pixel truly past the Bay with the roads\nlayer's road, its half tiles every one its code's; F2's synthetic case the curved painter's ring tiles the Bay painter's\nbytes for every code - grass, dirt, the sea). Mutants `tools/mutants/townring.json` (11, all dead). PIN MOVED (F2): the\nARENA2 case's \"past the Bay\" city had stood on Gothway Garden's own Bay pixel, so the curved painter never ran;\nTS9-notch-turned's file is `roadCurves.js` now and `audittesa3e1.json`'s E1-1-the-curved-ring-paves-the-sea re-aimed by\ncontent (dead)."],
  ['bible/03-World/Town-Shapes.md',
   "- Measured again: 0 of the 373 on a painted road, every one of them still placed.\n",
   "- Measured again: 0 of the 373 on a painted road, every one of them still placed.\n- **AUDIT BAY-LEFT F3 - the key through the fabric** (2026-10-27, `01-Overview/audits/Audit-Left-In-The-Bay.md`): the\n  pixel build wraps the walk shut in URBANIZER U3's (`world/urban/townFabricStand.js` fabricWalkShut), a new function\n  that carried no `key`, so the memo read 'shut' whatever the roads and kept the yards placed before them - on the Bay\n  and past it. The wrapper's key is now the town's shut's and whether its fabric stands, read when asked.\n"],
  ['bible/03-World/Town-Shapes.md',
   "Tests `test/world/townpaths.test.js`\n(5, its last on ARENA2). Mutants `tools/mutants/townpaths.json` (8, all dead).",
   "Tests `test/world/townpaths.test.js`\n(6, its last on ARENA2; F3's the fabric's key moving with its roads). Mutants `tools/mutants/townpaths.json` (10, all dead)."],
];
const files = new Map();
for (const [f, a, b] of edits) {
  const s = files.get(f) ?? fs.readFileSync(f, 'utf8');
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`needle x${n} in ${f}: ${a.slice(0, 80)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) fs.writeFileSync(f, s);
console.log('applied', edits.length);
