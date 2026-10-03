// PROF8 (2026-09-30, Mac: "Continue the arc"; "XP follows your rank") - FISHING'S CLIENT: the net's act (the wind and
// its throw, the wait and its clock, the tug, the haul's band and weight, a full net or a plain one, gentle acts, Esc);
// the kind in the gathering host (the cast only with a net in the net's water, its key and its ground, the plan and its
// words, Foraging's refusals, the day's schools on water and a cast landing in one, the species named, a trophy once);
// the meter; the book's day; the page; the host's wiring. bible/06-Systems/Professions-Arc.md 5.2, 30.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createFishAct, FLY_S, WIND_HOLD_S } from '../src/systems/fishAct.js';
import {
  fishKind, fishPlan, haulLine, speciesOfHaul, keyRng, bearingWord, haulId, standSchools, NET_WHERE_WORDS, CAST_AHEAD_M, SCHOOL_PICTURE,
} from '../src/scenes/fishHost.js';
import { parseNodeKey, haulKey, utcDayOfMs, SCHOOL_R } from '../src/net/nodeLaw.js';
import { FISH_ACT, tugWindow, HAULS_PER_DAY, PEARL, fishBand } from '../src/net/professionLaw.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { PASSIVE_FISH_SPECIES } from '../src/world/passiveFish.js';
import { climateToBiome } from '../src/world/underwaterDecorations.js';
import { createProfHud } from '../src/ui/profHud.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { WORLD_MAP_TILE_DIM } from '../src/world/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WOODS = 231, OCEAN = 223;
/** Run an act to its end: `input(st)` the frame's keys. */
function run(act, input, max = 4000) {
  let n = 0;
  while (!act.state.done && !act.state.cancelled && n++ < max) act.tick(0.05, input(act.state));
  return act;
}
/** Wind for `s` seconds and let go. */
function throwFor(act, s) {
  for (let t = 0; t < s - 1e-9; t += 0.05) act.tick(0.05, { held: true });
  act.tick(0.05, { held: false });
}
const waitOut = (act) => { for (let n = 0; n < 4000 && !act.state.done && (act.state.phase === 'fly' || act.state.phase === 'wait'); n++) act.tick(0.05, { held: false }); };
/** A hand that follows the weight: the band raised while it is below it. */
const follow = (st) => ({ held: st.phase === 'haul' ? st.bandAt + st.bandW / 2 < st.weight : false });

// ─── THE ACT ─────────────────────────────────────────────────────────

test('PROF8 act: the wind - held, the net winds (3 m at 0.3 s to 12 m at 1.5 s); let go, it flies; a wind forgotten down is thrown at its longest; the wait its clock\'s (5-30 s, halved at the day\'s first hour, doubled in a storm)', () => {
  const a = createFishAct({ rng: () => 0.5 });
  assert.equal(a.state.phase, 'wind');
  throwFor(a, 0.9);
  assert.equal(a.state.phase, 'fly');
  assert.ok(Math.abs(a.state.throwM - 7.5) < 0.6, `about 7.5 m (${a.state.throwM})`);
  const short = createFishAct({});
  short.tick(0.05, { held: false });
  assert.deepEqual([short.state.phase, short.state.throwM], ['fly', FISH_ACT.throwMinM], 'let go at once: the shortest throw');
  const held = createFishAct({});
  for (let i = 0; i < (WIND_HOLD_S + 1) / 0.05; i++) held.tick(0.05, { held: true });
  assert.deepEqual([held.state.phase === 'wind', held.state.throwM], [false, FISH_ACT.throwMaxM], 'thrown at its longest');
  // the wait: its range, and its clock
  const waitOf = (o) => { const x = createFishAct({ rng: () => 0.5, ...o }); x.tick(0.05, { held: false }); for (let t = 0; t <= FLY_S + 0.05; t += 0.05) x.tick(0.05, {}); return x.state.waitS; };
  assert.equal(waitOf({}), 17.5);
  assert.equal(waitOf({ hour: 7 }), 8.75);
  assert.equal(waitOf({ hour: 17, storm: true }), 17.5);
  assert.equal(waitOf({ storm: true }), 35);
  assert.equal(waitOf({ rng: () => 0 }), 5);
});

test('PROF8 act: the tug - E (a new press) or attack inside 600 ms (an Angler\'s 840) hauls; missed, a plain net ("missed"); a key held down from the wind is no press', () => {
  const tug = (o, press) => {
    const a = createFishAct({ rng: () => 0.5, ...o });
    throwFor(a, 0.3);
    waitOut(a);
    assert.equal(a.state.phase, 'tug');
    let t = 0;
    while (a.state.phase === 'tug' && t < press) { a.tick(0.05, {}); t += 0.05; }
    if (a.state.phase === 'tug') a.tick(0.05, { attack: true });
    return a;
  };
  assert.equal(tug({}, 0.5).state.phase, 'haul');
  const late = tug({}, 0.7);
  assert.deepEqual([late.state.done, late.report().clean, late.report().why, late.report().tugged], [true, false, 'missed', false]);
  assert.equal(tug({ angler: true }, 0.75).state.phase, 'haul', 'an Angler\'s window is wider');
  assert.ok(Math.abs(tugWindow(true) - 0.84) < 1e-9);
  // the floats dip: the host told once (its buzz, TI2's pulse)
  let buzzed = 0;
  const b = createFishAct({ rng: () => 0.5, onTug: () => { buzzed++; } });
  throwFor(b, 0.3);
  waitOut(b);
  b.tick(0.05, {});
  assert.deepEqual([b.state.phase, buzzed], ['tug', 1]);
  assert.match(src('src/scenes/world.js'), /tug: \(\) => \{ if \(!getPref\('touchHaptics'\)\) return; try \{ navigator\.vibrate\?\.\(120\); \}/);
  // a press of E: the level going down, not a key held since the wind
  const e = createFishAct({ rng: () => 0.5 });
  throwFor(e, 0.3);
  for (let n = 0; n < 4000 && (e.state.phase === 'fly' || e.state.phase === 'wait'); n++) e.tick(0.05, { held: true });
  e.tick(0.05, { held: true });
  assert.equal(e.state.phase, 'tug', 'held all along: no press');
  e.tick(0.05, { held: false });
  e.tick(0.05, { held: true });
  assert.equal(e.state.phase, 'haul', 'let go and pressed again: the tug taken');
});

test('PROF8 act: the haul - the weight kept inside the band fills a full net (clean); two seconds outside in all comes in plain ("slipped"); twenty seconds without filling, plain ("slow"); the band\'s width the rank\'s', () => {
  const haul = (rng, input) => {
    const a = createFishAct({ rng });
    throwFor(a, 0.3);
    waitOut(a);
    a.tick(0.05, { attack: true });
    assert.equal(a.state.phase, 'haul');
    return run(a, input);
  };
  const good = haul(() => 0.5, follow);
  assert.deepEqual([good.report().clean, good.report().tugged, good.report().why], [true, true, null]);
  assert.ok(good.state.haulS <= FISH_ACT.haulS);
  const dropped = haul(() => 0.5, (st) => ({ held: false, attack: false, ...(st.phase === 'haul' && st.weight < 0.3 ? {} : {}) }));
  assert.equal(dropped.report().clean, false);
  assert.ok(['slipped', 'slow'].includes(dropped.report().why), dropped.report().why);
  // the weight parked outside a band held at the top: slipped
  const slip = createFishAct({ rng: () => 0.5 });
  throwFor(slip, 0.3); waitOut(slip); slip.tick(0.05, { attack: true });
  slip.state.weight = 0; slip.state.speed = 0;
  run(slip, () => ({ held: true }));
  assert.deepEqual([slip.report().clean, slip.report().why, slip.report().slipped], [false, 'slipped', true]);
  assert.ok(slip.state.haulS >= FISH_ACT.slipS - 0.1 && slip.state.haulS <= FISH_ACT.slipS + 0.2, 'two seconds outside');
  // the band's width: a Novice's 20%, a Master's 30%, an attribute band's widening on top
  assert.ok(Math.abs(createFishAct({ rank: 0 }).state.bandW - fishBand(0)) < 1e-9);
  assert.ok(Math.abs(createFishAct({ rank: 100, band: 1.3 }).state.bandW - 0.39) < 1e-9);
});

test('PROF8 act: gentle acts - no moment, a plain net after the wait; Esc - nothing, no report; the school the cast landed in, in the report', () => {
  const g = createFishAct({ gentle: true, rng: () => 0 });
  throwFor(g, 0.3);
  waitOut(g);
  assert.deepEqual([g.state.done, g.report().clean], [true, false]);
  const c = createFishAct({});
  throwFor(c, 0.3);
  c.cancel();
  assert.equal(c.report(), null);
  const s = createFishAct({ rng: () => 0.5, schoolAt: (m) => (m > 10 ? 1 : null) });
  throwFor(s, 2);
  const near = createFishAct({ rng: () => 0.5, schoolAt: (m) => (m > 10 ? 1 : null) });
  throwFor(near, 0.3);
  assert.deepEqual([s.state.school, near.state.school], [1, null]);
  waitOut(s); s.tick(0.05, { attack: true }); run(s, follow);
  assert.equal(s.report().school, 1);
  waitOut(near); near.tick(0.05, { attack: true }); run(near, follow);
  assert.equal('school' in near.report(), false);
});

// ─── THE KIND ────────────────────────────────────────────────────────

test('PROF8 plan and words: cast the net, or what it needs - the ground\'s refusal, the account\'s forty, the Stores\' room; a school near said; the goods\' line names the species, as Raw Fish, with a Pearl and the scales; the refusal\'s words', () => {
  const base = { taken: false, counting: false, hauls: 3, rank: 12, storesFull: false };
  assert.deepEqual(fishPlan(base), { harvest: 'fish', verb: 'Cast the net', rest: 'Fishing 12', ready: true });
  assert.equal(fishPlan({ ...base, school: 'a school rises 14 m north' }).rest, 'Fishing 12 - a school rises 14 m north');
  // PIN MOVED (ANY-HOUR, 2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"): the
  // ground's words were the daylight's too ("the fish bite by daylight (07:00-17:59)"); now a settlement's
  assert.deepEqual(fishPlan({ ...base, where: NET_WHERE_WORDS.town }), { harvest: 'fish', verb: 'Cast the net', rest: 'not in a settlement', ready: false });
  assert.equal(NET_WHERE_WORDS.daylight, undefined, 'no hour has words');
  assert.deepEqual(fishPlan({ ...base, hauls: HAULS_PER_DAY }), { harvest: 'fish', verb: 'Cast the net', rest: 'Fishing 12 - 40 of 40 hauls today', ready: false, full: true });
  assert.equal(fishPlan({ ...base, storesFull: true }).ready, false);
  assert.equal(fishPlan({ ...base, counting: true }).rest, 'being counted');
  const bass = PASSIVE_FISH_SPECIES.find((s) => s.templateIndex === 9002);
  assert.equal(haulLine({ qty: 2, gem: PEARL.key, extra: 'hide:slaughterfish', extraQty: 1 }, bass), '+2 Largemouth Bass, as Raw Fish, a Pearl and Slaughterfish Scales to your Stores', '5.2\'s toast: "+2 Largemouth Bass, as Raw Fish"');
  assert.equal(haulLine({ qty: 1 }, bass), '+1 Largemouth Bass, as Raw Fish to your Stores');
  assert.equal(haulLine({ qty: 2 }, null), '+2 Raw Fish to your Stores');
  assert.match(accountRefusalText('prof-fish-cap'), /all the nets a day allows \(40, across your characters\)/);
  assert.equal(bearingWord(0, 10), 'north');
  assert.equal(bearingWord(10, 0), 'east');
  assert.equal(bearingWord(-7, -7), 'south-west');
  assert.match(haulId(() => 0.99), /^f{12}$/);
});

test('PROF8 species: Deep Waters\' own for the pixel\'s water - drawn from the haul\'s key, so every answer names the same fish; the sea\'s fish at sea, a lake\'s in the Woodlands', () => {
  const k = haulKey({ x: 300, y: 200, day: 20724, id: '0123456789ab' });
  assert.equal(speciesOfHaul(k, WOODS), speciesOfHaul(k, WOODS), 'the same key, the same fish');
  const r = keyRng('abc');
  assert.equal(keyRng('abc')(), r());
  const drawn = (climate) => new Set(Array.from({ length: 300 }, (_, i) => speciesOfHaul(haulKey({ x: 1, y: 1, day: 1, id: i.toString(16).padStart(12, '0') }), climate).templateIndex));
  const woods = drawn(WOODS), sea = drawn(OCEAN);
  const lives = (climate) => (t) => (PASSIVE_FISH_SPECIES.find((s) => s.templateIndex === t).biomes & climateToBiome(climate)) !== 0;
  assert.ok([...woods].every(lives(WOODS)), `a Woodlands haul: its waters' fish (${[...woods]})`);
  assert.ok([...sea].every(lives(OCEAN)), `a sea haul: the sea's (${[...sea]})`);
  assert.ok(woods.has(9002) || woods.has(9004), 'the bass or the carp');
  assert.ok(!sea.has(9002), 'no bass at sea');
});

/** A fake book: the day, the taken, the Stores. */
function fakeBook(o = {}) {
  const taken = new Set();
  return {
    state: { open: true, hauls: 0, caps: { hauls: 40, stores: 5000 }, ...o },
    taken: (k) => taken.has(k), counting: () => false, held: () => 0, _take: (k) => taken.add(k),
  };
}
/** Foraging's world as the net reads it. */
const world = (o = {}) => ({
  inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS,
  region: 17, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: true, exteriorWater: 'Swimming', ...o,
});
const NET = { templateIndex: 1603, currentCondition: 50 };

test('PROF8 kind: the cast stands ahead of the look only with a Fishing-Net in the pack and the player in the net\'s water, never underground; its key the pixel\'s and the day\'s, a new one once its haul is asked', () => {
  let w = world();
  const prev = setForagingHost({ world: () => w, entity: () => null });
  try {
    const book = fakeBook();
    let r = 0;
    const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: WOODS, region: 17 }), eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), feet: () => [0, 0, 0], hour: () => 12, storm: () => false, climateAt: () => WOODS, trophy: () => true, day: () => 20724, rand: () => ((r++ % 13) + 0.5) / 16 };
    const k = fishKind({ book, host });
    const entity = { items: [NET] };
    const [cast] = k.looseNodesOf({ entity, dungeon: false });
    assert.ok(cast, 'a net, in water: a cast');
    assert.deepEqual(parseNodeKey(cast.key), { kind: 'haul', x: 300, y: 200, day: 20724, id: '0123456789ab' });
    assert.deepEqual(cast.at(), [0, 1.6, CAST_AHEAD_M], 'just ahead of the look, where it crosses there (PIN MOVED, CAST-LOOK: it stood 0.6 m under the eye whatever the look)');
    assert.equal(k.looseNodesOf({ entity, dungeon: false })[0].key, cast.key, 'the same cast until its haul');
    book._take(cast.key);
    assert.notEqual(k.looseNodesOf({ entity, dungeon: false })[0].key, cast.key, 'asked: a new one');
    assert.equal(k.gone(cast), true);
    assert.deepEqual(k.looseNodesOf({ entity: { items: [] }, dungeon: false }), [], 'no net');
    assert.deepEqual(k.looseNodesOf({ entity: { items: [{ ...NET, currentCondition: 0 }] }, dungeon: false }), [], 'a broken net');
    assert.deepEqual(k.looseNodesOf({ entity, dungeon: true }), [], 'never underground');
    w = world({ swimming: false, exteriorWater: 'None' });
    assert.deepEqual(k.looseNodesOf({ entity, dungeon: false }), [], 'on dry land');
    w = world({ swimming: false, exteriorWater: 'None', climate: OCEAN });
    assert.equal(k.looseNodesOf({ entity, dungeon: false }).length, 1, 'at sea (a boat, a pier - the Ocean\'s climate), as the net reads it');
  } finally { setForagingHost(prev); }
});

test('PROF8 kind: the plan (the page\'s rank, the ground\'s words, the account\'s day), the start (Foraging\'s own refusal first; the act, its ground asked with it), the chip, the notes', () => {
  let w = world();
  const prev = setForagingHost({ world: () => w, entity: () => null });
  try {
    const book = fakeBook({ hauls: 5 });
    const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: WOODS, region: 17 }), eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), feet: () => [0, 0, 0], hour: () => 12, storm: () => false, climateAt: () => WOODS, trophy: () => true, day: () => 20724 };
    const k = fishKind({ book, host });
    const entity = { items: [NET], stats: {} };
    const [cast] = k.looseNodesOf({ entity, dungeon: false });
    const rank = () => 7;
    const specs = () => ({ 50: 'angler', 100: null });
    const plan = k.plan(cast, { rank, keyLabel: () => 'E' });
    assert.deepEqual([plan.verb, plan.rest, plan.ready, plan.profession], ['Cast the net', 'Fishing 7', true, 'fishing']);
    // PIN MOVED (ANY-HOUR): 21:00 put the daylight's words on the prompt; now the net is cast by night
    w = world({ hour: 21 });
    assert.deepEqual([k.plan(cast, { rank, keyLabel: () => 'E' }).rest, k.plan(cast, { rank, keyLabel: () => 'E' }).ready], ['Fishing 7', true], 'by night as by day');
    assert.equal(k.start(cast, plan, { entity, rank, specs, keyLabel: () => 'E' }).act?.state.kind, 'fish', 'and started');
    w = world({ enemiesNear: true });
    assert.deepEqual(k.start(cast, plan, { entity, rank, specs, keyLabel: () => 'E' }), { refused: 'You cannot fish with enemies nearby!' }, 'Foraging\'s own line');
    w = world();
    const a = k.start(cast, plan, { entity, rank, specs, keyLabel: () => 'E' });
    assert.equal(a.act.state.kind, 'fish');
    assert.ok(Math.abs(a.act.state.tugS - tugWindow(true)) < 1e-9, 'an Angler\'s tug');
    assert.deepEqual([a.harvest, a.profession, a.label, a.ask], ['fish', 'fishing', 'E', { climate: WOODS, region: 17 }]);
    assert.equal(a.tool, NET);
    assert.deepEqual(k.tally(), { n: 5, cap: 40 });
    assert.equal(k.actNote({ clean: true }), ' (a full net)');
    assert.equal(k.actNote({ clean: false, why: 'missed' }), ' (the tug missed - a plain haul)');
    assert.equal(k.actNote({ clean: false, why: 'slipped' }), ' (the net slipped - a plain haul)');
    assert.equal(k.title(), 'Angler');
  } finally { setForagingHost(prev); }
});

test('PROF8 schools: the day\'s two stood on water (none on dry ground), their flats the fish\'s own and never a target; the prompt says one near; a cast that lands within SCHOOL_R of one is its haul', () => {
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION);
  const water = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM);   // tile 0: water
  const land = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM).fill(2);
  const stood = standSchools({ px: 300, py: 200, day: 20724, samples, tilemap: water });
  assert.deepEqual(stood.map((s) => s.k), [0, 1]);
  assert.ok(stood.every((s) => s.school && s.local[0] >= 0 && s.local[0] <= TERRAIN_SIZE && s.local[2] >= 0 && s.local[2] <= TERRAIN_SIZE));
  assert.deepEqual(standSchools({ px: 300, py: 200, day: 20724, samples, tilemap: land }), [], 'no water, no school');
  let w = world();
  const prev = setForagingHost({ world: () => w, entity: () => null });
  try {
    const s0 = stood[0];
    let eye = { pos: [s0.local[0] - 8, 1.6, s0.local[2]], dir: [1, 0, 0] };
    const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: WOODS, region: 17 }), eye: () => eye, feet: () => eye.pos, hour: () => 12, storm: () => false, climateAt: () => WOODS, trophy: () => true, day: () => 20724 };
    const book = fakeBook();
    const k = fishKind({ book, host });
    const entry = { px: 300, py: 200, samples, tilemap: water };
    const nodes = k.nodesOf({ entry, px: 300, py: 200, day: 20724 });
    k.stood(entry, nodes);
    k.frame(0, { feet: eye.pos, translation: (e) => (e === entry ? [0, 0, 0] : null) });
    assert.ok(nodes.every((n) => k.gone(n)), 'never a target');
    const [flat] = k.goneFlatsOf(nodes[0], entry);
    assert.deepEqual([flat.archive, flat.record, flat.centers.length], [...SCHOOL_PICTURE, 3], 'the Fish item\'s own picture, three on the water');
    const fish = JSON.parse(src('vendor/foraging/ItemTemplates.json')).find((t) => t.index === 1605);
    assert.deepEqual([fish.worldTextureArchive, fish.worldTextureRecord], [...SCHOOL_PICTURE], 'Foraging\'s Fish, DFU\'s own picture');
    const [cast] = k.looseNodesOf({ entity: { items: [NET] }, dungeon: false });
    assert.match(k.plan(cast, { rank: () => 0, keyLabel: () => 'E' }).rest, /^Fishing 0 - a school rises 8 m east$/);
    const start = () => k.start(cast, { harvest: 'fish' }, { entity: { items: [NET] }, rank: () => 0, specs: () => ({ 50: null, 100: null }), keyLabel: () => 'E' });
    const on = start().act;
    throwFor(on, 0.9);   // about 7.5 m: onto it
    assert.equal(on.state.school, s0.k);
    eye = { pos: [s0.local[0] - 8, 1.6, s0.local[2]], dir: [-1, 0, 0] };
    const away = start().act;
    throwFor(away, 0.9);
    assert.equal(away.state.school, null, 'thrown the other way');
    assert.ok(SCHOOL_R >= 10);
  } finally { setForagingHost(prev); }
});

test('PROF8 answers: the goods\' line the kind\'s (the species named), and a trophy - the species\' own item into the pack ONCE, however many answers say it', () => {
  const minted = [];
  const book = fakeBook();
  const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: WOODS, region: 17 }), eye: () => ({ pos: [0, 0, 0], dir: [0, 0, 1] }), feet: () => [0, 0, 0], hour: () => 12, storm: () => false, climateAt: () => WOODS, trophy: (s) => { minted.push(s.templateIndex); return true; }, day: () => 20724 };
  const k = fishKind({ book, host });
  const node = haulKey({ x: 300, y: 200, day: 20724, id: 'abcdefabcdef' });
  const species = speciesOfHaul(node, WOODS);
  assert.equal(k.storesLine({ node, qty: 2 }), haulLine({ qty: 2 }, species));
  const said = [];
  k.answered({ node, qty: 1, trophy: true }, (t) => said.push(t));
  k.answered({ node, qty: 1, trophy: true, repeat: true }, (t) => said.push(t));
  k.answered({ node: haulKey({ x: 300, y: 200, day: 20724, id: '000000000001' }), qty: 1 }, (t) => said.push(t));
  assert.deepEqual(minted, [species.templateIndex]);
  assert.deepEqual(said, [`A trophy ${species.itemName} - it is in your pack.`]);
  // the host hooks read them
  const gh = src('src/scenes/gatherHost.js');
  assert.match(gh, /hud\.toast\(k\?\.storesLine \? k\.storesLine\(d\) : storesLine\(d\), \{ keep: true \}\);/);
  assert.match(gh, /try \{ k\?\.answered\?\.\(d, \(t\) => hud\.toast\(t\), \{ hauled \}\); \}/);   // HAUL-CARDS (PIN MOVED): whether its card said the goods
  assert.match(gh, /if \(!n \|\| n\.kind === 'body' \|\| n\.kind === 'haul'\) return;/);
});

// ─── THE METER, THE BOOK, THE PAGE, THE HOST ─────────────────────────

test('PROF8 meter: each phase its words - wind (the throw it makes), the wait (over a school), the tug flashed, the haul\'s band and weight on the bar and its fill under it', () => {
  const hud = createProfHud();
  const meter = () => document.body.querySelector('.prof-meter');
  const a = createFishAct({ rng: () => 0.5, schoolAt: () => 0 });
  hud.setMeter(a, 'E');
  assert.match(meter().textContent, /hold E to wind the net, let go to throw it \(3 m\)/);
  throwFor(a, 0.3);
  a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {}); a.tick(0.05, {});
  hud.setMeter(a, 'E');
  assert.match(meter().textContent, /waiting for a bite - over a school/);
  waitOut(a);
  hud.setMeter(a, 'E');
  assert.match(meter().textContent, /a tug! press E now/);
  assert.ok(meter().className.split(' ').includes('fish-tug'), 'the tug flashed (PROF-SCENES: on the panel, whole)');
  a.tick(0.05, { attack: true });
  hud.setMeter(a, 'E');
  assert.match(meter().textContent, /hold E to raise the band, let go to lower it - keep the weight inside/);
  assert.ok(meter().querySelector('.prof-haulband') && meter().querySelector('.prof-haulweight'));
  hud.setMeter(null);
});

test('PROF8 book, page, words and wiring: the book keeps the account\'s hauls (the state\'s, an answer\'s, a refusal\'s forty); the page practises Fishing and says its day and how; the host builds the kind over its world', () => {
  const pb = src('src/net/profBook.js');
  assert.match(pb, /applyHauls\(data\?\.hauls\);/);
  assert.match(pb, /applyHauls\(r\.data\?\.hauls\);/);
  assert.match(pb, /if \(r\?\.error === 'prof-fish-cap'\) state\.hauls = Math\.max\(state\.hauls \?\? 0, state\.caps\?\.hauls \?\? HAULS_PER_DAY\);/);
  const pp = src('src/ui/profPages.js');
  assert.match(pp, /const PRACTISED = Object\.freeze\(\['herbalism', 'mining', 'hunting', 'fishing',/);
  assert.match(pp, /Today: \$\{book\.state\.hauls \?\? 0\} of \$\{book\.state\.caps\?\.hauls \?\? HAULS_PER_DAY\} hauls - your account's, across your characters/);
  const w = src('src/scenes/world.js');
  assert.match(w, /fishKind\(\{ book: profBook, host: \{/);
  assert.match(w, /storm: \(\) => currentWeather\(\) === 'thunder',/);
  assert.match(w, /const item = createFishItem\(species\);\n\s+if \(!item\) return false;\n\s+addItem\(\(playerEntity\.items \?\?= \[\]\), item\);/);
  assert.match(src('server-account/src/index.js'), /'prof-fish-cap': 409,/);
  assert.equal(utcDayOfMs(86_400_000 * 3 + 5), 3);
});
