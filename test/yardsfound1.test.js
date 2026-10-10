// YARDS-FOUND (2026-10-10, from play: "The new stable and transport merchant shops dont show on town maps/overworld",
// "Ensure these locations appear when talking to NPCs"; bible/03-World/Merchant-Yards.md YARDS-FOUND). THE YARDS FOUND
// AS A SHOP IS: rows of the town's talk directory under a key no building holds (systems/merchantYards.js
// yardDirectoryRows), their own groups on the Where-is page (systems/topicTree.js), answered as a building is (the
// compass, the knowledge roll, the map's mark); their ground and their names on both town maps (world/merchantYardMap.js
// yardTownBlocks, ui/townMapDoor.js, ui/exteriorAutomapWindow.js, ui/townSheet.js); and their marks on the Overworld
// (scenes/merchantYardsHost.js overworldMarks, ui/travelViewHud.js yardGlyph, systems/travelViewFilters.js). Every site
// here is the producer's own (world/merchantYardSites.js yardSitesOn, the host's keeper beside it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  YARD_KIND_ORDER, YARD_QUALITY, YARD_KEY_BASE, YARD_TALK_GROUPS, yardBuildingKey, yardDirectoryRows, yardKeeper, yardName,
} from '../src/systems/merchantYards.js';
import { yardGround, yardSitesOn } from '../src/world/merchantYardSites.js';
import { yardTownBlocks, YARD_MAP_BYTE, YARD_MAP_TYPE, YARD_MAP_BLOCK_M } from '../src/world/merchantYardMap.js';
import { CityNavigation, NAV_CELL } from '../src/world/cityNavigation.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { ROAD_WEIGHT } from '../src/systems/gothwayBoards.js';
import { BUILDING_KEY_0, makeBuildingKey } from '../src/systems/talkTopics.js';
import { TopicTree, LIST_ITEM_TYPE, QUESTION_TYPE, EN } from '../src/systems/topicTree.js';
import { AnswerPipeline } from '../src/systems/answerPipeline.js';
import { buildingCompassDirection, DIRECTION_HINTS } from '../src/systems/talk.js';
import { quarterOf } from '../src/ui/townQuarters.js';
import { nameplateAnchor, WORLD_PER_PX } from '../src/ui/nameplateLayout.js';
import { ExteriorAutomapWindow, _resetZoomForTests } from '../src/ui/exteriorAutomapWindow.js';
import { createTownSheet } from '../src/ui/townSheet.js';
import { _resetForTests } from '../src/systems/settings.js';
import { createMerchantYards, YARD_MARK_LIFT } from '../src/scenes/merchantYardsHost.js';
import { markGroup, markShown, countGroups, isYardMark } from '../src/systems/travelViewFilters.js';
import { yardGlyph, TV_YARD_R } from '../src/ui/travelViewHud.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 } };

/** A town of two blocks by two, open ground with a road along row 64, its yards placed by the producer and handed the
 *  keeper the host hands them (scenes/world.js merchantYardSitesFor). */
function town() {
  const g = yardGround({ width: 128, height: 128, weightAt: (gx, gy) => (gx < 0 || gy < 0 || gx >= 128 || gy >= 128 ? 0 : gy === 64 || gy === 65 ? ROAD_WEIGHT : 1) });
  const mapId = 7, regionIndex = 17;
  const sites = yardSitesOn(g).map((t) => ({ ...t, key: `${mapId}:${t.kind}`, mapId, regionIndex, race: 'Breton', keeper: yardKeeper(mapId, t.kind, regionIndex) }));
  assert.deepEqual(sites.map((s) => s.kind), ['stable', 'transport'], 'both yards stand');
  const rows = [0, 1].flatMap((y) => [0, 1].map((x) => ({ x, y, autoMap: new Uint8Array(64 * 64), landmark: null })));
  return { sites, rows };
}
const SHOPS = [
  { name: 'The Odd Blades', buildingKey: makeBuildingKey(0, 0, 1), buildingType: BUILDING_TYPES.WeaponSmith, position: [20, 0, 20] },
  { name: 'The Dented Helm', buildingKey: makeBuildingKey(1, 0, 2), buildingType: BUILDING_TYPES.Tavern, position: [120, 0, 30] },
];
function treeOver(list) {
  return new TopicTree({
    getQuest: () => null, getAllActiveQuestIds: () => [], currentRegionIndex: () => 17, currentRegionName: () => 'Daggerfall',
    currentLocationName: () => 'Daggerfall', currentMapId: () => 7, isPlayerInside: () => false, isPlayerInsideBuilding: () => false,
    isPlayerInsideCastle: () => false, currentBuildingKey: () => -1, getBuildingList: () => list, exteriorBuildings: () => [],
    factionName: (id) => `faction:${id}`,
  });
}

test('YARDS-FOUND THE DIRECTORY\'S ROWS: each yard a row of its town\'s talk directory as a building\'s is - its name, its counter\'s type, its quality, its middle in the location\'s frame - under a key no building of Daggerfall\'s holds; a kind the law does not know, or none, no row (mutants: the key a building\'s, the middle unread)', () => {
  const { sites } = town();
  const rows = yardDirectoryRows(sites);
  assert.deepEqual(rows, sites.map((s, i) => ({
    name: yardName(s.kind, s.keeper.name), buildingType: `yard:${s.kind}`, factionId: 0, quality: YARD_QUALITY,
    position: [s.x, 0, s.z], buildingKey: YARD_KEY_BASE + i, yard: s.kind,
  })));
  assert.deepEqual(YARD_KIND_ORDER.map(yardBuildingKey), [1 << 25, (1 << 25) + 1]);
  // no building's key can meet it: the largest city's last record, and the key 0's stand-in
  for (const r of rows) assert.ok(r.buildingKey > makeBuildingKey(7, 7, 255) && r.buildingKey > BUILDING_KEY_0, `${r.name}: past every building's key`);
  assert.notEqual(rows[0].buildingKey, rows[1].buildingKey);
  assert.deepEqual(yardDirectoryRows([{ kind: 'barn', x: 1, z: 1 }, null]), []);
  assert.deepEqual(yardDirectoryRows(null), []);
  assert.deepEqual(YARD_TALK_GROUPS, { stable: 'Stables', transport: 'Wagon yards' });
});

test('YARDS-FOUND THE WHERE-IS PAGE: the town\'s Stable and Wagon Yard each their own group after the shops\' - its Previous List head, its yard asked as a building (LocalBuilding, its key) - and before the General section and Regional; a town with none has neither group, and the palace still joins General (mutants: the yards ungrouped)', () => {
  const { sites } = town();
  const yards = yardDirectoryRows(sites);
  const tree = treeOver([...SHOPS, ...yards, { name: 'Castle Daggerfall', buildingKey: makeBuildingKey(1, 1, 0), buildingType: BUILDING_TYPES.Palace, position: [80, 0, 80] }]);
  tree.assembleTopicListLocation();
  const captions = tree.listTopicLocation.map((g) => g.caption);
  assert.deepEqual(captions, ['Weapon smiths', 'Taverns', 'Stables', 'Wagon yards', EN.general, EN.regional]);
  for (const [i, kind] of YARD_KIND_ORDER.entries()) {
    const g = tree.listTopicLocation.find((x) => x.caption === YARD_TALK_GROUPS[kind]);
    assert.equal(g.type, LIST_ITEM_TYPE.ItemGroup);
    assert.equal(g.listChildItems[0].type, LIST_ITEM_TYPE.NavigationBack, `${kind}: the Previous List head`);
    assert.equal(g.listChildItems[0].listParentItems, tree.listTopicLocation);
    assert.deepEqual(g.listChildItems.slice(1).map((c) => [c.caption, c.questionType, c.buildingKey]), [[yards[i].name, QUESTION_TYPE.LocalBuilding, yards[i].buildingKey]]);
  }
  const general = tree.listTopicLocation.find((x) => x.caption === EN.general);
  assert.deepEqual(general.listChildItems.slice(1).map((c) => c.caption), ['Castle Daggerfall'], 'the palace in General, as C# lays it');
  const bare = treeOver(SHOPS);
  bare.assembleTopicListLocation();
  assert.deepEqual(bare.listTopicLocation.map((g) => g.caption), ['Weapon smiths', 'Taverns', EN.regional], 'no yards, no groups');
});

test('YARDS-FOUND THE ANSWER: asked where a yard is, the compass reads its middle from the directory ("%di of here"), the knowledge roll takes its key as a building\'s, and the map\'s mark discovers it by its key (mutants: the rows never joined the directory)', () => {
  const { sites } = town();
  const yards = yardDirectoryRows(sites);
  const list = [...SHOPS, ...yards];
  const [stable] = yards;
  const south = [stable.position[0], 0, stable.position[2] - 40], east = [stable.position[0] + 40, 0, stable.position[2]];
  assert.equal(buildingCompassDirection({ listBuildings: list, playerPos: south }, stable.buildingKey), DIRECTION_HINTS.north, 'south of it: north of here');
  assert.equal(buildingCompassDirection({ listBuildings: list, playerPos: east }, stable.buildingKey), DIRECTION_HINTS.west);
  const found = [];
  const tree = treeOver(list);
  tree.assembleTopicListLocation();
  const pipe = new AnswerPipeline({ tree, discoverBuilding: (k) => found.push(k), session: () => ({ socialGroup: 0, isSpyMaster: false }) });
  const item = tree.listTopicLocation.find((g) => g.caption === 'Wagon yards').listChildItems[1];
  pipe.currentKeySubjectBuildingKey = item.buildingKey;
  pipe.markKeySubjectLocationOnMap();
  assert.deepEqual(found, [yards[1].buildingKey], 'marked on the map: the Wagon Yard discovered by its key');
  const a = pipe.getNPCKnowledgeAboutItem(item, 1234), b = pipe.getNPCKnowledgeAboutItem(item, 1234);
  assert.equal(a, b, 'the roll stable per person and place');
});

test('YARDS-FOUND THE TOWN MAP: a yard\'s ground drawn in the General Store\'s byte (a shop\'s quarter) cell for cell where it stands - the same cells the people\'s navgrid closes - in a copy, the block\'s own bytes untouched; its name a place of the block its middle stands in, anchored there by the plate law; both maps letter it always, in a shop\'s ink, and never rename it (mutants: the rows flipped, the bytes written in place, the place in the wrong block, the classic window\'s places unread, the sheet\'s)', () => {
  const { sites, rows } = town();
  const before = rows.map((r) => r.autoMap.slice());
  const out = yardTownBlocks(rows, sites);
  assert.deepEqual(rows.map((r) => [...r.autoMap]), before.map((b) => [...b]), 'the block\'s own bytes untouched');
  assert.equal(quarterOf(YARD_MAP_BYTE), 'shop');
  assert.equal(YARD_MAP_TYPE, BUILDING_TYPES.GeneralStore);
  close(YARD_MAP_BLOCK_M, 102.4, 1e-9);
  // the painted bytes read as the people's navgrid reads a block: exactly the yards' cells closed
  const nav = new CityNavigation(2, 2), open = new CityNavigation(2, 2);
  for (const r of out) nav.setBlockData(r.x, r.y, r.autoMap, () => 2);
  for (const r of rows) open.setBlockData(r.x, r.y, r.autoMap, () => 2);
  const inYard = (gx, gy) => sites.some((s) => gx >= s.gx && gx < s.gx + s.nx && gy >= s.gy && gy < s.gy + s.nz);
  let painted = 0;
  for (let gy = 0; gy < 128; gy++) for (let gx = 0; gx < 128; gx++) {
    const closed = nav.weightAt(gx, gy) === 0;
    assert.equal(closed, inYard(gx, gy), `cell ${gx},${gy}`);
    assert.equal(open.weightAt(gx, gy) === 0, false);
    if (closed) painted++;
  }
  assert.equal(painted, sites.reduce((n, s) => n + s.nx * s.nz, 0));
  // the names: one place each, in the block its middle stands in, anchored on its middle
  const places = out.flatMap((r) => (r.places ?? []).map((p) => ({ ...p, bx: r.x, by: r.y })));
  assert.deepEqual(places.map((p) => p.name), sites.map((s) => yardName(s.kind, s.keeper.name)));
  for (const [i, p] of places.entries()) {
    const s = sites[i];
    assert.deepEqual([p.bx, p.by], [Math.floor(s.x / 102.4), Math.floor(s.z / 102.4)], `${p.name}: its block`);
    assert.deepEqual(nameplateAnchor(p.bx, p.by, p.position), [Math.trunc(s.x / WORLD_PER_PX), Math.trunc(s.z / WORLD_PER_PX)], `${p.name}: over its middle`);
    assert.equal(p.buildingType, YARD_MAP_TYPE);
  }
  assert.equal(yardTownBlocks(rows, null), rows, 'no yards: the rows as handed');
  // a yard two blocks east of where it was placed (the producer's site moved by whole blocks, as it would stand in a
  // wider town): its ground and its name go with it, into a block whose column is not its row
  const wide = [0, 1].flatMap((y) => [0, 1, 2, 3].map((x) => ({ x, y, autoMap: new Uint8Array(64 * 64), landmark: null })));
  const moved = { ...sites[0], gx: sites[0].gx + 128, x: sites[0].x + 2 * YARD_MAP_BLOCK_M };
  const bx = Math.floor(moved.x / YARD_MAP_BLOCK_M), by = Math.floor(moved.z / YARD_MAP_BLOCK_M);
  assert.notEqual(bx, by);
  const laid = yardTownBlocks(wide, [moved]);
  assert.deepEqual(laid.filter((r) => r.places?.length).map((r) => [r.x, r.y]), [[bx, by]], 'its name in its own block');
  assert.ok(laid.find((r) => r.x === bx && r.y === by).autoMap.includes(YARD_MAP_BYTE), 'its ground there too');
  assert.equal(laid.filter((r) => r.x < 2).some((r) => r.autoMap.includes(YARD_MAP_BYTE)), false, 'none where it no longer stands');
  // the classic window: a plate a yard, nothing discovered; no record renames it
  _resetForTests(); _resetZoomForTests();
  const renames = [];
  const w = new ExteriorAutomapWindow({
    locationName: 'Gothway', locationId: 'r:7', gridW: 2, gridH: 2, blocks: out,
    playerPos: () => [0, 0, 0], playerYaw: () => 0, locOrigin: [0, 0, 0], isCustomLocation: false,
    arrowMesh: () => null, compassArt: null, buildings: () => [], directory: () => [], discovered: () => [],
    rename: (k, t) => renames.push([k, t]),
  });
  const plates = w.buildPlates(FONT, { s: 3, ox: 0, oy: 0 });
  assert.deepEqual(plates.map((p) => [p.text, p.landmark]), places.map((p) => [p.name, true]));
  w._hoverPlate = plates[0];
  w._renameAt(0, 0);
  assert.deepEqual(renames, [], 'no record renames a yard');
  // the enhanced sheet: named in a shop's ink, each name on its yard's ground
  const sheet = createTownSheet({ gridW: 2, gridH: 2, blocks: out, buildings: () => [], discovered: () => [] });
  assert.deepEqual(sheet.names().map((n) => [n.text, n.quarter]), places.map((p) => [p.name, 'shop']));
  for (const n of sheet.names()) {
    assert.equal(n.key, null);
    assert.equal(sheet.field.bytes[n.y * sheet.field.w + n.x], YARD_MAP_BYTE, `${n.text} stands on its ground`);
  }
});

test('YARDS-FOUND THE OVERWORLD: each yard standing is a mark - its name over its ground, its kind the look\'s - shown and hidden with the Towns switch and never counted a town; its glyph its signboard\'s emblem, the Wagon Yard\'s wheel and the Stable\'s horseshoe (mutants: no mark, the group lost, counted a town, one glyph for both)', () => {
  const keeper = { name: 'Gwynara Moorhart', sex: 'female', variant: 1 };
  const sites = [
    { key: '7:stable', kind: 'stable', x: 100, z: 50, yaw: 0, comp: 0, regionIndex: 17, race: 'Breton', keeper },
    { key: '7:transport', kind: 'transport', x: 140, z: 50, yaw: 90, comp: 0, regionIndex: 17, race: 'Breton', keeper: { name: 'Jalib', sex: 'male', variant: 2 } },
  ];
  const renderer = { textures: new Set(), uploadTexture() {}, createMesh: () => ({}), destroyMesh() {}, drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} };
  const collider = { addMesh() {}, removeBucket() {} };
  const y = createMerchantYards({
    renderer, collider: () => collider, getTexture: async () => null, uploadRecordFrame() {},
    sites: () => sites, groundAt: () => 2, eye: () => [0, 3, 0], feet: () => null, horseArt: () => false,
    showWagon: () => true, wagonBox: () => null, open: () => true, say() {}, midText() {}, now: () => 0,
  });
  assert.deepEqual(y.overworldMarks(), [], 'nothing stood yet');
  y.frame();
  const marks = y.overworldMarks();
  assert.deepEqual(marks, [
    { key: 'yard:7:stable', at: [100, 2 + YARD_MARK_LIFT, 50], label: 'Moorhart\'s Stables', kind: 'yard stable' },
    { key: 'yard:7:transport', at: [140, 2 + YARD_MARK_LIFT, 50], label: 'Jalib\'s Wagon Yard', kind: 'yard transport' },
  ]);
  for (const m of marks) {
    assert.equal(markGroup(m.kind), 'towns');
    assert.equal(isYardMark(m), true);
    assert.equal(markShown(m, { towns: true }), true);
    assert.equal(markShown(m, { towns: false }), false, 'Towns off: the yards with them');
  }
  assert.equal(countGroups([...marks, { kind: 'place' }]).towns, 1, 'the Towns switch counts towns, not yards');
  // the glyphs, on a recording context
  const ops = (kind) => {
    const log = [];
    const g = new Proxy({ fillStyle: '#fff' }, { get: (t, k) => (k in t ? t[k] : (...a) => { log.push([k, ...a]); }), set: (t, k, v) => { t[k] = v; return true; } });
    yardGlyph(g, 50, 60, kind, '#c08a3e');
    return log;
  };
  const wheel = ops('transport'), shoe = ops('stable');
  assert.ok(wheel.filter(([k]) => k === 'arc').length >= 2 && wheel.some(([k]) => k === 'lineTo'), 'the wheel: its tyre and its spokes');
  const arcs = shoe.filter(([k]) => k === 'arc');
  assert.deepEqual(arcs, [['arc', 50, 59, TV_YARD_R, 0, Math.PI]], 'the horseshoe: one half-ring, open at the top');
  assert.ok(shoe.filter(([k]) => k === 'fillRect').length >= 4, 'and its nail holes');
  y.dispose();
});

test('YARDS-FOUND THE HOSTS: the streaming host hands its yards to the town map (laid on the rows once, at the door both maps share), to the talk directory and to the Overworld\'s marks; townTalk joins them to its directory and, with no engine, groups them after the shops; the bench stands no yard, and the interiors and the dungeon open no town map (mutants: each hand dropped)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /\n\s+yards: b\.merchantYards \?\? null,   \/\/ YARDS-FOUND/, 'the town map');
  assert.match(w, /\n\s+yards: cur\.merchantYards \?\? null,   \/\/ YARDS-FOUND/, 'the talk directory');
  assert.match(w, /for \(const m of merchantYards\?\.overworldMarks\(\) \?\? \[\]\) marks\.push\(m\);/, 'the Overworld');
  assert.ok(w.indexOf('merchantYards?.overworldMarks()') > w.indexOf('function travelViewMarks()'), 'in the Overworld\'s marks');
  const door = read('src/ui/townMapDoor.js');
  assert.match(door, /if \(deps\.yards\?\.length\) deps = \{ \.\.\.deps, blocks: yardTownBlocks\(deps\.blocks \?\? \[\], deps\.yards\) \};\n\s+if \(heldMapWorn\(\)\) \{/, 'laid before either map is built');
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /directory = buildBuildingDirectory\(topics\.exteriorBuildings, topics\.blocks, opts\);\n(?:\s+\/\/[^\n]*\n)*\s+directory\.push\(\.\.\.yardDirectoryRows\(topics\.yards\)\);/, 'joined to the directory');
  assert.match(tt, /\.\.\.YARD_KIND_ORDER\.map\(\(k\) => \(\{ label: YARD_TALK_GROUPS\[k\], buildings: directory\.filter\(\(b\) => b\.yard === k\) \}\)\),/, 'the fallback\'s groups');
  assert.doesNotMatch(read('src/scenes/exterior.js'), /merchantYards|yardTownBlocks/, 'the bench stands no yard');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /createTownMapWindow/, `${host} opens no town map`);
  assert.match(read('src/ui/travelViewHud.js'), /if \(k === 'yard'\) return k;/, 'the HUD\'s look');
});

function close(a, b, eps, msg = '') { assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`); }
