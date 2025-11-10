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

// Lazy API
router.use('/lazy', (req, res) => proxyEnvatoApi(req, res, 'data-api'));

// Manifest
router.get('/manifest.webmanifest', (req, res) => {
  return res.json({
    name: "Envato Elements",
    short_name: "Elements", 
    start_url: "/envato",
    display: "standalone",
    theme_color: "#82b541",
    background_color: "#ffffff",
    icons: []
  });
});

router.get('/favicon.svg', (req, res) => {
  return handleProxyRequest(req, res, envatoConfig);
});

// ✅ CHANGED: Use Puppeteer instead of Axios
router.use('/', (req, res) => {
  console.log('✅ HIT ROOT ROUTE - Using Puppeteer proxy');
  return proxyEnvatoWithPuppeteer(req, res);
});

export default router;