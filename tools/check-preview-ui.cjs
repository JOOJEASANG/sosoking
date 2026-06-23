'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.argv[2] || '').replace(/\/$/, '');
if (!/^https:\/\//.test(baseUrl)) {
  console.error('Usage: node tools/check-preview-ui.cjs https://preview-url');
  process.exit(1);
}

const outputDir = path.resolve('preview-screenshots');
fs.mkdirSync(outputDir, { recursive: true });

const routes = [
  { name: 'home', hash: '#/', selector: '.king-hero h1', text: '오늘은 뭐가 억울해요' },
  { name: 'judge', hash: '#/playground/judge', selector: '#king-main-text', selected: 3 },
  { name: 'create', hash: '#/playground/create', selector: '#king-main-text', selected: 1 },
  { name: 'consult', hash: '#/playground/consult', selector: '#king-main-text', selected: 3 },
  { name: 'lounge', hash: '#/playground/lounge', selector: '.king-tool-card' },
  { name: 'account', hash: '#/account', selector: '#page-content' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      colorScheme: 'light',
    });

    for (const route of routes) {
      const page = await context.newPage();
      const pageErrors = [];
      const failedAssets = [];

      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('response', response => {
        const request = response.request();
        const type = request.resourceType();
        if (response.url().startsWith(baseUrl) && ['document', 'script', 'stylesheet', 'image'].includes(type) && response.status() >= 400) {
          failedAssets.push(`${response.status()} ${response.url()}`);
        }
      });

      try {
        await page.goto(`${baseUrl}/${route.hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector(route.selector, { state: 'visible', timeout: 60000 });
        await page.waitForTimeout(1200);

        const bodyText = await page.locator('body').innerText();
        assert(!/화면을 불러오지 못했습니다|앱 초기화 실패/.test(bodyText), `${route.name}: application error state rendered`);
        assert(!/정치력|정당|대선|대통령 후보/.test(bodyText), `${route.name}: retired political UI text is visible`);

        if (route.text) assert(bodyText.includes(route.text), `${route.name}: expected text is missing`);
        if (route.selected) {
          const selectedCount = await page.locator('.king-char-option.selected').count();
          assert(selectedCount === route.selected, `${route.name}: expected ${route.selected} selected characters, got ${selectedCount}`);
        }

        if (route.name === 'account') {
          const ready = /로그인이 필요해요|AI 결과|내 글/.test(bodyText);
          assert(ready, 'account: authentication loading did not settle');
          assert(!bodyText.includes('불러오는 중'), 'account: loading placeholder remains');
        }

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        assert(overflow.scrollWidth <= overflow.clientWidth + 2, `${route.name}: horizontal overflow ${overflow.scrollWidth}/${overflow.clientWidth}`);
        assert(pageErrors.length === 0, `${route.name}: uncaught errors: ${pageErrors.join(' | ')}`);
        assert(failedAssets.length === 0, `${route.name}: failed assets: ${failedAssets.join(' | ')}`);

        await page.screenshot({
          path: path.join(outputDir, `${viewport.name}-${route.name}.png`),
          fullPage: true,
        });
        console.log(`PASS ${viewport.name} ${route.name}`);
      } catch (error) {
        failures.push(`${viewport.name}/${route.name}: ${error.message}`);
        await page.screenshot({
          path: path.join(outputDir, `FAILED-${viewport.name}-${route.name}.png`),
          fullPage: true,
        }).catch(() => {});
      } finally {
        await page.close();
      }
    }

    await context.close();
  }

  await browser.close();

  if (failures.length) {
    console.error('Preview UI check failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('Preview UI check passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
