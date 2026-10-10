// IMPORT-GRAPH1's fixture (test/accountdeploy.test.js): a line comment carrying a stray /* - the old walk opened a
// "block" here that ran to the last line's close and saw none of the imports between
import { a } from './a.js';
import { sep } from 'node:path';
export * from './b.js';
export const later = () => import('./c.js');
import "./e.js";
import table from './d.json' with { type: 'json' };
export { a, table, sep };
export { f } from './f.js';
/* a block comment naming import './not-walked.js' - never walked */
