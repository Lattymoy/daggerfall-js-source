// SUMMON-REPAIR (2026-10-15; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md SUMMON-OFFER; Mac, asked how to mend the
// reporter's save: "Operator tool"). SUMMON-OFFER stops a summoning whose quest cannot be made from taking the gold and
// setting the prince's Summoned flag - but the reporter's save already holds both: faction 8's flags at 65 (FACTION.TXT's
// 0x01 and Summoned, 0x40), 100,000 gold gone. Nothing in a save tells that flag from one a refused offer set, so staff
// mend the one character: the review's `repair` act (server-account/src/review.js, net/repairLaw.js).
//
// Over HTTP against the real Worker and the real migrations (test/accountDb.mjs), a realm character seated as the realm
// makes one (test/realmSeat.mjs), and the playing tab's own session and join (systems/realmSaves.js):
//   - the repair clears the bit and gives the gold back, as a letter of credit, witnessed, written down as staff's act;
//   - the same ticket again moves nothing;
//   - nobody but a developer is heard, and a repair the law refuses writes nothing;
//   - the tab playing the character cannot write over it, and its next join plays the mended record;
//   - the operator's command, as tools/realmReview.mjs builds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { realmIo, createRealmSession, openRealmBoot } from '../../src/systems/realmSaves.js';
import { realmLetterOfCredit } from '../../src/net/realm/realmGoldLaw.js';
import { FACTION_FLAGS } from '../../src/formats/factionFile.js';
import { REPAIR_GOLD_MAX } from '../../src/net/repairLaw.js';
import { reviewRequest } from '../../tools/realmReview.mjs';

const HERMAEUS = 8;
const TICKET = 'fb1014-summon-offer';
/** The reporter's record, as save.js snapshotFactionRep writes it: Hermaeus Mora's flags 65, the Mages Guild's 0. */
const stuck = () => ({
  name: 'Sucean', level: 12, goldPieces: 350, items: [],
  factionRep: { ids: [HERMAEUS, 40], rep: [0, 10], flags: [0x41, 0], power: [50, 40] },
});

/** A device's storage - the session (SESSION_KEY) and whatever the realm's rescue copy writes. */
function deviceOf(who) {
  const m = new Map([[SESSION_KEY, JSON.stringify({ secret: who.secret, id: who.id })]]);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _map: m };
}

async function stand() {
  const s = await standService({ DEVELOPER_HANDLES: 'mac' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('mac');
  const sucean = await s.registered('sucean');
  const R = await seatRealm(s.env, sucean.secret, 'Sucean', stuck());
  sucean.character = R.id;
  sucean.at = R.at;
  const row = () => raw.prepare('SELECT seq, obj, lease, witnessed, svc_seq FROM realm_characters WHERE id = ?').get(R.id);
  const record = () => JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row().obj)));
  const repair = (body, secret = mac.secret) => s.call('/v1/mod/realm-repair', { id: R.id, ticket: TICKET, faction: HERMAEUS, flag: FACTION_FLAGS.Summoned, gold: 100_000, note: 'SUMMON-OFFER, Dak\'fron', ...body }, secret);
  const repairs = () => raw.prepare('SELECT ticket, faction, flag, was, gold, seq, by_handle, note FROM realm_repairs WHERE char_id = ?').all(R.id).map((r) => ({ ...r }));
  const findings = () => raw.prepare("SELECT kind, detail FROM realm_findings WHERE char_id = ? AND kind = 'staff'").all(R.id).map((f) => JSON.parse(f.detail));
  const faucet = () => raw.prepare("SELECT COALESCE(SUM(gold), 0) AS gold, COALESCE(SUM(n), 0) AS n FROM realm_faucets WHERE kind = 'repair'").get();
  const faucetPlain = () => ({ ...faucet() });
  return { s, raw, mac, sucean, R, row, record, repair, repairs, findings, faucet: faucetPlain };
}

test('SUMMON-REPAIR: a developer\'s repair clears the Summoned bit on Hermaeus Mora\'s faction and gives the 100,000 back as the game\'s letter of credit - the record one sequence on, its seat taken, the gold witnessed and the service\'s own faucet, the act written down (mutants: the bit kept; the gold as coin; the seat kept; the gold unwitnessed; no finding)', async () => {
  const t = await stand();
  const before = t.row();
  const r = await t.repair({});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, repeat: false, ticket: TICKET, seq: before.seq + 1, faction: HERMAEUS, flag: 0x40, was: 0x41, cleared: true, gold: 100_000, by: 'mac', at: r.body.at });
  const rec = t.record();
  assert.deepEqual(rec.factionRep.flags, [0x01, 0], 'Summoned cleared - FACTION.TXT\'s own 0x01 kept, the other faction untouched');
  assert.deepEqual(rec.items, [realmLetterOfCredit(100_000)], 'the gold back as the game\'s letter, which weighs nothing');
  assert.equal(rec.goldPieces, 350, 'the purse as it was');
  const after = t.row();
  assert.deepEqual([after.seq, after.svc_seq, after.lease], [before.seq + 1, before.seq + 1, null], 'one sequence on, a service move, the seat taken from any tab');
  assert.equal(after.witnessed - before.witnessed, 100_000, 'witnessed: the judge charges no gain the service made');
  assert.deepEqual(t.repairs(), [{ ticket: TICKET, faction: HERMAEUS, flag: 0x40, was: 0x41, gold: 100_000, seq: before.seq + 1, by_handle: 'mac', note: 'SUMMON-OFFER, Dak\'fron' }]);
  assert.deepEqual(t.findings().map((f) => [f.act, f.by, f.ticket, f.faction, f.flag, f.was, f.gold, f.from, f.to]), [['repair', 'mac', TICKET, HERMAEUS, 0x40, 0x41, 100_000, before.seq, before.seq + 1]]);
  assert.deepEqual(t.faucet(), { gold: 100_000, n: 1 }, 'the refund is the service\'s own faucet, named');
});

test('SUMMON-REPAIR: the same ticket again is the repair it was - answered again, nothing moved: no second letter, no second sequence, no second faucet; a ticket is the character\'s, so the key is the pair (mutants: the ticket unread; the row out of the batch)', async () => {
  const t = await stand();
  const first = await t.repair({});
  assert.equal(first.status, 200);
  const once = { row: t.row(), rec: t.record(), faucet: t.faucet() };
  const again = await t.repair({ note: 'asked twice' });
  assert.equal(again.status, 200);
  assert.deepEqual({ ...again.body, at: 0 }, { ...first.body, repeat: true, at: 0 }, 'the first repair\'s answer, marked a repeat');
  assert.deepEqual([t.row().seq, t.row().obj], [once.row.seq, once.row.obj], 'the record did not move');
  assert.deepEqual(t.record(), once.rec, 'one letter, the bit as the repair left it');
  assert.deepEqual(t.faucet(), once.faucet);
  assert.equal(t.repairs().length, 1);
  assert.equal(t.findings().length, 1, 'one act written down');
  // asked twice at once: one lands; the other finds its row, or meets the ticket's key in its batch and answers the row
  const t2 = await stand();
  const both = await Promise.all([t2.repair({}), t2.repair({})]);
  assert.deepEqual(both.map((b) => b.status), [200, 200]);
  assert.deepEqual(both.map((b) => b.body.repeat).sort(), [false, true]);
  assert.deepEqual(t2.record().items, [realmLetterOfCredit(100_000)], 'once');
});

test('SUMMON-REPAIR: only a developer is heard - the player whose character it is and any other are refused (403), no session is 401 - and a repair the law refuses writes nothing: a bit FactionFile does not name, gold past the bound or below nothing, no faction, a ticket of no shape (400); a faction the record does not hold (409 repair-no-faction), a bit its faction does not carry (409 repair-not-set - the wrong character mended never); the dead (409) (mutants: the developer gate; the flag law; the bound; the faction looked for nowhere; the bit not asked)', async () => {
  const t = await stand();
  const before = { row: t.row(), rec: t.record() };
  const nothingMoved = (why) => {
    assert.deepEqual([t.row().seq, t.row().obj], [before.row.seq, before.row.obj], `${why}: the record did not move`);
    assert.deepEqual(t.record(), before.rec, why);
    assert.deepEqual([t.repairs().length, t.findings().length, t.faucet().gold], [0, 0, 0], why);
  };
  const own = await t.repair({}, t.sucean.secret);
  assert.deepEqual([own.status, own.body.error], [403, 'not-developer'], 'not the player\'s own to mend');
  const rando = await t.s.registered('rando');
  assert.equal((await t.repair({}, rando.secret)).status, 403);
  assert.equal((await t.repair({}, null)).status, 401);
  nothingMoved('refused callers');
  for (const [why, body] of [
    ['a bit FactionFile does not name', { flag: 0x20 }],
    ['two bits at once', { flag: 0x50 }],
    ['gold past the bound', { gold: REPAIR_GOLD_MAX + 1 }],
    ['gold below nothing', { gold: -1 }],
    ['gold not whole', { gold: 0.5 }],
    ['no faction', { faction: 0 }],
    ['a ticket of no shape', { ticket: 'Sucean Summon' }],
  ]) {
    const r = await t.repair(body);
    assert.deepEqual([r.status, r.body.error], [400, 'body'], why);
  }
  nothingMoved('refused repairs');
  const absent = await t.repair({ faction: 9 });
  assert.deepEqual([absent.status, absent.body.error], [409, 'repair-no-faction'], 'Sheogorath is no faction this record holds');
  nothingMoved('a faction the record does not hold');
  const unset = await t.repair({ faction: 40 });
  assert.deepEqual([unset.status, unset.body.error], [409, 'repair-not-set'], 'the Mages Guild carries no Summoned bit: a repair aimed wrong gives nothing');
  nothingMoved('a bit that is not set');
  assert.equal((await t.s.call('/v1/mod/realm-repair', { id: 'r00000000000000000000', ticket: TICKET, faction: 8, flag: 0x40, gold: 1 }, t.mac.secret)).status, 404);
  t.raw.prepare('UPDATE realm_characters SET dead_at = 1 WHERE id = ?').run(t.R.id);
  const dead = await t.repair({});
  assert.deepEqual([dead.status, dead.body.error], [409, 'dead']);
  nothingMoved('the dead');
});

test('SUMMON-REPAIR: the tab playing the character sees it - its next checkpoint (the stuck save, flag and all) is refused and it goes offline, the copy its device keeps follows a sequence the record has left, so the next join drops it and plays the mended record; the old save is never written over the repair (mutants: the seat kept; the copy played)', async () => {
  const t = await stand();
  const device = deviceOf(t.sucean);
  const io = realmIo({ fetch: t.s.fetch, storage: device });
  const at = t.sucean.at();
  let lost = null;
  const session = createRealmSession({ io, id: at.id, lease: at.lease, seq: at.seq, onLost: (why) => { lost = why; }, later: () => () => {}, hidden: () => false, watchHidden: () => {} });
  // the tab plays on: a checkpoint lands before the repair
  const playing = { ...stuck(), goldPieces: 360 };
  assert.deepEqual(await session.checkpoint(JSON.stringify(playing)), { ok: true, seq: at.seq + 1 });
  // the operator mends it while the tab plays
  assert.equal((await t.repair({})).status, 200);
  const mended = t.record();
  // the tab's next save still carries the flag and none of the gold: refused, the session lost
  const stale = await session.checkpoint(JSON.stringify({ ...playing, goldPieces: 370 }));
  assert.deepEqual(stale, { ok: false, error: 'lease' });
  assert.equal(lost, 'lease', 'the tab is told its character is not its to write');
  assert.deepEqual(t.record(), mended, 'the stale save never landed');
  assert.ok(device.getItem('dagger.realm.unsent.' + at.id), 'the device kept its copy for the next join to decide');
  // the next join: the copy follows the sequence before the repair - dropped; the mended record is the one played
  const join = await openRealmBoot({ io: realmIo({ fetch: t.s.fetch, storage: device }), id: at.id });
  assert.equal(join.ok, true, JSON.stringify(join));
  assert.notEqual(join.restored, true, 'not the device\'s copy');
  assert.equal(device.getItem('dagger.realm.unsent.' + at.id), null, 'the copy is gone');
  assert.deepEqual(join.snap.factionRep.flags, [0x01, 0], 'Hermaeus Mora summoned no more: his quest may be offered again');
  assert.deepEqual(join.snap.items, [realmLetterOfCredit(100_000)], 'and the 100,000 in the pack');
  assert.equal(join.snap.goldPieces, 360, 'what landed before the repair kept');
  assert.equal(join.seq, t.row().seq, 'the join plays at the record\'s sequence, the repair\'s');
});

test('SUMMON-REPAIR: the operator\'s command - `characters <handle>` finds the id through the same developer gate, and `repair <id> <ticket> <faction> <flag> <gold> [note]` builds the act, the flag by its hex, its number or its FactionFile name; a typo is refused by the tool before it is sent (mutants: the flag read as decimal; the gold unchecked)', async () => {
  const t = await stand();
  const look = reviewRequest(['characters', 'Sucean']);
  assert.deepEqual(look, { path: '/v1/mod/realm-characters', body: { name: 'Sucean' } });
  const found = await t.s.call(look.path, look.body, t.mac.secret);
  assert.equal(found.status, 200);
  assert.deepEqual(found.body.player.handle, 'sucean');
  assert.deepEqual(found.body.characters.map((c) => [c.id, c.name, c.dead]), [[t.R.id, 'Sucean', false]]);
  assert.equal((await t.s.call(look.path, look.body, t.sucean.secret)).status, 403, 'the same gate');
  assert.equal((await t.s.call(look.path, { name: 'nobody' }, t.mac.secret)).status, 404);
  for (const flag of ['0x40', '64', 'Summoned']) {
    assert.deepEqual(reviewRequest(['repair', t.R.id, TICKET, '8', flag, '100000', 'SUMMON-OFFER,', 'Dak\'fron']), {
      path: '/v1/mod/realm-repair', body: { id: t.R.id, ticket: TICKET, faction: 8, flag: 0x40, gold: 100_000, note: 'SUMMON-OFFER, Dak\'fron' },
    }, flag);
  }
  for (const bad of [['0x20', '100000'], ['40', '100000'], ['0x40', '1000001'], ['0x40', '-5'], ['0x40', '1e5']]) {
    assert.ok('usage' in reviewRequest(['repair', t.R.id, TICKET, '8', ...bad]), bad.join(' '));
  }
  // the command as built is the act the service takes
  const req = reviewRequest(['repair', t.R.id, TICKET, '8', '0x40', '100000']);
  const done = await t.s.call(req.path, req.body, t.mac.secret);
  assert.deepEqual([done.status, done.body.cleared, t.record().factionRep.flags[0]], [200, true, 0x01]);
});
