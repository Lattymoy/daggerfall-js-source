import fs from 'fs'; import path from 'path';
const root='/tmp/claude-0/-home-user-daggerfall-js-source/bb6b4fae-5956-5f83-84ff-79d9c78d9657/scratchpad/a65/lane-activation/src';
const deps=new Map();
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p); else if(e.name.endsWith('.js')){const t=fs.readFileSync(p,'utf8'); const out=[]; for(const m of t.matchAll(/from\s+'(\.[^']+)'/g)){out.push(path.resolve(path.dirname(p),m[1]));} deps.set(p,out);} }}
walk(root);
// find cycles containing activate.js
const target=path.join(root,'player/activate.js');
const seen=new Set(); const stack=[];
let found=[];
function dfs(n){ if(stack.includes(n)){ if(n===target) found.push([...stack.slice(stack.indexOf(n)),n]); return;} if(seen.has(n))return; stack.push(n); for(const c of (deps.get(n)||[])) dfs(c); stack.pop(); seen.add(n);}
dfs(target);
console.log('cycles through activate.js:', found.length);
for(const f of found.slice(0,5)) console.log(f.map(x=>x.replace(root+'/','')).join(' -> '));
