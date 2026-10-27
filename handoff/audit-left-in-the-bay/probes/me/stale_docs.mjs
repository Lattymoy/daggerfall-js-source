import fs from 'node:fs';
const edits = [
  ['bible/03-World/World-Wide.md',
   "The law: a crime on the road is charged to `maps.getRegionIndexAt`'s region, 0 past the Bay (`caravanHost.js` report,\n`relations.js reportOk`'s 0..61), so a robbery's tale past the Bay is told where the law charges it - the owner's call\non the provinces as regions (decision 5).",
   "The law: a crime on the road is charged to `maps.getRegionIndexAt`'s region (`caravanHost.js` report, `relations.js\nreportOk`'s 0..70) - past the Bay its province's since WW-R (`tamrielGround.js` groundPoliticIndex), so a robbery's tale\npast the Bay is told where the law charges it, the owner's call on the provinces as regions (decision 5)."],
  ['bible/03-World/World-Wide.md',
   "- **Deep Waters** (the sea floor's bake) is the Bay's - WOODS.WLD's own bathymetry; past the Bay a ship's draft is the\n  streamed water's.\n",
   ""],
  ['bible/03-World/World-Wide.md',
   "- The town-bound books (above) and the seats (`townSeatLaw.js seatRegionOk`), the homes (`homeLaw.js`), the town economy\n  (`townEconLaw.js`) - their towns are the Bay's until WW7 stands the world's towns past it.\n",
   ""],
  ['bible/03-World/World-Wide.md',
   "### What stays the Bay's (recorded)\n\n- A Motherlode's site is a pixel the Watch can vouch for (`net/watchReceipt.js watchPixelOk` - the Bay's map), so the\n  Motherlodes stay the Bay's until the Watch walks past it (WW7).\n- A region's Court writs and its chapters' hall writs are a town's books (`bayRegionOk`), the Bay's until WW7.\n\n",
   ""],
  ['bible/03-World/World-Wide.md',
   "the Bay's) - a guild's castle past the Bay is its halls without a court; the capitals' quests (none of the Bay's quest\n  places resolve there).",
   "the Bay's) - a guild's castle past the Bay is its halls without a court."],
  ['bible/03-World/Tamriel.md',
   "`byteAt` for the pixels past the map. World of Daggerfall's picks and Deep Waters' promotions are held to the Bay.",
   "`byteAt` for the pixels past the map. World of Daggerfall's picks are held to the Bay; Deep Waters promotes past it on\n  its own bake (TAMRIEL-DEEP, `03-World/Deep-Waters.md`)."],
  ['bible/03-World/Tamriel.md',
   "- **Readings, honest.** The region past the Bay reads as `getRegionIndexAt`'s clamp (0, the Alik'r Desert) - DFU's own\n  clamp, kept; weather, quests and factions key on it and see the Alik'r. Online",
   "- **Readings, honest.** The region past the Bay is its province's (WW-R, `03-World/World-Wide.md`: regions 62..70 off\n  `tamrielGround.js` groundPoliticIndex - DFU's clamp kept for the pixels the table has no region for); the weather keys\n  on the climate, quests and the law on the province's region. Online"],
  ['bible/03-World/Tamriel.md',
   "The sea past the Bay is the kernel's own water tiles (Deep Waters' bathymetry is the Bay's) - TAMRIEL-DEEP (2026-10-26, `03-World/Deep-Waters.md`): carved by a bake of its own now, the Bay's law on the continent's frame.",
   "The sea past the Bay is carved by a bake of its own, the Bay's law on the continent's frame (TAMRIEL-DEEP, 2026-10-26,\n  `03-World/Deep-Waters.md`)."],
  ['bible/03-World/Arena-Provinces.md',
   "its port byte is 0.",
   "its port byte is its place's (TESA6: `arenaLocations.js` portTownAndUnknown 1 for a port)."],
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
