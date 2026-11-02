// GUILD-LETTER (2026-09-30, FIELD BUGS 2026-09-30 - a player's list: "cant withdraw gold from guild over wieght limit
// (good place to see if anyone stored cheated gold, was able to store gold befor the empires customs) should be able to
// take note of credit"). A guild treasury's withdrawal was paid in coin whatever it weighed: the Guild book credited the
// purse (scenes/world.js's guild wallet, court.js addGold) and the service the record's purse (net/realm/realmGoldLaw.js
// creditSave) - and a move is up to 1,000,000 gold, 2,500 kg, with Roleplay & Realism's encumbrance on online. The bank
// refuses what cannot be carried, and the trade window pays it as a letter of credit (tradeModes.js sellProceeds). The
// treasury pays as the trade window does: what the pack cannot carry comes as the game's own letter, worth the whole
// withdrawal, no commission taken - written on the record by the service and in the pack by the book, the same letter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { layRecord } from '../realmSeat.mjs';
import { SESSION_KEY, accountGuilds, accountRefusalText } from '../../src/net/accountClient.js';
import { GUILD_FOUND_RENOWN, GUILD_RANK_MASTER } from '../../src/net/guild/guildLaw.js';
import { realmLetterOfCredit, payableOf, liquidWorthOf } from '../../src/net/realm/realmGoldLaw.js';
import { GuildBook } from '../../src/net/guild/guildBook.js';
import { realmIo, createRealmSession, realmGoldAct } from '../../src/systems/realmSaves.js';
import { letterOfCredit, carriedWeight } from '../../src/systems/inventory.js';
import { entityMaxEncumbrance } from '../../src/combat/formulas.js';
import { sellProceeds, LETTER_OF_CREDIT_TEXT } from '../../src/systems/tradeModes.js';
import { addGold, deductGold, totalGoldAmount } from '../../src/systems/court.js';
import { guildDoneText } from '../../src/ui/socialPanel.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();

/** The record the service holds for a realm character now. */
const recordOf = (env, id) => {
  const row = env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id);
  return JSON.parse(new TextDecoder().decode(env.SAVES._map.get(row.obj)));
};

/** A guildmaster playing a realm character, its guild founded on its record and 60,000 of the record's gold put in. */
async function guildmaster() {
  const s = await standService();
  const who = await s.registered('Aldric', { renown: GUILD_FOUND_RENOWN });
  assert.equal((await s.found(who, { name: 'The Iron Oath', tag: 'IRON' })).status, 200, 'founded');
  const dep = await s.call('/v1/guilds/deposit', { character: who.character, gold: 60_000, realm: who.at() }, who.secret);
  assert.equal(dep.status, 200, 'the record put 60,000 in');
  const take = (gold, extra = {}) => s.call('/v1/guilds/withdraw', { character: who.character, gold, realm: who.at(), ...extra }, who.secret);
  return { s, who, take };
}

/** The world host's guild wallet (scenes/world.js - pinned to its source below) over a plain entity. */
const walletOf = (entity) => ({
  gold: () => totalGoldAmount(entity),
  pay: (n) => { deductGold(entity, n); },
  credit: (n, { letter = false } = {}) => { if (letter) (entity.items ??= []).unshift(realmLetterOfCredit(n)); else addGold(entity, n); },
  paper: (n) => sellProceeds(n, { carriedWeightKg: carriedWeight(entity), maxEncumbranceKg: entityMaxEncumbrance(entity) }).kind === 'letterOfCredit',
  region: () => 0,
});

test('GUILD-LETTER the service: a withdrawal asked as a letter is the game\'s own letter of credit on the record, at the front of its pack and worth the whole withdrawal - its purse untouched, a lit light moved with the pack and an unlit one left unlit; one asked as gold comes as gold (mutants: the record paid in coin; the treasury drops the letter; the record told nothing; the letter at the back; the light left behind; a light lit on the letter)', async () => {
  const { s, who, take } = await guildmaster();
  const torch = { group: 'UselessItems2', templateIndex: 247, name: 'Torch', value: 1, stackCount: 1 };
  const sword = { group: 'Weapons', templateIndex: 116, name: 'Longsword', value: 150, stackCount: 1 };
  layRecord(s.env, who.character, { ...recordOf(s.env, who.character), items: [sword, torch], lightSourceIndex: 1 });
  const gold = recordOf(s.env, who.character).goldPieces;
  // what is asked as gold comes as gold
  assert.deepEqual([(await take(1_000)).body.treasury, recordOf(s.env, who.character).goldPieces], [59_000, gold + 1_000]);
  assert.deepEqual(recordOf(s.env, who.character).items, [sword, torch]);
  // and what is asked as a letter comes as the letter
  const before = recordOf(s.env, who.character);
  const out = await take(20_000, { letter: true });
  assert.deepEqual([out.status, out.body.treasury], [200, 39_000], 'the treasury gave it');
  const after = recordOf(s.env, who.character);
  assert.deepEqual(after.items, [letterOfCredit(20_000), sword, torch], 'the game\'s letter, at the front of the pack as the trade window and the bank put one');
  assert.equal(after.goldPieces, gold + 1_000, 'no coin');
  assert.equal(liquidWorthOf(after.items[0]), 20_000, 'worth the whole withdrawal - no commission');
  assert.equal(payableOf(after) - payableOf(before), 20_000, 'and it pays as gold does');
  assert.equal(after.lightSourceIndex, 2, 'the lit torch is still the lit torch');
  // a record with no light lit keeps none
  layRecord(s.env, who.character, { ...recordOf(s.env, who.character), lightSourceIndex: -1 });
  await take(500, { letter: true });
  assert.deepEqual([recordOf(s.env, who.character).lightSourceIndex, recordOf(s.env, who.character).items[0]], [-1, letterOfCredit(500)]);
});

test('GUILD-LETTER the service reads `letter` as `true` or as nothing: a torn or unknown word pays in coin, never a letter (mutants: any word a letter)', async () => {
  const { s, who, take } = await guildmaster();
  for (const torn of ['true', 1, 'yes', {}, [true], null]) {
    const was = recordOf(s.env, who.character);
    const r = await take(100, { letter: torn });
    assert.equal(r.status, 200, JSON.stringify(torn));
    const now = recordOf(s.env, who.character);
    assert.deepEqual([now.goldPieces - was.goldPieces, now.items.length], [100, was.items.length], `${JSON.stringify(torn)} is no letter`);
  }
});

test('GUILD-LETTER the client, end to end: the Guild book weighs before it asks - the pack\'s real carried weight against the real max encumbrance - and what fits comes as coins, what does not as a letter the book writes into the pack exactly as the service wrote it into the record; the old lane pays a letter too (mutants: decided never; the letter unasked; the door drops the letter; the apply pays coins; the old lane pays coins; the answer unsaid; a refusal says a letter)', async () => {
  const { s, who } = await guildmaster();
  const storage = sessionStorageOf(SESSION_KEY, who);
  const door = accountGuilds({ fetch: s.fetch, storage });
  const wrote = [];
  const withdraw = door.withdraw;
  door.withdraw = async (...a) => { const r = await withdraw(...a); wrote.push(recordOf(s.env, who.character)); return r; };   // what the service wrote, before the book applies
  const at = who.at();
  const session = createRealmSession({ io: realmIo({ fetch: s.fetch, storage }), id: at.id, lease: at.lease, seq: at.seq });
  // Strength 50 carries 75 kg; 20,000 coins weigh 50
  const entity = { name: 'Aldric', stats: { strength: 50 }, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] };
  const book = new GuildBook({
    door, character: () => who.character, wallet: () => walletOf(entity),
    realm: { act: (o) => realmGoldAct({ session, checkpoint: () => session.checkpoint(JSON.stringify(entity)), wait: noWait, ...o }) },
  });
  const same = () => assert.deepEqual(wrote.at(-1), JSON.parse(JSON.stringify(entity)), 'the record the service wrote is the pack the book wrote');
  // 10,000 more weigh 25: exactly the 75 carried - coins
  const coins = await book.withdraw(10_000);
  assert.deepEqual([coins.ok, coins.letter, entity.goldPieces, entity.items], [true, undefined, 30_000, []]);
  same();
  // any more is past it: a letter, on both sides
  const paper = await book.withdraw(5_000);
  assert.deepEqual([paper.ok, paper.letter, entity.goldPieces, entity.items], [true, true, 30_000, [letterOfCredit(5_000)]]);
  same();
  assert.equal(guildDoneText('5,000 gold taken out.', paper), `5,000 gold taken out. ${LETTER_OF_CREDIT_TEXT}`, 'the tab says so');
  // the ceiling is the live one: stronger, the same withdrawal fits
  entity.stats.strength = 100;
  const fits = await book.withdraw(5_000);
  assert.deepEqual([fits.ok, fits.letter, entity.goldPieces, entity.items.length], [true, undefined, 35_000, 1]);
  same();
  // THE OLD LANE (a character no record stands behind - its save is its own): a letter too, on the service's answer
  const guildId = s.env.DB._raw.prepare('SELECT id FROM guilds').get().id;
  s.env.DB._raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, 'an-offline-id-0002', ?, ?, 'Old', 1)").run(who.id, guildId, GUILD_RANK_MASTER);
  const old = { stats: { strength: 50 }, goldPieces: 30_000, items: [] };
  const oldBook = new GuildBook({ door: accountGuilds({ fetch: s.fetch, storage }), character: () => 'an-offline-id-0002', wallet: () => walletOf(old) });
  const oldOut = await oldBook.withdraw(1_000);
  assert.deepEqual([oldOut.ok, oldOut.letter, old.goldPieces, old.items], [true, true, 30_000, [letterOfCredit(1_000)]]);
  const refused = await oldBook.withdraw(1_000_000);
  assert.deepEqual([refused.ok, refused.letter, old.items.length], [false, undefined, 1], 'a refusal pays nothing and says no letter');
});

test('GUILD-LETTER one letter: the realm\'s maker, which the Worker bundles, is the game\'s letter (inventory.js letterOfCredit) - template, name, worth - and the realm counts it at its worth; the tab says the trade window\'s own line, and nothing more for gold (mutants: the letter misnamed; the tab silent; the line unsaid; the tab takes any word)', () => {
  for (const n of [100, 20_000, 1_000_000]) {
    assert.deepEqual(realmLetterOfCredit(n), letterOfCredit(n));
    assert.deepEqual([liquidWorthOf(realmLetterOfCredit(n)), payableOf({ items: [realmLetterOfCredit(n)] })], [n, n]);
  }
  assert.equal(LETTER_OF_CREDIT_TEXT, 'You are paid with a letter of credit.');
  assert.equal(guildDoneText('20,000 gold taken out.', { ok: true, letter: true }), '20,000 gold taken out. You are paid with a letter of credit.');
  assert.equal(guildDoneText('20,000 gold taken out.', { ok: true }), '20,000 gold taken out.');
  assert.equal(guildDoneText('20,000 gold taken out.', { ok: true, letter: 'yes' }), '20,000 gold taken out.');
  // AUDIT GUILD1d R13: an act's word may be the answer's own (the hall's sale says its sum) - through the same door
  assert.match(src('src/ui/socialPanel.js'), /guildUi\.word = r\?\.ok \? guildDoneText\(typeof okWord === 'function' \? okWord\(r\) : okWord, r\) : guildWordText\(r\?\.error, r, Math\.floor\(social\.now\(\) \/ 1000\)\);/, 'every act\'s word goes through it');   // PIN MOVED (AUDIT2 GUILD2 S2/S7): and its reason
});

test('GUILD-LETTER the host: the world\'s guild wallet weighs a withdrawal by the real carried weight against the real max encumbrance, and writes the realm\'s letter at the front of the pack or the coins (mutants: the weight unread; the ceiling unread; the host pays coins)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /credit: \(n, \{ letter = false \} = \{\}\) => \{ if \(letter\) \(playerEntity\.items \?\?= \[\]\)\.unshift\(realmLetterOfCredit\(n\)\); else addGold\(playerEntity, n\); \},/);
  assert.match(w, /paper: \(n\) => sellProceeds\(n, \{ carriedWeightKg: carriedWeight\(playerEntity\), maxEncumbranceKg: entityMaxEncumbrance\(playerEntity\) \}\)\.kind === 'letterOfCredit',/);
});

test('GUILD-LETTER the reporter\'s parenthesis: a realm character takes out only what realm characters put in (AUDIT REALM L1-F3) - and the refusal says that rule, where it said only "before the realm" (mutants: the old words)', () => {
  const said = accountRefusalText('guild-treasury-old');
  assert.match(said, /can only take out gold that realm characters put in/);
  assert.match(said, /before the realm or from a character outside it/);
  assert.match(said, /stays in the treasury/);
});
