import{expect,it}from'vitest';import{parseIRFList,parseIRFEquipment}from'./equipment';import{sanitize}from'./privacy';
it('selects equipment identity, model and explicit room while excluding contact and reservation payloads',()=>{
 const html='<div class="name_list"><label class="dev" id="fi_105"><span class="t">Cryo-EM</span><ul><li>private@example.org</li></ul></label></div><div class="item_info"><div class="btit">Cryo-EM</div><p>초저온 전자현미경</p><dl><dt>모 델</dt><dd>Krios G4</dd></dl><dl><dt>호 실</dt><dd>139-1동 B112호</dd></dl><dl><dt>이메일</dt><dd>private@example.org</dd></dl><dl><dt>담당자</dt><dd>개인 이름</dd></dl></div><div class="schedule">예약자 개인 정보</div>';
 const facts={list:parseIRFList(html),equipment:parseIRFEquipment(html)};expect(facts.list).toEqual([{externalId:'105',label:'Cryo-EM'}]);expect(facts.equipment).toEqual({name:'초저온 전자현미경',shortName:'Cryo-EM',model:'Krios G4',address:'139-1동 B112호'});expect(sanitize(facts).exclusions).toEqual([]);expect(JSON.stringify(facts)).not.toMatch(/private|예약|개인/);
});
it('reads only explicit application bullets from IRF additional details and excludes contact rows',async()=>{
 const{parseIRFApplications}=await import('./equipment');
 const parsed=parseIRFApplications('<p>원리 및 기능</p><div class="terms_text">설명 본문</div><p>기기활용</p><div class="terms_text">- 단백질 구조 분석<br>- 토모그래피<br>담당자 private@example.org</div><p>사양</p><div class="terms_text">사양 본문</div>');
 expect(parsed.applications).toEqual(['단백질 구조 분석','토모그래피']);expect(parsed.purpose).not.toMatch(/private|사양|설명/);
});
