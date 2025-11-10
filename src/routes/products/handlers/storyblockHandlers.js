/**
 * Storyblocks Specific Handlers
 * Handles cookie rotation and request proxying
 */
import axios from 'axios';
import { decryptUserCookies } from '../../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../../services/apiService.js';
import { USER_AGENT } from '../../../../utils/constants.js';
import storyblocksConfig from '../../../../products/storyblocks.js';
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
 * Main Storyblocks proxy handler using Puppeteer
 * Used for browsing pages (bypasses CloudFlare/bot detection)
 */
export async function proxyStoryblocksWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, storyblocksConfig);
}

/**
 * Main Storyblocks proxy handler (Axios-based)
 * Keep this for API calls or as fallback
 */
export async function proxyStoryblocks(req, res) {
  try {
    console.log('🟦 Storyblocks request:', req.method, req.originalUrl);

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
      return res.status(500).json({ error: 'No Storyblocks accounts available' });
    }

    // Get current rotation index
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];
    
    console.log(`🔄 Using Storyblocks account ${currentIndex + 1}/${accountsArray.length}`);
    
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

    // Build target URL - remove /storyblocks prefix
    let targetUrl = `https://${storyblocksConfig.domain}${req.originalUrl}`;
    targetUrl = targetUrl.replace('/storyblocks', '');
    
    console.log('🎯 Target URL:', targetUrl);
    
    // Make request to Storyblocks
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...storyblocksConfig.customHeaders,
        'referer': `https://${storyblocksConfig.domain}/`,
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      data: req.body,
      validateStatus: () => true,
      responseType: 'arraybuffer'
    });
    
    console.log(`✅ Storyblocks response: ${response.status}`);
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    
    // Copy content type
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    // Handle HTML responses - rewrite URLs
    if (response.headers['content-type']?.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      console.log('🔧 Rewriting asset URLs for storyblocks');
      
      // Rewrite asset paths to go through /storyblocks proxy
      html = html.replace(/href="\//g, 'href="/storyblocks/');
      html = html.replace(/src="\//g, 'src="/storyblocks/');
      html = html.replace(/srcset="\//g, 'srcset="/storyblocks/');
      
      // Rewrite URLs in CSS
      html = html.replace(/url\(\//g, 'url(/storyblocks/');
      html = html.replace(/url\("\//g, 'url("/storyblocks/');
      html = html.replace(/url\('\//g, 'url(\'/storyblocks/');
      
      // Apply domain replacement rules from config
      storyblocksConfig.replaceRules.forEach(([find, replace]) => {
        const regex = new RegExp(find, 'g');
        html = html.replace(regex, replace);
      });
      
      // Fix double slashes that might have been created
      html = html.replace(/\/storyblocks\/storyblocks\//g, '/storyblocks/');
      
      console.log('   ✅ Rewritten URLs to route through /storyblocks');
      
      return res.status(response.status).send(html);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying Storyblocks:', error.message);
    return res.status(500).json({ 
      error: 'Storyblocks proxy error',
      message: error.message 
    });
  }
}

/**
 * Proxy Storyblocks static assets
 */
export async function proxyStoryblocksStatic(req, res) {
  try {
    const assetPath = req.path.replace('/static', '');
    const targetUrl = `https://static.storyblocks.com${assetPath}`;
    
    console.log('🎨 Proxying Storyblocks static asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.storyblocks.com/'
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
    console.error('❌ Error proxying Storyblocks static:', error.message);
    return res.status(500).json({ error: 'Failed to proxy static asset' });
  }
}

/**
 * Proxy Storyblocks CDN assets
 */
export async function proxyStoryblocksCDN(req, res) {
  try {
    const assetPath = req.path.replace('/cdn', '');
    const targetUrl = `https://cdn.storyblocks.com${assetPath}`;
    
    console.log('🎨 Proxying Storyblocks CDN asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.storyblocks.com/'
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
    console.error('❌ Error proxying Storyblocks CDN:', error.message);
    return res.status(500).json({ error: 'Failed to proxy CDN asset' });
  }
}

/**
 * Proxy Storyblocks content assets
 */
export async function proxyStoryblocksContent(req, res) {
  try {
    const assetPath = req.path.replace('/content', '');
    const targetUrl = `https://content.storyblocks.com${assetPath}`;
    
    console.log('🎨 Proxying Storyblocks content asset:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.storyblocks.com/'
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
    console.error('❌ Error proxying Storyblocks content:', error.message);
    return res.status(500).json({ error: 'Failed to proxy content asset' });
  }
}

/**
 * Proxy Storyblocks images
 */
export async function proxyStoryblocksImages(req, res) {
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
    const targetUrl = `https://images.storyblocks.com${imagePath}`;
    
    console.log('🖼️  Proxying Storyblocks image:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.storyblocks.com/',
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
    console.error('❌ Error proxying Storyblocks image:', error.message);
    return res.status(500).send('Image proxy error');
  }
}

/**
 * Proxy Storyblocks media (video/audio files)
 */
export async function proxyStoryblocksMedia(req, res) {
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
    const targetUrl = `https://media.storyblocks.com${mediaPath}`;
    
    console.log('🎬 Proxying Storyblocks media:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.storyblocks.com/',
        'Accept': 'video/*,audio/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 30000 // Longer timeout for media files
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
    console.error('❌ Error proxying Storyblocks media:', error.message);
    return res.status(500).send('Media proxy error');
  }
}