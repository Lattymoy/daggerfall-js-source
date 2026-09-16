# Mutation lists

Run with `node tools/mutate.mjs tools/mutants/<slice>.json` (or `*.json`). Each list is the exact set of
mutations a slice's "N mutations, N dead" refers to. A survivor is a finding, not a flake: add a pin.

The lists here begin at SLAM8. SLAM1-SLAM7's mutation sets predate this harness and were never committed -
their "all dead" counts are recorded in Online-Arc.md as they were run, and AUDIT SLAM found at least one
full-suite survivor per file; those survivors are closed by the PINS slice, whose list is committed.
