// ALLOC-RACE: the allocation measure's settle (see test/allocChild.mjs) - preloaded into every measuring child with
// --import. Every measure opens each window with gc(), so gc() first waits out the optimising compiler's queue
// (%FinalizeOptimization: every job the warm-up queued is compiled and installed, however late a loaded machine runs
// it) - the windows then read the code the browser runs, compiled the browser's own way, concurrently. The runtime
// call is V8's own syntax, legal only under --allow-natives-syntax (which the child has), so it is compiled from a
// string: this file stays plain JavaScript to the linter.
// eslint-disable-next-line no-new-func
const settle = new Function('%FinalizeOptimization()');
const gc = globalThis.gc;
globalThis.gc = () => { settle(); gc(); };
