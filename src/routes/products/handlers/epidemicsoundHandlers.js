/**
 * Epidemic Sound Specific Handlers
 * Handles cookie rotation and request proxying
 */
 
import epidemicsoundConfig from '../../../../products/epidemicsound.js';
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';
// Keep Puppeteer import as fallback
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
 * Main Epidemic Sound proxy handler using Puppeteer (FALLBACK)
 * Used only if Axios version has issues
 */
export async function proxyEpidemicsoundWithPuppeteer(req, res) {
  return await proxyWithPuppeteer(req, res, epidemicsoundConfig);
}

/**
 * ✅ MAIN EPIDEMIC SOUND PROXY (AXIOS-BASED)
 * This is the PRIMARY handler - faster and more reliable than Puppeteer
 */
export async function proxyEpidemicsoundWithAxios(req, res) {
  try {
    console.log('🎵 [AXIOS] Epidemic Sound request:', req.method, req.originalUrl);

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

    // Build target URL - clean path
    const productPrefix = '/epidemicsound';
    let cleanPath = req.originalUrl;
    
    if (cleanPath.startsWith(productPrefix)) {
      cleanPath = cleanPath.substring(productPrefix.length);
    }
    
    if (!cleanPath || cleanPath === '' || cleanPath === '/') {
      cleanPath = epidemicsoundConfig.redirectPath || '/music/featured/';
    }
    
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    
    const targetUrl = `https://${epidemicsoundConfig.domain}${cleanPath}`;
    
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
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 15000
    });
    
    console.log(`✅ Epidemic Sound response: ${response.status}`);
    
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    
    // Copy content type
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    
    // Get current host for dynamic replacements
    const currentHost = `${req.protocol}://${req.get('host')}`;
    
    // Handle HTML responses - rewrite URLs
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      console.log('🔧 Rewriting asset URLs for epidemicsound');
      
      // Replace absolute domain URLs
      html = html.replace(/https:\/\/www\.epidemicsound\.com/g, `${currentHost}/epidemicsound`);
      html = html.replace(/https:\/\/static\.epidemicsound\.com/g, `${currentHost}/epidemicsound/static`);
      html = html.replace(/https:\/\/cdn\.epidemicsound\.com/g, `${currentHost}/epidemicsound/cdn`);
      html = html.replace(/https:\/\/assets\.epidemicsound\.com/g, `${currentHost}/epidemicsound/assets`);
      html = html.replace(/https:\/\/images\.epidemicsound\.com/g, `${currentHost}/epidemicsound/images`);
      html = html.replace(/https:\/\/media\.epidemicsound\.com/g, `${currentHost}/epidemicsound/media`);
      
      // Rewrite asset paths to go through /epidemicsound proxy
      html = html.replace(/href="\/(?!epidemicsound)/g, 'href="/epidemicsound/');
      html = html.replace(/href='\/(?!epidemicsound)/g, "href='/epidemicsound/");
      
      html = html.replace(/src="\/(?!epidemicsound)/g, 'src="/epidemicsound/');
      html = html.replace(/src='\/(?!epidemicsound)/g, "src='/epidemicsound/");
      
      html = html.replace(/srcset="\/(?!epidemicsound)/g, 'srcset="/epidemicsound/');
      html = html.replace(/srcset='\/(?!epidemicsound)/g, "srcset='/epidemicsound/");
      
      // Rewrite URLs in CSS
      html = html.replace(/url\(\/(?!epidemicsound)/g, 'url(/epidemicsound/');
      html = html.replace(/url\("\/(?!epidemicsound)/g, 'url("/epidemicsound/');
      html = html.replace(/url\('\/(?!epidemicsound)/g, "url('/epidemicsound/");
      
      // Fix API paths in JavaScript
      html = html.replace(/["']\/api\//g, '"/epidemicsound/api/');
      html = html.replace(/["']\/session\//g, '"/epidemicsound/session/');
      
      // Fix double slashes that might have been created
      html = html.replace(/\/epidemicsound\/epidemicsound\//g, '/epidemicsound/');
      
      // ✅ INJECT ANALYTICS BLOCKER SCRIPT
      const blockAnalyticsScript = `
        <script>
        (function() {
          console.log('🚫 Analytics blocker initialized');
          
          // Block Hotjar and other analytics
          window.hj = function() { console.log('🚫 Blocked hj()'); };
          window.hjBootstrap = function() { console.log('🚫 Blocked hjBootstrap()'); };
          window._hjSettings = { hjid: 0, hjsv: 0 };
          
          // Intercept fetch to block analytics
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            if (typeof url === 'string' && (
              url.includes('hotjar') ||
              url.includes('google-analytics') ||
              url.includes('facebook.net') ||
              url.includes('doubleclick') ||
              url.includes('metrics.hotjar.io')
            )) {
              console.log('🚫 Blocked fetch:', url);
              return Promise.resolve(new Response('', { status: 200 }));
            }
            return originalFetch.apply(this, args);
          };
          
          // Intercept XHR to block analytics
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && (
              url.includes('hotjar') ||
              url.includes('google-analytics') ||
              url.includes('facebook.net') ||
              url.includes('doubleclick') ||
              url.includes('metrics.hotjar.io')
            )) {
              console.log('🚫 Blocked XHR:', url);
              this.send = function() {};
              return;
            }
            return originalOpen.call(this, method, url, ...rest);
          };
          
          // Block script loading
          const originalCreateElement = document.createElement;
          document.createElement = function(tagName) {
            const element = originalCreateElement.call(document, tagName);
            if (tagName.toLowerCase() === 'script') {
              const originalSetAttribute = element.setAttribute;
              element.setAttribute = function(name, value) {
                if (name === 'src' && typeof value === 'string' && (
                  value.includes('hotjar') ||
                  value.includes('google-analytics') ||
                  value.includes('facebook.net') ||
                  value.includes('doubleclick')
                )) {
                  console.log('🚫 Blocked script:', value);
                  return;
                }
                return originalSetAttribute.call(this, name, value);
              };
            }
            return element;
          };
        })();
        </script>
      `;
      
      // Inject script right after <head> tag
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${blockAnalyticsScript}`);
        console.log('   ✅ Injected analytics blocker script');
      }
      
      console.log('   ✅ Rewritten URLs to route through /epidemicsound');
      
      return res.status(response.status).send(html);
    }
    
    // Handle JavaScript - rewrite URLs
    if (contentType.includes('javascript') || contentType.includes('text/javascript')) {
      let js = response.data.toString('utf-8');
      
      // Replace API paths
      js = js.replace(/["']\/api\//g, '"/epidemicsound/api/');
      js = js.replace(/["']\/session\//g, '"/epidemicsound/session/');
      
      // Replace asset domains
      js = js.replace(/https:\/\/static\.epidemicsound\.com/g, `${currentHost}/epidemicsound/static`);
      js = js.replace(/https:\/\/cdn\.epidemicsound\.com/g, `${currentHost}/epidemicsound/cdn`);
      js = js.replace(/https:\/\/images\.epidemicsound\.com/g, `${currentHost}/epidemicsound/images`);
      
      return res.status(response.status).type(contentType).send(js);
    }
    
    // Handle CSS - rewrite URLs
    if (contentType.includes('css')) {
      let css = response.data.toString('utf-8');
      
      css = css.replace(/url\(\/(?!epidemicsound)/g, 'url(/epidemicsound/');
      css = css.replace(/https:\/\/static\.epidemicsound\.com/g, `${currentHost}/epidemicsound/static`);
      css = css.replace(/https:\/\/cdn\.epidemicsound\.com/g, `${currentHost}/epidemicsound/cdn`);
      
      return res.status(response.status).type(contentType).send(css);
    }
    
    // For other content (images, fonts, etc.), send as-is
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