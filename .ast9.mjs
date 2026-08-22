import { parseAst } from 'rollup/parseAst';
import fs from 'fs'; import path from 'path';
function walk(d, out=[]) { for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p,out); else if(e.name.endsWith('.js')) out.push(p);} return out; }
const files=walk('/home/user/project-dagger/src');
// class -> {name, superClass, methods:Map(name->line)}
const classes=[];
for (const f of files) {
  const src=fs.readFileSync(f,'utf8'); let ast; try{ast=parseAst(src);}catch{continue;}
  const lineOf=(p)=>src.slice(0,p).split('\n').length;
  const rec=(n)=>{
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n)){n.forEach(rec);return;}
    if(!n.type)return;
    if(n.type==='ClassDeclaration'||n.type==='ClassExpression'){
      const name=n.id?.name??'(anon)';
      const sup=n.superClass?.type==='Identifier'?n.superClass.name:null;
      const methods=new Map();
      for(const m of n.body.body){ const k=m.key?.name??(m.key?.type==='Literal'?String(m.key.value):null); if(k) methods.set(k+(m.kind==='get'?' [get]':m.kind==='set'?' [set]':''), lineOf(m.start)); }
      classes.push({file:f,name,sup,methods,line:lineOf(n.start)});
    }
    for(const k in n){if(k==='start'||k==='end'||k==='type')continue;const v=n[k];if(v&&typeof v==='object')rec(v);}
  };
  rec(ast);
}
const byName=new Map(classes.map(c=>[c.name,c]));
for (const c of classes) {
  if (!c.sup) continue;
  const base=byName.get(c.sup);
  if (!base) continue;
  for (const [m,line] of c.methods) {
    if (m==='constructor') continue;
    if (base.methods.has(m)) console.log(`${c.file.replace('/home/user/project-dagger/','')}:${line}  ${c.name}.${m} OVERRIDES ${base.name}.${m} (${base.file.replace('/home/user/project-dagger/','')}:${base.methods.get(m)})`);
  }
}
