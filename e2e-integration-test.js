const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-jwt-secret-key';
const user = { id: 2, username: 'admin', role: 'admin' };
const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
const userB64 = Buffer.from(JSON.stringify(user)).toString('base64');

const IMMS = 'http://localhost:3002';
const MCS = 'http://localhost:3003';

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('   [browser console.error]', m.text()); });

  // ---------- IMMS: inject session, load app ----------
  await page.goto(`${IMMS}/login`);
  await page.evaluate(([t]) => { localStorage.setItem('token', t); localStorage.setItem('rememberMe', 'true'); }, [token]);
  await page.goto(`${IMMS}/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const url = page.url();
  ok('IMMS authenticated (not bounced to /login)', !/\/login/.test(url), url);

  // IMMS sidebar is permanent — no menu click needed.

  // ---------- IMMS nav: external MCS link ----------
  const mcsLink = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a')).find(x => /MAINTENANCE SYSTEM/i.test(x.textContent || ''));
    if (!a) return null;
    return { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), text: a.textContent.trim() };
  });
  ok('IMMS nav has "MAINTENANCE SYSTEM" external link', !!mcsLink, mcsLink ? JSON.stringify(mcsLink) : 'not found');
  if (mcsLink) {
    ok('  link target=_blank + rel set', mcsLink.target === '_blank' && /noopener/.test(mcsLink.rel || ''), `target=${mcsLink.target} rel=${mcsLink.rel}`);
    ok('  link href points to MCS:3003 with SSO fragment', /3003/.test(mcsLink.href) && mcsLink.href.includes('#token=') && mcsLink.href.includes('&user='), mcsLink.href);
  }

  const hasOldItem = await page.evaluate(() => Array.from(document.querySelectorAll('a,span,div')).some(x => (x.textContent || '').trim() === 'MAINTENANCE CALLS'));
  ok('IMMS old "MAINTENANCE CALLS" internal item is gone', !hasOldItem);

  // Old internal route should not render the deleted page
  await page.goto(`${IMMS}/maintenance-calls`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const afterRoute = page.url();
  const bodyTxt = (await page.evaluate(() => document.body.innerText)).slice(0, 200);
  ok('IMMS /maintenance-calls no longer shows old board', !/call board|call station/i.test(bodyTxt), `url=${afterRoute}`);

  // ---------- MCS: SSO via fragment ----------
  await page.goto(`${MCS}/calls#token=${token}&user=${userB64}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const mcsUrl = page.url();
  ok('MCS authenticates via SSO fragment (not on /login)', !/\/login/.test(mcsUrl), mcsUrl);

  // Open MCS drawer
  const mcsMenu = await page.$('header button, button[aria-label*="menu" i]');
  if (mcsMenu) { await mcsMenu.click().catch(() => {}); await page.waitForTimeout(600); }

  const navInfo = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a'));
    const find = (label) => items.find(a => (a.textContent || '').trim() === label);
    const lb = find('Live Board');
    return {
      labels: items.map(a => (a.textContent || '').trim()).filter(Boolean),
      liveBoardTarget: lb ? lb.getAttribute('target') : null,
      hasAdmin: !!find('Admin'),
    };
  });
  ok('MCS nav shows Live Board', navInfo.labels.includes('Live Board'), navInfo.labels.join(', '));
  ok('  Live Board opens new tab (target=_blank)', navInfo.liveBoardTarget === '_blank', `target=${navInfo.liveBoardTarget}`);
  ok('MCS nav shows Analytics', navInfo.labels.includes('Analytics'));
  ok('MCS nav shows Admin (admin role)', navInfo.hasAdmin);

  // No "Open Board in New Tab" footer link
  const footerLink = await page.evaluate(() => Array.from(document.querySelectorAll('a,button')).some(x => /Open Board in New Tab/i.test(x.textContent || '')));
  ok('MCS old footer "Open Board in New Tab" removed', !footerLink);

  // ---------- MCS /admin page ----------
  await page.goto(`${MCS}/admin#token=${token}&user=${userB64}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500);
  const adminTxt = await page.evaluate(() => document.body.innerText);
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.textContent.trim()));
  ok('MCS /admin renders BadgeAdmin (Badge & Reader Admin heading)', /Badge\s*&?\s*Reader Admin/i.test(adminTxt), adminTxt.slice(0, 120).replace(/\n/g, ' | '));
  ok('  Admin has Badges + Readers tabs', tabs.some(t => /Badges/i.test(t)) && tabs.some(t => /Readers/i.test(t)), tabs.join(', '));
  ok('  Permissions tab present (post-plan addition)', tabs.some(t => /Permission/i.test(t)), tabs.join(', '));

  await page.screenshot({ path: 'e2e-mcs-admin.png', fullPage: true });

  await browser.close();

  const failed = results.filter(r => !r.pass);
  console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
  if (failed.length) { console.log('FAILURES:'); failed.forEach(f => console.log(' - ' + f.name + (f.detail ? '  (' + f.detail + ')' : ''))); process.exitCode = 1; }
})().catch(err => { console.error(err); process.exit(1); });
