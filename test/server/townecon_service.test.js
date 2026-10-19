import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import { mintRaidReceipt } from '../../src/net/raid/raidReceipt.js';
import { WITNESS } from '../../src/net/nodeLaw.js';
import { validLootList, generateRandomLoot, LOOT_MATRICES } from '../../src/systems/loot/loot.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { itemWorth } from '../../src/systems/item/itemLaw.js';
import { patronCap, patronWorth } from '../../src/net/patronLaw.js';
import {
  TOWN_ECON_CAPS, TOWN_ECON_DAYS, TOWN_ECON_KEPT_S, TOWN_WATCH_CLAIM_MAX, TOWN_WITNESS_HOUR, townActivity, townPlayersShare, townShareShown,
} from '../../src/net/townEconLaw.js';
import { HOUR_JOBS, MINUTE_JOBS, runCron, CRON_HOUR, CRON_MINUTE } from '../../server-account/src/cron.js';
import { _resetTownEconForTests, TOWN_ECON_ISOLATE_S } from '../../server-account/src/townEcon.js';

// TOWN-ECON TE2 (2026-10-18, bible/06-Systems/Town-Economy-Arc.md section 4): the account service's half of the players'
// share - the town registry, the four witnessed sources (footsteps, a trader's sale, a patron's, a raid driven off),
// each account capped a town a day, the read and the sweep.

const { subtle } = globalThis.crypto;
let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
const DAY = 86_400;
const today = () => Math.floor(_now / DAY);
let _rid = 0;
const rid = () => `te2-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
// AUDIT TOWN-ECON 2 SVC-1: a map id names its own pixel - its low 20 bits y x 1000 + x (townEconLaw.js townPixelIdOf)
const pixelMap = (px, py, hi = 3) => ((hi << 20) | (py * 1000 + px)) >>> 0;
const MAP = pixelMap(207, 212), KEY = 4242, PIECE = 'trader1';
const VENDOR = { map: MAP, id: PIECE };
/** Daggerfall's own town as a client reports it: its map id, pixel, region and location index. */
const TOWN = Object.freeze({ map: MAP, px: 207, py: 212, region: DF, location: 5 });
const plain = (it) => JSON.parse(JSON.stringify(it));
const place = (station = null) => JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, ...(station ? { station } : {}) });
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** Pieces to sell - weapons off the loot tables, each one the loot law stands behind. */
function goods(n = 8) {
  const out = [];
  for (let seed = 1; out.length < n && seed < 300; seed++) {
    const items = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(seed));
    for (const it of items) if (it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE && validLootList([plain(it)])?.[0]) out.push(it);
  }
  return out.slice(0, n);
}

async function stand(env = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Devi', ...env });
  const raw = s.env.DB._raw;
  /** A registered account a week old - a witness (nodeLaw.js WITNESS.ageS). */
  const aged = async (handle) => {
    const who = await s.registered(handle);
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - WITNESS.ageS - DAY, who.id);
    return who;
  };
  const seated = async (handle, save = {}, { old = true } = {}) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: 0, ...save });
    who.character = R.id; who.at = R.at;
    if (old) raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - WITNESS.ageS - DAY, who.id);
    return who;
  };
  // AUDIT TOWN-ECON 2 SVC-1: a report goes with a Watch tick of the account's at the town's pixel (`receipt` null: none)
  const witness = async (who, town = TOWN, receipt = undefined) => s.call('/v1/towns/witness',
    { town, ...(receipt === null ? {} : { receipt: receipt ?? await mintWatchReceipt({ s: who.id, x: town.px, y: town.py, c: 4000 }, s.gateKey, { subtle, nowS: _now }).catch(() => 'k1.off.map') }) }, who.secret);
  const confirm = async (town = TOWN) => { for (const h of ['Wita', 'Witb', 'Witc']) await witness(await aged(`${h}${town.map}`), town); };
  const tick = (who, x = TOWN.px, y = TOWN.py, c = 1) => mintWatchReceipt({ s: who.id, x, y, c }, s.gateKey, { subtle, nowS: _now });
  const watch = (who, receipts, sea) => s.call('/v1/towns/watch', sea ? { receipts, sea } : { receipts }, who.secret);   // SEA-TRADE: `sea` the dealings' ticks
  const econ = (who) => s.call('/v1/towns/econ', {}, who.secret);
  const acts = (who) => raw.prepare('SELECT map, day, src, n FROM town_econ_acts WHERE account = ? ORDER BY src').all(who.id).map((r) => ({ ...r }));
  const days = () => raw.prepare('SELECT map, day, src, n FROM town_econ_days ORDER BY map, day, src').all().map((r) => ({ ...r }));
  const record = (who) => {
    const row = raw.prepare('SELECT obj, seq FROM realm_characters WHERE id = ?').get(who.character);
    return { seq: Number(row.seq), save: JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))) };
  };
  /** A home of `who`'s in Daggerfall with a trader. */
  const home = (who) => {
    raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, ?, ?, 'public', 1000, ?)`)
      .run(MAP, KEY, who.id, who.character, who.handle, DF, _now);
    raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
      VALUES (?, ?, ?, NULL, 182, 3, ?, ?, NULL, 0, 0)`).run(MAP, KEY, PIECE, place('vendor'), _now);
  };
  const list = (who, price = 50, vendor = VENDOR) => s.call('/v1/market/list', {
    character: who.character, region: WR, kind: 'item', item: validLootList([record(who).save.items[0]])?.[0] ?? null, pick: 0, price, hubs: HUBS, rid: rid(),
    currency: 'gold', realm: who.at(), ...(vendor ? { vendor } : {}),
  }, who.secret);
  const buy = (who, l) => s.call('/v1/market/buy', {
    character: who.character, region: DF, listing: l.id, units: 1, max: l.price, hubs: HUBS, rid: rid(), realm: who.at(), vendor: VENDOR,
  }, who.secret);
  return { ...s, raw, aged, seated, witness, confirm, tick, watch, econ, acts, days, record, home, list, buy };
}

test('TOWN-ECON TE2 the town registry (POST /v1/towns/witness): a town is the clients\' word, agreed - three accounts a week registered giving the same report confirm it, and a confirmed town takes no more; a guest is refused, a young account not counted, a bad report refused, the hour\'s reports bounded; a second town at a confirmed pixel, or at its place, never stands and is told `taken` (mutants: TOWNECON2-witness-young, TOWNECON2-witness-known, TOWNECON2-confirm-early, TOWNECON-AUDIT2-SVC6-taken-confirmed, TOWNECON-AUDIT2-REC9-pixel-not-unique, TOWNECON-AUDIT2-REC9-place-not-unique, TOWNECON-AUDIT2-SVC4-limit)', async () => {
  _now = T0;
  const s = await stand();
  const guest = await s.guest();
  assert.equal((await s.witness(guest)).body.error, 'towns-need-account');
  const young = await s.registered('Yoon');
  assert.deepEqual((await s.witness(young)).body, { ok: true, counted: false, why: 'young' });
  const a = await s.aged('Ada'), b = await s.aged('Bel'), c = await s.aged('Cyr'), d = await s.aged('Dov');
  assert.equal((await s.witness(a, { ...TOWN, px: 1000 })).body.error, 'bad-town');
  assert.equal((await s.witness(a, { ...TOWN, map: 0 })).body.error, 'bad-town');
  assert.deepEqual((await s.witness(a)).body, { ok: true, counted: true, confirmed: false });
  assert.deepEqual((await s.witness(b, { ...TOWN, location: 6 })).body, { ok: true, counted: true, confirmed: false }, 'a dissent');
  assert.deepEqual((await s.witness(b)).body, { ok: true, counted: true, confirmed: false }, 'an account\'s first answer stands');
  assert.deepEqual((await s.witness(c)).body, { ok: true, counted: true, confirmed: false }, 'two agree');
  assert.deepEqual(s.raw.prepare('SELECT * FROM town_econ_towns').all(), []);
  assert.deepEqual((await s.witness(d)).body, { ok: true, counted: true, confirmed: true }, 'three');
  assert.deepEqual({ ...s.raw.prepare('SELECT map, px, py, region, location FROM town_econ_towns').get() }, { ...TOWN });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'town' AND key = ?").get(`1:${MAP}`).n, 4, 'AUDIT TOWN-ECON 2 SVC-11: keyed `1:<map>` - an account\'s first answer a row');
  assert.deepEqual((await s.witness(await s.aged('Eve'))).body, { ok: true, counted: false, why: 'known' }, 'confirmed: no more reports');
  // another map id at the confirmed pixel never stands - the first confirmed holds the pixel. AUDIT TOWN-ECON 2 SVC-6
  // (REC-8): and it is told so - `taken`, its reports let go - not `confirmed`; REC-9: the pixel's key alone, and the
  // place's alone, each hold it
  const samePixel = { ...TOWN, map: pixelMap(207, 212, 4), location: 9 };
  const samePlace = { ...TOWN, map: pixelMap(209, 212), px: 209 };
  for (const [i, town] of [samePixel, samePlace].entries()) {
    const answers = [];
    for (const h of ['Fen', 'Gus', 'Hal']) answers.push((await s.witness(await s.aged(`${h}${i}`), town)).body);
    assert.deepEqual(answers.at(-1), { ok: true, counted: true, confirmed: false, why: 'taken' }, `the ${i ? 'place' : 'pixel'} another's`);
    assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'town' AND key = ?").get(`1:${town.map}`).n, 0, 'its reports let go');
  }
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_econ_towns').get().n, 1);
  // the hour's reports - a walk's
  const r = await s.aged('Ivo');
  assert.equal(TOWN_WITNESS_HOUR, 12);
  for (let i = 0; i < TOWN_WITNESS_HOUR; i++) await s.witness(r, { ...TOWN, map: pixelMap(i, 1), px: i, py: 1, location: 100 + i });
  assert.equal((await s.witness(r, { ...TOWN, map: pixelMap(900, 212), px: 900 })).body.error, 'towns-rate');
});

test('TOWN-ECON TE2 footsteps (POST /v1/towns/watch): the relay\'s signed Watch ticks, claimed by the account they name, count at the confirmed town of their pixel on their own day - once each, at most TOWN_ECON_CAPS.watch a town a day; another\'s tick, an unsigned one, one at no confirmed town, a young account\'s and a claim too large count nothing; AUDIT TOWN-ECON 2: an account unseated refused (SVC-2), a tick past the cap or seen writes nothing and the full pixel said (SVC-5), a tick a moment past midnight today\'s (SVC-9), a tick on its own day (REC-10) (mutants: TOWNECON2-watch-cap, TOWNECON2-watch-seen, TOWNECON2-watch-yours, TOWNECON2-watch-young, TOWNECON2-days-uncounted, TOWNECON-AUDIT2-SVC2-unseated, TOWNECON-AUDIT2-SVC5-capped-written, TOWNECON-AUDIT2-SVC5-full-unsaid, TOWNECON-AUDIT2-SVC9-skew, TOWNECON-AUDIT2-REC10-today)', async () => {
  _now = T0;
  const s = await stand();
  const w = await s.seated('Walker'), other = await s.seated('Other');   // AUDIT TOWN-ECON 2 SVC-2: a claim of the Watch is its account's seat's (INT16)
  assert.deepEqual((await s.watch(w, [await s.tick(w)])).body, { ok: true, counted: 0, sea: 0, why: { 'no-town': 1 }, full: [] }, 'no town confirmed there yet');
  await s.confirm();
  assert.equal((await s.watch(w, [])).body.error, 'bad-watch');
  assert.equal((await s.watch(w, Array.from({ length: TOWN_WATCH_CLAIM_MAX + 1 }, () => 'k1.x.y'))).body.error, 'bad-watch');
  const r1 = await s.tick(w, TOWN.px, TOWN.py, 1);
  assert.deepEqual((await s.watch(w, [r1])).body, { ok: true, counted: 1, sea: 0, why: {}, full: [] });
  const seenRows = () => s.raw.prepare('SELECT COUNT(*) AS n FROM town_econ_seen').get().n;
  const seen1 = seenRows();
  assert.deepEqual((await s.watch(w, [r1])).body, { ok: true, counted: 0, sea: 0, why: { capped: 1 }, full: [] }, 'once each');
  assert.equal(seenRows(), seen1, 'AUDIT TOWN-ECON 2 SVC-5: a tick seen before writes nothing');
  assert.deepEqual((await s.watch(w, [await s.tick(other)])).body.why, { 'not-yours': 1 });
  assert.equal((await s.watch(w, [(await s.tick(w)).replace(/\.[^.]+$/, '.')])).body.counted, 0, 'unsigned');
  assert.deepEqual((await s.watch(w, [await s.tick(w, 500, 100)])).body.why, { 'no-town': 1 });
  const young = await s.seated('Newcomer', {}, { old: false });
  assert.deepEqual((await s.watch(young, [await s.tick(young)])).body, { ok: true, counted: 0, sea: 0, why: { young: 1 }, full: [] });
  // AUDIT TOWN-ECON 2 SVC-2: an account with no realm character seated, or one the judge holds, is refused as the seats' Watch is
  const loose = await s.aged('Loose');
  assert.equal((await s.watch(loose, [await s.tick(loose)])).body.error, 'progress-seat');
  // the day's cap: the walker's 2..40 - twelve a claim. SVC-5: the ticks past it write nothing, and the claim that
  // filled it says the town's pixel is full today
  let counted = 1, full = [];
  for (let c = 2; c <= 40; c += TOWN_WATCH_CLAIM_MAX) {
    const batch = [];
    for (let k = c; k < Math.min(41, c + TOWN_WATCH_CLAIM_MAX); k++) batch.push(await s.tick(w, TOWN.px, TOWN.py, k));
    const b = (await s.watch(w, batch)).body;
    counted += b.counted;
    full = [...full, ...b.full];
  }
  assert.equal(counted, TOWN_ECON_CAPS.watch, 'an hour\'s walking a town a day');
  assert.deepEqual([...new Set(full)], [`${TOWN.px},${TOWN.py}`], 'full today');
  const seen30 = seenRows();
  const past = (await s.watch(w, [await s.tick(w, TOWN.px, TOWN.py, 77)])).body;
  assert.deepEqual([past.counted, past.why, past.full, seenRows()], [0, { capped: 1 }, [`${TOWN.px},${TOWN.py}`], seen30], 'past the cap: nothing written');
  assert.deepEqual(s.acts(w), [{ map: MAP, day: today(), src: 'watch', n: TOWN_ECON_CAPS.watch }]);
  assert.deepEqual(s.days(), [{ map: MAP, day: today(), src: 'watch', n: TOWN_ECON_CAPS.watch }], 'the town\'s day counts what the account\'s did');
  // the claim whose last tick fills the cap says it - a second walker one short of it
  const w2 = await s.seated('Walker2');
  s.raw.prepare('INSERT INTO town_econ_acts (account, map, day, src, n) VALUES (?, ?, ?, ?, ?)').run(w2.id, MAP, today(), 'watch', TOWN_ECON_CAPS.watch - 1);
  assert.deepEqual((await s.watch(w2, [await s.tick(w2, TOWN.px, TOWN.py, 1)])).body.full, [`${TOWN.px},${TOWN.py}`], 'filled by this claim: full');
  // REC-10: a tick counts on ITS day - one from before midnight claimed after it is yesterday's (its cap full)
  const late = await s.tick(w, TOWN.px, TOWN.py, 98);
  _now += DAY;
  assert.equal((await s.watch(w, [late])).body.counted, 0, 'yesterday\'s, at yesterday\'s cap');
  // the next day is another day's cap
  assert.equal((await s.watch(w, [await s.tick(w, TOWN.px, TOWN.py, 99)])).body.counted, 1);
  assert.equal(s.days().length, 2);
  // AUDIT TOWN-ECON 2 SVC-9: a tick the relay minted a moment past the service's midnight counts on the service's today
  _now = (today() + 1) * DAY - 3;
  const ahead = await mintWatchReceipt({ s: w.id, x: TOWN.px, y: TOWN.py, c: 555 }, s.gateKey, { subtle, nowS: _now + 6 });
  assert.deepEqual((await s.watch(w, [ahead])).body.why, {}, 'not `old`');
  assert.ok(s.acts(w).some((r) => r.day === today()), 'on today');
});

test('SEA-TRADE a captain\'s dealing (POST /v1/towns/watch `sea`): a tick the claim flags counts once more as a `sea` act - at the confirmed town at its pixel or the nearest beside it within TOWN_SEA_REACH_PX, its own seen ref, at most TOWN_ECON_CAPS.sea a town a day; its footstep counted as ever; a tick two pixels off counts no dealing; a bad `sea` refused; a young account\'s none (mutants: TOWNECON4-sea-reach, TOWNECON4-sea-seen, TOWNECON4-sea-cap, TOWNECON4-sea-unflagged, TOWNECON4-sea-bad)', async () => {
  _now = T0;
  const s = await stand();
  const cap = await s.seated('Captain');
  await s.confirm();
  // at the town's own pixel: a footstep and a dealing
  const at = await s.tick(cap, TOWN.px, TOWN.py, 1);
  assert.deepEqual((await s.watch(cap, [at], [0])).body, { ok: true, counted: 1, sea: 1, why: {}, full: [] });
  assert.deepEqual((await s.watch(cap, [at], [0])).body, { ok: true, counted: 0, sea: 0, why: { capped: 2 }, full: [] }, 'each once');
  // beside it (a ship at the quay): no footstep there, the dealing at the town beside
  const quay = await s.tick(cap, TOWN.px + 1, TOWN.py - 1, 2);
  assert.deepEqual((await s.watch(cap, [quay], [0])).body, { ok: true, counted: 0, sea: 1, why: { 'no-town': 1 }, full: [] });
  assert.deepEqual((await s.watch(cap, [await s.tick(cap, TOWN.px + 2, TOWN.py, 3)], [0])).body, { ok: true, counted: 0, sea: 0, why: { 'no-town': 1, 'no-port': 1 }, full: [] }, 'two pixels off: no port');
  // unflagged: a footstep alone
  assert.deepEqual((await s.watch(cap, [await s.tick(cap, TOWN.px, TOWN.py, 4)])).body, { ok: true, counted: 1, sea: 0, why: {}, full: [] });
  // a bad `sea`
  const two = [await s.tick(cap, TOWN.px, TOWN.py, 5), await s.tick(cap, TOWN.px, TOWN.py, 6)];
  for (const bad of [[0, 0], [2], [-1], [0.5], ['0'], 'x', { 0: 0 }, [0, 1, 1]]) assert.equal((await s.watch(cap, two, bad)).body.error, 'bad-watch', JSON.stringify(bad));
  assert.equal(s.acts(cap).find((r) => r.src === 'sea').n, 2, 'nothing of a refused claim');
  // the day's cap
  let sea = 2;
  for (let c = 10; c < 40; c += TOWN_WATCH_CLAIM_MAX) {
    const batch = [];
    for (let k = c; k < c + TOWN_WATCH_CLAIM_MAX; k++) batch.push(await s.tick(cap, TOWN.px + 1, TOWN.py, k));
    sea += (await s.watch(cap, batch, batch.map((_, i) => i))).body.sea;
  }
  assert.equal(sea, TOWN_ECON_CAPS.sea, 'ten dealings a town a day');
  assert.deepEqual(s.acts(cap), [{ map: MAP, day: today(), src: 'sea', n: TOWN_ECON_CAPS.sea }, { map: MAP, day: today(), src: 'watch', n: 2 }]);
  assert.deepEqual(s.days().filter((r) => r.src === 'sea'), [{ map: MAP, day: today(), src: 'sea', n: TOWN_ECON_CAPS.sea }], 'the town\'s day counts it');
  // the nearest town of two beside a tick, the tick's own pixel's first
  const NEXT = Object.freeze({ map: pixelMap(TOWN.px + 2, TOWN.py), px: TOWN.px + 2, py: TOWN.py, region: DF, location: 6 });
  await s.confirm(NEXT);
  const mid = await s.seated('Mid');
  assert.equal((await s.watch(mid, [await s.tick(mid, TOWN.px + 1, TOWN.py, 1)], [0])).body.sea, 1);
  assert.deepEqual(s.acts(mid), [{ map: MAP, day: today(), src: 'sea', n: 1 }], 'a tie: the lower map id');
  assert.equal((await s.watch(mid, [await s.tick(mid, NEXT.px, NEXT.py, 2)], [0])).body.sea, 1);
  assert.ok(s.acts(mid).some((r) => r.map === NEXT.map && r.src === 'sea'), 'the tick\'s own pixel\'s town');
  // a young account's: none
  const young = await s.seated('Deckhand', {}, { old: false });
  assert.deepEqual((await s.watch(young, [await s.tick(young)], [0])).body, { ok: true, counted: 0, sea: 0, why: { young: 1 }, full: [] });
  // the share weighs it
  assert.equal(townActivity([{ day: today(), src: 'sea', n: 10 }], today()), 10 * 2);
});

test('TOWN-ECON TE2 the read (POST /v1/towns/econ): every town whose players\' share is one or more, one decimal, by the law over the days kept - kept by the isolate; any session reads it; AUDIT TOWN-ECON 2 SVC-3: counted by the clock once a keeping into one row the isolates read, and REC-10 the least share answered, under it not (mutants: TOWNECON2-read-unkept, TOWNECON2-read-least, TOWNECON-AUDIT2-SVC3-days-read, TOWNECON-AUDIT2-SVC3-counted-fresh, TOWNECON-AUDIT2-REC10-least-exclusive)', async () => {
  _now = T0;
  const s = await stand();
  const g = await s.guest();
  assert.deepEqual((await s.econ(g)).body, { ok: true, towns: [] });
  const t = today();
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(MAP, t, 'watch', 60);
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(MAP, t - 2, 'trade', 10);
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(MAP, t - TOWN_ECON_DAYS, 'raid', 9);   // past the days kept
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(2002, t, 'watch', 2);   // a share under one
  _now += TOWN_ECON_KEPT_S;
  const r = (await s.econ(g)).body;
  const share = townShareShown(townPlayersShare(townActivity([{ day: t, src: 'watch', n: 60 }, { day: t - 2, src: 'trade', n: 10 }], t)));
  assert.ok(share > 10 && share < 20, `${share}`);
  assert.deepEqual(r, { ok: true, towns: [[MAP, share]] }, 'the law\'s share; the old day and the small town left out');
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(3003, t, 'raid', 30);
  assert.deepEqual((await s.econ(g)).body.towns.map(([m]) => m), [MAP], 'kept');
  _now += TOWN_ECON_KEPT_S;
  assert.deepEqual((await s.econ(g)).body.towns.map(([m]) => m), [3003, MAP], 'read again past the keeping');
  // AUDIT TOWN-ECON 2 SVC-3: THE CLOCK KEEPS THE SHARES - counted once into one row, which every isolate reads
  assert.ok(MINUTE_JOBS.some(([name]) => name === 'town-shares'));
  await runCron(s.env, { cron: CRON_MINUTE, nowS: _now });
  const kept = s.raw.prepare('SELECT at, towns FROM town_econ_kept WHERE id = 1').get();
  assert.deepEqual([Number(kept.at), JSON.parse(kept.towns).map(([m]) => m)], [_now, [3003, MAP]]);
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?)').run(4004, t, 'raid', 30);
  _now += TOWN_ECON_ISOLATE_S;
  assert.deepEqual((await s.econ(g)).body.towns.map(([m]) => m), [3003, MAP], 'the kept row read - the days themselves not');
  await runCron(s.env, { cron: CRON_MINUTE, nowS: _now });
  assert.equal(JSON.parse(s.raw.prepare('SELECT towns FROM town_econ_kept WHERE id = 1').get().towns).length, 2, 'fresh: not counted again');
  _resetTownEconForTests();   // another isolate's clock: the row itself says it is fresh
  await runCron(s.env, { cron: CRON_MINUTE, nowS: _now });
  assert.equal(JSON.parse(s.raw.prepare('SELECT towns FROM town_econ_kept WHERE id = 1').get().towns).length, 2, 'fresh by the row: not counted again');
  _now += TOWN_ECON_KEPT_S;
  await runCron(s.env, { cron: CRON_MINUTE, nowS: _now });
  _now += TOWN_ECON_ISOLATE_S;
  assert.deepEqual((await s.econ(g)).body.towns.map(([m]) => m), [3003, 4004, MAP], 'counted again a keeping later');
  // REC-10: "one or more" - five footsteps today a share of 0.97, shown 1.0, are answered; four (0.8) are not
  _resetTownEconForTests();
  s.raw.prepare('DELETE FROM town_econ_kept').run();
  s.raw.prepare('DELETE FROM town_econ_days').run();
  s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, ?), (?, ?, ?, ?)').run(5005, t, 'watch', 5, 6006, t, 'watch', 4);
  assert.deepEqual((await s.econ(g)).body.towns, [[5005, 1]], 'the least share answered, and under it not');
});

test('AUDIT TOWN-ECON 2 the registry\'s defences (SVC-1): a report goes with a Watch tick of the reporter\'s at the town\'s pixel - none, another\'s, another pixel\'s or an unsigned one is refused; a developer strikes a false town (its row, reports, acts and days) and its map id is never witnessed again, the true town then confirmed; the audit names a region\'s towns and who confirmed them; neither is anyone else\'s; the switch shuts the doors (SVC-7) (mutants: TOWNECON-AUDIT2-SVC1-unwalked, TOWNECON-AUDIT2-SVC1-another-pixel, TOWNECON-AUDIT2-SVC1-strike-kept, TOWNECON-AUDIT2-SVC1-struck-again, TOWNECON-AUDIT2-SVC1-strike-anyone, TOWNECON-AUDIT2-SVC7-switch)', async () => {
  _now = T0;
  const s = await stand();
  const a = await s.aged('Ada'), b = await s.aged('Bel');
  assert.equal((await s.witness(a, TOWN, null)).body.error, 'town-unwalked', 'no tick');
  assert.equal((await s.witness(a, TOWN, await s.tick(b))).body.error, 'town-unwalked', 'another account\'s tick');
  assert.equal((await s.witness(a, TOWN, await s.tick(a, TOWN.px + 1, TOWN.py))).body.error, 'town-unwalked', 'another pixel\'s');
  assert.equal((await s.witness(a, TOWN, (await s.tick(a)).replace(/\.[^.]+$/, '.'))).body.error, 'town-unwalked', 'unsigned');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'town'").get().n, 0, 'nothing written');
  // a false town at Daggerfall's pixel and place, confirmed first
  const FALSE = { ...TOWN, map: pixelMap(TOWN.px, TOWN.py, 9) };
  await s.confirm(FALSE);
  const w = await s.seated('Walker');
  assert.equal((await s.watch(w, [await s.tick(w)])).body.counted, 1);
  assert.deepEqual(s.acts(w), [{ map: FALSE.map, day: today(), src: 'watch', n: 1 }], 'its footsteps the false town\'s');
  let last = null;
  for (const h of ['Fen', 'Gus', 'Hal']) last = (await s.witness(await s.aged(h))).body;
  assert.equal(last.why, 'taken', 'the true town kept off its pixel');
  // the audit and the strike - a developer's
  const dev = await s.aged('Devi');
  assert.equal((await s.call('/v1/towns/audit', { region: DF }, a.secret)).body.error, 'not-developer');
  assert.equal((await s.call('/v1/towns/strike', { map: FALSE.map }, a.secret)).body.error, 'not-developer');
  const audit = (await s.call('/v1/towns/audit', { region: DF }, dev.secret)).body;
  assert.deepEqual(audit.towns.map((t) => [t.map, t.px, t.py, t.location, t.by.length]), [[FALSE.map, TOWN.px, TOWN.py, TOWN.location, 3]]);
  assert.equal((await s.call('/v1/towns/strike', { map: 0 }, dev.secret)).body.error, 'bad-town');
  const struck = (await s.call('/v1/towns/strike', { map: FALSE.map }, dev.secret)).body;
  assert.deepEqual(struck, { ok: true, map: FALSE.map, reports: 3 });
  assert.deepEqual([s.raw.prepare('SELECT COUNT(*) AS n FROM town_econ_towns').get().n, s.acts(w), s.days()], [0, [], []], 'its row, acts and days gone');
  assert.equal((await s.witness(await s.aged('Ivo'), FALSE)).body.why, 'struck', 'never witnessed again');
  await s.confirm();
  assert.deepEqual({ ...s.raw.prepare('SELECT map FROM town_econ_towns').get() }, { map: MAP }, 'the true town stands');
  // the switch
  const shut = await stand({ TOWNS_OPEN: 'off' });
  const g = await shut.guest();
  const r = await shut.econ(g);
  assert.deepEqual([r.status, r.body.error], [403, 'towns-closed']);
  assert.equal(shut.raw.prepare("SELECT COUNT(*) AS n FROM town_econ_kept").get().n, 0);
  await runCron(shut.env, { cron: CRON_MINUTE, nowS: _now });
  assert.equal(shut.raw.prepare("SELECT COUNT(*) AS n FROM town_econ_kept").get().n, 0, 'the clock counts nothing shut');
});

test('TOWN-ECON TE2 trade: a sale at a trader counts at its town for its buyer, under the day\'s cap; a buyer under a week registered, and a sale on a board, count nothing; a patron\'s purchase counts for the trader\'s seller (mutants: TOWNECON2-trade-gold, TOWNECON2-trade-young, TOWNECON2-patron)', async () => {
  _now = T0;
  const s = await stand();
  const eve = await s.seated('Eve', { items: goods(3).map(plain) });
  const tom = await s.seated('Tom', { goldPieces: 1000 });
  const kid = await s.seated('Kid', { goldPieces: 1000 }, { old: false });
  s.home(eve);
  const sell = async () => { const l = await s.list(eve); assert.equal(l.status, 200, JSON.stringify(l.body)); return (await s.call('/v1/market/vendor', { vendor: VENDOR }, tom.secret)).body.rows.at(-1); };
  const b1 = await s.buy(tom, await sell());
  assert.equal(b1.status, 200, JSON.stringify(b1.body));
  assert.deepEqual(s.acts(tom), [{ map: MAP, day: today(), src: 'trade', n: 1 }], 'the buyer\'s act at the trader\'s town');
  assert.deepEqual(s.days(), [{ map: MAP, day: today(), src: 'trade', n: 1 }]);
  assert.equal((await s.buy(kid, await sell())).status, 200);
  assert.deepEqual(s.acts(kid), [], 'a young buyer counts nothing');
  // the cap, by the table's own guard
  s.raw.prepare('UPDATE town_econ_acts SET n = ? WHERE account = ?').run(TOWN_ECON_CAPS.trade, tom.id);
  assert.equal((await s.buy(tom, await sell())).status, 200);
  assert.deepEqual(s.acts(tom)[0].n, TOWN_ECON_CAPS.trade);
  assert.deepEqual(s.days(), [{ map: MAP, day: today(), src: 'trade', n: 1 }], 'a capped act moves no day');
  // both currencies' batches carry it, and the patron's
  const m = rd('server-account/src/market.js');
  assert.equal((m.match(/\.\.\.tradeActStatements\(db, player, nowS, vend\?\.map \?\? null, 'EXISTS \(SELECT 1 FROM market_sales WHERE buyer = \?6 AND rid = \?7 AND n = \?8\)', \[me, rid, nonce\]\)/g) ?? []).length, 2);
  assert.match(m, /\.\.\.patronActStatements\(db, l\.seller, map, day\),/);
});

test('TOWN-ECON TE2 a patron\'s purchase counts at its town for the trader\'s seller, on the hour\'s own day (mutants: TOWNECON2-patron)', async () => {
  _now = T0;
  const s = await stand();
  const eve = await s.seated('Eve', { items: goods(8).map(plain) });
  s.home(eve);
  for (let i = 0; i < 8; i++) {
    const item = s.record(eve).save.items[0];
    const price = Math.max(1, Math.floor(patronCap(patronWorth(item, itemWorth)) * 0.45));
    const r = await s.call('/v1/market/list', { character: eve.character, region: DF, kind: 'item', item: validLootList([item])?.[0] ?? null, pick: 0, price, hubs: HUBS, rid: rid(), currency: 'gold', realm: eve.at(), vendor: VENDOR }, eve.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  _now = T0 + 40 * 3600;
  assert.equal((await s.call('/v1/market/vendor', { vendor: VENDOR }, eve.secret)).status, 200);
  const sales = s.raw.prepare('SELECT day, COUNT(*) AS n FROM market_patron_sales GROUP BY day ORDER BY day').all();
  assert.ok(sales.length >= 1, 'the patrons bought');
  const want = sales.map((r) => ({ map: MAP, day: Number(r.day), src: 'trade', n: Math.min(TOWN_ECON_CAPS.trade, Number(r.n)) }));
  assert.deepEqual(s.raw.prepare('SELECT map, day, src, n FROM town_econ_acts WHERE account = ? ORDER BY day').all(eve.id).map((r) => ({ ...r })), want);
});

test('TOWN-ECON TE2 a raid driven off counts at the confirmed town its key names, for the account that claims it - one a town a day, a young account none, a town not confirmed none (mutants: TOWNECON2-raid, TOWNECON2-raid-young, TOWNECON2-raid-cap)', async () => {
  _now = T0;
  const s = await stand();
  const hero = await s.seated('Hero');
  const raid = async (who, key) => s.call('/v1/raid/claim', {
    receipt: await mintRaidReceipt({ w: key, s: who.id, c: 777, y: 2 }, s.gateKey, { subtle, nowS: _now }), character: who.character, name: who.handle,
  }, who.secret);
  const r0 = await raid(hero, `${DF}:${TOWN.location}:1000`);
  assert.equal(r0.status, 200, JSON.stringify(r0.body));
  assert.deepEqual(s.acts(hero), [], 'no town confirmed at that place');
  await s.confirm();
  assert.equal((await raid(hero, `${DF}:${TOWN.location}:1001`)).body.recorded, true);
  assert.deepEqual(s.acts(hero), [{ map: MAP, day: today(), src: 'raid', n: 1 }]);
  assert.deepEqual(s.days(), [{ map: MAP, day: today(), src: 'raid', n: 1 }]);
  assert.equal((await raid(hero, `${DF}:${TOWN.location}:1002`)).body.recorded, true);
  assert.deepEqual(s.days(), [{ map: MAP, day: today(), src: 'raid', n: TOWN_ECON_CAPS.raid }], 'one a town a day');
  const kid = await s.seated('Kid', {}, { old: false });
  assert.equal((await raid(kid, `${DF}:${TOWN.location}:1003`)).body.recorded, true);
  assert.deepEqual(s.acts(kid), [], 'a young account none');
});

test('TOWN-ECON TE2 the sweep: a town\'s days and its accounts\' acts go once past the days the share weighs, and AUDIT TOWN-ECON 2 SVC-5 the ticks seen once past a receipt\'s life, in the hourly clock (mutants: TOWNECON2-sweep-days, TOWNECON-AUDIT2-SVC5-seen-kept)', async () => {
  _now = T0;
  const s = await stand();
  const w = await s.aged('Walker');
  const t = today();
  for (const d of [t, t - TOWN_ECON_DAYS + 1, t - TOWN_ECON_DAYS]) {
    s.raw.prepare('INSERT INTO town_econ_days (map, day, src, n) VALUES (?, ?, ?, 1)').run(MAP, d, 'watch');
    s.raw.prepare('INSERT INTO town_econ_acts (account, map, day, src, n) VALUES (?, ?, ?, ?, 1)').run(w.id, MAP, d, 'watch');
    s.raw.prepare('INSERT INTO town_econ_seen (ref, day) VALUES (?, ?)').run(`r${d}`, d);
  }
  assert.ok(HOUR_JOBS.some(([name]) => name === 'town-econ'));
  await runCron(s.env, { cron: CRON_HOUR, nowS: _now });
  for (const table of ['town_econ_days', 'town_econ_acts']) {
    assert.deepEqual(s.raw.prepare(`SELECT day FROM ${table} ORDER BY day`).all().map((r) => r.day), [t - TOWN_ECON_DAYS + 1, t], table);
  }
  // AUDIT TOWN-ECON 2 SVC-5: a tick seen is kept a receipt's life and a day - an older one is refused by its own expiry
  assert.deepEqual(s.raw.prepare('SELECT day FROM town_econ_seen ORDER BY day').all().map((r) => r.day), [t], 'town_econ_seen');
  s.raw.prepare('INSERT INTO town_econ_seen (ref, day) VALUES (?, ?), (?, ?)').run('r-3', t - 3, 'r-4', t - 4);
  _now += 3600;
  await runCron(s.env, { cron: CRON_HOUR, nowS: _now });
  assert.deepEqual(s.raw.prepare('SELECT day FROM town_econ_seen ORDER BY day').all().map((r) => r.day), [t - 3, t], 'the receipt\'s two days and a day\'s skew kept');
});
