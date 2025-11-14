/**
 * Envato Specific Handlers
 * Handles CSRF token extraction, proxy rotation, and download tracking
 */
import axios from 'axios';
import { decryptUserCookies, getPremiumCookies } from '../../../services/cookieService.js';
import { checkDownloadPermission, recordDownloadAction } from '../../../controllers/downloadController.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { parseCookieString, cookiesToString } from '../../../utils/helpers.js';
import { USER_AGENT } from '../../../utils/constants.js';
import envatoConfig from '../../../../products/envato.js';
// ✅ ADD THIS IMPORT
import { proxyWithPuppeteer } from './puppeteerProxy.js';

// ✅ ADD THIS NEW FUNCTION FOR PUPPETEER BROWSING
/**
 * Main Envato proxy handler using Puppeteer (optional)
 * Only use this if Envato starts blocking the Axios proxy
 */
export async function proxyEnvatoWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, envatoConfig);
}

/**
 * Extract CSRF tokens from Envato HTML page
 */
function extractCsrfTokens(htmlContent) {
  const backendCsrfTokenMatch = htmlContent.match(/"backendCsrfToken":\s*"([^"]+)"/);
  const csrfTokenMatch = htmlContent.match(/"csrfToken":\s*"([^"]+)"/);

  if (!backendCsrfTokenMatch || !csrfTokenMatch) {
    return { backendCsrfToken: null, csrfToken: null };
  }

  return {
    backendCsrfToken: backendCsrfTokenMatch[1].trim(),
    csrfToken: csrfTokenMatch[1].trim()
  };
}

// ... rest of your existing functions stay the same ...
// At the top with other functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// In proxyEnvatoAccount, before making the axios request:
await delay(500); // 500ms delay

// In proxyEnvatoApi, before making the axios request:
await delay(500); // 500ms delay
/**
 * Get current cookie/proxy index based on 10-minute rotation
 */
function getCurrentRotationIndex(totalAccounts) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const totalMinutes = currentHour * 60 + currentMinute;
  const intervalIndex = Math.floor(totalMinutes / 10);
  return intervalIndex % totalAccounts;
}

/**
 * Process Envato download with CSRF tokens
 */
export async function processEnvatoDownload(req, res) {
  try {
    console.log('📥 Envato download request');

    // Validate user session
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const userEmail = userData.user_email;
    const prefix = userData.prefix;
    const authToken = userData.auth_token;

    if (!userEmail || !prefix || !authToken) {
      console.log('❌ Missing user data');
      return res.redirect('/expired');
    }

    // Check download limit BEFORE processing
    const limitCheck = await checkDownloadPermission(req, 'envato', userEmail, 'default');

    if (!limitCheck.allowed) {
      console.log(`⚠️  Download limit reached: ${limitCheck.count}/${limitCheck.limit}`);
      return res.redirect('/limit-reached');
    }

    console.log(`✅ Download allowed: ${limitCheck.count}/${limitCheck.limit}`);

    // Get all premium accounts and proxies
    const apiData = await getDataFromApiWithoutVerify(prefix);  // ✅ CHANGED
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    const proxiesArray = apiData.access_configuration_preferences[1]?.proxies || [];

    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No Envato accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    const cookiesStr = accountsArray[currentIndex];

    const proxyAddress = proxiesArray[currentIndex];
// ✅ ADD DEBUG LOGS
console.log('🔍 DEBUG - cookiesStr type:', typeof cookiesStr);
console.log('🔍 DEBUG - cookiesStr length:', cookiesStr?.length);
console.log('🔍 DEBUG - First 200 chars:', cookiesStr?.substring?.(0, 200));
console.log('🔍 DEBUG - Is Array?:', Array.isArray(cookiesStr));
    console.log(`🔄 Using account ${currentIndex + 1}/${accountsArray.length}`);
    console.log(`🌐 Using proxy: ${proxyAddress || 'none'}`);

    // ✅ UPDATED: Parse cookies JSON array
    let cookies;
    try {
      cookies = JSON.parse(cookiesStr);
      console.log(`✅ Parsed ${cookies.length} cookies from JSON`);
    } catch (e) {
      console.error('❌ Failed to parse cookies:', e.message);
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Build upstream URL
    let upstreamUrl = `https://${envatoConfig.domain}${req.originalUrl}`;
    upstreamUrl = upstreamUrl.replace('/envato', '');

    console.log('🎯 Download URL:', upstreamUrl);

    // Try up to 10 times
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt + 1}/10`);

        // Step 1: Get CSRF tokens from homepage
        const homeHeaders = {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': USER_AGENT,
          'Cookie': cookieString
        };

        const axiosConfig = {
          method: 'GET',
          url: `https://${envatoConfig.domain}`,
          headers: homeHeaders,
          validateStatus: () => true
        };

        // Add proxy if available
        if (proxyAddress) {
          const [host, port] = proxyAddress.split(':');
          axiosConfig.proxy = {
            host,
            port: parseInt(port, 10)
          };
        }

        const homeResponse = await axios(axiosConfig);
        const htmlContent = homeResponse.data;

        // Extract CSRF tokens
        const { backendCsrfToken, csrfToken } = extractCsrfTokens(htmlContent);

        if (!backendCsrfToken || !csrfToken) {
          console.log(`❌ Attempt ${attempt + 1}: Failed to extract CSRF tokens`);
          continue;
        }

        console.log(`✅ CSRF tokens extracted`);

        // Step 2: Make download request with CSRF tokens
        const downloadHeaders = {
          'accept': 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'content-type': 'application/json',
          'origin': `https://${envatoConfig.domain}`,
          'referer': `https://${envatoConfig.domain}/account/downloads`,
          'user-agent': USER_AGENT,
          'x-csrf-token': backendCsrfToken,
          'x-csrf-token-2': csrfToken,
          'Cookie': cookieString
        };

        const downloadConfig = {
          method: 'POST',
          url: upstreamUrl,
          data: req.body,
          headers: downloadHeaders,
          responseType: 'arraybuffer',
          validateStatus: () => true
        };

        // Add proxy if available
        if (proxyAddress) {
          const [host, port] = proxyAddress.split(':');
          downloadConfig.proxy = {
            host,
            port: parseInt(port, 10)
          };
        }

        const downloadResponse = await axios(downloadConfig);

        // Check if response contains download URL
        const responseContent = Buffer.from(downloadResponse.data).toString('utf-8');

        if (responseContent.includes('downloadUrl')) {
          console.log('✅ Download successful!');

          // Record the download
          await recordDownloadAction(req, 'envato', userEmail, 'file_download');

          // Return response
          const contentType = downloadResponse.headers['content-type'] || 'application/json';
          return res.status(downloadResponse.status).type(contentType).send(downloadResponse.data);
        } else {
          console.log(`⚠️  Attempt ${attempt + 1}: No download URL in response`);
        }

      } catch (error) {
        console.log(`❌ Attempt ${attempt + 1} failed: ${error.message}`);
        continue;
      }
    }

    // All attempts failed
    console.error('❌ All download attempts failed');
    return res.status(500).json({ 
      error: 'Download failed after multiple attempts' 
    });

  } catch (error) {
    console.error('❌ Error in Envato download:', error.message);
    return res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
}

/**
 * Proxy Envato assets (SVGs, fonts, etc.)
 */
export async function proxyEnvatoAssets(req, res) {
  try {
    const assetPath = req.path.replace('/assets', '');
    const targetUrl = `https://assets.elements.envato.com${assetPath}`;
    
    console.log('🎨 Proxying Envato asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': req.headers.accept || '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://elements.envato.com',
        'Referer': 'https://elements.envato.com/'
      },
      validateStatus: () => true
    });
    
    // ✅ CRITICAL: Set CORS headers FIRST
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    // Copy content type
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Envato asset:', error.message);
    return res.status(500).json({ error: 'Failed to proxy asset' });
  }
}
/**
 * Proxy Envato images
 */
export async function proxyEnvatoImages(req, res) {
  try {
    // Get user cookies
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    
    // Get premium cookies
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    
    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    const cookiesStr = accountsArray[currentIndex];
    
    // Parse cookies JSON array
    let cookies;
    try {
      cookies = JSON.parse(cookiesStr);
    } catch (e) {
      console.error('❌ Failed to parse cookies:', e.message);
      return res.status(500).json({ error: 'Invalid cookie format' });
    }
    
    // Convert cookie objects to cookie string
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Get the full path after /envato/images
    let imagePath = req.originalUrl.replace('/envato/images', '');
    
    // If imagePath is empty or just '/', use req.path
    if (!imagePath || imagePath === '/') {
      imagePath = req.path.replace('/images', '');
    }
    
    console.log('🖼️  Image request - Original URL:', req.originalUrl);
    console.log('🖼️  Image request - Extracted path:', imagePath);
    
    // Determine the correct domain
    let targetDomain;
    if (imagePath.includes('envato-shoebox') || imagePath.includes('envato-dam')) {
      targetDomain = 'envato-shoebox.imgix.net';
    } else if (imagePath.includes('elements-resized')) {
      targetDomain = 'elements-resized.envatousercontent.com';
    } else {
      // Default to elements-resized
      targetDomain = 'elements-resized.envatousercontent.com';
    }
    
    const targetUrl = `https://${targetDomain}${imagePath}`;
    
    console.log('🖼️  Proxying Envato image:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://elements.envato.com/',
        'Accept': 'image/*',
        'Cookie': cookieString  // ✅ ADD COOKIES!
      },
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('✅ Image response status:', response.status);
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Envato image:', error.message);
    return res.status(500).send('Image proxy error');
  }
}

/**
 * Proxy Envato account API requests
 */
/**
 * Proxy Envato account API requests
 */
export async function proxyEnvatoAccount(req, res) {
  try {
    // Get user cookies
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const authToken = userData.auth_token;
    const prefix = userData.prefix;
    
    // Get premium cookies
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    
    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    const cookiesStr = accountsArray[currentIndex];
    
    // Parse cookies JSON array
    let cookies;
    try {
      cookies = JSON.parse(cookiesStr);
      console.log(`✅ Parsed ${cookies.length} cookies from JSON`);
    } catch (e) {
      console.error('❌ Failed to parse cookies:', e.message);
      return res.status(500).json({ error: 'Invalid cookie format' });
    }
    
    // Convert cookie objects to cookie string
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    console.log('🍪 Cookie string created with', cookies.length, 'cookies');

    // Remove /account prefix and build target URL
    const cleanPath = req.path.replace(/^\/account/, '');
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetUrl = `https://account.envato.com${cleanPath}${queryString}`;
    
    console.log('🔑 Proxying account request:', targetUrl);
    console.log('🔑 Method:', req.method);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'accept': req.headers.accept || 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': req.headers['content-type'] || 'application/json',
        'origin': 'https://elements.envato.com',
        'referer': 'https://elements.envato.com/',
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer'
    });
    
    console.log(`✅ Account API response: ${response.status}`);
    
    // ✅ Handle 429 - just return empty success response
    if (response.status === 429) {
      console.log('⚠️  Rate limited - returning empty response');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Content-Type', 'application/json');
      return res.status(200).json({ success: true });
    }
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    
    // Copy content type
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying account request:', error.message);
    return res.status(500).json({ 
      error: 'Account proxy error',
      message: error.message 
    });
  }
}

export async function proxyEnvatoApi(req, res, apiType) {
  try {
    // Get user cookies
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const authToken = userData.auth_token;
    const prefix = userData.prefix;
    
    // Get premium cookies
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    
    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    const cookiesStr = accountsArray[currentIndex];
    
    // Parse cookies JSON array
    let cookies;
    try {
      cookies = JSON.parse(cookiesStr);
      console.log(`✅ Parsed ${cookies.length} cookies from JSON`);
    } catch (e) {
      console.error('❌ Failed to parse cookies:', e.message);
      return res.status(500).json({ error: 'Invalid cookie format' });
    }
    
    // Convert cookie objects to cookie string
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

// Build target URL - preserve the API type in the path
const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
const targetUrl = `https://elements.envato.com/${apiType}${req.path}${queryString}`;

console.log(`🎯 Proxying ${apiType} request:`, targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'accept': req.headers.accept || 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': req.headers['content-type'] || 'application/json',
        'origin': 'https://elements.envato.com',
        'referer': 'https://elements.envato.com/',
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true
    });
    
    console.log(`✅ ${apiType} response: ${response.status}`);
    
    // ✅ Handle 404 and 429 gracefully
    if (response.status === 404 || response.status === 429) {
      console.log(`⚠️  Status ${response.status} - returning empty response`);
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Content-Type', 'application/json');
      return res.status(200).json({ data: [] });
    }
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    
    // Copy content type
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    // ✅ SINGLE RETURN STATEMENT
    return res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error(`❌ Error proxying ${apiType}:`, error.message);
    return res.status(500).json({ 
      error: `${apiType} proxy error`,
      message: error.message 
    });
  }
}