// ARENA5 (2026-10-03): THE GATE'S WARDENS AND THE CITY'S LAW (bible/11-Multiplayer/Arena.md 1: "the gate wardens - two
// guards (the city watch's own), so a brawl at the gate is a crime like any other"). What was read: the wardens are the
// gate's static people (world/arenaCity.js ARENA_GATE_PEOPLE - the Royal Guard's, in a person archive the ray meets, named
// by their office); a crime at the gate runs the street's own law with no arena term anywhere on its path - both hosts'
// crime door (the bout driver's `crime`, the street's Assault and its response), the response (`_crimeResponse` ->
// `_spawnGuards(true)` -> scenes/cityGuards.js spawnCityGuards over `_guardPool`), and spawnCityGuards itself, whose only
// place gates are DFU's (underground nothing; inside an open shop, a tavern or a home the watch never comes through the
// wall). The watch's response is DFU's SpawnCityGuards: it converts the street's WALKERS (`_livePersons` - MobilePersonNPC's
// pool) and otherwise rings watchmen in from outside the player's view; a static person is never in that pool in DFU, so
// the wardens' posts are not where the response comes from - stood here so, deliberately (the faithful reading). Host
// wiring pins by source, as the suites keep them; the driver's seam driven.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARENA_GATE_PEOPLE, arenaGatePersonName } from '../src/world/arenaCity.js';
import { NPC_FLAT_ARCHIVES } from '../src/world/rdbLayout.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { exhibitionFor } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A function's body in a source, by its declaration's text. */
const body = (src, decl) => { const at = src.indexOf(decl); assert.ok(at >= 0, decl); return src.slice(at, src.indexOf('\n  }\n', at) + 4); };

test('ARENA5 the wardens: two of the Royal Guard (372) in a person archive the ray meets, either side of the Herald at the gate, named by their office - static people, as DFU stands them (mutant: ARENA5-WARDENS-FACTION)', () => {
  const w = ARENA_GATE_PEOPLE.filter((p) => p.role === 'warden');
  const herald = ARENA_GATE_PEOPLE.find((p) => p.role === 'herald');
  assert.equal(w.length, 2);
  for (const p of w) {
    assert.equal(p.faction, 372, 'the Royal Guard');
    assert.ok(NPC_FLAT_ARCHIVES.includes(p.archive), 'a person the ray meets');
    assert.equal(arenaGatePersonName({ position: p.position, textureArchive: p.archive, textureRecord: p.record }), ARENA_TEXT.gateNames.warden);
  }
  assert.ok(w[0].x < herald.x && w[1].x > herald.x, 'either side of the Herald');
});

test('ARENA5 a brawl at the gate is a crime like any other: the driver\'s crime door is the street\'s Assault and its response in both hosts; the response and the watch\'s spawn carry no arena or cell term - the street\'s pool, its walkers alone (mutants: ARENA5-CRIME-EXEMPT, ARENA5-CRIME-DOOR, ARENA5-WATCH-FROM-WARDENS)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(f);
    assert.match(s, /crime: \(\) => \{ setCrimeCommitted\(playerEntity, CRIMES\.Assault\); _crimeResponse\(\); \},/, `${f}: the driver's crime door`);
    assert.match(s, /function _crimeResponse\(\) \{ _spawnGuards\(true\); \}/, `${f}: the response`);
    const spawn = body(s, 'function _spawnGuards(immediate) {');
    assert.match(spawn, /cityGuards\.spawnCityGuards\(!!immediate, \{ playerFeet: \[\.\.\.feet\], playerFwd: fwd, pool: _guardPool\(\) \}\)/, f);
    assert.doesNotMatch(spawn, /arena|Arena|ARENA/, `${f}: no arena term on the response`);
    assert.match(s, /const _guardPool = \(\) => \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \? \[\] : _livePersons\.map\(/, `${f}: the pool is the street's walkers`);
  }
  const G = read('src/scenes/cityGuards.js');
  const spawnCity = G.slice(G.indexOf('  async function spawnCityGuards('), G.indexOf('    // Non-immediate: witnesses.'));
  assert.ok(spawnCity.length > 1000);
  assert.doesNotMatch(spawnCity, /arena|Arena|ARENA|inArenaCell|cell/, 'the watch\'s spawn has no place gate but DFU\'s');
  assert.match(spawnCity, /if \(_ee\?\.isPlayerInsideDungeon\) return;/, 'DFU\'s own: underground, nothing');
});

test('ARENA5 the driver\'s seam: a stranger\'s blow on a fighter of the exhibition at the gate is warned once, then the watch is called through the host\'s crime door (mutant: ARENA5-INTRUDE-NO-CRIME)', async () => {
  let t = 1000, crimes = 0;
  const said = [];
  const foes = [];
  const stage = {
    kind: 'city', centre: () => [0, 0, 0],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] }, ai: { feet: [...feet] } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => null,
  };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: { name: 'A', health: 10, maxHealth: 10 }, say: (l) => said.push(l), crime: () => crimes++, drawHud: () => {} });
  A.setStage(stage);
  const gm = (405 * 360 + 40) * MINUTES_PER_DAY + 12 * 60;
  A.ask({ where: 'city', kind: 'exhibition', ex: exhibitionFor(gm) });
  await new Promise((r) => setTimeout(r, 0));
  t += 100; A.frame(0.1, { playerFeet: [0, 0, 30] });
  foes[0].entity.bout.hooks.intrude(foes[0]);
  assert.deepEqual([said.at(-1), crimes], [ARENA_TEXT.herald.intrude, 0]);
  foes[0].entity.bout.hooks.intrude(foes[0]);
  assert.deepEqual([said.at(-1), crimes], [ARENA_TEXT.herald.intrudeCrime, 1], 'the watch, by the street\'s own law');
});
