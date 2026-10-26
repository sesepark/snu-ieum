import{test,expect}from'@playwright/test';
import snapshot from '../../../data/college-draft.json' with {type:'json'};
test.beforeEach(async({page})=>{await page.route('**/snapshot.json',route=>route.fulfill({json:snapshot}));});
test('real buildings group resources and restore a bounded map viewpoint',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('#/?view=2d');await page.getByLabel('건물 선택',{exact:true}).selectOption('snu-139');
 await expect(page.getByLabel('선택 건물 상세')).toBeVisible();await expect(page.getByLabel('선택 건물 상세').getByText(/수록 자원 12개/)).toBeVisible();
 await expect(page.getByLabel('선택 건물 상세').getByRole('link',{name:/서울대학교 캠퍼스맵/})).toHaveAttribute('href','https://map.snu.ac.kr/web/main.action');
 await expect(page).toHaveURL(/building=snu-139.*camera=/);const url=page.url();await page.reload();await expect(page.getByLabel('건물 선택',{exact:true})).toHaveValue('snu-139');expect(page.url()).toBe(url);
 await page.getByLabel('선택 건물 상세').getByRole('button',{name:/300MHz NMR/}).click();await expect(page.getByLabel('선택 자원 상세')).toBeVisible();await expect(page.getByLabel('선택 자원 상세').getByText(/장비 설치 위치/)).toBeVisible();expect(errors).toEqual([]);
});
test('unlocated lab remains discoverable without a fabricated map location',async({page})=>{
 await page.goto('#/?view=2d&selected=lab-cee-urban');await expect(page.getByLabel('선택 자원 상세')).toBeVisible();await expect(page.getByLabel('선택 자원 상세').getByText(/공식 상세 주소·건물 연결 확인 필요/)).toBeVisible();
 await expect(page.getByText(/위치 확인 필요 \d+개 · 목록에서 탐색/)).toBeVisible();expect(page.url()).not.toContain('building=');
});
