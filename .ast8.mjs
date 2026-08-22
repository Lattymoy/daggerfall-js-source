import { parseAst } from 'rollup/parseAst';
import fs from 'fs'; import path from 'path';
function walk(d, out=[]) { for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p,out); else if(e.name.endsWith('.js')) out.push(p);} return out; }
const files=walk('/home/user/project-dagger/src');
const byExpr=new Map();
for (const f of files) {
  const src=fs.readFileSync(f,'utf8'); let ast; try{ast=parseAst(src);}catch{continue;}
  const lineOf=(p)=>src.slice(0,p).split('\n').length;
  const S=(n)=>src.slice(n.start,n.end).replace(/\s+/g,'');
  const enumName=(n)=>{ if(n.type==='MemberExpression'&&!n.computed&&n.object.type==='Identifier'&&/^[A-Z][A-Z0-9_]*$/.test(n.object.name)) return n.object.name; return null; };
  const note=(lhs,rhs,line)=>{ const e=enumName(rhs); if(!e)return; const k=S(lhs); if(!byExpr.has(k))byExpr.set(k,new Map()); const m=byExpr.get(k); if(!m.has(e))m.set(e,[]); m.get(e).push(`${f.replace('/home/user/project-dagger/','')}:${line}`); };
  const rec=(n,parent)=>{
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n)){n.forEach(x=>rec(x,parent));return;}
    if(!n.type)return;
    if(n.type==='BinaryExpression'&&['===','!==','==','!='].includes(n.operator)){ note(n.left,n.right,lineOf(n.start)); note(n.right,n.left,lineOf(n.start)); }
    if(n.type==='SwitchStatement'){ for(const c of n.cases) if(c.test) note(n.discriminant,c.test,lineOf(c.start)); }
    for(const k in n){if(k==='start'||k==='end'||k==='type')continue;const v=n[k];if(v&&typeof v==='object')rec(v,n);}
  };
  rec(ast,null);
}
for (const [expr,m] of byExpr) {
  if (m.size>1) {
    console.log(`### ${expr}  -> enums: ${[...m.keys()].join(', ')}`);
    for (const [e,locs] of m) console.log(`    ${e}: ${locs.slice(0,4).join(' ')}`);
  }
}
