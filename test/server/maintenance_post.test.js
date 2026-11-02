// MAINTENANCE-APOLOGY (2026-11-02, the owner: "Please grant all users 500 aurum and an apology for the maintence. Grant
// MarioTheShiba 1000 aurum. In total 1500 for Mario"). The two gifts' law, migration 0209 run over accounts that stand (the
// real Worker on node:sqlite), and the letters in the box naming their gifts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from '../accountDb.mjs';
import { GIFTS, giftsOf, giftPiecesOf } from '../../src/net/giftLaw.js';
import { MAINTENANCE_POST, MAINTENANCE_PLUS_POST, maintenancePostSql, giftPostSql } from '../../tools/sendServerPost.mjs';
import { postGiftWords } from '../../src/ui/enhanced/enhancedPost.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('MAINTENANCE-APOLOGY the gifts\' law: `maintenance` gives 500 Aurum, `maintenanceplus` 1000, neither an armory piece; the letter\'s words name the Aurum', () => {
  assert.deepEqual(GIFTS.maintenance, { aurum: 500, armory: [] });
  assert.deepEqual(GIFTS.maintenanceplus, { aurum: 1000, armory: [] });
  assert.deepEqual(giftsOf({ gifts: 'thanks maintenance maintenanceplus' }), ['thanks', 'maintenance', 'maintenanceplus']);
  assert.deepEqual(giftPiecesOf({ gifts: 'maintenance maintenanceplus' }), [], 'no piece');
  assert.deepEqual(postGiftWords('maintenance'), ['500 Aurum']);
  assert.deepEqual(postGiftWords('maintenanceplus'), ['1,000 Aurum']);
  assert.throws(() => giftPostSql({ ...MAINTENANCE_POST, gift: 'nope' }), /not a gift/);
});

test('MAINTENANCE-APOLOGY migration 0209 is the tool\'s own statement; the apology to everyone, the extra to MarioTheShiba alone', () => {
  const mig = src('server-account/migrations/0209_maintenance_apology.sql');
  assert.ok(mig.trimEnd().endsWith(maintenancePostSql()), 'the tool\'s statement, as it prints it');
  assert.deepEqual([MAINTENANCE_POST.batch, MAINTENANCE_POST.gift, MAINTENANCE_POST.sender], ['maintenance-apology', 'maintenance', 'The DFO Team']);
  assert.deepEqual([MAINTENANCE_PLUS_POST.batch, MAINTENANCE_PLUS_POST.gift, MAINTENANCE_PLUS_POST.handles], ['maintenance-apology-plus', 'maintenanceplus', 'MarioTheShiba']);
  assert.match(MAINTENANCE_POST.body, /sorry for the maintenance/);
  assert.match(MAINTENANCE_POST.body, /500 Aurum is on your account now/);
  assert.match(MAINTENANCE_PLUS_POST.body, /1,500 in all/);
});

test('MAINTENANCE-APOLOGY over the accounts that stand: every registered account 500 Aurum and the apology, MarioTheShiba 1500 and both letters; a guest and an account made after none; run again, nothing doubles', async () => {
  const s = await standService({ AURUM_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const a = await s.registered('Patient'), b = await s.seated('AlsoPatient'), mario = await s.registered('MarioTheShiba'), g = await s.guest();
  const give = () => raw.exec(maintenancePostSql());
  give();
  give();   // run again: nothing doubles
  const later = await s.registered('Later');
  const balance = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).aurum?.balance;
  assert.equal(await balance(a), 500);
  assert.equal(await balance(b), 500);
  assert.equal(await balance(mario), 1500, 'Mario: 500 and 1000');
  assert.equal(await balance(later), 0, 'an account made after holds none');
  assert.equal(raw.prepare('SELECT gifts FROM players WHERE id = ?').get(mario.id).gifts, 'maintenance maintenanceplus');
  assert.equal(raw.prepare('SELECT gifts FROM players WHERE id = ?').get(a.id).gifts, 'maintenance');
  assert.equal(raw.prepare('SELECT gifts FROM players WHERE id = ?').get(g.id).gifts, '', 'a guest holds none');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM aurum_ledger WHERE kind = 'gift'").get().n, 4, 'three apologies, one extra');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM server_post WHERE batch = 'maintenance-apology'").get().n, 3, 'a letter each, once');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM server_post WHERE batch = 'maintenance-apology-plus'").get().n, 1, 'Mario\'s alone');
  const box = async (who) => (await (await s.fetch('https://accounts.invalid/v1/post/box', { headers: { authorization: `Bearer ${who.secret}` } })).json()).post ?? [];
  const mine = await box(mario);
  const apology = mine.find((p) => p.subject === MAINTENANCE_POST.subject), extra = mine.find((p) => p.subject === MAINTENANCE_PLUS_POST.subject);
  assert.deepEqual([apology?.gift, apology?.item, apology?.from], ['maintenance', null, 'The DFO Team'], JSON.stringify(mine));
  assert.deepEqual([extra?.gift, extra?.item], ['maintenanceplus', null]);
  assert.equal((await box(a)).some((p) => p.subject === MAINTENANCE_PLUS_POST.subject), false, 'the extra is Mario\'s alone');
});
