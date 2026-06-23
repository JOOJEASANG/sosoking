'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.argv[2] || '').replace(/\/$/, '');
if (!/^https:\/\//.test(baseUrl)) process.exit(1);

const outputDir = path.resolve('preview-screenshots');
fs.mkdirSync(outputDir, { recursive: true });

const routes = [
  { name: 'home', hash: '#/', selector: '.king-hero h1', text: '누구 관점으로 판결받을까요', personas: true },
  { name: 'judge', hash: '#/playground/judge', selector: '#king-main-text', selected: 3, personas: true, menu: true },
  { name: 'create', hash: '#/playground/create', selector: '#king-main-text', selected: 1, menu: true },
  { name: 'consult', hash: '#/playground/consult', selector: '#king-main-text', selected: 3, menu: true },
  { name: 'today', hash: '#/today', selector: '.today-page', text: '오늘의 자료와 토론' },
  { name: 'materials', hash: '#/materials', selector: '.mat-page', text: '소소자료실' },
  { name: 'debates', hash: '#/debates', selector: '.debate-page', text: '소소토론실' },
  { name: 'account', hash: '#/account', selector: '#page-content' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: 'light' });
    for (const route of routes) {
      const page = await context.newPage();
      const pageErrors = [];
      const failedAssets = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('response', response => {
        const type = response.request().resourceType();
        if (response.url().startsWith(baseUrl) && ['document', 'script', 'stylesheet', 'image'].includes(type) && response.status() >= 400) failedAssets.push(response.url());
      });

      try {
        await page.goto(`${baseUrl}/${route.hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector(route.selector, { state: 'visible', timeout: 60000 });
        if (route.name === 'account') {
          await page.waitForFunction(() => /로그인이 필요해요|AI 결과|내 글/.test(document.body.innerText), null, { timeout: 12000 });
        } else {
          await page.waitForTimeout(1000);
        }
        const bodyText = await page.locator('body').innerText();

        verify(!bodyText.includes('다른 공간 둘러보기'), `${route.name}: old side panel remains`);
        if (route.text) verify(bodyText.includes(route.text), `${route.name}: expected heading missing`);
        if (route.selected) verify(await page.locator('.king-char-option.selected').count() === route.selected, `${route.name}: selected persona count mismatch`);
        if (route.personas) {
          for (const label of ['감성형', '원칙형', '꼰대형', '냉혈형', '사이다형', '현실형']) verify(bodyText.includes(label), `${route.name}: ${label} missing`);
        }
        if (route.menu) {
          verify(bodyText.includes('AI 놀이터 메뉴'), `${route.name}: playground menu missing`);
          verify(await page.locator('.king-play-menu__item').count() === 4, `${route.name}: playground menu count mismatch`);
        }
        if (route.name === 'materials') verify(bodyText.includes('찬반 토론은 별도 토론실'), 'materials: separation notice missing');
        if (route.name === 'debates') verify(bodyText.includes('자료실과 분리된 독립 공간'), 'debates: separation notice missing');
        if (route.name === 'account') verify(/로그인이 필요해요|AI 결과|내 글/.test(bodyText), 'account state did not settle');

        const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        verify(size.scroll <= size.client + 2, `${route.name}: horizontal overflow`);
        verify(pageErrors.length === 0, `${route.name}: page error`);
        verify(failedAssets.length === 0, `${route.name}: asset error`);
        await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${route.name}.png`), fullPage: true });
        console.log(`PASS ${viewport.name} ${route.name}`);
      } catch (error) {
        failures.push(`${viewport.name}/${route.name}: ${error.message}`);
        await page.screenshot({ path: path.join(outputDir, `FAILED-${viewport.name}-${route.name}.png`), fullPage: true }).catch(() => {});
      } finally {
        await page.close();
      }
    }
    await context.close();
  }

  await browser.close();
  if (failures.length) {
    failures.forEach(item => console.error(item));
    process.exit(1);
  }
  console.log('Preview UI check passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
