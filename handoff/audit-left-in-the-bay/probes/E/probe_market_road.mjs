// LANE E probe: the market's courier knows no road to or from a province region (62..70).
// The client's marketHubs is built exactly as scenes/world.js builds it: pickRegionHubs over MAPS.BSA's own rows
// (the boot loop's _hubRows), then { [regionIndex]: [x, y] }. The service is the real Worker over node:sqlite.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = '/home/user/daggerfall-js-source';
const A2 = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
const bytes = (n) => new Uint8Array(readFileSync(join(A2, n)));
const { MapsFile, longitudeLatitudeToMapPixel } = await import(`${R}/src/formats/mapsFile.js`);
const { pickRegionHubs } = await import(`${R}/src/systems/region/regionHubs.js`);
const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
const hubRows = [];
for (let r = 0; r < maps.regionCount; r++) {
  const region = maps.getRegion(r); if (!region) continue;
  const base = maps.baseLocationCount(r);
  for (let l = 0; l < region.locationCount; l++) {
    const loc = maps.getLocation(r, l);
    if (!loc || !loc.exterior || !loc.exterior.exteriorData) continue;
    if (l < base) hubRows.push(loc);
  }
}
const regionHubs = pickRegionHubs(hubRows, { regionNameOf: (r) => maps.getRegionName(r) });
const marketHubs = Object.fromEntries([...regionHubs.byRegion.values()].map((h) => [h.regionIndex, [h.pixel.x, h.pixel.y]]));
const keys = Object.keys(marketHubs).map(Number);
console.log('maps.regionCount', maps.regionCount, '| hubs derived', keys.length, '| max region with a hub', Math.max(...keys), '| any province (62..70) hub:', keys.some((k) => k >= 62));

const { standService, T0 } = await import(`${R}/test/accountDb.mjs`);
Date.now = () => T0 * 1000;
const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
const raw = s.env.DB._raw;
const fund = (who, m) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, m);
const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
let n = 0; const rid = () => `prb-${String(++n).padStart(6, '0')}`;
const mac = await s.registered('Mac'); const ann = await s.registered('Ann');
fund(mac, 5000); fund(ann, 5000); give(ann, 'ore:mithril', 'own', 100);
const DF = 17, SKYRIM = 64, WAYREST = 23;
const order = (await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ore:mithril', units: 200, price: 8, hubs: marketHubs, rid: rid() }, mac.secret)).body.order;
console.log('a buy order posted in Daggerfall (17):', !!order?.id);
const fillFrom = async (region) => (await s.call('/v1/market/fill', { character: ann.character, region, order: order.id, units: 40, hubs: marketHubs, rid: rid() }, ann.secret)).body;
const w = await fillFrom(WAYREST);
console.log('fill from Wayrest (23):', w.error ?? `ok, courier ${w.fill?.courier}`);
console.log('fill from Skyrim (64), a board in Solitude:', JSON.stringify(await fillFrom(SKYRIM)));
const read = (await s.call('/v1/market/read', { character: ann.character, region: SKYRIM, view: 'orders', hubs: marketHubs }, ann.secret)).body;
console.log('Orders view read at a board in Skyrim - the Daggerfall order\'s road:', JSON.stringify(read.orders?.map((o) => [o.region, o.road])));
// the other way: a listing made at a board in Skyrim, bought from Daggerfall
give(ann, 'metal:iron', 'own', 50);
const sk = await s.call('/v1/market/list', { character: ann.character, region: SKYRIM, kind: 'material', material: 'metal:iron', units: 10, price: 5, hubs: marketHubs, rid: rid() }, ann.secret);
console.log('a listing made at a board in Skyrim (64):', sk.status, sk.body?.listing?.id ? 'listed' : JSON.stringify(sk.body));
if (sk.body?.listing?.id) {
  const b = await s.call('/v1/market/buy', { character: mac.character, region: DF, listing: sk.body.listing.id, units: 5, max: 100_000, hubs: marketHubs, rid: rid() }, mac.secret);
  console.log('bought from a board in Daggerfall (17):', JSON.stringify(b.body.error ? b.body : { ok: true }));
}
