// D2 verification, the other half: the enhanced lane's SNOW COVER (scenes/snowCoverHost.js over systems/weather/snowpack.js
// and the air law's map, systems/weather/airGround.js lawAirGround - the world host's own wiring) past the Bay in winter.
import { setup, imp } from './base.mjs';
const { maps, woods } = await setup();
const { lawAirGround } = await imp('systems/weather/airGround.js');
const { setAirGround, airGround } = await imp('systems/weather/airTemperature.js');
const { SnowpackLattice, snowlineOf, coverAtHeight, SNOWPACK, cornerField } = await imp('systems/weather/snowpack.js');
const { landformClimates } = await imp('world/landforms.js');
const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
setAirGround(lawAirGround({ woods, maps, landforms: true, climates: () => climates }));
const lat = new SnowpackLattice({ climateAt: (x, y) => maps.getClimateIndex(x, y), spacing: 2 });
const YEAR = 360 * 1440, t = 405 * YEAR + 35 * 1440 + 8 * 60;   // day 35 of 3E 405, 08:00 - deep winter (the coldest day is 20)
const places = { 'Whiterun (Skyrim tundra)': [1891, -202], 'Windhelm (Skyrim)': [2294, -481], 'Dawnstar (Frozen Coast)': [1829, -543], 'Daggerfall (Bay)': [207, 213], 'Wrothgarian Mts (Bay)': [560, 120] };
const pts = Object.entries(places).map(([n, [px, py]]) => { const [i, j] = lat.indexOf(px, py); return { n, px, py, pt: lat.point(i, j, t) }; });
const t0 = Date.now();
const done = lat.advance(pts.map((p) => p.pt), t);
console.log('advanced', done, (Date.now() - t0) + ' ms');
for (const p of pts) {
  const swe = lat.packNow(p.pt, t), line = snowlineOf(swe, [0, 0, 0], p.pt.n);
  const [x, z] = cornerField(p.pt.i * 2, p.pt.j * 2), h = airGround().groundAt(x, z);
  console.log(p.n.padEnd(26), 'ground', h.toFixed(0), 'm', 'snowline h50', line[1].toFixed(0), 'm', 'cover', coverAtHeight(line, h).toFixed(2), 'swe@lowest', swe[0].toFixed(1));
}
