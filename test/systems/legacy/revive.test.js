// REVIVE (2026-10-14, Mac, of TheHalfinStream: "I want to roll back this specific account", then "Undo the death",
// then "Full revive"; bible/06-Systems/Legacy-Arc.md REVIVE) - A DEATH TAKEN BACK, AND IT HOLDS.
//   - the law (src/systems/legacy/revived.js): a death taken back is stamped `revived: [diedAt]`, and every copy that
//     meets the stamp drops THAT death with its remains row and its Succession - the client's merges and the realm's
//     write (legacy.js putLineage) alike;
//   - the operator's plan (tools/reviveRealmCharacter.mjs), driven here over the real death: the repo's own putLineage,
//     realmDie, inheritHome and ledger write it, the tool's own queries read it before and after, and its plan is run;
//   - the workflow (.github/workflows/realm-revive.yml) holds the shape realm-restore.yml proved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { d1 } from '../../accountDb.mjs';
import { putLineage, realmDie } from '../../../server-account/src/legacy.js';
import { inheritHome } from '../../../server-account/src/homes.js';
import { ledgerStep, DUPE_GRACE_S } from '../../../server-account/src/ledger.js';
import { revivedOf, stampRevived, dropRevived, takeRevived } from '../../../src/systems/legacy/revived.js';
import { mergeFacts } from '../../../src/systems/legacy/store.js';
import { mergeLines } from '../../../src/systems/legacy/realmLine.js';
import { readFamily } from '../../../src/systems/legacy/family.js';
import { mergeFamily } from '../../../src/scenes/legacyHost.js';
import { query, playerQuery, findFallen, planRevive, summaryOf, recordEdit, REV_MARGIN, BEFORE_DEATH_S, STATEMENT_MAX_BYTES } from '../../../tools/reviveRealmCharacter.mjs';
import { GUILD_RANK_MASTER } from '../../../src/net/guild/guildLaw.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const P = 'p0123456789abcdef0123456789abcde', Q = 'q0123456789abcdef0123456789abcde';
const F = `r${'f'.repeat(20)}`, H = `r${'e'.repeat(20)}`, G = `r${'d'.repeat(20)}`;
const LID = 'fam-abc-abcdef';
const DIED_AT = 999;
const A = 'aaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbb', C = 'cccccccccccccccc';
const DEAD_S = Date.parse('2026-10-13T18:00:00Z') / 1000;

/** The line as the device writes it: Ysolde (F) the founder; dead of her years in Wayrest; then her heir Tlist (H). */
const fam = (rev, { died = false, heir = false, revived = false } = {}) => ({
  v: 1, id: LID, rev, surname: 'Hlaalu', model: 'enduring', nextId: heir ? 2 : 1, currentId: heir ? 1 : 0,
  people: [
    { id: 0, kind: 'member', given: 'Ysolde', characterId: F, parents: [], children: heir ? [1] : [], toll: 50, born: 1,
      ...(died ? { died: { at: DIED_AT, cause: 'years', place: { mode: 'dungeon', region: 'Wayrest', loc: 'Wayrest' }, by: null } } : {}),
      ...(revived ? { revived: [DIED_AT] } : {}) },
    ...(heir ? [{ id: 1, kind: 'member', given: 'Tlist', characterId: H, parents: [0], children: [], born: 1000 }] : []),
  ],
  remains: died ? [{ id: 'r0', of: 0, name: 'Ysolde Hlaalu', items: [], state: 'lying', by: null, at: DIED_AT }] : [],
  pending: died && !heir ? { fallenId: 0, at: DIED_AT, estate: 3000, bequest: [] } : null,
  houses: [{ regionIndex: 17, mapId: 4242, buildingKey: 7, location: 'Wayrest', by: heir && died ? 1 : 0, ...(heir && died ? { from: 0 } : {}) }],
});

// ── THE LAW ─────────────────────────────────────────────────────────────

test('REVIVE: a stamp drops THAT death - its remains row and its Succession with it - and no other: a later death, another member\'s, another line\'s remains stand (mutants: every death dropped; the remains kept; the Succession kept)', () => {
  const f = fam(3, { died: true });
  f.people.push({ id: 5, kind: 'member', given: 'Old', died: { at: 10, cause: 'years' }, parents: [], children: [] });
  f.remains.push({ id: 'r5', of: 5, at: 10, state: 'lying' });
  assert.equal(dropRevived(f), false, 'nothing stamped, nothing dropped');
  stampRevived(f.people[0], DIED_AT);
  stampRevived(f.people[0], DIED_AT);
  assert.deepEqual(revivedOf(f.people[0]), [DIED_AT], 'a stamp twice is one stamp');
  assert.equal(dropRevived(f), true);
  assert.equal(f.people[0].died, null);
  assert.deepEqual(f.remains.map((r) => r.id), ['r5'], 'her remains go, another\'s stay');
  assert.equal(f.pending, null);
  assert.ok(f.people[1].died, 'another member\'s death stands');
  const later = fam(3, { died: true, revived: true });
  later.people[0].died.at = DIED_AT + 500;
  later.remains[0].at = DIED_AT + 500; later.pending.at = DIED_AT + 500;
  assert.equal(dropRevived(later), false, 'a LATER death is another `at`, and stands');
  assert.ok(later.people[0].died && later.remains.length === 1 && later.pending);
});

test('REVIVE: every merge hears the stamp, whichever copy carries it and whichever is the base - a stale copy\'s death, remains and Succession are never taken back in (mutants: mergeFacts deaf; mergeFamily deaf with the store the base; readFamily drops the stamp)', () => {
  const stamped = fam(150, { heir: true, revived: true });
  const stale = fam(3, { died: true, heir: true });
  // the device's pull, both rev orders (realmLine.js mergeLines)
  for (const [a, b] of [[stale, stamped], [stamped, stale]]) {
    const kept = mergeLines(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
    assert.equal(kept.people[0].died, null, 'the pull killed her again');
    assert.deepEqual(revivedOf(kept.people[0]), [DIED_AT]);
    assert.equal(kept.remains.length, 0);
  }
  // mergeFacts straight: the stamped copy the base, the stale one taken in
  const m = readFamily(JSON.parse(JSON.stringify(stamped)));
  mergeFacts(m, readFamily(JSON.parse(JSON.stringify(stale))));
  assert.equal(m.people[0].died, null);
  assert.equal(m.pending ?? null, null, 'the stale copy\'s Succession was taken in');
  // a stale STORE the base (the higher rev), the revived member's own save stamped: loading her plays her
  const store = readFamily(fam(200, { died: true, heir: true }));
  const save = readFamily(fam(1, { revived: true }));
  const loaded = mergeFamily(store, save, F);
  assert.equal(loaded.people.find((p) => p.characterId === F).died, null, 'her own save loaded her as the past');
  assert.deepEqual(readFamily(stamped).people[0].revived, [DIED_AT], 'the family reader dropped the stamp');
  assert.equal(takeRevived(null, stamped), false);
});

// ── THE REALM, AND THE OPERATOR'S PLAN, OVER THE REAL DEATH ─────────────

/** The death as the game writes it, and what the tool reads then and now. */
async function theDeath({ master = true, other = true } = {}) {
  const db = d1();
  const raw = db._raw;
  for (const [id, h] of [[P, 'TheHalfinStream'], [Q, 'Other']]) raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen, password) VALUES (?, ?, ?, ?, 0, 0, ?)').run(id, h, h.toLowerCase(), h, 'x');
  const rc = (id, player, person, lease, created = 0) => raw.prepare('INSERT INTO realm_characters (id, player, name, seq, bytes, lease, lease_at, created_at, updated_at, obj, lineage_id, person_id) VALUES (?, ?, ?, 5, 100, ?, 0, ?, 0, ?, ?, ?)')
    .run(id, player, id === F ? 'Ysolde' : id, lease, created, `realm/${player}/${id}/5-aaaa`, person == null ? null : LID, person);
  const LEASE = 'a'.repeat(32);
  rc(F, P, 0, LEASE); rc(G, Q, null, null);
  let nowS = DEAD_S - 3600;
  assert.ok((await putLineage({ db, nowS }, P, { id: LID, record: fam(1) })).ok);
  raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('gabcdefghij', 'Wayrest Blades', 'wayrest blades', 'WB', '[]', 0, 1)").run();
  raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, 'gabcdefghij', ?, 'Ysolde', 10)").run(P, F, master ? GUILD_RANK_MASTER : 3);
  if (other) raw.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, 'gabcdefghij', 3, 'Other', 20)").run(Q, G);
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at, paid) VALUES (4242, 7, ?, ?, 'Ysolde', 17, 1000, 1, 1000)").run(P, F);
  for (const [k, fp] of [[A, '1:2'], [B, '1:3'], [C, '1:4']]) raw.prepare("INSERT INTO item_uids (uid, player, char_id, seen_seq, state, fp, at) VALUES (?, ?, ?, 5, 'held', ?, 0)").run(k, P, F, fp);
  raw.prepare('INSERT INTO item_dupes (uid, char_id, at) VALUES (?, ?, 0)').run(B, G);

  const ask = (sql) => raw.prepare(sql).all();
  const facts = () => {
    const player = ask(playerQuery('thehalfinstream'))[0] ?? null;
    return { player, chars: ask(query('chars', { player: P })), lineages: ask(query('lineages', { player: P })) };
  };
  const then = { seat: ask(query('seat', { player: P, fallen: F })), homes: ask(query('homes', { player: P })), items: ask(query('items', { player: P, fallen: F })), unions: ask(query('unions', { player: P, fallen: F })) };

  // THE DEATH: the device's lineage write and the tab's die, as onDeath sends them
  nowS = DEAD_S;
  assert.ok((await putLineage({ db, nowS }, P, { id: LID, record: fam(2, { died: true }), base: 1 })).ok);
  assert.ok((await realmDie({ db, nowS }, P, { id: F, lease: LEASE, why: 'fell' })).ok);
  // THE HEIR: born, the line's record carries them, the house inherited, and their checkpoint shows A (a grafted piece)
  rc(H, P, 1, 'b'.repeat(32), DEAD_S + 60);
  assert.ok((await putLineage({ db, nowS: DEAD_S + 60 }, P, { id: LID, record: fam(3, { died: true, heir: true }), base: 2 })).ok);
  assert.ok((await inheritHome({ db }, { id: P, handle: 'TheHalfinStream', password: 'x' }, { mapId: 4242, buildingKey: 7, character: H, from: F })).ok);
  const s = await ledgerStep(db, { player: P, char: H, seq: 6, nowS: DEAD_S + 70 }, [{ key: A, fp: '1:2' }]);
  await db.batch(s.steps);
  return { db, raw, ask, facts, then };
}
const nowFacts = (ask, guild, then) => ({
  chars: ask(query('chars', { player: P })), lineages: ask(query('lineages', { player: P })), homes: ask(query('homes', { player: P })),
  unions: ask(query('unions', { player: P, fallen: F })), guild: ask(query('guild', { player: P, guild })),
  items: ask(query('itemsNow', { player: P, uids: then.items.filter((r) => r.state === 'held').map((r) => r.uid) })),
});

test('REVIVE: the operator\'s plan over the real death - the tombstone cleared, the line stamped (her remains and Succession gone, the house row hers, the rev past every copy\'s), the home back, her seat back, the heir\'s piece hers again and the heir\'s copy a known one; written twice, nothing twice (mutants: the stamp unwritten; the rev unmoved; the home kept; the piece left the heir\'s)', async () => {
  const { raw, ask, facts, then } = await theDeath({ master: false });
  const found = findFallen(facts());
  assert.equal(found.fallen, F);
  assert.equal(found.diedAt, DIED_AT);
  assert.deepEqual(found.heirs, [H]);
  assert.equal(found.deadAt - BEFORE_DEATH_S, DEAD_S - BEFORE_DEATH_S, 'the past is read two minutes before the tombstone');
  const now = nowFacts(ask, then.seat[0].guild_id, then);
  const nowS = DEAD_S + 86400;
  const plan = planRevive({ then, now, found, player: P, nowS });
  assert.deepEqual(plan.held, []);
  for (const stmt of plan.sql) raw.exec(stmt);

  const f = raw.prepare('SELECT dead_at, dead_why, lease FROM realm_characters WHERE id = ?').get(F);
  assert.deepEqual({ ...f }, { dead_at: null, dead_why: null, lease: null }, 'the tombstone stands');
  const line = raw.prepare('SELECT rev, record FROM lineages WHERE id = ?').get(LID);
  const rec = JSON.parse(line.record);
  assert.equal(rec.people[0].died, null);
  assert.deepEqual(rec.people[0].revived, [DIED_AT], 'the death taken back is unstamped - the first stale copy kills her again');
  assert.deepEqual(rec.remains, []);
  assert.equal(line.rev, 3 + REV_MARGIN);
  assert.deepEqual(rec.houses.map((h) => [h.by, h.from]), [[0, undefined]], 'the house row is still the heir\'s');
  assert.equal(raw.prepare('SELECT char_id FROM homes WHERE map_id = 4242').get().char_id, F, 'the home is still the heir\'s');
  assert.equal(raw.prepare('SELECT rank FROM guild_members WHERE char_id = ?').get(F)?.rank, 3, 'her seat was not put back');
  assert.equal(raw.prepare('SELECT char_id FROM item_uids WHERE uid = ?').get(A).char_id, F, 'the piece the heir holds is not hers again');
  assert.ok(raw.prepare('SELECT 1 FROM item_dupes WHERE uid = ? AND char_id = ?').get(A, H), 'the heir\'s copy is not a known copy');
  // a second run, read afresh, writes nothing twice
  const again = planRevive({ then, now: nowFacts(ask, then.seat[0].guild_id, then), found: { ...found, living: 2 }, player: P, nowS });
  const before = JSON.stringify(raw.prepare('SELECT * FROM lineages').all()) + JSON.stringify(raw.prepare('SELECT * FROM item_uids').all()) + JSON.stringify(raw.prepare('SELECT * FROM guild_members').all());
  for (const stmt of again.sql) raw.exec(stmt);
  assert.equal(JSON.stringify(raw.prepare('SELECT * FROM lineages').all()) + JSON.stringify(raw.prepare('SELECT * FROM item_uids').all()) + JSON.stringify(raw.prepare('SELECT * FROM guild_members').all()), before, 'a second run wrote again');
  assert.match(summaryOf({ handle: 'TheHalfinStream', found, plan, apply: false }), /A dry run: nothing was written/);
});

/**
 * The tool's own command line, run as the workflow's own line writes it: the line read out of realm-revive.yml, its
 * words split as bash splits them, `$HANDLE`, `$CHARACTER`, `$RUNNER_TEMP` and `$flags` put in as the step puts them.
 * @param {string} mode @param {Record<string, string>} vars @param {string} cwd
 */
function runAsTheWorkflow(mode, vars, cwd) {
  const line = src('.github/workflows/realm-revive.yml').split('\n').map((l) => l.trim()).find((l) => l.startsWith(`node $tool ${mode} `));
  assert.ok(line, `the workflow no longer runs the tool's ${mode}`);
  const words = line.slice('node $tool '.length).split(' > ')[0].trim().split(/\s+/)
    .flatMap((w) => (w === '$flags' ? (vars.flags ? vars.flags.trim().split(/\s+/) : []) : [w.replace(/^"|"$/g, '').replace(/\$(HANDLE|CHARACTER|RUNNER_TEMP)/g, (_, k) => vars[k])]));
  const out = spawnSync(process.execPath, [new URL('../../../tools/reviveRealmCharacter.mjs', import.meta.url).pathname, ...words], { cwd, encoding: 'utf8' });
  assert.equal(out.status, 0, `the workflow's ${mode} line fails the tool: ${out.stderr}`);
  return out.stdout;
}

test('REVIVE: the tool\'s command line as the workflow\'s lines run it - the find, then the plan (whose line carries --find too: the first run took it for a find and failed), as Mac ran it (keep_homes, apply) and as a dry run; the mode is the first word of every line (mutant: the mode any word)', async () => {
  const { raw, ask, facts, then } = await theDeath({ master: false });
  const dir = mkdtempSync(join(tmpdir(), 'revive-'));
  try {
    const vars = { HANDLE: 'TheHalfinStream', CHARACTER: '', RUNNER_TEMP: dir };
    writeFileSync(join(dir, 'facts.json'), JSON.stringify(facts()));
    writeFileSync(join(dir, 'found.json'), runAsTheWorkflow('--find', vars, dir));
    const found = JSON.parse(readFileSync(join(dir, 'found.json'), 'utf8'));
    assert.equal(found.fallen, F);
    assert.equal(found.before, DEAD_S - BEFORE_DEATH_S, 'the moment the workflow rewinds to');
    writeFileSync(join(dir, 'then.json'), JSON.stringify(then));
    writeFileSync(join(dir, 'now.json'), JSON.stringify(nowFacts(ask, then.seat[0].guild_id, then)));
    // the dry run
    assert.match(runAsTheWorkflow('--plan', { ...vars, flags: '' }, dir), /^\d+ statement\(s\), 0 held\n$/);
    assert.match(readFileSync(join(dir, 'summary.md'), 'utf8'), /A dry run: nothing was written/);
    // as Mac ran it: the homes left with the heir, the revive written
    runAsTheWorkflow('--plan', { ...vars, flags: ' --keep-homes --apply' }, dir);
    assert.doesNotMatch(readFileSync(join(dir, 'summary.md'), 'utf8'), /A dry run/);
    for (const stmt of readFileSync(join(dir, 'revive.sql'), 'utf8').split('\n').filter(Boolean)) raw.exec(stmt);
    assert.equal(raw.prepare('SELECT dead_at FROM realm_characters WHERE id = ?').get(F).dead_at, null, 'the tombstone stands');
    assert.deepEqual(JSON.parse(raw.prepare('SELECT record FROM lineages WHERE id = ?').get(LID).record).people[0].revived, [DIED_AT]);
    assert.equal(raw.prepare('SELECT char_id FROM homes WHERE map_id = 4242').get().char_id, H, 'keep_homes moved the home anyway');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // every line of the workflow names its mode first, and the tool reads its mode from the first word alone
  const calls = [...src('.github/workflows/realm-revive.yml').matchAll(/node \$tool (--[a-z-]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(calls)].sort(), ['--find', '--plan', '--player-query', '--query']);
  assert.match(src('tools/reviveRealmCharacter.mjs'), /const mode = argv\[0\];/);
});

test('REVIVE-SIZE: a line\'s record past what one D1 statement takes is revived by an edit in place - the statement small, the record it leaves exactly the revival\'s, the rest of the record as it was; the line written before the tombstone; a plan with any statement too long writes nothing; an edit that cannot say the change is refused (mutants: the whole record in the statement; the tombstone first; the long statement written)', async () => {
  const { raw, ask, facts, then } = await theDeath({ master: false });
  // the line as a long-played house holds it: its news past 100 KB (a record may be 128 KiB)
  const news = Array.from({ length: 1100 }, (_, i) => ({ at: i, kind: 'deed', text: `The house of Hlaalu was spoken of in Wayrest, the ${i}th time, with a quote's "marks" and a dash - ${'x'.repeat(40)}` }));
  raw.prepare('UPDATE lineages SET record = json_set(record, \'$.news\', json(?)) WHERE id = ?').run(JSON.stringify(news), LID);
  const stored = raw.prepare('SELECT rev, record FROM lineages WHERE id = ?').get(LID);
  assert.ok(stored.record.length > STATEMENT_MAX_BYTES, `the record is not past one statement (${stored.record.length})`);
  const found = findFallen(facts());
  const plan = planRevive({ then, now: nowFacts(ask, then.seat[0].guild_id, then), found, player: P, nowS: DEAD_S + 86400 });
  assert.deepEqual(plan.held, []);
  const line = plan.sql.findIndex((q) => q.startsWith('UPDATE lineages'));
  const tomb = plan.sql.findIndex((q) => q.startsWith('UPDATE realm_characters'));
  assert.ok(line >= 0 && tomb > line, 'the tombstone is cleared before the line is stamped - a write cut between them leaves her alive under a line that entombs her again');
  assert.ok(plan.sql[line].length < 8000, `the line's statement carries the whole record (${plan.sql[line].length} chars)`);
  // what the revival makes, by the law itself, over the record as stored
  const want = JSON.parse(stored.record);
  const me = want.people.find((p) => p.id === 0);
  stampRevived(me, DIED_AT);
  dropRevived(want);
  want.houses = want.houses.map((h) => (h.from === 0 ? (({ from, ...row }) => ({ ...row, by: 0 }))(h) : h));   // eslint-disable-line no-unused-vars
  want.rev = stored.rev + REV_MARGIN;
  for (const q of plan.sql) raw.exec(q);
  const got = JSON.parse(raw.prepare('SELECT record FROM lineages WHERE id = ?').get(LID).record);
  const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
  assert.equal(canon(got), canon(want), 'the record the edit left is not the revival\'s');
  assert.equal(got.news.length, 1100, 'the rest of the record was not kept');
  assert.equal(raw.prepare('SELECT dead_at FROM realm_characters WHERE id = ?').get(F).dead_at, null);
  // ALL OR NOTHING: one statement past what D1 takes, and nothing is written
  const big = planRevive({ then: { ...then, seat: [{ ...then.seat[0], name: 'y'.repeat(STATEMENT_MAX_BYTES) }] }, now: nowFacts(ask, then.seat[0].guild_id, then), found: { ...found, living: 1 }, player: P, nowS: DEAD_S + 86400 });
  assert.deepEqual(big.sql, [], 'a plan with a statement D1 refuses wrote the rest');
  assert.match(big.held.join('\n'), /longer than D1 takes .* NOTHING written/);
  // an edit refuses a change it cannot say: anything but the people, the remains, the Succession, the houses, the rev
  const w = { people: [{ id: 0 }], remains: [], houses: [], rev: 1, surname: 'A' };
  assert.equal(recordEdit(w, { ...w, surname: 'B', rev: 2 }), null);
  assert.equal(recordEdit(w, { ...w, people: [], rev: 2 }), null);
  assert.match(recordEdit(w, { ...w, rev: 2 }), /^json_set\(record, '\$\.rev', json\('2'\)\)$/);
});

test('REVIVE: and it HOLDS - a stale device\'s copy (the death in it) written after the revival stores no death and entombs nobody; her checkpoint and her heir\'s then charge nobody a copy; a LATER real death is a death (mutants: putLineage deaf to the stored stamp)', async () => {
  const { db, raw, ask, facts, then } = await theDeath({ master: false });
  const found = findFallen(facts());
  const plan = planRevive({ then, now: nowFacts(ask, then.seat[0].guild_id, then), found, player: P, nowS: DEAD_S + 86400 });
  for (const stmt of plan.sql) raw.exec(stmt);
  const rev = raw.prepare('SELECT rev FROM lineages WHERE id = ?').get(LID).rev;
  // the stale device writes its copy on the stored base (a pull read the rev, never the stamp - an older build's)
  const stale = fam(rev + 1, { died: true, heir: true });
  const w = await putLineage({ db, nowS: DEAD_S + 90000 }, P, { id: LID, record: stale, base: rev });
  assert.ok(w.ok);
  const stored = JSON.parse(raw.prepare('SELECT record FROM lineages WHERE id = ?').get(LID).record);
  assert.equal(stored.people[0].died, null, 'the stale copy stored the death again');
  assert.deepEqual(stored.remains, []);
  assert.equal(raw.prepare('SELECT dead_at FROM realm_characters WHERE id = ?').get(F).dead_at, null, 'the stale copy entombed her again');
  // her own checkpoint shows A and C, her heir's still A past the grace: nobody is charged a copy
  let s = await ledgerStep(db, { player: P, char: F, seq: 6, nowS: DEAD_S + 90010 }, [{ key: A, fp: '1:2' }, { key: C, fp: '1:4' }]);
  await db.batch(s.steps);
  s = await ledgerStep(db, { player: P, char: H, seq: 7, nowS: DEAD_S + 90020 + DUPE_GRACE_S }, [{ key: A, fp: '1:2' }]);
  await db.batch(s.steps);
  assert.equal(raw.prepare('SELECT dupes FROM realm_characters WHERE id = ?').get(F).dupes ?? 0, 0, 'the revived character was charged the heir\'s copy');
  // a LATER death - her years are spent - is a death, and the realm entombs her for it
  const lease = 'c'.repeat(32);
  raw.prepare('UPDATE realm_characters SET lease = ? WHERE id = ?').run(lease, F);
  const later = JSON.parse(JSON.stringify(stored));
  later.rev = rev + 2;
  later.people[0].died = { at: DIED_AT + 700, cause: 'years', place: null, by: null };
  assert.ok((await putLineage({ db, nowS: DEAD_S + 99999 }, P, { id: LID, record: later, base: rev + 1 })).ok);
  assert.notEqual(raw.prepare('SELECT dead_at FROM realm_characters WHERE id = ?').get(F).dead_at, null, 'a later death was taken back too');
});

test('REVIVE: the plan HOLDS what it must not write - her master\'s seat another took, a full roster, her union - and the queries take no id but D1\'s own shapes (mutants: the master restored over another; the roster ignored)', async () => {
  const { ask, facts, then } = await theDeath({ master: true });
  const found = findFallen(facts());
  const now = nowFacts(ask, then.seat[0].guild_id, then);
  assert.match(now.guild[0].master, new RegExp(`^${Q}:${G}$`), 'the other was made master at her death');
  const plan = planRevive({ then: { ...then, unions: [{ sid: 's1', a_player: P, a_char: F, b_player: Q, b_char: G, ended_at: null }] }, now, found, player: P, nowS: DEAD_S + 86400 });
  assert.ok(plan.held.some((h) => /was made master at her death/.test(h)), 'her master\'s seat was written over another\'s');
  assert.ok(!plan.sql.some((s) => /guild_members/.test(s)));
  assert.ok(plan.held.some((h) => /wed to/.test(h)));
  const full = planRevive({ then, now, found: { ...found, living: 6 }, player: P, nowS: DEAD_S + 86400 });
  assert.ok(!full.sql.some((s) => /UPDATE realm_characters/.test(s)), 'a full roster was written past');
  assert.ok(full.held.some((h) => /roster/.test(h)));
  // the window: none, or two, fell in it - name one
  assert.match(findFallen({ player: { id: P }, chars: [], lineages: [] }).error, /0 realm characters/);
  assert.match(findFallen({ player: null, chars: [], lineages: [] }).error, /no registered account/);
  for (const bad of [["x' OR 1=1 --", F], [P, "r' OR 1=1"]]) assert.throws(() => query('seat', { player: bad[0], fallen: bad[1] }));
  assert.throws(() => playerQuery("a b"), /not a handle/);
  assert.equal(playerQuery("O'Brien"), "SELECT id, handle FROM players WHERE handle_lc = 'o''brien' AND handle IS NOT NULL", 'a quote in a handle is data');
});

test('REVIVE: the tombstone is cleared only over the death the plan read - a death since (her years are spent) stands - and the heir is a character of the line born SINCE the death, never a living sibling played before it (mutants: the tombstone unguarded; the heir any living member)', async () => {
  const { raw, ask, facts, then } = await theDeath({ master: false });
  const f = facts();
  const found = findFallen(f);
  const plan = planRevive({ then, now: nowFacts(ask, then.seat[0].guild_id, then), found, player: P, nowS: DEAD_S + 86400 });
  raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(DEAD_S + 5000, F);   // she died again before the run wrote
  for (const stmt of plan.sql) raw.exec(stmt);
  assert.equal(raw.prepare('SELECT dead_at FROM realm_characters WHERE id = ?').get(F).dead_at, DEAD_S + 5000, 'a death the plan never read was cleared');
  const sib = `r${'1'.repeat(20)}`;
  f.chars.push({ id: sib, name: 'Sib', lineage_id: LID, person_id: 7, dead_at: null, dead_why: null, created_at: DEAD_S - 100 });
  assert.deepEqual(findFallen(f).heirs, [H], 'a sibling played before the death was taken for her heir');
});

test('REVIVE: the workflow - by hand, a dry run by default, its inputs as environment, found before anything is held, the present ALWAYS put back, and the maintenance never lifted over a rewound database (mutants: apply by default; an input spliced; the lift over a rewind)', () => {
  const wf = src('.github/workflows/realm-revive.yml');
  assert.match(wf, /on:\n  workflow_dispatch:/);
  assert.match(wf, /      apply:\n        description: [^\n]*\n        required: true\n        default: false/);
  assert.doesNotMatch(wf, /run: [^\n]*\$\{\{ inputs\./, 'an input spliced into a run line');
  assert.match(wf, /HANDLE: \$\{\{ inputs\.handle \}\}/);
  assert.ok(wf.indexOf('- name: Find the character') < wf.indexOf('- name: Hold the service for maintenance'), 'held before anything was found');
  assert.match(wf, /- name: Put the present back\n        if: always\(\) && env\.REWOUND == '1'/);
  assert.match(wf, /- name: Lift the maintenance\n        if: always\(\) && env\.HELD == '1' && env\.REWOUND != '1'/);
  assert.match(wf, /- name: Write the revive\n        if: env\.APPLY == 'true'/);
  assert.match(wf, /group: account-deploy/);
});
