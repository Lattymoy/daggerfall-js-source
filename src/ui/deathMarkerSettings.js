import { deathMarkerControls } from '../systems/map/deathMarkerControls.js';

export function createDeathMarkerSettings(doc = document, controls = deathMarkerControls) {
  const section=doc.createElement('section'),heading=doc.createElement('h4'),note=doc.createElement('p'),list=doc.createElement('div'),refresh=doc.createElement('button'),clear=doc.createElement('button');
  section.dataset.deathHistory='';section.dataset.opt='deathMarkerHistory';section.className='opt';heading.textContent='Death marker history';
  note.textContent='Current character only. The oldest markers are removed when the limit is exceeded or lowered. Removing a marker clears it from the world and the Overworld map.';
  refresh.type=clear.type='button';refresh.textContent='Refresh markers';clear.textContent='Clear all death markers';
  let confirm=false;
  function render() {
    list.replaceChildren();const records=controls.list();clear.disabled=!records.length;
    clear.textContent=confirm?'Confirm clear all':'Clear all death markers';
    if(!records.length){const empty=doc.createElement('p');empty.textContent='No saved death markers for the active character.';list.append(empty);}
    for(const record of records){
      const row=doc.createElement('div'),text=doc.createElement('span'),remove=doc.createElement('button');row.className='row';
      text.textContent=`${record.name} · ${record.place} · ${new Date(record.time).toLocaleString()}`;
      remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove ${record.name}`);
      remove.onclick=()=>{controls.remove(record.id);confirm=false;render();};row.append(text,remove);list.append(row);
    }
  }
  refresh.onclick=()=>{confirm=false;render();};
  clear.onclick=()=>{if(confirm){controls.clear();confirm=false;}else confirm=true;render();};
  section.append(heading,note,list,refresh,clear);render();return section;
}
