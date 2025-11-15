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
    console.log('🔧 Rewriting URLs in HTML...');

    // ✅ DETECT PROTOCOL - Use https for production, http for localhost
    const isLocalhost = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
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

    // ✅ FIX: Use req.url instead of req.originalUrl
    // req.url is relative to the router and doesn't include the product prefix
    const productPrefix = `/${productConfig.name}`;
    let requestPath = req.url;

    // ✅ Only remove prefix if it somehow still exists (shouldn't happen with req.url)
    if (requestPath.startsWith(productPrefix)) {
      requestPath = requestPath.substring(productPrefix.length);
    }

    // ✅ Ensure path starts with /
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }

    // Build target URL
    const targetUrl = `https://${productConfig.domain}${requestPath}`;
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
        'metrics.hotjar.io',
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

    // Prepare cookies
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

    // ✅ CONDITIONAL INTERCEPTOR - Skip for Freepik since pages load from actual domain
    if (productConfig.name !== 'freepik') {
      await page.evaluateOnNewDocument((productPrefix) => {
        console.log('🔧 [INTERCEPTOR] Product prefix:', productPrefix);

        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
          let url = args[0];

          if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(productPrefix)) {
            const newUrl = productPrefix + url;
            console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
            args[0] = newUrl;
          }

          return originalFetch.apply(this, args);
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(productPrefix)) {
            const newUrl = productPrefix + url;
            console.log('[XHR INTERCEPTED]', url, '→', newUrl);
            url = newUrl;
          }

          return originalOpen.call(this, method, url, ...rest);
        };

        // Intercept Request constructor
        if (window.Request) {
          const OriginalRequest = window.Request;
          window.Request = function (input, init) {
            if (typeof input === 'string' && input.startsWith('/') && !input.startsWith(productPrefix)) {
              console.log('[REQUEST INTERCEPTED]', input, '→', productPrefix + input);
              input = productPrefix + input;
            }
            return new OriginalRequest(input, init);
          };
        }
      }, productPrefix);
    } else {
      console.log('⚠️ Skipping fetch interceptor for Freepik (pages load from actual domain)');
    }

    // Navigate to page FIRST (without cookies)
    console.log('🚀 Attempting to load page...');

    // Log all network requests
    page.on('response', (response) => {
      if (!response.ok()) {
        console.log(`⚠️  Failed request: ${response.status()} ${response.url()}`);
      }
    });

    // ✅ CONDITIONAL: Only intercept history for non-Freepik products
    if (productConfig.name !== 'freepik') {
      await page.evaluateOnNewDocument((prefix) => {
        const pushState = history.pushState;
        history.pushState = function (state, title, url) {
          if (url.startsWith('/') && !url.startsWith(prefix)) {
            url = prefix + url;
          }
          return pushState.apply(this, [state, title, url]);
        };
      }, productPrefix);
    }

    // Try to load with a very permissive strategy
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('✅ Page loaded');

      // ✅ NOW SET COOKIES AFTER PAGE LOADS
      console.log('🍪 Setting cookies after page load...');

      // ✅ FOR FREEPIK: Set cookies with multiple domain variants
      if (productConfig.name === 'freepik') {
        const freepikCookies = [];

        cookiesArray.forEach(cookie => {
          // Add cookie for .freepik.com
          freepikCookies.push({
            name: cookie.name,
            value: cookie.value,
            domain: '.freepik.com',
            path: '/',
            expires: cookie.expirationDate || -1,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || true,
            sameSite: 'Lax'
          });

          // Also add for www.freepik.com
          freepikCookies.push({
            name: cookie.name,
            value: cookie.value,
            domain: 'www.freepik.com',
            path: '/',
            expires: cookie.expirationDate || -1,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || true,
            sameSite: 'Lax'
          });
        });

        await page.setCookie(...freepikCookies);
        console.log('✅ Set', freepikCookies.length, 'Freepik cookies (with domain variants)');
      } else {
        await page.setCookie(...puppeteerCookies);
        console.log('✅ Set', puppeteerCookies.length, 'cookies in browser');
      }

      // Verify cookies were set
      const actualCookies = await page.cookies();
      console.log('🔍 Cookies in browser:', actualCookies.length);


      // ✅ INJECT FETCH INTERCEPTOR BEFORE RELOAD (for Freepik)
      if (productConfig.name === 'freepik') {
        console.log('🔧 Injecting fetch interceptor into page before reload...');

        const proxyHost = req.get('host');

        await page.evaluateOnNewDocument((proxyHost, protocol) => {
          console.log('🔧 [FREEPIK] Installing fetch interceptor...');
          console.log('   Proxy:', protocol + '://' + proxyHost);

          const originalFetch = window.fetch;
          window.fetch = function (...args) {
            let url = args[0];

            // Intercept absolute URLs to www.freepik.com
            if (typeof url === 'string') {
              if (url.startsWith('https://www.freepik.com/')) {
                const path = url.replace('https://www.freepik.com', '');
                const newUrl = protocol + '://' + proxyHost + '/freepik' + path;
                console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
                args[0] = newUrl;
              } else if (url.startsWith('/') && !url.startsWith('/_next')) {
                const newUrl = protocol + '://' + proxyHost + '/freepik' + url;
                console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
                args[0] = newUrl;
              }
            }

            return originalFetch.apply(this, args);
          };

          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            if (typeof url === 'string') {
              if (url.startsWith('https://www.freepik.com/')) {
                const path = url.replace('https://www.freepik.com', '');
                const newUrl = protocol + '://' + proxyHost + '/freepik' + path;
                console.log('[XHR INTERCEPTED]', url, '→', newUrl);
                url = newUrl;
              } else if (url.startsWith('/') && !url.startsWith('/_next')) {
                const newUrl = protocol + '://' + proxyHost + '/freepik' + url;
                console.log('[XHR INTERCEPTED]', url, '→', newUrl);
                url = newUrl;
              }
            }
            return originalOpen.call(this, method, url, ...rest);
          };

          console.log('✅ Fetch interceptor installed');
        }, proxyHost, protocol);

        console.log('✅ Fetch interceptor ready');
      }
      // Reload page to apply cookies
      console.log('🔄 Reloading page with cookies...');
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      console.log('✅ Page reloaded successfully with cookies');


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
    // ✅ IMPROVED URL REWRITING

    // Get page content
    let html = await page.content();

    // ✅ INJECT COOKIES INTO USER'S BROWSER
    console.log('🍪 Injecting cookies into HTML...');
    const cookieScript = `
<script>
(function() {
  console.log('🍪 Setting cookies in browser...');
  ${puppeteerCookies.map(cookie =>
      `document.cookie = '${cookie.name}=${cookie.value}; path=${cookie.path}; domain=${cookie.domain}; ${cookie.secure ? 'secure;' : ''} samesite=${cookie.sameSite}';`
    ).join('\n  ')}
  console.log('✅ Cookies set!');
})();
</script>`;

    // ✅ ADD FETCH INTERCEPTOR FOR FREEPIK
    let fetchInterceptorScript = '';
    if (productConfig.name === 'freepik') {
      const proxyHost = req.get('host');

      fetchInterceptorScript = `
<script>
(function() {
  console.log('🔧 [FREEPIK] Installing fetch interceptor...');
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    let url = args[0];
    
    // Intercept all relative URLs except /_next
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('/freepik') && !url.startsWith('/_next')) {
      const newUrl = '/freepik' + url;
      console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
      args[0] = newUrl;
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Also intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('/freepik') && !url.startsWith('/_next')) {
      const newUrl = '/freepik' + url;
      console.log('[XHR INTERCEPTED]', url, '→', newUrl);
      url = newUrl;
    }
    return originalOpen.call(this, method, url, ...rest);
  };
  
  console.log('✅ Fetch interceptor installed - will prefix all relative URLs with /freepik');
})();
</script>`;
    }

    // Inject before </head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${cookieScript}${fetchInterceptorScript}</head>`);
      console.log('   ✅ Injected cookie script');
      if (fetchInterceptorScript) {
        console.log('   ✅ Injected fetch interceptor');
      }
    } else {
      console.log('   ⚠️ No </head> tag found');
    }

    // ✅ ADD THIS - Check if page shows logged in content
    if (html.includes('Sign in') || html.includes('Log in')) {
      console.log('⚠️  HTML contains sign in button');
    } else {
      console.log('✅ HTML does NOT contain sign in button');
    }

    // Check for user profile indicators
    if (html.includes('logout') || html.includes('profile') || html.includes('account')) {
      console.log('✅ HTML contains logout/profile indicators - likely logged in');
    }


    const localProxyBase = `${protocol}://${req.get('host')}${productPrefix}`;

    // 🔥 CONDITIONAL BASE TAG - Skip for Epidemic Sound & Freepik
    if (productConfig.name !== 'epidemicsound' && productConfig.name !== 'freepik') {
      const baseTag = `<base href="${localProxyBase}/">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<html>')) {
        html = html.replace('<html>', `<html><head>${baseTag}</head>`);
      }
      console.log('   ✅ Injected base tag:', baseTag);
    } else {
      console.log('   ⚠️ Skipped base tag for', productConfig.name);
    }

    // 1. Replace absolute domain URLs
    html = html.replace(
      new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
      localProxyBase
    );

    // 🔥 FOR FREEPIK: No URL rewriting (works at root level)
    if (productConfig.name === 'freepik') {
      console.log('   🔧 Freepik mode: No URL rewriting (works at root level)');
      // Freepik works at root level - no rewriting needed
    } else {
      // Normal rewriting for other products

      // 2. Fix API calls and manifest in JavaScript/JSON
      html = html.replace(/["']\/api\//g, `"${productPrefix}/api/`);
      html = html.replace(/["']\/session\//g, `"${productPrefix}/session/`);
      html = html.replace(/["']\/manifest\.json/g, `"${productPrefix}/manifest.json`);

      // 💥 Critical: Fix internal navigation links
      html = html.replace(/href="\/(?!static|cdn|img|image|api)([^"]+)"/g, `href="${productPrefix}/$1"`);
      html = html.replace(/href='\/(?!static|cdn|img|image|api)([^']+)'/g, `href='${productPrefix}/$1'`);

      html = html.replace(/src="\/(?!static|cdn|img|image|api)([^"]+)"/g, `src="${productPrefix}/$1"`);
      html = html.replace(/src='\/(?!static|cdn|img|image|api)([^']+)'/g, `src='${productPrefix}/$1'`);

      html = html.replace(/data-href="\/([^"]+)"/g, `data-href="${productPrefix}/$1"`);

      html = html.replace(/srcset="\/(?!\/)/g, `srcset="${productPrefix}/`);
      html = html.replace(/srcset='\/(?!\/)/g, `srcset='${productPrefix}/`);

      html = html.replace(/action="\/(?!\/)/g, `action="${productPrefix}/`);
      html = html.replace(/action='\/(?!\/)/g, `action='${productPrefix}/`);

      html = html.replace(/url\(\/(?!\/)/g, `url(${productPrefix}/`);
      html = html.replace(/url\("\/(?!\/)/g, `url("${productPrefix}/`);
      html = html.replace(/url\('\/(?!\/)/g, `url('${productPrefix}/`);

      // 4. Fix localhost/production HTTPS references
      const currentHost = req.get('host');
      if (isLocalhost) {
        html = html.replace(/https:\/\/localhost:8224/g, 'http://localhost:8224');
      } else {
        html = html.replace(/http:\/\/localhost:8224/g, `https://${currentHost}`);
        html = html.replace(/https:\/\/localhost:8224/g, `https://${currentHost}`);
      }
    }

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

    // ✅ FIX: Use req.url instead of req.originalUrl
    const productPrefix = `/${productConfig.name}`;
    let assetPath = req.url;

    // ✅ Only remove prefix if it somehow still exists
    if (assetPath.startsWith(productPrefix)) {
      assetPath = assetPath.substring(productPrefix.length);
    }

    // ✅ Ensure path starts with /
    if (!assetPath.startsWith('/')) {
      assetPath = '/' + assetPath;
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

      // ✅ DETECT PROTOCOL
      const isLocalhost = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
      const protocol = isLocalhost ? 'http' : 'https';
      const localProxyBase = `${protocol}://${req.get('host')}${productPrefix}`;

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

      // Fix localhost/production references
      if (isLocalhost) {
        content = content.replace(/https:\/\/localhost:8224/g, 'http://localhost:8224');
      } else {
        const currentHost = req.get('host');
        content = content.replace(/http:\/\/localhost:8224/g, `https://${currentHost}`);
        content = content.replace(/https:\/\/localhost:8224/g, `https://${currentHost}`);
      }

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