/**
 * Proxy Controller
 * Main proxy logic for handling requests to target websites
 */
import { decryptUserCookies, getPremiumCookies } from '../services/cookieService.js';
import { makeProxyRequest, processProxyResponse } from '../services/proxyService.js';
import { downloadFile } from '../services/fileService.js';
import { isPathBanned } from '../utils/validators.js';
import { STATIC_FILE_EXTENSIONS } from '../utils/constants.js';

/**
 * Main proxy handler
 */
export async function handleProxyRequest(req, res, productConfig) {
  try {
    // Get the full request path
    const requestPath = req.path.substring(1); // Remove leading slash
    const lowerPath = requestPath.toLowerCase();

    console.log(`🔄 Proxy request: ${req.method} ${requestPath}`);

    // Validate user session
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      console.log('⚠️  Session invalid, redirecting to:', userData.redirect);
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    if (!prefix) {
      console.log('❌ No prefix found, redirecting to /expired');
      return res.redirect('/expired');
    }

    // Check banned paths
    const pathParts = requestPath.split('/').filter(p => p);
    if (isPathBanned(requestPath, productConfig.bannedPaths || [])) {
      console.warn('⚠️  Blocked banned path:', requestPath);
      return res.status(403).send('Access to this page is restricted.');
    }

    // Build upstream URL
    // Remove the product prefix from URL if it exists
    const fullPath = req.originalUrl.startsWith('/flaticon') 
      ? req.originalUrl.replace('/flaticon', '') 
      : req.originalUrl;
    
    let upstreamUrl = `https://${productConfig.domain}${fullPath}`;

    // Apply custom replacements (reverse)
    for (const [find, replace] of productConfig.replaceRules || []) {
      const regex = new RegExp(replace, 'g');
      upstreamUrl = upstreamUrl.replace(regex, find);
    }

    console.log('🎯 Upstream URL:', upstreamUrl);

    // Get premium cookies
    const { cookies, proxy } = await getPremiumCookies(
      prefix, 
      0, 
      productConfig.useExternalProxy || false
    );

    // Merge with custom cookies
    const allCookies = { ...cookies, ...(productConfig.customCookies || {}) };

    // Handle static files (CSS, JS, images, etc.)
    const isStaticFile = STATIC_FILE_EXTENSIONS.some(ext => lowerPath.endsWith(ext)) && !lowerPath.endsWith('.json');

    if (isStaticFile) {
      try {
        const { content, contentType } = await downloadFile(
          upstreamUrl,
          allCookies,
          productConfig.customHeaders || {},
          productConfig.domain,
          req.get('host'),
          productConfig.replaceRules || []
        );

        return res.type(contentType).send(content);
      } catch (error) {
        console.error('❌ Error downloading static file:', error.message);
        return res.status(500).send('Error downloading file');
      }
    }

    // Handle dynamic requests (HTML, API calls, etc.)
    const response = await makeProxyRequest(
      upstreamUrl,
      req.method,
      allCookies,
      {
        ...productConfig.customHeaders,
        'accept': req.headers.accept || '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'referer': `https://${productConfig.domain}/`,
        'user-agent': req.headers['user-agent']
      },
      proxy,
      req.body
    );

    // Handle redirects
    if (response.redirectLocation) {
      console.log('↪️  Redirect to:', response.redirectLocation);
      return res.redirect(response.redirectLocation);
    }

    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // Process response (apply domain replacements if text)
    const processedData = processProxyResponse(
      response.data,
      lowerPath,
      contentType,
      productConfig.domain,
      req.get('host'),
      productConfig.replaceRules || []
    );

    return res.status(response.status).type(contentType).send(processedData);

  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    return res.status(500).json({ 
      error: 'Proxy request failed',
      message: error.message 
    });
  }
}

/**
 * Handle media proxy (for CDN files)
 */
export async function handleMediaProxy(req, res, productConfig, mediaDomain) {
  try {
    // Get the full path after /media
    const mediaPath = req.path.replace('/media/', '').replace('/media', '');
    const mediaUrl = `https://${mediaDomain}/${mediaPath}`;

    console.log('🖼️  Media proxy request:', mediaUrl);

    // Validate user session
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    if (!prefix) {
      return res.redirect('/expired');
    }

    // Get premium cookies
    const { cookies } = await getPremiumCookies(prefix, 0, false);

    // Make request to media CDN
    const response = await makeProxyRequest(
      mediaUrl,
      'GET',
      cookies,
      {
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'referer': `https://${productConfig.domain}/`,
        'user-agent': req.headers['user-agent']
      }
    );

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    return res.status(response.status).type(contentType).send(response.data);

  } catch (error) {
    console.error('❌ Media proxy error:', error.message);
    return res.status(500).json({ error: 'Media request failed' });
  }
}