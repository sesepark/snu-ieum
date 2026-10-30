import { test, expect } from '@playwright/test';
import draft from '../../../data/college-draft.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.route('**/snapshot.json', route => route.fulfill({ json: draft }));
});

test('explores official equipment and its installation room in the full college draft', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('#/?view=2d');
  await expect(page.locator('.resource-card')).toHaveCount(30);
  await page.getByRole('button', { name: '30개 더 보기', exact: false }).click();
  await expect(page.locator('.resource-card')).toHaveCount(60);
  await expect(page.getByLabel('학과 필터').locator('option')).toHaveCount(15);
  await page.getByLabel('자원명·연구 분야 검색').fill('Krios');
  await expect(page.locator('.resource-card')).toHaveCount(1);
  await page.locator('.resource-card').click();
  await expect(page.locator('.detail-panel a').first()).toHaveAttribute('href', 'https://irf.snu.ac.kr/possessed_device/possessed_device.php?idx=105');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: '2단계 확장', exact: true }).click();
  await expect(page.getByTestId('map-stage')).toHaveAttribute('aria-label', /자원·근거 3개, 연결 2개/);
  await expect(page).toHaveURL(/view=3d.*selected=eq-irf-105/);
  await page.locator('.related-list button').filter({ hasText: '139-1동 B112호' }).click();
  await expect(page.getByRole('heading', { name: '기초과학공동기기원 139-1동 B112호', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('keeps paper evidence separate from resources and preserves its expansion across views', async ({ page }) => {
  await page.goto('#/?view=2d&department=industrial&selected=lab-industrial-dsba');
  await expect(page.locator('.resource-card')).toHaveCount(draft.resources.filter(r=>r.departmentId==='industrial').length);
  await expect(page.locator('.evidence-list strong').filter({hasText:'A Gradient Accumulation Method'})).toHaveText('A Gradient Accumulation Method for Dense Retriever under Memory Constraint');
  await expect(page.locator('.evidence-list a').first()).toHaveAttribute('href', 'https://ie.snu.ac.kr/dsba_lab/');
  await page.getByRole('button', { name: '지도에 논문 근거 펼치기', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('button', { name: '지도에서 논문 근거 접기', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('map-stage')).toHaveAttribute('aria-label', /3D.*자원·근거 5개, 연결 5개/);
  await expect(page.locator('.resource-card')).toHaveCount(draft.resources.filter(r=>r.departmentId==='industrial').length);
  await expect(page).toHaveURL(/selected=lab-industrial-dsba/);
});


test('purpose filters, distribution and recovery keep all candidates reachable', async ({ page }) => {
  await page.goto('#/?view=2d');
  await page.getByRole('button', { name: '장비 찾기', exact: true }).click();
  await expect(page.locator('.resource-card .card-meta')).toContainText(Array(30).fill('장비'));
  await page.getByRole('button', { name: '조건 지우기', exact: true }).click();
  await page.getByLabel('자원명·연구 분야 검색').fill('로봇');
  await expect(page.locator('.resource-card')).toHaveCount(18);
  await page.getByText('4개 학과·기관에서 찾았습니다', {exact:true}).click();
  await expect(page.locator('.result-distribution meter')).toHaveCount(4);
  await page.getByLabel('자원명·연구 분야 검색').fill('없는검색어-xyz');
  await expect(page.getByText('수록된 결과가 없습니다.', {exact:true})).toBeVisible();
  await page.getByRole('button', {name:'시계열 살펴보기',exact:true}).click();
  await expect(page.locator('.resource-card')).toHaveCount(5);
});


test('search counts and quality meters use their stated denominators', async ({ page }) => {
  await page.goto('#/?view=2d');
  await page.getByLabel('자원명·연구 분야 검색').fill('Krios');
  await expect(page.locator('.filters fieldset button').first()).toHaveText('전체 1');
  await page.getByRole('button', {name:'초기화',exact:true}).click();
  await expect(page.getByLabel('자원명·연구 분야 검색')).toHaveValue('');
  await page.getByText('수록 현황 · 데이터 품질', {exact:false}).click();
  await expect(page.getByRole('meter', {name:/지도 위치 근거/})).toBeVisible();
  await expect(page.getByRole('meter', {name:/저자 검수 논문/})).toHaveAttribute('value','0');
});

test('map distribution counts located results and focuses them without losing search state', async ({ page }) => {
  await page.goto('#/?view=2d');
  await page.getByLabel('자원명·연구 분야 검색').fill('로봇');
  const summary=page.getByLabel('검색 위치 분포');
  await expect(summary).toContainText('18개 검색 결과 · 3개 건물');
  await expect(summary.getByRole('img')).toHaveAttribute('aria-label','위치 확인 6개, 위치 미확인 12개');
  await summary.getByRole('button').click();
  await expect(page).toHaveURL(/camera=/);
  await expect(page.getByLabel('자원명·연구 분야 검색')).toHaveValue('로봇');
  await expect(page.locator('.resource-card')).toHaveCount(18);
  await page.getByRole('button',{name:'3D',exact:true}).click();
  await expect(summary).toContainText('18개 검색 결과 · 3개 건물');
});
