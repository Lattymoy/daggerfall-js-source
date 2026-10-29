// DLV6 (bible/03-World/Delve-II.md sections 8 and 15): THE FIRST CURATED BLOCKS AND THEIR SET PIECES - the light an add
// stands (world/dungeon/curatedBlocks.js, read by the host as the block's own lights are), the lab's hand (a thing set on
// the floor at my feet, a light over me, the spot a Rebuild leaves me on - scenes/delve/delveBench.js, tools/delveLab.js),
// the fire law kept clear of a designed encounter, and the four shipped blocks against the freeware's own: each prop on a
// floor, none in a ward or a doorway, every light in a room, every anchor landing among them. Held to fail under
// tools/mutants/dlv6.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { curatedRecordError, curatedBlockOf, lightRadiusOf, CURATED_LIGHT_M, curatedBlockName } from '../../src/world/dungeon/curatedBlocks.js';
import { CURATED_RECORDS } from '../../src/world/dungeon/curatedRecords.js';
import { curatedSlot } from '../../src/world/dungeon/curatedSplice.js';
import { collectDungeonLights } from '../../src/world/dungeon/dungeonLights.js';
import { RDB_RESOURCE_TYPES } from '../../src/formats/blocksFile.js';
import { DUNGEON_TYPES } from '../../src/formats/mapsFile.js';
import { DELVE_KINDS, DELVE_FAMILIES } from '../../src/net/delve/delveLaw.js';
import { labSpawn, labFoot, benchLocation } from '../../src/scenes/delve/delveBench.js';
import { mountDelveLab } from '../../src/tools/delveLab.js';

const ARENA2 = process.env.ARENA2_PATH;
const NO_ARENA2 = (!ARENA2 || !existsSync(ARENA2)) && 'ARENA2_PATH not set or missing - real-data validation skipped';
const REC = Object.freeze({ id: 'test-hall', n: 7, base: 'N0000023.RDB', types: [DUNGEON_TYPES.Crypt], drop: [], add: [], anchors: [] });
const BASE = { name: 'N0000023.RDB', index: 23, position: 4096, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: [] }] } };

test('DLV6 THE LIGHT AN ADD STANDS: a reach of 1 to 12 m, alone; made a Light resource of the block\'s own units, which the host reads back as that reach (mutants: the light uncounted; its reach unbounded; its radius\'s units; made a flat)', () => {
  const bad = (a) => curatedRecordError({ ...REC, add: [a] });
  assert.equal(bad({ light: 6, at: [10, 2, 10] }), null);
  assert.deepEqual(CURATED_LIGHT_M, [1, 12]);
  assert.match(bad({ light: 0.5, at: [10, 2, 10] }), /^add: a light's reach/);
  assert.match(bad({ light: 13, at: [10, 2, 10] }), /^add: a light's reach/);
  assert.match(bad({ light: 6, model: 41300, at: [10, 2, 10] }), /^add: one of model, flat, marker or light/);
  const made = curatedBlockOf(BASE, { ...REC, add: [{ light: 6, at: [10, 2.5, 12] }] });
  const o = made.rdbBlock.objectRootList.at(-1).rdbObjects[0];
  assert.equal(o.type, RDB_RESOURCE_TYPES.Light);
  assert.equal(o.resources.lightResource.radius, lightRadiusOf(6));
  assert.equal(lightRadiusOf(6), 80, 'the freeware\'s own units: a 6 m reach is a radius of 80');
  const [l] = collectDungeonLights(made);
  assert.deepEqual([l.x, l.y, l.z].map((v) => Math.round(v * 100) / 100), [10, 2.5, 12]);
  assert.ok(Math.abs(l.range - 6) < 0.05, `read back as its reach (${l.range})`);
});

test('DLV6 THE LAB\'S HAND: I stand where my Rebuild left me (`?at=`), else on the host\'s floor by the first encounter (never its heart: it would wake the ward); a model or a flat set ON the floor at my feet - a model\'s lowest point under its origin, a flat\'s half height - one the data lacks refused; a light over me; the Rebuild told where I stand (mutants: `?at` unread; the foot\'s sign; a flat\'s whole height; the foot unread; the spot unsaid)', async () => {
  const P = (q) => new URLSearchParams(q);
  const d = { ...REC, n: 0, anchors: [{ kind: 'hold', at: [15.6, 12.8, 15.6], r: 4, vault: [12.2, 12.8, 15.6] }] };
  assert.deepEqual(labSpawn(P('at=1.5,2,3')), [1.5, 2, 3]);
  for (const q of ['at=1,x,3', 'at=1,,3', 'at=1,2', '']) assert.equal(labSpawn(P(q)), null, `"${q}": the host's floor (delveHost.js firstFloor)`);
  const arch = { getRecordIndex: (id) => (id === 41319 ? 0 : -1), getMesh: () => ({ totalVertices: 2, totalTriangles: 0, subMeshes: [{ textureArchive: 0, textureRecord: 0, planes: [{ points: [{ x: 0, y: 18, z: 0, nx: 0, ny: 1, nz: 0, u: 0, v: 0 }, { x: 4, y: -18, z: 4, nx: 0, ny: 1, nz: 0, u: 0, v: 0 }] }], totalPrimitives: 0 }] }) };
  const tex = { recordCount: 3, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) };
  const foot = labFoot(arch, async (a) => (a === 210 ? tex : null));
  assert.ok(Math.abs((await foot({ model: 41319 })) - 0.45) < 1e-6, 'its lowest point 0.45 m under its origin (Daggerfall\'s y is down)');
  assert.equal(await foot({ model: 99999 }), null);
  const h = (await import('../../src/world/rmbFlats.js')).classicBillboardSize(tex, 1).h;
  assert.equal(await foot({ flat: [210, 1] }), h / 2);
  assert.equal(await foot({ flat: [210, 5] }), null, 'a record past the archive');
  assert.equal(await foot({ flat: [211, 0] }), null, 'an archive the data lacks');
  // the panel, on a document of its own
  const node = (tag) => ({ tag, kids: [], value: '', textContent: '', append(...k) { this.kids.push(...k); }, replaceChildren(...k) { this.kids = k; }, addEventListener() {}, remove() {} });
  const doc = { createElement: node, head: node('head'), body: node('body') };
  const find = (n, text) => (n?.tag === 'button' && n.textContent === text ? n : (n?.kids ?? []).map((k) => find(k, text)).find(Boolean));
  let rebuilt = null;
  const lab = mountDelveLab({ draft: { ...d, anchors: [] }, feet: () => [10, 2, 10], landing: () => ({ ok: true }), foot: async (it) => (it.model === 99999 ? null : it.model ? 0.45 : 1.2), rebuild: (x, at) => { rebuilt = { x, at }; }, doc: /** @type {any} */ (doc) });
  try {
    await find(doc.body, 'Model here').onclick();
    await find(doc.body, 'Flat here').onclick();
    find(doc.body, 'Light here').onclick();
    const add = lab.draft().add;
    assert.deepEqual(add.map((a) => a.at), [[10, 2.45, 10], [10, 3.2, 10], [10, 4.2, 10]], 'on the floor, and a light 2.2 m over me');
    assert.deepEqual([add[0].model, add[1].flat, add[2].light], [41300, [199, 0], 6]);
    const input = (n, value) => (n?.tag === 'input' && n.value === value ? n : (n?.kids ?? []).map((k) => input(k, value)).find(Boolean));
    input(doc.body, '41300').value = '99999';
    await find(doc.body, 'Model here').onclick();
    assert.equal(lab.draft().add.length, 3, 'a model the data lacks: refused');
    const said = (n) => (n?.className?.startsWith?.('say') && n.textContent.includes('not in your game') ? n : (n?.kids ?? []).map(said).find(Boolean));
    assert.ok(said(doc.body), 'and said so');
    find(doc.body, 'Rebuild').onclick();
    assert.deepEqual(rebuilt.at, [10, 2, 10], 'the Rebuild told where I stand');
  } finally { lab.destroy(); }
  const tpl = { name: 'tpl', hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId: 9, dungeonType: DUNGEON_TYPES.OrcStronghold }, dungeon: { recordElement: { header: { locationId: 5 } }, blocks: [{ blockName: 'N0000001.RDB', isStartingBlock: true }, { blockName: 'B0000002.RDB' }] } };
  const maps = { regionCount: 1, getRegion: () => ({ locationCount: 1 }), baseLocationCount: () => 1, getLocation: () => tpl };
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { setCuratedDraft } = await import('../../src/world/dungeon/curatedRecords.js');
  W._resetWorldDataReplacement(); W.installWorldDataReplacement();
  try { assert.deepEqual(benchLocation(P('dungeon=lab&lab=throne-hall&at=40,25.65,9'), maps, null).spawn, [40, 25.65, 9], 'the bench stands me there'); } finally { setCuratedDraft(null); W._resetWorldDataReplacement(); }
});

test('DLV6 THE FIRST FOUR: numbered 1 to 4, each a kind of its own of both families; the types whose pools hold one, and those that hold none yet; a game-made dungeon of each pool can take its block (mutants: a record unlisted)', () => {
  assert.deepEqual(CURATED_RECORDS.map((r) => [r.n, r.id]), [[1, 'crypt-hall'], [2, 'mine-gallery'], [3, 'desecrated-chapel'], [4, 'throne-hall']]);
  const kinds = CURATED_RECORDS.flatMap((r) => r.anchors.map((a) => a.kind));
  assert.deepEqual(kinds, ['hold', 'brazier', 'seals', 'weighing']);
  assert.deepEqual([...new Set(kinds.map((k) => DELVE_KINDS[k].family))].sort(), [...DELVE_FAMILIES].sort());
  const T = DUNGEON_TYPES;
  const pooled = [...new Set(CURATED_RECORDS.flatMap((r) => r.types))].sort((a, b) => a - b);
  assert.deepEqual(pooled, [T.Crypt, T.OrcStronghold, T.HumanStronghold, T.DesecratedTemple, T.Mine, T.Coven, T.VampireHaunt, T.RuinedCastle, T.GiantStronghold, T.BarbarianStronghold].sort((a, b) => a - b));
  for (const type of pooled) {
    const pool = CURATED_RECORDS.filter((r) => r.types.includes(type));
    const ids = new Set();
    for (let id = 1; id <= 400; id++) {
      const loc = { spawned: true, mapTableData: { mapId: id, dungeonType: type }, dungeon: { blocks: [{ blockName: 'N0000001.RDB', isStartingBlock: true }, { blockName: 'N0000002.RDB' }, { blockName: 'B0000001.RDB' }] } };
      const s = curatedSlot(loc, CURATED_RECORDS);
      if (s) ids.add(s.rec.id);
    }
    assert.deepEqual([...ids].sort(), pool.map((r) => r.id).sort(), `type ${type}: every block of its pool drawn`);
  }
});

test('DLV6 THE FIRES KEEP CLEAR OF A DESIGNED ENCOUNTER: the dungeon\'s campfire law stands none within the site law\'s own 12 m of a curated anchor - an anchor is stood as designed, never judged again; no anchor, the fires the law always placed (mutants: the anchors unread; the reach)', async () => {
  const { dungeonFirePlan, DFIRE } = await import('../../src/world/dungeon/dungeonFires.js');
  const { DSITE } = await import('../../src/world/dungeon/delveSites.js');
  assert.equal(DFIRE.anchorM, DSITE.fireM);
  const laid = (name, x, start = false) => ({ name, originX: x * 51.2, originZ: 0, isStartingBlock: start, layout: { waterLevel: 10000, markers: start ? [{ record: 10, x: 5, y: 0, z: 5 }] : [], startMarkers: start ? [{ x: 5, y: 0, z: 5 }] : [], flats: [] } });
  const blocks = [laid('N0000001.RDB', 0, true), laid(curatedBlockName(7), 1), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3), laid('N0000004.RDB', 4), laid('N0000005.RDB', 5)];
  const probe = { floor: () => ({ y: 0, ny: 1 }), room: () => ({ walls: [5, 5, 5, 5, 5, 5, 5, 5] }) };
  const anchors = [{ kind: 'hold', r: 4, at: [51.2 + 25.6 + 3, 0, 25.6], vault: [51.2 + 25.6, 0, 25.6] }];
  const bare = dungeonFirePlan({ blocks, probe, anchors: [] });
  const held = dungeonFirePlan({ blocks, probe, anchors });
  assert.equal(held.valid, bare.valid - 1, 'the block\'s centre, 3 m from its encounter, never a fire\'s');
  for (let seed = 0; seed < 24; seed++) {
    for (const f of dungeonFirePlan({ blocks, probe, anchors, seed }).fires) assert.ok(Math.hypot(f[0] - anchors[0].at[0], f[1] - anchors[0].at[1], f[2] - anchors[0].at[2]) >= DFIRE.anchorM, `seed ${seed}: a fire at ${f}`);
  }
  const near = [{ ...anchors[0], at: [51.2 + 25.6 + 11.9, 0, 25.6] }], far = [{ ...anchors[0], at: [51.2 + 25.6 + 12.1, 0, 25.6] }];
  assert.deepEqual([dungeonFirePlan({ blocks, probe, anchors: near }).valid, dungeonFirePlan({ blocks, probe, anchors: far }).valid], [bare.valid - 1, bare.valid], 'within 12 m, and no farther');
  // ...and an anchor a layout's own fire crowds (a neighbour block's brazier) gives way in the site law, as a found site would
  const { delveSitePlan } = await import('../../src/world/dungeon/delveSites.js');
  const at = anchors[0].at, fire = (dx) => [[at[0] + dx, at[1], at[2]]];
  assert.deepEqual([11.9, 12.1].map((dx) => delveSitePlan({ blocks, probe, seed: 3, anchors, fires: fire(dx) }).anchored), [0, 1]);
});

test('DLV6 THE SET PIECES ON THE FREEWARE\'S BLOCKS: every model and flat Daggerfall\'s own, standing on a floor (a model\'s foot on the base\'s, a flat on whatever it stands on - a lid, an altar, a mantel); none within half a metre of a ward, nor 1.2 m of a door; every light 0.5 to 4 m over a floor; the made block\'s lights its base\'s and its own (ARENA2)', { skip: NO_ARENA2 }, async () => {
  const { loadData } = await import('../../tools/climbDungeonProbe.mjs');
  const { hostModelReader, hostFireCollider, hostFlatSize, layoutHearths } = await import('../../tools/dungeonFireProbe.mjs');
  const { colliderSiteProbe, landDelveSites, DSITE, DSITE_SMALL } = await import('../../src/world/dungeon/delveSites.js');
  const { fireLayoutInputs, enemyMarks, itemMarks, blockWaterY } = await import('../../src/world/dungeon/dungeonFires.js');
  const { layoutDungeon } = await import('../../src/world/dungeon/dungeonLayout.js');
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { installCuratedBlocks } = await import('../../src/world/dungeon/curatedInstall.js');
  const data = loadData(/** @type {string} */ (ARENA2));
  W._resetWorldDataReplacement(); W.installWorldDataReplacement(); W.bindWorldDataBlocks(data.blocks); installCuratedBlocks();
  try {
    const getModel = hostModelReader(data.arch), size = hostFlatSize(/** @type {string} */ (ARENA2));
    const lay = (name) => layoutDungeon({ name, hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId: 1 }, dungeon: { recordElement: { header: { locationId: 1 } }, blocks: [{ x: 0, z: 0, blockName: name, isStartingBlock: false }] } }, data.blocks, getModel);
    const ext = (id) => { const p = getModel(id).positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[i + a]); hi[a] = Math.max(hi[a], p[i + a]); } return { lo, hi }; };
    for (const rec of CURATED_RECORDS) {
      const made = lay(curatedBlockName(rec.n)), base = lay(rec.base);
      const onMade = colliderSiteProbe(hostFireCollider(made.blocks, getModel)), onBase = colliderSiteProbe(hostFireCollider(base.blocks, getModel));
      const { doors, existing } = fireLayoutInputs(made.blocks, layoutHearths(made.blocks, size));
      for (const n of rec.anchors) {
        const tally = {};
        const got = landDelveSites([{ pos: n.at, water: blockWaterY(made.blocks[0].layout) }], { probe: onMade, doors, enemies: enemyMarks(made.blocks), items: itemMarks(made.blocks), fires: existing, start: null, tally, law: n.r === DSITE.r ? DSITE : DSITE_SMALL });
        assert.equal(got.length, 1, `${rec.id}: its ${n.kind} lands among its own set pieces and fires, as the lab checks it (${JSON.stringify(tally)})`);
      }
      for (const a of rec.add) {
        const what = `${rec.id}: ${JSON.stringify(a)}`;
        if (a.light !== undefined) {
          let f = null;
          for (let dy = 0.5; dy <= 4 && !f; dy += 0.25) f = onMade.floor([a.at[0], a.at[1] - dy, a.at[2]]);
          assert.ok(f && a.at[1] - f.y >= 0.5 && a.at[1] - f.y <= 4, `${what}: over a floor, in its room`);
          continue;
        }
        let foot, half;
        if (a.model !== undefined) {
          assert.ok(getModel(a.model), `${what}: in ARCH3D`);
          const e = ext(a.model);
          foot = a.at[1] + e.lo[1]; half = Math.max(e.hi[0] - e.lo[0], e.hi[2] - e.lo[2]) / 2;
        } else {
          const s = size(a.flat[0], a.flat[1]);
          assert.ok(s, `${what}: in its archive`);
          foot = a.at[1] - s.h / 2; half = s.w / 2;
        }
        const f = (a.model !== undefined ? onBase : onMade).floor([a.at[0], foot + 0.4, a.at[2]]);
        assert.ok(f && Math.abs(foot - f.y) < 0.06, `${what}: on a floor (${f ? (foot - f.y).toFixed(2) : 'none'})`);
        for (const n of rec.anchors) assert.ok(Math.hypot(a.at[0] - n.at[0], a.at[2] - n.at[2]) - half - n.r >= 0.5, `${what}: clear of the ${n.kind}'s ward`);
        for (const d of doors) if (Math.abs(d[1] - foot) < 3) assert.ok(Math.hypot(a.at[0] - d[0], a.at[2] - d[2]) - half >= 1.2, `${what}: clear of the door at ${d}`);
      }
      const lights = (name) => collectDungeonLights(data.blocks.getBlock(data.blocks.getBlockIndex(name))).length;
      assert.equal(lights(curatedBlockName(rec.n)), lights(rec.base) + rec.add.filter((a) => a.light !== undefined).length, `${rec.id}: its lights its base's and its own`);
    }
  } finally { W._resetWorldDataReplacement(); }
});
