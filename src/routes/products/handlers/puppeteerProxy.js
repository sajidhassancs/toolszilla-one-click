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
    // ✅ CRITICAL FIX FOR FREEPIK: Remove /freepik prefix if this is a direct Freepik path
    if (req._freepikDirectPath && requestPath.startsWith('/freepik/')) {
      requestPath = requestPath.substring(8); // Remove '/freepik'
      console.log('🎨 [FREEPIK DIRECT] Removed prefix, using:', requestPath);
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
    } else {
      await page.setCookie(...puppeteerCookies);
      console.log('✅ Set', puppeteerCookies.length, 'cookies BEFORE load');
    }

    // NOW load the page WITH cookies already set!
    console.log('🚀 Attempting to load page WITH COOKIES...');

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

      // ✅ Get content type FIRST
      const contentType = response.headers()['content-type'] || '';
      console.log('📄 Content-Type:', contentType);

      // ✅ Check if this is an asset request (handles query params like ?ver=3.7.1)
      // Very aggressive detection for all possible asset types
      const isAssetRequest =
        // File extension based detection
        /\.(js|css|jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot|ico|json|map)(\?.*)?$/i.test(requestPath) ||
        // WordPress specific paths
        requestPath.includes('/wp-content/') ||
        requestPath.includes('/wp-includes/') ||
        requestPath.includes('/uploads/') ||
        // Common asset directory patterns
        requestPath.match(/\/(js|css|fonts|assets|images|static|dist|build)\//i) ||
        // Common JavaScript/CSS file patterns (even without directory)
        requestPath.match(/\.(min\.)?(js|css)(\?|$)/i) ||
        // WordPress theme/plugin patterns
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
    // ✅ IMPROVED URL REWRITING

    // Get page content
    let html = await page.content();

    // ✅ FOR FREEPIK: Check if this is a 404 page and fix it BEFORE sending to browser
    if (productConfig.name === 'freepik' && html.includes('404') && html.includes("doesn't exist")) {
      console.log('   🔧 [FREEPIK] Detected 404 page - removing 404 content from HTML');

      // Remove the 404 overlay container from the HTML entirely
      // This prevents React hydration errors
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
  console.log('🍪 Setting cookies in browser...');
  ${puppeteerCookies.map(cookie =>
      `document.cookie = '${cookie.name}=${cookie.value}; path=${cookie.path}; domain=${cookie.domain}; ${cookie.secure ? 'secure;' : ''} samesite=${cookie.sameSite}';`
    ).join('\n  ')}
  console.log('✅ Cookies set!');
})();
</script>`;
    // ✅ ADD FETCH INTERCEPTOR FOR FREEPIK & STORYBLOCKS
    let fetchInterceptorScript = '';
    if (productConfig.name === 'freepik' || productConfig.name === 'storyblocks') {
      fetchInterceptorScript = `
<style>
  /* Hide Freepik modals and overlays */
  [role="dialog"],
  [class*="modal"],
  [class*="Modal"],
  [class*="overlay"],
  [class*="Overlay"] {
    display: none !important;
  }
</style>
<script>
(function() {
  console.log('🔧 [FREEPIK] Installing interceptors...');
  

  // ✅ CRITICAL: Fix window.location.pathname for Freepik internal paths
if (window.location.pathname.startsWith('/freepik/pikaso') ||
    window.location.pathname.startsWith('/freepik/wepik') ||
    window.location.pathname.startsWith('/freepik/slidesgo')) {
  // Remove /freepik prefix from URL bar
  const cleanPath = window.location.pathname.replace('/freepik', '');
  console.log('🔧 Rewriting browser URL from', window.location.pathname, 'to', cleanPath);
  window.history.replaceState({}, '', cleanPath + window.location.search + window.location.hash);
}
  // ✅ List of Freepik internal paths that should NOT be prefixed
  const freepikInternalPaths = [
    '/pikaso', '/wepik', '/slidesgo', '/ai',
    '/profile', '/collections', '/projects',
    '/pricing', '/popular', '/search', '/photos',
    '/vectors', '/icons', '/psd', '/mockups'
  ];
  
  function isInternalPath(url) {
    return freepikInternalPaths.some(path => url.startsWith(path));
  }
  
  // ✅ MORE PRECISE 404 removal - find the specific overlay container
  // ✅ AGGRESSIVE 404 removal - remove the ENTIRE 404 page structure
const observer = new MutationObserver((mutations) => {
  const body = document.body;
  if (!body) return;

  const text = body.innerText.toLowerCase();
  if (text.includes('404') && text.includes("doesn't exist")) {
    console.log('⚠️ 404 page detected, removing ENTIRE 404 structure...');

    // Find ALL direct children of body
    const bodyChildren = Array.from(document.body.children);

    for (const child of bodyChildren) {
      const childText = (child.innerText || '').toLowerCase();

      // If this child contains 404 text, it's the 404 page container
      if (childText.includes('404') && childText.includes("doesn't exist")) {
        console.log('🗑️ Removing entire 404 page structure:', child.tagName, child.className);
        child.remove(); // Remove the ENTIRE container
        observer.disconnect();

        // Force React to re-render the actual content
        setTimeout(() => {
          // Trigger a popstate event to force Next.js to re-render
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, 100);

        return;
      }
    }

    console.log('⚠️ Could not find 404 container');
  }
});
  
  // Start observing when DOM is ready
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('👁️ MutationObserver started watching for 404 pages');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      console.log('👁️ MutationObserver started watching for 404 pages');
    });
  }
  
  // ✅ INTERCEPT CLICKS ON LINKS
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href) {
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin) {
        console.log('[CLICK ALLOWED]', url.pathname);
      }
    }
  }, true);
  
  // ✅ Fetch interceptor
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    let url = args[0];
    if (typeof url === 'string') {
      if (url.startsWith('https://www.freepik.com/')) {
        const path = url.replace('https://www.freepik.com', '');
        if (isInternalPath(path)) {
          console.log('[FETCH SKIPPED - INTERNAL - USING RELATIVE]', url, '→', path);
          args[0] = path;
        } else {
          const newUrl = '/freepik' + path;
          console.log('[FETCH INTERCEPTED ABSOLUTE]', url, '→', newUrl);
          args[0] = newUrl;
        }
      }
      else if (url.startsWith('/') && !url.startsWith('/freepik') && !url.startsWith('/_next')) {
        if (isInternalPath(url)) {
          console.log('[FETCH SKIPPED - INTERNAL]', url);
        } else {
          const newUrl = '/freepik' + url;
          console.log('[FETCH INTERCEPTED]', url, '→', newUrl);
          args[0] = newUrl;
        }
      }
    }
    return originalFetch.apply(this, args);
  };
  
  // ✅ XHR interceptor
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (typeof url === 'string') {
      if (url.startsWith('https://www.freepik.com/')) {
        const path = url.replace('https://www.freepik.com', '');
        if (isInternalPath(path)) {
          console.log('[XHR SKIPPED - INTERNAL - USING RELATIVE]', url, '→', path);
          url = path;
        } else {
          const newUrl = '/freepik' + path;
          console.log('[XHR INTERCEPTED ABSOLUTE]', url, '→', newUrl);
          url = newUrl;
        }
      }
      else if (url.startsWith('/') && !url.startsWith('/freepik') && !url.startsWith('/_next')) {
        if (isInternalPath(url)) {
          console.log('[XHR SKIPPED - INTERNAL]', url);
        } else {
          const newUrl = '/freepik' + url;
          console.log('[XHR INTERCEPTED]', url, '→', newUrl);
          url = newUrl;
        }
      }
    }
    return originalOpen.call(this, method, url, ...rest);
  };
  
  console.log('✅ Interceptors installed - clicks and API calls will be prefixed (except internal paths)');
})();
</script>`;
    }
    // ✅ CRITICAL: Inject interceptor at START of <head>, not end!
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${fetchInterceptorScript}${cookieScript}`);
      console.log('   ✅ Injected fetch interceptor at START of <head>');
      console.log('   ✅ Injected cookie script');
    } else if (html.includes('</head>')) {
      // Fallback to end of head if no opening tag found
      html = html.replace('</head>', `${cookieScript}${fetchInterceptorScript}</head>`);
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
    // Find the end of our injected scripts
    const scriptEndMarker = '✅ Interceptors installed';
    const scriptEndIndex = html.indexOf(scriptEndMarker);

    if (scriptEndIndex > 0) {
      // Split: everything before our script stays untouched
      const beforeScripts = html.substring(0, scriptEndIndex + scriptEndMarker.length + 20); // +20 to include closing tags
      const afterScripts = html.substring(scriptEndIndex + scriptEndMarker.length + 20);

      // Only replace in the part AFTER our scripts
      const afterReplaced = afterScripts.replace(
        new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
        localProxyBase
      );

      html = beforeScripts + afterReplaced;
      console.log('   ✅ Protected interceptor from domain replacement');
    } else {
      // Fallback - no interceptor found, replace everywhere
      html = html.replace(
        new RegExp(`https://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
        localProxyBase
      );
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


    // 🔥 FOR STORYBLOCKS: DO NOTHING - Let pages load as-is
    if (productConfig.name === 'storyblocks') {
      console.log('   🔧 Storyblocks mode: Leaving HTML untouched (no URL rewriting)');
      // Don't modify anything - let fetch interceptor handle it all
    }
    else if (productConfig.name === 'freepik') {
      console.log('   🔧 Freepik mode: Fixing URLs');

      const prefix = '/freepik';

      // ✅ List of Freepik's internal routes that should NOT get prefix
      const freepikInternalPaths = [
        'pikaso', 'wepik', 'slidesgo', 'ai',
        'profile', 'collections', 'projects',
        'pricing', 'popular', 'search', 'photos',
        'vectors', 'icons', 'psd', 'mockups'
      ];

      // ✅ Add prefix to navigation links EXCEPT internal Freepik paths
      html = html.replace(
        /href="\/([^"]*?)"/g,
        (match, path) => {
          // Skip if already has prefix, or is anchor/mailto/http
          if (path.startsWith('freepik') || path.startsWith('#') ||
            path.startsWith('mailto:') || path.startsWith('http')) {
            return match;
          }

          // ✅ Check if this is a Freepik internal path
          const firstSegment = path.split('/')[0].split('?')[0];
          if (freepikInternalPaths.includes(firstSegment)) {
            console.log('   ⚠️ Skipping internal path:', path);
            return match; // Don't add prefix to internal Freepik routes
          }

          return `href="${prefix}/${path}"`;
        }
      );

      html = html.replace(
        /href='\/([^']*?)'/g,
        (match, path) => {
          if (path.startsWith('freepik') || path.startsWith('#') ||
            path.startsWith('mailto:') || path.startsWith('http')) {
            return match;
          }

          const firstSegment = path.split('/')[0].split('?')[0];
          if (freepikInternalPaths.includes(firstSegment)) {
            return match;
          }

          return `href='${prefix}/${path}'`;
        }
      );

      // ✅ REMOVE prefix from asset sources
      html = html.replace(new RegExp(`src="${prefix}/`, 'g'), 'src="/');
      html = html.replace(new RegExp(`src='${prefix}/`, 'g'), "src='/");

      console.log('   ✅ Fixed Freepik URLs - preserved internal paths');
    }
    else {
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