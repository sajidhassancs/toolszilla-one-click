/**
 * Epidemic Sound Specific Handlers
 * Handles cookie rotation and request proxying
 */
 
import epidemicsoundConfig from '../../../../products/epidemicsound.js';
 


import axios from 'axios';
import { decryptUserCookies    } from '../../../services/cookieService.js';
import {   getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
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

/**
 * Main Epidemic Sound proxy handler using Puppeteer
 * Used for browsing pages (bypasses CloudFlare/bot detection)
 */
export async function proxyEpidemicsoundWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, epidemicsoundConfig);
}

/**
 * Main Epidemic Sound proxy handler (Axios-based)
 * Keep this for API calls or as fallback
 */
export async function proxyEpidemicsound(req, res) {
  try {
    console.log('🎵 Epidemic Sound request:', req.method, req.originalUrl);

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
      return res.status(500).json({ error: 'No Epidemic Sound accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];
    
    console.log(`🔄 Using Epidemic Sound account ${currentIndex + 1}/${accountsArray.length}`);
    
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

    // Build target URL - remove /epidemicsound prefix
    let targetUrl = `https://${epidemicsoundConfig.domain}${req.originalUrl}`;
    targetUrl = targetUrl.replace('/epidemicsound', '');
    
    console.log('🎯 Target URL:', targetUrl);
    
    // Make request to Epidemic Sound
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...epidemicsoundConfig.customHeaders,
        'referer': `https://${epidemicsoundConfig.domain}/`,
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer'
    });
    
    console.log(`✅ Epidemic Sound response: ${response.status}`);
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    
    // Copy content type
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    // Handle HTML responses - rewrite URLs
    if (response.headers['content-type']?.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      console.log('🔧 Rewriting asset URLs for epidemicsound');
      
      // Rewrite asset paths to go through /epidemicsound proxy
      html = html.replace(/href="\//g, 'href="/epidemicsound/');
      html = html.replace(/src="\//g, 'src="/epidemicsound/');
      html = html.replace(/srcset="\//g, 'srcset="/epidemicsound/');
      
      // Rewrite URLs in CSS
      html = html.replace(/url\(\//g, 'url(/epidemicsound/');
      html = html.replace(/url\("\//g, 'url("/epidemicsound/');
      html = html.replace(/url\('\//g, 'url(\'/epidemicsound/');
      
      // Apply domain replacement rules from config
      epidemicsoundConfig.replaceRules.forEach(([find, replace]) => {
        const regex = new RegExp(find, 'g');
        html = html.replace(regex, replace);
      });
      
      // Fix double slashes that might have been created
      html = html.replace(/\/epidemicsound\/epidemicsound\//g, '/epidemicsound/');
      
      console.log('   ✅ Rewritten URLs to route through /epidemicsound');
      
      return res.status(response.status).send(html);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Epidemic Sound:', error.message);
    return res.status(500).json({ 
      error: 'Epidemic Sound proxy error',
      message: error.message 
    });
  }
}

/**
 * Proxy Epidemic Sound static assets
 */
export async function proxyEpidemicsoundStatic(req, res) {
  try {
    const assetPath = req.path.replace('/static', '');
    const targetUrl = `https://static.epidemicsound.com${assetPath}`;
    
    console.log('🎨 Proxying Epidemic Sound static asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
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
    console.error('❌ Error proxying Epidemic Sound static:', error.message);
    return res.status(500).json({ error: 'Failed to proxy static asset' });
  }
}

/**
 * Proxy Epidemic Sound CDN assets
 */
export async function proxyEpidemicsoundCDN(req, res) {
  try {
    const assetPath = req.path.replace('/cdn', '');
    const targetUrl = `https://cdn.epidemicsound.com${assetPath}`;
    
    console.log('🎨 Proxying Epidemic Sound CDN asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
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
    console.error('❌ Error proxying Epidemic Sound CDN:', error.message);
    return res.status(500).json({ error: 'Failed to proxy CDN asset' });
  }
}

/**
 * Proxy Epidemic Sound assets
 */
export async function proxyEpidemicsoundAssets(req, res) {
  try {
    const assetPath = req.path.replace('/assets', '');
    const targetUrl = `https://assets.epidemicsound.com${assetPath}`;
    
    console.log('🎨 Proxying Epidemic Sound assets:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
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
    console.error('❌ Error proxying Epidemic Sound assets:', error.message);
    return res.status(500).json({ error: 'Failed to proxy asset' });
  }
}

/**
 * Proxy Epidemic Sound images
 */
export async function proxyEpidemicsoundImages(req, res) {
  try {
    // Get user cookies for image requests
    const userData = await decryptUserCookies(req);
    
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
      console.log('⚠️  Image cookies stored as string, parsing...');
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
      console.log(`✅ Built image cookie string (${cookiesArray.length} cookies)`);
    } else {
      console.error('❌ Invalid cookie format for images');
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    const imagePath = req.path.replace('/images', '');
    const targetUrl = `https://images.epidemicsound.com${imagePath}`;
    
    console.log('🖼️  Proxying Epidemic Sound image:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.epidemicsound.com/',
        'Accept': 'image/*',
        'Cookie': cookieString
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
    console.error('❌ Error proxying Epidemic Sound image:', error.message);
    return res.status(500).send('Image proxy error');
  }
}

/**
 * Proxy Epidemic Sound media (audio files)
 */
export async function proxyEpidemicsoundMedia(req, res) {
  try {
    // Get user cookies for media requests
    const userData = await decryptUserCookies(req);
    
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
      console.log('⚠️  Media cookies stored as string, parsing...');
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
      console.log(`✅ Built media cookie string (${cookiesArray.length} cookies)`);
    } else {
      console.error('❌ Invalid cookie format for media');
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    const mediaPath = req.path.replace('/media', '');
    const targetUrl = `https://media.epidemicsound.com${mediaPath}`;
    
    console.log('🎵 Proxying Epidemic Sound media:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.epidemicsound.com/',
        'Accept': 'audio/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 30000 // Longer timeout for audio files
    });
    
    console.log('✅ Media response status:', response.status);
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Epidemic Sound media:', error.message);
    return res.status(500).send('Media proxy error');
  }
}