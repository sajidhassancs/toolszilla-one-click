/**
 * Proxy Controller - DEBUG VERSION
 * Main proxy logic for handling requests to target websites
 */
import { decryptUserCookies, getPremiumCookies } from '../services/cookieService.js';
import { makeProxyRequest, processProxyResponse } from '../services/proxyService.js';
import { isPathBanned } from '../utils/validators.js';
import { STATIC_FILE_EXTENSIONS } from '../utils/constants.js';

/**
 * Main proxy handler
 */
export async function handleProxyRequest(req, res, productConfig) {
  try {
    console.log('============================================');
    console.log('🔵 NEW REQUEST:', req.method, req.originalUrl);
    console.log('   Host:', req.get('host'));
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
    if (!prefix) {
      console.log('❌ No prefix found, redirecting to /expired');
      return res.redirect('/expired');
    }

    console.log('✅ User validated, prefix:', prefix);

    // Check banned paths
    if (isPathBanned(cleanPath, productConfig.bannedPaths || [])) {
      console.warn('⚠️  Blocked banned path:', cleanPath);
      return res.status(403).send('Access to this page is restricted.');
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
    console.log('📦 Is static file?', isStaticFile, '| Extensions checked:', STATIC_FILE_EXTENSIONS.filter(ext => lowerPath.includes(ext)));

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
        console.log('   Content-Type:', response.headers['content-type']);
        console.log('   Data size:', response.data.length, 'bytes');

        if (response.status !== 200) {
          console.error('❌ Static file failed with status:', response.status);
          return res.status(response.status).send('Resource not found');
        }

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        
        // ✅ ADD CORS HEADERS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        
        // For CSS/JS files, replace domains
        if (contentType.includes('text/css') || contentType.includes('javascript')) {
          console.log('🔧 Processing CSS/JS file, replacing domains...');
          let content = response.data.toString('utf-8');
          
          const originalLength = content.length;
          
          // Replace main domain references
          content = content.replace(
            new RegExp(`https?://${productConfig.domain.replace(/\./g, '\\.')}`, 'g'), 
            `http://${req.get('host')}${productPrefix}`
          );
          content = content.replace(
            new RegExp(`//${productConfig.domain.replace(/\./g, '\\.')}`, 'g'), 
            `//${req.get('host')}${productPrefix}`
          );
          
          console.log('   Replaced', originalLength - content.length, 'chars');
          
          return res.status(200).type(contentType).send(Buffer.from(content, 'utf-8'));
        }
        
        // For binary files (images, fonts, etc.), send as-is
        console.log('📤 Sending binary file as-is');
        return res.status(200).type(contentType).send(response.data);
        
      } catch (error) {
        console.error('❌ ERROR FETCHING STATIC FILE:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
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

    // Process response (apply domain replacements if text)
    const processedData = processProxyResponse(
      response.data,
      lowerPath,
      contentType,
      productConfig.domain,
      `http://${req.get('host')}${productPrefix}`,
      productConfig.replaceRules || []
    );

    // ✅ REWRITE ASSET URLs FOR PRODUCTS WITH assetDomains CONFIG
    if (productConfig.assetDomains && contentType.includes('text/html')) {
      console.log('🔧 Rewriting asset URLs for', productConfig.name);
      let htmlContent = processedData.toString('utf-8');
      
      for (const assetDomain of productConfig.assetDomains) {
        const fromDomain = assetDomain.from;
        const toPath = assetDomain.to;
        
        // Replace https://domain with http://localhost:8224/product/path
        htmlContent = htmlContent.replace(
          new RegExp(`https://${fromDomain.replace(/\./g, '\\.')}`, 'g'),
          `http://${req.get('host')}${productPrefix}${toPath}`
        );
        
        console.log(`   ✅ Rewritten: ${fromDomain} → ${productPrefix}${toPath}`);
      }
      
      return res.status(response.status).type(contentType).send(htmlContent);
    }

    console.log('✅ Sending processed response');
    return res.status(response.status).type(contentType).send(processedData);

  } catch (error) {
    console.error('❌ PROXY ERROR:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
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
    console.error('Stack:', error.stack);
    return res.status(500).send('Media proxy error');
  }
}