// LW-FIX5 (2026-10-05, bible/06-Systems/Living-World.md "LW-FIX5"): THE DEEP'S FOUR - a keepsake of the deep's dead was
// never carried home (they are travellers, minted off the town's row with no house), the remains lay one visit (marked
// on laying - a dungeon keeps nothing past its leaving) with goods rolled afresh and unminted, and a turned watchman was
// followed by the body the town's pool dressed again. Each pinned here, on the synthetic town and mock decks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { synthTown } from './lwTown.mjs';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { mintKeepsake, keepsakeFor } from '../src/systems/livingWorld/keepsake.js';
import { createDeepRemains } from '../src/scenes/deepRemains.js';
import { watchStep } from '../src/scenes/livingWatch.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

function makeTown(extra = {}) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors, makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND, ...extra,
  });
  return { town, clock };
}

test('LW-FIX5 a keepsake of one of the deep\'s dead - a traveller, minted off the town\'s row with no house - is carried home to the household the town\'s census gives their place, a newcomer\'s generation aside; another household takes nothing, and a keepsake that names its house keeps it (mutants: the census\'s word, the generation)', () => {
  const rel = createRelations();
  const carried = [];
  const { town, clock } = makeTown({ relations: () => rel, playerName: () => 'Mac', keepsakes: () => carried, takeKeepsake: (it) => carried.splice(carried.indexOf(it), 1) });
  const day = town.dayOf(clock.t);
  const fallen = town.residents.find((r) => r.id === `L${TOWN.mapId}.t3`);
  const kin = town.residents.find((r) => r.home === fallen.home && r.id !== fallen.id);
  const stranger = town.residents.find((r) => r.home != null && r.home !== fallen.home);
  assert.ok(fallen && kin && stranger);
  carried.push(mintKeepsake({ id: `L${TOWN.mapId}.t3~41`, name: 'Ada Lark', town: TOWN.mapId }));
  assert.equal(carried[0].livingKeepsake.home, null, 'the deep\'s dead carry no house');
  assert.equal(town.moment({ living: { id: stranger.id, res: stranger }, nameNPC: stranger.name }), null, 'another household: nothing');
  assert.ok(town.moment({ living: { id: kin.id, res: kin }, nameNPC: kin.name }), 'their own household, by the census');
  assert.equal(carried.length, 0, 'handed over');
  assert.equal(rel.regard(kin.id, day), 35);
  // a keepsake that names its house keeps to it; no word of the town's moves it
  const named = mintKeepsake({ id: 'L12345.h7', name: 'Bo Reed', town: TOWN.mapId, home: stranger.home });
  assert.equal(keepsakeFor([named], TOWN.mapId, kin.home, kin.id, () => kin.home), null);
  assert.equal(keepsakeFor([named], TOWN.mapId, stranger.home, 'L12345.zz', () => null), named);
});

/** A remains layer over mock decks - the piles keep their goods (`items`). */
function remainsRig() {
  const marks = new Set(), piles = [], said = [];
  const st = { feet: [200, 0, 200] };
  const spots = [[0, 0, 0], [30, 0, 0]];
  const layer = createDeepRemains({
    spots: () => spots, laid: (k) => marks.has(k), mark: (k) => marks.add(k),
    lay: (res, at, key) => { const p = { res, at, key, items: [1, 2, 3], gone: false }; piles.push(p); return p; },
    there: (at) => piles.some((p) => !p.gone && p.at === at), count: (p) => p.items.length,
    feet: () => st.feet, say: (t) => said.push(t), townName: () => '',
  });
  return { layer, marks, piles, said, st };
}

test('LW-FIX5 the remains lie each visit till the player takes from them: laid, not spent; taken from (fewer goods, or the pile emptied away) spent and never laid again; left untouched, the dungeon\'s leaving takes them and the next visit lays them again; the lay asked with the key its goods are rolled from (mutants: marked on laying, the count unread, the gone unread, the visit\'s laid unforgotten, the key unpassed)', () => {
  const r = { key: 'deep:L5.t2:L5.t2:60', res: { id: 'L5.t2', name: 'Ada Lark', town: 5 } };
  const a = remainsRig();
  a.layer.frame([r]);
  assert.deepEqual([a.piles.length, a.piles[0].key, a.marks.size], [1, r.key, 0], 'laid with its key, not spent');
  a.layer.frame([r]);
  assert.equal(a.piles.length, 1, 'once a visit');
  a.layer.clear(); a.piles[0].gone = true;   // the dungeon left: its piles with it
  a.layer.frame([r]);
  assert.deepEqual([a.piles.length, a.marks.size], [2, 0], 'untouched: laid again on the next visit');
  a.piles[1].items.pop();
  a.layer.frame([r]);
  assert.ok(a.marks.has(r.key), 'taken from: spent');
  a.layer.clear(); a.piles[1].gone = true;
  a.layer.frame([r]);
  assert.equal(a.piles.length, 2, 'never laid again');
  const b = remainsRig();
  b.layer.frame([r]);
  b.piles[0].gone = true;   // emptied, the pile away
  b.layer.frame([r]);
  assert.ok(b.marks.has(r.key), 'emptied: spent');
});

test('LW-FIX5 the host: the remains laid with their key and asked their count; their goods rolled off their key (the same each time - never a reroll for leaving), their weapon and armour minted as every piece the port hands out and never an arrow (mutants: the key, the count, the seed, the mint, the arrow)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /lay: \(res, feet, key\) => livingRemainsLay\(d, res, feet, key\),/);
  assert.match(w, /count: \(pile\) => pile\?\.items\?\.length \?\? 0,/);
  assert.match(w, /const rolls = lwRng\(textSeed\(key\), 0x676f6f64\);/);
  assert.match(w, /generateLootItems\(enemyLootTableKey\(res\.cls, look\.basics\.lootTableKey \?\? '-'\), \{ level, gender: res\.sex \?\? 'male' \}, rolls\);/);
  assert.match(w, /for \(const raw of \[createRandomWeapon\(level, rolls\), createRandomArmor\(level, rolls\)\]\) if \(raw && !isAmmunition\(raw\)\) items\.push\(mintCondition\(setItemFields\(raw\)\)\);/);
  assert.match(w, /items\.push\(goldStack\(5 \+ Math\.floor\(rolls\(\) \* 20 \* level\)\)\);/);
});

test('LW-FIX5 the turned watch is followed by the struck body\'s IDENTITY as it was struck - the town\'s pool dresses its bodies again, and a dead guard still wearing an old body\'s mark is never the next watchman\'s; the conversions mark with it (mutants: the body for the mark, each conversion)', () => {
  const slays = [];
  const town = { slain: (p) => slays.push(p.living.id) };
  const body = {};   // one pooled body, dressed twice
  const first = { id: 'L1.w1' }, second = { id: 'L1.w2' };
  const old = { livingFrom: first, dead: true };   // the first watchman's guard, cut down and lying
  const fresh = { livingFrom: second, dead: false };
  const turned = [{ res: second, from: second, town, at: [0, 0, 0], guard: null, waited: 0 }];
  void body;
  watchStep(turned, [old, fresh]);
  assert.equal(turned[0].guard, fresh, 'his own guard, never the old body\'s dead one');
  assert.deepEqual(slays, [], 'nobody slain for the old guard');
  fresh.dead = true;
  watchStep(turned, [old, fresh]);
  assert.deepEqual(slays, ['L1.w2']);
  assert.match(rd('src/scenes/cityGuards.js'), /if \(stood && best\.person\?\.living\) stood\.livingFrom = best\.person\.living;/);
  assert.match(rd('src/systems/rrRidingHost.js'), /const from = person\.living \?\? null;[^\n]*\n[^\n]*g\.livingFrom = from;/);
  assert.match(rd('src/scenes/world.js'), /_livingWatchTurned\.push\(\{ res: person\.living\.res, from: person\.living, town, at: \[\.\.\.person\.pos\], guard: null, waited: 0 \}\);/);
});
