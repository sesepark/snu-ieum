import {load} from 'cheerio';
import {sanitize} from './privacy';
// Returns selected metadata only. Original HTML, contact columns and images never enter Raw.
export function parseFacultyDirectory(html:string){
 const $=load(html);
 return $('table.prof tbody tr').toArray().map(tr=>{const t=$(tr).children('td');return{name:t.eq(0).text().trim(),department:t.eq(1).text().trim(),rank:t.eq(2).text().trim()};}).filter(r=>r.name&&r.department);
}
export function parseNuclearLabs(html:string){
 const $=load(html);
 return $('.edu-info h3').toArray().map(h=>{
  const title=$(h).text().trim(),siblings=$(h).nextUntil('h3'),items=siblings.filter('ul').find('li').toArray().map(li=>$(li).text().replace(/\s+/g,' ').trim());
  const professor=items.find(t=>/교수\s*:/.test(t))?.replace(/^.*교수\s*:\s*/,'')??null;
  const address=items.find(t=>/위치\s*:/.test(t))?.replace(/^.*위치\s*:\s*/,'')??null;
  const homepage=siblings.filter('ul').find('a[href]').toArray().map(a=>$(a).attr('href')!).find(u=>/^https?:\/\//.test(u))??null;
  return {title,professor,address,homepage};
 }).filter(r=>r.title);
}
export function parseAerospaceLabs(html:string){
 const $=load(html);
 return $('table tbody tr').toArray().map(tr=>{
  const t=$(tr).children('td'),raw=t.eq(0).text().trim(),title=raw.replace(/[A-Za-z].*$/s,'').trim();
  const professor=t.eq(1).text().trim().split(/\s+/)[0]||null;
  const addresses=t.eq(2).find('li').toArray().map(li=>$(li).text().trim()).filter(t=>/\d+(?:-\d+)?동/.test(t));
  const homepage=t.eq(2).find('a[href]').first().attr('href')??null;
  return {title,professor,addresses,homepage};
 }).filter(r=>r.title);
}
export function safeSourceFacts(input:unknown){const result=sanitize(input);if(result.exclusions.length)throw new Error('Source adapter retained contact data');return result.payload;}
