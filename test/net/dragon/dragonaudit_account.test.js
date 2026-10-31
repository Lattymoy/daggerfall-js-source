// AUDIT DRAGON (2026-10-29, the owner: "Can we audit everything and ensure perfection"; bible/11-Multiplayer/
// Dwarven-Dragon.md section 13): THE SERVICE IS THE RECORD - the tames it drew read back behind a session
// (`/v1/dragon/tames`), so a tame drawn while the mount waits is never lost with a device's storage; the dragons slain on
// the account's own card and the Inspect card; the device's recall joining the service's tames before a bind; and the
// tamed line saying the mount waits while it does. tools/mutants/dragonaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../../accountDb.mjs';
import { mintDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { dragonRecordText } from '../../../src/net/dragon/dragonClaims.js';
import { profileDragonLine, profileRecordLines } from '../../../src/ui/profileWindow.js';
import { DRAGON_CLAIM_TEXT } from '../../../src/systems/dragon/dragonWords.js';
import { DRAGON_MOUNT_ONLINE, DRAGON_MOUNT_TEMPLATE } from '../../../src/systems/dragon/dragonMount.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const W = 500_004;

test('AUDIT DRAGON the service\'s tames read back: `/v1/dragon/tames` behind a session answers this account\'s alone; the account\'s own view and the Inspect card carry the dragons slain, the Inspect card never the tames (mutants: the route unlisted; the record off the cards; a stranger\'s tames told)', async () => {
  const S = await standService();
  const who = await S.registered('Wyrmward');
  const r = await mintDragonReceipt({ q: W, b: 1, s: who.id, c: 5, x: 'dealt', l: 12 }, S.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.equal((await S.call('/v1/dragon/claim', { receipt: r, character: who.character, cid: 'a1b2c3d4e5f60718' }, who.secret)).status, 200);
  // the tame as the claim's draw writes it (a draw is one in a hundred: written here, so the read is always asked). The
  // claim's own draw, when it tamed, is cleared first: its random id beside this one failed the pin one run in a hundred.
  S.env.DB._raw.prepare('DELETE FROM dragon_mounts WHERE account = ?').run(who.id);
  S.env.DB._raw.prepare('INSERT OR IGNORE INTO dragon_mounts (id, account, char_id, look, watch, at) VALUES (?, ?, ?, ?, ?, ?)').run('dg0123456789abcdef', who.id, who.character, 1, W, 1);
  assert.equal((await S.call('/v1/dragon/tames', {}, null)).status, 401, 'behind a session');
  const tames = await S.call('/v1/dragon/tames', {}, who.secret);
  assert.equal(tames.status, 200);
  assert.deepEqual(tames.body.tames.map((m) => [m.id, m.character, m.look, m.watch]), [['dg0123456789abcdef', who.character, 1, W]], 'the tame, its character, its look and its watch');
  const other = await S.registered('Coilward');
  assert.deepEqual((await S.call('/v1/dragon/tames', {}, other.secret)).body.tames, [], 'another account\'s none');
  const idx = src('server-account/src/index.js');
  // PIN MOVED (AURA-FAST): the reads asked together, each in its place
  assert.match(idx, /const \[duels, gates, raids, serpents, dragons, [^\]]*\] = await Promise\.all\(\[\s*duelRecordOf\(ctx, who\.player\.id\), gateRecordOf\(ctx, who\.player\.id\), raidRecordOf\(ctx, who\.player\.id\), serpentRecordOf\(ctx, who\.player\.id\),\s*dragonRecordOf\(ctx, who\.player\.id\),/, 'the account\'s own view');
  assert.match(idx, /const \[duels, gates, raids, serpents, dragons, [^\]]*\] = await Promise\.all\(\[duelRecordOf\(ctx, body\.id\), gateRecordOf\(ctx, body\.id\), raidRecordOf\(ctx, body\.id\), serpentRecordOf\(ctx, body\.id\), dragonSlainOf\(ctx, body\.id\),/, 'the Inspect card\'s answer');
  const card = await S.call('/v1/duel/record', { id: who.id }, other.secret);
  assert.deepEqual(card.body.dragons, { slain: 1 }, 'a stranger is told the dragons slain, never the tames');
  const own = await (await S.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json();
  assert.deepEqual(own.account.dragons, { slain: 1, tamed: 1 }, 'its own card, both');
  assert.match(src('server-account/src/service.js'), /'\/v1\/dragon\/tames', \/\/ AUDIT DRAGON/);
  assert.match(src('src/net/duel/duelRecord.js'), /\.\.\.\(Number\.isSafeInteger\(d\?\.dragons\?\.slain\) \? \{ dragons: \{ slain: d\.dragons\.slain \} \} : \{\}\),/, 'and the Inspect card keeps it');
});

test('AUDIT DRAGON the cards\' words: the profile\'s line once there is one, the account card\'s count or none yet, nothing from a service before it (mutants: a line for none)', () => {
  assert.equal(profileDragonLine({ dragons: { slain: 0 } }), null);
  assert.equal(profileDragonLine({ dragons: { slain: 3 } }), 'Dragons slain: 3');
  assert.equal(profileRecordLines({ dragons: { slain: 2 } }).dragons, 'Dragons slain: 2');
  assert.equal(dragonRecordText({ slain: 4 }), '4');
  assert.equal(dragonRecordText({ slain: 0 }), 'None yet');
  assert.equal(dragonRecordText(null), null);
  assert.match(src('src/ui/enhanced/enhancedAccount.js'), /if \(dragons\) row\(t\('account\.card\.dragons', 'Dragons slain'\), dragons\);/);
  assert.match(src('src/ui/profileWindow.js'), /\['dfprofile-dragons', v\.dragons\]/);
});

test('AUDIT DRAGON the recall: with the mount on, the service\'s tames for the standing character join the device\'s copy and bind - a tame lost with a device\'s storage comes back; another character\'s stays the service\'s (mutants: the recall unasked; another character\'s recalled)', async () => {
  const { createDragonRewards } = await import('../../../src/scenes/dragonRewards.js');
  const { playerEntity } = await import('../../../src/characters/playerEntity.js');
  const storage = new Map();
  const rewardsStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const was = { items: playerEntity.items, id: playerEntity.characterId };
  playerEntity.items = []; playerEntity.characterId = 'char-0001';
  try {
    const served = [{ id: 'dgaaaaaaaaaaaaaaaa', character: 'char-0001', look: 1, watch: 7 }, { id: 'dgbbbbbbbbbbbbbbbb', character: 'char-0002', look: 0, watch: 8 }];
    let asked = 0;
    const rw = createDragonRewards({ rewardsStorage, takeSpoil: (p) => p.item && playerEntity.items.push(p.item), relayNowS: () => 0, chatNotice() {}, dragonMountOnline: true,
      dragonAccount: { me: () => 'acct-1', claim: async () => ({ ok: false, error: 'offline' }), tames: async () => { asked++; return { ok: true, data: { tames: served } }; } } });
    await rw.recall('char-0001');
    assert.equal(asked, 1);
    assert.deepEqual(rw.tames().map((t) => t.id), ['dgaaaaaaaaaaaaaaaa'], 'its own alone joined');
    assert.equal(rw.bind('char-0001'), true);
    assert.deepEqual(playerEntity.items.map((i) => [i.templateIndex, i.dragonId, i.dragonLook]), [[DRAGON_MOUNT_TEMPLATE, 'dgaaaaaaaaaaaaaaaa', 1]]);
    const off = createDragonRewards({ rewardsStorage, takeSpoil() {}, relayNowS: () => 0, chatNotice() {}, dragonMountOnline: false,
      dragonAccount: { me: () => 'acct-1', claim: async () => ({ ok: false }), tames: async () => { asked++; return { ok: true, data: { tames: served } }; } } });
    await off.recall('char-0001');
    assert.equal(asked, 1, 'the mount waiting: the service not asked');
    assert.match(src('src/scenes/dragonRewards.js'), /recall\(characterId\)\n\s*\.then\(\(\) => bind\(characterId\)\)/, 'a stand-up recalls, then binds');
  } finally { playerEntity.items = was.items; playerEntity.characterId = was.id; }
});

test('AUDIT DRAGON the tamed line says the mount waits while it does - never a dragon this release does not give (mutants: the line promising a ride)', () => {
  assert.equal(DRAGON_MOUNT_ONLINE, true);   // PIN MOVED (DRAGON-ON)
  assert.doesNotMatch(DRAGON_CLAIM_TEXT.tamed(), /after a later update/, 'on: the line gives the dragon it gives');   // PIN MOVED (DRAGON-ON)
});
