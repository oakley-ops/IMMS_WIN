const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const filePath = 'file:///' + path.resolve('mockup-permissions.html').replace(/\\/g, '/');
  await page.goto(filePath);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Full page screenshot
  await page.screenshot({ path: 'mockup-permissions-full.png', fullPage: true });
  console.log('Saved mockup-permissions-full.png');

  // Viewport screenshot (above the fold)
  await page.screenshot({ path: 'mockup-permissions-top.png' });
  console.log('Saved mockup-permissions-top.png');

  await browser.close();
  console.log('Done');
})().catch(err => { console.error(err); process.exit(1); });
