// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SCALE1 (2026-09-30, the scaling audit): HOW A TAB ASKS AGAIN.
//
// Every book asked a failed act again after the same fixed waits, so a
// service that stumbled for everyone at once (a deploy, D1 busy) was
// asked again by every tab at the same instant - the stumble, three
// times over. A wait is JITTERED: anywhere from half to one and a half
// of itself, so the asks spread out instead of arriving together.
//
// And the answers a quick ask cannot change are not asked quickly: the
// account's request minute (`rate`) and the service's maintenance
// minute are a minute long. Each book keeps such an act and its own
// slower pump asks after it (profBook PROF_PUMP_MS and the rest).
// ═══════════════════════════════════════════════════════════════════

/** The answers worth asking again within one press: the network, and the service's own fault. */
export const ASK_AGAIN_NOW = Object.freeze(['offline', 'server']);

/** `ms`, jittered to anywhere in [ms/2, 3ms/2). `rand` is Math.random's shape (the pins pass their own). */
export const jittered = (/** @type {number} */ ms, rand = Math.random) => Math.max(0, Math.round(ms * (0.5 + rand())));
