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
    // ✅ PARSE LOCALSTORAGE FROM API
    // ✅ PARSE LOCALSTORAGE FROM API
    let localStorageData = {};
    try {
      const lsArray = apiData.access_configuration_preferences[0].localstorage;
      if (lsArray && lsArray.length > 0) {
        let lsString = lsArray[0];

        // Handle if it's a stringified JSON object
        if (typeof lsString === 'string') {
          // Remove outer quotes if present
          if (lsString.startsWith('"') && lsString.endsWith('"')) {
            lsString = lsString.slice(1, -1);
          }

          // Unescape escaped quotes
          lsString = lsString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

          localStorageData = JSON.parse(lsString);
          console.log('📦 Parsed', Object.keys(localStorageData).length, 'localStorage keys from API');
        } else if (typeof lsString === 'object') {
          // Already an object
          localStorageData = lsString;
          console.log('📦 Loaded', Object.keys(localStorageData).length, 'localStorage keys from API (already object)');
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse localStorage:', e.message);
      console.error('❌ Raw localStorage value:', apiData.access_configuration_preferences[0].localstorage?.[0]?.substring(0, 100));
    }
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
    // ✅ INJECT INTERCEPTOR FOR ALL PRODUCTS EXCEPT FREEPIK (Freepik uses HTML interceptor)
    if (productConfig.name !== 'freepik') {
      await page.evaluateOnNewDocument((productPrefix, productName) => {
        console.log('🔧 [INTERCEPTOR] Product:', productName, 'Prefix:', productPrefix);

        // Fetch interceptor
        const originalFetch = window.fetch;
        window.fetch = function (...args) {
          let url = args[0];

          if (typeof url === 'string') {
            // ✅ INTERCEPT ABSOLUTE URLs to www.freepik.com
            if (url.startsWith('https://www.freepik.com/')) {
              const path = url.replace('https://www.freepik.com', '');
              const newUrl = productPrefix + path;
              console.log('[FETCH INTERCEPTED ABSOLUTE]', url, '→', newUrl);
              args[0] = newUrl;
            }
            // ✅ INTERCEPT RELATIVE URLs
            else if (url.startsWith('/') && !url.startsWith(productPrefix) && !url.startsWith('/_next')) {
              const newUrl = productPrefix + url;
              console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
              args[0] = newUrl;
            }
          }

          return originalFetch.apply(this, args);
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          if (typeof url === 'string') {
            // ✅ INTERCEPT ABSOLUTE URLs
            if (url.startsWith('https://www.freepik.com/')) {
              const path = url.replace('https://www.freepik.com', '');
              const newUrl = productPrefix + path;
              console.log('[XHR INTERCEPTED ABSOLUTE]', url, '→', newUrl);
              url = newUrl;
            }
            // ✅ INTERCEPT RELATIVE URLs
            else if (url.startsWith('/') && !url.startsWith(productPrefix)) {
              const newUrl = productPrefix + url;
              console.log('[XHR INTERCEPTED]', url, '→', newUrl);
              url = newUrl;
            }
          }

          return originalOpen.call(this, method, url, ...rest);
        };

        // Intercept Request constructor
        if (window.Request) {
          const OriginalRequest = window.Request;
          window.Request = function (input, init) {
            if (typeof input === 'string') {
              // ✅ INTERCEPT ABSOLUTE URLs
              if (input.startsWith('https://www.freepik.com/')) {
                const path = input.replace('https://www.freepik.com', '');
                console.log('[REQUEST INTERCEPTED ABSOLUTE]', input, '→', productPrefix + path);
                input = productPrefix + path;
              }
              // ✅ INTERCEPT RELATIVE URLs
              else if (input.startsWith('/') && !input.startsWith(productPrefix)) {
                console.log('[REQUEST INTERCEPTED]', input, '→', productPrefix + input);
                input = productPrefix + input;
              }
            }
            return new OriginalRequest(input, init);
          };
        }

        console.log('✅ Interceptor installed for', productName);
      }, productPrefix, productConfig.name);
    } else {
      console.log('⚠️ Skipping evaluateOnNewDocument for Freepik - using HTML interceptor instead');
    }
    // ✅ CONDITIONAL: Only intercept history for non-Freepik and non-Storyblocks products
    if (productConfig.name !== 'freepik' && productConfig.name !== 'storyblocks') {
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

    // ✅ SET COOKIES BEFORE LOADING PAGE!
    console.log('🍪 Setting cookies BEFORE page load...');

    // ✅ CRITICAL FOR FREEPIK: Inject cookies into browser context BEFORE ANY JS RUNS!
    if (productConfig.name === 'freepik') {
      await page.evaluateOnNewDocument((cookies) => {
        cookies.forEach(cookie => {
          document.cookie = `${cookie.name}=${cookie.value}; path=${cookie.path}; domain=${cookie.domain}; ${cookie.secure ? 'secure;' : ''} samesite=${cookie.sameSite}`;
        });
        console.log('🍪 [FREEPIK] Cookies injected BEFORE page load!');
      }, puppeteerCookies);
      console.log('✅ Injected cookie script into page context BEFORE load');
    }

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
      console.log('✅ Set', freepikCookies.length, 'Freepik cookies BEFORE load');

      // ✅ INJECT LOCALSTORAGE FOR FREEPIK BEFORE PAGE LOADS
      if (Object.keys(localStorageData).length > 0) {
        await page.evaluateOnNewDocument((lsData) => {
          Object.keys(lsData).forEach(key => {
            try {
              localStorage.setItem(key, lsData[key]);
            } catch (e) {
              console.error('❌ [LS]', key.substring(0, 30));
            }
          });
        }, localStorageData);

        console.log('✅ Injected', Object.keys(localStorageData).length, 'localStorage items into Puppeteer context');
      }
    } else {
      await page.setCookie(...puppeteerCookies);
      console.log('✅ Set', puppeteerCookies.length, 'cookies BEFORE load');
    }

    // NOW load the page WITH cookies already set!
    console.log('🚀 Attempting to load page WITH COOKIES...');

    // ✅ ADD THIS - Set proper headers for Freepik
    if (productConfig.name === 'freepik') {
      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.freepik.com/',
        'Origin': 'https://www.freepik.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      console.log('✅ Set Freepik-specific headers');
    }

    // Log all network requests
    page.on('response', (response) => {
      if (!response.ok()) {
        console.log(`⚠️  Failed request: ${response.status()} ${response.url()}`);
      }
    });

    // Try to load with a very permissive strategy
    try {
      const response = await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      console.log('✅ Page loaded WITH COOKIES');
      console.log('📊 Response status:', response.status());
      console.log('📊 Response URL:', response.url());

      // ✅ Get content type FIRST
      const contentType = response.headers()['content-type'] || '';
      console.log('📄 Content-Type:', contentType);

      // ✅ Check if this is an asset request
      const isAssetRequest =
        /\.(js|css|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot|ico|json|map)(\?.*)?$/i.test(requestPath) ||
        requestPath.includes('/wp-content/') ||
        requestPath.includes('/wp-includes/') ||
        requestPath.includes('/uploads/') ||
        requestPath.match(/\/(js|css|fonts|assets|images|static|dist|build)\//i) ||
        requestPath.match(/\.(min\.)?(js|css)(\?|$)/i) ||
        requestPath.includes('/themes/') ||
        requestPath.includes('/plugins/') ||
        requestPath.includes('/cache/') ||
        requestPath.includes('/autoptimize');

      console.log('📄 Is Asset:', isAssetRequest);

      // ✅ For asset files, serve directly without HTML processing
      if (isAssetRequest || (!contentType.includes('text/html') && !contentType.includes('application/xhtml'))) {
        console.log('📦 Asset detected, serving directly without HTML processing');

        const buffer = await response.buffer();
        await page.close();

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (contentType.includes('javascript') || contentType.includes('css') || isAssetRequest) {
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }

        return res.send(buffer);
      }

      // Verify cookies were set
      const actualCookies = await page.cookies();
      console.log('🔍 Cookies in browser:', actualCookies.length);

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

    // ✅ FOR FREEPIK: Check if this is a 404 page and fix it BEFORE sending to browser
    if (productConfig.name === 'freepik' && html.includes('404') && html.includes("doesn't exist")) {
      console.log('   🔧 [FREEPIK] Detected 404 page - removing 404 content from HTML');

      // Remove the 404 overlay container from the HTML entirely
      html = html.replace(
        /<div[^>]*class="[^"]*relative[^"]*flex[^"]*size-full[^"]*"[^>]*>[\s\S]*?Oops![\s\S]*?doesn't exist[\s\S]*?<\/div>/gi,
        '<!-- 404 removed by proxy -->'
      );

      console.log('   ✅ Removed 404 HTML before sending to browser');
    }

    // ✅ INJECT COOKIES INTO USER'S BROWSER
    console.log('🍪 Injecting cookies into HTML...');

    const cookieScript = `
<script>
(function() {
  console.log('🍪 Setting cookies IMMEDIATELY...');
  ${puppeteerCookies.map(cookie =>
      `document.cookie = '${cookie.name}=${cookie.value}; path=/; samesite=Lax';`
    ).join('\n  ')}
  console.log('✅ Cookies set BEFORE page render!');
})();
</script>`;

    // ✅ ADD LOCALSTORAGE SCRIPT FOR FREEPIK
    const localStorageScript = (productConfig.name === 'freepik' && Object.keys(localStorageData).length > 0) ? `
<script>
(function() {
  console.log('💾 [FREEPIK LS] Injecting localStorage...');
  const lsData = ${JSON.stringify(localStorageData)};
  
  Object.keys(lsData).forEach(key => {
    try {
      localStorage.setItem(key, lsData[key]);
    } catch (e) {
      console.error('❌ [LS] Failed:', key.substring(0, 50));
    }
  });
  
  console.log('✅ [FREEPIK LS] Set', Object.keys(lsData).length, 'items');
})();
</script>` : '';

    // ✅ CREATE FETCH INTERCEPTOR SCRIPT - FIXED FOR FREEPIK!
    let fetchInterceptorScript = '';
    if (productConfig.name === 'freepik' || productConfig.name === 'storyblocks') {
      const productPrefix = `/${productConfig.name}`;

      fetchInterceptorScript = `
<script>
(function() {
  const PRODUCT_PREFIX = '${productPrefix}';
  const PRODUCT_NAME = '${productConfig.name}';
  
  console.log('🔧 [' + PRODUCT_NAME.toUpperCase() + '] Installing interceptors...');
  
  const internalPaths = ${JSON.stringify(productConfig.internalPaths || [])};
  
  function isInternalPath(url) {
    return internalPaths.some(path => url.startsWith(path));
  }
  
  // ✅ CRITICAL FIX: Rewrite URL IMMEDIATELY - SYNCHRONOUSLY BEFORE ANY OTHER SCRIPTS!
  (function() {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith(PRODUCT_PREFIX + '/')) {
      const cleanPath = currentPath.substring(PRODUCT_PREFIX.length);
      console.log('🔧 [IMMEDIATE URL FIX]', currentPath, '→', cleanPath);
      
      // This runs SYNCHRONOUSLY before React loads
      const newUrl = cleanPath + window.location.search + window.location.hash;
      history.replaceState(null, '', newUrl);
      
      // Force pathname to update
      Object.defineProperty(window.location, '_pathname', {
        value: cleanPath,
        writable: false
      });
    }
  })();
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    let url = args[0];

    if (typeof url === 'string') {
      if (url.startsWith(PRODUCT_PREFIX + '/')) {
        return originalFetch.apply(this, args);
      }

      if (url.startsWith('/api/')) {
        const newUrl = PRODUCT_PREFIX + url;
        console.log('[FETCH INTERCEPTED API]', url, '→', newUrl);
        args[0] = newUrl;
        return originalFetch.apply(this, args);
      }

      if (url.startsWith('https://www.' + PRODUCT_NAME + '.com/')) {
        const path = url.replace('https://www.' + PRODUCT_NAME + '.com', '');
        if (isInternalPath(path)) {
          args[0] = path;
        } else {
          const newUrl = PRODUCT_PREFIX + path;
          console.log('[FETCH INTERCEPTED ABSOLUTE]', url, '→', newUrl);
          args[0] = newUrl;
        }
      }
      else if (url.startsWith('/') && !url.startsWith(PRODUCT_PREFIX) && !url.startsWith('/_next')) {
        if (!isInternalPath(url)) {
          const newUrl = PRODUCT_PREFIX + url;
          console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
          args[0] = newUrl;
        }
      }
    }
    return originalFetch.apply(this, args);
  };
  
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (typeof url === 'string') {
      if (url.startsWith(PRODUCT_PREFIX + '/')) {
        return originalOpen.call(this, method, url, ...rest);
      }

      if (url.startsWith('https://www.' + PRODUCT_NAME + '.com/')) {
        const path = url.replace('https://www.' + PRODUCT_NAME + '.com', '');
        if (isInternalPath(path)) {
          url = path;
        } else {
          url = PRODUCT_PREFIX + path;
          console.log('[XHR INTERCEPTED ABSOLUTE]', url);
        }
      }
      else if (url.startsWith('/') && !url.startsWith(PRODUCT_PREFIX) && !url.startsWith('/_next')) {
        if (!isInternalPath(url)) {
          url = PRODUCT_PREFIX + url;
          console.log('[XHR INTERCEPTED]', url);
        }
      }
    }
    return originalOpen.call(this, method, url, ...rest);
  };
  
  console.log('✅ Interceptors installed');
})();
</script>`;
    }

    // ✅ INJECT SCRIPTS AT THE VERY TOP OF <head> - URL FIX MUST RUN FIRST!
    if (html.includes('<head>')) {
      // The order matters: localStorage FIRST, then URL fix, then cookies, then fetch interceptor
      html = html.replace('<head>', `<head>${localStorageScript}${fetchInterceptorScript}${cookieScript}`);
      console.log('   ✅ Injected scripts in correct order: localStorage → URL fix → cookies → interceptor');

    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${fetchInterceptorScript}${cookieScript}</head>`);
      console.log('   ✅ Injected scripts at end of <head>');
    } else {
      console.log('   ⚠️ No <head> tag found');
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

    // ✅ ONLY replace domain URLs in HTML content, NOT in our injected scripts
    if (productConfig.name !== 'freepik') {
      const scriptEndMarker = '✅ Interceptors installed';
      const scriptEndIndex = html.indexOf(scriptEndMarker);

      if (scriptEndIndex > 0) {
        const beforeScripts = html.substring(0, scriptEndIndex + scriptEndMarker.length + 20);
        const afterScripts = html.substring(scriptEndIndex + scriptEndMarker.length + 20);

        const afterReplaced = afterScripts.replace(
          new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
          localProxyBase
        );

        html = beforeScripts + afterReplaced;
        console.log('   ✅ Protected interceptor from domain replacement');
      } else {
        html = html.replace(
          new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
          localProxyBase
        );
      }
    } else {
      console.log('   ⚠️ Skipping domain replacement for Freepik');
    }

    // 🔥 CONDITIONAL BASE TAG - Skip for Epidemic Sound, Freepik & Storyblocks
    if (productConfig.name !== 'epidemicsound' &&
      productConfig.name !== 'freepik' &&
      productConfig.name !== 'storyblocks') {
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

    // 🔥 FOR STORYBLOCKS & FREEPIK: DO NOTHING - Let interceptor handle everything
    if (productConfig.name === 'storyblocks' || productConfig.name === 'freepik') {
      console.log(`   🔧 ${productConfig.displayName} mode: NO URL REWRITING - Let interceptor handle everything`);
    }
    else {
      // Normal rewriting for other products
      html = html.replace(/["']\/api\//g, `"${productPrefix}/api/`);
      html = html.replace(/["']\/session\//g, `"${productPrefix}/session/`);
      html = html.replace(/["']\/manifest\.json/g, `"${productPrefix}/manifest.json`);

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

      const currentHost = req.get('host');
      if (isLocalhost) {
        html = html.replace(/https:\/\/localhost:8224/g, 'http://localhost:8224');
      } else {
        html = html.replace(/http:\/\/localhost:8224/g, `https://${currentHost}`);
        html = html.replace(/https:\/\/localhost:8224/g, `https://${currentHost}`);
      }
    }

    // Fix double slashes
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

// ... rest of the file stays the same ...

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

      // 1. Replace absolute domain URLs
      content = content.replace(
        new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
        localProxyBase
      );

      // ✅ FOR STORYBLOCKS: Also rewrite breadcrumbs CDN URLs
      if (productConfig.name === 'storyblocks') {
        content = content.replace(
          /https:\/\/breadcrumbs\.storyblocks\.com/g,
          `${localProxyBase}/breadcrumbs`
        );
        console.log('   ✅ Rewritten breadcrumbs CDN URLs');
      }
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