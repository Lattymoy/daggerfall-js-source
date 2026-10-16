import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.env.DFO_REPO??new URL('../../',import.meta.url).pathname);
const require=createRequire(path.join(root,'package.json'));
const {parse}=require('acorn');
const source=readFileSync(path.join(root,'src/scenes/world.js'),'utf8');
let fn;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='Property'&&n.key?.name==='disenchant'&&source.slice(n.value.start,n.value.end).includes('modes?.enchantHere'))fn=source.slice(n.value.start,n.value.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
walk(parse(source,{ecmaVersion:'latest',sourceType:'module'}));assert.ok(fn,'production disenchant host callback found');
const {realmGoldAct}=await import(pathToFileURL(path.join(root,'src/systems/realmSaves.js')));
const defer=()=>{let resolve;return {promise:new Promise(r=>{resolve=r}),resolve:r=>resolve(r)}};
test('a realm disenchant rollback restores only the initiating inventory after a character switch',async()=>{
 const pending=defer(),piece={provenance:'aaaaaaaaaaaaaaaa',name:'Gold Ruby Ring'},itemsA=[piece],itemsB=[{name:'B item'}];
 const playerEntity={characterId:'A',items:itemsA,gold:1000};let checkpoints=0;
 const env={playerEntity,modes:{enchantHere:()=>({kind:'shop',fee:50})},totalGoldAmount:p=>p.gold,itemLongName:p=>p.name,
  characterIdOf:p=>p.characterId,storedSession:()=>({id:'account-A'}),appStorage:()=>null,
  realmSession:{transact:fn=>fn({id:'record-A',lease:'lease-A',seq:1})},realmGoldAct,onlineCheckpoint:()=>checkpoints++,
  profBook:{disenchant:()=>pending.promise,refresh:async()=>({ok:true})},deductGold:(p,n)=>p.gold-=n,saveSoon:{changed:()=>{}},accountRefusalText:x=>x};
 const host=Function(...Object.keys(env),`return (${fn})`)(...Object.values(env));const action=host(piece.provenance);
 await new Promise(r=>setImmediate(r));assert.equal(itemsA.length,0,'original piece reserved before request');
 playerEntity.characterId='B';playerEntity.items=itemsB;
 pending.resolve({ok:false,error:'prof-piece-busy',elsewhere:true});const r=await action;
 assert.deepEqual(itemsB,[{name:'B item'}],'rollback must not put A ring into B pack');
 assert.deepEqual(itemsA,[piece],'original collection receives rollback');assert.equal(playerEntity.gold,1000);assert.equal(r.ok,false);
 assert.equal(checkpoints,1,'completion must not checkpoint the next character');
});
for (const switchIdentity of [false,true]) test(`confirmed realm success ${switchIdentity?'after a switch is not rolled back or charged to the next character':'removes the item and charges its own character'}`,async()=>{
 const pending=defer(),piece={provenance:'aaaaaaaaaaaaaaaa',name:'Gold Ruby Ring'},itemsA=[piece],itemsB=[{name:'B item'}];
 const playerEntity={characterId:'A',items:itemsA,gold:1000};let checkpoints=0,saves=0;
 const env={playerEntity,modes:{enchantHere:()=>({kind:'shop',fee:50})},totalGoldAmount:p=>p.gold,itemLongName:p=>p.name,
  characterIdOf:p=>p.characterId,storedSession:()=>({id:'account-A'}),appStorage:()=>null,
  realmSession:{transact:fn=>fn({id:'record-A',lease:'lease-A',seq:1})},realmGoldAct,onlineCheckpoint:()=>checkpoints++,
  profBook:{disenchant:()=>pending.promise,refresh:async()=>({ok:true})},deductGold:(p,n)=>p.gold-=n,saveSoon:{changed:()=>saves++},accountRefusalText:x=>x};
 const host=Function(...Object.keys(env),`return (${fn})`)(...Object.values(env));const action=host(piece.provenance);
 await new Promise(r=>setImmediate(r));if(switchIdentity){playerEntity.characterId='B';playerEntity.items=itemsB;}
 pending.resolve({ok:true,data:{essence:21,xp:315,realm:{seq:2}},...(switchIdentity?{elsewhere:true}:{})});const r=await action;
 assert.deepEqual(itemsA,[],'completed server action must never restore its item');assert.deepEqual(itemsB,[{name:'B item'}]);
 assert.equal(playerEntity.gold,switchIdentity?1000:950);assert.equal(r.ok,!switchIdentity);assert.equal(checkpoints,switchIdentity?1:2);assert.equal(saves,switchIdentity?0:1);
});
