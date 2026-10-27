// RPT1026-CLIENT (private reports, 2026-10-18 to 10-20: a pack's count of Weir Keys fell back to one now and then from
// more; FIELD BUGS 2026-10-19f KEY-FACE's one door left open, Elite-Gates.md section 5). The account's balance is
// the count (`players.eg_keys`), and the pack's stack its face. A dungeon elite's find throws a face onto the body
// (systems/eliteGates/egFind.js egFindThrow), and the throw restacked the pack to the balance less THAT face alone - so a
// second find before the first body was looted, or a balance answer landing before the take-up, made the pack and the
// bodies together show a key the account never held, and the next answer took it back. Driven through the real find
// (registerEgFind, the world host's own throwKey), the real take (inventory.js takeOneInto) and the real load's fold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerEgFind, egFindThrow } from '../../../src/systems/eliteGates/egFind.js';
import { raiseEnemyDeath, registerEnemyDeathHandler } from '../../../src/scenes/corpseMarker.js';
import { weirKeysHeld, restackWeirKeys, foldStrayWeirKeys, weirKeysLying, isWeirKey, _resetWeirKeyFacesForTests } from '../../../src/systems/eliteGates/weirKey.js';
import { takeOneInto } from '../../../src/systems/inventory.js';
import { itemInfoRows } from '../../../src/systems/item/itemInfo.js';
import { weirKeys } from '../../../src/systems/eliteGates/weirKey.js';
import { EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';

const tick = () => new Promise((r) => setImmediate(r));
const elite = () => ({ eliteFoe: true, items: [], mobileType: 1 });

/** A player, the service's balance, and the find registered as scenes/world.js registers it (throwKey: egFindThrow). */
function rig() {
  _resetWeirKeyFacesForTests();
  const player = { items: [] };
  const S = { balance: 0, tier: 'elite' };
  const find = registerEgFind({
    ask: async () => { S.balance++; return { ok: true, data: { found: true, keys: S.balance, asks: 5 } }; },
    tierNow: () => S.tier, selfId: () => 'me', online: () => true,
    throwKey: (e, n) => egFindThrow(e, player.items, n),
  });
  const take = (body) => { for (const it of body.items.filter(isWeirKey)) takeOneInto(player, body.items, it); };
  const shown = (...bodies) => weirKeysHeld(player.items) + bodies.reduce((s, b) => s + weirKeysHeld(b.items), 0);
  return { player, S, find, take, shown, done: () => { find.dispose(); registerEnemyDeathHandler('eg-find', null); } };
}

test('RPT1026-CLIENT: two finds before either body is looted - the pack and the bodies show the balance, never a key more', async () => {
  const R = rig();
  try {
    const a = elite(), b = elite();
    raiseEnemyDeath(a, { by: null }); await tick();
    raiseEnemyDeath(b, { by: null }); await tick();
    assert.equal(R.S.balance, 2, 'the service found two');
    assert.deepEqual([weirKeysHeld(a.items), weirKeysHeld(b.items), weirKeysHeld(R.player.items)], [1, 1, 0], 'a face on each body, none in the pack yet');
    assert.equal(R.shown(a, b), 2);
    R.take(a);
    assert.equal(weirKeysHeld(R.player.items), 1);
    R.take(b);
    assert.equal(weirKeysHeld(R.player.items), 2, 'both taken up: the balance, not three');
    assert.equal(restackWeirKeys(R.player.items, R.S.balance), false, 'the next balance answer has nothing to take back');
  } finally { R.done(); }
});

test('RPT1026-CLIENT: a balance answer between the throw and the take-up leaves the face its key', async () => {
  const R = rig();
  try {
    R.S.balance = 3;
    restackWeirKeys(R.player.items, 3);
    const a = elite();
    raiseEnemyDeath(a, { by: null }); await tick();
    assert.deepEqual([weirKeysHeld(R.player.items), weirKeysHeld(a.items)], [3, 1]);
    // the keys asked again (every ten minutes, a preflight, a claim): the balance is 4, and one of them still lies on the body
    assert.equal(restackWeirKeys(R.player.items, 4), false, 'the pack is already the balance less the face lying');
    assert.equal(weirKeysLying(), 1);
    R.take(a);
    assert.deepEqual([weirKeysHeld(R.player.items), weirKeysLying()], [4, 0], 'taken up: the whole balance, and nothing lies');
    assert.equal(restackWeirKeys(R.player.items, 4), false);
  } finally { R.done(); }
});

test('RPT1026-CLIENT: out of the dungeon a face left on a body is folded off it and the pack shows the whole balance; a load keeps none as lying', async () => {
  const R = rig();
  try {
    const a = elite();
    raiseEnemyDeath(a, { by: null }); await tick();
    assert.deepEqual([weirKeysHeld(R.player.items), weirKeysHeld(a.items)], [0, 1]);
    R.S.tier = null;   // the player walked out with the body unlooted
    assert.equal(restackWeirKeys(R.player.items, 1), true);
    assert.deepEqual([weirKeysHeld(R.player.items), weirKeysHeld(a.items)], [1, 0], 'the key in the pack, no face left to take up twice');
    // a load: the world it reads is a new one - the old one's lying faces are no count
    R.S.tier = 'elite';
    const b = elite();
    raiseEnemyDeath(b, { by: null }); await tick();
    assert.equal(weirKeysLying(), 1);
    assert.equal(foldStrayWeirKeys([JSON.parse(JSON.stringify(b.items))]), 1, 'the saved body\'s face folded at the load');
    assert.equal(weirKeysLying(), 0);
    restackWeirKeys(R.player.items, 2);
    assert.equal(weirKeysHeld(R.player.items), 2);
  } finally { R.done(); }
});

test('RPT1026-CLIENT: the key\'s card says the keys are the account\'s, under its own line', () => {
  const rows = itemInfoRows(weirKeys(3), () => null);
  const at = rows.findIndex((r) => r.text === EG_TEXT.keyLine);
  assert.ok(at > 0, 'the key\'s own line');
  assert.equal(rows[at + 1]?.text, 'Every character on your account shares the same Weir Keys.');
});
