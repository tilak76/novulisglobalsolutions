const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('https://white-cliff-0bca3ed00.1.azurestaticapps.net/login', { waitUntil: 'networkidle' });

  console.log('Filling form...');
  await page.fill('input[type="email"]', 'admin@gmail.com');
  await page.fill('input[type="password"]', 'password');

  console.log('Clicking submit...');
  await page.click('button[type="submit"]');

  console.log('Waiting for URL change...');
  try {
    await page.waitForURL(url => !url.href.includes("login"), { timeout: 15000 });
    console.log('Successfully navigated away from login. New URL:', page.url());
  } catch (e) {
    console.log('Failed to navigate away from login. Taking screenshot of result...');
    await page.screenshot({ path: 'login_failed.png' });
    const html = await page.content();
    require('fs').writeFileSync('login_failed.html', html);
  }

  await browser.close();
})();
