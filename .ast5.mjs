import { parseAst } from 'rollup/parseAst';
import fs from 'fs'; import path from 'path';
function walk(d, out=[]) { for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p,out); else if(e.name.endsWith('.js')) out.push(p);} return out; }
const files=walk('/home/user/project-dagger/src');
const out=[];
for (const f of files) {
  const src=fs.readFileSync(f,'utf8'); let ast;
  try{ast=parseAst(src);}catch{continue;}
  const lineOf=(p)=>src.slice(0,p).split('\n').length;
  const S=(n)=>src.slice(n.start,n.end).replace(/\s+/g,' ');
  // walk statement lists; track guards of the form: if (!X) return/continue/throw;  or if (X == null) return;
  const scanBody = (body) => {
    const guarded = []; // {expr, line}
    for (const st of body) {
      // detect guard
      if (st.type==='IfStatement' && !st.alternate) {
        const c = st.consequent;
        const isExit = (c.type==='ReturnStatement'||c.type==='ContinueStatement'||c.type==='ThrowStatement'||c.type==='BreakStatement') ||
          (c.type==='BlockStatement' && c.body.length && ['ReturnStatement','ContinueStatement','ThrowStatement','BreakStatement'].includes(c.body[c.body.length-1].type) && c.body.every(s=>s.type!=='IfStatement'));
        if (isExit) {
          const t=st.test;
          if (t.type==='UnaryExpression'&&t.operator==='!') guarded.push({e:S(t.argument),line:lineOf(st.start)});
          else if (t.type==='BinaryExpression'&&['==','===' ].includes(t.operator)&&(S(t.right)==='null'||S(t.right)==='undefined')) guarded.push({e:S(t.left),line:lineOf(st.start)});
          else if (t.type==='LogicalExpression'&&t.operator==='||'){ const fl=(n)=>{ if(n.type==='LogicalExpression'&&n.operator==='||'){fl(n.left);fl(n.right);} else { if(n.type==='UnaryExpression'&&n.operator==='!') guarded.push({e:S(n.argument),line:lineOf(st.start)}); else if(n.type==='BinaryExpression'&&['==','==='].includes(n.operator)&&(S(n.right)==='null'||S(n.right)==='undefined')) guarded.push({e:S(n.left),line:lineOf(st.start)}); } }; fl(t); }
          continue;
        }
      }
      // after guards: look for redundant re-checks within this statement
      if (guarded.length) {
        const rec=(n)=>{
          if(!n||typeof n!=='object')return;
          if(Array.isArray(n)){n.forEach(rec);return;}
          if(!n.type)return;
          if(n.type==='LogicalExpression'&&n.operator==='&&'){
            // a && a.b  -- fine
          }
          if(n.type==='UnaryExpression'&&n.operator==='!'){
            const t=S(n.argument);
            const g=guarded.find(x=>x.e===t);
            if(g) out.push(`${f}:${lineOf(n.start)}  REDUNDANT !(${t}) - guarded at line ${g.line}: ${S(n).slice(0,110)}`);
          }
          if(n.type==='BinaryExpression'&&['==','===' ].includes(n.operator)&&(S(n.right)==='null'||S(n.right)==='undefined')){
            const t=S(n.left); const g=guarded.find(x=>x.e===t);
            if(g) out.push(`${f}:${lineOf(n.start)}  REDUNDANT ${t}${n.operator}null - guarded at ${g.line}`);
          }
          if(n.type==='ChainExpression'){ /* optional chaining after guard */ }
          if(n.type==='MemberExpression'&&n.optional){ const t=S(n.object); const g=guarded.find(x=>x.e===t); if(g) out.push(`${f}:${lineOf(n.start)}  REDUNDANT ?. on ${t} - guarded at ${g.line}`); }
          for(const k in n){if(k==='start'||k==='end'||k==='type')continue;const v=n[k];if(v&&typeof v==='object')rec(v);}
        };
        rec(st);
      }
      // reassignment kills the guard
      const kill=(n)=>{ if(!n||typeof n!=='object')return; if(Array.isArray(n)){n.forEach(kill);return;} if(!n.type)return;
        if(n.type==='AssignmentExpression'){ const t=S(n.left); for(let i=guarded.length-1;i>=0;i--) if(guarded[i].e===t||guarded[i].e.startsWith(t+'.')) guarded.splice(i,1); }
        if(n.type==='UpdateExpression'){ const t=S(n.argument); for(let i=guarded.length-1;i>=0;i--) if(guarded[i].e===t) guarded.splice(i,1); }
        for(const k in n){if(k==='start'||k==='end'||k==='type')continue;const v=n[k];if(v&&typeof v==='object')kill(v);} };
      kill(st);
    }
  };
  const rec=(n)=>{
    if(!n||typeof n!=='object')return;
    if(Array.isArray(n)){n.forEach(rec);return;}
    if(!n.type)return;
    if(n.type==='BlockStatement'||n.type==='Program') scanBody(n.body);
    for(const k in n){if(k==='start'||k==='end'||k==='type')continue;const v=n[k];if(v&&typeof v==='object')rec(v);}
  };
  rec(ast);
}
console.log(out.join('\n'));console.log('TOTAL',out.length);
