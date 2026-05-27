const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3002/login');
  await page.waitForLoadState('networkidle');
  const inputs = await page.$$eval('input', els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder, id: e.id })));
  console.log(JSON.stringify(inputs, null, 2));
  const buttons = await page.$$eval('button', els => els.map(e => ({ type: e.type, text: e.textContent.trim() })));
  console.log('buttons:', JSON.stringify(buttons));
  await browser.close();
})().catch(console.error);
