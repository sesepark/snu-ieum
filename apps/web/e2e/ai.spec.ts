import { test, expect } from '@playwright/test';
test('static exploration hides unavailable AI and never transmits user goals', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') sent.push(request.postData() || ''); });
  await page.goto('#/?view=2d');
  await expect(page.getByText('목표로 좁혀보기', { exact: false })).toHaveCount(0);
  await page.getByLabel('자원명·연구 분야 검색').fill('AI');
  await expect(page.locator('.resource-card')).toHaveCount(2);
  expect(page.url()).not.toContain('private'); expect(sent).toEqual([]);
});
