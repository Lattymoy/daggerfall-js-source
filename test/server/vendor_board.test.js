// VENDOR-BOARD (2026-10-19, the account database overloaded again: the region's traders the read most asked again in the
// 18:05 overload; bible/11-Multiplayer/Scale-Arc.md VENDOR-BOARD; migration 0137) - A REGION'S TRADERS READ AS ONE ROW:
// the board every caller reads alike is kept in `market_vendor_boards` at a version the database moves on every trader
// listing, trader, trader's house and patron sale written, until its first listing runs out; the caller's own door (its
// own house, its guild's, a room it rents) is read off its own rows.
//
// The proof is an oracle: the board's two statements as they stood before this slice (their text kept here, its caller's
// door asked in SQL of every row), against the service's answer, through listings put up, bought, cancelled and run
// out, traders made and moved off their station, houses changing hands, doors, guilds and regions, houses released,
// guilds joined and left, rooms rented and patrons' sales - every caller of every region, each read kept or not; and
// (AUDIT LEAN-READS B5) every answer off a kept row held whole to the answer read afresh at the same second.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { d1, T0 } from '../accountDb.mjs';
import { marketVendors, vendorBoard, vendorBoardOf, vendorSpan, VENDOR_BOARD_READ, VENDOR_BOARD_KEEP, VENDOR_BOARD_SHAPE, VENDOR_BOARD_KEPT_S, VENDOR_NEWEST_SQL, VENDOR_HOUSES_SQL,
  VENDOR_SPAN_SQL, PATRON_TOLD_S, PATRON_TOLD_SQL } from '../../server-account/src/market.js';
import { shapeOf, keptFits, KEPT_BOARD_MAX_BYTES } from '../../server-account/src/keptBoard.js';
import { VENDOR_STATION, VENDOR_BOARD_SHOWN } from '../../src/net/vendorLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
const ENV = { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' };
const REGIONS = [17, 23];
const PEOPLE = ['p-ana', 'p-bo', 'p-cy', 'p-di'];
const CHARS = (p) => [`${p}-c1`, `${p}-c2`];
const place = (station) => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...(station ? { station } : {}) });
const ITEM = JSON.stringify({ t: 1, n: 'Iron Longsword' });

/** THE ORACLE: the board as it was read before VENDOR-BOARD - its two statements with the caller's door asked of every
 *  row (market.js marketVendors at the merge base), and the region's patron sales of the day. */
async function before(db, player, region, me, nowS) {
  const columns = `l.*, d.map_id AS v_map, d.id AS v_id, h.building_key AS v_key, h.owner_name AS v_owner, h.player AS v_player,
      h.entry AS v_entry, (h.player = ?3 AND h.char_id = ?4) AS v_mine,
      (h.entry = 'guild' AND EXISTS (SELECT 1 FROM guild_members a JOIN guild_members b ON b.guild_id = a.guild_id
        WHERE a.player = h.player AND a.char_id = h.char_id AND b.player = ?3 AND b.char_id = ?4)) AS v_guildmate,
      (SELECT MAX(r.until) FROM home_rooms r WHERE r.map_id = h.map_id AND r.building_key = h.building_key AND r.tenant = ?3 AND r.tenant_char = ?4 AND r.until > ?1) AS v_tenancy`;
  const HOME = `h.entry = 'public' AND h.player = l.seller AND d.yard = 0 AND h.guild_id IS NULL
  AND json_extract(d.place, '$.station') = '${VENDOR_STATION}'`;
  const { results: newest = [] } = await db.prepare(`SELECT ${columns}
    FROM market_listings l JOIN home_decor d ON d.map_id = l.vendor_map AND d.id = l.vendor_id
    JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key
    WHERE l.state = 'open' AND l.expires_at > ?1 AND l.vendor_id IS NOT NULL AND l.region = ?2 AND h.region = ?2 AND h.player = l.seller AND d.yard = 0
      AND h.guild_id IS NULL AND json_extract(d.place, '$.station') = '${VENDOR_STATION}'
    ORDER BY l.at DESC LIMIT ${VENDOR_BOARD_SHOWN}`).bind(nowS, region, player.id, me).all();
  const { results: houses = [] } = await db.prepare(`SELECT * FROM (SELECT ${columns},
      ROW_NUMBER() OVER (PARTITION BY d.map_id, d.building_key, d.id ORDER BY l.at DESC, l.id) AS v_rank
    FROM market_listings l JOIN home_decor d ON d.map_id = l.vendor_map AND d.id = l.vendor_id
  JOIN homes h ON h.map_id = d.map_id AND h.building_key = d.building_key WHERE l.state = 'open' AND l.vendor_id IS NOT NULL AND l.currency = 'gold' AND l.kind = 'item' AND ${HOME} AND l.expires_at > ?1 AND l.region = ?2 AND h.region = ?2) WHERE v_rank = 1
    ORDER BY at DESC LIMIT ${VENDOR_BOARD_SHOWN}`).bind(nowS, region, player.id, me).all();
  const traderOf = (l) => `${l.v_map}:${l.v_key}:${l.v_id}`;
  const shown = new Set(newest.map(traderOf));
  const results = [...newest, ...houses.filter((l) => !shown.has(traderOf(l)))];
  const { results: patrons = [] } = await db.prepare(PATRON_TOLD_SQL('s.region = ?2')).bind(nowS - PATRON_TOLD_S, region).all();
  // AUDIT LEAN-READS B5: every field the answer gives, as market.js's listingView and patronView make them from the rows
  const good = (text) => { try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } };
  return {
    patrons: patrons.map((r) => [r.listing, Number(r.map), r.vendor_id, r.building_key == null ? null : Number(r.building_key), Number(r.hour), Number(r.minute),
      Number(r.seed), Number(r.price), Number(r.at), String(good(r.item)?.name ?? '')]),
    rows: results.map((l) => [l.id, Number(l.v_map), Number(l.v_key), l.v_id, l.v_owner, {
      owner: l.v_owner, entry: l.v_entry, mine: Number(l.v_mine) === 1,
      ...(Number(l.v_guildmate) === 1 ? { guildmate: true } : {}), ...(Number.isSafeInteger(l.v_tenancy) && l.v_tenancy > nowS ? { tenant: Number(l.v_tenancy) } : {}) },
    { kind: l.kind, region: Number(l.region), material: l.material || null, item: l.kind === 'item' ? good(l.item) : null, units: Number(l.own) + Number(l.bought),
      listed: Number(l.units), price: Number(l.price), fee: Number(l.fee), wear: l.wear != null ? Number(l.wear) : null, at: Number(l.at), expiresAt: Number(l.expires_at),
      state: l.state, currency: l.currency === 'gold' ? 'gold' : 'marks', mine: l.seller === player.id }]),
  };
}
const after = (a) => ({
  patrons: a.patrons.map((p) => [p.listing, p.map, p.vendor, p.buildingKey, p.hour, p.minute, p.seed, p.price, p.at, p.name]),
  rows: a.rows.map((r) => [r.id, r.map, r.buildingKey, r.vendor.id, r.owner, r.home, { kind: r.kind, region: r.region, material: r.material ?? null, item: r.item ?? null,
    units: r.units, listed: r.listed, price: r.price, fee: r.fee, wear: r.wear ?? null, at: r.at, expiresAt: r.expiresAt, state: r.state, currency: r.currency, mine: r.mine }]),
});

/** A region's version and its kept board (AUDIT LEAN-READS 2 B3: the version a row of its own). */
const rowOf = (raw, region) => raw.prepare(`SELECT v.ver, b.built, b.shape, b.since, b.until FROM (SELECT ? AS r) q
  LEFT JOIN market_vendor_ver v ON v.region = q.r LEFT JOIN market_vendor_boards b ON b.region = q.r`).get(region);

/** A world: four people with two characters each, two guilds, houses in both regions with traders and chairs. */
function world() {
  const db = d1();
  const raw = db._raw;
  for (const p of PEOPLE) raw.prepare('INSERT INTO players (id, guest_name, handle, created_at, last_seen, registered_at) VALUES (?, ?, ?, 0, 0, 0)').run(p, p, p.slice(2));
  for (const g of [1, 2]) raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES (?, ?, ?, ?, '[]', 0)").run(`g${g}`, `Guild${g}`, `guild${g}`, `G${g}`);
  return { db, raw };
}
const put = (raw, s, r) => {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    pick,
    home(map, key) {
      const owner = pick(PEOPLE);
      raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(map, key);   // released, then bought - no route replaces a house (AUDIT LEAN-READS B6)
      raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)")
        .run(map, key, owner, pick(CHARS(owner)), owner.slice(2), pick(REGIONS), pick(['public', 'public', 'guild', 'private']),
          r() < 0.15 && !raw.prepare("SELECT 1 FROM homes WHERE guild_id = 'g1'").get() ? 'g1' : null);   // a guild holds one hall
      raw.prepare('INSERT OR IGNORE INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, 1, 0, 0)').run(map, key, `t${key}`, place(VENDOR_STATION));
      raw.prepare('INSERT OR IGNORE INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, 1, 0, 0)').run(map, key, `chair${key}`, place(null));
    },
    listing(id, nowS) {
      const h = raw.prepare('SELECT * FROM homes ORDER BY map_id, building_key LIMIT 1 OFFSET ?').get(Math.floor(r() * 6));
      if (!h) return;
      const seller = r() < 0.85 ? h.player : pick(PEOPLE);
      const item = r() < 0.9;   // a pack's piece for gold, else a material for Marks (the market's own CHECK)
      raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, bought, price, fee, at, expires_at, state, rid, n, currency, item, vendor_map, vendor_id)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?, 1, ?, ?, 'open', ?, 'n', ?, ?, ?, ?)`).run(id, seller, pick(CHARS(seller)), r() < 0.9 ? h.region : pick(REGIONS), item ? 'item' : 'material', item ? null : 'iron',
        10 + Math.floor(r() * 90), nowS - Math.floor(r() * 50), nowS + 5 + Math.floor(r() * 120), `rid-${id}`, item ? 'gold' : 'marks', item ? ITEM : null, h.map_id, r() < 0.9 ? `t${h.building_key}` : `chair${h.building_key}`);
    },
  };
};

test('VENDOR-BOARD the oracle: through listings put up, bought, cancelled and run out, traders made and moved off their station, houses changing hands, doors, guilds and regions, houses released, guilds joined and left, rooms rented and patrons\' sales, every caller\'s board is the board the two statements read, kept or read again (mutants: each write that moves a board unmoved, a run-out board kept, a patron\'s sale kept past its day, the caller\'s door, a kept column read off another)', async () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { db, raw } = world();
    const r = lcg(seed * 15485863);
    const w = put(raw, seed, r);
    let nowS = T0, ids = 0;
    for (let k = 0; k < 6; k++) w.home(1000 + (k % 3), 300 + k);
    for (let i = 0; i < 25; i++) w.listing(`L${ids++}`, nowS);
    for (let op = 0; op < 70; op++) {
      const x = r();
      if (x < 0.2) w.listing(`L${ids++}`, nowS);
      else if (x < 0.32) raw.prepare("UPDATE market_listings SET state = ? WHERE id = ?").run(w.pick(['sold', 'cancelled']), `L${Math.floor(r() * ids)}`);
      else if (x < 0.40) nowS += Math.floor(r() * 40);   // listings run out
      else if (x < 0.42) {
        // AUDIT LEAN-READS 2 B1: a write by no route today - a trader piece or a listing deleted outright - and an heir's
        // house (homes.js inheritHome: the char_id alone)
        const y = r();
        if (y < 0.3) raw.prepare('DELETE FROM home_decor WHERE id = ?').run(`t${300 + Math.floor(r() * 6)}`);
        else if (y < 0.6) { try { raw.prepare('DELETE FROM market_listings WHERE id = ?').run(`L${Math.floor(r() * ids)}`); } catch { /* a listing a sale still names */ } }
        else {
          const h = raw.prepare('SELECT map_id, building_key, player FROM homes ORDER BY building_key LIMIT 1 OFFSET ?').get(Math.floor(r() * 6));
          if (h) raw.prepare('UPDATE homes SET char_id = ? WHERE map_id = ? AND building_key = ?').run(w.pick(CHARS(h.player)), h.map_id, h.building_key);
        }
      } else if (x < 0.45) raw.prepare('UPDATE home_decor SET place = ? WHERE id = ?').run(place(r() < 0.5 ? VENDOR_STATION : null), `t${300 + Math.floor(r() * 6)}`);
      else if (x < 0.48) raw.prepare('UPDATE market_listings SET region = ? WHERE id = ?').run(w.pick(REGIONS), `L${Math.floor(r() * ids)}`);   // no route moves one; the database's law holds if one does
      else if (x < 0.58) {
        const h = raw.prepare('SELECT map_id, building_key FROM homes ORDER BY building_key LIMIT 1 OFFSET ?').get(Math.floor(r() * 6));
        if (h) {
          const col = w.pick(['entry', 'guild_id', 'region', 'player', 'owner_name']);
          const val = col === 'entry' ? w.pick(['public', 'guild', 'private']) : col === 'guild_id' ? (r() < 0.5 ? null : 'g2') : col === 'region' ? w.pick(REGIONS) : col === 'player' ? w.pick(PEOPLE) : `Name${op}`;
          try { raw.prepare(`UPDATE homes SET ${col} = ? WHERE map_id = ? AND building_key = ?`).run(val, h.map_id, h.building_key); } catch { /* a player change a key forbids */ }
        }
      } else if (x < 0.62) {
        raw.prepare('DELETE FROM homes WHERE building_key = ?').run(300 + Math.floor(r() * 6));
        w.home(1000 + Math.floor(r() * 3), 300 + Math.floor(r() * 6));
      } else if (x < 0.72) {
        const p = w.pick(PEOPLE);
        raw.prepare('INSERT OR REPLACE INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 0, ?, 0)').run(p, w.pick(CHARS(p)), w.pick(['g1', 'g2']), p);
      } else if (x < 0.76) raw.prepare('DELETE FROM guild_members WHERE player = ?').run(w.pick(PEOPLE));
      else if (x < 0.84) {
        const h = raw.prepare('SELECT map_id, building_key FROM homes ORDER BY building_key LIMIT 1 OFFSET ?').get(Math.floor(r() * 6));
        const p = w.pick(PEOPLE);
        if (h) raw.prepare('INSERT OR REPLACE INTO home_rooms (map_id, building_key, room, anchor, price, tenant, tenant_char, until) VALUES (?, ?, ?, 1, 1, ?, ?, ?)')
          .run(h.map_id, h.building_key, Math.floor(r() * 2), p, w.pick(CHARS(p)), nowS + Math.floor(r() * 60) - 20);
      } else {
        const l = raw.prepare("SELECT * FROM market_listings WHERE vendor_id IS NOT NULL ORDER BY id LIMIT 1 OFFSET ?").get(Math.floor(r() * ids));
        if (l) raw.prepare(`INSERT OR IGNORE INTO market_patron_sales (listing, map, hour, minute, seed, seller, char_id, region, price, tax, fee, gets, at, day, building_key)
          VALUES (?, ?, 1, 2, 3, ?, ?, ?, ?, 0, 0, ?, ?, 1, 300)`).run(l.id, l.vendor_map, l.seller, l.char_id, l.region, l.price, l.price, nowS - Math.floor(r() * 2 * PATRON_TOLD_S));
      }
      if (r() < 0.25) nowS += Math.floor(r() * PATRON_TOLD_S / 4);   // the patrons' day passing
      for (const region of REGIONS) for (const lag of [0, Math.floor(r() * 60)]) {
        // AUDIT LEAN-READS 2 B1/B2: callers whose clocks were taken before the board's read too, as an overload's are
        const p = w.pick(PEOPLE), me = r() < 0.15 ? null : w.pick(CHARS(p));
        const player = { id: p, handle: p.slice(2), registered_at: 0 };
        const at = nowS - lag;
        const got = await marketVendors({ db, nowS: at }, player, ENV, { region, character: me });
        assert.equal(got.ok, true, JSON.stringify(got));
        assert.deepEqual(after(got), await before(db, player, region, me ?? '', at), `seed ${seed} op ${op} region ${region} lag ${lag}`);
        const was = raw.prepare('SELECT built FROM market_vendor_boards WHERE region = ?').get(region);
        raw.prepare('UPDATE market_vendor_boards SET built = -1 WHERE region = ?').run(region);
        assert.deepEqual(got, await marketVendors({ db, nowS: at }, player, ENV, { region, character: me }), `seed ${seed} op ${op} region ${region} lag ${lag}: whole, as read afresh`);
        if (was && raw.prepare('SELECT built FROM market_vendor_boards WHERE region = ?').get(region)?.built === -1) raw.prepare('UPDATE market_vendor_boards SET built = ? WHERE region = ?').run(was.built, region);   // a later board stands: as it was
      }
    }
  }
});

test('VENDOR-BOARD a kept board is one statement and the caller\'s own two rows; a first read writes nothing before its reads and keeps its board last, after the caller\'s own (AUDIT LEAN-READS D5); a write moves it, and the next caller reads it again and keeps it; a board whose first listing has run out is read again; a version moved while it was read is not kept (mutants: the version unread, the run-out unread, the keep unguarded, the caller\'s rows read after the keep)', async () => {
  const { db, raw } = world();
  const r = lcg(7);
  const w = put(raw, 0, r);
  for (let k = 0; k < 6; k++) w.home(1000 + (k % 3), 300 + k);
  raw.prepare('UPDATE homes SET region = 17, entry = \'public\', guild_id = NULL').run();
  for (let i = 0; i < 20; i++) w.listing(`L${i}`, T0);
  const asked = [];
  const counted = Object.create(db);
  counted.prepare = (sql) => { asked.push(sql); return db.prepare(sql); };
  counted.batch = (list) => { asked.push(`BATCH(${list.length})`); return db.batch(list); };
  const player = { id: 'p-ana', handle: 'ana', registered_at: 0 };
  await marketVendors({ db: counted, nowS: T0 }, player, ENV, { region: 17, character: 'p-ana-c1' });
  const steps = asked.map((x) => (x === VENDOR_BOARD_READ ? 'READ' : x === VENDOR_BOARD_KEEP ? 'KEEP' : /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(x) ? 'WRITE' : x.startsWith('BATCH') ? x : null)).filter(Boolean);
  assert.deepEqual(steps, ['BATCH(2)', 'READ', 'BATCH(5)', 'KEEP'], 'the caller\'s own rows, the row, the board\'s reads - and its one write last');
  const row = () => rowOf(raw, 17);
  assert.equal(row().built, row().ver, 'kept');
  assert.equal(row().shape, VENDOR_BOARD_SHAPE);
  assert.equal(row().since, 0, 'for every second before the read: no listing ran out by it, no patron\'s sale left its day');
  const next = raw.prepare("SELECT MIN(expires_at) AS n FROM market_listings WHERE state = 'open' AND vendor_id IS NOT NULL AND region = 17 AND expires_at > ?").get(T0).n;
  assert.equal(row().until, next, 'until its first listing runs out');
  asked.length = 0;
  await marketVendors({ db: counted, nowS: T0 + 1 }, player, ENV, { region: 17, character: 'p-ana-c1' });
  assert.deepEqual(asked.filter((s) => !/guild_members|home_rooms/.test(s)), ['BATCH(2)', VENDOR_BOARD_READ], 'kept: the row, and the caller\'s own two rows in one batch');
  asked.length = 0;
  await marketVendors({ db: counted, nowS: T0 + 1 }, player, ENV, { region: 17, character: null });
  assert.deepEqual(asked, [VENDOR_BOARD_READ], 'no character: no door to read');
  // a write moves it; the next caller reads and keeps it again
  raw.prepare("UPDATE market_listings SET region = 17 WHERE id = 'L3'").run();
  const v0 = row().ver;
  raw.prepare("UPDATE market_listings SET state = 'sold' WHERE id = 'L3'").run();
  assert.equal(row().ver, v0 + 1);
  asked.length = 0;
  await marketVendors({ db: counted, nowS: T0 + 2 }, player, ENV, { region: 17, character: null });
  assert.ok(asked.includes('BATCH(5)'), 'read again');
  assert.equal(row().built, row().ver, 'and kept');
  // run out: read again at its `until`
  asked.length = 0;
  await vendorBoard({ db: counted, nowS: row().until }, 17);
  assert.ok(asked.includes('BATCH(5)'), 'its first listing run out: read again');
  // a trader taken off its station moves its region's board
  await vendorBoard({ db, nowS: T0 + 3 }, 17);
  const v2 = row().ver;
  raw.prepare('UPDATE home_decor SET place = ? WHERE id = ?').run(place(null), 't300');
  assert.equal(row().ver, v2 + 1, 'off its station: moved');
  const h = raw.prepare('SELECT map_id, building_key FROM homes WHERE region = 17 LIMIT 1').get();
  raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, 1, 0, 0)').run(h.map_id, h.building_key, 'tnew', place(VENDOR_STATION));
  assert.equal(row().ver, v2 + 2, 'a trader set down in a house that stands: moved');
  // a version moved between the read and the keep: kept at the version read, so the next caller reads again; and a slow
  // reader's board never stands over the newer one another reader kept meanwhile
  raw.prepare("UPDATE market_listings SET region = 17 WHERE id IN ('L4', 'L5')").run();
  const v1 = row().ver;
  const racing = Object.create(db);
  racing.batch = async (list) => {
    const out = await db.batch(list);
    raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L4'").run();
    await vendorBoard({ db, nowS: T0 + 3 }, 17);   // another caller, reading after the write, keeps the newer board
    return out;
  };
  raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L5'").run();
  await vendorBoard({ db: racing, nowS: T0 + 3 }, 17);
  assert.equal(row().ver, v1 + 2);
  assert.equal(row().built, row().ver, 'the newer board stands: the slow reader\'s older one was not put over it');
  const keptText = raw.prepare('SELECT rows FROM market_vendor_boards WHERE region = 17').get().rows;
  raw.prepare('UPDATE market_vendor_boards SET built = -1 WHERE region = 17').run();
  assert.deepEqual(JSON.parse(keptText), JSON.parse(JSON.stringify(await vendorBoard({ db, nowS: T0 + 3 }, 17))), 'and it is the board after the write');
  // bounds
  assert.equal(VENDOR_BOARD_KEPT_S, 86_400);
  assert.equal(vendorBoardOf('{"newest":[],"houses":[]}'), null, 'not a board');
  assert.deepEqual(vendorBoardOf('{"newest":[],"houses":[],"patrons":[]}'), { newest: [], houses: [], patrons: [] });
});

test('VENDOR-BOARD AUDIT LEAN-READS: a row of another shape is no board (B1); a caller whose second came before the board\'s read is told the listings open at its own, and the newer board stays kept (B3); callers that missed together write it once (B2); a region no write has touched reads as version 0, and a write landing before the keep leaves it unkept; bookkeeping moves no board (B7); the bound is in bytes (B10) (mutants: the shape unread, the second\'s floor unread, the keep rewriting a board that serves, the bookkeeping moving it, the bound in characters)', async () => {
  const { db, raw } = world();
  const w = put(raw, 0, lcg(11));
  for (let k = 0; k < 6; k++) w.home(1000 + (k % 3), 300 + k);
  raw.prepare('UPDATE homes SET region = 17, entry = \'public\', guild_id = NULL').run();
  for (let i = 0; i < 20; i++) w.listing(`L${i}`, T0);
  const row = () => rowOf(raw, 17);
  const ids = (b) => [...b.newest, ...b.houses].map((l) => l.id).sort();
  // B1 (2 B5): the shape is the reads' own, their bounds' and the seconds they span, and the text's; a row of another is
  // read again and kept in this one
  assert.equal(VENDOR_BOARD_SHAPE, shapeOf('vendor-board: {newest, houses, patrons} from since to until', VENDOR_NEWEST_SQL, VENDOR_HOUSES_SQL, PATRON_TOLD_SQL('s.region = ?2'),
    VENDOR_SPAN_SQL, PATRON_TOLD_S, VENDOR_BOARD_KEPT_S, VENDOR_BOARD_SHOWN));
  await vendorBoard({ db, nowS: T0 }, 17);
  raw.prepare("UPDATE market_vendor_boards SET shape = 'an older deploy', rows = '{\"newest\":[],\"houses\":[],\"patrons\":[]}' WHERE region = 17").run();
  assert.ok(ids(await vendorBoard({ db, nowS: T0 }, 17)).length > 0, 'another shape: read again');
  assert.equal(row().shape, VENDOR_BOARD_SHAPE, 'and kept in this one');
  // B3: a listing open at T0 and run out by T0 + 10
  raw.prepare("UPDATE market_listings SET expires_at = ? WHERE id = 'L0'").run(T0 + 5);
  raw.prepare("UPDATE market_listings SET expires_at = ? WHERE id <> 'L0' AND expires_at <= ?").run(T0 + 500, T0 + 10);
  const later = await vendorBoard({ db, nowS: T0 + 10 }, 17);
  assert.equal(row().since, T0 + 5, 'the board read at T0 + 10 is the board from L0\'s end');
  const kept = row();
  const early = await vendorBoard({ db, nowS: T0 }, 17);
  assert.deepEqual(row(), kept, 'the newer board stays kept: a lagging caller\'s never put over it');
  const keptRows = raw.prepare('SELECT rows FROM market_vendor_boards WHERE region = 17').get().rows;
  raw.prepare('UPDATE market_vendor_boards SET built = -1 WHERE region = 17').run();
  const live = await vendorBoard({ db, nowS: T0 }, 17);
  raw.prepare('UPDATE market_vendor_boards SET built = ?, since = ?, until = ?, rows = ? WHERE region = 17').run(kept.built, kept.since, kept.until, keptRows);
  assert.deepEqual(ids(early), ids(live), 'the earlier caller is told the board at its own second');
  assert.ok(ids(early).includes('L0') && !ids(later).includes('L0'));
  // 2 B2: a caller whose clock lags the read, with no listing run out between, is served the kept board - no read
  const asked = [];
  const counting = Object.create(db);
  counting.prepare = (sql) => { asked.push(sql); return db.prepare(sql); };
  counting.batch = (list) => { asked.push('BATCH'); return db.batch(list); };
  assert.deepEqual(ids(await vendorBoard({ db: counting, nowS: T0 + 6 }, 17)), ids(later));
  assert.deepEqual(asked, [VENDOR_BOARD_READ], 'served from L0\'s end on');
  asked.length = 0;
  await vendorBoard({ db: counting, nowS: T0 + 4 }, 17);
  assert.ok(asked.includes('BATCH'), 'before it: read again');
  // B2: five callers miss together - the board written once
  raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L2'").run();
  let writes = 0;
  const keeps = Object.create(db);
  keeps.prepare = (sql) => {
    const st = db.prepare(sql);
    if (sql !== VENDOR_BOARD_KEEP) return st;
    return { bind: (...a) => ({ run: async () => { const res = await st.bind(...a).run(); writes += res.meta.changes; return res; } }) };
  };
  await Promise.all(Array.from({ length: 5 }, () => vendorBoard({ db: keeps, nowS: T0 + 20 }, 17)));
  assert.equal(writes, 1, 'one write for the five');
  assert.equal(row().built, row().ver);
  // 2 B4: a region with no version row is read every time and kept never; its first write makes the row past any board kept
  // for the region, so a row lost and counted again never meets an older board; a row deleted between the read and the keep
  // keeps nothing
  const built = row().built;
  raw.prepare('DELETE FROM market_vendor_ver WHERE region = 17').run();
  asked.length = 0;
  await vendorBoard({ db: counting, nowS: T0 + 20 }, 17);
  await vendorBoard({ db: counting, nowS: T0 + 20 }, 17);
  assert.equal(asked.filter((x) => x === 'BATCH').length, 2, 'no version row: read every time');
  assert.equal(row().built, built, 'and nothing kept');
  raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L2'").run();
  assert.equal(row().ver, built + 1, 'made past the kept board\'s version');
  const racing = Object.create(db);
  racing.batch = async (list) => { const out = await db.batch(list); raw.prepare('DELETE FROM market_vendor_ver WHERE region = 17').run(); return out; };
  await vendorBoard({ db: racing, nowS: T0 + 20 }, 17);
  assert.equal(row().built, built, 'the version row gone between the read and the keep: nothing kept');
  raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L2'").run();
  const ver = row().ver;
  racing.batch = async (list) => { const out = await db.batch(list); raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L2'").run(); return out; };
  await vendorBoard({ db: racing, nowS: T0 + 20 }, 17);
  assert.deepEqual([row().ver, row().built], [ver + 1, built], 'a write landing between: its version stands unkept');
  // B7: the hour's reckoning and the board's pixel move no board; the price does
  await vendorBoard({ db, nowS: T0 + 20 }, 17);
  const v = row().ver;
  raw.prepare('UPDATE market_listings SET patron_hour = 99, board_x = 1, board_y = 2 WHERE vendor_id IS NOT NULL').run();
  assert.equal(row().ver, v, 'bookkeeping: unmoved');
  raw.prepare("UPDATE market_listings SET price = price + 1 WHERE id = 'L2'").run();
  assert.equal(row().ver, v + 1, 'a price: moved');
  // B6: a house replaced - its implied delete fires no trigger, its insert does
  const v6 = row().ver;
  raw.prepare("INSERT OR REPLACE INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) SELECT map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at FROM homes WHERE region = 17 LIMIT 1").run();
  assert.ok(row().ver > v6, 'a replaced house moves its region\'s board');
  // B8: the next listing to run out found by its index
  const plan = raw.prepare("EXPLAIN QUERY PLAN SELECT MIN(expires_at) AS next FROM market_listings WHERE state = 'open' AND vendor_id IS NOT NULL AND region = ?1 AND expires_at > ?2").all(17, T0).map((x) => x.detail).join(' | ');
  assert.match(plan, /idx_market_vendor_expiry \(region=\? AND expires_at>\?\)/, plan);
  // B10: bytes, not characters
  assert.equal(KEPT_BOARD_MAX_BYTES, 1_500_000);
  assert.equal(keptFits('a'.repeat(KEPT_BOARD_MAX_BYTES), 'test'), true);
  assert.equal(keptFits('é'.repeat(KEPT_BOARD_MAX_BYTES / 2 + 1), 'test'), false, 'two bytes a character: past the bound');
  assert.equal(keptFits('é'.repeat(KEPT_BOARD_MAX_BYTES / 2), 'test'), true);
});

test('VENDOR-BOARD the writes that move a board are the database\'s own - every listing, trader, house and patron write of the region, by any route, a cascade or a sweep - and stand after every migration (mutant: a trigger dropped)', () => {
  const { raw } = world();
  const triggers = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'vendor_board_%' ORDER BY name").all().map((t) => t.name);
  assert.deepEqual(triggers, ['vendor_board_house', 'vendor_board_house_gone', 'vendor_board_house_in', 'vendor_board_listed', 'vendor_board_listing', 'vendor_board_patron', 'vendor_board_trader', 'vendor_board_trader_in', 'vendor_board_trader_out', 'vendor_board_unlisted']);
  assert.match(src('server-account/migrations/0137_vendor_board.sql'), new RegExp(`'\\$\\.station'\\) END = '${VENDOR_STATION}'`), 'the station the board reads');
  // a piece whose place is not JSON is no piece (decor.js) - its write is never refused by a trigger asking its station
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (5, 5, 'p-ana', 'c', 'Ana', 17, 1, 1)").run();
  assert.doesNotThrow(() => raw.prepare("INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (5, 5, 'bad', 1, 'not json', 1, 0, 0)").run());
  assert.doesNotThrow(() => raw.prepare("UPDATE home_decor SET place = 'still not' WHERE id = 'bad'").run());
  assert.doesNotThrow(() => raw.prepare("DELETE FROM home_decor WHERE id = 'bad'").run());
  const files = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f > '0137');
  for (const f of files) assert.doesNotMatch(src(`server-account/migrations/${f}`), /DROP TABLE (market_listings|home_decor|homes|market_patron_sales)\b/, `${f} rebuilds a table the board's triggers stand on - make them again in it`);
  // AUDIT LEAN-READS 2 B1: EVERY WRITE THE BOARD READS, AND WHICH REGIONS IT MOVES - each by name, those no route makes
  // today too (a listing or a trader deleted outright, an heir's house): the random oracle meets them too seldom to hold
  // them alone. And (B3) a write moves its region's version row, never the kept board's.
  assert.ok(!raw.prepare('PRAGMA table_info(market_vendor_boards)').all().some((c) => c.name === 'ver'), 'the kept board carries no version');
  const ver = (r) => raw.prepare('SELECT ver FROM market_vendor_ver WHERE region = ?').get(r)?.ver ?? 0;
  const moves = (label, write, regions) => {
    const before = [17, 23].map(ver);
    write();
    const after = [17, 23].map(ver);
    assert.deepEqual([17, 23].filter((_, i) => after[i] !== before[i]), regions, label);
  };
  const list = (id) => raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, state, rid, n, currency, item, vendor_map, vendor_id)
    VALUES (?, 'p-ana', 'p-ana-c1', 17, 'item', 1, 1, 0, 10, 1, 1, ?, 'open', ?, 'n', 'gold', ?, 6, 'tv')`).run(id, T0 + 99, `rid-${id}`, ITEM);
  moves('a house bought', () => raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (6, 6, 'p-ana', 'p-ana-c1', 'Ana', 17, 'public', 1, 1)").run(), [17]);
  moves('a trader set down', () => raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (6, 6, ?, 41000, ?, 1, 0, 0)').run('tv', place(VENDOR_STATION)), [17]);
  moves('a chair set down', () => raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (6, 6, ?, 41000, ?, 1, 0, 0)').run('ch', place(null)), []);
  moves('a listing put up', () => list('V1'), [17]);
  list('V2');
  moves('its price', () => raw.prepare("UPDATE market_listings SET price = 11 WHERE id = 'V1'").run(), [17]);
  moves('its region', () => raw.prepare("UPDATE market_listings SET region = 23 WHERE id = 'V1'").run(), [17, 23]);
  moves('an heir\'s house (the char_id alone)', () => raw.prepare("UPDATE homes SET char_id = 'p-ana-c2' WHERE map_id = 6 AND building_key = 6").run(), [17]);
  moves('its door', () => raw.prepare("UPDATE homes SET entry = 'guild' WHERE map_id = 6 AND building_key = 6").run(), [17]);
  moves('the house to another region', () => raw.prepare('UPDATE homes SET region = 23 WHERE map_id = 6 AND building_key = 6').run(), [17, 23]);
  moves('a patron\'s sale', () => raw.prepare(`INSERT INTO market_patron_sales (listing, map, hour, minute, seed, seller, char_id, region, price, tax, fee, gets, at, day, building_key)
    VALUES ('V2', 6, 1, 2, 3, 'p-ana', 'p-ana-c1', 23, 10, 0, 0, 10, ?, 1, 6)`).run(T0), [23]);
  moves('a listing deleted outright', () => raw.prepare("DELETE FROM market_listings WHERE id = 'V1'").run(), [23]);
  moves('the trader taken off its station', () => raw.prepare("UPDATE home_decor SET place = ? WHERE id = 'tv'").run(place(null)), [23]);
  moves('a chair moved', () => raw.prepare("UPDATE home_decor SET place = ? WHERE id = 'ch'").run(place(null)), []);
  raw.prepare("UPDATE home_decor SET place = ? WHERE id = 'tv'").run(place(VENDOR_STATION));
  moves('the trader deleted outright', () => raw.prepare("DELETE FROM home_decor WHERE id = 'tv'").run(), [23]);
  moves('the house released', () => raw.prepare('DELETE FROM homes WHERE map_id = 6 AND building_key = 6').run(), [23]);
});

test('VENDOR-BOARD AUDIT LEAN-READS 2 B2: a board is the board from the last second an answer would have differed - the last listing to run out by its read, and the last patron\'s sale to leave the day where it tells fewer than it may - to its first listing\'s end; a caller between is served it, a caller before reads again (mutants: the run-out unread, the sale unread, the sale read where the board is full)', async () => {
  const day = PATRON_TOLD_S;
  assert.deepEqual(vendorSpan(null, 0, T0), { since: 0, until: T0 + VENDOR_BOARD_KEPT_S }, 'nothing run out, no sale gone: every second before');
  assert.deepEqual(vendorSpan({ next: T0 + 9, gone: T0 - 50, told: T0 - day - 30 }, VENDOR_BOARD_SHOWN - 1, T0), { since: T0 - 30, until: T0 + 9 });
  assert.deepEqual(vendorSpan({ next: T0 + 9, gone: T0 - 50, told: T0 - day - 30 }, VENDOR_BOARD_SHOWN, T0), { since: T0 - 50, until: T0 + 9 }, 'a full board: an older sale never reaches it');
  assert.deepEqual(vendorSpan({ next: null, gone: T0 - 50, told: T0 - day - 70 }, 0, T0), { since: T0 - 50, until: T0 + VENDOR_BOARD_KEPT_S });
  const { db, raw } = world();
  const w = put(raw, 0, lcg(13));
  for (let k = 0; k < 6; k++) w.home(1000 + (k % 3), 300 + k);
  raw.prepare('UPDATE homes SET region = 17, entry = \'public\', guild_id = NULL').run();
  for (let i = 0; i < 6; i++) w.listing(`L${i}`, T0);
  raw.prepare("UPDATE market_listings SET region = 17, expires_at = ? WHERE expires_at <= ?").run(T0 + 500, T0 + 5);
  const l = raw.prepare("SELECT * FROM market_listings WHERE vendor_id IS NOT NULL AND region = 17 LIMIT 1").get();
  const sale = (listing, at) => raw.prepare(`INSERT INTO market_patron_sales (listing, map, hour, minute, seed, seller, char_id, region, price, tax, fee, gets, at, day, building_key)
    VALUES (?, ?, 1, 2, 3, ?, ?, 17, 10, 0, 0, 10, ?, 1, 300)`).run(listing, l.vendor_map, l.seller, l.char_id, at);
  sale(l.id, T0 - day - 10);   // left the day ten seconds before the read
  const board = await vendorBoard({ db, nowS: T0 }, 17);
  assert.equal(board.patrons.length, 0);
  assert.equal(rowOf(raw, 17).since, T0 - 10);
  const asked = [];
  const counting = Object.create(db);
  counting.prepare = (sql) => { asked.push(sql); return db.prepare(sql); };
  counting.batch = (list) => { asked.push('BATCH'); return db.batch(list); };
  await vendorBoard({ db: counting, nowS: T0 - 5 }, 17);
  assert.deepEqual(asked, [VENDOR_BOARD_READ], 'after the sale left the day: served');
  asked.length = 0;
  const early = await vendorBoard({ db: counting, nowS: T0 - 20 }, 17);
  assert.ok(asked.includes('BATCH'), 'before it: read again');
  assert.equal(early.patrons.length, 1, 'and told the sale still in its day');
});
