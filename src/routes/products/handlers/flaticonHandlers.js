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

export async function processFlatIconIconDownload(req, res) {
  try {
    console.log('🖼️  Flaticon icon download request');

    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    if (!prefix) {
      console.log('❌ Missing prefix');
      return res.redirect('/expired');
    }

    const format = req.query.format || 'png';
    const iconId = req.query.icon_id || req.path.split('/').pop();

    console.log(`📥 Downloading icon: ${iconId}.${format}`);

    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const proxyAddress = apiData.access_configuration_preferences[1]?.proxies?.[0];

    let cookieString;
    if (Array.isArray(cookiesArray)) {
      cookieString = cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    } else if (typeof cookiesArray === 'string') {
      const cookies = parseCookieString(cookiesArray);
      cookieString = cookiesToString(cookies);
    } else {
      throw new Error('Invalid cookie format');
    }

    let cleanPath = req.originalUrl;
    if (cleanPath.startsWith(`/${flaticonConfig.name}`)) {
      cleanPath = cleanPath.substring(flaticonConfig.name.length + 1);
    }

    const upstreamUrl = `https://${flaticonConfig.domain}${cleanPath}`;
    console.log('🎯 Icon download URL:', upstreamUrl);

    // ✅ ENHANCED HEADERS - More browser-like
    const flaticonHeaders = {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': `https://${flaticonConfig.domain}/free-icons/`,  // ✅ Better referer
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': USER_AGENT,
      'Cookie': cookieString
    };

    const axiosConfig = {
      method: 'GET',
      url: upstreamUrl,
      headers: flaticonHeaders,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 5,  // ✅ Follow redirects
      timeout: 30000     // ✅ Longer timeout
    };

    if (proxyAddress) {
      const [host, port] = proxyAddress.split(':');
      axiosConfig.proxy = { host, port: parseInt(port, 10) };
    }

    const response = await axios(axiosConfig);

    console.log('✅ Icon download response status:', response.status);

    if (response.status === 403) {
      console.error('❌ 403 Forbidden - Cookies may be invalid or expired');
      console.error('   Try refreshing your Flaticon premium cookies');
      return res.status(403).send('Download forbidden - please refresh your premium cookies');
    }

    if (response.status === 404) {
      return res.status(404).send('Icon not found');
    }

    if (response.status !== 200) {
      return res.status(response.status).send('Download failed');
    }

    const filename = `flaticon_${iconId}.${format}`;
    const contentType = response.headers['content-type'] || `image/${format}`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', response.data.byteLength || response.data.length);
    
    return res.status(200).send(response.data);

  } catch (error) {
    console.error('❌ Error in Flaticon icon download:', error.message);
    return res.status(500).json({ 
      error: 'Icon download failed',
      message: error.message 
    });
  }
}