// THE GENERATOR - every archetype in every theatre's style on ground
// that suits it keeps the contract; the terraces follow the land and every step is climbable; decks stand clear of their
// ground; regenerating keeps every anchor's key; a site the archetype cannot stand on says so. The grounds are the probe's
// (tools/settlementProbe.mjs SYNTHETIC), so the pictures and the pins read one land. A Hammerfell place beside a Bay one
// (TAMRIEL-WIDE). Pins mutation-checked (tools/mutants/rmbc2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSettlement, layoutSettlement, GENERATOR_ID, SETTLEMENT_GENERATOR_VERSION, DECK_CLEAR } from '../../../src/world/settlement/settlementGen.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES, styleOfTheatre } from '../../../src/world/settlement/settlementStyles.js';
import { settlementPrint, groundAt, padAt, STEP_MAX, validateSettlement } from '../../../src/world/settlement/settlementContract.js';
import { BUILDING_TYPES as T, isResidence } from '../../../src/world/buildingNames.js';
import { GUILD_FACTION_IDS, DIVINES } from '../../../src/systems/guild/guildFactions.js';
import { THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { arenaPlaceId } from '../../../src/world/arenaLocations.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const PAST_BAY = arenaPlaceId({ provinceIndex: 1, id: 3 });
const SITE = { east: 400, north: 400, radius: 90 };
const gen = (archetype, style, o = {}) => generateSettlement({
  place: o.place ?? PAST_BAY, origin: o.origin ?? { px: 1000, py: 200, east: 0, north: 0 }, seed: o.seed ?? 1, archetype, style, site: SITE,
  env: o.env ?? SYNTHETIC[archetype], ...o,
});

test('RMBC2 the data: a style for every theatre (the Bay and the nine provinces), and the six archetypes (mutant: a theatre\'s style dropped)', () => {
  assert.deepEqual(Object.keys(SETTLEMENT_STYLES).sort(), [...THEATRE_KEYS].sort());
  assert.equal(styleOfTheatre(0), SETTLEMENT_STYLES.IliacBay);
  assert.equal(styleOfTheatre(2), SETTLEMENT_STYLES.Hammerfell);
  assert.equal(styleOfTheatre(99), SETTLEMENT_STYLES.IliacBay);
  assert.deepEqual(Object.keys(SETTLEMENT_ARCHETYPES), ['oasis', 'mining', 'fort', 'river', 'wetland', 'village', 'outskirts']);
  assert.throws(() => gen('castle', 'Skyrim'), RangeError);
  assert.throws(() => gen('fort', 'Akavir'), RangeError);
});

test('RMBC2 every archetype in every style, on ground that suits it, keeps the contract and stands enough buildings (mutants: the relaxation, the sags, a link\'s run)', () => {
  for (const archetype of Object.keys(SETTLEMENT_ARCHETYPES).filter((k) => !SETTLEMENT_ARCHETYPES[k].core)) {
    for (const style of Object.keys(SETTLEMENT_STYLES)) {
      const { plan, report } = gen(archetype, style);
      assert.deepEqual(report.problems, [], `${archetype} in ${style}`);
      assert.equal(report.ok, true, `${archetype} in ${style}: ${JSON.stringify(report.fit)}`);
      assert.deepEqual(plan.generator, { id: GENERATOR_ID, version: SETTLEMENT_GENERATOR_VERSION, seed: 1 });
    }
  }
});

test('RMBC2 on the Bay as past it: one generator, one law (TAMRIEL-WIDE)', () => {
  const bay = gen('village', 'IliacBay', { place: 1, origin: { px: 207, py: 213, east: 0, north: 0 } });
  assert.equal(bay.report.ok, true);
  assert.equal(bay.plan.place, 1);
  assert.equal(gen('village', 'Hammerfell').plan.place, PAST_BAY);
});

test('RMBC2 deterministic: the same inputs lay out the same plan, another seed another (mutant: an unseeded draw)', () => {
  const a = gen('fort', 'HighRock'), b = gen('fort', 'HighRock');
  assert.equal(settlementPrint(a.plan), settlementPrint(b.plan));
  assert.notEqual(settlementPrint(gen('fort', 'HighRock', { seed: 2 }).plan), settlementPrint(a.plan));
  assert.ok(a.plan.pads.every((p) => p.poly.every((pt) => pt.every((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6))), 'points on the centimetre, east and north');
});

test('RMBC2 the terraces follow the land: the hill fort rises, each step between cut terraces is a terrace at most, each link climbable (mutants: the terrace cap, the pull)', () => {
  const { plan, report } = gen('fort', 'HighRock');
  assert.ok(report.relief > 6, `a hill town terraces (${report.relief} m)`);
  const y = new Map(plan.pads.map((p) => [p.id, p]));
  for (const l of plan.links) {
    const rise = Math.abs(y.get(l.to).y - y.get(l.from).y);
    if (y.get(l.to).base === 'cut' && y.get(l.from).base === 'cut') assert.ok(rise <= SETTLEMENT_STYLES.HighRock.terrace + 1e-9, `${l.id} rises ${rise}`);
    if (l.kind === 'grade') assert.ok(rise <= STEP_MAX);
  }
  assert.ok(plan.links.some((l) => l.kind === 'stairs') && plan.links.some((l) => l.kind !== 'stairs'), 'stairs where it climbs, level where it does not');
  const flat = gen('village', 'IliacBay');
  assert.ok(flat.report.relief < 2, 'flat ground, a flat town');
});

test('RMBC2 decks: a wetland stands on decks clear of the ground under them, bridged; its gate a landing on the ground (mutants: the deck floor, the bridge, the landing)', () => {
  const { plan, report } = gen('wetland', 'BlackMarsh');
  const env = SYNTHETIC.wetland;
  const raised = plan.pads.filter((p) => p.base === 'raised'), cut = plan.pads.filter((p) => p.base === 'cut');
  assert.ok(raised.length > 10);
  for (const p of raised) for (const [e, n] of p.poly) assert.ok(p.y + report.datum >= env.heightAt(e, n) + DECK_CLEAR - 0.02, `${p.id} sinks`);
  assert.ok(plan.links.some((l) => l.kind === 'bridge'));
  assert.deepEqual(cut.map((p) => p.id), plan.gates.map((g) => g.pad), 'the landing is the gate\'s');
  // its gate on the low side: the landing pulls the decks toward it, and none sinks into the higher ground under it
  const falls = { heightAt: (e) => 100 - 0.3 * (e - 400) };
  const pulled = gen('wetland', 'BlackMarsh', { env: falls, roads: [90] });
  assert.deepEqual(pulled.report.problems, []);
  for (const p of pulled.plan.pads.filter((q) => q.base === 'raised')) for (const [e, n] of p.poly) assert.ok(p.y + pulled.report.datum >= falls.heightAt(e, n) + DECK_CLEAR - 0.02, `${p.id} sinks on the slope`);
  const valenwood = gen('village', 'Valenwood', { env: SYNTHETIC.village });
  assert.ok(valenwood.plan.pads.filter((p) => p.base === 'raised').length > 5, 'Valenwood builds on decks');
});

test('RMBC2 regenerated: with its ledger the same plan keeps every key; denser plots keep the anchors that stand and retire the rest; a protected home is not lost (mutants: the ledger unread)', () => {
  const first = gen('village', 'Hammerfell', { env: SYNTHETIC.village });
  const again = gen('village', 'Hammerfell', { env: SYNTHETIC.village, ledger: first.ledger });
  assert.deepEqual(again.plan.buildings.map((b) => [b.anchor, b.key]), first.plan.buildings.map((b) => [b.anchor, b.key]));
  const dense = gen('village', 'Hammerfell', { env: SYNTHETIC.village, ledger: first.ledger, params: { density: 1.6 } });
  const was = new Map(first.plan.buildings.map((b) => [b.anchor, b.key]));
  for (const b of dense.plan.buildings) if (was.has(b.anchor)) assert.equal(b.key, was.get(b.anchor), b.anchor);
  assert.ok(dense.plan.buildings.some((b) => !was.has(b.anchor) && b.key >= first.ledger.next), 'a new anchor mints past the ledger');
  // sparser plots: an anchor goes, its key retired; protected, it is refused (mutant: the protected keys unread)
  const sparse = gen('village', 'Hammerfell', { env: SYNTHETIC.village, ledger: first.ledger, params: { density: 0.6 } });
  const gone = first.plan.buildings.find((b) => !sparse.plan.buildings.some((d) => d.anchor === b.anchor));
  assert.ok(gone, 'a sparser town drops an anchor');
  assert.ok(sparse.ledger.retired.includes(gone.key) && !Object.values(sparse.ledger.keys).includes(gone.key), 'retired, never kept');
  const guarded = gen('village', 'Hammerfell', { env: SYNTHETIC.village, ledger: first.ledger, params: { density: 0.6 }, protectedKeys: [gone.key], published: first.plan.buildings });
  assert.equal(guarded.report.ok, false);
  assert.deepEqual(guarded.report.conflicts.map((c) => [c.code, c.key]), [['protected-removed', gone.key]]);
});

test('RMBC2 services: each archetype keeps its own; a temple serves its style\'s divine, a guild hall its guild; the fort\'s keep stands on its mound in the square (mutants: the service pass, the temple\'s divine)', () => {
  for (const [name, a] of Object.entries(SETTLEMENT_ARCHETYPES).filter(([, x]) => !x.core)) {
    const { plan } = gen(name, 'Skyrim');
    const types = plan.buildings.map((b) => b.type);
    for (const s of a.services) assert.ok(types.includes(T[s.type]), `${name} keeps a ${s.type}`);
    for (const b of plan.buildings) {
      if (b.type === T.Temple) assert.equal(b.factionId, DIVINES.Kynareth);
      if (b.type === T.GuildHall) assert.ok(Object.values(GUILD_FACTION_IDS).includes(b.factionId));
      assert.equal(b.access, isResidence(b.type) ? 'private' : 'public');
    }
  }
  const { plan } = gen('fort', 'HighRock');
  const keep = plan.buildings.find((b) => b.type === T.Palace);
  assert.equal(keep.pad, 'mound');
  const mound = plan.pads.find((p) => p.id === 'mound'), square = plan.pads.find((p) => p.id === 'plaza');
  assert.ok(mound.y > square.y, 'the mound stands over the square');
  assert.equal(groundAt(plan, ...keep.at).pad, 'mound', 'the ground under the keep is the mound, inside the square');
  assert.ok(plan.features.some((f) => f.kind === 'wall') && plan.features.some((f) => f.kind === 'tower'));
});

test('RMBC2 the shore: a river town\'s quay is dry, its docks reach the water; its gates at its two ends (mutants: the shore\'s sag, the docks)', () => {
  const { plan } = gen('river', 'Imperial');
  const env = SYNTHETIC.river;
  const docks = plan.features.filter((f) => f.kind === 'dock');
  assert.ok(docks.length >= 4);
  for (const d of docks) assert.ok(env.waterAt(...d.path[d.path.length - 1]), `${d.id} ends in the water`);
  for (const p of plan.pads) assert.ok(p.poly.every(([e, n]) => !env.waterAt(e, n)), `${p.id} is dry`);
  assert.equal(plan.gates.length, 2);
});

test('RMBC2 roads: a ring town\'s gate faces the road it is given (mutant: the bearing unread)', () => {
  for (const bearing of [0, 90, 200]) {
    const { plan } = gen('village', 'IliacBay', { roads: [bearing] });
    const g = plan.gates[0].at, c = [SITE.east, SITE.north];
    const toward = ((Math.atan2(g[0] - c[0], g[1] - c[1]) * 180) / Math.PI + 360) % 360;
    const off = Math.abs(((toward - bearing + 540) % 360) - 180);
    assert.ok(off < 50, `road ${bearing}, gate ${toward.toFixed(0)}`);
  }
});

test('RMBC2 fit: a cut town on a marsh stands too little, a fort on a uniform steep slope cuts too deep; both say so (mutants: each fit check)', () => {
  const marsh = gen('village', 'IliacBay', { env: SYNTHETIC.wetland });
  assert.equal(marsh.report.ok, false);
  assert.ok(marsh.report.fit.buildings < marsh.report.fit.least);
  assert.deepEqual(marsh.report.problems, [], 'too little is still a plan that keeps the contract');
  const steep = gen('fort', 'IliacBay', { env: { heightAt: (e, n) => 100 + 0.45 * n } });
  assert.equal(steep.report.ok, false);
  assert.ok(steep.report.fit.cutMax > steep.report.fit.cutLimit);
});

test('RMBC2 every building stands on its own plot, its door to its street; every plot a street\'s (mutants: the plot, the door)', () => {
  const { plan } = gen('oasis', 'Hammerfell');
  const plots = new Map(plan.plots.map((p) => [p.id, p]));
  const streets = new Set(plan.streets.map((s) => s.id));
  for (const b of plan.buildings) {
    if (b.anchor === 'keep') continue;
    assert.ok(plots.has(b.anchor), b.anchor);
    const r = (b.entrances[0].facing * Math.PI) / 180, e = b.entrances[0].at;
    assert.equal(padAt(plan.pads, [e[0] + Math.sin(r) * 2, e[1] + Math.cos(r) * 2])?.id, b.pad, 'two metres out the door is its own street');
  }
  for (const p of plan.plots) assert.ok(streets.has(p.street));
  assert.ok(plan.features.some((f) => f.kind === 'garden'), 'some plots stay open ground');
});

test('RMBC2 a marsh town\'s gate is a landing on its dry ground, never the mean of its pools; a gate mostly water stays a deck (mutants: the dry mean, the landing\'s share)', () => {
  const sea = 34, height = (e, n) => sea + (Math.sin(e / 7) * Math.sin(n / 9) > 0.25 ? -2 : 1);
  const env = { heightAt: height, waterAt: (e, n) => height(e, n) < sea + 0.5 };
  let decks = 0, landings = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { plan, report } = gen('village', 'BlackMarsh', { env, seed });
    assert.ok(report.ok);
    const cut = plan.pads.filter((p) => p.base === 'cut');
    for (const p of cut) assert.equal(report.datum + p.y, sea + 1, `${seed}: ${p.id} on its dry ground`);
    landings += cut.length;
    decks += plan.gates.filter((g) => plan.pads.find((p) => p.id === g.pad).base === 'raised').length;
  }
  assert.ok(landings > 5 && decks > 0, `${landings} landings; a gate over its pools a deck`);
});

test('RMBC2 size scales a ring as it does a row: its square and its sectors, so its buildings (mutant: a ring\'s size unread)', () => {
  for (const archetype of ['oasis', 'fort', 'wetland']) {
    const [small, one, big] = [0.5, 1, 2].map((size) => {
      const input = { place: PAST_BAY, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 1, archetype, style: 'Hammerfell', site: SITE, params: { size } };
      return { L: layoutSettlement(input, SYNTHETIC[archetype]), plan: generateSettlement({ ...input, env: SYNTHETIC[archetype] }).plan };
    });
    assert.ok(small.L.inner < one.L.inner && one.L.inner === SETTLEMENT_ARCHETYPES[archetype].plaza && big.L.inner === 2 * one.L.inner, `${archetype}: its square`);
    assert.ok(small.L.sectors < one.L.sectors && one.L.sectors < big.L.sectors, `${archetype}: its sectors`);
    assert.ok(big.plan.buildings.length > one.plan.buildings.length, `${archetype}: more to it`);
    for (const size of [0.5, 0.75, 1.5]) assert.deepEqual(validateSettlement(gen(archetype, 'Hammerfell', { params: { size } }).plan), [], `${archetype} at ${size}: its square's feature off the keep's mound and its ways`);
  }
});
