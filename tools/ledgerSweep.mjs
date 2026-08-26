// THE LEDGER SWEEP AID - Port-Ledger section C, cross-referenced against
// the arc docs and the tree. Prints every UNSTRUCK row beside the evidence
// that it might already have shipped, so "is this row still true?" is a
// read instead of a manual grep per row.
//
// TWO SIGNALS, because neither alone found all four stale rows in the
// 2026-08-19 sweep:
//
//   1. ARC HEADINGS. Every closed slice writes a `## ... SHIPPED` (or
//      CLOSED) heading in its arc doc. A row whose feature words show up
//      in one of those headings is very likely closed - this is what
//      catches "breath/drowning + crouch" against "## P12 (breath/drowning
//      + crouch): SHIPPED". The strongest signal, because it compares the
//      row's CLAIM against a slice's own claim.
//   2. MEMBER GREP. The row's DFU members, found in NON-COMMENT src/.
//      Weaker and noisier - a format reader's name (MapsFile) matches for
//      rows about things built ON that reader - but it is the only thing
//      that catches a row closed without a matching heading, which is how
//      MakeHouseContainer shipped inside S2b.
//
// MEASURED, by running it against the PRE-sweep ledger (2f477a1) where
// the four stale rows were still standing:
//   caught 2 of 4 - transition stingers (arc heading, shares
//     [transition, stingers]) and breath/drowning (shares [breath,
//     drowning, crouch] AND AcrobatMotor in code).
//   missed 2 of 4 - interior containers, because the port RENAMED the
//     member (MakeHouseContainer -> isHouseContainerModel), and the
//     U20b career flags, because S23's vocabulary shares nothing with
//     CreateCharSpecialAdvantageWindow.ParseCareerData.
//   2 standing false positives - the two rows naming MapsFile, which is
//     a ported READER that other unported things are built on.
// So: A CLEAN RUN IS NOT PROOF. This narrows ~14 rows to 2-4 worth
// reading. The two it missed are exactly the shape a person catches and
// a matcher cannot - a rename, and a slice that used its own words.
//
// WHY THIS IS AN AID AND NOT A GATE. It cannot decide the question: a
// member matching in src/ might be a real port or a comment saying the
// thing is FLAGGED, and only a person can tell which. Wired into
// `npm run check` it would either fire constantly or - far worse - decay
// into a date-bump nobody reads, a FALSE attestation that section C was
// swept when it was not. A stale row already lies; a rubber-stamped sweep
// line would lie about the lying. So this reports and ranks; a person calls it.
//
// Usage: node tools/ledgerSweep.mjs [--all] [--ledger <path>]
//   --all              also list the rows that matched nothing
//   --ledger <path>    sweep a different copy (used to self-test against
//                      a pre-sweep ledger out of git)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const LEDGER = argv.includes('--ledger')
  ? argv[argv.indexOf('--ledger') + 1]
  : join(ROOT, 'bible/01-Overview/Port-Ledger.md');

// ---- section C's rows -------------------------------------------------
const ledger = readFileSync(LEDGER, 'utf8');
const secC = ledger.slice(ledger.indexOf('## C. DFU features not yet ported'));
const rows = secC.split('\n')
  .filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Feature'))
  .map((l) => {
    const c = l.split('|').slice(1, -1).map((x) => x.trim());
    return { feature: c[0] ?? '', source: c[1] ?? '', target: c[2] ?? '' };
  });
// A `Kept` or `Not planned` row is a DECISION, not a claim that
// something is unported, so it cannot go stale the same way.
//
// STRUCK MEANS THE CLAIM ITSELF IS STRUCK, not that a strikethrough
// appears somewhere in the row. The first rule here was
// `!r.feature.includes('~~')`, which read a NARROWED row - one whose
// closed clause is struck and whose open half stands live beside it,
// the shape this ledger's own "narrow, do not strike" rule produces -
// as fully closed, and dropped it from the sweep. Exactly seven live
// rows were invisible that way when AUDIT 26 closed its parity block.
//
// The convention the file actually follows is that a closed row
// strikes its CLAIM, at the head, and carries the closing note after
// it; a narrowed row leaves its claim standing and strikes only the
// clause that shipped. So read the head, not the whole cell - and do
// not try to measure how much prose survives, because a dated closing
// note is often longer than the claim it retires.
const isStruck = (feature) => feature.trimStart().startsWith('~~');
const open = rows.filter((r) => !isStruck(r.feature) && !/^(Kept|Not planned)/.test(r.target));

// ---- signal 1: the arc docs' own SHIPPED/CLOSED headings --------------
const bible = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (f.endsWith('.md')) bible.push(f);
  }
})(join(ROOT, 'bible'));
const headings = [];
for (const f of bible) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (/^##+ /.test(line) && /\bSHIPPED\b|\bCLOSED\b/.test(line)) {
      headings.push({ file: f.slice(ROOT.length), text: line.replace(/^#+\s*/, '') });
    }
  }
}

// Feature words worth comparing: lowercase, long enough to mean something.
const STOPW = new Set(['interior', 'exterior', 'player', 'system', 'systems', 'shipped', 'closed',
  'classic', 'verbatim', 'arc', 'until', 'their', 'these', 'those', 'which', 'where', 'still',
  'audit', 'window', 'windows', 'effects', 'effect', 'quest', 'items', 'item']);
const wordsOf = (s) => new Set((s.toLowerCase().match(/[a-z][a-z/-]{4,}/g) || [])
  .flatMap((w) => w.split(/[/-]/))
  .filter((w) => w.length >= 5 && !STOPW.has(w)));

// ---- signal 2: DFU members in non-comment src/ ------------------------
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (f.endsWith('.js')) files.push(f);
  }
})(join(ROOT, 'src'));
const tree = files.map((f) => ({ path: f.slice(ROOT.length), src: readFileSync(f, 'utf8') }));

const STOP = new Set(['Systems', 'Rendering', 'Player', 'Audio', 'Combat', 'Kept', 'Unity', 'DFU',
  'Increased', 'Decreased', 'Interior', 'Exterior', 'Assets', 'Scripts']);
// Two CamelCase humps minimum: `Increased` alone is a fragment of a
// slashed compound and matches half the tree; `MakeHouseContainer` is a member.
const membersOf = (s) => [...new Set((s.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || []))]
  .filter((m) => !STOP.has(m) && m.length >= 8);
const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

// ---- report -----------------------------------------------------------
let suspects = 0;
for (const r of open) {
  const fw = wordsOf(r.feature);
  const headHits = headings
    .map((h) => ({ h, shared: [...wordsOf(h.text)].filter((w) => fw.has(w)) }))
    .filter((x) => x.shared.length >= 2)
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 2);

  const memberHits = [];
  for (const m of membersOf(r.source)) {
    let code = 0; const where = new Set();
    for (const f of tree) {
      for (const line of f.src.split('\n')) {
        if (line.includes(m) && !isComment(line)) { code++; where.add(f.path); }
      }
    }
    if (code) memberHits.push({ m, code, where: [...where].slice(0, 2) });
  }

  const hot = headHits.length || memberHits.length;
  if (!hot && !ALL) continue;
  if (hot) suspects++;
  console.log('\n' + (hot ? '  SUSPECT  ' : '  clear    ') + r.feature.slice(0, 86));
  for (const { h, shared } of headHits) {
    console.log(`      arc heading: "${h.text.slice(0, 66)}"`);
    console.log(`                   shares [${shared.join(', ')}]  ${h.file}`);
  }
  for (const h of memberHits) {
    console.log(`      in code:     ${h.m} x${h.code}  ${h.where.join(' ')}`);
  }
}

console.log(`\n${open.length} unstruck rows, ${rows.length - open.length} struck, ${suspects} suspect.`);
console.log('Read each suspect and decide: STRIKE it, NARROW it (say what landed AND what is');
console.log('still open), or leave it. A partial close recorded as a whole one is its own bug.');
if (!ALL) console.log('Run with --all to see the rows that matched nothing.');
