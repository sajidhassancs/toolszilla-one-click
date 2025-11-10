/**
 * Puppeteer-based Proxy Handler
 */
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
      cookiesArray = JSON.parse(cookiesArray);
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

    // ✅ NEW: Inject script to intercept fetch/XHR BEFORE navigation
    await page.evaluateOnNewDocument((productPrefix) => {
      // Intercept fetch
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        let url = args[0];
        
        // If URL starts with /, add product prefix
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(productPrefix)) {
          args[0] = productPrefix + url;
          console.log('[FETCH INTERCEPTED]', url, '→', args[0]);
        }
        
        return originalFetch.apply(this, args);
      };

      // Intercept XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        // If URL starts with /, add product prefix
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(productPrefix)) {
          url = productPrefix + url;
          console.log('[XHR INTERCEPTED]', url);
        }
        
        return originalOpen.call(this, method, url, ...rest);
      };
    }, productPrefix);

    // Navigate to page
    await page.goto(targetUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    console.log('✅ Page loaded successfully');

    // Get page content
    let html = await page.content();

    // ✅ IMPROVED URL REWRITING
    console.log('🔧 Rewriting URLs in HTML...');

    const localProxyBase = `http://${req.get('host')}${productPrefix}`;

    // 1. Replace absolute domain URLs
    html = html.replace(
      new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
      localProxyBase
    );
    html = html.replace(
      new RegExp(`http://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
      localProxyBase
    );

    // 2. Replace protocol-relative URLs (//domain.com)
    html = html.replace(
      new RegExp(`//${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
      localProxyBase
    );

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
      cookiesArray = JSON.parse(cookiesArray);
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
      waitUntil: 'networkidle0',
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