import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeathBeaconStore,DEATH_BEACON_KEY,deathMarkerLimit} from '../../src/systems/map/deathBeacon.js';
import {createDeathBeaconHost} from '../../src/scenes/deathBeaconHost.js';
import {deathMarkerControls} from '../../src/systems/map/deathMarkerControls.js';
import {getPref,setPref} from '../../src/systems/uiPrefs.js';
const record=(time=1)=>({at:[10,2,30],place:{space:'dungeon',k:'d:mine'},entrance:[327680,2,3276800],time});
const shelf=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('history migrates the single-marker shelf, bounds each character, removes by identity, and preserves newest records',()=>{
  const storage=shelf();storage.setItem(DEATH_BEACON_KEY,JSON.stringify([{character:'a',...record()}]));
  const store=createDeathBeaconStore(storage),legacy=store.read('a');assert.ok(legacy.id);
  assert.equal(createDeathBeaconStore(storage).read('a').id,legacy.id,'migration saves stable identity immediately');
  for(let time=2;time<=8;time++)store.write('a',record(time));
  assert.deepEqual(store.list('a').map(r=>r.time),[8,7,6,5,4]);
  const remove=store.list('a')[2];store.write('b',record(90));
  assert.equal(store.remove('b',remove.id),false);assert.equal(store.remove('a',remove.id),true);
  assert.deepEqual(createDeathBeaconStore(storage).list('a').map(r=>r.time),[8,7,5,4]);
  store.trim('a',2);assert.deepEqual(store.list('a').map(r=>r.time),[8,7]);
  store.clear('a');assert.deepEqual(store.list('a'),[]);assert.equal(store.read('b').time,90);
  for(let i=0;i<200;i++)store.write('b',record(i),999);
  assert.equal(store.list('b').length,10);
  assert.equal(deathMarkerLimit(NaN),5);assert.equal(deathMarkerLimit(-1),1);
  assert.equal(new Set(store.list('b').map(r=>r.id)).size,10);
});
test('native death owner captures once, projects entrance, removes immediately and isolates characters',()=>{
const keys=['deathBeacon','deathMapMarkers','deathAutoClear','deathMarkerLimit'],before=keys.map(getPref);setPref('deathBeacon',true);setPref('deathMapMarkers',true);setPref('deathAutoClear',false);setPref('deathMarkerLimit',5);
let character='a',health=100,here={space:'dungeon',k:'d:mine'};const host=createDeathBeaconHost({store:createDeathBeaconStore(shelf()),canvas:{addEventListener(){},removeEventListener(){}},character:()=>character,health:()=>health,place:()=>here,ready:()=>true,feet:()=>[1,2,3],entrance:()=>[30,0,40],toWorld:p=>[p[0]+100,p[1],p[2]+100],fromWorld:p=>[p[0]-100,p[1],p[2]-100]});
try{host.update();health=0;for(let i=0;i<50;i++)host.update();assert.equal(host.history().length,1);assert.deepEqual(host.worldPoints()[0].at,[30,0,40]);here={space:'world',k:'w'};health=100;host.update();assert.equal(host.history().length,1);const id=host.history()[0].id;character='b';host.update();assert.equal(host.history().length,0);assert.equal(host.remove(id),false);character='a';host.update();assert.equal(host.history().length,1);setPref('deathMapMarkers',false);assert.deepEqual(host.worldPoints(),[]);assert.equal(host.history().length,1);setPref('deathMapMarkers',true);assert.equal(deathMarkerControls.remove(id),true);assert.deepEqual(host.worldPoints(),[]);}finally{host.dispose();keys.forEach((key,i)=>setPref(key,before[i]));}assert.deepEqual(deathMarkerControls.list(),[]);
});
