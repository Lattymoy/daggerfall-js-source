// TS10: the walk shut's key, as townWalkShut makes it and as pixelBuild hands it on (fabricWalkShut over it)
import { imp } from './setup.mjs';
const { townWalkShut } = await imp('src/world/townWalls.js');
const { fabricWalkShut } = await imp('src/world/urban/townFabricStand.js');
const loc = { mapTableData: { mapId: 1 }, exterior: { exteriorData: { width: 2, height: 2, blockNames: [] } } };
const paths = new Uint8Array(128 * 128); paths[5000] = 1;
const a = townWalkShut(loc, null, null), b = townWalkShut(loc, null, paths);
console.log('townWalkShut keys (roadless, roads landed):', a.key, '|', b.key);
const fa = fabricWalkShut(a, loc), fb = fabricWalkShut(b, loc);
console.log('as pixelBuild hands them to townPlacesFor:', fa.key, '|', fb.key);
const sig = (shut) => `${shut?.key ?? (shut ? 'shut' : '')}`;
console.log('townPlacesFor sig tail, roadless vs roads landed:', sig(fa), 'vs', sig(fb), '-> memo kept:', sig(fa) === sig(fb));
