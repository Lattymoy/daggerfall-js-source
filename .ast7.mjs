import { parseAst } from 'rollup/parseAst';
import fs from 'fs'; import path from 'path';
function walk(d, out=[]) { for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p,out); else if(e.name.endsWith('.js')) out.push(p);} return out; }
const srcFiles=walk('/home/user/project-dagger/src');
const allFiles=[...srcFiles, ...walk('/home/user/project-dagger/test'), ...walk('/home/user/project-dagger/tools')];
// collect all property READS across everything
const reads=new Set();
const defs=[]; // {file,line,key}
for (const f of allFiles) {
  const src=fs.readFileSync(f,'utf8'); let ast; try{ast=parseAst(src);}catch{continue;}
  const lineOf=(p)=>src.slice(0,p).split('\n').length;
  const rec=(n,parent)=>{
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n)){n.forEach(x=>rec(x,parent));return;}
    if(!n.type)return;
    if(n.type==='MemberExpression'){
      if(!n.computed && n.property?.type==='Identifier') reads.add(n.property.name);
      if(n.computed && n.property?.type==='Literal'&&typeof n.property.value==='string') reads.add(n.property.value);
    }
    if(n.type==='Property'&&parent&&parent.type==='ObjectPattern'){ // destructuring = read
      if(n.key?.type==='Identifier') reads.add(n.key.name);
      if(n.key?.type==='Literal'&&typeof n.key.value==='string') reads.add(n.key.value);
    }
    if(n.type==='Property'&&parent&&parent.type==='ObjectExpression'){
      if(n.shorthand) { /* shorthand: name likely also a var */ }
      const k = n.key?.type==='Identifier'?n.key.name:(n.key?.type==='Literal'&&typeof n.key.value==='string'?n.key.value:null);
      if(k && f.startsWith('/home/user/project-dagger/src')) defs.push({f,line:lineOf(n.start),key:k, shorthand:n.shorthand, computed:n.computed});
    }
    for(const kk in n){if(kk==='start'||kk==='end'||kk==='type')continue;const v=n[kk];if(v&&typeof v==='object')rec(v,n);}
  };
  rec(ast,null);
}
// also string usage in JSON/data
const seen=new Set();
for (const d of defs) {
  if(d.computed)continue;
  if(reads.has(d.key))continue;
  if(seen.has(d.key))continue; seen.add(d.key);
  console.log(`${d.f.replace('/home/user/project-dagger/','')}:${d.line}  key '${d.key}' NEVER READ`);
}
