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
/**
 * Proxy Iconscout CDN assets (cdna, cdn3d, cdn)
 */
export async function proxyIconscoutCDN(req, res) {
  try {
    // ✅ GET AUTHENTICATION COOKIES
    const userData = await decryptUserCookies(req);
    let cookieString = '';
    
    // If user is authenticated, get their cookies
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
        console.log('⚠️ Could not get cookies for CDN, trying without auth');
      }
    }
    
    // Determine which CDN based on the route
    let cdnDomain;
    if (req.originalUrl.includes('/cdna')) {
      cdnDomain = 'cdna.iconscout.com';
    } else if (req.originalUrl.includes('/cdn3d')) {
      cdnDomain = 'cdn3d.iconscout.com';
    } else {
      cdnDomain = 'cdn.iconscout.com';
    }
    
    // Get the asset path
    let assetPath = req.originalUrl
      .replace('/iconscout/cdna', '')
      .replace('/iconscout/cdn3d', '')
      .replace('/iconscout/cdn', '');
    
    const targetUrl = `https://${cdnDomain}${assetPath}`;
    
    console.log('🎨 Proxying CDN asset:', targetUrl);
    
    // ✅ Make request WITH cookies
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://iconscout.com/',
        'Origin': 'https://iconscout.com',
        'Cookie': cookieString, // ✅ Include authentication cookies
      },
      validateStatus: () => true,
      timeout: 15000,
      maxRedirects: 5
    });
    
    console.log('✅ CDN response:', response.status);
    
    // ✅ Handle 403/404 gracefully
    if (response.status === 403 || response.status === 404) {
      console.log('⚠️ CDN blocked or not found, returning empty');
      return res.status(200).send('');
    }
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying CDN:', error.message);
    // Return empty instead of error to prevent page breaking
    return res.status(200).send('');
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

    // Get the asset path
    const assetPath = req.originalUrl.replace('/iconscout/assets', '');
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