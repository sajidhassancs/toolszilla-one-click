import express from 'express';
import axios from 'axios';
import epidemicsoundConfig from '../../../products/epidemicsound.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  proxyEpidemicsoundWithAxios,
  proxyEpidemicsoundWithPuppeteer,
  proxyEpidemicsoundStatic,
  proxyEpidemicsoundCDN,
  proxyEpidemicsoundAssets,
  proxyEpidemicsoundImages,
  proxyEpidemicsoundMedia
} from './handlers/epidemicsoundHandlers.js';
import { decryptUserCookies } from '../../services/cookieService.js';
import { getDataFromApiWithoutVerify } from '../../services/apiService.js';
import { USER_AGENT } from '../../utils/constants.js';

const router = express.Router();

console.log('🎵 [EPIDEMIC SOUND] Router initialized (Axios mode)');

// ============================================
// ✅ ROOT REDIRECT - LOAD DIRECTLY WITHOUT REDIRECT!
// ============================================
router.get('/', async (req, res) => {
  console.log('🎵 [EPIDEMIC SOUND] Root access - proxying /music/featured/ directly');
  // Set the URL to what we want and proxy directly
  req.url = '/music/featured/?override_referrer=true';
  return proxyEpidemicsoundWithAxios(req, res);
});

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, epidemicsoundConfig.displayName, 'default');
});

// ============================================
// ✅ STATIC ASSETS
// ============================================
router.use('/staticfiles', async (req, res) => {
  try {
    console.log('📦 [STATIC FILES] Asset proxy:', req.originalUrl);
    
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

    let assetPath = req.originalUrl;
    while (assetPath.includes('/epidemicsound')) {
      assetPath = assetPath.replace('/epidemicsound', '');
    }
    
    const targetUrl = `https://www.epidemicsound.com${assetPath}`;
    
    console.log('   Target:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': req.headers.accept || '*/*',
        'Referer': 'https://www.epidemicsound.com/',
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
    console.error('❌ Error proxying staticfiles:', error.message);
    return res.status(500).send('');
  }
});

// ============================================
// ✅ API ENDPOINTS
// ============================================
router.use('/api', async (req, res) => {
  try {
    console.log('🌐 [API] Request:', req.originalUrl);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      console.log('   ⚠️ Session invalid, but continuing anyway for API');
    }

    const prefix = userData.prefix || req.cookies.prefix;
    
    if (!prefix) {
      console.log('   ❌ No prefix available');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const apiData = await getDataFromApiWithoutVerify(prefix);
    let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    let apiPath = req.originalUrl;
    while (apiPath.includes('/epidemicsound')) {
      apiPath = apiPath.replace('/epidemicsound', '');
    }
    
    if (!apiPath.startsWith('/')) {
      apiPath = '/' + apiPath;
    }
    
    const targetUrl = `https://www.epidemicsound.com${apiPath}`;
    
    console.log('   Target:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://www.epidemicsound.com/',
        'Cookie': cookieString,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 15000
    });
    
    console.log('   Response:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    
    return res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error('❌ Error proxying API:', error.message);
    
    return res.status(500).json({ 
      error: 'API proxy error',
      message: error.message,
      path: req.originalUrl
    });
  }
});

// ✅ Handle /session routes
router.use('/session', async (req, res) => {
  try {
    console.log('🔐 [SESSION] Request:', req.originalUrl);
    
    const userData = await decryptUserCookies(req);
    if (userData.redirect) {
      return res.status(403).json({ error: 'Unauthorized' });
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

    let sessionPath = req.originalUrl;
    while (sessionPath.includes('/epidemicsound')) {
      sessionPath = sessionPath.replace('/epidemicsound', '');
    }
    
    if (!sessionPath.startsWith('/')) {
      sessionPath = '/' + sessionPath;
    }
    
    const targetUrl = `https://www.epidemicsound.com${sessionPath}`;
    
    console.log('   Target:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://www.epidemicsound.com/',
        'Cookie': cookieString,
        'Content-Type': 'application/json'
      },
      data: req.body,
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log('   Response:', response.status);
    
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', 'application/json');
    
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Error proxying session:', error.message);
    return res.status(500).json({ error: 'Session error' });
  }
});

// Handle /json routes
router.use('/json', async (req, res) => {
  return proxyEpidemicsoundWithAxios(req, res);
});

// Handle /a routes  
router.use('/a', async (req, res) => {
  return proxyEpidemicsoundWithAxios(req, res);
});

// Handle /trackshop routes
router.use('/trackshop', async (req, res) => {
  return proxyEpidemicsoundWithAxios(req, res);
});

// Handle /music routes (main browsing)
router.use('/music', async (req, res) => {
  return proxyEpidemicsoundWithAxios(req, res);
});

// Static files
router.use('/static', (req, res) => {
  return proxyEpidemicsoundStatic(req, res);
});

// CDN files
router.use('/cdn', (req, res) => {
  return proxyEpidemicsoundCDN(req, res);
});

// Assets
router.use('/assets', (req, res) => {
  return proxyEpidemicsoundAssets(req, res);
});

// Images
router.use('/images', (req, res) => {
  return proxyEpidemicsoundImages(req, res);
});

// Media (audio files)
router.use('/media', (req, res) => {
  return proxyEpidemicsoundMedia(req, res);
});

// ============================================
// 🎭 CATCH-ALL FOR OTHER PAGES
// ============================================
router.use((req, res) => {
  console.log('🎵 [EPIDEMIC SOUND] Catch-all handler triggered (AXIOS)');
  console.log('   Path:', req.path);
  
  // If it's truly the root with no path, add the query parameter
  if (!req.path || req.path === '/') {
    req.url = '/music/featured/?override_referrer=true';
  }
  
  return proxyEpidemicsoundWithAxios(req, res);
});

export default router;