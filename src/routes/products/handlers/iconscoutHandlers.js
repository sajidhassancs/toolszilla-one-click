/**
 * Iconscout Specific Handlers
 * Handles request proxying for Iconscout
 */
 
import iconscoutConfig from '../../../../products/iconscout.js';
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';

 import { proxyIconscoutWithAxios } from './iconscoutAxiosProxy.js';
export async function proxyIconscoutWithPuppeteer(req, res) {
  return await proxyIconscoutWithAxios(req, res);
}
export async function proxyIconscoutAPI(req, res) {
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

    // Remove /iconscout prefix from the URL
    const apiPath = req.originalUrl
      .replace('/iconscout/strapi', '')
      .replace('/iconscout/api-domain', '')
      .replace('/iconscout/api', '')
      .replace('/iconscout', '');
    
    // Determine the target domain
    let targetUrl;
    if (req.originalUrl.includes('/strapi')) {
      targetUrl = `https://iconscout.com/strapi${apiPath}`;
    } else if (req.originalUrl.includes('/api-domain')) {
      targetUrl = `https://api.iconscout.com${apiPath}`;
    } else {
      targetUrl = `https://iconscout.com${apiPath}`;
    }
    
    console.log('🔌 Proxying Iconscout API:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || 'application/json',
        'Referer': 'https://iconscout.com/',
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
    console.error('❌ Error proxying Iconscout API:', error.message);
    return res.status(500).json({ error: 'API proxy error' });
  }
}
export async function proxyIconscoutCDN(req, res) {
  try {
    const userData = await decryptUserCookies(req);
    let cookieString = '';
    
    if (!userData.redirect) {
      try {
        const prefix = userData.prefix;
        const apiData = await getDataFromApiWithoutVerify(prefix);
        let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
        
        if (typeof cookiesArray === 'string') {
          cookiesArray = JSON.parse(cookiesArray);
        }
        
        cookieString = cookiesArray
          .map(cookie => `${cookie.name}=${cookie.value}`)
          .join('; ');
      } catch (e) {
        console.log('⚠️ Could not get cookies for CDN');
      }
    }
    
    // ✅ Updated to handle /image prefix
    let cdnDomain;
    if (req.originalUrl.includes('/cdna')) {
      cdnDomain = 'cdna.iconscout.com';
    } else if (req.originalUrl.includes('/cdn3d')) {
      cdnDomain = 'cdn3d.iconscout.com';
    } else {
      cdnDomain = 'cdn.iconscout.com';
    }
    
    // ✅ Updated to remove /image prefix
    let assetPath = req.originalUrl
      .replace('/iconscout/image/cdna', '')
      .replace('/iconscout/image/cdn3d', '')
      .replace('/iconscout/image/cdn', '')
      .replace('/iconscout/cdna', '')    // Fallback for old URLs
      .replace('/iconscout/cdn3d', '')   // Fallback for old URLs
      .replace('/iconscout/cdn', '');     // Fallback for old URLs
    
    const targetUrl = `https://${cdnDomain}${assetPath}`;
    
    console.log('🎨 Proxying CDN asset:', targetUrl);
    
    // ✅ CRITICAL: Use proper referer from the request
    const referer = req.headers.referer || 'https://iconscout.com/3d-icons';
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': referer,  // ✅ Pass the actual page referer
        'Origin': 'https://iconscout.com',
        'Cookie': cookieString,
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site'
      },
      validateStatus: () => true,
      timeout: 15000,
      maxRedirects: 5
    });
    
    console.log('✅ CDN response:', response.status);
    
    if (response.status === 403 || response.status === 404) {
      console.log('⚠️ CDN blocked:', response.status);
      // Return 1x1 transparent pixel instead of empty
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.status(200).send(transparentPixel);
    }
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying CDN:', error.message);
    // Return transparent pixel on error
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    return res.status(200).send(transparentPixel);
  }
}
/**
 * Proxy Iconscout assets
 */
/**
 * Proxy Iconscout assets (assets.iconscout.com)
 */
export async function proxyIconscoutAssets(req, res) {
  try {
    // Get user cookies for authentication
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    if (!prefix) {
      return res.status(403).send('Unauthorized');
    }

    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      try {
        cookiesArray = JSON.parse(cookiesArray);
      } catch (e) {
        console.error('❌ Failed to parse cookies:', e.message);
        return res.status(403).send('Invalid cookie format');
      }
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // ✅ Updated to handle /image prefix
    const assetPath = req.originalUrl
      .replace('/iconscout/image/assets', '')
      .replace('/iconscout/assets', '');  // Fallback for old URLs
    
    const targetUrl = `https://assets.iconscout.com${assetPath}`;
    
    console.log('🎨 Proxying Iconscout assets:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('✅ Assets response:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Iconscout assets:', error.message);
    return res.status(500).json({ error: 'Failed to proxy asset' });
  }
}