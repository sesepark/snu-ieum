import{load}from'cheerio';
export function parseIRFList(html:string){const $=load(html);return $('.name_list label.dev').toArray().map(el=>({externalId:$(el).attr('id')?.replace(/^fi_/,''),label:$(el).find('.t').text().replace(/\s+/g,' ').trim()})).filter((r):r is {externalId:string;label:string}=>Boolean(r.externalId&&/^\d+$/.test(r.externalId)&&r.label));}
export function parseIRFEquipment(html:string){
 const $=load(html),card=$('.item_info').first(),fields:Record<string,string>={};
 card.find('dl').each((_,dl)=>{const key=$(dl).find('dt').text().replace(/\s+/g,'');if(key==='호실'||key==='모델')fields[key]=$(dl).find('dd').text().replace(/\s+/g,' ').trim();});
 return {name:card.children('p').first().text().trim(),shortName:card.children('.btit').text().trim(),model:fields['모델']&&fields['모델']!=='-'?fields['모델']:null,address:fields['호실']&&fields['호실']!=='-'?fields['호실']:null};
}
export function parseCBESharedEquipment(html:string){const $=load(html);return $('table.tbl-st1 tbody tr').toArray().map(tr=>{const t=$(tr).children('td');return{name:t.eq(0).text().replace(/\s+/g,' ').trim(),model:t.eq(1).text().replace(/\s+/g,' ').trim(),address:t.eq(2).text().replace(/\s+/g,' ').trim()};}).filter(r=>r.name&&r.model&&r.address);}
