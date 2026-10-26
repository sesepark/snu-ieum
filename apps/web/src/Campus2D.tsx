import { useEffect, useRef } from 'react';
import { project, surface, pickLabels, buildingCenter, homeView, type CampusViewProps } from './campus-model';
export default function Campus2D(p:CampusViewProps){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef(p);latest.current=p;
 const view=useRef(p.viewpoint);view.current=p.viewpoint;
 useEffect(()=>{
  const node=canvas.current;if(!node)return;
  let drag:{x:number;y:number;vx:number;vy:number;distance:number}|null=null;
  const scale=()=>Math.min(latest.current.width/2400,latest.current.height/3100)*view.current.zoom;
  const redraw=()=>{
   const q=latest.current,ctx=node.getContext('2d');if(!ctx)return;
   const ratio=Math.min(devicePixelRatio||1,2);node.width=q.width*ratio;node.height=q.height*ratio;
   ctx.scale(ratio,ratio);ctx.fillStyle='#f2f4ed';ctx.fillRect(0,0,q.width,q.height);
   const k=scale(),v=view.current,to=(x:number,y:number)=>[q.width/2+(x-v.x)*k,q.height/2+(y-v.y)*k];
   const t=q.campus.terrain;
   if(t){
    for(let j=0;j<t.rows;j++)for(let i=0;i<t.columns;i++){
     const h=t.heights[j*t.columns+i];if(h===null)continue;
     const [x,y]=project([t.west+(i+.5)/t.columns*(t.east-t.west),t.north-(j+.5)/t.rows*(t.north-t.south)]),[sx,sy]=to(x,y);
     ctx.fillStyle=`hsl(88 17% ${96-Math.min(1,h/650)*20}%)`;
     ctx.fillRect(sx-(t.east-t.west)*88300/t.columns*k/2,sy-(t.north-t.south)*111200/t.rows*k/2,(t.east-t.west)*88300/t.columns*k+1,(t.north-t.south)*111200/t.rows*k+1);
    }
   }
   const path=(points:readonly number[][],close=false)=>{ctx.beginPath();points.forEach((pt,i)=>{const [x,y]=to(...project(pt));if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});if(close)ctx.closePath();};
   for(const road of q.campus.paths){path(road.points,road.kind==='green');ctx.strokeStyle=road.kind==='road'?'#fff':'#b7c1ac';ctx.lineWidth=Math.max(.7,road.kind==='road'?6*k:1.2*k);if(road.kind==='green'){ctx.fillStyle='#b2c6a6';ctx.fill();}else ctx.stroke();}
   for(const m of q.model.markers){
    const b=m.building,selected=b.id===q.selectedBuilding,hit=q.searching&&m.matched>0;
    ctx.fillStyle=selected?'#285cc5':hit?'#f4b759':m.resourceIds.length?'#b7c6d7':'#e2e1da';ctx.strokeStyle=selected?'#1c4089':hit?'#a66c20':'#b4b9b4';ctx.lineWidth=selected?2:Math.max(.6,k);
    if(b.footprint){for(const ring of b.footprint.coordinates)path(ring,true);ctx.fill('evenodd');ctx.stroke();}else{const[x,y]=to(...m.center);ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}
   }
   const occupied:{x:number;y:number;w:number;h:number}[]=[];
   ctx.textAlign='center';ctx.textBaseline='middle';
   for(const m of pickLabels(q.model,q.selectedBuilding,q.searching,v.zoom)){
    const [x,y]=to(...m.center),selected=m.building.id===q.selectedBuilding;
    const text=`${m.building.number?m.building.number+'동 ':''}${m.building.name}${m.resourceIds.length?' · '+m.resourceIds.length:''}`;
    ctx.font=`${selected?'600':'500'} 11px sans-serif`;const w=ctx.measureText(text).width+14,h=24;
    if(!selected&&(x<0||x>q.width||y<0||y>q.height||occupied.some(r=>Math.abs(x-r.x)<(w+r.w)/2+4&&Math.abs(y-r.y)<(h+r.h)/2+4)))continue;
    occupied.push({x,y,w,h});ctx.fillStyle=selected?'#fff':'#fffffff0';ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,5);ctx.fill();ctx.fillStyle=selected?'#1b459a':'#30403a';ctx.fillText(text,x,y);
   }
   for(const link of q.model.links){const a=q.model.markers.find(m=>m.building.id===link.from),b=q.model.markers.find(m=>m.building.id===link.to);if(!a||!b)continue;const [x,y]=to(...a.center),[tx,ty]=to(...b.center);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.strokeStyle='#2563b8';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#1a467c';ctx.fillText(link.label,(x+tx)/2,(y+ty)/2-10);}
   ctx.fillStyle='#52624d';ctx.textAlign='left';ctx.font='11px sans-serif';ctx.fillText('N ↑',18,25);
   const meters=100,bar=meters*k;ctx.fillRect(18,q.height-24,bar,2);ctx.fillText('100 m',18,q.height-34);
  };
  const commit=()=>latest.current.onViewpoint({...view.current});
  const zoom=(f:number)=>{view.current={...view.current,zoom:Math.max(.2,Math.min(20,view.current.zoom*f))};redraw();commit();};
  const handle={home:()=>{view.current=homeView;redraw();commit();},zoom,focus:(id:string)=>{const m=latest.current.model.markers.find(m=>m.building.id===id||m.resourceIds.includes(id));if(m){view.current={...view.current,x:m.center[0],y:m.center[1],zoom:4};redraw();commit();}}};
  latest.current.onReady(handle);
  const down=(e:PointerEvent)=>{drag={x:e.clientX,y:e.clientY,vx:view.current.x,vy:view.current.y,distance:0};node.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance=Math.hypot(dx,dy);view.current={...view.current,x:Math.max(-6000,Math.min(6000,drag.vx-dx/scale())),y:Math.max(-6000,Math.min(6000,drag.vy-dy/scale()))};redraw();};
  const up=(e:PointerEvent)=>{if(!drag)return;const clicked=drag.distance<5;drag=null;if(!clicked){commit();return;}const rect=node.getBoundingClientRect(),x=(e.clientX-rect.left-latest.current.width/2)/scale()+view.current.x,y=(e.clientY-rect.top-latest.current.height/2)/scale()+view.current.y;
   const q=latest.current;let best:string|undefined,dist=Infinity;
   for(const m of q.model.markers){const d=Math.hypot(m.center[0]-x,m.center[1]-y);if(d<Math.max(22/scale(),35)&&d<dist){dist=d;best=m.building.id;}}
   if(best)q.onBuilding(best);
  };
  let timer:ReturnType<typeof setTimeout>|undefined;
  const wheel=(e:WheelEvent)=>{e.preventDefault();view.current={...view.current,zoom:Math.max(.2,Math.min(20,view.current.zoom*Math.exp(-e.deltaY*.001)))};redraw();clearTimeout(timer);timer=setTimeout(commit,180);};
  const key=(e:KeyboardEvent)=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=80/view.current.zoom;view.current={...view.current,x:view.current.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:view.current.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)};redraw();commit();}else if(e.key==='+'||e.key==='=')zoom(1.3);else if(e.key==='-')zoom(.77);else if(e.key==='Home')handle.home();};
  node.addEventListener('pointerdown',down);node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('wheel',wheel,{passive:false});node.addEventListener('keydown',key);
  const cancel=()=>{drag=null;};node.addEventListener('pointercancel',cancel);
  redraw();const render=()=>redraw();node.addEventListener('campus-redraw',render);
  return()=>{clearTimeout(timer);node.removeEventListener('pointerdown',down);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('wheel',wheel);node.removeEventListener('keydown',key);node.removeEventListener('pointercancel',cancel);node.removeEventListener('campus-redraw',render);};
 },[]);
 useEffect(()=>{canvas.current?.dispatchEvent(new Event('campus-redraw'));},[p]);
 return <canvas ref={canvas} style={{width:p.width,height:p.height,touchAction:'none'}} tabIndex={0} aria-label="2D 실제 관악 캠퍼스. 방향키 이동, 더하기·빼기 확대, 건물 목록에서 선택."/>;
}
