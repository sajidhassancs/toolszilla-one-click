/**
 * SIMPLIFIED Epidemic Sound Handler
 * Minimal processing to avoid breaking the page
 */

import epidemicsoundConfig from '../../../../products/epidemicsound.js';
import axios from 'axios';
import { decryptUserCookies } from '../../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../../services/apiService.js';
import { USER_AGENT } from '../../../utils/constants.js';

function getCurrentRotationIndex(totalAccounts) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const totalMinutes = currentHour * 60 + currentMinute;
  const intervalIndex = Math.floor(totalMinutes / 10);
  return intervalIndex % totalAccounts;
}

/**
 * SIMPLIFIED Axios proxy - minimal HTML rewriting
 */
export async function proxyEpidemicsoundWithAxios(req, res) {
  try {
    console.log('🎵 [AXIOS] Epidemic Sound request:', req.method, req.originalUrl);

    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    
    if (!accountsArray || accountsArray.length === 0) {
      return res.status(500).json({ error: 'No Epidemic Sound accounts available' });
    }

    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Build target URL - keep it simple
    let cleanPath = req.originalUrl.replace('/epidemicsound', '');
    
    if (!cleanPath || cleanPath === '/' || cleanPath === '') {
      cleanPath = '/music/featured/?override_referrer=';
    }
    
    const targetUrl = `https://www.epidemicsound.com${cleanPath}`;
    
    console.log('🎯 Target URL:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...epidemicsoundConfig.customHeaders,
        'referer': 'https://www.epidemicsound.com/',
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
    
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // Set headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);
    
    // Only process HTML
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      const currentHost = `${req.protocol}://${req.get('host')}`;
      
      // ✅ CRITICAL: Inject analytics blocker FIRST - must run BEFORE any other scripts
      const analyticsBlocker = `
        <script>
        (function() {
          'use strict';
          console.log('🚫 Analytics blocker initialized');
          
          // Block list - comprehensive
          const blockedDomains = [
            'bat.bing.com',
            'hotjar',
            'google-analytics',
            'doubleclick',
            'facebook.net',
            'sentry.io',
            'metrics.hotjar',
            'static.hotjar',
            'script.hotjar',
            'vars.hotjar'
          ];
          
          // Intercept fetch IMMEDIATELY
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
            if (blockedDomains.some(d => url.includes(d))) {
              console.log('🚫 Blocked fetch:', url.substring(0, 50));
              return Promise.resolve(new Response('{}', { 
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
              }));
            }
            return originalFetch.apply(this, args);
          };
          
          // Intercept XHR IMMEDIATELY
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && blockedDomains.some(d => url.includes(d))) {
              console.log('🚫 Blocked XHR:', url.substring(0, 50));
              this._blocked = true;
              this.send = function() {};
              this.abort = function() {};
              setTimeout(() => {
                if (this.onload) this.onload();
                if (this.onreadystatechange) this.onreadystatechange();
              }, 0);
              return;
            }
            return originalOpen.call(this, method, url, ...rest);
          };
          
          // Block script loading IMMEDIATELY
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'SCRIPT' && node.src && blockedDomains.some(d => node.src.includes(d))) {
                  console.log('🚫 Blocked script tag:', node.src.substring(0, 50));
                  node.remove();
                }
              });
            });
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
          
          // Stub analytics objects
          window.hj = window.hj || function() { console.log('🚫 Blocked hj()'); };
          window.hjBootstrap = window.hjBootstrap || function() { console.log('🚫 Blocked hjBootstrap()'); };
          window._hjSettings = { hjid: 0, hjsv: 0 };
          
          console.log('✅ Analytics blocker ready');
        })();
        </script>
      `;
      
      // Inject at start of <head>
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${analyticsBlocker}`);
      }
      
      // ✅ CRITICAL: Add base tag for SPA routing
      const baseTag = '<base href="/epidemicsound/">';
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${baseTag}</head>`);
        console.log('   ✅ Injected base tag for SPA routing');
      }
      
      // ✅ DO NOT ADD PREFIX - Keep URLs clean for SPA routing
      // The product cookie will handle routing, not URL prefixes
      
      // Just rewrite external domains to go through our proxy
      html = html.replace(/https:\/\/static\.epidemicsound\.com/g, `${currentHost}/epidemicsound/static`);
      html = html.replace(/https:\/\/cdn\.epidemicsound\.com/g, `${currentHost}/epidemicsound/cdn`);
      html = html.replace(/https:\/\/images\.epidemicsound\.com/g, `${currentHost}/epidemicsound/images`);
      html = html.replace(/https:\/\/media\.epidemicsound\.com/g, `${currentHost}/epidemicsound/media`);
      
      // ✅ CRITICAL: Fix JavaScript API paths WITHOUT adding /epidemicsound prefix
      // The auto-router will handle adding the prefix based on cookies
      // So these paths will stay as /session/, /api/, etc.
      
      console.log('✅ HTML rewritten with analytics blocker (URLs kept clean)');
      
      return res.status(response.status).send(html);
    }
    
    // For non-HTML, send as-is
    return res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error('❌ Error proxying Epidemic Sound:', error.message);
    return res.status(500).json({ 
      error: 'Epidemic Sound proxy error',
      message: error.message 
    });
  }
}

// Keep all the other proxy functions exactly as they are
export async function proxyEpidemicsoundStatic(req, res) {
  try {
    const assetPath = req.path.replace('/static', '');
    const targetUrl = `https://static.epidemicsound.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
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
    console.error('❌ Error proxying static:', error.message);
    return res.status(500).send('');
  }
}

export async function proxyEpidemicsoundCDN(req, res) {
  try {
    const assetPath = req.path.replace('/cdn', '');
    const targetUrl = `https://cdn.epidemicsound.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
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
    console.error('❌ Error proxying CDN:', error.message);
    return res.status(500).send('');
  }
}

export async function proxyEpidemicsoundAssets(req, res) {
  try {
    const assetPath = req.path.replace('/assets', '');
    const targetUrl = `https://assets.epidemicsound.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/'
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
    console.error('❌ Error proxying assets:', error.message);
    return res.status(500).send('');
  }
}

export async function proxyEpidemicsoundImages(req, res) {
  try {
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const imagePath = req.path.replace('/images', '');
    const targetUrl = `https://images.epidemicsound.com${imagePath}`;
    
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
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying image:', error.message);
    return res.status(500).send('');
  }
}

export async function proxyEpidemicsoundMedia(req, res) {
  try {
    const userData = await decryptUserCookies(req);
    
    if (userData.redirect) {
      return res.redirect(userData.redirect);
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const mediaPath = req.path.replace('/media', '');
    const targetUrl = `https://media.epidemicsound.com${mediaPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.epidemicsound.com/',
        'Accept': 'audio/*',
        'Cookie': cookieString
      },
      validateStatus: () => true,
      timeout: 30000
    });
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying media:', error.message);
    return res.status(500).send('');
  }
}