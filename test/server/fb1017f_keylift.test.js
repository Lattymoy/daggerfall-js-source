// FIELD BUGS 2026-10-17f (KEY-LIFT) - the Discord, the evening after KEY-LAW: "bruhhhh it was that keyyyyy", over "The
// realm's law has held this character three times. Its trading is frozen until October 24 at 3:21 AM, then opens on its
// own.", and "like 5 other people reporting same thing". Migration 0125 lifted law 6's Weir Key holds only where every
// law finding a character ever had was the key's, so a finding already cleared (0123's) or one an older law laid kept
// the key's week standing. Migration 0130 reads the findings since the character's last act that zeroed its count, and
// lifts the timed hold the key made - the strikes another finding could have struck kept, a hold another finding makes
// kept, written as a staff act.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { STRIKES_FOR_TIMED } from '../../server-account/src/judge.js';
import { LAW_HOLD_S } from '../../server-account/src/verdict.js';
import { WEIR_KEY_LAW_ROW } from '../../src/systems/eliteGates/weirKeyRow.js';

/** A Weir Key stack as the client mints it (fb1017_keylaw_lift.test.js's - this process must not import the key's home). */
const keys = (n) => ({ group: 'UselessItems2', templateIndex: WEIR_KEY_LAW_ROW.index, name: 'Weir Key', value: 500, maxCondition: 1000, currentCondition: 1000, stackCount: n });
/** A piece of no template the port registers: what the law finds on a forged piece, as the real verdict writes it. */
const forged = () => ({ group: 'UselessItems2', templateIndex: 9999, name: 'Forged', value: 1, maxCondition: 1, currentCondition: 1 });
const migration = (f) => readFileSync(new URL(`../../server-account/migrations/${f}`, import.meta.url), 'utf8').split('\n').filter((l) => !l.startsWith('--')).join('\n');

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
  // a finding as verdict.js writes one (`{ count, findings: [{ code, list, at, t }] }`), and a staff act as review.js and the lifts write one
  const find = (c, detail, at = T0 - 3600, law = 6) => raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, ?, 'law', ?)").run(c.who.id, c.R.id, at, law, JSON.stringify(detail));
  const act = (c, detail, at = T0 - 7200) => raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 0, 'staff', ?)").run(c.who.id, c.R.id, at, JSON.stringify(detail));
  const set = (c, f) => raw.prepare('UPDATE realm_characters SET held = ?, held_at = ?, held_until = ?, strikes = ?, law_holds = ?, law_at = ?, law_sig = ? WHERE id = ?')
    .run(f.held ?? null, f.held ? 777 : null, f.until ?? null, f.strikes ?? 0, f.served ?? 0, f.at ?? null, f.sig ?? null, c.R.id);
  return { ...s, raw, seat, put, row, findings, find, act, set, done: () => { Date.now = realNow; } };
}

const KEY = (n = 1) => ({ count: n, findings: Array.from({ length: n }, (_, i) => ({ code: 'template', list: i, at: 0, t: 575 })) });
const OTHER = (code = 'gold', t = null) => ({ count: 1, findings: [{ code, ...(t == null ? {} : { list: 0, at: 0, t }) }] });
const SIG = 'template:575';
/** The week's hold the key's third strike made, under law 6: the keys' strikes counted into one timed hold served. */
const TIMED = { held: 'law', until: T0 + LAW_HOLD_S, served: 1, at: T0 + LAW_HOLD_S, sig: SIG };
const LIFTED = (rev) => [null, null, null, 0, 0, null, rev + 1];
const state = (r) => [r.held, r.held_at, r.held_until, r.strikes, r.law_holds, r.law_at, r.judge_rev];

test('KEY-LIFT, the report: a character whose Aetheric pieces 0123 cleared, then held a week by the key\'s three strikes - 0125 leaves it held, 0130 lifts it, written as a staff act; its next checkpoint carrying keys holds nothing (mutant: the last clear unread)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('flylit');
    // MAKER-KEPT: law 5's finding on the gate's Regalia, cleared by migration 0123 as it ran
    s.find(A, { count: 2, findings: [{ code: 'aetheric', list: 0, at: 0, t: 127 }, { code: 'enchantments', list: 0, at: 0, t: 127 }] }, T0 - 86400, 5);
    s.set(A, { held: 'law', strikes: 1, at: T0 - 86400, sig: 'aetheric:127,enchantments:127' });
    s.raw.exec(migration('0123_maker_kept.sql'));
    assert.deepEqual(s.findings(A.R.id, 'staff').map((d) => d.by), ['maker-kept']);
    // the Elite Breach: three keys taken up, each after the last was spent - three strikes, a week's hold
    for (const at of [T0 - 3000, T0 - 2000, T0 - 1000]) s.find(A, KEY(), at);
    s.set(A, TIMED);
    const rev = s.row(A.R.id).judge_rev;
    s.raw.exec(migration('0125_key_law.sql'));
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).held_until], ['law', T0 + LAW_HOLD_S], 'the gap: 0125 read the cleared finding and left the week standing');
    s.raw.exec(migration('0130_key_lift.sql'));
    assert.deepEqual(state(s.row(A.R.id)), LIFTED(rev), 'lifted whole - nothing since the last clear but the key');
    assert.equal(s.row(A.R.id).law_sig, null, 'the key\'s signature dropped - law 7 finds no key');
    assert.deepEqual(s.findings(A.R.id, 'staff').at(-1), { act: 'clear', by: 'key-lift', was: 'law', until: T0 + LAW_HOLD_S, strikes: 0, served: 1, kept: 0 });
    assert.deepEqual(s.raw.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'key_lift%'").all(), [], 'the scratch tables dropped');
    assert.equal((await s.put(A, [keys(2)])).tradeHeld ?? null, null);
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).strikes, s.row(A.R.id).held_until], [null, 0, null]);
  } finally { s.done(); }
});

test('KEY-LIFT: a strike an older law\'s finding laid, then two of the key\'s - the week lifted, that one strike kept and faded from its own finding; the real verdict\'s finding (mutants: the strikes zeroed; the fade dropped)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('healed');
    // a strike the real verdict lays, through the Worker: a forged piece carried, then gone
    assert.equal((await s.put(A, [forged()])).tradeHeld, 'law');
    await s.put(A, []);
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).strikes], [null, 1]);
    const otherAt = s.raw.prepare("SELECT at FROM realm_findings WHERE char_id = ? AND kind = 'law'").get(A.R.id).at;
    for (const at of [T0 + 100, T0 + 200]) s.find(A, KEY(), at);
    s.set(A, TIMED);
    const rev = s.row(A.R.id).judge_rev;
    s.raw.exec(migration('0130_key_lift.sql'));
    assert.deepEqual(state(s.row(A.R.id)), [null, null, null, 1, 0, otherAt, rev + 1]);
    assert.equal(s.findings(A.R.id, 'staff').at(-1).kept, 1);
    // its count goes on from there: the forged piece taken up again is the second strike, no week
    await s.put(A, [forged()]);
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).strikes, s.row(A.R.id).held_until], ['law', 2, null]);
  } finally { s.done(); }
});

test('KEY-LIFT: what counts and what does not - a staff clear and a rollback end the count, 0120\'s copies\' clear does not; an excused finding and an id on another piece strike nothing; a count past its kept list could; a hold another finding makes stands (mutants: each)', async () => {
  const s = await stand();
  try {
    const seats = {};
    for (const h of ['staffclear', 'rollback', 'dupeclear', 'excused', 'uid', 'cut', 'carrying', 'three', 'timedact', 'sworn', 'nokey', 'done']) seats[h] = await s.seat(`kl${h}`);
    const three = (c, at = T0 - 9000) => { for (let i = 0; i < STRIKES_FOR_TIMED; i++) s.find(c, OTHER('gold'), at + i); };
    // three findings, then a person's clear: none of them counts past it
    three(seats.staffclear); s.act(seats.staffclear, { act: 'clear', by: 'Mac', note: null, was: 'law', review: null, excused: 'gold:' });
    s.find(seats.staffclear, KEY()); s.set(seats.staffclear, TIMED);
    // and a rollback the same
    three(seats.rollback); s.act(seats.rollback, { act: 'rollback', by: 'Mac', note: null, from: 4, to: 2 });
    s.find(seats.rollback, KEY()); s.set(seats.rollback, TIMED);
    // 0120's clear lifted a copy's hold and zeroed no strike: the three before it still count
    three(seats.dupeclear); s.act(seats.dupeclear, { act: 'clear', by: 'auto-hold', was: 'dupe' });
    s.find(seats.dupeclear, KEY()); s.set(seats.dupeclear, TIMED);
    // an excused finding held nothing
    s.find(seats.excused, { ...OTHER('gold'), excused: true }); s.find(seats.excused, KEY()); s.set(seats.excused, TIMED);
    // an id on another piece beside the key: no strike (verdict.js)
    s.find(seats.uid, { count: 2, findings: [...KEY().findings, { code: 'uid', at: 'k1', t: 102 }] }); s.set(seats.uid, TIMED);
    // the key's finding past its kept list: what else it found could have struck
    s.find(seats.cut, { ...KEY(), count: 2 }); s.set(seats.cut, TIMED);
    // a forged piece still carried, the key's week on top: the week goes, the piece's hold stays
    s.find(seats.carrying, OTHER('gold')); s.find(seats.carrying, KEY()); s.set(seats.carrying, { ...TIMED, sig: 'gold:' });
    // three findings beside the key's: the week could have come without it
    three(seats.three); s.find(seats.three, KEY()); s.set(seats.three, TIMED);
    // a week an act made (0120's conversion) - not the key's
    s.act(seats.timedact, { act: 'timed', by: 'auto-hold', was: 'law', until: T0 + LAW_HOLD_S }); s.find(seats.timedact, KEY()); s.set(seats.timedact, TIMED);
    s.find(seats.sworn, KEY()); s.set(seats.sworn, { ...TIMED, held: 'staff' });
    // no key's finding at all: not this, whatever stands
    s.find(seats.nokey, OTHER('gold')); s.find(seats.nokey, OTHER('gold')); s.set(seats.nokey, { ...TIMED, sig: 'gold:' });
    // already lifted by 0125: nothing of the key's since
    s.find(seats.done, KEY()); s.act(seats.done, { act: 'clear', by: 'key-law', was: 'law', until: null, strikes: 1, served: 0 }); s.set(seats.done, { sig: SIG });
    const revs = Object.fromEntries(Object.entries(seats).map(([h, c]) => [h, s.row(c.R.id).judge_rev]));
    s.raw.exec(migration('0130_key_lift.sql'));
    for (const h of ['staffclear', 'rollback', 'excused', 'uid']) assert.deepEqual(state(s.row(seats[h].R.id)), LIFTED(revs[h]), `${h}: lifted whole`);
    assert.deepEqual(state(s.row(seats.cut.R.id)), [null, null, null, 1, 0, T0 - 3600, revs.cut + 1], 'cut: the week lifted, one strike kept');
    assert.deepEqual(state(s.row(seats.carrying.R.id)), ['law', 777, null, 1, 0, T0 - 3600, revs.carrying + 1], 'carrying: the week lifted, the piece\'s hold standing');
    assert.equal(s.row(seats.carrying.R.id).law_sig, 'gold:');
    for (const h of ['dupeclear', 'three', 'timedact', 'sworn', 'nokey', 'done']) {
      assert.equal(s.row(seats[h].R.id).judge_rev, revs[h], `${h}: untouched`);
      assert.equal(s.findings(seats[h].R.id, 'staff').filter((d) => d.by === 'key-lift').length, 0, `${h}: nothing written`);
    }
    assert.deepEqual([s.row(seats.dupeclear.R.id).held_until, s.row(seats.three.R.id).held_until, s.row(seats.nokey.R.id).held_until, s.row(seats.sworn.R.id).held], [T0 + LAW_HOLD_S, T0 + LAW_HOLD_S, T0 + LAW_HOLD_S, 'staff']);
    // the carried piece's hold, judged again: still held, no new strike (the signature kept), and lifted once it is gone
    assert.equal((await s.put(seats.carrying, [forged()])).tradeHeld, 'law');
    assert.equal(s.row(seats.carrying.R.id).strikes, 1);
    assert.equal((await s.put(seats.carrying, [keys(1)])).tradeHeld ?? null, null);
  } finally { s.done(); }
});
