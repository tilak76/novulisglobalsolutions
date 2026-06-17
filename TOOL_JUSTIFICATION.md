# Tool Justification & Extraction Strategy (Step 6)

In accordance with the assignment requirements (Step 6), this document explicitly outlines the architecture, tooling decisions, considered alternatives, and accepted trade-offs for the UI State Capture and Extraction pipeline.

---

## 1. Chosen Extraction Strategy: Playwright

To correctly process a dynamic web application, we needed an extraction strategy that handles:
1. **Authentication:** The target site (`WaiverPro`) is gated behind a `/login` page requiring credentials (`admin@gmail.com` / `password`).
2. **Client-Side Rendering (CSR):** React SPAs ship empty `div` containers and hydrate on the client. A naive HTTP `GET` (e.g., `curl` or `axios`) will only return the loading skeleton, missing all dynamic elements.
3. **Evidence Capture:** The assignment requires capturing visual evidence (screenshots) corresponding to specific UI states.

### Why Playwright?
We chose **Playwright (Node.js)** as the core extraction engine inside the backend.
- **Native Network Idling:** Playwright's `networkidle` lifecycle event ensures that all React network calls have finished, and the DOM is fully rendered before we attempt extraction.
- **Robust Auth Handling:** We can programmatically drive the browser to type into `#email` and `#password` fields, click the submit button, wait for the redirect to `/dashboard`, and automatically preserve those auth cookies for subsequent extractions.
- **Pixel-Perfect Evidence:** Playwright natively takes high-fidelity, full-page screenshots of the live viewport, fulfilling the assignment's requirement for visual evidence mapping.

## 2. Alternatives Considered

### Alternative A: Cheerio / Axios (Static Scraping)
- **What it is:** Fetching the HTML payload over HTTP and parsing it with Cheerio (similar to BeautifulSoup in Python).
- **Why we rejected it:** It fundamentally cannot execute JavaScript. Because WaiverPro is a React SPA, Cheerio would only see `<div id="root"></div>`. It also cannot negotiate the JWT/Session cookie auth flow easily without manually reverse-engineering the API endpoints, which violates the requirement to extract what the *user* actually sees in the DOM.

### Alternative B: Puppeteer
- **What it is:** Google's older headless browser automation tool.
- **Why we rejected it:** While Puppeteer handles JS execution and auth, Playwright offers superior auto-waiting mechanics (it inherently waits for elements to be actionable before clicking). Playwright also has cleaner cross-browser support and better parallel execution mechanisms, making our pipeline much faster and more resilient to network hiccups.

### Alternative C: Direct Raw DOM to LLM
- **What it is:** Scraping the `document.documentElement.outerHTML` directly and feeding the raw HTML string into the Gemini Comparison Agent.
- **Why we rejected it:** Modern React DOMs are massive, polluted with `data-v-*` attributes, massive inline SVG strings, and deeply nested layout `divs`. Feeding this to the LLM destroys the token window (costly), dilutes the attention mechanism (leading to severe hallucinations), and results in a fragile comparison.

## 3. Trade-offs Accepted

### Trade-off 1: Semantic Filtering over Pixel-Diffing
Rather than attempting pixel-by-pixel image comparison (which is notoriously flaky due to sub-pixel rendering differences across OSs), we chose to run a DOM-evaluation script *inside* Playwright. We extract only "meaningful" semantic tags (e.g., `h1`-`h6`, `button`, `a`, `p`, `span`) along with their text content and coordinates, returning it as a highly structured JSON array.
- **Trade-off:** We lose the ability to easily verify if a button is the exact correct hex code color (e.g., `#FF0000`).
- **Benefit:** We gain a massive boost in reliability for verifying textual content, presence of required elements, and functional structure without AI hallucinations.

### Trade-off 2: Headless Browser Overhead
Running a full Chromium instance via Playwright inside a Node backend consumes significant memory and CPU compared to a static script.
- **Trade-off:** Slower initial boot times and higher memory footprint.
- **Benefit:** It is the *only* way to guarantee we are extracting the actual rendered state that the user sees, completely satisfying the strict dynamic content requirements of Step 6.

### Trade-off 3: Network Resiliency
The assignment requires handling network hiccups.
We implemented implicit retries in Playwright (`page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })`) and explicit `try/catch` blocks in our `extract.js` worker. If a page fails to load, it retries before marking the route as failed.
- **Trade-off:** Pipeline execution takes a few seconds longer as it ensures the page is truly idle.
- **Benefit:** Eliminates false-positive discrepancy reports caused by a spinner or partially loaded widget.
