import{test,expect}from'@playwright/test';
import snapshot from '../../../data/college-draft.json' with {type:'json'};
test.beforeEach(async({page})=>{await page.route('**/snapshot.json',route=>route.fulfill({json:snapshot}));});
test('real buildings group resources and restore a bounded map viewpoint',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('#/?view=2d');await page.getByLabel('건물 선택',{exact:true}).selectOption('snu-139');
 await expect(page.getByLabel('선택 건물 상세')).toBeVisible();await expect(page.getByLabel('선택 건물 상세').getByText(/수록 자원 35개/)).toBeVisible();
 await expect(page.getByLabel('선택 건물 상세').getByRole('link',{name:/서울대학교 캠퍼스맵/})).toHaveAttribute('href','https://map.snu.ac.kr/web/main.action');
 await expect(page).toHaveURL(/building=snu-139.*camera=/);const url=page.url();await page.reload();await expect(page.getByLabel('건물 선택',{exact:true})).toHaveValue('snu-139');expect(page.url()).toBe(url);
 await page.getByLabel('선택 건물 상세').getByRole('button',{name:/300MHz NMR/}).click();await expect(page.getByLabel('선택 자원 상세')).toBeVisible();await expect(page.getByLabel('선택 자원 상세').getByText(/장비 설치 위치/)).toBeVisible();expect(errors).toEqual([]);
});
test('unlocated lab remains discoverable without a fabricated map location',async({page})=>{
 await page.goto('#/?view=2d&selected=lab-cee-urban');await expect(page.getByLabel('선택 자원 상세')).toBeVisible();await expect(page.getByLabel('선택 자원 상세').getByText(/공식 상세 주소·건물 연결 확인 필요/)).toBeVisible();
 await expect(page.getByText(/위치 확인 필요 \d+개 · 목록에서 탐색/)).toBeVisible();expect(page.url()).not.toContain('building=');
});
test('equipment details show field-level official model evidence while retaining unconfirmed installation location',async({page})=>{
 await page.goto('#/?view=2d&selected=eq-isrc-275');
 const panel=page.getByLabel('선택 자원 상세');await expect(panel.getByRole('heading',{name:'정보별 근거',exact:true})).toBeVisible();
 await expect(panel.locator('.resource-facts').getByText('4522',{exact:true})).toBeVisible();
 await expect(panel.getByText(/개별 장비 배치 근거 확인 필요/)).toBeVisible();
 await expect(panel.locator('.resource-facts').getByRole('link',{name:/와이어 볼 본딩/}).first()).toHaveAttribute('href','https://isrc.snu.ac.kr/hm/equipInfo/detail?EQUIP_SKEY=275');
});
test('college background highlights multiple officially searched buildings and shares that selection',async({page})=>{
 await page.goto('#/?view=2d');await page.getByLabel('단과대 건물 배경').selectOption('engineering');await expect(page).toHaveURL(/college=engineering/);
 await expect(page.getByLabel('단과대 건물 배경').locator('option[value=engineering]')).toHaveText(/공과대학 · 1[0-9]동/);
 await page.getByLabel('건물 선택',{exact:true}).selectOption('snu-301');await expect(page.getByLabel('선택 건물 상세')).toBeVisible();await expect(page).toHaveURL(/building=snu-301.*college=engineering/);
});
test('same-building official relations open their evidence without a fabricated geographic route',async({page})=>{
 await page.goto('#/?view=2d&selected=eq-irf-105');
 await page.getByLabel('지도에 표시한 공식 관계').getByRole('button',{name:/같은 건물/}).first().click();
 const evidence=page.getByLabel('선택 관계 근거');await expect(evidence).toBeVisible();await expect(evidence.getByText('같은 건물에 있는 자원의 확인된 관계입니다.')).toBeVisible();await expect(evidence.getByRole('link')).toHaveCount(1);
});
test('new searches dismiss old details and the wordmark restores the whole campus',async({page})=>{
 await page.goto('#/?view=2d&selected=eq-irf-105&building=snu-139&college=engineering&camera=20,30,4,0,45');
 await expect(page.getByLabel('선택 자원 상세')).toBeVisible();
 await page.getByRole('searchbox',{name:'자원명·연구 분야 검색'}).fill('전자현미경');
 await expect(page.getByLabel('선택 자원 상세')).toHaveCount(0);await expect(page.getByRole('heading',{name:'검색 결과',exact:true})).toBeVisible();
 await expect(page).not.toHaveURL(/selected=|building=/);
 await page.getByRole('link',{name:'서울대 이음',exact:true}).click();
 await expect(page.getByRole('searchbox',{name:'자원명·연구 분야 검색'})).toHaveValue('');await expect(page.getByRole('heading',{name:'수록 자원',exact:true})).toBeVisible();
 await expect(page.getByLabel('단과대 건물 배경')).toHaveValue('');await expect(page).not.toHaveURL(/college=|selected=|building=/);
});
