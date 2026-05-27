const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-jwt-secret-key';
const user = { id: 1, username: 'admin', role: 'admin' };
const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });

// AuthContext reads from #token=<jwt>&user=<base64-json>
const userB64 = Buffer.from(JSON.stringify(user)).toString('base64');
const authFragment = `#token=${token}&user=${userB64}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Navigate directly to /analytics with the SSO fragment — AuthContext will
  // consume it, store to localStorage, and render the page authenticated.
  await page.goto(`http://localhost:3003/analytics${authFragment}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Page height:', pageHeight);
  console.log('Preview:', bodyText.replace(/\n/g, ' | '));

  // Screenshot 1: Production Health (top)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'analytics-s1-production-health.png' });
  console.log('Saved s1');

  // Find actual scroll positions by locating section headers
  const s2y = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const el = els.find(e => e.textContent && e.textContent.includes('PARTS CONSUMPTION') && e.children.length === 0);
    return el ? el.getBoundingClientRect().top + window.scrollY - 20 : 900;
  });
  const s3y = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const el = els.find(e => e.textContent && e.textContent.includes('EQUIPMENT') && e.children.length === 0);
    return el ? el.getBoundingClientRect().top + window.scrollY - 20 : 1800;
  });
  const s4y = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const el = els.find(e => e.textContent && e.textContent.includes('TEAM PERFORMANCE') && e.children.length === 0);
    return el ? el.getBoundingClientRect().top + window.scrollY - 20 : 2700;
  });
  console.log('Section scroll positions:', { s2y, s3y, s4y });

  // Screenshot 2: Parts Consumption
  await page.evaluate((y) => window.scrollTo(0, y), s2y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'analytics-s2-parts-consumption.png' });
  console.log('Saved s2');

  // Screenshot 3: Equipment
  await page.evaluate((y) => window.scrollTo(0, y), s3y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'analytics-s3-equipment.png' });
  console.log('Saved s3');

  // Screenshot 4: Team Performance
  await page.evaluate((y) => window.scrollTo(0, y), s4y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'analytics-s4-team-performance.png' });
  console.log('Saved s4');

  await browser.close();
  console.log('Done');
})().catch(err => { console.error(err); process.exit(1); });
