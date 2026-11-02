// FIELD BUGS 2026-10-20h (SOUL-LAW; bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md) - the Discord's "Soul Trap (Ogre)":
// item law 8 found the soul of one of Daggerfall Enemy Expansion's fifty in a Soul Gem (template 274) or Azura's Star (an
// amulet, 133) 'soul', and held its trapper's trade with a strike - three gems filled and sold, a week's hold. Law 9 takes
// those souls; migration 0143 lifts what that finding alone made, read as 0130 read the Weir Key's (KEY-LIFT): the findings
// since the character's last act that zeroed its count, the timed hold the soul made lifted, the strikes another finding
// could have struck kept, a hold another finding makes kept, written as a staff act. The findings are the shapes the real
// verdict writes (`{ count, findings: [{ code, list, at, t }] }`); the checkpoints are the real Worker's, over node:sqlite.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { STRIKES_FOR_TIMED } from '../../server-account/src/judge.js';
import { LAW_HOLD_S } from '../../server-account/src/verdict.js';
import { createEmptySoulTrap } from '../../src/systems/shopStock.js';
import { attemptSoulTrap } from '../../src/systems/mysticism.js';

/** The Mages Guild's Soul Gem, an Ogre's soul in it (the mod's 282) by the kill law. */
const ogreGem = () => { const g = createEmptySoulTrap(); attemptSoulTrap({ activeEffects: [{ kind: 'soulTrap', chance: 100 }] }, 282, [g], 0); return g; };
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
  const find = (c, detail, at = T0 - 3600, law = 8) => raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, ?, 'law', ?)").run(c.who.id, c.R.id, at, law, JSON.stringify(detail));
  const act = (c, detail, at = T0 - 7200) => raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 0, 'staff', ?)").run(c.who.id, c.R.id, at, JSON.stringify(detail));
  const set = (c, f) => raw.prepare('UPDATE realm_characters SET held = ?, held_at = ?, held_until = ?, strikes = ?, law_holds = ?, law_at = ?, law_sig = ? WHERE id = ?')
    .run(f.held ?? null, f.held ? 777 : null, f.until ?? null, f.strikes ?? 0, f.served ?? 0, f.at ?? null, f.sig ?? null, c.R.id);
  return { ...s, raw, seat, put, row, findings, find, act, set, done: () => { Date.now = realNow; } };
}

/** Law 8's finding on a gem with a soul of the fifty (t 274), or on Azura's Star (t 133). */
const SOUL = (t = 274) => ({ count: 1, findings: [{ code: 'soul', list: 0, at: 0, t }] });
const OTHER = (code = 'gold', t = null) => ({ count: 1, findings: [{ code, ...(t == null ? {} : { list: 0, at: 0, t }) }] });
const SIG = 'soul:274';
/** The week's hold the soul's third strike made, under law 8: the strikes counted into one timed hold served. */
const TIMED = { held: 'law', until: T0 + LAW_HOLD_S, served: 1, at: T0 + LAW_HOLD_S, sig: SIG };
const LIFTED = (rev) => [null, null, null, 0, 0, null, rev + 1];
const state = (r) => [r.held, r.held_at, r.held_until, r.strikes, r.law_holds, r.law_at, r.judge_rev];

test('SOUL-LAW lift, the report: three Ogre gems filled and sold under law 8 - three strikes, a week\'s hold - lifted whole by 0143, written as a staff act, the scratch tables dropped; the next checkpoint carrying the gem holds nothing (mutants: the soul\'s finding unread; the hold left)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('ogrebane');
    for (const at of [T0 - 3000, T0 - 2000, T0 - 1000]) s.find(A, SOUL(), at);
    s.set(A, TIMED);
    const rev = s.row(A.R.id).judge_rev;
    s.raw.exec(migration('0143_soul_lift.sql'));
    assert.deepEqual(state(s.row(A.R.id)), LIFTED(rev), 'lifted whole - nothing since but the soul');
    assert.equal(s.row(A.R.id).law_sig, SIG, 'the signature kept: a checkpoint law 8 judges before the Worker moves is no new strike');
    assert.deepEqual(s.findings(A.R.id, 'staff').at(-1), { act: 'clear', by: 'soul-lift', was: 'law', until: T0 + LAW_HOLD_S, strikes: 0, served: 1, kept: 0 });
    assert.deepEqual(s.raw.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'soul_lift%'").all(), [], 'the scratch tables dropped');
    assert.equal((await s.put(A, [ogreGem()])).tradeHeld ?? null, null, 'law 9: the gem is no finding');
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).strikes, s.row(A.R.id).held_until, s.row(A.R.id).law_sig], [null, 0, null, null]);
  } finally { s.done(); }
});

test('SOUL-LAW lift: what counts and what does not - Azura\'s Star\'s soul and an id beside a soul are the soul\'s; a strike a forged piece laid is kept, its fade its own; a hold another finding makes stands; three other findings, a timed act, staff\'s hold and no soul at all are left as they were; 0130\'s lift, which kept a strike, ends no count (mutants: the Star\'s template; the strikes zeroed; the key-lift read as a clear)', async () => {
  const s = await stand();
  try {
    const seats = {};
    for (const h of ['star', 'uid', 'excused', 'struck', 'carrying', 'three', 'timedact', 'sworn', 'nosoul', 'dagger', 'keylift']) seats[h] = await s.seat(`sl${h}`);
    s.find(seats.star, SOUL(133)); s.find(seats.star, SOUL(133)); s.find(seats.star, SOUL()); s.set(seats.star, { ...TIMED, sig: 'soul:133,soul:274' });
    s.find(seats.uid, { count: 2, findings: [...SOUL().findings, { code: 'uid', at: 'k1', t: 102 }] }); s.set(seats.uid, TIMED);
    s.find(seats.excused, { ...OTHER('gold'), excused: true }); s.find(seats.excused, SOUL()); s.set(seats.excused, TIMED);
    // a strike the real verdict lays, through the Worker: a forged piece carried, then gone - then two of the soul's
    assert.equal((await s.put(seats.struck, [forged()])).tradeHeld, 'law');
    await s.put(seats.struck, []);
    assert.deepEqual([s.row(seats.struck.R.id).held, s.row(seats.struck.R.id).strikes], [null, 1]);
    const otherAt = s.raw.prepare("SELECT at FROM realm_findings WHERE char_id = ? AND kind = 'law'").get(seats.struck.R.id).at;
    for (const at of [T0 + 100, T0 + 200]) s.find(seats.struck, SOUL(), at);
    s.set(seats.struck, TIMED);
    // a forged piece still carried, the soul's week on top: the week goes, the piece's hold stays
    s.find(seats.carrying, OTHER('template', 9999)); s.find(seats.carrying, SOUL()); s.set(seats.carrying, { ...TIMED, sig: 'template:9999' });
    const three = (c, at = T0 - 9000) => { for (let i = 0; i < STRIKES_FOR_TIMED; i++) s.find(c, OTHER('gold'), at + i); };
    three(seats.three); s.find(seats.three, SOUL()); s.set(seats.three, TIMED);
    s.act(seats.timedact, { act: 'timed', by: 'auto-hold', was: 'law', until: T0 + LAW_HOLD_S }); s.find(seats.timedact, SOUL()); s.set(seats.timedact, TIMED);
    s.find(seats.sworn, SOUL()); s.set(seats.sworn, { ...TIMED, held: 'staff' });
    s.find(seats.nosoul, OTHER('gold')); s.find(seats.nosoul, OTHER('gold')); s.set(seats.nosoul, { ...TIMED, sig: 'gold:' });
    // a soul in a dagger is a forgery law 9 still finds: three of them made the week, not the gem's
    for (let i = 0; i < 3; i++) s.find(seats.dagger, OTHER('soul', 113), T0 - 5000 + i);
    s.find(seats.dagger, SOUL()); s.set(seats.dagger, TIMED);
    // KEY-LIFT (0130) kept one strike a forged piece laid before the keys; two of the soul's since make the week
    s.find(seats.keylift, OTHER('gold'), T0 - 9000); s.find(seats.keylift, { count: 1, findings: [{ code: 'template', list: 0, at: 0, t: 575 }] }, T0 - 8000);
    s.act(seats.keylift, { act: 'clear', by: 'key-lift', was: 'law', until: T0 + 100, strikes: 0, served: 1, kept: 1 }, T0 - 7000);
    s.find(seats.keylift, SOUL(), T0 - 2000); s.find(seats.keylift, SOUL(), T0 - 1000); s.set(seats.keylift, TIMED);
    const revs = Object.fromEntries(Object.entries(seats).map(([h, c]) => [h, s.row(c.R.id).judge_rev]));
    s.raw.exec(migration('0143_soul_lift.sql'));
    for (const h of ['star', 'uid', 'excused']) assert.deepEqual(state(s.row(seats[h].R.id)), LIFTED(revs[h]), `${h}: lifted whole`);
    assert.deepEqual(state(s.row(seats.struck.R.id)), [null, null, null, 1, 0, otherAt, revs.struck + 1], 'struck: the week lifted, the forged piece\'s strike kept, faded from its own finding');
    assert.equal(s.findings(seats.struck.R.id, 'staff').at(-1).kept, 1);
    assert.deepEqual(state(s.row(seats.carrying.R.id)), ['law', 777, null, 1, 0, T0 - 3600, revs.carrying + 1], 'carrying: the week lifted, the piece\'s hold standing');
    assert.equal(s.row(seats.carrying.R.id).law_sig, 'template:9999');
    assert.deepEqual(state(s.row(seats.keylift.R.id)), [null, null, null, 1, 0, T0 - 9000, revs.keylift + 1], 'keylift: the strike 0130 kept is kept');
    for (const h of ['three', 'timedact', 'sworn', 'nosoul', 'dagger']) {
      assert.equal(s.row(seats[h].R.id).judge_rev, revs[h], `${h}: untouched`);
      assert.equal(s.findings(seats[h].R.id, 'staff').filter((d) => d.by === 'soul-lift').length, 0, `${h}: nothing written`);
    }
    assert.deepEqual(['three', 'timedact', 'nosoul', 'dagger'].map((h) => s.row(seats[h].R.id).held_until), Array(4).fill(T0 + LAW_HOLD_S));
    assert.equal(s.row(seats.sworn.R.id).held, 'staff');
    // the struck character's count goes on from there: a checkpoint carrying its Ogre gem is clean under law 9 (the kept
    // signature let go), and the forged piece taken up again is the second strike, no week
    assert.equal((await s.put(seats.struck, [ogreGem()])).tradeHeld ?? null, null);
    assert.equal(s.row(seats.struck.R.id).law_sig, null);
    await s.put(seats.struck, [forged()]);
    assert.deepEqual([s.row(seats.struck.R.id).held, s.row(seats.struck.R.id).strikes, s.row(seats.struck.R.id).held_until], ['law', 2, null]);
  } finally { s.done(); }
});
