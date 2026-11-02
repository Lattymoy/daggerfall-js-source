// AUDIT GATHER (2026-10-26; bible/06-Systems/Professions-Arc.md section 55): THE AUDIT'S SERVICE PINS, driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs), each failing on the code before its fix.
//   F2 - a Motherlode is struck only once it has risen on the SERVICE's clock: the act's end is the client's word, allowed
//        HARVEST_EARLY_S past the service's now, and a strike sent early took a slot before any honest client saw it.
//   F3 - a school's fish on the account's first SCHOOL_HAULS_DAY hauls of the day alone: CAP-OFF lifted the forty from the
//        hauls, and with it the only bound on the client's word that its cast landed in a school.
// The client's pins are test/systems/auditgather.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { xpForRank, glintsMax, SCHOOL_HAULS_DAY } from '../../src/net/professionLaw.js';
import { haulKey } from '../../src/net/nodeLaw.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { MOTHERLODE_RANK, MOTHERLODE_TIER } from '../../src/net/motherlodeLaw.js';

const { subtle } = globalThis.crypto;
const DAY = 86_400, DAY0 = utcDay(T0);
const realNow = Date.now;
let _now = DAY0 * DAY + 60;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = (p) => `${p}-${String(++_rid).padStart(6, '0')}`;

/** Every die the service rolls at nought for `fn`'s length: every chance hits, every roll its least. */
async function zeroDice(fn) {
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  globalThis.crypto.getRandomValues = (b) => { if (b.byteLength === 4) { b.fill(0); return b; } return real(b); };
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = real; }
}

test('AUDIT GATHER F2: a Motherlode is struck only once it has risen on the service\'s clock - thirty seconds before, an act\'s end claimed thirty seconds ahead is refused and takes no slot; risen, the same strike lands (mutants: the service\'s clock unread at the door; at the strike\'s insert)', async () => {
  clock(DAY0 * DAY + 60);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const M = CLIMATES.Mountain;
  const wit = [await s.seated('Wita'), await s.seated('Witb'), await s.seated('Witc')];
  for (let i = 0; i < 6; i++) for (const w of wit) raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)').run('pixel', `${200 + i},80`, w.id, `${M},21`, 21, DAY0 * DAY - 3600);
  const ann = await s.seated('Ann');
  raw.prepare("INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'mining', ?, ?)").run(ann.id, ann.character, xpForRank(MOTHERLODE_RANK), _now);
  const lode = (await s.call('/v1/prof/motherlodes', { character: ann.character }, ann.secret)).body.lodes[0];
  const strike = async (at) => {
    const watch = await mintWatchReceipt({ s: ann.id, x: lode.x, y: lode.y, c: 4242 }, s.gateKey, { subtle, nowS: _now });
    return s.call('/v1/prof/harvest', { character: ann.character, node: lode.key, kind: 'ore', act: { glints: glintsMax(MOTHERLODE_TIER), clean: true }, at, rid: rid('mlode'), watch }, ann.secret);
  };
  clock(lode.opensAt - 30);
  assert.equal((await strike(_now - 2)).body.error, 'motherlode-closed', 'an honest act before it rises');
  const early = await strike(_now + 30);
  assert.equal(early.body.error, 'motherlode-closed', `an act's end claimed past the rise, on the service's clock before it: ${JSON.stringify(early.body)}`);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM motherlode_strikes WHERE player = ?').get(ann.id).n, 0, 'no slot taken');
  clock(lode.opensAt + 1);   // AUDIT LOCKPICK D5: a second past the rise - the bound is the rise itself
  const risen = await strike(_now);
  assert.equal(risen.body.ok, true, JSON.stringify(risen.body));
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM motherlode_strikes WHERE player = ?').get(ann.id).n, 1);
});

test('AUDIT GATHER F3: a school\'s fish on the account\'s first SCHOOL_HAULS_DAY SCHOOLS of the day - forty plain hauls take nothing from the bound (AUDIT LOCKPICK D2), the fortieth school counted, the forty-first not; every haul still credited (CAP-OFF) (mutants: the bound unread; one school over; every haul counted)', async () => {
  const NOON = DAY0 * DAY + 12 * 3600;
  clock(NOON);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const mac = await s.seated('Mac');
  let id = 0;
  const haul = (act) => s.call('/v1/prof/harvest', {
    character: mac.character, node: haulKey({ x: 300 + (id % 5), y: 200, day: utcDay(NOON), id: (++id).toString(16).padStart(12, '0') }), kind: 'fish', climate: CLIMATES.Woodlands, region: 17, act, at: NOON - 2, rid: rid('fish'),
  }, mac.secret);
  assert.equal(SCHOOL_HAULS_DAY, 40);
  for (let i = 0; i < 41; i++) assert.equal((await haul({ clean: false })).status, 200);
  const honest = await zeroDice(() => haul({ clean: true, school: 1 }));
  assert.deepEqual([honest.body.hauls, honest.body.qty], [42, 3], 'forty-one plain hauls, then the day\'s first school: one x1.5, its fraction the dice\'s nought, and the school\'s one');
  for (let i = 0; i < SCHOOL_HAULS_DAY - 2; i++) assert.equal((await zeroDice(() => haul({ clean: true, school: 1 }))).body.qty, 3, `school ${i + 2}`);
  const fortieth = await zeroDice(() => haul({ clean: true, school: 1 }));
  assert.equal(fortieth.body.qty, 3, 'the fortieth school counted');
  const past = await zeroDice(() => haul({ clean: true, school: 1 }));
  assert.deepEqual([past.status, past.body.qty], [200, 2], 'credited, the full net\'s step, and no school');
  assert.equal(s.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM node_harvests WHERE player = ? AND school = 1').get(mac.id).n, SCHOOL_HAULS_DAY, 'the rows say which took a school');
});
