// GATE-MIX (2026-10-20): the night's bodies' sprites made ready as I stand in the court - scenes/gate/gateSpriteWarm.js,
// wired by scenes/gate/gateCourt.js. Design: bible/11-Multiplayer/World-Bosses.md section 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileOf } from '../../../src/net/gate/gateBrain.js';
import { GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { nightMobiles, createSpriteWarm, SPRITE_WARM_UPLOADS, SPRITE_WARM_LOOKS } from '../../../src/scenes/gate/gateSpriteWarm.js';
import { destroyGateBossBar } from '../../../src/ui/gate/gateBossBar.js';

const night = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
const settle = () => new Promise((r) => setTimeout(r, 0));
/** An archive of `records` records of `frames` frames each - the shape getTexture answers. */
const archiveOf = (records, frames) => ({ recordCount: records, getFrameCount: () => frames });

test('GATE-MIX nightMobiles: him and the Tithe-Imp any night; his host on a Legion-Lord\'s; the Vanguard\'s kinds, his Flame and the Gaolers on their portents\' nights - each by his aspect; no night, none (mutants: the host on every night; a portent unread)', () => {
  const plain = night();
  assert.deepEqual(nightMobiles(plain, profileOf(plain)), [31, 1], 'the Daedra Lord and an Imp');
  const legion = night({ md: ['legion'] });
  assert.deepEqual(nightMobiles(legion, profileOf(legion)), [31, 1, 35, 26], 'and his Imps, his Fire Atronachs and his Ward-Bearers');
  const dire = night({ pt: ['vanguard', 'sunder', 'captive'] });
  assert.deepEqual(nightMobiles(dire, profileOf(dire)), [31, 1, 27, 26, 35], 'a Daedroth, a Fire Daedra, his Flame (a Fire Atronach) - the Gaolers\' Daedra already among them');
  const rime = night({ md: ['rime', 'legion'] });
  assert.deepEqual(nightMobiles(rime, profileOf(rime)), [31, 1, 38, 25], 'under the rime: Ice Atronachs and Frost Daedra');
  assert.deepEqual(nightMobiles(GATE_STATE_EMPTY, null), []);
});

test('GATE-MIX the warm-up: each archive asked once a night, its frames uploaded at most SPRITE_WARM_UPLOADS a frame and never one already standing, every one in the end; forgotten with the court (mutants: no budget; a standing frame uploaded again; the night asked every frame)', async () => {
  const asks = [], ups = [], standing = new Set(['256_0#1']);
  const archives = { 286: archiveOf(2, 3), 256: archiveOf(2, 2) };
  const w = createSpriteWarm({
    getTexture: (a) => { asks.push(a); return Promise.resolve(archives[a] ?? null); },
    uploadRecordFrame: (a, r, f) => { ups.push(`${a}_${r}#${f}`); standing.add(`${a}_${r}#${f}`); },
    has: (a, rk) => standing.has(`${a}_${rk}`),
  });
  const s = night();
  w.want(s, profileOf(s));
  w.want(s, profileOf(s));
  assert.equal(w.step(), 0, 'nothing until an archive answers');
  await settle();
  assert.deepEqual(asks, [286, 256], 'his archive and the Imp\'s, once');
  const per = [];
  for (let i = 0; i < 5; i++) per.push(w.step());
  assert.deepEqual(per, [SPRITE_WARM_UPLOADS, 4, 1, 0, 0], 'four a frame, the last few, then nothing');
  assert.deepEqual(ups, ['286_0#0', '286_0#1', '286_0#2', '286_1#0', '286_1#1', '286_1#2', '256_0#0', '256_1#0', '256_1#1'], 'every frame once, the one standing passed by');
  w.clear();
  w.want(s, profileOf(s));
  await settle();
  assert.deepEqual(asks, [286, 256, 286, 256], 'a court come back to asks again');
  assert.ok(SPRITE_WARM_LOOKS >= SPRITE_WARM_UPLOADS);
});

test('GATE-MIX the warm-up looks over at most SPRITE_WARM_LOOKS frames a frame - a night whose frames all stand costs a bounded walk, not the whole archive (mutants: the look unbounded)', async () => {
  let looked = 0;
  const w = createSpriteWarm({ getTexture: () => Promise.resolve(archiveOf(40, 5)), uploadRecordFrame: () => {}, has: () => { looked++; return true; } });
  w.want(night(), profileOf(night()));
  await settle();
  w.step();
  assert.equal(looked, SPRITE_WARM_LOOKS);
});

test('GATE-MIX the court warms a Legion-Lord\'s host as I stand in it - its archives asked and frames uploaded before any of it has risen; nothing out of the court (mutants: the warm-up unwired; warmed off the court)', async () => {
  destroyGateBossBar();
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 }, asks = [], ups = [];
  let inside = false;
  const textures = new Map();
  const c = createGateCourt({
    renderer: { textures }, gl: null, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), audio: { play3d() {}, play3dId() {} },
    getTexture: (a) => { asks.push(a); return Promise.resolve(archiveOf(2, 2)); },
    uploadRecordFrame: (a, r, f) => { ups.push(`${a}_${r}#${f}`); textures.set(`${a}_${r}#${f}`, {}); },
    feet: () => (inside ? courtToDungeon(1, 0, 1) : null), player: () => ({ health: 500, maxHealth: 500 }), save: () => 0, strike: () => {}, rng: () => 0.5, send: () => true,
  });
  link.st = night({ md: ['legion'] });
  clock.t = 100; c.frame(); await settle(); c.frame();
  assert.deepEqual([asks.length, ups.length], [0, 0], 'not in the court: nothing');
  inside = true;
  for (let i = 0; i < 8; i++) { clock.t += 16; c.frame(); await settle(); }
  assert.deepEqual(asks.slice().sort((x, y) => x - y), [256, 281, 286, 290], 'his, the Imps\', the Ward-Bearers\' and the Atronachs\' archives');
  assert.equal(new Set(ups).size, 16, 'every frame of the four, once');
  assert.ok(ups.some((k) => k.startsWith('290_')) && ups.some((k) => k.startsWith('281_')), 'his host\'s among them, none of it risen');
});
