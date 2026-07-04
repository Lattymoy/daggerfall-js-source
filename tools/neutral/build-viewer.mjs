// Builds the standalone orbit viewer: runs the neutral body builder,
// injects the shaded face payload into the viewer template.
// Usage: ARENA2_PATH=... node tools/neutral/build-viewer.mjs out.html
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('.', import.meta.url).pathname;
execFileSync('node', [dir + 'neutral-body.mjs', '/tmp/np.json'], { env: process.env, stdio: 'inherit' });
const payload = readFileSync('/tmp/np.json', 'utf8');
const tpl = readFileSync(dir + 'viewer-template.html', 'utf8');
writeFileSync(process.argv[2] || 'dagger-viewer.html', tpl.replace('__PAYLOAD__', payload));
console.log('viewer written ->', process.argv[2] || 'dagger-viewer.html');
