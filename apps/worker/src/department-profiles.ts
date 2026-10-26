import{load}from'cheerio';
export type FacultyFact={name:string;rank:string;researchFields:string|null;homepage:string|null;officeAddress:string|null;labName:string|null};
const clean=(text:string)=>text.replace(/\s+/g,' ').trim();
export function parseIEFaculty(html:string):FacultyFact[]{
 const $=load(html),facts:FacultyFact[]=[];let stopped=false;
 for(const h of $('h2').toArray()){
  const heading=clean($(h).text());if(heading==='객원교수'){stopped=true;continue;}if(stopped)continue;
  const name=heading.match(/^(.+?)\s+(부교수|조교수|교수)$/);if(!name)continue;
  const card=$(h).closest('.elementor-widget-wrap'),text=clean(card.text()),major=text.match(/전공\s*(.*?)\s*주소/s)?.[1]||null,address=text.match(/주소\s*(.*?)\s*연락처/s)?.[1]||null;
  const homepage=card.find('a[href]').toArray().map(a=>$(a).attr('href')!).find(u=>/^https?:\/\//.test(u))??null;
  facts.push({name:name[1],rank:name[2],researchFields:major,homepage,officeAddress:address,labName:null});
 }
 return facts;
}
export function parseNuclearFaculty(html:string):FacultyFact[]{
 const $=load(html);
 return $('.cont').has('h3').toArray().flatMap(card=>{
  const element=$(card),title=clean(element.find('h3').first().text()),m=title.match(/^(.+?)\s+(부교수|조교수|교수)$/);if(!m)return[];
  const rows=element.find('.info li'),lab=rows.eq(0);
  return[{name:m[1],rank:m[2],labName:clean(lab.text())||null,homepage:lab.find('a[href]').attr('href')??null,researchFields:clean(rows.eq(1).text())||null,officeAddress:clean(rows.eq(4).text())||null}];
 });
}
export function parseAerospaceFaculty(html:string):FacultyFact[]{
 const $=load(html),heading=$('h3.prof').filter((_,h)=>clean($(h).text())==='현직교수').first(),section=heading.next('.row');
 return section.find('.text').has('h3').toArray().flatMap(card=>{
  const e=$(card),m=clean(e.find('h3').text()).match(/^(.+?)\s+(부교수|조교수|교수)(?:\/.*)?$/);if(!m)return[];
  const text=clean(e.children('div').eq(1).text()),address=text.match(/\d+(?:-\d+)?동\s*[^\s,]+(?:호)?/)?.[0]??null;
  return[{name:m[1],rank:m[2],labName:clean(e.children('div').first().text())||null,homepage:null,researchFields:null,officeAddress:address}];
 });
}
export function parseIELab(html:string){
 const $=load(html),read=(label:string)=>{
  const heading=$('strong').filter((_,s)=>clean($(s).text()).replace(/\s/g,'')===label.replace(/\s/g,'')).first();
  let cell=heading;for(let level=0;level<5&&cell.parent().length&&cell.parent().children().length===1;level++)cell=cell.parent();return cell.parent().children().last();
 };
 const rawTitle=clean(read('연구실명').text()),end=rawTitle.indexOf('연구실'),title=end>=0?rawTitle.slice(0,end+3):rawTitle,advisor=clean(read('지도교수').text()).match(/[가-힣]{2,5}/)?.[0]??null;
 const fields=clean(read('주요 연구 분야').text())||null,address=clean(read('위치').text())||null;
 if(!title||title==='연구실'||title==='연구실명')throw new Error('Lab value cell selector did not match');
 const homepageRow=read('홈페이지'),operating=homepageRow.html()?.match(/운영중[\s\S]*?<a[^>]*href=["']([^"']+)/i)?.[1];
 return{title,advisor,researchFields:fields,homepage:operating??homepageRow.find('a[href]').first().attr('href')??null,address};
}
