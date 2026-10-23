// ETHER-WILD (2026-10-21) - THE ELTHERIC OCEAN AN OPEN PVP ZONE. The owner: "I want there to be more of a reason to
// venture into this zone. ... id also like to implement open pvp for this zone specifficaly and implement some of the
// wrothgarian mountain open pvp aspects into the procedural Islands".
//
// The sea past Veilhaven's peace stands the mountains' law (systems/wild/wildZone.js's live flag, read by every pool,
// fight, drop and name of the zone), its depth bands for the four rings - systems/wild/etherWild.js. Pinned here: the
// zone's extent and its rings to the pixel, the peace, the words by the ground, an isle's ruin read by its band, and the
// host's seams (scenes/world.js, scenes/dungeonContext.js) by source. bible/03-World/Eltheric-Ocean.md ETHER-WILD,
// bible/11-Multiplayer/Wild-Zone.md section 24.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ETHER_KIND, ETHER_PEACE_PX, etherInPeace, etherWildRingAt, etherRingName, wildRingAtPlace, ETHER_WILD_TEXT, etherRisePort, etherRiseSite, ETHER_RISE_PX } from '../../../src/systems/wild/etherWild.js';
import { setWildHere, wildHere, wildRing, wildZoneKind, zoneWord, zoneName, zoneRingName, setWildDeath, wildDeathLines, WILD_TEXT, WILD_KIND, WILD_NAME, wildRingLoot } from '../../../src/systems/wild/wildZone.js';
import { ETHER_BOX, VEIL_X, LEAGUE_PX, BANDS, veilhaven, landfall, ETHER_SEA_NAME } from '../../../src/world/ethericSea.js';
import { synthesizeEtherLocation } from '../../../src/world/etherPlaces.js';
import { crossingRows, questionRows, ROW_CHARS } from '../../../src/systems/naval/etherCrossing.js';
import { heldAtSide, packStaysAshore } from '../../../src/systems/naval/crewCompanions.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A pixel well north of Veilhaven, where only the depth decides. */
const FAR_Y = -3000;
/** The first whole pixel of a band, coming from the Veil: the easternmost x whose depth reaches its `from`. */
const bandEdgeX = (from) => Math.floor(VEIL_X - from * LEAGUE_PX);

test('ETHER-WILD: the zone is the sea\'s box past Veilhaven\'s peace - nothing outside the box, nothing in the Veil, nothing within twelve pixels of Veilhaven', () => {
  const h = veilhaven();
  assert.deepEqual([h.px, h.py], [8068, -5185], 'Veilhaven where the crossing has always made landfall');
  assert.equal(ETHER_PEACE_PX, 12);
  // the peace: Veilhaven, its landfall, the ring of twelve pixels about it
  assert.equal(etherWildRingAt(h.px, h.py), 0, 'Veilhaven itself');
  assert.equal(etherWildRingAt(landfall().px, landfall().py), 0, 'the landfall - a crossing never comes out into a fight');
  assert.equal(etherWildRingAt(h.px - 12, h.py), 0, 'twelve pixels west: still the peace');
  assert.equal(etherWildRingAt(h.px - 13, h.py), 1, 'thirteen: the Shallows, open');
  assert.equal(etherWildRingAt(h.px, h.py - 13), 1, 'thirteen north');
  assert.equal(etherWildRingAt(h.px - 8, h.py - 8), 0, 'on a diagonal, 11.3 px: the peace');
  assert.equal(etherWildRingAt(h.px - 9, h.py - 9), 1, '12.7 px on a diagonal: open - a circle, never a square (a square of twelve would hold it)');
  assert.equal(etherInPeace(h.px - 9, h.py - 8), false, '12.04 px: past the peace by a hair');
  // the Veil: the way home is never contested, the whole length of the sea
  assert.equal(etherWildRingAt(VEIL_X, FAR_Y), 0, 'the Veil\'s first pixel');
  assert.equal(etherWildRingAt(ETHER_BOX.x1 - 1, FAR_Y), 0, 'the Veil\'s last');
  assert.equal(etherWildRingAt(VEIL_X - 1, FAR_Y), 1, 'one pixel west of the Veil: open water');
  // outside the box: the Bay, the continent, past the world's edge
  for (const [x, y] of [[500, 250], [0, 0], [ETHER_BOX.x0 - 1, FAR_Y], [ETHER_BOX.x1, FAR_Y], [4000, ETHER_BOX.y0 - 1], [4000, ETHER_BOX.y1]]) {
    assert.equal(etherWildRingAt(x, y), 0, `${x},${y}`);
  }
  assert.equal(etherWildRingAt(ETHER_BOX.x0, ETHER_BOX.y0), 4, 'the box\'s far corner: the Abyss');
  for (const bad of [undefined, null, NaN, Infinity]) assert.equal(etherWildRingAt(bad, FAR_Y), 0, String(bad));
});

test('ETHER-WILD: the rings are the depth bands - the Shallows I, the Reaches II, the Deep Aether III, the Abyss IV - to the pixel at each band\'s edge, and their loot the mountains\' rings\' own', () => {
  assert.deepEqual(BANDS.map((b) => b.id), ['shallows', 'reaches', 'deep', 'abyss'], 'four bands for four rings');
  assert.deepEqual(BANDS.map((b) => b.from), [0, 12, 45, 140]);
  for (let i = 1; i < BANDS.length; i++) {
    const x = bandEdgeX(BANDS[i].from);
    assert.equal(etherWildRingAt(x, FAR_Y), i + 1, `${BANDS[i].id} at its edge (${x})`);
    assert.equal(etherWildRingAt(x + 1, FAR_Y), i, `${BANDS[i - 1].id} a pixel east of it`);
  }
  assert.deepEqual([bandEdgeX(12), bandEdgeX(45), bandEdgeX(140)], [8041, 7846, 7286], 'the edges, written down');
  assert.deepEqual([1, 2, 3, 4].map(wildRingLoot), [1.25, 1.5, 1.75, 2], 'the Shallows +25% ... the Abyss twice');
  assert.deepEqual([1, 2, 3, 4].map(etherRingName), ['The Shallows', 'The Reaches', 'The Deep Aether', 'The Abyss']);
  assert.equal(etherRingName(9), 'The Abyss', 'a ring past the four is the deepest - never paid less');
});

test('ETHER-WILD: the live flag carries its ground - the zone\'s words are the sea\'s there and the mountains\' everywhere else', () => {
  try {
    setWildHere(true, 2, ETHER_KIND);
    assert.equal(wildHere(), true);
    assert.equal(wildRing(), 2);
    assert.equal(wildZoneKind(), 'ether');
    assert.equal(`the ${zoneName()}`, ETHER_SEA_NAME, 'named as WILD_NAME is, its sentence bringing the "the"');
    assert.equal(zoneRingName(2), 'The Reaches');
    assert.equal(zoneWord('enter'), ETHER_WILD_TEXT.enter());
    assert.match(zoneWord('enter'), /Veilhaven's peace onto the open Eltheric Ocean, an open PvP zone/);
    assert.equal(zoneWord('ring')(4), 'The Abyss: +100% loot.');
    assert.equal(zoneWord('ringCross')(3, true), 'Deeper - The Deep Aether: +75% loot.');
    assert.equal(zoneWord('ringCross')(1, false), 'Back toward the Veil - The Shallows: +25% loot.');
    assert.match(zoneWord('chipTip'), /Eltheric Ocean past Veilhaven's peace/);
    // PIN MOVED (AUDIT SEA VENTURES C7): the truce is the sea's own now - a word the sea does not say its own way is still the mountains'
    assert.equal(zoneWord('truce'), ETHER_WILD_TEXT.truce());
    assert.equal(zoneWord('noFight'), WILD_TEXT.noFight, 'a word the sea does not say its own way is the mountains\'');
    assert.match(WILD_TEXT.companionStays('Bran'), /until you leave the Eltheric Ocean/, 'a companion held at my side says the sea');
    assert.equal(zoneWord('leave', ETHER_KIND), ETHER_WILD_TEXT.leave(), 'the words of the ground left, asked by name');
    // the mountains
    setWildHere(true, 1);
    assert.equal(wildZoneKind(), WILD_KIND, 'the mountains are the default ground');
    assert.equal(zoneName(), WILD_NAME);
    assert.equal(zoneRingName(1), 'The Foothills');
    assert.equal(zoneWord('enter'), WILD_TEXT.enter);
    assert.equal(zoneWord('ring')(1), WILD_TEXT.ring(1));
    assert.match(WILD_TEXT.companionStays('Bran'), /until you leave the Wrothgarian Mountains/);
    // outside every zone
    setWildHere(false, 3, ETHER_KIND);
    assert.equal(wildZoneKind(), null, 'no ground outside the zone');
    assert.equal(wildRing(), 0);
    assert.equal(zoneWord('leave'), WILD_TEXT.leave);
  } finally { setWildHere(false); }
});

test('ETHER-WILD: a death keeps the ground it fell on - the death screen says the sea\'s wait past the Veil, and the mountains\' in them, through every update', () => {
  try {
    setWildHere(true, 4, ETHER_KIND);
    setWildDeath({ killer: 'Ysolde', dropped: 0 });
    assert.ok(wildDeathLines().includes('Past the Veil the dead wait two minutes.'));
    assert.ok(!wildDeathLines().includes(WILD_TEXT.deathHold));
    setWildHere(false);   // the flag let go under a death screen still standing (a load, the room lost)
    setWildDeath({ killer: 'Ysolde', dropped: 3 });   // the drop's answer updates it
    assert.ok(wildDeathLines().includes('Past the Veil the dead wait two minutes.'), 'the update keeps the ground the death had');
    setWildDeath(null);
    setWildHere(true, 1);
    setWildDeath({ killer: null, dropped: 0 });
    assert.ok(wildDeathLines().includes(WILD_TEXT.deathHold), 'the mountains\' own');
  } finally { setWildDeath(null); setWildHere(false); }
});

test('ETHER-WILD: an isle\'s ruin is read by its band at its own pixel, through the place\'s longitude and latitude; a Bay place with no mask registered is no zone\'s', () => {
  const template = { name: 'Template', mapTableData: { mapId: 1, longitude: 0, latitude: 0, dungeonType: 0 }, exterior: { exteriorData: {} } };
  const isle = (px, py, kind = 'ruin') => ({ key: `${px},${py}`, cx: 10, cy: 10, px, py, kind, name: 'Old Thal' });
  for (const [px, py, ring] of [[bandEdgeX(140) - 40, -6000, 4], [bandEdgeX(45) - 3, FAR_Y, 3], [bandEdgeX(12) - 1, -7000, 2], [VEIL_X - 2, FAR_Y, 1], [veilhaven().px, veilhaven().py, 0]]) {
    const loc = synthesizeEtherLocation(template, isle(px, py));
    assert.equal(loc.ether, `${px},${py}`);
    assert.equal(wildRingAtPlace(loc), ring, `${px},${py}`);
    assert.equal(wildRingAtPlace(loc), etherWildRingAt(px, py), 'the pixel round-trips through MapsFile\'s own sum');
  }
  assert.equal(wildRingAtPlace({ mapTableData: { longitude: 400 * 128, latitude: (499 - 120) * 128 } }), 0, 'a place of the Bay, no mask: none');
  assert.equal(wildRingAtPlace({ ether: '1,1', mapTableData: {} }), 0, 'a place that cannot say where it stands');
  assert.equal(wildRingAtPlace(null), 0);
});

test('ETHER-WILD: the hosts\' seams - the frame stands the sea beside the mountains, online, on its ground; no pace cap at sea; the rise, the teleports, the maps\' hiding, the packs and an isle\'s ruin read the sea', () => {
  const w = src('src/scenes/world.js');
  const frame = w.slice(w.indexOf('const wildFrame = () => {'), w.indexOf('// WILD-LINE-HOLD (2026-10-08'));
  assert.match(frame, /const seaRing = _onlineWorldSession\(\) && !!online\?\.wildOk && etherSea && playerSpawned \? etherWildRingAt\(/, 'online, past a relay that raises the zone, with the sea standing');
  assert.match(frame, /const here = seaRing > 0 \|\| \(/, 'the sea is the zone beside the mountains');
  assert.match(frame, /ring = seaRing \|\| wildRingAt\(/, 'the sea\'s band is the ring');
  assert.match(frame, /setWildHere\(here, ring, seaRing \? ETHER_KIND : undefined\)/, 'the ground on the flag');
  assert.match(frame, /zoneWord\('enter'\)/);
  assert.match(frame, /: 'leave', left \|\| undefined\)/, 'the leaving said in the words of the ground left');   // PIN MOVED (AUDIT SEA VENTURES C7): 'quiet' while still past the peace
  assert.match(w, /setPaceZoneCap\(wildHere\(\) && wildZoneKind\(\) !== ETHER_KIND \? WILD_PACE_CAP : null\)/, 'the mountains\' pace cap never at sea');
  const rise = w.slice(w.indexOf('const wildRiseSite = (px, inDungeon = false) => {'), w.indexOf('const wildClearSpawn = () => {'));
  assert.match(rise.split('\n')[1], /if \(etherSea && inEther\(px\.x, px\.y\)\) return etherRiseSite\(px\.x, px\.y\);/, 'a death at sea rises at the nearest freeport, before the mountains\' search of the Bay\'s maps');
  // the site itself (HOST-SPLIT, SEA VENTURES: out of bootWorld): the nearest freeport's town within ETHER_RISE_PX, else Veilhaven
  const vh = veilhaven(), far = { x: vh.px + 20 * ETHER_RISE_PX, y: vh.py };
  for (const [x, y] of [[vh.px + 1, vh.py], [far.x, far.y]]) {
    const port = etherRisePort(x, y);
    assert.deepEqual(etherRiseSite(x, y), { mapPixel: { x: port.px, y: port.py }, kind: 'city' });
  }
  assert.deepEqual(etherRiseSite(vh.px + 1, vh.py).mapPixel, { x: vh.px, y: vh.py }, 'Veilhaven beside it');
  const tele = w.slice(w.indexOf('const wildTeleportRefused = (to = null) => {'), w.indexOf('const wildTravelGate = '));
  assert.match(tele, /etherWildRingAt\(playerTravelPixel\(\)\?\.x, playerTravelPixel\(\)\?\.y\) > 0 \|\| \(to && etherWildRingAt\(to\.x, to\.y\) > 0\)\)\) \{ townTalk\.say\(ETHER_WILD_TEXT\.teleport\(\)\); return true; \}/);
  assert.ok(tele.indexOf('ETHER_WILD_TEXT.teleport') < tele.indexOf('if (!m) return false;'), 'asked before the mountains\' mask is');
  const atWire = w.slice(w.indexOf('const wildAtWire = (p, near = false) => {'), w.indexOf('const wildOutdoors = () =>'));
  assert.match(atWire, /if \(etherSea && \(near \? inEther\(px\.x, px\.y\) : etherWildRingAt\(px\.x, px\.y\) > 0\)\) return true;/, 'a peer at sea is fair - and near it, past the Veil, unseen');
  assert.match(w, /return \(etherSea && inEther\(pixel\.x, pixel\.y\)\) \|\| \(!!m && wildNear\(m, pixel\.x, pixel\.y\)\);/, 'a map row past the Veil hides as the mountains\' band does');
  assert.match(w, /function wildBornHere\(px, py\) \{ const m = wildMaskOf\(maps\); return \(!!m && wildInside\(m, px, py\)\) \|\| \(etherSea && _onlineWorldSession\(\) && etherWildRingAt\(px, py\) > 0\); \}/, 'the open sea\'s packs four times as many, online');
  assert.match(w, /name: `\$\{WILD_TEXT\.chip\} - \$\{zoneRingName\(wildRing\(\)\)\}/, 'the HUD tile names the band');
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /const _wildRingRaw = isOnlinePage\(\) && \(isWildRegion\(dfLocation\?\.regionIndex \?\? -1\) \|\| !!dfLocation\?\.ether\) \? wildRingAtPlace\(dfLocation\) : 0;/, 'an isle\'s ruin asks its ring');
  assert.match(d, /const _wildDungeon = isOnlinePage\(\) && \(_wildRingRaw > 0 \|\| \(isWildRegion\(dfLocation\?\.regionIndex \?\? -1\) && !wildMask\(\)\)\);/, 'and is the zone\'s by it - the mountains\' maskless fallback theirs alone');
  assert.match(src('src/ui/hud/statusTips.js'), /lines\.push\(String\(tile\.name \?\? ''\), zoneWord\('chipTip'\)\);/, 'the tile\'s tip says the ground');
});

test('ETHER-WILD: the crossing says what lies past the peace, online alone; at sea a hand ashore goes back aboard and a knocked-out hand\'s pack to her hold - in the mountains he stays', () => {
  const plain = crossingRows('out');
  const warned = crossingRows('out', { pvp: true });
  assert.deepEqual(warned.slice(0, plain.length), plain, 'the question as it stood, then the warning');
  assert.deepEqual(warned.slice(plain.length), ['', 'Past Veilhaven\'s peace the open sea is an open PvP zone.', 'Other players may attack you there.']);
  assert.ok(plain.every((r) => r.length <= ROW_CHARS), 'as wide as the question\'s own rows');
  assert.deepEqual(questionRows('aa bb cc', 5), ['aa bb', 'cc']);
  assert.deepEqual(questionRows('aa bb', 5), ['aa bb'], 'a row exactly as wide stands');
  assert.deepEqual(questionRows('abcdefgh ij', 5), ['abcdefgh', 'ij'], 'a word past the width stands alone');
  assert.deepEqual(questionRows('  '), []);
  assert.deepEqual(crossingRows('home', { pvp: true }), crossingRows('home'), 'the way home warns of nothing');
  assert.match(src('src/scenes/world.js'), /rows: crossingRows\(way, \{ pvp: _onlineWorldSession\(\) && !!online\?\.wildOk \}\)/, 'online, past a relay that raises the zone');
  const said = [];
  try {
    setWildHere(true, 3, ETHER_KIND);
    assert.equal(heldAtSide('Bran', (l) => said.push(l)), false, 'at sea: sent back aboard');
    assert.equal(packStaysAshore(), false, 'at sea: to her hold');
    setWildHere(true, 3);
    assert.equal(heldAtSide('Bran', (l) => said.push(l)), true, 'in the mountains: he stays');
    assert.equal(packStaysAshore(), true);
    assert.deepEqual(said, [WILD_TEXT.companionStays('Bran')]);
    setWildHere(false);
    assert.equal(heldAtSide('Bran'), false);
  } finally { setWildHere(false); }
});

test('ETHER-WILD: a street foe past the Veil is the zone\'s to FOE-BOUNDS, read from Veilhaven\'s peace too; /unstuck at sea walks to the nearest freeport, never a Bay town across the Veil', () => {
  const g = src('src/scenes/grantHost.js');
  const about = g.slice(g.indexOf('function wildAbout(r, lane) {'), g.indexOf('const statsSaid = new Set();'));
  assert.match(about, /const \[px, py\] = mapPixelOfWire\(r\.f\[0\], r\.f\[2\]\);\n    if \(inEther\(px, py\)\) return true;/);
  const w = src('src/scenes/world.js');
  const unstuck = w.slice(w.indexOf('const unstuckOutdoors = () => {'), w.indexOf('You find your way to the nearest town.'));
  assert.match(unstuck, /const town = etherSea && inEther\(px\.x, px\.y\) \? wildRiseSite\(px\) : nearestSafeLocationAnywhere\(/);
});
