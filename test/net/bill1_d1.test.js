// BILL1 (2026-10-24, Mac, over the month's Cloudflare bill: "Wtf. Is this right?", then "Do everything now";
// bible/11-Multiplayer/Bill-Arc.md): THE ACCOUNT SERVICE'S READS THAT COST THE MOST. D1 read 7.4 billion rows on
// 2026-10-23 and two statements read 4.4 billion of them: the Work tab's eligible pieces (writs.js eligibleHere, 838,000
// rows a call) and the market's crafted pieces (market.js pieceWaysRead, 1.8 million a call). Both asked the decor
// whether a piece stands in a home with `json_extract(item, '$.pv') = p.provenance` - a COLUMN, whose TEXT affinity is
// not the expression index's (none), so the planner could not search idx_home_decor_pv and read it whole for every
// piece. `+p.provenance` is the same value with no affinity, and the index is searched (the live database's own plan,
// asked 2026-10-24, says SCAN before and SEARCH after). SCALE1 C's pin asked the expression of a BOUND value, which was
// always searched - so it passed over every one of these.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { standService, T0 } from '../accountDb.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const planned = () => {
  const db = new DatabaseSync(':memory:');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return (sql) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
};

test('BILL1: every decor provenance asked of a column is spelled `+column`, and so is searched in idx_home_decor_pv - never read whole for each piece (mutants: each `+` dropped)', () => {
  const plan = planned();
  const asked = [];
  for (const f of readdirSync(new URL('../../server-account/src', import.meta.url)).filter((x) => x.endsWith('.js'))) {
    for (const m of src(`server-account/src/${f}`).matchAll(/json_extract\((?:\w+\.)?item, '\$\.pv'\) = ([^\s)]+)/g)) if (!m[1].startsWith('?')) asked.push([f, m[1]]);
  }
  assert.deepEqual(asked.map(([f]) => f).sort(), ['craftWrits.js', 'market.js', 'writs.js'], 'the three lookups that ask it of a column');
  for (const [f, rhs] of asked) {
    assert.match(rhs, /^\+\w+\.provenance$/, `${f}: ${rhs}`);
    const p = plan(`SELECT 1 FROM products p WHERE p.owner = ? AND EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ${rhs.replace(/\w+\./, 'p.')})`);
    assert.match(p, /SEARCH home_decor USING COVERING INDEX idx_home_decor_pv \(<expr>=\?\)/, `${f}: ${p}`);
  }
  assert.match(plan("SELECT 1 FROM products p WHERE p.owner = ? AND EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = p.provenance)"),
    /SCAN home_decor/, 'the spelling without it is the whole-index read this pins against');
});

const DF = 17;
const P = (n) => n.toString(16).padStart(16, '0');

test('BILL1: the Work tab reads a crafter\'s pieces only when a commission it shows names them, open, in this region - the board answers the same (mutant: always read)', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
    const raw = s.env.DB._raw;
    const smith = await s.registered('Silverthorn'), pia = await s.registered('Pia');
    raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?)').run(pia.id, 10_000);
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 4, 4242, 'p1.x', ?)`).run(P(0x51), smith.id, smith.character, T0);
    raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
      VALUES (?, 'craft-51', ?, 'longsword:mithril', 4, 1, ?, 4242, 10, 0, ?, 'n')`).run(smith.id, smith.character, P(0x51), T0);
    const seen = [];
    const prepare = s.env.DB.prepare;
    s.env.DB.prepare = (sql) => { seen.push(sql); return prepare(sql); };
    const pieceReads = () => seen.filter((q) => q.includes('JOIN products p ON p.owner = ?1')).length;
    const list = (who) => s.call('/v1/writs/list', { character: who.character, region: DF }, who.secret);

    assert.equal((await list(smith)).status, 200);
    assert.equal(pieceReads(), 0, 'no commission names the smith: no piece of theirs is read');
    const c = await s.call('/v1/writs/commission', { character: pia.character, region: DF, crafter: 'Silverthorn', recipe: 'longsword:mithril', quality: 2, pay: 500, rid: 'bill1-c1' }, pia.secret);
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal((await list(pia)).status, 200);
    assert.equal(pieceReads(), 0, 'the poster\'s board names them the poster, not the crafter: still none');
    const read = (await list(smith)).body;
    assert.equal(pieceReads(), 1, 'a commission naming the smith here: their pieces read once');
    assert.deepEqual(read.commissions.find((x) => x.id === c.body.commission.id).eligible, [{ provenance: P(0x51), quality: 4 }]);
    assert.equal((await s.call('/v1/writs/list', { character: smith.character, region: DF + 1 }, smith.secret)).status, 200);
    assert.equal(pieceReads(), 1, 'another region\'s board shows that commission as theirs, never to fill here: none read');
  } finally {
    Date.now = realNow;
  }
});

test('AUDIT BILL B2: the gate reads both lists the board shows and only an OPEN commission - one cut from `asked` by its LIMIT but in `mine` still carries its pieces, and its mirror; a closed one naming the smith reads none (mutants: either list dropped; the open test dropped)', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
    const raw = s.env.DB._raw;
    const smith = await s.registered('Silverthorn'), pia = await s.registered('Pia'), other = await s.registered('Otherone');
    raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
      VALUES (?, ?, ?, 'Silverthorn', 'longsword:mithril', 120, 5, 4, 4242, 'p1.x', ?)`).run(P(0x51), smith.id, smith.character, T0);
    raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
      VALUES (?, 'craft-51', ?, 'longsword:mithril', 4, 1, ?, 4242, 10, 0, ?, 'n')`).run(smith.id, smith.character, P(0x51), T0);
    const ins = raw.prepare(`INSERT INTO commissions (id, poster, poster_char, crafter, region, recipe, quality, pay, at, expires_at, rid, n)
      VALUES (?, ?, ?, ?, ?, 'longsword:mithril', 2, 1, ?, ?, ?, 'n')`);
    const seen = [];
    const prepare = s.env.DB.prepare;
    s.env.DB.prepare = (sql) => { seen.push(sql); return prepare(sql); };
    const pieceReads = () => seen.filter((q) => q.includes('JOIN products p ON p.owner = ?1')).length;
    const board = async () => (await s.call('/v1/writs/list', { character: smith.character, region: DF }, smith.secret)).body;
    const PIECES = [{ provenance: P(0x51), quality: 4 }];

    // a closed commission naming the smith here, in `mine` for its week: no piece is asked of it
    raw.prepare(`INSERT INTO commissions (id, poster, poster_char, crafter, region, recipe, quality, pay, at, expires_at, rid, n, state, closed_at)
      VALUES ('shut', ?, ?, ?, ?, 'longsword:mithril', 2, 1, ?, ?, 'b2-shut', 'n', 'withdrawn', ?)`).run(pia.id, pia.character, smith.id, DF, T0 - 10, T0 + 3600, T0 - 5);
    const shut = await board();
    assert.ok(shut.yours.commissions.some((x) => x.id === 'shut'), 'shown among the smith\'s own');
    assert.equal(pieceReads(), 0, 'closed: no piece read');

    // in `mine` alone: fifty sooner-ending commissions here naming another crafter fill `asked`
    ins.run('mineonly', pia.id, pia.character, smith.id, DF, T0, T0 + 9000, 'b2-m');
    for (let i = 0; i < 50; i++) ins.run(`sooner${i}`, pia.id, pia.character, other.id, DF, T0 - 100, T0 + 60 + i, `b2-s${i}`);
    const a = await board();
    assert.equal(a.commissions.find((x) => x.id === 'mineonly'), undefined, 'cut from `asked`');
    assert.deepEqual(a.yours.commissions.find((x) => x.id === 'mineonly').eligible, PIECES, 'and offered its pieces in `mine`');
    raw.prepare("DELETE FROM commissions WHERE id = 'mineonly' OR id LIKE 'sooner%'").run();

    // in `asked` alone: fifty newer commissions of the smith's own, elsewhere, fill `mine`
    ins.run('askedonly', pia.id, pia.character, smith.id, DF, T0 - 50, T0 + 9000, 'b2-a');
    for (let i = 0; i < 50; i++) ins.run(`newer${i}`, smith.id, smith.character, other.id, DF + 1, T0 + 1 + i, T0 + 9000, `b2-n${i}`);
    const b = await board();
    assert.equal(b.yours.commissions.find((x) => x.id === 'askedonly'), undefined, 'cut from `mine`');
    assert.deepEqual(b.commissions.find((x) => x.id === 'askedonly').eligible, PIECES, 'and offered its pieces in `asked`');
  } finally {
    Date.now = realNow;
  }
});

test('AUDIT BILL B1: a piece\'s maker is found by the piece - both of the statements that ask it of prof_crafts search an index by player and provenance, never the player\'s every craft (mutants: the OR put back; an index dropped)', () => {
  const plan = planned();
  for (const [f, alias] of [['writs.js', ''], ['craftWrits.js', 'cr.']]) {
    const text = src(`server-account/src/${f}`);
    for (const col of ['provenance', 'provenance2']) {
      const m = new RegExp(`EXISTS \\(SELECT 1 FROM prof_crafts(?: cr)? WHERE ${alias.replace('.', '\\.')}player = [^)]+? AND ${alias.replace('.', '\\.')}${col} = (\\w+)\\.provenance\\)`).exec(text);
      assert.ok(m, `${f}: one EXISTS for ${col}`);
      const p = plan(`SELECT 1 FROM products ${m[1]} WHERE ${m[1]}.owner = 'x' AND EXISTS (SELECT 1 FROM prof_crafts WHERE player = 'x' AND ${col} = ${m[1]}.provenance)`);
      assert.match(p, new RegExp(`SEARCH prof_crafts USING COVERING INDEX idx_prof_crafts_${col} \\(player=\\? AND ${col}=\\?\\)`), `${f} ${col}: ${p}`);
    }
    assert.doesNotMatch(text, /provenance = \w+\.provenance OR \w*\.?provenance2 = \w+\.provenance/, `${f}: no OR of the two in one EXISTS`);
  }
});
