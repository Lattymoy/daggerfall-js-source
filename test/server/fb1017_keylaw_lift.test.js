// FIELD BUGS 2026-10-17 (KEY-LAW) - slick, the hour the Elite Breach went live: "Playing a new character I made last
// night and it's flagged by the new key thing". Item law 7 is the account service's judge (judge.js JUDGE_VERSION), and
// it knows the Weir Key's row headless (src/systems/eliteGates/weirKeyRow.js) - so a checkpoint carrying a key holds
// nothing; and migration 0125 lifts what law 6 laid on such characters alone - the hold, a timed hold, the strikes -
// written as a staff act, leaving staff's holds, other findings' holds and `law_sig` as they were.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { JUDGE_VERSION } from '../../server-account/src/judge.js';
import { LAW_HOLD_S } from '../../server-account/src/verdict.js';
import { WEIR_KEY_LAW_ROW } from '../../src/systems/eliteGates/weirKeyRow.js';

/** A Weir Key stack as the client mints it (systems/eliteGates/weirKey.js weirKeys) - written out, since this process
 *  must not import the key's home: the service never does, and the registry would answer for the row. */
const keys = (n) => ({ group: 'UselessItems2', templateIndex: WEIR_KEY_LAW_ROW.index, name: 'Weir Key', value: 500, maxCondition: 1000, currentCondition: 1000, stackCount: n });

async function stand() {
  const now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService();
  const raw = s.env.DB._raw;
  const seat = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    return { who, R };
  };
  const put = async ({ who, R }, items) => {
    const at = R.at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1), 'x-realm-summary': JSON.stringify({ level: 1 }) },
      body: JSON.stringify(freshSave({ name: who.handle, items })),
    }), s.env);
    assert.equal(res.status, 200);
    return res.json();
  };
  const row = (id) => ({ ...raw.prepare('SELECT held, held_at, held_until, strikes, law_holds, law_at, law_sig, judge_rev FROM realm_characters WHERE id = ?').get(id) });
  const findings = (id, kind) => raw.prepare('SELECT detail FROM realm_findings WHERE char_id = ? AND kind = ? ORDER BY id').all(id, kind).map((r) => JSON.parse(r.detail));
  return { ...s, raw, seat, put, row, findings, done: () => { Date.now = realNow; } };
}

test('KEY-LAW judge: the report, answered - a checkpoint carrying Weir Keys holds nothing and finds nothing, as the service loads the law; law 7 (mutants: the row unread; the law unmoved)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('keyed');
    assert.equal((await s.put(A, [keys(3)])).tradeHeld ?? null, null);
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).strikes, s.findings(A.R.id, 'law')], [null, 0, []]);
    assert.equal(JUDGE_VERSION, 9);   // PIN MOVED (SOUL-LAW, FIELD BUGS 2026-10-20h): law 9 - a soul of Daggerfall Enemy Expansion's fifty lawful in a Soul Gem or Azura's Star; PIN MOVED (WITCH1): law 8 - the Soul Cake and the Hearth Offering known too; the Weir Key from law 7 on
  } finally { s.done(); }
});

test('KEY-LAW migration 0125: a hold, a timed hold and strikes law 6 laid on Weir Keys alone lifted, written as a staff act; a staff hold, a hold with any other finding, and a finding past its kept list untouched; `law_sig` kept (mutants: the code; the template; the count guard; staff\'s)', async () => {
  const s = await stand();
  try {
    const seats = {};
    for (const h of ['timed', 'plain', 'gone', 'other', 'sworn', 'cut', 'tpl', 'none']) seats[h] = await s.seat(`kl${h}`);
    const law6 = (t = 575) => [{ code: 'template', list: 0, at: 0, t }];
    const find = (c, detail, at = T0 - 3600) => s.raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 6, 'law', ?)").run(c.who.id, c.R.id, at, JSON.stringify(detail));
    const set = (c, f) => s.raw.prepare('UPDATE realm_characters SET held = ?, held_at = ?, held_until = ?, strikes = ?, law_holds = ?, law_at = ?, law_sig = ? WHERE id = ?')
      .run(f.held ?? null, f.held ? 777 : null, f.until ?? null, f.strikes ?? 0, f.served ?? 0, f.at ?? null, f.sig ?? null, c.R.id);
    const SIG = 'template:575';
    // a third strike AUTO-HOLD made a week's hold of; the keys still carried
    set(seats.timed, { held: 'law', until: T0 + LAW_HOLD_S, served: 1, at: T0 + LAW_HOLD_S, sig: SIG });
    find(seats.timed, { count: 1, findings: law6() }); find(seats.timed, { count: 2, findings: [...law6(), ...law6()] });
    // the plain law hold, one strike - the report
    set(seats.plain, { held: 'law', strikes: 1, at: T0 - 3600, sig: SIG }); find(seats.plain, { count: 1, findings: law6() });
    // the keys staked or spent, the strike standing
    set(seats.gone, { strikes: 1, at: T0 - 3600 }); find(seats.gone, { count: 1, findings: law6() });
    // a finding of another kind among them: the law's hold stands
    set(seats.other, { held: 'law', strikes: 1, at: T0 - 3600, sig: 'gold:' }); find(seats.other, { count: 1, findings: law6() }); find(seats.other, { count: 1, findings: [{ code: 'gold' }] });
    // a count past the findings kept: what else it found is unknown
    set(seats.cut, { held: 'law', strikes: 1, at: T0 - 3600 }); find(seats.cut, { count: 2, findings: law6() });
    // the same code on a template the port never registered (an index past every row): not this
    set(seats.tpl, { held: 'law', strikes: 1, at: T0 - 3600 }); find(seats.tpl, { count: 1, findings: law6(9999) });
    set(seats.sworn, { held: 'staff', strikes: 1, at: T0 - 3600 }); find(seats.sworn, { count: 1, findings: law6() });
    const revs = Object.fromEntries(Object.entries(seats).map(([h, c]) => [h, s.row(c.R.id).judge_rev]));
    const sql = readFileSync(new URL('../../server-account/migrations/0125_key_law.sql', import.meta.url), 'utf8');
    s.raw.exec(sql.split('\n').filter((l) => !l.startsWith('--')).join('\n'));
    for (const h of ['timed', 'plain', 'gone']) {
      const r = s.row(seats[h].R.id);
      assert.deepEqual([r.held, r.held_at, r.held_until, r.strikes, r.law_holds, r.law_at, r.judge_rev], [null, null, null, 0, 0, null, revs[h] + 1], `${h}: lifted`);
    }
    assert.equal(s.row(seats.timed.R.id).law_sig, SIG, 'the signature kept - a checkpoint law 6 still judges is no new strike');
    assert.deepEqual(s.findings(seats.timed.R.id, 'staff'), [{ act: 'clear', by: 'key-law', was: 'law', until: T0 + LAW_HOLD_S, strikes: 0, served: 1 }], 'written as a staff act, with what it lifted');
    for (const h of ['other', 'cut', 'tpl', 'sworn', 'none']) {
      assert.equal(s.row(seats[h].R.id).judge_rev, revs[h], `${h}: untouched`);
      assert.deepEqual(s.findings(seats[h].R.id, 'staff'), [], `${h}: nothing written`);
    }
    assert.deepEqual([s.row(seats.other.R.id).held, s.row(seats.sworn.R.id).held, s.row(seats.sworn.R.id).strikes], ['law', 'staff', 1]);
    // the next checkpoint, under law 7, carrying the keys: nothing holds, no strike
    assert.equal((await s.put(seats.timed, [keys(2)])).tradeHeld ?? null, null);
    assert.deepEqual([s.row(seats.timed.R.id).held, s.row(seats.timed.R.id).strikes, s.row(seats.timed.R.id).law_sig], [null, 0, null]);
  } finally { s.done(); }
});
