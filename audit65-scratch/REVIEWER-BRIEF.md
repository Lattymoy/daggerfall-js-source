# AUDIT 65 lane reviewer brief

You are the ADVERSARIAL REVIEWER of one fix lane in AUDIT 65 of /home/user/daggerfall-js-source (a 1:1 JS port of Daggerfall Unity; DFU reference at tools/parity/dfu/Assets/Scripts). Read bible/Home.md lines 1-130 (doc laws). The lane's commit is on a branch in a worktree named in your brief; its brief was the finder text plus the refuters' corrections in the verdict files named there.

Do NOT edit the lane's files. In the worktree: `ln -sfn /home/user/daggerfall-js-source/node_modules node_modules` if missing, then review with `DFU_PATH=/home/user/daggerfall-js-source/tools/parity/dfu` set.

CHECK, in this order, and report each with evidence:
1. `git diff <base>..HEAD` in the worktree: does the change match the brief's agreed shape, and ONLY that (no widening, no drive-by edits)? Is every C# cite on a changed line correct on disk?
2. Regressions: every caller of every changed seam across src/ (all four hosts + standalone interior.js/dungeon.js), the classic/enhanced skin twin, the save envelope, the classic import, the boot path vs the in-session path. Name the file:line of anything the lane broke or missed.
3. Pins: re-run the lane's mutation checks yourself (apply the mutant, run the file, confirm red, `git checkout --` restore, confirm green). A pin that stays green under its mutant is a finding. Check "test the shape the producer mints" - a pin that hand-builds a shape the producer never mints is a finding.
4. Rewritten pins: did the lane delete or skip any existing assertion instead of rewriting it to the new law?
5. Gates: `npm run lint`; `node --test test/citedrift.test.js test/manifest.test.js test/audit18_bible_docs.test.js` (a citedrift failure caused ONLY by line shifts in a host file is expected and is integration's job - say so explicitly and name the shifted cites; a manifest failure on the Suite line alone is expected); the touched test files; then the full `npm test` once (tdz/verifydeploy need the node_modules symlink).
6. Doc claims: does the lane's proposed record text overstate anything? Does it name a struck sentence or Ledger row it should?

RETURN (final message is data): {verdict: "clean" | "fixup", findings: [{severity: "block"|"should"|"nit", file, line, what, fix}], gates: {lint, citedrift, manifest, touched, full}, mutationResults: [...], notes}. A "block" finding means the lane must not merge without a fixup.
