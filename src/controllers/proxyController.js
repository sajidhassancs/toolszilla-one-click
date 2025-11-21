/**
 * Proxy Controller - WITH DOWNLOAD LIMITS
 */
import { decryptUserCookies, getPremiumCookies } from '../services/cookieService.js';
import { makeProxyRequest, processProxyResponse } from '../services/proxyService.js';
import { isPathBanned } from '../utils/validators.js';
import { STATIC_FILE_EXTENSIONS } from '../utils/constants.js';
import { checkDownloadPermission, recordDownloadAction, showLimitReachedPage } from './downloadController.js';

/**
 * Main proxy handler WITH DOWNLOAD LIMIT CHECKING
 */
export async function handleProxyRequest(req, res, productConfig) {
  try {
    console.log('============================================');
    console.log('🔵 NEW REQUEST:', req.method, req.originalUrl);
    console.log('   Host:', req.get('host'));
    console.log('   Protocol:', req.protocol);
    console.log('   Product:', productConfig.name);

    // Get the full request path
    const productPrefix = `/${productConfig.name}`;
    let requestPath = req.originalUrl;

    console.log('   Original URL:', requestPath);

    // Remove product prefix if present
    if (requestPath.startsWith(productPrefix)) {
      requestPath = requestPath.substring(productPrefix.length);
    }

    console.log('   Clean path:', requestPath);

    // Handle query strings
    const [pathOnly, queryString] = requestPath.split('?');
    const cleanPath = pathOnly || '/';
    const lowerPath = cleanPath.toLowerCase();

    console.log('   Path only:', pathOnly);
    console.log('   Query:', queryString || 'none');

    // Validate user session
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      console.log('⚠️  Session invalid, redirecting to:', userData.redirect);
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const userEmail = userData.user_email;
    const plan = userData.plan || 'default';

    if (!prefix) {
      console.log('❌ No prefix found, redirecting to /expired');
      return res.redirect('/expired');
    }

    console.log('✅ User validated:');
    console.log('   Prefix:', prefix);
    console.log('   Email:', userEmail);
    console.log('   Plan:', plan);

    // Check banned paths
    if (isPathBanned(cleanPath, productConfig.bannedPaths || [])) {
      console.warn('⚠️  Blocked banned path:', cleanPath);
      return res.status(403).send('Access to this page is restricted.');
    }

    // ✅ DOWNLOAD LIMIT CHECK - Detect download endpoints
    const isDownloadEndpoint =
      lowerPath.includes('/download') ||
      lowerPath.includes('/license') ||
      lowerPath.includes('/export') ||
      (req.method === 'POST' && (
        lowerPath.includes('/download_and_license') || // Envato
        lowerPath.includes('/items/download') ||        // Flaticon
        lowerPath.includes('/pikaso/export') ||         // Freepik Pikaso
        lowerPath.includes('/api/download')             // Generic
      ));

    console.log('📥 Is download endpoint?', isDownloadEndpoint);

    // ✅ CHECK LIMIT BEFORE PROCESSING
    if (isDownloadEndpoint && productConfig.enforceLimits !== false) {
      console.log('🔒 Checking download limit...');

      const limitCheck = await checkDownloadPermission(
        req,
        productConfig.name,
        userEmail,
        plan
      );

      if (!limitCheck.allowed) {
        console.log(`⚠️  LIMIT REACHED: ${limitCheck.count}/${limitCheck.limit}`);
        return showLimitReachedPage(req, res, productConfig.displayName, plan);
      }

      console.log(`✅ Download allowed: ${limitCheck.count}/${limitCheck.limit}`);

      // Flag this request for recording after success
      req._shouldRecordDownload = true;
    }

    // Build upstream URL
    let upstreamUrl = `https://${productConfig.domain}${cleanPath}`;

    // Add back query string if it exists
    if (queryString) {
      upstreamUrl += `?${queryString}`;
    }

    console.log('🎯 Upstream URL:', upstreamUrl);

    // Get premium cookies
    const { cookies, proxy } = await getPremiumCookies(
      prefix,
      0,
      productConfig.useExternalProxy || false
    );

    console.log('🍪 Got cookies:', Object.keys(cookies).length, 'cookies');

    // Merge with custom cookies
    const allCookies = { ...cookies, ...(productConfig.customCookies || {}) };

    // Check if this is a static file
    const isStaticFile = STATIC_FILE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
    console.log('📦 Is static file?', isStaticFile);

    const currentHost = `${req.protocol}://${req.get('host')}`;
    console.log('🌐 Current host:', currentHost);

    if (isStaticFile) {
      console.log('📦 HANDLING STATIC FILE');

      try {
        const response = await makeProxyRequest(
          upstreamUrl,
          'GET',
          allCookies,
          {
            'accept': '*/*',
            'referer': `https://${productConfig.domain}/`,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'origin': `https://${productConfig.domain}`
          },
          proxy,
          null
        );

        console.log('✅ Static file response status:', response.status);

        if (response.status !== 200) {
          console.error('❌ Static file failed with status:', response.status);
          return res.status(response.status).send('Resource not found');
        }

        const contentType = response.headers['content-type'] || 'application/octet-stream';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        // For CSS/JS files, replace domains
        if (contentType.includes('text/css') || contentType.includes('javascript')) {
          console.log('🔧 Processing CSS/JS file, replacing domains...');
          let content = response.data.toString('utf-8');

          content = content.replace(
            new RegExp(`https?://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
            `${currentHost}${productPrefix}`
          );
          content = content.replace(
            new RegExp(`//${productConfig.domain.replace(/\./g, '\\.')}`, 'g'),
            `//${req.get('host')}${productPrefix}`
          );

          return res.status(200).type(contentType).send(Buffer.from(content, 'utf-8'));
        }

        // For binary files (images, fonts, etc.), send as-is
        console.log('📤 Sending binary file as-is');
        return res.status(200).type(contentType).send(response.data);

      } catch (error) {
        console.error('❌ ERROR FETCHING STATIC FILE:', error.message);
        return res.status(500).send('Error loading resource');
      }
    }

    // Handle dynamic requests (HTML, API calls, etc.)
    console.log('🌐 HANDLING DYNAMIC REQUEST (HTML/API)');

    const response = await makeProxyRequest(
      upstreamUrl,
      req.method,
      allCookies,
      {
        'accept': req.headers.accept || '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'referer': `https://${productConfig.domain}/`,
        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0'
      },
      proxy,
      req.body
    );

    console.log('✅ Dynamic response status:', response.status);

    // ✅ RECORD DOWNLOAD AFTER SUCCESSFUL RESPONSE
    if (req._shouldRecordDownload && response.status >= 200 && response.status < 300) {
      console.log('📝 Recording successful download...');

      // Check if response contains download data
      const responseText = response.data.toString('utf-8');
      const hasDownloadContent =
        responseText.includes('downloadUrl') ||
        responseText.includes('download_url') ||
        responseText.includes('file_url') ||
        response.headers['content-disposition'];

      if (hasDownloadContent) {
        await recordDownloadAction(
          req,
          productConfig.name,
          userEmail,
          plan,
          {
            path: cleanPath,
            method: req.method,
            timestamp: new Date().toISOString()
          }
        );
        console.log('✅ Download recorded successfully');
      } else {
        console.log('⚠️  No download content detected, skipping record');
      }
    }

    // Handle redirects
    if (response.redirectLocation) {
      console.log('↪️  Redirect to:', response.redirectLocation);

      let redirectUrl = response.redirectLocation;
      if (redirectUrl.includes(productConfig.domain)) {
        redirectUrl = redirectUrl.replace(`https://${productConfig.domain}`, productPrefix);
        redirectUrl = redirectUrl.replace(`http://${productConfig.domain}`, productPrefix);
      }

      return res.redirect(redirectUrl);
    }

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    console.log('   Content-Type:', contentType);

    const processedData = processProxyResponse(
      response.data,
      lowerPath,
      contentType,
      productConfig.domain,
      `${currentHost}${productPrefix}`,
      productConfig.replaceRules || []
    );

    // Rewrite asset URLs for products with assetDomains config
    if (productConfig.assetDomains && contentType.includes('text/html')) {
      console.log('🔧 Rewriting asset URLs for', productConfig.name);
      let htmlContent = processedData.toString('utf-8');

      for (const assetDomain of productConfig.assetDomains) {
        const fromDomain = assetDomain.from;
        const toPath = assetDomain.to;

        // Skip image domains - let them load directly from CDN
        if (fromDomain.includes('elements-resized') ||
          fromDomain.includes('elements-assets') ||
          fromDomain.includes('envatousercontent')) {
          console.log(`   ⏭️  Skipping image domain: ${fromDomain}`);
          continue;
        }

        htmlContent = htmlContent.replace(
          new RegExp(`https://${fromDomain.replace(/\./g, '\\.')}`, 'g'),
          `${currentHost}${productPrefix}${toPath}`
        );

        console.log(`   ✅ Rewritten: ${fromDomain} → ${currentHost}${productPrefix}${toPath}`);
      }

      // Inject download interceptor for Envato
      if (productConfig.name === 'envato') {
        console.log('🔧 Injecting Envato download interceptor');

        const envatoDownloadJS = `
<script>
(function() {
  console.log('🔧 Envato download interceptor loaded');
  
  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (url && url.includes('/download_and_license')) {
      console.log('🔧 Intercepting XHR download:', url);
      if (!url.startsWith('/envato/')) {
        url = '/envato' + url;
      }
    }
    return originalXHROpen.call(this, method, url, ...args);
  };
  
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('/download_and_license')) {
      console.log('🔧 Intercepting fetch download:', url);
      if (!url.startsWith('/envato/')) {
        url = '/envato' + url;
      }
    }
    return originalFetch.call(this, url, options);
  };
  
  console.log('✅ Download interceptor active');
})();
</script>
`;

        // Inject before closing body tag
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', envatoDownloadJS + '</body>');
          console.log('   ✅ Injected download interceptor');
        }
      }

      return res.status(response.status).type(contentType).send(htmlContent);
    }

    console.log('✅ Sending processed response');
    return res.status(response.status).type(contentType).send(processedData);

  } catch (error) {
    console.error('❌ PROXY ERROR:', error.message);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
}

/**
 * Handle media proxy requests (for CDN content)
 */
export async function handleMediaProxy(req, res, productConfig, mediaDomain) {
  try {
    console.log('🖼️  Media proxy request:', req.path);

    const mediaPath = req.path.replace('/media', '');
    const upstreamUrl = `https://${mediaDomain}${mediaPath}`;

    console.log('🎯 Proxying to:', upstreamUrl);

    // Validate user session
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      console.log('⚠️  Session invalid for media request');
      return res.status(403).send('Access denied');
    }

    const prefix = userData.prefix;
    if (!prefix) {
      console.log('❌ No prefix found for media request');
      return res.status(403).send('Access denied');
    }

    // Get premium cookies
    const { cookies, proxy } = await getPremiumCookies(
      prefix,
      0,
      productConfig.useExternalProxy || false
    );

    // Make request to media CDN
    const response = await makeProxyRequest(
      upstreamUrl,
      'GET',
      cookies,
      {
        'accept': '*/*',
        'referer': `https://${productConfig.domain}/`,
        'origin': `https://${productConfig.domain}`
      },
      proxy,
      null
    );

    console.log('✅ Media response status:', response.status);

    if (response.status !== 200) {
      console.error('❌ Media proxy failed with status:', response.status);
      return res.status(response.status).send('Media not found');
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // Set content type
    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    console.log('✅ Sending media file');
    return res.status(200).send(response.data);

  } catch (error) {
    console.error('❌ Media proxy error:', error.message);
    return res.status(500).send('Media proxy error');
  }
}