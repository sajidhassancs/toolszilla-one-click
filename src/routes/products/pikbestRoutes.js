/**
 * Pikbest Routes
 * Product-specific routes for Pikbest
 */
import express from 'express';
import pikbestConfig from '../../../products/pikbest.js';
import { showLimitReachedPage } from '../../controllers/downloadController.js';
import {
  proxyPikbestWithAxios,
  proxyPikbestAPI,
  proxyPikbestImages
} from './handlers/pikbestHandlers.js';

const router = express.Router();

console.log('🎨 [PIKBEST] Router initialized');

// Limit reached page
router.get('/limit-reached', (req, res) => {
  return showLimitReachedPage(req, res, pikbestConfig.displayName, 'default');
});

// ============================================
// ✅ SPECIAL ROUTES
// ============================================

// Manifest
router.get('/manifest.json', (req, res) => {
  console.log('📄 [PIKBEST] Manifest route hit');
  return res.status(200).json({
    name: "Pikbest",
    short_name: "Pikbest",
    start_url: "/pikbest/",
    display: "standalone",
    icons: []
  });
});

// ============================================
// ✅ API ROUTES
// ============================================

// API calls
router.use('/api', (req, res) => {
  console.log('🔌 [PIKBEST] API route hit:', req.originalUrl);
  console.log('   Query:', req.query);
  console.log('   Method:', req.method);
  return proxyPikbestAPI(req, res);
});

// ✅ ADD: Download endpoint (in case it's separate)
router.get('/download', (req, res) => {
  console.log('📥 [PIKBEST] Download route hit:', req.originalUrl);
  return proxyPikbestAPI(req, res);
});

router.post('/download', (req, res) => {
  console.log('📥 [PIKBEST] Download POST route hit:', req.originalUrl);
  return proxyPikbestAPI(req, res);
});


// Main image CDN
router.use('/img', (req, res) => {
  console.log('🎨 [PIKBEST] IMG route hit:', req.path);
  return proxyPikbestImages(req, res, 'img.pikbest.com');
});

// Image CDN 01
router.use('/img01', (req, res) => {
  console.log('🎨 [PIKBEST] IMG01 route hit:', req.path);
  return proxyPikbestImages(req, res, 'img01.pikbest.com');
});

// Image CDN 02
router.use('/img02', (req, res) => {
  console.log('🎨 [PIKBEST] IMG02 route hit:', req.path);
  return proxyPikbestImages(req, res, 'img02.pikbest.com');
});

// Image CDN 03
router.use('/img03', (req, res) => {
  console.log('🎨 [PIKBEST] IMG03 route hit:', req.path);
  return proxyPikbestImages(req, res, 'img03.pikbest.com');
});

// Static files
router.use('/static', (req, res) => {
  console.log('🎨 [PIKBEST] Static route hit:', req.path);
  return proxyPikbestImages(req, res, 'static.pikbest.com');
});

// ✅ FIX: CSS files
router.use('/css', (req, res) => {
  console.log('🎨 [PIKBEST] CSS route hit:', req.path);
  return proxyPikbestImages(req, res, 'static.pikbest.com');
});

// ✅ FIX: JavaScript files
router.use('/js', (req, res) => {
  console.log('🎨 [PIKBEST] JS route hit:', req.path);
  return proxyPikbestImages(req, res, 'js.pikbest.com');
});

// ✅ Download handler (BEFORE CATCH-ALL)
router.get('/', async (req, res) => {
  if (req.query.m === 'download') {
    console.log('📥 [PIKBEST] Download endpoint hit:', req.query);
    const { id, flag } = req.query;
    if (!id || !flag) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    req.url = `/api/AjaxDownload/download?id=${id}&flag=${flag}`;
    return proxyPikbestAPI(req, res);
  }
  return proxyPikbestWithAxios(req, res);
});
// ============================================
// 🎭 CATCH-ALL FOR HTML PAGES (MUST BE LAST!)
// ============================================
router.use((req, res) => {
  console.log('🎨 [PIKBEST] Catch-all handler triggered');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Original URL:', req.originalUrl);
  return proxyPikbestWithAxios(req, res);
});

// ✅ Export default router
export default router;