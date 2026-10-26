import type { Building, Campus, Snapshot, Graph, Filters } from '@ieum/contracts';
import { mappedLocations } from '../../../packages/catalog/src/campus';
import { filteredResources } from '@ieum/catalog';
export type Viewpoint = { x: number; y: number; zoom: number; bearing: number; pitch: number };
export const homeView: Viewpoint = {x:0,y:0,zoom:1,bearing:0,pitch:45};
export const origin=[126.954,37.4575] as const;
export function project([lon,lat]:readonly number[]):[number,number]{return [(lon-origin[0])*88300,-(lat-origin[1])*111200];}
export function buildingCenter(b:Building):[number,number]{
 if(b.point)return project(b.point);
 const r=b.footprint!.coordinates[0].slice(0,-1),points=r.map(project);
 return [points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
}
export function surface(c:Campus,x:number,y:number){
 const t=c.terrain;if(!t)return 0;
 const lon=origin[0]+x/88300,lat=origin[1]-y/111200;
 const i=Math.max(0,Math.min(t.columns-1,Math.round((lon-t.west)/(t.east-t.west)*t.columns-.5)));
 const j=Math.max(0,Math.min(t.rows-1,Math.round((t.north-lat)/(t.north-t.south)*t.rows-.5)));
 return t.heights[j*t.columns+i]??0;
}
export function buildingModel(c:Campus,s:Snapshot,f:Filters,highlighted:Set<string>,g:Graph,selected?:string){
 const allowed=new Set(filteredResources(s,{...f,q:''}).map(r=>r.id));
 const locations=mappedLocations(c,s);
 const buckets=new Map<string,string[]>();
 for(const l of locations)if(allowed.has(l.resourceId)&&l.buildingId){const ids=buckets.get(l.buildingId)??[];if(!ids.includes(l.resourceId))ids.push(l.resourceId);buckets.set(l.buildingId,ids);}
 const markers=c.buildings.filter(b=>b.point||b.footprint).map(b=>({building:b,center:buildingCenter(b),resourceIds:buckets.get(b.id)??[],matched:(buckets.get(b.id)??[]).filter(id=>highlighted.has(id)).length}));
 const links: {id:string;from:string;to:string;label:string}[]=[];
 if(selected)for(const edge of g.edges){
  if(edge.source!==selected&&edge.target!==selected)continue;
  const a=locations.find(l=>l.resourceId===edge.source),b=locations.find(l=>l.resourceId===edge.target);
  if(a?.buildingId&&b?.buildingId&&a.buildingId!==b.buildingId)links.push({id:edge.id,from:a.buildingId,to:b.buildingId,label:edge.label});
 }
 return {markers,links,unlocated:filteredResources(s,f).filter(r=>!locations.some(l=>l.resourceId===r.id)).length};
}
export type CampusModel=ReturnType<typeof buildingModel>;
export type CampusViewProps={campus:Campus;model:CampusModel;width:number;height:number;selectedBuilding?:string;searching:boolean;viewpoint:Viewpoint;reducedMotion:boolean;onBuilding(id:string):void;onViewpoint(v:Viewpoint):void;onReady(handle:{home():void;zoom(factor:number):void;focus(id:string):void}):void;onFailure():void};
export function pickLabels(model:CampusModel,selected:string|undefined,searching:boolean,zoom:number){
 return [...model.markers].filter(m=>m.building.id===selected||(searching?m.matched>0:zoom>1.5?Boolean(m.building.number):m.resourceIds.length>0)).sort((a,b)=>Number(b.building.id===selected)-Number(a.building.id===selected)||b.matched-a.matched||b.resourceIds.length-a.resourceIds.length).slice(0,80);
}
