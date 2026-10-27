import{expect,it}from'vitest';import{parseIEFaculty,parseNuclearFaculty,parseAerospaceFaculty,parseIELab}from'./department-profiles';
it('reads official current faculty fields and excludes guest faculty and contact fields',()=>{
 const html='<h2>현직교수</h2><div class="elementor-widget-wrap"><h2>강필성 부교수</h2><a href="https://example.org">site</a><p>전공 인공지능 주소 서울대학교 39동 301호 연락처 02-880-1234 이메일 private@example.org</p></div><h2>객원교수</h2><div class="elementor-widget-wrap"><h2>다른사람 교수</h2></div>';
 expect(parseIEFaculty(html)).toEqual([{name:'강필성',rank:'부교수',researchFields:'인공지능',homepage:'https://example.org',officeAddress:'서울대학교 39동 301호',labName:null}]);
});
it('distinguishes official office addresses from a lab label on a faculty card',()=>{
 const html='<div class="cont"><h3><a>김기현</a> 교수</h3><div class="info"><ul><li><a href="https://example.org">방사선공학연구실</a></li><li>방사선 계측 및 응용</li><li>02-880-1234</li><li>private@example.org</li><li>36동 307C호</li></ul></div></div>';
 const fact=parseNuclearFaculty(html)[0];expect(fact.officeAddress).toBe('36동 307C호');expect(fact.researchFields).toBe('방사선 계측 및 응용');expect(JSON.stringify(fact)).not.toContain('private');
});
it('reads a lab-specific address and research fields without personal contact rows',()=>{
 const row=(k:string,v:string)=>`<div><div><strong>${k}</strong></div><div>${v}</div></div>`;
 const html=row('연구실명','데이터과학 연구실 Data Science Lab')+row('지도교수','Prof. 강필성 (Kang)')+row('주요 연구 분야','시계열, 자연어')+row('위치','39동 411호')+row('홈페이지','<a href="https://example.org">lab</a>')+row('연락처','private@example.org');
 expect(parseIELab(html)).toEqual({title:'데이터과학 연구실',advisor:'강필성',researchFields:'시계열, 자연어',homepage:'https://example.org',address:'39동 411호'});
});

it('handles nested label spans and keeps Latin acronyms inside a Korean lab name',()=>{
 const row=(k:string,v:string)=>`<div><div><span><strong>${k}</strong></span></div><div>${v}</div></div>`;
 const fact=parseIELab(`<div class="responsive-table">${row('연구실명','빅데이터 AI 연구실 Big Data AI Lab')}${row('지도교수','Prof. 박종헌')}${row('위치','39동 501호')}</div>`);
 expect(fact.title).toBe('빅데이터 AI 연구실');expect(fact.advisor).toBe('박종헌');expect(fact.address).toBe('39동 501호');
});
it('uses the building icon on CEE faculty cards and never a phone or footer as the office address',async()=>{
 const{parseCEEFaculty}=await import('./department-profiles');const fact=parseCEEFaculty('<li class="ml_card"><h1 class="name"><a href="https://example.org/profile">고희동</a><span>Goh</span></h1><p class="depart">조교수</p><ul class="icon-wr"><li><i class="ri-building-fill"></i>35동 414호</li><li><i class="ri-phone-fill"></i>02-880-1234</li></ul><div class="lab-info"><dl><dt>전 공</dt><dd>구조공학</dd></dl><dl><dt>홈페이지</dt><dd><a href="https://example.org">구조해석연구실</a></dd></dl></div></li>')[0];expect(fact.officeAddress).toBe('35동 414호');expect(fact.researchFields).toBe('구조공학');expect(fact.labName).toBe('구조해석연구실');
});
it('excludes visiting naval faculty and labels their official address as an office rather than a lab',async()=>{
 const{parseNavalFaculty}=await import('./department-profiles');const html='<div class="cont"><h3>김용환 / 교수</h3><ul><li><a href="https://example.org">해양유체역학연구실</a></li><li>private@example.org</li><li>34-411</li></ul></div><div class="cont"><h3>다른사람 / 객원교수</h3></div>';const facts=parseNavalFaculty(html);expect(facts).toHaveLength(1);expect(facts[0].officeAddress).toBe('34동 411호');expect(facts[0].researchFields).toBeNull();
});
it('deduplicates materials category cards by official profile and never treats mailstop as office evidence',async()=>{
 const{parseMaterialsFacultyLinks,parseMaterialsDetail}=await import('./department-profiles');
 const card='<h3 class="elementor-post__title"><a href="https://mse.snu.ac.kr/example/">김교수</a></h3>';
 expect(parseMaterialsFacultyLinks(card+card)).toHaveLength(1);
 expect(parseMaterialsDetail('<span>Mailstop : 33-208</span><div class="elementor-widget"><h3>Research Interests</h3></div><div>반도체 소재</div><a href="https://example.org">Homepage</a>')).toEqual({researchFields:'반도체 소재',homepage:'https://example.org'});
});
it('extracts chemical profile labels without contacts or the department footer address',async()=>{
 const{parseChemicalDetail}=await import('./department-profiles');
 const html='<div class="prof-visual"><ul class="info"><li><p>연구 분야</p><span>촉매</span></li><li><p>주소</p><span>302동 729호 | 촉매 연구실</span></li><li><p>이메일</p><span>private@example.org</span></li></ul></div><footer>302동 909호</footer>';
 expect(parseChemicalDetail(html)).toEqual({researchFields:'촉매',homepage:null,officeAddress:'302동 729호',labName:'촉매 연구실'});
});
it('keeps electrical profile identifiers while excluding phone and email rows',async()=>{
 const{parseECEFaculty}=await import('./department-profiles');
 const fact=parseECEFaculty('<div class="cont"><h3><a href="?profid=p001">이종호<span class="nocolor">교수</span></a></h3><div class="info"><div class="research">반도체</div><div class="dept">private@example.org</div><div class="dept">02-880-0000</div></div></div>')[0];
 expect(fact.name).toBe('이종호');expect(fact.profileUrl).toBe('?profid=p001');expect(fact.officeAddress).toBeNull();expect(JSON.stringify(fact)).not.toContain('private');
});
it('preserves separately identified electrical labs with equal names and reads their own advisor fields',async()=>{
 const{parseECELabLinks,parseECELab}=await import('./department-profiles');
 const links=parseECELabLinks('<a href="?labidx=1">제어 연구실</a><a href="?labidx=2">제어 연구실</a><a href="?labidx=1">제어 연구실</a>');expect(links).toHaveLength(2);
 const fact=parseECELab('<div class="prof-name-bm"><h2>제어 연구실</h2></div><div class="info-wrap"><div><strong>지도</strong> 김교수 교수</div><div><strong>연구</strong> 동역학</div></div>');expect(fact.advisor).toBe('김교수');expect(fact.address).toBeNull();
});

it('keeps separately listed mechanical labs without concatenating them into a fabricated name',async()=>{
 const{parseMechanicalFaculty}=await import('./department-profiles');
 const html='<div class="elementor-widget-wrap"><h2 class="jet-headline"><span class="jet-headline__first"><span class="jet-headline__label">김교수</span></span></h2><div class="field-meta"><strong>연구실</strong><span>냉동 연구실<br>연료전지 연구실</span></div><div class="field-meta"><strong>주소</strong>301동 1호</div></div>';
 const fact=parseMechanicalFaculty(html)[0];expect(fact.labName).toBeNull();expect(fact.labNames).toEqual(['냉동 연구실','연료전지 연구실']);expect(fact.officeAddress).toBe('301동 1호');
});
