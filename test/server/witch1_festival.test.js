// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL, SERVICE SIDE - the REAL functions over
// the REAL migrations (test/accountDb.mjs, migration 0140): the finds the service's own die decides and a day caps, the
// sales under a request id, the Hearth Offerings set out, filled, taken from once a day and taken in, an orphan's cakes
// sent home, and the festival's wardrobe - the titles, the aura and the profile icon, held only as the rows say.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { ROUTES } from '../../server-account/src/service.js';
import {
  festivalOf, findFestival, buyFestival, festivalTown, setOffering, fillOffering, takeInOffering, takeFromOffering,
  festivalSwitchOf, festivalOpenFor, skyDayAt, FEST_STATUS,
} from '../../server-account/src/festival.js';
import { titlesHeld, aurasHeld, iconsHeld, iconWorn, iconRefusal, HEARTHKEEPER_TITLE, SOULCAKE_ICON } from '../../server-account/src/titles.js';
import {
  FESTIVALS, FIND_ASKS_PER_DAY, FIND_CAKES_PER_DAY, OFFERING_FILL, OFFERING_STOCK_MAX, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN, festivalNight,
} from '../../src/net/festivalLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

const ON = { FESTIVAL_OPEN: 'on' };
/** An instant inside the festival that is not a night the dead walk, one that is, and one after it. */
const DAY_S = FESTIVALS[0].fromMs / 1000 + 3600;
const NIGHT_S = (() => { for (let s = FESTIVALS[0].fromMs / 1000; s < FESTIVALS[0].toMs / 1000; s += 600) if (festivalNight(skyDayAt(s))) return s; return null; })();
const AFTER_S = FESTIVALS[0].toMs / 1000 + 60;
/** The die: a hit (every byte 0 - a roll of 0) or a miss (every byte 255). */
const HIT = (/** @type {Uint8Array} */ b) => b.fill(0);
const MISS = (/** @type {Uint8Array} */ b) => b.fill(255);
const MAP = 1234, HOME = 77, HALL = 78, CHAR = 'char-alice';

async function stand() {
  const S = await standService(ON);
  const alice = await S.registered('Alice');
  const bob = await S.registered('Bobby');
  const db = S.env.DB;
  const row = (id) => db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
  const player = (who) => ({ ...row(who.id), id: who.id, handle: who.handle });
  const ctx = (nowS = DAY_S, rand = HIT) => ({ db, nowS, rand });
  const cakes = (who, n) => db._raw.prepare('UPDATE players SET fest_cakes = ? WHERE id = ?').run(n, who.id);
  const bowls = (who, n) => db._raw.prepare('UPDATE players SET fest_bowls = ? WHERE id = ?').run(n, who.id);
  const home = (who, mapId, key, charId, guild = null) => db._raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at, guild_id)
    VALUES (?, ?, ?, ?, ?, 0, 1000, 1, ?)`).run(mapId, key, who.id, charId, who.handle, guild);
  return { S, alice, bob, db, row, player, ctx, cakes, bowls, home };
}

/** A db whose statement matching `re` runs `hook` once its first() has answered - an interleaving a real D1 allows
 *  (another request's whole transaction between this one's read and its batch). */
function interleaved(db, re, hook) {
  let fired = false;
  return new Proxy(db, {
    get(t, k) {
      if (k !== 'prepare') { const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; }
      return (sql) => {
        const st = t.prepare(sql);
        if (!re.test(sql)) return st;
        const wrap = {
          bind(...a) { st.bind(...a); return wrap; },
          first: async () => { const r = await st.first(); if (!fired) { fired = true; await hook(); } return r; },
          all: (...a) => st.all(...a),
          run: (...a) => st.run(...a),
          _result: () => st._result(),
        };
        return wrap;
      };
    },
  });
}

test('WITCH1 the routes and the switch: every festival route behind a session, FESTIVAL_OPEN off, dev or on', () => {
  for (const r of ['/v1/festival/mine', '/v1/festival/find', '/v1/festival/buy', '/v1/festival/town', '/v1/festival/offering/set',
    '/v1/festival/offering/fill', '/v1/festival/offering/take-in', '/v1/festival/offering/take', '/v1/account/icon']) assert.ok(ROUTES.has(r), r);
  assert.equal(festivalSwitchOf('on'), 'on');
  assert.equal(festivalSwitchOf('dev'), 'dev');
  assert.equal(festivalSwitchOf('yes'), 'off');
  assert.equal(festivalSwitchOf(undefined), 'off');
  assert.equal(festivalOpenFor({ handle: 'x' }, {}), false, 'unset is shut');
  assert.equal(festivalOpenFor({ handle: 'x' }, ON), true);
  assert.deepEqual(FEST_STATUS, { guest: 403, closed: 409, rate: 429, capped: 429 });
  assert.ok(NIGHT_S != null, 'the festival holds a night the dead walk on the sky\'s clock');
  assert.equal(festivalNight(skyDayAt(DAY_S)), false);
});

test('WITCH1 A FIND: the service\'s die decides at the source\'s odds; a guest, a shut switch, the days\' end and a word that is no source are refused', async () => {
  const { alice, player, ctx, row, S } = await stand();
  const g = await S.guest();
  assert.deepEqual(await findFestival(ctx(), { id: g.id, handle: null }, { source: 'foe' }, ON), { error: 'guest' });
  assert.deepEqual(await findFestival(ctx(), player(alice), { source: 'foe' }, {}), { error: 'closed' });
  assert.deepEqual(await findFestival(ctx(AFTER_S), player(alice), { source: 'foe' }, ON), { error: 'closed' });
  assert.deepEqual(await findFestival(ctx(), player(alice), { source: 'gold' }, ON), { error: 'source' });
  // PIN MOVED (CAKE-CAP-SAID, FIELD BUGS 2026-10-21b): each answer says the day's cakes found, this find's with them
  assert.deepEqual(await findFestival(ctx(DAY_S, MISS), player(alice), { source: 'foe' }, ON), { found: 0, cakes: 0, today: 0 });
  assert.deepEqual(await findFestival(ctx(DAY_S, HIT), player(alice), { source: 'foe' }, ON), { found: 1, cakes: 1, today: 1 });
  assert.deepEqual(await findFestival(ctx(DAY_S, HIT), player(alice), { source: 'endgame' }, ON), { found: 4, cakes: 5, today: 5 });
  assert.equal(utcDay(NIGHT_S), utcDay(DAY_S), 'the night falls on the same UTC day');
  assert.deepEqual(await findFestival(ctx(NIGHT_S, HIT), player(alice), { source: 'endgame' }, ON), { found: 8, cakes: 13, today: 13 }, 'twice on a night the dead walk');
  assert.equal(row(alice.id).fest_cakes, 13);
  // the festival's own night, 31 October: a whole UTC day, every player at once - twice, never four times on a sky's night too
  const eve = FESTIVALS[0].eveFromMs / 1000 + 3600;
  assert.equal((await findFestival(ctx(eve, HIT), player(alice), { source: 'endgame' }, ON)).found, 8);
  assert.equal((await findFestival(ctx(FESTIVALS[0].eveToMs / 1000 + 3600 * 2, HIT), player(alice), { source: 'endgame' }, ON)).found, festivalNight(skyDayAt(FESTIVALS[0].eveToMs / 1000 + 7200)) ? 8 : 4, 'the day after: as the sky says');
});

test('WITCH1 THE DAY\'S CAPS: FIND_ASKS_PER_DAY asks and FIND_CAKES_PER_DAY cakes - a forged client finds no more than a whole day\'s honest play', async () => {
  const { alice, player, ctx, db, row } = await stand();
  const day = utcDay(DAY_S);
  db._raw.prepare('INSERT INTO fest_finds (account, day, asks, found) VALUES (?, ?, ?, ?)').run(alice.id, day, FIND_ASKS_PER_DAY - 1, FIND_CAKES_PER_DAY - 3);
  // the last ask of the day: the cakes it gives stop at the day's cap - and say it (PIN MOVED, CAKE-CAP-SAID)
  assert.deepEqual(await findFestival(ctx(), player(alice), { source: 'endgame' }, ON), { found: 3, cakes: 3, today: FIND_CAKES_PER_DAY, capped: true });
  assert.deepEqual(await findFestival(ctx(), player(alice), { source: 'foe' }, ON), { error: 'capped', cakes: 3 });
  assert.equal(row(alice.id).fest_cakes, 3);
  // the next UTC day starts afresh
  assert.equal((await findFestival(ctx(DAY_S + 86400), player(alice), { source: 'foe' }, ON)).found, 1);
});

test('CAKE-CAP-SAID: the day\'s cakes all found with asks to spare - a winning roll answers `capped`, never a miss\'s `{ found: 0 }` (FIELD BUGS 2026-10-21b, "Soul Cake stopped dropping")', async () => {
  const { alice, player, ctx, db, row } = await stand();
  const day = utcDay(DAY_S);
  // the report: 120 found in the first hour of undead, a whole day of asks left
  db._raw.prepare('INSERT INTO fest_finds (account, day, asks, found) VALUES (?, ?, ?, ?)').run(alice.id, day, 231, FIND_CAKES_PER_DAY - 1);
  assert.deepEqual(await findFestival(ctx(DAY_S, MISS), player(alice), { source: 'undead' }, ON), { found: 0, cakes: 0, today: FIND_CAKES_PER_DAY - 1 }, 'a miss short of the cap is a miss');
  assert.deepEqual(await findFestival(ctx(DAY_S, HIT), player(alice), { source: 'undead' }, ON), { found: 1, cakes: 1, today: FIND_CAKES_PER_DAY, capped: true }, 'the cake that ends the day says so');
  assert.deepEqual(await findFestival(ctx(DAY_S, HIT), player(alice), { source: 'undead' }, ON), { found: 0, cakes: 1, today: FIND_CAKES_PER_DAY, capped: true }, 'a winning roll past it');
  assert.deepEqual(await findFestival(ctx(DAY_S, MISS), player(alice), { source: 'undead' }, ON), { found: 0, cakes: 1, today: FIND_CAKES_PER_DAY, capped: true });
  assert.equal(row(alice.id).fest_cakes, 1);
  // the account's festival says the day's count, and a new UTC day's is nought
  assert.equal((await festivalOf(ctx(), player(alice), ON)).today, FIND_CAKES_PER_DAY);
  assert.equal((await festivalOf(ctx(DAY_S + 86400), player(alice), ON)).today, 0);
  assert.deepEqual(await findFestival(ctx(DAY_S + 86400, HIT), player(alice), { source: 'undead' }, ON), { found: 1, cakes: 2, today: 1 }, 'the next UTC day finds again');
});

test('WITCH1 A SALE: the price taken only while the cakes cover it; an account ware laid on the row once; the same request id is one sale', async () => {
  const { alice, player, ctx, cakes, row, db } = await stand();
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'title:witchwarden', rid: 'nope' }, ON), { error: 'rid' });
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'title:nobody', rid: 'aaaaaaaaaaaa' }, ON), { error: 'ware' });
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'title:witchwarden', rid: 'aaaaaaaaaaaa' }, ON), { error: 'cakes', cakes: 0 });
  cakes(alice, 100);
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'title:witchwarden', rid: 'aaaaaaaaaaab' }, ON), { ware: 'title:witchwarden', cakes: 40, bowls: 0, wares: ['title:witchwarden'] });
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'title:witchwarden', rid: 'aaaaaaaaaaab' }, ON), { repeat: true, ware: 'title:witchwarden', cakes: 40, bowls: 0, wares: ['title:witchwarden'] }, 'asked again: answered, nothing moved');
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'title:witchwarden', rid: 'aaaaaaaaaaac' }, ON), { error: 'owned' });
  // a pack's ware is bought as often as the cakes go round
  assert.equal((await buyFestival(ctx(), player(alice), { ware: 'card:warlock', rid: 'aaaaaaaaaaad' }, ON)).cakes, 20);
  assert.equal((await buyFestival(ctx(), player(alice), { ware: 'card:warlock', rid: 'aaaaaaaaaaae' }, ON)).cakes, 0);
  assert.equal(row(alice.id).fest_wares, 'title:witchwarden');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM fest_sales WHERE account = ?').get(alice.id).n, 3);
  // a Hearth Offering is the account's count, as the cakes are - asked twice, one bowl
  cakes(alice, 10);
  assert.deepEqual(await buyFestival(ctx(), player(alice), { ware: 'item:offering', rid: 'aaaaaaaaaab0' }, ON), { ware: 'item:offering', cakes: 5, bowls: 1, wares: ['title:witchwarden'] });
  assert.equal((await buyFestival(ctx(), player(alice), { ware: 'item:offering', rid: 'aaaaaaaaaab0' }, ON)).bowls, 1, 'a repeat counts no second bowl');
  assert.equal(row(alice.id).fest_bowls, 1);
  // the days over: a new sale is closed, a sale asked before it is still answered
  assert.deepEqual(await buyFestival(ctx(AFTER_S), player(alice), { ware: 'card:warlock', rid: 'aaaaaaaaaaaf' }, ON), { error: 'closed' });
  assert.equal((await buyFestival(ctx(AFTER_S), player(alice), { ware: 'card:warlock', rid: 'aaaaaaaaaaae' }, ON)).repeat, true);
});

test('WITCH1 THE HEARTH OFFERING: set out only at a home the character owns (never a hall), filled from the owner\'s cakes, taken from once a day by others, taken in with its cakes', async () => {
  const { alice, bob, player, ctx, cakes, bowls, home, row, db } = await stand();
  db._raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g1', 'The Coven', 'the coven', 'CVN', '[]', 1)").run();
  home(alice, MAP, HOME, CHAR);
  home(alice, MAP, HALL, CHAR, 'g1');
  const at = { mapId: MAP, buildingKey: HOME, character: CHAR };
  assert.deepEqual(await setOffering(ctx(), player(bob), at, ON), { error: 'home' }, 'not his home');
  assert.deepEqual(await setOffering(ctx(), player(alice), { ...at, buildingKey: HALL }, ON), { error: 'home' }, 'a guild hall is its guild\'s');
  assert.deepEqual(await setOffering(ctx(), player(alice), { ...at, character: 'char-other' }, ON), { error: 'home' }, 'another character\'s');
  assert.deepEqual(await setOffering(ctx(), player(alice), at, ON), { error: 'item', bowls: 0 }, 'no bowl bought: the client\'s word is not a bowl');
  bowls(alice, 2);
  assert.deepEqual(await setOffering(ctx(), player(alice), at, ON), { ok: true, stock: 0, bowls: 1 });
  assert.deepEqual(await setOffering(ctx(), player(alice), at, ON), { error: 'set' });
  assert.equal(row(alice.id).fest_bowls, 1, 'a refused set-out spends nothing');
  // the fill: OFFERING_FILL at most, from the owner's count
  assert.deepEqual(await fillOffering(ctx(), player(alice), at, ON), { error: 'cakes', cakes: 0 });
  cakes(alice, 14);
  assert.deepEqual(await fillOffering(ctx(), player(alice), at, ON), { stock: OFFERING_FILL, cakes: 4, moved: OFFERING_FILL });
  assert.deepEqual(await fillOffering(ctx(), player(alice), at, ON), { stock: 14, cakes: 0, moved: 4 });
  // a take: never one's own, once a day each
  const take = { mapId: MAP, buildingKey: HOME };
  assert.deepEqual(await takeFromOffering(ctx(), player(alice), take, ON), { error: 'own' });
  assert.deepEqual(await takeFromOffering(ctx(), player(bob), take, ON), { ok: true, cakes: 1, stock: 13 });
  assert.deepEqual(await takeFromOffering(ctx(), player(bob), take, ON), { error: 'taken' });
  assert.equal((await takeFromOffering(ctx(DAY_S + 86400), player(bob), take, ON)).stock, 12, 'a new day, another cake');
  assert.equal(row(alice.id).fest_given, 2);
  assert.equal(row(bob.id).fest_taken, 2);
  // the town: whose, its cakes, mine, taken today
  assert.deepEqual(await festivalTown(ctx(DAY_S + 86400), player(bob), { mapId: MAP }, ON), { mapId: MAP, open: true, offerings: [{ buildingKey: HOME, stock: 12, owner: 'Alice', mine: false, taken: true }] });
  assert.deepEqual((await festivalTown(ctx(), player(alice), { mapId: MAP }, ON)).offerings[0].mine, true);
  // the days over (or the switch shut): each caller sees its own alone - nobody else's bowl stands to be asked of
  assert.deepEqual(await festivalTown(ctx(AFTER_S), player(bob), { mapId: MAP }, ON), { mapId: MAP, open: false, offerings: [] });
  assert.equal((await festivalTown(ctx(), player(bob), { mapId: MAP }, {})).offerings.length, 0);
  assert.equal((await festivalTown(ctx(AFTER_S), player(alice), { mapId: MAP }, ON)).offerings[0].mine, true);
  // taken in after the festival, the switch shut: the bowl and its cakes home
  assert.deepEqual(await takeInOffering(ctx(AFTER_S), player(alice), at), { ok: true, returned: 12, cakes: 12, bowls: 2 });
  assert.deepEqual(await takeInOffering(ctx(AFTER_S), player(alice), at), { error: 'none' });
  assert.deepEqual(await setOffering(ctx(AFTER_S), player(alice), at, ON), { error: 'closed' });
});

test('WITCH1 a bowl holds OFFERING_STOCK_MAX; an empty bowl gives nothing; one taken in since is `none`', async () => {
  const { alice, bob, player, ctx, cakes, bowls, home, db } = await stand();
  home(alice, MAP, HOME, CHAR);
  const at = { mapId: MAP, buildingKey: HOME, character: CHAR };
  bowls(alice, 1);
  await setOffering(ctx(), player(alice), at, ON);
  assert.deepEqual(await takeFromOffering(ctx(), player(bob), { mapId: MAP, buildingKey: HOME }, ON), { error: 'empty' });
  db._raw.prepare('UPDATE fest_offerings SET stock = ?').run(OFFERING_STOCK_MAX);
  cakes(alice, 5);
  assert.deepEqual(await fillOffering(ctx(), player(alice), at, ON), { error: 'full' });
  await takeInOffering(ctx(), player(alice), at);
  assert.deepEqual(await takeFromOffering(ctx(), player(bob), { mapId: MAP, buildingKey: HOME }, ON), { error: 'none' });
});

test('WITCH1 AN OFFERING OUTLIVES NO HOME: its home sold, it stands nowhere and its bowl and cakes go back to its account on its next read', async () => {
  const { alice, player, ctx, cakes, bowls, home, db, row } = await stand();
  home(alice, MAP, HOME, CHAR);
  const at = { mapId: MAP, buildingKey: HOME, character: CHAR };
  bowls(alice, 1);
  await setOffering(ctx(), player(alice), at, ON);
  const writes = () => db._raw.prepare('SELECT total_changes() AS n').get().n;
  const before = writes();
  await festivalOf(ctx(), player(alice), ON);
  assert.equal(writes(), before, 'no orphan: the read writes nothing');
  cakes(alice, 9);
  await fillOffering(ctx(), player(alice), at, ON);
  assert.equal((await festivalOf(ctx(), player(alice), ON)).offerings.length, 1);
  db._raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(MAP, HOME);
  assert.deepEqual((await festivalTown(ctx(), player(alice), { mapId: MAP }, ON)).offerings, [], 'standing nowhere');
  const mine = await festivalOf(ctx(), player(alice), ON);
  assert.equal(mine.cakes, 9, 'its cakes came home');
  assert.equal(mine.bowls, 1, 'and its bowl');
  assert.equal(row(alice.id).fest_bowls, 1);
  assert.deepEqual(mine.offerings, []);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM fest_offerings').get().n, 0);
});

test('WITCH1 A HOME CHANGES HANDS: the old owner\'s bowl goes back to them whole, credited from its own row - a read of it between the set-out\'s look and its batch pays nothing twice (AUDIT WITCH1 A1)', async () => {
  const { alice, bob, player, ctx, cakes, bowls, home, db, row } = await stand();
  home(alice, MAP, HOME, CHAR);
  const at = { mapId: MAP, buildingKey: HOME, character: CHAR };
  bowls(alice, 1);
  await setOffering(ctx(), player(alice), at, ON);
  cakes(alice, 60);
  for (let i = 0; i < 6; i++) await fillOffering(ctx(), player(alice), at, ON);
  assert.equal(row(alice.id).fest_cakes, 0);
  db._raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(MAP, HOME);
  home(bob, MAP, HOME, 'char-bobby');
  bowls(bob, 1);
  // Alice's own read lands between Bob's look at the old bowl and his batch: it sends her bowl home first
  const racy = interleaved(db, /SELECT player, char_id FROM fest_offerings/, () => festivalOf(ctx(), player(alice), ON));
  assert.deepEqual(await setOffering({ db: racy, nowS: DAY_S }, player(bob), { mapId: MAP, buildingKey: HOME, character: 'char-bobby' }, ON), { ok: true, stock: 0, bowls: 0 });
  assert.equal(row(alice.id).fest_cakes, 60, 'her sixty, once');
  assert.equal(row(alice.id).fest_bowls, 1, 'her bowl, once');
  // and with no read between: the set-out sends it home itself
  db._raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(MAP, HOME);
  home(alice, MAP, HOME, CHAR);
  await takeInOffering(ctx(), player(bob), { mapId: MAP, buildingKey: HOME, character: 'char-bobby' });
  assert.equal(row(bob.id).fest_bowls, 1, 'his bowl back');
  await setOffering(ctx(), player(alice), at, ON);
  cakes(alice, 7);
  await fillOffering(ctx(), player(alice), at, ON);
  db._raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(MAP, HOME);
  home(bob, MAP, HOME, 'char-bobby');
  assert.equal((await setOffering(ctx(), player(bob), { mapId: MAP, buildingKey: HOME, character: 'char-bobby' }, ON)).ok, true);
  assert.equal(row(alice.id).fest_cakes, 7, 'the seven in the bowl, home');
  assert.equal(row(alice.id).fest_bowls, 1);
  assert.equal(db._raw.prepare('SELECT player FROM fest_offerings').get().player, bob.id);
});

test('WITCH1 A TAKE-IN IS ONE TRANSACTION: the bowl goes only where its cakes and its bowl were counted home (AUDIT WITCH1 A2)', async () => {
  const { alice, player, ctx, cakes, bowls, home, db, row } = await stand();
  home(alice, MAP, HOME, CHAR);
  const at = { mapId: MAP, buildingKey: HOME, character: CHAR };
  bowls(alice, 1);
  await setOffering(ctx(), player(alice), at, ON);
  cakes(alice, 10);
  await fillOffering(ctx(), player(alice), at, ON);
  // a batch that fails whole leaves the bowl standing with its cakes - nothing half done
  const failing = new Proxy(db, { get: (t, k) => (k === 'batch' ? async () => { throw new Error('D1_ERROR: D1 DB is overloaded. Requests queued for too long.'); } : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) });
  await assert.rejects(takeInOffering({ db: failing, nowS: DAY_S }, player(alice), at));
  assert.equal(db._raw.prepare('SELECT stock FROM fest_offerings').get().stock, 10);
  assert.deepEqual(await takeInOffering(ctx(), player(alice), at), { ok: true, returned: 10, cakes: 10, bowls: 1 });
  assert.deepEqual([row(alice.id).fest_cakes, row(alice.id).fest_bowls], [10, 1]);
});

test('WITCH1 A TAKE CREDITS THE OWNER IT READ: the home changed hands between the take\'s look and its batch, nothing moves (AUDIT WITCH1 A11)', async () => {
  const { alice, bob, player, ctx, cakes, bowls, home, db, row } = await stand();
  home(alice, MAP, HOME, CHAR);
  const at = { mapId: MAP, buildingKey: HOME, character: CHAR };
  bowls(alice, 1);
  await setOffering(ctx(), player(alice), at, ON);
  cakes(alice, 5);
  await fillOffering(ctx(), player(alice), at, ON);
  const racy = interleaved(db, /SELECT o\.player, o\.stock FROM fest_offerings/, () => {
    db._raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(MAP, HOME);
    home(bob, MAP, HOME, 'char-bobby');
  });
  assert.deepEqual(await takeFromOffering({ db: racy, nowS: DAY_S }, player(bob), { mapId: MAP, buildingKey: HOME }, ON), { error: 'empty' });
  assert.deepEqual([row(alice.id).fest_given, row(bob.id).fest_taken, row(bob.id).fest_cakes], [0, 0, 0], 'no cake to him from his own home, no given to her');
});

test('WITCH1 THE WARDROBE: Witchwarden and Witchfire as bought, Hearthkeeper at HEARTHKEEPER_GIVEN given, the icons as bought and the Soul Cake at SOULCAKE_TAKEN taken', async () => {
  const { alice, player, db } = await stand();
  const p = () => player(alice);
  assert.ok(!titlesHeld(p(), ON).includes('witchwarden'));
  assert.deepEqual(iconsHeld(p()), []);
  db._raw.prepare("UPDATE players SET fest_wares = 'title:witchwarden aura:witchfire icon:twinmoons' WHERE id = ?").run(alice.id);
  assert.ok(titlesHeld(p(), ON).includes('witchwarden'));
  assert.ok(aurasHeld(p(), ON).includes('witchfire'));
  assert.deepEqual(iconsHeld(p()), ['twinmoons']);
  db._raw.prepare('UPDATE players SET fest_given = ?, fest_taken = ? WHERE id = ?').run(HEARTHKEEPER_GIVEN - 1, SOULCAKE_TAKEN - 1, alice.id);
  assert.ok(!titlesHeld(p(), ON).includes(HEARTHKEEPER_TITLE));
  assert.ok(!iconsHeld(p()).includes(SOULCAKE_ICON));
  db._raw.prepare('UPDATE players SET fest_given = ?, fest_taken = ? WHERE id = ?').run(HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN, alice.id);
  assert.ok(titlesHeld(p(), ON).includes(HEARTHKEEPER_TITLE));
  assert.deepEqual(iconsHeld(p()), ['twinmoons', 'soulcake']);
  assert.equal(iconRefusal('tallowskull', p()), 'not-held');
  assert.equal(iconRefusal('nothing', p()), 'no-icon');
  assert.equal(iconRefusal(null, p()), null, 'the face is always allowed');
  assert.equal(iconWorn({ ...p(), icon: 'twinmoons' }), 'twinmoons');
  assert.equal(iconWorn({ ...p(), icon: 'tallowskull' }), undefined, 'an icon no longer held is not signed');
});

test('WITCH1 THROUGH THE WORKER: the festival\'s answers and their statuses, and the icon worn rides the token', async (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['Date'], now: DAY_S * 1000 });
  const { S, alice, db } = await stand();
  const mine = await S.call('/v1/festival/mine', {}, alice.secret);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.open, true);
  assert.equal((await S.call('/v1/festival/buy', { ware: 'icon:twinmoons', rid: 'bbbbbbbbbbbb' }, alice.secret)).status, 400, 'cakes short');
  db._raw.prepare('UPDATE players SET fest_cakes = 40 WHERE id = ?').run(alice.id);
  assert.equal((await S.call('/v1/festival/buy', { ware: 'icon:twinmoons', rid: 'bbbbbbbbbbbc' }, alice.secret)).status, 200);
  const worn = await S.call('/v1/account/icon', { icon: 'twinmoons' }, alice.secret);
  assert.equal(worn.status, 200);
  assert.equal(worn.body.icon, 'twinmoons');
  assert.ok(worn.body.icons.includes('twinmoons'));
  assert.equal((await S.call('/v1/account/icon', { icon: 'tallowskull' }, alice.secret)).status, 403, 'not held');
  // AUDIT WITCH1 B1: the icon worn is SIGNED - the token's own claims say `pi`, so every room's Inspect card can show it
  const tok = await S.call('/v1/auth/token', { secret: alice.secret });
  assert.equal(tok.status, 200);
  assert.equal(tok.body.icon, 'twinmoons');
  assert.equal(JSON.parse(Buffer.from(tok.body.token.split('.')[1], 'base64url').toString('utf8')).pi, 'twinmoons', 'the claim itself');
  await S.call('/v1/account/icon', { icon: null }, alice.secret);
  const face = await S.call('/v1/auth/token', { secret: alice.secret });
  assert.equal('pi' in JSON.parse(Buffer.from(face.body.token.split('.')[1], 'base64url').toString('utf8')), false, 'the face worn: no claim, the bytes as before');
  const g = await S.guest();
  assert.equal((await S.call('/v1/festival/find', { source: 'foe' }, g.secret)).status, 403);
});
