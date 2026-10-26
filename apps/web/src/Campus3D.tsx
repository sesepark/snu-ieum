import { useEffect, useRef } from 'react';
import { AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, ExtrudeGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, Path, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Shape, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { homeView, project, surface, pickLabels, type CampusViewProps, type Viewpoint } from './campus-model';
export default function Campus3D(p:CampusViewProps){
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),latest=useRef(p);latest.current=p;
 const runtime=useRef<{apply(v:Viewpoint):void;update():void}|null>(null);
 useEffect(()=>{
  const node=canvas.current,container=root.current;if(!node||!container)return;
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({canvas:node,antialias:true,alpha:false,powerPreference:'high-performance'});}catch{latest.current.onFailure();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor('#edf2f3');
  const scene=new Scene(),camera=new PerspectiveCamera(42,1,1,16000);camera.up.set(0,0,1);
  const controls=new OrbitControls(camera,node);controls.enableDamping=!p.reducedMotion;controls.dampingFactor=.12;controls.minDistance=180;controls.maxDistance=12500;controls.maxPolarAngle=Math.PI*.46;controls.minPolarAngle=Math.PI*.08;
  const ambient=new AmbientLight(0xffffff,.8),light=new DirectionalLight(0xfff8ec,1.65);light.position.set(-700,1200,2500);scene.add(ambient,light);
  const meshes=new Map<string,Mesh>(),group=new Group(),relations=new Group();scene.add(group,relations);
  const t=p.campus.terrain;
  if(t){
   const positions:number[]=[],colors:number[]=[],indices:number[]=[];
   for(let j=0;j<t.rows;j++)for(let i=0;i<t.columns;i++){
    const [x,y]=project([t.west+(i+.5)/t.columns*(t.east-t.west),t.north-(j+.5)/t.rows*(t.north-t.south)]),h=t.heights[j*t.columns+i]??0;
    positions.push(x,y,h);const c=new Color().setHSL(.23,.12,.76-Math.min(1,h/650)*.15);colors.push(c.r,c.g,c.b);
   }
   for(let j=0;j<t.rows-1;j++)for(let i=0;i<t.columns-1;i++){
    const a=j*t.columns+i,b=a+1,c=a+t.columns,d=c+1;
    if([a,b,c,d].every(n=>t.heights[n]!==null))indices.push(a,c,b,b,c,d);
   }
   const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));geometry.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));geometry.setIndex(indices);geometry.computeVertexNormals();group.add(new Mesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:1,side:DoubleSide})));
  }else{const ground=new Mesh(new PlaneGeometry(2600,3300),new MeshStandardMaterial({color:'#e8ecdf',side:DoubleSide}));group.add(ground);}
  for(const kind of ['road','footway','green'] as const){
   const positions:number[]=[];
   for(const path of p.campus.paths.filter(r=>r.kind===kind))for(let i=1;i<path.points.length;i++)for(const point of [path.points[i-1],path.points[i]]){
    const [x,y]=project(point);positions.push(x,y,surface(p.campus,x,y)+2);
   }
   const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));group.add(new LineSegments(geometry,new LineBasicMaterial({color:kind==='road'?'#fcfcf5':kind==='green'?'#90aa84':'#b5bea6',transparent:true,opacity:kind==='road'?.95:.6})));
  }
  for(const m of p.model.markers){
   const b=m.building,height=b.heightMeters??12;let geometry:ExtrudeGeometry|PlaneGeometry;
   if(b.footprint){
    const ring=b.footprint.coordinates[0].map(project),shape=new Shape(ring.map(([x,y])=>new Vector2(x,y)));
    for(const hole of b.footprint.coordinates.slice(1))shape.holes.push(new Path(hole.map(pt=>{const[x,y]=project(pt);return new Vector2(x,y);}))); 
    geometry=new ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geometry.translate(0,0,surface(p.campus,...m.center));
   }else{geometry=new PlaneGeometry(14,14);geometry.translate(m.center[0],m.center[1],surface(p.campus,...m.center)+2);}
   const mesh=new Mesh(geometry,new MeshStandardMaterial({color:'#e2e2dc',roughness:.82,metalness:0,side:DoubleSide}));mesh.userData.buildingId=b.id;meshes.set(b.id,mesh);group.add(mesh);
  }
  let frame=0,lastLabels=0,disposed=false;
  const labels=()=>{
   const q=latest.current,occupied:{x:number;y:number;w:number;h:number}[]=[];
   const valid=pickLabels(q.model,q.selectedBuilding,q.searching,q.viewpoint.zoom);
   const validIds=new Set(valid.map(m=>m.building.id));
   const dom=container.querySelectorAll<HTMLButtonElement>('.campus-map-label');
   const elements=new Map([...dom].map(el=>[el.dataset.building!,el]));
   for(const el of elements.values())el.style.display='none';
   for(const m of valid){
    const el=elements.get(m.building.id);if(!el)continue;
    const position=new Vector3(m.center[0],m.center[1],surface(q.campus,...m.center)+(m.building.heightMeters??12)+8).project(camera);
    const x=(position.x+1)/2*q.width,y=(1-position.y)/2*q.height,w=el.offsetWidth||170,h=24;
    if(position.z>1||position.z< -1||x<5||x>q.width-5||y<5||y>q.height-40)continue;
    if(m.building.id!==q.selectedBuilding&&occupied.some(r=>Math.abs(x-r.x)<(w+r.w)/2+8&&Math.abs(y-r.y)<(h+r.h)/2+6))continue;
    occupied.push({x,y,w,h});el.style.display='block';el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
   }
  };
  const apply=(v:Viewpoint)=>{
   const distance=3800/v.zoom,pitch=v.pitch*Math.PI/180,bearing=v.bearing*Math.PI/180,z=surface(latest.current.campus,v.x,v.y);
   controls.target.set(v.x,v.y,z);camera.position.set(v.x+Math.sin(bearing)*Math.cos(pitch)*distance,v.y+Math.cos(bearing)*Math.cos(pitch)*distance,z+Math.sin(pitch)*distance);camera.lookAt(controls.target);controls.update();labels();
  };
  const commit=()=>{
   const target=controls.target,diff=camera.position.clone().sub(target),distance=diff.length();
   latest.current.onViewpoint({x:Math.max(-6000,Math.min(6000,target.x)),y:Math.max(-6000,Math.min(6000,target.y)),zoom:Math.max(.2,Math.min(20,3800/distance)),bearing:Math.atan2(diff.x,diff.y)*180/Math.PI,pitch:Math.max(15,Math.min(85,Math.asin(diff.z/distance)*180/Math.PI))});
  };
  const update=()=>{
   for(const child of [...relations.children]){if(child instanceof LineSegments){child.geometry.dispose();const material=child.material;if(Array.isArray(material))material.forEach(m=>m.dispose());else material.dispose();}relations.remove(child);}
   const q=latest.current;renderer.setSize(q.width,q.height,false);camera.aspect=q.width/Math.max(1,q.height);camera.updateProjectionMatrix();
   for(const m of q.model.markers){const material=meshes.get(m.building.id)?.material as MeshStandardMaterial|undefined;if(!material)continue;material.color.set(m.building.id===q.selectedBuilding?'#3773c8':q.searching&&m.matched?'#f0b157':m.resourceIds.length?'#bbcad4':'#e2e2dc');}
   const segments:number[]=[];
   for(const link of q.model.links){const a=q.model.markers.find(m=>m.building.id===link.from),b=q.model.markers.find(m=>m.building.id===link.to);if(!a||!b)continue;const z=Math.max(surface(q.campus,...a.center),surface(q.campus,...b.center))+45;segments.push(a.center[0],a.center[1],z,b.center[0],b.center[1],z);}
   if(segments.length){const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(segments),3));relations.add(new LineSegments(geometry,new LineBasicMaterial({color:'#245da9',depthTest:false,transparent:true,opacity:.85})));}
   labels();
  };
  const handles={home:()=>{apply(homeView);latest.current.onViewpoint(homeView);},zoom:(factor:number)=>{camera.position.sub(controls.target).divideScalar(factor).add(controls.target);controls.update();commit();},focus:(id:string)=>{const m=latest.current.model.markers.find(m=>m.building.id===id||m.resourceIds.includes(id));if(m){const v={...latest.current.viewpoint,x:m.center[0],y:m.center[1],zoom:4};apply(v);latest.current.onViewpoint(v);}}};
  runtime.current={apply,update};latest.current.onReady(handles);update();apply(p.viewpoint);
  const ray=new Raycaster(),pointer=new Vector2();let down:[number,number]=[0,0];
  const onDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};
  const onUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=node.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const first=ray.intersectObjects([...meshes.values()],false)[0];if(first)latest.current.onBuilding(first.object.userData.buildingId);};
  const onLoss=(e:Event)=>{e.preventDefault();latest.current.onFailure();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Home')handles.home();else if(e.key==='+'||e.key==='=')handles.zoom(1.3);else if(e.key==='-')handles.zoom(.77);else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const v={...latest.current.viewpoint},step=80/v.zoom;v.x+=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0;v.y+=e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0;apply(v);latest.current.onViewpoint(v);}};
  node.addEventListener('pointerdown',onDown);node.addEventListener('pointerup',onUp);node.addEventListener('webglcontextlost',onLoss);node.addEventListener('keydown',key);controls.addEventListener('end',commit);
  const animate=(time:number)=>{if(disposed)return;frame=requestAnimationFrame(animate);if(document.hidden)return;controls.update();renderer.render(scene,camera);if(time-lastLabels>100){labels();lastLabels=time;}};frame=requestAnimationFrame(animate);
  return()=>{disposed=true;runtime.current=null;cancelAnimationFrame(frame);controls.removeEventListener('end',commit);controls.dispose();node.removeEventListener('pointerdown',onDown);node.removeEventListener('pointerup',onUp);node.removeEventListener('webglcontextlost',onLoss);node.removeEventListener('keydown',key);scene.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});renderer.dispose();};
 },[p.campus,p.model.markers.length]);
 useEffect(()=>{runtime.current?.update();},[p]);
 useEffect(()=>{runtime.current?.apply(p.viewpoint);},[p.viewpoint]);
 return <div ref={root} style={{position:'relative',width:p.width,height:p.height}}><canvas ref={canvas} style={{width:'100%',height:'100%',touchAction:'none'}} tabIndex={0} aria-label="3D 실제 관악 캠퍼스. 드래그 회전, 휠 확대, 방향키 이동. 건물 목록에서도 선택 가능."/><div className="campus-label-layer">{p.model.markers.filter(m=>m.building.number||m.resourceIds.length||m.building.id===p.selectedBuilding).map(m=><button key={m.building.id} data-building={m.building.id} className={`campus-map-label ${m.building.id===p.selectedBuilding?'selected':''}`} onClick={()=>p.onBuilding(m.building.id)}>{m.building.number?`${m.building.number}동 `:''}{m.building.name}{m.resourceIds.length?` · ${m.resourceIds.length}`:''}</button>)}</div></div>;
}
