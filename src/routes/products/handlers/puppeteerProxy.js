import { getBrowser } from '../../../services/browserService.js';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';

/**
 * Main proxy function using Puppeteer
 */
export async function proxyWithPuppeteer(req, res, productConfig) {
  let browser = null;
  
  try {
    console.log('🎭 Puppeteer proxy request:', req.method, req.originalUrl);

    // Validate user session
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    if (!prefix) {
      return res.redirect('/expired');
    }

    // Get premium cookies from API
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    // Parse cookies if stored as string
    if (typeof cookiesArray === 'string') {
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookies:', e.message);
        return res.status(500).send('Invalid cookie configuration');
      }
    }

    // ✅ CHECK FOR NULL OR EMPTY COOKIES
    if (!cookiesArray || cookiesArray === 'null' || !Array.isArray(cookiesArray) || cookiesArray.length === 0) {
      console.error('❌ No valid cookies available for this product');
      return res.status(500).send('No cookies configured. Please add cookies in admin panel for ' + productConfig.displayName);
    }

    console.log('🍪 Loaded', cookiesArray.length, 'cookies for Puppeteer');

    // Get clean path (remove product prefix)
    const productPrefix = `/${productConfig.name}`;
    let requestPath = req.originalUrl;
    
    if (requestPath.startsWith(productPrefix)) {
      requestPath = requestPath.substring(productPrefix.length);
    }

    // Build target URL
    const targetUrl = `https://${productConfig.domain}${requestPath || '/'}`;
    console.log('🎯 Target URL:', targetUrl);

    // Launch browser
    browser = await getBrowser();
    const page = await browser.newPage();

    // ✅ CRITICAL FIX: ENABLE INTERCEPTION FIRST!
    await page.setRequestInterception(true);

    // ✅ THEN SETUP REQUEST HANDLER
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      
      // ✅ AGGRESSIVE BLOCKING: Block analytics and tracking
      const blockedPatterns = [
        'bat.bing.com',
        'bat.bing.net',
        'google-analytics.com',
        'googletagmanager.com',
        'doubleclick.net',
        'facebook.com/tr',
        'connect.facebook.net',
        'clarity.ms',
        'hotjar.com',
        'hotjar.io',
        'metrics.hotjar.io',  // ✅ FIX YOUR ISSUE!
        'vars.hotjar.com',
        'script.hotjar.com',
        'static.hotjar.com',
        'analytics.tiktok.com',
        'sentry.io',
        'cdn.onetrust.com',
        'cookielaw.org',
        'geotrust.com',
        'otBannerSdk.js',
        'js.hs-scripts.com',
        '/actions_tkcdp',
        '/actionp/',
        'tt.co',
        'facebook.net',
        'Meta Pixel'
      ];
      
      // Check if URL matches any blocked pattern
      if (blockedPatterns.some(pattern => url.includes(pattern))) {
        console.log(`🚫 Blocked: ${url}`);
        return request.abort('blockedbyclient');
      }
      
      // ✅ Also block beacon/ping requests
      if (resourceType === 'beacon' || resourceType === 'ping') {
        console.log(`🚫 Blocked ${resourceType}: ${url}`);
        return request.abort('blockedbyclient');
      }
      
      return request.continue();
    });

    // Set cookies
    const puppeteerCookies = cookiesArray.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expirationDate || -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: cookie.sameSite || 'Lax'
    }));

    await page.setCookie(...puppeteerCookies);
    console.log('✅ Set', puppeteerCookies.length, 'cookies in browser');

    // ✅ IMPROVED: Inject script to intercept fetch/XHR BEFORE navigation
    await page.evaluateOnNewDocument((productPrefix) => {
      console.log('🔧 [INTERCEPTOR] Product prefix:', productPrefix);

      // Intercept fetch
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        let url = args[0];
        
        // If URL starts with /, add product prefix
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(productPrefix)) {
          const newUrl = productPrefix + url;
          console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
          args[0] = newUrl;
        }
        
        return originalFetch.apply(this, args);
      };

      // Intercept XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        // If URL starts with /, add product prefix
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(productPrefix)) {
          const newUrl = productPrefix + url;
          console.log('[XHR INTERCEPTED]', url, '→', newUrl);
          url = newUrl;
        }
        
        return originalOpen.call(this, method, url, ...rest);
      };

      // 🔥 NEW: Intercept Request constructor for modern frameworks
      if (window.Request) {
        const OriginalRequest = window.Request;
        window.Request = function(input, init) {
          if (typeof input === 'string' && input.startsWith('/') && !input.startsWith(productPrefix)) {
            console.log('[REQUEST INTERCEPTED]', input, '→', productPrefix + input);
            input = productPrefix + input;
          }
          return new OriginalRequest(input, init);
        };
      }
    }, productPrefix);

    // Navigate to page with extensive debugging
    console.log('🚀 Attempting to load page...');

    // Log all network requests
    page.on('response', (response) => {
      if (!response.ok()) {
        console.log(`⚠️  Failed request: ${response.status()} ${response.url()}`);
      }
    });

    // Try to load with a very permissive strategy
    try {
      await page.goto(targetUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.error('❌ Page load failed:', error.message);
      
      // Try to get partial content anyway
      console.log('🔄 Attempting to get partial content...');
      try {
        const content = await page.content();
        if (content && content.length > 100) {
          console.log('✅ Got partial content, proceeding...');
        } else {
          throw error;
        }
      } catch (contentError) {
        throw error;
      }
    }

    // Get page content
    let html = await page.content();

    // ✅ IMPROVED URL REWRITING
    console.log('🔧 Rewriting URLs in HTML...');

    const localProxyBase = `http://${req.get('host')}${productPrefix}`;

    // 🔥 CONDITIONAL BASE TAG - Skip for Epidemic Sound (prevents double prefixing)
    if (productConfig.name !== 'epidemicsound') {
      const baseTag = `<base href="${localProxyBase}/">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<html>')) {
        html = html.replace('<html>', `<html><head>${baseTag}</head>`);
      }
      console.log('   ✅ Injected base tag:', baseTag);
    } else {
      console.log('   ⚠️ Skipped base tag for Epidemic Sound (prevents double prefixing)');
    }

    // 1. Replace absolute domain URLs
    html = html.replace(
      new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
      localProxyBase
    );

    // 🔥 Fix API calls and manifest in JavaScript/JSON
    html = html.replace(/["']\/api\//g, `"${productPrefix}/api/`);
    html = html.replace(/["']\/session\//g, `"${productPrefix}/session/`);
    html = html.replace(/["']\/manifest\.json/g, `"${productPrefix}/manifest.json`);

    // 3. Fix relative paths (starting with /)
    html = html.replace(/href="\/(?!\/)/g, `href="${productPrefix}/`);
    html = html.replace(/href='\/(?!\/)/g, `href='${productPrefix}/`);
    
    html = html.replace(/src="\/(?!\/)/g, `src="${productPrefix}/`);
    html = html.replace(/src='\/(?!\/)/g, `src='${productPrefix}/`);
    
    html = html.replace(/srcset="\/(?!\/)/g, `srcset="${productPrefix}/`);
    html = html.replace(/srcset='\/(?!\/)/g, `srcset='${productPrefix}/`);
    
    html = html.replace(/action="\/(?!\/)/g, `action="${productPrefix}/`);
    html = html.replace(/action='\/(?!\/)/g, `action='${productPrefix}/`);
    
    html = html.replace(/url\(\/(?!\/)/g, `url(${productPrefix}/`);
    html = html.replace(/url\("\/(?!\/)/g, `url("${productPrefix}/`);
    html = html.replace(/url\('\/(?!\/)/g, `url('${productPrefix}/`);

    // 4. Fix localhost HTTPS references
    html = html.replace(/https:\/\/localhost:8224/g, 'http://localhost:8224');

    // 5. Fix double slashes
    html = html.replace(new RegExp(`${productPrefix}${productPrefix}`, 'g'), productPrefix);

    console.log('   ✅ URL rewriting complete');

    // Close page
    await page.close();

    // Send response
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);

  } catch (error) {
    console.error('❌ Puppeteer proxy error:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      error: 'Proxy failed',
      message: error.message
    });
  }
}

/**
 * Proxy assets (CSS, JS, images) using Puppeteer browser
 */
export async function proxyAssetWithPuppeteer(req, res, productConfig, assetDomain) {
  let browser = null;
  
  try {
    console.log('🎨 Asset proxy request:', req.originalUrl);

    // Validate user session
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    if (!prefix) {
      return res.status(403).send('Unauthorized');
    }

    // Get premium cookies
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookies:', e.message);
        return res.status(403).send('Invalid cookie configuration');
      }
    }

    // ✅ CHECK FOR NULL OR EMPTY COOKIES
    if (!cookiesArray || cookiesArray === 'null' || !Array.isArray(cookiesArray) || cookiesArray.length === 0) {
      console.error('❌ No valid cookies available for asset');
      return res.status(403).send('No cookies configured');
    }

    // Get clean asset path
    const productPrefix = `/${productConfig.name}`;
    let assetPath = req.originalUrl;
    
    if (assetPath.startsWith(productPrefix)) {
      assetPath = assetPath.substring(productPrefix.length);
    }

    // Build asset URL
    const assetUrl = `https://${assetDomain}${assetPath}`;
    console.log('🖼️  Proxying asset:', assetUrl);

    // Launch browser
    browser = await getBrowser();
    const page = await browser.newPage();

    // ✅ ENABLE INTERCEPTION FIRST
    await page.setRequestInterception(true);

    // ✅ THEN SETUP REQUEST HANDLER
    page.on('request', (request) => {
      const url = request.url();
      
      if (
        url.includes('bat.bing.com') ||
        url.includes('bat.bing.net') ||
        url.includes('google-analytics.com') ||
        url.includes('googletagmanager.com') ||
        url.includes('doubleclick.net') ||
        url.includes('facebook.com/tr') ||
        url.includes('connect.facebook.net') ||
        url.includes('clarity.ms') ||
        url.includes('hotjar.com') ||
        url.includes('hotjar.io') ||
        url.includes('metrics.hotjar.io') ||
        url.includes('cdn.onetrust.com') ||
        url.includes('cookielaw.org') ||
        url.includes('sentry.io')
      ) {
        console.log('🚫 BLOCKED:', url);
        return request.abort('blockedbyclient');
      } else {
        return request.continue();
      }
    });

    // Set cookies
    const puppeteerCookies = cookiesArray.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expirationDate || -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: cookie.sameSite || 'Lax'
    }));

    await page.setCookie(...puppeteerCookies);

    // Fetch asset
    const response = await page.goto(assetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    if (!response) {
      await page.close();
      return res.status(404).send('Asset not found');
    }

    const buffer = await response.buffer();
    const contentType = response.headers()['content-type'] || 'application/octet-stream';

    await page.close();

    // For CSS/JS, rewrite URLs
    if (contentType.includes('css') || contentType.includes('javascript')) {
      let content = buffer.toString('utf-8');
      
      const localProxyBase = `http://${req.get('host')}${productPrefix}`;
      
      // Replace domain references
      content = content.replace(
        new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
        localProxyBase
      );
      content = content.replace(
        new RegExp(`//${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
        localProxyBase
      );
      
      // ✅ Fix relative paths in CSS/JS
      content = content.replace(/url\(\/(?!\/)/g, `url(${productPrefix}/`);
      content = content.replace(/url\("\/(?!\/)/g, `url("${productPrefix}/`);
      content = content.replace(/url\('\/(?!\/)/g, `url('${productPrefix}/`);
      
      // Fix localhost HTTPS
      content = content.replace(/https:\/\/localhost:8224/g, 'http://localhost:8224');

      res.setHeader('Content-Type', contentType);
      return res.send(content);
    }

    // Binary assets (images, fonts, etc.)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(buffer);

  } catch (error) {
    console.error('❌ Asset proxy error:', error.message);
    return res.status(500).send('Asset loading failed');
  }
}