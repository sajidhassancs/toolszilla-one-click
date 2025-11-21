/**
 * Vecteezy Specific Handlers
 * Handles cookie rotation and request proxying
 */
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import vecteezyConfig from '../../../../products/vecteezy.js';
// ✅ ADD THIS IMPORT
import { proxyWithPuppeteer } from './puppeteerProxy.js';

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

// ✅ ADD THIS NEW FUNCTION FOR PUPPETEER BROWSING
/**
 * Main Vecteezy proxy handler using Puppeteer
 * Used for browsing pages (bypasses CloudFlare/bot detection)
 */
export async function proxyVecteezyWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, vecteezyConfig);
}

/**
 * Main Vecteezy proxy handler (Axios-based)
 * Keep this for API calls or as fallback
 */
export async function proxyVecteezy(req, res) {
  try {
    console.log('🟣 Vecteezy request:', req.method, req.originalUrl);

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
      return res.status(500).json({ error: 'No Vecteezy accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];

    console.log(`🔄 Using Vecteezy account ${currentIndex + 1}/${accountsArray.length}`);

    // Handle both string and array formats
    if (typeof cookiesArray === 'string') {
      console.log('⚠️  Cookies stored as string, parsing...');
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookie string:', e.message);
        return res.status(500).json({ error: 'Invalid cookie format' });
      }
    }

    console.log('🍪 Cookies type:', Array.isArray(cookiesArray) ? 'Array' : typeof cookiesArray);

    // Convert cookie objects to cookie string
    let cookieString;
    if (Array.isArray(cookiesArray)) {
      cookieString = cookiesArray
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
      console.log(`✅ Built cookie string from array (${cookiesArray.length} cookies)`);
    } else {
      console.error('❌ Invalid cookie format after parsing');
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    // Build target URL - remove /vecteezy prefix
    let targetUrl = `https://${vecteezyConfig.domain}${req.originalUrl}`;
    targetUrl = targetUrl.replace('/vecteezy', '');

    console.log('🎯 Target URL:', targetUrl);

    // Make request to Vecteezy
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...vecteezyConfig.customHeaders,
        'referer': `https://${vecteezyConfig.domain}/`,
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer'
    });

    console.log(`✅ Vecteezy response: ${response.status}`);

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');

    // Copy content type
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    // Handle HTML responses - rewrite URLs
    if (response.headers['content-type']?.includes('text/html')) {
      let html = response.data.toString('utf-8');

      console.log('🔧 Rewriting asset URLs for vecteezy');

      // Rewrite asset paths to go through /vecteezy proxy
      html = html.replace(/href="\//g, 'href="/vecteezy/');
      html = html.replace(/src="\//g, 'src="/vecteezy/');
      html = html.replace(/srcset="\//g, 'srcset="/vecteezy/');

      // Rewrite URLs in CSS
      html = html.replace(/url\(\//g, 'url(/vecteezy/');
      html = html.replace(/url\("\//g, 'url("/vecteezy/');
      html = html.replace(/url\('\//g, 'url(\'/vecteezy/');

      // Apply domain replacement rules from config
      vecteezyConfig.replaceRules.forEach(([find, replace]) => {
        const regex = new RegExp(find, 'g');
        html = html.replace(regex, replace);
      });

      // Fix double slashes that might have been created
      html = html.replace(/\/vecteezy\/vecteezy\//g, '/vecteezy/');

      console.log('   ✅ Rewritten URLs to route through /vecteezy');

      return res.status(response.status).send(html);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Vecteezy:', error.message);
    return res.status(500).json({
      error: 'Vecteezy proxy error',
      message: error.message
    });
  }
}

/**
 * Proxy Vecteezy static assets
 */
export async function proxyVecteezyStatic(req, res) {
  try {
    const assetPath = req.path.replace('/static', '');
    const targetUrl = `https://static.vecteezy.com${assetPath}`;

    console.log('🎨 Proxying Vecteezy static asset:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.vecteezy.com/'
      },
      validateStatus: () => true
    });

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Vecteezy static:', error.message);
    return res.status(500).json({ error: 'Failed to proxy static asset' });
  }
}

/**
 * Proxy Vecteezy CDN assets
 */
export async function proxyVecteezyCDN(req, res) {
  try {
    const assetPath = req.path.replace('/cdn', '');
    const targetUrl = `https://cdn.vecteezy.com${assetPath}`;

    console.log('🎨 Proxying Vecteezy CDN asset:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.vecteezy.com/'
      },
      validateStatus: () => true
    });

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Vecteezy CDN:', error.message);
    return res.status(500).json({ error: 'Failed to proxy CDN asset' });
  }
}

/**
 * ✅ OPTIMIZED: Proxy Vecteezy images (uses NoSessionCheck for speed)
 */
export async function proxyVecteezyImages(req, res) {
  try {
    // ✅ USE NO SESSION CHECK VERSION - Much faster for images!
    const userData = await decryptUserCookiesNoSessionCheck(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;

    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No accounts available' });
    }

    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];

    // Handle both string and array formats
    if (typeof cookiesArray === 'string') {
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookie string:', e.message);
        return res.status(500).json({ error: 'Invalid cookie format' });
      }
    }

    // Convert cookie objects to cookie string
    let cookieString;
    if (Array.isArray(cookiesArray)) {
      cookieString = cookiesArray
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
    } else {
      console.error('❌ Invalid cookie format for images');
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    const imagePath = req.path.replace('/images', '');
    const targetUrl = `https://images.vecteezy.com${imagePath}`;

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.vecteezy.com/',
        'Accept': 'image/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 10000
    });

    // Set CORS and cache headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Vecteezy image:', error.message);
    return res.status(500).send('Image proxy error');
  }
}