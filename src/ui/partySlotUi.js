import {getPref} from '../systems/uiPrefs.js';
import {partySlotStyle} from '../systems/party/partySlots.js';

// Decorate the existing native seat rows, preserving controls, portraits and health bars.
// Order + name validation fails closed if a future client changes the UI structure.
export function createPartySlotUi(socialOf,doc=globalThis.document){
  let next=0,style=null;const owned=new Set(),healthLists=new Set(),companionLists=new Set();
  const clear=node=>{node.removeAttribute('data-keta-party-slot');node.style.removeProperty('--keta-party-color');owned.delete(node);};
  const syncAttribute=(selector,attribute,enabled,tracked)=>{
    const live=new Set(enabled?[...doc.querySelectorAll(selector)]:[]);
    for(const node of live){if(!node.hasAttribute(attribute))node.setAttribute(attribute,'');tracked.add(node);}
    for(const node of tracked)if(!live.has(node)){node.removeAttribute(attribute);tracked.delete(node);}
  };
  return {
    frame(now=performance.now()){
      if(!doc||now<next)return;next=now+250;
      const social=socialOf(),party=social?.party,live=new Set(),enabled=getPref('partyVisibility')===true;
      syncAttribute('.dfparty-list','data-keta-player-health',enabled&&getPref('partyPlayerHealthNumbers')!==false,healthLists);
      syncAttribute('.dfparty-mates','data-keta-companions',enabled&&getPref('partyCompanionDivider')!==false,companionLists);
      const decorate=(nodes,members,nameSelector)=>{
        if(nodes.length!==members.length)return;
        if(nodes.some((node,i)=>node.querySelector(nameSelector)?.textContent!==members[i].name))return;
        nodes.forEach((node,i)=>{
          const paint=partySlotStyle(party,members[i].acct);if(!paint)return;
          if(node.dataset.ketaPartySlot!==String(paint.slot))node.dataset.ketaPartySlot=String(paint.slot);
          if(node.style.getPropertyValue('--keta-party-color')!==paint.color)node.style.setProperty('--keta-party-color',paint.color);
          live.add(node);owned.add(node);
        });
      };
      if(enabled&&Array.isArray(party?.members)&&getPref('partySlotColors')!==false){
        decorate([...doc.querySelectorAll('.dfparty-list > .dfparty-card')],party.members.filter(m=>m.acct!==social.acct),'.dfparty-name');
        const panel=doc.querySelector('.dfsocial:has([data-tab="party"][aria-selected="true"])');
        if(panel){
          const rows=[...panel.querySelectorAll('.dfsocial-body > .dfsocial-row')].slice(0,party.members.length);
          decorate(rows,party.members,'.dfsocial-name');
        }
      }
      for(const node of owned)if(!live.has(node))clear(node);
      if((live.size||healthLists.size||companionLists.size)&&!style){
        style=doc.createElement('style');style.dataset.partySlotStyle='';
        style.textContent=`[data-keta-party-slot]::before{content:attr(data-keta-party-slot);color:var(--keta-party-color);border-left:2px solid currentColor;padding-left:3px;min-width:12px;flex-shrink:0;align-self:center;font:700 11px system-ui;text-shadow:1px 1px 2px #000;}
        [data-keta-party-slot] .dfparty-name,[data-keta-party-slot] .dfsocial-name{color:var(--keta-party-color)!important;}
        .dfparty-list[data-keta-player-health] > .dfparty-card:not(.away) .dfparty-hp.off{display:inline;color:var(--bone,#efe8d6);}
        .dfparty-mates[data-keta-companions]:not(:empty){margin-top:12px;padding-top:8px;border-top:1px solid rgba(205,193,157,.6);}
        .dfparty-mates[data-keta-companions]:not(:empty)::before{content:'COMPANIONS';display:block;margin-bottom:4px;font:600 11px/16px system-ui,sans-serif;letter-spacing:.08em;color:var(--bone,#d8cfae);text-shadow:1px 1px 2px #000;}`;
        doc.head.append(style);
      }
    },
    dispose(){for(const node of owned)clear(node);for(const node of healthLists)node.removeAttribute('data-keta-player-health');for(const node of companionLists)node.removeAttribute('data-keta-companions');healthLists.clear();companionLists.clear();style?.remove();},
  };
}
