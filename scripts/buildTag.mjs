// Stamps the current commit into src/buildTag.js at build time - the
// F8 readout's stale-cache killer.
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
const sha = execSync('git rev-parse --short HEAD').toString().trim();
writeFileSync('src/buildTag.js', `export const BUILD_TAG = '${sha}';\n`);
