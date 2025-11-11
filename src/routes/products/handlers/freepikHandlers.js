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

/**
 * Main Freepik proxy handler using Puppeteer
 * Used for browsing pages (bypasses CloudFlare/bot detection)
 */
export async function proxyFreepikWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, freepikConfig);
}

/**
 * Proxy Freepik static assets
 */
export async function proxyFreepikStatic(req, res) {
  try {
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


/**
 * Proxy Freepik API calls
 */
export async function proxyFreepikAPI(req, res) {
  try {
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.status(403).json({ error: 'Unauthorized' });
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

    // Remove /freepik prefix from the URL
    const apiPath = req.originalUrl.replace('/freepik', '');
    const targetUrl = `https://www.freepik.com${apiPath}`;
    
    console.log('🔌 Proxying Freepik API:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || 'application/json',
        'Referer': 'https://www.freepik.com/',
        'Cookie': cookieString,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('✅ API response status:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Freepik API:', error.message);
    return res.status(500).json({ error: 'API proxy error' });
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