// STAFF-PANEL3-PLAYERS (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 3, "Players and
// nameplates") - THE PANEL'S PLAYERS (server-account/src/staffPlayers.js), driven through the real Worker on the
// node:sqlite database every account pin stands on (test/accountDb.mjs): the search, a profile's card and badges and each
// tab, the devices and Sign out everywhere, and the rename of a handle or a character's name - Admins alone, every read
// and act written down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { PLAYER_ROUTES, PLAYER_TABS, PLAYERS_PAGE, ITEMS_PAGE, NAME_COPIES, profileBadges, saveViewOf, listedHandles, isPieceFinding } from '../../server-account/src/staffPlayers.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { realmLetterOfCredit } from '../../src/net/realm/realmGoldLaw.js';
import { PLAY_GRACE_S } from '../../src/net/playClock.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The record the pins read: a character of level 12 with a sword worn, a letter of credit and bread in the pack, ore in
 *  the wagon and the Materials Bag, and a goblet stored in a home. */
const RECORD = {
  name: 'Brisk', level: 12, goldPieces: 500, bankAccounts: [{ accountGold: 250, loanTotal: 0 }],
  stats: { strength: 61, intelligence: 50, willpower: 40, agility: 55, endurance: 45, personality: 30, speed: 50, luck: 50 },
  skills: [10, 20, 30],
  items: [
    { name: 'Steel Longsword', group: 'Weapons', templateIndex: 120, material: 2, quality: 7, value: 300, equipSlot: 9 },
    realmLetterOfCredit(5000),
    { name: 'Bread', group: 'Food', templateIndex: 9999, value: 1 },
  ],
  wagonItems: [{ name: 'Iron Ore', group: 'Ingredients', templateIndex: 9998, value: 2 }],
  bagItems: [{ name: 'Copper Ore', group: 'Ingredients', templateIndex: 9997, value: 2 }],
  sceneCache: { scenes: [{ sceneName: 'DaggerfallInterior [MapID=1, BuildingKey=2]', decorItems: { shelf: [{ name: 'Silver Goblet', group: 'Plate', templateIndex: 9996, value: 40 }] } }] },
};

/** The Worker with the panel set up: mob (an Admin and owner) and Asynian (a Moderator) signed in, Brisk playing a realm
 *  character, Sylvia a second player, and SquidKamer's title on a list. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', DUNGEON_MASTER_HANDLES: 'SquidKamer',
    OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`, DISCORD_MODERATORS: '111111111111111111:Asynian,333333333333333333:Watcher9',
  });
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const key = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await key.proof('enroll', 'Asynian')) })).body;
  assert.ok(asy.session && mob.session);
  const brisk = await s.seated('Brisk', { save: RECORD });
  const sylvia = await s.seated('Sylvia');
  const raw = s.env.DB._raw;
  const char = raw.prepare('SELECT * FROM realm_characters WHERE id = ?').get(brisk.character);
  const audits = (act) => raw.prepare('SELECT target, detail, outcome, role FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r }));
  return { ...s, raw, staff, mob, asy, brisk, sylvia, char, audits };
}

test('STAFF-PANEL3-PLAYERS: the doors are listed among the staff panel\'s; none opens without a staff session, and a Moderator is refused every one and written down (mutant: the role check)', async () => {
  for (const r of PLAYER_ROUTES) assert.ok(STAFF_ROUTES.has(r), r);
  const s = await stand();
  for (const r of PLAYER_ROUTES) {
    assert.deepEqual((await s.staff(r, { target: s.brisk.id })).status, 401, r);
    assert.equal((await s.staff(r, { target: s.brisk.id }, s.brisk.secret)).status, 401, `${r}: a game secret is no staff session`);
    const mod = await s.staff(r, { target: s.brisk.id, q: 'B' }, s.asy.session);
    assert.deepEqual([mod.status, mod.body], [403, { error: 'staff-admin' }], r);
  }
  const refused = s.audits('refused');
  assert.equal(refused.length, PLAYER_ROUTES.length);
  assert.ok(refused.every((a) => a.outcome === 'denied' && a.role === 'moderator' && JSON.parse(a.detail).need === 'admin'));
  assert.equal(s.audits('player-read').length + s.audits('players-search').length + s.audits('rename').length, 0, 'nothing read, nothing done');
  assert.equal(s.raw.prepare('SELECT handle FROM players WHERE id = ?').get(s.brisk.id).handle, 'Brisk');
});

test('STAFF-PANEL3-PLAYERS: THE SEARCH - every account by its handle or a character\'s name, any case, a prefix; "online now" a filter; paged by handle; written down once in ten minutes a view (mutants: the name half; the online filter; the page)', async () => {
  const s = await stand();
  const r = await s.staff('/v1/staff/players', { q: 'bri' }, s.mob.session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.players.map((p) => p.handle), ['Brisk']);
  assert.deepEqual(r.body.players[0].characters.map((c) => [c.id, c.name, c.playing]), [[s.brisk.character, 'Brisk', true]]);
  assert.equal(r.body.next, null);
  // a character's name finds its account, whatever the handle
  s.raw.prepare('UPDATE realm_characters SET name = ? WHERE id = ?').run('Thornwick', s.sylvia.character);
  assert.deepEqual((await s.staff('/v1/staff/players', { q: 'THORN' }, s.mob.session)).body.players.map((p) => p.handle), ['Sylvia'], 'by a character\'s name, any case');
  assert.deepEqual((await s.staff('/v1/staff/players', { q: 'horn' }, s.mob.session)).body.players, [], 'a prefix, never the middle of a name');
  // online now: a tab that beat inside the play clock's grace
  s.raw.prepare('UPDATE players SET played_at = ? WHERE id = ?').run(nowS() - 10, s.brisk.id);
  s.raw.prepare('UPDATE players SET played_at = ? WHERE id = ?').run(nowS() - PLAY_GRACE_S - 5, s.sylvia.id);
  const on = await s.staff('/v1/staff/players', { online: true }, s.mob.session);
  assert.deepEqual(on.body.players.map((p) => [p.handle, p.online]), [['Brisk', true]]);
  const every = await s.staff('/v1/staff/players', {}, s.mob.session);
  assert.deepEqual(every.body.players.map((p) => p.handle), ['Asynian', 'Brisk', 'SirMcMobdon', 'Sylvia'], 'every account with a handle, by handle; guests none');
  assert.equal(every.body.players.find((p) => p.handle === 'Sylvia').online, false);
  // paged by handle
  for (let i = 0; i < PLAYERS_PAGE; i++) await s.registered(`Zed${String(i).padStart(2, '0')}`);
  const p1 = await s.staff('/v1/staff/players', { q: 'zed' }, s.mob.session);
  assert.equal(p1.body.players.length, PLAYERS_PAGE);
  assert.equal(p1.body.next, null, 'a page just full has none after it');
  const p2 = await s.staff('/v1/staff/players', {}, s.mob.session);
  const p3 = await s.staff('/v1/staff/players', { from: p2.body.next }, s.mob.session);
  assert.equal(p2.body.players.length + p3.body.players.length, PLAYERS_PAGE + 4);
  assert.equal(new Set([...p2.body.players, ...p3.body.players].map((p) => p.id)).size, PLAYERS_PAGE + 4, 'every account once across the pages');
  assert.equal(p3.body.next, null);
  // STAFF-BANNED: the ban filter is part of the view, its default not-banned
  assert.deepEqual(s.audits('players-search').map((a) => JSON.parse(a.detail)), [{ q: 'bri', online: false, ban: 'not-banned' }, { q: 'THORN', online: false, ban: 'not-banned' },
    { q: 'horn', online: false, ban: 'not-banned' }, { q: '', online: true, ban: 'not-banned' }, { q: '', online: false, ban: 'not-banned' }, { q: 'zed', online: false, ban: 'not-banned' }],
  'once a view in ten minutes, whatever its pages');
});

test('STAFF-PANEL3-PLAYERS: WHAT GOES FIRST - each tab\'s badge counts what is open, at its level, and the profile opens on the most urgent (mutants: each level; the order)', () => {
  const none = { openCases: 0, banned: false, muted: false, frozen: false, holds: 0, charLaw: 0, pieceLaw: 0, copies: 0, claims: 0, reported: 0, refusedHeld: 0, budget: 0, measure: 0, findings: 0 };
  const b = (f) => profileBadges({ ...none, ...f });
  const quiet = b({});
  assert.equal(quiet.first, 'overview');
  assert.deepEqual(Object.keys(quiet.tabs), PLAYER_TABS);
  for (const t of PLAYER_TABS) assert.deepEqual(quiet.tabs[t], { count: 0, level: 'low', why: [] }, t);
  // each tab's level
  assert.deepEqual(b({ openCases: 1, holds: 2 }).tabs.overview, { count: 3, level: 'high', why: ['1 open case', '2 characters held'] });
  assert.deepEqual(b({ openCases: 2 }).tabs.overview, { count: 2, level: 'high', why: ['2 open cases'] }, 'a chat case and a spawn case, both counted');
  for (const k of ['banned', 'frozen']) assert.equal(b({ [k]: true }).tabs.overview.level, 'high', k);
  assert.deepEqual(b({ muted: true }).tabs.overview, { count: 1, level: 'medium', why: ['muted'] });
  assert.deepEqual(b({ charLaw: 1 }).tabs.skills, { count: 1, level: 'high', why: ['1 law finding on the character'] });
  assert.deepEqual(b({ pieceLaw: 2 }).tabs.equipment, { count: 2, level: 'high', why: ['2 law findings on pieces'] });
  assert.deepEqual(b({ copies: 1, claims: 2 }).tabs.inventories, { count: 3, level: 'high', why: ['1 locked copy', '2 pending claims'] });
  assert.equal(b({ claims: 1 }).tabs.inventories.level, 'medium', 'a claim alone');
  assert.deepEqual(b({ reported: 1 }).tabs.market, { count: 1, level: 'medium', why: ['1 reported listing'] });
  assert.deepEqual(b({ refusedHeld: 2 }).tabs.trades, { count: 2, level: 'medium', why: ['2 trades refused on their hold'] });
  assert.equal(b({ budget: 1 }).tabs.economy.level, 'high', 'a gain the budget held');
  assert.deepEqual(b({ measure: 3 }).tabs.economy, { count: 3, level: 'medium', why: ['3 gains past the budget, measured'] });
  assert.deepEqual(b({ findings: 4 }).tabs.history, { count: 4, level: 'low', why: ['4 findings this week'] });
  // the first tab: the highest level, then the most open, then the usual order
  assert.equal(b({ findings: 9 }).first, 'history', 'anything open beats a quiet overview');
  assert.equal(b({ findings: 9, reported: 1 }).first, 'market', 'medium over low');
  assert.equal(b({ reported: 5, copies: 1 }).first, 'inventories', 'high over medium');
  assert.equal(b({ charLaw: 1, pieceLaw: 2 }).first, 'equipment', 'the most open, at one level');
  assert.equal(b({ charLaw: 2, pieceLaw: 2 }).first, 'skills', 'the usual order, on a tie');
  assert.equal(b({ muted: true, refusedHeld: 1 }).first, 'overview');
  assert.equal(b({ muted: true, refusedHeld: 2 }).first, 'trades');
  assert.equal(b({ holds: 1, charLaw: 1 }).first, 'overview');
});

test('STAFF-PANEL3-PLAYERS: A SAVE READ - every piece where it lies, walked as the judge walks it (mutants: a list named wrong; a home\'s piece)', () => {
  const v = saveViewOf(RECORD);
  assert.deepEqual(v.items.map((r) => [r.where, r.name, r.li, r.i]), [
    ['carried', 'Steel Longsword', 0, 0], ['carried', 'Letter of Credit', 0, 1], ['carried', 'Bread', 0, 2],
    ['wagon', 'Iron Ore', 1, 0], ['bag', 'Copper Ore', 2, 0], ['home', 'Silver Goblet', 3, 0],
  ]);
  assert.deepEqual(v.items.find((r) => r.letter), { ...v.items.find((r) => r.letter), worth: 5000, where: 'carried' });
  assert.equal(v.items[0].slot, 9);
  assert.deepEqual([v.level, v.purse, v.banks, v.stats.strength, v.skills], [12, 500, 250, 61, [10, 20, 30]]);
  // a boat's hold or a companion's pack is `other`
  const boat = saveViewOf({ modData: { 'come-sail-away': { placedBoats: [{ Items: [{ name: 'Rope' }] }] } } });
  assert.deepEqual(boat.items.map((r) => [r.where, r.name]), [['other', 'Rope']]);
  assert.equal(isPieceFinding({ code: 'ceiling', list: 0, at: 1 }), true);
  assert.equal(isPieceFinding({ code: 'uid', at: 'k' }), true);
  assert.equal(isPieceFinding({ code: 'provenance', at: 'p' }), true);
  assert.equal(isPieceFinding({ code: 'skill', at: 2 }), false);
});

test('STAFF-PANEL3-PLAYERS: A PROFILE - the card, the badges from the judge\'s stored findings, the urgent tab first, and each tab; every view written down once (mutants: the law split; the seq guard on a flag; the own-side hold)', async () => {
  const s = await stand();
  const { raw, brisk, sylvia } = s;
  const t = nowS();
  const ch = brisk.character;
  // the judge's law finding standing at this very save: a piece in the pack (list 0, place 0) and a skill
  raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, ?, ?, 1, 'law', ?)")
    .run(brisk.id, ch, s.char.seq, t - 60, JSON.stringify({ count: 2, findings: [{ code: 'ceiling', list: 0, at: 0, t: 120 }, { code: 'skill', at: 2 }] }));
  raw.prepare("UPDATE realm_characters SET law_sig = 'ceiling:120,skill:', held = 'law', held_at = ? WHERE id = ?").run(t - 60, ch);
  raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 1, 'measure', ?)").run(brisk.id, ch, t - 30, JSON.stringify({ gain: 90000, over: 80000, level: 12 }));
  raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 1, 'staff', ?)").run(brisk.id, ch, t - 20, JSON.stringify({ act: 'hold', by: 'x' }));
  // a copy the ledger locked, a pending claim
  raw.prepare("INSERT INTO item_dupes (uid, char_id, at) VALUES ('abcdabcdabcdabcd', ?, ?)").run(ch, t);
  raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, claim_char, claim_at, at) VALUES ('ffffeeeeddddcccc', ?, ?, 1, 'held', '1:1', ?, ?, ?)").run(sylvia.id, sylvia.character, ch, t, t);
  // a reported open listing, gold at the market, Stores, a delivery
  raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, price, fee, at, expires_at, rid, n, currency) VALUES
    ('lst1', ?, ?, 3, 'material', 'iron', 10, 50, 1, ?, ?, 'r1', 'Brisk', 'marks')`).run(brisk.id, ch, t - 100, t + 86400);
  raw.prepare('INSERT INTO market_reports (listing, reporter, at) VALUES (?, ?, ?)').run('lst1', sylvia.id, t);
  raw.prepare('INSERT INTO market_gold (player, char_id, gold) VALUES (?, ?, 777)').run(brisk.id, ch);
  raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'oak', 'own', 5)").run(brisk.id, ch);
  raw.prepare("INSERT INTO market_deliveries (id, player, char_id, item, why, arrives_at, at) VALUES ('dl1', ?, ?, ?, 'bought', ?, ?)").run(brisk.id, ch, JSON.stringify({ name: 'Ruby Ring', templateIndex: 135 }), t, t);
  // trades: one done (Brisk the first side), one refused on Brisk's hold, one on the other side's
  const trade = (sid, cols) => {
    const row = { sid, a_player: brisk.id, a_char: ch, a_lease: 'l', a_seq: 1, a_half: '{}', b_player: sylvia.id, b_char: sylvia.character, state: 'waiting', created_at: t, ...cols };
    raw.prepare(`INSERT INTO realm_trades (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
  };
  trade('s1', { state: 'done', result: JSON.stringify({ a: { seq: 2, items: [], gold: 100 }, b: { seq: 2, items: [realmLetterOfCredit(500)], gold: 0 } }), created_at: t - 3 });
  trade('s2', { a_player: sylvia.id, a_char: sylvia.character, b_player: brisk.id, b_char: ch, state: 'refused', why: 'trade-held:b', created_at: t - 2 });
  trade('s3', { a_player: sylvia.id, a_char: sylvia.character, b_player: brisk.id, b_char: ch, state: 'refused', why: 'trade-held:a', created_at: t - 1 });

  const open = await s.staff('/v1/staff/player', { name: 'brisk' }, s.mob.session);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  const { card, badges, first } = open.body;
  assert.deepEqual([card.handle, card.level, card.online, card.strikes], ['Brisk', s.char.level_seen, false, 0], 'the level the realm trusts, off the row - never the save\'s own word');
  assert.deepEqual(card.holds.map((h) => [h.char, h.held]), [[ch, 'law']]);
  assert.deepEqual([card.flag.kind, card.flag.char], ['measure', ch], 'the newest flag the judge stored - never staff\'s own act');
  assert.deepEqual(Object.fromEntries(PLAYER_TABS.map((k) => [k, badges[k].count])),
    { overview: 1, skills: 1, equipment: 1, inventories: 2, market: 1, trades: 1, economy: 1, history: 2 });
  assert.equal(first, 'inventories', 'two open at the highest level');
  assert.equal(open.body.tab, 'inventories');
  assert.equal(open.body.data.character.id, ch);

  // INVENTORIES: the save's pieces where they lie, the judge's flag on the piece it named, and what the service holds
  const inv = open.body.data;
  assert.equal(inv.seq, s.char.seq);
  const sword = inv.items.find((r) => r.name === 'Steel Longsword');
  assert.deepEqual(sword.flags, ['ceiling'], 'the finding laid on the piece it named, made of this very save');
  assert.deepEqual(inv.items.filter((r) => r.flags).length, 1);
  assert.deepEqual(inv.items.map((r) => r.where).sort(), ['bag', 'carried', 'carried', 'carried', 'deliveries', 'escrow', 'home', 'market-gold', 'stores', 'wagon']);
  assert.deepEqual([inv.purse, inv.banks], [500, 250]);
  const tab = async (name, more = {}) => {
    const r = await s.staff('/v1/staff/player', { target: brisk.id, tab: name, ...more }, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.card, undefined, 'a tab alone');
    return r.body.data;
  };
  assert.deepEqual((await tab('inventories', { where: 'letters' })).items.map((r) => [r.name, r.worth]), [['Letter of Credit', 5000]]);
  assert.deepEqual((await tab('inventories', { where: 'home' })).items.map((r) => r.name), ['Silver Goblet']);
  assert.deepEqual((await tab('inventories', { where: 'market-gold' })).items.map((r) => r.worth), [777]);
  assert.deepEqual((await tab('inventories', { q: 'ORE' })).items.map((r) => r.name), ['Iron Ore', 'Copper Ore']);
  assert.deepEqual((await tab('inventories', { type: 'weapons' })).items.map((r) => r.name), ['Steel Longsword']);
  assert.deepEqual((await tab('inventories', { quality: 5 })).items.map((r) => r.name), ['Steel Longsword']);
  assert.deepEqual((await tab('inventories', { min: 1000 })).items.map((r) => r.name), ['Letter of Credit']);
  assert.deepEqual((await tab('inventories', { where: 'escrow' })).items.map((r) => [r.name, r.count]), [['iron', 10]]);
  assert.deepEqual((await tab('inventories', { where: 'deliveries' })).items.map((r) => r.name), ['Ruby Ring']);
  assert.deepEqual((await tab('inventories', { where: 'stores' })).items.map((r) => [r.name, r.count]), [['oak', 5]]);

  // SKILLS and EQUIPMENT: the law split by what a finding names
  const skills = await tab('skills');
  assert.deepEqual(skills.findings, [{ code: 'skill', at: 2 }]);
  assert.deepEqual([skills.save.level, skills.save.stats.strength, skills.save.skills], [12, 61, [10, 20, 30]]);
  const eq = await tab('equipment');
  assert.deepEqual(eq.worn.map((r) => [r.name, r.slot, r.flags]), [['Steel Longsword', 9, ['ceiling']]]);
  assert.deepEqual(eq.findings, [{ code: 'ceiling', list: 0, at: 0, t: 120 }]);
  // a finding made of an older save names no piece of this one
  raw.prepare('UPDATE realm_findings SET seq = seq - 1 WHERE kind = ?').run('law');
  assert.equal((await tab('equipment')).worn[0].flags, undefined, 'never a guess');

  // MARKET: the reported listing
  const market = await tab('market');
  assert.deepEqual(market.listings.rows.map((l) => [l.id, l.reports]), [['lst1', 1]]);
  assert.deepEqual(Object.keys(market), ['listings', 'sales', 'purchases', 'auctions', 'bids', 'orders', 'fills']);

  // TRADES: both sides, newest first; what was given is what the other side got; whose hold refused it
  const trades = await tab('trades');
  assert.deepEqual(trades.trades.map((x) => [x.sid, x.state, x.why, x.held]), [['s3', 'refused', 'trade-held', 'theirs'], ['s2', 'refused', 'trade-held', 'mine'], ['s1', 'done', null, null]]);
  assert.deepEqual([trades.trades[2].got, trades.trades[2].gave], [{ gold: 100, letters: 0, pieces: 0 }, { gold: 0, letters: 500, pieces: 1 }]);
  assert.deepEqual(trades.trades[2].with, { id: sylvia.character, name: 'Sylvia', player: sylvia.id, handle: 'Sylvia' });
  assert.equal(trades.keptDays, 7);

  // ECONOMY: wealth by the hour, the day range capped, and the gains
  raw.prepare('INSERT OR REPLACE INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, checkpoints) VALUES (?, ?, ?, 12, 10, 0, 600, 2)').run(ch, Math.floor(t / 3600) * 3600, brisk.id);
  raw.prepare('INSERT INTO realm_wealth_hours (char_id, hour, player, level, gain, loss, played_s, checkpoints) VALUES (?, ?, ?, 11, 5, 0, 600, 2)').run(ch, t - 40 * 86400, brisk.id);
  const econ = await tab('economy', { days: 400 });
  assert.equal(econ.days, 7, 'past the cap is the default week');
  assert.equal(econ.hours.length, 1);
  assert.equal((await tab('economy', { days: 30 })).hours.length, 1);
  assert.deepEqual(econ.gains.map((g) => [g.kind, g.detail.gain]), [['measure', 90000]]);

  // HISTORY: the findings (staff's realm acts among them), the strike record, the reports against and by
  const history = await tab('history');
  assert.deepEqual(history.findings.rows.map((f) => f.kind), ['staff', 'measure', 'law']);
  assert.deepEqual(Object.keys(history), ['findings', 'acts', 'against', 'filed']);

  // OVERVIEW
  const ov = await tab('overview');
  assert.deepEqual([ov.account.handle, ov.devices, ov.openCases, ov.characters[0].held], ['Brisk', 1, [], 'law']);

  // every view written down once in ten minutes, whatever its pages and filters
  assert.deepEqual(s.audits('player-read').map((a) => [a.target, JSON.parse(a.detail).tab]),
    [[brisk.id, 'inventories'], [brisk.id, 'skills'], [brisk.id, 'equipment'], [brisk.id, 'market'], [brisk.id, 'trades'], [brisk.id, 'economy'], [brisk.id, 'history'], [brisk.id, 'overview']]);
  assert.deepEqual((await s.staff('/v1/staff/player', { name: 'nobody-here' }, s.mob.session)).status, 404);
});

test('STAFF-PANEL3-PLAYERS FIX: A PROFILE SHOWS EVERY OPEN CASE - a chat case and a spawn case at once, both on Overview by kind, and both in its badge (mutants: the first case only; the order; the badge a boolean)', async () => {
  const s = await stand();
  const t = nowS();
  const kase = (id, kind, source) => s.raw.prepare(`INSERT INTO mod_cases (id, target, source, status, opened_at, updated_at, reports, credible, ai_state, discord_state, kind)
    VALUES (?, ?, ?, 'open', ?, ?, ?, 0, 'off', 'off', ?)`).run(id, s.brisk.id, source, t - 60, t - 60, source === 'report' ? 1 : 0, kind);
  kase('case-spawn-000001', 'spawn', 'review');
  kase('case-chat-0000001', 'chat', 'report');
  const open = await s.staff('/v1/staff/player', { target: s.brisk.id }, s.mob.session);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.deepEqual(open.body.badges.overview, { count: 2, level: 'high', why: ['2 open cases'] });
  const ov = (await s.staff('/v1/staff/player', { target: s.brisk.id, tab: 'overview' }, s.mob.session)).body.data;
  assert.deepEqual(ov.openCases.map((c) => [c.id, c.kind, c.reports, c.claimedBy]), [['case-chat-0000001', 'chat', 1, null], ['case-spawn-000001', 'spawn', 0, null]]);
});

test('STAFF-PANEL3-PLAYERS FIX: THE ECONOMY\'S GAINS PAGE - every gain in the range reached from `from`, answered `next`, never cut (mutants: the page; the cursor)', async () => {
  const s = await stand();
  const t = nowS();
  const ins = s.raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 1, 'measure', ?)");
  const n = PLAYERS_PAGE * 4 + 3;   // past the hundred the tab once cut at
  for (let i = 0; i < n; i++) ins.run(s.brisk.id, s.brisk.character, t - 60 - i, JSON.stringify({ gain: i }));
  const seen = [];
  let from = 0;
  for (let pages = 0; from !== null && pages < 10; pages++) {
    const r = await s.staff('/v1/staff/player', { target: s.brisk.id, tab: 'economy', days: 30, ...(from ? { from } : {}) }, s.mob.session);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.data.gains.length <= PLAYERS_PAGE, 'a page');
    seen.push(...r.body.data.gains.map((g) => g.detail.gain));
    from = r.body.data.next;
  }
  assert.deepEqual(seen, Array.from({ length: n }, (_, i) => i), 'every gain once, newest first');
});

test('STAFF-PANEL3-PLAYERS: THE LEDGER\'S WORD - a copy it locked shown on the piece by its key, and a claim counted both ways: one the character made, one made on its piece (mutants: the locked mark; each half of the claims)', async () => {
  const s = await stand();
  const { raw, sylvia } = s;
  const t = nowS();
  const gem = await s.seated('Gem', { save: { name: 'Gem', level: 3, goldPieces: 0, items: [{ ...realmLetterOfCredit(100), uid: 'abcdabcdabcdabcd' }, { name: 'Bread', group: 'Food', templateIndex: 9999, value: 1 }] } });
  raw.prepare("INSERT INTO item_dupes (uid, char_id, at) VALUES ('abcdabcdabcdabcd', ?, ?)").run(gem.character, t);
  const claim = raw.prepare("INSERT OR REPLACE INTO item_uids (uid, player, char_id, seen_seq, state, fp, claim_char, claim_at, at) VALUES (?, ?, ?, 1, 'held', '1:1', ?, ?, ?)");
  claim.run('ffffeeeeddddcccc', sylvia.id, sylvia.character, gem.character, t, t);   // Gem claims Sylvia's piece
  claim.run('1111222233334444', gem.id, gem.character, sylvia.character, t, t);      // Sylvia claims Gem's
  const open = await s.staff('/v1/staff/player', { target: gem.id }, s.mob.session);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.deepEqual(open.body.badges.inventories, { count: 3, level: 'high', why: ['1 locked copy', '2 pending claims'] });
  const inv = (await s.staff('/v1/staff/player', { target: gem.id, tab: 'inventories' }, s.mob.session)).body.data;
  assert.deepEqual(inv.items.filter((r) => r.locked).map((r) => [r.name, r.key]), [['Letter of Credit', 'abcdabcdabcdabcd']], 'the copy the ledger locked, by its key');
  assert.equal(inv.items.find((r) => r.name === 'Bread').locked, undefined);
});

test('STAFF-PANEL3-PLAYERS: A LIST PAGES -a section asked alone from `from`, answered `next` (mutant: the page)', async () => {
  const s = await stand();
  const t = nowS();
  for (let i = 0; i < PLAYERS_PAGE + 3; i++) {
    s.raw.prepare("INSERT INTO mod_actions (target, kind, until, reason, actor, actor_name, at) VALUES (?, 'unmute', NULL, NULL, 'x', 'x', ?)").run(s.brisk.id, t - i);
  }
  const p1 = await s.staff('/v1/staff/player', { target: s.brisk.id, tab: 'history' }, s.mob.session);
  assert.equal(p1.body.data.acts.rows.length, PLAYERS_PAGE);
  assert.equal(p1.body.data.acts.next, PLAYERS_PAGE);
  const p2 = await s.staff('/v1/staff/player', { target: s.brisk.id, tab: 'history', section: 'acts', from: p1.body.data.acts.next }, s.mob.session);
  assert.deepEqual(Object.keys(p2.body.data), ['acts']);
  assert.equal(p2.body.data.acts.rows.length, 3);
  assert.equal(p2.body.data.acts.next, null);
  assert.equal(p2.body.data.acts.rows[2].at, t - PLAYERS_PAGE - 2, 'oldest last');
  const inv = await s.staff('/v1/staff/player', { target: s.brisk.id, tab: 'inventories', from: 4 }, s.mob.session);
  assert.equal(inv.body.data.total, 6);
  assert.deepEqual(inv.body.data.items.map((r) => r.name), ['Copper Ore', 'Silver Goblet']);
  assert.equal(ITEMS_PAGE > inv.body.data.total, true);
});

test('STAFF-PANEL3-PLAYERS: DEVICES AND SIGN OUT EVERYWHERE - the player\'s own list and act, from the panel, by the account\'s id, and written down (mutants: the act unwritten; a name taken for an act)', async () => {
  const s = await stand();
  const d = await s.staff('/v1/staff/player/devices', { name: 'Brisk' }, s.mob.session);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.devices.length, 1);
  assert.equal(Object.keys(d.body.devices[0]).includes('secret'), false);
  assert.deepEqual((await s.staff('/v1/staff/player/signout', { name: 'Brisk' }, s.mob.session)).body, { error: 'no-player' }, 'an act names the account by its id');
  const out = await s.staff('/v1/staff/player/signout', { target: s.brisk.id }, s.mob.session);
  assert.deepEqual(out.body, { ok: true, target: s.brisk.id, revoked: 1 });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(s.brisk.id).n, 0, 'the game sessions are gone');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(s.sylvia.id).n, 1, 'another account\'s untouched');
  assert.deepEqual(s.audits('devices-read').map((a) => a.target), [s.brisk.id]);
  assert.deepEqual(s.audits('signout-all').map((a) => [a.target, JSON.parse(a.detail).revoked, a.outcome]), [[s.brisk.id, 1, 'ok']]);
});

test('STAFF-PANEL3-PLAYERS FIX: SIGN OUT EVERYWHERE REFUSES A GUEST - its sessions are its only way in, so it is never locked out for good; the refusal written down (mutant: the guest guard)', async () => {
  const s = await stand();
  const g = await s.guest();
  const sessions = () => s.raw.prepare('SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?').get(g.id).n;
  assert.equal(sessions(), 1);
  assert.deepEqual(await s.staff('/v1/staff/player/signout', { target: g.id }, s.mob.session), { status: 409, body: { error: 'no-handle' } });
  assert.equal(sessions(), 1, 'the guest keeps its way in');
  const name = s.raw.prepare('SELECT guest_name FROM players WHERE id = ?').get(g.id).guest_name;
  assert.deepEqual(s.audits('signout-all').map((a) => [a.target, JSON.parse(a.detail), a.outcome]), [[g.id, { name, error: 'no-handle' }, 'failed']]);
});

test('STAFF-PANEL3-PLAYERS: A HANDLE RENAMED - migration 0134\'s way, the old name and the new written down; never to or from a role or title list\'s name, never another\'s, never one the game refuses (mutants: each refusal; a copy left unwritten)', async () => {
  const s = await stand();
  const { raw, brisk } = s;
  const t = nowS();
  raw.prepare("INSERT INTO letters (id, to_id, from_id, from_name, subject, body, sent_at) VALUES ('lt1', ?, ?, 'Brisk', 'hi', 'hello', ?)").run(s.sylvia.id, brisk.id, t);
  raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g1', 'Oak', 'oak', 'OAK', '[]', ?)").run(t);
  raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, 'g1', 0, 'Brisk', ?)").run(brisk.id, brisk.character, t);
  raw.prepare("INSERT INTO mod_actions (target, kind, actor, actor_name, at) VALUES (?, 'mute', ?, 'Brisk', ?)").run(s.sylvia.id, brisk.id, t);
  const rename = (body, token = s.mob.session) => s.staff('/v1/staff/player/rename', body, token);
  const squid = await s.registered('SquidKamer');
  const helper = await s.registered('Helper');
  raw.prepare('UPDATE players SET staff_mod = 1 WHERE id = ?').run(helper.id);
  const refusals = [
    [{ target: brisk.id, to: 'Lattymoy' }, 409, 'rename-listed', 'an Admin\'s handle'],
    [{ target: brisk.id, to: 'squidkamer' }, 409, 'rename-listed', 'a title\'s handle, any case'],
    [{ target: brisk.id, to: 'Watcher9' }, 409, 'rename-listed', 'a handle DISCORD_MODERATORS binds'],
    [{ target: s.raw.prepare("SELECT id FROM players WHERE handle = 'Asynian'").get().id, to: 'Calmer' }, 409, 'rename-listed', 'a Moderator\'s own handle is the config\'s'],
    [{ target: squid.id, to: 'Calmer' }, 409, 'rename-listed', 'a title\'s holder keeps the name the list holds'],
    [{ target: helper.id, to: 'Calmer' }, 409, 'rename-listed', 'a Moderator made on the row (staff_mod), on no list'],
    [{ target: brisk.id, to: 'SYLVIA' }, 409, 'rename-taken', 'another account\'s, any case'],
    [{ target: brisk.id, to: 'two words' }, 400, 'rename-bad', 'a guest\'s shape'],
    [{ target: brisk.id, to: 'me@x.com' }, 400, 'rename-bad', 'an address'],
    [{ target: brisk.id, to: 'Brisk' }, 409, 'rename-same', 'the name it has'],
    [{ name: 'Brisk', to: 'Bristle' }, 404, 'no-player', 'by name'],
  ];
  for (const [body, status, error, why] of refusals) {
    const r = await rename(body);
    assert.deepEqual([r.status, r.body], [status, { error }], why);
  }
  assert.deepEqual((await rename({ target: brisk.id, to: 'Bristle' }, s.asy.session)).body, { error: 'staff-admin' });
  assert.equal(raw.prepare('SELECT handle FROM players WHERE id = ?').get(brisk.id).handle, 'Brisk', 'nothing moved');
  const failed = s.audits('rename');
  assert.equal(failed.length, refusals.length - 1, 'every refusal written down, failed (a name names no account to write)');
  assert.ok(failed.every((a) => a.outcome === 'failed'));
  assert.deepEqual(JSON.parse(failed[0].detail), { from: 'Brisk', to: 'Lattymoy', error: 'rename-listed' });

  const ok = await rename({ target: brisk.id, to: 'Bristle' });
  assert.deepEqual(ok.body, { ok: true, target: brisk.id, from: 'Brisk', to: 'Bristle' });
  assert.deepEqual({ ...raw.prepare('SELECT handle, handle_lc FROM players WHERE id = ?').get(brisk.id) }, { handle: 'Bristle', handle_lc: 'bristle' });
  assert.equal(raw.prepare("SELECT from_name FROM letters WHERE id = 'lt1'").get().from_name, 'Bristle', 'a letter\'s sender');
  assert.equal(raw.prepare('SELECT name FROM guild_members WHERE player = ?').get(brisk.id).name, 'Bristle', 'a guild roster');
  assert.equal(raw.prepare('SELECT actor_name FROM mod_actions WHERE actor = ?').get(brisk.id).actor_name, 'Brisk', 'the moderation record keeps what was done as it was');
  assert.equal(raw.prepare('SELECT name FROM realm_characters WHERE id = ?').get(brisk.character).name, 'Brisk', 'a character\'s name is the character\'s');
  const done = s.audits('rename').at(-1);
  assert.deepEqual([done.target, JSON.parse(done.detail), done.outcome], [brisk.id, { from: 'Brisk', to: 'Bristle' }, 'ok']);
  // the account signs in by its new handle, and the old is free
  assert.equal((await s.call('/v1/auth/login', { handle: 'Bristle', password: PASSWORD })).status, 200);
  assert.equal((await s.call('/v1/auth/login', { handle: 'Brisk', password: PASSWORD })).status, 401);
  // a guest has no handle to rename
  const g = await s.guest();
  assert.deepEqual((await rename({ target: g.id, to: 'Named' })).body, { error: 'no-handle' });
});

test('STAFF-PANEL3-PLAYERS: A CHARACTER RENAMED - its row\'s name, the one the mint signs where the player wears it; never another account\'s handle or a listed name (mutants: each refusal)', async () => {
  const s = await stand();
  const { raw, brisk } = s;
  const rename = (body) => s.staff('/v1/staff/player/rename', body, s.mob.session);
  const refusals = [
    [{ target: brisk.id, char: brisk.character, to: 'Sylvia' }, 'rename-taken', 'another account\'s handle'],
    [{ target: brisk.id, char: brisk.character, to: 'Lattymoy' }, 'rename-listed', 'a listed name'],
    [{ target: brisk.id, char: brisk.character, to: '' }, 'rename-bad', 'nothing'],
    [{ target: brisk.id, char: brisk.character, to: ' Padded' }, 'rename-bad', 'not as the realm keeps it'],
    [{ target: brisk.id, char: brisk.character, to: 'x'.repeat(30) }, 'rename-bad', 'past what the wire carries'],
    [{ target: brisk.id, char: brisk.character, to: 'Brisk' }, 'rename-same', 'the name it has'],
    [{ target: brisk.id, char: s.sylvia.character, to: 'Thorn' }, 'no-character', 'another account\'s character'],
  ];
  for (const [body, error, why] of refusals) assert.deepEqual((await rename(body)).body, { error }, why);
  assert.equal(raw.prepare('SELECT name FROM realm_characters WHERE id = ?').get(brisk.character).name, 'Brisk');
  const ok = await rename({ target: brisk.id, char: brisk.character, to: 'Thorn' });
  assert.deepEqual(ok.body, { ok: true, target: brisk.id, char: brisk.character, from: 'Brisk', to: 'Thorn' });
  assert.equal(raw.prepare('SELECT name FROM realm_characters WHERE id = ?').get(brisk.character).name, 'Thorn');
  assert.equal(raw.prepare('SELECT handle FROM players WHERE id = ?').get(brisk.id).handle, 'Brisk', 'the handle stays');
  assert.deepEqual(JSON.parse(s.audits('rename').at(-1).detail), { char: brisk.character, from: 'Brisk', to: 'Thorn' });
  assert.equal(s.audits('rename').filter((a) => a.outcome === 'failed').length, refusals.length);
});

test('STAFF-PANEL3-PLAYERS: the lists a rename refuses are every role and title list, and a handle\'s copies are migration 0134\'s own, less the columns that hold no handle', () => {
  const listed = listedHandles({ DEVELOPER_HANDLES: 'A1x', HOURS_FIRST_HANDLES: 'Bee, cee', OWNER_KEYS: 'Own1:abc', DISCORD_MODERATORS: '1:Disc1', OTHER: 'Nope', DB: {} });
  assert.deepEqual([...listed].sort(), ['a1x', 'bee', 'cee', 'disc1', 'own1']);
  const sql = readFileSync(new URL('../../server-account/migrations/0134_handle_rename.sql', import.meta.url), 'utf8');
  const copies = [...sql.matchAll(/^UPDATE (\w+) SET (\w+) = 'SanguinePanguine' WHERE lower/gm)].map((m) => [m[1], m[2]]);
  // STAFF-PANEL3-PLAYERS FIX: a character's name (renown_tracks), an account's id (closed_by) and a guild's (fealty, pacts)
  const NO_HANDLE = ['renown_tracks.name', 'guild_writs.closed_by', 'guild_contracts.closed_by', 'guild_fealty.offered_by', 'guild_fealty.broken_by', 'guild_pacts.offered_by'];
  assert.deepEqual([...NAME_COPIES].map((c) => c.slice(0, 2).join('.')).sort(), copies.map((c) => c.join('.')).filter((c) => !NO_HANDLE.includes(c)).sort());
});

test('STAFF-PANEL3-PLAYERS FIX: A HANDLE RENAMED WRITES ITS OWN COPIES ALONE - never another account\'s row that reads like the old handle, a guild\'s hall named like it, or a character\'s renown track (mutants: each scope; the renown track a copy again)', async () => {
  const s = await stand();
  const { raw, brisk, sylvia } = s;
  const t = nowS();
  const insert = (table, row) => raw.prepare(`INSERT OR REPLACE INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`).run(...Object.values(row));
  // a renown track keeps a character's name as the client sends it: Sylvia's named like the handle, and Brisk's own
  insert('renown_tracks', { player: sylvia.id, char_id: sylvia.character, name: 'brisk', xp: 10, created_at: t, updated_at: t });
  insert('renown_tracks', { player: brisk.id, char_id: brisk.character, name: 'Brisk', xp: 10, created_at: t, updated_at: t });
  // Brisk's own home, and the hall he bought for his guild named Brisk (halls.js: a hall's owner_name the guild's name, its
  // player the buyer)
  insert('guilds', { id: 'g-brisk', name: 'Brisk', name_key: 'brisk', tag: 'BRK', ranks: '[]', founded_at: t });
  insert('homes', { map_id: 1, building_key: 1, player: brisk.id, char_id: brisk.character, owner_name: 'Brisk', region: 1, price: 1, bought_at: t });
  insert('homes', { map_id: 1, building_key: 2, player: brisk.id, char_id: 'guild:g-brisk', owner_name: 'Brisk', region: 1, price: 1, bought_at: t, guild_id: 'g-brisk' });
  // a Marks line's `who` is a material or a product on some kinds: Sylvia's reads like the handle; Brisk's own names him
  insert('marks_ledger', { src_kind: 'mint', dst_kind: 'account', dst_id: sylvia.id, kind: 'stock', amount: 1, day: 1, at: t, actor: sylvia.id, who: 'brisk', rid: 'r-sylvia' });
  insert('marks_ledger', { src_kind: 'mint', dst_kind: 'account', dst_id: brisk.id, kind: 'tribute', amount: 1, day: 1, at: t, actor: brisk.id, who: 'Brisk', rid: 'r-brisk' });
  // a letter of Sylvia's under a name like it, and Brisk's own
  insert('letters', { id: 'lt-sylvia', to_id: brisk.id, from_id: sylvia.id, from_name: 'Brisk', subject: 'hi', body: 'hello', sent_at: t });
  insert('letters', { id: 'lt-brisk', to_id: sylvia.id, from_id: brisk.id, from_name: 'Brisk', subject: 'hi', body: 'hello', sent_at: t });
  const ok = await s.staff('/v1/staff/player/rename', { target: brisk.id, to: 'Bristle' }, s.mob.session);
  assert.deepEqual(ok.body, { ok: true, target: brisk.id, from: 'Brisk', to: 'Bristle' });
  const one = (sql, ...a) => raw.prepare(sql).get(...a);
  assert.equal(one('SELECT name FROM renown_tracks WHERE player = ?', sylvia.id).name, 'brisk', 'another account\'s character');
  assert.equal(one('SELECT name FROM renown_tracks WHERE player = ?', brisk.id).name, 'Brisk', 'a character\'s name is the character\'s - the handle is not it');
  assert.equal(one('SELECT owner_name FROM homes WHERE building_key = 1').owner_name, 'Bristle', 'the account\'s own home');
  assert.equal(one('SELECT owner_name FROM homes WHERE building_key = 2').owner_name, 'Brisk', 'a guild\'s hall keeps the guild\'s name, though the account bought it');
  assert.equal(one("SELECT who FROM marks_ledger WHERE rid = 'r-sylvia'").who, 'brisk', 'another account\'s line');
  assert.equal(one("SELECT who FROM marks_ledger WHERE rid = 'r-brisk'").who, 'Bristle', 'the account\'s own line');
  assert.equal(one("SELECT from_name FROM letters WHERE id = 'lt-sylvia'").from_name, 'Brisk', 'another sender\'s letter');
  assert.equal(one("SELECT from_name FROM letters WHERE id = 'lt-brisk'").from_name, 'Bristle', 'the account\'s own letter');
});

test('STAFF-PANEL3-PLAYERS: SERVER LOAD - the trades read and the search by a character\'s name stand on migration 0151\'s indexes, and "online now" on the play beat\'s, never a scan of the table (mutant: the online filter beside the handle\'s range)', async () => {
  const s = await stand();
  const seen = [];
  const prepare = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => { seen.push(sql); return prepare(sql); };
  await s.staff('/v1/staff/player', { target: s.brisk.id, tab: 'trades' }, s.mob.session);
  await s.staff('/v1/staff/players', { q: 'thor' }, s.mob.session);
  await s.staff('/v1/staff/players', { online: true }, s.mob.session);
  await s.staff('/v1/staff/player', { target: s.brisk.id }, s.mob.session);
  s.env.DB.prepare = prepare;
  const plan = (sql) => s.raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
  const trades = seen.filter((q) => /FROM realm_trades/.test(q));
  assert.equal(trades.length, 2, 'the tab and the badge');
  for (const q of trades) {
    const p = plan(q);
    assert.match(p, /realm_trades_b_player/, p);
    assert.doesNotMatch(p, /SCAN t\b|SCAN realm_trades\b/, p);
  }
  const search = plan(seen.find((q) => /realm_characters WHERE name >=/.test(q)));
  assert.match(search, /realm_characters_name/, search);
  assert.doesNotMatch(search, /SCAN realm_characters\b/, search);
  // STAFF-PANEL3-PLAYERS FIX: "online now" reads by the last play beat's index, never a walk of every handle
  const online = plan(seen.find((q) => /played_at >=/.test(q)));
  assert.match(online, /idx_players_played/, online);
  assert.doesNotMatch(online, /SCAN players\b/, online);
});

test('INV-HOVER (mob: "hover for item here with descriptons", "so i can see what enchants and amounts of gold on parchment are"): a save row carries what its hover says - its enchantments as [type, param] (the item maker\'s cost rows left out, ITEM_ENCH_MAX at most), its condition, its value, its message and a quest\'s mark - and only what the piece has (mutants: the maker rows kept, the condition unread)', () => {
  const ench = [{ type: 4, param: 0 }, { type: 0, param: 77, enchantCost: 10 }, { type: 26 }, { type: 'x', param: 1 }];
  const v = saveViewOf({ items: [{ name: 'Blade', templateIndex: 120, enchantments: ench, currentCondition: 40, maxCondition: 100, value: 300, questItem: true, message: 9 }, { name: 'Bread', templateIndex: 9999 }] });
  const [blade, bread] = v.items;
  assert.deepEqual([blade.ench, blade.cond, blade.value, blade.msg, blade.quest], [[[4, 0], [26, -1]], [40, 100], 300, 9, true]);
  for (const k of ['ench', 'cond', 'value', 'msg', 'quest']) assert.equal(k in bread, false, `no ${k} on a piece without one`);
  const many = saveViewOf({ items: [{ name: 'Many', enchantments: Array.from({ length: 20 }, (_, i) => ({ type: 3, param: i })) }] });
  assert.equal(many.items[0].ench.length, 12);
});
