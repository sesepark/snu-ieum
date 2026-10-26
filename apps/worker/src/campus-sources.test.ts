import{expect,it}from'vitest';
import{parseFacultyDirectory,parseNuclearLabs,parseAerospaceLabs,safeSourceFacts}from'./campus-sources';
it('selects only professor identity facts from a directory with contact columns',()=>{
 const html='<table class="prof"><tbody><tr><td>교수 이름</td><td>산업공학과</td><td>교수</td><td>private@example.org</td><td><a href="https://lab.example.org">site</a></td></tr></tbody></table>';
 expect(parseFacultyDirectory(html)).toEqual([{name:'교수 이름',department:'산업공학과',rank:'교수'}]);expect(()=>safeSourceFacts({phone:'02-880-1234'})).toThrow('contact');
});
it('keeps lab addresses from the matching lab section and omits telephone items',()=>{
 const html='<div class="edu-info"><h3>첫 연구실</h3><h4>First Lab</h4><ul><li>교수 : 홍길동</li><li>전화 : 02-880-1234</li><li>위치 : 31-205 / 31-207</li><li>홈페이지 : <a href="https://example.org">lab</a></li></ul><p>Research</p><h3>둘 연구실</h3><ul><li>교수 : 다른교수</li><li>위치 : 32-102</li></ul></div>';
 expect(parseNuclearLabs(html)).toEqual([{title:'첫 연구실',professor:'홍길동',address:'31-205 / 31-207',homepage:'https://example.org'},{title:'둘 연구실',professor:'다른교수',address:'32-102',homepage:null}]);
});
it('keeps multi-building lab addresses without spreading them into arbitrary indoor coordinates',()=>{
 const html='<table><tbody><tr><td>로켓추진연구실 Rocket Lab</td><td>홍길동 교수 private@example.org</td><td><ul><li>02-880-1234</li><li>301동 216호 / 30동 112호</li><li><a href="https://example.org">Lab</a></li></ul></td></tr></tbody></table>';
 expect(parseAerospaceLabs(html)[0]).toEqual({title:'로켓추진연구실',professor:'홍길동',addresses:['301동 216호 / 30동 112호'],homepage:'https://example.org'});
});
