import {build} from 'esbuild';
import {chromium} from 'playwright';
const bundle=await build({stdin:{contents:`export {PartyOutline} from './src/render/partyOutline.js';export {createBillboardReplay} from './src/render/billboardReplay.js';export {buildProgram} from './src/render/glProgram.js';export {createPartyVisibilityLabels} from './src/ui/partyVisibilityLabels.js';export {createPartySlotUi} from './src/ui/partySlotUi.js';export {setPref} from './src/systems/uiPrefs.js';`,resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'Replay',write:false});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
  const page=await browser.newPage({viewport:{width:900,height:320}});
  await page.setContent('<body style="margin:0;background:#18221b;color:#eee;font:14px system-ui"><div style="display:flex;text-align:center"><div style="width:50%">Old: lantern angle reused<img id="before" style="width:100%"></div><div style="width:50%">Fixed: character angle retained<img id="after" style="width:100%"></div></div></body>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const result=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true});if(!gl)throw Error('WebGL2 unavailable');
    const vs=`#version 300 es
    uniform mat4 uProj,uView;uniform vec3 uRight,uUp;out vec2 uv;
    void main(){uv=vec2(float(gl_VertexID&1),float(gl_VertexID>>1));gl_Position=uProj*uView*vec4(vec3(0.,-.7,0.)+uRight*(uv.x-.5)*.7+uUp*uv.y*1.4,1.);}`;
    const fs=`#version 300 es
    precision highp float;in vec2 uv;out vec4 color;
    void main(){if(!((uv.x>.18&&uv.x<.42&&uv.y>.08&&uv.y<.9)||(uv.x>.18&&uv.x<.85&&uv.y>.7&&uv.y<.9)))discard;color=vec4(.9,.15,.1,1.);}`;
    const program=Replay.buildProgram(gl,vs,fs,'synthetic asymmetric character'),vao=gl.createVertexArray();
    const u=Object.fromEntries(['Proj','View','Right','Up'].map(k=>[k,gl.getUniformLocation(program,'u'+k)]));
    const r={gl,_frameFbo:null,_shadows:null,_bbRight:new Float32Array(3),_bbUp:new Float32Array(3),
      _proj:new Float32Array([-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),_view:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
      endUiRun(){},markForeignPass(){},drawBillboards(batches,right,up){
        this._bbRight.set(right);this._bbUp.set(up);gl.useProgram(program);gl.bindVertexArray(vao);
        gl.uniformMatrix4fv(u.Proj,false,this._proj);gl.uniformMatrix4fv(u.View,false,this._view);gl.uniform3fv(u.Right,right);gl.uniform3fv(u.Up,up);
        for(const b of batches)if(b.visible)gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      }};
    const sprite={visible:true},lantern={visible:false},replay=Replay.createBillboardReplay(r),outline=new Replay.PartyOutline(gl);
    for(let i=0;i<120&&!outline.init();i++)await new Promise(resolve=>setTimeout(resolve,16));
    if(!outline.init())throw Error("Party outline shader did not become ready");
    replay.setEnabled(true);replay.track(sprite);
    const read=()=>{const bytes=new Uint8Array(640*360*4);gl.readPixels(0,0,640,360,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
    let lastPixels,testBounds=null;
    const run=(fixed,tilt,up=[0,1,0],viewport=[0,0,640,360],fill=0,time=1,width=2)=>{
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(...viewport);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.depthMask(true);gl.clearColor(.02,.03,.02,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      r.drawBillboards([sprite],[-1,0,0],up);const baseline=read();
      r.drawBillboards([lantern],[-Math.cos(tilt),Math.sin(tilt),0],[Math.sin(tilt),Math.cos(tilt),0]);
      outline.draw(r,[{id:sprite,alpha:1,bounds:testBounds}],{color:'#00ff00',width,throughWalls:true,fill,time},b=>fixed?replay.draw(b):r.drawBillboards([b],r._bbRight,r._bbUp));
      const pixels=read();lastPixels=pixels;let green=0,detached=0;
      for(let y=0;y<360;y++)for(let x=0;x<640;x++){
        const i=(y*640+x)*4;if(pixels[i+1]<70||pixels[i+1]<pixels[i]*1.4)continue;green++;let near=false;
        for(let dy=-3;dy<=3&&!near;dy++)for(let dx=-3;dx<=3;dx++){
          if(x+dx<0||x+dx>=640||y+dy<0||y+dy>=360)continue;
          const p=((y+dy)*640+x+dx)*4;if(baseline[p]>150){near=true;break;}
        }
        if(!near)detached++;
      }
      if(gl.getError()!==0)throw Error('GL error');return {green,detached};
    };
    const before=run(false,.65);document.querySelector('#before').src=canvas.toDataURL();
    const after=run(true,.65);document.querySelector('#after').src=canvas.toDataURL();
    const raised=run(true,-.65,[0,.8,.6]),offset=run(true,.8,[0,1,0],[40,20,520,280]);
    if(before.detached<50)throw Error('Old bug was not reproduced');
    for(const test of [after,raised,offset])if(test.green<50||test.detached!==0)throw Error('Corrected replay detached: '+JSON.stringify(test));
    // A full previous mask leaves stale pixels; clipped reads must still match a fresh full-frame result.
    run(true,.65);const full=lastPixels;
    let clearPixels=0;const clear=gl.clear.bind(gl);
    gl.clear=bits=>{if(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===outline.fbo){const sc=gl.getParameter(gl.SCISSOR_BOX);if(!gl.isEnabled(gl.SCISSOR_TEST))throw Error('Unbounded party clear');clearPixels+=sc[2]*sc[3];}return clear(bits);};
    testBounds=[180,35,280,290];run(true,.65);const clipped=lastPixels;
    if(!full.every((v,i)=>v===clipped[i]))throw Error('Clipped mask changed outline pixels');
    if(clearPixels>=640*360)throw Error('Clear was not reduced');
    testBounds=[0,0,32,32];run(true,.65);
    if(lastPixels.some((v,i)=>i%4===1&&v>70))throw Error('Stale mask escaped clipped region');
    gl.clear=clear;
    replay.dispose();outline.dispose();gl.deleteProgram(program);gl.deleteVertexArray(vao);gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {passed:true,before,after,raised,offset,clearPixels,fullFramePixels:640*360,scope:'Synthetic WebGL outline alignment, bounded clear and stale-mask rejection. Not a live-game FPS benchmark.'};
  });
  result.labels=await page.evaluate(()=>{
    const check=(ok,note)=>{if(!ok)throw Error(note);};
    const labels=Replay.createPartyVisibilityLabels();
    const o={size:16,names:true,distance:true,elevation:true,rect:{left:0,top:0,width:900,height:320}};
    const row={acct:'a',name:'Teammate',x:450,y:160,exact:true,metres:77,dy:6,color:'#e0b060',slot:2};
    labels.sync([row],o);
    check(document.querySelector('[data-party-place]').textContent==='\u2191','Elevation must be a small up arrow');
    check(document.querySelector('[data-party-distance]').textContent==='77 m','Distance stays below the diamond');
    check(document.querySelector('[data-party-name]').textContent==='Teammate','Name preserved');
    labels.sync([{...row,dy:-6}],o);check(document.querySelector('[data-party-place]').textContent==='\u2193','Down arrow');
    labels.sync([{...row,edge:true,x:35,angle:180}],o);
    check(document.querySelector('[data-party-name]').hidden,'Edge name hidden');
    check(document.querySelector('[data-party-person]').style.display==='block','Edge player icon shown');
    labels.dispose();check(!document.querySelector('[data-party-visibility]'),'Labels disposed');
    const fixture=document.createElement('div');fixture.innerHTML='<div class="dfparty-list"><div class="dfparty-card"><span class="dfparty-name">Teammate</span><span class="dfparty-hp off">77 / 100</span></div></div><div class="dfparty-mates">Companion</div>';document.body.append(fixture);
    Replay.setPref('partyVisibility',true);
    const ui=Replay.createPartySlotUi(()=>({acct:'me',party:{members:[{acct:'me',name:'Me'},{acct:'a',name:'Teammate'}]}}));
    ui.frame(0);check(fixture.querySelector('[data-keta-party-slot]')?.dataset.ketaPartySlot==='2','Slot includes self');
    check(getComputedStyle(fixture.querySelector('.dfparty-hp')).display!=='none','HP revealed');
    check(fixture.querySelector('.dfparty-mates').hasAttribute('data-keta-companions'),'Companion divider');
    Replay.setPref('partyVisibility',false);ui.frame(300);check(!fixture.querySelector('[data-keta-party-slot]'),'Disable removes decorations');
    check(!fixture.querySelector('[data-keta-player-health]'),'Disable removes HP override');
    ui.dispose();fixture.remove();return {arrows:true,edgeIcon:true,slotColor:true,health:true,companions:true,disableCleanup:true};
  });
  console.log(JSON.stringify(result));
}finally{await browser.close();}
