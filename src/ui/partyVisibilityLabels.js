import { partyDistanceText, partyElevationArrow } from '../systems/party/partyPresentation.js';
import { layoutPartyEdgeMarkers } from '../systems/party/partySlots.js';
const partyLabelFocused=(p,r,percent)=>!p.edge&&Math.hypot(p.x-r.left-r.width/2,p.y-r.top-r.height/2)<=r.height*percent/100;

export function createPartyVisibilityLabels() {
  const root = document.createElement('div'); root.dataset.partyVisibility = '';
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden;font:600 14px/18px system-ui,sans-serif;text-shadow:1px 1px 0 #000,-1px -1px 0 #000;';
  document.body.append(root);
  const nodes = new Map();
  const set = (n,key,value,write) => { if(n.last[key]===value)return; n.last[key]=value; write(value); };
  return {
    sync(rows, options) {
      root.hidden = false;
      const live = new Set(), rect=options.rect??{left:0,top:0,width:globalThis.innerWidth,height:globalThis.innerHeight};
      for (const r of layoutPartyEdgeMarkers(rows,rect)) {
        live.add(r.acct); let n = nodes.get(r.acct);
        if (!n) {
          const wrap=document.createElement('div'),details=document.createElement('div'),label=document.createElement('div'),distance=document.createElement('span'),place=document.createElement('div');
          const glyph=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
          const person=document.createElementNS('http://www.w3.org/2000/svg','svg'),silhouette=document.createElementNS('http://www.w3.org/2000/svg','path'),seat=document.createElementNS('http://www.w3.org/2000/svg','text');
          person.setAttribute('viewBox','0 0 24 24');person.setAttribute('width','20');person.setAttribute('height','20');person.setAttribute('aria-hidden','true');person.dataset.partyPerson='';
          person.style.cssText='position:absolute;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 1px #000);';
          silhouette.setAttribute('d','M12 2a4 4 0 1 1 0 8a4 4 0 1 1 0-8M3 22v-4a9 7 0 0 1 18 0v4Z');silhouette.setAttribute('fill','currentColor');silhouette.setAttribute('stroke','#182019');
          seat.setAttribute('x','19');seat.setAttribute('y','23');seat.setAttribute('text-anchor','middle');seat.style.cssText='font:700 11px system-ui;fill:#fff;stroke:#101810;stroke-width:3px;paint-order:stroke;';person.append(silhouette,seat);
          glyph.setAttribute('viewBox','0 0 24 24');glyph.setAttribute('aria-hidden','true');
          glyph.style.cssText='display:block;filter:drop-shadow(0 1px 1px #000);';
          path.setAttribute('stroke','#182019');path.setAttribute('stroke-width','1');glyph.append(path);
          wrap.style.cssText='position:absolute;transform:translate(-50%,-50%);text-align:center;';
          details.style.cssText='position:absolute;bottom:100%;left:50%;width:max-content;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity 120ms linear;';
          label.style.cssText='position:absolute;top:100%;left:50%;width:210px;white-space:normal;font-size:12px;line-height:16px;transition:opacity 120ms linear;';
          place.style.cssText='overflow-wrap:anywhere;';
          glyph.dataset.partyGlyph='';details.dataset.partyName='';distance.dataset.partyDistance='';place.dataset.partyPlace='';
          label.append(distance,place);wrap.append(glyph,person,details,label);root.append(wrap);
          n={wrap,glyph,path,person,seat,details,label,distance,place,last:{}};nodes.set(r.acct,n);
        }
        const focus=partyLabelFocused(r,rect,12);
        const near=Number.isFinite(r.metres)&&r.metres<=30;
        const textAlpha=focus||near?1:.15;
        const edgePerson=r.edge;
        const reveal=!edgePerson;
        const color=/^#[\da-f]{6}$/i.test(r.color??'')?r.color:'#d7f5a2';
        const dpr=globalThis.devicePixelRatio||1;
        set(n,'x',`${Math.round(r.x*dpr)/dpr}px`,v=>{n.wrap.style.left=v;});set(n,'y',`${Math.round(r.y*dpr)/dpr}px`,v=>{n.wrap.style.top=v;});
        set(n,'alpha',String(r.alpha??1),v=>{n.wrap.style.opacity=v;});
        set(n,'color',color,v=>{n.wrap.style.color=v;});
        set(n,'size',String(edgePerson?12:options.size),v=>{n.glyph.setAttribute('width',v);n.glyph.setAttribute('height',v);});
        set(n,'personVisible',!!edgePerson,v=>{n.person.style.display=v?'block':'none';});
        set(n,'seat',Number.isInteger(r.slot)&&r.slot>=1&&r.slot<=8?String(r.slot):r.memberAccts?.length>1?'+':'',v=>{n.seat.textContent=v;});
        if(edgePerson){
          const angle=r.angle*Math.PI/180;
          set(n,'personX',`calc(50% - ${Math.cos(angle)*18}px)`,v=>{n.person.style.left=v;});
          set(n,'personY',`calc(50% - ${Math.sin(angle)*18}px)`,v=>{n.person.style.top=v;});
        }
        const icon=r.edge?'M3 4L22 12L3 20L7 12Z':'M12 1L20 12L12 23L4 12Z';
        set(n,'path',icon,v=>{n.path.setAttribute('d',v);});
        set(n,'fill','currentColor',v=>{n.path.setAttribute('fill',v);});
        set(n,'stroke','#182019',v=>{n.path.setAttribute('stroke',v);});
        set(n,'rotation',r.edge?`rotate(${r.angle}deg)`:'',v=>{n.glyph.style.transform=v;});
        const name=options.names?(r.playerName||r.name||'Party member'):'';
        set(n,'name',name,v=>{n.details.textContent=v;});
        const metres=options.distance?partyDistanceText(r.metres,r.exact!==false):'';
        set(n,'distance',metres,v=>{n.distance.textContent=v;});
        const caption=r.caption??(r.entrance?(r.place||'Entrance'):!r.exact?(r.place||'Location approximate'):partyElevationArrow(r.dy,options.elevation));
        set(n,'place',caption,v=>{n.place.textContent=v;});
        set(n,'nameHidden',!reveal||!name,v=>{n.details.hidden=v;});set(n,'labelHidden',!reveal||(!metres&&!caption),v=>{n.label.hidden=v;});
        set(n,'textAlpha',String(textAlpha),v=>{n.details.style.opacity=v;n.label.style.opacity=v;});
        // Onscreen aim/nearby reveal wins over the older distance-only dimmer.
        set(n,'distanceAlpha',String(!(focus||near)?r.distanceAlpha??1:1),v=>{n.distance.style.opacity=v;});
        const alignment=r.edgeLabelAlignment??(r.x<rect.left+110?'left':r.x>rect.left+rect.width-110?'right':null);
        const shift=alignment==='left'?'translateX(0)':alignment==='right'?'translateX(-100%)':'translateX(-50%)';
        set(n,'shift',shift,v=>{n.details.style.transform=v;n.label.style.transform=v;});
      }
      for(const [id,n]of nodes)if(!live.has(id)){n.wrap.remove();nodes.delete(id);}
    },
    hide(){root.hidden=true;},
    dispose(){root.remove();nodes.clear();},
  };
}
