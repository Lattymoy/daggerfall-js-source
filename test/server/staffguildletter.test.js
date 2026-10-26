// GUILD-LETTER-FIX (2026-10-25, mob: a player's level 10 Lyrezi vampire never had the Dark Brotherhood's letter - the
// tally at InviteSent, no letter pending, The Acceptance Test nowhere in the save; "do it") - THE STAFF PANEL SENDS A
// CRIME GUILD'S LETTER AGAIN, OR CALLS ONE OFF: /v1/staff/fix/letter { id, ticket, guild, op, note }, an Admin's
// (server-account/src/staffRealm.js), the review's `letter` act (review.js letterAct, staffMend) over its law
// (net/repairLaw.js guildLetterOf, applyGuildLetter) - and the game's own letter (systems/crimeGuilds.js) sends what the
// fix set. The law alone, then the real Worker on node:sqlite with R2 beside it (test/accountDb.mjs, test/realmSeat.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { seatRealm, freshSave, recordOf } from '../realmSeat.mjs';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import { letterRowFaction } from '../../server-account/src/review.js';
import { guildLetterOf, applyGuildLetter, GUILD_LETTERS, GUILD_LETTER_OPS } from '../../src/net/repairLaw.js';
import {
  handleStartingCrimeGuildQuests, setCrimeGuildQuestHost, INVITE_SENT, DARK_BROTHERHOOD_TALLY_TARGET, THIEVES_GUILD_TALLY_TARGET,
  DARK_BROTHERHOOD_INITIATION_QUEST, DARK_BROTHERHOOD_FACTION_ID, THIEVES_GUILD_FACTION_ID,
} from '../../src/systems/crimeGuilds.js';
import worker from '../../server-account/src/index.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const PASSWORD = 'a good long one';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const TICKET = 'mob-letter-1';
const NOTE = 'player report: no Brotherhood letter';
/** The reporter's record: the Brotherhood's tally parked, no letter pending, no quest, both membership books empty. */
const stuck = (extra = {}) => ({
  darkBrotherhoodRequirementTally: INVITE_SENT, timeForDarkBrotherhoodLetter: 0, thievesGuildRequirementTally: 0, timeForThievesGuildLetter: 0,
  guildMemberships: { mortal: {}, vampire: {} }, quest: { machine: { siteLinks: [], quests: [{ questName: 'S0000999', uid: 7 }] } }, ...extra,
});

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

/** The Worker with the panel set up (test/server/staffpanel3realm.test.js's): mob an Admin and a developer, Asynian a
 *  Moderator, each signed in; realm characters seated through the service. */
async function stand() {
  const mobKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'Lattymoy,SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'Lattymoy,SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${mobKey.pub}`,
  });
  const raw = s.env.DB._raw;
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const h of ['SirMcMobdon', 'Asynian']) await s.registered(h);
  const mob = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await mobKey.proof('login', 'SirMcMobdon')) })).body;
  const inv = await staff('/v1/staff/invite', { handle: 'Asynian' }, mob.session);
  const asyKey = await extensionKey();
  const asy = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: inv.body.invite, ...(await asyKey.proof('enroll', 'Asynian')) })).body;
  const admin = (path, body = {}) => staff(path, body, mob.session);
  /** A checkpoint under a lease, one on - the character's own tab's, unless one is named. */
  const put = async (who, id, save, { seq = null, lease = null } = {}) => {
    const row = raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(id);
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': lease ?? row.lease ?? '0'.repeat(32), 'x-realm-seq': String(seq ?? row.seq + 1) }, body: JSON.stringify(save),
    }), s.env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A registered account seated as a realm character, `save` checkpointed over its first. */
  const seat = async (handle, save = null) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle);
    if (save) assert.equal((await put(who, R.id, save)).status, 200, `${handle}'s save lands`);
    return { who, id: R.id };
  };
  const row = (id) => ({ ...raw.prepare('SELECT * FROM realm_characters WHERE id = ?').get(id) });
  const findings = (id) => raw.prepare('SELECT kind, detail FROM realm_findings WHERE char_id = ? ORDER BY id').all(id).map((r) => ({ kind: r.kind, detail: JSON.parse(r.detail) }));
  const repairs = (id) => raw.prepare('SELECT ticket, faction, flag, was, gold, seq, by_handle, note FROM realm_repairs WHERE char_id = ?').all(id).map((r) => ({ ...r }));
  const faucet = () => ({ ...raw.prepare("SELECT COALESCE(SUM(gold), 0) AS gold, COALESCE(SUM(n), 0) AS n FROM realm_faucets WHERE kind = 'repair'").get() });
  const audits = (act) => raw.prepare('SELECT act, target, detail, outcome FROM staff_audit WHERE act = ? ORDER BY id').all(act).map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null }));
  /** The bank the profile says for one character - the Staff Panel's own read (staffPlayers.js `banks`). */
  const banks = async (c) => {
    const r = await admin('/v1/staff/player', { target: row(c.id).player, tab: 'inventories', char: c.id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data.banks;
  };
  const letter = (c, body, as = mob.session) => staff('/v1/staff/fix/letter', { id: c.id, ticket: TICKET, note: NOTE, guild: 'db', op: 'send', ...body }, as);
  return { ...s, raw, staff, admin, mob, asy, put, seat, row, findings, repairs, faucet, audits, letter };
}

test('GUILD-LETTER-FIX THE LAW: a fix asks a ticket of the repair\'s shape, a guild (db, tg) and an act (send, cancel); nothing else is a fix (mutants: the ticket unread; the guild unread; the act unread)', () => {
  assert.deepEqual(guildLetterOf({ ticket: TICKET, guild: 'db', op: 'send', note: 'x', id: 'r1' }), { ticket: TICKET, guild: 'db', op: 'send' });
  assert.deepEqual(guildLetterOf({ ticket: TICKET, guild: 'tg', op: 'cancel' }), { ticket: TICKET, guild: 'tg', op: 'cancel' });
  for (const [why, v] of [['no body', null], ['no ticket', { guild: 'db', op: 'send' }], ['a ticket of no shape', { ticket: 'Letter One', guild: 'db', op: 'send' }],
    ['no guild', { ticket: TICKET, op: 'send' }], ['a guild of no letter', { ticket: TICKET, guild: 'mages', op: 'send' }], ['a guild by faction', { ticket: TICKET, guild: 108, op: 'send' }],
    ['an inherited key', { ticket: TICKET, guild: 'toString', op: 'send' }], ['no act', { ticket: TICKET, guild: 'db' }], ['an act of none', { ticket: TICKET, guild: 'db', op: 'join' }]]) {
    assert.equal(guildLetterOf(v), null, why);
  }
  assert.deepEqual([GUILD_LETTERS.db.faction, GUILD_LETTERS.tg.faction], [DARK_BROTHERHOOD_FACTION_ID, THIEVES_GUILD_FACTION_ID]);
  assert.deepEqual([letterRowFaction('db'), letterRowFaction('tg')], [-108, -42], 'below BANK_SET_FACTION (-1): no row before reads as one');
});

test('GUILD-LETTER-FIX ON A SAVE: send sets the tally at the guild\'s target and the letter due, and the game\'s own letter then starts the initiation quest - offline and online; never to a member (either book, a vampire\'s too), a save still holding the quest (running, ended or waiting) or one with a letter on its way; cancel parks the tally with none pending, and a parked tally with none pending has nothing to call off (mutants: membership unread; the vampire book unread; the quest unread; the waiting quests unread; pending unread; the target; the clock; cancel\'s park)', () => {
  const save = stuck();
  assert.deepEqual(applyGuildLetter(save, { guild: 'db', op: 'send' }), { was: INVITE_SENT });
  assert.deepEqual([save.darkBrotherhoodRequirementTally, save.timeForDarkBrotherhoodLetter], [DARK_BROTHERHOOD_TALLY_TARGET, 1]);
  assert.deepEqual([save.thievesGuildRequirementTally, save.timeForThievesGuildLetter], [0, 0], 'the other guild\'s letter untouched');
  const started = [];
  const prev = setCrimeGuildQuestHost({ startQuest: (n, f) => { started.push([n, f]); return { questName: n }; } });
  try {
    for (const online of [false, true]) {
      const e = { ...stuck(), darkBrotherhoodRequirementTally: save.darkBrotherhoodRequirementTally, timeForDarkBrotherhoodLetter: save.timeForDarkBrotherhoodLetter };
      assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: 500_000, inside: true, online }), [], 'never underground');
      assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: 500_000, inside: false, online }), [DARK_BROTHERHOOD_INITIATION_QUEST], `the next minute outside (online ${online})`);
      assert.equal(e.darkBrotherhoodRequirementTally, INVITE_SENT);
    }
  } finally { setCrimeGuildQuestHost(prev); }
  assert.deepEqual(started, [[DARK_BROTHERHOOD_INITIATION_QUEST, DARK_BROTHERHOOD_FACTION_ID], [DARK_BROTHERHOOD_INITIATION_QUEST, DARK_BROTHERHOOD_FACTION_ID]]);
  assert.equal(applyGuildLetter(save, { guild: 'db', op: 'send' }), 'letter-pending', 'a letter already on its way');
  const tg = stuck();
  assert.deepEqual(applyGuildLetter(tg, { guild: 'tg', op: 'send' }), { was: 0 }, 'a letter never earned - staff testing');
  assert.deepEqual([tg.thievesGuildRequirementTally, tg.timeForThievesGuildLetter], [THIEVES_GUILD_TALLY_TARGET, 1]);
  for (const [why, s] of [
    ['a member, the mortal book', stuck({ guildMemberships: { mortal: { 6: { guild: 'DarkBrotherhood', rank: 0 } }, vampire: {} } })],
    ['a member, the vampire book', stuck({ guildMemberships: { mortal: {}, vampire: { 6: { guild: 'DarkBrotherhood', rank: 2 } } } })],
    ['a member, a book from before the two', stuck({ guildMemberships: { 6: { guild: 'DarkBrotherhood', rank: 0 } } })],
  ]) {
    const b = structuredClone(s);
    assert.equal(applyGuildLetter(s, { guild: 'db', op: 'send' }), 'letter-member', why);
    assert.deepEqual(s, b, `${why}: nothing changed`);
  }
  for (const [why, machine] of [['running', { quests: [{ questName: DARK_BROTHERHOOD_INITIATION_QUEST }] }], ['in lower case', { quests: [{ questName: 'l0a01l00' }] }],
    ['waiting to start', { quests: [], toInvoke: [{ questName: DARK_BROTHERHOOD_INITIATION_QUEST }] }]]) {
    const s = stuck({ quest: { machine } });
    const b = structuredClone(s);
    assert.equal(applyGuildLetter(s, { guild: 'db', op: 'send' }), 'letter-quest', why);
    assert.deepEqual(s, b, `${why}: nothing changed`);
  }
  // a Thieves Guild member is no Brotherhood member
  assert.deepEqual(applyGuildLetter(stuck({ guildMemberships: { mortal: { 1: { guild: 'ThievesGuild', rank: 3 } }, vampire: {} } }), { guild: 'db', op: 'send' }), { was: INVITE_SENT });
  // cancel
  const pending = stuck({ darkBrotherhoodRequirementTally: 15, timeForDarkBrotherhoodLetter: 90_000 });
  assert.deepEqual(applyGuildLetter(pending, { guild: 'db', op: 'cancel' }), { was: 15 });
  assert.deepEqual([pending.darkBrotherhoodRequirementTally, pending.timeForDarkBrotherhoodLetter], [INVITE_SENT, 0], 'never coming');
  const counting = stuck({ darkBrotherhoodRequirementTally: 5 });
  assert.deepEqual(applyGuildLetter(counting, { guild: 'db', op: 'cancel' }), { was: 5 }, 'a tally still counting: called off before it is earned');
  assert.equal(counting.darkBrotherhoodRequirementTally, INVITE_SENT);
  const parked = stuck();
  assert.equal(applyGuildLetter(parked, { guild: 'db', op: 'cancel' }), 'letter-none');
  assert.deepEqual(parked, stuck(), 'nothing changed');
});

test('GUILD-LETTER-FIX THE FIX: an Admin sends the reporter\'s letter again - the record one sequence on with its seat taken, the act\'s row, its finding and the audit row, nothing else moved and no gold; the playing tab writes over it never; once a ticket, a ticket names one act; only an Admin, a note, the law\'s body, and the law\'s refusals said (mutants: the act unwired; the route unlisted; the row unwritten; the finding; the row\'s kind)', async () => {
  const s = await stand();
  const c = await s.seat('Garrett', freshSave({ name: 'Garrett', level: 10, ...stuck() }));
  const before = { row: s.row(c.id), rec: recordOf(s.env, c.id), findings: s.findings(c.id).length };
  const tab = { lease: before.row.lease, seq: before.row.seq + 1 };
  assert.equal((await s.letter(c, { note: '' })).status, 400, 'a note');
  assert.equal((await s.letter(c, { guild: 'mages' })).status, 400, 'the law\'s body');
  assert.equal((await s.letter(c, {}, s.asy.session)).status, 403, 'an Admin\'s alone');
  assert.equal(s.row(c.id).seq, before.row.seq, 'nothing moved yet');
  const r = await s.letter(c, {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, repeat: false, ticket: TICKET, seq: before.row.seq + 1, guild: 'db', op: 'send', was: INVITE_SENT, held: null, by: 'SirMcMobdon', at: r.body.at, playing: true });
  const rec = recordOf(s.env, c.id);
  assert.deepEqual([rec.darkBrotherhoodRequirementTally, rec.timeForDarkBrotherhoodLetter], [DARK_BROTHERHOOD_TALLY_TARGET, 1]);
  assert.deepEqual({ ...rec, darkBrotherhoodRequirementTally: null, timeForDarkBrotherhoodLetter: null }, { ...before.rec, darkBrotherhoodRequirementTally: null, timeForDarkBrotherhoodLetter: null }, 'nothing else in the record moved');
  const after = s.row(c.id);
  assert.deepEqual([after.seq, after.lease], [before.row.seq + 1, null], 'one sequence on, the seat taken from any tab');
  assert.deepEqual(s.repairs(c.id), [{ ticket: TICKET, faction: -108, flag: GUILD_LETTER_OPS.send, was: INVITE_SENT, gold: 0, seq: before.row.seq + 1, by_handle: 'SirMcMobdon', note: NOTE }]);
  assert.deepEqual(s.findings(c.id).slice(before.findings), [{ kind: 'staff', detail: { act: 'letter', by: 'SirMcMobdon', note: NOTE, ticket: TICKET, guild: 'db', op: 'send', was: INVITE_SENT, from: before.row.seq, to: before.row.seq + 1 } }]);
  assert.deepEqual(s.faucet(), { gold: 0, n: 0 }, 'no gold');
  assert.deepEqual(s.audits('fix-letter').filter((a) => a.outcome === 'ok').map((a) => a.detail), [{ char: c.id, name: 'Garrett', note: NOTE, ticket: TICKET, guild: 'db', op: 'send', was: INVITE_SENT, repeat: false }]);
  const stale = await s.put(c.who, c.id, before.rec, tab);
  assert.equal(stale.status, 409, 'the playing tab writes over it never');
  assert.deepEqual(recordOf(s.env, c.id), rec, 'the fix stands');
  // once a ticket: asked again it answers its row and moves nothing; the same ticket for another act is refused
  const again = await s.letter(c, {});
  assert.equal(again.status, 200);
  assert.equal(again.body.repeat, true);
  assert.equal(s.row(c.id).seq, after.seq, 'moved nothing');
  assert.equal((await s.admin('/v1/staff/fix/bank', { id: c.id, ticket: TICKET, note: NOTE, was: 0, gold: 5 })).body.error, 'repair-ticket', 'a letter\'s ticket is no bank set\'s');
  // the law's refusals, said: a letter already on its way
  const pend = await s.letter(c, { ticket: 'mob-letter-2' });
  assert.deepEqual([pend.status, pend.body.error], [409, 'letter-pending']);
  // and the call-off, a ticket of its own
  const off = await s.letter(c, { ticket: 'mob-letter-3', op: 'cancel' });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.deepEqual([off.body.op, off.body.was], ['cancel', DARK_BROTHERHOOD_TALLY_TARGET]);
  assert.deepEqual([recordOf(s.env, c.id).darkBrotherhoodRequirementTally, recordOf(s.env, c.id).timeForDarkBrotherhoodLetter], [INVITE_SENT, 0]);
  assert.equal(s.repairs(c.id).find((x) => x.ticket === 'mob-letter-3').flag, GUILD_LETTER_OPS.cancel);
  assert.equal((await s.letter(c, { ticket: 'mob-letter-4', op: 'cancel' })).body.error, 'letter-none');
});
