import { PlayerMotor, STEP_OFFSET } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const I4 = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
function quad(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz){return {positions:[ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz],indices:[0,1,2,0,2,3]};}
function stairs(){
  const col=new Collider(()=>0);
  const floor=quad(-10,0,-10,10,0,-10,10,0,20,-10,0,20);
  col.addMesh('floor',floor.positions,floor.indices,I4);
  const run=0.6,riser=0.3,count=8,hw=2,z0=2;
  for(let i=0;i<count;i++){const zf=z0+i*run,yb=i*riser,yt=(i+1)*riser;
    const r=quad(-hw,yb,zf,hw,yb,zf,hw,yt,zf,-hw,yt,zf);col.addMesh('s',r.positions,r.indices,I4);
    const t=quad(-hw,yt,zf,hw,yt,zf,hw,yt,zf+run,-hw,yt,zf+run);col.addMesh('s',t.positions,t.indices,I4);}
  const topY=count*riser,topZ=z0+count*run;
  const land=quad(-hw,topY,topZ,hw,topY,topZ,hw,topY,topZ+30,-hw,topY,topZ+30);
  col.addMesh('s',land.positions,land.indices,I4);
  return {col,topY,topZ};
}
const walkInput={forward:1,strafe:0,run:false,jump:false,up:false,down:false};
function run(dt, mode){
  const {col,topY,topZ}=stairs();
  const m=new PlayerMotor(col); m.pos=[0,0,0]; m.grounded=true;
  const read = mode==='eye' ? ()=>m.eyeAt()[1] : mode==='feet' ? ()=>m.feetAt()[1] : ()=>m.pos[1];
  let maxRise=0, maxLag=0, prev=read(), f=0, maxDz=-1e9, minDz=1e9;
  let prevX = (mode==='eye'?m.eyeAt():mode==='feet'?m.feetAt():m.pos)[2];
  while(m.pos[2]<topZ+3 && f<2000){
    m.update(dt,walkInput,0);
    const v=read(); maxRise=Math.max(maxRise,v-prev); prev=v;
    const z=(mode==='eye'?m.eyeAt():mode==='feet'?m.feetAt():m.pos)[2];
    maxDz=Math.max(maxDz,z-prevX); minDz=Math.min(minDz,z-prevX); prevX=z;
    if(mode==='feet') maxLag=Math.max(maxLag,Math.abs(m.feetAt()[1]-m.pos[1]));
    f++;
  }
  return {maxRise,maxLag,maxDz,minDz,topY,y:m.pos[1]};
}
for(const dt of [1/60,1/90,1/120,1/144]){
  const e=run(dt,'eye'), ft=run(dt,'feet'), raw=run(dt,'raw');
  console.log(`dt=1/${Math.round(1/dt)} eyeRise=${e.maxRise.toFixed(4)} feetAtRise=${ft.maxRise.toFixed(4)} rawRise=${raw.maxRise.toFixed(4)} lag=${ft.maxLag.toFixed(4)} STEP_OFFSET=${STEP_OFFSET}`);
  console.log(`      dz: feetAt[${ft.minDz.toFixed(4)},${ft.maxDz.toFixed(4)}] raw[${raw.minDz.toFixed(4)},${raw.maxDz.toFixed(4)}] eye[${e.minDz.toFixed(4)},${e.maxDz.toFixed(4)}]`);
}
