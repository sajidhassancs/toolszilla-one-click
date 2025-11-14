/**
 * Envato Routes
 */
import express from 'express';
import envatoConfig from '../../../products/envato.js';
import { handleProxyRequest } from '../../controllers/proxyController.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import { 
  processEnvatoDownload,
  proxyEnvatoAssets,
  proxyEnvatoImages,
  proxyEnvatoAccount,
  proxyEnvatoApi,
  proxyEnvatoWithPuppeteer  // ✅ ADD THIS
} from './handlers/envatoHandlers.js';

const router = express.Router();

// Logging middleware
router.use((req, res, next) => {
  console.log('\n========================================');
  console.log('🚨 [ENVATO ROUTER] Incoming request');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Path:', req.path);
  console.log('   Original URL:', req.originalUrl);
  console.log('   Base URL:', req.baseUrl);
  console.log('========================================\n');
  next();
});

// CORS middleware
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, envatoConfig.displayName, 'default');
});

// Download endpoint
router.post('/download_and_license.json', processEnvatoDownload);

// Asset routes
router.use('/assets', proxyEnvatoAssets);
router.use('/images', proxyEnvatoImages);
router.use('/account', proxyEnvatoAccount);
router.use('/data-api', (req, res) => proxyEnvatoApi(req, res, 'data-api'));
router.use('/elements-api', (req, res) => proxyEnvatoApi(req, res, 'elements-api'));

// Static JSON
router.get('/user_collections.json', (req, res) => {
  return res.json({ data: [] });
});

router.get('/infrastructure_availability.json', (req, res) => {
  return res.json({
    market: { available: true, scheduledMaintenance: false },
    identity: { available: true, scheduledMaintenance: false },
    rss: { available: true, scheduledMaintenance: false },
    area51: { available: true, scheduledMaintenance: false }
  });
});

// Lazy API - keep the /lazy prefix in the URL
router.use('/lazy', async (req, res) => {
  try {
    const userData = await decryptUserCookies(req);
    if (userData.redirect) return res.redirect(userData.redirect);
    
    const prefix = userData.prefix;
    const apiData = await getDataFromApiWithoutVerify(prefix);
    const accountsArray = apiData.access_configuration_preferences[0].accounts;
    const currentIndex = getCurrentRotationIndex(accountsArray.length);
    let cookiesArray = accountsArray[currentIndex];
    
    if (typeof cookiesArray === 'string') {
      cookiesArray = JSON.parse(cookiesArray);
    }
    
    const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Keep /data-api/lazy in the path
    const targetUrl = `https://elements.envato.com/data-api${req.url}`;
    
    console.log('🎯 Lazy API:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'accept': 'application/json',
        'user-agent': USER_AGENT,
        'Cookie': cookieString
      },
      validateStatus: () => true
    });
    
    if (response.status === 404) {
      return res.status(200).json({ data: [] });
    }
    
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('❌ Lazy API error:', error.message);
    return res.status(200).json({ data: [] });
  }
});
// Add this BEFORE the auto-router section
router.get('/manifest.webmanifest', (req, res) => {
  const productCookie = req.cookies.product || '';
  
  if (productCookie === 'envato') {
    return res.json({
      name: "Envato Elements",
      short_name: "Elements",
      start_url: "/envato",
      display: "standalone",
      theme_color: "#82b541",
      background_color: "#ffffff",
      icons: []
    });
  }
  
  // Default
  return res.json({
    name: "ToolsZilla",
    short_name: "ToolsZilla",
    start_url: "/",
    display: "standalone",
    icons: []
  });
});
router.get('/favicon.svg', (req, res) => {
  return handleProxyRequest(req, res, envatoConfig);
});

// ✅ CHANGED: Use Puppeteer instead of Axios
router.use('/', (req, res) => {
  console.log('✅ HIT ROOT ROUTE - Using standard proxy');
  return handleProxyRequest(req, res, envatoConfig);
});

export default router;