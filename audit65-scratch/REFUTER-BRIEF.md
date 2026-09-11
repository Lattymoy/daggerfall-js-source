# AUDIT 65 refuter brief

You are an ADVERSARIAL REFUTER in AUDIT 65 of /home/user/daggerfall-js-source (a 1:1 JS port of Daggerfall Unity). The DFU reference is on disk at tools/parity/dfu/Assets/Scripts (master 81e89e9). Read bible/Home.md lines 1-130 for the doc laws first. The audited delta is `git diff 0fe2c05b..HEAD` (199 src files); slices in it are named by their commit tags (OT1, MAC1, CS1, AUDIT 63/64 lanes, WATER1, VC1-VC5, CLK1/CLK2, DS1/DS2, SIB1/SIB2, ROAD-H, FIX-C/E/F, ECV1, MW-LOAD, EV1-EV6...).

Your lens file holds a finder's findings as JSON inside a code fence (plus a coverage block). For EACH finding id:
1. Re-derive the evidence yourself at HEAD - open the cited C# and the port's lines; never trust the finder's quotes. `git blame`/`git log -S` to confirm a line is in the delta when the finding says so.
2. Reproduce any probe the finder describes when it is cheap (node one-liners, `node --test test/x.test.js`, temporary mutants you REVERT with `git checkout --` before you finish - `git status --short` must be empty for src/ test/ tools/ when you are done).
3. Decide. A finding SURVIVES only if: the defect is real at HEAD; it is a divergence from DFU or from the port's own recorded law with an observable consequence (or, for the pins lens, a pin that provably cannot redden); and it is not already recorded as deliberate in bible/01-Overview/Audit-63.md, Audit-64.md, or Port-Ledger.md section A. Default to REFUTED when uncertain. Severity inflation is a refutation ground for the severity, not the finding - give your own severity.
4. Judge the PROPOSED FIX: is it DFU's shape? Would it regress another host, another caller, the save envelope, a live open flag? Correct it where wrong - your corrections travel into the fix-lane brief verbatim (AUDIT 62's lesson: "the verifiers' corrections are the brief"). Name the exact files and lines the lane should touch.
5. Ask what the finder did NOT check: the other callers of the seam, all four hosts (world.js, exterior.js, worldModes.js, dungeonContext.js, plus standalone interior.js/dungeon.js), the classic-skin twin of an enhanced window, the boot path vs the in-session path.

Known duplicates: UI-2, XL-3 and HP-1 are one finding (MAC1 J's relock hook missing from hosts). Judge it under HP-1's id if it is in your file; if only UI-2 or XL-3 is in your file, judge it but say "same as HP-1".

Do NOT edit files persistently. RETURN (your final message is data, nothing else): a JSON array, one entry per finding id in your file:
{id, upheld: true|false, confidence: "high"|"medium"|"low", reasoning: 2-6 sentences with the C# and tree evidence you re-derived (file:line), corrections: what in the claim/evidence is wrong or overstated (or "none"), fixShape: the fix you would brief a lane with (files + lines + the change), severity: your own call, laneKey: the primary FILE the fix lands in (for grouping lanes by file)}

Known duplicate: MC-5 (water scroll/opacity literals in the dungeon hosts) is the same finding as CV-3 in findings-constants.md - judge it under CV-3 and say so.
