// Small map annotations, drawn on the existing HUD canvas. No DOM tiles, timers,
// animated effects, extra render passes or persistent location tracking.
const TYPES=new Set(['campfire','tent','skull']);
const COLORS={campfire:'#ffc879',tent:'#b6dc96',skull:'#a4dcff'};
export const beaconKind=m=>TYPES.has(m?.beaconIcon)?m.beaconIcon:m?.deathId?'skull':null;
const short=value=>String(value??'').slice(0,30);
const distanceText=n=>n<1000?`${Math.round(n)} m`:`${(n/1000).toFixed(n<10000?1:0)} km`;
export function projectBeaconMarker(mark,feet){
  const type=beaconKind(mark);if(!type)return {};
  const valid=p=>p?.length===3&&Array.from(p).every(Number.isFinite);
  const distance=valid(mark.at)&&valid(feet)?Math.hypot(...mark.at.map((n,i)=>n-feet[i])):NaN;
  return {beaconIcon:type,beaconBeam:mark.beaconBeam!==false,
    beaconOpacity:Number.isFinite(mark.beaconOpacity)?Math.max(.1,Math.min(.6,mark.beaconOpacity)):.6,
    ...(mark.deathId?{deathId:mark.deathId}:{}),sub:Number.isFinite(distance)?distanceText(distance):short(mark.sub)};
}
export function beaconMapBox(q,vw){
  const half=q.held?12:Math.min(90,Math.max(14,Math.max(short(q.m.label).length,short(q.m.sub).length)*3.5+6));
  const cx=Math.max(half,Math.min(vw-half,q.x));
  return{x0:cx-half,x1:cx+half,y0:q.y-(!q.held&&q.m.beaconBeam!==false?48:12),y1:q.y+(q.held?12:44)};
}
function icon(ctx,type,x,y,color){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.fillStyle=color;ctx.strokeStyle='#17191b';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.beginPath();
  if(type==='tent'){
    ctx.moveTo(0,-9);ctx.lineTo(11,8);ctx.lineTo(-11,8);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#17191b';ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(5,8);ctx.lineTo(-5,8);ctx.closePath();ctx.fill();
  }else if(type==='campfire'){
    ctx.moveTo(-6,4);ctx.bezierCurveTo(-11,-1,-2,-5,-2,-10);ctx.bezierCurveTo(5,-7,2,-2,6,-4);ctx.bezierCurveTo(11,4,4,7,0,7);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,9);ctx.lineTo(8,6);ctx.moveTo(-8,6);ctx.lineTo(8,9);ctx.stroke();
  }else{
    ctx.moveTo(-5,-9);ctx.lineTo(5,-9);ctx.lineTo(8,-5);ctx.lineTo(8,2);ctx.lineTo(4,5);ctx.lineTo(4,9);ctx.lineTo(-4,9);ctx.lineTo(-4,5);ctx.lineTo(-8,2);ctx.lineTo(-8,-5);ctx.closePath();
    ctx.rect(-5,-3,3,3);ctx.rect(2,-3,3,3);ctx.moveTo(0,1);ctx.lineTo(-2,4);ctx.lineTo(2,4);ctx.closePath();ctx.fill('evenodd');ctx.stroke();
  }
  ctx.restore();
}
export function paintBeaconMapMarker(ctx,q,vw,font='system-ui, sans-serif'){
  const type=beaconKind(q.m);if(!type)return false;
  const{x,y,m}=q,color=/^#[\da-f]{6}$/i.test(m.color??'')?m.color:COLORS[type];
  ctx.save();ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  if(!q.held&&m.beaconBeam!==false){
    const opacity=Number.isFinite(m.beaconOpacity)?Math.max(.1,Math.min(.6,m.beaconOpacity)):.6;
    const gradient=ctx.createLinearGradient(x,y-48,x,y-9);gradient.addColorStop(0,color+'00');gradient.addColorStop(1,color+'ff');
    ctx.save();ctx.globalAlpha*=opacity;ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-1,y-48);ctx.lineTo(x+1,y-48);ctx.lineTo(x+4,y-9);ctx.lineTo(x-4,y-9);ctx.closePath();ctx.fill();ctx.restore();
  }
  icon(ctx,type,x,y,color);
  if(!q.held){
    const cx=Math.round(Math.max(90,Math.min(vw-90,x)));
    ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=2.5;ctx.strokeStyle='#17191b';ctx.lineJoin='round';
    for(const[text,dy,size,tint]of [[short(m.label),14,12,color],[short(m.sub),29,11,'#e6e0d2']]){
      if(!text)continue;ctx.font=`600 ${size}px ${font}`;ctx.strokeText(text,cx,Math.round(y+dy),174);ctx.fillStyle=tint;ctx.fillText(text,cx,Math.round(y+dy),174);
    }
  }
  ctx.restore();return true;
}
