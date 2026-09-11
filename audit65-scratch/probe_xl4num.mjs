import { PlayerMotor, STEP_OFFSET, STEP_SMOOTH_TAU } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function quad(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz){return {positions:[ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz],indices:[0,1,2,0,2,3]};}
function stairs(){const col=new Collider(()=>0);const f=quad(-10,0,-10,10,0,-10,10,0,20,-10,0,20);col.addMesh('floor',f.positions,f.indices,I4);
const run=0.6,riser=0.3,count=8,hw=2,z0=2;
for(let i=0;i<count;i++){const zf=z0+i*run,yb=i*riser,yt=(i+1)*riser;const r=quad(-hw,yb,zf,hw,yb,zf,hw,yt,zf,-hw,yt,zf);col.addMesh('s',r.positions,r.indices,I4);const t=quad(-hw,yt,zf,hw,yt,zf,hw,yt,zf+run,-hw,yt,zf+run);col.addMesh('s',t.positions,t.indices,I4);}
const topY=count*riser,topZ=z0+count*run;const land=quad(-hw,topY,topZ,hw,topY,topZ,hw,topY,topZ+30,-hw,topY,topZ+30);col.addMesh('s',land.positions,land.indices,I4);
return {col,topY,topZ};}
const walkInput={forward:1,strafe:0,run:false,jump:false,up:false,down:false};
const worst=(dt,read)=>{const {col,topZ}=stairs();const m=new PlayerMotor(col);m.pos=[0,0,0];m.grounded=true;let rise=0,lag=0,prev=read(m)[1],f=0;
while(m.pos[2]<topZ+3&&f<2000){m.update(dt,walkInput,0);const v=read(m)[1];rise=Math.max(rise,v-prev);lag=Math.max(lag,Math.abs(m.feetAt()[1]-m.pos[1]));prev=v;f++;}return {rise,lag};};
console.log('STEP_OFFSET',STEP_OFFSET,'STEP_SMOOTH_TAU',STEP_SMOOTH_TAU);
for (const hz of [60,90,120,144]) {
  const dt=1/hz;
  const e=worst(dt,(m)=>m.eyeAt()), fe=worst(dt,(m)=>m.feetAt()), raw=worst(dt,(m)=>m.pos);
  console.log(hz+'Hz  eyeAt', e.rise.toFixed(4), ' feetAt', fe.rise.toFixed(4), ' raw', raw.rise.toFixed(4), ' lag', fe.lag.toFixed(4));
}
