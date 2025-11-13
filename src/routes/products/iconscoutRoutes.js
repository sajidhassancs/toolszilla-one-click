/**
 * Iconscout Routes
 * Product-specific routes for Iconscout
 */
import express from 'express';
import axios from 'axios';
import iconscoutConfig from '../../../products/iconscout.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { decryptUserCookies, decryptUserCookiesNoSessionCheck } from '../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../services/apiService.js';
import { USER_AGENT } from '../../utils/constants.js';

const router = express.Router();

console.log('🎨 [ICONSCOUT] Router initialized');

// ============================================
// ✅ HELPER FUNCTION - GET USER COOKIES
// ============================================
export async function getUserCookieString(req) {
  const userData = await decryptUserCookies(req);
  
  if (userData.redirect) {
    return null;
  }

  const prefix = userData.prefix;
  const apiData = await getDataFromApiWithoutVerify(prefix);
  let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
  
  if (typeof cookiesArray === 'string') {
    cookiesArray = JSON.parse(cookiesArray);
  }
  
  return cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// ============================================
// ✅ HELPER FUNCTION - GET USER COOKIES (NO SESSION CHECK)
// ============================================
async function getUserCookieStringNoSessionCheck(req) {
  const userData = await decryptUserCookiesNoSessionCheck(req);
  
  if (userData.redirect) {
    return null;
  }

  const prefix = userData.prefix;
  const apiData = await getDataFromApiWithoutVerify(prefix);
  let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
  
  if (typeof cookiesArray === 'string') {
    cookiesArray = JSON.parse(cookiesArray);
  }
  
  return cookiesArray.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, iconscoutConfig.displayName, 'default');
});
// ✅ DUMMY ENDPOINTS FOR REMOVED SCRIPTS
router.all('/dummy-rum', (req, res) => {
  return res.status(200).json({ success: true });
});

router.get('/dummy-analytics', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  return res.status(200).send('console.log("Analytics disabled");');
});
// ============================================
// ✅ CLOUDFLARE SCRIPTS PROXY (BEFORE CATCH-ALL)
// ============================================
router.get(/^\/cdn-cgi\/scripts\/.*$/, async (req, res) => {
  try {
    const scriptPath = req.path;
    const targetUrl = `https://iconscout.com${scriptPath}`;
    
    console.log('🎨 [CLOUDFLARE SCRIPT] Request:', targetUrl);
    
    const cookieString = await getUserCookieStringNoSessionCheck(req);
    if (!cookieString) {
      res.set('Content-Type', 'application/javascript');
      return res.status(200).send('// No auth');
    }

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      responseType: 'text',
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   Response:', response.status);
    
    if (response.status === 200) {
      let script = response.data;
      
      script = script.replace(/["']\/cdn-cgi\//g, '"/iconscout/cdn-cgi/');
      script = script.replace(/,\s*["']\/cdn-cgi\//g, ', "/iconscout/cdn-cgi/');
      script = script.replace(/\(["']\/cdn-cgi\//g, '("/iconscout/cdn-cgi/');
      
      res.set('Content-Type', 'application/javascript');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(script);
    }
    
    res.set('Content-Type', 'application/javascript');
    return res.status(404).send('// Not found');
  } catch (error) {
    console.error('❌ Cloudflare script error:', error.message);
    res.set('Content-Type', 'application/javascript');
    return res.status(200).send('// Error');
  }
});

// ============================================
// ✅ FAVICON ROUTES (BEFORE CATCH-ALL)
// ============================================
router.get(/^\/(favicon.*\.(ico|png)|android-icon.*\.png|apple-icon.*\.png)$/, async (req, res) => {
  try {
    const faviconPath = req.path;
    const targetUrl = `https://iconscout.com${faviconPath}`;
    
    console.log('🎨 [FAVICON] Request:', targetUrl);
    
    const cookieString = await getUserCookieStringNoSessionCheck(req);
    if (!cookieString) {
      return res.status(404).send('Not found');
    }

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('   Response:', response.status);
    
    if (response.status === 200 && response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(response.data);
    }
    
    return res.status(404).send('Not found');
  } catch (error) {
    console.error('❌ Favicon error:', error.message);
    return res.status(404).send('Not found');
  }
});
router.get('/iconscout-sw.js', (req, res) => {
  const currentHost = `${req.protocol}://${req.get('host')}`;
  const swCode = `
// ✅ FORCE IMMEDIATE ACTIVATION
self.addEventListener('install', function(event) {
  console.log('🔧 SW: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('🔧 SW: Activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  
  try {
    // ⭐ INTERCEPT MANIFEST.JSON - Return inline
    if (url.endsWith('/manifest.json')) {
      console.log('🔧 SW: Intercepting manifest.json');
      event.respondWith(new Response(JSON.stringify({
        name: "Iconscout",
        short_name: "Iconscout",
        start_url: "/iconscout/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        icons: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
      return;
    }
    
    // ⭐ INTERCEPT STRAPI API CALLS
    if (url.includes('/strapi/') && !url.includes('/iconscout/strapi/')) {
      const newUrl = url.replace(/\/strapi\//, '/iconscout/strapi/');
      console.log('🔧 SW: Intercepting strapi:', newUrl);
      event.respondWith(fetch(newUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? event.request.body : undefined,
        credentials: 'include'
      }).catch(err => {
        console.error('SW: strapi fetch failed:', err);
        return new Response('{}', { status: 200 });
      }));
      return;
    }
    
    // ✅ Intercept CDN-CGI requests
    if (url.includes('/cdn-cgi/')) {
      console.log('🔧 SW: Intercepting cdn-cgi:', url);
      
      if (url.includes('/cdn-cgi/rum')) {
        event.respondWith(new Response(JSON.stringify({success: true}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
        return;
      }
      
      const newUrl = url.replace('/cdn-cgi/', '/iconscout/cdn-cgi/');
      event.respondWith(fetch(newUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? event.request.body : undefined,
        credentials: 'include'
      }).catch(err => {
        console.error('SW: cdn-cgi fetch failed:', err);
        return new Response('{}', { status: 200 });
      }));
      return;
    }
    
    // ✅ Intercept CDN3D requests
    if (url.includes('cdn3d.iconscout.com')) {
      const newUrl = url.replace('https://cdn3d.iconscout.com', '${currentHost}/iconscout/image/cdn3d');
      event.respondWith(fetch(newUrl, {credentials: 'include'}).catch(err => {
        console.error('SW: cdn3d fetch failed:', err);
        return fetch(event.request);
      }));
      return;
    }
    
    // ✅ Intercept CDNA requests
    if (url.includes('cdna.iconscout.com')) {
      const newUrl = url.replace('https://cdna.iconscout.com', '${currentHost}/iconscout/image/cdna');
      event.respondWith(fetch(newUrl, {credentials: 'include'}).catch(err => {
        console.error('SW: cdna fetch failed:', err);
        return fetch(event.request);
      }));
      return;
    }
    
    // ✅ Intercept CDN requests
    if (url.includes('cdn.iconscout.com')) {
      const newUrl = url.replace('https://cdn.iconscout.com', '${currentHost}/iconscout/image/cdn');
      event.respondWith(fetch(newUrl, {credentials: 'include'}).catch(err => {
        console.error('SW: cdn fetch failed:', err);
        return fetch(event.request);
      }));
      return;
    }
    
    // ✅ Intercept Assets requests
    if (url.includes('assets.iconscout.com')) {
      const newUrl = url.replace('https://assets.iconscout.com', '${currentHost}/iconscout/image/assets');
      event.respondWith(fetch(newUrl, {credentials: 'include'}).catch(err => {
        console.error('SW: assets fetch failed:', err);
        return fetch(event.request);
      }));
      return;
    }
    
    // Let other requests pass through
    event.respondWith(fetch(event.request));
  } catch (err) {
    console.error('SW: Error in fetch event:', err);
    event.respondWith(fetch(event.request));
  }
});
  `;
  
  res.set('Content-Type', 'application/javascript');
  res.set('Service-Worker-Allowed', '/');
  return res.send(swCode);
});

// ============================================
// ✅ SPECIAL ROUTES
// ============================================

 

// ============================================
// ✅ CLOUDFLARE CDN-CGI ROUTES (BEFORE CATCH-ALL)
// ============================================
router.all('/rum', (req, res) => {
  return res.status(200).json({ success: true });
});

router.all('/cdn-cgi/rum', (req, res) => {
  return res.status(200).json({ success: true });
});

router.all(/^\/cdn-cgi\/.*$/, (req, res) => {
  return res.status(200).json({ success: true });
});

// ============================================
// ✅ CLOUDFLARE EMAIL DECODE SCRIPT
// ============================================
router.get('/cdn-cgi/scripts/:version/cloudflare-static/email-decode.min.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  return res.status(200).send('// Cloudflare email decode disabled');
});

// ============================================
// ✅ ASSETS ROUTE (BEFORE CATCH-ALL)
// ============================================
router.get(/^\/image\/assets\/(.*)$/, async (req, res) => {
  try {
    const assetPath = req.params[0];
    const assetUrl = `https://assets.iconscout.com/${assetPath}`;
    
    console.log('🎨 [ASSETS] Request:', assetUrl);
    
    const cookieString = await getUserCookieStringNoSessionCheck(req);
    if (!cookieString) {
      console.log('   ❌ No cookies - returning fallback');
      if (assetPath.endsWith('.js')) {
        res.set('Content-Type', 'application/javascript');
        return res.status(200).send('// Unauthorized');
      }
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      return res.status(200).send(transparentPixel);
    }

    const response = await axios.get(assetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   Response:', response.status);
    
    if (response.status === 403 || response.status === 404) {
      console.log('   ⚠️ Asset not found');
      if (assetPath.endsWith('.js')) {
        res.set('Content-Type', 'application/javascript');
        return res.status(200).send('// Not found');
      }
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      return res.status(200).send(transparentPixel);
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Assets error:', error.message);
    const assetPath = req.params[0];
    if (assetPath && assetPath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
      return res.status(200).send('// Error');
    }
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.set('Content-Type', 'image/png');
    return res.status(200).send(transparentPixel);
  }
});
 router.get('/manifest.json', (req, res) => {
  console.log('📱 [ICONSCOUT] Manifest.json request');
  return res.status(200).json({
    name: "Iconscout",
    short_name: "Iconscout",
    start_url: "/iconscout/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: []
  });
});
// ============================================
// 🎭 CATCH-ALL PROXY (MUST BE LAST!)
// ============================================
router.use((req, res) => {
  (async () => {
    try {
      console.log('🎨 [ICONSCOUT] Catch-all:', req.method, req.originalUrl);
      
      if (req.originalUrl.includes('/image/')) {
        console.log('   ⏭️ Skipping /image route - handled by mainRouter');
        return res.status(404).send('Not found');
      }
      
      const cookieString = await getUserCookieString(req);
      if (!cookieString) {
        console.log('   ❌ No cookies - redirecting to setup');
        return res.redirect('/setup-session');
      }

      let cleanPath = req.originalUrl.replace('/iconscout', '');
      if (!cleanPath || cleanPath === '') {
        cleanPath = '/';
      }
      
      const targetUrl = `https://iconscout.com${cleanPath}`;
      console.log('   Target:', targetUrl);
      
      const response = await axios({
        method: req.method,
        url: targetUrl,
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'referer': 'https://iconscout.com/',
          'user-agent': USER_AGENT,
          'Cookie': cookieString
        },
        data: req.body,
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 15000
      });
      
      console.log('   Response:', response.status, 'Type:', response.headers['content-type']);
      
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const currentHost = `${req.protocol}://${req.get('host')}`;


 if (contentType.includes('text/html')) {
  let html = response.data.toString('utf-8');
  
  console.log('🔧 Rewriting HTML URLs...');
  
  // Replace CDN domains
  html = html.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
  html = html.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
  html = html.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
  html = html.replace(/https:\/\/assets\.iconscout\.com/g, `${currentHost}/iconscout/image/assets`);
  
  html = html.replace(/\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
  html = html.replace(/\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
  html = html.replace(/\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
  html = html.replace(/\/\/assets\.iconscout\.com/g, `${currentHost}/iconscout/image/assets`);
  
  // ✅ Only remove EXTERNAL analytics script tags (not inline scripts)
  html = html.replace(/<script[^>]+src="https:\/\/www\.google-analytics\.com[^"]*"[^>]*><\/script>/gi, '');
  html = html.replace(/<script[^>]+src="https:\/\/www\.googletagmanager\.com[^"]*"[^>]*><\/script>/gi, '');
  html = html.replace(/<script[^>]+src="https:\/\/connect\.facebook\.net[^"]*"[^>]*><\/script>/gi, '');
  
  // Remove GTM noscript iframes
  html = html.replace(/<noscript>[^<]*<iframe[^>]*googletagmanager[^<]*<\/iframe>[^<]*<\/noscript>/gi, '');
  
  // ✅ REMOVE CLOUDFLARE RUM
  html = html.replace(/<script[^>]*src="[^"]*\/cdn-cgi\/rum[^"]*"[^>]*><\/script>/gi, '');
  
  // Fix Cloudflare paths
  html = html.replace(/src="\/cdn-cgi\//g, 'src="/iconscout/cdn-cgi/');
  html = html.replace(/href="\/cdn-cgi\//g, 'href="/iconscout/cdn-cgi/');
  
  // Fix relative paths
  html = html.replace(/href="\/(?!iconscout)/g, 'href="/iconscout/');
  html = html.replace(/src="\/(?!iconscout)/g, 'src="/iconscout/');
  
  console.log('   ✅ Removed analytics and tracking scripts');
  
  // ✅ RUNTIME BLOCKER - Block analytics at the JavaScript level
  const errorHandlerScript = `<script>
// Disable analytics functions BEFORE they load
window.gtag = window.gtag || function() { };
window.ga = window.ga || function() { };
window.fbq = window.fbq || function() { };
window._fbq = window._fbq || function() { };

// Prevent errors from breaking the page
window.addEventListener('error', function(e) {
  if (e.message && (e.message.includes('google-analytics') || e.message.includes('facebook'))) {
    e.preventDefault();
    return true;
  }
}, true);

// Block fetch to analytics
const origFetch = window.fetch;
window.fetch = function(...args) {
  const url = String(args[0]);
  if (url.includes('google-analytics.com') || url.includes('facebook.com/tr')) {
    return Promise.resolve(new Response('{}', {status: 200}));
  }
  return origFetch.apply(this, args);
};
</script>`;
  
  // Service Worker
  const serviceWorkerScript = `<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/iconscout/iconscout-sw.js', {scope: '/'})
    .then(function(reg) {
      console.log('✅ Service Worker registered:', reg.scope);
    })
    .catch(function(err) {
      console.error('❌ Service Worker failed:', err);
    });
}
</script>`;
  
  // Inject scripts right after <head> tag
  if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${errorHandlerScript}${serviceWorkerScript}`);
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', `<html><head>${errorHandlerScript}${serviceWorkerScript}</head>`);
  }
  
  console.log('   ✅ HTML rewriting complete');
  
  res.set('Content-Type', 'text/html');
  res.set('Access-Control-Allow-Origin', '*');
  return res.status(response.status).send(html);
}
      // For JavaScript
      if (contentType.includes('javascript')) {
        let js = response.data.toString('utf-8');
        
        console.log('🔧 Rewriting JavaScript URLs...');
        
        js = js.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
        js = js.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
        js = js.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
        js = js.replace(/https:\/\/assets\.iconscout\.com/g, `${currentHost}/iconscout/image/assets`);
        
        js = js.replace(/["']\/cdn-cgi\//g, '"/iconscout/cdn-cgi/');
        js = js.replace(/,\s*["']\/cdn-cgi\//g, ', "/iconscout/cdn-cgi/');
        js = js.replace(/\(["']\/cdn-cgi\//g, '("/iconscout/cdn-cgi/');
        
        res.set('Content-Type', contentType);
        return res.status(response.status).send(js);
      }
      
      // For CSS
      if (contentType.includes('css')) {
        let css = response.data.toString('utf-8');
        
        console.log('🔧 Rewriting CSS URLs...');
        
        css = css.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn3d`);
        css = css.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/image/cdna`);
        css = css.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/image/cdn`);
        css = css.replace(/https:\/\/assets\.iconscout\.com/g, `${currentHost}/iconscout/image/assets`);
        
        res.set('Content-Type', contentType);
        return res.status(response.status).send(css);
      }
      
      // For everything else
      res.set('Access-Control-Allow-Origin', '*');
      if (response.headers['content-type']) {
        res.set('Content-Type', response.headers['content-type']);
      }
      
      return res.status(response.status).send(response.data);
      
    } catch (error) {
      console.error('❌ Proxy error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  })();
});

export default router;