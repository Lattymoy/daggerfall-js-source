// STAR7 (bible/11-Multiplayer/Starfall.md section 6): THE FALLEN STARS HELD, AS THE SERVICE KEEPS THEM - a star's `j1`
// receipt counted once a (star, account), nine a UTC day of its fall, paid in Renown to the character that fought it and
// in silver under the day's combat cap, its spoils given once a device, a guest thanked and never counted, the cards'
// count. The real Worker over node:sqlite with every migration applied (test/accountDb.mjs). tools/mutants/star7.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../../accountDb.mjs';
import { mintStarReceipt } from '../../../src/net/starfall/starReceipt.js';
import { STAR_HOUR_MS, starTimes } from '../../../src/net/starfall/starfallLaw.js';
import { MARKS_FAUCETS, MARKS_COMBAT } from '../../../src/net/marksLaw.js';
import { STAR_CLAIMS_DAY_MAX, starKeyOf, starDayOf } from '../../../server-account/src/stars.js';
import { progressSpentOf } from '../../../server-account/src/progress.js';
import { renownRaidXp, renownForXp } from '../../../src/net/renown.js';
import { spoilsGrant } from '../../../server-account/src/budget.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)

const { subtle } = globalThis.crypto;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);

/** A night inside the window, and the stars of the four nights from it - one UTC day's (05:00 to 08:00). */
const N = Math.ceil(FESTIVAL_FROM_MS / STAR_HOUR_MS) + 5;
const STARS = Array.from({ length: 12 }, (_, i) => [N + Math.floor(i / 3), i % 3]);
const CH = 'char-0001';
const CID = '0123456789abcdef', CID2 = 'fedcba9876543210';

async function stand(extra = {}) {
  const s = await standService({ MARKS_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  const receipt = (who, [n, k] = [N, 0], key = s.gateKey, l = 14) => mintStarReceipt({ n, k, s: who.id, c: 77, l }, key, { subtle, nowS: _now });
  const star = async (who, nk = [N, 0], { cid = null, r = null, character = CH } = {}) => s.call('/v1/star/claim', {
    receipt: r ?? await receipt(who, nk), character, name: who.handle, ...(cid ? { cid } : {}),
  }, who.secret);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  return { ...s, raw, receipt, star, balance };
}

test('STAR7 THE LAW: a star strikes 30 silver, a combat faucet under the day\'s 150 with the gates, the raids, the serpents and the Spire; nine a UTC day; a star\'s row is its night and star, its day the one it fell (mutants: the amount; the cap\'s kinds; the day the claim\'s)', () => {
  assert.deepEqual(MARKS_FAUCETS.star, { amount: 30 });
  assert.ok(MARKS_COMBAT.kinds.includes('star'));
  assert.equal(MARKS_COMBAT.perDay, 150, 'the ceiling unmoved');
  assert.equal(STAR_CLAIMS_DAY_MAX, 9);
  assert.equal(starKeyOf(N, 2), `${N}.2`);
  assert.equal(starDayOf(N, 0), Math.floor(starTimes(N, 0).fallAt / 86_400_000));
  assert.equal(new Set(STARS.map(([n, k]) => starDayOf(n, k))).size, 1, 'the rig\'s twelve stars fell on one UTC day');
  assert.deepEqual(progressSpentOf('/v1/star/claim', { recorded: true, renown: { credited: 300 } }), [['renown', 300]], 'its Renown spent from the hour\'s bucket');
  assert.deepEqual(progressSpentOf('/v1/star/claim', { recorded: false, why: 'claimed' }), []);
});

test('STAR7 THE CLAIM: a star held counts once - its row, the character\'s Renown, 30 silver; the same receipt again is `claimed` and pays nothing; another account\'s receipt is not yours; an unsigned one is refused by its rung; the cards count it (mutants: counted twice; the account unchecked; the cards silent)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  const bo = await s.registered('Bors', { character: CH });
  const a = await s.star(ann, [N, 0], { cid: CID });
  assert.equal(a.status, 200);
  assert.equal(a.body.recorded, true);
  assert.equal(a.body.held, 1);
  assert.equal(a.body.spoils, true, 'the first claim of its device');
  assert.equal(a.body.renown.character, CH);
  assert.equal(a.body.renown.credited, renownRaidXp(1), 'a raid\'s Renown at the track\'s level');
  assert.equal(a.body.marks.struck, MARKS_FAUCETS.star.amount);
  assert.equal(s.balance(ann), 30);
  assert.equal('key' in a.body || 'struck' in a.body, false, 'the service\'s own words stay its own');
  const row = s.raw.prepare('SELECT * FROM stars_held WHERE account = ?').get(ann.id);
  assert.deepEqual([row.star, row.day, row.char_id, row.xp], [`${N}.0`, starDayOf(N, 0), CH, renownRaidXp(1)]);
  const again = await s.star(ann, [N, 0], { cid: CID });
  assert.deepEqual([again.body.recorded, again.body.why, again.body.held, again.body.spoils], [false, 'claimed', 1, true], 'the same device again: answered the same');
  assert.equal((await s.star(ann, [N, 0], { cid: CID2 })).body.spoils, false, 'a second browser: no spoils');
  assert.equal(s.balance(ann), 30, 'nothing struck twice');
  const theirs = await s.star(bo, [N, 0], { r: await s.receipt(ann, [N, 1]) });
  assert.deepEqual([theirs.status, theirs.body.error], [403, 'not-yours']);
  const unsigned = await s.star(bo, [N, 1], { r: await s.receipt(bo, [N, 1], null) });
  assert.deepEqual([unsigned.status, unsigned.body.error, unsigned.body.why], [400, 'receipt', 'unsigned']);
  // the cards
  const mine = await s.fetch('https://accounts.invalid/v1/account', { method: 'GET', headers: { authorization: `Bearer ${ann.secret}` } });
  assert.deepEqual((await mine.json()).account.stars, { held: 1 });
  assert.deepEqual((await s.call('/v1/duel/record', { id: ann.id }, bo.secret)).body.stars, { held: 1 }, 'and another player\'s view of the card');
});

test('STAR7 THE DAY\'S BOUND AND THE CAP: nine stars counted on the day they fell, the tenth `day-full`; the day\'s combat silver stops at 150 - the claim still counted, its silver what the day had left; a guest is given the spoils once a device and counted never (mutants: the bound by the claim\'s day; the cap unread; a guest counted; the silver unguarded)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  const said = [];
  for (const nk of STARS.slice(0, 10)) said.push((await s.star(ann, nk)).body);
  assert.deepEqual(said.map((b) => b.recorded), [...Array(9).fill(true), false]);
  assert.equal(said[9].why, 'day-full');
  assert.deepEqual(said.map((b) => b.marks?.struck ?? null).slice(0, 9), [30, 30, 30, 30, 30, 0, 0, 0, 0], 'five stars fill the day\'s 150');
  assert.equal(said[5].marks.why, 'cap');
  assert.equal(s.balance(ann), 150);
  // a guest
  const g = await s.guest();
  const gw = { id: g.id, secret: g.secret, handle: null };
  const one = await s.star(gw, [N, 0], { cid: CID });
  assert.deepEqual([one.body.recorded, one.body.why, one.body.spoils, one.body.held], [false, 'guest', true, 0]);
  assert.equal((await s.star(gw, [N, 0], { cid: CID2 })).body.spoils, false, 'another device of the guest');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM stars_held WHERE account = ?').get(g.id).n, 0);
  // a star that fell the next day counts on that day's own bound, whenever it is claimed
  const next = await s.star(ann, [N + 24, 0]);
  assert.equal(next.body.recorded, true, 'its own day\'s first');
  assert.equal(starDayOf(N + 24, 0), starDayOf(N, 0) + 1);
  // a claim its day's bound refuses strikes no silver: the silver is the row's
  const bo = await s.registered('Bors', { character: CH });
  for (let i = 0; i < STAR_CLAIMS_DAY_MAX; i++) s.raw.prepare('INSERT INTO stars_held (star, account, day, char_id, xp, nonce, at) VALUES (?, ?, ?, ?, 0, ?, ?)').run(`${N - 100 + i}.0`, bo.id, starDayOf(N, 0), CH, `n${i}`, T0);
  const full = await s.star(bo, [N, 0]);
  assert.equal(full.body.why, 'day-full');
  assert.equal(s.balance(bo), 0, 'no row, no silver');
});

test('STAR7 THE MIGRATION AND THE DEPLOY: stars_held and star_spoils, one row a (star, account), cascading with their account; the route declared beside the raid\'s; the account Worker\'s deploy watches the star\'s law and receipt (mutants: the key; the cascade)', async () => {
  const sql = src('server-account/migrations/0141_stars_held.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS stars_held \([\s\S]*PRIMARY KEY \(star, account\),\s*FOREIGN KEY \(account\) REFERENCES players\(id\) ON DELETE CASCADE/);
  assert.match(sql, /\n {2}cid {5}TEXT,\n {2}PRIMARY KEY \(star, account\)/, 'AUDIT STARFALL B3: the claim id that wrote the row');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS star_spoils \([\s\S]*PRIMARY KEY \(star, account\),\s*FOREIGN KEY \(account\) REFERENCES players\(id\) ON DELETE CASCADE/);
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  await s.star(ann, [N, 0], { cid: CID });
  s.raw.prepare('DELETE FROM players WHERE id = ?').run(ann.id);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM stars_held').get().n, 0, 'gone with its account');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM star_spoils').get().n, 0);
  const deploy = src('.github/workflows/account-deploy.yml');
  assert.match(deploy, /- "src\/net\/starfall\/starReceipt\.js"/);
  assert.match(deploy, /- "src\/net\/starfall\/starfallLaw\.js"/);
});

test('AUDIT STARFALL B3: AN ANSWER LOST AFTER THE BATCH - the fill (INT5) rides the claim\'s own batch, by its row alone; a 5xx past the batch keeps the row, the Renown, the silver and the fill, and the retry is `claimed` with what the lost answer said - the row is this device\'s own (its claim id), the count, the Renown the row credited its character - never to another device\'s claim, and paying nothing again (mutants: B3-the-fill-after-the-batch; B3-the-fill-unguarded; B3-own-for-every-device; B3-the-snapshot-unsaid; B3-the-row-unstamped)', async () => {
  clock(T0);
  const s = await stand();
  const ann = await s.registered('Anna', { character: CH });
  s.raw.prepare('INSERT INTO realm_characters (id, player, name, lease, created_at, updated_at, allowance, level_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('rc-star', ann.id, 'Anna', 'lease-1', T0, T0, 1000, 1);
  const allowance = () => s.raw.prepare('SELECT allowance FROM realm_characters WHERE id = ?').get('rc-star').allowance;
  // the first claim: counted, and its fill in the same batch
  const a = await s.star(ann, [N, 0], { cid: CID });
  assert.equal(a.body.recorded, true);
  assert.equal(allowance(), 1000 + spoilsGrant(1), 'the signed win\'s fill');
  const again = await s.star(ann, [N, 0], { cid: CID });
  assert.deepEqual([again.body.why, again.body.own, again.body.held], ['claimed', true, 1], 'this device\'s own row');
  assert.deepEqual(again.body.renown, { character: CH, xp: renownRaidXp(1), level: renownForXp(renownRaidXp(1)), credited: renownRaidXp(1), rose: renownForXp(renownRaidXp(1)) > 1 }, 'what the row credited its character, the track as it stands');
  assert.equal(allowance(), 1000 + spoilsGrant(1), 'a retry fills nothing');
  assert.equal(s.balance(ann), 30, 'and strikes nothing');
  const theirs = await s.star(ann, [N, 0], { cid: CID2 });
  assert.deepEqual([theirs.body.why, 'own' in theirs.body, 'renown' in theirs.body], ['claimed', false, false], 'another device\'s claim: nothing of the row\'s to finish');
  assert.equal(s.raw.prepare('SELECT cid FROM stars_held WHERE account = ?').get(ann.id).cid, CID, 'the row names the claim that wrote it');
  // A 5xx PAST THE BATCH: the measure after it fails (its table gone) - the row, the Renown, the silver and the fill stand
  const bo = await s.registered('Bors', { character: CH });
  s.raw.prepare('INSERT INTO realm_characters (id, player, name, lease, created_at, updated_at, allowance, level_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('rc-bors', bo.id, 'Bors', 'lease-2', T0, T0, 500, 1);
  s.raw.exec('ALTER TABLE progress_hours RENAME TO progress_hours_gone');
  const lost = await s.star(bo, [N, 1], { cid: CID });
  s.raw.exec('ALTER TABLE progress_hours_gone RENAME TO progress_hours');
  assert.ok(lost.status >= 500, `the answer lost (${lost.status})`);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM stars_held WHERE account = ?').get(bo.id).n, 1, 'the row committed');
  assert.equal(s.raw.prepare('SELECT allowance FROM realm_characters WHERE id = ?').get('rc-bors').allowance, 500 + spoilsGrant(1), 'and the fill with it');
  assert.equal(s.balance(bo), 30, 'and the silver');
  const retry = await s.star(bo, [N, 1], { cid: CID });
  assert.deepEqual([retry.status, retry.body.recorded, retry.body.why, retry.body.own, retry.body.held, retry.body.renown.character, retry.body.renown.credited], [200, false, 'claimed', true, 1, CH, renownRaidXp(1)], 'the retry: what the lost answer said');
  assert.equal(s.raw.prepare('SELECT allowance FROM realm_characters WHERE id = ?').get('rc-bors').allowance, 500 + spoilsGrant(1), 'filled once');
  // a claim the day's bound refuses fills nothing: no row, no fill
  const cy = await s.registered('Cyra', { character: CH });
  s.raw.prepare('INSERT INTO realm_characters (id, player, name, lease, created_at, updated_at, allowance, level_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('rc-cyra', cy.id, 'Cyra', 'lease-3', T0, T0, 700, 1);
  for (let i = 0; i < STAR_CLAIMS_DAY_MAX; i++) s.raw.prepare('INSERT INTO stars_held (star, account, day, char_id, xp, nonce, at) VALUES (?, ?, ?, ?, 0, ?, ?)').run(`${N - 100 + i}.0`, cy.id, starDayOf(N, 0), CH, `n${i}`, T0);
  assert.equal((await s.star(cy, [N, 0], { cid: CID })).body.why, 'day-full');
  assert.equal(s.raw.prepare('SELECT allowance FROM realm_characters WHERE id = ?').get('rc-cyra').allowance, 700, 'no row, no fill');
  const svc = src('server-account/src/index.js');
  const route = svc.slice(svc.indexOf("if (path === '/v1/star/claim'"), svc.indexOf("if (path === '/v1/serpent/claim'"));
  assert.ok(route.length > 0 && !route.includes('grantSpoils('), 'no fill after the batch');
});
