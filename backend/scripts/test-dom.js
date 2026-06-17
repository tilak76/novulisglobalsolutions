const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://white-cliff-0bca3ed00.1.azurestaticapps.net/login', { waitUntil: 'networkidle' });
  const html = await page.content();
  fs.writeFileSync('login_dom.html', html);
  
  await browser.close();
})();
