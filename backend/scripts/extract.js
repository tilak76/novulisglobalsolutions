const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = "https://white-cliff-0bca3ed00.1.azurestaticapps.net";
const EMAIL = "admin@gmail.com";
const PASSWORD = "password";

async function login(page, coverage) {
    console.log("Navigating to login page...");
    try {
        await page.goto(`${URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
        
        console.log("Waiting for login form...");
        await page.waitForSelector('[data-testid="field-email"]', { timeout: 10000 });
        await page.fill('[data-testid="field-email"]', EMAIL);
        await page.fill('[data-testid="field-password"]', PASSWORD);
        
        console.log("Submitting login...");
        await page.click('[data-testid="btn-login"]');
        
        console.log("Waiting for navigation post-login...");
        await page.waitForURL(url => !url.href.includes("login"), { timeout: 15000 });
        console.log("Login successful.");
        coverage.successful_routes.push('/login');
    } catch (e) {
        console.error("Login failed:", e.message);
        coverage.failed_routes.push({ route: '/login', reason: e.message });
        throw e; // Rethrow to stop extraction
    }
}

async function extractPageContentWithRetry(page, link, screenshotDir, coverage, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Attempt ${attempt}] Extracting content from ${link}...`);
            await page.goto(link, { waitUntil: 'networkidle', timeout: 15000 });
            
            const urlPath = page.url().replace(URL, "") || "/";
            const safePath = urlPath.replace(/\//g, "_").replace(/^_/, "") || "home";
            const screenshotName = `${safePath}.png`;
            const screenshotPath = path.join(screenshotDir, screenshotName);
            
            await page.screenshot({ path: screenshotPath, fullPage: true });
            
            const extractedElements = await page.evaluate(() => {
                const elements = [];
                function getSelector(el) {
                    if (el.id) return `#${el.id}`;
                    let p = [];
                    while (el.nodeType === Node.ELEMENT_NODE) {
                        let selector = el.nodeName.toLowerCase();
                        if (el.className && typeof el.className === 'string') {
                            const classes = el.className.split(' ').filter(c => c && !c.includes(':')).join('.');
                            if (classes) selector += `.${classes}`;
                        }
                        p.unshift(selector);
                        el = el.parentNode;
                        if (!el || el.nodeType !== Node.ELEMENT_NODE) break;
                    }
                    return p.join(' > ');
                }

                const targetTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'button', 'a', 'span', 'div'];
                targetTags.forEach(tag => {
                    document.querySelectorAll(tag).forEach(el => {
                        const text = el.innerText ? el.innerText.trim() : '';
                        if (!text && tag !== 'img' && tag !== 'button') return;
                        if ((tag === 'span' || tag === 'div') && el.children.length > 0) return;
                        
                        const rect = el.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) return;

                        let componentType = tag;
                        if (tag === 'a') componentType = 'navigation_item';
                        else if (tag.match(/^h[1-6]$/) || tag === 'p' || tag === 'span') componentType = 'text_block';
                        
                        elements.push({
                            component_type: componentType,
                            component_selector: getSelector(el),
                            actual_text_content: text,
                            tag_name: tag,
                            is_visible: true
                        });
                    });
                });
                return elements;
            });
            
            coverage.successful_routes.push(urlPath);
            return {
                page_url: urlPath,
                screenshot_path: screenshotName,
                retrieved_at: new Date().toISOString(),
                elements: extractedElements
            };
        } catch (e) {
            console.error(`Attempt ${attempt} failed for ${link}:`, e.message);
            coverage.retries += 1;
            if (attempt === maxRetries) {
                coverage.failed_routes.push({ route: link, reason: e.message });
                coverage.missed_data.push(`Failed to extract elements from ${link} after ${maxRetries} attempts.`);
                return null;
            }
        }
    }
}

async function extractUIState(outputFile, screenshotDir) {
    if (!fs.existsSync(screenshotDir)){
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Explicit coverage and instrumentation tracking (Requirement 4)
    const coverage = {
        total_routes_discovered: 0,
        successful_routes: [],
        failed_routes: [],
        retries: 0,
        missed_data: []
    };
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    
    const allData = [];
    
    try {
        await login(page, coverage);
        
        // Find links on dashboard
        const navLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(h => h.startsWith(window.location.origin) && !h.includes("logout") && !h.includes("login"));
        });
        
        const currentUrl = page.url();
        const linksToVisit = new Set([currentUrl, ...navLinks]);
        coverage.total_routes_discovered = linksToVisit.size;
        
        for (const link of linksToVisit) {
            const data = await extractPageContentWithRetry(page, link, screenshotDir, coverage);
            if (data) {
                allData.push(data);
            }
        }
        
    } catch (e) {
        console.error("Critical error during Playwright extraction:", e);
        coverage.missed_data.push("Extraction pipeline aborted due to critical error: " + e.message);
    } finally {
        await browser.close();
    }
    
    // Save UI Data
    fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2));
    
    // Save Coverage Report
    const coverageFile = path.join(path.dirname(outputFile), 'coverage.json');
    fs.writeFileSync(coverageFile, JSON.stringify(coverage, null, 2));
    
    console.log(`Extraction complete. Saved to ${outputFile}`);
    console.log(`Coverage report saved to ${coverageFile}`);
    
    return allData;
}

module.exports = { extractUIState };
