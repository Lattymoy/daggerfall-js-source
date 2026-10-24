// ORE-MAP (FIELD BUGS 2026-10-11d #4, the Discord's "Arbitrary mining conditions to 'unlock' higher nodes.": "how are we
// supposed to tell if higher tier veins have been unlocked in an area?" and "If at all possible can you please add
// something to the overworld map like 'this area is known for X ore'"). The held map's bare ground answers with a card
// (ui/oreMapTip.js): the ground's veins (its climate's table), its dungeons' deep veins, its kingdom's own ore, and
// whether the witnesses have vouched for it - every word read off the law that stands the veins, so the card cannot
// promise an ore the ground would not give. The world host hands the map the card and asks the ground's witnessed
// state once a pixel, through the gathering host. bible/01-Overview/bugs/Field-Bugs-2026-10-11d.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { oreMapTip, oreWord, ORE_TIP_TITLE, ORE_WITNESS_RULE } from '../../src/ui/oreMapTip.js';
import { readTip, TIP_LINES_MAX, TIP_TEXT_MAX } from '../../src/ui/eventMapMarks.js';
import { VEIN_TABLES, veins, regionSignature, UNCONFIRMED_VEIN_TIER } from '../../src/net/nodeLaw.js';
import { minedMaterial } from '../../src/net/professionLaw.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { REGION_NAMES } from '../../src/formats/mapsTables.js';
import { createGatherHost } from '../../src/scenes/gatherHost.js';
import { mineKind } from '../../src/scenes/mineHost.js';
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';
import { MINING_GROUND_LINE } from '../../src/ui/professions/profPages.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const GLENUMBRA = 59, SENTINEL = 20, ORSINIUM = 26, ALIKR = 0, BETONY = 19;

test('ORE-MAP: the card says a pixel\'s veins, its dungeons\', its kingdom\'s own ore and its ground\'s witnessed state - for the report\'s own case, a Daggerfall woodland nobody has read yet (mutants: the signature unsaid; the held ores unsaid; a confirmed pixel said unwitnessed)', () => {
  assert.deepEqual(oreMapTip({ climate: CLIMATES.Woodlands, region: GLENUMBRA, fact: null }), { title: ORE_TIP_TITLE, lines: [
    'Veins: Iron, Copper, Tin, Lodestone',
    'Dungeons: Silver, Gold, Dwarven Scrap, Platinum, Adamantium, Moonstone',
    'Daggerfall\'s own ore: Moonstone',
    'Moonstone only on witnessed ground',
    ORE_WITNESS_RULE,
  ] });
  assert.deepEqual(oreMapTip({ climate: CLIMATES.Desert, region: SENTINEL, fact: { state: 'unconfirmed' } }).lines.slice(2), [
    'Sentinel\'s own ore: Ebony', 'Not yet witnessed: no Gold or Ebony here yet', ORE_WITNESS_RULE,
  ], 'the desert\'s Gold and Ebony wait on the witnesses');
  assert.deepEqual(oreMapTip({ climate: CLIMATES.Mountain, region: ORSINIUM, fact: { state: 'confirmed' } }).lines.slice(2), [
    `${REGION_NAMES[ORSINIUM]}'s own ore: Orichalcum`, 'Witnessed ground: every vein can appear here',
  ], 'a Free Land\'s own, by its name; witnessed ground holds all of it');
  assert.equal(oreMapTip({ climate: CLIMATES.Mountain, region: ORSINIUM, fact: { state: 'disputed' } }).lines.at(-1), 'Witnessed ground: every vein can appear here', 'a disputed pixel keeps its confirmed answer');
  assert.deepEqual(oreMapTip({ climate: CLIMATES.Woodlands, region: BETONY, fact: { state: 'none' } }).lines.slice(2), ['No vein here needs witnesses'], 'a March\'s woodland - no crown\'s own ore - holds nothing over Silver');
  assert.equal(oreMapTip({ climate: CLIMATES.Ocean, region: GLENUMBRA }), null, 'the sea stands no vein');
  assert.equal(oreWord('ore:mithril'), 'Mithril');
  assert.equal(oreWord('ore:dwarven'), 'Dwarven Scrap');
});

test('ORE-MAP: the card is the vein law\'s own - over every climate a vein stands in and every region, what it names is its climate\'s table and its region\'s signature, every card fits the map\'s card unclipped, and an ore it says waits on the witnesses never stands on unwitnessed ground while every other can (mutants: the held tier not UNCONFIRMED_VEIN_TIER)', () => {
  for (const [climate, table] of Object.entries(VEIN_TABLES).map(([c, t]) => [Number(c), t])) {
    for (let region = 0; region < REGION_NAMES.length; region++) {
      for (const fact of [null, { state: 'unconfirmed' }, { state: 'confirmed' }]) {
        const card = oreMapTip({ climate, region, fact });
        assert.deepEqual(readTip(card), card, `climate ${climate} region ${region}: the map's card shows it whole`);
        assert.ok(card.lines.length <= TIP_LINES_MAX && card.lines.every((l) => l.length <= TIP_TEXT_MAX));
        assert.equal(card.lines[0], `Veins: ${table.map(oreWord).join(', ')}`);
        const sig = regionSignature(region);
        assert.equal(card.lines.some((l) => l.endsWith(`'s own ore: ${sig ? oreWord(sig.ore) : ''}`)), !!sig, `region ${region}'s own ore`);
      }
    }
    // the law: an unwitnessed pixel's veins over thirty days hold none of what the card holds back
    const said = oreMapTip({ climate, region: ALIKR, fact: { state: 'none' } }).lines.join('\n');
    for (let day = 20500; day < 20530; day++) {
      for (const v of veins({ x: 300, y: 200, day, climate, region: ALIKR, confirmed: false })) {
        assert.ok(minedMaterial(v.material).tier <= UNCONFIRMED_VEIN_TIER, `${v.material} stood unwitnessed`);
        assert.ok(!new RegExp(`no [^\\n]*\\b${oreWord(v.material)}\\b`).test(said), `the card held back ${v.material}, which stands`);
      }
    }
  }
});

test('ORE-MAP: the world host hands the held map the card online, asks a pixel\'s witnessed state once and after the pointer rests, through the gathering host - which stands again a pixel of its own whose state the answer moved - and the Mining page says where to look (mutants: the card offline; asked every hover; the ask past the host; the stood pixel left on its old word)', async () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /      oreAt: profBook \? oreMapAt : null,/);
  assert.match(w, /if \(!fact && profBook\?\.state\?\.open === true && gatherHost && !_oreAsked\.has\(k\)\) \{\n\s+clearTimeout\(_oreAskTimer\);\n\s+_oreAskTimer = setTimeout\(\(\) => \{\n\s+if \(_oreAsked\.has\(k\)\) return;\n\s+_oreAsked\.add\(k\);\n\s+gatherHost\?\.askPixels\(\[\[px, py\]\]\)\.then\(\(\) => again\?\.\(\), \(\) => \{\}\);\n\s+\}, ORE_ASK_MS\);/);
  // PIN MOVED (MINE-PERKS, Professions-Arc 43): and whether the reader is a Surveyor, whose own word witnesses the ground
  assert.match(w, /return oreMapTip\(\{ climate: maps\.getClimateIndex\(px, py\), region: maps\.getRegionIndexAt\(px, py\), fact, surveyed \}\);/, 'the ground\'s own climate and region, as the gathering host reads them');
  assert.match(w, /pixelInfo: \(x, y\) => \{ try \{ return \{ climate: maps\.getClimateIndex\(x, y\), region: maps\.getRegionIndexAt\(x, y\) \}; \}/, 'the same reads the veins stand by');
  assert.match(MINING_GROUND_LINE, /Point at open ground on the world map to see what its veins hold and whether it has been witnessed yet\.$/);   // VOICE1 (PIN MOVED): the same law in plain words
  // the gathering host's ask: a pixel it stands, answered as changed, is stood again
  const WOODS = CLIMATES.Woodlands, PX = 405, PY = 150, DAY = 20500;
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA, confirmed: false });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  let fact = null;
  const asked = [];
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => fact, pump: () => {},
    askPixels: async (list) => { asked.push(list); fact = { state: 'confirmed', climate: WOODS, region: GLENUMBRA }; return [{ x: PX, y: PY, state: 'confirmed' }]; },
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  const built = new Map([[`${PX},${PY}`, entry]]);
  const host = createGatherHost({
    book, kinds: [mineKind({ book })], hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => DAY * 86_400_000 + 43_200_000,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [], stats: {} }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true, activeDungeon: () => false,
  });
  const tick = () => new Promise((r) => setImmediate(r));
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  assert.ok(!host.nodesOf(PX, PY).some((n) => n.material === 'ore:moonstone'), 'unwitnessed: no Moonstone');
  const changed = await host.askPixels([[PX, PY]]);
  for (let i = 0; i < 4; i++) await tick();
  assert.deepEqual(asked, [[[PX, PY]]], 'through the one book');
  assert.deepEqual(changed, [{ x: PX, y: PY, state: 'confirmed' }]);
  assert.ok(host.nodesOf(PX, PY).some((n) => n.material === 'ore:moonstone'), 'witnessed on the map\'s ask: its Moonstone stands at once');
  host.dispose?.();
});
