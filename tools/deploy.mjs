// Deploy: build -> force-push dist to the gh-pages branch -> verify
// BY CONTENT (tools/verify-deploy.mjs polls the live index for the
// local bundle hash - the standing lesson: HTTP 200 proves nothing).
//
// Branch deploy, not Actions: the repo PAT carries no `workflow`
// scope (workflow files are push-rejected). If CI deploys are ever
// wanted, mint a PAT with workflow scope and restore deploy.yml.
// Usage: GIT_PAT=... node tools/deploy.mjs
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pat = process.env.GIT_PAT;
if (!pat) { console.error('GIT_PAT required'); process.exit(1); }
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

run('npm run build');
const stage = mkdtempSync(join(tmpdir(), 'dagger-pages-'));
cpSync('dist', stage, { recursive: true });
writeFileSync(join(stage, '.nojekyll'), '');   // no Jekyll pass on Pages
run('git init -q -b gh-pages', stage);
run('git config user.email "fable@fightlife.dev" && git config user.name "Fable"', stage);
run('git add -A && git commit -q -m "pages deploy"', stage);
run(`git push -f https://${pat}@github.com/Lattymoy/project-dagger.git gh-pages`, stage);
console.log('gh-pages pushed; verifying by content...');
run('node tools/verify-deploy.mjs');
