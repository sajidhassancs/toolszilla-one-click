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

    // ✅ REWRITE URLs IN JAVASCRIPT FILES
    if (contentType.includes('javascript') || contentType.includes('application/javascript') || assetPath.endsWith('.js')) {
      let jsContent = response.data.toString('utf-8');

      // Get current host
      const isLocalhost = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
      const protocol = isLocalhost ? 'http' : 'https';
      const currentHost = req.get('host');
      const proxyBase = `${protocol}://${currentHost}/freepik`;

      console.log('   🔧 Rewriting JavaScript URLs...');
      console.log('   📍 Current host:', currentHost);
      console.log('   📍 Proxy base:', proxyBase);

      // ✅ Replace ALL variations of www.freepik.com
      jsContent = jsContent.replace(/https:\/\/www\.freepik\.com\/pikaso\//g, `${proxyBase}/pikaso/`);
      jsContent = jsContent.replace(/https:\/\/www\.freepik\.com\//g, `${proxyBase}/`);
      jsContent = jsContent.replace(/https:\/\/www\.freepik\.com"/g, `${proxyBase}"`);
      jsContent = jsContent.replace(/"https:\/\/www\.freepik\.com/g, `"${proxyBase}`);
      jsContent = jsContent.replace(/'https:\/\/www\.freepik\.com'/g, `'${proxyBase}'`);

      // ✅ Replace domain-only references (for things like VITE_APP_DOMAIN)
      jsContent = jsContent.replace(/"www\.freepik\.com"/g, `"${currentHost}"`);
      jsContent = jsContent.replace(/'www\.freepik\.com'/g, `'${currentHost}'`);
      jsContent = jsContent.replace(/VITE_APP_DOMAIN:"www\.freepik\.com"/g, `VITE_APP_DOMAIN:"${currentHost}"`);
      jsContent = jsContent.replace(/APP_DOMAIN:"www\.freepik\.com"/g, `APP_DOMAIN:"${currentHost}"`);

      // ✅ Replace static.cdnpk.net references
      jsContent = jsContent.replace(/https:\/\/static\.cdnpk\.net\/pikaso\//g, `${proxyBase}/static-cdnpk/pikaso/`);
      jsContent = jsContent.replace(/https:\/\/static\.cdnpk\.net\//g, `${proxyBase}/static-cdnpk/`);
      jsContent = jsContent.replace(/BASE_URL:"https:\/\/static\.cdnpk\.net\/pikaso\/"/g, `BASE_URL:"${proxyBase}/static-cdnpk/pikaso/"`);

      // ✅ Replace freepik.com without subdomain
      jsContent = jsContent.replace(/VITE_REVERB_HOST:"freepik\.com"/g, `VITE_REVERB_HOST:"${currentHost}"`);
      jsContent = jsContent.replace(/"freepik\.com"/g, `"${currentHost}"`);
      jsContent = jsContent.replace(/'freepik\.com'/g, `'${currentHost}'`);

      const originalLength = response.data.length;
      const newLength = jsContent.length;
      console.log(`   ✅ JavaScript rewritten (${originalLength} → ${newLength} bytes)`);

      return res.status(response.status).send(jsContent);
    }

    // Binary files (images, fonts, etc.) - send as-is
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying static.cdnpk.net:', error.message);
    return res.status(500).json({ error: 'Failed to proxy static cdnpk asset' });
  }
}


/**
 * Axios-based Freepik proxy (faster and better for client-side routing)
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

    // Build target URL (use req.url which has /freepik prefix removed by router)
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
    const isLocalhost = req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
    const currentHost = `${protocol}://${req.get('host')}`;

    // Handle HTML
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');

      console.log('🔧 Rewriting Freepik HTML...');

      // ✅ CRITICAL: Inject URL fix script BEFORE React loads
      const urlFixScript = `
<script>
(function() {
  console.log('🔧 [FREEPIK] Fixing window.location...');
  
  // Check if URL has /freepik prefix and remove it
  if (window.location.pathname.startsWith('/freepik/')) {
    const cleanPath = window.location.pathname.replace('/freepik', '');
    console.log('🔧 URL rewrite:', window.location.pathname, '→', cleanPath);
    window.history.replaceState({}, '', cleanPath + window.location.search + window.location.hash);
  }
  
  console.log('✅ URL fixed, path is now:', window.location.pathname);
})();
</script>
`;

      // ✅ Inject RIGHT AFTER <head> tag (before React loads)
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${urlFixScript}`);
        console.log('   ✅ Injected URL fix script');
      }

      // Replace domain URLs
      html = html.replace(/https:\/\/www\.freepik\.com/g, `${currentHost}/freepik`);
      html = html.replace(/https:\/\/cdn\.freepik\.com/g, `${currentHost}/freepik/cdn`);
      html = html.replace(/https:\/\/cdnb\.freepik\.com/g, `${currentHost}/freepik/cdnb`);
      html = html.replace(/https:\/\/static\.freepik\.com/g, `${currentHost}/freepik/static`);

      console.log('   ✅ HTML rewriting complete');

      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(response.status).send(html);
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
 * Proxy Freepik API calls - USING PUPPETEER to bypass CloudFlare
 */
export async function proxyFreepikAPI(req, res) {
  let browser = null;

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

    if (!Array.isArray(cookiesArray) || cookiesArray.length === 0) {
      return res.status(500).json({ error: 'Invalid cookie format' });
    }

    // Remove /freepik prefix from the URL
    const apiPath = req.originalUrl.replace('/freepik', '');
    const targetUrl = `https://www.freepik.com${apiPath}`;

    console.log('🔌 Proxying Freepik API with Puppeteer:', targetUrl);

    // Use Puppeteer to bypass CloudFlare
    browser = await getBrowser();
    const page = await browser.newPage();

    // Set stealth mode
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // ✅ Set cookies with BOTH domain variants
    const puppeteerCookies = [];
    cookiesArray.forEach(cookie => {
      // .freepik.com domain
      puppeteerCookies.push({
        name: cookie.name,
        value: cookie.value,
        domain: '.freepik.com',
        path: '/',
        expires: cookie.expirationDate || -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || true,
        sameSite: 'Lax'
      });

      // www.freepik.com domain
      puppeteerCookies.push({
        name: cookie.name,
        value: cookie.value,
        domain: 'www.freepik.com',
        path: '/',
        expires: cookie.expirationDate || -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || true,
        sameSite: 'Lax'
      });
    });

    await page.setCookie(...puppeteerCookies);
    console.log('✅ Set', puppeteerCookies.length, 'cookies for API call');

    // Fetch API
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    if (!response) {
      await page.close();
      return res.status(500).json({ error: 'API request failed' });
    }

    const content = await response.text();
    const contentType = response.headers()['content-type'] || 'application/json';

    // ✅ FORWARD COOKIES TO BROWSER
    const responseCookies = await page.cookies();
    if (responseCookies.length > 0) {
      console.log('🍪 Setting', responseCookies.length, 'cookies in user browser');
      responseCookies.forEach(cookie => {
        res.cookie(cookie.name, cookie.value, {
          domain: '.primewp.net',
          path: cookie.path || '/',
          httpOnly: false,
          secure: true,
          sameSite: 'none',
          maxAge: 3600000
        });
      });
    }

    await page.close();

    console.log('✅ API response status:', response.status());

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);

    return res.status(response.status()).send(content);

  } catch (error) {
    console.error('❌ Error proxying Freepik API:', error.message);
    if (browser) {
      try {
        const pages = await browser.pages();
        await Promise.all(pages.map(page => page.close().catch(() => { })));
      } catch (e) { }
    }
    return res.status(500).json({ error: 'API proxy error', message: error.message });
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