// @ts-check
// PERF-URL (2026-09-29, Mac: "I'm receiving reports after some updates, performance seems to be worse") - THE PAGE'S
// QUERY, PARSED ONCE A SEARCH.
//
// Every URL door in the port - `?online`, `?skin=`, `?air=off`, `?water=off`, `?lighting=classic`, `?blood=off` and
// the rest - was a one-line predicate that minted a URLSearchParams and parsed `location.search` on EVERY call, and
// the predicates are read inside the frame: every `getPref` and every `modSetting` asks `isOnlinePage` (the online
// lane's forced keys, systems/online/onlineLane.js), and the skin is asked by whatever draws. Counted in the real game (a
// town in the rain, Knightstale, the world host settled): 84 parses a frame - 54 of them the online lane's, 24 the
// skin's - at about 4.5 us each in headless Chromium on a quiet CPU (~0.4 ms a frame), where the same read keyed on
// the search string is under 1 us (the `location.search` read it still pays is most of that).
//
// PERF-SUN (2026-09-19) paid exactly this for ONE door - the sway's `swayDisabled` in systems/wind/windDrive.js keeps its
// answer until the search string changes, `cullDisabled`'s shape - and every door written since was written the old
// way again, because the fix lived in one file. So the shape has ONE HOME now, and test/systems/perfurl_doors.test.js sweeps
// src/ for a door that parses on its own.
//
// WHY A SEARCH-KEYED MEMO AND NOT A LATCH. The page's search does change once: the boot publishes the params it
// decided (onlineLane.js publishBootParams, MAC-N3) before the world boots, and a latch read before that would answer
// the menu's URL for the rest of the session - the very bug MAC-N3 fixed. Keyed on the string it reads, the memo is
// the URL's answer at every call, a replaceState included; and the tests' own injected searches key it the same way.
// Every other change to the URL in this port is a navigation (location.replace/href), which starts a new page.
//
// The parsed object never leaves this module: a caller gets a string or a boolean, so no reader can edit what the
// next reader is served (main.js keeps its own URLSearchParams for the boot, which it DOES edit).

/** @type {string|null} */
let _search = null;
/** @type {URLSearchParams|null} */
let _params = null;

/** @param {string} search */
function parsed(search) {
  if (_params === null || search !== _search) {
    _params = new URLSearchParams(search);
    _search = search;
  }
  return _params;
}

/**
 * The value of `name` on the page's query (or on `search`, the doors' injectable form), or null when it is absent.
 * @param {string} name
 * @param {string} [search]
 * @returns {string|null}
 */
export function pageParam(name, search = globalThis.location?.search ?? '') {
  return parsed(search).get(name);
}

/**
 * Whether the page's query (or `search`) carries `name` at all - `?online`, `?nofonts`.
 * @param {string} name
 * @param {string} [search]
 * @returns {boolean}
 */
export function pageHas(name, search = globalThis.location?.search ?? '') {
  return parsed(search).has(name);
}
