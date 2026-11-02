// SHADOW-FANG-MOD (2026-10-19, Mac: "Give the shadow fang title mod perms including ban"): THE SHADOW FANG TITLE
// MODERATES. Its holder may do all canModerate opens - mute, ban, unban, the strikes - and is protected as a moderator
// is; the grant is the title's own list (SHADOW_FANG_HANDLES), so off the list is off the rights. The shield stays the
// moderator list's: Shadow Fang's glyph is its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { canModerate, isModerator, glyphsOf, MOD_TIERS, TIER_LISTS } from '../../server-account/src/titles.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];

test('SHADOW-FANG-MOD THE GRANT: Shadow Fang is a title that moderates; SirMcMobdon, on its list in any case, may moderate without the shield; off the list, a guest and a near name may not (mutants: MOD_TIERS emptied; canModerate not reading it)', () => {
  assert.deepEqual([...MOD_TIERS], ['shadowfang']);
  for (const t of MOD_TIERS) assert.ok(Object.hasOwn(TIER_LISTS, t), `${t}: a title a list grants`);
  const env = { SHADOW_FANG_HANDLES: v('SHADOW_FANG_HANDLES') };
  assert.equal(env.SHADOW_FANG_HANDLES, 'SirMcMobdon');
  for (const h of ['SirMcMobdon', 'sirmcmobdon', 'SIRMCMOBDON']) {
    const row = { handle: h, created_at: 0 };
    assert.equal(canModerate(row, env), true, `${h}: may moderate`);
    assert.equal(isModerator(row, env), false, `${h}: not on the moderator list`);
    assert.deepEqual(glyphsOf(row, env, 10 ** 10), ['shadowfang'], `${h}: the wolf, no shield`);
  }
  assert.equal(canModerate({ handle: 'SirMcMobdon', created_at: 0 }, {}), false, 'off the list, off the rights');
  assert.equal(canModerate({ handle: null, guest_name: 'SirMcMobdon' }, env), false, 'a guest is no title holder');
  for (const h of ['SirMcMobdon_', 'SirMcMob', 'Mobdon']) assert.equal(canModerate({ handle: h }, env), false, `${h}: another account`);
  // the other made-for-one titles do not moderate
  const others = { PENITENT_HANDLES: 'Diggleborf', AEGIS_HANDLES: 'Sureme', PRIMARCH_HANDLES: 'GA00250', CRYSTAL_FIST_HANDLES: 'Flylighter', WIKIMAID_HANDLES: 'SylviaBun' };
  for (const h of ['Diggleborf', 'Sureme', 'GA00250', 'Flylighter', 'SylviaBun']) assert.equal(canModerate({ handle: h }, others), false, `${h}: no moderating`);
});

test('SHADOW-FANG-MOD THE SERVICE: a Shadow Fang holder mutes, bans, looks and unbans through the real Worker; a moderator cannot ban them; taken off the list, the same holder is refused (mutant: canModerate not reading MOD_TIERS)', async () => {
  const s = await standService({ SHADOW_FANG_HANDLES: 'SirMcMobdon', MODERATOR_HANDLES: 'Asynian' });
  const fang = await s.registered('SirMcMobdon');
  const mod = await s.registered('Asynian');
  const troll = await s.registered('Troll');
  assert.equal((await s.call('/v1/mod/mute', { target: troll.id, minutes: 30 }, fang.secret)).status, 200, '/mute');
  const ban = await s.call('/v1/mod/ban', { name: 'Troll', days: 7, reason: 'spam' }, fang.secret);
  assert.equal(ban.status, 200, '/ban');
  assert.equal(ban.body.target, troll.id);
  const look = await s.call('/v1/mod/strikes', { name: 'Troll' }, fang.secret);
  assert.equal(look.status, 200, '/strikes');
  assert.ok(look.body.bannedUntil > 0);
  assert.equal((await s.call('/v1/mod/unban', { target: troll.id }, fang.secret)).status, 200, '/unban');
  assert.equal((await s.call('/v1/mod/ban', { name: 'SirMcMobdon', days: 7 }, mod.secret)).body.error, 'protected', 'protected as a moderator is');
  s.env.SHADOW_FANG_HANDLES = '';
  assert.equal((await s.call('/v1/mod/ban', { name: 'Troll', days: 7 }, fang.secret)).status, 403, 'off the list: no ban');
});
