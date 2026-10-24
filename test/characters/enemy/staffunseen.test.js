// STAFF-UNSEEN (2026-10-24, mob: "staff in overworld and flat need to stay in it and not have mobs pull them out"; the
// card's pick "Monsters ignore hidden staff"): a hidden staff member is no one to a foe - never seen, heard or
// stealth-detected, a seer included, the blind pursuit given up - and the page's follow says so on the player entity
// each online frame (scenes/staffFollowHost.js staffFollowOnPage), which the senses context reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAI } from '../../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../../src/player/collider.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { sensesContext } from '../../../src/scenes/shared.js';
import { staffFollowOnPage } from '../../../src/scenes/staffFollowHost.js';

setPref('enhancedAI', false);
const tick = (ai, feet, senses) => { for (let i = 0; i < 4; i++) ai.update(1 / 60, feet, senses); };
const base = { gameMinutes: 2, playerStealth: 0, movingLessThanHalfSpeed: false, sharedStealth: { minute: -1 }, rolls: () => 0.5 };

test('STAFF-UNSEEN motor: a foe in plain sight, close enough to hear, and a seer never sense a hidden staff member - and one already hunting gives up at once', () => {
  const c = new Collider(() => -100);
  const inFront = [0, 0, 3];
  const ai = new EnemyAI(c, [0, 0, 0], 0, {});
  tick(ai, inFront, base);
  assert.ok(ai.detected && ai.inSight, 'shown: seen');
  assert.ok(ai.giveUpTimer > 0);
  tick(ai, inFront, { ...base, playerUnseen: true });
  assert.deepEqual([ai.detected, ai.inSight, ai.giveUpTimer], [false, false, 0], 'hidden: no one - no pursuit left to spend');
  const seer = new EnemyAI(c, [0, 0, 0], 0, { seesThroughInvisibility: true });
  tick(seer, inFront, { ...base, playerInvisible: true, playerUnseen: true });
  assert.deepEqual([seer.detected, seer.inSight], [false, false], 'a seer sees no more of them');
  tick(seer, inFront, { ...base, playerInvisible: true });
  assert.ok(seer.detected, 'only invisible: the seer sees them as ever');
});

test('STAFF-UNSEEN senses: the context reads the entity\'s flag, true alone', () => {
  assert.equal(sensesContext({ staffHidden: true }, 10).playerUnseen, true);
  assert.equal(sensesContext({ staffHidden: 1 }, 10).playerUnseen, false);
  assert.equal(sensesContext({}, 10).playerUnseen, false);
});

test('STAFF-UNSEEN page: the entity is hidden while the game\'s last token is, and online', async () => {
  const body = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  let hd = 1;
  const main = { url: null, mintToken: async () => `v1.${body({ s: 'x', ...(hd ? { hd: 1 } : {}) })}.sig` };
  let online = main;
  const entity = {};
  const win = { location: { origin: 'https://game.test' }, addEventListener: () => {}, postMessage: () => {} };
  const page = staffFollowOnPage({ main: () => online, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 2 }), toScene: () => null, win, entity });
  page.frame();
  assert.equal(entity.staffHidden, false, 'nothing minted yet');
  await main.mintToken(null);
  page.frame();
  assert.equal(entity.staffHidden, true, 'a hidden token');
  hd = 0; await main.mintToken(null);
  page.frame();
  assert.equal(entity.staffHidden, false, 'shown again');
  hd = 1; await main.mintToken(null);
  online = null;
  page.frame();
  assert.equal(entity.staffHidden, false, 'offline: no one is hidden');
  const { playerEntity } = await import('../../../src/characters/playerEntity.js');
  staffFollowOnPage({ main: () => null, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 2 }), toScene: () => null, win }).frame();
  assert.equal(playerEntity.staffHidden, false, 'by default the game\'s own player');
  assert.doesNotThrow(() => staffFollowOnPage({ main: () => online, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 2 }), toScene: () => null, win, entity: null }).frame(), 'no entity: nothing to say');
});
