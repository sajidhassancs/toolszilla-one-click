/**
 * Freepik Specific Handlers
 * Handles request proxying for Freepik
 */

import freepikConfig from '../../../../products/freepik.js';
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
import { proxyWithPuppeteer } from './puppeteerProxy.js';
import { getBrowser } from '../../../services/browserService.js';

/**
 * Main Freepik proxy handler using Puppeteer
 * Used for browsing pages (bypasses CloudFlare/bot detection)
 */
export async function proxyFreepikWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, freepikConfig);
}
/**
 * Proxy static.cdnpk.net assets
 */
export async function proxyFreepikStaticCDNPK(req, res) {
  try {
    const assetPath = req.path.replace('/static-cdnpk', '');
    const targetUrl = `https://static.cdnpk.net${assetPath}`;

    console.log('🎨 Proxying static.cdnpk.net asset:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    const contentType = response.headers['content-type'] || '';
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    // Return all files as-is, NO JavaScript rewriting!
    return res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ Error proxying static.cdnpk.net:', error.message);
    return res.status(500).json({ error: 'Failed to proxy static cdnpk asset' });
  }
}

/**
 * Axios-based Freepik proxy - SIMPLE VERSION
 */
export async function proxyFreepikWithAxios(req, res) {
  try {
    console.log('🎨 [AXIOS] Freepik request:', req.method, req.originalUrl);

    // Get user cookies
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    // Build cookie string
    const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

    // Build target URL
    let cleanPath = req.url;
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    const targetUrl = `https://www.freepik.com${cleanPath}`;
    console.log('🎯 Target URL:', targetUrl);

    // Make request
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.freepik.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 30000
    });

    console.log(`✅ Freepik response: ${response.status}`);

    const contentType = response.headers['content-type'] || '';

    // Handle HTML - NO URL REWRITING, just serve it!
    if (contentType.includes('text/html')) {
      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(response.status).send(response.data);
    }

    // Handle other content types
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ Freepik Axios proxy error:', error.message);
    return res.status(500).json({
      error: 'Freepik proxy error',
      message: error.message
    });
  }
}
export async function proxyFreepikStatic(req, res) {
  try {

    console.log('🎨 [STATIC-CDNPK] Request received:', req.url);
    console.log('🎨 [STATIC-CDNPK] Original URL:', req.originalUrl);
    console.log('🎨 [STATIC-CDNPK] Path:', req.path);
    const assetPath = req.path.replace('/static', '');
    const targetUrl = `https://static.freepik.com${assetPath}`;

    console.log('🎨 Proxying Freepik static asset:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik static:', error.message);
    return res.status(500).json({ error: 'Failed to proxy static asset' });
  }
}

/**
 * Proxy Freepik CDN assets
 */
export async function proxyFreepikCDN(req, res) {
  try {
    const assetPath = req.path.replace('/cdn', '');
    const targetUrl = `https://cdn.freepik.com${assetPath}`;

    console.log('🎨 Proxying Freepik CDN asset:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik CDN:', error.message);
    return res.status(500).json({ error: 'Failed to proxy CDN asset' });
  }
}

/**
 * Proxy Freepik CDNB assets
 */
export async function proxyFreepikCDNB(req, res) {
  try {
    const assetPath = req.path.replace('/cdnb', '');
    const targetUrl = `https://cdnb.freepik.com${assetPath}`;

    console.log('🎨 Proxying Freepik CDNB asset:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik CDNB:', error.message);
    return res.status(500).json({ error: 'Failed to proxy CDNB asset' });
  }
}

/**
 * Proxy Freepik img assets (img.freepik.com)
 */
export async function proxyFreepikImg(req, res) {
  try {
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookies:', e.message);
        return res.status(500).json({ error: 'Invalid cookie format' });
      }
    }

    let cookieString;
    if (Array.isArray(cookiesArray)) {
      cookieString = cookiesArray
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
    } else {
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    const imagePath = req.path.replace('/img', '');
    const targetUrl = `https://img.freepik.com${imagePath}`;

    console.log('🖼️  Proxying Freepik image:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.freepik.com/',
        'Accept': 'image/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 10000
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik image:', error.message);
    return res.status(500).send('Image proxy error');
  }
}

/**
 * Proxy Freepik image assets (image.freepik.com)
 */
export async function proxyFreepikImage(req, res) {
  try {
    const userData = await decryptUserCookies(req);

    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookies:', e.message);
        return res.status(500).json({ error: 'Invalid cookie format' });
      }
    }

    let cookieString;
    if (Array.isArray(cookiesArray)) {
      cookieString = cookiesArray
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
    } else {
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    const imagePath = req.path.replace('/image', '');
    const targetUrl = `https://image.freepik.com${imagePath}`;

    console.log('🖼️  Proxying Freepik image:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.freepik.com/',
        'Accept': 'image/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 10000
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik image:', error.message);
    return res.status(500).send('Image proxy error');
  }
}

/**
 * Proxy Freepik assets
 */
export async function proxyFreepikAssets(req, res) {
  try {
    const assetPath = req.path.replace('/assets', '');
    const targetUrl = `https://assets.freepik.com${assetPath}`;

    console.log('🎨 Proxying Freepik assets:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik assets:', error.message);
    return res.status(500).json({ error: 'Failed to proxy asset' });
  }
}

/**
 * Proxy Freepik FPS (Freepik Premium Service)
 */
export async function proxyFreepikFPS(req, res) {
  try {
    const assetPath = req.path.replace('/fps', '');
    const targetUrl = `https://fps.cdnpk.net${assetPath}`;

    console.log('🎨 Proxying Freepik FPS:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik FPS:', error.message);
    return res.status(500).json({ error: 'Failed to proxy FPS asset' });
  }



}
export async function proxyFreepikAPI(req, res) {
  try {
    console.log('🔌 [API] Request:', req.originalUrl);
    console.log('🔌 [API] baseUrl:', req.baseUrl);
    console.log('🔌 [API] url:', req.url);

    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

    // ✅ Use originalUrl and strip /freepik prefix only
    let apiPath = req.originalUrl;
    if (apiPath.startsWith('/freepik/')) {
      apiPath = apiPath.substring(8); // Remove '/freepik'
    }

    const targetUrl = `https://www.freepik.com${apiPath}`;

    console.log('🎯 API Target:', targetUrl);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.freepik.com/',
        'Origin': 'https://www.freepik.com',
        'Cookie': cookieString,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 10000
    });

    console.log('✅ API Response:', response.status);

    // Copy response headers
    Object.keys(response.headers).forEach(key => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.set(key, response.headers[key]);
      }
    });

    res.set('Access-Control-Allow-Origin', '*');

    return res.status(response.status).send(response.data);

  } catch (error) {
    console.error('❌ API error:', error.message);
    return res.status(500).json({ error: 'API error' });
  }
}
/**
 * Proxy Freepik manifest.json (no authentication needed)
 */
export async function proxyFreepikManifest(req, res) {
  try {
    const targetUrl = 'https://www.freepik.com/manifest.json';

    console.log('📄 Proxying Freepik manifest:', targetUrl);

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://www.freepik.com/'
      },
      validateStatus: () => true,
      timeout: 5000
    });

    console.log('✅ Manifest response status:', response.status);

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', 'application/json');

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying manifest:', error.message);
    // Return a minimal valid manifest instead of erroring
    return res.status(200).json({
      name: "Freepik",
      short_name: "Freepik",
      start_url: "/freepik/",
      display: "standalone"
    });
  }
}