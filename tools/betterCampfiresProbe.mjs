import { build } from 'esbuild';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const bundle = await build({ entryPoints: ['src/render/campBeacon.js'], bundle: true, format: 'iife', globalName: 'Beacon', write: false });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 440 } });
  await page.setContent('<body style="margin:0;background:#16221e;color:#e6e0d2;font:14px system-ui"><div style="display:flex;text-align:center;padding:10px"><span style="width:50%">Before</span><span style="width:50%">Wave extended downward</span></div><canvas width="720" height="400"></canvas></body>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) throw Error('WebGL2 unavailable');
    gl.viewport(0, 0, 720, 400);
    const r = { _proj: new Float32Array([1,0,0,0,0,2/35,0,0,0,0,-1,0,0,-1,0,1]),
      _view: new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]), endUiRun() {}, markForeignPass() {} };
    const beam = new Beacon.CampBeacon(gl), pixels = () => {
      const bytes = new Uint8Array(720*400*4); gl.readPixels(0,0,720,400,gl.RGBA,gl.UNSIGNED_BYTE,bytes); return bytes;
    };
    for(let i=0;i<120&&!beam.init();i++)await new Promise(resolve=>setTimeout(resolve,16));
    if(!beam.init())throw Error('Shader did not finish compiling');
    const draw = lowerWave => {
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      beam.draw(r,[0,0,0],{height:35,width:.45,time:4,lowerWave}); return pixels();
    };
    const original = draw(0), defaults = draw(undefined), lower = draw(1);
    // Model an opaque tree canopy covering the left half of the beam by writing
    // nearer scene depth. The beam must disappear behind it.
    gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);gl.scissor(0,0,360,400);gl.clearDepth(.25);gl.clear(gl.DEPTH_BUFFER_BIT);gl.disable(gl.SCISSOR_TEST);
    gl.depthFunc(gl.ALWAYS); // A preceding UI pass must not disable camp occlusion.
    beam.draw(r,[0,0,0],{height:35,width:.45,opacity:.6,throughWalls:false});
    const restoredDepthFunc=gl.getParameter(gl.DEPTH_FUNC)===gl.ALWAYS;
    const occluded=pixels();let coveredPixels=0,clearPixels=0;
    for(let y=0;y<400;y++)for(let x=0;x<720;x++)if(occluded[(y*720+x)*4+3]>0){if(x<360)coveredPixels++;else clearPixels++;}
    gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
    const deviation = bytes => {
      let sum=0,rows=0;
      for(let y=40;y<120;y++) {
        let weight=0,xSum=0;
        for(let x=0;x<720;x++){const a=bytes[(y*720+x)*4+3];weight+=a;xSum+=(x+.5)*a;}
        if(weight){sum+=Math.abs(xSum/weight-360);rows++;}
      }
      return sum/rows;
    };
    gl.clear(gl.COLOR_BUFFER_BIT);
    for(const [x,lowerWave]of [[-.5,0],[.5,1]])beam.draw(r,[x,0,0],{height:35,width:.4,time:4,lowerWave});
    const result = { defaultUnchanged: original.every((v,i)=>v===defaults[i]), restoredDepthFunc,coveredPixels,clearPixels,oldLowerSwayPixels:deviation(original), newLowerSwayPixels:deviation(lower), glError:gl.getError() };
    beam.dispose(); return result;
  });
  assert.equal(result.defaultUnchanged,true);
  assert.equal(result.glError,0);
  assert.equal(result.restoredDepthFunc,true);
  assert.equal(result.coveredPixels,0,'tree depth occludes camp beam');assert.ok(result.clearPixels>0,'uncovered beam remains visible');
  assert.ok(result.newLowerSwayPixels>result.oldLowerSwayPixels*2,'lower-column wave must visibly increase');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
