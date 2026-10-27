// C probe 3: the held map reads its marks against `this._size` (ui/heldMap.js: deps.mapSize ?? MAP_WIDTH x MAP_HEIGHT -
// the world host hands no mapSize), so a mark past the Bay is dropped - where the gates, bounties, lairs and quests are
// read over the continent's frame (tamrielFrameInBay). Each reader run as heldMap.js runs it.
import { imp } from './setup.mjs';
const { readPartyMarks, readTravellerMarks } = await imp('ui/partyMapMarks.js');
const { readVendorMark } = await imp('ui/vendor/vendorMapMark.js');
const { readGateMark } = await imp('ui/gate/gateMapMark.js');
const { readBountyMarks, readBountyMarksIn } = await imp('ui/bounty/bountyMapMark.js');
const { MAP_WIDTH, MAP_HEIGHT } = await imp('formats/woodsFile.js');
const size = { width: MAP_WIDTH, height: MAP_HEIGHT };   // heldMap.js this._size with no deps.mapSize
const frame = { x0: -1500, y0: -1200, w: 5000, h: 4000 };   // a continent-sized box (tamrielFrameInBay's shape)
const solitude = { px: 1569, py: -430 }, whiterun = { px: 1820, py: -300 }, bayTown = { px: 500, py: 250 };
console.log('size', size);
const party = () => [{ acct: 'a', name: 'In Solitude', ...solitude }, { acct: 'b', name: 'In the Bay', ...bayTown }];
console.log('party marks kept:', readPartyMarks(party, size).map((m) => m.name));
const trav = () => [{ id: 'p1', name: 'Rider past the Bay', ...whiterun, fx: 0, fy: 0 }, { id: 'p2', name: 'Rider on the Bay', ...bayTown, fx: 0, fy: 0 }];
console.log('traveller marks kept:', readTravellerMarks(trav, size).map((m) => m.name));
console.log('vendor waypoint in Solitude:', readVendorMark(() => ({ ...solitude, label: 'Trader', town: 'Solitude' }), size));
console.log('serpent ring off Solitude (r 12):', readGateMark(() => ({ cx: solitude.px, cy: solitude.py, r: 12, label: 'Sea Serpent' }), size));
const lode = () => [{ cx: whiterun.px + 0.5, cy: whiterun.py + 0.5, r: 4, label: 'Motherlode' }];
console.log('Motherlode by Whiterun, read as heldMap reads lodes (readBountyMarks, _size):', readBountyMarks(lode, size).length, '- read as it reads bounties (readBountyMarksIn, the frame):', readBountyMarksIn(lode, frame).length);
