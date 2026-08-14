// Deploy verification BY CONTENT (standing lesson: a failed deploy
// leaves the site on the previous build - HTTP 200 proves nothing).
// The pipeline is the CI workflow (.github/workflows/deploy.yml,
// Pages build_type: workflow - push to main deploys). This tool
// closes the loop: build the commit locally (buildTag = commit sha,
// so hashes are commit-deterministic), then run this to poll the
// live index until it serves that exact bundle.
// Usage: npm run build && node tools/verify-deploy.mjs [url]
import { readFile } from 'node:fs/promises';

// Verifies the artifact ALREADY in dist/ - never rebuilds (buildTag
// varies per build, so a rebuild here would chase a hash the deploy
// never pushed - the exact bug this replaced). Build first.
const url = process.argv[2] || 'https://lattymoy.github.io/project-dagger/';
const local = await readFile('dist/index.html', 'utf8');
const bundle = local.match(/assets\/index-[\w-]+\.js/)?.[0];
if (!bundle) { console.error('no bundle ref in local dist/index.html'); process.exit(1); }
console.log('local bundle:', bundle);

const deadline = Date.now() + 8 * 60 * 1000;
while (Date.now() < deadline) {
  try {
    const live = await (await fetch(url, { cache: 'no-store' })).text();
    if (live.includes(bundle)) {
      console.log(`VERIFIED: ${url} serves ${bundle}`);
      process.exit(0);
    }
    const theirs = live.match(/assets\/index-[\w-]+\.js/)?.[0];
    console.log(`live serves ${theirs ?? '(no bundle / not up yet)'} - waiting...`);
  } catch (e) { console.log(`fetch: ${e.message} - waiting...`); }
  await new Promise((r) => setTimeout(r, 15000));
}
console.error('TIMEOUT: live site never matched the local bundle');
process.exit(1);
