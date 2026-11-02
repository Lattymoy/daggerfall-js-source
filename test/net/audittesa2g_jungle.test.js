// AUDIT TESA II J5 (AUDIT TESA-BIOME J5, OPEN): Logging's jungle past the Bay - JUNGLE-WOODS' 48 trees a day stood on Bantha's
// area alone, and a jungle zone's pixel past the Bay (the Nibenay's, Blackwood's, Valenwood's forest) its climate's count.
// The account service holds no trace to read the zones by, so the client's word that its pixel is a jungle zone's is
// WITNESSED with the pixel's climate and region (SEAT0 3.2, net/nodeLaw.js pixelReport's `,1`) and stands on confirmed ground
// alone, where a jungle zone may stand (jungleGroundOk) - one law, the client's stand and the service's bound
// (nodeSlots, jungleWoods). bible/06-Systems/Professions-Arc.md, bible/03-World/Tamriel-Biomes.md.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { harvestNode } from '../../server-account/src/professions.js';
import {
  nodeSlots, treeSlots, trees, tree, nodeKey, pixelKey, pixelReport, parseReport, witnessedFact, jungleWoods, jungleGroundOk,
  JUNGLE_GROUND, JUNGLE_TREE_SLOTS, NODE_COUNTS, WITNESS,
} from '../../src/net/nodeLaw.js';
import { CLIMATES, CYRODIIL_REGION, regionOfTheatre, theatreOfRegion } from '../../src/formats/mapsTables.js';
import { BIOMES } from '../../src/world/tamriel/tamrielBiomes.js';
import { PROVINCE_OF_ID } from '../../src/world/tamriel/tamrielLand.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { withJungleWord } from '../../src/scenes/gatherHost.js';
import { standTrees } from '../../src/scenes/treeHost.js';
import { tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';

const NOW = T0, TODAY = utcDay(NOW), R = CLIMATES.Swamp;   // Blackwood's (Cyrodiil's and Valenwood's Rainforest stand 48 on confirmed ground by their richness - WW-C1)
/** A pixel of Cyrodiil's past the Bay. */
const CX = 2400, CY = 900;
const VALENWOOD = regionOfTheatre(6), SKYRIM = regionOfTheatre(3);

test('AUDIT TESA II J5 the law: a pixel\'s jungle word is witnessed with its ground - an old report reads no jungle; the jungle\'s trees stand on confirmed jungle ground past the Bay alone, where a jungle zone may stand (mutants: the word unwitnessed; the ground unbounded; the report\'s bit dropped)', () => {
  assert.equal(pixelReport(R, CYRODIIL_REGION), `${R},${CYRODIIL_REGION}`, 'no jungle: the report it always was');
  assert.equal(pixelReport(R, CYRODIIL_REGION, true), `${R},${CYRODIIL_REGION},1`);
  assert.deepEqual(parseReport(`${R},${CYRODIIL_REGION},1`), { climate: R, region: CYRODIIL_REGION, jungle: true });
  assert.deepEqual(parseReport(`${R},${CYRODIIL_REGION}`), { climate: R, region: CYRODIIL_REGION });
  assert.equal(parseReport(`${R},${CYRODIIL_REGION},2`), null);
  const rows = ['a', 'b', 'c'].map((account, i) => ({ account, report: pixelReport(R, CYRODIIL_REGION, true), at: i }));
  assert.deepEqual(witnessedFact(rows), { state: 'confirmed', climate: R, region: CYRODIIL_REGION, jungle: true });
  // the slots: the jungle's on confirmed jungle ground past the Bay, the climate's everywhere else
  const p = { x: CX, y: CY, climate: R, region: CYRODIIL_REGION };
  assert.equal(nodeSlots('tree', { ...p, confirmed: true, jungle: true }), JUNGLE_TREE_SLOTS);
  assert.equal(nodeSlots('tree', { ...p, confirmed: false, jungle: true }), NODE_COUNTS[R].tree, 'unconfirmed: the least the kind allows');
  assert.equal(nodeSlots('tree', { ...p, confirmed: true, jungle: false }), nodeSlots('tree', { ...p, confirmed: true }));
  assert.equal(nodeSlots('tree', { ...p, confirmed: true }), 24, 'Blackwood\'s swamp without the word: its climate\'s six times Cyrodiil\'s richness');
  assert.equal(nodeSlots('tree', { ...p, region: SKYRIM, confirmed: true, jungle: true }), nodeSlots('tree', { ...p, region: SKYRIM, confirmed: true }), 'Skyrim stands no jungle');
  assert.equal(nodeSlots('tree', { ...p, climate: CLIMATES.Woodlands, confirmed: true, jungle: true }), nodeSlots('tree', { ...p, climate: CLIMATES.Woodlands, confirmed: true }), 'nor the valley\'s grass');
  assert.equal(nodeSlots('tree', { ...p, x: 300, y: 200, confirmed: true, jungle: true }), nodeSlots('tree', { ...p, x: 300, y: 200, confirmed: true }), 'nor any pixel of the Bay\'s map (Bantha\'s area is its own)');
  assert.equal(treeSlots({ ...p, x: CX + 3, region: VALENWOOD, confirmed: true, jungle: true }), JUNGLE_TREE_SLOTS, 'Valenwood\'s forest');
  assert.equal(trees({ ...p, day: TODAY, confirmed: true, jungle: true }).length, JUNGLE_TREE_SLOTS, 'every slot of the jungle stands a tree');
  assert.equal(tree({ ...p, day: TODAY, slot: JUNGLE_TREE_SLOTS - 1, confirmed: true, jungle: true })?.slot, JUNGLE_TREE_SLOTS - 1);
  assert.equal(jungleWoods({ ...p, confirmed: true, jungle: true }), true);
});

test('AUDIT TESA II J5: where a jungle zone may stand is the zones\' own - every jungle zone\'s province and climate, and no other (the service holds no world module to read them by: held here)', () => {
  const zones = BIOMES.filter((b) => b.jungle);
  const id = (key) => Number(Object.keys(PROVINCE_OF_ID).find((k) => PROVINCE_OF_ID[k] === key));
  assert.deepEqual([...new Set(zones.map((b) => id(b.province)))].sort(), [...JUNGLE_GROUND.theatres].sort());
  assert.deepEqual([...new Set(zones.map((b) => b.climate))].sort(), [...JUNGLE_GROUND.climates].sort());
  for (const b of zones) assert.ok(jungleGroundOk(CX, CY, b.climate, regionOfTheatre(id(b.province))), b.key);
  assert.equal(theatreOfRegion(CYRODIIL_REGION), 9);
});

test('AUDIT TESA II J5 the service: a jungle word on ground no jungle zone can stand is refused; three witnesses\' jungle stands the jungle\'s trees, an unconfirmed one its climate\'s; a confirmed pixel\'s word is the witnesses\' (mutants: the service blind to the word; no ground check; the fact\'s word unread)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const realNow = Date.now;
  Date.now = () => NOW * 1000;
  try {
    const w = await s.registered('Mac');
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOW - WITNESS.ageS, w.id);
    const row = () => raw.prepare('SELECT * FROM players WHERE id = ?').get(w.id);
    raw.prepare('INSERT OR REPLACE INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)').run(w.id, w.character, 'logging', 100_000, NOW);
    const ask = (x, y, slot, { region = CYRODIIL_REGION, climate = R, jungle = true } = {}, rid) => harvestNode({ db: s.env.DB, nowS: NOW, rand: (b) => globalThis.crypto.getRandomValues(b) }, row(), s.env, {
      character: w.character, node: nodeKey({ kind: 'tree', x, y, day: TODAY, slot }), kind: 'logs', climate, region, act: { cuts: 3, clean: 0 }, at: NOW - 2, rid, ...(jungle ? { jungle: true } : {}),
    });
    assert.equal((await ask(CX, CY, 0, { region: SKYRIM }, 'audj5-0001')).error, 'prof-pixel', 'Skyrim\'s ground holds no jungle');
    assert.equal((await ask(CX, CY, 0, { climate: CLIMATES.Woodlands }, 'audj5-0002')).error, 'prof-pixel', 'the grass holds none');
    const slot = NODE_COUNTS[R].tree + 1;
    assert.equal((await ask(CX, CY, slot, {}, 'audj5-0003')).error, 'bad-node', 'unwitnessed: the climate\'s trees alone');
    for (const name of ['Ada', 'Bram', 'Cass']) {
      const a = await s.registered(name);
      raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)').run('pixel', pixelKey(CX + 1, CY), a.id, pixelReport(R, CYRODIIL_REGION, true), CYRODIIL_REGION, NOW - 3600);
    }
    const r = await ask(CX + 1, CY, JUNGLE_TREE_SLOTS - 1, {}, 'audj5-0004');
    assert.equal(r.error, undefined, JSON.stringify(r));
    assert.equal(r.ok, true, 'the jungle\'s last tree on confirmed jungle ground');
    assert.equal((await ask(CX + 1, CY, 0, { jungle: false }, 'audj5-0005')).error, 'prof-pixel', 'a word against the witnesses\' refused');
    const witnessed = raw.prepare('SELECT report FROM world_witness WHERE key = ? AND account = ?').get(pixelKey(CX + 1, CY), w.id);
    assert.equal(witnessed?.report, pixelReport(R, CYRODIIL_REGION, true), 'the harvest witnessed the word with the ground');
  } finally { Date.now = realNow; }
});

test('AUDIT TESA II J5: the gathering says the word its pixel\'s zone holds - a jungle zone\'s pixel past the Bay, never another zone\'s, never the Bay\'s (mutants: the word unsaid; said everywhere)', () => {
  setTamrielTrace(null); setTamrielFit(null);   // the authored rings: every zone stands on them too
  let jungle = null, other = null;
  for (let y = -900; y < 1400 && !(jungle && other); y += 9) for (let x = -1800; x < 3600 && !(jungle && other); x += 9) {
    const b = tamrielBiomeAt(x, y);
    if (b?.jungle && !jungle) jungle = [x, y];
    else if (b && !b.jungle && !other) other = [x, y];
  }
  assert.ok(jungle && other, 'a jungle zone\'s pixel and another zone\'s');
  const info = { climate: R, region: CYRODIIL_REGION };
  assert.deepEqual(withJungleWord(info, ...jungle), { ...info, jungle: true }, `${tamrielBiomeAt(...jungle).key}'s`);
  assert.equal(withJungleWord(info, ...other), info, `${tamrielBiomeAt(...other).key}'s - no word`);
  assert.equal(withJungleWord(info, 300, 200), info, 'the Bay\'s - Bantha\'s area is its own law');
  assert.equal(withJungleWord(null, ...jungle), null);
  // and the trees stand by the confirmed word: a forest's flats over a confirmed jungle pixel take the jungle's 48
  const flats = Array.from({ length: 400 }, (_, i) => ({ id: i, group: 'J0', i, x: 2 + (i % 20) * 40, y: 0, z: 2 + Math.floor(i / 20) * 40 }));
  const stand = (word) => standTrees({ px: CX, py: CY, day: TODAY, climate: R, region: CYRODIIL_REGION, confirmed: true, jungle: word, forest: { trees: flats } });
  assert.equal(stand(true).length, JUNGLE_TREE_SLOTS, 'the jungle\'s word confirmed: its trees');
  assert.equal(stand(false).length, nodeSlots('tree', { x: CX, y: CY, climate: R, region: CYRODIIL_REGION, confirmed: true }), 'without it the climate\'s');
});

test('AUDIT TESA II J5 by source: the client says the word it reads off the zones, keeps the witnesses\' and stands its trees by it', () => {
  const src = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
  const gather = src('src/scenes/gatherHost.js');
  assert.match(gather, /return tamrielBiomeAt\(px, py\)\?\.jungle === true \? \{ \.\.\.info, jungle: true \} : info;/);
  assert.match(gather, /const info = book\.state\.open === true \? withJungleWord\(deps\.pixelInfo\(entry\.px, entry\.py\), entry\.px, entry\.py\) : null;/);
  assert.match(gather, /\(fact\.jungle === true\) !== \(info\.jungle === true\)/);
  assert.match(gather, /\.\.\.\(a\.info\?\.jungle === true \? \{ jungle: true \} : \{\}\),/);
  assert.match(src('src/scenes/treeHost.js'), /confirmed, jungle: info\.jungle === true, forest:/);
  const book = src('src/net/profBook.js');
  assert.match(book, /\.\.\.\(h\.jungle === true \? \{ jungle: true \} : \{\}\),/);
  assert.match(book, /\.\.\.\(p\.jungle === true \? \{ jungle: true \} : \{\}\) \}\);/);
  assert.match(src('server-account/src/professions.js'), /const factView = \(f\) => \(factConfirmed\(f\) \? \{ state: f\.state, climate: f\.climate, region: f\.region, \.\.\.\(f\.jungle \? \{ jungle: true \} : \{\}\) \}/);
});
