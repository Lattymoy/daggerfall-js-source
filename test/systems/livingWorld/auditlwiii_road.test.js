// AUDIT LW-III (bible/01-Overview/audits/Audit-LivingWorld-III.md): THE ROAD'S TIMELINE AND THE TRADERS' READ - a party halted
// across nightfall walks on to its night's stop from where it stood, never as far on as the halt's minutes would have
// walked it (trips.js partyAt's `walked`, `held`); a town's patron sales read on its town index's hour, never the whole
// kept history (market.js patronsTold). Pure, synthetic and the account service's own schema: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { partyAt, wayOf, whenWalked, NATIVE_PIXEL, NATIVE_PER_M, CALENDAR_MPM } from '../../../src/systems/livingWorld/trips.js';
import { patronsTold, PATRON_TOLD_S, PATRON_TOLD_SQL } from '../../../server-account/src/market.js';
import { d1, T0 } from '../../accountDb.mjs';

test('AUDIT LW-III a halt across nightfall: the walk on to the night\'s stop counts the minutes WALKED since dusk, the halt\'s own out - the party steps out of its halt where it stood, an inn half a pixel ahead or wet ground about it, and walks on at its pace (mutants: the loop\'s held, the end\'s held)', () => {
  const plan = { pixels: Array.from({ length: 11 }, (_, i) => ({ x: 100 + i, y: 100 })), kinds: Array(10).fill('road') };
  const pace = 0.95 * CALENDAR_MPM * NATIVE_PER_M;   // a pedlar's, native a minute
  const trim0 = 8192, trim1 = 8192;
  for (const ground of ['inn', 'wet']) {
    const way = wayOf(plan);
    const walk = (way.len - trim0 - trim1) / pace;
    const outT0 = 10 * 1440 + 8 * 60;
    const outT1 = whenWalked(outT0, walk);
    // met at 18:27 of its first day, held an hour, past dusk (19:00)
    const t0 = 10 * 1440 + 18 * 60 + 27, t1 = t0 + 60;
    const s0 = trim0 + pace * (10 * 60 + 27);
    if (ground === 'inn') way.inns = [{ s: s0 + NATIVE_PIXEL / 2, town: { mapId: 7, name: 'Inn' } }];
    else { const x0 = way.pts[0][0] + s0; way.dry = (nx) => !(nx > x0 - 2000 && nx < x0 + 12000); }
    const trip = { id: 'x', way, pace, trim0, trim1, outT0, outT1, backT0: outT1 + 600, backT1: whenWalked(outT1 + 600, walk), halt: { t0, t1, fightEnd: t0 + 25, s: s0, leg: 'out' } };
    let last = partyAt(trip, t1 - 1);
    assert.equal(last.halt, true);
    for (let t = t1; t < t1 + 90; t++) {
      const at = partyAt(trip, t);
      assert.ok(Math.abs(at.s - last.s) <= pace + 1e-6, `${ground}: one minute's walk at most (${Math.round(at.s - last.s)} native at ${t - t1} min)`);
      last = at;
    }
    assert.ok(last.s > s0, `${ground}: and it walks on`);
  }
});

test('AUDIT LW-III a town\'s patron sales read on its index\'s hour: the read bounded by the hour as well as the minute, so the town index (map, hour) walks the last day alone, not MARKET_KEEP_DAYS of sales; the same sales told (mutants: the hour bound)', async () => {
  const db = d1();
  const raw = db._raw;
  raw.exec('PRAGMA foreign_keys=OFF');
  const ins = raw.prepare('INSERT INTO market_patron_sales (listing, map, hour, minute, seed, seller, char_id, region, price, tax, fee, gets, at, day, building_key) VALUES (?,5,?,?,1,\'p1\',\'c1\',17,10,0,0,10,?,?,1)');
  const insL = raw.prepare("INSERT INTO market_listings (id, seller, char_id, region, kind, units, own, bought, price, fee, at, expires_at, rid, n, currency, item, state) VALUES (?, 'p1', 'c1', 17, 'item', 1, 0, 0, 10, 1, ?, ?, ?, 'n', 'gold', '{}', 'sold')");
  const h1 = Math.floor(T0 / 3600);
  let n = 0;
  raw.exec('BEGIN');
  for (let h = h1 - 30 * 24; h < h1; h++) for (let k = 0; k < 2; k++) { const id = `L${n++}`; insL.run(id, h * 3600, h * 3600 + 1, `r${id}`); ins.run(id, h, k * 20, h * 3600 + k * 1200, Math.floor(h / 24)); }
  raw.exec('COMMIT');
  const asked = [];
  const spy = { prepare: (sql) => { asked.push(sql); const st = db.prepare(sql); return { bind: (...a) => { asked.push(a); return st.bind(...a); } }; } };
  const told = await patronsTold(spy, [5], T0);
  const unbounded = raw.prepare(PATRON_TOLD_SQL('s.map IN (?2)')).all(T0 - PATRON_TOLD_S, 5).map((r) => r.listing);
  assert.deepEqual(told.map((s) => s.listing), unbounded, 'the same sales as the minute\'s window alone');
  assert.ok(told.length > 0 && told.every((s) => s.at > T0 - PATRON_TOLD_S), 'the last day\'s');
  const plan = raw.prepare(`EXPLAIN QUERY PLAN ${asked[0]}`).all(...asked[1]).map((r) => r.detail).join(' | ');
  assert.match(plan, /idx_patron_sales_town \(map=\? AND hour>\?\)/, `the hour bounds the index: ${plan}`);
  assert.equal(asked[1].at(-1), Math.floor((T0 - PATRON_TOLD_S) / 3600), 'bounded at the told window\'s first hour');
});
