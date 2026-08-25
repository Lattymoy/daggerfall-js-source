// A REPAINT MUST NOT MOVE THE PAGE UNDER THE PLAYER.
//
// Mac, playing on a phone: on the skills screen every tap on a stepper
// threw the list back to the top. The enhanced screens rebuild their
// whole DOM on every state change, and a rebuilt element starts at
// scroll 0 - the same fault that cost the province map its clicks, one
// layer up: there the destroyed thing was the node under the pointer,
// here it is the scroll offset.
//
// IT TOOK THREE TRIES TO REPRODUCE, and all three failures were this
// probe rather than the code. Twice it tapped a stepper that was
// scrolled out of view. Then it tapped a DECREMENT on a value sitting
// at its rolled floor, which skillDown correctly refuses - so nothing
// moved, the scroll held, and the probe reported the bug fixed while
// it was still there. Hence the two rules it now follows: tap only a
// control that is inside the scrolled pane, and CHECK THAT THE TAP
// MOVED SOMETHING before believing anything about the scroll.
//
// A real touchscreen tap, because that is the input the report came
// from and because a synthetic click on an element handle never
// travels the path a finger does.
//
//     ARENA2_PATH=... npx vite --port 5199 &
//     node tools/enhancedScrollProbe.mjs
import { chromium, devices } from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({...devices['Pixel 5']});const p=await ctx.newPage();
await p.goto('http://127.0.0.1:5199/chargen.html',{waitUntil:'networkidle'});
await p.waitForSelector('.prov',{timeout:20000});
const st=async()=>JSON.parse(await p.evaluate(()=>window.__chargen()));
const key=async(k,n=1)=>{for(let i=0;i<n;i++){await p.keyboard.press(k);await p.waitForTimeout(45);}};
await key('ArrowDown',2);await key('Enter');await key('Enter');await key('ArrowDown');await key('Enter');
for(let i=0;i<200;i++){const s=await st(); if(s.state==='skills')break;
 if(s.state==='name'){await p.keyboard.type('V');await key('Enter');continue;}
 if(s.state==='stats'){await key('+',12);await key('ArrowDown');await key('Enter');continue;}
 await key('Enter'); if((await st()).state===s.state) await key('ArrowDown');}
await p.evaluate(()=>{document.querySelector('.skillpane').scrollTop=300;});
await p.waitForTimeout(120);
const before=await p.evaluate(()=>document.querySelector('.skillpane').scrollTop);
const vals=async()=>p.evaluate(()=>[...document.querySelectorAll('.row .val')].map(v=>v.textContent).join(','));
const v0=await vals();
// a REAL TAP, which is what a phone sends
const box=await p.evaluate(()=>{
  const pane=document.querySelector('.skillpane').getBoundingClientRect();
  const steps=[...document.querySelectorAll('.row .step')];
  for(let i=1;i<steps.length;i+=2){ const s=steps[i];
    const b=s.getBoundingClientRect();
    if(b.top>pane.top+30&&b.bottom<pane.bottom-30) return {x:b.x+b.width/2,y:b.y+b.height/2};
  } return null;});
await p.touchscreen.tap(box.x,box.y);
await p.waitForTimeout(250);
const v1=await vals();
const after=await p.evaluate(()=>document.querySelector('.skillpane').scrollTop);
const landed = v0 !== v1;
console.log('tap landed:', landed,'pools:',await p.evaluate(()=>[...document.querySelectorAll('.skillpool')].map(x=>x.textContent).join(' ')),'| under tap:',await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?e.tagName+'.'+e.className:'none';},[box.x,box.y]));
console.log(`scroll ${before} -> ${after} ${after===before?'HELD':'RESET'}`);
await b.close();
if (!landed) { console.log('INCONCLUSIVE - the tap changed nothing, so the scroll proves nothing'); process.exit(1); }
if (after !== before) process.exit(1);
