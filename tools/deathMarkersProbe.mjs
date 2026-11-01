import {build} from 'esbuild';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:`export {createDeathBeaconHost} from './src/scenes/deathBeaconHost.js';export {createDeathBeaconStore} from './src/systems/map/deathBeacon.js';export {createDeathMarkerSettings} from './src/ui/deathMarkerSettings.js';export {setPref} from './src/systems/uiPrefs.js';`,resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'TestDeath',write:false});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:720,height:420}});
  await page.setContent('<body style="margin:0;background:#29312c;color:#e6e0d2;font:13px system-ui"><canvas width="720" height="420"></canvas></body>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const result=await page.evaluate(async()=>{
    const{setPref,createDeathBeaconStore,createDeathBeaconHost,createDeathMarkerSettings}=TestDeath;
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    let time=0;const values=new Map(),store=createDeathBeaconStore({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)});
    const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true});check(gl,'WebGL2 unavailable');
    const view=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    const proj=new Float32Array([1,0,0,0,0,1,0,0,0,0,-1,-1,0,0,-.2,0]);
    const renderer={gl,_view:view,_proj:proj,endUiRun(){},markForeignPass(){}};
    const keys={deathBeacon:true,deathBeams:false,deathMarkerLimit:5,deathLabelOnLook:true,deathLabelDelay:300,deathMapMarkers:true};
    for(const[k,v]of Object.entries(keys))setPref(k,v);
    for(let i=0;i<5;i++)store.write('fixture',{time:i+1,place:{space:'world',k:'w:test'},at:[(i-2)*4,0,-20]});
    const host=createDeathBeaconHost({store,canvas,renderer,character:()=> 'fixture',ready:()=>true,place:()=>({space:'world',k:'w:test'}),feet:()=>[0,0,0],health:()=>100,toWorld:p=>p,fromWorld:p=>p,rect:()=>({left:0,top:0,width:720,height:420}),now:()=>time});
    const roots=()=>[...document.querySelectorAll('[data-death-beacon]')];
    const captions=()=>roots().filter(r=>!r.hidden&&!r.querySelector('[data-death-caption]').hidden);
    try{
      host.update();host.frame(false);check(roots().length===5,'Five bounded skulls');check(captions().length===0,'Dwell initially hides captions');
      time=299;host.frame(false);check(captions().length===0,'No early caption');time=301;host.frame(false);check(captions().length===1,'Exactly one focused caption');
      check(roots().every(r=>getComputedStyle(r).backgroundColor==='rgba(0, 0, 0, 0)'&&!!r.querySelector('svg')),'Skulls without plates');
      const settings=createDeathMarkerSettings();document.body.append(settings);
      check(settings.querySelectorAll('button[aria-label^="Remove "]').length===5,'History lists each record');
      settings.querySelector('button[aria-label^="Remove "]').click();host.frame(false);check(roots().length===4&&host.mapCircles().length===4,'Individual removal clears all views');
      settings.remove();setPref('deathMarkerLimit',1);host.frame(false);check(roots().length===1&&host.history().length===1,'Lower limit removes oldest');
      const one=createDeathMarkerSettings();document.body.append(one);const clear=[...one.querySelectorAll('button')].find(b=>b.textContent==='Clear all death markers');
      clear.click();check(host.history().length===1&&clear.textContent==='Confirm clear all','Clear-all requires second click');clear.click();host.frame(false);check(!roots().length&&!host.history().length,'Confirmed clear removes skulls');one.remove();
      setPref('deathMarkerLimit',5);store.write('fixture',{time:100,place:{space:'dungeon',k:'d:a'},at:[1,2,3],entrance:[0,0,-20]});store.write('fixture',{time:101,place:{space:'dungeon',k:'d:a'},at:[5,2,3],entrance:[0,0,-20]});
      host.frame(false);time=700;host.frame(false);check(roots().length===1&&captions()[0]?.textContent.includes('(2)'),'Shared entrances coalesce');
      host.frame(true);check(roots().every(r=>r.hidden),'Menus hide world markers');host.frame(false);
      setPref('deathBeams',true);gl.viewport(0,0,720,420);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      for(let i=0;i<60;i++){host.frame(false);await new Promise(requestAnimationFrame);}
      const pixels=new Uint8Array(720*420*4);gl.readPixels(0,0,720,420,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const lit=pixels.filter((v,i)=>i%4===3&&v>0).length;
      check(lit>0,'Asynchronous beam eventually draws');check(gl.getError()===gl.NO_ERROR,'No GL error');
      setPref('deathBeams',false);host.frame(false);check(roots().length===1,'Beam off retains skull');
      host.dispose();check(!roots().length,'Disposal removes world DOM');
      return{passed:true,historyCap:5,hardCap:10,initialSkulls:5,focusedCaptions:1,coalescedEntranceSkulls:1,beamPixels:lit,checks:14,scope:'Synthetic headless DOM/WebGL; no account data, visible client, or live FPS measurement.'};
    }finally{host.dispose();}
  });
  assert.equal(result.passed,true);
  console.log(JSON.stringify(result));
}finally{await browser.close();}
