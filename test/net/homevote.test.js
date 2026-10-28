// HOME-VOTE (2026-10-10, the owner: "I want to implement a house voting system within vicinity of player houses. If the
// house votes run negative, the exterior decorations/interior decorations should not be shown to other players"). A
// registered account a week old votes a home up or down - one vote a home, changed or taken back at will, never on its
// own home or a hall of its own guild (server-account/src/homeVotes.js, migration 0108; the law net/homeVoteLaw.js) -
// standing at the house: its door's plaque lists the votes, unlit where they are all it lists, and an Info press asks
// where no plaque is drawn (scenes/worldModes.js). The town's homes carry each one's score, kept on its row, and the
// reader's own vote (homes.js homesInTown), and a home whose votes run negative stands for everyone but its insiders as
// Daggerfall built it - no placed piece but its hired trader and nothing taken out inside (worldModes.js loadHomeDecor;
// the service hands out no more, decor.js decorOf), no yard (scenes/homeYards.js), the town's own paint (scenes/world.js
// lookOfHome; homesInTown says no look). AUDIT HOME-VOTE (A1-A6, B1-B7, D1-D14) pinned here too. Each pin failed on the
// build before it. tools/mutants/homevote.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  HOME_VOTE_UP, HOME_VOTE_DOWN, HOME_SHUN_AT, HOME_VOTES_MAX, HOME_VOTES_WINDOW_S, HOME_VOTE_AGE_S, homeVoteOk, homeShunned, homeDecorShown, homeScoreText, homeVotesLine,
  homeVotedLine, HOME_SHUNNED_LINE, homeMyVoteOf, homeVoteRefusalLine, HOME_VOTE_GONE_LINE, homeShunnedInsiderLine, decorStaysShunned,
} from '../../src/net/homeVoteLaw.js';
import { WITNESS } from '../../src/net/nodeLaw.js';
import {
  createOnlineHomes, homeVotable, homeVoteRows, homeVoteOfVerb, homeVoteChoices, homeVoteLines, isHomeVoteVerb, HOME_VERB, HOME_VOTE_VERB, homeVotePressable,
} from '../../src/systems/online/onlineHomes.js';
import { REFUSALS, accountHomes, SESSION_KEY } from '../../src/net/accountClient.js';
import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { yardWorld, yardPiece, live, settle } from '../decorFakes.mjs';
import { voteHome } from '../../server-account/src/homeVotes.js';
import { planRestore } from '../../tools/realmRestore.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const visitor = (over = {}) => ({ owner: 'Olga', own: false, mine: false, member: false, insider: false, hall: null, score: 0, myVote: 0, ...over });
const WEEK_AGO = T0 - HOME_VOTE_AGE_S - 1;
const HALL = 'The Hand';   // the hall's guild - who its door names, and so whose house a vote on it names (AUDIT HOME-VOTE II A4)

/** A stood service with Olga's home 300 in town 7, and accounts registered a week before T0 (AUDIT A1: the age bar). */
async function town(t) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const aged = (who) => { raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(WEEK_AGO, who.id); return who; };
  const owner = aged(await svc.registered('Olga'));
  const home = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  assert.equal(home.status, 200, JSON.stringify(home.body));
  const vote = (who, v, bk = 300, owner = 'Olga') => svc.call('/v1/homes/vote', { mapId: 7, buildingKey: bk, vote: v, owner }, who.secret);   // AUDIT HOME-VOTE II A4: naming the owner its door read
  const read = async (who, bk = 300) => (await svc.call('/v1/homes/town', { mapId: 7 }, who.secret)).body.homes.find((h) => h.buildingKey === bk);
  const hall = (memberId, charId = 'c-member') => {
    raw.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES (?, ?, ?, ?, ?, ?)').run('g1', 'The Hand', 'the hand', 'HND', '[]', T0);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(memberId, charId, 'g1', 3, 'Cid', T0);
    raw.prepare('UPDATE homes SET guild_id = ? WHERE map_id = 7 AND building_key = 300').run('g1');
  };
  /** HOME-SHUN: the town votes the home down to HOME_SHUN_AT - five more accounts a week old, each one vote down. */
  const shun = async (bk = 300, owner = 'Olga') => {
    for (let i = 0; i < -HOME_SHUN_AT; i++) assert.equal((await vote(aged(await svc.registered(`Down${bk}x${i}`)), -1, bk, owner)).status, 200);
  };
  return { svc, raw, owner, ownerChar: home.character, aged, vote, read, hall, shun };
}

test('HOME-VOTE the law: a vote is -1, +1 or 0 (taken back); a home is shunned at five votes down net, never above it (HOME-SHUN: it was one); its decor stands for its insiders (its owner\'s account, a hall\'s guild - the account\'s, AUDIT A5) whatever its score and for everyone else unless shunned; a shunned home\'s hired trader stands (AUDIT B2); the bars are 30 votes an hour and an account a week old (AUDIT A1); the words (mutants: zero shunned, the owner hidden, a member hidden, the kin hidden, a visitor shown, the trader hidden)', () => {
  for (const v of [HOME_VOTE_UP, HOME_VOTE_DOWN, 0]) assert.equal(homeVoteOk(v), true, String(v));
  for (const v of [2, -2, 0.5, '1', null, undefined]) assert.equal(homeVoteOk(v), false, String(v));
  assert.equal(HOME_SHUN_AT, -5, 'HOME-SHUN');
  for (const n of [-1, -2, -3, -4]) assert.equal(homeShunned(n), false, `HOME-SHUN: ${n} still shown, so still seen to be voted up`);
  assert.equal(homeShunned(-5), true);
  assert.equal(homeShunned(-6), true);
  assert.equal(homeShunned(0), false, 'none, or as many up as down: shown');
  assert.equal(homeShunned(3), false);
  assert.equal(homeShunned('x'), false, 'no number: none');
  assert.equal(homeDecorShown(null), true, 'not an online home');
  assert.equal(homeDecorShown(visitor()), true);
  assert.equal(homeDecorShown(visitor({ score: -1 })), true, 'HOME-SHUN: one vote down hides nothing');
  assert.equal(homeDecorShown(visitor({ score: -5 })), false, 'shunned, to a visitor');
  assert.equal(homeDecorShown(visitor({ score: HOME_SHUN_AT, mine: true, own: true })), true, 'the owner always');
  assert.equal(homeDecorShown(visitor({ score: HOME_SHUN_AT, mine: true })), true, 'the owner\'s other characters too');
  assert.equal(homeDecorShown(visitor({ score: HOME_SHUN_AT, hall: { name: 'The Hand' }, member: true })), true, 'a hall\'s member');
  assert.equal(homeDecorShown(visitor({ score: HOME_SHUN_AT, hall: { name: 'The Hand' }, insider: true })), true, 'AUDIT A5: another character of a member\'s account');
  assert.equal(decorStaysShunned({ station: 'vendor' }), true, 'AUDIT B2: a shop');
  assert.equal(decorStaysShunned({ station: 'alchemy' }), false);
  assert.equal(decorStaysShunned({}), false);
  assert.equal(HOME_VOTES_MAX, 30, 'AUDIT A1');
  assert.equal(HOME_VOTE_AGE_S, WITNESS.ageS, 'AUDIT A1: a witness\'s bar, one home');
  assert.equal(HOME_VOTE_AGE_S, 7 * 86_400);
  assert.equal(homeMyVoteOf(-1), -1);
  assert.equal(homeMyVoteOf(5), 0);
  assert.equal(homeScoreText(3), '+3');
  assert.equal(homeScoreText(-2), '-2');
  assert.equal(homeVotesLine(-2, HOME_VOTE_DOWN), 'Votes: -2 (you voted down)');
  assert.match(homeVotedLine(0, 1), /took your vote back/);
  // AUDIT D6: the words themselves
  assert.equal(REFUSALS['vote-own'], 'You cannot vote on your own home, or on the hall of your own guild.');
  assert.equal(REFUSALS['vote-rate'], 'You have voted on too many homes this hour. Try again later.');
  assert.equal(REFUSALS['vote-young'], 'An account must have had its username and password for a week to vote on homes.');   // PIN MOVED (AUDIT HOME-VOTE II A7): a week REGISTERED
  assert.match(REFUSALS['bad-vote'], /could not read that vote/);
  assert.equal(homeVoteRefusalLine('homes-need-account'), 'Voting on homes needs a username and password. Add them to this account to vote.', 'a guest is not told about owning a home');
  assert.equal(homeVoteRefusalLine('no-home'), HOME_VOTE_GONE_LINE, 'nor that it is not theirs any more');
  assert.equal(HOME_VOTE_GONE_LINE, 'Nobody owns that home any more.');
  assert.equal(homeVoteRefusalLine('vote-own'), null, 'the rest are the service\'s own words');
  assert.equal(homeShunnedInsiderLine(-2, true), 'Votes: -2. Your hall\'s decorations are hidden from other players.');
});

test('HOME-VOTE the door: a visitor reads two vote rows saying what each press does - the vote standing taken back by a row of its own (AUDIT B3), each row\'s verb the vote it sends; the Info box\'s choices are those rows; the score and one\'s own vote are said once there is either; the owner and a hall\'s guild read no rows, the owner told its score, and when shunned that its decor is hidden (mutants: the owner votes, a member votes, the kin votes, the take-back re-sent, a vote at zero unsaid, the owner told a zero)', () => {
  assert.equal(homeVotable(visitor()), true);
  assert.equal(homeVotable(visitor({ own: true, mine: true })), false);
  assert.equal(homeVotable(visitor({ mine: true })), false, 'the owner\'s other character');
  assert.equal(homeVotable(visitor({ hall: { name: 'The Hand' }, member: true })), false);
  assert.equal(homeVotable(visitor({ hall: { name: 'The Hand' }, insider: true })), false, 'AUDIT A5: the account\'s other character');
  assert.equal(homeVotable(visitor({ hall: { name: 'The Hand' } })), true, 'a stranger\'s hall');
  assert.equal(homeVotable(null), false);
  assert.deepEqual(homeVoteRows(visitor()).map((r) => [r.id, r.label]), [[HOME_VOTE_VERB.up, 'Vote up'], [HOME_VOTE_VERB.down, 'Vote down']]);
  assert.deepEqual(homeVoteRows(visitor({ myVote: 1 })).map((r) => [r.id, r.label]), [[HOME_VOTE_VERB.clear, 'Take back your vote up'], [HOME_VOTE_VERB.down, 'Vote down']]);
  assert.deepEqual(homeVoteRows(visitor({ myVote: -1 })).map((r) => r.id), [HOME_VOTE_VERB.up, HOME_VOTE_VERB.clear]);
  assert.deepEqual(homeVoteRows(visitor({ own: true, mine: true })), []);
  assert.deepEqual([HOME_VOTE_VERB.up, HOME_VOTE_VERB.down, HOME_VOTE_VERB.clear, HOME_VERB.enter].map(homeVoteOfVerb), [1, -1, 0, null], 'AUDIT B3: the row says the vote');
  assert.equal(isHomeVoteVerb(HOME_VOTE_VERB.clear), true);
  assert.equal(isHomeVoteVerb(HOME_VERB.enter), false);
  assert.deepEqual(homeVoteChoices(visitor({ myVote: 1 })), [
    { code: 'KeyU', label: 'U - Take back your vote up', vote: 0 }, { code: 'KeyD', label: 'D - Vote down', vote: -1 }]);
  assert.deepEqual(homeVoteChoices(visitor()).map((c) => c.vote), [1, -1], 'AUDIT D2: U is up');
  assert.deepEqual(homeVoteLines(visitor()), [], 'no votes, no line');
  assert.deepEqual(homeVoteLines(visitor({ score: -5, myVote: -1 })), ['Votes: -5 (you voted down)', HOME_SHUNNED_LINE]);
  assert.deepEqual(homeVoteLines(visitor({ score: -4, myVote: -1 })), ['Votes: -4 (you voted down)'], 'HOME-SHUN: not yet shunned');
  assert.deepEqual(homeVoteLines(visitor({ score: 0, myVote: 1 })), ['Votes: 0 (you voted up)'], 'AUDIT D5: one\'s vote said where the score nets to zero');
  assert.deepEqual(homeVoteLines(visitor({ score: 2 })), ['Votes: +2']);
  assert.deepEqual(homeVoteLines(visitor({ own: true, mine: true, score: 2 })), ['Votes: +2'], 'the owner reads its score');
  assert.deepEqual(homeVoteLines(visitor({ own: true, mine: true })), [], 'AUDIT D5: and nothing where nobody voted');
  assert.equal(homeVoteLines(visitor({ own: true, mine: true, score: -5 }))[0], homeShunnedInsiderLine(-5, false));
  assert.equal(homeVoteLines(visitor({ hall: { name: 'H' }, member: true, score: -5 }))[0], homeShunnedInsiderLine(-5, true));
});

test('HOME-VOTE the service: an account a week old votes and the score is its votes summed, kept on the home\'s row - one a home (a second changes it), taken back by 0; never on its own home, never a guest\'s, never a home nobody holds (404 - AUDIT D7), never a word that is no vote; the town\'s homes carry the score and the reader\'s own vote (mutants: two votes an account, the owner votes, the score unsaid, the vote unsaid, the score unkept)', async (t) => {
  const { svc, raw, owner, aged, vote, read } = await town(t);
  const bob = aged(await svc.registered('Bob'));
  const cid = aged(await svc.registered('Cid'));
  const g = await svc.guest();
  assert.deepEqual((await vote(bob, -1)).body, { ok: true, mapId: 7, buildingKey: 300, vote: -1, score: -1 });
  assert.equal((await vote(bob, -1)).body.score, -1, 'the same vote again: still one');
  assert.equal((await vote(cid, 1)).body.score, 0);
  assert.equal((await vote(bob, 1)).body.score, 2, 'a change of mind');
  assert.equal((await vote(bob, 0)).body.score, 1, 'taken back');
  assert.equal((await vote(bob, 0)).status, 200, 'taking back none: answered');
  assert.deepEqual([(await vote(owner, -1)).status, (await vote(owner, -1)).body.error], [403, 'vote-own']);
  assert.equal((await vote(g, -1)).body.error, 'homes-need-account');
  const gone = await vote(bob, -1, 301);
  assert.deepEqual([gone.status, gone.body.error], [404, 'no-home']);
  for (const bad of [2, '1', null]) assert.equal((await vote(bob, bad)).body.error, 'bad-vote', String(bad));
  await vote(bob, -1);
  await vote(cid, -1);
  assert.equal(raw.prepare('SELECT score FROM homes WHERE map_id = 7 AND building_key = 300').get().score, -2, 'AUDIT A2: kept on its row');
  const seen = await read(bob);
  assert.equal(seen.score, -2);
  assert.equal(seen.vote, -1, 'the reader\'s own');
  const mine = await read(owner);
  assert.equal(mine.score, -2, 'the owner reads its score');
  assert.equal('vote' in mine, false);
  await vote(bob, 0); await vote(cid, 0);
  const none = await read(bob);
  assert.equal('score' in none || 'vote' in none, false, 'nothing said where there is nothing');
  assert.equal(raw.prepare('SELECT score FROM homes WHERE map_id = 7 AND building_key = 300').get().score, 0, 'the row kept in step');
});

test('HOME-VOTE AUDIT the service\'s bars: an account registered less than a week ago votes nothing (`vote-young`, 403) but may take back what it has (A1); a vote cast on a hall before its voter joined the guild is taken back after (A4); a hall\'s insider is the account - any character of it in the guild, said as `insider` on the hall\'s row - its votes refused (A5); 30 votes an hour then `vote-rate`; the votes go with the home (mutants: no age bar, the withdrawal guarded, no count, the votes kept)', async (t) => {
  const { svc, raw, vote, read, hall } = await town(t);
  const young = await svc.registered('Yan');
  const y = await vote(young, -1);
  assert.deepEqual([y.status, y.body.error], [403, 'vote-young']);
  assert.equal((await vote(young, 0)).status, 200, 'taking back is never barred');
  const c = await svc.registered('Cid');
  raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(WEEK_AGO, c.id);
  assert.equal((await vote(c, -1)).body.score, -1, 'an outsider\'s vote');
  hall(c.id);
  assert.equal((await vote(c, 1, 300, HALL)).body.error, 'vote-own', 'a member votes nothing on its hall');
  const back = await vote(c, 0);
  assert.deepEqual([back.status, back.body.score], [200, 0], 'A4: but takes back what it cast before');
  const row = await read(c);
  assert.equal(row.insider, true, 'A5: the account has a character in the guild');
  const bob = await svc.registered('Bob');
  raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(WEEK_AGO, bob.id);
  assert.equal('insider' in (await read(bob)), false);
  for (let i = 0; i < HOME_VOTES_MAX; i++) assert.equal((await vote(bob, i % 2 ? 1 : -1, 300, HALL)).status, 200, `vote ${i + 1}`);
  const over = await vote(bob, 1, 300, HALL);
  assert.deepEqual([over.status, over.body.error], [429, 'vote-rate']);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_votes').get().n, 1);
  raw.prepare('DELETE FROM homes WHERE map_id = 7 AND building_key = 300').run();
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_votes').get().n, 0, 'gone with the home');
});

test('HOME-VOTE AUDIT A3: the service hands a shunned home\'s room to anyone but its insiders as Daggerfall furnished it - no placed piece but its hired trader, nothing taken out - and says no look of it; its owner reads all of it (mutants: the room handed out, the trader withheld, the look said)', async (t) => {
  const { svc, raw, owner, ownerChar, aged, vote, read, shun } = await town(t);
  const place = (id, over = {}) => raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, paid, yard)
    VALUES (7, 300, ?, 41000, NULL, NULL, ?, ?, 0, 0)`).run(id, JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...over }), T0);
  place('chair');
  place('trader', { station: 'vendor' });
  place('statue', { station: 'vendor' });   // AUDIT HOME-VOTE II A1: a trader's licence on a piece with nothing on sale at it
  // the trader's goods on sale at it (HOME-VENDOR: its open listing)
  raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, price, fee, at, expires_at, rid, n, vendor_map, vendor_id)
    VALUES ('l1', ?, ?, 17, 'material', 'iron', 1, 10, 1, ?, ?, 'r1', 'n1', 7, 'trader')`).run(owner.id, ownerChar, T0, T0 + 86_400);
  raw.prepare('INSERT INTO home_hidden (map_id, building_key, keys) VALUES (7, 300, ?)').run(JSON.stringify(['m0:41000']));
  raw.prepare('UPDATE homes SET look = ? WHERE map_id = 7 AND building_key = 300').run(JSON.stringify({ walls: { set: 'manor', climate: 'swamp' } }));
  const bob = aged(await svc.registered('Bob'));
  const room = async (who) => (await svc.call('/v1/homes/decor', { mapId: 7, buildingKey: 300 }, who.secret)).body;
  assert.equal((await room(bob)).pieces.length, 3, 'shown: all of it');
  assert.deepEqual((await read(bob)).look, { walls: { set: 'manor', climate: 'swamp' } }, 'and its paint');
  await vote(bob, -1);
  assert.equal((await room(bob)).pieces.length, 3, 'HOME-SHUN: one vote down hides nothing');
  await shun();
  const bare = await room(bob);
  assert.deepEqual(bare.pieces.map((p) => p.id), ['trader'], 'shunned: its trader alone - AUDIT HOME-VOTE II A1: the one with goods on sale, never a licence bought for a statue');
  assert.deepEqual(bare.hidden, [], 'nothing taken out');
  const kept = await room(owner);
  assert.deepEqual(kept.pieces.map((p) => p.id).sort(), ['chair', 'statue', 'trader']);
  assert.deepEqual(kept.hidden, ['m0:41000']);
  assert.equal('look' in (await read(bob)), false, 'no paint said to a visitor');
  assert.deepEqual((await read(owner)).look, { walls: { set: 'manor', climate: 'swamp' } }, 'the owner\'s own read as ever');
});

test('HOME-VOTE the registry over the real door (AUDIT D3, D8): the town read through accountHomes carries each home\'s score, the account\'s own vote and a hall\'s `insider`; a vote sent through accountHomes is shown at once, read back, and never told as a home of mine changed (LEGACY7\'s listener); a refusal - the account\'s own, or a home gone - asks the town again, and a vote on a home the town never heard of is read back (mutants: the route misnamed, the score unread, the vote unshown, the listener told, `no-home` never re-asked, the unknown home unread)', async (t) => {
  const { svc, raw, aged, read, hall } = await town(t);
  const bob = aged(await svc.registered('Bob'));
  const told = [];
  let asks = 0;
  const door = accountHomes({ fetch: (u, i) => { if (String(u).endsWith('/v1/homes/town')) asks++; return svc.fetch(u, i); }, storage: sessionStorageOf(SESSION_KEY, bob) });
  const homes = createOnlineHomes({ api: door, character: () => 'r-bob', onWrote: (...a) => told.push(a) });
  await homes.ensure(7);
  assert.equal(homes.homeAt(7, 300).score, 0);
  const v0 = homes.version();
  const r = await homes.vote(7, 300, -1);
  assert.deepEqual(r, { ok: true, vote: -1, score: -1 }, 'through the real route');
  assert.equal(homes.homeAt(7, 300).score, -1, 'shown at once');
  assert.equal(homes.homeAt(7, 300).myVote, -1);
  assert.equal(homeDecorShown(homes.homeAt(7, 300)), true, 'HOME-SHUN: one vote down hides nothing, to this reader');
  assert.ok(homes.version() > v0, 'the doors read again');
  assert.deepEqual(told, [], 'no home of mine');
  await settle(); await settle();
  assert.equal((await read(bob)).vote, -1);
  await homes.ensure(7, { force: true });
  assert.deepEqual([homes.homeAt(7, 300).score, homes.homeAt(7, 300).myVote], [-1, -1], 'read back off the town\'s own answer');
  // a refusal re-asks: a home gone, and the account's own
  let before = asks;
  assert.deepEqual(await homes.vote(7, 301, -1), { ok: false, error: 'no-home' });
  await settle(); await settle();
  assert.ok(asks > before, '`no-home`: the town asked again');
  // HOME-SHUN: the service's own `no-home` - a house this page read, sold under it - re-asks too (on 301 the page held no
  // owner and asked before it sent; this one reaches the service, which refuses it)
  raw.prepare("UPDATE homes SET owner_name = 'Zed' WHERE map_id = 7 AND building_key = 300").run();
  before = asks;
  assert.deepEqual(await homes.vote(7, 300, 1), { ok: false, error: 'no-home' });
  await settle(); await settle();
  assert.ok(asks > before, 'the service\'s `no-home`: the town asked again');
  raw.prepare("UPDATE homes SET owner_name = 'Olga' WHERE map_id = 7 AND building_key = 300").run();
  hall(bob.id, 'c-other');   // AUDIT D8: the account's other character is in the hall's guild
  await homes.ensure(7, { force: true });
  await settle();
  assert.equal(homes.homeAt(7, 300).insider, true, 'the hall says so');
  assert.equal(homeVotable(homes.homeAt(7, 300)), false, 'so no rows are offered...');
  assert.equal(homeDecorShown(homes.homeAt(7, 300)), true, '...and its decor stands');
  before = asks;
  assert.deepEqual(await homes.vote(7, 300, 1), { ok: false, error: 'vote-own' });
  await settle(); await settle();
  assert.ok(asks > before, '`vote-own`: asked again');
  // a vote on a home this page never read: the town is asked
  const fresh = createOnlineHomes({ api: door, character: () => 'r-bob' });
  before = asks;
  await fresh.vote(7, 300, 0);
  await settle(); await settle();
  assert.ok(asks > before, 'an unknown home: the town read');
  void raw;
});

test('HOME-VOTE the yard: a home voted down to HOME_SHUN_AT stands no yard for a visitor - its pieces taken down - and stands them again once its votes climb; its owner\'s yard stands whatever its score (mutants: the yard unasked)', async () => {
  const home = { score: HOME_SHUN_AT };
  const w = yardWorld({ pieces: [yardPiece({ flat: [209, 0], scale: 1 })], home });
  await w.run();
  assert.equal(live(w.made).length, 0, 'shunned: nothing stands');
  home.score = 2;
  await w.run(3);
  w.clock.t += 120_000;
  await w.run(3);
  assert.equal(live(w.made).length, 1, 'voted up again: it stands');
  const mine = yardWorld({ pieces: [yardPiece({ flat: [209, 0], scale: 1 })], own: true, home: { score: -3, mine: true } });
  await mine.run();
  assert.equal(live(mine.made).filter((b) => b.a === 209).length, 1, 'its owner sees it');
});

test('DECOR-BATCH (2026-10-16, the owner\'s screenshots of every account deploy since #952: "/v1/homes/decor did not answer a home\'s pieces (000)", seven asks of 15 s while the overloaded database answered homes/town\'s one batch in 11): A HOME\'S ROOM IS ONE REQUEST - its pieces, whether the caller is shown them and what its owner took out, one batch where they were three trips in a row - and a shunned home\'s traders one more, never a trip each; every answer as it was (mutants: a read its own trip again; the shop a trip a trader)', async (t) => {
  const { svc, raw, owner, ownerChar, aged, shun } = await town(t);
  const place = (id, over = {}) => raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, paid, yard)
    VALUES (7, 300, ?, 41000, NULL, NULL, ?, ?, 0, 0)`).run(id, JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...over }), T0);
  place('chair');
  place('trader', { station: 'vendor' });
  place('statue', { station: 'vendor' });
  raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, price, fee, at, expires_at, rid, n, vendor_map, vendor_id)
    VALUES ('l1', ?, ?, 17, 'material', 'iron', 1, 10, 1, ?, ?, 'r1', 'n1', 7, 'trader')`).run(owner.id, ownerChar, T0, T0 + 86_400);
  raw.prepare('INSERT INTO home_hidden (map_id, building_key, keys) VALUES (7, 300, ?)').run(JSON.stringify(['m0:41000']));
  // every round trip the service asks of its database, where the Worker asks it (PRIMARY-TRIPS' count): a statement's
  // own first/all/run one trip, a batch one trip
  const db = svc.env.DB;
  const trips = [];
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const st = prepare(sql);
    const one = (fn) => async (...a) => { trips.push({ sql }); return fn(...a); };
    return Object.assign(st, { first: one(st.first), all: one(st.all), run: one(st.run), _sql: sql });
  };
  const batch = db.batch.bind(db);
  db.batch = async (list) => { trips.push({ batch: list.map((st) => st._sql) }); return batch(list); };
  const ROOM = /home_decor|home_hidden|FROM homes h|market_listings/;
  const room = async (who) => {
    trips.length = 0;
    const r = await svc.call('/v1/homes/decor', { mapId: 7, buildingKey: 300 }, who.secret);
    assert.equal(r.status, 200);
    return { r: r.body, shape: trips.filter((x) => (x.batch ? x.batch.some((q) => ROOM.test(q)) : ROOM.test(x.sql))).map((x) => (x.batch ? `batch ${x.batch.length}` : 'trip')) };
  };
  const bob = aged(await svc.registered('Bob'));
  let { r, shape } = await room(bob);
  assert.deepEqual(shape, ['batch 4'], 'shown: the room in one request - its pieces, whether it is shown, what was taken out, its revision');
  assert.equal(r.pieces.length, 3);
  assert.deepEqual(r.hidden, ['m0:41000']);
  await shun();
  ({ r, shape } = await room(bob));
  assert.deepEqual(shape, ['batch 4', 'batch 2'], 'shunned: and its two traders\' stock in one more - never a trip each');
  assert.deepEqual(r.pieces.map((p) => p.id), ['trader'], 'the shop as it was: the trader with goods on sale');
  assert.deepEqual(r.hidden, []);
  ({ r, shape } = await room(owner));
  assert.deepEqual(shape, ['batch 4'], 'its owner: one request');
  assert.deepEqual(r.pieces.map((p) => p.id).sort(), ['chair', 'statue', 'trader']);
  assert.deepEqual(r.hidden, ['m0:41000']);
});

test('HOME-VOTE the hosts by source: the interior stands a shunned home bare but its trader, nothing taken out; the world paints a shunned home in its town\'s own look and keeps it in the merge; the door lists the votes unlit where they are all it lists and still says "Locked"; a vote row presses the vote it says, before the lock, and a home gone is said so (AUDIT B3, B5); the Info box asks only where no plaque is drawn (B1), says the lock, and carries the door\'s rows; presses keep their order (mutants: the room stood, the look painted, the rows lit, the vote inverted, the press after the lock, the box over a drawn plaque, the order dropped, the way in dropped)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /const shown = homeDecorShown\(interiorHome\);\n\s*const pieces = r\.data\.pieces\.map\(decorPieceOf\)\.filter\(\(p\) => p && \(shown \|\| decorStaysShunned\(p\)\)\);/);
  assert.match(m, /if \(!shown\) \{ interiorCtx\?\.base\?\.setHidden\(\[\]\); return; \}   \/\/ HOME-VOTE: the room as Daggerfall furnished it\n\s*interiorCtx\?\.base\?\.setHidden\(Array\.isArray\(r\.data\.hidden\)/);
  assert.match(m, /const rows = \[\.\.\.\(homeVisitorRows\(home, homeDoorFor\(bd, home\)\) \?\? \[\]\), \.\.\.\(worldPlaqueOn\(\) \? homeVoteRows\(home\) : \[\]\)\];/);
  assert.match(m, /_doorText = homeVoteDoorText\(_doorText, bd, home, verbs\);[^\n]*\n\s*if \(verbs\) _doorText = \{ \.\.\._doorText, actions: verbs \};/);
  assert.match(m, /const voteOnly = isHomeVoteVerb\(verbs\?\.\[0\]\?\.id\);/, 'AUDIT D1: unlit when the first row is a vote\'s');
  assert.match(m, /const lines = \[\.\.\.\(voteOnly && homeDoorFor\(bd, home\) === 'locked' \? \['Locked'\] : \[\]\), \.\.\.homeVoteLines\(home\)\];/);
  assert.match(m, /return voteOnly \? \{ \.\.\.said, actionsUnlit: true \} : said;/);
  assert.match(m, /if \(isHomeVoteVerb\(verb\)\) \{ if \(homeVotePressable\(home, homeVoteOfVerb\(verb\)\)\) pressHomeVote\(bd, homeVoteOfVerb\(verb\)\); else if \(!home\) townTalk\?\.say\?\.\(HOME_VOTE_GONE_LINE\); return true; \}/);   // PIN MOVED (AUDIT HOME-VOTE II A3): a take-back where I may vote no more
  const press = m.indexOf('if (isHomeVoteVerb(verb)) {');
  const lock = m.indexOf("if (door === 'locked') { townTalk?.say?.(homeLockedLine(home)); return true; }");
  assert.ok(press > 0 && lock > press, 'a vote is pressed before the lock answers');
  assert.equal(m.slice(m.lastIndexOf('\n', press - 200), press).includes('if (!isBash && !homeAsked && getInteractionMode() !== \'steal\') {'), true, 'AUDIT B5: whether or not a home stands');
  assert.match(m, /if \(verb == null && getInteractionMode\(\) === 'info' && homeVoteRows\(home\)\.length && !listed\) \{ openHomeVoteMenu\(bd, home, door, door === 'enter' \? homeOnward\(hit, entries\) : null\); return true; \}/);   // PIN MOVED (AUDIT HOME-VOTE II A3, B4): wherever the door has a vote row, the plaque as the press found it
  assert.match(m, /lines: \[homeDoorTitle\(home\), \.\.\.\(door === 'locked' \? \[homeLockedLine\(home\)\] : \[\]\),/);
  assert.match(m, /\.\.\.homeVoteChoices\(home\)\.map\(\(c\) => \(\{ code: c\.code, label: c\.label, action: \(\) => pressHomeVote\(bd, c\.vote\) \}\)\),/);
  assert.match(m, /_homeVoting = _homeVoting\.then\(async \(\) => \{\n\s*if \(!homeVotePressable\(homeOf\(bd\), vote\)\) return;[^\n]*\n\s*const r = await host\.onlineHomes\.vote\(homeTownOf\(bd\), bd\.buildingKey, vote\);/);   // PIN MOVED (AUDIT HOME-VOTE II A3)
  assert.match(m, /townTalk\?\.say\?\.\(r\.ok \? homeVotedLine\(r\.vote, r\.score\) : homeVoteRefusalLine\(r\.error\) \?\? accountRefusalText\(r\.error\)\);/, 'AUDIT D6: the vote\'s own words first');
  assert.match(src('src/systems/quickLoot.js'), /export const plaqueListing = \(\) => !!\(_actionIds && _actionIds\.length && _sel\);/);
  const w = src('src/scenes/world.js');
  assert.match(w, /: homeDecorShown\(row\) \? row\?\.look \?\? null : null\);/);
  assert.match(w, /\(\(row\?\.look && homeDecorShown\(row\)\) \|\| row\?\.mine \|\| row\?\.keeper\)\) merged = true;/);
});

test('HOME-VOTE AUDIT II the service: a vote taken back past the hour\'s bar is never refused (A2); a vote names the owner its door read and lands only on that owner\'s house - one sold and bought again takes none, a cast vote naming nobody is no vote (A4); a write that found nothing to vote on is answered as it found it, never re-asked into an `ok` (A5); a knight\'s deed house is none to vote on (B5); a restore puts a home back without its score (A6) (mutants: the bar on a take-back, the owner unread, the follow-up re-asking, the deed votable, the score restored)', async (t) => {
  const { svc, raw, aged, vote, hall } = await town(t);
  const bob = aged(await svc.registered('Bob'));
  // A2: 30 presses spent, the last a slip down: taken back all the same
  for (let i = 0; i < HOME_VOTES_MAX; i++) await vote(bob, i % 2 ? 1 : -1);
  assert.equal((await vote(bob, 1)).body.error, 'vote-rate');
  const back = await vote(bob, 0);
  assert.deepEqual([back.status, back.body.score], [200, 0], 'A2: the take-back, past the bar');
  // A4: the house sold and bought again by Pat while Bob's door still read Olga's
  const cid = aged(await svc.registered('Cid'));
  assert.deepEqual([(await vote(cid, -1, 300, null)).status, (await vote(cid, -1, 300, null)).body.error], [400, 'bad-vote'], 'a cast vote names its owner');
  raw.prepare('DELETE FROM homes WHERE map_id = 7 AND building_key = 300').run();
  const pat = aged(await svc.registered('Pat'));
  assert.equal((await svc.seatHome(pat, { mapId: 7, buildingKey: 300, region: 17, price: 5000 })).status, 200);
  const stale = await vote(cid, -1);
  assert.deepEqual([stale.status, stale.body.error], [404, 'no-home'], 'A4: Olga\'s house is no more');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_votes').get().n, 0, 'and nothing written on Pat\'s');
  assert.equal((await vote(cid, -1, 300, 'Pat')).body.score, -1, 'naming Pat, it lands');
  // A5: Cid leaves the hall's guild between the write (refused: an insider) and any second look - answered as refused
  hall(cid.id);
  const player = raw.prepare('SELECT * FROM players WHERE id = ?').get(cid.id);
  const db = svc.env.DB;
  const racing = { prepare: (sql) => {
    const st = db.prepare(sql);
    if (!sql.startsWith('INSERT INTO home_votes')) return st;
    return { bind: (...a) => { const b = st.bind(...a); return { run: async () => { const r = await b.run(); raw.prepare('DELETE FROM guild_members WHERE player = ?').run(cid.id); return r; } }; } };
  } };
  assert.deepEqual(await voteHome({ db: racing, nowS: T0 }, player, { mapId: 7, buildingKey: 300, vote: 1, owner: HALL }), { error: 'vote-own' }, 'A5: never `ok` for a vote nobody kept');
  // B5: a knight's deed house - its room, yard and paint its save's - takes no vote
  raw.prepare('UPDATE homes SET guild_id = NULL, deed = 1 WHERE map_id = 7 AND building_key = 300').run();
  const dan = aged(await svc.registered('Dan'));
  const deed = await vote(dan, -1, 300, 'Pat');
  assert.deepEqual([deed.status, deed.body.error], [404, 'no-home'], 'B5');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_votes WHERE player = ?').get(dan.id).n, 0);
  // A6: a restore's home row carries no score - its votes are no table of the tool's
  const MIG = readdirSync(new URL('../../server-account/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const dbOf = () => { const d = new DatabaseSync(':memory:'); d.exec('PRAGMA foreign_keys = ON'); for (const f of MIG) d.exec(src(`server-account/migrations/${f}`)); return d; };
  const then = dbOf(), now = dbOf();
  for (const d of [then, now]) for (const id of ['gary', 'v1', 'v2']) d.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'A Guest', 1, 1)").run(id);
  then.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (4242, 1, 'gary', 'gary-o', 'Gary', 17, 'private', 40000, 1)").run();
  for (const v of ['v1', 'v2']) then.prepare('INSERT INTO home_votes (map_id, building_key, player, vote, voted_at) VALUES (4242, 1, ?, -1, 1)').run(v);
  now.prepare("INSERT INTO realm_census (player, char_id, spent) VALUES ('gary', 'gary-o', 1)").run();
  const plan = planRestore({ then, now });
  const sql = Array.isArray(plan.sql) ? plan.sql : String(plan.sql).split('\n');
  const put = sql.find((l) => l.startsWith('INSERT OR IGNORE INTO homes'));
  assert.ok(put && !/\bscore\b/.test(put), put);
  now.exec(sql.join('\n'));
  assert.equal(now.prepare('SELECT score FROM homes WHERE building_key = 1').get().score, 0, 'A6: back, and shown');
});

test('HOME-VOTE AUDIT II the door: a hall\'s member with a vote cast before they joined is offered its take-back alone, pressed as the take-back and never as a vote (A3) - D the take-back of a vote down; a knight\'s deed house offers no vote (B5); where no plaque is drawn the rent box carries the votes (B1) and the owner\'s box the score (B2); whether the plaque listed rows is read as the press lands (B4) (mutants: the take-back unoffered, a member\'s vote cast, the deed votable, the rent box voteless, the owner untold, the plaque read late)', () => {
  const member = visitor({ hall: { name: HALL }, member: true, score: -1, myVote: -1 });
  assert.deepEqual(homeVoteRows(member).map((r) => [r.id, r.label]), [[HOME_VOTE_VERB.clear, 'Take back your vote down']], 'A3');
  assert.deepEqual(homeVoteChoices(member), [{ code: 'KeyD', label: 'D - Take back your vote down', vote: 0 }]);
  assert.deepEqual(homeVoteChoices(visitor({ hall: { name: HALL }, insider: true, myVote: 1 })).map((c) => c.code), ['KeyU']);
  assert.equal(homeVotePressable(member, 0), true);
  assert.equal(homeVotePressable(member, -1), false, 'a member casts nothing on its hall');
  assert.equal(homeVotePressable(visitor({ hall: { name: HALL }, member: true }), 0), false, 'nothing standing, nothing to take back');
  assert.equal(homeVotePressable(visitor(), 1), true);
  assert.deepEqual(homeVoteRows(visitor({ hall: { name: HALL }, member: true })), [], 'no vote standing: no rows');
  assert.equal(homeVotable(visitor({ deed: true })), false, 'B5');
  assert.deepEqual(homeVoteRows(visitor({ deed: true })), []);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /lines: \[\.\.\.rentPickLines\(got\.owner \|\| home\.owner\), \.\.\.homeVoteLines\(home\)\],[^\n]*\n\s*options: \[\n\s*\.\.\.homeVoteChoices\(home\)\.map\(\(c\) => \(\{ code: c\.code, label: c\.label, action: \(\) => pressHomeVote\(bd, c\.vote\) \}\)\),/, 'B1');
  assert.match(m, /lines: \[\.\.\.homeOwnerLines\(home\), \.\.\.homeVoteLines\(home\)\],/, 'B2');
  // PIN MOVED (LOCKPICK, bible/06-Systems/Lockpicking.md): the door's options carry `picked` beside the verb - a front door the
  // pick window opened walks in through the same door, picked
  assert.match(m, /async function activateStaticDoor\(hit, entries, isBash = false, \{ homeAsked = false, verb = null, listed = plaqueListing\(\) && worldPlaqueOn\(\), picked = false \} = \{\}\) \{/, 'B4: read with the verb');
  assert.equal(m.includes('&& !plaqueListing()) { openHomeVoteMenu'), false, 'B4: never after the wait');
});

test('HOME-VOTE AUDIT II the pins lane D found missing: the score triggers touch their own home alone (D4); a hall says its score to everyone and its paint to its guild, shunned (D5); the bar is an hour (D6); the words themselves (D8); a week to the second, a guest refused by the vote itself, `bad-vote` a 400, a take-back of nothing answered, the voter\'s votes gone with the voter (D9) (mutants: a trigger town-wide, the hall\'s score unsaid, the hall\'s paint from its guild, the window a minute, the words swapped or blank, the age bar off by one, the guest unguarded, the status moved, the voter\'s cascade dropped)', async (t) => {
  const { svc, raw, aged, vote, read, hall, shun } = await town(t);
  // D4: a second home in the town keeps its own score through a vote, a change and a take-back
  const zed = aged(await svc.registered('Zed'));
  assert.equal((await svc.seatHome(zed, { mapId: 7, buildingKey: 301, region: 17, price: 5000 })).status, 200);
  const bob = aged(await svc.registered('Bob'));
  const scores = () => raw.prepare('SELECT building_key AS k, score FROM homes WHERE map_id = 7 ORDER BY building_key').all().map((r) => [r.k, r.score]);
  await vote(bob, -1);
  assert.deepEqual(scores(), [[300, -1], [301, 0]], 'cast');
  await vote(bob, 1);
  assert.deepEqual(scores(), [[300, 1], [301, 0]], 'turned');
  await vote(bob, 0);
  assert.deepEqual(scores(), [[300, 0], [301, 0]], 'gone');
  // D5: a shunned hall - its score said to a stranger, its paint to its own guild alone
  const cid = aged(await svc.registered('Cid'));
  hall(cid.id);
  await shun(300, HALL);
  raw.prepare('UPDATE homes SET look = ? WHERE map_id = 7 AND building_key = 300').run(JSON.stringify({ walls: { set: 'manor', climate: 'swamp' } }));
  const seen = await read(bob);
  assert.equal(seen.score, HOME_SHUN_AT, 'D5: a hall says its score');
  assert.equal('look' in seen, false, 'and no paint to a stranger');
  assert.deepEqual((await read(cid)).look, { walls: { set: 'manor', climate: 'swamp' } }, 'D5: its paint to its guild');
  // D6: an hour
  assert.equal(HOME_VOTES_WINDOW_S, 3600);
  // D9: a week to the second
  const ann = await svc.registered('Ann');
  raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(T0 - HOME_VOTE_AGE_S + 1, ann.id);
  assert.equal((await vote(ann, 1, 301, 'Zed')).body.error, 'vote-young', 'a second short');
  raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(T0 - HOME_VOTE_AGE_S, ann.id);
  assert.equal((await vote(ann, 1, 301, 'Zed')).status, 200, 'a week to the second');
  // D9: the vote's own guard on a guest, whatever wall stands before it
  assert.deepEqual(await voteHome({ db: svc.env.DB, nowS: T0 }, { id: 'g1', handle: null, registered_at: 0 }, { mapId: 7, buildingKey: 301, vote: 1, owner: 'Zed' }), { error: 'homes-need-account' });
  const bad = await vote(bob, 2);
  assert.deepEqual([bad.status, bad.body.error], [400, 'bad-vote'], 'D9: a 400');
  const none = await vote(bob, 0, 302);
  assert.deepEqual([none.status, none.body.ok], [200, true], 'D9: a take-back of nothing answered');
  // D9: the voter's votes go with the voter (the migration's player cascade)
  assert.equal(raw.prepare('SELECT score FROM homes WHERE building_key = 301').get().score, 1);
  raw.prepare('DELETE FROM players WHERE id = ?').run(ann.id);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_votes WHERE player = ?').get(ann.id).n, 0);
  assert.equal(raw.prepare('SELECT score FROM homes WHERE building_key = 301').get().score, 0, 'and the score with them');
});

test('HOME-VOTE AUDIT II D8, D9: the words a player reads, as they read them; the Info box says a score of none; a vote thrown in the queue drops no later press (mutants: the words swapped or blank, the box\'s zero unsaid, the queue uncaught)', () => {
  assert.equal(HOME_SHUNNED_LINE, 'Its decorations are hidden: the town has voted it down.');
  assert.equal(homeShunnedInsiderLine(-1, false), 'Votes: -1. Your home\'s decorations are hidden from other players.');
  assert.equal(homeVotedLine(1, 2), 'You voted this home up. Its votes: +2.');
  assert.equal(homeVotedLine(-1, -2), 'You voted this home down. Its votes: -2.');
  assert.equal(homeVotedLine(0, 0), 'You took your vote back. Its votes: 0.');
  assert.deepEqual(homeVoteRows(visitor({ myVote: -1 })).map((r) => r.label), ['Vote up', 'Take back your vote down']);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /\.\.\.\(homeVoteLines\(home\)\.length \? homeVoteLines\(home\) : \[homeVotesLine\(home\.score\)\]\)\],/, 'D9: the box says Votes: 0');
  assert.match(m, /townTalk\?\.say\?\.\(r\.ok \? homeVotedLine\(r\.vote, r\.score\) : homeVoteRefusalLine\(r\.error\) \?\? accountRefusalText\(r\.error\)\);\n\s*\}\)\.catch\(\(e\) => console\.error\(e\)\);/, 'D9: ASYNC NEVER DROPS');
});
