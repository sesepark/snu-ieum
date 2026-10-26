import { test, expect } from '@playwright/test';
test('AI is opt-in and an unconfigured catalog never transmits user goals', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') sent.push(request.postData() || ''); });
  await page.goto('#/?view=2d');
  await page.getByText('목표로 좁혀보기', { exact: false }).click();
  await expect(page.getByRole('checkbox', { name: '목표의 외부 전송과 데이터 처리에 동의합니다.' })).not.toBeChecked();
  await page.getByLabel('어떤 프로젝트를 생각하고 있나요?').fill('private research goal');
  await expect(page.getByRole('button', { name: '목표 해석하기', exact: true })).toBeDisabled();
  await page.getByLabel('자원명·연구 분야 검색').fill('AI');
  await expect(page.locator('.resource-card')).toHaveCount(2);
  expect(page.url()).not.toContain('private'); expect(sent).toEqual([]);
});
