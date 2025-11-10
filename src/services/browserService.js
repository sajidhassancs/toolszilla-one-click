/**
 * Browser Service
 * Manages Puppeteer browser instance (singleton pattern)
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

let browser = null;
let isLaunching = false;

/**
 * Get or create browser instance (singleton)
 * Uses singleton pattern to reuse the same browser
 */
export async function getBrowser() {
  // If browser already exists and is connected, return it
  if (browser && browser.isConnected()) {
    return browser;
  }

  // If browser is currently being launched, wait for it
  if (isLaunching) {
    console.log('⏳ Browser is launching, waiting...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getBrowser(); // Retry
  }

  try {
    isLaunching = true;
    console.log('🚀 Launching new Puppeteer browser...');

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreHTTPSErrors: true
    });

    console.log('✅ Browser launched successfully');
    isLaunching = false;

    // Handle browser disconnect
    browser.on('disconnected', () => {
      console.log('⚠️  Browser disconnected');
      browser = null;
    });

    return browser;

  } catch (error) {
    isLaunching = false;
    console.error('❌ Failed to launch browser:', error.message);
    throw error;
  }
}

/**
 * Launch a new browser instance (non-singleton)
 */
export async function launchBrowser() {
  const newBrowser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ],
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  return newBrowser;
}

/**
 * Navigate to a page with cookies
 */
export async function navigateWithCookies(page, url, cookies) {
  await page.setCookie(...cookies);
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  return page;
}

/**
 * Get page HTML content
 */
export async function getPageContent(page) {
  return await page.content();
}

/**
 * Take a screenshot (useful for debugging)
 */
export async function takeScreenshot(page, path) {
  await page.screenshot({ path, fullPage: true });
}

/**
 * Close browser instance
 */
export async function closeBrowser() {
  if (browser) {
    console.log('🔒 Closing browser...');
    await browser.close();
    browser = null;
    console.log('✅ Browser closed');
  }
}

/**
 * Cleanup on process exit
 */
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});