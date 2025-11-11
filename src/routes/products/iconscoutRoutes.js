/**
 * Iconscout Routes
 * Product-specific routes for Iconscout
 */
import express from 'express';
import axios from 'axios';
import iconscoutConfig from '../../../products/iconscout.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyIconscoutWithPuppeteer,
  proxyIconscoutAPI,
  proxyIconscoutCDN,
  proxyIconscoutAssets
} from './handlers/iconscoutHandlers.js';
import { decryptUserCookies } from '../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../services/apiService.js';
import { USER_AGENT } from '../../utils/constants.js';

const router = express.Router();

console.log('🎨 [ICONSCOUT] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, iconscoutConfig.displayName, 'default');
});

// ============================================
// ✅ SPECIAL ROUTES (BEFORE API!)
// ============================================

// Manifest
router.get('/manifest.json', (req, res) => {
  console.log('📄 [ICONSCOUT] Manifest route hit');
  return res.status(200).json({
    name: "Iconscout",
    short_name: "Iconscout",
    start_url: "/iconscout/",
    display: "standalone",
    icons: []
  });
});

// RUM endpoint (Cloudflare Real User Monitoring)
router.post('/rum', (req, res) => {
  console.log('☁️ [ICONSCOUT] RUM request');
  return res.status(200).json({ success: true });
});

// Cloudflare CDN routes
router.use('/cdn-cgi', (req, res) => {
  console.log('☁️ [ICONSCOUT] Cloudflare CDN request:', req.path);
  return res.status(200).json({ success: true });
});

// ============================================
// ✅ API ROUTES (MUST BE BEFORE STATIC ASSETS!)
// ============================================

// Strapi CMS API
router.use('/strapi', (req, res) => {
  console.log('🔌 [ICONSCOUT] Strapi API route hit:', req.originalUrl);
  return proxyIconscoutAPI(req, res);
});

// API domain (api.iconscout.com)
router.use('/api-domain', (req, res) => {
  console.log('🔌 [ICONSCOUT] API domain route hit:', req.originalUrl);
  return proxyIconscoutAPI(req, res);
});

// API calls
router.use('/api', (req, res) => {
  console.log('🔌 [ICONSCOUT] API route hit:', req.originalUrl);
  return proxyIconscoutAPI(req, res);
});

// ============================================
// ✅ STATIC ASSETS (BEFORE CATCH-ALL!)
// ============================================

// CDNA (CDN A) files
router.use('/cdna', (req, res) => {
  console.log('🎨 [ICONSCOUT] CDNA route hit');
  return proxyIconscoutCDN(req, res);
});

// CDN3D files
router.use('/cdn3d', (req, res) => {
  console.log('🎨 [ICONSCOUT] CDN3D route hit');
  return proxyIconscoutCDN(req, res);
});

// CDN files
router.use('/cdn', (req, res) => {
  console.log('🎨 [ICONSCOUT] CDN route hit');
  return proxyIconscoutCDN(req, res);
});

// Assets
router.use('/assets', (req, res) => {
  console.log('🎨 [ICONSCOUT] Assets route hit');
  return proxyIconscoutAssets(req, res);
});

// CSS files
router.use('/css', async (req, res) => {
  try {
    console.log('📜 [ICONSCOUT] CSS route hit:', req.path);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const assetPath = req.originalUrl.replace('/iconscout', '');
    const targetUrl = `https://iconscout.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      validateStatus: () => true
    });
    
    // Rewrite URLs in CSS
    if (response.status === 200) {
      let css = response.data.toString('utf-8');
      const currentHost = `${req.protocol}://${req.get('host')}`;
      
      css = css.replace(/url\(\/(?!iconscout)/g, 'url(/iconscout/');
      css = css.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/cdna`);
      css = css.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/cdn3d`);
      css = css.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/cdn`);
      
      res.set('Content-Type', 'text/css');
      res.set('Access-Control-Allow-Origin', '*');
      return res.status(200).send(css);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying CSS:', error.message);
    return res.status(500).send('');
  }
});

// JavaScript files
router.use('/js', async (req, res) => {
  try {
    console.log('📜 [ICONSCOUT] JS route hit:', req.path);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const assetPath = req.originalUrl.replace('/iconscout', '');
    const targetUrl = `https://iconscout.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
      },
      validateStatus: () => true
    });
    
    // Rewrite URLs in JS
    if (response.status === 200) {
      let js = response.data.toString('utf-8');
      const currentHost = `${req.protocol}://${req.get('host')}`;
      
      js = js.replace(/https:\/\/cdna\.iconscout\.com/g, `${currentHost}/iconscout/cdna`);
      js = js.replace(/https:\/\/cdn3d\.iconscout\.com/g, `${currentHost}/iconscout/cdn3d`);
      js = js.replace(/https:\/\/cdn\.iconscout\.com/g, `${currentHost}/iconscout/cdn`);
      js = js.replace(/https:\/\/api\.iconscout\.com/g, `${currentHost}/iconscout/api-domain`);
      
      res.set('Content-Type', 'application/javascript');
      res.set('Access-Control-Allow-Origin', '*');
      return res.status(200).send(js);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying JS:', error.message);
    return res.status(500).send('');
  }
});

// Font files
router.use('/fonts', async (req, res) => {
  try {
    console.log('🔤 [ICONSCOUT] Font route hit:', req.path);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const assetPath = req.originalUrl.replace('/iconscout', '');
    const targetUrl = `https://iconscout.com${assetPath}`;
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Referer': 'https://iconscout.com/',
        'Cookie': cookieString
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
    console.error('❌ Error proxying font:', error.message);
    return res.status(500).send('');
  }
});

// Static files (THIS IS THE IMPORTANT ONE FOR THE 403 ERRORS!)
router.use('/static', async (req, res) => {
  try {
    console.log('🖼️ [ICONSCOUT] Static route hit:', req.path);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).send('Unauthorized');
    }

    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    const assetPath = req.originalUrl.replace('/iconscout', '');
    const targetUrl = `https://iconscout.com${assetPath}`;
    
    console.log('   Target:', targetUrl);
    
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
    
    console.log('   Response:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying static asset:', error.message);
    return res.status(500).send('');
  }
});

// ============================================
// 🎭 CATCH-ALL FOR HTML PAGES (MUST BE LAST!)
// ============================================
router.use((req, res) => {
  console.log('🎨 [ICONSCOUT] Catch-all handler triggered');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Original URL:', req.originalUrl);
  return proxyIconscoutWithPuppeteer(req, res);
});

// ✅ CRITICAL: Export default router
export default router;