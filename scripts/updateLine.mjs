// REL8 (2026-10-09, Mac: "Let's officially start numbering updates beginning with 0.0.1") - THE UPDATE LINE.
//
// A player's update is numbered MAJOR.MINOR.PATCH: MAJOR.MINOR is the line below, written by hand; PATCH is DERIVED
// (scripts/updateNumber.mjs) - the first-parent commit that last changed the line is the line's update 1, and every
// first-parent commit after it the next. So the merge that brought this file was Update 0.0.1, and nothing is bumped by
// hand between updates. RELEASE-FLOW (2026-10-19): releases are cut from `release`, so the history counted is
// release's - each promotion of main, and each hotfix, the next update.
//
// To start a new line (0.1, 1.0), change the line below and nothing else on it: the release that carries the change is
// that line's .1. The line is FOUND by its diff (`git log -G`), so an edit to these comments moves nothing, and an
// edit to the line itself - even its spacing - starts the count again.
export const UPDATE_LINE = '0.0';
