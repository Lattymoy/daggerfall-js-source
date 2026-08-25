// Deploy verification BY CONTENT (standing lesson: a failed deploy
// leaves the site on the previous build - HTTP 200 proves nothing).
// The pipeline is the CI workflow (.github/workflows/deploy.yml,
// Pages build_type: workflow - push to main deploys). This tool
// closes the loop: build the commit locally (buildTag = commit sha,
// so hashes are commit-deterministic), then run this to poll the
// live index until it can prove your commit is what the site serves.
// Usage: npm run build && node tools/verify-deploy.mjs [url]
//
// TWO WAYS TO PROVE IT, and the second one is why this file was
// rewritten. Exact chunk-hash equality only holds while YOUR build
// tag is the head that CI built - and other sessions push to main
// constantly, so the deploy that actually landed is routinely a
// DESCENDANT of your commit rather than your commit. That is a pass,
// not a timeout: the bundle on the site contains your work. Four
// separate cycles were spent re-running a red verifier against a
// perfectly good deploy before this arm existed. So: match the entry
// chunk if it matches, and otherwise read the deployed head's own
// build tag (vite.config.js stamps it into every built page as
// <meta name="build-tag">) and ask git whether your commit is an
// ancestor of it.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** The ENTRY script as a page actually names it. This used to match
 *  /assets\/index-[\w-]+\.js/ - a hardcoded chunk NAME - and when the
 *  entry chunk became `main-*.js` the tool stopped being able to
 *  verify anything at all, reporting "no bundle ref" against a
 *  perfectly good build. Read what the page loads instead of assuming
 *  what it is called. Only the entry is wanted, so the FIRST script
 *  element wins - the modulepreload links that follow are <link>. */
export function entryBundle(html) {
  return String(html ?? '').match(/<script[^>]+src="\.?\/?(assets\/[\w.-]+\.js)"/)?.[1] ?? null;
}

/** The commit a built page was stamped with, or null on a page built
 *  before the stamp existed (which is the whole reason the caller has
 *  to keep the exact-hash arm). Attribute order is not assumed. */
export function buildTagOf(html) {
  const tag = String(html ?? '').match(/<meta[^>]*\sname="build-tag"[^>]*>/i)?.[0];
  return tag?.match(/\scontent="([^"]*)"/i)?.[1] || null;
}

/** The verdict, with the git question injected so it is testable
 *  without a repository. `contains(a, d)` answers whether commit `a`
 *  is an ancestor of (or equal to) commit `d`, or null when it cannot
 *  tell - an unknown object is NOT a "no". */
export function deployVerdict({ localHtml, liveHtml, contains = () => null }) {
  const bundle = entryBundle(localHtml);
  if (!bundle) return { kind: 'nolocal', message: 'no entry script ref in local dist/index.html' };
  if (String(liveHtml ?? '').includes(bundle)) {
    return { kind: 'exact', bundle, message: `serves ${bundle}` };
  }
  const theirs = entryBundle(liveHtml);
  const localTag = buildTagOf(localHtml);
  const liveTag = buildTagOf(liveHtml);
  if (!localTag || !liveTag) {
    return { kind: 'wait', bundle, theirs, message: `live serves ${theirs ?? '(no bundle / not up yet)'}` };
  }
  // Same commit, different chunk hash: the deploy is fine and the
  // LOCAL artifact is the odd one out - almost always a dist/ built
  // from a dirty tree. Say that rather than polling for a hash CI
  // will never produce.
  if (localTag === liveTag) {
    return {
      kind: 'dirty', bundle, theirs, localTag, liveTag,
      message: `live is your commit ${liveTag} but serves ${theirs} - rebuild from a clean tree`,
    };
  }
  const ancestor = contains(localTag, liveTag);
  if (ancestor === true) {
    return {
      kind: 'ancestor', bundle, theirs, localTag, liveTag,
      message: `serves ${theirs} from ${liveTag}, which contains ${localTag}`,
    };
  }
  return {
    kind: 'wait', bundle, theirs, localTag, liveTag,
    message: `live serves ${theirs ?? '(no bundle)'} from ${liveTag} - waiting...`,
  };
}

/** git's own answer. --is-ancestor exits 0 for yes and 1 for no; any
 *  other status (128 on an object this clone has never fetched) is
 *  "cannot tell", which must not be reported as a no. */
export function gitContains(a, d) {
  const ask = () => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', a, d], { stdio: 'ignore' });
      return true;
    } catch (e) { return e.status === 1 ? false : null; }
  };
  let out = ask();
  if (out === null) {
    // The deployed head can be a commit this clone has not seen yet.
    try { execFileSync('git', ['fetch', 'origin', 'main'], { stdio: 'ignore' }); } catch { /* offline */ }
    out = ask();
  }
  return out;
}

async function main() {
  const url = process.argv[2] || 'https://lattymoy.github.io/project-dagger/';
  const localHtml = await readFile('dist/index.html', 'utf8');
  const bundle = entryBundle(localHtml);
  if (!bundle) { console.error('no entry script ref in local dist/index.html'); process.exit(1); }
  console.log('local bundle:', bundle, buildTagOf(localHtml) ? `(${buildTagOf(localHtml)})` : '(unstamped)');

  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    let liveHtml = null;
    try {
      liveHtml = await (await fetch(url, { cache: 'no-store' })).text();
    } catch (e) { console.log(`fetch: ${e.message} - waiting...`); }
    if (liveHtml !== null) {
      const v = deployVerdict({ localHtml, liveHtml, contains: gitContains });
      if (v.kind === 'exact' || v.kind === 'ancestor') {
        console.log(`VERIFIED: ${url} ${v.message}`);
        process.exit(0);
      }
      if (v.kind === 'dirty') { console.error(`FAILED: ${v.message}`); process.exit(1); }
      console.log(v.message);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.error('TIMEOUT: live site never matched the local bundle');
  process.exit(1);
}

// THE FILE IS A LIBRARY UNLESS IT IS THE PROGRAM. tools/musicNames.mjs
// taught this the expensive way: top-level work plus process.exit
// killed the test runner mid-file and reported a green suite.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
