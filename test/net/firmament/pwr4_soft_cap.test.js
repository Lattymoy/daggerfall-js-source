// PWR4 (2026-10-23, bible/05-Combat/Power-Arc.md section 7; Mac, asked: "20; past it, loadouts"): WIDER, NOT TALLER -
// Renown's health and magicka, the sigil stages (re-spaced 1/5/10/15/20, and the loot's ease that reads them) and the
// Stars a sky in force may spend all top out at Renown 20; past it Renown buys breadth - a second saved sky at 30, a third
// at 40, each with its attunement set, swapped out of combat - and the long road's three titles at 30, 40 and 50.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from '../../accountDb.mjs';
import {
  FIRM_RENOWN_SOFT_CAP, FIRM_SKIES_AT, activeStarsFor, skiesFor, starsFor, pathTo, packTree, FIRM_RENOWN_MAX,
} from '../../../src/net/firmament/firmamentLaw.js';
import { START_KEYS } from '../../../src/net/firmament/firmamentTree.js';
import { RENOWN_SOFT_CAP, renownPower, renownBonus, RENOWN_MAX } from '../../../src/net/renown.js';
import { SIGIL_STAGES, renownSigilStage } from '../../../src/systems/sigil/sigil.js';
import { RENOWN_LOOT_QUARTERS, renownLootQuarters } from '../../../src/systems/renownLoot.js';
import { RENOWN_TITLES, TITLES } from '../../../src/net/identityToken.js';
import { titlesHeld } from '../../../server-account/src/titles.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
let _rid = 0;
const rid = () => `pwr4-${String(++_rid).padStart(6, '0')}`;
function walk(start, ...targets) {
  const tree = { start, keys: [] };
  for (const t of targets) tree.keys.push(...pathTo(tree, t));
  return tree;
}

test('PWR4 THE SOFT CAP: one number, 20, for the Renown\'s health and magicka, the sigils\' stages and the Stars a sky in force spends - restated in the Worker\'s graph and held equal (mutants: either cap moved; the Stars past it spent; the bonus past it)', () => {
  assert.equal(RENOWN_SOFT_CAP, 20);
  assert.equal(FIRM_RENOWN_SOFT_CAP, RENOWN_SOFT_CAP, 'the Firmament\'s restated soft cap is the Renown\'s');
  for (const R of [1, 5, 19, 20]) assert.equal(activeStarsFor(R), starsFor(R), `Renown ${R}: every Star`);
  for (const R of [21, 30, 50]) assert.equal(activeStarsFor(R), starsFor(20), `Renown ${R}: the soft cap's Stars`);
  assert.deepEqual([1, 20, 21, 50, null].map(renownPower), [1, 20, 20, 20, 1]);
  assert.deepEqual(renownBonus(50), renownBonus(20), 'health and magicka stop at 20');
  assert.ok(renownBonus(20).hp > renownBonus(19).hp);
  assert.equal(RENOWN_MAX, FIRM_RENOWN_MAX);
});

test('PWR4 THE STAGES RE-SPACED: a sigil\'s five stages open at Renown 1, 5, 10, 15 and 20 - the last at the soft cap - and the loot\'s Renown ease, read in the sigils\' own stages, with them (mutants: a stage\'s threshold; the last past the cap)', () => {
  assert.deepEqual(SIGIL_STAGES.map((s) => s.renown), [1, 5, 10, 15, 20]);
  assert.equal(SIGIL_STAGES.at(-1).renown, RENOWN_SOFT_CAP);
  assert.deepEqual([1, 4, 5, 9, 10, 14, 15, 19, 20, 50].map(renownSigilStage), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  for (const R of [1, 5, 10, 15, 20, 50]) assert.equal(renownLootQuarters({ online: true, renown: R }), RENOWN_LOOT_QUARTERS[renownSigilStage(R)]);
  assert.equal(renownLootQuarters({ online: true, renown: 20 }), renownLootQuarters({ online: true, renown: 50 }), 'the ease tops out at the soft cap');
});

test('PWR4 THE SKIES: one sky, a second kept aside at Renown 30, a third at 40 (mutants: a sky\'s Renown moved; one more sky)', () => {
  assert.deepEqual(FIRM_SKIES_AT, [30, 40]);
  assert.deepEqual([1, 29, 30, 39, 40, 50].map(skiesFor), [1, 1, 2, 2, 3, 3]);
});

test('PWR4 THE SWAP ON THE SERVICE: the sky in force exchanged with a slot kept aside, in one batch over the tree it was asked over - free, refused for a slot the Renown has not opened, asked twice one swap; the state carries the skies and what each holds (mutants: the slot unread; the exchange one-way; the repeat swapped again)', async () => {
  const s = await standService({ FIRMAMENT_OPEN: 'on', MARKS_OPEN: 'on' });
  const state = (who) => s.call('/v1/firmament/state', { character: who.character }, who.secret);
  const set = (who, tree) => s.call('/v1/firmament/set', { character: who.character, tree: packTree(tree), rid: rid() }, who.secret);
  const swap = (who, slot, id = rid()) => s.call('/v1/firmament/swap', { character: who.character, slot, rid: id }, who.secret);
  const ana = await s.seated('Ana', { renown: 30 });
  const st = await state(ana);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(st.body.skies, 2);
  assert.equal(st.body.stars, activeStarsFor(30), 'Stars to the soft cap');
  const first = walk('wr.start', 'wr.k1');
  assert.equal((await set(ana, first)).status, 200);
  assert.deepEqual([(await swap(ana, 2)).status, (await swap(ana, 2)).body.error], [409, 'firm-sky-closed'], 'the third sky opens at 40');
  assert.equal((await swap(ana, 0)).body.error, 'firm-sky');
  const id = rid();
  const a = await swap(ana, 1, id);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([a.body.tree, a.body.aside[0], a.body.swapped], ['', packTree(first), 1], 'the sky in force set aside; the empty slot in force');
  const again = await swap(ana, 1, id);
  assert.deepEqual([again.body.repeat, again.body.tree], [true, ''], 'asked twice: one swap');
  const second = walk(START_KEYS.find((k) => k !== 'wr.start'));
  assert.equal((await set(ana, second)).status, 200);
  const b = await swap(ana, 1);
  assert.deepEqual([b.body.tree, b.body.aside[0]], [packTree(first), packTree(second)], 'and back: an exchange');
  const st2 = await state(ana);
  assert.deepEqual([st2.body.tree, st2.body.aside], [packTree(first), [packTree(second), '']]);
  // the client's door and the window's
  assert.match(rd('src/net/accountClient.js'), /\/v1\/firmament\/swap/);
  assert.match(rd('src/ui/firmamentWindow.js'), /swapAttunementSet\(/, 'the attunement set travels with the sky');
});

test('PWR4 THE LONG ROAD\'S THREE: Renowned at 30, Paragon of the Bay at 40, Legend of the Iliac at 50 - derived from the account\'s best Renown, as the founder from a date; the vocabulary only appended (mutants: a title\'s Renown; the best read off the wrong track; held below its Renown)', () => {
  assert.deepEqual(RENOWN_TITLES.map((r) => [r.id, r.at]), [['renowned', 30], ['paragon', 40], ['legend', 50]]);
  assert.deepEqual(TITLES.slice(-3), ['renowned', 'paragon', 'legend']);
  const held = (best) => titlesHeld({ id: 'x', handle: 'Ana', created_at: 2_000_000_000, renownBest: best }, {}).filter((t) => RENOWN_TITLES.some((r) => r.id === t));
  assert.deepEqual(held(29), []);
  assert.deepEqual(held(30), ['renowned']);
  assert.deepEqual(held(45), ['renowned', 'paragon']);
  assert.deepEqual(held(50), ['renowned', 'paragon', 'legend']);
  assert.deepEqual(held(undefined), [], 'a row read without it holds none');
  assert.match(rd('server-account/src/honours.js'), /SELECT MAX\(xp\) AS best FROM renown_tracks WHERE player = \?1/);
});
