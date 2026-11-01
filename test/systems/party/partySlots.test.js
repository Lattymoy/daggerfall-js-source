import {test} from 'node:test';import assert from 'node:assert/strict';
import {PARTY_SLOT_COLORS,partySlotStyle,layoutPartyEdgeMarkers} from '../../../src/systems/party/partySlots.js';
test('all eight server slots include self/offline members and retain colors on leader change',()=>{
  const party={leader:'a0',members:Array.from({length:8},(_,i)=>({acct:`a${i}`,online:i!==2,name:'Duplicate name'}))};
  assert.equal(new Set(PARTY_SLOT_COLORS).size,8);
  for(let i=0;i<8;i++)assert.deepEqual(partySlotStyle(party,`a${i}`),{slot:i+1,color:PARTY_SLOT_COLORS[i]});
  party.leader='a4';assert.equal(partySlotStyle(party,'a4').slot,5);
  assert.equal(partySlotStyle(party,'stranger'),null);assert.equal(partySlotStyle(null,'a0'),null);
  party.members.splice(1,1);assert.equal(partySlotStyle(party,'a2').slot,2);
});
test('crowded edge markers separate inside the viewport without changing bearings or source coordinates',()=>{
  const rows=Array.from({length:8},(_,i)=>({edge:true,x:164,y:250,angle:180,slot:i+1}));
  const placed=layoutPartyEdgeMarkers(rows,{left:100,top:40,width:600,height:400});
  const ys=placed.map(r=>r.y).sort((a,b)=>a-b);
  assert.ok(ys.every((y,i)=>y>=80&&y<=400&&(!i||y-ys[i-1]>=32)));
  assert.ok(placed.every(r=>r.x===164&&r.angle===180));assert.ok(rows.every(r=>r.y===250));
});
