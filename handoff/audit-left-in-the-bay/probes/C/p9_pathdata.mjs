// C probe 9: Travel Options' path reads past the Bay (world/road/pathData.js - the follow key, the junction map's paths,
// the host's travellerOnRoad): a network whose every byte is a road, read on the Bay and past it.
import { imp } from './setup.mjs';
const { pathsDataPoint, roadsDataPoint } = await imp('world/road/pathData.js');
const all = new Uint8Array(1000 * 500).fill(0xff);
const net = { roads: all, tracks: all, rivers: null, streams: null };
for (const [x, y] of [[500, 250], [999, 499], [1000, 250], [1569, -430], [1820, -300], [-200, 300]]) console.log(`(${x},${y}) paths=${pathsDataPoint(net, x, y)} roads=${roadsDataPoint(net, x, y)}`);
const { drawMapSection } = await imp('ui/travel/travelPathsOverlay.js');
const buf = new Uint32Array(100 * 100); let asked = 0;
drawMapSection(buf, { originX: 1560, originY: -440, width: 20, height: 20 }, { pathsAt: () => { asked++; return 0xff; }, locationAt: () => null, colorOf: () => null });
console.log('junction map section at Solitude: pathsAt asked', asked, 'times; texels lit', buf.filter((v) => v).length);
