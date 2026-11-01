import {getPref} from '../systems/uiPrefs.js';
import {CampBeacon} from '../render/campBeacon.js';
import {ownCampMarks, campBeamStyle, campOverworldMarks} from '../systems/betterCampfires.js';

// Owned, bounded live-pool reads: no polling, persisted coordinates or remote camps.
export function createBetterCampfires({renderer, canvas, pool, feet, exterior}) {
  let pass=null, failed=false;
  const release=()=>{pass?.dispose();pass=null;failed=false;};
  const lost=()=>{pass=null;failed=false;};
  canvas.addEventListener('webglcontextlost',lost);
  return {
    frame(covered=false) {
      if(!getPref('ketaCampBeacons')){release();return;}
      if(covered||failed||renderer.gl.isContextLost())return;
      const rows=ownCampMarks(pool(),feet()).filter(row=>row.distance<=(getPref('ketaCampRange')??500));
      if(!rows.length)return;
      try {
        pass??=new CampBeacon(renderer.gl);
        for(const row of rows)pass.draw(renderer,row.at,{
          ...campBeamStyle(row.distance,{height:getPref('ketaCampHeight')??100,opacity:getPref('ketaCampOpacity')??.6,exterior:exterior()}),
          color:[1,.7,.3],width:1.5,lowerWave:1,time:performance.now()/1000,
        });
      }catch(error){release();failed=true;console.warn('[Keta campfires] Beacon unavailable',error);}
    },
    mapMarks(){return getPref('ketaCampMap')?campOverworldMarks(pool(),{beam:getPref('ketaCampBeacons')!==false,opacity:getPref('ketaCampOpacity')??.6}):[];},
    dispose(){release();canvas.removeEventListener('webglcontextlost',lost);},
  };
}
