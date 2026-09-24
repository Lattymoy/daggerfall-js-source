// Stamps the current commit into src/buildTag.js at build time - the
// F8 readout's stale-cache killer.
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
// AUDIT 68 X5-verify-deploy-tag-length-bypasses-dirty: a FIXED length. Bare
// --short lets git size the abbreviation by the clone's object count - 9
// in a full clone, 7 in CI's depth-1 checkout - so one commit had two tags,
// and verify-deploy's same-commit arm never fired.
const sha = execSync('git rev-parse --short=12 HEAD').toString().trim();
writeFileSync('src/buildTag.js', `export const BUILD_TAG = '${sha}';\n`);
