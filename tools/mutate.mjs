// PINS (2026-09-16, AUDIT SLAM R14): THE MUTATION LISTS ARE COMMITTED, so "N mutations, N dead" is a claim anyone can
// re-run rather than a number in a chat log. The audit found that every slam slice's mutation set lived nowhere in the
// tree, and that at least one full-suite survivor existed per file the sets were meant to cover - the sets were real,
// the "all dead" they implied was not the whole story.
//
//   node tools/mutate.mjs tools/mutants/slam8.json          one list
//   node tools/mutate.mjs tools/mutants/*.json              every list
//
// A list is a JSON array of { name, file, old, new, tests[], equivalent?, why? }. For each: copy the file aside,
// replace the FIRST occurrence of `old` with `new` (the record must be exact - a mutant that does not apply is
// reported, not skipped silently), run the named tests, restore the file byte-for-byte, and say whether the mutant
// SURVIVED (the pins cannot fail it) or died. A survivor is a finding. A mutant marked `equivalent: true` is one the
// slice DECIDED to leave alive - redundant code kept as belt-and-braces, say - and `why` says so; it is expected to
// survive, reported as such, and counted as a failure only if it unexpectedly DIES (the record is then stale).
// Exit 1 if anything unexpectedly survived, unexpectedly died, or failed to apply.
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let survived = 0, noapply = 0, dead = 0, equivalent = 0, stale = 0;
for (const listPath of process.argv.slice(2)) {
  const list = JSON.parse(readFileSync(listPath, 'utf8'));
  console.log(`\n== ${listPath} (${list.length} mutants)`);
  for (const m of list) {
    const src = readFileSync(m.file, 'utf8');
    if (!src.includes(m.old)) { console.log(`  ${m.name}: COULD NOT APPLY - the source moved; update the record`); noapply++; continue; }
    const bak = m.file + '.mutbak';
    copyFileSync(m.file, bak);
    try {
      writeFileSync(m.file, src.replace(m.old, () => m.new));   // a function replacer: `$&`/`$1` in `new` are text, not patterns
      // AUDIT (final lens C): the default 1 MiB maxBuffer is smaller than a whole-suite TAP, and a child killed by
      // ENOBUFS has status null - which this harness once read as "dead (0 failing)". A harness error is neither a
      // death nor a survival; it is reported as itself and fails the run.
      const r = spawnSync('node', ['--test', ...m.tests], { encoding: 'utf8', maxBuffer: 1 << 28 });
      const failing = ((r.stdout ?? '').match(/^not ok/gm) ?? []).length;
      if (r.error || r.status === null) { console.log(`  ${m.name}: HARNESS ERROR (${r.error?.code ?? 'no exit status'}) - not a verdict`); noapply++; continue; }
      if (m.equivalent) {
        if (r.status === 0) { console.log(`  ${m.name}: equivalent, as recorded - ${m.why ?? ''}`); equivalent++; }
        else { console.log(`  ${m.name}: recorded as equivalent but DIED (${failing} failing) - the record is stale`); stale++; }
      } else if (r.status === 0) { console.log(`  ${m.name}: SURVIVED  <-- the pins cannot fail this`); survived++; }
      else { console.log(`  ${m.name}: dead (${failing} failing)`); dead++; }
    } finally {
      copyFileSync(bak, m.file); unlinkSync(bak);
      if (readFileSync(m.file, 'utf8') !== src) { console.log(`  !! ${m.file} NOT RESTORED`); process.exit(2); }
    }
  }
}
console.log(`\n${dead} dead, ${survived} survived, ${equivalent} equivalent as recorded, ${stale} stale records, ${noapply} did not apply`);
process.exit(survived || noapply || stale ? 1 : 0);   // noapply counts harness errors too
