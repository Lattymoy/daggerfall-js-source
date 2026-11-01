import {layoutDeathEdgeMarkers,projectDeathMarker,deathBeamStyle,deathNumber,deathColor,colorRGB,createMarkerDwell} from '../systems/map/deathMarkerPresentation.js';
import {startPrograms,releasePrograms} from '../render/glProgram.js';
import { createDeathBeaconStore, deathBeaconTarget, deathWorldPoint, deathMapCircle, deathMarkerLimit } from '../systems/map/deathBeacon.js';
import { registerDeathMarkerControls } from '../systems/map/deathMarkerControls.js';
import { appStorage } from '../systems/appStorage.js';
import { getPref } from '../systems/uiPrefs.js';
import { DeathBeacon } from '../render/deathBeacon.js';
import { createDeathMarkerLabel } from '../ui/deathMarkerLabel.js';

export function createDeathBeaconHost(deps) {
  const store = deps.store ?? createDeathBeaconStore(appStorage());
  let character = null, records = [], dead = false, outside = null, beam = null, failed = false, limit = 5, beamReady = null, syncedRevision = -1;
  const labels = new Map(), dwell = createMarkerDwell();
  const now = deps.now ?? (() => Date.now());
  const sync = () => {
    const id = deps.character(), cap = deathMarkerLimit(getPref('deathMarkerLimit'));
    const changed=id!==character, resized=cap!==limit;
    if (changed) { character = id; dead = false; outside = null; hide(); }
    limit = cap;
    if(character&&(changed||resized))store.trim(character,limit);
    if(changed||resized||store.revision==null||store.revision!==syncedRevision){records=character?store.list(character):[];syncedRevision=store.revision;}
  };
  function hide() { for (const label of labels.values()) label.hide(); dwell.reset(); }
  const release = () => { beam?.dispose(); if(beamReady&&!beam)releasePrograms(deps.renderer.gl,DeathBeacon.programs); beamReady=null; beam = null; for (const label of labels.values()) label.dispose(); labels.clear(); failed = false; dwell.reset(); };
  const lost = () => { beamReady=null; beam = null; failed = false; hide(); };
  deps.canvas.addEventListener('webglcontextlost', lost);
  const mapsOn = () => getPref('deathBeacon') === true && getPref('deathMapMarkers') !== false;
  const points = () => { sync(); return mapsOn() ? records.map(deathWorldPoint).filter(Boolean) : []; };
  const localPoints = () => {
    sync(); if (!mapsOn()) return [];
    const here = deps.place();
    return records.flatMap(r => { const target = deathBeaconTarget(r,here); return target ? [{id:r.id,time:r.time,at:target.world?deps.fromWorld(target.at):target.at,label:target.entrance?'Death — entrance':'Death location',entrance:target.entrance,space:here.space}] : []; });
  };
  function update() {
    sync();
    if (!character || !deps.ready()) return;
    const here = deps.place(), feet = deps.feet();
    if (!here || !feet?.every(Number.isFinite)) return;
    const health = deps.health();
    if (!Number.isFinite(health)) return;
    const dying = health <= 0;
    if (here.space === 'world' && !dying) outside = deps.toWorld(feet);
    if (dying && !dead && getPref('deathBeacon')) {
      const entrance = deps.entrance?.();
      const next = { place: here, at: here.space === 'dungeon' ? [...feet] : deps.toWorld(feet), time: now(),
        entrance: here.space === 'world' ? null : entrance ? deps.toWorld(entrance) : here.space === 'interior' ? outside : null };
      store.write(character,next,limit); records = store.list(character);
    }
    dead = dying;
    if (!dying && getPref('deathAutoClear') === true) {
      for (const record of records) {
        const target = deathBeaconTarget(record,here);
        if (!target || target.entrance) continue;
        const at = target.world ? deps.fromWorld(target.at) : target.at;
        if (Math.hypot(...at.map((v,i)=>v-feet[i])) < 2.5) store.remove(character,record.id);
      }
      records = store.list(character);
    }
  }
  const api = {
    update,
    history: () => { sync(); return records.map((r,i)=>({id:r.id,time:r.time,name:i===0?'Latest death':`Death ${i+1}`,place:r.place.name||(r.place.space==='world'?'Outdoors':r.place.space==='dungeon'?'Dungeon':'Building'),hasEntrance:!!r.entrance})); },
    remove(id) { sync(); const changed = !!character && store.remove(character,id); if (changed) { records=store.list(character); labels.get(id)?.dispose(); labels.delete(id); dwell.reset(); } return changed; },
    clear() { sync(); if (!character) return false; store.clear(character); records=[]; release(); return true; },
    localPoints,
    absolutePoints: points,
    mapCircles: () => { sync(); return mapsOn()?records.map(deathMapCircle).filter(Boolean):[]; },
    worldPoints: () => points().map(p=>({...p,at:deps.fromWorld(p.at)})),
    // Keep the previous kit's read-only entry points until its adapter is regenerated.
    mapCircle: () => api.mapCircles()[0]??null,
    worldPoint: () => api.worldPoints()[0]??null,
    frame(covered) {
      sync();
      if (!getPref('deathBeacon') || !records.length) { release(); return; }
      if (covered || dead) { hide(); return; }
      const here=deps.place(),feet=deps.feet();if(!here||!feet?.every(Number.isFinite)){hide();return;}
      const rect=deps.rect(),rows=[],live=new Set();
      for (const record of records) {
        const target=deathBeaconTarget(record,here);if(!target)continue;
        const at=target.world?deps.fromWorld(target.at):target.at;
        const distance=Math.hypot(...at.map((v,i)=>v-feet[i]));
        if(distance>deathNumber('deathRenderDistance',5000,100,100000))continue;
        // Several deaths at one entrance share one world symbol and beam, but remain individually removable.
        const group=rows.find(r=>Math.hypot(...r.at.map((v,i)=>v-at[i]))<2);
        if(group){group.count++;continue;}
        const p=projectDeathMarker(at,deps.renderer._proj,deps.renderer._view,rect,34);
        if(p)rows.push({...p,at,acct:record.id,count:1,metres:distance,name:target.entrance?'Death — entrance':'Death location'});
      }
      const focused=dwell.update(rows,rect,{distance:deathNumber('deathLabelDistance',2000,10,100000),delay:deathNumber('deathLabelDelay',300,0,1500),radius:deathNumber('deathLabelFocus',8,2,15),now:now()});
      for(const row of layoutDeathEdgeMarkers(rows,rect)){
        live.add(row.acct);
        if(getPref('deathBeams')!==false&&!row.edge&&!failed&&!deps.renderer.gl.isContextLost()){
          try{
            beamReady??=startPrograms(deps.renderer.gl,DeathBeacon.programs);
            if(!beam&&beamReady())beam=new DeathBeacon(deps.renderer.gl);
            beam?.draw(deps.renderer,[row.at[0],row.at[1]+.3,row.at[2]],{...deathBeamStyle(row.metres,{height:deathNumber('deathBeamHeight',100,5,100),opacity:deathNumber('deathOpacity',.6,.1,.6),exterior:here.space==='world'}),
              width:Math.min(1.5,Math.max(.3,row.metres*.003)),color:colorRGB(deathColor('deathColor','#a4dcff')),lowerWave:deathNumber('deathLowerWave',1,0,1),time:(now()%3600000)/1000});
          }catch(e){beam?.dispose();beam=null;failed=true;console.warn('[death beacon] Beam unavailable; skull markers remain.',e);}
        }
        if(typeof document==='undefined')continue;
        let label=labels.get(row.acct);if(!label){label=createDeathMarkerLabel();labels.set(row.acct,label);}
        label.sync(row,{name:row.name+(row.count>1?` (${row.count})`:''),metres:row.metres,color:deathColor('deathColor','#a4dcff'),size:deathNumber('deathMarkerSize',18,12,40),
          showLabel:!row.edge&&(getPref('deathLabelOnLook')===false||focused?.acct===row.acct),labelOpacity:deathNumber('deathLabelOpacity',.85,.2,1)});
      }
      for(const[id,label]of labels)if(!live.has(id)){label.dispose();labels.delete(id);}
      if(getPref('deathBeams')===false){beam?.dispose();if(beamReady&&!beam)releasePrograms(deps.renderer.gl,DeathBeacon.programs);beam=null;beamReady=null;}
    },
    dispose(){release();unregister();deps.canvas.removeEventListener('webglcontextlost',lost);},
  };
  const unregister=registerDeathMarkerControls(api);
  return api;
}
