// Deploy verification BY CONTENT (standing lesson: a failed deploy
// leaves the site on the previous build - HTTP 200 proves nothing).
// Builds locally, extracts the bundle filename from dist/index.html,
// and polls the live site until its index references the SAME hashed
// bundle (or times out). Usage: node tools/verify-deploy.mjs [url]
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const url = process.argv[2] || 'https://lattymoy.github.io/project-dagger/';
execSync('npm run build', { stdio: 'inherit' });
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
