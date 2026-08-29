// MW-D8: THIS FILE MOVED, AND THE MOVE IS THE POINT.
//
// Every member below now lives in src/formats/mwFirstPerson.js. Nothing
// changed but the address.
//
// WHY. Until MW-D8 the assembly law - assembleFirstPersonArm,
// poseAssembly, armReport, the rule 6 skeleton table, the clip report -
// existed only to serve a diagnostic page, so it lived under src/tools/.
// MW-D8 puts the arm in the GAME, and the game cannot reasonably import
// its rendering path out of a tools directory. The alternative to one
// shared home is a second copy, which is exactly the shape of MW7's
// failure: two ports of one rule, drifting apart, each verified against
// itself.
//
// It is also where these belong on their own merits. parseBsaIndex,
// readNifHeader, walkEsm and subrecords are FORMAT READERS; they sat in
// tools/ only because the first consumer happened to be a page.
//
// This shim stays so mw-inspect.html and test/mwinspect.test.js keep
// working unchanged - both import behaviourally, neither greps this
// path - and so the move is reviewable as a move rather than as a
// rewrite. `export *` cannot drift from what it forwards.
export * from '../formats/mwFirstPerson.js';
