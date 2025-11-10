/**
 * Flaticon Specific Handlers
 * Handles pack downloads and icon downloads
 */
import axios from 'axios';
import { decryptUserCookies, getPremiumCookies } from '../../../services/cookieService.js';
import { checkDownloadPermission, recordDownloadAction } from '../../../controllers/downloadController.js';
import { getDataFromApi, getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { parseCookieString, cookiesToString } from '../../../utils/helpers.js';
import { USER_AGENT } from '../../../utils/constants.js';
import flaticonConfig from '../../../../products/flaticon.js';
// ✅ ADD THIS IMPORT
import { proxyWithPuppeteer } from './puppeteerProxy.js';

// ✅ ADD THIS NEW FUNCTION FOR BROWSING
/**
 * Main Flaticon proxy handler using Puppeteer
 * Used for browsing pages (not downloads)
 */
export async function proxyFlaticonWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, flaticonConfig);
}
export async function processFlatIconPackDownload(req, res) {
  try {
    console.log('📦 Flaticon pack download request');

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
    const limitCheck = await checkDownloadPermission(req, 'flaticon', userEmail, 'default');

    if (!limitCheck.allowed) {
      console.log(`⚠️  Download limit reached: ${limitCheck.count}/${limitCheck.limit}`);
      return res.redirect('/limit-reached');
    }

    console.log(`✅ Download allowed: ${limitCheck.count}/${limitCheck.limit}`);

    // Get premium cookies from API
    const apiData = await getDataFromApi(authToken, prefix);

    const cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    const proxyAddress = apiData.access_configuration_preferences[1]?.proxies?.[0];

    // Parse cookies
    const cookies = parseCookieString(cookiesArray);

    // Setup headers for Flaticon API
    const flaticonHeaders = {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'cache-control': 'max-age=0',
      'content-type': 'application/x-www-form-urlencoded',
      'origin': `https://${flaticonConfig.domain}`,
      'referer': `https://${flaticonConfig.domain}/`,
      'user-agent': USER_AGENT,
      'Cookie': cookiesToString(cookies)
    };

    // Build upstream URL
    let upstreamUrl = `https://${flaticonConfig.domain}${req.originalUrl}`;

    console.log('🎯 Pack download URL:', upstreamUrl);

    // Make request to Flaticon download-pack endpoint
    const axiosConfig = {
      method: 'POST',
      url: upstreamUrl,
      data: req.body,
      headers: flaticonHeaders,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    };

    // Add proxy if available
    if (proxyAddress) {
      const [host, port] = proxyAddress.split(':');
      axiosConfig.proxy = {
        host,
        port: parseInt(port, 10)
      };
    }

    try {
      const response = await axios(axiosConfig);

      console.log('📥 Pack download response status:', response.status);

      // Check for 302 redirect (success)
      if (response.status === 302) {
        console.log('✅ Pack download successful (302 redirect)');

        // Record the download
        await recordDownloadAction(req, 'flaticon', userEmail, 'pack_download');

        // Get redirect location
        const redirectLocation = response.headers['location'];
        if (redirectLocation) {
          return res.redirect(redirectLocation);
        }
      }

      // Return response as-is
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      return res.status(response.status).type(contentType).send(response.data);

    } catch (error) {
      // Handle axios redirect error (302/301)
      if (error.response && (error.response.status === 302 || error.response.status === 301)) {
        console.log('✅ Pack download successful (redirect caught in error)');

        // Record the download
        await recordDownloadAction(req, 'flaticon', userEmail, 'pack_download');

        const redirectLocation = error.response.headers['location'];
        if (redirectLocation) {
          return res.redirect(redirectLocation);
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('❌ Error in Flaticon pack download:', error.message);
    return res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
}

/**
 * Process individual icon download
 */
/**
 * Process individual icon download
 */
export async function processFlatIconIconDownload(req, res) {
  try {
    console.log('🖼️  Flaticon icon download request');

    // Validate user session
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;

    if (!prefix) {
      console.log('❌ Missing prefix');
      return res.redirect('/expired');
    }

    // Extract format and icon_id from URL
    const format = req.query.format || 'png';
    const iconId = req.query.icon_id || req.path.split('/').pop();

    console.log(`📥 Downloading icon: ${iconId}.${format}`);

    // Get premium cookies WITHOUT verification
    const apiData = await getDataFromApiWithoutVerify(prefix);

    // Handle both string and array formats
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      console.log('⚠️  Cookies stored as string, parsing...');
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    console.log('🍪 Cookies type:', Array.isArray(cookiesArray) ? 'Array' : typeof cookiesArray);
    
    const proxyAddress = apiData.access_configuration_preferences[1]?.proxies?.[0];

    // Convert cookie objects to cookie string format
    let cookieString;
    
    if (Array.isArray(cookiesArray)) {
      cookieString = cookiesArray
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
      console.log('✅ Built cookie string from array');
    } else if (typeof cookiesArray === 'string') {
      const cookies = parseCookieString(cookiesArray);
      cookieString = cookiesToString(cookies);
      console.log('✅ Used parseCookieString');
    } else {
      throw new Error('Invalid cookie format');
    }

    // ✅ FIX: Remove /flaticon prefix from URL
    let cleanPath = req.originalUrl;
    const productPrefix = `/${flaticonConfig.name}`;
    
    if (cleanPath.startsWith(productPrefix)) {
      cleanPath = cleanPath.substring(productPrefix.length);
    }
    
    console.log('🔧 Original URL:', req.originalUrl);
    console.log('🔧 Clean path:', cleanPath);

    // Build upstream URL with clean path
    let upstreamUrl = `https://${flaticonConfig.domain}${cleanPath}`;

    console.log('🎯 Icon download URL:', upstreamUrl);

    // Setup headers
    const flaticonHeaders = {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'referer': `https://${flaticonConfig.domain}/`,
      'user-agent': USER_AGENT,
      'Cookie': cookieString
    };

    // Make request
    const axiosConfig = {
      method: 'GET',
      url: upstreamUrl,
      headers: flaticonHeaders,
      responseType: 'arraybuffer',
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

    const response = await axios(axiosConfig);

    console.log('✅ Icon download response status:', response.status);
    console.log('📦 Response headers:', response.headers);

    if (response.status === 404) {
      console.error('❌ Icon not found on Flaticon');
      return res.status(404).send('Icon not found');
    }

    // Determine filename
    const filename = `flaticon_${iconId}.${format}`;

    // Add Content-Disposition header for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Return the icon file
    const contentType = response.headers['content-type'] || `image/${format}`;
    return res.status(response.status).type(contentType).send(Buffer.from(response.data));

  } catch (error) {
    console.error('❌ Error in Flaticon icon download:', error.message);
    console.error('   Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Icon download failed',
      message: error.message 
    });
  }
}