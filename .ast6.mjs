import { parseAst } from 'rollup/parseAst';
import fs from 'fs'; import path from 'path';
function walk(d, out=[]) { for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p,out); else if(e.name.endsWith('.js')) out.push(p);} return out; }
const files=walk('/home/user/project-dagger/src');
const kindOf=(n,S)=>{
  if(!n)return '?';
  if(n.type==='TemplateLiteral')return 'tmpl';
  if(n.type==='Literal')return typeof n.value;
  if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='String')return 'string';
  if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='Number')return 'number';
  if(n.type==='BinaryExpression'&&n.operator==='+')return 'plus';
  return '?';
};
for (const f of files) {
  const src=fs.readFileSync(f,'utf8'); let ast; try{ast=parseAst(src);}catch{continue;}
  const lineOf=(p)=>src.slice(0,p).split('\n').length;
  const S=(n)=>src.slice(n.start,n.end).replace(/\s+/g,' ');
  const info={}; // receiver text -> {set:Set, get:Set, lines}
  const rec=(n)=>{
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n)){n.forEach(rec);return;}
    if(!n.type)return;
    if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&['set','get','has','delete'].includes(n.callee.property?.name)&&n.arguments.length){
      const recv=S(n.callee.object);
      const k=kindOf(n.arguments[0],S);
      if(k!=='?'){
        info[recv]=info[recv]||{ops:[]};
        info[recv].ops.push({op:n.callee.property.name,k,line:lineOf(n.start),txt:S(n).slice(0,100)});
      }
    }
    for(const kk in n){if(kk==='start'||kk==='end'||kk==='type')continue;const v=n[kk];if(v&&typeof v==='object')rec(v);}
  };
  rec(ast);
  for (const [recv,d] of Object.entries(info)) {
    const kinds=new Set(d.ops.map(o=>o.k==='tmpl'||o.k==='plus'?'string':o.k));
    if(kinds.size>1 && kinds.has('string') && kinds.has('number')){
      console.log(`${f.replace('/home/user/project-dagger/','')} recv=${recv}`);
      for(const o of d.ops) console.log(`   ${o.line} ${o.op} key:${o.k} | ${o.txt}`);
    }
  }
}
