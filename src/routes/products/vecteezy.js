import express from 'express';
import axios from 'axios';
import {
  proxyVecteezyWithPuppeteer,
  proxyVecteezyStatic,
  proxyVecteezyCDN,
  proxyVecteezyImages
} from './handlers/vecteezyHandlers.js';
import { decryptUserCookies } from '../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../services/apiService.js';

const router = express.Router();

console.log('🟣 [VECTEEZY] Router initialized');

// Logging middleware
router.use((req, res, next) => {
  console.log('\n========================================');
  console.log('🟣 [VECTEEZY ROUTER] Incoming request');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Path:', req.path);
  console.log('   Original URL:', req.originalUrl);
  console.log('   Base URL:', req.baseUrl);
  console.log('========================================\n');
  next();
});

// ✅ Handle site.webmanifest directly (no Puppeteer needed)
router.get('/site.webmanifest', (req, res) => {
  return res.status(200).json({
    name: "Vecteezy",
    short_name: "Vecteezy",
    start_url: "/vecteezy/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: []
  });
});

// ✅ ADD MISSING async_contributors_info ROUTE
router.get('/async_contributors_info', async (req, res) => {
  try {
    console.log('📡 [VECTEEZY] /async_contributors_info');
    console.log('   Query:', req.query);

    // Validate session
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const prefix = userData.prefix;

    // Get premium cookies
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }

    const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');

    // Build target URL
    const queryString = new URLSearchParams(req.query).toString();
    const targetUrl = `https://www.vecteezy.com/async_contributors_info?${queryString}`;

    console.log('   Target:', targetUrl);

    // Proxy the request
    const response = await axios.get(targetUrl, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://www.vecteezy.com/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      validateStatus: () => true,
      timeout: 10000
    });

    console.log('   ✅ Response:', response.status);

    // Return the response
    res.status(response.status)
      .type(response.headers['content-type'] || 'application/json')
      .send(response.data);

  } catch (error) {
    console.error('❌ /async_contributors_info error:', error.message);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// ✅ ADD cdn-cgi/rum ROUTES (stops 404 errors)
router.post('/cdn-cgi/rum', (req, res) => {
  res.status(200).json({ success: true });
});

router.get('/cdn-cgi/rum', (req, res) => {
  res.status(200).json({ success: true });
});

// ✅ SERVE VITE ASSETS DIRECTLY (NO PUPPETEER!)
router.use('/vite', async (req, res) => {
  try {
    const assetPath = req.path; // Path after /vite
    const targetUrl = `https://www.vecteezy.com/vite${assetPath}`;

    console.log('⚡ [VITE ASSET] Fast-serving:', targetUrl);

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://www.vecteezy.com/'
      },
      validateStatus: () => true,
      timeout: 10000
    });

    // Set headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Vite asset error:', error.message);
    return res.status(500).send('Asset loading failed');
  }
});

// Static assets
router.use('/static', proxyVecteezyStatic);
console.log('✅ [VECTEEZY] Registered /static route');

// CDN assets
router.use('/cdn', proxyVecteezyCDN);
console.log('✅ [VECTEEZY] Registered /cdn route');

// Images
router.use('/images', proxyVecteezyImages);
console.log('✅ [VECTEEZY] Registered /images route');

// ✅ USE PUPPETEER for main browsing (bypasses bot detection)
router.use('/', proxyVecteezyWithPuppeteer);
console.log('✅ [VECTEEZY] Registered catch-all route (Puppeteer)');

export default router;