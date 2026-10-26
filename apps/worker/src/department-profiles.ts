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
export function parseCEEFaculty(html:string):(FacultyFact&{profileUrl:string|null})[]{
 const $=load(html);
 return $('li.ml_card').toArray().map(card=>{
  const e=$(card),h=e.find('h1.name').first(),name=clean(h.find('a').first().text())||clean(h.clone().children().remove().end().text())||clean(h.text());
  const fields:Record<string,string>={};e.find('.lab-info dl').each((_,dl)=>{fields[clean($(dl).find('dt').text()).replace(/\s/g,'')]=clean($(dl).find('dd').text());});
  const homepage=e.find('.lab-info a[href]').first(),office=e.find('.icon-wr li').filter((_,li)=>$(li).find('.ri-building-fill').length>0).first();
  return{name,rank:clean(e.find('p.depart').not('.pf_badges').first().text()),researchFields:fields['전공']||null,homepage:homepage.attr('href')??null,labName:/연구실|실험실/.test(homepage.text())?clean(homepage.text()):null,officeAddress:clean(office.text())||null,profileUrl:h.find('a[href]').attr('href')??null};
 }).filter(f=>f.name);
}
export function parseNavalFaculty(html:string):FacultyFact[]{
 const $=load(html);
 return $('.cont').has('h3').toArray().flatMap(card=>{
  const e=$(card),m=clean(e.find('h3').first().text()).match(/^(.+?)\s*\/\s*(교수|부교수|조교수)$/);if(!m)return[];
  const rows=e.find('li'),lab=rows.find('a[href]').filter((_,a)=>/^https?:\/\//.test($(a).attr('href')??'')).first(),office=rows.toArray().map(li=>clean($(li).text())).find(t=>/^\d+(?:-\d+)?-\d+[A-Z]?$/.test(t));
  const address=office?.match(/^(\d+(?:-\d+)?)-(\d+[A-Z]?)$/);
  return[{name:m[1].trim(),rank:m[2],researchFields:null,homepage:lab.attr('href')??null,labName:clean(lab.text())||null,officeAddress:address?`${address[1]}동 ${address[2]}호`:null}];
 });
}
export function parseEnergyFaculty(html:string):(FacultyFact&{profileUrl:string|null})[]{
 const $=load(html);
 return $('.cont').has('h2.name').toArray().map(card=>{
  const e=$(card),name=clean(e.find('h2.name').text()).replace(/교수$/,'').trim(),href=e.parent().find('a[href*="wr_id="]').first().attr('href')??null;
  return{name,rank:'교수',researchFields:clean(e.find('p.cate').text())||null,homepage:null,labName:null,officeAddress:null,profileUrl:href};
 }).filter(f=>f.name);
}
export function parseEnergyDetail(html:string){
 const $=load(html),heading=$('h4').filter((_,h)=>clean($(h).text())==='주요연구분야').first(),fields=clean(heading.nextUntil('h4').text()).slice(0,1500);
 const homepage=$('a[href]').filter((_,a)=>/^Homepage$/i.test(clean($(a).text()))).first().attr('href')??null;
 return{researchFields:fields||null,homepage};
}
export function parseNavalLabs(html:string){
 const $=load(html);
 return $('.cont').has('h4').toArray().flatMap(card=>{
  const e=$(card),name=clean(e.find('h4').first().text());if(!name)return[];
  const rows=e.find('.info li'),address=rows.toArray().map(li=>clean($(li).text())).find(t=>/^\d+(?:-\d+)?-\d+[A-Z]?$/.test(t))??null;
  const homepage=rows.find('a[href]').filter((_,a)=>/^https?:\/\//.test($(a).attr('href')??'')).first().attr('href')??null;
  return[{name,address,homepage}];
 });
}
