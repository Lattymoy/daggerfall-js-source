// AUDIT RELEASE R2 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md): THE BAY-ONLY ASSUMPTIONS PAST THE BAY - the
// owner: "ensure everything is perfect and that everything is covered for a smooth release that expands our world
// seamlessly". Each pin is the finding's own: it fails on the head before its fix, and on its mutants
// (tools/mutants/auditrelease_r2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validStaffDestination, validStaffTeleportIn, validStaffTeleportOut, notePlace } from '../../src/net/staffTeleport.js';
import { parseClient, egSite, validEgIn, WORLD_PIXEL_BOUND, validOwIn, validOwOut, SOCIAL_ROOM, RELAY_VERSION, worldRoom, relaySupportsWorldWide } from '../../src/net/wire.js';
import { validEgArchWord, egArchSite } from '../../src/scenes/eliteGates/egArch.js';
import { CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, setTamrielFit, inBay } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { owFoldGraves, newOwLedger } from '../../src/net/overworldLaw.js';
import { GRAVE_LOC_RE } from '../../src/scenes/searchPartyHost.js';
import { OnlineSession, bayMapPixel } from '../../src/net/online.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { createQuestWorld } from '../../src/scenes/questWorld.js';
import { TopicTree, QUESTION_TYPE } from '../../src/systems/topicTree.js';
import { MapsFile } from '../../src/formats/mapsFile.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';
import { codeOnly } from '../codeOnly.mjs';

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite

/** A capital's map pixel past the Bay (the authored fit): Solitude north of the Bay's top edge, the Imperial City east of
 *  its right edge, Alinor west of its left edge and south of its bottom - each axis past the Bay's 0..999 x 0..499 once. */
const at = (name) => { const c = CITIES.find((x) => x.name === name); const [x, y] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { x, y }; };
const SOLITUDE = at('Solitude'), IMPERIAL = at('Imperial City'), ALINOR = at('Alinor');

test('R2 the probes stand past the Bay: Solitude north of it, the Imperial City east, Alinor west and south', () => {
  for (const p of [SOLITUDE, IMPERIAL, ALINOR]) assert.equal(inBay(p.x, p.y), false);
  assert.ok(SOLITUDE.y < 0 && IMPERIAL.x >= 1000 && ALINOR.x < 0 && ALINOR.y >= 500);
});

test('R2-1 staff /tp reaches a player past the Bay: a destination there is lossless on the client and through the relay\'s projection both ways, and a where note there is placed (mutants: the Bay\'s 0..999 x 0..499 again; the bound past the wire\'s)', () => {
  for (const pixel of [SOLITUDE, IMPERIAL, ALINOR]) {
    const ext = { kind: 'exterior', pixel, pos: [pixel.x * 32768 + 12.5, 40.25, (499 - pixel.y) * 32768 + 7.75], yaw: 0.5, pitch: -0.1 };
    assert.deepEqual(validStaffDestination(ext), ext, `${pixel.x},${pixel.y}`);
    const dungeon = { ...ext, kind: 'dungeon', mapId: 500123 };
    assert.deepEqual(validStaffDestination(dungeon), dungeon);
    // the target's game answers through the relay (wire.js parseClient -> validStaffTeleportIn), and the hub's result reaches the asker
    assert.deepEqual(parseClient(JSON.stringify({ t: 'stp', k: 'answer', ticket: 'ticket-one', dest: ext }), { hasHello: true }), { t: 'stp', k: 'answer', ticket: 'ticket-one', dest: ext });
    assert.deepEqual(validStaffTeleportIn({ k: 'answer', ticket: 't1', dest: ext }), { k: 'answer', ticket: 't1', dest: ext });
    assert.deepEqual(validStaffTeleportOut({ k: 'result', nonce: 'n1', id: 'peer-a', name: 'Bran', dest: ext }), { k: 'result', nonce: 'n1', id: 'peer-a', name: 'Bran', dest: ext });
    // a where note past the Bay is a place (STAFF-PANEL5-FOLLOW: before, "a pixel off the map" - their game asked, and it said unavailable)
    assert.deepEqual(notePlace({ px: pixel.x, py: pixel.y, in: 0, wx: ext.pos[0], wy: ext.pos[1], wz: ext.pos[2] }), { kind: 'exterior', pixel, pos: ext.pos, yaw: 0, pitch: 0 });
    assert.deepEqual(notePlace({ px: pixel.x, py: pixel.y, in: 1, rk: 'dungeon:m500123' }), { kind: 'dungeon', pixel, yaw: 0, pitch: 0, mapId: 500123, whole: true, pos: null });
  }
  const ext = { kind: 'exterior', pixel: { x: 0, y: 0 }, pos: [1, 2, 3], yaw: 0, pitch: 0 };
  assert.deepEqual(validStaffDestination({ ...ext, pixel: { x: 1 - WORLD_PIXEL_BOUND, y: WORLD_PIXEL_BOUND - 1 } })?.pixel, { x: 1 - WORLD_PIXEL_BOUND, y: WORLD_PIXEL_BOUND - 1 }, 'the wire\'s whole grid');
  for (const pixel of [{ x: WORLD_PIXEL_BOUND, y: 0 }, { x: 0, y: -WORLD_PIXEL_BOUND }]) assert.equal(validStaffDestination({ ...ext, pixel }), null, 'past the wire\'s grid');
});

test('R2-2 an Elite Breach\'s arch past the Bay: its site is a site, so the open leaves the client (validEgIn), the relay keeps it (parseClient) and every member stands it (validEgArchWord) - the key is no longer staked for a word that is never sent (mutants: the Bay\'s bounds on the site, either axis)', () => {
  for (const p of [SOLITUDE, IMPERIAL, ALINOR]) {
    const site = egArchSite([p.x * 819.2 + 409.6, 12, 380.25], 1.5, p.x, p.y, [p.x * 819.2, 0, 0]);
    assert.deepEqual(site, { px: p.x, py: p.y, x: 409.6, y: 12, z: 380.25, yaw: 1.5 });
    assert.deepEqual(egSite(site), site, `${p.x},${p.y}`);
    assert.deepEqual(validEgIn({ k: 'open', z: 'v1.abc.def', site }), { k: 'open', z: 'v1.abc.def', site });
    assert.deepEqual(parseClient(JSON.stringify({ t: 'eg', k: 'open', z: 'v1.abc.def', site }), { hasHello: true }), { t: 'eg', k: 'open', z: 'v1.abc.def', site });
    const word = { b: '0123456789abcdef', o: 'Mac', os: 'acct-mac', op: 1_800_000_000_000, ew: 0, site, sg: 'a'.repeat(86) };
    assert.deepEqual(validEgArchWord(word), word);
  }
  const site = { px: 0, py: 0, x: 1, y: 2, z: 3, yaw: 0 };
  for (const [px, py] of [[WORLD_PIXEL_BOUND, 0], [0, -WORLD_PIXEL_BOUND], [1.5, 0], ['1', 0]]) assert.equal(egSite({ ...site, px, py }), null, `${px},${py}`);
  // the client's door: the host's facts (scenes/world.js egKeyFacts) name the site egArchSite makes, at any pixel - the wire's law is the one bound
  assert.match(codeOnly(readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8')), /site: at\.at && Number\.isSafeInteger\(px\?\.x\) \? egArchSite\(at\.at, at\.yaw, px\.x, px\.y, state\.pixelTranslation\(px\.x, px\.y\)\) : null/);
});

test('R2-3 a headstone past the Bay is owed to its cell and locked for the party: its place `g<px>,<py>` reads back to the world\'s pixel, the word leaves the client (validOwIn), the cell folds it into its ledger (owFoldGraves) and says it back (validOwOut) - GRAVE-PARTY\'s own field bug, past the Bay (mutants: the Bay\'s three digits in the place; the Bay\'s bounds on the row)', () => {
  const M = 1_000_000;
  for (const p of [SOLITUDE, IMPERIAL, ALINOR]) {
    const m = GRAVE_LOC_RE.exec(`g${p.x},${p.y}`);
    assert.ok(m, `g${p.x},${p.y}`);
    assert.deepEqual([Number(m[1]), Number(m[2])], [p.x, p.y]);
    const row = [p.x, p.y, 3];
    assert.deepEqual(validOwIn({ k: 'gr', rows: [row] }), { k: 'gr', rows: [row] });
    assert.deepEqual(parseClient(JSON.stringify({ t: 'ow', k: 'gr', rows: [row] }), { hasHello: true })?.rows, [row]);
    const led = newOwLedger();
    const taken = owFoldGraves(led, [row], 'acct-ann', M, 'Ann');
    assert.deepEqual(taken, [[p.x, p.y, 3, M, 'acct-ann', 'Ann']], 'the cell keeps the stone');
    assert.deepEqual(validOwOut({ k: 'gr', rows: taken }), { k: 'gr', rows: taken }, 'and says it to the party');
  }
  assert.equal(GRAVE_LOC_RE.exec('g101,207')?.slice(1).join(','), '101,207', 'a Bay stone as it was');
  for (const loc of ['g12345,0', 'g1.5,0', 'gx,0', 'g101,207,1']) assert.equal(GRAVE_LOC_RE.exec(loc), null, loc);
  assert.match(codeOnly(readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8')), /loc: `g\$\{p\.px\},\$\{p\.py\}`/, 'the stone\'s place is its pixel, as the host writes it');
});

test('R2 THE OLDER RELAY: a word naming a pixel past the Bay goes only to a relay that reads one (relaySupportsWorldWide) - before it, the relay closes the socket on it: the staff answer says `unavailable`, the arch is refused before its key is staked, the headstone past the Bay is not said; a Bay pixel goes to both (mutants: the gate unasked, each door)', () => {
  assert.equal(relaySupportsWorldWide('world259'), false);
  assert.equal(relaySupportsWorldWide(RELAY_VERSION), true);
  assert.deepEqual([bayMapPixel(0, 0), bayMapPixel(999, 499), bayMapPixel(1000, 0), bayMapPixel(0, -1), bayMapPixel(1.5, 0)], [true, true, false, false, false]);
  const BAY = { x: 207, y: 213 };
  const extAt = (pixel) => ({ kind: 'exterior', pixel, pos: [1, 2, 3], yaw: 0, pitch: 0 });
  const siteAt = (p) => ({ px: p.x, py: p.y, x: 409.6, y: 12, z: 380.25, yaw: 1.5 });
  for (const [v, world] of [['world259', false], [RELAY_VERSION, true]]) {
    // the hub: the staff answer and the arch
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Bran', id: 'peer-bran', secret: 'secret-bran', WebSocketImpl: FakeWS, presence: false });
    s.join(SOCIAL_ROOM); const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'peer-bran', peers: [], n: 1, v });
    assert.equal(s.worldPixelsOk, world, v);
    const sent = () => ws.sent.map((x) => JSON.parse(x));
    assert.equal(s.sendStaffTeleport({ k: 'answer', ticket: 'tk-bay', dest: extAt(BAY) }), true);
    assert.deepEqual(sent().at(-1), { t: 'stp', k: 'answer', ticket: 'tk-bay', dest: extAt(BAY) }, 'a Bay destination to every relay');
    assert.equal(s.sendStaffTeleport({ k: 'answer', ticket: 'tk-far', dest: extAt(SOLITUDE) }), true);
    assert.deepEqual(sent().at(-1), world ? { t: 'stp', k: 'answer', ticket: 'tk-far', dest: extAt(SOLITUDE) } : { t: 'stp', k: 'answer', ticket: 'tk-far', error: 'unavailable' }, `${v}: past the Bay`);
    assert.equal(s.egSiteOk(siteAt(BAY)), true);
    assert.equal(s.egSiteOk(siteAt(IMPERIAL)), world, `${v}: an arch past the Bay`);
    assert.equal(s.egSiteOk(null), false);
    const before = ws.sent.length;
    assert.equal(s.sendEg('open', { z: 'v1.abc.def', site: siteAt(IMPERIAL) }), world, `${v}: the open past the Bay`);
    assert.equal(ws.sent.length - before, world ? 1 : 0);
    s.leave();
    // the cell past the Bay: a headstone's row
    const c = fakeSocketClass();
    const cs = new OnlineSession({ url: 'wss://relay.test', name: 'Bran', id: 'peer-bran', secret: 'secret-bran', WebSocketImpl: c.FakeWS, presence: false });
    const room = worldRoom(ALINOR.x, ALINOR.y);
    cs.join(room); const cws = c.sockets[0]; cws.open();
    cws.receive({ t: 'welcome', id: 'peer-bran', peers: [], n: 1, v });
    assert.equal(cs.owGraveOk, true, `${v}: a relay that keeps the graves`);
    assert.deepEqual(cs.sendOverworld('gr', [[ALINOR.x, ALINOR.y, 3]]), world ? [[ALINOR.x, ALINOR.y, 3]] : [], `${v}: a headstone past the Bay`);
    assert.equal(c.sockets[0].sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'ow').length, world ? 1 : 0);
    cs.leave();
  }
  // the key's refusal asks the hub before the key is staked (scenes/eliteGates/egClient.js openRefusal)
  assert.match(codeOnly(readFileSync(new URL('../../src/scenes/eliteGates/egClient.js', import.meta.url), 'utf8')), /room: f \? !!f\.site && \(hub\(\)\?\.egSiteOk\?\.\(f\.site\) \?\? true\) : true/);
});

test('R2-4 the quest layer\'s region name past the Bay is its province\'s (WW-R): an NPC past the Bay knows a quest\'s place and person there - the site names the province (scenes/tamrielPlacesHost.js), and the region\'s name had been \'\' - and "Where am I?" in a lair names it; on the Bay the loaded region\'s, an empty region\'s \'\' as DFU\'s (mutants: the province unnamed; every region named)', () => {
  let r = 64;
  const maps = Object.create(MapsFile.prototype);
  maps.getRegion = (i) => (i === 17 ? { name: 'Daggerfall' } : null);   // MAPS.BSA holds the Bay's; a province's region none, as an empty Bay region's
  const { questWorld } = createQuestWorld({ maps, _questRegionIndex: () => r, params: new URLSearchParams() });
  assert.equal(questWorld.currentRegionName(), 'Skyrim');
  for (r = 62; r <= 70; r++) assert.equal(questWorld.currentRegionName(), REGION_NAMES[r], `region ${r}`);
  r = 17; assert.equal(questWorld.currentRegionName(), 'Daggerfall', 'the Bay\'s loaded region');
  r = 9; assert.equal(questWorld.currentRegionName(), '', 'an empty Bay region: DFU\'s empty DFRegion');
  // the clone past the Bay names its province's region (the host's `where`), and the talk's gate compares the two
  assert.match(codeOnly(readFileSync(new URL('../../src/scenes/tamrielPlacesHost.js', import.meta.url), 'utf8')), /regionIndex, regionName: REGION_NAMES\[regionIndex\], politic: 128 \+ regionIndex/);
  r = 64;
  const place = { siteDetails: { regionName: REGION_NAMES[64], locationName: 'Whiterun' } };
  const person = { homeRegionIndex: 64, homeRegionName: REGION_NAMES[64] };
  const quest = { getResource: ({ name }) => (name === 'place' ? place : person) };
  const tree = new TopicTree({ getQuest: () => quest, currentRegionName: () => questWorld.currentRegionName() });
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic({ questID: 1, key: 'place', questionType: QUESTION_TYPE.QuestLocation }), true, 'a place past the Bay, asked past the Bay');
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic({ questID: 1, key: 'person', questionType: QUESTION_TYPE.QuestPerson }), true, 'a person past the Bay');
  r = 17;
  assert.equal(tree.checkNPCcanKnowAboutTellMeAboutTopic({ questID: 1, key: 'place', questionType: QUESTION_TYPE.QuestLocation }), false, 'asked in Daggerfall, a place in Skyrim is unknown');
});
