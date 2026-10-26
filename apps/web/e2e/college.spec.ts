import { test, expect } from '@playwright/test';
import draft from '../../../data/college-draft.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.route('**/snapshot.json', route => route.fulfill({ json: draft }));
});

test('explores official equipment and its installation room in the full college draft', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('#/?view=2d');
  await expect(page.locator('.resource-card')).toHaveCount(104);
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
  await expect(page.locator('.resource-card')).toHaveCount(6);
  await expect(page.locator('.evidence-list strong')).toHaveText('A Gradient Accumulation Method for Dense Retriever under Memory Constraint');
  await expect(page.locator('.evidence-list a')).toHaveAttribute('href', 'https://ie.snu.ac.kr/dsba_lab/');
  await page.getByRole('button', { name: '지도에 논문 근거 펼치기', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('button', { name: '지도에서 논문 근거 접기', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('map-stage')).toHaveAttribute('aria-label', /3D.*자원·근거 3개, 연결 3개/);
  await expect(page.locator('.resource-card')).toHaveCount(6);
  await expect(page).toHaveURL(/selected=lab-industrial-dsba/);
});
