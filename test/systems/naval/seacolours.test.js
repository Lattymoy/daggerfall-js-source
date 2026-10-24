// SEA-COLOURS (2026-10-17, the owner: "enemies and merchants should have their own unique liveries, flags hosted, etc";
// bible/03-World/Naval-Refit.md SEA-COLOURS) - every ship of the sea in her own paint and under her own flag of cloth:
// the law (a navy's crown, a merchant house, a pirate crew, a legend's own; a pirate under false colours painted and
// flagged as the house she passes for; colours down once struck), every table's flag through the flag's door, the pick
// off her seed, the frame's flags nearest first; the flag host taking them after the players' to the pass's cap; and the
// real naval host painting a ship as her hull is built - the same on a peer's copy - and saying her flag until she
// strikes. tools/mutants/seacolours.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CROWN_COLOURS, MERCHANT_HOUSES, PIRATE_CREWS, LEGEND_COLOURS, HOUSE_SALT, CREW_SALT, SEA_FLAG_M,
  seaPick, houseOf, crewOf, seaLiveryOf, seaFlagOf, seaFlagsOf,
} from '../../../src/systems/naval/seaColours.js';
import { shipFlagOf, flagKey } from '../../../src/systems/naval/shipFlag.js';
import { liveryCode, liveryPartsOf, SHIP_PAINTS } from '../../../src/systems/naval/shipLivery.js';
import { classById, CROWNS, SHIP_CLASSES, HULL } from '../../../src/systems/naval/navalShips.js';
import { LEGENDS, ISLES_FLAG } from '../../../src/systems/naval/etherShips.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { navalWireRecord } from '../../../src/systems/naval/navalWire.js';
import { createShipFlagHost, flagPhaseOf } from '../../../src/scenes/shipFlagHost.js';
import { FLAGS_MAX } from '../../../src/render/shipFlagPass.js';
import { sea, freshPool } from '../../navalSea.mjs';

const paint = (id) => SHIP_PAINTS.findIndex((p) => p?.id === id);
const who = (classId, o = {}) => ({ cls: classById(classId), seed: 1, crown: null, legend: null, disguise: null, ...o });
/** A seed whose pick off `salt` is `n`. */
const seedOf = (salt, n, of) => { for (let s = 1; s < 20000; s++) if (seaPick(s, salt, of) === n) return s; throw new Error('no seed'); };

test('SEA-COLOURS the law: a navy wears her crown\'s livery under white canvas and flies its royal ensign - Daggerfall\'s azure and dagger, Wayrest\'s crimson and rose, Sentinel\'s gold and sun; a War Galley her crown\'s stain; one of no crown known, as built and none (mutants: the crown\'s paint, its ensign, the galley\'s parts)', () => {
  assert.deepEqual(Object.keys(CROWN_COLOURS).sort(), [...CROWNS.map((c) => c.name), ISLES_FLAG].sort(), 'every crown\'s, and the Isles\'');
  const cutter = (crown) => who('navyCutter', { crown });
  assert.deepEqual(seaLiveryOf(cutter('Daggerfall')), { strake: paint('navy'), accent: paint('gold'), sail: paint('white'), stain: 0 });
  assert.deepEqual(seaLiveryOf(cutter('Wayrest')), { strake: paint('crimson'), accent: paint('gold'), sail: paint('white'), stain: 0 });
  assert.equal(seaLiveryOf(cutter('Sentinel')).strake, paint('ochre'));
  const ensign = (crown) => seaFlagOf(cutter(crown));
  assert.deepEqual([ensign('Daggerfall').field, ensign('Daggerfall').device, ensign('Daggerfall').border], ['azure', 'dagger', 'gold']);
  assert.deepEqual([ensign('Wayrest').field, ensign('Wayrest').device], ['crimson', 'rose']);
  assert.deepEqual([ensign('Sentinel').field, ensign('Sentinel').device, ensign('Sentinel').charge], ['gold', 'sun', 'crimson']);
  assert.equal(ensign('Daggerfall').shape, 'flag');
  const galley = seaLiveryOf(who('navyGalley', { crown: 'Wayrest' }));
  assert.deepEqual(galley, { strake: 0, accent: 0, sail: paint('white'), stain: paint('crimson') }, 'a galley takes her stain and her canvas alone');
  assert.equal(seaLiveryOf(cutter(null)), null);
  assert.equal(seaFlagOf(cutter('Nowhere')), null);
});

test('SEA-COLOURS the law: a merchantman is of a house off her seed - its paint, and her crown\'s merchant colors parted with the house\'s colour under its device, a swallowtail; past the Veil the Isles\' teal; the house the same on every machine (mutants: the house\'s paint, the crown\'s field, the parting, the device, the shape, the salt)', () => {
  assert.ok(MERCHANT_HOUSES.length >= 6);
  for (let n = 0; n < MERCHANT_HOUSES.length; n++) {
    const seed = seedOf(HOUSE_SALT, n, MERCHANT_HOUSES.length);
    const h = MERCHANT_HOUSES[n];
    const w = who('merchantGalleon', { seed, crown: 'Daggerfall' });
    assert.equal(houseOf(w), h);
    const lv = seaLiveryOf(w);
    assert.equal(lv.strake, h.livery.strake, h.id);
    assert.equal(lv.accent, h.livery.accent);
    const f = seaFlagOf(w);
    assert.deepEqual([f.shape, f.field, f.division, f.device], ['swallowtail', 'azure', h.division, h.device], h.id);
    assert.equal(f.field2, h.colour === 'azure' ? 'argent' : h.colour);
  }
  assert.notEqual(seaPick(5, HOUSE_SALT, 997), seaPick(5, CREW_SALT, 997), 'two streams off one seed');
  const isles = seaFlagOf(who('merchantCarrack', { seed: 9, crown: ISLES_FLAG }));
  assert.equal(isles.field, 'teal');
  const seen = new Set();
  for (let s = 1; s <= 400; s++) seen.add(houseOf(who('merchantGalleon', { seed: s })).id);
  assert.equal(seen.size, MERCHANT_HOUSES.length, 'every house sails');
});

test('SEA-COLOURS the law: a pirate is of a crew off her seed - its dark paint, its black flag; one under false colours painted as the house she passes for and flying its colours in the crown she pretends, till the black flag goes up; a legend in her own whatever her faction (mutants: the crew, the disguise\'s paint, the false flag, the legend)', () => {
  for (let n = 0; n < PIRATE_CREWS.length; n++) {
    const seed = seedOf(CREW_SALT, n, PIRATE_CREWS.length);
    const c = PIRATE_CREWS[n];
    const w = who('pirateBrig', { seed });
    assert.equal(crewOf(w), c);
    assert.equal(seaLiveryOf(w).strake, c.livery.strake, c.id);
    const f = seaFlagOf(w);
    assert.deepEqual([f.field, f.device, f.shape], [c.flag.field, c.flag.device, c.flag.shape], c.id);
  }
  const masked = who('pirateBrig', { seed: 21, disguise: 'Sentinel' });
  assert.deepEqual(seaLiveryOf(masked), seaLiveryOf(who('merchantGalleon', { seed: 21 })), 'her paint the house she passes for');
  const shown = seaFlagOf(masked, 'false');
  assert.deepEqual([shown.field, shown.device, shown.shape], ['gold', houseOf(masked).device, 'swallowtail'], 'Sentinel\'s merchant colors');
  assert.deepEqual(seaFlagOf(masked, 'hers'), seaFlagOf(who('pirateBrig', { seed: 21 })), 'the black flag run up');
  assert.equal(seaFlagOf(who('pirateBrig', { seed: 21 }), 'false'), null, 'no false colours, none flown');
  for (const l of LEGENDS) {
    const w = who(l.classId, { legend: l.id, seed: 3 });
    assert.ok(LEGEND_COLOURS[l.id], l.id);
    assert.equal(seaFlagOf(w).device, LEGEND_COLOURS[l.id].flag.device, l.id);
    assert.equal(seaLiveryOf(w).sail, LEGEND_COLOURS[l.id].livery.sail);
  }
});

test('SEA-COLOURS the law: her colours come down with her - none struck, taken or gone; every table\'s flag through the flag\'s door (every crown with every house, every crew, every legend, every pretended crown); every livery a hull\'s own parts alone (mutants: the colours down, a table\'s clash)', () => {
  const w = who('navyCutter', { crown: 'Daggerfall' });
  for (const c of ['struck', 'taken', 'sunk', null, undefined]) assert.equal(seaFlagOf(w, c ?? 'none'), null, String(c));
  const crowns = Object.keys(CROWN_COLOURS);
  for (const crown of crowns) {
    for (let n = 0; n < MERCHANT_HOUSES.length; n++) {
      const seed = seedOf(HOUSE_SALT, n, MERCHANT_HOUSES.length);
      const f = seaFlagOf(who('merchantGalleon', { seed, crown }));
      assert.ok(f && shipFlagOf(f), `${crown} ${MERCHANT_HOUSES[n].id}`);
      assert.ok(seaFlagOf(who('pirateBrig', { seed, disguise: crown }), 'false'));
    }
    assert.ok(shipFlagOf(seaFlagOf(who('navyCutter', { crown }))) || crown === ISLES_FLAG);
  }
  for (const c of PIRATE_CREWS) assert.ok(shipFlagOf({ division: 'plain', ...c.flag }), c.id);
  for (const [id, l] of Object.entries(LEGEND_COLOURS)) assert.ok(shipFlagOf({ division: 'plain', ...l.flag }), id);
  for (const cls of SHIP_CLASSES) {
    for (let seed = 1; seed < 40; seed++) {
      const lv = seaLiveryOf({ cls, seed, crown: CROWNS[seed % 3].name, legend: LEGENDS.find((l) => l.classId === cls.id)?.id ?? null, disguise: seed % 2 ? 'Wayrest' : null });
      if (!lv) continue;
      const parts = liveryPartsOf(cls.hull);
      for (const k of ['strake', 'accent', 'sail', 'stain']) if (!parts.includes(k)) assert.equal(lv[k], 0, `${cls.id} ${k}`);
    }
  }
});

test('SEA-COLOURS the frame\'s flags: each ship standing whose colours fly, within SEA_FLAG_M of the eye, the nearest first, her wave her seed\'s - never a hull struck or taken, one not standing, nor one past the reach (mutants: the reach, the order, the colours, the standing)', () => {
  const at = (x, colours = 'hers', o = {}) => ({ boat: { GameObject: { position: [x, 0, 0], activeSelf: true } }, ship: { seed: x + 1 }, colours, who: who('navyCutter', { crown: 'Wayrest' }), ...o });
  const entries = [at(300), at(100), at(SEA_FLAG_M + 1), at(50, 'struck'), at(60, 'taken'), at(70, 'false', { who: who('pirateBrig', { disguise: 'Sentinel' }) }),
    { ...at(20), boat: { GameObject: { position: [20, 0, 0], activeSelf: false } } }, { ...at(10), boat: null }];
  const out = seaFlagsOf(entries, [0, 0, 0], (e) => e.who);
  assert.deepEqual(out.map((f) => f.d), [70, 100, 300]);
  assert.deepEqual(out.map((f) => f.phase), [71, 101, 301]);
  assert.equal(out[0].flag.shape, 'swallowtail', 'her false colours');
  assert.equal(out[1].flag.device, 'rose');
  // the flag host: the sea's after the players', to the pass's cap, each her seed's wave
  const node = (x) => ({ position: [x, 10, 0], forward: [0, 0, 1] });
  const boat = (x, o = {}) => ({ hull: 2, FlagObject: node(x), GameObject: { activeSelf: true }, ...o });
  const flown = shipFlagOf({ shape: 'flag', field: 'vert', device: 'ship' });
  const mine = boat(1, { uid: 5 });
  const many = Array.from({ length: FLAGS_MAX + 5 }, (_, i) => ({ boat: boat(10 + i), flag: out[1].flag, phase: 1000 + i }));
  const host = createShipFlagHost({ myBoats: () => [mine], coloursOf: () => flown, seaFlags: () => many });
  host.frame();
  const list = host.draws();
  assert.equal(list.length, FLAGS_MAX, 'to the pass\'s cap');
  assert.equal(list[0].key, flagKey(flown), 'mine first');
  assert.equal(list[1].phase, flagPhaseOf(1000), 'her seed\'s wave');
  assert.equal(host.flies(many[0].boat), true, 'her pennant\'s cubes left out for her cloth');
  assert.equal(host.flies(many.at(-1).boat), false, 'past the cap: her pennant flies');
});

test('SEA-COLOURS over the real naval host: a ship is painted as her hull is built - a navy\'s crown, a merchant\'s house, a pirate\'s crew - and a peer\'s copy of her the same off her seed; the host says each one\'s flag, the nearest first, until she strikes and her colours come down (mutants: the paint unset, the flags unsaid, the colours\' state)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const ids = ['navyCutter', 'merchantGalleon', 'pirateBrig'].map((c, i) => h.host.spawnShip(c, { range: 120 + 60 * i, bearing: i }));
  h.run(0.5);
  const es = ids.map((id) => h.host._sea.get(id));
  for (const e of es) {
    assert.ok(e.boat, e.ship.cls.id);
    const want = liveryCode(seaLiveryOf({ cls: e.ship.cls, seed: e.ship.seed, crown: e.ship.flag ?? null, legend: e.legend ?? null, disguise: null }));
    assert.ok(want > 0, `${e.ship.cls.id} wears paint`);
    assert.equal(e.boat.livery, want, e.ship.cls.id);
  }
  const flags = h.host.seaFlags();
  assert.deepEqual(flags.map((f) => f.boat), es.map((e) => e.boat), 'each, the nearest first');
  assert.equal(flags[0].flag.field, CROWN_COLOURS[es[0].ship.flag].field, 'the navy\'s ensign');
  assert.equal(flags[2].flag.field, crewOf({ seed: es[2].ship.seed }).flag.field, 'the black flag');
  // she strikes: her colours come down
  es[2].ship.damage.apply({ hull: es[2].ship.damage.hull * 0.9, sail: 0, crew: 0 }, 1);
  h.run(0.3);
  assert.notEqual(es[2].ship.damage.state, SHIP_STATES.afloat);
  assert.equal(h.host.seaFlags().some((f) => f.boat === es[2].boat), false, 'struck: no flag');
  // a peer's copy of her, off her seed
  const peer = await sea({ hull: HULL.SmallShip, online: { id: () => 'b-player', peers: () => [], sendHit: () => true }, pool: await freshPool(), settings: { ShipsAtSea: 'off' } });
  const e = es[1];
  peer.host.applyWord('a-player', navalWireRecord({ ships: [{ n: 1, classId: e.ship.cls.id, variant: 0, pos: [0, 0, 150], yaw: 0, speed: 0, sails: 0, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: e.ship.seed, fire: false, gen: 0, region: e.region }] }), (p) => p);
  peer.run(0.5);
  const copy = [...peer.host._sea.values()].find((x) => x.owner === 'a-player');
  assert.ok(copy?.boat);
  assert.equal(copy.boat.livery, e.boat.livery, 'the same paint on every screen');
});
