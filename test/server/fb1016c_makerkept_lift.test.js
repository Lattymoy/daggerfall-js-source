// FIELD BUGS 2026-10-16c (MAKER-KEPT) - the realm's side of Flylighter's "Grandfathered Items triggering trade lock":
// item law 6 (src/systems/item/itemLaw.js MAKER_ERA_AETHERIC) is the account service's judge (judge.js JUDGE_VERSION), so
// a checkpoint carrying a Ruhn's Regalia piece the item maker enchanted before AETHERIC-MAKER holds nothing; and
// migration 0123 lifts what law 5 laid on such characters alone - the hold, the timed hold AUTO-HOLD made of a third
// strike, the strikes - written as a staff act, leaving staff's holds, other findings' holds and `law_sig` as they were.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { JUDGE_VERSION } from '../../server-account/src/judge.js';
import { LAW_HOLD_S } from '../../server-account/src/verdict.js';
import { mintAetheric, REGALIA, SERPENT_SET_PIECES } from '../../src/systems/aetheric.js';
import { applyEnchantments } from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';

const cleaver = () => {
  const item = mintAetheric(REGALIA.find((r) => r.id === 'ruhn-gatecleaver'));
  applyEnchantments(item, [enchantmentSettings('PotentVs', 1)]);   // the item maker's write, before its refusal
  return item;
};

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

test('MAKER-KEPT judge: a checkpoint carrying a Regalia piece the maker enchanted before the refusal holds nothing and finds nothing; a later set\'s piece enchanted still holds (mutant: the law\'s keep)', async () => {
  const s = await stand();
  try {
    const A = await s.seat('kept'), B = await s.seat('late');
    assert.equal((await s.put(A, [cleaver()])).tradeHeld ?? null, null);
    assert.deepEqual([s.row(A.R.id).held, s.row(A.R.id).strikes, s.findings(A.R.id, 'law')], [null, 0, []]);
    const late = mintAetheric(SERPENT_SET_PIECES[0]);
    applyEnchantments(late, [enchantmentSettings('FeatherWeight', -1), enchantmentSettings('BadReactionsFrom', 1)]);
    await s.put(B, [late]);
    assert.equal(s.row(B.R.id).held, 'law', 'no maker ever laid a row on a Serpent piece');
  } finally { s.done(); }
});

test('MAKER-KEPT migration 0123: a hold, a timed hold and strikes law 5 laid on the era\'s enchanted pieces alone lifted, written as a staff act; a staff hold, a hold with any other finding, and a finding past its kept list untouched; `law_sig` kept (mutants: the codes; the templates; the count guard; staff\'s)', async () => {
  const s = await stand();
  try {
    const seats = {};
    for (const h of ['timed', 'plain', 'gone', 'other', 'sworn', 'cut', 'tpl', 'none']) seats[h] = await s.seat(`mk${h}`);
    const law5 = (t) => [{ code: 'aetheric', list: 0, at: 0, t }, { code: 'enchantments', list: 0, at: 0, t }];
    const find = (c, detail, at = T0 - 3600) => s.raw.prepare("INSERT INTO realm_findings (player, char_id, seq, at, law, kind, detail) VALUES (?, ?, 1, ?, 5, 'law', ?)").run(c.who.id, c.R.id, at, JSON.stringify(detail));
    const set = (c, f) => s.raw.prepare('UPDATE realm_characters SET held = ?, held_at = ?, held_until = ?, strikes = ?, law_holds = ?, law_at = ?, law_sig = ? WHERE id = ?')
      .run(f.held ?? null, f.held ? 777 : null, f.until ?? null, f.strikes ?? 0, f.served ?? 0, f.at ?? null, f.sig ?? null, c.R.id);
    const SIG = 'aetheric:127,enchantments:127';
    // three strikes AUTO-HOLD made a week's hold of; the piece still carried
    set(seats.timed, { held: 'law', until: T0 + LAW_HOLD_S, served: 1, at: T0 + LAW_HOLD_S, sig: SIG });
    find(seats.timed, { count: 2, findings: law5(127) }); find(seats.timed, { count: 4, findings: [...law5(127), ...law5(102)] });
    // the plain law hold, one strike
    set(seats.plain, { held: 'law', strikes: 1, at: T0 - 3600, sig: SIG }); find(seats.plain, { count: 2, findings: law5(127) });
    // the piece gone, two strikes standing
    set(seats.gone, { strikes: 2, at: T0 - 3600 }); find(seats.gone, { count: 2, findings: law5(111) });
    // a finding of another kind among them: the law's hold stands
    set(seats.other, { held: 'law', strikes: 1, at: T0 - 3600, sig: 'gold:' }); find(seats.other, { count: 2, findings: law5(127) }); find(seats.other, { count: 1, findings: [{ code: 'gold' }] });
    // a count past the findings kept: what else it found is unknown
    set(seats.cut, { held: 'law', strikes: 1, at: T0 - 3600 }); find(seats.cut, { count: 3, findings: law5(127) });
    // the same codes on a template no era record stands on (a Saber, 113): not this
    set(seats.tpl, { held: 'law', strikes: 1, at: T0 - 3600 }); find(seats.tpl, { count: 2, findings: law5(113) });
    set(seats.sworn, { held: 'staff', strikes: 2, at: T0 - 3600 }); find(seats.sworn, { count: 2, findings: law5(127) });
    const revs = Object.fromEntries(Object.entries(seats).map(([h, c]) => [h, s.row(c.R.id).judge_rev]));
    const sql = readFileSync(new URL('../../server-account/migrations/0123_maker_kept.sql', import.meta.url), 'utf8');
    s.raw.exec(sql.split('\n').filter((l) => !l.startsWith('--')).join('\n'));
    for (const h of ['timed', 'plain', 'gone']) {
      const r = s.row(seats[h].R.id);
      assert.deepEqual([r.held, r.held_at, r.held_until, r.strikes, r.law_holds, r.law_at, r.judge_rev], [null, null, null, 0, 0, null, revs[h] + 1], `${h}: lifted`);
    }
    assert.equal(s.row(seats.timed.R.id).law_sig, SIG, 'the signature kept - the piece carried on is no new strike');
    assert.deepEqual(s.findings(seats.timed.R.id, 'staff'), [{ act: 'clear', by: 'maker-kept', was: 'law', until: T0 + LAW_HOLD_S, strikes: 0, served: 1 }], 'written as a staff act, with what it lifted');
    for (const h of ['other', 'cut', 'tpl', 'sworn', 'none']) {
      assert.equal(s.row(seats[h].R.id).judge_rev, revs[h], `${h}: untouched`);
      assert.deepEqual(s.findings(seats[h].R.id, 'staff'), [], `${h}: nothing written`);
    }
    assert.deepEqual([s.row(seats.other.R.id).held, s.row(seats.sworn.R.id).held, s.row(seats.sworn.R.id).strikes], ['law', 'staff', 2]);
    // the next checkpoint, under law 6, carrying the piece: nothing holds, no strike
    assert.equal((await s.put(seats.timed, [cleaver()])).tradeHeld ?? null, null);
    assert.deepEqual([s.row(seats.timed.R.id).held, s.row(seats.timed.R.id).strikes, s.row(seats.timed.R.id).law_sig], [null, 0, null]);
    assert.equal(JUDGE_VERSION, 12);   // PIN MOVED (GUNS-UNFOUND): law 12 - the Hourlock lawful as a gilded Dwarven Long Bow and as the Thunderlock minted before, the Sunken Sovereign as the Ebony Saber again and as the Pistolet minted between; PIN MOVED (SEA-SET): law 11 - the Eltheric Tidemail's nine records lawful (law 10 on its branch, renumbered past PISTOLET's at the merge); PIN MOVED (AUDIT PISTOLET A7): law 10 - a Sunken Sovereign minted as a saber before PISTOLET lawful as minted, the record's saber era; PIN MOVED (SOUL-LAW, FIELD BUGS 2026-10-20h): law 9 - a soul of Daggerfall Enemy Expansion's fifty lawful in a Soul Gem or Azura's Star; PIN MOVED (WITCH1): law 8 - the Soul Cake and the Hearth Offering known to the service's law; PIN MOVED (KEY-LAW): law 7 - the Weir Key known to the service's law; the era's pieces lawful from law 6 on
  } finally { s.done(); }
});
