// PINS (2026-09-16, AUDIT SLAM R14): THE MUTATION LISTS ARE COMMITTED, so "N mutations, N dead" is a claim anyone can
// re-run rather than a number in a chat log. The audit found that every slam slice's mutation set lived nowhere in the
// tree, and that at least one full-suite survivor existed per file the sets were meant to cover - the sets were real,
// the "all dead" they implied was not the whole story.
//
//   node tools/mutate.mjs tools/mutants/slam8.json          one list
//   node tools/mutate.mjs tools/mutants/*.json              every list
//
// A list is a JSON array of { name, file, old, new, tests[], equivalent?, why?, syntax? }. For each: copy the file aside,
// replace the FIRST occurrence of `old` with `new` (the record must be exact - a mutant that does not apply is
// reported, not skipped silently - and name ONE site: a text that stands twice is aimed at whichever copy is higher
// up, so a copy added above the one it was written for takes its mutant; test/mutantdrift.test.js's MUT-AIM holds
// every record to one), run the named tests, restore the file byte-for-byte, and say whether the mutant
// SURVIVED (the pins cannot fail it) or died. A survivor is a finding. A mutant marked `equivalent: true` is one the
// slice DECIDED to leave alive - redundant code kept as belt-and-braces, say - and `why` says so; it is expected to
// survive, reported as such, and counted as a failure only if it unexpectedly DIES (the record is then stale).
// Exit 1 if anything unexpectedly survived, unexpectedly died, or failed to apply; 2 if a source could not be put back
// (or a previous run's backup is still lying there); 130 if interrupted, after the file in hand is restored.
// A record whose mutant is MEANT not to parse (a second declaration beside an import, say) carries `syntax: true`;
// every other mutant of a .js/.mjs/.cjs file must parse, or it is reported as not a verdict (AUDIT 68).
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const lists = process.argv.slice(2).map((listPath) => [listPath, JSON.parse(readFileSync(listPath, 'utf8'))]);

// AUDIT 68 X5-mutate-interrupt-loses-source: a `.mutbak` left by an interrupted run is the only clean copy of its
// file, and this run's first copyFileSync over it would destroy it. Nothing is touched while one exists.
const leftovers = [...new Set(lists.flatMap(([, list]) => list.map((m) => m.file)))].filter((f) => existsSync(`${f}.mutbak`));
if (leftovers.length) {
  for (const f of leftovers) console.log(`${f}.mutbak exists - a previous run was interrupted: move it back over ${f} and re-run`);
  process.exit(2);
}

// A signal must not kill this process mid-mutant: the finally below is what puts the source back. So the signal is
// noted, handed to the child, and the run stops once the file is restored. The children run ASYNC for the same
// reason - a handler cannot run while spawnSync blocks, and an interrupted `node --test` exits 1 like a failing one.
let interrupted = null, child = null;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { interrupted = sig; child?.kill(sig); });

/** `node <args>`, stdout collected in full - no buffer ceiling to overflow (AUDIT final lens C: the default 1 MiB
 *  maxBuffer was smaller than a whole-suite TAP, and a child killed by ENOBUFS once read as "dead (0 failing)"). */
const run = (args) => new Promise((resolve) => {
  const chunks = [];
  child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  child.stdout.on('data', (c) => chunks.push(c));
  child.on('error', (error) => { child = null; resolve({ status: null, signal: null, error, stdout: '' }); });
  child.on('close', (status, signal) => { child = null; resolve({ status, signal, error: null, stdout: Buffer.concat(chunks).toString('utf8') }); });
});

let survived = 0, noapply = 0, dead = 0, equivalent = 0, stale = 0;
for (const [listPath, list] of lists) {
  console.log(`\n== ${listPath} (${list.length} mutants)`);
  for (const m of list) {
    const src = readFileSync(m.file, 'utf8');
    if (!src.includes(m.old)) { console.log(`  ${m.name}: COULD NOT APPLY - the source moved; update the record`); noapply++; continue; }
    const bak = m.file + '.mutbak';
    copyFileSync(m.file, bak);
    try {
      writeFileSync(m.file, src.replace(m.old, () => m.new));   // a function replacer: `$&`/`$1` in `new` are text, not patterns
      // AUDIT 68 X5-mutant-records-die-by-syntax-error: a mutant that does not parse fails every test that loads the
      // file, so its "dead" says nothing about the pins the record names.
      if (!m.syntax && /\.[cm]?js$/.test(m.file)) {
        const chk = await run(['--check', m.file]);
        if (interrupted) continue;
        if (chk.status !== 0) { console.log(`  ${m.name}: DOES NOT PARSE - not a verdict; re-aim the record by content`); noapply++; continue; }
      }
      const r = await run(['--test', ...m.tests]);
      if (interrupted) continue;
      const failing = (r.stdout.match(/^not ok/gm) ?? []).length;
      // A harness error is neither a death nor a survival; it is reported as itself and fails the run.
      if (r.error || r.status === null) { console.log(`  ${m.name}: HARNESS ERROR (${r.error?.code ?? `signal ${r.signal}`}) - not a verdict`); noapply++; continue; }
      if (m.equivalent) {
        if (r.status === 0) { console.log(`  ${m.name}: equivalent, as recorded - ${m.why ?? ''}`); equivalent++; }
        else { console.log(`  ${m.name}: recorded as equivalent but DIED (${failing} failing) - the record is stale`); stale++; }
      } else if (r.status === 0) { console.log(`  ${m.name}: SURVIVED  <-- the pins cannot fail this`); survived++; }
      else { console.log(`  ${m.name}: dead (${failing} failing)`); dead++; }
    } finally {
      copyFileSync(bak, m.file); unlinkSync(bak);
      if (readFileSync(m.file, 'utf8') !== src) { console.log(`  !! ${m.file} NOT RESTORED`); process.exit(2); }
      if (interrupted) { console.log(`\ninterrupted (${interrupted}) - ${m.file} restored, no verdict for ${m.name}`); process.exit(130); }
    }
  }
}
console.log(`\n${dead} dead, ${survived} survived, ${equivalent} equivalent as recorded, ${stale} stale records, ${noapply} did not apply`);
process.exit(survived || noapply || stale ? 1 : 0);   // noapply counts harness errors and unparseable mutants too
